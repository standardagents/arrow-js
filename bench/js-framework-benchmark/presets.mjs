import { benchmarkFrameworkName } from './lib.mjs'

const localKeyed = `keyed/${benchmarkFrameworkName}`
const localNonKeyed = `non-keyed/${benchmarkFrameworkName}`

export const presetMap = {
  smoke: {
    frameworks: [
      localKeyed,
      'keyed/arrowjs',
      'keyed/vanillajs',
      localNonKeyed,
      'non-keyed/arrowjs',
      'non-keyed/vanillajs',
    ],
    benchmarks: ['01_'],
  },
  core: {
    frameworks: [
      localKeyed,
      'keyed/arrowjs',
      'keyed/vanillajs',
      'keyed/redom',
      'keyed/lit',
      'keyed/mithril',
      'keyed/solid',
      localNonKeyed,
      'non-keyed/arrowjs',
      'non-keyed/vanillajs',
      'non-keyed/redom',
      'non-keyed/lit',
      'non-keyed/vue',
      'non-keyed/uhtml',
    ],
    benchmarks: ['01_', '05_', '07_', '09_'],
  },
  targets: {
    frameworks: [
      localKeyed,
      'keyed/vanillajs',
      'keyed/solid',
      'keyed/vue',
      localNonKeyed,
      'non-keyed/vanillajs',
      'non-keyed/vue',
    ],
    benchmarks: ['01_', '02_', '03_', '04_', '05_', '06_', '07_', '08_', '09_'],
  },
  breadth: {
    frameworks: [
      localKeyed,
      'keyed/arrowjs',
      'keyed/vanillajs',
      'keyed/redom',
      'keyed/lit',
      'keyed/mithril',
      'keyed/solid',
      'keyed/preact-hooks',
      'keyed/vue',
      localNonKeyed,
      'non-keyed/arrowjs',
      'non-keyed/vanillajs',
      'non-keyed/redom',
      'non-keyed/lit',
      'non-keyed/vue',
      'non-keyed/uhtml',
      'non-keyed/mikado',
    ],
    benchmarks: ['01_', '02_', '03_', '04_', '05_', '06_', '07_', '08_', '09_'],
  },
}
