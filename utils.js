try { console.log('[ATP][LOAD] utils.js carregado com sucesso'); } catch (e) {}
/**
 * ATP MODULAR - utils.js
 * Funções utilitárias compartilhadas (DOM, texto, normalização, helpers gerais).
 * (Agrupadas a partir dos módulos)
 */
// ---- norm (normaliza string) ----
const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); // Normaliza espaços e trim.



// ---- atpTrunc (movido de 01_bpmn_modal_and_core.js) ----
const atpTrunc = (s, max) => { // Executa trunc.
              s = String(s || '');
              if (s.length <= max) return s;
              return s.slice(0, Math.max(0, max - 1)).trimEnd() + '…';
            };

            


// ---- applyTruncation (movido de 01_bpmn_modal_and_core.js) ----
const applyTruncation = () => { // Aplica truncation.
              if (!modeling) return;
              try {
                const all = elementRegistry.getAll ? elementRegistry.getAll() : [];
                for (const el of all) {
                  const bo = el && el.businessObject;
                  if (!bo) continue;
                  const nm = bo.name;
                  if (!nm || typeof nm !== 'string') continue;
                  if (nm.length <= ATP_MODAL_LABEL_MAX) continue;
                  if (!_origNames.has(el.id)) _origNames.set(el.id, nm);
                  const shortNm = atpTrunc(nm, ATP_MODAL_LABEL_MAX);
                  try { modeling.updateProperties(el, { name: shortNm }); } catch (e) {}
                }
              } catch (e) {}
            };

            


// ---- restoreOriginalNames (movido de 01_bpmn_modal_and_core.js) ----
const restoreOriginalNames = () => { // Executa restore original names.
              if (!modeling) return;
              try {
                for (const [id, nm] of _origNames.entries()) {
                  const el = elementRegistry.get(id);
                  if (!el) continue;
                  try { modeling.updateProperties(el, { name: nm }); } catch (e) {}
                }
              } catch (e) {}
            };

            


// ---- applyZoom (movido de 01_bpmn_modal_and_core.js) ----
const applyZoom = (v) => { // Aplica zoom.
              try {
                zoomValue = clamp(v, 0.2, 4);
                canvas.zoom(zoomValue);
                zoomLabel.textContent = Math.round(zoomValue * 100) + '%';
              } catch (e) {}
            };

            


// ---- ensureCss (movido de 01_bpmn_modal_and_core.js) ----
const ensureCss = (cssUrls) => { // Injeta CSSs necessários do bpmn-js (recebe URLs por parâmetro).
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
          '.djs-container .atp-bpmn-highlight .djs-visual > :nth-child(1){stroke:#f59e0b !important;stroke-width:4px !important;}',
          '.djs-container .atp-bpmn-highlight .djs-visual > text{font-weight:700 !important;}'
        ].join('\n');
        document.head.appendChild(st);
      }
    };

    


// ---- showATPLoading (movido de 01_bpmn_modal_and_core.js) ----
function showATPLoading() { // Executa show atp loading.
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

    // timeout de segurança (2 min)
    window.__ATP_LOADING_TIMEOUT__ = setTimeout(() => {
      try {
        const el = document.getElementById(ATP_LOADING_ID);
        if (el) el.remove();
        window.__ATP_LOADING_HIDDEN__ = true;
      } catch {}
    }, 120000);
  } catch {}
}


// ---- setATPLoadingMsg (movido de 01_bpmn_modal_and_core.js) ----
function setATPLoadingMsg(msg) { // Define o atp loading msg.
  try {
    const el = document.getElementById('atpLoadingMsg');
    if (el) el.textContent = msg;
  } catch {}
}


// ---- hideATPLoading (movido de 01_bpmn_modal_and_core.js) ----
function hideATPLoading() { // Executa hide atp loading.
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
  } catch {}
}


