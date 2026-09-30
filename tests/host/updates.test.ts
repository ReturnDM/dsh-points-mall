import test from 'node:test'
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PointsHostService } from '../../src/host/service.ts'

const module = await import('../../src/host/updates.ts').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {} as Record<string, unknown>
  throw error
})

async function fixture() {
  const Updates = module.PointsMallUpdates as typeof import('../../src/host/updates.ts').PointsMallUpdates
  assert.equal(typeof Updates, 'function', 'points updates must provide an owned stream')
  const ctx = new Context()
  const fiber = ctx.plugin(Updates)
  await fiber.await()
  return { ctx, fiber, updates: ctx.pointsMallUpdates }
}

test('points update stream preserves changes between the initial frame and the next pull', async () => {
  const { fiber, updates } = await fixture()
  const controller = new AbortController()
  const stream = updates.watch(controller.signal)[Symbol.asyncIterator]()
  try {
    assert.deepEqual(await stream.next(), { done: false, value: { revision: 0 } })
    updates.notify()
    updates.notify()
    assert.deepEqual(await stream.next(), { done: false, value: { revision: 2 } })
    const pending = stream.next()
    controller.abort()
    assert.equal((await pending).done, true)
  } finally { controller.abort(); await fiber.dispose() }
})

test('disposing the points plugin releases a pending update stream', async () => {
  const { fiber, updates } = await fixture()
  const controller = new AbortController()
  const stream = updates.watch(controller.signal)[Symbol.asyncIterator]()
  try {
    await stream.next()
    const pending = stream.next()
    await fiber.dispose()
    assert.equal((await pending).done, true)
  } finally { controller.abort(); await fiber.dispose() }
})

test('committed rewards notify the sidebar while retries and refused writes do not publish changes', async () => {
  const { fiber, updates } = await fixture()
  const root = await mkdtemp(join(tmpdir(), 'points-notify-'))
  const controller = new AbortController()
  const stream = updates.watch(controller.signal)[Symbol.asyncIterator]()
  const dataDir = join(root, 'data')
  const service = new PointsHostService(() => ({ dataDir, timeZone: 'Asia/Shanghai', setupVersion: 1, jevEnabled: false }), dataDir, undefined, () => updates.notify())
  try {
    await service.initialize()
    assert.deepEqual((await stream.next()).value, { revision: 0 })
    await service.earn({ title: '临时阅读', points: 20, idempotencyKey: 'once' })
    assert.deepEqual((await stream.next()).value, { revision: 1 })
    assert.equal((await service.earn({ title: '临时阅读', points: 20, idempotencyKey: 'once' })).duplicate, true)
    await assert.rejects(service.earn({ title: '无效奖励', points: -1 }))
    await service.earn({ title: '临时散步', points: 5 })
    assert.deepEqual((await stream.next()).value, { revision: 2 })
    assert.equal((await service.summary() as { balance: number }).balance, 25)
  } finally { controller.abort(); await fiber.dispose(); await rm(root, { recursive: true, force: true }) }
})
