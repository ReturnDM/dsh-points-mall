/** 返回错误描述数组；空数组 = 通过校验 */
export function entryErrors(e: any): string[];
/**
 * 流水记录字段校验 —— CLI（scripts/ledger.mjs）与前端（src/lib/fsdata.ts）共用的唯一口径。
 * 任何一侧改规则都要改这里，保证「CLI 拒绝的坏数据，前端也不会拿去汇总出 NaN」。
 */
export const VALID_TYPES: Set<string>;
