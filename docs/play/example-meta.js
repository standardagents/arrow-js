export const starterExampleId = 'starter'
const examplesBaseUrl =
  'https://github.com/justin-schroeder/arrow-js/tree/master/docs/play/examples'

export const playgroundExampleMeta = [
  {
    id: starterExampleId,
    title: 'Starter',
    description: 'A compact multi-file starter with shared state and a local component.',
  },
  {
    id: 'todo',
    title: 'Todo List',
    description:
      'A task tracker with reactive arrays, keyed lists, and computed filtering.',
    sourceUrl: `${examplesBaseUrl}/todo`,
  },
  {
    id: 'timer',
    title: 'Pomodoro Timer',
    description:
      'A focus timer with SVG progress ring, intervals, and computed formatting.',
    sourceUrl: `${examplesBaseUrl}/timer`,
  },
  {
    id: 'palette',
    title: 'Color Palette',
    description:
      'A Coolors-style harmony palette generator with reactive style binding and computed colors.',
    sourceUrl: `${examplesBaseUrl}/palette`,
  },
  {
    id: 'password',
    title: 'Password Generator',
    description:
      'A configurable password tool with reactive toggles and a strength meter.',
    sourceUrl: `${examplesBaseUrl}/password`,
  },
  {
    id: 'accordion',
    title: 'Accordion',
    description:
      'Expandable FAQ sections where each component instance keeps its own state.',
    sourceUrl: `${examplesBaseUrl}/accordion`,
  },
  {
    id: 'feed',
    title: 'Live Feed',
    description:
      'An auto-updating event feed with reactive array mutations and timed entries.',
    sourceUrl: `${examplesBaseUrl}/feed`,
  },
]

export const docsExampleMeta = playgroundExampleMeta.filter(
  (example) => example.id !== starterExampleId
)

export function playgroundExampleHref(id) {
  return id === starterExampleId
    ? '/play/'
    : `/play/?example=${encodeURIComponent(id)}`
}
