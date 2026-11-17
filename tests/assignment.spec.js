// Random 1:1 assignment, and the decoder.
const { test, expect } = require('@playwright/test');
const { PREVIEW, setup, session } = require('./helpers');

async function freshVersion(page) {
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
  return (await session(page)).version;
}

test('versions are assigned about 1:1, from the crypto source and not Math.random', async ({ page }) => {
  test.setTimeout(240000);
  await page.addInitScript(() => { Math.random = () => 0; });                  // would force one version if it were used
  await setup(page);
  const counts = { A: 0, B: 0 };
  counts[(await session(page)).version] += 1;
  for (let i = 1; i < 200; i++) counts[await freshVersion(page)] += 1;
  expect(counts.A + counts.B).toBe(200);
  // 200 fair coin flips land between 70 and 130 heads all but about 3 times in 100,000.
  expect(counts.A).toBeGreaterThanOrEqual(70);
  expect(counts.A).toBeLessThanOrEqual(130);
});

test('a reload does not reassign the version', async ({ page }) => {
  await setup(page);
  const first = (await session(page)).version;
  for (let i = 0; i < 8; i++) {
    await page.reload();
    expect((await session(page)).version).toBe(first);
  }
});

test('research mode ignores ?c=A and ?c=B', async ({ page }) => {
  await setup(page, { query: '?c=B' });
  const seen = new Set([(await session(page)).version]);
  for (let i = 0; i < 40 && seen.size < 2; i++) seen.add(await freshVersion(page));
  expect(seen.size).toBe(2);                                                   // forty B's in a row by chance: about 1 in a trillion
});

test('preview mode honors ?c=A', async ({ page }) => {
  await setup(page, { config: PREVIEW, query: '?c=A' });
  expect((await session(page)).version).toBe('A');
  for (let i = 0; i < 10; i++) expect(await freshVersion(page)).toBe('A');
});

test('the decoder reads app codes, sets pilot rows aside, and counts only prompts that were shown', async ({ page }) => {
  await page.goto('/decode.html');
  await page.locator('#in').fill(['SS1-A-AAA', 'SS1-A-ADN', '2026-12-01 09:14,B,Allow,Allow,Allow,SS1-B-AAA', 'PSS1-B-DDD', 'not a code'].join('\n'));
  await page.locator('#btn-decode').click();
  await expect(page.locator('#rows-table tbody tr')).toHaveCount(4);
  await expect(page.locator('#errors')).toContainText('No app code found on line 5');
  const rows = await page.locator('#rows-table tbody tr').evaluateAll((trs) => trs.map((tr) => Array.from(tr.children).map((td) => td.textContent)));
  expect(rows[1]).toEqual(['2', 'SS1-A-ADN', 'no', 'A', 'Allow', "Don't Allow", 'Prompt not shown']);
  expect(rows[3]).toEqual(['4', 'PSS1-B-DDD', 'yes', 'B', "Don't Allow", "Don't Allow", "Don't Allow"]);
  const summary = await page.locator('#summary-table tbody tr').evaluateAll((trs) => trs.map((tr) => Array.from(tr.children).map((td) => td.textContent)));
  // permission, version, prompts shown, Allow, Allow %, Prompt not shown
  expect(summary).toEqual([
    ['location', 'A', '2', '2', '100%', '0'],
    ['location', 'B', '1', '1', '100%', '0'],
    ['camera', 'A', '2', '1', '50%', '0'],
    ['camera', 'B', '1', '1', '100%', '0'],
    ['microphone', 'A', '1', '1', '100%', '1'],
    ['microphone', 'B', '1', '1', '100%', '0']
  ]);
  await expect(page.locator('#summary-table')).toContainText('3 code(s) counted, 1 pilot code(s) left out');
  expect(await page.content()).not.toMatch(/Nearlo|NRL1/);
});
