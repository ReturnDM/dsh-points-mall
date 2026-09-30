import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import { requestJson } from './api.js'
import type { PointsSettings } from './types.js'

export interface SetupOptions {
  mode: 'new' | 'existing'
  dataDir: string
  timeZone: string
  form: Pick<ConfigForm<PointsSettings>, 'getSnapshot' | 'mutate'>
  baseUrl?: string
}

/** Validate or initialize first, then persist one revision-fenced Host mutation. */
export async function completeSetup(options: SetupOptions): Promise<string> {
  const snapshot = options.form.getSnapshot()
  if (snapshot.status !== 'ready' || !snapshot.writable) throw new Error('账本设置尚未准备好，请稍后重试。')
  const dataDir = options.dataDir.trim()
  const timeZone = options.timeZone.trim()
  try { new Intl.DateTimeFormat('zh-CN', { timeZone }).format() }
  catch { throw new Error('时区无效，请使用 Asia/Shanghai 等时区名称。') }
  if (options.mode === 'existing' && !dataDir) throw new Error('请先选择已有账本目录。')
  const endpoint = options.mode === 'new' ? 'initialize' : 'validate'
  const value = await requestJson<{ dataDir: string; validation: { valid: boolean; issues?: string[] } }>(
    `${options.baseUrl ?? 'api/points-mall/'}${endpoint}`,
    { method: 'POST', body: dataDir ? { dataDir } : {} },
  )
  if (typeof value.dataDir !== 'string' || !value.dataDir || value.validation?.valid !== true) {
    throw new Error('账本未通过检查，请检查目录后重试。')
  }
  const accepted = await options.form.mutate([
    { op: 'set', path: ['dataDir'], value: value.dataDir },
    { op: 'set', path: ['timeZone'], value: timeZone },
    { op: 'set', path: ['setupVersion'], value: 1 },
    ...((snapshot.value?.setupVersion ?? 0) < 1 ? [{ op: 'set' as const, path: ['jevEnabled'], value: false }] : []),
  ], snapshot.revision)
  if (!accepted) throw new Error('配置未能保存，请重试；新建的账本可以通过“连接已有账本”继续使用。')
  return value.dataDir
}
