import { mkdir, writeFile, readFile, readdir, lstat, open, rename, unlink } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { randomUUID, createHash } from 'node:crypto'
import { hostname } from 'node:os'
import { setTimeout as delay } from 'node:timers/promises'
import { entryErrors } from './shared/entry-schema.mjs'
import { ledgerErrors, voucherState } from './shared/ledger-state.mjs'
import { summarize, recycleValue } from './shared/ledger-core.mjs'
import { parseShop, parsePricing } from './shared/shop-schema.mjs'

const DEFAULT_TASKS = {
  tiers: [5, 10, 20, 50, 100, 200],
  tasks: [
    { id: 'daily-care', name: '完成日常清洁', points: 5, emoji: '🪥' },
    { id: 'reading', name: '阅读半小时', points: 20, emoji: '📚' },
    { id: 'exercise', name: '运动半小时', points: 20, emoji: '🏃' },
  ],
}
const DEFAULT_SHOP = {
  items: [
    { id: 'relax-break', name: '休息券', type: 'voucher', points: 30, desc: '奖励自己一段休息时间', emoji: '☕' },
    { id: 'movie-night', name: '电影之夜', type: 'voucher', points: 100, desc: '安排一次喜欢的电影', emoji: '🎬' },
  ],
}
const DEFAULT_RULES = '# 我的生活积分规则\n\n固定事项参考 tasks.json；其他已完成事项按实际投入由对话模型定分。\n避免重复奖励同一次投入。补记追加流水，改账追加更正，不删除历史。\n你可以在这里补充自己的事项分值和奖励规则。\n'

export async function initializeData(dataDir) {
  dataDir = directoryPath(dataDir)
  await mkdir(join(dataDir, 'ledger'), { recursive: true })
  for (const [name, value] of Object.entries({
    'tasks.json': JSON.stringify(DEFAULT_TASKS, null, 2) + '\n',
    'shop.json': JSON.stringify(DEFAULT_SHOP, null, 2) + '\n',
    'config.json': JSON.stringify({ physicalRate: 20 }, null, 2) + '\n',
    '积分规则.md': DEFAULT_RULES,
  })) {
    try { await writeFile(join(dataDir, name), value, { encoding: 'utf8', flag: 'wx' }) }
    catch (error) { if (error.code !== 'EEXIST') throw error }
  }
  return validateData(dataDir)
}

function fail(message, code = 'INVALID_OPERATION') {
  throw Object.assign(new Error(message), { code })
}

function directoryPath(dataDir) {
  if (typeof dataDir !== 'string' || !dataDir.trim()) fail('请先选择积分数据目录', 'NOT_CONFIGURED')
  return resolve(dataDir)
}

async function scanLedger(dataDir) {
  const entries = [], issues = []
  const walk = async (folder, relative) => {
    let names
    try {
      const root = await lstat(folder)
      if (root.isSymbolicLink()) { issues.push(`${relative}：账本不支持符号链接`); return }
      names = await readdir(folder)
    }
    catch (error) { issues.push(`${relative || 'ledger/'}：无法读取目录（${error.code}）`); return }
    for (const name of names.sort()) {
      const full = join(folder, name), rel = `${relative}/${name}`
      try {
        const info = await lstat(full)
        if (info.isSymbolicLink()) { issues.push(`${rel}：账本不支持符号链接`); continue }
        if (info.isDirectory()) { await walk(full, rel); continue }
        if (!info.isFile() || !name.endsWith('.json')) continue
        const entry = JSON.parse(await readFile(full, 'utf8'))
        const problems = entryErrors(entry)
        if (problems.length) { issues.push(`${rel}：${problems.join('；')}`); continue }
        if (name !== `${entry.id}.json`) issues.push(`${rel}：文件名与流水 id 不一致`)
        if (entry.idempotencyKey !== undefined && (typeof entry.idempotencyKey !== 'string' || !entry.idempotencyKey.trim()))
          issues.push(`${rel}：幂等请求标识无效`)
        entries.push(entry)
      } catch (error) { issues.push(`${rel}：无法读取流水（${error.message}）`) }
    }
  }
  await walk(join(dataDir, 'ledger'), 'ledger')
  issues.push(...ledgerErrors(entries))
  const keys = new Set()
  for (const entry of entries) {
    if (!entry.idempotencyKey) continue
    if (keys.has(entry.idempotencyKey)) issues.push(`重复幂等请求标识：${entry.idempotencyKey}`)
    keys.add(entry.idempotencyKey)
  }
  return { entries, issues }
}

