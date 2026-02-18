try { console.log('[ATP][LOAD] utilitarios.js carregado com sucesso'); } catch (e) { }

const clean = (x) => {
  const s = (typeof x === 'string') ? x : ((x && x.textContent) ? x.textContent : '');
  return s.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
};

const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

const lower = (x) => clean(x).toLowerCase();

const rmAcc = (v) => {
  const s0 = (v == null) ? '' : String(v);
  return s0.normalize ? s0.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : s0;
};

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

// ---- exprCanon (canonicaliza string ou {canonical}) ----
const exprCanon = (expr, fallback) => {
  const base = (expr && typeof expr === 'object') ? (expr.canonical || '') : (expr || '');
  const out = clean(base);
  return out || (fallback == null ? '' : String(fallback));
};

// ---- exprTermSet (converte expr.clauses em Set<string> de termos) ----
const exprTermSet = (expr) => {
  const out = new Set();
  if (!expr) return out;
  if (typeof expr === 'string') { const t = clean(expr); if (t) out.add(t); return out; }
  const clauses = expr.clauses;
  if (!clauses || !clauses.length) {
    const t = clean(expr.canonical || '');
    if (t) out.add(t);
    return out;
  }
  for (const c of clauses) {
    if (!c) continue;
    if (c instanceof Set) { for (const v of c) { const t = clean(v); if (t) out.add(t); } continue; }
    if (Array.isArray(c)) { for (const v of c) { const t = clean(v); if (t) out.add(t); } continue; }
    const t = clean(String(c));
    if (t) out.add(t);
  }
  return out;
};

// ---- normKey (normaliza label para chave estável) ----
function normKey(label) {
  const k = (label || '').replace(/:/g, '').trim();
  const noAcc = rmAcc(k).toLowerCase();
  return noAcc.replace(/[^a-z0-9]/g, '') || null;
}

// Alias para compatibilidade (extract_dados.js usa normalizarChave)
const normalizarChave = normKey;

// ---- parsePriority (converte prioridade em objeto) ----
function parsePriority(p) {
  const s = String(p ?? '').trim();
  const m = s.match(/\d+/);
  return m ? { raw: s, num: Number(m[0]), text: s } : { raw: s || '[*]', num: null, text: s || '[*]' };
}

