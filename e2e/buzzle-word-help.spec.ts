import { expect, test } from './fixtures';

test('Word Help shows legal words only and preserves a pending play', async ({ page }) => {
  let lookups = 0;
  await page.route('https://en.wiktionary.org/api/rest_v1/page/definition/**', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'api-user-agent' } });
    lookups++;
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ en: [{ language: 'English', partOfSpeech: 'preposition', definitions: [{ definition: 'At a particular place. Test fixture.' }] }] }) });
  });
  await page.goto('/buzzle');
  await page.getByRole('button', { name: /Pass & Play/ }).click();
  const board = page.getByRole('grid', { name: /BUZZLE board/ });
  const rack = page.getByRole('list', { name: 'Player 1 tiles' });
  await rack.locator('[role="listitem"]:not([aria-label^="Blank"])').first().click();
  await board.getByRole('gridcell', { name: /q 0, r 0:/ }).click();
  const draft = await board.locator('[data-draft="true"]').getAttribute('aria-label');
  const trigger = page.getByRole('button', { name: 'Two-letter words', exact: true });
  await trigger.click();
  const help = page.getByRole('dialog', { name: 'BUZZLE Word Help' });
  await expect(help.getByRole('button', { name: /^Define / })).toHaveCount(128);
  await help.getByLabel('Filter by letter').fill('at');
  await expect(help.getByRole('button', { name: /^Define / })).toHaveCount(1);
  await help.getByRole('button', { name: 'Define AT', exact: true }).click();
  await expect(help.getByText('At a particular place. Test fixture.')).toBeVisible();
  await help.getByLabel('Look up a legal word').fill('zzzzzz');
  await help.getByRole('button', { name: 'Look up', exact: true }).click();
  await expect(help.getByText('Not accepted in BUZZLE.')).toBeVisible();
  expect(lookups).toBe(1);
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await expect(board.locator('[data-draft="true"]')).toHaveAttribute('aria-label', draft!);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('Help Mode previews legal placements without changing the draft and clears on handoff', async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 0.5; });
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/buzzle');
  await page.getByRole('button', { name: /Pass & Play/ }).click();
  const board = page.getByRole('grid', { name: /BUZZLE board/ });
  await page.getByRole('button', { name: 'Help Mode: off' }).click();
  const help = page.getByRole('region', { name: 'Possible two-letter plays' });
  await help.getByRole('button', { name: /^Preview / }).first().click();
  await expect(board.locator('[data-hint="true"]')).toHaveCount(2);
  await expect(board.locator('[data-preview-marker="1"] .buzzle-preview-marker')).toHaveText('1');
  await expect(board.locator('[data-preview-marker="2"] .buzzle-preview-marker')).toHaveText('2');
  await expect(board.locator('[data-draft="true"]')).toHaveCount(0);
  await expect(help.getByLabel('Placement preview')).toContainText('Preview only');
  await help.getByRole('button', { name: 'Next placement' }).click();
  await expect(board.locator('[data-draft="true"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Help Mode: on' }).click();
  await expect(board.locator('[data-hint="true"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Help Mode: off' }).click();
  await help.getByRole('button', { name: /^Preview / }).first().click();
  await page.getByRole('button', { name: 'Pass', exact: true }).click();
  await expect(page.getByRole('dialog', { name: /Pass to/ })).toBeVisible();
  await expect(page.locator('.buzzle-help-suggestions')).toHaveCount(0);
  await expect(board.locator('[data-hint="true"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Reveal my rack' }).click();
  await expect(help).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('a suggested word can be played and inspected on the board', async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 0.5; });
  await page.goto('/buzzle');
  await page.getByRole('button', { name: /Pass & Play/ }).click();
  await page.getByRole('button', { name: 'Help Mode: off' }).click();
  const hints = page.getByRole('region', { name: 'Possible two-letter plays' });
  await hints.getByRole('button', { name: /^Preview / }).first().click();
  const preview = hints.getByLabel('Placement preview');
  const word = (await preview.locator('p').first().innerText()).split(' · ')[0];
  const steps = [...(await preview.locator('ol').innerText()).matchAll(/Place (a blank as )?([A-Z]) on (\d+)/g)];
  expect(steps).toHaveLength(2);
  const board = page.getByRole('grid', { name: /BUZZLE board/ });
  const firstCellIndex = await board.getByRole('gridcell').evaluateAll(cells => cells.findIndex(cell => cell.getAttribute('data-preview-marker') === '1'));
  const rack = page.getByRole('list', { name: 'Player 1 tiles' });
  for (const [, blank, letter, marker] of steps) {
    await rack.locator(`[role="listitem"]:not([disabled])[aria-label^="${blank ? 'Blank' : letter},"]`).first().click();
    await expect(board.locator(`[data-preview-marker="${marker}"] .buzzle-preview-marker`)).toHaveText(marker);
    await board.locator(`[data-preview-marker="${marker}"]`).click();
    if (blank) await page.getByRole('dialog', { name: 'Choose the blank tile letter' }).getByRole('button', { name: letter, exact: true }).click();
    await expect(preview).toContainText(`${letter} already placed`);
  }
  await expect(board.locator('[data-preview-marker]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Submit', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await page.getByRole('button', { name: 'Reveal my rack' }).click();
  await board.getByRole('gridcell').nth(firstCellIndex).click();
  const help = page.getByRole('dialog', { name: 'BUZZLE Word Help' });
  await expect(help.getByRole('button', { name: word, exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(board.getByRole('gridcell').nth(firstCellIndex)).toBeFocused();
});
