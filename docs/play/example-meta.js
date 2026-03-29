export const starterExampleId = 'starter'
const examplesBaseUrl =
  'https://github.com/standardagents/arrow-js/tree/main/docs/play/examples'

export const playgroundExampleMeta = [
  {
    id: starterExampleId,
    title: 'Starter',
    icon: '\u{1F680}',
    description: 'A compact multi-file starter with shared state and a local component.',
  },
  {
    id: 'todo',
    title: 'Todo List',
    icon: '\u2705',
    description:
      'A task tracker with reactive arrays, keyed lists, and computed filtering.',
    sourceUrl: `${examplesBaseUrl}/todo`,
  },
  {
    id: 'timer',
    title: 'Pomodoro Timer',
    icon: '\u{1F345}',
    description:
      'A focus timer with SVG progress ring, intervals, and computed formatting.',
    sourceUrl: `${examplesBaseUrl}/timer`,
  },
  {
    id: 'palette',
    title: 'Color Palette',
    icon: '\u{1F3A8}',
    description:
      'A Coolors-style harmony palette generator with reactive style binding and computed colors.',
    sourceUrl: `${examplesBaseUrl}/palette`,
  },
  {
    id: 'password',
    title: 'Password Generator',
    icon: '\u{1F510}',
    description:
      'A configurable password tool with reactive toggles and a strength meter.',
    sourceUrl: `${examplesBaseUrl}/password`,
  },
  {
    id: 'accordion',
    title: 'Accordion',
    icon: '\u{1FA97}',
    description:
      'Expandable FAQ sections where each component instance keeps its own state.',
    sourceUrl: `${examplesBaseUrl}/accordion`,
  },
  {
    id: 'feed',
    title: 'Live Feed',
    icon: '\u{1F4E1}',
    description:
      'An auto-updating event feed with reactive array mutations and timed entries.',
    sourceUrl: `${examplesBaseUrl}/feed`,
  },
  {
    id: 'table',
    title: 'Data Table',
    icon: '\u{1F4CA}',
    description:
      'A sortable data table with reactive column sorting, keyed rows, and computed ordering.',
    sourceUrl: `${examplesBaseUrl}/table`,
  },
  {
    id: 'tabs',
    title: 'Tabs',
    icon: '\u{1F4C1}',
    description:
      'A tabbed interface with ARIA roles, animated panel transitions, and per-tab content.',
    sourceUrl: `${examplesBaseUrl}/tabs`,
  },
  {
    id: 'gallery',
    title: 'Photo Gallery',
    icon: '\u{1F5BC}\uFE0F',
    description:
      'A responsive image grid with a lightbox carousel, keyboard navigation, and lazy loading.',
    sourceUrl: `${examplesBaseUrl}/gallery`,
  },
  {
    id: 'runner',
    title: 'Flappy Arrow',
    icon: '\u{1F3AE}',
    description:
      'Navigate ()=> through ASCII pipes in this flappy-bird tribute with reactive state and a RAF game loop.',
    sourceUrl: `${examplesBaseUrl}/runner`,
  },
  {
    id: 'sandbox',
    title: 'Sandbox',
    icon: '\u{1F6E1}\uFE0F',
    description:
      'Run untrusted Arrow code in a WASM VM with isolated DOM, restricted fetch, and one-way output.',
    sourceUrl: `${examplesBaseUrl}/sandbox`,
  },

]

export const docsExampleMeta = playgroundExampleMeta.filter(
  (example) => example.id !== starterExampleId
)

export const showcaseMeta = [
  {
    title: 'Forma — AI-Native CMS',
    icon: '\u{1F916}',
    href: 'https://github.com/JussMor/forma-ai-cms',
    description:
      'Full-stack app builder where you describe what you want in plain language and Claude generates schemas, typed API endpoints, and live ArrowJS UI modules — all wired together automatically.',
    cta: 'View on GitHub',
  },
]

export function playgroundExampleHref(id) {
  return id === starterExampleId
    ? '/play/'
    : `/play/?example=${encodeURIComponent(id)}`
}
