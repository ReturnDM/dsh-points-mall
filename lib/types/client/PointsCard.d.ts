import type { CardSnapshot } from './types.js';
export interface PointsCardProps {
    snapshot: CardSnapshot;
    onConfigure: () => void;
    onRetry: () => void;
}
export declare function PointsCard({ snapshot, onConfigure, onRetry }: PointsCardProps): import("react").JSX.Element;
