import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { JSDOM } from 'jsdom'
const module = await import('../../src/client/PointsCard.tsx').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {}
  throw error
})

test('ready card exposes the exact balance, today earnings and accessible level progress', () => {
  assert.equal(typeof module.PointsCard, 'function', 'points card is not implemented')
  const html = renderToStaticMarkup(React.createElement(module.PointsCard, {
    snapshot: { status: 'ready', balance: 1260, totalExp: 720, level: 6, expInLevel: 120, expRequired: 150, expToNext: 30, progress: 0.8, todayEarned: 40, day: '2025-01-01', timeZone: 'Asia/Shanghai', updatedAt: '2025-01-01T00:00:00Z' },
    onConfigure() {}, onRetry() {},
  }))
  const document = new JSDOM(html).window.document
  assert.match(document.body.textContent, /1,260/)
  assert.match(document.body.textContent, /今日.*40/)
  assert.match(document.body.textContent, /Lv\.6/)
  const progress = document.querySelector('[role="progressbar"]')
  assert.equal(progress.getAttribute('aria-valuenow'), '120')
  assert.equal(progress.getAttribute('aria-valuemax'), '150')
  assert.equal(progress.getAttribute('aria-valuetext'), '120 / 150 经验，还差 30 升级')
})

test('unconfigured and error cards show a recovery action without inventing a zero balance', () => {
  assert.equal(typeof module.PointsCard, 'function', 'points card is not implemented')
  for (const snapshot of [{ status: 'unconfigured' }, { status: 'error', message: '账本暂时不可用' }]) {
    const html = renderToStaticMarkup(React.createElement(module.PointsCard, { snapshot, onConfigure() {}, onRetry() {} }))
    const document = new JSDOM(html).window.document
    assert.equal(document.querySelector('[role="progressbar"]'), null)
    assert.equal(document.querySelectorAll('button').length >= 1, true)
    assert.doesNotMatch(document.body.textContent, /今日.*0|已有积分.*0/)
  }
})
