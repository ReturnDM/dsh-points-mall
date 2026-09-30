import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client';
import type { SummaryStore } from './summary.js';
import type { PointsSettings } from './types.js';
interface ConfigurationProps {
    form: ConfigForm<PointsSettings>;
    summary: SummaryStore;
}
export declare function Configuration({ form, summary }: ConfigurationProps): import("react").JSX.Element;
export declare function Activation({ onOpenDetails, onDismiss }: {
    onOpenDetails: () => void;
    onDismiss: () => void;
}): import("react").JSX.Element;
export {};
