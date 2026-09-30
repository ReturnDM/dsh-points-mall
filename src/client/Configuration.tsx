import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent } from 'react'
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import { requestJson } from './api.js'
import { completeSetup } from './setup.js'
import type { SummaryStore } from './summary.js'
import type { PointsSettings } from './types.js'

interface ConfigurationProps {
  form: ConfigForm<PointsSettings>
  summary: SummaryStore
}

interface CredentialStatus {
  configured: boolean
  writable: boolean
  source?: string
}

function message(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') return '操作超时，请重试。'
    return error.message
  }
  return '操作未能完成，请重试。'
}

function JevSettings({ form }: { form: ConfigForm<PointsSettings> }) {
  const snapshot = useSyncExternalStore(form.subscribe.bind(form), form.getSnapshot.bind(form), form.getSnapshot.bind(form))
  const id = useId()
  const [credential, setCredential] = useState<CredentialStatus>()
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    const controller = new AbortController()
    void requestJson<CredentialStatus>('api/points-mall/jev-key', { signal: controller.signal })
      .then(value => { if (mounted.current) setCredential(value) })
      .catch(value => { if (mounted.current && !controller.signal.aborted) setError(message(value)) })
    return () => { mounted.current = false; controller.abort() }
  }, [])

  const manageKey = async (clear: boolean) => {
    if (busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await requestJson<CredentialStatus>(`api/points-mall/jev-key${clear ? '/clear' : ''}`, {
        method: 'POST', body: clear ? {} : { key: key.trim() },
      })
      if (!mounted.current) return
      setCredential(result)
      setKey('')
      setNotice(clear ? '已移除 Jev 密钥。' : 'Jev 密钥已保存。')
    } catch (value) { if (mounted.current) setError(message(value)) }
    finally { if (mounted.current) setBusy(false) }
  }

  const setEnabled = async (enabled: boolean) => {
    setBusy(true); setError(''); setNotice('')
    try {
      const current = form.getSnapshot()
      const accepted = await form.mutate([{ op: 'set', path: ['jevEnabled'], value: enabled }], current.revision)
      if (!accepted) throw new Error('Jev 设置未能保存，请重试。')
    } catch (value) { if (mounted.current) setError(message(value)) }
    finally { if (mounted.current) setBusy(false) }
  }
  const enabled = snapshot.value?.jevEnabled ?? false
  return <fieldset className="pm-divider">
    <legend>Jev 复核（可选）</legend>
    <p>未设固定分值的事项默认由当前 DSH 模型定分。启用 Jev 后，会使用额外的 API 密钥复核。</p>
    <label className="pm-choice"><input type="checkbox" checked={enabled} disabled={busy || !snapshot.writable || (!credential?.configured && !enabled)} onChange={event => { void setEnabled(event.target.checked) }} />启用 Jev 复核</label>
    <div className="pm-field">
      <label htmlFor={`${id}-key`}>TypeSafe API 密钥</label>
      <div className="pm-input-row"><input id={`${id}-key`} type="password" value={key} onChange={event => setKey(event.target.value)} autoComplete="off" spellCheck={false} placeholder={credential?.configured ? '已保存；填写可替换' : '填写密钥后即可启用'} disabled={busy || credential?.writable === false} /><button type="button" className="pm-button" disabled={busy || !key.trim() || credential?.writable === false} onClick={() => { void manageKey(false) }}>保存密钥</button></div>
      <small>{credential === undefined ? '正在检查密钥…' : credential.configured ? '密钥已配置，保存后不会显示原值。' : '尚未配置密钥。无需 Jev 也可以正常记账。'}</small>
      {credential?.configured && <button type="button" className="pm-text-button" disabled={busy || !credential.writable} onClick={() => { void manageKey(true) }}>移除密钥</button>}
    </div>
    {error && <div className="pm-error" role="alert">{error}</div>}
    {notice && <div className="pm-success" role="status">{notice}</div>}
  </fieldset>
}

