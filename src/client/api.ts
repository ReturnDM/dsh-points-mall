export async function requestJson<T>(
  path: string,
  options: { method?: 'GET' | 'POST'; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const timeout = AbortSignal.timeout(8000)
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout
  const response = await fetch(path, {
    method: options.method ?? 'GET',
    headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: 'no-store',
    signal,
  })
  const value = await response.json() as { error?: { message?: unknown } }
  if (!response.ok) {
    const message = value?.error?.message
    throw new Error(typeof message === 'string' ? message : '操作暂时未能完成，请重试。')
  }
  return value as T
}
