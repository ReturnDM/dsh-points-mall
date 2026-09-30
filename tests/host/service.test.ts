import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

const module = await import('../../src/host/service.ts')

async function temporaryDirectory() {
  const artifacts = join(process.cwd(), '.test-artifacts')
  await mkdir(artifacts, { recursive: true })
  return mkdtemp(join(artifacts, 'host-review-'))
}

test('an unconfigured plugin reports the proposed local data directory without creating a ledger', async () => {
  assert.ok(module?.PointsHostService, 'PointsHostService must report unconfigured state')
  const root = await mkdtemp(join(tmpdir(), 'points-host-'))
  try {
    const dataDir = join(root, 'data')
    const service = new module.PointsHostService(() => ({ dataDir: '', timeZone: 'Asia/Shanghai', setupVersion: 0, jevEnabled: false }), dataDir)
    assert.deepEqual(await service.summary(), { status: 'unconfigured', defaultDataDir: dataDir, timeZone: 'Asia/Shanghai' })
    assert.deepEqual(await readdir(root), [])
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('initializing a ledger leaves configuration unchanged and returns an empty ready summary', async () => {
  assert.ok(module?.PointsHostService, 'PointsHostService must initialize a ledger')
  const root = await mkdtemp(join(tmpdir(), 'points-host-'))
  try {
    const dataDir = join(root, 'data')
    const service = new module.PointsHostService(() => ({ dataDir: '', timeZone: 'Asia/Shanghai', setupVersion: 0, jevEnabled: false }), dataDir)
    const result = await service.initialize()
    assert.equal(result.dataDir, dataDir)
    assert.equal(result.summary.balance, 0)
    assert.equal(result.summary.level, 1)
    assert.equal(result.summary.expRequired, 100)
    assert.equal(result.validation.valid, true)
    assert.equal((await service.summary()).status, 'unconfigured')
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('connecting a ledger is read-only and reward writes return the current balance, level, and today total', async () => {
  assert.ok(module?.PointsHostService, 'PointsHostService must validate and write a configured ledger')
  const root = await mkdtemp(join(tmpdir(), 'points-host-'))
  try {
    const dataDir = join(root, 'data')
    const config = { dataDir: '', timeZone: 'Asia/Shanghai', setupVersion: 0, jevEnabled: false }
    const service = new module.PointsHostService(() => config, dataDir)
    await service.initialize()
    const before = await readFile(join(dataDir, 'tasks.json'), 'utf8')
    assert.equal((await service.validate(dataDir)).validation.valid, true)
    assert.equal(await readFile(join(dataDir, 'tasks.json'), 'utf8'), before)
    config.dataDir = dataDir
    config.setupVersion = 1
    const result = await service.earn({ title: '完成测试任务', points: 23, note: '临时账本' })
    assert.equal(result.summary.balance, 23)
    assert.equal(result.summary.level, 1)
    assert.equal(result.summary.todayEarned, 23)
    assert.equal((await service.summary()).balance, 23)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('validating a missing directory refuses the connection without creating files', async () => {
  assert.ok(module?.PointsHostService, 'PointsHostService must refuse missing ledgers')
  const root = await mkdtemp(join(tmpdir(), 'points-host-'))
  try {
    const dataDir = join(root, 'missing')
    const service = new module.PointsHostService(() => ({ dataDir: '', timeZone: 'Asia/Shanghai', setupVersion: 0, jevEnabled: false }), dataDir)
    await assert.rejects(service.validate(dataDir))
    assert.deepEqual(await readdir(root), [])
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('authenticated route handlers validate JSON input and expose summary, initialization, and connection previews', async () => {
  assert.ok(module?.PointsHostService, 'PointsHostService must provide route handlers')
  const root = await mkdtemp(join(tmpdir(), 'points-host-'))
  try {
    const dataDir = join(root, 'data')
    const service = new module.PointsHostService(() => ({ dataDir: '', timeZone: 'Asia/Shanghai', setupVersion: 0, jevEnabled: false }), dataDir)
    const summary = await service.fetch(new Request('http://localhost/api/points-mall/summary'))
    assert.equal(summary.status, 200)
    assert.equal((await summary.json()).status, 'unconfigured')
    const invalid = await service.fetch(new Request('http://localhost/api/points-mall/validate', { method: 'POST', body: JSON.stringify({ dataDir: 9 }) }))
    assert.equal(invalid.status, 400)
    const initialized = await service.fetch(new Request('http://localhost/api/points-mall/initialize', { method: 'POST', body: '{}' }))
    assert.equal(initialized.status, 200)
    assert.equal((await initialized.json()).summary.balance, 0)
    const validated = await service.fetch(new Request('http://localhost/api/points-mall/validate', { method: 'POST', body: JSON.stringify({ dataDir }) }))
    assert.equal(validated.status, 200)
    assert.equal((await validated.json()).dataDir, dataDir)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('disabled or unavailable review falls back before reading missing rules', async () => {
  const root = await temporaryDirectory()
  try {
    const dataDir = join(root, 'missing')
    for (const [jevEnabled, judge] of [
      [false, { async judge() { throw new Error('A disabled review must not contact Jev') } }],
      [true, undefined],
    ] as const) {
      const service = new module.PointsHostService(() => ({ dataDir, timeZone: 'Asia/Shanghai', setupVersion: 1, jevEnabled }), dataDir, judge)
      const result = await service.review('已完成阅读', 20)
      assert.equal(result.status, 'fallback')
      assert.match(result.message, /Jev/)
    }
    assert.deepEqual(await readdir(root), [])
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('an unconfigured review returns setup guidance without reading or creating files', async () => {
  const root = await temporaryDirectory()
  try {
    const dataDir = join(root, 'unused')
    const service = new module.PointsHostService(() => ({ dataDir: '', timeZone: 'Asia/Shanghai', setupVersion: 0, jevEnabled: true }), dataDir, {
      async judge() { throw new Error('An unconfigured review must not contact Jev') },
    })
    const result = await service.review('已完成阅读', 20)
    assert.equal(result.status, 'fallback')
    assert.match(result.message, /(?:配置|创建|连接).*账本/)
    assert.deepEqual(await readdir(root), [])
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('review refuses unsafe proposed integers before opening the ledger', async () => {
  const root = await temporaryDirectory()
  try {
    const dataDir = join(root, 'missing')
    const service = new module.PointsHostService(() => ({ dataDir, timeZone: 'Asia/Shanghai', setupVersion: 1, jevEnabled: false }), dataDir)
    await assert.rejects(service.review('已完成阅读', Number.MAX_SAFE_INTEGER + 1), { code: 'INVALID_REWARD' })
    assert.deepEqual(await readdir(root), [])
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('a previously cancelled review rejects before inspecting configuration or rules', async () => {
  const cancellation = new AbortController()
  cancellation.abort()
  const service = new module.PointsHostService(() => { throw new Error('Cancelled review must not inspect configuration') }, '')
  await assert.rejects(service.review('已完成阅读', 20, cancellation.signal), { name: 'AbortError' })
})

test('unreadable review rules produce a repair fallback without invented rules or a reward write', async () => {
  const root = await temporaryDirectory()
  try {
    const dataDir = join(root, 'data')
    const { initializeData } = await import('../../src/ledger/index.mjs')
    await initializeData(dataDir)
    await writeFile(join(dataDir, 'tasks.json'), '{invalid JSON')
    let requests = 0
    const service = new module.PointsHostService(() => ({ dataDir, timeZone: 'Asia/Shanghai', setupVersion: 1, jevEnabled: true }), dataDir, {
      async judge() { requests++; return { status: 'reviewed', accepted: true, message: 'This response must never be used' } },
    })
    const result = await service.review('已完成阅读', 20)
    assert.equal(result.status, 'fallback')
    assert.match(result.message, /规则.*无法读取/)
    assert.match(result.message, /修复/)
    assert.match(result.message, /(?:不要|不能|勿).*记账/)
    assert.equal(requests, 0)
    assert.deepEqual(await readdir(join(dataDir, 'ledger')), [])
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('an external judge failure gives ordinary fallback advice without changing the balance', async () => {
  const root = await temporaryDirectory()
  try {
    const dataDir = join(root, 'data')
    const { initializeData } = await import('../../src/ledger/index.mjs')
    await initializeData(dataDir)
    const service = new module.PointsHostService(() => ({ dataDir, timeZone: 'Asia/Shanghai', setupVersion: 1, jevEnabled: true }), dataDir, {
      async judge() { throw new Error('Simulated remote outage with private details') },
    })
    const result = await service.review('已完成阅读', 20)
    assert.equal(result.status, 'fallback')
    assert.match(result.message, /当前模型.*规则/)
    assert.doesNotMatch(result.message, /private details/)
    assert.equal((await service.summary() as any).balance, 0)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('review propagates cancellation even when an external judge ignores its signal', async () => {
  const root = await temporaryDirectory()
  try {
    const dataDir = join(root, 'data')
    const { initializeData } = await import('../../src/ledger/index.mjs')
    await initializeData(dataDir)
    for (const throwAfterCancel of [false, true]) {
      const cancellation = new AbortController()
      const reason = new Error('User cancelled the review')
      const service = new module.PointsHostService(() => ({ dataDir, timeZone: 'Asia/Shanghai', setupVersion: 1, jevEnabled: true }), dataDir, {
        async judge() {
          cancellation.abort(reason)
          if (throwAfterCancel) throw new Error('A late remote failure')
          return { status: 'reviewed', accepted: true, message: 'A late response' }
        },
      })
      await assert.rejects(service.review('已完成阅读', 20, cancellation.signal), error => error === reason)
    }
    const ledger = await (await import('../../src/ledger/index.mjs')).createLedger(dataDir)
    assert.equal((await ledger.summary()).balance, 0)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('a judge AbortError is propagated rather than converted to ordinary fallback', async () => {
  const root = await temporaryDirectory()
  try {
    const dataDir = join(root, 'data')
    const { initializeData } = await import('../../src/ledger/index.mjs')
    await initializeData(dataDir)
    const abort = new DOMException('Review cancelled', 'AbortError')
    const service = new module.PointsHostService(() => ({ dataDir, timeZone: 'Asia/Shanghai', setupVersion: 1, jevEnabled: true }), dataDir, {
      async judge() { throw abort },
    })
    await assert.rejects(service.review('已完成阅读', 20), error => error === abort)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('committed mutations notify once while idempotent retries, failures, and cancellations stay silent', async () => {
  const root = await temporaryDirectory()
  try {
    const dataDir = join(root, 'data')
    const { initializeData } = await import('../../src/ledger/index.mjs')
    await initializeData(dataDir)
    let notifications = 0
    const service = new module.PointsHostService(() => ({ dataDir, timeZone: 'Asia/Shanghai', setupVersion: 1, jevEnabled: false }), dataDir, undefined, () => { notifications++ })
    async function writeOnce<T extends { duplicate: boolean }>(operation: () => Promise<T>, count: number) {
      const result = await operation()
      assert.equal(result.duplicate, false)
      assert.equal(notifications, count)
      assert.equal((await operation()).duplicate, true)
      assert.equal(notifications, count, 'an idempotent retry must not announce a new commit')
      return result
    }
    const earn = await writeOnce(() => service.earn({ title: 'Initial reward', points: 200, idempotencyKey: 'notify-earn' }), 1)
    await writeOnce(() => service.adjust({ ref: earn.entry.id, points: -10, exp: -10, idempotencyKey: 'notify-adjust' }), 2)
    const used = await writeOnce(() => service.redeem({ itemId: 'relax-break', idempotencyKey: 'notify-redeem-used' }), 3)
    await writeOnce(() => service.use({ ref: used.entry.id, idempotencyKey: 'notify-use' }), 4)
    const recycled = await writeOnce(() => service.redeem({ itemId: 'relax-break', idempotencyKey: 'notify-redeem-recycled' }), 5)
    await writeOnce(() => service.recycle({ ref: recycled.entry.id, idempotencyKey: 'notify-recycle' }), 6)
    await assert.rejects(service.earn({ title: 'Invalid reward', points: 0 }))
    const cancelled = new AbortController()
    cancelled.abort()
    await assert.rejects(service.earn({ title: 'Cancelled reward', points: 5 }, cancelled.signal), { name: 'AbortError' })
    assert.equal(notifications, 6)
    assert.equal((await service.list()).length, 6)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('a notification failure cannot turn a committed reward into an apparent write failure', async () => {
  const root = await temporaryDirectory()
  try {
    const dataDir = join(root, 'data')
    const { initializeData } = await import('../../src/ledger/index.mjs')
    await initializeData(dataDir)
    const service = new module.PointsHostService(() => ({ dataDir, timeZone: 'Asia/Shanghai', setupVersion: 1, jevEnabled: false }), dataDir, undefined, () => { throw new Error('Simulated notification failure') })
    const result = await service.earn({ title: 'Committed reward', points: 5 })
    assert.equal(result.summary.balance, 5)
    assert.equal(result.duplicate, false)
    assert.equal((await service.list()).length, 1)
  } finally { await rm(root, { recursive: true, force: true }) }
})
