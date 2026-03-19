import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  root: fileURLToPath(new URL('./', import.meta.url)),
  resolve: {
    alias: {
      '@arrow-js/core': fileURLToPath(
        new URL('../../core/src/index.ts', import.meta.url)
      ),
      '@arrow-js/sandbox': fileURLToPath(
        new URL('../src/index.ts', import.meta.url)
      ),
    },
  },
  server: {
    port: 4175,
  },
  preview: {
    port: 4175,
  },
})
