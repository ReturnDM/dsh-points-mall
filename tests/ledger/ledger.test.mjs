import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile, writeFile, mkdir, readdir, utimes, symlink } from 'node:fs/promises'
import { tmpdir, hostname } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'

async function loadLedger() {
  let api
  try { api = await import('../../src/ledger/index.mjs') }
  catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error }
  assert.equal(typeof api?.initializeData, 'function', '账本初始化 API 尚未实现')
  return api
}

async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-points-ledger-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  return dir
}

async function writeEntry(dir, entry, subdir = '2026-09') {
  const folder = join(dir, 'ledger', subdir)
  await mkdir(folder, { recursive: true })
  await writeFile(join(folder, `${entry.id}.json`), JSON.stringify(entry))
}

const earnEntry = (id, points, time = '2026-09-30T10:00:00+08:00') => ({ id, time, type: 'earn', title: id, points, exp: points })

async function configured(t, options = {}) {
  const dir = await fixture(t)
  const api = await loadLedger()
  await api.initializeData(dir)
  const ledger = await api.createLedger(dir, { now: () => new Date('2026-09-30T10:00:00Z'), ...options })
  return { dir, api, ledger }
}

test('初始化新目录时建立零余额账本，重复初始化不覆盖用户规则', async t => {
  const dir = await fixture(t)
  const { initializeData, createLedger } = await loadLedger()
  await initializeData(dir)
  const tasks = JSON.parse(await readFile(join(dir, 'tasks.json'), 'utf8'))
  assert.ok(tasks.tiers.length > 0)
  assert.ok(Array.isArray(tasks.tasks))
  assert.ok(Array.isArray(JSON.parse(await readFile(join(dir, 'shop.json'), 'utf8')).items))
  assert.deepEqual(await readdir(join(dir, 'ledger')), [])
  await writeFile(join(dir, '积分规则.md'), '我自己的规则\n')
  await writeFile(join(dir, 'tasks.json'), JSON.stringify({ tiers: [7, 14], tasks: [] }))
  await initializeData(dir)
  assert.equal(await readFile(join(dir, '积分规则.md'), 'utf8'), '我自己的规则\n')
  assert.deepEqual(JSON.parse(await readFile(join(dir, 'tasks.json'), 'utf8')).tiers, [7, 14])
  const ledger = await createLedger(dir, { now: () => new Date('2026-09-30T10:00:00Z') })
  assert.deepEqual(await ledger.summary(), {
    status: 'ready', balance: 0, totalExp: 0, level: 1, expInLevel: 0,
    expRequired: 100, expToNext: 100, progress: 0, todayEarned: 0,
    day: '2026-09-30', timeZone: 'Asia/Shanghai', updatedAt: '2026-09-30T10:00:00.000Z',
  })
})

test('兼容递归旧流水并以今日奖励的有效更正树统计今日累计', async t => {
  const { dir, ledger } = await configured(t)
  const yesterday = earnEntry('yesterday', 50, '2026-09-29T20:00:00+08:00')
  const today = earnEntry('today', 200, '2026-09-29T16:30:00Z')
  const records = [yesterday, today,
    { ...earnEntry('fix-today', -20), type: 'adjust', ref: 'today' },
    { ...earnEntry('undo-fix', 10), type: 'adjust', ref: 'fix-today' },
    { ...earnEntry('fix-old', -10), type: 'adjust', ref: 'yesterday' },
    { ...earnEntry('coupon', -30), type: 'redeem_voucher', exp: 0 },
    { ...earnEntry('recycled', 24), type: 'recycle_voucher', ref: 'coupon', exp: 0 },
  ]
  for (const record of records) await writeEntry(dir, record, 'old/deep')
  await writeFile(join(dir, 'ledger', 'interrupted.json.tmp'), '{broken')
  const summary = await ledger.summary()
  assert.equal(summary.balance, 224)
  assert.equal(summary.totalExp, 230)
  assert.equal(summary.level, 3)
  assert.equal(summary.expInLevel, 20)
  assert.equal(summary.expRequired, 120)
  assert.equal(summary.progress, 20 / 120)
  assert.equal(summary.todayEarned, 190)
  const otherZone = await (await loadLedger()).createLedger(dir, { timeZone: 'UTC', now: () => new Date('2026-09-30T10:00:00Z') })
  assert.equal((await otherZone.summary()).todayEarned, 0)
})

