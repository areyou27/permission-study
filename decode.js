/* Decodes NRL1 result codes into rows and a CSV. Runs entirely in the browser. */
(function () {
  'use strict';
  var CFG = window.STUDY_CONFIG || {};
  var $ = function (id) { return document.getElementById(id); };
  var KEYS = { L: 'location', N: 'notifications', C: 'camera', M: 'microphone', K: 'contacts' };
  var RESULTS = { G: 'granted', D: 'denied', M: 'dismissed', P: 'pre_declined', U: 'unsupported', X: 'no_device', T: 'timeout', E: 'error', S: 'skipped' };
  var rows = [];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  var ANSWERED = { granted: 1, denied: 1, pre_declined: 1, dismissed: 1 };
  function reflectionLabel(key, values, perms) {
    var q = (CFG.reflection || []).filter(function (x) { return x.key === key; })[0];
    if (!q || !values || values === '-') return values || '';
    var vals = values.split(',');
    if (q.type === 'scale') return vals.join(',');
    if (q.type === 'perms') {
      // The app built these options from the permissions that got a real answer, in order, then "None".
      var opts = perms.filter(function (p) { return ANSWERED[p.result]; }).map(function (p) { return p.permission; }).concat(['None']);
      return vals.map(function (v) { return opts[parseInt(v, 10) - 1] || v; }).join(', ');
    }
    if (q.options) return vals.map(function (v) { return q.options[parseInt(v, 10) - 1] || v; }).join(', ');
    return values;
  }

  function parseLine(line, n) {
    var parts = line.trim().split(';');
    if (parts[0] !== 'NRL1') throw new Error('Line ' + n + ': does not start with NRL1');
    var base = { line: n };
    var perms = [];
    var reflect = {};
    for (var i = 1; i < parts.length; i++) {
      var eq = parts[i].indexOf('=');
      if (eq < 0) continue;
      var k = parts[i].slice(0, eq), v = parts[i].slice(eq + 1);
      if (KEYS[k]) {
        var f = v.split('/');
        perms.push({ permission: KEYS[k], result: RESULTS[f[0]] || f[0], mode: f[1] || '', prior: f[2] || '', sec_pre: f[3] || '', sec_prompt: f[4] || '', detail: (f[5] && f[5] !== '-') ? f[5] : '' });
      } else if (k.indexOf('r_') === 0) {
        reflect[k.slice(2)] = v;
      } else {
        base[k] = v;
      }
    }
    if (!perms.length) throw new Error('Line ' + n + ': no permission fields found');
    return perms.map(function (p, i) {
      var r = { participant: base.id || '', condition: base.c || '', platform: base.p || '', secure: base.sec || '', permission: p.permission, order: i + 1, result: p.result, mode: p.mode, prior_state: p.prior, sec_pre: p.sec_pre, sec_prompt: p.sec_prompt, detail: p.detail, sec_home: base.feed || '', ad: base.ad === 'T' ? 'targeted' : (base.ad === 'G' ? 'generic' : ''), total_sec: base.total || '', started_at: base.t || '' };
      Object.keys(reflect).forEach(function (rk) { r['reflect_' + rk] = reflect[rk]; r['reflect_' + rk + '_label'] = reflectionLabel(rk, reflect[rk], perms); });
      return r;
    });
  }

  function decode() {
    var lines = $('in').value.split(/\r?\n/).filter(function (l) { return l.trim(); });
    var errors = [];
    rows = [];
    lines.forEach(function (l, i) {
      try { rows = rows.concat(parseLine(l, i + 1)); } catch (e) { errors.push(e.message); }
    });
    $('errors').innerHTML = errors.map(function (e) { return '<p class="err">' + esc(e) + '</p>'; }).join('');
    render();
    $('btn-csv').disabled = !rows.length;
  }

  function render() {
    if (!rows.length) { $('summary').hidden = true; $('rows').hidden = true; return; }
    var cols = Object.keys(rows[0]);
    rows.forEach(function (r) { Object.keys(r).forEach(function (k) { if (cols.indexOf(k) < 0) cols.push(k); }); });
    var html = '<table><thead><tr>' + cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>';
    rows.forEach(function (r) { html += '<tr>' + cols.map(function (c) { return '<td>' + esc(r[c]) + '</td>'; }).join('') + '</tr>'; });
    html += '</tbody></table>';
    $('rows-table').innerHTML = html;
    $('rows').hidden = false;

    var agg = {};
    rows.forEach(function (r) {
      if (r.result !== 'granted' && r.result !== 'denied' && r.result !== 'pre_declined' && r.result !== 'dismissed') return;
      var k = r.permission + '|' + r.condition;
      agg[k] = agg[k] || { permission: r.permission, condition: r.condition, n: 0, granted: 0, participants: {} };
      agg[k].n += 1;
      if (r.result === 'granted') agg[k].granted += 1;
      agg[k].participants[r.participant] = 1;
    });
    var keys = Object.keys(agg).sort();
    var s = '<table><thead><tr><th>Permission</th><th>Condition</th><th>Decisions</th><th>Allowed</th><th>Allowed %</th></tr></thead><tbody>';
    keys.forEach(function (k) {
      var a = agg[k];
      s += '<tr><td>' + esc(a.permission) + '</td><td>' + esc(a.condition) + '</td><td>' + a.n + '</td><td>' + a.granted + '</td><td>' + (a.n ? Math.round(100 * a.granted / a.n) : 0) + '%</td></tr>';
    });
    s += '</tbody></table>';
    var ids = {};
    rows.forEach(function (r) { ids[r.participant + '|' + r.started_at] = 1; });
    s += '<p class="legend">' + Object.keys(ids).length + ' session(s) decoded. Only real answers (allowed, denied, not now, closed) count as decisions; unsupported and error results are left out.</p>';
    $('summary-table').innerHTML = s;
    $('summary').hidden = false;
  }

  function csv(v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function downloadCSV() {
    var cols = [];
    rows.forEach(function (r) { Object.keys(r).forEach(function (k) { if (cols.indexOf(k) < 0) cols.push(k); }); });
    var lines = [cols.join(',')].concat(rows.map(function (r) { return cols.map(function (c) { return csv(r[c]); }).join(','); }));
    var blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'nearlo-results-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  $('btn-decode').addEventListener('click', decode);
  $('btn-csv').addEventListener('click', downloadCSV);
  $('btn-clear').addEventListener('click', function () { $('in').value = ''; rows = []; render(); $('errors').innerHTML = ''; $('btn-csv').disabled = true; });
})();
