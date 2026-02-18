try { console.log('[ATP][LOAD] 09-mapa-regra-bpmn.js carregado com sucesso'); } catch (e) { }

let ATP_BPMN_SPLIT_CACHE = null;
let ATP_BPMN_SPLIT_CACHE_KEY = '';

function atpGetBpmnSplitFilesForRules(rules) {
  try {
    const key = String((rules && rules.length) || 0);
    if (ATP_BPMN_SPLIT_CACHE && ATP_BPMN_SPLIT_CACHE_KEY === key) return ATP_BPMN_SPLIT_CACHE;
    const files = atpBuildFluxosBPMN(rules || [], { layout: 'grid', splitFiles: true }) || [];
    ATP_BPMN_SPLIT_CACHE = files;
    ATP_BPMN_SPLIT_CACHE_KEY = key;
    return files;
  } catch (e) {
    try { console.warn(LOG_PREFIX, '[Mapa] Falha ao gerar BPMN split:', e); } catch (_) { }
    return [];
  }
}

function atpFindBpmnFileByRuleNum(files, ruleNum) {
  const re = new RegExp('\\bREGRA\\s+' + String(ruleNum).replace(/[-/\\^$*+?.()|[\\]{}]/g, '\\$&') + '\\b', 'i');
  for (const f of (files || [])) {
    const xml = f && f.xml;
    if (xml && re.test(xml)) return f;
  }
  return null;
}

let ATP_BPMNJS_PROMISE = null;
function atpEnsureBpmnJsLoaded() {

  if (window.BpmnJS && window.BpmnJS.prototype && window.BpmnJS.prototype.__ATP_IS_MODELER__) return Promise.resolve(window.BpmnJS);
  if (ATP_BPMNJS_PROMISE) return ATP_BPMNJS_PROMISE;

  const CSS_URLS = [
    'https://unpkg.com/bpmn-js@18.1.1/dist/assets/diagram-js.css',
    'https://unpkg.com/bpmn-js@18.1.1/dist/assets/bpmn-js.css',
    'https://unpkg.com/bpmn-js@18.1.1/dist/assets/bpmn-font/css/bpmn-embedded.css'
  ];

  ATP_BPMNJS_PROMISE = new Promise((resolve, reject) => {
    try {
      ensureCss(CSS_URLS);

      const s = document.createElement('script');

      s.src = 'https://unpkg.com/bpmn-js@18.1.1/dist/bpmn-modeler.development.js';
      s.async = true;
      s.setAttribute('data-atp-bpmnjs', '1');
      s.onload = () => {
        try {
          if (!window.BpmnJS) throw new Error('BpmnJS não carregou');
          try { window.BpmnJS.prototype.__ATP_IS_MODELER__ = true; } catch (e) { }
          resolve(window.BpmnJS);
        } catch (e) { reject(e); }
      };
      s.onerror = (e) => reject(e);
      document.head.appendChild(s);
    } catch (e) {
      reject(e);
    }
  });

  return ATP_BPMNJS_PROMISE;
}

function atpFindBpmnElementIdByRuleNum(xml, ruleNum) {
  try {
    const doc = new DOMParser().parseFromString(String(xml || ''), 'text/xml');
    const num = String(ruleNum);
    const nodes = Array.from(doc.querySelectorAll('serviceTask, bpmn\\:serviceTask'));
    for (const n of nodes) {
      const name = (n.getAttribute('name') || '').trim();

      if (name.startsWith('REGRA ' + num) || name.startsWith('REGRA\u00A0' + num)) {
        return n.getAttribute('id') || null;
      }
    }
  } catch (e) { }
  return null;
}

function atpCloseRuleMapModal() {
  const el = document.getElementById('atpRuleMapModal');
  if (!el) return;
  try {
    const viewer = el._atpBpmnViewer;
    if (viewer && typeof viewer.destroy === 'function') viewer.destroy();
  } catch (e) { }
  try { el.remove(); } catch (e) { }
}