test('读取规则与流水只读取选定目录并按实际时间倒序', async t => {
  const { dir, ledger } = await configured(t)
  assert.equal(typeof ledger.rules, 'function', '规则读取尚未实现')
  await writeFile(join(dir, 'config.json'), JSON.stringify({ physicalRate: 12 }))
  await writeFile(join(dir, '积分规则.md'), '阅读 15 分\n')
  const rules = await ledger.rules()
  assert.equal(rules.physicalRate, 12)
  assert.equal(rules.rulesMarkdown, '阅读 15 分\n')
  assert.ok(Array.isArray(rules.shop))
  assert.ok(Array.isArray(rules.tasks.tiers))
  await writeEntry(dir, earnEntry('later', 10, '2026-09-30T02:00:00Z'))
  await writeEntry(dir, earnEntry('earlier', 5, '2026-09-30T09:00:00+08:00'))
  assert.deepEqual((await ledger.list(1)).map(e => e.id), ['later'])
  assert.deepEqual(await ledger.list(0), [])
  await assert.rejects(() => ledger.list(-1), /limit/)
})

test('积分获得持久追加且重复请求不重记，冲突请求拒绝', async t => {
  const { dir, ledger } = await configured(t)
  assert.equal(typeof ledger.earn, 'function', '记账尚未实现')
  const first = await ledger.earn({ title: '阅读', points: 25, note: '半小时', idempotencyKey: 'earn-one' })
  assert.equal(first.summary.balance, 25)
  assert.equal(first.entry.exp, 25)
  assert.equal(first.duplicate, false)
  const reopened = await (await loadLedger()).createLedger(dir)
  const retry = await reopened.earn({ title: '阅读', points: 25, note: '半小时', idempotencyKey: 'earn-one' })
  assert.equal(retry.entry.id, first.entry.id)
  assert.equal(retry.duplicate, true)
  assert.equal(retry.summary.balance, 25)
  assert.equal((await reopened.list()).length, 1)
  await assert.rejects(() => ledger.earn({ title: '阅读', points: 50, idempotencyKey: 'earn-one' }), /幂等|重复请求/)
  await assert.rejects(() => ledger.earn({ title: '无效', points: 0 }), /积分|points/)
  await assert.rejects(() => ledger.earn({ title: '无效', points: 1.5 }), /整数/)
  assert.equal((await ledger.summary()).balance, 25)
})

test('更正追加历史并保护全额冲正和更正链', async t => {
  const { ledger } = await configured(t)
  assert.equal(typeof ledger.adjust, 'function', '更正尚未实现')
  const earned = await ledger.earn({ title: '工作', points: 100 })
  const changed = await ledger.adjust({ ref: earned.entry.id, points: -30, exp: -30 })
  assert.equal(changed.summary.balance, 70)
  assert.equal(changed.summary.todayEarned, 70)
  const undone = await ledger.adjust({ ref: changed.entry.id })
  assert.equal(undone.summary.balance, 100)
  const reversed = await ledger.adjust({ ref: earned.entry.id })
  assert.equal(reversed.summary.balance, 0)
  await assert.rejects(() => ledger.adjust({ ref: earned.entry.id }), /冲正/)
  assert.equal((await ledger.list()).length, 4)
})

test('兑换读取成交价与汇率，核销回收防重复并按有效实付返分', async t => {
  const { dir, ledger } = await configured(t)
  assert.equal(typeof ledger.redeem, 'function', '兑换尚未实现')
  await writeFile(join(dir, 'shop.json'), JSON.stringify({ items: [
    { id: 'voucher', name: '休息', type: 'voucher', points: 100 },
    { id: 'tea', name: '茶', type: 'physical', yuan: 1.25 },
  ] }))
  await writeFile(join(dir, 'config.json'), JSON.stringify({ physicalRate: 12 }))
  await ledger.earn({ title: '工作', points: 300 })
  const tea = await ledger.redeem({ itemId: 'tea' })
  assert.equal(tea.entry.points, -15)
  assert.equal(tea.entry.rate, 12)
  assert.equal(tea.summary.totalExp, 300)
  const voucher = await ledger.redeem({ itemId: 'voucher' })
  await ledger.adjust({ ref: voucher.entry.id, points: 25 })
  const returned = await ledger.recycle({ ref: voucher.entry.id, idempotencyKey: 'return-once' })
  assert.equal(returned.entry.points, 60)
  assert.equal(returned.summary.balance, 270)
  assert.equal(returned.summary.todayEarned, 300)
  assert.equal((await ledger.recycle({ ref: voucher.entry.id, idempotencyKey: 'return-once' })).duplicate, true)
  await assert.rejects(() => ledger.use({ ref: voucher.entry.id }), /核销|回收/)
  await assert.rejects(() => ledger.adjust({ ref: voucher.entry.id, points: 1 }), /核销|回收/)
  const second = await ledger.redeem({ itemId: 'voucher' })
  const use = await ledger.use({ ref: second.entry.id })
  assert.equal(use.entry.points, 0)
  await assert.rejects(() => ledger.recycle({ ref: second.entry.id }), /核销|回收/)
  await assert.rejects(() => ledger.adjust({ ref: use.entry.id, points: 1 }), /零值/)
  assert.equal((await ledger.redeem({ itemId: 'voucher' })).summary.balance, 70)
  await assert.rejects(() => ledger.redeem({ itemId: 'voucher' }), /余额不足/)
})

