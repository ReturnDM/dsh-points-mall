import type { CardSnapshot, PointsSummary } from './types.js';
export declare function decodeSummary(value: unknown): PointsSummary;
export interface PointsUpdate {
    revision: number;
}
type UpdateStream = AsyncIterable<PointsUpdate> & {
    dispose?(): void;
};
interface SummaryOptions {
    url?: string;
    intervalMs?: number;
    timeoutMs?: number;
    baselineWaitMs?: number;
    document?: Document;
    updates?: (signal: AbortSignal) => UpdateStream;
}
/** Owns one request at a time and publishes stable snapshots for React. */
export declare class SummaryStore {
    private snapshot;
    private listeners;
    private timer;
    private wakeTimer;
    private controller;
    private inFlight;
    private started;
    private disposed;
    private refreshPending;
    private requestGeneration;
    private readonly options;
    private readonly document;
    private readonly updates;
    private updatesController;
    private updatesStream;
    private retryTimer;
    private updateGeneration;
    private updateAttempt;
    private lastRevision;
    private baselineRead;
    private baselineTimer;
    constructor(options?: SummaryOptions);
    getSnapshot: () => CardSnapshot;
    subscribe: (listener: () => void) => (() => void);
    start(): void;
    refresh: () => Promise<void>;
    dispose(): void;
    /** A new native connection invalidates both the stream and its read baseline. */
    reconnectUpdates: () => void;
    private isVisible;
    private onVisibilityChange;
    /** Visibility and focus commonly arrive together; share one refresh. */
    private wake;
    /** Wait briefly for the registered stream's baseline; a slow carrier never blocks the card. */
    private readAfterBaseline;
    private clearBaselineRead;
    private openUpdates;
    private closeUpdates;
    private publish;
}
export {};
