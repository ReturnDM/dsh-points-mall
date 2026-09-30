import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { JSDOM } from 'jsdom'

const module = await import('../../src/client/summary.ts').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {}
  throw error
})
const ready = { status: 'ready', balance: 42, totalExp: 180, level: 2, expInLevel: 80, expRequired: 110, expToNext: 30, progress: 80 / 110, todayEarned: 12, day: '2026-09-30', timeZone: 'Asia/Shanghai', updatedAt: '2026-09-30T12:00:00.000Z' }

test('malformed host summaries become errors instead of plausible zero balances', () => {
  assert.equal(typeof module.decodeSummary, 'function', 'summary validation is not implemented')
  assert.deepEqual(module.decodeSummary(ready), ready)
  assert.throws(() => module.decodeSummary({ ...ready, balance: '42' }), /积分数据/)
  assert.throws(() => module.decodeSummary({ ...ready, progress: 1.1 }), /积分数据/)
  assert.throws(() => module.decodeSummary({ status: 'ready' }), /积分数据/)
  assert.equal(module.decodeSummary({ status: 'unconfigured', defaultDataDir: '/data', timeZone: 'Asia/Shanghai' }).status, 'unconfigured')
})

test('level progress rejects contradictory experience counts before rendering an invalid progressbar', () => {
  assert.throws(() => module.decodeSummary({ ...ready, expInLevel: 120 }), /积分数据/)
  assert.throws(() => module.decodeSummary({ ...ready, expToNext: 31 }), /积分数据/)
  assert.throws(() => module.decodeSummary({ ...ready, progress: 0.1 }), /积分数据/)
})

test('slow summary requests never overlap and disposed stores stop publishing', async t => {
  assert.equal(typeof module.SummaryStore, 'function', 'summary polling is not implemented')
  let active = 0
  let maximumActive = 0
  let received = 0
  const server = createServer((_req, res) => {
    active++
    received++
    maximumActive = Math.max(maximumActive, active)
    setTimeout(() => {
      active--
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(ready))
    }, 60)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => server.close())
  const url = `http://127.0.0.1:${server.address().port}/api/points-mall/summary`
  const store = new module.SummaryStore({ url, intervalMs: 20, timeoutMs: 500 })
  let snapshots = 0
  store.subscribe(() => { snapshots++ })
  store.start()
  store.refresh()
  store.refresh()
  await new Promise(resolve => setTimeout(resolve, 150))
  assert.equal(maximumActive, 1)
  assert.equal(store.getSnapshot().status, 'ready')
  store.dispose()
  const before = snapshots
  const requestsBefore = received
  await new Promise(resolve => setTimeout(resolve, 100))
  assert.equal(snapshots, before)
  assert.equal(received, requestsBefore)
})

test('HTTP failures present a recovery state and a later refresh restores the card', async t => {
  assert.equal(typeof module.SummaryStore, 'function', 'summary polling is not implemented')
  let failed = true
  const server = createServer((_req, res) => {
    res.statusCode = failed ? 503 : 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(failed ? { error: { message: 'temporarily unavailable' } } : ready))
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => server.close())
  const store = new module.SummaryStore({ url: `http://127.0.0.1:${server.address().port}/summary`, intervalMs: 5000 })
  t.after(() => store.dispose())
  await store.refresh()
  assert.equal(store.getSnapshot().status, 'error')
  failed = false
  await store.refresh()
  assert.equal(store.getSnapshot().balance, 42)
})

test('summary HTML errors are localized, preserve HTTP status, and recover on refresh', async t => {
  let mode = 'html'
  const server = createServer((_req, res) => {
    if (mode === 'ready') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(ready)); return }
    res.statusCode = mode === 'gateway' ? 502 : 200
    res.setHeader('Content-Type', 'text/html')
    res.end('<html>proxy failure</html>')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => server.close())
  const store = new module.SummaryStore({ url: `http://127.0.0.1:${server.address().port}/summary` })
  t.after(() => store.dispose())
  await store.refresh()
  assert.match(store.getSnapshot().message, /返回.*JSON.*重试/)
  mode = 'gateway'
  await store.refresh()
  assert.match(store.getSnapshot().message, /HTTP 502/)
  mode = 'ready'
  await store.refresh()
  assert.equal(store.getSnapshot().balance, 42)
})

