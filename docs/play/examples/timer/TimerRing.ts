import { component, html } from '@arrow-js/core'

const RADIUS = 90
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export const TimerRing = component((props: { progress: () => number }) =>
  html`<svg class="timer-ring" viewBox="0 0 200 200">
    <circle
      class="timer-ring__track"
      cx="100"
      cy="100"
      r="${RADIUS}"
      fill="none"
      stroke-width="8"
    />
    <circle
      class="timer-ring__fill"
      cx="100"
      cy="100"
      r="${RADIUS}"
      fill="none"
      stroke-width="8"
      stroke-linecap="round"
      stroke-dasharray="${CIRCUMFERENCE}"
      stroke-dashoffset="${() => CIRCUMFERENCE * (1 - props.progress())}"
      transform="rotate(-90 100 100)"
    />
  </svg>`
)
