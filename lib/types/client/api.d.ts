export declare function requestJson<T>(path: string, options?: {
    method?: 'GET' | 'POST';
    body?: unknown;
    signal?: AbortSignal;
}): Promise<T>;
