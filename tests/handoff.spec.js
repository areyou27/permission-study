// The Google Form handoff, what is stored, network use, and the preview and research modes.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { ROOT, FORM_URL, ENTRIES, RESEARCH, PREVIEW, setup, session, waitForStep, runToEnd, openForm, asks } = require('./helpers');

test('Continue opens the prefilled form in the same tab with exactly the approved values', async ({ page, context }) => {
  await setup(page, { version: 'B', behavior: { camera: { result: 'deny' }, microphone: { prior: 'denied' } } });
  await runToEnd(page);
  const form = await openForm(page);
  expect(form.base).toBe(FORM_URL);
  expect(form.params).toEqual(['usp', ENTRIES.version, ENTRIES.location, ENTRIES.camera, ENTRIES.microphone, ENTRIES.appCode]);
  expect(form.url.searchParams.get('usp')).toBe('pp_url');
  expect(form.version).toBe('B');
  expect(form.location).toBe('Allow');
  expect(form.camera).toBe("Don't Allow");
  expect(form.camera.charCodeAt(3)).toBe(0x27);                                // a straight apostrophe, not a curly one
  expect(form.microphone).toBe('Prompt not shown');
  expect(form.appCode).toBe('SS1-B-ADN');
  expect(context.pages().length).toBe(1);                                      // no new tab or window
  await expect(page.locator('#stub')).toHaveText('form');
});

test('the page makes no network request except loading itself and the final form navigation', async ({ page }) => {
  const { requests } = await setup(page, { version: 'A' });
  await runToEnd(page);
  const origin = new URL(page.url()).origin;
  const notFavicon = (r) => new URL(r.url).pathname !== '/favicon.ico';
  const before = requests.filter(notFavicon);
  expect(before.every((r) => r.url.indexOf(origin + '/') === 0)).toBe(true);
  expect(before.map((r) => new URL(r.url).pathname).sort()).toEqual(['/app.js', '/config.js', '/index.html', '/styles.css']);
  expect(before.filter((r) => ['fetch', 'xhr', 'websocket', 'eventsource', 'ping', 'beacon'].indexOf(r.type) >= 0)).toEqual([]);

  await openForm(page);
  const external = requests.filter(notFavicon).filter((r) => r.url.indexOf(origin + '/') !== 0);
  expect(external.length).toBe(1);
  expect(external[0].navigation).toBe(true);
  expect(external[0].url.indexOf(FORM_URL + '?')).toBe(0);
});

test('only the version, the step, and the three outcomes are stored', async ({ page, context }) => {
  await setup(page, { version: 'A', behavior: { camera: { result: 'deny' } } });
  await runToEnd(page);
  const stored = await page.evaluate(() => ({ session: Object.keys(sessionStorage), local: Object.keys(localStorage), cookie: document.cookie }));
  expect(stored).toEqual({ session: ['studyspot_session'], local: [], cookie: '' });
  expect(await context.cookies()).toEqual([]);
  const s = await session(page);
  expect(Object.keys(s).sort()).toEqual(['asking', 'outcomes', 'step', 'version']);
  expect(s).toEqual({ version: 'A', step: 4, asking: false, outcomes: { location: 'A', camera: 'D', microphone: 'A' } });
});

test('?pilot=1 puts a P in front of the app code and changes nothing else', async ({ page }) => {
  await setup(page, { version: 'A', query: '?pilot=1', behavior: { microphone: { result: 'deny' } } });
  await runToEnd(page);
  const form = await openForm(page);
  expect(form.appCode).toBe('PSS1-A-AAD');
  expect(form.version).toBe('A');
  expect(form.microphone).toBe("Don't Allow");
});

for (const c of [
  { name: 'the placeholders from config.js', config: { mode: 'research' } },
  { name: 'one entry ID still a placeholder', config: { ...RESEARCH, formEntries: { ...ENTRIES, appCode: 'entry.REPLACE_APP_CODE' } } },
  { name: 'a short forms.gle link', config: { ...RESEARCH, formUrl: 'https://forms.gle/abc123' } },
  { name: 'two answers pointing at the same entry', config: { ...RESEARCH, formEntries: { ...ENTRIES, camera: ENTRIES.location } } },
  { name: 'a misspelled mode with placeholders (treated as research)', config: { mode: 'reserach' } }
]) {
  test('research mode refuses to start with ' + c.name, async ({ page }) => {
    const { log } = await setup(page, { config: c.config });
    await expect(page.locator('#s-notready')).toHaveClass(/active/);
    await expect(page.locator('#s-notready h1')).toHaveText('This page is not ready yet');
    await expect(page.locator('#btn-start')).toBeHidden();
    await expect(page.locator('#notready-detail')).toBeEmpty();               // no setup details for participants
    expect(await session(page)).toBeNull();                                    // no version was assigned
    expect(asks(log)).toEqual([]);
  });
}