test('校验与自检只读且坏流水禁止展示汇总和继续写账', async t => {
  const { dir, ledger, api } = await configured(t)
  assert.equal(typeof api.validateData, 'function', '只读校验尚未实现')
  await writeEntry(dir, earnEntry('good', 20))
  const broken = join(dir, 'ledger', 'broken.json')
  await writeFile(broken, '{broken')
  const report = await api.validateData(dir)
  assert.equal(report.valid, false)
  assert.ok(report.issues.some(issue => issue.includes('broken.json')))
  assert.equal(report.entryCount, 1)
  assert.equal((await ledger.doctor()).valid, false)
  await assert.rejects(() => ledger.summary(), /账本|流水/)
  await assert.rejects(() => ledger.earn({ title: '禁止', points: 5 }), /账本|流水/)
  assert.equal(await readFile(broken, 'utf8'), '{broken')
  assert.equal((await readdir(join(dir, 'ledger'))).includes('.ledger.lock'), false)
})

test('连接缺失目录的只读验证不会初始化或猜测路径', async t => {
  const { dir, api } = await configured(t)
  assert.equal(typeof api.validateData, 'function', '只读校验尚未实现')
  const missing = join(dir, 'missing')
  const report = await api.validateData(missing)
  assert.equal(report.valid, false)
  await assert.rejects(() => readdir(missing), { code: 'ENOENT' })
})

test('多个调用者并发兑换不能把余额扣成负数', async t => {
  const { dir, ledger, api } = await configured(t)
  assert.equal(typeof ledger.earn, 'function', '并发写账尚未实现')
  await writeFile(join(dir, 'shop.json'), JSON.stringify({ items: [{ id: 'only', name: '休息', type: 'voucher', points: 80 }] }))
  await ledger.earn({ title: '工作', points: 100 })
  const other = await api.createLedger(dir)
  const attempts = await Promise.allSettled([ledger.redeem({ itemId: 'only' }), other.redeem({ itemId: 'only' })])
  assert.equal(attempts.filter(result => result.status === 'fulfilled').length, 1)
  assert.equal((await ledger.summary()).balance, 20)
  assert.equal((await ledger.doctor()).valid, true)
})

test('账本根目录的链接不能绕过目录范围读取与写入', async t => {
  const { dir, ledger } = await configured(t)
  const external = await fixture(t)
  await mkdir(join(external, 'ledger'))
  await writeEntry(external, earnEntry('external', 80))
  await rm(join(dir, 'ledger'), { recursive: true })
  await symlink(join(external, 'ledger'), join(dir, 'ledger'), 'junction')
  await assert.rejects(() => ledger.summary(), /链接|账本/)
  await assert.rejects(() => ledger.earn({ title: '不能越界', points: 5 }), /链接|账本/)
  assert.equal((await readdir(join(external, 'ledger', '2026-09'))).length, 1)
})

test('公共校验拒绝损坏的计分模板且初始化不将旧错误覆盖成默认值', async t => {
  const { dir, api } = await configured(t)
  const tasksPath = join(dir, 'tasks.json')
  await writeFile(tasksPath, JSON.stringify({ tiers: [20, 5], tasks: [] }))
  assert.equal((await api.validateData(dir)).valid, false)
  assert.equal((await api.initializeData(dir)).valid, false)
  assert.deepEqual(JSON.parse(await readFile(tasksPath, 'utf8')).tiers, [20, 5])
})

test('更正不允许越过原始额度、虚增零值经验或引用不存在记录', async t => {
  const { ledger } = await configured(t)
  const entry = (await ledger.earn({ title: '工作', points: 50 })).entry
  await assert.rejects(() => ledger.adjust({ ref: entry.id, points: -51, exp: -51 }), /超过|无效/)
  await assert.rejects(() => ledger.adjust({ ref: entry.id, points: 51, exp: 51 }), /超过|无效/)
  await assert.rejects(() => ledger.adjust({ ref: 'missing' }), /找不到/)
  assert.equal((await ledger.summary()).balance, 50)
})

