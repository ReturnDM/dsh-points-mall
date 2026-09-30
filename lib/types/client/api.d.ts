/** Translate invalid bodies without swallowing transport cancellation. */
export declare function readJsonResponse<T>(response: Response): Promise<T>;
export declare function requestJson<T>(path: string, options?: {
    method?: 'GET' | 'POST';
    body?: unknown;
    signal?: AbortSignal;
}): Promise<T>;