async function readStrict(dataDir) {
  const scan = await scanLedger(dataDir)
  if (scan.issues.length) fail(`账本存在问题，拒绝读取汇总或写账：${scan.issues.join('；')}`, 'INVALID_LEDGER')
  return scan.entries
}

async function readRules(dataDir) {
  const json = async name => {
    try { return JSON.parse(await readFile(join(dataDir, name), 'utf8')) }
    catch (error) { fail(`${name}：无法读取配置（${error.message}）`, 'INVALID_RULES') }
  }
  let tasks, shop
  try { tasks = parsePricing(await json('tasks.json')); shop = parseShop(await json('shop.json')) }
  catch (error) { fail(`积分规则或商品无效：${error.message}`, 'INVALID_RULES') }
  let rulesMarkdown = '', physicalRate = 20
  try { rulesMarkdown = await readFile(join(dataDir, '积分规则.md'), 'utf8') }
  catch (error) { if (error.code !== 'ENOENT') throw error }
  try {
    const config = JSON.parse(await readFile(join(dataDir, 'config.json'), 'utf8'))
    if (config.physicalRate !== undefined) {
      if (!Number.isFinite(config.physicalRate) || config.physicalRate <= 0)
        fail('config.json 的 physicalRate 必须是正数', 'INVALID_RULES')
      physicalRate = config.physicalRate
    }
  } catch (error) { if (error.code !== 'ENOENT') throw error }
  return { tasks, shop, rulesMarkdown, physicalRate }
}

export async function validateData(dataDir) {
  dataDir = directoryPath(dataDir)
  const { entries, issues } = await scanLedger(dataDir)
  try { await readRules(dataDir) }
  catch (error) { issues.push(error.message) }
  return { valid: issues.length === 0, issues, entryCount: entries.length }
}

function processAlive(pid) {
  try { process.kill(pid, 0); return true }
  catch (error) { return error.code !== 'ESRCH' }
}

async function acquireLock(dataDir, signal) {
  const path = join(dataDir, '.ledger.lock')
  const owner = { pid: process.pid, host: hostname(), token: randomUUID() }
  const deadline = Date.now() + 5000
  while (true) {
    signal?.throwIfAborted()
    let handle
    try {
      handle = await open(path, 'wx')
      try { await handle.writeFile(JSON.stringify(owner), 'utf8') }
      catch (error) { await handle.close(); handle = undefined; await unlink(path); throw error }
      await handle.close()
      return async () => {
        try {
          if (JSON.parse(await readFile(path, 'utf8')).token === owner.token) await unlink(path)
        } catch (error) { if (error.code !== 'ENOENT') throw error }
      }
    } catch (error) {
      if (error.code !== 'EEXIST') fail(`无法创建账本写锁：${error.message}`, 'LOCK_ERROR')
      try {
        const text = await readFile(path, 'utf8'), current = JSON.parse(text)
        if (current.host === owner.host && Number.isSafeInteger(current.pid) && current.pid > 0 &&
            !processAlive(current.pid) && Date.now() - (await lstat(path)).mtimeMs > 30_000 &&
            await readFile(path, 'utf8') === text) {
          await unlink(path)
          continue
        }
      } catch { /* A live owner may still be writing or releasing the lock. */ }
      if (Date.now() >= deadline) fail('获取账本写锁超时：另一笔写账仍在进行或无法确认锁持有者状态', 'LOCK_TIMEOUT')
      await delay(25, undefined, { signal })
    }
  }
}

function requiredString(value, name) {
  if (typeof value !== 'string' || !value.trim()) fail(`${name} 必须是非空文字`)
  return value.trim()
}

function safeInteger(value, name) {
  if (!Number.isSafeInteger(value)) fail(`${name} 必须是安全整数`)
  return value
}

