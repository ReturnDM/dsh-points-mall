/**
 * Compute the current effect of each entry, including adjustments to adjustments.
 * Zero-value entries (voucher uses) have no numeric effect, so their reversal
 * state is determined by the active zero-value reversal immediately below them.
 */
export function voucherState(entries: any): {
    consumed: Set<any>;
    voided: Set<any>;
    activeConsumptions: Map<any, any>;
    isFullyReversed: (entryOrId: any) => any;
    effectiveTotal: (entryOrId: any) => any;
};
/** Account-level errors shared by the CLI and browser. Empty means trustworthy. */
export function ledgerErrors(entries: any): string[];
/** 回收返还比例：当前有效实付积分 × RECYCLE_RATE，向下取整（ledger-core 再导出） */
export const RECYCLE_RATE: 0.8;
export function recycleValue(paidPoints: any): number;
