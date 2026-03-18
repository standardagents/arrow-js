import { ScrollSpyNav } from '../../components/ScrollSpyNav'
import { CopyPageMenu } from '../../components/CopyPageMenu'
import { hydrateEachIsland, hydrateIntoRoot } from '../../islands'
import { homeNavGroups } from './nav'
import { HeroCounter } from './Hero'

export async function hydrateHomeIslands() {
  await hydrateIntoRoot('home-mobile-nav-root', ScrollSpyNav(homeNavGroups).mobile())
  await hydrateIntoRoot('home-sidebar-nav-root', ScrollSpyNav(homeNavGroups).sidebar())
  await hydrateIntoRoot('hero-counter-root', HeroCounter())
  await hydrateEachIsland('[data-island="copy-page-menu"]', (root) =>
    CopyPageMenu({ markdownPath: root.dataset.markdownPath || '/docs.md' })
  )
}