// ---- splitVals (converte "a, b | c" etc em Set normalizado) ----
function splitVals(raw) {
  const base = rmAcc(lower(raw || ''))
    .replace(/[.;]\s*$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (!base) return new Set();
  const tokens = base.split(/;|\||,|\s+ou\s+|\s+e\s+/i).map(s => s.trim()).filter(Boolean);
  return new Set(tokens);
}

// ---- setsEqual (compara Sets) ----
function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

// ---- parseTooltipMsg (extrai mensagem do infraTooltipMostrar) ----
function parseTooltipMsg(onm) {
  const raw = String(onm || '');
  const m = raw.match(/infraTooltipMostrar\(\s*(?:'([^']*)'|"([^"]*)")\s*,\s*(?:'Comportamento do Localizador REMOVER'|"Comportamento do Localizador REMOVER")/);
  const msg = m ? (m[1] ?? m[2] ?? '') : '';
  let decoded = msg;
  try { decoded = msg.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'); } catch { }
  return clean(decoded);
}

const atpTrunc = (s, max) => {
  s = String(s || '');
  if (s.length <= max) return s;
  return s.slice(0, Math.max(0, max - 1)).trimEnd() + '…';
};

const ensureCss = (cssUrls) => {
  const CSS_URLS = Array.isArray(cssUrls) ? cssUrls : [];
  for (const href of CSS_URLS) {
    if (document.querySelector('link[data-atp-bpmnjs][href="' + href + '"]')) continue;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute('data-atp-bpmnjs', '1');
    document.head.appendChild(link);
  }

  if (!document.getElementById('atpBpmnJsMarkerCss')) {
    const st = document.createElement('style');
    st.id = 'atpBpmnJsMarkerCss';
    st.textContent = [
      '.atp-bpmnjs-wrap{position:relative;width:100%;height:100%;}',
      '.atp-bpmnjs-canvas{width:100%;height:100%;background:#fff;}',
      '.atp-bpmnjs-canvas .djs-container{height:100% !important;}',
      '.atp-bpmnjs-canvas .djs-palette{z-index:3;}',
      '.djs-container .atp-bpmn-highlight .djs-visual > :nth-child(1){fill:#fde047 !important;stroke:#f59e0b !important;stroke-width:4px !important;}',
      '.djs-container .atp-bpmn-highlight .djs-visual > text{font-weight:700 !important;}'
    ].join('\n');
    document.head.appendChild(st);
  }
};

const xmlSanitize = (s) => {
  const str = String(s == null ? '' : s);
  let out = '';
  for (const ch of str) {
    const cp = ch.codePointAt(0);
    const ok = (cp === 0x9 || cp === 0xA || cp === 0xD ||
      (cp >= 0x20 && cp <= 0xD7FF) ||
      (cp >= 0xE000 && cp <= 0xFFFD) ||
      (cp >= 0x10000 && cp <= 0x10FFFF));
    if (ok) out += ch;
  }
  return out;
};

function hashCode(str) {
  str = String(str == null ? '' : str);
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0; }
  return h;
}

const makeId = (prefix, raw) => {
  const base = norm(raw).toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  return prefix + '_' + (base || 'x') + '_' + Math.abs(hashCode(raw)).toString(36);
};

function valToStr(v) {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return norm(String(v));

  if (typeof v === 'object') {
    if (v.canonical) return norm(String(v.canonical));
    if (v.text) return norm(String(v.text));
    if (v.raw) return norm(String(v.raw));

    if (Array.isArray(v)) {
      const arr = v.map(valToStr).filter(Boolean);
      return arr.join(', ');
    }
    if (v instanceof Set) {
      const arr = Array.from(v).map(valToStr).filter(Boolean);
      return arr.join(' && ');
    }

    try {
      const shallow = {};
      for (const [k2, v2] of Object.entries(v)) {
        const kk = norm(String(k2 || ''));
        if (!kk) continue;
        if (IGNORE_KEYS.has(kk.toLowerCase())) continue;
        const vv = valToStr(v2);
        if (!vv) continue;
        shallow[kk] = vv;
      }
      const keys = Object.keys(shallow);
      if (keys.length) {
        return keys.map(k => `${k}=${shallow[k]}`).join('; ');
      }
    } catch (e) { }
  }

  const s = norm(String(v));
  if (/^\[object\s+.*\]$/i.test(s)) return '';
  return s;
}

const truncateBpmnName = (s, max) => {
  const str = String(s == null ? '' : s);
  const m = Math.max(10, Number(max) || 420);
  if (str.length <= m) return str;
  return str.slice(0, m - 3) + '...';
};

const truncateBpmnDoc = (s, max) => {
  const str = String(s == null ? '' : s);
  const m = Math.max(100, Number(max) || 5000);
  if (str.length <= m) return str;
  return str.slice(0, m - 3) + '...';
};

function __atpKeyTokens(k) {
  return String(k || '').split('&&').map(t => String(t).trim()).filter(Boolean);
}

function __atpJoinTokens(tokens) {
  const arr = (tokens || []).map(t => String(t).trim()).filter(Boolean);
  arr.sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));
  return arr.join(' && ');
}

function __atpPickBestBaseKey(childKey, allFromSet, allToSet) {
  const allFrom = allFromSet instanceof Set ? allFromSet : new Set();
  const allTo = allToSet instanceof Set ? allToSet : new Set();

  const toks = __atpKeyTokens(childKey);
  if (toks.length < 2) return null;

  let best = null;
  let bestLen = 0;

  for (let i = 0; i < toks.length; i++) {
    const sub = toks.slice(0, i).concat(toks.slice(i + 1));
    if (sub.length < 1) continue;

    const k = __atpJoinTokens(sub);
    if (!allTo.has(k) && !allFrom.has(k)) continue;

    if (sub.length > bestLen) {
      best = k;
      bestLen = sub.length;
    }
  }

  return best;
}

const __atpKeyTokens2 = __atpKeyTokens;
const __atpJoinTokens2 = __atpJoinTokens;
const __atpPickBestBaseKey2 = __atpPickBestBaseKey;

const rectOverlap = (a, b, pad) => {
  const ax1 = a.x - pad, ay1 = a.y - pad, ax2 = a.x + a.w + pad, ay2 = a.y + a.h + pad;
  const bx1 = b.x - pad, by1 = b.y - pad, bx2 = b.x + b.w + pad, by2 = b.y + b.h + pad;
  return ax1 < bx2 && ax2 > bx1 && ay1 < by2 && ay2 > by1;
};

