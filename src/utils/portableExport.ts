import { ReadableEquation } from '../types';
import { formatEquationForCopy } from './mathContext';

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Generates a self-contained single-file HTML workbook + interactive Matrix Solver
 * and expression calculator that runs 100% locally offline via file:// on any PC.
 */
export function buildPortableOfflineAppHtml(
  equations: ReadableEquation[],
  initialSolverLines?: string[]
): string {
  const safeEqCards = equations
    .map((eq, idx) => {
      const title = escapeHtml(eq.title || `Equation ${idx + 1}`);
      const mathml = formatEquationForCopy(eq.latex, 'mathml');
      const plain = escapeHtml(eq.plain);
      return `<article class="eq-card">
        <div class="eq-head">
          <span class="eq-title">${title}</span>
          <button type="button" class="btn-mini" data-apply="${plain}">Apply to Solver</button>
        </div>
        <div class="eq-math">${mathml}</div>
        <code class="eq-plain">${plain}</code>
      </article>`;
    })
    .join('\n');

  const defaultLines = (
    initialSolverLines && initialSolverLines.length > 0
      ? initialSolverLines
      : ['2*x + y = 5', 'x - y = 1']
  ).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Lecture Scratchpad — Offline Local Edition</title>
  <style>
    :root {
      --bg: #f7f5fc;
      --card: #ffffff;
      --ink: #18122b;
      --muted: #5c5470;
      --border: #dfd8f3;
      --violet: #7c3aed;
      --violet-dark: #5b21b6;
      --violet-soft: #f2ecff;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--bg);
      color: var(--ink);
      line-height: 1.5;
    }
    header {
      background: linear-gradient(135deg, #5b21b6 0%, #7c3aed 55%, #9333ea 100%);
      color: #ffffff;
      padding: 24px 28px 0 28px;
    }
    header h1 { margin: 0 0 4px 0; font-size: 22px; letter-spacing: -0.01em; }
    header p { margin: 0 0 18px 0; font-size: 13px; color: #ede9fe; }
    .wave { display: block; width: 100%; height: 34px; }
    main {
      max-width: 1120px;
      margin: 24px auto;
      padding: 0 20px 40px 20px;
      display: grid;
      grid-template-columns: 1.15fr 0.85fr;
      gap: 20px;
    }
    @media (max-width: 860px) { main { grid-template-columns: 1fr; } }
    .panel {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 18px;
    }
    h2 { margin: 0 0 12px 0; font-size: 15px; }
    textarea, input[type="text"] {
      width: 100%;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 13px;
      padding: 10px 12px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: #fcfbfe;
      color: var(--ink);
    }
    .btn {
      background: var(--violet);
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 9px 14px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn:hover { background: var(--violet-dark); }
    .btn-mini {
      background: var(--violet-soft);
      color: var(--violet-dark);
      border: 1px solid #d4c4fb;
      border-radius: 6px;
      padding: 4px 10px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    .row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; align-items: center; }
    .eq-card {
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 12px 14px;
      margin-bottom: 10px;
      background: #ffffff;
    }
    .eq-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 6px; }
    .eq-title { font-size: 12px; font-weight: 600; color: var(--muted); }
    .eq-math { font-size: 18px; overflow-x: auto; padding: 4px 0; }
    .eq-plain { display: block; font-size: 11px; color: var(--muted); margin-top: 4px; word-break: break-all; }
    .result-box {
      margin-top: 14px;
      padding: 12px 14px;
      border-radius: 8px;
      background: var(--violet-soft);
      border: 1px solid #d4c4fb;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 13px;
      white-space: pre-wrap;
    }
    .note {
      margin-top: 14px;
      font-size: 12px;
      color: var(--muted);
      border-top: 1px solid var(--border);
      padding-top: 10px;
    }
  </style>
</head>
<body>
  <header>
    <h1>Lecture Scratchpad — Local Offline Workbook</h1>
    <p>Self-contained HTML copy for your PC. Runs offline via file:// with built-in Matrix Solver &amp; Expression Calculator.</p>
    <svg class="wave" viewBox="0 0 1200 60" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0,25 C220,62 420,-8 650,28 C880,62 1030,4 1200,30 L1200,60 L0,60 Z" fill="#f7f5fc"></path>
    </svg>
  </header>

  <main>
    <section class="panel">
      <h2>Offline Matrix &amp; System Solver</h2>
      <textarea id="sys-input" rows="5" aria-label="Equations to solve">${escapeHtml(defaultLines)}</textarea>
      <div class="row">
        <button type="button" class="btn" id="solve-btn">Solve Matrix System</button>
        <button type="button" class="btn-mini" data-preset="2*x + y = 5&#10;x - y = 1">Unique</button>
        <button type="button" class="btn-mini" data-preset="x + y + z = 6&#10;2*x - y + z = 3">Many Solutions</button>
        <button type="button" class="btn-mini" data-preset="x + y = 4&#10;2*x + 2*y = 10">No Solution</button>
      </div>
      <div id="sys-output" class="result-box">Click "Solve Matrix System" to compute Ax = b, RREF, and solutions.</div>

      <h2 style="margin-top:20px;">Quick Expression Calculator</h2>
      <div class="row" style="margin-top:0;">
        <input id="calc-input" type="text" value="5/2 + sqrt(3^2 + 4^2)" aria-label="Expression" style="flex:1;" />
        <button type="button" class="btn" id="calc-btn">=</button>
      </div>
      <div id="calc-output" class="result-box">Result: 7.5</div>

      <p class="note">
        <strong>Local PC Note:</strong> Matrix solving, expression evaluation, and viewing saved equations work 100% offline in this file. Handwriting photo OCR requires the online Lecture Scratchpad server with Gemini API key.
      </p>
    </section>

    <section class="panel">
      <h2>Saved Equations (${equations.length})</h2>
      ${safeEqCards || '<p style="font-size:13px;color:var(--muted);">No saved equations yet.</p>'}
    </section>
  </main>

  <script>
    (function () {
      function prepExpr(s) {
        var out = s.trim()
          .replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-')
          .replace(/\\^/g, '**')
          .replace(/(\\d+(?:\\.\\d+)?)([fpnumkKMGT])\\b/g, function (_, num, suf) {
            var map = { f:'e-15', p:'e-12', n:'e-9', u:'e-6', m:'e-3', k:'e3', K:'e3', M:'e6', G:'e9', T:'e12' };
            return map[suf] ? '(' + num + map[suf] + ')' : num;
          })
          .replace(/\\bsqrt\\(/g, 'Math.sqrt(')
          .replace(/\\babs\\(/g, 'Math.abs(')
          .replace(/\\bpi\\b/g, 'Math.PI');
        return out;
      }

      function evalWithScope(expr, scope) {
        var keys = Object.keys(scope);
        var vals = keys.map(function (k) { return scope[k]; });
        var fn = new Function(keys.join(','), 'return (' + prepExpr(expr) + ');');
        return fn.apply(null, vals);
      }

      function fmt(v) {
        if (Math.abs(v) < 1e-10) return '0';
        if (Math.abs(v - Math.round(v)) < 1e-9) return String(Math.round(v));
        return Number(v.toPrecision(5)).toString();
      }

      function solveSystem() {
        var raw = document.getElementById('sys-input').value.split(/\\r?\\n/).map(function (s) { return s.trim(); }).filter(Boolean);
        var outEl = document.getElementById('sys-output');
        if (raw.length === 0) { outEl.textContent = 'Enter one equation per line.'; return; }
        var vars = [];
        var seen = {};
        var pairs = [];
        for (var i = 0; i < raw.length; i++) {
          var parts = raw[i].split('=');
          if (parts.length !== 2) { outEl.textContent = 'Invalid equation: ' + raw[i]; return; }
          pairs.push([parts[0], parts[1]]);
          var matches = raw[i].match(/\\b[A-Za-z][A-Za-z0-9_]*\\b/g) || [];
          for (var j = 0; j < matches.length; j++) {
            var tok = matches[j];
            if (tok === 'sqrt' || tok === 'abs' || tok === 'pi') continue;
            if (!seen[tok]) { seen[tok] = true; vars.push(tok); }
          }
        }
        var n = vars.length;
        var m = pairs.length;
        var aug = [];
        for (var r = 0; r < m; r++) {
          var z = {}; vars.forEach(function (v) { z[v] = 0; });
          var c0 = evalWithScope(pairs[r][0], z) - evalWithScope(pairs[r][1], z);
          var row = [];
          for (var c = 0; c < n; c++) {
            var u = {}; vars.forEach(function (v) { u[v] = 0; }); u[vars[c]] = 1;
            row.push(evalWithScope(pairs[r][0], u) - evalWithScope(pairs[r][1], u) - c0);
          }
          row.push(-c0);
          aug.push(row);
        }
        var pivots = [];
        var pr = 0;
        for (var col = 0; col < n && pr < m; col++) {
          var best = pr;
          for (var rr = pr + 1; rr < m; rr++) {
            if (Math.abs(aug[rr][col]) > Math.abs(aug[best][col])) best = rr;
          }
          if (Math.abs(aug[best][col]) < 1e-9) continue;
          var tmp = aug[pr]; aug[pr] = aug[best]; aug[best] = tmp;
          var div = aug[pr][col];
          for (var cc = col; cc <= n; cc++) aug[pr][cc] /= div;
          for (var rr2 = 0; rr2 < m; rr2++) {
            if (rr2 === pr) continue;
            var fac = aug[rr2][col];
            for (var cc2 = col; cc2 <= n; cc2++) aug[rr2][cc2] -= fac * aug[pr][cc2];
          }
          pivots.push(col);
          pr++;
        }
        var inconsistent = false;
        for (var rr3 = pr; rr3 < m; rr3++) {
          if (Math.abs(aug[rr3][n]) > 1e-8) inconsistent = true;
        }
        var matStr = aug.map(function (row) {
          return '[ ' + row.slice(0, n).map(fmt).join(', ') + ' | ' + fmt(row[n]) + ' ]';
        }).join('\\n');
        if (inconsistent) {
          outEl.textContent = 'NO SOLUTION (Inconsistent — nothing satisfies all equations)\\n\\nRREF [A | b]:\\n' + matStr;
          return;
        }
        var free = [];
        for (var c2 = 0; c2 < n; c2++) if (pivots.indexOf(c2) === -1) free.push(c2);
        var part = new Array(n).fill(0);
        for (var k = 0; k < pivots.length; k++) part[pivots[k]] = aug[k][n];
        if (free.length === 0) {
          var lines = vars.map(function (v, idx) { return v + ' = ' + fmt(part[idx]); });
          outEl.textContent = 'UNIQUE SOLUTION:\\n' + lines.join('\\n') + '\\n\\nRREF [A | b]:\\n' + matStr;
          return;
        }
        var basis = free.map(function (fc) {
          var vec = new Array(n).fill(0); vec[fc] = 1;
          for (var k2 = 0; k2 < pivots.length; k2++) vec[pivots[k2]] = -aug[k2][fc];
          return vec;
        });
        var samples = [0, 1, -1].map(function (t) {
          return 't=' + t + ': ' + vars.map(function (v, idx) {
            var val = part[idx];
            for (var bi = 0; bi < basis.length; bi++) val += t * basis[bi][idx];
            return v + '=' + fmt(val);
          }).join(', ');
        });
        outEl.textContent = 'MANY SOLUTIONS (' + free.length + ' free variable(s))\\nSample solutions:\\n' + samples.join('\\n') + '\\n\\nRREF [A | b]:\\n' + matStr;
      }

      document.getElementById('solve-btn').addEventListener('click', function () {
        try { solveSystem(); } catch (e) { document.getElementById('sys-output').textContent = 'Error: ' + e.message; }
      });
      document.getElementById('calc-btn').addEventListener('click', function () {
        try {
          var v = evalWithScope(document.getElementById('calc-input').value, {});
          document.getElementById('calc-output').textContent = 'Result: ' + fmt(v);
        } catch (e) {
          document.getElementById('calc-output').textContent = 'Error: ' + e.message;
        }
      });
      document.querySelectorAll('[data-preset]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          document.getElementById('sys-input').value = btn.getAttribute('data-preset');
          solveSystem();
        });
      });
      document.querySelectorAll('[data-apply]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var eq = btn.getAttribute('data-apply');
          var el = document.getElementById('sys-input');
          el.value = el.value.trim() ? el.value.trim() + '\\n' + eq : eq;
        });
      });
    })();
  </script>
</body>
</html>
`;
}

export function buildJsonBackupPayload(equations: ReadableEquation[]): string {
  return JSON.stringify(
    {
      app: 'Lecture Scratchpad',
      exportedAt: new Date().toISOString(),
      equations,
    },
    null,
    2
  );
}
