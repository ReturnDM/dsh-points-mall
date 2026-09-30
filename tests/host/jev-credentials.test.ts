import test from 'node:test'
import assert from 'node:assert/strict'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { createJevCredentials } from '../../src/host/jev-credentials.js'

test('Jev key 在凭据服务读写并且客户端只得到状态', async () => {
  let stored: string | undefined
  const provider = {
    async resolve(ref: unknown) { assert.equal(ref, credentialRef('DSH_POINTS_MALL_JEV_KEY')); return stored ? { value: stored, source: 'store' } : undefined },
    async describe() { return { configured: !!stored, writable: true, source: stored ? 'store' : undefined } },
    async set(_ref: unknown, value: string) { stored = value },
    async unset() { stored = undefined },
  }
  const credentials = createJevCredentials(provider)
  const response = await credentials.fetch(new Request('http://localhost/api/points-mall/jev-key', { method: 'POST', body: JSON.stringify({ key: 'secret-example' }) }))
  assert.equal(response.status, 200)
  assert.equal((await response.json()).configured, true)
  assert.equal(await credentials.resolveKey(), 'secret-example')
  const state = await (await credentials.fetch(new Request('http://localhost/api/points-mall/jev-key'))).text()
  assert.equal(state.includes('secret-example'), false)
  assert.equal((await credentials.fetch(new Request('http://localhost/api/points-mall/jev-key/clear', { method: 'POST' }))).status, 200)
  assert.equal(await credentials.resolveKey(), undefined)
})

test('拒绝空白key及畸形请求，并且凭据错误不泄露key', async () => {
  const credentials = createJevCredentials({
    async resolve() { return undefined }, async describe() { return { configured: false, writable: true } },
    async set() { throw new Error('secret-example') }, async unset() {},
  })
  for (const body of ['{}', '{', JSON.stringify({ key: ' ' }), JSON.stringify({ key: 'secret-example' })]) {
    const response = await credentials.fetch(new Request('http://localhost/api/points-mall/jev-key', { method: 'POST', body }))
    assert.equal(response.status, 400)
    assert.equal((await response.text()).includes('secret-example'), false)
  }
})
