import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, readdir, rm, unlink, writeFile } from 'node:fs/promises'
import { hostname, tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'

const module = await import('../../src/host/tools.ts')

async function temporaryDirectory() {
  const artifacts = join(process.cwd(), '.test-artifacts')
  await mkdir(artifacts, { recursive: true })
  return mkdtemp(join(artifacts, 'host-tools-snapshot-'))
}

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

for (const name of ['points_mall_rules', 'points_mall_list', 'points_mall_doctor']) test(`${name} keeps content and summary on one captured directory and timezone`, async () => {
  const root = await temporaryDirectory()
  try {
    const { PointsHostService } = await import('../../src/host/service.ts')
    const { createLedger, initializeData } = await import('../../src/ledger/index.mjs')
    const firstDir = join(root, 'first'), nextDir = join(root, 'next')
    await initializeData(firstDir)
    await initializeData(nextDir)
    await writeFile(join(firstDir, '积分规则.md'), '# First directory rules\n')
    await writeFile(join(nextDir, '积分规则.md'), '# Next directory rules\n')
    await (await createLedger(firstDir)).earn({ title: 'First directory reward', points: 20 })
    await (await createLedger(nextDir)).earn({ title: 'Next directory reward', points: 80 })
    const first = { dataDir: firstDir, timeZone: 'UTC', setupVersion: 1, jevEnabled: false }
    const next = { dataDir: nextDir, timeZone: 'Asia/Shanghai', setupVersion: 1, jevEnabled: false }
    let configReads = 0
    const service = new PointsHostService(() => configReads++ === 0 ? first : next, firstDir)
    const tool = module.createPointsTools(service).find(tool => tool.name === name)
    assert.ok(tool)
    const result = await tool.execute({}, {} as never) as any
    if (name === 'points_mall_rules') assert.equal(result.rulesMarkdown, '# First directory rules\n')
    if (name === 'points_mall_list') assert.equal(result.entries[0].title, 'First directory reward')
    if (name === 'points_mall_doctor') assert.equal(result.entryCount, 1)
    assert.equal(result.summary.balance, 20, `${name} must summarize the same directory`)
    assert.equal(result.summary.timeZone, 'UTC', `${name} must retain the captured timezone`)
    assert.equal(configReads, 1, `${name} must capture configuration once`)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('a configuration object changed during review cannot move its result to a different ledger', async () => {
  const root = await temporaryDirectory()
  try {
    const { PointsHostService } = await import('../../src/host/service.ts')
    const { createLedger, initializeData } = await import('../../src/ledger/index.mjs')
    const firstDir = join(root, 'first'), nextDir = join(root, 'next')
    await initializeData(firstDir)
    await initializeData(nextDir)
    await (await createLedger(firstDir)).earn({ title: 'First directory reward', points: 20 })
    await (await createLedger(nextDir)).earn({ title: 'Next directory reward', points: 80 })
    const config = { dataDir: firstDir, timeZone: 'UTC', setupVersion: 1, jevEnabled: true }
    const service = new PointsHostService(() => config, firstDir, {
      async judge() {
        config.dataDir = nextDir
        config.timeZone = 'Asia/Shanghai'
        return { status: 'reviewed', accepted: true, message: 'Configuration changed during the remote review' }
      },
    })
    const tool = module.createPointsTools(service).find(tool => tool.name === 'points_mall_judge')
    assert.ok(tool)
    const result = await tool.execute({ task: '已完成阅读', proposedPoints: 20 }, {} as never) as any
    assert.equal(result.status, 'reviewed')
    assert.equal(result.summary.balance, 20)
    assert.equal(result.summary.timeZone, 'UTC')
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('the review tool keeps its enabled state, rules, and summary from one captured configuration', async () => {
  const root = await temporaryDirectory()
  try {
    const { PointsHostService } = await import('../../src/host/service.ts')
    const { createLedger, initializeData } = await import('../../src/ledger/index.mjs')
    const firstDir = join(root, 'first'), nextDir = join(root, 'next')
    await initializeData(firstDir)
    await initializeData(nextDir)
    await (await createLedger(firstDir)).earn({ title: 'First directory reward', points: 20 })
    await (await createLedger(nextDir)).earn({ title: 'Next directory reward', points: 80 })
    const first = { dataDir: firstDir, timeZone: 'UTC', setupVersion: 1, jevEnabled: true }
    const next = { dataDir: nextDir, timeZone: 'Asia/Shanghai', setupVersion: 1, jevEnabled: false }
    let configReads = 0
    const service = new PointsHostService(() => configReads++ === 0 ? first : next, firstDir, {
      async judge() { return { status: 'reviewed', accepted: true, message: 'Valid first configuration' } },
    })
    const tool = module.createPointsTools(service).find(tool => tool.name === 'points_mall_judge')
    assert.ok(tool)
    const result = await tool.execute({ task: '已完成阅读', proposedPoints: 20 }, {} as never) as any
    assert.equal(result.status, 'reviewed')
    assert.equal(result.summary.balance, 20)
    assert.equal(result.summary.timeZone, 'UTC')
    assert.equal(configReads, 1)
  } finally { await rm(root, { recursive: true, force: true }) }
})
