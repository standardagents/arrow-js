import { html } from '@arrow-js/core'
import { AccordionApp } from './AccordionApp'

const root = document.getElementById('app')

if (!root) {
  throw new Error('Missing #app root')
}

html`${AccordionApp()}`(root)
