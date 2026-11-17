// Shared test helpers: a research-mode configuration with a stand-in form, and fake
// location, camera, microphone, and Permissions APIs that record everything the page does.
const fs = require('fs');
const path = require('path');
const { expect } = require('@playwright/test');

const ROOT = path.join(__dirname, '..');
const SESSION_KEY = 'studyspot_session';

const FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSfTESTtestTESTtestTESTtestTESTtestTESTtestTEST/viewform';
const ENTRIES = {
  version: 'entry.1000001',
  location: 'entry.1000002',
  camera: 'entry.1000003',
  microphone: 'entry.1000004',
  appCode: 'entry.1000005'
};
// Research mode with the form filled in. An answer faster than 150 ms counts as instant.
const RESEARCH = { mode: 'research', formUrl: FORM_URL, formEntries: ENTRIES, instantAnswerMs: 150 };
const PREVIEW = { mode: 'preview', instantAnswerMs: 150 };

const WORDING = {
  welcome: 'Welcome to StudySpot, a sample study-helper app. Tap Start to try it.',
  reasons: {
    location: 'StudySpot uses your location to show study spots near you.',
    camera: 'StudySpot uses your camera to scan your notes.',
    microphone: 'StudySpot uses your microphone to record voice notes.'
  },
  thanks: 'Thanks for trying StudySpot! Tap Continue for a short survey.'
};

/* Runs inside the page before any of its scripts. `b` describes how the fake browser behaves:
     b.permissionsApi   false removes navigator.permissions
     b.mediaApi         'missing' removes navigator.mediaDevices
     b.location / b.camera / b.microphone:
       prior    'prompt' (default) | 'granted' | 'denied' | 'unsupported' (permissions.query rejects)
       api      'missing' removes the feature (location only)
       result   'grant' (default) | 'deny' | 'dismiss' | 'never'
                location also: 'unavailable' (code 2) | 'timeout' (code 3)
                camera and microphone also: 'nodevice' | 'busy' | 'weird'
       delayMs  how long the fake person takes to answer (default 300)
       after    state the browser remembers after a 'timeout' result */
function installFakes(b) {
  const rec = (e) => { window.__rec(e); };
  const kinds = { geolocation: b.location || {}, camera: b.camera || {}, microphone: b.microphone || {} };
  const delayOf = (k) => (typeof k.delayMs === 'number' ? k.delayMs : 300);
  const define = (name, value) => Object.defineProperty(navigator, name, { value, configurable: true });

  if (b.permissionsApi === false) {
    define('permissions', undefined);
  } else {
    define('permissions', {
      query: async (d) => {
        const k = kinds[d && d.name];
        if (!k || k.prior === 'unsupported') throw new TypeError('not supported');
        rec('query:' + d.name);
        return { state: await window.__getState(d.name) };
      }
    });
  }

  const g = kinds.geolocation;
  if (g.api === 'missing') {
    define('geolocation', undefined);
  } else {
    define('geolocation', {
      getCurrentPosition: (ok, fail) => {
        rec('ask:location');
        if (g.result === 'never') return;
        setTimeout(async () => {
          if (g.result === 'deny') { await window.__setState('geolocation', 'denied'); fail({ code: 1 }); }
          else if (g.result === 'dismiss') { fail({ code: 1 }); }
          else if (g.result === 'unavailable') { await window.__setState('geolocation', 'granted'); fail({ code: 2 }); }
          else if (g.result === 'timeout') { if (g.after) await window.__setState('geolocation', g.after); fail({ code: 3 }); }
          else {
            await window.__setState('geolocation', 'granted');
            // Any attempt to read anything from the position is recorded.
            ok(new Proxy({}, { get: (t, prop) => { rec('position-read:' + String(prop)); return undefined; } }));
          }
        }, delayOf(g));
      }
    });
  }

  if (b.mediaApi === 'missing') {
    define('mediaDevices', undefined);
  } else {
    define('mediaDevices', {
      getUserMedia: (c) => {
        const kind = c && c.video ? 'camera' : 'microphone';
        rec('ask:' + kind);
        rec('constraints:' + JSON.stringify(c));
        const k = kinds[kind];
        const fail = (name) => { const e = new Error(name); e.name = name; return e; };
        return new Promise((resolve, reject) => {
          if (k.result === 'never') return;
          setTimeout(async () => {
            if (k.result === 'deny') { await window.__setState(kind, 'denied'); reject(fail('NotAllowedError')); }
            else if (k.result === 'dismiss') { reject(fail('NotAllowedError')); }
            else if (k.result === 'nodevice') { reject(fail('NotFoundError')); }
            else if (k.result === 'busy') { await window.__setState(kind, 'granted'); reject(fail('NotReadableError')); }
            else if (k.result === 'weird') { reject(fail('TypeError')); }
            else {
              await window.__setState(kind, 'granted');
              const track = {
                kind: kind === 'camera' ? 'video' : 'audio',
                readyState: 'live',
                stop() { this.readyState = 'ended'; rec('stop:' + kind); }
              };
              rec('stream:' + kind);
              resolve({ getTracks: () => [track], getVideoTracks: () => (track.kind === 'video' ? [track] : []), getAudioTracks: () => (track.kind === 'audio' ? [track] : []) });
            }
          }, delayOf(k));
        });
      }
    });
  }
}

