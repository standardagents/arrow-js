import { html } from '@arrow-js/core'
import { GeneratorApp } from './GeneratorApp'

const root = document.getElementById('app')

if (!root) {
  throw new Error('Missing #app root')
}

html`${GeneratorApp()}`(root)
