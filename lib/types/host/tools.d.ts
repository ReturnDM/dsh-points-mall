/** DSH-native points tools with schema-validated arguments and JSON results. */
import { type ToolDefinition } from '@deepseek-ai/dsh-tools';
import type { PointsHostService } from './service.ts';
/** Create the definitions once; every execution captures current configuration through the service. */
export declare function createPointsTools(service: PointsHostService): ToolDefinition[];