function atpOpenRuleMapModal(ruleNum) {
  try {
    const rules = (typeof window.atpGetLastRules === 'function')
      ? window.atpGetLastRules()
      : ((typeof window.atpGetLastRules === 'function') ? window.atpGetLastRules() : (window.__ATP_LAST_RULES__ || []));
    if (!rules.length) return;

    const files = atpGetBpmnSplitFilesForRules(rules);
    const f = atpFindBpmnFileByRuleNum(files, ruleNum);
    if (!f) {
      alert('Não encontrei essa regra dentro de um BPMN gerado (talvez a regra não tenha REMOVER/INCLUIR mapeados).');
      return;
    }

    const targetElId = atpFindBpmnElementIdByRuleNum(f.xml, ruleNum);

    atpCloseRuleMapModal();

    const overlay = document.createElement('div');
    overlay.id = 'atpRuleMapModal';
    overlay.className = 'atp-map-overlay';
    overlay.addEventListener('click', (ev) => { if (ev.target === overlay) atpCloseRuleMapModal(); });

    const box = document.createElement('div');
    box.className = 'atp-map-box';

    const top = document.createElement('div');
    top.className = 'atp-map-top';
    top.innerHTML = `<div><div class="atp-map-title">🗺️ Localização da Regra ${ruleNum} no Fluxo (BPMN)</div><div class="atp-map-sub">Arquivo: ${String(f.filename || '')}</div></div>`;

    const actions = document.createElement('div');
    actions.className = 'atp-map-actions';

    let zoomValue = 1;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

    const btnZoomOut = document.createElement('button');
    btnZoomOut.type = 'button';
    btnZoomOut.className = 'atp-map-btn';
    btnZoomOut.title = 'Zoom out';
    btnZoomOut.textContent = '-';

    const zoomLabel = document.createElement('span');
    zoomLabel.className = 'atp-map-zoom';
    zoomLabel.textContent = '100%';

    const btnZoomIn = document.createElement('button');
    btnZoomIn.type = 'button';
    btnZoomIn.className = 'atp-map-btn';
    btnZoomIn.title = 'Zoom in';
    btnZoomIn.textContent = '+';

    const btnFit = document.createElement('button');
    btnFit.type = 'button';
    btnFit.className = 'atp-map-btn';
    btnFit.title = 'Ajustar ao viewport';
    btnFit.textContent = 'Fit';

    const btnDownload = document.createElement('button');
    btnDownload.type = 'button';
    btnDownload.className = 'atp-map-btn';
    btnDownload.textContent = 'Baixar BPMN desse fluxo';
    btnDownload.addEventListener('click', () => {
      try {
        const viewer = overlay._atpBpmnViewer;
        if (!viewer || typeof viewer.saveXML !== 'function') {

          const blob = new Blob([String(f.xml || '')], { type: 'application/xml;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = String(f.filename || ('fluxo_regra_' + ruleNum + '.bpmn'));
          document.body.appendChild(a);
          a.click();
          setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) { } try { a.remove(); } catch (e) { } }, 0);
          return;
        }

        try { if (overlay._atpRestoreNames) overlay._atpRestoreNames(); } catch (e) { }

        viewer.saveXML({ format: true }).then(({ xml }) => {
          try {
            const blob = new Blob([String(xml || '')], { type: 'application/xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = String(f.filename || ('fluxo_regra_' + ruleNum + '.bpmn'));
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) { } try { a.remove(); } catch (e) { } }, 0);
          } catch (e) { }
        }).catch(() => {

          try {
            const blob = new Blob([String(f.xml || '')], { type: 'application/xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = String(f.filename || ('fluxo_regra_' + ruleNum + '.bpmn'));
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) { } try { a.remove(); } catch (e) { } }, 0);
          } catch (e2) { }
        }).finally(() => {

          try { if (overlay._atpApplyTruncation) overlay._atpApplyTruncation(); } catch (e) { }
        });
      } catch (e) { }
    });

    const btnJpeg = document.createElement('button');
    btnJpeg.type = 'button';
    btnJpeg.className = 'atp-map-btn';
    btnJpeg.title = 'Exportar o diagrama para JPEG (imagem)';
    btnJpeg.textContent = 'Exportar JPEG';
    btnJpeg.addEventListener('click', () => {
      try {
        const viewer = overlay._atpBpmnViewer;
        if (!viewer || typeof viewer.saveSVG !== 'function') {
          alert('Exportacao JPEG indisponivel: bpmn-js nao esta pronto.');
          return;
        }

        viewer.saveSVG({ format: true }).then(({ svg }) => {
          const raw = String(svg || '');
          if (!raw) throw new Error('SVG vazio');

          let normalized = raw;
          try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(raw, 'image/svg+xml');
            const svgEl = doc.documentElement;
            if (svgEl && svgEl.tagName && String(svgEl.tagName).toLowerCase() === 'svg') {
              const hasW = svgEl.getAttribute('width');
              const hasH = svgEl.getAttribute('height');
              const vb = svgEl.getAttribute('viewBox');
              if ((!hasW || !hasH) && vb) {
                const parts = vb.split(/\s+|,/).map(x => parseFloat(x)).filter(x => Number.isFinite(x));
                if (parts.length === 4) {
                  const w = Math.max(1, parts[2]);
                  const h = Math.max(1, parts[3]);
                  if (!hasW) svgEl.setAttribute('width', String(w));
                  if (!hasH) svgEl.setAttribute('height', String(h));
                }
              }

              const ser = new XMLSerializer();
              normalized = ser.serializeToString(svgEl);
            }
          } catch (e) {
            normalized = raw;
          }

          const blob = new Blob([normalized], { type: 'image/svg+xml;charset=utf-8' });
          const url = URL.createObjectURL(blob);

          const img = new Image();

          img.onload = () => {
            try {
              const scale = 2;
              const w = img.naturalWidth || img.width || 2000;
              const h = img.naturalHeight || img.height || 1000;

              const canvas = document.createElement('canvas');
              canvas.width = Math.round(w * scale);
              canvas.height = Math.round(h * scale);

              const ctx = canvas.getContext('2d');
              if (!ctx) throw new Error('canvas 2d indisponivel');

              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, canvas.width, canvas.height);

              ctx.setTransform(scale, 0, 0, scale, 0, 0);
              ctx.drawImage(img, 0, 0);

              canvas.toBlob((jpegBlob) => {
                try {
                  if (!jpegBlob) throw new Error('Falha ao gerar JPEG');
                  const jurl = URL.createObjectURL(jpegBlob);
                  const a = document.createElement('a');
                  a.href = jurl;
                  a.download = String(f.filename || ('fluxo_regra_' + ruleNum + '.bpmn')).replace(/\.bpmn$/i, '') + '.jpeg';
                  document.body.appendChild(a);
                  a.click();
                  setTimeout(() => {
                    try { URL.revokeObjectURL(jurl); } catch (e) { }
                    try { a.remove(); } catch (e) { }
                  }, 0);
                } catch (e) {
                  try { alert('Falha ao exportar JPEG.'); } catch (e2) { }
                }
              }, 'image/jpeg', 0.92);

            } catch (e) {
              try { alert('Falha ao exportar JPEG.'); } catch (e2) { }
            } finally {
              try { URL.revokeObjectURL(url); } catch (e) { }
            }
          };
          img.onerror = () => {
            try { URL.revokeObjectURL(url); } catch (e) { }
            try { alert('Falha ao exportar JPEG (erro ao carregar SVG).'); } catch (e2) { }
          };
          img.src = url;

        }).catch((err) => {
          try { console.warn(LOG_PREFIX, '[Mapa] saveSVG falhou:', err); } catch (e) { }
          try { alert('Falha ao exportar JPEG.'); } catch (e2) { }
        });
      } catch (e) {
        try { alert('Falha ao exportar JPEG.'); } catch (e2) { }
      }
    });
    const btnClose = document.createElement('button');
    btnClose.type = 'button';
    btnClose.className = 'atp-map-btn';
    btnClose.textContent = 'Fechar';
    btnClose.addEventListener('click', atpCloseRuleMapModal);

    actions.appendChild(btnZoomOut);
    actions.appendChild(zoomLabel);
    actions.appendChild(btnZoomIn);
    actions.appendChild(btnFit);
    actions.appendChild(btnDownload);
    actions.appendChild(btnJpeg);
    actions.appendChild(btnClose);
    top.appendChild(actions);

    const body = document.createElement('div');
    body.className = 'atp-map-body';

    const wrap = document.createElement('div');
    wrap.className = 'atp-bpmnjs-wrap';

    const canvasHost = document.createElement('div');
    canvasHost.className = 'atp-bpmnjs-canvas';
    wrap.appendChild(canvasHost);
    body.appendChild(wrap);

    box.appendChild(top);
    box.appendChild(body);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    atpEnsureBpmnJsLoaded().then((BpmnJS) => {
      try {
        const viewer = new BpmnJS({ container: canvasHost });
        overlay._atpBpmnViewer = viewer;

        viewer.importXML(String(f.xml || '')).then(() => {
          const canvas = viewer.get('canvas');
          const elementRegistry = viewer.get('elementRegistry');
          const modeling = (function () { try { return viewer.get('modeling'); } catch (e) { return null; } })();

          const ATP_MODAL_LABEL_MAX = 90;

          const _origNames = new Map();
          const truncate = (s) => {
            const str = String(s || '');
            return (str.length > ATP_MODAL_LABEL_MAX) ? (str.slice(0, ATP_MODAL_LABEL_MAX - 1) + '…') : str;
          };
          const restoreOriginalNames = () => {
            try {
              if (!modeling) return;
              _origNames.forEach((name, id) => {
                try {
                  const el = elementRegistry.get(id);
                  if (el) modeling.updateProperties(el, { name });
                } catch (e) { }
              });
            } catch (e) { }
          };
          const applyTruncation = () => {
            try {
              if (!modeling) return;
              elementRegistry.forEach((el) => {
                try {
                  const bo = el && el.businessObject;
                  if (!bo || typeof bo.name !== 'string' || !bo.name) return;
                  if (!_origNames.has(el.id)) _origNames.set(el.id, bo.name);
                  const t = truncate(_origNames.get(el.id));
                  if (t !== bo.name) modeling.updateProperties(el, { name: t });
                } catch (e) { }
              });
            } catch (e) { }
          };
          const applyZoom = (z) => {
            try {
              zoomValue = clamp(z, 0.2, 3.0);
              canvas.zoom(zoomValue);
              zoomLabel.textContent = Math.round(zoomValue * 100) + '%';
            } catch (e) { }
          };
          overlay._atpOrigNames = _origNames;
          overlay._atpRestoreNames = restoreOriginalNames;
          overlay._atpApplyTruncation = applyTruncation;

          applyTruncation();

          try { canvas.zoom('fit-viewport'); } catch (e) { }
          try { zoomValue = canvas.zoom() || 1; } catch (e) { zoomValue = 1; }
          zoomLabel.textContent = Math.round(zoomValue * 100) + '%';

          try {
            const hasModeling = (function () { try { return !!viewer.get('modeling'); } catch (e) { return false; } })();
            if (!hasModeling) {
              console.warn(LOG_PREFIX, '[Mapa] Viewer sem edição detectado. Recarregue a página para forçar Modeler.');
            }
          } catch (e) { }

          if (targetElId) {
            const el = elementRegistry.get(targetElId);
            if (el) {
              try { canvas.addMarker(targetElId, 'atp-bpmn-highlight'); } catch (e) { }
              try { canvas.scrollToElement(el); } catch (e) { }
            }
          }

          btnZoomOut.addEventListener('click', () => applyZoom(zoomValue - 0.2));
          btnZoomIn.addEventListener('click', () => applyZoom(zoomValue + 0.2));
          btnFit.addEventListener('click', () => {
            try { canvas.zoom('fit-viewport'); } catch (e) { }
            try { zoomValue = canvas.zoom() || 1; } catch (e) { zoomValue = 1; }
            zoomLabel.textContent = Math.round(zoomValue * 100) + '%';
          });

        }).catch((err) => {
          try { console.warn(LOG_PREFIX, '[Mapa] BPMN-JS importXML falhou:', err); } catch (e) { }
          try { canvasHost.textContent = 'Falha ao renderizar BPMN (bpmn-js).'; } catch (e) { }
        });
      } catch (e) {
        try { console.warn(LOG_PREFIX, '[Mapa] Falha ao instanciar BPMN-JS:', e); } catch (e2) { }
        try { canvasHost.textContent = 'Falha ao inicializar visualizador BPMN.'; } catch (e3) { }
      }
    }).catch((err) => {
      try { console.warn(LOG_PREFIX, '[Mapa] Falha ao carregar BPMN-JS:', err); } catch (e) { }
      try { canvasHost.textContent = 'Falha ao carregar BPMN-JS (verifique bloqueios de rede/CSP).'; } catch (e) { }
    });

  } catch (e) {
    try { console.warn(LOG_PREFIX, '[Mapa] Falha ao abrir modal:', e); } catch (_) { }
  }
}

