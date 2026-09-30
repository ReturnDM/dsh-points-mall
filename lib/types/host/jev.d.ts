export interface JudgeInput {
    task: string;
    proposedPoints: number;
    rulesMarkdown?: string;
    tasks?: unknown;
}
export interface JudgeResult {
    status: 'reviewed' | 'fallback';
    accepted?: boolean;
    probability?: number;
    message: string;
}
export interface JevOptions {
    enabled: () => boolean;
    resolveKey: () => Promise<string | undefined>;
    fetch?: typeof fetch;
    timeoutMs?: number;
}
/** Advisory review only. The calling DSH model remains responsible for scoring. */
export declare function createJevJudge(options: JevOptions): {
    judge(input: JudgeInput, signal?: AbortSignal): Promise<JudgeResult>;
};
