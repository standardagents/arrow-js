export interface WelcomeCardData {
  copy: string
  eyebrow: string
  snippet: string
}

export async function loadWelcomeCard(): Promise<WelcomeCardData> {
  await new Promise((resolve) => setTimeout(resolve, 12))

  return {
    eyebrow: 'SSR + Hydration',
    copy: 'This card resolved on the server, was serialized into the HTML payload, and hydrated on the client without repeating the async work.',
    snippet: `// entry-server.ts
const result = await renderToString(App())
// { html, payload } → sent to the browser

// entry-client.ts
await hydrate(root, App(), readPayload())
// DOM reused, no re-fetch needed`,
  }
}
