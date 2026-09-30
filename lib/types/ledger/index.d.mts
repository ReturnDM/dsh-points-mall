export interface LedgerEntry {
  id: string
  time: string
  type: 'earn' | 'adjust' | 'redeem_physical' | 'redeem_voucher' | 'use_voucher' | 'recycle_voucher'
  title: string
  points: number
  exp: number
  ref?: string
  note?: string
  rate?: number
  idempotencyKey?: string
  idempotencyFingerprint?: string
  idempotencyFingerprintVersion?: 1 | 2
}

export interface Summary {
  status: 'ready'
  balance: number
  totalExp: number
  level: number
  expInLevel: number
  expRequired: number
  expToNext: number
  /** Fraction in [0, 1), suitable for a progress bar. */
  progress: number
  todayEarned: number
  /** YYYY-MM-DD in the configured timezone. */
  day: string
  timeZone: string
  updatedAt: string
}

export interface ErrorSummary {
  status: 'error'
  code: string
  message: string
  timeZone: string
}

export interface TaskPricing {
  tiers: number[]
  tasks: { id: string; name: string; points: number; emoji?: string }[]
}

export interface ShopItem {
  id: string
  name: string
  type: 'voucher' | 'physical'
  points?: number
  yuan?: number
  desc?: string
  emoji?: string
}

export interface Rules {
  tasks: TaskPricing
  shop: ShopItem[]
  rulesMarkdown: string
  physicalRate: number
}

export interface ValidationReport {
  valid: boolean
  issues: string[]
  entryCount: number
}

export interface WriteOptions {
  note?: string
  idempotencyKey?: string
}
export interface EarnInput extends WriteOptions { title: string; points: number }
export interface AdjustInput extends WriteOptions { ref: string; points?: number; exp?: number; title?: string }
export interface RedeemInput extends WriteOptions { itemId: string }
export interface VoucherInput extends WriteOptions { ref: string }

export interface MutationResult {
  entry: LedgerEntry
  summary: Summary
  duplicate: boolean
}

export interface OperationOptions { signal?: AbortSignal }

export interface Ledger {
  summary(): Promise<Summary>
  rules(): Promise<Rules>
  /** One loaded view; does not promise an atomic snapshot across external edits. */
  rulesWithSummary(): Promise<Rules & { summary: Summary }>
  list(limit?: number): Promise<LedgerEntry[]>
  listWithSummary(limit?: number): Promise<{ entries: LedgerEntry[]; summary: Summary }>
  earn(input: EarnInput, options?: OperationOptions): Promise<MutationResult>
  adjust(input: AdjustInput, options?: OperationOptions): Promise<MutationResult>
  redeem(input: RedeemInput, options?: OperationOptions): Promise<MutationResult>
  use(input: VoucherInput, options?: OperationOptions): Promise<MutationResult>
  recycle(input: VoucherInput, options?: OperationOptions): Promise<MutationResult>
  doctor(): Promise<ValidationReport>
  doctorWithSummary(): Promise<ValidationReport & { summary: Summary | ErrorSummary }>
}

export function createLedger(dataDir: string, options?: { timeZone?: string; now?: () => Date }): Promise<Ledger>
/** Only writes missing starter files; never rewrites the existing ledger or rules. */
export function initializeData(dataDir: string): Promise<ValidationReport>
/** Reads and validates without creating or changing any files. */
export function validateData(dataDir: string): Promise<ValidationReport>
