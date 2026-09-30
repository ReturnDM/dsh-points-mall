import type { Context } from '@deepseek-ai/cordis';
import type { RemoteStreamHandle } from '@deepseek-ai/dsh-typert-protocol';
import { type PointsUpdate } from './summary.js';
export declare const name = "points-mall-client";
export declare const inject: string[];
export declare const PACKAGE_NAME = "dsh-points-mall";
declare module '@deepseek-ai/dsh-typert-protocol' {
    interface TypertRemoteNamespaceMap {
        pointsMallUpdates: {
            watch(signal?: AbortSignal): RemoteStreamHandle<PointsUpdate, never>;
        };
    }
}
export declare function apply(ctx: Context): void;
