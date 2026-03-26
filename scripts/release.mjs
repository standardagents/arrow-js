#!/usr/bin/env node

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import * as p from '@clack/prompts'
import chalk from 'chalk'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rootPackagePath = path.join(rootDir, 'package.json')
const createArrowVersionsPath = path.join(rootDir, 'packages/create-arrow-js/versions.json')
const releasablePackages = [
  'packages/core',
  'packages/framework',
  'packages/highlight',
  'packages/hydrate',
  'packages/sandbox',
  'packages/skill',
  'packages/ssr',
  'packages/vite-plugin-arrow',
  'packages/create-arrow-js',
]

const args = process.argv.slice(2)

if (args[0] === 'sync') {
  const version = readFlagValue(args, '--version')
  if (!version) {
    fail('Missing --version for sync.')
  }
  syncVersions(version)
  process.stdout.write(`Synced releasable packages to ${version}\n`)
  process.exit(0)
}

await runInteractiveRelease({
  requestedTag: readFlagValue(args, '--tag'),
  requestedBump: readFlagValue(args, '--bump'),
  dryRun: args.includes('--dry-run'),
  skipConfirm: args.includes('--yes'),
})

async function runInteractiveRelease({ requestedTag, requestedBump, dryRun, skipConfirm }) {
  p.intro(chalk.bgCyan.black(' arrow release '))

  if (!isWorkingDirectoryClean()) {
    p.cancel('Working directory is not clean. Commit or stash changes first.')
    process.exit(1)
  }

  const branch = exec('git branch --show-current')
  const stableVersion = getStableVersion(readJson(rootPackagePath).version || readPackageVersion('packages/core'))

  // --- Release channel ---
  const releaseTag = requestedTag
    ? (validateReleaseTag(branch, requestedTag), requestedTag)
    : await selectReleaseTag(branch)

  if (p.isCancel(releaseTag)) {
    p.cancel('Release cancelled.')
    process.exit(0)
  }

  // --- Version bump ---
  const bumpType = requestedBump
    ? validateBumpType(requestedBump)
    : await p.select({
        message: 'Version bump',
        options: [
          { value: 'patch', label: `patch`, hint: `${stableVersion} ${chalk.dim('->')} ${chalk.green(bumpVersion(stableVersion, 'patch'))}` },
          { value: 'minor', label: `minor`, hint: `${stableVersion} ${chalk.dim('->')} ${chalk.green(bumpVersion(stableVersion, 'minor'))}` },
          { value: 'major', label: `major`, hint: `${stableVersion} ${chalk.dim('->')} ${chalk.green(bumpVersion(stableVersion, 'major'))}` },
        ],
      })

  if (p.isCancel(bumpType)) {
    p.cancel('Release cancelled.')
    process.exit(0)
  }

  const nextStable = bumpVersion(stableVersion, bumpType)
  const commitHash = exec('git rev-parse --short=7 HEAD')
  const version = releaseTag === 'latest'
    ? nextStable
    : `${nextStable}-${releaseTag}.${commitHash}`
  const gitTag = `v${version}`

  // --- Summary ---
  p.note(
    [
      `${chalk.dim('Branch:')}    ${chalk.cyan(branch)}`,
      `${chalk.dim('Version:')}   ${chalk.green(version)}`,
      `${chalk.dim('Git tag:')}   ${chalk.yellow(gitTag)}`,
      `${chalk.dim('npm tag:')}   ${chalk.magenta(releaseTag)}`,
    ].join('\n'),
    'Release summary'
  )

  // --- Confirm ---
  if (!skipConfirm) {
    const confirmed = await p.confirm({
      message: dryRun ? 'Continue with dry run?' : 'Ship it?',
    })

    if (p.isCancel(confirmed) || !confirmed) {
      p.cancel('Release cancelled.')
      process.exit(0)
    }
  }

  // --- Execute release ---
  if (dryRun) {
    p.outro(chalk.dim('Dry run complete — nothing was pushed.'))
    return
  }

  const s = p.spinner()

  if (releaseTag === 'latest') {
    s.start('Syncing package versions')
    syncVersions(version)
    s.stop('Package versions synced')

    s.start('Committing release')
    exec('git add package.json packages')
    exec(`git commit -m "chore: release ${gitTag}"`)
    s.stop('Release committed')

    s.start('Tagging & pushing')
    exec(`git tag ${gitTag}`)
    exec('git push origin HEAD')
    exec(`git push origin ${gitTag}`)
    s.stop('Tag pushed')
  } else {
    s.start('Tagging & pushing')
    exec(`git tag ${gitTag}`)
    exec(`git push origin ${gitTag}`)
    s.stop('Tag pushed')
  }

  // --- Watch the GitHub Actions workflow ---
  const repoSlug = getRepoSlug()
  if (repoSlug) {
    await watchWorkflow(repoSlug, gitTag)
  }

  p.outro(chalk.green(`Released ${gitTag}`))
}

async function selectReleaseTag(branch) {
  const options = branch === 'main'
    ? [
        { value: 'latest', label: 'latest', hint: 'stable release' },
        { value: 'next', label: 'next', hint: 'pre-release' },
        { value: 'dev', label: 'dev', hint: 'development' },
      ]
    : [
        { value: 'next', label: 'next', hint: 'pre-release' },
        { value: 'dev', label: 'dev', hint: 'development' },
      ]

  return p.select({
    message: branch === 'main'
      ? 'Release channel'
      : `Release channel ${chalk.dim(`(branch: ${branch})`)}`,
    options,
  })
}

