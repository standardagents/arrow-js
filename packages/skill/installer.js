import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { multiSelect } from './tui.js'

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const skillTemplateRoot = path.resolve(packageRoot, 'resources', 'skill')
const projectReferenceRoot = path.resolve(skillTemplateRoot, 'references')

export const SUPPORTED_AGENTS = [
  { id: 'codex', name: 'Codex', description: 'OpenAI Codex CLI', file: 'AGENTS.md', skillDir: true },
  { id: 'claude', name: 'Claude Code', description: 'Anthropic Claude Code', file: 'CLAUDE.md' },
  { id: 'cursor', name: 'Cursor', description: 'Cursor AI', file: '.cursorrules' },
  { id: 'copilot', name: 'Copilot', description: 'GitHub Copilot CLI', file: path.join('.github', 'copilot-instructions.md') },
  { id: 'gemini', name: 'Gemini CLI', description: 'Google Gemini CLI', file: 'GEMINI.md' },
  { id: 'amp', name: 'Amp', description: 'Sourcegraph Amp', file: 'AGENTS.md' },
  { id: 'cline', name: 'Cline', description: 'Cline CLI', file: '.clinerules' },
  { id: 'opencode', name: 'OpenCode', description: 'OpenCode CLI', file: 'AGENTS.md' },
  { id: 'qwen', name: 'Qwen CLI', description: 'Qwen Code CLI', file: 'AGENTS.md' },
]

const AGENT_IDS = new Set(SUPPORTED_AGENTS.map((a) => a.id))

const INSTRUCTION_BLOCK = [
  '# Arrow',
  '',
  'Use the local Arrow references when working on this project:',
  '',
  '- `.arrow-js/skill/getting-started.md`',
  '- `.arrow-js/skill/api.md`',
  '- `.arrow-js/skill/examples.md`',
  '',
  'Prefer idiomatic Arrow patterns:',
  '- `reactive()` for live state',
  '- `html` tagged templates for DOM',
  '- `component()` for reusable view units',
  '- `routeToPage(url)` in scaffolded SSR apps',
  '',
  'Keep no-build core usage simple. If SSR or hydration is involved, preserve payload and boundary behavior.',
].join('\n')

export async function installArrowSkill(options = {}) {
  const agents = resolveAgents(options)
  const projectDir = path.resolve(options.projectDir ?? process.cwd())
  const enableProject = options.enableProject ?? true
  const codexHome = path.resolve(options.codexHome ?? resolveCodexHome())
  const messages = []

  if (agents.length === 0) return { messages }

  // Copy reference files once (shared by all project-level agents)
  if (enableProject) {
    const refTarget = path.join(projectDir, '.arrow-js', 'skill')
    await copyDir(projectReferenceRoot, refTarget)
    messages.push(`  Arrow references copied to .arrow-js/skill/`)
  }

  // Install Codex skill directory if selected
  if (agents.includes('codex')) {
    const targetDir = path.join(codexHome, 'skills', 'arrow-js')
    await fs.mkdir(path.dirname(targetDir), { recursive: true })
    await copyDir(skillTemplateRoot, targetDir)
    messages.push(`  Codex skill installed to ${targetDir}`)
  }

  // Write instruction files (deduplicate by resolved path)
  if (enableProject) {
    const writtenFiles = new Set()

    for (const agentId of agents) {
      const agent = SUPPORTED_AGENTS.find((a) => a.id === agentId)
      if (!agent) continue

      const filePath = path.join(projectDir, agent.file)
      if (writtenFiles.has(filePath)) continue
      writtenFiles.add(filePath)

      await fs.mkdir(path.dirname(filePath), { recursive: true })
      await upsertManagedBlock(filePath, 'arrow-js-skill', INSTRUCTION_BLOCK)
      messages.push(`  Updated ${agent.file}`)
    }
  }

  return { messages }
}

function resolveAgents(options) {
  if (Array.isArray(options.agents)) return options.agents
  const agent = options.agent ?? 'codex'
  if (agent === 'both') return ['codex', 'claude']
  if (agent === 'skip') return []
  if (agent === 'all') return SUPPORTED_AGENTS.map((a) => a.id)
  return agent.split(',').map((s) => s.trim()).filter(Boolean)
}

