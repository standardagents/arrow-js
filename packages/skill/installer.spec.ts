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
    expect(await fs.readFile(path.join(projectDir, 'AGENTS.md'), 'utf8')).toContain('Use the installed `arrow-js` Codex skill')
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
})

async function createTempRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'arrow-skill-'))
  tempRoots.push(root)
  return root
}
