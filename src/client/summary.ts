import type { CardSnapshot, PointsSummary, ReadySummary } from './types.js'
import { readJsonResponse } from './api.js'

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

export interface PointsUpdate { revision: number }
type UpdateStream = AsyncIterable<PointsUpdate> & { dispose?(): void }

interface SummaryOptions {
  url?: string
  intervalMs?: number
  timeoutMs?: number
  baselineWaitMs?: number
  document?: Document
  updates?: (signal: AbortSignal) => UpdateStream
}

/** Owns one request at a time and publishes stable snapshots for React. */
export class SummaryStore {
  private snapshot: CardSnapshot = { status: 'loading' }
  private listeners = new Set<() => void>()
  private timer: ReturnType<typeof setTimeout> | undefined
  private wakeTimer: ReturnType<typeof setTimeout> | undefined
  private controller: AbortController | undefined
  private inFlight: Promise<void> | undefined
  private started = false
  private disposed = false
  private refreshPending = false
  private requestGeneration = 0
  private readonly options: Required<Omit<SummaryOptions, 'document' | 'updates'>>
  private readonly document: Document | undefined
  private readonly updates: SummaryOptions['updates']
  private updatesController: AbortController | undefined
  private updatesStream: UpdateStream | undefined
  private retryTimer: ReturnType<typeof setTimeout> | undefined
  private updateGeneration = 0
  private updateAttempt = 0
  private lastRevision: number | undefined
  private baselineRead: { generation: number } | undefined
  private baselineTimer: ReturnType<typeof setTimeout> | undefined

  constructor(options: SummaryOptions = {}) {
    this.options = { url: 'api/points-mall/summary', intervalMs: 30000, timeoutMs: 8000, baselineWaitMs: 200, ...options }
    this.document = options.document ?? (typeof document === 'undefined' ? undefined : document)
    this.updates = options.updates
  }

  getSnapshot = (): CardSnapshot => this.snapshot

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  start(): void {
    if (this.started || this.disposed) return
    this.started = true
    this.document?.addEventListener('visibilitychange', this.onVisibilityChange)
    this.document?.defaultView?.addEventListener('focus', this.wake)
    this.readAfterBaseline()
  }

  refresh = (): Promise<void> => {
    if (this.disposed || !this.isVisible()) return Promise.resolve()
    if (this.inFlight) {
      this.refreshPending = true
      return this.inFlight
    }
    clearTimeout(this.timer)
    clearTimeout(this.wakeTimer)
    this.wakeTimer = undefined
    const controller = new AbortController()
    this.controller = controller
    const generation = ++this.requestGeneration
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs)
    const request = async () => {
      try {
        const response = await fetch(this.options.url, { signal: controller.signal, cache: 'no-store' })
        const summary = decodeSummary(await readJsonResponse(response))
        if (!this.disposed && generation === this.requestGeneration) this.publish(summary)
      } catch (error) {
        if (!this.disposed && generation === this.requestGeneration) {
          this.publish({ status: 'error', message: error instanceof Error && error.name !== 'AbortError' ? error.message : '读取积分超时，请重试。' })
        }
      } finally {
        clearTimeout(timeout)
        this.controller = undefined
        this.inFlight = undefined
        if (!this.disposed && this.started && this.isVisible()) {
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
    clearTimeout(this.wakeTimer)
    this.document?.removeEventListener('visibilitychange', this.onVisibilityChange)
    this.document?.defaultView?.removeEventListener('focus', this.wake)
    this.controller?.abort()
    this.closeUpdates()
    this.listeners.clear()
  }

  /** A new native connection invalidates both the stream and its read baseline. */
  reconnectUpdates = (): void => {
    if (this.disposed) return
    this.closeUpdates()
    this.updateAttempt = 0
    this.readAfterBaseline()
  }

  private isVisible(): boolean {
    return this.document?.hidden !== true
  }

  private onVisibilityChange = (): void => {
    if (this.isVisible()) {
      if (this.updates && !this.updatesController) this.readAfterBaseline()
      else this.wake()
      return
    }
    clearTimeout(this.timer)
    clearTimeout(this.wakeTimer)
    this.wakeTimer = undefined
    this.refreshPending = false
    this.requestGeneration++
    this.controller?.abort()
    this.closeUpdates()
  }

  /** Visibility and focus commonly arrive together; share one refresh. */
  private wake = (): void => {
    if (this.disposed || !this.isVisible() || this.wakeTimer !== undefined) return
    if (this.baselineTimer !== undefined) return
    if (this.inFlight && !this.controller?.signal.aborted) return
    this.wakeTimer = setTimeout(() => {
      this.wakeTimer = undefined
      void this.refresh()
    }, 0)
  }

  /** Wait briefly for the registered stream's baseline; a slow carrier never blocks the card. */
  private readAfterBaseline(): void {
    if (this.disposed || !this.isVisible()) return
    if (!this.updates) { void this.refresh(); return }
    clearTimeout(this.wakeTimer)
    this.wakeTimer = undefined
    this.clearBaselineRead()
    const plan = { generation: this.updateGeneration + 1 }
    this.baselineRead = plan
    this.baselineTimer = setTimeout(() => {
      this.baselineTimer = undefined
      if (this.baselineRead === plan) void this.refresh()
    }, this.options.baselineWaitMs)
    this.openUpdates()
  }

  private clearBaselineRead(): void {
    clearTimeout(this.baselineTimer)
    this.baselineTimer = undefined
    this.baselineRead = undefined
  }

  private openUpdates(): void {
    if (!this.updates || this.disposed || !this.started || !this.isVisible() || this.updatesController) return
    clearTimeout(this.retryTimer)
    const controller = new AbortController()
    const generation = ++this.updateGeneration
    this.updatesController = controller
    void (async () => {
      let opening = true
      try {
        const stream = this.updates!(controller.signal)
        this.updatesStream = stream
        for await (const frame of stream) {
          if (controller.signal.aborted || generation !== this.updateGeneration || this.disposed) break
          if (!Number.isSafeInteger(frame?.revision) || frame.revision < 0) throw new Error('Invalid update revision')
          const previous = this.lastRevision
          this.lastRevision = frame.revision
          const isBaseline = opening
          opening = false
          if (isBaseline) {
            if (this.baselineRead?.generation === generation) this.clearBaselineRead()
            // HTTP and WebSocket registration are unordered. Only a read after this
            // frame is guaranteed to cover writes that occurred before subscription.
            void this.refresh()
          } else if (previous !== frame.revision) {
            this.updateAttempt = 0
            void this.refresh()
          }
        }
      } catch {
        // A missing/disconnected stream falls back to the bounded summary poll.
      } finally {
        if (generation !== this.updateGeneration) return
        this.updatesController = undefined
        this.updatesStream = undefined
        if (this.disposed || !this.started || !this.isVisible()) return
        if (this.baselineRead?.generation === generation) {
          this.clearBaselineRead()
          void this.refresh()
        }
        const delay = Math.min(1000 * 2 ** Math.min(this.updateAttempt++, 5), 30000)
        this.retryTimer = setTimeout(() => { this.openUpdates() }, delay)
      }
    })()
  }

  private closeUpdates(): void {
    clearTimeout(this.retryTimer)
    this.clearBaselineRead()
    this.updateGeneration++
    this.updatesController?.abort()
    this.updatesStream?.dispose?.()
    this.updatesController = undefined
    this.updatesStream = undefined
  }

  private publish(snapshot: CardSnapshot): void {
    this.snapshot = snapshot
    for (const listener of this.listeners) listener()
  }
}
