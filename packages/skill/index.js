#!/usr/bin/env node

import process from 'node:process'
import { installArrowSkill, parseCliArgs, promptForInstallOptions } from './installer.js'

try {
  const cli = parseCliArgs(process.argv.slice(2))
  const options = cli.interactive
    ? await promptForInstallOptions(cli.defaults)
    : cli.defaults

  if (options.agent === 'skip') {
    process.stdout.write('Skipped Arrow skill installation.\n')
    process.exit(0)
  }

  const result = await installArrowSkill(options)
  const output = [
    '',
    'Arrow skill installed.',
    ...result.messages,
    '',
  ]
  process.stdout.write(output.join('\n'))
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
}
