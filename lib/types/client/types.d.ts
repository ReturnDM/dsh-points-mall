export interface ReadySummary {
    status: 'ready';
    balance: number;
    totalExp: number;
    level: number;
    expInLevel: number;
    expRequired: number;
    expToNext: number;
    progress: number;
    todayEarned: number;
    day: string;
    timeZone: string;
    updatedAt: string;
}
export interface UnconfiguredSummary {
    status: 'unconfigured';
    defaultDataDir?: string;
    timeZone?: string;
    message?: string;
}
export type PointsSummary = ReadySummary | UnconfiguredSummary | {
    status: 'error';
    message: string;
};
export type CardSnapshot = PointsSummary | {
    status: 'loading';
};
export interface PointsSettings {
    dataDir: string;
    timeZone: string;
    setupVersion: number;
    jevEnabled: boolean;
}
