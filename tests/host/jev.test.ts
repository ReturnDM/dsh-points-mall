import test from 'node:test'
import assert from 'node:assert/strict'
import { createJevJudge } from '../../src/host/jev.js'

const input = { task: '阅读半小时', proposedPoints: 15, rulesMarkdown: '阅读半小时：15 分', tasks: { tasks: [{ id: 'read', name: '阅读半小时', points: 15 }], tiers: [5, 15, 30] } }

test('关闭 Jev 时不解析凭据、不发送事项', async () => {
  const judge = createJevJudge({ enabled: () => false, resolveKey: async () => { throw new Error('不应调用') }, fetch: async () => { throw new Error('不应请求') } })
  assert.equal((await judge.judge(input)).status, 'fallback')
})

test('按真实 HTTP 合约发送规则并读取 0.91 的肯定概率', async () => {
  const judge = createJevJudge({ enabled: () => true, resolveKey: async () => 'test-key', fetch: async (url, init) => {
    assert.equal(url, 'https://api.typesafe.ai/v1/systemone')
    assert.equal(init?.method, 'POST')
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer test-key')
    const body = JSON.parse(String(init?.body))
    assert.equal(body.state.proposedPoints, 15)
    assert.equal(body.state.rulesMarkdown, '阅读半小时：15 分')
    assert.equal(body.state.tasks.tasks[0].points, 15)
    assert.deepEqual(body.state.tasks.tiers, [5, 15, 30])
    assert.equal(body.questions.fair.type, 'noul')
    return Response.json({ model: 'jev-1.13.0', answers: { fair: { type: 'noul', noul: 0.91 } }, usage: { input_tokens: 200, output_tokens: 20 } })
  } })
  const result = await judge.judge(input)
  assert.equal(result.status, 'reviewed')
  assert.equal(result.accepted, true)
  assert.equal(result.probability, 0.91)
})

test('概率不足时只给重新定分建议', async () => {
  const judge = createJevJudge({ enabled: () => true, resolveKey: async () => 'key', fetch: async () => Response.json({ answers: { fair: { type: 'noul', noul: 0.3 } } }) })
  const result = await judge.judge(input)
  assert.equal(result.status, 'reviewed')
  assert.equal(result.accepted, false)
})

test('缺 key、HTTP 错误或畸形返回均降级且不泄露错误正文', async () => {
  for (const scenario of ['missing', 'http', 'malformed', 'network']) {
    const judge = createJevJudge({ enabled: () => true, resolveKey: async () => scenario === 'missing' ? undefined : 'secret-test-key', fetch: async () => {
      if (scenario === 'network') throw new Error('secret-test-key')
      return scenario === 'http' ? new Response('secret-test-key', { status: 401 }) : Response.json({ answers: { fair: { type: 'noul', noul: 2 } } })
    } })
    const result = await judge.judge(input)
    assert.equal(result.status, 'fallback')
    assert.equal(JSON.stringify(result).includes('secret-test-key'), false)
  }
})

test('非法事项和分值不产生外部请求', async () => {
  const judge = createJevJudge({ enabled: () => true, resolveKey: async () => 'key', fetch: async () => { throw new Error('不应请求') } })
  await assert.rejects(judge.judge({ ...input, proposedPoints: 0 }), /正整数/)
  await assert.rejects(judge.judge({ ...input, task: '' }), /事项/)
})

test('超时中止外部请求，显式取消向调用方传播', async () => {
  const pending: typeof fetch = async (_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
  })
  const judge = createJevJudge({ enabled: () => true, resolveKey: async () => 'key', fetch: pending, timeoutMs: 15 })
  const keepAlive = setTimeout(() => {}, 100)
  try { assert.equal((await judge.judge(input)).status, 'fallback') } finally { clearTimeout(keepAlive) }
  const controller = new AbortController()
  controller.abort(new Error('cancelled'))
  await assert.rejects(judge.judge(input, controller.signal), /cancelled/)
})
