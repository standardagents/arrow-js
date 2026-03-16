import { component, html, reactive } from '@arrow-js/core'

export const AccordionItem = component((props: {
  answer: string
  question: string
}) => {
  const state = reactive({ open: false })

  return html`<article class="acc-item" data-open="${() => String(state.open)}">
    <button class="acc-trigger" @click="${() => { state.open = !state.open }}">
      <span>${() => props.question}</span>
      <span class="acc-icon"></span>
    </button>
    <div class="acc-body">
      <div><p>${() => props.answer}</p></div>
    </div>
  </article>`
})
