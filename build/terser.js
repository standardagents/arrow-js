import { fileURLToPath } from 'url'
import fs from 'fs'
import { minify } from 'terser'

const inputFile = fileURLToPath(new URL('../dist/index.mjs', import.meta.url))
const tsSourceMap = fileURLToPath(
  new URL('../dist/index.mjs.map', import.meta.url)
)
const outputFile = fileURLToPath(
  new URL('../dist/index.min.mjs', import.meta.url)
)

let result = await minify(fs.readFileSync(inputFile, 'utf-8'), {
  mangle: {
    module: true,
    reserved: [
      // '_m',
      // '$on',
      // '$off',
      // '_em',
      // 'key',
      // 'memo',
      // 't',
      // 'r',
      // 'w',
      // 'html',
    ],
    properties: {
      reserved: ['$on', '$off', 'key', 'memo', 'pool', 'recycle', 'update'],
    },
  },
  compress: {
    ecma: '2022',
  },
  ecma: '2022',
  sourceMap: {
    content: fs.readFileSync(tsSourceMap, 'utf-8'),
    url: 'index.min.mjs.map',
  },
})

// Output the minified file and the map.
fs.writeFileSync(outputFile, result.code, 'utf8')
fs.writeFileSync(outputFile + '.map', result.map, 'utf8')

// IIFE
const iifeInputFile = fileURLToPath(
  new URL('../dist/index.js', import.meta.url)
)
const iifeTsSourceMap = fileURLToPath(
  new URL('../dist/index.js.map', import.meta.url)
)
const iifeOutputFile = fileURLToPath(
  new URL('../dist/index.min.js', import.meta.url)
)

let iifeResult = await minify(fs.readFileSync(iifeInputFile, 'utf-8'), {
  mangle: {
    module: true,
    reserved: [
      '_m',
      '$on',
      '$off',
      '_em',
      'key',
      'memo',
      'pool',
      'recycle',
      'update',
      't',
      'r',
      'w',
      'html',
      '$arrow',
    ],
  },
  compress: {
    ecma: '2015',
  },
  ecma: '2015',
  sourceMap: {
    content: fs.readFileSync(iifeTsSourceMap, 'utf-8'),
    url: 'index.min.js.map',
  },
})

// Output the minified file and the map.
fs.writeFileSync(iifeOutputFile, iifeResult.code, 'utf8')
fs.writeFileSync(iifeOutputFile + '.map', iifeResult.map, 'utf8')
