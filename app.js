/* StudySpot: participant flow.

   The page keeps exactly two things, in this tab's session storage: the assigned version
   (A or B) and, for each permission, one of three outcomes (Allow, Don't Allow,
   Prompt not shown). The last screen hands those to the Google Form as prefilled answers.

   It never reads the position, never keeps a camera or microphone track, loads no
   third-party code, and makes no network request of its own. */
(function () {
  'use strict';

  var CFG = window.STUDY_CONFIG || {};
  var W = CFG.wording || {};
  var qs = new URLSearchParams(location.search);
  var $ = function (id) { return document.getElementById(id); };
  var now = function () { return (window.performance && performance.now) ? performance.now() : Date.now(); };

  var PREVIEW = CFG.mode === 'preview';                 // anything else is research mode
  var SIMULATE = PREVIEW && qs.get('sim') === '1';      // simulated dialogs never run in research mode
  var PILOT = qs.get('pilot') === '1';
  var AUTO_A = CFG.autoPromptVersionA !== false;
  var INSTANT_MS = typeof CFG.instantAnswerMs === 'number' ? CFG.instantAnswerMs : 500;
  var SESSION_KEY = 'studyspot_session';
  var CODE_PREFIX = 'SS1';
  var REQUIRED = ['location', 'camera', 'microphone'];  // also the letter order in the app code
  var ALLOW = 'A', DENY = 'D', NOT_SHOWN = 'N';

  var ORDER = Array.isArray(CFG.permissions) ? CFG.permissions.slice() : [];
  var session = null;
  var busy = false;

  /* ---------- permissions ---------- */
  function mediaSupported() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia); }

  var PERMS = {
    location: {
      label: 'Location',
      queryName: 'geolocation',
      supported: function () { return !!(navigator.geolocation && navigator.geolocation.getCurrentPosition); },
      request: requestLocation,
      simText: 'use your current location'
    },
    camera: {
      label: 'Camera',
      queryName: 'camera',
      supported: mediaSupported,
      request: function () { return requestMedia('camera'); },
      simText: 'use your camera'
    },
    microphone: {
      label: 'Microphone',
      queryName: 'microphone',
      supported: mediaSupported,
      request: function () { return requestMedia('microphone'); },
      simText: 'use your microphone'
    }
  };

  /* ---------- helpers ---------- */
  function show(id) {
    var screens = document.querySelectorAll('.screen');
    for (var i = 0; i < screens.length; i++) screens[i].classList.remove('active');
    var el = $(id);
    el.classList.add('active');
    el.scrollTop = 0;
  }
  function text(el, s) { el.textContent = s; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function appName() { return CFG.appName || 'StudySpot'; }

  // What the browser already remembers for this site: 'granted', 'denied', 'prompt', or 'unknown'.
  function queryState(name) {
    if (!name || !navigator.permissions || !navigator.permissions.query) return Promise.resolve('unknown');
    try {
      return navigator.permissions.query({ name: name }).then(
        function (s) { return (s && s.state) || 'unknown'; },
        function () { return 'unknown'; }
      );
    } catch (e) { return Promise.resolve('unknown'); }
  }

  /* ---------- setup checks ---------- */
  function configProblems() {
    var p = [];
    var ok = ORDER.length === REQUIRED.length && REQUIRED.every(function (r) { return ORDER.indexOf(r) >= 0; });
    if (!ok) p.push('permissions must list location, camera, and microphone, once each');
    var reasons = W.reasons || {};
    if (!W.welcome || !W.start || !W.proceed || !W.thanks || !REQUIRED.every(function (r) { return !!reasons[r]; })) p.push('wording is incomplete');
    if (!(window.crypto && window.crypto.getRandomValues)) p.push('this browser cannot assign a version at random');
    return p;
  }

  // Research mode will not start while any of these remain.
  function formProblems() {
    var p = [];
    var url = String(CFG.formUrl || '');
    if (/REPLACE/.test(url) || !/^https:\/\/docs\.google\.com\/forms\/d\/(e\/)?[A-Za-z0-9_-]+\/viewform$/.test(url)) p.push('formUrl');
    var e = CFG.formEntries || {};
    var seen = {};
    ['version', 'location', 'camera', 'microphone', 'appCode'].forEach(function (k) {
      var v = String(e[k] || '');
      if (!/^entry\.\d+$/.test(v) || seen[v]) p.push('formEntries.' + k);
      seen[v] = true;
    });
    var L = CFG.labels || {};
    ['allow', 'deny', 'notShown'].forEach(function (k) { if (!L[k]) p.push('labels.' + k); });
    return p;
  }

  /* ---------- session: version, step, outcomes ---------- */
  // step 0 is Welcome, steps 1 to 3 are the permission screens, step 4 is the last screen.
  function loadSession() {
    try {
      var s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
      if (!s || (s.version !== 'A' && s.version !== 'B')) return null;
      if (typeof s.step !== 'number' || s.step < 0 || s.step > ORDER.length + 1) return null;
      if (!s.outcomes || typeof s.outcomes !== 'object') return null;
      return { version: s.version, step: s.step, asking: s.asking === true, outcomes: s.outcomes };
    } catch (e) { return null; }
  }
  function saveSession() {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch (e) { /* the run continues in memory */ }
  }
  function clearSession() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* nothing to clear */ }
  }

  function forcedVersion() {
    if (!PREVIEW) return '';                              // ?c=A / ?c=B only work in preview mode
    var c = (qs.get('c') || '').toUpperCase();
    return (c === 'A' || c === 'B') ? c : '';
  }

  // One random bit from the browser's cryptographic source: A or B with equal chance.
  function assignVersion() {
    var forced = forcedVersion();
    if (forced) return forced;
    var bit = new Uint8Array(1);
    window.crypto.getRandomValues(bit);
    return (bit[0] & 1) ? 'B' : 'A';
  }

  /* ---------- real permission requests ---------- */
  function requestLocation() {
    return new Promise(function (resolve) {
      var settled = false;
      var done = function (r) { if (!settled) { settled = true; resolve(r); } };
      try {
        navigator.geolocation.getCurrentPosition(
          function () { done('granted'); },             // takes no argument: the position is never read
          function (err) {
            var c = err && err.code;
            if (c === 1) done('denied');
            else if (c === 2) done('granted');          // permission was given; no fix was available
            else if (c === 3) done('timeout');
            else done('error');
          },
          { timeout: CFG.locationTimeoutMs || 30000, maximumAge: 0, enableHighAccuracy: false }
        );
      } catch (e) { done('error'); }
    });
  }

  function requestMedia(kind) {
    var constraints = kind === 'camera' ? { video: true, audio: false } : { audio: true, video: false };
    var p;
    try { p = navigator.mediaDevices.getUserMedia(constraints); } catch (e) { return Promise.resolve('error'); }
    return p.then(function (stream) {
      var tracks = stream.getTracks();
      for (var i = 0; i < tracks.length; i++) tracks[i].stop();   // nothing is recorded, shown, or kept
      return 'granted';
    }, function (e) {
      var n = (e && e.name) || '';
      if (n === 'NotAllowedError' || n === 'PermissionDeniedError' || n === 'SecurityError') return 'denied';
      if (n === 'NotFoundError' || n === 'DevicesNotFoundError' || n === 'OverconstrainedError') return 'no_device';
      if (n === 'NotReadableError' || n === 'AbortError' || n === 'TrackStartError') return 'granted'; // allowed, but the device was busy
      return 'error';
    });
  }

  /* Turns one request into one of the three outcomes.

     Allow             the person allowed it (including "allowed, but no fix" and "allowed, but busy").
     Don't Allow       the person refused at the prompt, or closed it.
     Prompt not shown  the browser never asked: the feature is missing, the browser already
                       remembered a choice for this site, there is no camera or microphone,
                       or the answer came back faster than a person could tap (for example
                       location is switched off for the browser, or a browser setting
                       answers for every site).

     The earlier state and the elapsed time are used here once and are never stored. */
  function askBrowser(def) {
    if (!def.supported()) return Promise.resolve(NOT_SHOWN);
    return queryState(def.queryName).then(function (prior) {
      if (prior === 'granted' || prior === 'denied') return NOT_SHOWN;   // the browser will not ask again
      session.asking = true;                                             // a prompt may be on screen from here on
      saveSession();
      var t = now();
      return def.request().then(function (r) {
        var instant = (now() - t) < INSTANT_MS;
        if (instant && (r === 'granted' || r === 'denied')) return NOT_SHOWN;   // too fast to be a person
        if (r === 'granted') return ALLOW;
        if (r === 'denied') return DENY;
        if (r === 'timeout') {
          return queryState(def.queryName).then(function (st) {
            return (st === 'denied' || st === 'prompt') ? DENY : ALLOW;
          });
        }
        return NOT_SHOWN;                                                // no such device, or an error
      });
    });
  }

  /* ---------- simulated dialog (preview mode with ?sim=1 only) ---------- */
  var isAndroid = /Android/.test(navigator.userAgent || '');
  function simulatedPrompt(def) {
    return new Promise(function (resolve) {
      var dlg = $('os-dialog');
      var host = location.host || 'This site';
      dlg.className = 'os-dialog ' + (isAndroid ? 'android' : 'ios');
      if (isAndroid) {
        dlg.innerHTML = '<div class="ttl">' + esc(host) + ' wants to ' + esc(def.simText) + '</div>' +
          '<div class="btns"><button data-r="' + ALLOW + '" class="b">Allow</button><button data-r="' + DENY + '">Don’t allow</button></div>';
      } else {
        dlg.innerHTML = '<div class="ttl">“' + esc(host) + '” would like to ' + esc(def.simText) + '</div>' +
          '<div class="msg">Simulated dialog (preview only)</div>' +
          '<div class="btns side"><button data-r="' + DENY + '">Don’t Allow</button><button data-r="' + ALLOW + '" class="b">Allow</button></div>';
      }
      $('dim').hidden = false;
      var btns = dlg.querySelectorAll('button');
      for (var i = 0; i < btns.length; i++) {
        btns[i].addEventListener('click', function (ev) {
          $('dim').hidden = true;
          resolve(ev.currentTarget.getAttribute('data-r'));
        });
      }
    });
  }

  /* ---------- flow ---------- */
  function init() {
    var els = document.querySelectorAll('[data-app]');
    for (var i = 0; i < els.length; i++) text(els[i], appName());
    document.title = appName();

    var problems = configProblems();
    if (!PREVIEW) problems = problems.concat(formProblems());
    if (problems.length) { showNotReady(problems); return; }

    text($('welcome-text'), W.welcome);
    text($('btn-start'), W.start);
    text($('btn-pre-continue'), W.proceed);
    text($('thanks-text'), W.thanks);
    text($('btn-continue'), W.proceed);

    if (PREVIEW && qs.get('reset') === '1') clearSession();
    session = loadSession();
    var forced = forcedVersion();
    if (session && forced && session.version !== forced) session = null;
    if (!session) {
      session = { version: assignVersion(), step: 0, asking: false, outcomes: {} };
      saveSession();
    }

    $('btn-start').addEventListener('click', start);
    $('btn-pre-continue').addEventListener('click', function () {
      if (session.step >= 1 && session.step <= ORDER.length) ask(ORDER[session.step - 1]);
    });
    $('btn-continue').addEventListener('click', goToForm);

    if (PREVIEW) renderPreviewNotes();
    resume(true);
  }

  function showNotReady(problems) {
    // Participants see only the plain message. The reasons go to the console, and to the
    // screen in preview mode.
    if (window.console && console.warn) console.warn('StudySpot is not ready: ' + problems.join('; '));
    if (PREVIEW) {
      $('notready-detail').innerHTML = '<div class="warn">' + problems.map(esc).join('<br>') + '</div>';
    }
    show('s-notready');
  }

  // Shows the screen for the saved step. A reload lands here too (fresh = true), so nothing
  // is reassigned and no answered permission is asked again.
  function resume(fresh) {
    if (session.step <= 0) { show('s-welcome'); return; }
    if (session.step > ORDER.length) { show('s-thanks'); return; }
    showPermission(fresh === true);
  }

  function start() {
    if (session.step !== 0) return;
    session.step = 1;
    saveSession();
    resume();
  }

  function setWaiting(on) {
    $('btn-pre-continue').hidden = on;
    $('pre-waiting').hidden = !on;
  }

  function showPermission(fresh) {
    var id = ORDER[session.step - 1];
    // Version A asks as soon as the screen appears, except right after a reload: a prompt
    // fired by a page load has no tap behind it, so that one screen waits for Continue.
    var auto = session.version === 'A' && AUTO_A && !fresh;
    // The only difference between the versions: Version B shows the reason sentence here.
    text($('pre-reason'), session.version === 'B' ? W.reasons[id] : '');
    setWaiting(auto || session.asking);
    show('s-pre');
    if (session.asking) { resumeAsk(id); return; }
    if (auto) ask(id);
  }

  function ask(id) {
    if (busy) return;
    busy = true;
    setWaiting(true);
    var def = PERMS[id];
    var p = SIMULATE ? simulatedPrompt(def) : askBrowser(def);
    p.then(function (outcome) { record(id, outcome); }, function () { record(id, NOT_SHOWN); });
  }

  // The page was reloaded while a prompt was open. If the browser now remembers an answer,
  // that answer was given at the prompt. Otherwise the prompt was never answered, so the
  // screen starts over.
  function resumeAsk(id) {
    busy = true;
    var def = PERMS[id];
    queryState(def.queryName).then(function (st) {
      if (st === 'granted') { record(id, ALLOW); return; }
      if (st === 'denied') { record(id, DENY); return; }
      busy = false;
      session.asking = false;
      saveSession();
      setWaiting(false);                                 // wait for a Continue tap, in either version
    });
  }

  function record(id, outcome) {
    session.outcomes[id] = (outcome === ALLOW || outcome === DENY) ? outcome : NOT_SHOWN;
    session.asking = false;
    session.step += 1;
    saveSession();
    setTimeout(function () { busy = false; resume(); }, 250);
  }

  /* ---------- handoff to the Google Form ---------- */
  function label(letter) {
    var L = CFG.labels || {};
    if (letter === ALLOW) return L.allow;
    if (letter === DENY) return L.deny;
    return L.notShown;
  }
  function outcomeOf(id) { return session.outcomes[id] || NOT_SHOWN; }

  // For example SS1-B-ADN: version B, location Allow, camera Don't Allow, microphone Prompt not shown.
  function appCode() {
    return (PILOT ? 'P' : '') + CODE_PREFIX + '-' + session.version + '-' + REQUIRED.map(outcomeOf).join('');
  }

  function formLink() {
    var e = CFG.formEntries;
    var pairs = [
      ['usp', 'pp_url'],
      [e.version, session.version],
      [e.location, label(outcomeOf('location'))],
      [e.camera, label(outcomeOf('camera'))],
      [e.microphone, label(outcomeOf('microphone'))],
      [e.appCode, appCode()]
    ];
    return CFG.formUrl + '?' + pairs.map(function (kv) { return encodeURIComponent(kv[0]) + '=' + encodeURIComponent(kv[1]); }).join('&');
  }

  function goToForm() {
    if (session.step <= ORDER.length) return;
    if (formProblems().length) {                         // only reachable in preview mode
      var rows = [['Version', session.version]]
        .concat(REQUIRED.map(function (id) { return [PERMS[id].label, label(outcomeOf(id))]; }))
        .concat([['App code', appCode()]]);
      var box = $('preview-form');
      box.innerHTML = '<div class="warn"><b>Preview:</b> the Google Form is not set up in config.js yet, so nothing opens. The form would be prefilled with:<br>' +
        rows.map(function (r) { return esc(r[0]) + ': ' + esc(r[1]); }).join('<br>') + '</div>';
      box.hidden = false;
      return;
    }
    window.location.assign(formLink());                  // same tab
  }

  /* ---------- preview banner (never shown in research mode) ---------- */
  function renderPreviewNotes() {
    var notes = ['<b>Preview mode.</b> Not for participants. Set mode to "research" in config.js before collecting data.'];
    notes.push('This session is Version ' + session.version + (forcedVersion() ? ' (forced by the link).' : ' (assigned at random).'));
    notes.push(AUTO_A ? 'Version A asks as soon as each screen appears; Version B asks after Continue.' : 'Both versions ask after one Continue tap per screen.');
    if (SIMULATE) notes.push('Simulated dialogs are on (?sim=1). The browser\'s real prompts will not appear.');
    else if (!window.isSecureContext) notes.push('This page is not on HTTPS, so the browser cannot ask. Every permission will be coded "Prompt not shown". Add ?sim=1 to try simulated dialogs.');
    if (PILOT) notes.push('Pilot link (?pilot=1): the app code will start with P.');
    var fp = formProblems();
    if (fp.length) notes.push('Still to fill in before research mode: ' + fp.join(', ') + '.');
    var box = $('preview-notes');
    var draw = function () { box.innerHTML = '<div class="warn">' + notes.join('<br>') + '</div>'; };
    draw();
    if (SIMULATE) return;
    Promise.all(ORDER.map(function (id) {
      return queryState(PERMS[id].queryName).then(function (st) { return { id: id, st: st }; });
    })).then(function (rs) {
      var decided = rs.filter(function (r) { return r.st === 'granted' || r.st === 'denied'; });
      if (!decided.length) return;
      notes.push('This browser already remembers a choice for: ' +
        decided.map(function (r) { return esc(PERMS[r.id].label) + ' (' + esc(r.st) + ')'; }).join(', ') +
        '. It will not ask again, so those will be coded "Prompt not shown". Use a private tab or reset this site\'s permissions.');
      draw();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
