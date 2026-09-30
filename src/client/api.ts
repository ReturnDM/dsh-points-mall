/** Translate invalid bodies without swallowing transport cancellation. */
export async function readJsonResponse<T>(response: Response): Promise<T> {
  let value: unknown
  try {
    value = await response.json()
  } catch (error) {
    if (!(error instanceof Error) || error.name !== 'SyntaxError') throw error
    throw new Error(response.ok
      ? '服务返回的内容不是有效 JSON，请重试。'
      : `请求失败（HTTP ${response.status}），请重试。`)
  }
  if (!response.ok) {
    const message = (value as { error?: { message?: unknown } } | null)?.error?.message
    throw new Error(typeof message === 'string'
      ? `请求失败（HTTP ${response.status}）：${message}`
      : `请求失败（HTTP ${response.status}），请重试。`)
  }
  return value as T
}

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
  return readJsonResponse<T>(response)
}
