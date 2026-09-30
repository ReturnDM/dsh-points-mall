import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { requestJson } from '../../src/client/api.ts'

test('HTML instead of a successful JSON reply becomes a Chinese recovery message', async t => {
  const server = createServer((_req, res) => { res.setHeader('Content-Type', 'text/html'); res.end('<html>proxy error</html>') })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => server.close())
  await assert.rejects(requestJson(`http://127.0.0.1:${server.address().port}/api`), error => {
    assert.match(error.message, /返回.*JSON.*重试/)
    assert.doesNotMatch(error.message, /Unexpected token|proxy error/)
    return true
  })
})

test('HTTP errors retain their status even when the error page is HTML', async t => {
  const server = createServer((_req, res) => { res.statusCode = 502; res.end('<html>bad gateway</html>') })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => server.close())
  await assert.rejects(requestJson(`http://127.0.0.1:${server.address().port}/api`), /HTTP 502.*重试/)
})

test('caller cancellation during JSON body download preserves the AbortError', async t => {
  const server = createServer((_req, res) => {
    res.setHeader('Content-Type', 'application/json')
    res.write('{')
    const timer = setTimeout(() => res.end('"ok":true}'), 200)
    res.on('close', () => clearTimeout(timer))
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => { server.closeAllConnections(); server.close() })
  const controller = new AbortController()
  const request = requestJson(`http://127.0.0.1:${server.address().port}/api`, { signal: controller.signal })
  setTimeout(() => controller.abort(), 25)
  await assert.rejects(request, error => error.name === 'AbortError')
})
