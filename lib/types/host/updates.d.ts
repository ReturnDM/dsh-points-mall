import type { Context } from '@deepseek-ai/cordis';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
declare module '@deepseek-ai/cordis' {
    interface Context {
        pointsMallUpdates: PointsMallUpdates;
    }
}
/** Process-local invalidations; frames carry no ledger paths or personal data. */
export declare class PointsMallUpdates extends TypertRemoteService {
    private revision;
    private closed;
    private readonly listeners;
    constructor(ctx: Context);
    /** Call only after a new record has committed. Rapid writes coalesce naturally. */
    notify(): void;
    /** Baseline plus invalidations over DSH's authenticated Remote stream carrier. */
    watch(signal: AbortSignal): AsyncGenerator<{
        revision: number;
    }, void, void>;
}
