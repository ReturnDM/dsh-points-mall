import { createElement, useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { Activation, Configuration } from './Configuration.js'
import { PointsCard } from './PointsCard.js'
import { mountCardContainer } from './mount.js'
import { STYLES } from './styles.js'
import { SummaryStore } from './summary.js'
import type { PointsSettings } from './types.js'

export const name = 'points-mall-client'
export const inject = ['slots', 'configForms', 'pluginNavigation']
export const PACKAGE_NAME = 'dsh-points-mall'

function CardBinding({ summary, configure }: { summary: SummaryStore; configure: () => void }) {
  const snapshot = useSyncExternalStore(summary.subscribe, summary.getSnapshot, summary.getSnapshot)
  return <PointsCard snapshot={snapshot} onConfigure={configure} onRetry={() => { void summary.refresh() }} />
}

export function apply(ctx: Context): void {
  const summary = new SummaryStore()
  const form = ctx.configForms.get<PointsSettings>('points-mall')
  ctx.effect(() => {
    summary.start()
    const unsubscribe = form.subscribe(() => { void summary.refresh() })
    const onFocus = () => { void summary.refresh() }
    window.addEventListener('focus', onFocus)
    return () => {
      unsubscribe()
      window.removeEventListener('focus', onFocus)
      summary.dispose()
    }
  }, 'points-mall: summary polling')

  ctx.effect(() => {
    if (document.getElementById('dsh-points-mall-styles')) return () => {}
    const style = document.createElement('style')
    style.id = 'dsh-points-mall-styles'
    style.textContent = STYLES
    document.head.append(style)
    return () => { style.remove() }
  }, 'points-mall: native styles')

  ctx.effect(() => mountCardContainer(document, container => {
    const root = createRoot(container)
    root.render(createElement(CardBinding, { summary, configure: () => ctx.pluginNavigation.openBundle(PACKAGE_NAME) }))
    return () => { root.unmount() }
  }), 'points-mall: sidebar card')

  ctx.slots.inject('plugins.bundle.activation', () => ctx.slots.register({
    name: 'plugins.bundle.activation', key: PACKAGE_NAME,
  }, Activation))
  ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
    name: 'plugins.bundle.config', key: PACKAGE_NAME, inject: () => ({ form, summary }),
  }, Configuration))
}
