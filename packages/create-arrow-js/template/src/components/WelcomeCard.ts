import { component, html } from '@arrow-js/core'
import '@arrow-js/framework'
import { loadWelcomeCard } from '../data/loadWelcomeCard'

export const WelcomeCard = component(async () => {
  const note = await loadWelcomeCard()

  return html`<div class="card">
    <p class="section__label">${note.eyebrow}</p>
    <p class="card__copy">${note.copy}</p>
    <pre class="code-block">${note.snippet}</pre>
  </div>`
})
