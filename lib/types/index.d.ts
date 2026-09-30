/** Host entry for the DSH Desktop points-mall bundle. */
import type { Context, Volatile } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
/** Stable plugin entry id, also used by the Client's ConfigForms. */
export declare const name = "points-mall";
/** Runtime services supplied by the Desktop profile. */
export declare const inject: string[];
/** Live settings accepted by the current profile's configuration editor. */
export interface Config {
    dataDir: Volatile<string>;
    timeZone: Volatile<string>;
    setupVersion: Volatile<number>;
    jevEnabled: Volatile<boolean>;
}
/** Blank dataDir keeps the plugin available until the user completes setup. */
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    dataDir: z<string, string, "volatile-defined">;
    timeZone: z<string, string, "volatile-defined">;
    setupVersion: z<number, number, "volatile-defined">;
    jevEnabled: z<boolean, boolean, "volatile-defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    dataDir: z<string, string, "volatile-defined">;
    timeZone: z<string, string, "volatile-defined">;
    setupVersion: z<number, number, "volatile-defined">;
    jevEnabled: z<boolean, boolean, "volatile-defined">;
}>>, "plain">;
/** Register authenticated routes, model tools, and the bundled conversation skill. */
export declare function apply(ctx: Context, config: Config): void;
