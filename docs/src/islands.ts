import { hydrate } from '@arrow-js/hydrate'

export async function hydrateIntoRoot(
  rootId: string,
  view: unknown
) {
  const root = document.getElementById(rootId)

  if (!root) {
    return
  }

  await hydrate(root, view)
}

export async function hydrateEachIsland(
  selector: string,
  render: (root: HTMLElement) => unknown
) {
  const roots = Array.from(document.querySelectorAll<HTMLElement>(selector))

  for (const root of roots) {
    await hydrate(root, render(root))
  }
}
