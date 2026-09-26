/* Nearlo permission study: participant flow.
   Records only decisions and timings. Never reads or stores location, media, or notification content. */
(function () {
  'use strict';

  var CFG = window.STUDY_CONFIG || {};
  var qs = new URLSearchParams(location.search);
  var $ = function (id) { return document.getElementById(id); };
  var now = function () { return (window.performance && performance.now) ? performance.now() : Date.now(); };

  /* ---------- platform ---------- */
  var ua = navigator.userAgent || '';
  var isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isAndroid = /Android/.test(ua);
  var platform = isIOS ? 'ios' : (isAndroid ? 'android' : 'desktop');
  var browser = (function () {
    if (/SamsungBrowser/.test(ua)) return 'Samsung';
    if (/Edg\//.test(ua)) return 'Edge';
    if (/OPR\//.test(ua)) return 'Opera';
    if (/Firefox|FxiOS/.test(ua)) return 'Firefox';
    if (/CriOS/.test(ua)) return 'Chrome';
    if (/Chrome\//.test(ua)) return 'Chrome';
    if (/Safari\//.test(ua)) return 'Safari';
    return 'Other';
  })();
  var dialogStyle = isAndroid ? 'android' : 'ios';

  /* ---------- permission definitions ---------- */
  var ICONS = {
    location: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.6"/></svg>',
    notifications: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15z"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>',
    camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    microphone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
    contacts: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>'
  };

  var PERMS = {
    location: {
      key: 'L', label: 'Location',
      title: function (a) { return 'Allow ' + a + ' to use your location'; },
      plain: function (a) { return a + ' needs access to your location.'; },
      reason: function (a) { return a + ' uses your location to show events and deals near you.'; },
      osTitle: function (a) { return 'Allow “' + a + '” to use your location?'; },
      osMsg: 'Your location is used to show what is happening around you.',
      threeWay: true,
      consequences: [
        'Know where you are whenever the app is open, and sometimes in the background.',
        'Build a history of the places you go, including home and school, over time.',
        'Sell or share that history with advertisers and data brokers.',
        'Show you ads based on the places you visit.'
      ],
      supported: function () { return !!(navigator.geolocation && navigator.geolocation.getCurrentPosition); },
      request: requestLocation,
      queryName: 'geolocation'
    },
    notifications: {
      key: 'N', label: 'Notifications',
      title: function (a) { return 'Turn on notifications'; },
      plain: function (a) { return a + ' would like to send you notifications.'; },
      reason: function (a) { return a + ' sends notifications so you hear about events before they sell out.'; },
      osTitle: function (a) { return '“' + a + '” Would Like to Send You Notifications'; },
      osMsg: 'Notifications may include alerts, sounds, and icon badges. These can be configured in Settings.',
      consequences: [
        'Send you alerts at any time, including marketing and reminders to open the app.',
        'Track which notifications you tap and when.',
        'Interrupt you to pull you back into the app.'
      ],
      supported: function () { return ('Notification' in window) && typeof Notification.requestPermission === 'function'; },
      request: requestNotifications,
      queryName: 'notifications'
    },
    camera: {
      key: 'C', label: 'Camera',
      title: function (a) { return 'Allow ' + a + ' to use your camera'; },
      plain: function (a) { return a + ' needs access to your camera.'; },
      reason: function (a) { return a + ' uses your camera to scan event tickets and check-in codes.'; },
      osTitle: function (a) { return '“' + a + '” Would Like to Access the Camera'; },
      osMsg: 'The camera is used to scan tickets and codes.',
      consequences: [
        'Turn on the camera while the app is open, without a visible photo being taken.',
        'Read what is in the frame, including faces and documents, if the app is designed to.',
        'Access this permission every time you open the app, not just once.'
      ],
      supported: function () { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia); },
      request: function () { return requestMedia('camera'); },
      queryName: 'camera'
    },
    microphone: {
      key: 'M', label: 'Microphone',
      title: function (a) { return 'Allow ' + a + ' to use your microphone'; },
      plain: function (a) { return a + ' needs access to your microphone.'; },
      reason: function (a) { return a + ' uses your microphone so you can search for events by voice.'; },
      osTitle: function (a) { return '“' + a + '” Would Like to Access the Microphone'; },
      osMsg: 'The microphone is used for voice search.',
      consequences: [
        'Listen through the microphone while the app is open.',
        'Send audio to the company\'s servers for processing.',
        'Access this permission every time you open the app, not just once.'
      ],
      supported: function () { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia); },
      request: function () { return requestMedia('microphone'); },
      queryName: 'microphone'
    },
    contacts: {
      key: 'K', label: 'Contacts',
      title: function (a) { return 'Find your friends on ' + a; },
      plain: function (a) { return a + ' needs access to your contacts.'; },
      reason: function (a) { return a + ' uses your contacts to show you which friends are going to events.'; },
      osTitle: function (a) { return '“' + a + '” Would Like to Access Your Contacts'; },
      osMsg: 'Contacts are used to find friends who also use the app.',
      consequences: [
        'Upload the names, phone numbers, and emails of everyone in your contacts.',
        'Keep that list on the company\'s servers, even for people who never used the app.',
        'Use it to build a map of who knows whom.'
      ],
      supported: function () { return false; },
      request: null,
      queryName: null
    }
  };

  /* ---------- state ---------- */
  var state = {
    v: 1,
    id: '',
    cond: '',
    platform: platform,
    browser: browser,
    secure: !!window.isSecureContext,
    simulateAll: false,
    startedAt: '',
    perms: [],
    feedMs: 0,
    ad: '',
    reflect: {},
    totalMs: 0
  };
  var order = (CFG.permissions || ['location', 'notifications', 'camera', 'microphone']).filter(function (p) { return PERMS[p]; });
  var idx = -1;
  var t0 = 0;
  var tPreShown = 0;
  var tFeedShown = 0;

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
  function sec(ms) { return (Math.round(ms / 100) / 10).toFixed(1); }
  function appName() { return CFG.appName || 'Nearlo'; }
  function cleanCode(s) { return String(s || '').replace(/[;=\/,\s]/g, '').slice(0, 24); }

  function queryState(name) {
    if (!name || !navigator.permissions || !navigator.permissions.query) return Promise.resolve('unknown');
    try {
      return navigator.permissions.query({ name: name }).then(function (s) { return s.state || 'unknown'; }, function () { return 'unknown'; });
    } catch (e) { return Promise.resolve('unknown'); }
  }

  function assignCondition() {
    var forced = (qs.get('c') || '').toUpperCase();
    if (forced === 'A' || forced === 'B') return forced;
    var mode = CFG.assign || 'random';
    if (mode === 'A' || mode === 'B') return mode;
    if (mode === 'alternate') {
      try {
        var n = parseInt(localStorage.getItem('nearlo_n') || '0', 10) || 0;
        localStorage.setItem('nearlo_n', String(n + 1));
        return (n % 2 === 0) ? 'A' : 'B';
      } catch (e) { /* fall through to random */ }
    }
    return Math.random() < 0.5 ? 'A' : 'B';
  }

  /* ---------- real permission requests ---------- */
  function requestLocation() {
    return new Promise(function (resolve) {
      var settled = false;
      var done = function (r) { if (!settled) { settled = true; resolve(r); } };
      try {
        navigator.geolocation.getCurrentPosition(
          function () { done('granted'); },            // the position argument is deliberately never read
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

  function requestNotifications() {
    return new Promise(function (resolve) {
      var settled = false;
      var map = function (v) { return v === 'granted' ? 'granted' : (v === 'denied' ? 'denied' : 'dismissed'); };
      var done = function (r) { if (!settled) { settled = true; resolve(r); } };
      var p;
      try { p = Notification.requestPermission(function (v) { done(map(v)); }); } catch (e) { done('error'); return; }
      if (p && typeof p.then === 'function') p.then(function (v) { done(map(v)); }, function () { done('error'); });
    });
  }

  function requestMedia(kind) {
    var constraints = kind === 'camera' ? { video: true, audio: false } : { audio: true, video: false };
    return navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
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

  // After an ambiguous result, ask the Permissions API what the browser actually stored.
  function refine(def, result) {
    if (result !== 'timeout' && result !== 'error' && result !== 'denied' && result !== 'dismissed') return Promise.resolve(result);
    return queryState(def.queryName).then(function (st) {
      if (st === 'granted') return 'granted';
      if (st === 'denied') return 'denied';
      if (st === 'prompt') return (result === 'timeout') ? 'dismissed' : 'dismissed';
      return result;
    });
  }

  /* ---------- simulated OS dialog ---------- */
  function simulatedPrompt(def) {
    return new Promise(function (resolve) {
      var dlg = $('os-dialog');
      var a = appName();
      var html = '';
      dlg.className = 'os-dialog ' + dialogStyle;
      if (dialogStyle === 'ios') {
        html += '<div class="ttl">' + esc(def.osTitle(a)) + '</div><div class="msg">' + esc(def.osMsg) + '</div>';
        if (def.threeWay) {
          html += '<div class="btns"><button data-r="granted" data-d="once">Allow Once</button><button data-r="granted" data-d="while_using">Allow While Using App</button><button data-r="denied" data-d="">Don’t Allow</button></div>';
        } else {
          html += '<div class="btns side"><button data-r="denied" data-d="">Don’t Allow</button><button data-r="granted" data-d="" class="b">Allow</button></div>';
        }
      } else {
        html += '<div class="ic">' + ICONS[def.id] + '</div><div class="ttl">Allow <b>' + esc(a) + '</b> to access ' + esc(androidNoun(def.id)) + '?</div>';
        if (def.threeWay) {
          html += '<div class="btns"><button data-r="granted" data-d="while_using" class="b">While using the app</button><button data-r="granted" data-d="once">Only this time</button><button data-r="denied" data-d="">Don’t allow</button></div>';
        } else {
          html += '<div class="btns"><button data-r="granted" data-d="" class="b">Allow</button><button data-r="denied" data-d="">Don’t allow</button></div>';
        }
      }
      dlg.innerHTML = html;
      $('dim').hidden = false;
      var btns = dlg.querySelectorAll('button');
      for (var i = 0; i < btns.length; i++) {
        btns[i].addEventListener('click', function (ev) {
          $('dim').hidden = true;
          resolve({ result: ev.currentTarget.getAttribute('data-r'), detail: ev.currentTarget.getAttribute('data-d') || '' });
        });
      }
    });
  }
  function androidNoun(id) {
    return { location: "this device's location", notifications: 'notifications', camera: 'the camera', microphone: 'the microphone', contacts: 'your contacts' }[id] || id;
  }

  /* ---------- flow ---------- */
  function init() {
    var els = document.querySelectorAll('[data-app]');
    for (var i = 0; i < els.length; i++) text(els[i], appName());
    els = document.querySelectorAll('[data-tagline]');
    for (i = 0; i < els.length; i++) text(els[i], CFG.tagline || '');
    document.title = appName();

    state.simulateAll = !!CFG.simulateAll || qs.get('sim') === '1' || !state.secure;
    text($('code-hint'), CFG.codeHint || '');
    if (qs.get('id')) $('code').value = cleanCode(qs.get('id'));
    if (CFG.askForCode === false) $('code-field').hidden = true;

    var warn = [];
    if (!state.secure) warn.push('This page is not on HTTPS, so the browser will not show real permission prompts. Simulated prompts will be used and marked as simulated.');
    else if (state.simulateAll) warn.push('Simulation is on: every prompt will be a simulated dialog, not a real one.');
    var forced = (qs.get('c') || '').toUpperCase();
    if (forced === 'A' || forced === 'B') warn.push('Condition forced to ' + forced + ' by the link.');
    renderWarnings(warn);

    // Warn if this browser has already decided any of these permissions for this site.
    var checks = order.map(function (p) { return queryState(PERMS[p].queryName).then(function (st) { return { p: p, st: st }; }); });
    Promise.all(checks).then(function (rs) {
      var decided = rs.filter(function (r) { return r.st === 'granted' || r.st === 'denied'; });
      if (decided.length) {
        warn.push('This browser already remembers a choice for: ' + decided.map(function (r) { return PERMS[r.p].label + ' (' + r.st + ')'; }).join(', ') + '. The browser will not ask again, so this run may not reflect a fresh decision. Use a private tab or reset the site\'s permissions first.');
        renderWarnings(warn);
      }
    });

    $('btn-begin').addEventListener('click', begin);
    $('code').addEventListener('keydown', function (e) { if (e.key === 'Enter') begin(); });
    $('btn-start').addEventListener('click', startPermissions);
    $('btn-pre-continue').addEventListener('click', function () { preDecision('continue'); });
    $('btn-pre-notnow').addEventListener('click', function () { preDecision('not_now'); });
    $('btn-feed-continue').addEventListener('click', leaveFeed);
    $('btn-reveal-continue').addEventListener('click', leaveReveal);
    $('btn-debrief-continue').addEventListener('click', finish);
    $('btn-copy').addEventListener('click', copyCode);
    $('btn-download-json').addEventListener('click', downloadJSON);
    $('btn-download-csv').addEventListener('click', downloadCSV);
    $('btn-submit').addEventListener('click', submitResults);
    $('btn-pre-notnow').hidden = CFG.allowNotNow === false;
  }

  function renderWarnings(list) {
    $('intro-warnings').innerHTML = list.map(function (w) { return '<div class="warn">' + esc(w) + '</div>'; }).join('');
  }

  function begin() {
    var code = cleanCode($('code').value);
    if (CFG.askForCode !== false && code.length < 2) {
      $('code').focus();
      $('code').style.outline = '2px solid var(--no)';
      return;
    }
    state.id = code || 'anon';
    state.cond = assignCondition();
    state.startedAt = new Date().toISOString();
    t0 = now();
    show('s-splash');
  }

  function startPermissions() {
    idx = -1;
    nextPermission();
  }

  function nextPermission() {
    idx += 1;
    if (idx >= order.length) { enterFeed(); return; }
    var id = order[idx];
    var def = PERMS[id];
    def.id = id;
    var a = appName();
    text($('pre-step'), 'Step ' + (idx + 1) + ' of ' + order.length);
    $('pre-icon').innerHTML = ICONS[id];
    text($('pre-title'), def.title(a));
    text($('pre-body'), state.cond === 'B' ? def.reason(a) : def.plain(a));
    $('btn-pre-continue').disabled = false;
    $('btn-pre-continue').hidden = false;
    $('btn-pre-notnow').hidden = CFG.allowNotNow === false;
    $('pre-waiting').hidden = true;
    show('s-pre');
    tPreShown = now();
  }

  function preDecision(choice) {
    var id = order[idx];
    var def = PERMS[id];
    var rec = { id: id, key: def.key, label: def.label, order: idx + 1, pre: choice, prior: 'unknown', mode: '', result: '', detail: '', tPre: now() - tPreShown, tPrompt: 0 };
    $('btn-pre-continue').disabled = true;

    if (choice === 'not_now') {
      rec.result = 'pre_declined';
      rec.mode = 'none';
      rec.prior = 'n/a';
      state.perms.push(rec);
      nextPermission();
      return;
    }

    var useReal = !state.simulateAll && def.supported() && !!def.request;
    rec.mode = useReal ? 'real' : 'simulated';

    var prior = useReal ? queryState(def.queryName) : Promise.resolve('n/a');
    prior.then(function (st) {
      rec.prior = st;
      $('btn-pre-continue').hidden = true;
      $('btn-pre-notnow').hidden = true;
      $('pre-waiting').hidden = false;
      var tStart = now();
      var p = useReal ? def.request().then(function (r) { return refine(def, r).then(function (rr) { return { result: rr, detail: '' }; }); })
                      : simulatedPrompt(def);
      p.then(function (out) {
        rec.tPrompt = now() - tStart;
        rec.result = out.result;
        rec.detail = out.detail || '';
        state.perms.push(rec);
        setTimeout(nextPermission, 250);
      });
    });
  }

  /* ---------- fake home screen ---------- */
  var EVENTS = [
    { e: '🎸', t: 'Friday night live music', m: 'Tonight · 7:30 PM · 1.2 mi' },
    { e: '🏀', t: 'Pickup basketball, open gym', m: 'Sat · 10 AM · 0.8 mi' },
    { e: '🎬', t: 'Outdoor movie: sci-fi double feature', m: 'Sat · 8 PM · 2.4 mi' },
    { e: '🌮', t: 'Food truck rally', m: 'Sun · 12 PM · 1.9 mi' },
    { e: '🎨', t: 'Free art workshop for teens', m: 'Sun · 2 PM · 3.1 mi' },
    { e: '🏃', t: 'Community 5K sign-ups', m: 'Next week · 0.5 mi' }
  ];

  function granted(id) {
    for (var i = 0; i < state.perms.length; i++) if (state.perms[i].id === id) return state.perms[i].result === 'granted';
    return false;
  }

  function enterFeed() {
    var loc = granted('location');
    state.ad = loc ? 'targeted' : 'generic';
    $('feed-loc').innerHTML = loc ? ICONS.location + ' Near you' : ICONS.location + ' Location off';

    var html = '';
    var adCard;
    if (loc) {
      adCard = '<div class="card ad"><div class="label">Sponsored · Near you</div><div class="art">🧋</div><div class="body">' +
        '<div class="title">Buy one, get one free boba, 0.3 mi from you</div>' +
        '<div class="meta">Tap for directions from your current location</div>' +
        '<span class="cta">Get directions</span></div></div>';
    } else {
      adCard = '<div class="card ad"><div class="label">Sponsored</div><div class="art">🎧</div><div class="body">' +
        '<div class="title">Wireless earbuds, 30% off this week</div>' +
        '<div class="meta">Free shipping nationwide</div>' +
        '<span class="cta">Shop now</span></div></div>';
    }
    for (var i = 0; i < EVENTS.length; i++) {
      var ev = EVENTS[i];
      var meta = loc ? ev.m : ev.m.replace(/ · [\d.]+ mi$/, '');
      html += '<div class="card"><div class="art" style="background:' + artBg(i) + '">' + ev.e + '</div><div class="body"><div class="title">' + esc(ev.t) + '</div><div class="meta">' + esc(meta) + '</div></div></div>';
      if (i === 1) html += adCard;
    }
    $('feed').innerHTML = html;

    var toast = $('feed-toast');
    if (granted('notifications')) {
      toast.innerHTML = '<div class="logo small"></div><div><b>' + esc(appName()) + '</b>Two events near you start in the next hour.</div>';
      toast.hidden = false;
    } else {
      toast.hidden = true;
    }

    var btn = $('btn-feed-continue');
    btn.disabled = true;
    var wait = Math.max(0, (CFG.feedMinSeconds || 0) * 1000);
    setTimeout(function () { btn.disabled = false; }, wait);
    show('s-feed');
    tFeedShown = now();
  }
  function artBg(i) {
    var bgs = ['linear-gradient(135deg,#ffd6e0,#ffe9c7)', 'linear-gradient(135deg,#d6f0ff,#e3ffe9)', 'linear-gradient(135deg,#e6dcff,#ffd9f5)', 'linear-gradient(135deg,#fff3c4,#ffd8b5)', 'linear-gradient(135deg,#d9fff2,#d6e4ff)', 'linear-gradient(135deg,#ffe0d6,#fff5c4)'];
    return bgs[i % bgs.length];
  }

  function leaveFeed() {
    state.feedMs = now() - tFeedShown;
    enterReveal();
  }

  /* ---------- reveal ---------- */
  function enterReveal() {
    var html = '';
    for (var i = 0; i < state.perms.length; i++) {
      var p = state.perms[i];
      var def = PERMS[p.id];
      var pill, lead;
      if (p.result === 'granted') { pill = '<span class="pill ok">Allowed</span>'; lead = 'You allowed it. An app with this permission could:'; }
      else if (p.result === 'denied' || p.result === 'pre_declined') { pill = '<span class="pill no">Not allowed</span>'; lead = 'You said no. If you had allowed it, an app could:'; }
      else if (p.result === 'dismissed') { pill = '<span class="pill na">Skipped</span>'; lead = 'You closed the prompt without answering. If you had allowed it, an app could:'; }
      else { pill = '<span class="pill na">Not available</span>'; lead = 'This device could not ask. If it had, an app with this permission could:'; }
      html += '<div class="rcard"><div class="head">' + ICONS[p.id] + '<span class="name">' + esc(def.label) + '</span>' + pill + '</div>' +
        '<p class="muted" style="margin:8px 0 0;font-size:14px">' + esc(lead) + '</p><ul>' +
        def.consequences.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul>';
      if (p.id === 'location' && p.result === 'granted') {
        html += '<div class="note">The “near you” ad on the home screen was picked because you allowed location. A real app would use your actual position for that.</div>';
      }
      if (p.id === 'notifications' && p.result === 'granted') {
        html += '<div class="note">The alert at the top of the home screen appeared because you allowed notifications.</div>';
      }
      html += '</div>';
    }
    $('reveal-cards').innerHTML = html;
    renderQuestions();
    show('s-reveal');
  }

  function renderQuestions() {
    var qsList = CFG.reflection || [];
    var html = '';
    for (var i = 0; i < qsList.length; i++) {
      var q = qsList[i];
      html += '<div class="q" data-key="' + esc(q.key) + '" data-type="' + esc(q.type) + '"><div class="qt">' + esc(q.text) + '</div>';
      if (q.type === 'scale') {
        html += '<div class="scale">';
        for (var v = q.min; v <= q.max; v++) html += '<button type="button" class="opt" data-v="' + v + '" aria-pressed="false">' + v + '</button>';
        html += '</div><div class="scale-labels"><span>' + esc(q.minLabel || '') + '</span><span>' + esc(q.maxLabel || '') + '</span></div>';
      } else {
        var opts = q.type === 'perms'
          ? state.perms.filter(function (p) { return p.result === 'granted' || p.result === 'denied' || p.result === 'pre_declined' || p.result === 'dismissed'; }).map(function (p) { return PERMS[p.id].label; }).concat(['None'])
          : (q.options || []);
        html += '<div class="opts">';
        for (var o = 0; o < opts.length; o++) html += '<button type="button" class="opt" data-v="' + (o + 1) + '" data-label="' + esc(opts[o]) + '" aria-pressed="false">' + esc(opts[o]) + '</button>';
        html += '</div>';
      }
      html += '</div>';
    }
    var wrap = $('reveal-questions');
    wrap.innerHTML = html;
    var groups = wrap.querySelectorAll('.q');
    for (var g = 0; g < groups.length; g++) {
      (function (group) {
        var multi = group.getAttribute('data-type') === 'multi' || group.getAttribute('data-type') === 'perms';
        var btns = group.querySelectorAll('.opt');
        for (var b = 0; b < btns.length; b++) {
          btns[b].addEventListener('click', function (ev) {
            var btn = ev.currentTarget;
            var pressed = btn.getAttribute('aria-pressed') === 'true';
            if (!multi) { for (var k = 0; k < btns.length; k++) btns[k].setAttribute('aria-pressed', 'false'); btn.setAttribute('aria-pressed', 'true'); }
            else {
              var isNone = btn.getAttribute('data-label') === 'None';
              if (isNone) { for (var k2 = 0; k2 < btns.length; k2++) btns[k2].setAttribute('aria-pressed', 'false'); btn.setAttribute('aria-pressed', 'true'); }
              else {
                btn.setAttribute('aria-pressed', pressed ? 'false' : 'true');
                for (var k3 = 0; k3 < btns.length; k3++) if (btns[k3].getAttribute('data-label') === 'None') btns[k3].setAttribute('aria-pressed', 'false');
              }
            }
          });
        }
      })(groups[g]);
    }
  }

  function collectAnswers() {
    var groups = document.querySelectorAll('#reveal-questions .q');
    var out = {};
    for (var g = 0; g < groups.length; g++) {
      var key = groups[g].getAttribute('data-key');
      var pressed = groups[g].querySelectorAll('.opt[aria-pressed="true"]');
      var vals = [], labels = [];
      for (var i = 0; i < pressed.length; i++) { vals.push(pressed[i].getAttribute('data-v')); labels.push(pressed[i].getAttribute('data-label') || pressed[i].textContent); }
      out[key] = { values: vals, labels: labels };
    }
    return out;
  }

  function leaveReveal() {
    state.reflect = collectAnswers();
    enterDebrief();
  }

  /* ---------- debrief ---------- */
  function enterDebrief() {
    var paras = CFG.debrief || [];
    $('debrief-text').innerHTML = paras.map(function (p) { return '<p>' + esc(p).replace(/Nearlo/g, esc(appName())) + '</p>'; }).join('');
    $('revoke-steps').innerHTML = revokeSteps();
    show('s-debrief');
  }
  function revokeSteps() {
    var host = location.hostname || 'this site';
    var ios = '<h4>iPhone or iPad (Safari)</h4><ol><li>Tap the <b>aA</b> or page-settings icon in the address bar, then <b>Website Settings</b>.</li><li>Set Location, Camera, and Microphone to <b>Deny</b> or <b>Ask</b>.</li><li>Or open Settings → Apps → Safari → Location / Camera / Microphone and remove <b>' + esc(host) + '</b>.</li></ol>';
    var android = '<h4>Android (Chrome)</h4><ol><li>Tap the lock or tune icon left of the address bar, then <b>Permissions</b>.</li><li>Tap <b>Reset permissions</b>, or switch each one off.</li><li>Or open Chrome Settings → Site settings and find <b>' + esc(host) + '</b>.</li></ol>';
    var desktop = '<h4>Desktop browsers</h4><ol><li>Click the lock or tune icon left of the address bar.</li><li>Reset or switch off Location, Camera, Microphone, and Notifications for <b>' + esc(host) + '</b>.</li></ol>';
    if (platform === 'ios') return ios + android + desktop;
    if (platform === 'android') return android + ios + desktop;
    return desktop + ios + android;
  }

  /* ---------- results ---------- */
  function finish() {
    state.totalMs = now() - t0;
    var code = buildCode();
    text($('result-code'), code);
    if (CFG.formUrl && CFG.formField) {
      var a = $('btn-form');
      a.href = CFG.formUrl + (CFG.formUrl.indexOf('?') >= 0 ? '&' : '?') + 'usp=pp_url&' + encodeURIComponent(CFG.formField) + '=' + encodeURIComponent(code);
      a.hidden = false;
    }
    if (CFG.submitUrl) $('btn-submit').hidden = false;
    var rows = '';
    for (var i = 0; i < state.perms.length; i++) {
      var p = state.perms[i];
      rows += '<tr><td>' + esc(p.label) + '</td><td>' + esc(prettyResult(p.result)) + (p.mode === 'simulated' ? ' (simulated)' : '') + '</td></tr>';
    }
    $('done-summary').innerHTML = '<table>' + rows + '</table>';
    show('s-done');
  }

  var RESULT_CODE = { granted: 'G', denied: 'D', dismissed: 'M', pre_declined: 'P', no_device: 'X', timeout: 'T', error: 'E', unsupported: 'U', skipped: 'S' };
  function prettyResult(r) {
    return { granted: 'Allowed', denied: 'Denied', dismissed: 'Closed without answering', pre_declined: 'Not now', no_device: 'No such device', timeout: 'Timed out', error: 'Error', unsupported: 'Not supported', skipped: 'Skipped' }[r] || r;
  }
  var MODE_CODE = { real: 'real', simulated: 'sim', none: '-' };
  var PRIOR_CODE = { prompt: 'prompt', granted: 'granted', denied: 'denied', unknown: 'unk', 'n/a': '-' };

  function buildCode() {
    var parts = ['NRL1', 'id=' + state.id, 'c=' + state.cond, 'p=' + state.platform + '-' + state.browser, 'sec=' + (state.secure ? 1 : 0)];
    for (var i = 0; i < state.perms.length; i++) {
      var p = state.perms[i];
      parts.push(p.key + '=' + [RESULT_CODE[p.result] || '?', MODE_CODE[p.mode] || p.mode, PRIOR_CODE[p.prior] || p.prior, sec(p.tPre), sec(p.tPrompt), p.detail || '-'].join('/'));
    }
    parts.push('feed=' + sec(state.feedMs), 'ad=' + (state.ad === 'targeted' ? 'T' : 'G'));
    var keys = Object.keys(state.reflect);
    for (var k = 0; k < keys.length; k++) parts.push('r_' + keys[k] + '=' + (state.reflect[keys[k]].values.join(',') || '-'));
    parts.push('total=' + sec(state.totalMs), 't=' + state.startedAt.slice(0, 16));
    return parts.join(';');
  }

  function record() {
    return {
      version: state.v,
      participant: state.id,
      condition: state.cond,
      platform: state.platform,
      browser: state.browser,
      secureContext: state.secure,
      simulateAll: state.simulateAll,
      startedAt: state.startedAt,
      permissions: state.perms.map(function (p) {
        return { permission: p.id, order: p.order, prePrompt: p.pre, priorState: p.prior, mode: p.mode, result: p.result, detail: p.detail, secondsOnPrePrompt: +sec(p.tPre), secondsOnPrompt: +sec(p.tPrompt) };
      }),
      secondsOnHomeScreen: +sec(state.feedMs),
      adShown: state.ad,
      reflection: state.reflect,
      totalSeconds: +sec(state.totalMs),
      resultCode: buildCode()
    };
  }

  function copyCode() {
    var code = $('result-code').textContent;
    var done = function (ok) { text($('done-status'), ok ? 'Copied.' : 'Could not copy automatically. Press and hold the code to select it.'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(function () { done(true); }, function () { done(false); });
    else done(false);
  }

  function download(name, mime, body) {
    var blob = new Blob([body], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function stamp() { return state.startedAt.replace(/[:.]/g, '-').slice(0, 19); }
  function downloadJSON() { download('nearlo-' + state.id + '-' + stamp() + '.json', 'application/json', JSON.stringify(record(), null, 2)); }
  function downloadCSV() {
    var header = ['participant', 'condition', 'platform', 'browser', 'secure', 'permission', 'order', 'pre_prompt', 'prior_state', 'mode', 'result', 'detail', 'sec_pre', 'sec_prompt', 'sec_home', 'ad', 'total_sec', 'started_at'];
    var lines = [header.join(',')];
    for (var i = 0; i < state.perms.length; i++) {
      var p = state.perms[i];
      lines.push([state.id, state.cond, state.platform, state.browser, state.secure ? 1 : 0, p.id, p.order, p.pre, p.prior, p.mode, p.result, p.detail, sec(p.tPre), sec(p.tPrompt), sec(state.feedMs), state.ad, sec(state.totalMs), state.startedAt].map(csv).join(','));
    }
    download('nearlo-' + state.id + '-' + stamp() + '.csv', 'text/csv', lines.join('\n'));
  }
  function csv(v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }

  function submitResults() {
    var btn = $('btn-submit');
    btn.disabled = true;
    text($('done-status'), 'Submitting…');
    fetch(CFG.submitUrl, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(record()) })
      .then(function () { text($('done-status'), 'Submitted. You can also keep the code above as a backup.'); })
      .catch(function () { btn.disabled = false; text($('done-status'), 'Could not submit. Copy the code instead.'); });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
