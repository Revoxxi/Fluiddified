import { test, expect } from '@playwright/test'

test.describe('app shell', () => {
  test('loads document and mounts Vue root', async ({ page }) => {
    const response = await page.goto('/')
    expect(response?.ok()).toBeTruthy()

    await expect(page.locator('#app')).toBeVisible({ timeout: 90_000 })
    await expect(page).toHaveTitle(/Fluiddified/i)
  })

  test('uses hash router (login or home)', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('#app')).toBeVisible({ timeout: 90_000 })

    const hash = await page.evaluate(() => window.location.hash)
    expect(hash === '' || hash.startsWith('#/')).toBeTruthy()
  })
})
