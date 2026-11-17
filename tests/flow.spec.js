// Screens, wording, order of requests, the A/B difference, and reloads.
const { test, expect } = require('@playwright/test');
const { RESEARCH, WORDING, setup, session, waitForStep, runToEnd, openForm, asks } = require('./helpers');

const ORDER = ['location', 'camera', 'microphone'];

test('Welcome shows the approved sentence and nothing meant for researchers', async ({ page }) => {
  const { log } = await setup(page, { version: 'A' });
  await expect(page.locator('#s-welcome')).toHaveClass(/active/);
  await expect(page.locator('#welcome-text')).toHaveText(WORDING.welcome);
  await expect(page.locator('#btn-start')).toHaveText('Start');
  await expect(page).toHaveTitle('StudySpot');
  expect(await page.locator('a').count()).toBe(0);
  expect(await page.locator('input, textarea, select').count()).toBe(0);
  await expect(page.locator('#preview-notes')).toBeEmpty();
  expect(await page.content()).not.toMatch(/Nearlo|decode\.html|Researcher|participant code/i);
  expect(asks(log)).toEqual([]);                           // nothing is requested before Start
});

test('Version B: each screen shows its sentence and asks after Continue, in the approved order', async ({ page }) => {
  const { log } = await setup(page, { version: 'B' });
  await page.locator('#btn-start').click();
  for (let k = 0; k < 3; k++) {
    await waitForStep(page, k + 1);
    await expect(page.locator('#pre-reason')).toHaveText(WORDING.reasons[ORDER[k]]);
    await expect(page.locator('#btn-pre-continue')).toBeVisible();
    await expect(page.locator('#btn-pre-continue')).toHaveText('Continue');
    expect(asks(log)).toEqual(ORDER.slice(0, k).map((p) => 'ask:' + p));     // not asked before the tap
    await page.locator('#btn-pre-continue').click();
    await waitForStep(page, k + 2);
  }
  expect(asks(log)).toEqual(['ask:location', 'ask:camera', 'ask:microphone']); // once each, in order
  await expect(page.locator('#s-thanks')).toHaveClass(/active/);
  await expect(page.locator('#thanks-text')).toHaveText(WORDING.thanks);
  await expect(page.locator('#btn-continue')).toHaveText('Continue');
});

test('Version A: no sentence, and each prompt fires as soon as its screen appears', async ({ page }) => {
  const slow = { delayMs: 600 };
  const { log } = await setup(page, { version: 'A', behavior: { location: slow, camera: slow, microphone: slow } });
  await page.locator('#btn-start').click();
  for (let k = 0; k < 3; k++) {
    await waitForStep(page, k + 1);
    await expect.poll(() => asks(log).length).toBe(k + 1);                     // asked without a tap
    await expect(page.locator('#s-pre')).toHaveClass(/active/);
    await expect(page.locator('#pre-reason')).toHaveText('');
    await expect(page.locator('#btn-pre-continue')).toBeHidden();
    await waitForStep(page, k + 2);
  }
  expect(asks(log)).toEqual(['ask:location', 'ask:camera', 'ask:microphone']);
  await expect(page.locator('#thanks-text')).toHaveText(WORDING.thanks);
});

test('with autoPromptVersionA off, Version A also waits for one Continue tap per screen', async ({ page }) => {
  const { log } = await setup(page, { version: 'A', config: { ...RESEARCH, autoPromptVersionA: false } });
  await page.locator('#btn-start').click();
  for (let k = 0; k < 3; k++) {
    await waitForStep(page, k + 1);
    await expect(page.locator('#btn-pre-continue')).toBeVisible();
    await expect(page.locator('#pre-reason')).toHaveText('');
    await page.waitForTimeout(400);
    expect(asks(log).length).toBe(k);                                          // still waiting for the tap
    await page.locator('#btn-pre-continue').click();
    await waitForStep(page, k + 2);
  }
  expect(asks(log)).toEqual(['ask:location', 'ask:camera', 'ask:microphone']);
});

// Everything on screen, with the reason sentence blanked out, plus where things sit.
async function snapshot(page) {
  return page.evaluate(() => {
    const box = (sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(Math.round); };
    const clone = document.getElementById('phone').cloneNode(true);
    const reason = clone.querySelector('#pre-reason');
    const sentence = reason.textContent;
    reason.textContent = '';
    return {
      html: clone.innerHTML,
      sentence,
      active: document.querySelector('.screen.active').id,
      boxes: { appbar: box('#s-pre .appbar'), reason: box('#pre-reason'), action: box('#s-pre .action'), button: box('#btn-pre-continue'), waiting: box('#pre-waiting') }
    };
  });
}

