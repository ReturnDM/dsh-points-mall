import { credentialRef, type CredentialProvider } from '@deepseek-ai/dsh-credentials'

const keyRef = credentialRef('DSH_POINTS_MALL_JEV_KEY')
type Provider = Pick<CredentialProvider, 'resolve' | 'describe' | 'set' | 'unset'>

/** Expose metadata only, never the stored value or provider errors. */
export function createJevCredentials(provider: Provider) {
  const status = async () => {
    const info = await provider.describe(keyRef)
    return { configured: info.configured, writable: info.writable, source: info.source }
  }
  return {
    async resolveKey() { return (await provider.resolve(keyRef))?.value },
    async fetch(request: Request) {
      const path = new URL(request.url).pathname
      try {
        if (path === '/api/points-mall/jev-key' && request.method === 'GET') return Response.json(await status())
        if (path === '/api/points-mall/jev-key' && request.method === 'POST') {
          const body = await request.json() as { key?: unknown }
          if (!body || typeof body.key !== 'string' || !body.key.trim() || body.key.length > 8192) return Response.json({ error: { message: '请输入有效的 Jev key。' } }, { status: 400 })
          await provider.set(keyRef, body.key.trim())
          return Response.json(await status())
        }
        if (path === '/api/points-mall/jev-key/clear' && request.method === 'POST') {
          await provider.unset(keyRef)
          return Response.json(await status())
        }
        return new Response(null, { status: 404 })
      } catch {
        return Response.json({ error: { message: '无法更新 Jev 凭据，请检查凭据服务和当前来源是否可写。' } }, { status: 400 })
      }
    },
  }
}