test('default polling waits thirty seconds between completed requests', async t => {
  let requests = 0
  // Keep real response parsing; isolate the scheduler from network dispatch latency.
  t.mock.method(globalThis, 'fetch', async () => { requests++; return new Response(JSON.stringify(ready)) })
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const store = new module.SummaryStore()
  t.after(() => store.dispose())
  const nextSnapshot = () => new Promise(resolve => {
    const unsubscribe = store.subscribe(() => { unsubscribe(); resolve() })
  })
  const first = nextSnapshot()
  store.start()
  await first
  t.mock.timers.tick(29999)
  assert.equal(requests, 1)
  const second = nextSnapshot()
  t.mock.timers.tick(1)
  await second
  assert.equal(requests, 2)
})

test('hidden pages suspend requests and visibility plus focus wake one refresh; disposal removes wakeups', async t => {
  let requests = 0
  const server = createServer((_req, res) => { requests++; res.end(JSON.stringify(ready)) })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => server.close())
  const dom = new JSDOM('', { pretendToBeVisual: true })
  t.after(() => dom.window.close())
  let hidden = true
  Object.defineProperty(dom.window.document, 'hidden', { get: () => hidden })
  const store = new module.SummaryStore({ url: `http://127.0.0.1:${server.address().port}/summary`, document: dom.window.document, intervalMs: 20 })
  t.after(() => store.dispose())
  const nextSnapshot = () => new Promise(resolve => {
    const unsubscribe = store.subscribe(() => { unsubscribe(); resolve() })
  })
  store.start()
  await new Promise(resolve => setTimeout(resolve, 35))
  assert.equal(requests, 0)
  const first = nextSnapshot()
  hidden = false
  dom.window.document.dispatchEvent(new dom.window.Event('visibilitychange'))
  dom.window.dispatchEvent(new dom.window.Event('focus'))
  await first
  hidden = true
  dom.window.document.dispatchEvent(new dom.window.Event('visibilitychange'))
  await new Promise(resolve => setTimeout(resolve, 55))
  assert.equal(requests, 1)
  const second = nextSnapshot()
  hidden = false
  dom.window.document.dispatchEvent(new dom.window.Event('visibilitychange'))
  dom.window.dispatchEvent(new dom.window.Event('focus'))
  await second
  assert.equal(requests, 2)
  store.dispose()
  dom.window.dispatchEvent(new dom.window.Event('focus'))
  dom.window.document.dispatchEvent(new dom.window.Event('visibilitychange'))
  await new Promise(resolve => setTimeout(resolve, 35))
  assert.equal(requests, 2)
})

function updateSource(initialRevision = 0) {
  let revision = initialRevision
  const generations = []
  return {
    generations,
    setRevision(value) { revision = value },
    open(signal) {
      const frames = revision === null ? [] : [{ revision }]
      let wake
      let ended = false
      const generation = {
        signal,
        push(frame) { frames.push(frame); wake?.() },
        end() { ended = true; wake?.() },
      }
      generations.push(generation)
      return (async function* () {
        const aborted = () => wake?.()
        signal.addEventListener('abort', aborted, { once: true })
        try {
          while (!signal.aborted && !ended) {
            if (frames.length) { yield frames.shift(); continue }
            await new Promise(resolve => { wake = resolve })
          }
        } finally {
          signal.removeEventListener('abort', aborted)
        }
      })()
    },
  }
}

