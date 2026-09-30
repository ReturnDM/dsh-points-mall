import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'

const module = await import('../../src/client/mount.ts').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {}
  throw error
})

test('points card precedes usage while usage remains immediately before settings', async () => {
  assert.equal(typeof module.mountCardContainer, 'function', 'sidebar mounting is not implemented')
  const dom = new JSDOM('<div data-pane="sidebar"><div class="footArea"><div data-dsh-usage-foot-card></div><div class="settingsArea"></div></div></div>', { pretendToBeVisual: true })
  const dispose = module.mountCardContainer(dom.window.document, container => {
    container.textContent = '积分 42'
    return () => {}
  })
  const foot = dom.window.document.querySelector('.footArea')
  assert.equal(foot.children[0].getAttribute('data-dsh-life-points-card'), '')
  assert.equal(foot.children[1].hasAttribute('data-dsh-usage-foot-card'), true)
  assert.equal(foot.children[2].className, 'settingsArea')
  dispose()
  assert.equal(foot.querySelector('[data-dsh-life-points-card]'), null)
  dom.window.close()
})

test('mounting before usage loads repositions once it appears and never duplicates', async () => {
  assert.equal(typeof module.mountCardContainer, 'function', 'sidebar mounting is not implemented')
  const dom = new JSDOM('<div data-pane="sidebar"><div class="footArea"><div class="settingsArea"></div></div></div>', { pretendToBeVisual: true })
  let cleanups = 0
  const dispose = module.mountCardContainer(dom.window.document, container => {
    container.textContent = '积分 42'
    return () => { cleanups++ }
  })
  const duplicate = module.mountCardContainer(dom.window.document, () => { throw new Error('duplicate render') })
  const foot = dom.window.document.querySelector('.footArea')
  const usage = dom.window.document.createElement('div')
  usage.setAttribute('data-dsh-usage-foot-card', '')
  foot.insertBefore(usage, foot.querySelector('.settingsArea'))
  await new Promise(resolve => dom.window.setTimeout(resolve, 40))
  assert.equal(foot.children[0].hasAttribute('data-dsh-life-points-card'), true)
  assert.equal(foot.children[1], usage)
  assert.equal(foot.querySelectorAll('[data-dsh-life-points-card]').length, 1)
  duplicate()
  dispose()
  await new Promise(resolve => dom.window.setTimeout(resolve, 25))
  assert.equal(cleanups, 1)
  assert.equal(foot.querySelector('[data-dsh-life-points-card]'), null)
  dom.window.close()
})

test('whole sidebar rebuild moves the same card and collapsed sidebar hides it', async () => {
  assert.equal(typeof module.mountCardContainer, 'function', 'sidebar mounting is not implemented')
  const dom = new JSDOM('<div data-pane="sidebar"><div class="footArea"><div class="settingsArea"></div></div></div>', { pretendToBeVisual: true })
  const dispose = module.mountCardContainer(dom.window.document, () => () => {})
  const card = dom.window.document.querySelector('[data-dsh-life-points-card]')
  dom.window.document.querySelector('[data-pane]').innerHTML = '<div class="footArea"><div class="settingsArea"></div></div>'
  dom.window.document.documentElement.setAttribute('data-sidebar-collapsed', 'true')
  await new Promise(resolve => dom.window.setTimeout(resolve, 40))
  assert.equal(dom.window.document.querySelector('[data-dsh-life-points-card]'), card)
  assert.equal(card.hidden, true)
  dom.window.document.documentElement.setAttribute('data-sidebar-collapsed', 'false')
  await new Promise(resolve => dom.window.setTimeout(resolve, 40))
  assert.equal(card.hidden, false)
  dispose()
  dom.window.close()
})
