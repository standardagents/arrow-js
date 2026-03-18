import { ScrollSpyNav } from '../../components/ScrollSpyNav'
import { CopyPageMenu } from '../../components/CopyPageMenu'
import { hydrateEachIsland, hydrateIntoRoot } from '../../islands'
import { apiNavGroups } from './nav'

export async function hydrateApiIslands() {
  await hydrateIntoRoot('api-mobile-nav-root', ScrollSpyNav(apiNavGroups).mobile())
  await hydrateIntoRoot('api-sidebar-nav-root', ScrollSpyNav(apiNavGroups).sidebar())
  await hydrateEachIsland('[data-island="copy-page-menu"]', (root) =>
    CopyPageMenu({ markdownPath: root.dataset.markdownPath || '/api.md' })
  )
}