for (const auto of [true, false]) {
  test('Version A and Version B differ only in the reason sentence (' + (auto ? 'approved timing' : 'tap on every screen') + ')', async ({ context }) => {
    const config = { ...RESEARCH, autoPromptVersionA: auto };
    const slow = { delayMs: 900 };
    const behavior = { location: slow, camera: slow, microphone: slow };
    const a = await context.newPage();
    const b = await context.newPage();
    await setup(a, { version: 'A', config, behavior });
    await setup(b, { version: 'B', config, behavior });

    const same = async (label, opts = {}) => {
      const sa = await snapshot(a);
      const sb = await snapshot(b);
      expect(sa.active, label).toBe(sb.active);
      expect(sa.html, label).toBe(sb.html);
      expect(sa.boxes, label).toEqual(sb.boxes);
      if (opts.reason) { expect(sa.sentence, label).toBe(''); expect(sb.sentence, label).toBe(opts.reason); }
    };

    await same('welcome');
    await a.locator('#btn-start').click();
    await b.locator('#btn-start').click();
    for (let k = 0; k < 3; k++) {
      await waitForStep(a, k + 1);
      await waitForStep(b, k + 1);
      await expect(b.locator('#pre-reason')).toHaveText(WORDING.reasons[ORDER[k]]);
      if (auto) {
        // Approved timing: A is already waiting on its prompt; B reaches the same state after Continue.
        await expect(a.locator('#btn-pre-continue')).toBeHidden();
        await b.locator('#btn-pre-continue').click();
        await same('waiting on ' + ORDER[k], { reason: WORDING.reasons[ORDER[k]] });
      } else {
        await expect(a.locator('#btn-pre-continue')).toBeVisible();
        await same('before the tap on ' + ORDER[k], { reason: WORDING.reasons[ORDER[k]] });
        await a.locator('#btn-pre-continue').click();
        await b.locator('#btn-pre-continue').click();
        await same('waiting on ' + ORDER[k], { reason: WORDING.reasons[ORDER[k]] });
      }
      await waitForStep(a, k + 2);
      await waitForStep(b, k + 2);
    }
    await expect(a.locator('#s-thanks')).toHaveClass(/active/);
    await expect(b.locator('#s-thanks')).toHaveClass(/active/);
    await same('last screen');
  });
}

test('a reload keeps the version and never asks an answered permission again', async ({ page }) => {
  const { log } = await setup(page, { version: 'B' });
  await page.reload();                                                         // on Welcome
  expect((await session(page)).version).toBe('B');
  await expect(page.locator('#s-welcome')).toHaveClass(/active/);

  await page.locator('#btn-start').click();
  await waitForStep(page, 1);
  await page.locator('#btn-pre-continue').click();                             // location answered
  await waitForStep(page, 2);
  await page.reload();                                                         // on the camera screen
  await expect(page.locator('#s-pre')).toHaveClass(/active/);
  await expect(page.locator('#pre-reason')).toHaveText(WORDING.reasons.camera);
  let s = await session(page);
  expect(s.version).toBe('B');
  expect(s.step).toBe(2);
  expect(s.outcomes).toEqual({ location: 'A' });
  await page.waitForTimeout(400);
  expect(asks(log)).toEqual(['ask:location']);                                 // the reload asked nothing

  await runToEnd(page);
  await page.reload();                                                         // on the last screen
  await expect(page.locator('#s-thanks')).toHaveClass(/active/);
  await page.waitForTimeout(400);
  expect(asks(log)).toEqual(['ask:location', 'ask:camera', 'ask:microphone']);
  s = await session(page);
  expect(s.version).toBe('B');
  const form = await openForm(page);
  expect(form.appCode).toBe('SS1-B-AAA');
});

test('Version A resumes after a reload without repeating finished prompts', async ({ page }) => {
  const { log } = await setup(page, { version: 'A', behavior: { camera: { delayMs: 1500 } } });
  await page.locator('#btn-start').click();
  await waitForStep(page, 2);                                                  // location done, camera prompt open
  await expect.poll(() => asks(log).length).toBe(2);
  await page.reload();                                                         // prompt was never answered
  await expect(page.locator('#btn-pre-continue')).toBeVisible();               // a page load never fires a prompt by itself
  await expect(page.locator('#pre-reason')).toHaveText('');
  await page.waitForTimeout(400);
  expect(asks(log).length).toBe(2);
  await page.locator('#btn-pre-continue').click();                             // camera again, then microphone on its own
  await waitForStep(page, 4);
  expect(asks(log)).toEqual(['ask:location', 'ask:camera', 'ask:camera', 'ask:microphone']);
  expect((await session(page)).outcomes).toEqual({ location: 'A', camera: 'A', microphone: 'A' });
});

test('an answer given just before a reload is kept, not asked again', async ({ page }) => {
  const { log, state } = await setup(page, { version: 'A', behavior: { camera: { result: 'never' } } });
  await page.locator('#btn-start').click();
  await waitForStep(page, 2);
  await expect.poll(() => asks(log).length).toBe(2);                           // camera prompt is open
  expect((await session(page)).asking).toBe(true);
  state.camera = 'denied';                                                     // the person taps Don't Allow as the page reloads
  await page.reload();
  await waitForStep(page, 4);
  expect(asks(log)).toEqual(['ask:location', 'ask:camera', 'ask:microphone']); // camera was not asked twice
  expect((await session(page)).outcomes).toEqual({ location: 'A', camera: 'D', microphone: 'A' });
});
