import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { benchmarkRepoDir } from './lib.mjs'

const resultsDir = join(benchmarkRepoDir, 'webdriver-ts', 'results')

if (!existsSync(resultsDir)) {
  console.log('No benchmark results found')
  process.exit(0)
}

const files = readdirSync(resultsDir).filter((file) => file.endsWith('.json'))
const rows = files
  .map((file) => JSON.parse(readFileSync(join(resultsDir, file), 'utf8')))
  .map((result) => {
    const total = result.values.total ?? result.values.DEFAULT
    return {
      framework: result.framework,
      benchmark: result.benchmark,
      mean: total.mean,
      median: total.median,
    }
  })
  .sort((left, right) =>
    left.benchmark === right.benchmark
      ? left.mean - right.mean
      : left.benchmark.localeCompare(right.benchmark)
  )

let currentBenchmark = ''
for (const row of rows) {
  if (row.benchmark !== currentBenchmark) {
    currentBenchmark = row.benchmark
    console.log(`\n${currentBenchmark}`)
  }
  console.log(
    `${row.framework.padEnd(36)} mean=${row.mean.toFixed(1).padStart(6)} median=${row.median
      .toFixed(1)
      .padStart(6)}`
  )
}
