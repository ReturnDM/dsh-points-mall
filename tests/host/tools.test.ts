import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rm, unlink, writeFile } from 'node:fs/promises'
import { hostname, tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'

const module = await import('../../src/host/tools.ts')

test('the conversation reward tool enforces required parameters, preserves retry ids, and returns balance and level', async () => {
  assert.ok(module?.createPointsTools, 'the plugin must provide DSH conversation tools')
  const { PointsHostService } = await import('../../src/host/service.ts')
  const root = await mkdtemp(join(tmpdir(), 'points-tools-'))
  try {
    const dataDir = join(root, 'data')
    const service = new PointsHostService(() => ({ dataDir, timeZone: 'Asia/Shanghai', setupVersion: 1, jevEnabled: false }), dataDir)
    await service.initialize()
    const tools = module.createPointsTools(service)
    const earn = tools.find(tool => tool.name === 'points_mall_earn')
    assert.ok(earn)
    await assert.rejects(earn.execute({ title: '缺少积分' }, {} as never))
    const result = await earn.execute({ title: '完成阅读', points: 20, note: '按固定规则', idempotencyKey: 'read-once' }, {} as never)
    assert.equal((result as any).summary.balance, 20)
    assert.equal((result as any).summary.level, 1)
    assert.equal((result as any).summary.todayEarned, 20)
    const retry = await earn.execute({ title: '完成阅读', points: 20, note: '按固定规则', idempotencyKey: 'read-once' }, {} as never)
    assert.equal((retry as any).duplicate, true)
    assert.equal((retry as any).summary.balance, 20)
    const summary = tools.find(tool => tool.name === 'points_mall_summary')
    assert.ok(summary)
    assert.equal(((await summary.execute({}, {} as never)) as any).balance, 20)
    for (const name of ['points_mall_rules', 'points_mall_list', 'points_mall_doctor']) {
      const read = tools.find(tool => tool.name === name)
      assert.ok(read)
      const value = await read.execute({}, {} as never) as any
      assert.ok(value.summary, 'read tools must include a current points summary')
      assert.equal(value.summary.balance, 20)
      assert.equal(value.summary.level, 1)
      assert.equal(value.summary.todayEarned, 20)
    }
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('the review tool reads real rules and produces advice without earning points', async () => {
  assert.ok(module?.createPointsTools, 'the plugin must provide an optional reward review tool')
  const { PointsHostService } = await import('../../src/host/service.ts')
  const root = await mkdtemp(join(tmpdir(), 'points-review-'))
  try {
    const dataDir = join(root, 'data')
    const service = new PointsHostService(() => ({ dataDir, timeZone: 'Asia/Shanghai', setupVersion: 1, jevEnabled: true }), dataDir, {
      async judge(input) {
        assert.ok(input.rulesMarkdown?.includes('固定事项'))
        assert.equal((input as any).tasks.tasks.find((task: any) => task.id === 'reading').points, 20)
        assert.equal(input.task, '阅读半小时')
        assert.equal(input.proposedPoints, 20)
        return { status: 'reviewed', accepted: true, probability: 0.9, message: '符合规则' }
      },
    })
    await service.initialize()
    const judge = module.createPointsTools(service).find(tool => tool.name === 'points_mall_judge')
    assert.ok(judge)
    const result = await judge.execute({ task: '阅读半小时', proposedPoints: 20, rulesMarkdown: '伪造规则' }, { signal: new AbortController().signal } as never)
    assert.equal((result as any).status, 'reviewed')
    assert.ok((result as any).summary, 'review advice must include a current points summary')
    assert.equal((result as any).summary.balance, 0)
    assert.equal((await service.summary() as any).balance, 0)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('cancelling a reward while waiting for the real ledger lock prevents a later write', async () => {
  const { PointsHostService } = await import('../../src/host/service.ts')
  const root = await mkdtemp(join(tmpdir(), 'points-cancel-'))
  try {
    const dataDir = join(root, 'data')
    const service = new PointsHostService(() => ({ dataDir, timeZone: 'Asia/Shanghai', setupVersion: 1, jevEnabled: false }), dataDir)
    await service.initialize()
    const lockPath = join(dataDir, '.ledger.lock')
    const lockOwner = { pid: process.pid, host: hostname(), token: 'controlled-live-owner' }
    await writeFile(lockPath, JSON.stringify(lockOwner), { flag: 'wx' })
    const earn = module.createPointsTools(service).find(tool => tool.name === 'points_mall_earn')
    assert.ok(earn)
    const cancellation = new AbortController()
    const result = earn.execute({ title: '等待时已取消', points: 37 }, { signal: cancellation.signal } as never)
      .then(value => ({ status: 'fulfilled' as const, value }), error => ({ status: 'rejected' as const, error }))
    await delay(80)
    cancellation.abort()
    await delay(25)
    assert.deepEqual(JSON.parse(await readFile(lockPath, 'utf8')), lockOwner, 'cancellation must preserve another writer’s live lock')
    await unlink(lockPath)
    const outcome = await result
    assert.equal(outcome.status, 'rejected', 'a cancelled tool must not write after the lock becomes available')
    if (outcome.status === 'rejected') assert.equal(outcome.error.name, 'AbortError')
    assert.equal((await service.summary() as any).balance, 0)
    assert.deepEqual(await service.list(), [])
    assert.deepEqual(await readdir(join(dataDir, 'ledger')), [])
    await assert.rejects(readFile(lockPath), { code: 'ENOENT' })
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('every mutating tool respects a cancellation that already happened before dispatch', async () => {
  const { PointsHostService } = await import('../../src/host/service.ts')
  const root = await mkdtemp(join(tmpdir(), 'points-cancel-before-'))
  try {
    const dataDir = join(root, 'data')
    const service = new PointsHostService(() => ({ dataDir, timeZone: 'Asia/Shanghai', setupVersion: 1, jevEnabled: false }), dataDir)
    await service.initialize()
    const tools = module.createPointsTools(service)
    const cancellation = new AbortController()
    cancellation.abort()
    for (const [name, args] of [
      ['points_mall_earn', { title: '已取消奖励', points: 5 }],
      ['points_mall_adjust', { ref: 'unused-reference' }],
      ['points_mall_redeem', { itemId: 'relax-break' }],
      ['points_mall_use', { ref: 'unused-reference' }],
      ['points_mall_recycle', { ref: 'unused-reference' }],
    ] as const) {
      const tool = tools.find(tool => tool.name === name)
      assert.ok(tool)
      await assert.rejects(tool.execute(args, { signal: cancellation.signal } as never), { name: 'AbortError' }, name)
    }
    assert.equal((await service.summary() as any).balance, 0)
    assert.deepEqual(await service.list(), [])
  } finally { await rm(root, { recursive: true, force: true }) }
})