export function Configuration({ form, summary }: ConfigurationProps) {
  const snapshot = useSyncExternalStore(form.subscribe.bind(form), form.getSnapshot.bind(form), form.getSnapshot.bind(form))
  const card = useSyncExternalStore(summary.subscribe, summary.getSnapshot, summary.getSnapshot)
  const id = useId()
  const configured = (snapshot.value?.setupVersion ?? 0) >= 1 && Boolean(snapshot.value?.dataDir)
  const [mode, setMode] = useState<'new' | 'existing'>(configured ? 'existing' : 'new')
  const [dataDir, setDataDir] = useState(snapshot.value?.dataDir ?? '')
  const [timeZone, setTimeZone] = useState(snapshot.value?.timeZone ?? 'Asia/Shanghai')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const dirty = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    if (snapshot.status === 'ready' && !dirty.current) {
      setDataDir(snapshot.value?.dataDir ?? '')
      setTimeZone(snapshot.value?.timeZone ?? 'Asia/Shanghai')
      setMode((snapshot.value?.setupVersion ?? 0) >= 1 ? 'existing' : 'new')
    }
  }, [snapshot.status, snapshot.value])
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const pickDirectory = async () => {
    setError('')
    const picker = (globalThis as typeof globalThis & { __DSH_DIRECTORY_PICKER__?: { pick(): Promise<string | null> } }).__DSH_DIRECTORY_PICKER__
    if (!picker) { setError('此环境无法打开目录选择器，请在输入框中填写账本目录。'); return }
    try {
      const selected = await picker.pick()
      if (selected && mounted.current) { dirty.current = true; setDataDir(selected) }
    } catch (value) { if (mounted.current) setError(message(value)) }
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      const saved = await completeSetup({ mode, dataDir, timeZone, form })
      if (!mounted.current) return
      dirty.current = false
      setDataDir(saved)
      setMode('existing')
      setNotice('账本已连接。现在可以在对话中说“记录今天完成的事项”。')
      await summary.refresh()
    } catch (value) { if (mounted.current) setError(message(value)) }
    finally { if (mounted.current) setBusy(false) }
  }
  const defaultDirectory = card.status === 'unconfigured' ? card.defaultDataDir : undefined
  return <div className="pm-config">
    <h3>{configured ? '积分账本设置' : '开始记录生活积分'}</h3>
    <p>{configured ? '对话记账与侧栏卡片使用同一份账本。' : '创建空账本，或连接已有积分数据。完成配置后即可在对话中记账。'}</p>
    <form onSubmit={event => { void save(event) }}>
      <div className="pm-choices" role="radiogroup" aria-label="账本来源">
        <label className="pm-choice"><input type="radio" name={`${id}-mode`} value="new" checked={mode === 'new'} disabled={busy} onChange={() => { dirty.current = true; setMode('new'); setDataDir(''); setNotice('') }} />新建空账本</label>
        <label className="pm-choice"><input type="radio" name={`${id}-mode`} value="existing" checked={mode === 'existing'} disabled={busy} onChange={() => { dirty.current = true; setMode('existing'); setDataDir(snapshot.value?.dataDir ?? ''); setNotice('') }} />连接已有账本</label>
      </div>
      <div className="pm-field">
        <label htmlFor={`${id}-directory`}>账本目录</label>
        <div className="pm-input-row"><input id={`${id}-directory`} type="text" value={dataDir} onChange={event => { dirty.current = true; setDataDir(event.target.value) }} placeholder={mode === 'new' ? '留空，使用默认数据目录' : '选择包含 ledger 目录的账本'} disabled={busy} spellCheck={false} autoComplete="off" /><button type="button" className="pm-button" disabled={busy} onClick={() => { void pickDirectory() }}>选择目录</button></div>
        <small>{mode === 'new' ? `自动创建账本与通用规则模板。${defaultDirectory ? `默认目录：${defaultDirectory}` : ''}` : '保存前会检查账本格式。检查过程不会修改已有数据。'}</small>
      </div>
      <div className="pm-field"><label htmlFor={`${id}-timezone`}>今日积分使用的时区</label><input id={`${id}-timezone`} type="text" value={timeZone} onChange={event => { dirty.current = true; setTimeZone(event.target.value) }} disabled={busy} spellCheck={false} autoComplete="off" /><small>默认 Asia/Shanghai。今日累计按事项记录的日期计算，包含后续调整。</small></div>
      {snapshot.status === 'loading' && <div role="status">正在加载设置…</div>}
      {(snapshot.status === 'unavailable' || (snapshot.status === 'ready' && !snapshot.writable)) && <div className="pm-error" role="status">此连接无法保存设置，请在 DSH Desktop 中配置。</div>}
      {error && <div className="pm-error" role="alert">{error}</div>}
      {notice && <div className="pm-success" role="status">{notice}</div>}
      <div className="pm-form-actions"><button type="submit" className="pm-button pm-button-primary" disabled={busy || snapshot.status !== 'ready' || !snapshot.writable}>{busy ? '正在检查并保存…' : mode === 'new' ? '创建并开始记账' : '检查并连接账本'}</button></div>
    </form>
    {configured && <JevSettings form={form} />}
  </div>
}

export function Activation({ onOpenDetails, onDismiss }: { onOpenDetails: () => void; onDismiss: () => void }) {
  return <div className="pm-activation"><h3>生活积分已启用</h3><p>先设置积分账本，即可显示积分、等级和今日累计，并在对话中记账。</p><div className="pm-form-actions"><button type="button" className="pm-button pm-button-primary" onClick={onOpenDetails}>设置积分账本</button><button type="button" className="pm-button" onClick={onDismiss}>稍后设置</button></div></div>
}
