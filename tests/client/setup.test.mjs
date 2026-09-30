import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'

const module = await import('../../src/client/setup.ts').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {}
  throw error
})

test('existing-directory setup persists only the validated canonical path in one revision', async t => {
  assert.equal(typeof module.completeSetup, 'function', 'first-run setup is not implemented')
  const requests = []
  const server = createServer(async (req, res) => {
    let body = ''
    for await (const chunk of req) body += chunk
    requests.push({ url: req.url, body: JSON.parse(body) })
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ dataDir: '/canonical/ledger', summary: { status: 'ready' }, validation: { valid: true, issues: [], entryCount: 3 } }))
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => server.close())
  const initial = { dataDir: '', timeZone: 'Asia/Shanghai', setupVersion: 0, jevEnabled: false }
  const form = {
    getSnapshot: () => ({ status: 'ready', writable: true, mode: 'host', revision: 4, value: initial }),
    async mutate(ops, revision) {
      assert.equal(revision, 4)
      for (const op of ops) initial[op.path[0]] = op.value
      return true
    },
  }
  await module.completeSetup({ mode: 'existing', dataDir: '/chosen/ledger', timeZone: 'Asia/Shanghai', form, baseUrl: `http://127.0.0.1:${server.address().port}/api/points-mall/` })
  assert.equal(initial.dataDir, '/canonical/ledger')
  assert.equal(initial.setupVersion, 1)
  assert.deepEqual(requests, [{ url: '/api/points-mall/validate', body: { dataDir: '/chosen/ledger' } }])
})

test('invalid existing ledgers leave the stored configuration untouched', async t => {
  assert.equal(typeof module.completeSetup, 'function', 'first-run setup is not implemented')
  const server = createServer((_req, res) => {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: { code: 'INVALID_LEDGER', message: '账本含损坏记录' } }))
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => server.close())
  const form = {
    getSnapshot: () => ({ status: 'ready', writable: true, mode: 'host', revision: 1, value: { dataDir: '', setupVersion: 0 } }),
    mutate() { throw new Error('must not save an invalid ledger') },
  }
  await assert.rejects(module.completeSetup({ mode: 'existing', dataDir: '/bad', timeZone: 'Asia/Shanghai', form, baseUrl: `http://127.0.0.1:${server.address().port}/` }), /账本含损坏记录/)
})

test('initialization only marks setup complete after the host accepts the settings write', async t => {
  assert.equal(typeof module.completeSetup, 'function', 'first-run setup is not implemented')
  const server = createServer((_req, res) => {
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ dataDir: '/new/ledger', validation: { valid: true, issues: [], entryCount: 0 } }))
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => server.close())
  const form = {
    getSnapshot: () => ({ status: 'ready', writable: true, mode: 'host', revision: 1, value: { dataDir: '', setupVersion: 0 } }),
    async mutate() { return false },
  }
  await assert.rejects(module.completeSetup({ mode: 'new', dataDir: '', timeZone: 'Asia/Shanghai', form, baseUrl: `http://127.0.0.1:${server.address().port}/` }), /配置未能保存/)
})
