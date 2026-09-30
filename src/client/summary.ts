import type { CardSnapshot, PointsSummary, ReadySummary } from './types.js'

export function decodeSummary(value: unknown): PointsSummary {
  if (!value || typeof value !== 'object') throw new Error('积分数据格式异常，请重试或检查账本。')
  const data = value as Record<string, unknown>
  if (data.status === 'error' && typeof data.message === 'string') {
    return { status: 'error', message: data.message }
  }
  if (data.status === 'unconfigured') {
    return {
      status: 'unconfigured',
      ...(typeof data.defaultDataDir === 'string' ? { defaultDataDir: data.defaultDataDir } : {}),
      ...(typeof data.timeZone === 'string' ? { timeZone: data.timeZone } : {}),
      ...(typeof data.message === 'string' ? { message: data.message } : {}),
    }
  }
  const integers = ['balance', 'totalExp', 'level', 'expInLevel', 'expRequired', 'expToNext', 'todayEarned'] as const
  const strings = ['day', 'timeZone', 'updatedAt'] as const
  if (data.status !== 'ready'
    || !integers.every(key => Number.isSafeInteger(data[key]))
    || !strings.every(key => typeof data[key] === 'string' && (data[key] as string).length > 0)
    || typeof data.progress !== 'number' || !Number.isFinite(data.progress) || data.progress < 0 || data.progress > 1
    || (data.level as number) < 1 || (data.totalExp as number) < 0 || (data.expInLevel as number) < 0
    || (data.expRequired as number) <= 0 || (data.expToNext as number) < 0
    || (data.expInLevel as number) >= (data.expRequired as number)
    || (data.expRequired as number) - (data.expInLevel as number) !== data.expToNext
    || Math.abs(data.progress - (data.expInLevel as number) / (data.expRequired as number)) > 1e-9) {
    throw new Error('积分数据格式异常，请重试或检查账本。')
  }
  return data as unknown as ReadySummary
}

interface SummaryOptions {
  url?: string
  intervalMs?: number
  timeoutMs?: number
}

/** Owns one request at a time and publishes stable snapshots for React. */
export class SummaryStore {
  private snapshot: CardSnapshot = { status: 'loading' }
  private listeners = new Set<() => void>()
  private timer: ReturnType<typeof setTimeout> | undefined
  private controller: AbortController | undefined
  private inFlight: Promise<void> | undefined
  private started = false
  private disposed = false
  private refreshPending = false
  private readonly options: Required<SummaryOptions>

  constructor(options: SummaryOptions = {}) {
    this.options = { url: 'api/points-mall/summary', intervalMs: 5000, timeoutMs: 8000, ...options }
  }

  getSnapshot = (): CardSnapshot => this.snapshot

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  start(): void {
    if (this.started || this.disposed) return
    this.started = true
    void this.refresh()
  }

  refresh = (): Promise<void> => {
    if (this.disposed) return Promise.resolve()
    if (this.inFlight) {
      this.refreshPending = true
      return this.inFlight
    }
    clearTimeout(this.timer)
    const controller = new AbortController()
    this.controller = controller
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs)
    const request = async () => {
      try {
        const response = await fetch(this.options.url, { signal: controller.signal, cache: 'no-store' })
        if (!response.ok) throw new Error('暂时无法读取积分，请重试。')
        const summary = decodeSummary(await response.json())
        if (!this.disposed) this.publish(summary)
      } catch (error) {
        if (!this.disposed) {
          this.publish({ status: 'error', message: error instanceof Error && error.name !== 'AbortError' ? error.message : '读取积分超时，请重试。' })
        }
      } finally {
        clearTimeout(timeout)
        this.controller = undefined
        this.inFlight = undefined
        if (!this.disposed && this.started) {
          const delay = this.refreshPending ? 0 : this.options.intervalMs
          this.refreshPending = false
          this.timer = setTimeout(() => { void this.refresh() }, delay)
        }
      }
    }
    this.inFlight = request()
    return this.inFlight
  }

  dispose(): void {
    this.disposed = true
    clearTimeout(this.timer)
    this.controller?.abort()
    this.listeners.clear()
  }

  private publish(snapshot: CardSnapshot): void {
    this.snapshot = snapshot
    for (const listener of this.listeners) listener()
  }
}
