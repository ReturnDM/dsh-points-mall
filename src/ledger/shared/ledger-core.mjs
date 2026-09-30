import { voucherState, RECYCLE_RATE, recycleValue } from './ledger-state.mjs'
export { RECYCLE_RATE, recycleValue }

/**
 * 账本汇总与数值口径 —— CLI（scripts/ledger.mjs）与前端（src/lib/ledger.ts）共用的唯一实现。
 * 升级公式、回收比例、实物换算都只在这里定义，任何一侧改规则都要改这里。
 */

/** 第 N 级 → N+1 级所需经验 = 100 + 10 × (N - 1) */
export const expForLevel = (level) => 100 + 10 * (level - 1)

/** 由总经验计算等级与级内进度（对浮点开方边界做了校正） */
export function levelFromExp(totalExp) {
  if (!Number.isFinite(totalExp) || Math.abs(totalExp) > Number.MAX_SAFE_INTEGER)
    throw new RangeError('经验总额超出安全计算范围')
  const exp = Math.max(0, totalExp)
  // 跨过 k 级所需经验为 5k(k + 19)；用公式定位，再校正浮点开方的边界误差。
  let crossed = Math.max(0, Math.floor((Math.sqrt(361 + (4 * exp) / 5) - 19) / 2))
  let spent = 5 * crossed * (crossed + 19)
  while (spent > exp) {
    crossed -= 1
    spent = 5 * crossed * (crossed + 19)
  }
  while (5 * (crossed + 1) * (crossed + 20) <= exp) {
    crossed += 1
    spent = 5 * crossed * (crossed + 19)
  }
  const level = crossed + 1
  const remaining = exp - spent
  const need = expForLevel(level)
  return { level, expInLevel: remaining, expToNext: need - remaining, expRequired: need }
}

/** 实物默认汇率：20 积分 = 1 元（可被数据目录 config.json 的 physicalRate 覆盖） */
export const DEFAULT_RATE = 20

/** 实物标价：人民币 × 汇率，向上取整 */
export const yuanToPoints = (yuan, rate = DEFAULT_RATE) => Math.ceil(yuan * rate)

/**
 * 汇总：余额 / 累计经验 / 等级 / 背包（未核销未作废的券）/ 各券当前实付。
 * 返回的 voucherPaid 供回收估值展示，避免调用方重复计算 voucherState。
 */
export function summarize(entries) {
  let points = 0
  let exp = 0
  const { consumed, voided, effectiveTotal } = voucherState(entries)
  const backpack = []
  const voucherPaid = new Map()
  for (const e of entries) {
    points += e.points
    exp += e.exp
    if (e.type === 'redeem_voucher' && !consumed.has(e.id) && !voided.has(e.id)) {
      backpack.push(e)
      voucherPaid.set(e.id, -effectiveTotal(e).points)
    }
  }
  return { points, exp, level: levelFromExp(exp), backpack, voucherPaid }
}
