/** Desktop sidebar integration, isolated from the shell's React tree. */
export declare const POINTS_CARD_SELECTOR = "[data-dsh-life-points-card]";
export declare function mountCardContainer(document: Document, render: (container: HTMLElement) => () => void): () => void;