test('research mode ignores ?sim=1 and ?reset=1: the real prompts are used and the session stays', async ({ page }) => {
  const { log } = await setup(page, { version: 'B', query: '?sim=1&reset=1' });
  await runToEnd(page);
  await expect(page.locator('#dim')).toBeHidden();
  expect(asks(log)).toEqual(['ask:location', 'ask:camera', 'ask:microphone']);
  await page.reload();                                                         // ?reset=1 is still in the address
  expect((await session(page)).step).toBe(4);
  await expect(page.locator('#s-thanks')).toHaveClass(/active/);
});

test('preview mode: banner, forced version, simulated dialogs, and no form navigation before setup', async ({ page }) => {
  const { log } = await setup(page, { config: PREVIEW, query: '?c=B&sim=1' });
  await expect(page.locator('#preview-notes')).toContainText('Preview mode');
  await expect(page.locator('#preview-notes')).toContainText('Version B (forced by the link)');
  await expect(page.locator('#preview-notes')).toContainText('formUrl');
  expect((await session(page)).version).toBe('B');

  await page.locator('#btn-start').click();
  const taps = ['Don’t', 'Allow', 'Allow'];                                    // location refused, camera and microphone allowed
  for (let k = 0; k < 3; k++) {
    await waitForStep(page, k + 1);
    await page.locator('#btn-pre-continue').click();
    await expect(page.locator('#dim')).toBeVisible();
    await page.locator('#os-dialog button', { hasText: new RegExp('^' + taps[k]) }).click();
    await waitForStep(page, k + 2);
  }
  expect(asks(log)).toEqual([]);                                               // the browser was never asked
  await expect(page.locator('#s-thanks')).toHaveClass(/active/);
  const before = page.url();
  await page.locator('#btn-continue').click();
  await expect(page.locator('#preview-form')).toContainText('App code: SS1-B-DAA');
  await expect(page.locator('#preview-form')).toContainText("Location: Don't Allow");
  expect(page.url()).toBe(before);                                             // nothing opened
});

test('preview mode: ?reset=1 starts a fresh session, and Version A opens the simulated dialog without a tap', async ({ page }) => {
  await setup(page, { config: PREVIEW, query: '?c=A&sim=1' });
  await page.locator('#btn-start').click();
  await expect(page.locator('#dim')).toBeVisible();                            // fired as soon as the screen appeared
  await page.locator('#os-dialog button', { hasText: /^Allow/ }).click();
  await waitForStep(page, 2);
  await page.goto('/index.html?c=A&sim=1&reset=1');
  await expect(page.locator('#s-welcome')).toHaveClass(/active/);
  expect(await session(page)).toEqual({ version: 'A', step: 0, asking: false, outcomes: {} });
});

test('the files ship with no third-party code, no storage beyond the session, and no way to read a position', async () => {
  const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const config = fs.readFileSync(path.join(ROOT, 'config.js'), 'utf8');
  expect(app).not.toMatch(/\.coords|latitude|longitude/);
  expect(app).not.toMatch(/fetch\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|localStorage|document\.cookie|indexedDB/);
  expect(app).not.toMatch(/Math\.random/);
  expect(app).toMatch(/crypto\.getRandomValues/);
  expect(html.match(/<script[^>]*src="([^"]+)"/g)).toEqual(['<script src="config.js"', '<script src="app.js"']);
  expect(html).not.toMatch(/https?:\/\//);                                     // nothing loaded from another site
  expect(html).not.toMatch(/target=/);
  for (const text of [app, html, config]) expect(text).not.toMatch(/Nearlo|NRL1|nearlo_n/);
  expect(config).toMatch(/permissions: \["location", "camera", "microphone"\]/);
});
