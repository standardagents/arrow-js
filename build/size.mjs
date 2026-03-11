import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { brotliCompressSync, constants, gzipSync } from 'node:zlib'

const limit = 3 * 1024
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const file = resolve(__dirname, '../dist/index.min.mjs')
const source = readFileSync(file)
const gzip = gzipSync(source, { level: 9 })
const brotli = brotliCompressSync(source, {
  params: {
    [constants.BROTLI_PARAM_QUALITY]: 11,
  },
})

console.log(`raw: ${source.length} B`)
console.log(`gzip: ${gzip.length} B`)
console.log(`brotli: ${brotli.length} B`)

if (gzip.length > limit) {
  console.warn(`gzip is above target (${limit} B)`)
}

if (brotli.length > limit) {
  console.error(`brotli size exceeded ${limit} B`)
  process.exit(1)
}