async function watchWorkflow(repoSlug, gitTag) {
  if (!hasGhCli()) {
    p.log.info(
      chalk.dim(`Watch the publish workflow at: https://github.com/${repoSlug}/actions`)
    )
    return
  }

  const shouldWatch = await p.confirm({
    message: 'Watch publish workflow?',
    initialValue: true,
  })

  if (p.isCancel(shouldWatch) || !shouldWatch) {
    p.log.info(chalk.dim(`https://github.com/${repoSlug}/actions`))
    return
  }

  const s = p.spinner()
  s.start('Waiting for workflow to start')

  // Wait for the workflow run to appear (triggered by the tag push)
  let runId = ''
  for (let i = 0; i < 30; i++) {
    await sleep(2000)
    try {
      runId = exec(
        `gh run list --repo ${repoSlug} --workflow=publish.yml --limit=1 --json databaseId,headBranch --jq '.[] | select(.headBranch=="${gitTag}") | .databaseId'`
      )
    } catch {
      // gh may fail if the run isn't visible yet
    }
    if (runId) break
  }

  if (!runId) {
    s.stop('Could not find workflow run')
    p.log.warn(chalk.dim(`Check manually: https://github.com/${repoSlug}/actions`))
    return
  }

  s.stop(`Workflow started ${chalk.dim(`(run #${runId})`)}`)
  p.log.info(chalk.dim(`https://github.com/${repoSlug}/actions/runs/${runId}`))

  // Poll for job status
  const prevStatus = new Map()
  let conclusion = ''

  while (!conclusion) {
    await sleep(5000)
    try {
      const json = exec(
        `gh run view ${runId} --repo ${repoSlug} --json status,conclusion,jobs`
      )
      const run = JSON.parse(json)

      // Print job status changes
      for (const job of run.jobs || []) {
        const prev = prevStatus.get(job.name)
        if (prev !== job.status && prev !== 'completed') {
          prevStatus.set(job.name, job.status)
          const icon = job.conclusion === 'success'
            ? chalk.green('*')
            : job.conclusion === 'failure'
              ? chalk.red('x')
              : job.status === 'in_progress'
                ? chalk.yellow('~')
                : chalk.dim('-')
          const label = job.conclusion === 'success'
            ? chalk.green(job.name)
            : job.conclusion === 'failure'
              ? chalk.red(job.name)
              : job.status === 'in_progress'
                ? chalk.yellow(job.name)
                : chalk.dim(job.name)
          p.log.step(`${icon} ${label}`)
        }
      }

      if (run.status === 'completed') {
        conclusion = run.conclusion
      }
    } catch {
      // transient API errors — just retry
    }
  }

  if (conclusion === 'success') {
    p.log.success(chalk.green('All packages published!'))
  } else {
    p.log.error(chalk.red(`Workflow ${conclusion}. Check: https://github.com/${repoSlug}/actions/runs/${runId}`))
  }
}

// ---- helpers ----

function syncVersions(version) {
  const rootPackage = readJson(rootPackagePath)
  rootPackage.version = version
  writeJson(rootPackagePath, rootPackage)

  for (let index = 0; index < releasablePackages.length; index += 1) {
    const packagePath = path.join(rootDir, releasablePackages[index], 'package.json')
    const packageJson = readJson(packagePath)
    packageJson.version = version
    writeJson(packagePath, packageJson)
  }

  const versionMap = readJson(createArrowVersionsPath)
  for (const key of Object.keys(versionMap)) {
    versionMap[key] = version
  }
  writeJson(createArrowVersionsPath, versionMap)
}

function validateReleaseTag(branch, requestedTag) {
  if (!['latest', 'next', 'dev'].includes(requestedTag)) {
    fail(`Unknown release tag "${requestedTag}". Use latest, next, or dev.`)
  }
  if (requestedTag === 'latest' && branch !== 'main') {
    fail('Cannot publish latest from a non-main branch.')
  }
}

function validateBumpType(value) {
  if (!['patch', 'minor', 'major'].includes(value)) {
    fail(`Unknown bump type "${value}". Use patch, minor, or major.`)
  }
  return value
}

function getStableVersion(version) {
  return version.split('-')[0]
}

function readPackageVersion(packageDir) {
  return readJson(path.join(rootDir, packageDir, 'package.json')).version
}

function bumpVersion(version, bumpType) {
  const parts = version.split('.').map(Number)
  if (bumpType === 'major') return `${parts[0] + 1}.0.0`
  if (bumpType === 'minor') return `${parts[0]}.${parts[1] + 1}.0`
  return `${parts[0]}.${parts[1]}.${parts[2] + 1}`
}

function isWorkingDirectoryClean() {
  return exec('git status --short') === ''
}

function getRepoSlug() {
  try {
    const url = exec('git remote get-url origin')
    const match = url.match(/github\.com[/:](.+?)(?:\.git)?$/)
    return match?.[1] || ''
  } catch {
    return ''
  }
}

function hasGhCli() {
  try {
    execSync('gh --version', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function readFlagValue(sourceArgs, flag) {
  const direct = sourceArgs.find((value) => value.startsWith(`${flag}=`))
  if (direct) return direct.slice(flag.length + 1)
  const index = sourceArgs.indexOf(flag)
  if (index === -1) return ''
  return sourceArgs[index + 1] ?? ''
}

function exec(command) {
  return execSync(command, {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function fail(message) {
  p.cancel(message)
  process.exit(1)
}
