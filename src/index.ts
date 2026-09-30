/** Host entry for the DSH Desktop points-mall bundle. */
import type { Context, Volatile } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { join } from 'node:path'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import type {} from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-skill'
import type {} from '@deepseek-ai/dsh-client-connection'
import type {} from '@deepseek-ai/dsh-settings'
import type {} from '@deepseek-ai/dsh-credentials'
import { PointsHostService } from './host/service.ts'
import { createPointsTools } from './host/tools.ts'
import { POINTS_MALL_SKILL } from './host/skill.ts'
import { createJevJudge } from './host/jev.ts'
import { createJevCredentials } from './host/jev-credentials.js'

/** Stable plugin entry id, also used by the Client's ConfigForms. */
export const name = 'points-mall'

/** Runtime services supplied by the Desktop profile. */
export const inject = ['tools', 'skills', 'connection', 'settings', 'credentials']

/** Live settings accepted by the current profile's configuration editor. */
export interface Config {
  dataDir: Volatile<string>
  timeZone: Volatile<string>
  setupVersion: Volatile<number>
  jevEnabled: Volatile<boolean>
}

/** Blank dataDir keeps the plugin available until the user completes setup. */
export const Config = z.object({
  dataDir: z.string().default('').volatile(),
  timeZone: z.string().default('Asia/Shanghai').volatile(),
  setupVersion: z.number().min(0).step(1).default(0).volatile(),
  jevEnabled: z.boolean().default(false).volatile(),
})

/** Register authenticated routes, model tools, and the bundled conversation skill. */
export function apply(ctx: Context, config: Config): void {
  ctx.effect(() => ctx.settings.configure({ auto: false }, ctx.fiber), 'points-mall: configuration')
  const credentials = createJevCredentials(ctx.credentials)
  const judge = createJevJudge({
    enabled: () => config.jevEnabled.get(),
    resolveKey: () => credentials.resolveKey(),
  })
  const service = new PointsHostService(() => ({
    dataDir: config.dataDir.get(), timeZone: config.timeZone.get(),
    setupVersion: config.setupVersion.get(), jevEnabled: config.jevEnabled.get(),
  }), join(resolveDshHome(), 'points-mall', 'data'), judge)

  for (const [path, methods] of [
    ['/api/points-mall/summary', ['GET']],
    ['/api/points-mall/rules', ['GET']],
    ['/api/points-mall/validate', ['POST']],
    ['/api/points-mall/initialize', ['POST']],
  ] as const) {
    ctx.effect(() => ctx.connection.fetch.register({
      path, methods, requestBody: 'buffered', fetch: request => service.fetch(request),
    }), `points-mall: ${path}`)
  }
  for (const [path, methods] of [
    ['/api/points-mall/jev-key', ['GET', 'POST']],
    ['/api/points-mall/jev-key/clear', ['POST']],
  ] as const) {
    ctx.effect(() => ctx.connection.fetch.register({ path, methods, requestBody: 'buffered', fetch: request => credentials.fetch(request) }), `points-mall: ${path}`)
  }
  for (const tool of createPointsTools(service)) ctx.effect(() => ctx.tools.register(tool), `points-mall: ${tool.name}`)
  ctx.effect(() => ctx.skills.register({
    name: 'points-mall', source: 'bundled',
    description: '生活积分商城：记账、查询余额和等级、奖励更正、兑换、核销与回收。',
    content: POINTS_MALL_SKILL,
  }), 'points-mall: bundled skill')
}
