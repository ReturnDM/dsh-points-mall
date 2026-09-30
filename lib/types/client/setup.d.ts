import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client';
import type { PointsSettings } from './types.js';
export interface SetupOptions {
    mode: 'new' | 'existing';
    dataDir: string;
    timeZone: string;
    form: Pick<ConfigForm<PointsSettings>, 'getSnapshot' | 'mutate'>;
    baseUrl?: string;
}
/** Validate or initialize first, then persist one revision-fenced Host mutation. */
export declare function completeSetup(options: SetupOptions): Promise<string>;
