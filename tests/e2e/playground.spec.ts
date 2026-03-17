import { expect, test } from '@playwright/test'
import {
  playgroundExampleHref,
  playgroundExampleMeta,
  starterExampleId,
} from '../../docs/play/example-meta.js'

test('playground loads the starter multi-file example', async ({ page }) => {
  const messages: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      messages.push(msg.text())
    }
  })

  await page.goto(playgroundExampleHref(starterExampleId))

  await expect(page.locator('.play-file-name')).toHaveText([
    'main.ts',
    'App.ts',
    'CounterPanel.ts',
    'styles.css',
  ])

  const preview = page.frameLocator('#play-preview')

  await expect
    .poll(() => preview.locator('#runtime-error').getAttribute('data-active'))
    .toBe('false')
  await expect
    .poll(() =>
      preview
        .locator('#app')
        .evaluate((node) => (node.textContent || '').trim().length > 0)
    )
    .toBe(true)

  expect(messages).toEqual([])
})

test('playground loads every registered example by direct url', async ({ page }) => {
  const preview = page.frameLocator('#play-preview')

  expect(playgroundExampleMeta.length).toBeGreaterThan(6)

  for (const example of playgroundExampleMeta) {
    await page.goto(playgroundExampleHref(example.id))

    await expect(page.locator('.play-file-name')).not.toHaveCount(0)
    await expect
      .poll(() => preview.locator('#runtime-error').getAttribute('data-active'))
      .toBe('false')
    await expect
      .poll(() =>
        preview
          .locator('#app')
          .evaluate((node) => (node.textContent || '').trim().length > 0)
      )
      .toBe(true)
  }
})
