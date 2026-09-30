import type { CardSnapshot, PointsSummary } from './types.js';
export declare function decodeSummary(value: unknown): PointsSummary;
interface SummaryOptions {
    url?: string;
    intervalMs?: number;
    timeoutMs?: number;
}
/** Owns one request at a time and publishes stable snapshots for React. */
export declare class SummaryStore {
    private snapshot;
    private listeners;
    private timer;
    private controller;
    private inFlight;
    private started;
    private disposed;
    private refreshPending;
    private readonly options;
    constructor(options?: SummaryOptions);
    getSnapshot: () => CardSnapshot;
    subscribe: (listener: () => void) => (() => void);
    start(): void;
    refresh: () => Promise<void>;
    dispose(): void;
    private publish;
}
export {};
