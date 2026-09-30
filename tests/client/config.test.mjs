import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { JSDOM } from 'jsdom'
const module = await import('../../src/client/Configuration.tsx').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {}
  throw error
})
const summary = { getSnapshot: () => ({ status: 'unconfigured' }), subscribe: () => () => {}, refresh: async () => {} }

test('first-run form offers an automatic empty ledger and keeps Jev out of the required path', () => {
  assert.equal(typeof module.Configuration, 'function', 'configuration page is not implemented')
  const snapshot = { status: 'ready', revision: 1, writable: true, mode: 'host', value: { dataDir: '', timeZone: 'Asia/Shanghai', setupVersion: 0, jevEnabled: false } }
  const form = { getSnapshot: () => snapshot, subscribe: () => () => {}, mutate: async () => true }
  const document = new JSDOM(renderToStaticMarkup(React.createElement(module.Configuration, { form, summary }))).window.document
  assert.equal(document.querySelector('input[type=radio][value=new]').checked, true)
  assert.equal(document.querySelector('input[type=password]'), null)
  assert.equal(document.querySelector('button[type=submit]').disabled, false)
})

test('configuration cannot save while Host preferences are unavailable', () => {
  assert.equal(typeof module.Configuration, 'function', 'configuration page is not implemented')
  const snapshot = { status: 'unavailable', revision: undefined, writable: false, mode: 'memory', value: undefined }
  const form = { getSnapshot: () => snapshot, subscribe: () => () => {}, mutate: async () => true }
  const document = new JSDOM(renderToStaticMarkup(React.createElement(module.Configuration, { form, summary }))).window.document
  assert.equal(document.querySelector('button[type=submit]').disabled, true)
  assert.match(document.body.textContent, /此连接无法保存/)
})
