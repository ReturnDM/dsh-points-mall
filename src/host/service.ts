/** Authenticated HTTP and conversation operations over one configured local ledger. */
import { isAbsolute, normalize } from 'node:path'
import { createLedger, initializeData } from '../ledger/index.mjs'

/** Values captured from the plugin's DSH configuration at each operation. */
export interface PointsHostConfig {
  dataDir: string
  timeZone: string
  setupVersion: number
  jevEnabled: boolean
}

type Ledger = Awaited<ReturnType<typeof createLedger>>
type ReadySummary = Awaited<ReturnType<Ledger['summary']>>
type MutationResult = Awaited<ReturnType<Ledger['earn']>>
type ReviewResult = Awaited<ReturnType<PointsJudge['judge']>>

/** A review is advice; only an explicit earn operation changes the ledger. */
export interface PointsJudge {
  judge(input: { task: string; proposedPoints: number; rulesMarkdown?: string; tasks?: unknown }, signal?: AbortSignal): Promise<{
    status: 'reviewed' | 'fallback'
    accepted?: boolean
    probability?: number
    message: string
  }>
}

/** Summary states consumed by the sidebar, including missing configuration and read failures. */
export type PointsSummary = ReadySummary
  | { status: 'unconfigured'; defaultDataDir: string; timeZone: string }
  | { status: 'error'; message: string; code: string; timeZone: string }

/** Error presented at a local API or conversation tool. */
export class PointsHostError extends Error {
  constructor(message: string, readonly code: string) { super(message); this.name = 'PointsHostError' }
}

/** Stable public error fields without exception stacks. */
function errorFields(error: unknown): { code: string; message: string } {
  return {
    code: error instanceof Error && 'code' in error && typeof error.code === 'string' ? error.code : 'POINTS_ERROR',
    message: error instanceof Error ? error.message : String(error),
  }
}

/** Cancellation is control flow, never an advisory fallback. */
function rethrowCancellation(error: unknown, signal?: AbortSignal): void {
  signal?.throwIfAborted()
  if (error instanceof Error && error.name === 'AbortError') throw error
}

function validateReview(task: string, proposedPoints: number, signal?: AbortSignal): void {
  signal?.throwIfAborted()
  if (typeof task !== 'string' || !task.trim() || !Number.isSafeInteger(proposedPoints) || proposedPoints <= 0) {
    throw new PointsHostError('请提供事项和安全正整数建议积分。', 'INVALID_REWARD')
  }
}

/** Validate one absolute directory supplied by the configuration form or API. */
function dataDirectory(value: string): string {
  const path = value.trim()
  if (!path || !isAbsolute(path)) throw new PointsHostError('请选择完整的积分数据目录路径。', 'INVALID_DATA_DIRECTORY')
  return normalize(path)
}

/** Host adapter; it never stores a second copy of DSH configuration. */
export class PointsHostService {
  constructor(
    private readonly getConfig: () => PointsHostConfig,
    readonly defaultDataDir: string,
    private readonly judge?: PointsJudge,
    private readonly onMutation?: () => void,
  ) {}

  /** Read a snapshot for the current data directory; unconfigured plugins do no filesystem work. */
  async summary(): Promise<PointsSummary> {
    return this.summaryForConfig(this.captureConfig())
  }

  /** Create public defaults only after a user asks; saving the connection remains the form's responsibility. */
  async initialize(directory?: string) {
    const config = this.captureConfig()
    const dataDir = dataDirectory(directory?.trim() || this.defaultDataDir)
    await initializeData(dataDir)
    return this.validateForConfig(dataDir, config)
  }

  /** Validate and preview an existing directory without initializing or repairing files. */
  async validate(directory: string) {
    const config = this.captureConfig()
    const dataDir = dataDirectory(directory)
    return this.validateForConfig(dataDir, config)
  }

  /** Read actual rules, fixed tasks, and shop items before selecting a reward. */
  async rules() { return (await this.ledger()).rules() }

  /** Derive rules and balance in the engine's combined read under one configuration. */
  async rulesWithSummary() { return (await this.ledger()).rulesWithSummary() }

  /** Query newest persisted entries. */
  async list(limit = 20) {
    this.validateLimit(limit)
    return (await this.ledger()).list(limit)
  }

  /** Derive newest entries and balance from the same engine scan. */
  async listWithSummary(limit = 20) {
    this.validateLimit(limit)
    return (await this.ledger()).listWithSummary(limit)
  }

  /** Append one reward and include the resulting balance and level. */
  async earn(input: Parameters<Ledger['earn']>[0], signal?: AbortSignal) {
    return this.mutate(ledger => ledger.earn(input, { signal }), signal)
  }

  /** Append an adjustment instead of replacing any historical entry. */
  async adjust(input: Parameters<Ledger['adjust']>[0], signal?: AbortSignal) {
    return this.mutate(ledger => ledger.adjust(input, { signal }), signal)
  }

  /** Redeem an existing shop item. */
  async redeem(input: Parameters<Ledger['redeem']>[0], signal?: AbortSignal) {
    return this.mutate(ledger => ledger.redeem(input, { signal }), signal)
  }

  /** Mark an available voucher as used. */
  async use(input: Parameters<Ledger['use']>[0], signal?: AbortSignal) {
    return this.mutate(ledger => ledger.use(input, { signal }), signal)
  }

  /** Recycle a voucher or item according to the existing ledger rules. */
  async recycle(input: Parameters<Ledger['recycle']>[0], signal?: AbortSignal) {
    return this.mutate(ledger => ledger.recycle(input, { signal }), signal)
  }

