// The three outcome codes, immediate track stopping, and never reading the position.
const { test, expect } = require('@playwright/test');
const { RESEARCH, setup, runToEnd, openForm, asks, session } = require('./helpers');

const LABEL = { A: 'Allow', D: "Don't Allow", N: 'Prompt not shown' };
const each = (v) => ({ location: { ...v }, camera: { ...v }, microphone: { ...v } });

// code: outcome letters for location, camera, microphone.
const CASES = [
  { name: 'allowed at every prompt', behavior: {}, code: 'AAA' },
  { name: 'refused at every prompt', behavior: each({ result: 'deny' }), code: 'DDD' },
  { name: 'every prompt closed without an answer', behavior: each({ result: 'dismiss' }), code: 'DDD' },
  { name: 'refused instantly, so the browser never asked (for example location is off for the browser)', behavior: each({ result: 'deny', delayMs: 0 }), code: 'NNN' },
  { name: 'allowed instantly, so a browser setting answered and nobody was asked', behavior: each({ delayMs: 0 }), code: 'NNN' },
  { name: 'the browser already remembers Allow', behavior: each({ prior: 'granted' }), code: 'NNN', noAsks: true },
  { name: 'the browser already remembers Block', behavior: each({ prior: 'denied' }), code: 'NNN', noAsks: true },
  { name: 'location and media features are missing', behavior: { location: { api: 'missing' }, mediaApi: 'missing' }, code: 'NNN', noAsks: true },
  { name: 'no camera and no microphone on the device', behavior: { camera: { result: 'nodevice' }, microphone: { result: 'nodevice' } }, code: 'ANN' },
  { name: 'allowed, but no position fix and the devices are busy', behavior: { location: { result: 'unavailable' }, camera: { result: 'busy' }, microphone: { result: 'busy' } }, code: 'AAA' },
  { name: 'an unexpected camera error', behavior: { camera: { result: 'weird' } }, code: 'ANA' },
  { name: 'location allowed, then timed out waiting for a fix', behavior: { location: { result: 'timeout', after: 'granted' } }, code: 'AAA' },
  { name: 'location prompt left unanswered until it timed out', behavior: { location: { result: 'timeout' } }, code: 'DAA' },
  { name: 'no Permissions API: asks anyway and codes the answers', behavior: { permissionsApi: false, camera: { result: 'deny' } }, code: 'ADA' },
  { name: 'no Permissions API: an instant refusal is still Prompt not shown', behavior: { permissionsApi: false, location: { result: 'deny', delayMs: 0 } }, code: 'NAA' },
  { name: 'Permissions API does not cover camera or microphone', behavior: { camera: { prior: 'unsupported' }, microphone: { prior: 'unsupported', result: 'deny' } }, code: 'AAD' },
  { name: 'one of each', behavior: { camera: { result: 'deny' }, microphone: { prior: 'denied' } }, code: 'ADN' }
];

for (const version of ['A', 'B']) {
  for (const c of CASES) {
    test('Version ' + version + ': ' + c.name + ' -> ' + c.code, async ({ page }) => {
      const { log } = await setup(page, { version, behavior: c.behavior });
      await runToEnd(page);
      if (c.noAsks) expect(asks(log)).toEqual([]);
      const letters = c.code.split('');
      expect((await session(page)).outcomes).toEqual({ location: letters[0], camera: letters[1], microphone: letters[2] });
      const form = await openForm(page);
      expect(form.version).toBe(version);
      expect(form.location).toBe(LABEL[letters[0]]);
      expect(form.camera).toBe(LABEL[letters[1]]);
      expect(form.microphone).toBe(LABEL[letters[2]]);
      expect(form.appCode).toBe('SS1-' + version + '-' + c.code);
    });
  }
}

test('tracks are stopped the moment they arrive, one kind per request, and the position is never read', async ({ page }) => {
  const { log } = await setup(page, { version: 'A' });
  await runToEnd(page);
  const at = (e) => log.indexOf(e);
  expect(log.filter((e) => e.indexOf('position-read') === 0)).toEqual([]);
  expect(at('stop:camera')).toBe(at('stream:camera') + 1);                    // nothing happens in between
  expect(at('stop:microphone')).toBe(at('stream:microphone') + 1);
  expect(at('stop:camera')).toBeLessThan(at('ask:microphone'));
  expect(log.filter((e) => e.indexOf('constraints:') === 0)).toEqual([
    'constraints:{"video":true,"audio":false}',
    'constraints:{"audio":true,"video":false}'
  ]);
  expect(log.filter((e) => e.indexOf('stop:') === 0).length).toBe(2);
});

test("with Chromium's own fake camera and microphone, every real track has ended", async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', "uses Chromium's built-in fake devices");
  await page.addInitScript(() => {
    if (!navigator.mediaDevices) return;
    window.__streams = [];
    const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = (c) => real(c).then((s) => { window.__streams.push(s); return s; });
  });
  // Chromium's fake prompt answers instantly, which the page would rightly code as
  // "Prompt not shown", so the instant-answer rule is switched off for this one test.
  await setup(page, { version: 'A', fakes: false, config: { ...RESEARCH, instantAnswerMs: 0 } });
  await runToEnd(page);
  const tracks = await page.evaluate(() => window.__streams.map((s) => s.getTracks().map((t) => t.kind + ':' + t.readyState)));
  expect(tracks).toEqual([['video:ended'], ['audio:ended']]);
  const s = await session(page);
  expect(s.outcomes.camera).toBe('A');
  expect(s.outcomes.microphone).toBe('A');
  expect(['D', 'N']).toContain(s.outcomes.location);                           // headless Chromium cannot show a location prompt
});
