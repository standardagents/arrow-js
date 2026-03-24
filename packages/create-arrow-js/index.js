#!/usr/bin/env node

import process from 'node:process'
import {
  detectPackageManager,
  getPackageManagerCommands,
  installProjectDependencies,
  scaffoldArrowApp,
} from './scaffold.js'

const args = process.argv.slice(2)
let targetDir = ''
const options = {}

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index]

  if (!targetDir && !arg.startsWith('-')) {
    targetDir = arg
    continue
  }

  if (arg === '--help' || arg === '-h') {
    printHelp()
    process.exit(0)
  }

  if (arg === '--skill-agent') {
    options.skillAgent = args[index + 1] ?? ''
    index += 1
    continue
  }

  if (arg === '--no-install') {
    options.install = false
    continue
  }

  throw new Error(`Unknown argument "${arg}".`)
}

targetDir = targetDir || 'arrow-app'

try {
  const result = await scaffoldArrowApp(targetDir, options)
  const packageManager = detectPackageManager()
  const commands = getPackageManagerCommands(packageManager ?? 'pnpm')
  const shouldInstall = options.install !== false

  let installedPackageManager = null

  if (shouldInstall && packageManager) {
    process.stdout.write(`\nInstalling dependencies with ${packageManager}...\n`)
    installedPackageManager = await installProjectDependencies(result.targetDir, {
      packageManager,
    })
  }

  const nextSteps = []

  if (result.relativeTargetDir !== '.') {
    nextSteps.push(`  cd ${result.relativeTargetDir}`)
  }

  if (!installedPackageManager) {
    if (shouldInstall && !packageManager) {
      nextSteps.push(`  ${commands.install}`)
    } else if (!shouldInstall) {
      nextSteps.push(`  ${commands.install}`)
    }
  }

  nextSteps.push(`  ${commands.dev}`)
  nextSteps.push('')

  process.stdout.write(
    [
      '',
      `Arrow app scaffolded in ${result.targetDir}`,
      '',
      ...(shouldInstall && !packageManager
        ? ['Automatic dependency install was skipped because the invoking package manager could not be detected.', '']
        : []),
      'Next steps:',
      ...nextSteps,
      '',
    ].join('\n')
  )
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`
  )
  process.exit(1)
}

function printHelp() {
  process.stdout.write(
    [
      'Usage: create-arrow-js [project-name] [--skill-agent codex|claude|both|skip] [--no-install]',
      '',
    ].join('\n')
  )
}
