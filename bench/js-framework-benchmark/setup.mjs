import { benchmarkRepoDir, benchmarkTag, ensureBenchmarkRepo } from './lib.mjs'

ensureBenchmarkRepo({ install: true })
console.log(`Benchmark repo ready at ${benchmarkRepoDir} (${benchmarkTag})`)
