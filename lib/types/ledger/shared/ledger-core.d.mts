/** 由总经验计算等级与级内进度（对浮点开方边界做了校正） */
export function levelFromExp(totalExp: any): {
    level: number;
    expInLevel: number;
    expToNext: number;
    expRequired: number;
};
/**
 * 汇总：余额 / 累计经验 / 等级 / 背包（未核销未作废的券）/ 各券当前实付。
 * 返回的 voucherPaid 供回收估值展示，避免调用方重复计算 voucherState。
 */
export function summarize(entries: any): {
    points: number;
    exp: number;
    level: {
        level: number;
        expInLevel: number;
        expToNext: number;
        expRequired: number;
    };
    backpack: any[];
    voucherPaid: Map<any, any>;
};
export function expForLevel(level: any): number;
/** 实物默认汇率：20 积分 = 1 元（可被数据目录 config.json 的 physicalRate 覆盖） */
export const DEFAULT_RATE: 20;
export function yuanToPoints(yuan: any, rate?: number): number;
import { RECYCLE_RATE } from './ledger-state.mjs';
import { recycleValue } from './ledger-state.mjs';
export { RECYCLE_RATE, recycleValue };
