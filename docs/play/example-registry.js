import { playgroundExampleMeta, starterExampleId } from './example-meta'

const ENTRY_FILE = 'main.ts'
const exampleModules = import.meta.glob('./examples/**/*.{ts,css}', {
  eager: true,
  import: 'default',
  query: '?raw',
})

const metaById = new Map(playgroundExampleMeta.map((example) => [example.id, example]))

function createExample(id, files) {
  const meta = metaById.get(id)

  if (!meta) {
    throw new Error(`Unknown playground example: ${id}`)
  }

  return {
    ...meta,
    entry: ENTRY_FILE,
    files,
  }
}

function getExampleFile(id, name) {
  const key = `./examples/${id}/${name}`
  const value = exampleModules[key]

  if (typeof value !== 'string') {
    throw new Error(`Missing playground example file: ${key}`)
  }

  return value.trimEnd() + '\n'
}

function createExampleFromDir(id, files) {
  return createExample(
    id,
    files.map((name) => [name, getExampleFile(id, name)])
  )
}

export const playgroundExamples = [
  createExampleFromDir(starterExampleId, [
    ENTRY_FILE,
    'App.ts',
    'CounterPanel.ts',
    'styles.css',
  ]),
  createExampleFromDir('todo', [
    ENTRY_FILE,
    'TodoApp.ts',
    'TodoItem.ts',
    'styles.css',
  ]),
  createExampleFromDir('timer', [
    ENTRY_FILE,
    'TimerApp.ts',
    'TimerRing.ts',
    'styles.css',
  ]),
  createExampleFromDir('palette', [
    ENTRY_FILE,
    'PaletteApp.ts',
    'Swatch.ts',
    'styles.css',
  ]),
  createExampleFromDir('password', [
    ENTRY_FILE,
    'GeneratorApp.ts',
    'StrengthMeter.ts',
    'styles.css',
  ]),
  createExampleFromDir('accordion', [
    ENTRY_FILE,
    'AccordionApp.ts',
    'AccordionItem.ts',
    'styles.css',
  ]),
  createExampleFromDir('feed', [
    ENTRY_FILE,
    'FeedApp.ts',
    'FeedCard.ts',
    'styles.css',
  ]),
]

const exampleById = new Map(playgroundExamples.map((example) => [example.id, example]))

export function getPlaygroundExample(id) {
  return exampleById.get(id) ?? exampleById.get(starterExampleId)
}

export function cloneExampleFiles(files) {
  return files.map(([name, content]) => [name, content])
}

export { ENTRY_FILE }