test('write invalidations refresh immediately while an opening baseline and repeated revision do not', async t => {
  let requests = 0
  const source = updateSource()
  const server = createServer((_req, res) => {
    requests++
    res.end(JSON.stringify({ ...ready, balance: requests === 1 ? 42 : 55 }))
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => server.close())
  const store = new module.SummaryStore({ url: `http://127.0.0.1:${server.address().port}/summary`, updates: source.open })
  t.after(() => store.dispose())
  const nextSnapshot = () => new Promise(resolve => {
    const unsubscribe = store.subscribe(() => { unsubscribe(); resolve() })
  })
  const initial = nextSnapshot()
  store.start()
  await initial
  assert.equal(source.generations.length, 1)
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(requests, 1)
  const updated = nextSnapshot()
  source.generations[0].push({ revision: 1 })
  await updated
  assert.equal(store.getSnapshot().balance, 55)
  source.generations[0].push({ revision: 1 })
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(requests, 2)
  store.dispose()
  assert.equal(source.generations[0].signal.aborted, true)
})

test('update streams stop while hidden, reopen when visible, and reset with the native connection', async t => {
  const dom = new JSDOM('', { pretendToBeVisual: true })
  t.after(() => dom.window.close())
  let hidden = false
  Object.defineProperty(dom.window.document, 'hidden', { get: () => hidden })
  const source = updateSource()
  let requests = 0
  t.mock.method(globalThis, 'fetch', async () => { requests++; return new Response(JSON.stringify(ready)) })
  const store = new module.SummaryStore({ document: dom.window.document, updates: source.open })
  t.after(() => store.dispose())
  store.start()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(source.generations.length, 1)
  hidden = true
  dom.window.document.dispatchEvent(new dom.window.Event('visibilitychange'))
  assert.equal(source.generations[0].signal.aborted, true)
  const hiddenRequests = requests
  source.generations[0].push({ revision: 1 })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(requests, hiddenRequests)
  hidden = false
  dom.window.document.dispatchEvent(new dom.window.Event('visibilitychange'))
  dom.window.dispatchEvent(new dom.window.Event('focus'))
  await new Promise(resolve => setTimeout(resolve, 10))
  assert.equal(source.generations.length, 2)
  assert.equal(requests, hiddenRequests + 1)
  store.reconnectUpdates()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(source.generations[1].signal.aborted, true)
  assert.equal(source.generations.length, 3)
  assert.equal(requests, hiddenRequests + 2)
  store.dispose()
  assert.equal(source.generations[2].signal.aborted, true)
  store.reconnectUpdates()
  assert.equal(source.generations.length, 3)
})

test('unavailable update streams retry with increasing delays while polling remains a bounded fallback', async t => {
  const openedAt = []
  let clock = 0
  let summaryRequests = 0
  const store = new module.SummaryStore({
    updates() { openedAt.push(clock); throw new Error('carrier unavailable') },
  })
  t.after(() => store.dispose())
  t.mock.method(globalThis, 'fetch', async () => { summaryRequests++; return new Response(JSON.stringify(ready)) })
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const tick = async duration => {
    clock += duration
    t.mock.timers.tick(duration)
    await new Promise(resolve => setImmediate(resolve))
  }
  store.start()
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(openedAt, [0])
  await tick(999)
  assert.deepEqual(openedAt, [0])
  await tick(1)
  assert.deepEqual(openedAt, [0, 1000])
  await tick(1999)
  assert.deepEqual(openedAt, [0, 1000])
  await tick(1)
  assert.deepEqual(openedAt, [0, 1000, 3000])
  await tick(4000)
  assert.deepEqual(openedAt, [0, 1000, 3000, 7000])
  await tick(8000)
  assert.deepEqual(openedAt, [0, 1000, 3000, 7000, 15000])
  await tick(16000)
  assert.deepEqual(openedAt, [0, 1000, 3000, 7000, 15000, 31000])
  assert.equal(summaryRequests, 2)
  await tick(29999)
  assert.equal(openedAt.length, 6)
  await tick(1)
  assert.equal(openedAt.length, 7)
  assert.equal(summaryRequests, 3)
  store.dispose()
  await tick(60000)
  assert.equal(openedAt.length, 7)
  assert.equal(summaryRequests, 3)
})

test('a reconnect after stream loss refreshes writes missed before the new baseline', async t => {
  let requests = 0
  const source = updateSource()
  t.mock.method(globalThis, 'fetch', async () => { requests++; return new Response(JSON.stringify({ ...ready, balance: requests === 1 ? 42 : 55 })) })
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const store = new module.SummaryStore({ updates: source.open })
  t.after(() => store.dispose())
  store.start()
  await new Promise(resolve => setImmediate(resolve))
  source.setRevision(1)
  source.generations[0].end()
  await new Promise(resolve => setImmediate(resolve))
  t.mock.timers.tick(999)
  assert.equal(requests, 1)
  t.mock.timers.tick(1)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(source.generations.length, 2)
  assert.equal(requests, 2)
  assert.equal(store.getSnapshot().balance, 55)
})

test('a changed baseline after a connection reset is covered by its single summary read', async t => {
  let requests = 0
  const source = updateSource()
  t.mock.method(globalThis, 'fetch', async () => { requests++; return new Response(JSON.stringify(ready)) })
  const store = new module.SummaryStore({ updates: source.open })
  t.after(() => store.dispose())
  store.start()
  await new Promise(resolve => setImmediate(resolve))
  source.setRevision(1)
  store.reconnectUpdates()
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(requests, 2)
})

test('hiding cancels an active read quietly and the next visible refresh restores the card', async t => {
  const dom = new JSDOM('', { pretendToBeVisual: true })
  t.after(() => dom.window.close())
  let hidden = false
  Object.defineProperty(dom.window.document, 'hidden', { get: () => hidden })
  let requests = 0
  let firstSignal
  t.mock.method(globalThis, 'fetch', async (_path, { signal }) => {
    requests++
    if (requests > 1) return new Response(JSON.stringify(ready))
    firstSignal = signal
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }))
  })
  const store = new module.SummaryStore({ document: dom.window.document })
  t.after(() => store.dispose())
  const snapshots = []
  store.subscribe(() => snapshots.push(store.getSnapshot()))
  store.start()
  hidden = true
  dom.window.document.dispatchEvent(new dom.window.Event('visibilitychange'))
  assert.equal(firstSignal.aborted, true)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(snapshots.length, 0)
  hidden = false
  dom.window.document.dispatchEvent(new dom.window.Event('visibilitychange'))
  dom.window.dispatchEvent(new dom.window.Event('focus'))
  await new Promise(resolve => setTimeout(resolve, 10))
  assert.equal(requests, 2)
  assert.equal(store.getSnapshot().balance, 42)
})