test('并发重试同一请求只追加一笔且释放写锁', async t => {
  const { dir, ledger } = await configured(t)
  const results = await Promise.all(Array.from({ length: 8 }, () => ledger.earn({ title: '一次阅读', points: 10, idempotencyKey: 'concurrent-once' })))
  assert.equal(results.filter(result => !result.duplicate).length, 1)
  assert.equal((await ledger.list()).length, 1)
  assert.equal((await ledger.summary()).balance, 10)
  await assert.rejects(() => readFile(join(dir, '.ledger.lock')), { code: 'ENOENT' })
})

test('历史 CLI 协议写端与原生引擎同时写账共享锁并保留全部流水', async t => {
  const { dir, ledger } = await configured(t)
  const legacyPath = fileURLToPath(new URL('./fixtures/legacy-writer.mjs', import.meta.url))
  const runLegacy = index => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [legacyPath, dir, `历史协议 ${index}`], { windowsHide: true })
    let errors = ''
    child.stderr.on('data', value => { errors += value })
    child.stdout.resume()
    child.on('error', reject)
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`旧 CLI 退出 ${code}：${errors}`)))
  })
  await Promise.all([
    ...Array.from({ length: 4 }, (_, index) => runLegacy(index)),
    ...Array.from({ length: 4 }, (_, index) => ledger.earn({ title: `原生工具 ${index}`, points: 5 })),
  ])
  assert.equal((await ledger.summary()).balance, 40)
  assert.equal((await ledger.list()).length, 8)
  assert.equal((await ledger.doctor()).valid, true)
})

test('确认已退出的同机旧锁可回收，活进程旧锁始终不可抢占', async t => {
  const { dir, ledger } = await configured(t)
  const lockPath = join(dir, '.ledger.lock')
  const staleDate = new Date(Date.now() - 60_000)
  await writeFile(lockPath, JSON.stringify({ pid: 2147483647, host: hostname(), token: 'dead-owner' }))
  await utimes(lockPath, staleDate, staleDate)
  await ledger.earn({ title: '回收陈旧锁后写账', points: 5 })
  await writeFile(lockPath, JSON.stringify({ pid: process.pid, host: hostname(), token: 'live-owner' }))
  await utimes(lockPath, staleDate, staleDate)
  const rejected = ledger.earn({ title: '不能抢活锁', points: 5 })
  await assert.rejects(rejected, /写锁超时/)
  assert.equal(JSON.parse(await readFile(lockPath, 'utf8')).token, 'live-owner')
  assert.equal((await ledger.summary()).balance, 5)
})

test('已取消的写请求不能建立写锁或追加记录', async t => {
  const { dir, ledger } = await configured(t)
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(() => ledger.earn({ title: '已取消事项', points: 10 }, { signal: controller.signal }), { name: 'AbortError' })
  assert.equal((await ledger.summary()).balance, 0)
  assert.deepEqual(await ledger.list(), [])
  await assert.rejects(() => readFile(join(dir, '.ledger.lock')), { code: 'ENOENT' })
})

test('等待别人的写锁期间取消后立即停止且保留锁持有者', async t => {
  const { dir, ledger } = await configured(t)
  const lockPath = join(dir, '.ledger.lock')
  await writeFile(lockPath, JSON.stringify({ pid: process.pid, host: hostname(), token: 'other-live-owner' }))
  const controller = new AbortController()
  const pending = ledger.earn({ title: '不能等待后偷偷写账', points: 10 }, { signal: controller.signal })
  await delay(30)
  controller.abort()
  await assert.rejects(pending, { name: 'AbortError' })
  assert.equal(JSON.parse(await readFile(lockPath, 'utf8')).token, 'other-live-owner')
  await rm(lockPath)
  assert.equal((await ledger.summary()).balance, 0)
  assert.deepEqual(await ledger.list(), [])
})

test('取得本人写锁后取消在提交前停止并释放本人锁', async t => {
  const { dir, api } = await configured(t)
  const controller = new AbortController()
  const ledger = await api.createLedger(dir, { now: () => { controller.abort(); return new Date('2026-09-30T10:00:00Z') } })
  await assert.rejects(() => ledger.earn({ title: '提交前取消', points: 10 }, { signal: controller.signal }), { name: 'AbortError' })
  assert.deepEqual(await ledger.list(), [])
  await assert.rejects(() => readFile(join(dir, '.ledger.lock')), { code: 'ENOENT' })
})
