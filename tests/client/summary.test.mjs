import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'

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
