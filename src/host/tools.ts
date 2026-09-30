/** DSH-native points tools with schema-validated arguments and JSON results. */
import { defineTool, type ToolDefinition } from '@deepseek-ai/dsh-tools'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import type { PointsHostService } from './service.ts'

/** Detach a library result into the JSON value accepted by the DSH tool registry. */
function jsonValue(value: unknown): JsonValue { return JSON.parse(JSON.stringify(value)) as JsonValue }

const output = {
  schema: { type: 'json' as const },
  render: (_args: unknown, value: JsonValue) => [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
}

const note = { type: 'string' as const, description: '定分依据或更正原因，保留原规则、模型判断及可选 Jev 复核结论。' }
const idempotencyKey = { type: 'string' as const, description: '同一次操作重试时复用同一标识，防止重复记账。' }
const ref = { type: 'string' as const, required: true as const, description: '已有流水的 id，请先查询真实记录，不能猜测。' }

/** Create the definitions once; every execution captures current configuration through the service. */
export function createPointsTools(service: PointsHostService): ToolDefinition[] {
  return [
    defineTool({
      name: 'points_mall_summary', description: '读取生活积分余额、等级、经验进度和今日有效奖励积分。', parameters: {}, output,
      execute: async () => jsonValue(await service.summary()),
      isConcurrencySafe: () => true,
      presentCall: () => ({ card: 'generic', title: '查询生活积分', kind: 'read' }),
    }),
    defineTool({
      name: 'points_mall_rules', description: '读取当前账本的专项规则、固定事项分值、可用商品和回收比例。奖励前先读这些规则。', parameters: {}, output,
      execute: async () => jsonValue({ ...await service.rules(), summary: await service.summary() }),
      isConcurrencySafe: () => true,
      presentCall: () => ({ card: 'generic', title: '读取积分规则', kind: 'read' }),
    }),
    defineTool({
      name: 'points_mall_list', description: '读取最近的真实积分流水，核对重复奖励和更正、兑换、核销的引用 id。',
      parameters: { limit: { type: 'integer', description: '最近流水数量，1 到 1000，默认 20。' } }, output,
      execute: async args => jsonValue({ entries: await service.list(args.limit), summary: await service.summary() }),
      isConcurrencySafe: () => true,
      presentCall: () => ({ card: 'generic', title: '查询积分流水', kind: 'read' }),
    }),
    defineTool({
      name: 'points_mall_earn', description: '为用户明确已完成的事项追加奖励流水，同时增加积分和经验。先读规则与流水，固定事项优先；其他事项由当前模型定分并记录依据。',
      parameters: {
        title: { type: 'string', required: true, description: '已完成事项的简洁标题。' },
        points: { type: 'integer', required: true, description: '正整数奖励分值。' }, note, idempotencyKey,
      }, output,
      execute: async (args, exec) => jsonValue(await service.earn(args, exec.signal)),
      presentCall: args => ({ card: 'generic', title: `记录奖励：${args.title}`, kind: 'edit' }),
    }),
    defineTool({
      name: 'points_mall_adjust', description: '追加更正流水，保留历史原记录。ref 必须来自真实流水；奖励更正通常同时更正积分和经验。',
      parameters: {
        ref,
        points: { type: 'integer', description: '积分变动，可为正或负。与 exp 均省略时全额冲正原记录；已部分更正时先核对流水并显式填写剩余差额。' },
        exp: { type: 'integer', description: '经验变动，可为正或负。' },
        title: { type: 'string', description: '更正标题。' }, note, idempotencyKey,
      }, output,
      execute: async (args, exec) => jsonValue(await service.adjust(args, exec.signal)),
      presentCall: () => ({ card: 'generic', title: '更正积分流水', kind: 'edit' }),
    }),
    defineTool({
      name: 'points_mall_redeem', description: '用已有积分兑换当前商店中的商品或券。先读商品真实 id，余额不足会拒绝；兑换不扣经验。',
      parameters: { itemId: { type: 'string', required: true, description: '当前 shop.json 中的商品 id。' }, note, idempotencyKey }, output,
      execute: async (args, exec) => jsonValue(await service.redeem(args, exec.signal)),
      presentCall: () => ({ card: 'generic', title: '兑换积分商品', kind: 'edit' }),
    }),
    defineTool({
      name: 'points_mall_use', description: '按用户明确意图核销一张尚未使用的券。ref 是兑换流水 id，已经核销的券不能重复使用。',
      parameters: { ref, note, idempotencyKey }, output,
      execute: async (args, exec) => jsonValue(await service.use(args, exec.signal)),
      presentCall: () => ({ card: 'generic', title: '核销奖励券', kind: 'edit' }),
    }),
    defineTool({
      name: 'points_mall_recycle', description: '按用户明确意图回收一张券或物品，依当前账本规则返还积分，不增加经验或今日奖励。ref 是兑换流水 id。',
      parameters: { ref, note, idempotencyKey }, output,
      execute: async (args, exec) => jsonValue(await service.recycle(args, exec.signal)),
      presentCall: () => ({ card: 'generic', title: '回收积分商品', kind: 'edit' }),
    }),
    defineTool({
      name: 'points_mall_doctor', description: '只读检查账本、引用关系与文件格式，返回问题列表，不自动修复或删除任何记录。', parameters: {}, output,
      execute: async () => jsonValue({ ...await service.doctor(), summary: await service.summary() }),
      isConcurrencySafe: () => true,
      presentCall: () => ({ card: 'generic', title: '检查积分账本', kind: 'read' }),
    }),
    defineTool({
      name: 'points_mall_judge', description: '可选 Jev 复核：根据真实账本规则评估当前模型建议的奖励积分，只提供建议，不直接写账。未启用、缺少凭据或失败时返回 fallback，继续由当前模型按规则判断。',
      parameters: {
        task: { type: 'string', required: true, description: '实际已完成事项及必要投入说明。' },
        proposedPoints: { type: 'integer', required: true, description: '当前模型拟定的正整数奖励分值。' },
      }, output,
      execute: async (args, exec) => jsonValue({ ...await service.review(args.task, args.proposedPoints, exec.signal), summary: await service.summary() }),
      isConcurrencySafe: () => true,
      presentCall: () => ({ card: 'generic', title: '复核奖励积分', kind: 'read' }),
    }),
  ]
}
