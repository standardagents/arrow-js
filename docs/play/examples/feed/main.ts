import { html } from '@arrow-js/core'
import { FeedApp } from './FeedApp'

const root = document.getElementById('app')

if (!root) {
  throw new Error('Missing #app root')
}

html`${FeedApp()}`(root)