test('a prompt opening baseline precedes the initial read so writes during stream registration are shown', async t => {
  const source = updateSource(null)
  let balance = 42
  let requests = 0
  t.mock.method(globalThis, 'fetch', async () => {
    requests++
    return new Response(JSON.stringify({ ...ready, balance }))
  })
  const store = new module.SummaryStore({ updates: source.open, baselineWaitMs: 1000 })
  t.after(() => store.dispose())
  store.start()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(requests, 0)
  balance = 55
  source.generations[0].push({ revision: 1 })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(requests, 1)
  assert.equal(store.getSnapshot().balance, 55)
})

test('a late opening baseline rereads a write after the fast startup fallback has displayed old data', async t => {
  const source = updateSource(null)
  let balance = 42
  let requests = 0
  t.mock.method(globalThis, 'fetch', async () => {
    requests++
    return new Response(JSON.stringify({ ...ready, balance }))
  })
  const store = new module.SummaryStore({ updates: source.open, baselineWaitMs: 10 })
  t.after(() => store.dispose())
  store.start()
  await new Promise(resolve => setTimeout(resolve, 25))
  assert.equal(requests, 1)
  assert.equal(store.getSnapshot().balance, 42)
  balance = 55
  source.generations[0].push({ revision: 1 })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(requests, 2)
  assert.equal(store.getSnapshot().balance, 55)
})

test('a baseline after a stale in-flight fallback queues a fresh read without overlapping it', async t => {
  const source = updateSource(null)
  let releaseFirst
  let requests = 0
  t.mock.method(globalThis, 'fetch', async () => {
    requests++
    if (requests === 1) return new Promise(resolve => { releaseFirst = () => resolve(new Response(JSON.stringify(ready))) })
    return new Response(JSON.stringify({ ...ready, balance: 55 }))
  })
  const store = new module.SummaryStore({ updates: source.open, baselineWaitMs: 10 })
  t.after(() => store.dispose())
  store.start()
  await new Promise(resolve => setTimeout(resolve, 25))
  assert.equal(requests, 1)
  source.generations[0].push({ revision: 1 })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(requests, 1)
  releaseFirst()
  await new Promise(resolve => setTimeout(resolve, 10))
  assert.equal(requests, 2)
  assert.equal(store.getSnapshot().balance, 55)
})
