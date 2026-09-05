import { expect, test } from "@playwright/test";

test("opens physical-play tools without starting a game and provides all three tools", async ({ page }) => {
  const definitionRequests: string[] = [];
  await page.route('https://en.wiktionary.org/api/rest_v1/page/definition/*', async (route) => {
    definitionRequests.push(route.request().url());
    await route.fulfill({ json: { en: [{ language: 'English', partOfSpeech: 'noun', definitions: [{ definition: 'An evergreen tree. (Test fixture)' }] }] } });
  });
  await page.goto('/buzzle');
  await page.getByRole('dialog', { name: 'Choose a BUZZLE game' }).getByRole('link', { name: /Physical play tools/ }).click();
  await page.getByRole('button', { name: 'Keep cookie-free' }).click();
  await expect(page).toHaveURL(/\/buzzle\/word-tools$/);
  await expect(page.getByRole('grid', { name: 'BUZZLE board' })).toHaveCount(0);
  await page.getByLabel('Word to check').fill(' Aa ');
  await page.getByRole('button', { name: 'Check word', exact: true }).click();
  await expect(page.getByText('AA — accepted in BUZZLE.')).toBeVisible();
  await page.getByLabel('Word to check').fill('zzzz');
  await page.getByRole('button', { name: 'Check word', exact: true }).click();
  await expect(page.getByText('ZZZZ — not accepted in BUZZLE.')).toBeVisible();
  await page.getByRole('button', { name: 'Two-letter words', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Define / })).toHaveCount(128);
  expect(definitionRequests).toHaveLength(0);
  await page.getByRole('button', { name: 'Dictionary', exact: true }).click();
  await page.getByLabel('Look up a legal word').fill('fir');
  await page.getByRole('button', { name: 'Look up', exact: true }).click();
  await expect(page.getByText('An evergreen tree. (Test fixture)')).toBeVisible();
  await page.getByLabel('Look up a legal word').fill('zzzz');
  await page.getByRole('button', { name: 'Look up', exact: true }).click();
  await expect(page.getByText('Not accepted in BUZZLE.')).toBeVisible();
  expect(definitionRequests).toHaveLength(1);
  await page.setViewportSize({ width: 320, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Two-letter words', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
