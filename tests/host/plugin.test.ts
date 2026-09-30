import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import type { ConnectionFetchRoute } from '@deepseek-ai/dsh-client-connection'
import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
import type { SkillRegistration } from '@deepseek-ai/dsh-skill'
import { test } from 'node:test'

const plugin = await import('../../src/index.ts')

test('the enabled Host serves public summary routes and withdraws its tools, skill, and routes on disable', async () => {
  assert.ok(plugin?.apply, 'the plugin must expose the Host entry')
  const ctx = new Context()
  const routes = new Map<string, ConnectionFetchRoute>()
  const tools = new Map<string, ToolDefinition>()
  const skills = new Map<string, SkillRegistration>()
  ctx.provide('connection', { fetch: { register(route: ConnectionFetchRoute) { routes.set(route.path, route); return async () => { routes.delete(route.path) } } } } as never)
  ctx.provide('tools', { register(tool: ToolDefinition) { tools.set(tool.name, tool); return () => { tools.delete(tool.name) } } } as never)
  ctx.provide('skills', { register(skill: SkillRegistration) { skills.set(skill.name, skill); return () => { skills.delete(skill.name) } } } as never)
  ctx.provide('settings', { configure() { return () => {} } } as never)
  ctx.provide('credentials', { resolve() { return undefined } } as never)
  const fiber = ctx.plugin(plugin)
  try {
    await fiber.await()
    const summary = routes.get('/api/points-mall/summary')
    assert.ok(summary)
    const response = await summary.fetch(new Request('http://localhost/api/points-mall/summary'))
    assert.equal((await response.json()).status, 'unconfigured')
    assert.ok(routes.has('/api/points-mall/validate'))
    assert.ok(routes.has('/api/points-mall/initialize'))
    assert.ok(tools.has('points_mall_earn'))
    assert.ok(skills.get('points-mall')?.content)
  } finally { await fiber.dispose() }
  assert.equal(routes.size, 0)
  assert.equal(tools.size, 0)
  assert.equal(skills.size, 0)
})
