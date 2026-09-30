import type { CardSnapshot } from './types.js'

export interface PointsCardProps {
  snapshot: CardSnapshot
  onConfigure: () => void
  onRetry: () => void
}

function SettingsIcon() {
  return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
    <path d="m9 3-1 3-3 1-2 3 2 2-1 3 3 2 3-1 2 2 3-1 1-3 3-1 2-3-2-2 1-3-3-2-3 1-2-2Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
}

export function PointsCard({ snapshot, onConfigure, onRetry }: PointsCardProps) {
  const format = (value: number) => value.toLocaleString('zh-CN')
  return <section className="pm-card" aria-label="生活积分" aria-busy={snapshot.status === 'loading'}>
    <div className="pm-card-head">
      <span>生活积分</span>
      <button type="button" className="pm-icon-button" onClick={onConfigure} aria-label="配置生活积分" title="配置生活积分"><SettingsIcon /></button>
    </div>
    {snapshot.status === 'loading' && <div className="pm-loading" role="status"><span>正在读取积分…</span><div className="pm-loading-line" /></div>}
    {snapshot.status === 'unconfigured' && <div className="pm-card-state"><p>把完成的生活事项变成积分。</p><button type="button" className="pm-text-button" onClick={onConfigure}>设置积分账本</button></div>}
    {snapshot.status === 'error' && <div className="pm-card-state"><p role="status" title={snapshot.message}>积分暂时不可用</p><div className="pm-card-actions"><button type="button" className="pm-text-button" onClick={onRetry}>重试</button><button type="button" className="pm-text-button" onClick={onConfigure}>检查配置</button></div></div>}
    {snapshot.status === 'ready' && <>
      <div className="pm-card-balance"><span><strong>{format(snapshot.balance)}</strong> <span className="pm-muted">积分</span></span><span className="pm-level">Lv.{snapshot.level}</span></div>
      <div className="pm-progress-label"><span>{format(snapshot.expInLevel)} / {format(snapshot.expRequired)} 经验</span><span>还差 {format(snapshot.expToNext)}</span></div>
      <div className="pm-progress" role="progressbar" aria-label={`Lv.${snapshot.level} 升级进度`} aria-valuemin={0} aria-valuemax={snapshot.expRequired} aria-valuenow={snapshot.expInLevel} aria-valuetext={`${snapshot.expInLevel} / ${snapshot.expRequired} 经验，还差 ${snapshot.expToNext} 升级`}>
        <div className="pm-progress-fill" style={{ transform: `scaleX(${snapshot.progress})` }} />
      </div>
      <div className="pm-card-today" title={`${snapshot.day} · ${snapshot.timeZone} · 计入今日赚取记录的有效积分`}>今日累计 <strong>{snapshot.todayEarned >= 0 ? '+' : ''}{format(snapshot.todayEarned)}</strong></div>
    </>}
  </section>
}
