import { html } from '@arrow-js/core'
import { TimerApp } from './TimerApp'

const root = document.getElementById('app')

if (!root) {
  throw new Error('Missing #app root')
}

html`${TimerApp()}`(root)
