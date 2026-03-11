import { ensureBenchmarkRepo, syncArrowLocal } from './lib.mjs'

ensureBenchmarkRepo()
syncArrowLocal()
console.log('Synced local Arrow into js-framework-benchmark')
