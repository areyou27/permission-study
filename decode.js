/* Decodes StudySpot app codes (for example SS1-B-ADN) into rows and a CSV.
   Runs entirely in the browser; nothing is uploaded. */
(function () {
  'use strict';
  var CFG = window.STUDY_CONFIG || {};
  var LABELS = CFG.labels || {};
  var $ = function (id) { return document.getElementById(id); };
  var PERMS = ['location', 'camera', 'microphone'];           // letter order in the code
  var OUTCOME = {
    A: LABELS.allow || 'Allow',
    D: LABELS.deny || "Don't Allow",
    N: LABELS.notShown || 'Prompt not shown'
  };
  // P (optional, pilot) + SS1 + version + three outcome letters
  var CODE = /(^|[^A-Za-z0-9])(P?)SS1-([AB])-([ADN])([ADN])([ADN])(?![A-Za-z0-9])/g;
  var rows = [];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  // Finds every code in the pasted text, so a whole spreadsheet column or CSV can be pasted as is.
  function parse(input) {
    var out = [];
    var lines = String(input).split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
      var m;
      CODE.lastIndex = 0;
      while ((m = CODE.exec(lines[i])) !== null) {
        out.push({
          line: i + 1,
          app_code: m[2] + 'SS1-' + m[3] + '-' + m[4] + m[5] + m[6],
          pilot: m[2] === 'P' ? 'yes' : 'no',
          version: m[3],
          location: OUTCOME[m[4]],
          camera: OUTCOME[m[5]],
          microphone: OUTCOME[m[6]]
        });
      }
    }
    return out;
  }

  function decode() {
    var input = $('in').value;
    rows = parse(input);
    var nonEmpty = input.split(/\r?\n/).filter(function (l) { return l.trim(); });
    var withCode = {};
    rows.forEach(function (r) { withCode[r.line] = 1; });
    var missed = [];
    var lines = input.split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) if (lines[i].trim() && !withCode[i + 1]) missed.push(i + 1);
    $('errors').innerHTML = missed.length && nonEmpty.length
      ? '<p class="err">No app code found on line' + (missed.length > 1 ? 's ' : ' ') + esc(missed.slice(0, 20).join(', ')) + (missed.length > 20 ? ', and more' : '') + '.</p>'
      : '';
    render();
    $('btn-csv').disabled = !rows.length;
  }

  function render() {
    if (!rows.length) { $('summary').hidden = true; $('rows').hidden = true; return; }
    var cols = ['line', 'app_code', 'pilot', 'version', 'location', 'camera', 'microphone'];
    var html = '<table><thead><tr>' + cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>';
    rows.forEach(function (r) { html += '<tr>' + cols.map(function (c) { return '<td>' + esc(r[c]) + '</td>'; }).join('') + '</tr>'; });
    html += '</tbody></table>';
    $('rows-table').innerHTML = html;
    $('rows').hidden = false;

    // Allow rate by version, pilot rows left out. Only prompts that were shown count as decisions.
    var real = rows.filter(function (r) { return r.pilot === 'no'; });
    var s = '<table><thead><tr><th>Permission</th><th>Version</th><th>Prompts shown</th><th>Allow</th><th>Allow %</th><th>Prompt not shown</th></tr></thead><tbody>';
    PERMS.forEach(function (p) {
      ['A', 'B'].forEach(function (v) {
        var group = real.filter(function (r) { return r.version === v; });
        var shown = group.filter(function (r) { return r[p] !== OUTCOME.N; });
        var allow = shown.filter(function (r) { return r[p] === OUTCOME.A; });
        s += '<tr><td>' + esc(p) + '</td><td>' + v + '</td><td>' + shown.length + '</td><td>' + allow.length + '</td><td>' +
          (shown.length ? Math.round(100 * allow.length / shown.length) + '%' : '') + '</td><td>' + (group.length - shown.length) + '</td></tr>';
      });
    });
    s += '</tbody></table>';
    var pilots = rows.length - real.length;
    s += '<p class="legend">' + real.length + ' code(s) counted' + (pilots ? ', ' + pilots + ' pilot code(s) left out' : '') +
      '. Version A: ' + real.filter(function (r) { return r.version === 'A'; }).length +
      '. Version B: ' + real.filter(function (r) { return r.version === 'B'; }).length + '.</p>';
    $('summary-table').innerHTML = s;
    $('summary').hidden = false;
  }

  function csv(v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function downloadCSV() {
    var cols = ['line', 'app_code', 'pilot', 'version', 'location', 'camera', 'microphone'];
    var lines = [cols.join(',')].concat(rows.map(function (r) { return cols.map(function (c) { return csv(r[c]); }).join(','); }));
    var blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'studyspot-codes-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  $('btn-decode').addEventListener('click', decode);
  $('btn-csv').addEventListener('click', downloadCSV);
  $('btn-clear').addEventListener('click', function () { $('in').value = ''; rows = []; render(); $('errors').innerHTML = ''; $('btn-csv').disabled = true; });
})();
