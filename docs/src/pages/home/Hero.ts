import { html } from '@arrow-js/core'
import { CliCommandIsland } from '../../components/CliCommand'
import { ChatMock } from './ChatMock'

export function HeroChat() {
  return ChatMock()
}

export function Hero() {
  return html`
    <section
      id="hero"
      class="relative flex flex-col items-center justify-center pt-28 pb-20 lg:pt-32 lg:pb-24 min-h-[80vh] overflow-x-clip"
    >
      <div class="hero-grid absolute inset-0 pointer-events-none"></div>
      <div
        class="absolute inset-x-0 bottom-0 h-64 pointer-events-none bg-gradient-to-t from-white dark:from-zinc-950 to-transparent"
      ></div>
      <div class="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          class="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-arrow-500/3 dark:bg-arrow-500/4 rounded-full blur-[120px]"
        ></div>
      </div>

      <div
        class="relative w-full max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-10 lg:gap-10 items-stretch"
      >
        <div class="max-w-xl lg:max-w-xl flex flex-col justify-center">
          <h1
            data-rain-collider="text"
            class="text-4xl sm:text-5xl xl:text-[5rem] text-balance font-extrabold tracking-tighter leading-[1.08] text-zinc-900 dark:text-white"
          >
            The first UI framework for the
            <span
              class="text-transparent bg-clip-text bg-gradient-to-r from-arrow-400 via-arrow-500 to-arrow-600"
            >
              agentic era&nbsp;
            </span>
          </h1>

          <p
            class="mt-6 text-base text-pretty sm:text-[1.0625rem] text-zinc-600 dark:text-zinc-400 leading-relaxed"
          >
            A tiny, blazing-fast, zero dependency, type-safe framework with no
            build step required. <br /><br />
            ArrowJS ships with the ability to isolate component logic inside Web
            Assembly
            <a
              href="#sandbox"
              class="text-arrow-600 dark:text-arrow-400 underline decoration-2 underline-offset-2"
              >sandboxes</a
            >
            while rendering full inline DOM directly in your app — no iframes,
            no pre-defined UI components.<br /><br />
            Ship safe, flexible, on-demand UIs for your users without having to
            plan components in advance.
          </p>

          <div class="mt-8">${CliCommandIsland()}</div>
        </div>

        <div
          class="relative w-full flex flex-col lg:translate-x-6 xl:translate-x-10"
        >
          <div id="hero-chat-root" class="flex flex-col flex-1">
            ${HeroChat()}
          </div>
        </div>
      </div>
    </section>
  `
}