const resolveOverlaps = (posMap, gapY) => {
  const pad = 10;
  const entries = Array.from(posMap.entries()).map(([id, r]) => ({ id, x: r.x, y: r.y, w: r.w, h: r.h }));
  entries.sort((a, b) => (a.x - b.x) || (a.y - b.y) || a.id.localeCompare(b.id));
  for (let i = 0; i < entries.length; i++) {
    const a = entries[i];
    let moved = true;
    while (moved) {
      moved = false;
      for (let j = 0; j < i; j++) {
        const b = entries[j];
        if (rectOverlap(a, b, pad)) {
          a.y = b.y + b.h + gapY;
          moved = true;
        }
      }
    }
  }
  for (const e of entries) posMap.set(e.id, { x: e.x, y: e.y, w: e.w, h: e.h });
};

function pairKey(tipo, a, b) {
  if (String(b) === '(Própria Regra)' || String(b) === '(própria regra)') {
    return String(tipo) + '|' + String(a || '') + '|SELF';
  }
  var an = Number(a), bn = Number(b);
  if (Number.isFinite(an) && Number.isFinite(bn)) {
    var lo = Math.min(an, bn);
    var hi = Math.max(an, bn);
    return String(tipo) + '|' + String(lo) + '|' + String(hi);
  }
  var as = String(a || '');
  var bs = String(b || '');
  var loS = (as <= bs) ? as : bs;
  var hiS = (as <= bs) ? bs : as;
  return String(tipo) + '|' + loS + '|' + hiS;
}

const ATP_LOADING_ID = 'atp-loading-overlay';