/* Opens the page with the given configuration and fake browser.
   options: config (merged over config.js), behavior (see installFakes), fakes (false to keep
   the browser's real APIs), version ('A' or 'B' to start a session with that version),
   query (for example '?pilot=1'). */
async function setup(page, options = {}) {
  const config = options.config || RESEARCH;
  const behavior = options.behavior || {};
  const log = [];
  const requests = [];
  const state = {
    geolocation: (behavior.location && behavior.location.prior) || 'prompt',
    camera: (behavior.camera && behavior.camera.prior) || 'prompt',
    microphone: (behavior.microphone && behavior.microphone.prior) || 'prompt'
  };

  page.on('request', (r) => requests.push({ url: r.url(), type: r.resourceType(), navigation: r.isNavigationRequest() }));
  await page.exposeFunction('__rec', (e) => { log.push(e); });
  await page.exposeFunction('__getState', (name) => state[name]);
  await page.exposeFunction('__setState', (name, value) => { state[name] = value; });

  await page.route('**/config.js', async (route) => {
    const body = fs.readFileSync(path.join(ROOT, 'config.js'), 'utf8') +
      '\n;Object.assign(window.STUDY_CONFIG, ' + JSON.stringify(config) + ');';
    await route.fulfill({ contentType: 'text/javascript; charset=utf-8', body });
  });
  // The stand-in for the Google Form. Nothing reaches Google during the tests.
  await page.route('https://docs.google.com/**', (route) =>
    route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><title>Form stand-in</title><p id="stub">form</p>' }));

  if (options.fakes !== false) await page.addInitScript(installFakes, behavior);
  if (options.version) {
    await page.addInitScript(([key, version]) => {
      if (location.hostname !== '127.0.0.1') return;
      if (!sessionStorage.getItem(key)) sessionStorage.setItem(key, JSON.stringify({ version, step: 0, asking: false, outcomes: {} }));
    }, [SESSION_KEY, options.version]);
  }

  await page.goto('/index.html' + (options.query || ''));
  return { log, requests, state };
}

async function session(page) {
  return page.evaluate((key) => JSON.parse(sessionStorage.getItem(key) || 'null'), SESSION_KEY);
}

async function waitForStep(page, step) {
  await expect.poll(async () => { const s = await session(page); return s ? s.step : -1; }, { timeout: 15000 }).toBe(step);
}

// Taps Start, then goes through the three permission screens, tapping Continue where the
// screen waits for it (Version B always; Version A only when autoPromptVersionA is false).
async function runToEnd(page, { auto = true } = {}) {
  const s = await session(page);
  const needsTap = s.version === 'B' || !auto;
  if (s.step === 0) await page.locator('#btn-start').click();
  if (!needsTap) {
    await waitForStep(page, 4);          // the screens advance on their own
  } else {
    for (let k = Math.max(1, s.step); k <= 3; k++) {
      await waitForStep(page, k);
      await expect(page.locator('#s-pre')).toHaveClass(/active/);
      await page.locator('#btn-pre-continue').click();
      await waitForStep(page, k + 1);
    }
  }
  await expect(page.locator('#s-thanks')).toHaveClass(/active/);
}

// Taps the last Continue and returns what the form link carried.
async function openForm(page) {
  await page.locator('#btn-continue').click();
  await page.waitForURL(/^https:\/\/docs\.google\.com\//);
  const url = new URL(page.url());
  return {
    url,
    base: url.origin + url.pathname,
    version: url.searchParams.get(ENTRIES.version),
    location: url.searchParams.get(ENTRIES.location),
    camera: url.searchParams.get(ENTRIES.camera),
    microphone: url.searchParams.get(ENTRIES.microphone),
    appCode: url.searchParams.get(ENTRIES.appCode),
    params: Array.from(url.searchParams.keys())
  };
}

const asks = (log) => log.filter((e) => e.indexOf('ask:') === 0);

module.exports = { ROOT, SESSION_KEY, FORM_URL, ENTRIES, RESEARCH, PREVIEW, WORDING, setup, session, waitForStep, runToEnd, openForm, asks };
