import { createElement, useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-api-gateway/client'
import type {} from '@deepseek-ai/dsh-client-connection/client'
import type { RemoteStreamHandle, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import { Activation, Configuration } from './Configuration.js'
import { PointsCard } from './PointsCard.js'
import { mountCardContainer } from './mount.js'
import { STYLES } from './styles.js'
import { SummaryStore, type PointsUpdate } from './summary.js'
import type { PointsSettings } from './types.js'

export const name = 'points-mall-client'
export const inject = ['slots', 'configForms', 'pluginNavigation', 'remote']
export const PACKAGE_NAME = 'dsh-points-mall'

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteNamespaceMap {
    pointsMallUpdates: { watch(signal?: AbortSignal): RemoteStreamHandle<PointsUpdate, never> }
  }
}

/** No business inputs or sensitive output: Gateway owns the authenticated carrier. */
const UPDATES_REMOTE: TypertRemoteContribution = {
  package: PACKAGE_NAME,
  descriptors: [{
    id: 'dsh-points-mall#pointsMallUpdates/watch',
    service: 'pointsMallUpdates', namespace: 'pointsMallUpdates', method: 'watch',
    mode: 'stream', invocation: { kind: 'direct' }, parameters: [],
    cancellation: { parameter: 'signal' }, result: { mode: 'src-json' },
  }],
}

function CardBinding({ summary, configure }: { summary: SummaryStore; configure: () => void }) {
  const snapshot = useSyncExternalStore(summary.subscribe, summary.getSnapshot, summary.getSnapshot)
  return <PointsCard snapshot={snapshot} onConfigure={configure} onRetry={() => { void summary.refresh() }} />
}

export function apply(ctx: Context): void {
  let watchUpdates: ((signal: AbortSignal) => RemoteStreamHandle<PointsUpdate, never>) | undefined
  const summary = new SummaryStore({ updates: signal => {
    if (!watchUpdates) throw new Error('Points update namespace is unavailable')
    return watchUpdates(signal)
  } })
  const form = ctx.configForms.get<PointsSettings>('points-mall')
  ctx.effect(async () => {
    let disposeRemote: (() => void | Promise<void>) | undefined
    let disposeNamespace: (() => Promise<void>) | undefined
    try {
      disposeRemote = await ctx.remote.$mount(UPDATES_REMOTE)
      // Cordis requires the dynamic service's own dependency declaration. Mount
      // first, then inject a child scope so startup cannot wait on its own service.
      const namespace = ctx.inject(['remote.pointsMallUpdates'], boundCtx => {
        watchUpdates = signal => boundCtx.remote.pointsMallUpdates.watch(signal)
        return () => { watchUpdates = undefined }
      })
      disposeNamespace = namespace.dispose
      await namespace
    } catch {
      // Keep the card usable through polling if the Remote assembly is unavailable.
    }
    summary.start()
    const unsubscribe = form.subscribe(() => { void summary.refresh() })
    const unsubscribeReset = ctx.on('connection/reset', summary.reconnectUpdates)
    return async () => {
      unsubscribe()
      unsubscribeReset()
      summary.dispose()
      await disposeNamespace?.()
      await disposeRemote?.()
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
