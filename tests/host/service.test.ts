import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

const module = await import('../../src/host/service.ts')

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
