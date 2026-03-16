import { html } from '@arrow-js/core'
import { TodoApp } from './TodoApp'

const root = document.getElementById('app')

if (!root) {
  throw new Error('Missing #app root')
}

html`${TodoApp()}`(root)
