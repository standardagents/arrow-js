import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { installArrowSkill } from './installer.js'

const tempRoots: string[] = []

describe('@arrow-js/skill installer', () => {
  afterEach(async () => {
    while (tempRoots.length > 0) {
      const root = tempRoots.pop()
      await fs.rm(root!, { recursive: true, force: true })
    }
  })

  it('installs the Codex skill and project instructions', async () => {
    const root = await createTempRoot()
    const codexHome = path.join(root, '.codex')
    const projectDir = path.join(root, 'app')
    await fs.mkdir(projectDir, { recursive: true })

    await installArrowSkill({
      agent: 'codex',
      codexHome,
      projectDir,
      enableProject: true,
    })

    expect(await fs.readFile(path.join(codexHome, 'skills', 'arrow-js', 'SKILL.md'), 'utf8')).toContain('name: arrow-js')
    expect(await fs.readFile(path.join(projectDir, 'AGENTS.md'), 'utf8')).toContain('Use the local Arrow references')
  })

  it('installs Claude project references and instructions', async () => {
    const root = await createTempRoot()
    const projectDir = path.join(root, 'app')
    await fs.mkdir(projectDir, { recursive: true })

    await installArrowSkill({
      agent: 'claude',
      projectDir,
      enableProject: true,
    })

    expect(await fs.readFile(path.join(projectDir, '.arrow-js', 'skill', 'api.md'), 'utf8')).toContain('Arrow API Notes')
    expect(await fs.readFile(path.join(projectDir, 'CLAUDE.md'), 'utf8')).toContain('Use the local Arrow references')
  })

  it('updates managed blocks idempotently', async () => {
    const root = await createTempRoot()
    const codexHome = path.join(root, '.codex')
    const projectDir = path.join(root, 'app')
    await fs.mkdir(projectDir, { recursive: true })

    await installArrowSkill({
      agent: 'codex',
      codexHome,
      projectDir,
      enableProject: true,
    })

    await installArrowSkill({
      agent: 'codex',
      codexHome,
      projectDir,
      enableProject: true,
    })

    const agents = await fs.readFile(path.join(projectDir, 'AGENTS.md'), 'utf8')
    expect(agents.match(/arrow-js-skill:start/g)?.length).toBe(1)
  })

  it('installs for multiple agents via agents array', async () => {
    const root = await createTempRoot()
    const codexHome = path.join(root, '.codex')
    const projectDir = path.join(root, 'app')
    await fs.mkdir(projectDir, { recursive: true })

    await installArrowSkill({
      agents: ['codex', 'claude', 'gemini'],
      codexHome,
      projectDir,
      enableProject: true,
    })

    expect(await fs.readFile(path.join(codexHome, 'skills', 'arrow-js', 'SKILL.md'), 'utf8')).toContain('name: arrow-js')
    expect(await fs.readFile(path.join(projectDir, 'AGENTS.md'), 'utf8')).toContain('Use the local Arrow references')
    expect(await fs.readFile(path.join(projectDir, 'CLAUDE.md'), 'utf8')).toContain('Use the local Arrow references')
    expect(await fs.readFile(path.join(projectDir, 'GEMINI.md'), 'utf8')).toContain('Use the local Arrow references')
    expect(await fs.readFile(path.join(projectDir, '.arrow-js', 'skill', 'api.md'), 'utf8')).toContain('Arrow API Notes')
  })

  it('deduplicates shared instruction files', async () => {
    const root = await createTempRoot()
    const projectDir = path.join(root, 'app')
    await fs.mkdir(projectDir, { recursive: true })

    await installArrowSkill({
      agents: ['codex', 'amp', 'opencode'],
      projectDir,
      enableProject: true,
    })

    const agentsMd = await fs.readFile(path.join(projectDir, 'AGENTS.md'), 'utf8')
    expect(agentsMd.match(/arrow-js-skill:start/g)?.length).toBe(1)
  })

  it('creates subdirectories for copilot instructions', async () => {
    const root = await createTempRoot()
    const projectDir = path.join(root, 'app')
    await fs.mkdir(projectDir, { recursive: true })

    await installArrowSkill({
      agents: ['copilot'],
      projectDir,
      enableProject: true,
    })

    const copilotMd = await fs.readFile(
      path.join(projectDir, '.github', 'copilot-instructions.md'),
      'utf8'
    )
    expect(copilotMd).toContain('Use the local Arrow references')
  })

  it('installs all agents', async () => {
    const root = await createTempRoot()
    const codexHome = path.join(root, '.codex')
    const projectDir = path.join(root, 'app')
    await fs.mkdir(projectDir, { recursive: true })

    await installArrowSkill({
      agent: 'all',
      codexHome,
      projectDir,
      enableProject: true,
    })

    expect(await fileExists(path.join(projectDir, 'AGENTS.md'))).toBe(true)
    expect(await fileExists(path.join(projectDir, 'CLAUDE.md'))).toBe(true)
    expect(await fileExists(path.join(projectDir, 'GEMINI.md'))).toBe(true)
    expect(await fileExists(path.join(projectDir, '.cursorrules'))).toBe(true)
    expect(await fileExists(path.join(projectDir, '.clinerules'))).toBe(true)
    expect(await fileExists(path.join(projectDir, '.github', 'copilot-instructions.md'))).toBe(true)
    expect(await fileExists(path.join(codexHome, 'skills', 'arrow-js', 'SKILL.md'))).toBe(true)
  })
})

async function createTempRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'arrow-skill-'))
  tempRoots.push(root)
  return root
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}
