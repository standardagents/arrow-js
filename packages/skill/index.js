#!/usr/bin/env node

import process from 'node:process'
import {
  installArrowSkill,
  parseCliArgs,
  promptForInstallOptions,
  SUPPORTED_AGENTS,
} from './installer.js'

try {
  const cli = parseCliArgs(process.argv.slice(2))
  const options = cli.interactive
    ? await promptForInstallOptions(cli.defaults)
    : cli.defaults

  const agents = options.agents ?? []

  if (agents.length === 0) {
    process.stdout.write('Skipped Arrow skill installation.\n')
    process.exit(0)
  }

  const names = agents.map((id) => {
    const agent = SUPPORTED_AGENTS.find((a) => a.id === id)
    return agent ? agent.name : id
  })

  process.stdout.write(
    `\n  Installing Arrow skill for: ${names.join(', ')}\n\n`
  )

  const result = await installArrowSkill(options)
  process.stdout.write(result.messages.join('\n') + '\n')
  process.stdout.write('\n  Done.\n\n')
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`
  )
  process.exit(1)
}