function normalizeNote(note) {
  if (note !== undefined && typeof note !== 'string') fail('note 必须是文字')
  return note
}

function findEntry(entries, ref, type) {
  const entry = entries.find(value => value.id === ref)
  if (!entry) fail(`找不到流水 ${ref}`)
  if (type && entry.type !== type) fail(`流水 ${ref} 的类型不是 ${type}`)
  return entry
}

function rootOf(entries, entry) {
  while (entry.type === 'adjust') entry = findEntry(entries, entry.ref)
  return entry
}

function activeVoucher(entries, ref) {
  const entry = findEntry(entries, ref, 'redeem_voucher')
  const state = voucherState(entries)
  if (state.voided.has(ref)) fail('该券兑换已冲正作废')
  if (state.consumed.has(ref)) fail('该券已被核销或回收，不能重复使用')
  return { entry, state }
}

export async function createLedger(dataDir, { timeZone = 'Asia/Shanghai', now = () => new Date() } = {}) {
  dataDir = directoryPath(dataDir)
  const dateFormat = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
  const currentDate = () => {
    const date = now()
    if (!(date instanceof Date) || !Number.isFinite(date.getTime())) fail('当前时间无效')
    return date
  }
  const summaryOf = (entries) => {
    const date = currentDate(), day = dateFormat.format(date)
    const state = voucherState(entries), summary = summarize(entries)
    const todayEarned = entries.filter(entry => entry.type === 'earn' && dateFormat.format(new Date(entry.time)) === day)
      .reduce((total, entry) => total + state.effectiveTotal(entry).points, 0)
    return {
      status: 'ready', balance: summary.points, totalExp: summary.exp,
      level: summary.level.level, expInLevel: summary.level.expInLevel,
      expRequired: summary.level.expRequired, expToNext: summary.level.expToNext,
      progress: summary.level.expInLevel / summary.level.expRequired,
      todayEarned, day, timeZone, updatedAt: date.toISOString(),
    }
  }
  const makeEntry = (type, title, points, exp, extra = {}) => {
    const date = currentDate(), local = dateFormat.format(date).replaceAll('-', '')
    return { id: `${local}-${date.toISOString().slice(11, 19).replaceAll(':', '')}-${randomUUID().slice(0, 8)}`, time: date.toISOString(), type, title, points, exp, ...extra }
  }
  const mutate = async (operation, args, build, { signal } = {}) => {
    signal?.throwIfAborted()
    const note = normalizeNote(args.note)
    const key = args.idempotencyKey === undefined ? undefined : requiredString(args.idempotencyKey, 'idempotencyKey')
    const fingerprintArgs = Object.fromEntries(Object.keys(args).filter(key => key !== 'idempotencyKey' && args[key] !== undefined).sort().map(key => [key, args[key]]))
    const fingerprint = createHash('sha256').update(JSON.stringify({ operation, args: fingerprintArgs })).digest('hex')
    const release = await acquireLock(dataDir, signal)
    try {
      signal?.throwIfAborted()
      const entries = await readStrict(dataDir)
      signal?.throwIfAborted()
      if (key) {
        const existing = entries.find(entry => entry.idempotencyKey === key)
        if (existing) {
          if (existing.idempotencyFingerprint !== fingerprint) fail('幂等请求标识已用于不同的操作，拒绝重复请求', 'IDEMPOTENCY_CONFLICT')
          return { entry: existing, summary: summaryOf(entries), duplicate: true }
        }
      }
      const entry = await build(entries, note)
      signal?.throwIfAborted()
      if (key) Object.assign(entry, { idempotencyKey: key, idempotencyFingerprint: fingerprint })
      const problems = ledgerErrors([...entries, entry])
      if (problems.length) fail(`操作会使账本无效，拒绝写账：${problems.join('；')}`, 'INVALID_OPERATION')
      const folder = join(dataDir, 'ledger', entry.time.slice(0, 7))
      await mkdir(folder, { recursive: true })
      const final = join(folder, `${entry.id}.json`), temp = `${final}.tmp`
      try {
        signal?.throwIfAborted()
        await writeFile(temp, JSON.stringify(entry, null, 2) + '\n', { encoding: 'utf8', flag: 'wx', signal })
        signal?.throwIfAborted()
        await rename(temp, final)
      } catch (error) {
        try { await unlink(temp) } catch { /* No partial entry remains visible. */ }
        throw error
      }
      return { entry, summary: summaryOf([...entries, entry]), duplicate: false }
    } finally { await release() }
  }
  return {
    async summary() { return summaryOf(await readStrict(dataDir)) },
    async rules() { return readRules(dataDir) },
    async list(limit = 20) {
      if (!Number.isSafeInteger(limit) || limit < 0) fail('limit 必须是非负安全整数')
      return (await readStrict(dataDir)).sort((a, b) => Date.parse(b.time) - Date.parse(a.time) || b.id.localeCompare(a.id)).slice(0, limit)
    },
    async doctor() { return validateData(dataDir) },
    async earn(args, options) {
      const title = requiredString(args.title, 'title'), points = safeInteger(args.points, '积分 points')
      if (points <= 0) fail('获得积分必须为正数；更正请使用 adjust')
      return mutate('earn', args, (_entries, note) => makeEntry('earn', title, points, points, note === undefined ? {} : { note }), options)
    },
    async adjust(args, options) {
      const ref = requiredString(args.ref, 'ref')
      const reverse = args.points === undefined && args.exp === undefined
      if (!reverse) { safeInteger(args.points ?? 0, '积分 points'); safeInteger(args.exp ?? 0, '经验 exp') }
      return mutate('adjust', args, (entries, note) => {
        const original = findEntry(entries, ref), state = voucherState(entries)
        const points = reverse ? -original.points : args.points ?? 0, exp = reverse ? -original.exp : args.exp ?? 0
        if (original.points === 0 && original.exp === 0 && (points !== 0 || exp !== 0)) fail('零值记录的更正只能是零积分零经验')
        if (state.isFullyReversed(original)) fail('记录已全额冲正；如需撤销，请更正相应冲正记录')
        const root = rootOf(entries, original)
        if (root.type === 'redeem_voucher' && state.consumed.has(root.id) && (points !== 0 || exp !== 0))
          fail('券已被核销或回收，请先撤销消费记录再更正兑换金额')
        return makeEntry('adjust', args.title === undefined ? `更正：${original.title}` : requiredString(args.title, 'title'), points, exp, { ref, note: note ?? `${reverse ? '全额冲正' : '差额更正'} ${ref}` })
      }, options)
    },
    async redeem(args, options) {
      const itemId = requiredString(args.itemId, 'itemId')
      return mutate('redeem', args, async (entries, note) => {
        const { shop, physicalRate } = await readRules(dataDir)
        const item = shop.find(item => item.id === itemId)
        if (!item) fail(`shop.json 中没有商品 ${itemId}`)
        const price = item.type === 'voucher' ? item.points : Math.ceil(item.yuan * physicalRate)
        safeInteger(price, '商品积分')
        if (price <= 0) fail('商品积分必须为正数')
        if (summarize(entries).points < price) fail('余额不足，无法兑换')
        return makeEntry(item.type === 'voucher' ? 'redeem_voucher' : 'redeem_physical', item.name, -price, 0, {
          ...(item.type === 'physical' ? { rate: physicalRate } : {}), ...(note === undefined ? {} : { note }),
        })
      }, options)
    },
    async use(args, options) {
      const ref = requiredString(args.ref, 'ref')
      return mutate('use', args, (entries, note) => {
        const { entry } = activeVoucher(entries, ref)
        return makeEntry('use_voucher', `核销：${entry.title}`, 0, 0, { ref, ...(note === undefined ? {} : { note }) })
      }, options)
    },
    async recycle(args, options) {
      const ref = requiredString(args.ref, 'ref')
      return mutate('recycle', args, (entries, note) => {
        const { entry, state } = activeVoucher(entries, ref)
        const paid = -state.effectiveTotal(entry).points
        return makeEntry('recycle_voucher', `回收：${entry.title}`, recycleValue(paid), 0, { ref, note: note ?? `当前有效实付 ${paid} 分 × 80%` })
      }, options)
    },
  }
}