  /** Check the configured directory without changing it. */
  async doctor() { return (await this.ledger()).doctor() }

  /** Validate and summarize one scanned set of entries, including corrupt-ledger errors. */
  async doctorWithSummary() { return (await this.ledger()).doctorWithSummary() }

  /** Review a proposed reward with the actual rules; it never records points. */
  async review(task: string, proposedPoints: number, signal?: AbortSignal) {
    validateReview(task, proposedPoints, signal)
    return this.reviewForConfig(this.captureConfig(), task, proposedPoints, signal)
  }

  /** Attach a balance using the configuration captured before the optional remote review. */
  async reviewWithSummary(task: string, proposedPoints: number, signal?: AbortSignal) {
    validateReview(task, proposedPoints, signal)
    const config = this.captureConfig()
    const result = await this.reviewForConfig(config, task, proposedPoints, signal)
    signal?.throwIfAborted()
    const summary = await this.summaryForConfig(config)
    signal?.throwIfAborted()
    return { ...result, summary }
  }

  /** Handle routes only after DSH Connection has authenticated and trusted the request. */
  async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname
    try {
      if (path === '/api/points-mall/summary' && request.method === 'GET') return Response.json(await this.summary())
      if (path === '/api/points-mall/rules' && request.method === 'GET') return Response.json(await this.rules())
      if (request.method === 'POST' && (path === '/api/points-mall/validate' || path === '/api/points-mall/initialize')) {
        let value: unknown
        try { value = await request.json() }
        catch { throw new PointsHostError('请求需要有效的 JSON 数据。', 'INVALID_REQUEST') }
        if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new PointsHostError('请求需要 JSON 对象。', 'INVALID_REQUEST')
        const field = 'dataDir' in value ? value.dataDir : undefined
        if (field !== undefined && typeof field !== 'string') throw new PointsHostError('数据目录需要是文本路径。', 'INVALID_REQUEST')
        if (path.endsWith('/validate')) {
          if (typeof field !== 'string') throw new PointsHostError('请选择积分数据目录。', 'INVALID_REQUEST')
          return Response.json(await this.validate(field))
        }
        return Response.json(await this.initialize(field))
      }
      return Response.json({ error: { code: 'NOT_FOUND', message: '没有找到此积分接口。' } }, { status: 404 })
    } catch (error) { return Response.json({ error: errorFields(error) }, { status: 400 }) }
  }

  private captureConfig(): PointsHostConfig { return { ...this.getConfig() } }

  private validateLimit(limit: number): void {
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new PointsHostError('流水数量需要是 1 到 1000 之间的整数。', 'INVALID_LIMIT')
  }

  private async summaryForConfig(config: PointsHostConfig): Promise<PointsSummary> {
    if (!config.dataDir.trim()) return { status: 'unconfigured', defaultDataDir: this.defaultDataDir, timeZone: config.timeZone }
    try { return await (await this.ledger(config)).summary() }
    catch (error) { return { status: 'error', ...errorFields(error), timeZone: config.timeZone } }
  }

  private async validateForConfig(dataDir: string, config: PointsHostConfig) {
    const { summary, ...validation } = await (await this.ledger({ ...config, dataDir })).doctorWithSummary()
    if (!validation.valid || summary.status !== 'ready') {
      throw new PointsHostError(validation.issues.join('\n') || '积分账本无法读取。', 'INVALID_LEDGER')
    }
    return { dataDir, summary, validation }
  }

  private async mutate(operation: (ledger: Ledger) => Promise<MutationResult>, signal?: AbortSignal): Promise<MutationResult> {
    signal?.throwIfAborted()
    const result = await operation(await this.ledger())
    if (!result.duplicate) {
      // Notification is best effort; the persisted transaction already succeeded.
      try { this.onMutation?.() } catch { /* A failed update signal cannot undo a committed entry. */ }
    }
    return result
  }

  private async reviewForConfig(config: PointsHostConfig, task: string, proposedPoints: number, signal?: AbortSignal): Promise<ReviewResult> {
    signal?.throwIfAborted()
    if (!config.dataDir.trim()) {
      return { status: 'fallback', message: '请先在生活积分插件设置中创建或连接账本，再按真实规则定分和记账。' }
    }
    if (!config.jevEnabled || this.judge === undefined) {
      return { status: 'fallback', message: 'Jev 复核未启用，请按已有规则及当前模型判断定分，并在备注标记未经 Jev 复核。' }
    }
    let rules: Awaited<ReturnType<Ledger['rules']>>
    try {
      rules = await (await this.ledger(config)).rules()
      signal?.throwIfAborted()
    } catch (error) {
      rethrowCancellation(error, signal)
      return { status: 'fallback', message: '当前积分规则无法读取，请先检查并修复数据目录和规则文件；不要在规则恢复前继续记账。' }
    }
    try {
      const result = await this.judge.judge({ task, proposedPoints, rulesMarkdown: rules.rulesMarkdown, tasks: rules.tasks }, signal)
      signal?.throwIfAborted()
      return result
    } catch (error) {
      rethrowCancellation(error, signal)
      return { status: 'fallback', message: 'Jev 暂时无法复核；请由当前模型按现有规则定分，并在备注标记未经 Jev 复核。' }
    }
  }

  private async ledger(config = this.captureConfig()): Promise<Ledger> {
    if (!config.dataDir.trim()) throw new PointsHostError('请先在生活积分插件设置中创建或连接账本。', 'POINTS_UNCONFIGURED')
    return createLedger(dataDirectory(config.dataDir), { timeZone: config.timeZone })
  }
}
