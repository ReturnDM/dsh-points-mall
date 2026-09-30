import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import * as Cordis from '@deepseek-ai/cordis'
import { JSDOM } from 'jsdom'
import * as pointsClient from '../../src/client/index.tsx'
const { apply } = pointsClient

const ready = { status: 'ready', balance: 42, totalExp: 180, level: 2, expInLevel: 80, expRequired: 110, expToNext: 30, progress: 80 / 110, todayEarned: 12, day: '2026-09-30', timeZone: 'Asia/Shanghai', updatedAt: '2026-09-30T12:00:00.000Z' }

test('client mounts its authenticated Remote contract and removes stream, reset, and form subscriptions together', async t => {
  let requests = 0
  t.mock.method(globalThis, 'fetch', async path => {
    assert.equal(path, 'api/points-mall/summary')
    requests++
    return new Response(JSON.stringify(ready))
  })
  let mounted
  let streamSignal
  let remoteDisposals = 0
  let formDisposals = 0
  let resetDisposals = 0
  let reset
  let pollingEffect
  const ctx = {
    remote: {
      async $mount(contribution) { mounted = contribution; return () => { remoteDisposals++ } },
      pointsMallUpdates: {
        watch(signal) {
          streamSignal = signal
          return (async function* () {
            yield { revision: 0 }
            if (!signal.aborted) await new Promise(resolve => signal.addEventListener('abort', resolve, { once: true }))
          })()
        },
      },
    },
    configForms: { get: () => ({ subscribe: () => () => { formDisposals++ } }) },
    pluginNavigation: { openBundle() {} },
    slots: { inject() {} },
    inject(names, callback) {
      assert.deepEqual(names, ['remote.pointsMallUpdates'])
      const cleanup = callback(ctx)
      return Object.assign(Promise.resolve(), { dispose: async () => cleanup() })
    },
    on(event, listener) {
      assert.equal(event, 'connection/reset')
      reset = listener
      return () => { resetDisposals++ }
    },
    effect(callback, label) {
      if (label === 'points-mall: summary polling') pollingEffect = Promise.resolve(callback())
    },
  }
  apply(ctx)
  const dispose = await pollingEffect
  let disposed = false
  t.after(() => { if (!disposed) return dispose() })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(mounted?.package, 'dsh-points-mall')
  assert.equal(mounted.descriptors.length, 1)
  const descriptor = mounted.descriptors[0]
  assert.deepEqual({ service: descriptor.service, namespace: descriptor.namespace, method: descriptor.method, mode: descriptor.mode, parameters: descriptor.parameters, cancellation: descriptor.cancellation }, {
    service: 'pointsMallUpdates', namespace: 'pointsMallUpdates', method: 'watch', mode: 'stream', parameters: [], cancellation: { parameter: 'signal' },
  })
  assert.equal(requests, 1)
  const beforeReset = streamSignal
  reset()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(beforeReset.aborted, true)
  assert.equal(requests, 2)
  await dispose()
  disposed = true
  assert.equal(streamSignal.aborted, true)
  assert.equal(remoteDisposals, 1)
  assert.equal(formDisposals, 1)
  assert.equal(resetDisposals, 1)
})

async function nativeClientModule(packageName) {
  const require = createRequire(import.meta.url)
  let definition
  runInNewContext(await readFile(require.resolve(`${packageName}/client`), 'utf8'), {
    window: { __ModuleLoader__: { load(value) { definition = value } } },
    AbortController, AbortSignal, setTimeout, clearTimeout, console,
    crypto: globalThis.crypto,
  })
  return definition.factory(name => {
    assert.equal(name, '@deepseek-ai/cordis')
    return Cordis
  })
}

test('real Cordis and native Gateway mount then inject the dynamic update namespace without parking startup', async t => {
  const dom = new JSDOM('', { pretendToBeVisual: true })
  const previousWindow = globalThis.window
  const previousDocument = globalThis.document
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  t.after(() => {
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
    if (previousDocument === undefined) delete globalThis.document
    else globalThis.document = previousDocument
    dom.window.close()
  })
  const root = new Cordis.Context()
  const requests = []
  let updatesSignal
  root.provide('connection', {
    isLoopback: true,
    generation: { getSnapshot: () => undefined, subscribe: () => () => {} },
    registerGenerationSource: () => () => {},
    start: () => ({ stop() {} }),
    rpc: {
      open(channel, endpoint, payload, signal) {
        assert.equal(channel, '/api')
        assert.equal(endpoint, 'pointsMallUpdates/watch')
        assert.deepEqual({ ...payload.args }, {})
        updatesSignal = signal
        requests.push(endpoint)
        return (async function* () {
          yield { revision: 0 }
          if (!signal.aborted) await new Promise(resolve => signal.addEventListener('abort', resolve, { once: true }))
        })()
      },
    },
  })
  root.provide('slots', { inject() {} })
  root.provide('configForms', { get: () => ({ subscribe: () => () => {} }) })
  root.provide('pluginNavigation', { openBundle() {} })
  const registry = root.plugin(await nativeClientModule('@deepseek-ai/dsh-typert-registry'))
  await registry
  t.after(() => registry.dispose())
  const gateway = root.plugin(await nativeClientModule('@deepseek-ai/dsh-api-gateway'))
  await gateway
  t.after(() => gateway.dispose())
  let reads = 0
  t.mock.method(globalThis, 'fetch', async () => { reads++; return new Response(JSON.stringify(ready)) })
  const plugin = root.plugin(pointsClient)
  await plugin
  t.after(() => plugin.dispose())
  // Await real owned effects, including the asynchronous namespace mount.
  await new Promise(resolve => setTimeout(resolve, 30))
  assert.deepEqual(requests, ['pointsMallUpdates/watch'])
  assert.equal(reads, 1)
  await plugin.dispose()
  assert.equal(updatesSignal.aborted, true)
})