'use strict';

window.__ATP_PAGE_LOADED__ = (document.readyState === 'complete');
if (!window.__ATP_PAGE_LOADED__) {
  window.addEventListener('load', () => {
    window.__ATP_PAGE_LOADED__ = true;
    setATPLoadingMsg('Carregamento completo. Analisando colisões…');

    try { scheduleHideATPLoading(1800); } catch { }
  }, { once: true });
}

(function atpBootstrapLoadingOnlyOnTargetPage() {
  try {
    const TARGET_TABLE_ID = 'tableAutomatizacaoLocalizadores';

    const urlLooksLikeTarget = /automatizar_localizadores/i.test(String(location.href || ''));

    if (!urlLooksLikeTarget) return;

    const startedAt = Date.now();
    const tickMs = 200;

    const t = setInterval(() => {
      try {
        const table = document.getElementById(TARGET_TABLE_ID);
        if (table) {
          clearInterval(t);

          showATPLoading();

          window.__ATP_PAGE_LOADED__ = (document.readyState === 'complete');
          if (window.__ATP_PAGE_LOADED__) {
            setATPLoadingMsg('Carregamento completo. Analisando colisões…');
            try { scheduleHideATPLoading(1800); } catch { }
          } else {
            setATPLoadingMsg('Aguardando carregamento completo do eProc…');
          }
        } else if (Date.now() - startedAt > 120000) {

          clearInterval(t);
        }
      } catch { }
    }, tickMs);
  } catch { }
})();

