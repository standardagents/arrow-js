import { spawn } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

import {
  benchmarkRepoDir,
  ensureBenchmarkRepo,
  rootDir,
  run,
  syncArrowLocal,
} from './lib.mjs'
import { presetMap } from './presets.mjs'

const runnerDir = `${benchmarkRepoDir}/webdriver-ts`
const resultsDir = join(runnerDir, 'results')
const runnerArgs = []
let preset = 'core'

for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i]
  if (arg === '--') {
    continue
  } else if (arg === '--preset') {
    preset = process.argv[++i] ?? preset
  } else {
    runnerArgs.push(arg)
  }
}

const selectedPreset = presetMap[preset]

if (!selectedPreset) {
  throw new Error(`Unknown benchmark preset: ${preset}`)
}

if (!runnerArgs.includes('--headless')) {
  runnerArgs.unshift('--headless')
}

if (!runnerArgs.includes('--count') && !runnerArgs.includes('--smoketest')) {
  runnerArgs.unshift('1')
  runnerArgs.unshift('--count')
}

if (!runnerArgs.includes('--framework')) {
  for (const framework of selectedPreset.frameworks) {
    runnerArgs.push('--framework', framework)
  }
}

if (!runnerArgs.includes('--benchmark')) {
  for (const benchmark of selectedPreset.benchmarks) {
    runnerArgs.push('--benchmark', benchmark)
  }
}

let server

function stopServer() {
  if (server?.exitCode === null) {
    try {
      process.kill(-server.pid, 'SIGTERM')
    } catch {}
  }
}

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const response = await fetch('http://localhost:8080/index.html')
      if (response.ok) return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  throw new Error('Timed out waiting for js-framework-benchmark server')
}

process.on('exit', stopServer)
process.on('SIGINT', () => {
  stopServer()
  process.exit(1)
})
process.on('SIGTERM', () => {
  stopServer()
  process.exit(1)
})

try {
  ensureBenchmarkRepo({ install: true })
  run('pnpm', ['build:runtime'], { cwd: rootDir })
  syncArrowLocal()
  rmSync(resultsDir, { recursive: true, force: true })
  mkdirSync(resultsDir, { recursive: true })
  server = spawn('npm', ['start'], {
    cwd: benchmarkRepoDir,
    detached: true,
    stdio: 'ignore',
  })
  server.unref()
  await waitForServer()
  run('node', ['dist/benchmarkRunner.js', ...runnerArgs], { cwd: runnerDir })
  if (!runnerArgs.includes('--smoketest')) {
    run('node', ['bench/js-framework-benchmark/report.mjs'], { cwd: rootDir })
  }
} finally {
  stopServer()
}
