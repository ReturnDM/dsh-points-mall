import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'

test('发布客户端由 DSH 加载并使用宿主提供的 React', async () => {
  const require = createRequire(import.meta.url)
  let loaded
  runInNewContext(await readFile(new URL('../../lib/client.js', import.meta.url), 'utf8'), {
    window: { __ModuleLoader__: { load: registration => { loaded = registration } } },
  })
  assert.equal(loaded.id, 'dsh-points-mall')
  const requests = []
  const exports = loaded.factory(id => { requests.push(id); return require(id) })
  assert.equal(typeof exports.apply, 'function')
  assert.ok(requests.includes('react'))
  assert.ok(requests.includes('react-dom/client'))
  assert.ok(requests.every(id => !id.startsWith('node:') && !id.includes('ledger')))
})

test('发布 Host 可以被加载并暴露真实配置与生命周期', async () => {
  const host = await import('../../lib/index.js')
  assert.equal(typeof host.apply, 'function')
  assert.equal(typeof host.Config, 'function')
  assert.ok(host.inject.includes('tools'))
  assert.ok(host.inject.includes('skills'))
  assert.ok(host.inject.includes('connection'))
})
