import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'

declare module '@deepseek-ai/cordis' {
  interface Context {
    pointsMallUpdates: PointsMallUpdates
  }
}

/** Process-local invalidations; frames carry no ledger paths or personal data. */
export class PointsMallUpdates extends TypertRemoteService {
  private revision = 0
  private closed = false
  private readonly listeners = new Set<() => void>()

  constructor(ctx: Context) {
    super(ctx, 'pointsMallUpdates')
    ctx.effect(() => () => {
      this.closed = true
      for (const listener of this.listeners) listener()
      this.listeners.clear()
    }, 'points-mall: close update streams')
  }

  /** Call only after a new record has committed. Rapid writes coalesce naturally. */
  notify(): void {
    if (this.closed) return
    this.revision++
    for (const listener of this.listeners) listener()
  }

  /** Baseline plus invalidations over DSH's authenticated Remote stream carrier. */
  @Remote({ mode: 'stream' })
  async *watch(signal: AbortSignal): AsyncGenerator<{ revision: number }, void, void> {
    signal.throwIfAborted()
    if (this.closed) return
    let wake: (() => void) | undefined
    const changed = () => { wake?.() }
    this.listeners.add(changed)
    signal.addEventListener('abort', changed, { once: true })
    try {
      while (!this.closed && !signal.aborted) {
        const observed = this.revision
        yield { revision: observed }
        await new Promise<void>(resolve => {
          wake = resolve
          // A write, disposal or cancellation may happen while the yielded frame is consumed.
          if (this.closed || signal.aborted || this.revision !== observed) resolve()
        })
        wake = undefined
      }
    } finally {
      signal.removeEventListener('abort', changed)
      this.listeners.delete(changed)
    }
  }
}
