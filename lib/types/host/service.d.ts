import { createLedger } from '../ledger/index.mjs';
/** Values captured from the plugin's DSH configuration at each operation. */
export interface PointsHostConfig {
    dataDir: string;
    timeZone: string;
    setupVersion: number;
    jevEnabled: boolean;
}
type Ledger = Awaited<ReturnType<typeof createLedger>>;
type ReadySummary = Awaited<ReturnType<Ledger['summary']>>;
/** A review is advice; only an explicit earn operation changes the ledger. */
export interface PointsJudge {
    judge(input: {
        task: string;
        proposedPoints: number;
        rulesMarkdown?: string;
        tasks?: unknown;
    }, signal?: AbortSignal): Promise<{
        status: 'reviewed' | 'fallback';
        accepted?: boolean;
        probability?: number;
        message: string;
    }>;
}
/** Summary states consumed by the sidebar, including missing configuration and read failures. */
export type PointsSummary = ReadySummary | {
    status: 'unconfigured';
    defaultDataDir: string;
    timeZone: string;
} | {
    status: 'error';
    message: string;
    code: string;
    timeZone: string;
};
/** Error presented at a local API or conversation tool. */
export declare class PointsHostError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
/** Host adapter; it never stores a second copy of DSH configuration. */
export declare class PointsHostService {
    private readonly getConfig;
    readonly defaultDataDir: string;
    private readonly judge?;
    constructor(getConfig: () => PointsHostConfig, defaultDataDir: string, judge?: PointsJudge | undefined);
    /** Read a snapshot for the current data directory; unconfigured plugins do no filesystem work. */
    summary(): Promise<PointsSummary>;
    /** Create public defaults only after a user asks; saving the connection remains the form's responsibility. */
    initialize(directory?: string): Promise<{
        dataDir: string;
        summary: import("../ledger/index.mjs").Summary;
        validation: import("../ledger/index.mjs").ValidationReport;
    }>;
    /** Validate and preview an existing directory without initializing or repairing files. */
    validate(directory: string): Promise<{
        dataDir: string;
        summary: import("../ledger/index.mjs").Summary;
        validation: import("../ledger/index.mjs").ValidationReport;
    }>;
    /** Read actual rules, fixed tasks, and shop items before selecting a reward. */
    rules(): Promise<import("../ledger/index.mjs").Rules>;
    /** Query newest persisted entries. */
    list(limit?: number): Promise<import("../ledger/index.mjs").LedgerEntry[]>;
    /** Append one reward and include the resulting balance and level. */
    earn(input: Parameters<Ledger['earn']>[0], signal?: AbortSignal): Promise<import("../ledger/index.mjs").MutationResult>;
    /** Append an adjustment instead of replacing any historical entry. */
    adjust(input: Parameters<Ledger['adjust']>[0], signal?: AbortSignal): Promise<import("../ledger/index.mjs").MutationResult>;
    /** Redeem an existing shop item. */
    redeem(input: Parameters<Ledger['redeem']>[0], signal?: AbortSignal): Promise<import("../ledger/index.mjs").MutationResult>;
    /** Mark an available voucher as used. */
    use(input: Parameters<Ledger['use']>[0], signal?: AbortSignal): Promise<import("../ledger/index.mjs").MutationResult>;
    /** Recycle a voucher or item according to the existing ledger rules. */
    recycle(input: Parameters<Ledger['recycle']>[0], signal?: AbortSignal): Promise<import("../ledger/index.mjs").MutationResult>;
    /** Check the configured directory without changing it. */
    doctor(): Promise<import("../ledger/index.mjs").ValidationReport>;
    /** Review a proposed reward with the actual rules; it never records points. */
    review(task: string, proposedPoints: number, signal?: AbortSignal): Promise<{
        status: "reviewed" | "fallback";
        accepted?: boolean;
        probability?: number;
        message: string;
    }>;
    /** Handle routes only after DSH Connection has authenticated and trusted the request. */
    fetch(request: Request): Promise<Response>;
    private ledger;
}
export {};