// ---- markATPRenderTick (movido de 01_bpmn_modal_and_core.js) ----
function markATPRenderTick() { // Executa mark atp Renderiza tick.
  try {
    window.__ATP_LAST_RENDER_TS__ = Date.now();
    window.__ATP_RENDER_COUNT__ = (window.__ATP_RENDER_COUNT__ || 0) + 1;
    // sempre agenda hide; ele só efetiva depois do load + silêncio
    scheduleHideATPLoading(1800);
  } catch {}
}


// ---- scheduleHideATPLoading (movido de 01_bpmn_modal_and_core.js) ----
function scheduleHideATPLoading(silenceMs = 1800) { // Executa schedule hide atp loading.
  try {
    if (window.__ATP_LOADING_HIDDEN__) return;

    if (window.__ATP_LOADING_HIDE_TIMER__) {
      clearTimeout(window.__ATP_LOADING_HIDE_TIMER__);
    }

    window.__ATP_LOADING_HIDE_TIMER__ = setTimeout(() => {
      try {
        window.__ATP_LOADING_HIDE_TIMER__ = null;

        // 1) aguarda window.load
        if (!window.__ATP_PAGE_LOADED__) return;

        // 2) precisa ter renderizado ao menos 1x
        if ((window.__ATP_RENDER_COUNT__ || 0) < 1) return;

        // 3) silêncio após último tick
        const last = window.__ATP_LAST_RENDER_TS__ || 0;
        if (Date.now() - last < silenceMs) {
          scheduleHideATPLoading(silenceMs);
          return;
        }

        // 4) marcador de UI pronta (botão ou coluna/células)
        const hasReportBtn = !!document.getElementById('btnGerarRelatorioColisoes');
        const hasAnyConflictCell = !!document.querySelector('#tableAutomatizacaoLocalizadores td[data-atp-cell="conflito"], #tableAutomatizacaoLocalizadores td.atp-cell-conflito');
        if (hasReportBtn || hasAnyConflictCell) {
          hideATPLoading();
        } else {
          // se a UI ainda não apareceu, tenta novamente
          scheduleHideATPLoading(silenceMs);
        }
      } catch {}
    }, silenceMs);
  } catch {}
}


