/**
 * shop.json / tasks.json 校验 —— CLI 与前端共用的唯一口径。
 * CLI 读取时全量校验，坏数据在写入侧就能暴露；前端展示时同一份错误信息。
 * 校验通过时返回原数据结构，失败时 throw Error（信息可直接展示）。
 */

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function positiveNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function positivePoints(value) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

function optionalString(value) {
  return value === undefined || typeof value === 'string'
}

/** 校验 shop.json（兼容旧数组格式与新 { items: [...] } 格式）；通过则返回商品数组 */
export function parseShop(data) {
  const items = Array.isArray(data) ? data : isRecord(data) ? data.items : undefined
  if (!Array.isArray(items)) throw new Error('应包含 items 数组')
  const ids = new Set()
  for (const [i, item] of items.entries()) {
    if (!isRecord(item) || !nonEmptyString(item.id) || !nonEmptyString(item.name))
      throw new Error(`第 ${i + 1} 个商品缺少有效的 id 或 name`)
    if (ids.has(item.id)) throw new Error(`商品 id 重复：${item.id}`)
    ids.add(item.id)
    if (item.type !== 'voucher' && item.type !== 'physical')
      throw new Error(`商品 ${item.id} 的 type 应为 voucher 或 physical`)
    if (item.type === 'voucher' && !positivePoints(item.points))
      throw new Error(`商品 ${item.id} 的 points 应为正整数（正安全整数）`)
    if (item.type === 'physical' && !positiveNumber(item.yuan))
      throw new Error(`商品 ${item.id} 的 yuan 应为正数`)
    if (!optionalString(item.desc) || !optionalString(item.emoji))
      throw new Error(`商品 ${item.id} 的 desc/emoji 应为文字`)
  }
  return items
}

/** 校验 tasks.json（tiers 严格递增 + tasks 列表）；通过则返回原对象 */
export function parsePricing(data) {
  if (!isRecord(data) || !Array.isArray(data.tiers) || !Array.isArray(data.tasks))
    throw new Error('应包含 tiers 和 tasks 数组')
  const tiers = data.tiers
  if (tiers.length === 0 || tiers.some((tier, i) => !positivePoints(tier) || (i > 0 && tier <= tiers[i - 1])))
    throw new Error('tiers 应为从小到大排列的正整数档位')
  const ids = new Set()
  for (const [i, task] of data.tasks.entries()) {
    if (!isRecord(task) || !nonEmptyString(task.id) || !nonEmptyString(task.name))
      throw new Error(`第 ${i + 1} 个事项缺少有效的 id 或 name`)
    if (ids.has(task.id)) throw new Error(`事项 id 重复：${task.id}`)
    ids.add(task.id)
    if (!positivePoints(task.points)) throw new Error(`事项 ${task.id} 的 points 应为正整数`)
    if (!optionalString(task.emoji)) throw new Error(`事项 ${task.id} 的 emoji 应为文字`)
  }
  return data
}
