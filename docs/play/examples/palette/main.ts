import { html } from '@arrow-js/core'
import { PaletteApp } from './PaletteApp'

const root = document.getElementById('app')

if (!root) {
  throw new Error('Missing #app root')
}

html`${PaletteApp()}`(root)
