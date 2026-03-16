import { component, html } from '@arrow-js/core'

const LABELS = ['Weak', 'Fair', 'Good', 'Strong', 'Very strong']
const COLORS = ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#27ae60']

export const StrengthMeter = component((props: { score: () => number }) =>
  html`<div class="strength-meter">
    <div class="strength-bar">
      <div
        class="strength-fill"
        style="${() => `width: ${((props.score() + 1) / 5) * 100}%; background: ${COLORS[props.score()]}`}"
      ></div>
    </div>
    <span class="strength-label" style="${() => `color: ${COLORS[props.score()]}`}">
      ${() => LABELS[props.score()]}
    </span>
  </div>`
)