export function parseCliArgs(args) {
  const defaults = {
    agents: undefined,
    agent: undefined,
    projectDir: process.cwd(),
    enableProject: true,
  }
  let interactive = args.length === 0

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === 'install') {
      interactive = false
      continue
    }

    if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    }

    if (arg === '--yes' || arg === '-y') {
      interactive = false
      continue
    }

    if (arg === '--agent') {
      defaults.agent = args[index + 1] ?? ''
      index += 1
      interactive = false
      continue
    }

    if (arg === '--project') {
      defaults.projectDir = args[index + 1] ?? ''
      index += 1
      interactive = false
      continue
    }

    if (arg === '--no-project') {
      defaults.enableProject = false
      interactive = false
      continue
    }

    throw new Error(`Unknown argument "${arg}".`)
  }

  if (!defaults.projectDir) {
    throw new Error('Missing value for --project.')
  }

  if (defaults.agent !== undefined) {
    const agents = resolveAgents(defaults)
    for (const id of agents) {
      if (!AGENT_IDS.has(id)) {
        throw new Error(
          `Unknown agent "${id}". Valid: ${[...AGENT_IDS].join(', ')}, all, both, skip`
        )
      }
    }
  }

  return { interactive, defaults }
}

export async function promptForInstallOptions(defaults = {}) {
  const selected = await multiSelect({
    items: SUPPORTED_AGENTS,
    preselected: [],
  })

  return {
    agents: selected,
    projectDir: defaults.projectDir ?? process.cwd(),
    enableProject: selected.length > 0,
  }
}

function printHelp() {
  const agentList = SUPPORTED_AGENTS.map((a) => a.id).join(', ')
  process.stdout.write(
    [
      'Usage: arrow-js-skill [install] [options]',
      '',
      'Options:',
      '  --agent <agents>   Comma-separated list of agents (or: all, both, skip)',
      `                     Available: ${agentList}`,
      '  --project <dir>    Project directory (default: current directory)',
      '  --no-project       Skip project-level file installation',
      '  --yes, -y          Non-interactive mode with defaults',
      '  --help, -h         Show this help',
      '',
      'Examples:',
      '  npx @arrow-js/skill@latest',
      '  npx @arrow-js/skill@latest install --agent codex,claude --yes',
      '  npx @arrow-js/skill@latest install --agent all --yes',
      '',
    ].join('\n')
  )
}

function resolveCodexHome() {
  return process.env.CODEX_HOME || path.join(os.homedir(), '.codex')
}

async function copyDir(sourceDir, targetDir) {
  await fs.mkdir(targetDir, { recursive: true })
  const entries = await fs.readdir(sourceDir, { withFileTypes: true })

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]
    const sourcePath = path.join(sourceDir, entry.name)
    const targetPath = path.join(targetDir, entry.name)

    if (entry.isDirectory()) {
      await copyDir(sourcePath, targetPath)
      continue
    }

    await fs.copyFile(sourcePath, targetPath)
  }
}

async function upsertManagedBlock(filePath, blockId, body) {
  const start = `<!-- ${blockId}:start -->`
  const end = `<!-- ${blockId}:end -->`
  const block = `${start}\n${body}\n${end}\n`
  let source = ''

  try {
    source = await fs.readFile(filePath, 'utf8')
  } catch (error) {
    if (!isMissingPathError(error)) {
      throw error
    }
  }

  if (source.includes(start) && source.includes(end)) {
    const next = source.replace(
      new RegExp(`${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}\\n?`),
      block
    )
    await fs.writeFile(filePath, next)
    return
  }

  const prefix =
    source.length > 0 && !source.endsWith('\n')
      ? '\n\n'
      : source.length > 0
        ? '\n'
        : ''
  await fs.writeFile(filePath, `${source}${prefix}${block}`)
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isMissingPathError(error) {
  return (
    !!error &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === 'ENOENT'
  )
}