function showATPLoading() {
  try {
    if (document.getElementById(ATP_LOADING_ID)) return;

    const overlay = document.createElement('div');
    overlay.id = ATP_LOADING_ID;
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 999999;
      background: rgba(243, 244, 246, 0.85);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: Arial, Helvetica, sans-serif;
    `;

    overlay.innerHTML = `
      <div style="
        background: #ffffff;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        padding: 24px 32px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.15);
        text-align: center;
        min-width: 320px;
      ">
        <div style="
          width: 42px;
          height: 42px;
          margin: 0 auto 16px;
          border: 4px solid #e5e7eb;
          border-top-color: #2563eb;
          border-radius: 50%;
          animation: atp-spin 1s linear infinite;
        "></div>

        <div style="font-size: 15px; font-weight: bold; color: #111827;">
          Análise de ATP – eProc
        </div>
        <div id="atpLoadingMsg" style="font-size: 13px; color: #374151; margin-top: 6px;">
          Aguardando carregamento completo do eProc…
        </div>
      </div>
    `;

    if (!document.getElementById('atp-loading-style')) {
      const style = document.createElement('style');
      style.id = 'atp-loading-style';
      style.textContent = `
        @keyframes atp-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `;
      (document.head || document.documentElement).appendChild(style);
    }

    (document.documentElement || document.body).appendChild(overlay);

    window.__ATP_LOADING_TIMEOUT__ = setTimeout(() => {
      try {
        const el = document.getElementById(ATP_LOADING_ID);
        if (el) el.remove();
        window.__ATP_LOADING_HIDDEN__ = true;
      } catch { }
    }, 120000);
  } catch { }
}

function setATPLoadingMsg(msg) {
  try {
    const el = document.getElementById('atpLoadingMsg');
    if (el) el.textContent = msg;
  } catch { }
}

function hideATPLoading() {
  try {
    if (window.__ATP_LOADING_HIDDEN__) return;
    const overlay = document.getElementById(ATP_LOADING_ID);
    if (overlay) overlay.remove();
    window.__ATP_LOADING_HIDDEN__ = true;

    if (window.__ATP_LOADING_TIMEOUT__) {
      clearTimeout(window.__ATP_LOADING_TIMEOUT__);
      window.__ATP_LOADING_TIMEOUT__ = null;
    }
    if (window.__ATP_LOADING_HIDE_TIMER__) {
      clearTimeout(window.__ATP_LOADING_HIDE_TIMER__);
      window.__ATP_LOADING_HIDE_TIMER__ = null;
    }
  } catch { }
}

function markATPRenderTick() {
  try {
    window.__ATP_LAST_RENDER_TS__ = Date.now();
    window.__ATP_RENDER_COUNT__ = (window.__ATP_RENDER_COUNT__ || 0) + 1;
    scheduleHideATPLoading(1800);
  } catch { }
}

function scheduleHideATPLoading(silenceMs = 1800) {
  try {
    if (window.__ATP_LOADING_HIDDEN__) return;

    if (window.__ATP_LOADING_HIDE_TIMER__) {
      clearTimeout(window.__ATP_LOADING_HIDE_TIMER__);
    }

    window.__ATP_LOADING_HIDE_TIMER__ = setTimeout(() => {
      try {
        window.__ATP_LOADING_HIDE_TIMER__ = null;

        if (!window.__ATP_PAGE_LOADED__) return;
        if ((window.__ATP_RENDER_COUNT__ || 0) < 1) return;

        const last = window.__ATP_LAST_RENDER_TS__ || 0;
        if (Date.now() - last < silenceMs) {
          scheduleHideATPLoading(silenceMs);
          return;
        }

        const hasReportBtn = !!document.getElementById('btnGerarRelatorioColisoes');
        const hasAnyConflictCell = !!document.querySelector('#tableAutomatizacaoLocalizadores td[data-atp-cell="conflito"], #tableAutomatizacaoLocalizadores td.atp-cell-conflito');
        if (hasReportBtn || hasAnyConflictCell) {
          hideATPLoading();
        } else {
          scheduleHideATPLoading(silenceMs);
        }
      } catch { }
    }, silenceMs);
  } catch { }
}

function atpEnsureJSZip() {
  return new Promise(function (resolve, reject) {
    try {
      if (window.JSZip) return resolve(window.JSZip);

      var existing = document.getElementById('atp_jszip_loader');
      if (existing) {
        var tries = 0;
        var t = setInterval(function () {
          tries++;
          if (window.JSZip) { clearInterval(t); return resolve(window.JSZip); }
          if (tries > 80) { clearInterval(t); return reject(new Error('Timeout carregando JSZip')); }
        }, 100);
        return;
      }

      var sc = document.createElement('script');
      sc.id = 'atp_jszip_loader';
      sc.async = true;
      sc.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
      sc.onload = function () {
        if (window.JSZip) resolve(window.JSZip);
        else reject(new Error('JSZip carregou, mas window.JSZip não está disponível'));
      };
      sc.onerror = function () { reject(new Error('Falha ao carregar JSZip (CDN)')); };
      (document.head || document.documentElement).appendChild(sc);
    } catch (e) {
      reject(e);
    }
  });
}

function schedule(fn, wait = 200) {
  if (window.__ATP_SCHEDULE_TIMER__) clearTimeout(window.__ATP_SCHEDULE_TIMER__);
  window.__ATP_SCHEDULE_TIMER__ = setTimeout(fn, wait);
}

const __atpReadyState = new WeakMap();

function atpIsTablePopulated(table) {
  try {
    const tb = table && table.tBodies && table.tBodies[0];
    if (!tb) return false;

    const rows = Array.from(tb.rows || []).filter(r => r && r.cells && r.cells.length >= 6);
    if (!rows.length) return false;

    const sample = [];
    const n = rows.length;
    const pick = (k) => rows[Math.min(n - 1, Math.max(0, k))];
    sample.push(pick(0));
    sample.push(pick(Math.floor(n * 0.25)));
    sample.push(pick(Math.floor(n * 0.50)));
    sample.push(pick(Math.floor(n * 0.75)));
    sample.push(pick(n - 1));

    let ok = 0;
    for (const tr of sample) {
      if (!tr || !tr.cells) continue;
      const cells = Array.from(tr.cells);

      const slice = cells.slice(1, Math.max(2, cells.length - 1));
      const textLen = slice.reduce((acc, td) => acc + ((td && td.textContent) ? td.textContent.trim().length : 0), 0);

      const hasSignals =
        tr.querySelector('[id^="dadosResumidos_"],[id^="dadosCompletos_"]') ||
        tr.querySelector('.selPrioridade') ||
        /\bPor\s+(Evento|Documento|Data|Tempo|Tipo)\b/i.test(tr.textContent || '') ||
        /Executar\s+Ação\s+Programada/i.test(tr.textContent || '');

      if (textLen >= 40 && hasSignals) ok++;
    }

    return ok >= 2;
  } catch (e) { }
  return false;
}

function atpWaitTablePopulationOrRetry(table) {
  try {
    if (!table) return false;

    const now = Date.now();
    const st = __atpReadyState.get(table) || { t0: now, tries: 0 };
    st.tries++;
    __atpReadyState.set(table, st);

    if (atpIsTablePopulated(table)) return true;
    if ((now - st.t0) > 12000) return true;

    return false;
  } catch (e) { }
  return true;
}

try { console.log('[ATP][OK] utilitarios.js inicializado'); } catch (e) { }
