import { component, html } from '@arrow-js/core'

export const FeedCard = component((props: {
  message: string
  time: string
  type: string
}) =>
  html`<article class="${() => `feed-card feed-card--${props.type}`}">
    <span class="feed-card__icon"></span>
    <span class="feed-card__message">${() => props.message}</span>
    <time class="feed-card__time">${() => props.time}</time>
  </article>`
)
