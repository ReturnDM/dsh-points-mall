/** Desktop sidebar integration, isolated from the shell's React tree. */
export const POINTS_CARD_SELECTOR = '[data-dsh-life-points-card]'
const mounts = new WeakMap<Document, HTMLElement>()

export function mountCardContainer(
  document: Document,
  render: (container: HTMLElement) => () => void,
): () => void {
  if (mounts.has(document) || document.querySelector(POINTS_CARD_SELECTOR)) return () => {}
  const window = document.defaultView
  if (!window || !document.body) return () => {}
  const container = document.createElement('div')
  container.setAttribute('data-dsh-life-points-card', '')
  mounts.set(document, container)
  const unmount = render(container)
  let disposed = false
  let frame: number | undefined

  const place = () => {
    if (disposed) return
    const column = document.querySelector<HTMLElement>('[data-pane="sidebar"], [class*="sidebarCol"]')
    const foot = column?.querySelector<HTMLElement>('[class*="footArea"]')
    if (!foot) return
    const usage = foot.querySelector<HTMLElement>('[data-dsh-usage-foot-card]')
    const settings = foot.querySelector<HTMLElement>('[class*="settingsArea"]')
    const anchor = usage ?? settings
    if (anchor && anchor.parentElement === foot) {
      if (container.nextElementSibling !== anchor) foot.insertBefore(container, anchor)
    } else if (container.parentElement !== foot || foot.lastElementChild !== container) {
      foot.append(container)
    }
    const collapsed = document.querySelector('[data-sidebar-collapsed="true"]') !== null
      || column?.querySelector('[class*="collapsed"]') !== null
    container.hidden = collapsed
  }

  place()
  const observer = new window.MutationObserver(() => {
    if (frame !== undefined || disposed) return
    frame = window.requestAnimationFrame(() => {
      frame = undefined
      place()
    })
  })
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'data-sidebar-collapsed'],
  })
  return () => {
    if (disposed) return
    disposed = true
    observer.disconnect()
    if (frame !== undefined) window.cancelAnimationFrame(frame)
    unmount()
    container.remove()
    mounts.delete(document)
  }
}