(function () {

  "use strict";

  const TABLE_ID = "tableAutomatizacaoLocalizadores";
  const TH_LABEL_RE = /n[ºo]\s*\/?\s*prioridade/i;

  function limparTextoLocal(s) {
    return (s ?? "").toString().replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
  }

  function toIntOrNull(x) {
    const m = String(x ?? "").match(/\d+/);
    return m ? Number(m[0]) : null;
  }

  function getRuleNumberFromCell(td) {
    const txt = limparTextoLocal(td?.textContent || "");
    const m = txt.match(/^\s*(\d{1,6})\b/);
    return m ? Number(m[1]) : null;
  }

  function getPriorityFromCell(td) {
    const sel = td?.querySelector?.("select");
    if (sel) {
      const opt = sel.selectedOptions?.[0] || sel.querySelector("option[selected]") || sel.options?.[sel.selectedIndex];
      const t = limparTextoLocal(opt?.textContent || "");
      const n = toIntOrNull(t);
      if (n != null) return n;
    }
    const raw = limparTextoLocal(td?.textContent || "");
    return toIntOrNull(raw);
  }

  function findPriorityColumnIndex(table) {
    const thead = table?.tHead || table?.querySelector("thead");
    if (!thead) return -1;
    const ths = Array.from(thead.querySelectorAll("th"));
    for (let i = 0; i < ths.length; i++) {
      const t = limparTextoLocal(ths[i].textContent || "");
      if (TH_LABEL_RE.test(t)) return i;
    }
    return -1;
  }

  function getAllBodyRows(table) {
    const tbodys = table.tBodies?.length ? Array.from(table.tBodies) : [];
    const rows = [];
    for (const tb of tbodys) for (const tr of Array.from(tb.rows)) rows.push(tr);
    return rows;
  }

  function sortTableByPriority(table, colIdx, direction) {
    const rows = getAllBodyRows(table);
    if (!rows.length) return;

    const byTbody = new Map();
    for (const tr of rows) {
      const tb = tr.parentElement;
      if (!byTbody.has(tb)) byTbody.set(tb, []);
      byTbody.get(tb).push(tr);
    }

    const factor = (direction === "desc") ? -1 : 1;

    for (const [tbody, trList] of byTbody.entries()) {
      trList.sort((a, b) => {
        const aTds = a.querySelectorAll(":scope > td");
        const bTds = b.querySelectorAll(":scope > td");

        const aCell = aTds[colIdx] || null;
        const bCell = bTds[colIdx] || null;

        const aPri = getPriorityFromCell(aCell);
        const bPri = getPriorityFromCell(bCell);

        const aHas = (aPri != null);
        const bHas = (bPri != null);

        if (aHas && bHas && aPri !== bPri) return (aPri - bPri) * factor;
        if (aHas !== bHas) return (aHas ? -1 : 1);

        const aNum = getRuleNumberFromCell(aCell) ?? getRuleNumberFromCell(aTds[0]) ?? 0;
        const bNum = getRuleNumberFromCell(bCell) ?? getRuleNumberFromCell(bTds[0]) ?? 0;
        if (aNum !== bNum) return (aNum - bNum) * factor;

        const at = limparTextoLocal(aCell?.textContent || "");
        const bt = limparTextoLocal(bCell?.textContent || "");
        return at.localeCompare(bt) * factor;
      });

      const frag = document.createDocumentFragment();
      trList.forEach(tr => frag.appendChild(tr));
      tbody.appendChild(frag);
    }
  }

  function ensureSortUI(table) {
    const thead = table.tHead || table.querySelector("thead");
    if (!thead) return;

    if ((table.classList && table.classList.contains('dataTable')) || table.closest('.dataTables_wrapper')) return;

    const colIdx = findPriorityColumnIndex(table);
    if (colIdx < 0) return;

    const th = thead.querySelectorAll("th")[colIdx];
    if (!th || th.dataset.atpSortBound === "1") return;

    th.dataset.atpSortBound = "1";
    th.style.cursor = "pointer";
    th.title = "Ordenação visual (não altera a execução real). Clique para alternar ↑/↓.";

    const badge = document.createElement("span");
    badge.textContent = " ↕";
    badge.style.opacity = "0.65";
    badge.style.userSelect = "none";
    badge.dataset.atpSortBadge = "1";
    th.appendChild(badge);

    th.dataset.atpSortDir = "asc";

    th.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const dir = (th.dataset.atpSortDir === "asc") ? "desc" : "asc";
      th.dataset.atpSortDir = dir;
      badge.textContent = (dir === "asc") ? " ↑" : " ↓";

      sortTableByPriority(table, colIdx, dir);
    }, true);
  }

  function init() {
    const table = document.getElementById(TABLE_ID);
    if (table) {

      const dtOn = (table.classList && table.classList.contains('dataTable')) || table.closest('.dataTables_wrapper');
      if (!dtOn) {
        try { ensureColumns(table); } catch (e) { }
      } ensureSortUI(table);
    }
  }

  init();

  const mo = new MutationObserver(() => {
    if (init._t) cancelAnimationFrame(init._t);
    init._t = requestAnimationFrame(init);
  });
  mo.observe(document.body, { childList: true, subtree: true });

})();

window.atpOpenRuleMapModal = atpOpenRuleMapModal;
window.atpCloseRuleMapModal = atpCloseRuleMapModal;
;
