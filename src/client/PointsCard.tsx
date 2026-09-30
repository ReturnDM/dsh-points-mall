import type { CardSnapshot } from './types.js'

export interface PointsCardProps {
  snapshot: CardSnapshot
  onConfigure: () => void
  onRetry: () => void
}

/** DSH IconSettingsOutlineMedium artwork, Copyright (c) 2026 DeepSeek, MIT License. */
function SettingsIcon() {
  return <svg viewBox="0 0 16 16" width="16" height="16" fill="none" strokeWidth="1.3" aria-hidden="true">
    <path d="M8 9.75012C8.9665 9.75012 9.75 8.96662 9.75 8.00012C9.75 7.03362 8.9665 6.25012 8 6.25012C7.0335 6.25012 6.25 7.03362 6.25 8.00012C6.25 8.96662 7.0335 9.75012 8 9.75012Z" stroke="currentColor" />
    <path d="M13.0107 7.79377C12.9505 7.89401 12.9205 7.94413 12.9205 7.99951C12.9205 8.0549 12.9505 8.10502 13.0106 8.20528L13.9849 9.83006C14.045 9.93029 14.0751 9.9804 14.0751 10.0358C14.0751 10.0911 14.045 10.1413 13.9849 10.2415L13.0037 11.8777C12.9468 11.9726 12.9184 12.0201 12.8725 12.0461C12.8267 12.072 12.7713 12.072 12.6607 12.072H10.6704C10.5598 12.072 10.5045 12.072 10.4586 12.098C10.4128 12.1239 10.3843 12.1714 10.3274 12.2662L9.33825 13.9142C9.28133 14.009 9.25287 14.0564 9.20703 14.0823C9.16118 14.1083 9.10588 14.1083 8.99529 14.1083H7.00486C6.89426 14.1083 6.83896 14.1083 6.79312 14.0823C6.74727 14.0564 6.71881 14.009 6.6619 13.9142L5.67273 12.2662C5.61581 12.1714 5.58735 12.1239 5.54151 12.098C5.49566 12.072 5.44036 12.072 5.32977 12.072H3.33945C3.2288 12.072 3.17347 12.072 3.12761 12.0461C3.08176 12.0201 3.0533 11.9726 2.9964 11.8777L2.0152 10.2415C1.9551 10.1413 1.92505 10.0911 1.92505 10.0358C1.92505 9.9804 1.9551 9.93029 2.0152 9.83006L2.98951 8.20528C3.04963 8.10502 3.07969 8.0549 3.07969 7.99951C3.07968 7.94413 3.04961 7.89401 2.98946 7.79377L2.01529 6.17011C1.95514 6.06987 1.92507 6.01975 1.92507 5.96437C1.92506 5.90899 1.95512 5.85886 2.01524 5.7586L2.9964 4.1224C3.0533 4.0275 3.08176 3.98005 3.12761 3.95408C3.17347 3.92811 3.2288 3.92811 3.33945 3.92811H5.32977C5.44036 3.92811 5.49566 3.92811 5.54151 3.90216C5.58735 3.87621 5.61581 3.82879 5.67273 3.73397L6.6619 2.08599C6.71881 1.99116 6.74727 1.94375 6.79312 1.9178C6.83896 1.89185 6.89426 1.89185 7.00486 1.89185H8.99529C9.10588 1.89185 9.16118 1.89185 9.20703 1.9178C9.25287 1.94375 9.28133 1.99116 9.33825 2.08599L10.3274 3.73397C10.3843 3.82879 10.4128 3.87621 10.4586 3.90216C10.5045 3.92811 10.5598 3.92811 10.6704 3.92811H12.6607C12.7713 3.92811 12.8267 3.92811 12.8725 3.95408C12.9184 3.98005 12.9468 4.0275 13.0037 4.1224L13.9849 5.7586C14.045 5.85886 14.0751 5.90899 14.0751 5.96437C14.0751 6.01975 14.045 6.06987 13.9849 6.17011L13.0107 7.79377Z" stroke="currentColor" strokeMiterlimit="10" />
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
