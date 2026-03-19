import path from 'node:path'
import { defineConfig } from 'vite'
import { arrow } from '@arrow-js/vite-plugin-arrow'
import tailwindcss from '@tailwindcss/vite'

const rootDir = __dirname

export default defineConfig({
  resolve: {
    alias: {
      '@arrow-js/highlight': path.resolve(rootDir, '../packages/highlight/src/index.ts'),
      '@arrow-js/sandbox': path.resolve(rootDir, '../packages/sandbox/src/index.ts'),
    },
  },
  plugins: [arrow(), tailwindcss()],
  server: {
    host: '127.0.0.1',
    port: 4174,
    fs: {
      allow: [rootDir, path.resolve(rootDir, '..')],
    },
  },
  build: {
    outDir: path.resolve(rootDir, 'dist/client'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(rootDir, 'index.html'),
        play: path.resolve(rootDir, 'play/index.html'),
        playPreview: path.resolve(rootDir, 'play/preview.html'),
      },
    },
  },
  environments: {
    ssr: {
      consumer: 'server',
      build: {
        outDir: path.resolve(rootDir, 'dist/server'),
        emptyOutDir: false,
        rollupOptions: {
          input: path.resolve(rootDir, 'src/entry-server.ts'),
          output: {
            entryFileNames: 'entry-server.js',
          },
        },
      },
    },
  },
})