// ---- atpEnsureJSZip (movido de 04_fluxos_text_and_zip.js) ----
function atpEnsureJSZip() { // Garante js ZIP.
  return new Promise(function (resolve, reject) {
    try {
      if (window.JSZip) return resolve(window.JSZip);

      var existing = document.getElementById('atp_jszip_loader');
      if (existing) {
        // Já está carregando: aguarda
        var tries = 0;
        var t = setInterval(function () {

  // =========================
  // [ATP] Localizar Regra no Fluxo (Modal BPMN)
  // =========================
  let ATP_LAST_RULES = null;
  let ATP_BPMN_SPLIT_CACHE = null; // [{filename, xml}]
  let ATP_BPMN_SPLIT_CACHE_KEY = '';

  


  


  


  






  


  


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


// ---- __atpKeyTokens (movido de 04_fluxos_text_and_zip.js) ----
function __atpKeyTokens(k) { // Executa key tokens.
    return String(k || '').split('&&').map(t => String(t).trim()).filter(Boolean);
  }


// ---- __atpJoinTokens (movido de 04_fluxos_text_and_zip.js) ----
function __atpJoinTokens(tokens) { // Executa join tokens.
    const arr = (tokens || []).map(t => String(t).trim()).filter(Boolean);
    arr.sort((a,b)=>String(a).localeCompare(String(b), 'pt-BR'));
    return arr.join(' && ');
  }


// ---- __atpPickBestBaseKey (movido de 04_fluxos_text_and_zip.js) ----
function __atpPickBestBaseKey(childKey, allFromSet, allToSet) { // Escolhe a melhor "baseKey" para um nó refinado (A && B) usando sets locais.
    const allFrom = allFromSet instanceof Set ? allFromSet : new Set();
    const allTo   = allToSet   instanceof Set ? allToSet   : new Set();

    const toks = __atpKeyTokens(childKey);
    if (toks.length < 2) return null;

    let best = null;
    let bestLen = 0;

    for (let i = 0; i < toks.length; i++) {
      const sub = toks.slice(0, i).concat(toks.slice(i + 1));
      if (sub.length < 1) continue;

      const k = __atpJoinTokens(sub);
      // Só faz sentido se o "base" existir em algum lugar (foi incluído ou é origem real)
      if (!allTo.has(k) && !allFrom.has(k)) continue;

      if (sub.length > bestLen) {
        best = k;
        bestLen = sub.length;
      }
    }

    return best;
  }


// ---- xmlSanitize (movido de 05_bpmn_build_export.js) ----
const xmlSanitize = (s) => { // Executa xml sanitize.
  const str = String(s == null ? '' : s);
  let out = '';
  for (const ch of str) { // itera por codepoint
    const cp = ch.codePointAt(0);
    const ok = (cp === 0x9 || cp === 0xA || cp === 0xD ||
      (cp >= 0x20 && cp <= 0xD7FF) ||
      (cp >= 0xE000 && cp <= 0xFFFD) ||
      (cp >= 0x10000 && cp <= 0x10FFFF));
    if (ok) out += ch;
  }
  return out;
};




// ---- hashCode (movido de 05_bpmn_build_export.js) ----
function hashCode(str) { // Executa hash code.
      str = String(str == null ? '' : str);
      let h = 0;
      for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0; }
      return h;
    }


// ---- makeId (movido de 05_bpmn_build_export.js) ----
const makeId = (prefix, raw) => { // Executa make ID.
      const base = norm(raw).toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
      return prefix + '_' + (base || 'x') + '_' + Math.abs(hashCode(raw)).toString(36);
    };





// ---- valToStr (movido de 05_bpmn_build_export.js) ----
function valToStr(v) { // Executa val to str.
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
          } catch (e) {}
        }

        const s = norm(String(v));
        if (/^\[object\s+.*\]$/i.test(s)) return '';
        return s;
      }


// ---- truncateBpmnName (movido de 05_bpmn_build_export.js) ----
const truncateBpmnName = (s, max) => { // Executa truncate BPMN name.
      const str = String(s == null ? '' : s);
      const m = Math.max(10, Number(max) || 420);
      if (str.length <= m) return str;
      return str.slice(0, m - 3) + '...';
    };

    


// ---- truncateBpmnDoc (movido de 05_bpmn_build_export.js) ----
const truncateBpmnDoc = (s, max) => { // Executa truncate BPMN doc.
      const str = String(s == null ? '' : s);
      const m = Math.max(100, Number(max) || 5000);
      if (str.length <= m) return str;
      return str.slice(0, m - 3) + '...';
    };

    


// ---- __atpKeyTokens2 (movido de 05_bpmn_build_export.js) ----
function __atpKeyTokens2(k) { // Tokeniza chave composta por '&&' (versão 2).
    return String(k || '').split('&&').map(t => String(t).trim()).filter(Boolean);
  }


// ---- __atpJoinTokens2 (movido de 05_bpmn_build_export.js) ----
const __atpJoinTokens2 = (tokens) => { // Executa join tokens 2.
      const arr = (tokens || []).map(t => String(t).trim()).filter(Boolean);
      arr.sort((a,b)=>String(a).localeCompare(String(b), 'pt-BR'));
      return arr.join(' && ');
    };
    


// ---- __atpPickBestBaseKey2 (movido de 05_bpmn_build_export.js) ----
const __atpPickBestBaseKey2 = (childKey, allFromSet, allToSet) => { // Escolhe a melhor baseKey (versão 2) de forma pura (sem globals).
      const allFrom = allFromSet instanceof Set ? allFromSet : new Set();
      const allTo   = allToSet   instanceof Set ? allToSet   : new Set();

      const toks = __atpKeyTokens2(childKey);
      if (toks.length < 2) return null;

      let best = null;
      let bestLen = 0;

      for (let i = 0; i < toks.length; i++) {
        const sub = toks.slice(0, i).concat(toks.slice(i + 1));
        if (sub.length < 1) continue;

        const k = __atpJoinTokens2(sub);
        if (!allTo.has(k) && !allFrom.has(k)) continue;

        if (sub.length > bestLen) { best = k; bestLen = sub.length; }
      }

      return best;
    };

    


// ---- centerOf ----
// (removido do utils) centerOf depende de variáveis locais do builder BPMN (startId, maps de DI etc.).
// Agora é definido localmente dentro de 05_bpmn_build_export.js, para evitar dependências globais.

// ---- rectOverlap (movido de 05_bpmn_build_export.js) ----
const rectOverlap = (a, b, pad) => { // Executa rect overlap.
        const ax1 = a.x - pad, ay1 = a.y - pad, ax2 = a.x + a.w + pad, ay2 = a.y + a.h + pad;
        const bx1 = b.x - pad, by1 = b.y - pad, bx2 = b.x + b.w + pad, by2 = b.y + b.h + pad;
        return ax1 < bx2 && ax2 > bx1 && ay1 < by2 && ay2 > by1;
      };
      


// ---- resolveOverlaps (movido de 05_bpmn_build_export.js) ----
const resolveOverlaps = (posMap, gapY) => { // Executa resolve overlaps.
        const pad = 10;
        const entries = Array.from(posMap.entries()).map(([id, r]) => ({ id, x: r.x, y: r.y, w: r.w, h: r.h }));
        entries.sort((a, b) => (a.x - b.x) || (a.y - b.y) || a.id.localeCompare(b.id));
        for (let i = 0; i < entries.length; i++) {
          const a = entries[i];
          // push down until it stops colliding with any previous shape
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

      


// ---- pairKey (movido de 05_bpmn_build_export.js) ----
function pairKey(tipo, a, b) { // Executa pair key.
          // Contradição é intrarregra (self).
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


// ---- schedule (movido de 05_bpmn_build_export.js) ----
function schedule(fn, wait = 200) { // Debounce simples por setTimeout.
    if (tDebounce) clearTimeout(tDebounce); // Cancela anterior.
    tDebounce = setTimeout(fn, wait); // Agenda novo.
  }


// ---- atpIsTablePopulated (movido de 05_bpmn_build_export.js) ----
function atpIsTablePopulated(table) { // Executa is tabela populated.
    try {
      const tb = table && table.tBodies && table.tBodies[0];
      if (!tb) return false;

      const rows = Array.from(tb.rows || []).filter(r => r && r.cells && r.cells.length >= 6);
      if (!rows.length) return false;

      // Amostra 5 linhas (espalhadas) pra reduzir custo.
      const sample = [];
      const n = rows.length;
      const pick = (k) => rows[Math.min(n - 1, Math.max(0, k))]; // Executa pick.
      sample.push(pick(0));
      sample.push(pick(Math.floor(n * 0.25)));
      sample.push(pick(Math.floor(n * 0.50)));
      sample.push(pick(Math.floor(n * 0.75)));
      sample.push(pick(n - 1));

      let ok = 0;
      for (const tr of sample) {
        if (!tr || !tr.cells) continue;
        const cells = Array.from(tr.cells);

        // Ignora checkbox e ações (normalmente primeira e última).
        const slice = cells.slice(1, Math.max(2, cells.length - 1));

        const textLen = slice.reduce((acc, td) => acc + ((td && td.textContent) ? td.textContent.trim().length : 0), 0);

        // Sinais típicos do eProc quando já terminou de montar conteúdo.
        const hasSignals =
          tr.querySelector('[id^="dadosResumidos_"],[id^="dadosCompletos_"]') ||
          tr.querySelector('.selPrioridade') ||
          /\bPor\s+(Evento|Documento|Data|Tempo|Tipo)\b/i.test(tr.textContent || '') ||
          /Executar\s+Ação\s+Programada/i.test(tr.textContent || '');

        if (textLen >= 40 && hasSignals) ok++;
      }

      // Considera “pronto” se pelo menos 2/5 amostras parecem completas.
      return ok >= 2;
    } catch (e) {}
    return false;
  }


// ---- atpWaitTablePopulationOrRetry (movido de 05_bpmn_build_export.js) ----
function atpWaitTablePopulationOrRetry(table) { // Aguarda tabela population or retry.
    // Retorna true se pode prosseguir; false se deve re-agendar.
    try {
      if (!table) return false;

      const now = Date.now();
      const st = __atpReadyState.get(table) || { t0: now, tries: 0 };
      st.tries++;
      __atpReadyState.set(table, st);

      // Se já está populada, segue.
      if (atpIsTablePopulated(table)) return true;

      // Janela máxima de espera (evita loop eterno se o eProc mudar).
      if ((now - st.t0) > 12000) return true;

      return false;
    } catch (e) {}
    return true;
  }


// ---- parsePriority (movido de 02_dom_and_style.js) ----
function parsePriority(p) { // Converte prioridade em objeto (numérico quando possível).
    const s = String(p ?? '').trim(); // Normaliza string.
    const m = s.match(/\d+/); // Extrai dígitos.
    return m ? { raw: s, num: Number(m[0]), text: s } : { raw: s || '[*]', num: null, text: s || '[*]' }; // Retorna com num ou null.
  }


// ---- normKey (movido de 02_dom_and_style.js) ----
function normKey(label) { // Normaliza label para chave estável.
    const k = (label || '').replace(/:/g, '').trim(); // Remove ":" e trim.
    const noAcc = rmAcc(k).toLowerCase(); // Remove acento e baixa.
    return noAcc.replace(/[^a-z0-9]/g, '') || null; // Mantém só alfanumérico.
  }


// ---- splitVals (movido de 02_dom_and_style.js) ----
function splitVals(raw) { // Converte "a, b | c" etc em Set normalizado.
    const base = rmAcc(lower(raw || '')) // Normaliza: remove acento e baixa.
      .replace(/[.;]\s*$/, '') // Remove pontuação final.
      .replace(/\s{2,}/g, ' ') // Colapsa espaços.
      .trim(); // Trim.
    if (!base) return new Set(); // Sem base, retorna set vazio.
    const tokens = base.split(/;|\||,|\s+ou\s+|\s+e\s+/i).map(s => s.trim()).filter(Boolean); // Separa por delimitadores comuns.
    return new Set(tokens); // Retorna set único.
  }


// ---- setsEqual (movido de 02_dom_and_style.js) ----
function setsEqual(a, b) { // Compara Sets.
    if (a.size !== b.size) return false; // Tamanhos diferentes => falso.
    for (const v of a) if (!b.has(v)) return false; // Algum elemento não existe => falso.
    return true; // Igual.
  }


// ---- parseTooltipMsg (movido de 02_dom_and_style.js) ----
function parseTooltipMsg(onm) { // Extrai mensagem do infraTooltipMostrar(...) de forma tolerante.
    const raw = String(onm || ''); // Garante string.
    // Tenta capturar 1º argumento (msg) aceitando aspas simples OU duplas.
    const m = raw.match(/infraTooltipMostrar\(\s*(?:'([^']*)'|"([^"]*)")\s*,\s*(?:'Comportamento do Localizador REMOVER'|"Comportamento do Localizador REMOVER")/); // Regex tolerante.
    const msg = m ? (m[1] ?? m[2] ?? '') : ''; // Pega grupo 1 ou 2.
    // Alguns trechos vêm HTML-escapados no atributo (ex.: &#39;), então tentamos decodificar.
    let decoded = msg; // Valor base.
    try { decoded = msg.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>'); } catch { } // Decode simples.
    return clean(decoded); // Retorna texto limpo.
  }

// ---- normalizarChave (movido de extract_dados.js / 01) ----
function normalizarChave(label) { // Normaliza um label para virar chave estável do mapa.
    if (!label) return null; // Sem label, sem chave.
    let key = String(label).replace(/:/g, "").trim(); // Remove ":" e corta espaços.
    key = rmAcc(key).toLowerCase(); // Remove acentos e baixa.
    key = key.replace(/[^a-z0-9]+/g, ""); // Mantém só alfanum.
    return key || null; // Retorna ou null.
  }