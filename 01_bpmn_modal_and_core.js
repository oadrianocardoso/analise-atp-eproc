try { console.log('[ATP][LOAD] 01_bpmn_modal_and_core.js carregado com sucesso'); } catch (e) {}
/**
 * ATP MODULAR - 01_bpmn_modal_and_core.js
 * Extraído de ATP-versao estavel com bpmno.js
 */


  // =========================
  // [ATP] Localizar Regra no Fluxo (Modal BPMN)
  // =========================
  let ATP_LAST_RULES = null;
  let ATP_BPMN_SPLIT_CACHE = null; // [{filename, xml}]
  let ATP_BPMN_SPLIT_CACHE_KEY = '';

  function atpGetBpmnSplitFilesForRules(rules) { // Obtém o BPMN split files for regras.
    try {
      const key = String((rules && rules.length) || 0);
      if (ATP_BPMN_SPLIT_CACHE && ATP_BPMN_SPLIT_CACHE_KEY === key) return ATP_BPMN_SPLIT_CACHE;
      const files = atpBuildFluxosBPMN(rules || [], { layout: 'grid', splitFiles: true }) || [];
      ATP_BPMN_SPLIT_CACHE = files;
      ATP_BPMN_SPLIT_CACHE_KEY = key;
      return files;
    } catch (e) {
      try { console.warn(LOG_PREFIX, '[Mapa] Falha ao gerar BPMN split:', e); } catch(_) {}
      return [];
    }
  }

  function atpFindBpmnFileByRuleNum(files, ruleNum) { // Localiza o BPMN file by regra num.
    const re = new RegExp('\\bREGRA\\s+' + String(ruleNum).replace(/[-/\\^$*+?.()|[\\]{}]/g, '\\$&') + '\\b', 'i');
    for (const f of (files || [])) {
      const xml = f && f.xml;
      if (xml && re.test(xml)) return f;
    }
    return null;
  }

  function atpParseBpmnToDiagram(xml) { // Extrai BPMN to diagrama.
    const dp = new DOMParser();
    const doc = dp.parseFromString(String(xml || ''), 'text/xml');
    // bounds by bpmnElement
    const shapes = [];
    const boundsByEl = new Map();

    const shapeEls = Array.from(doc.getElementsByTagNameNS('*', 'BPMNShape'));
    for (const sh of shapeEls) {
      const bpmnEl = sh.getAttribute('bpmnElement');
      const b = sh.getElementsByTagNameNS('*', 'Bounds')[0];
      if (!b || !bpmnEl) continue;
      const x = Number(b.getAttribute('x') || 0);
      const y = Number(b.getAttribute('y') || 0);
      const w = Number(b.getAttribute('width') || 0);
      const h = Number(b.getAttribute('height') || 0);
      const rec = { id: bpmnEl, x, y, w, h };
      boundsByEl.set(bpmnEl, rec);
      shapes.push(rec);
    }

    const edges = [];
    const edgeEls = Array.from(doc.getElementsByTagNameNS('*', 'BPMNEdge'));
    for (const ed of edgeEls) {
      const bpmnEl = ed.getAttribute('bpmnElement');
      if (!bpmnEl) continue;
      const wps = Array.from(ed.getElementsByTagNameNS('*', 'waypoint')).map(wp => ({
        x: Number(wp.getAttribute('x') || 0),
        y: Number(wp.getAttribute('y') || 0)
      }));
      if (wps.length < 2) continue;
      edges.push({ id: bpmnEl, waypoints: wps });
    }

    // Map element id -> {tag,name}
    const metaById = new Map();
    const proc = doc.getElementsByTagNameNS('*', 'process')[0];
    const all = proc ? Array.from(proc.getElementsByTagName('*')) : Array.from(doc.getElementsByTagName('*'));
    for (const el of all) {
      const id = el.getAttribute && el.getAttribute('id');
      if (!id) continue;
      const name = el.getAttribute('name') || '';
      const tag = (el.localName || el.tagName || '').toLowerCase();
      if (!metaById.has(id)) metaById.set(id, { tag, name });
    }

    // overall bbox
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    for (const s of shapes) {
      minX = Math.min(minX, s.x);
      minY = Math.min(minY, s.y);
      maxX = Math.max(maxX, s.x + s.w);
      maxY = Math.max(maxY, s.y + s.h);
    }
    for (const e of edges) {
      for (const p of e.waypoints) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
    }
    if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 800; maxY = 600; }

    return { shapes, edges, metaById, bbox: { minX, minY, maxX, maxY } };
  }

  function atpRenderDiagramSvg(diagram, highlightRuleNum) { // Renderiza diagrama SVG.
    const pad = 30;
    const vbX = diagram.bbox.minX - pad;
    const vbY = diagram.bbox.minY - pad;
    const vbW = (diagram.bbox.maxX - diagram.bbox.minX) + pad * 2;
    const vbH = (diagram.bbox.maxY - diagram.bbox.minY) + pad * 2;

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', `${vbX} ${vbY} ${vbW} ${vbH}`);
    svg.setAttribute('width', String(Math.min(1200, Math.max(700, vbW))));
    svg.setAttribute('height', String(Math.min(700, Math.max(420, vbH))));
    svg.classList.add('atp-map-svg');

    const defs = document.createElementNS(svgNS, 'defs');
    const marker = document.createElementNS(svgNS, 'marker');
    marker.setAttribute('id', 'atpArrow');
    marker.setAttribute('viewBox', '0 0 10 10');
    marker.setAttribute('refX', '10');
    marker.setAttribute('refY', '5');
    marker.setAttribute('markerWidth', '8');
    marker.setAttribute('markerHeight', '8');
    marker.setAttribute('orient', 'auto');
    const mp = document.createElementNS(svgNS, 'path');
    mp.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
    mp.setAttribute('fill', '#6b7280');
    marker.appendChild(mp);
    defs.appendChild(marker);

    const glow = document.createElementNS(svgNS, 'filter');
    glow.setAttribute('id', 'atpGlow');
    glow.innerHTML = '<feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="#f59e0b" flood-opacity="0.9"/>';
    defs.appendChild(glow);
    svg.appendChild(defs);

    // edges
    for (const e of (diagram.edges || [])) {
      const path = document.createElementNS(svgNS, 'path');
      const pts = e.waypoints;
      const d = pts.map((p,i)=> (i===0?`M ${p.x} ${p.y}`:`L ${p.x} ${p.y}`)).join(' ');
      path.setAttribute('d', d);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', '#6b7280');
      path.setAttribute('stroke-width', '1.6');
      path.setAttribute('marker-end', 'url(#atpArrow)');
      svg.appendChild(path);
    }

    let highlightEl = null;

    // shapes
    for (const s of (diagram.shapes || [])) {
      const meta = diagram.metaById.get(s.id) || { tag: '', name: '' };
      const tag = meta.tag;
      const name = meta.name || '';

      const isGateway = tag.includes('gateway');
      const isStart = tag.includes('startevent');
      const isEnd = tag.includes('endevent');
      const isService = tag.includes('servicetask');
      const isTask = tag === 'task' || isService;

      const shouldHighlight = isService && new RegExp('^\\s*REGRA\\s+' + String(highlightRuleNum) + '\\b', 'i').test(name);

      let node;
      if (isStart || isEnd) {
        node = document.createElementNS(svgNS, 'circle');
        node.setAttribute('cx', String(s.x + s.w/2));
        node.setAttribute('cy', String(s.y + s.h/2));
        node.setAttribute('r', String(Math.min(s.w,s.h)/2));
        node.setAttribute('fill', '#ffffff');
        node.setAttribute('stroke', shouldHighlight ? '#f59e0b' : '#111827');
        node.setAttribute('stroke-width', isEnd ? '2.2' : '1.8');
      } else if (isGateway) {
        node = document.createElementNS(svgNS, 'polygon');
        const cx = s.x + s.w/2, cy = s.y + s.h/2;
        const pts = [
          [cx, s.y],
          [s.x + s.w, cy],
          [cx, s.y + s.h],
          [s.x, cy]
        ].map(p=>p.join(',')).join(' ');
        node.setAttribute('points', pts);
        node.setAttribute('fill', '#ffffff');
        node.setAttribute('stroke', shouldHighlight ? '#f59e0b' : '#111827');
        node.setAttribute('stroke-width', shouldHighlight ? '2.6' : '1.8');
      } else if (isTask) {
        node = document.createElementNS(svgNS, 'rect');
        node.setAttribute('x', String(s.x));
        node.setAttribute('y', String(s.y));
        node.setAttribute('width', String(s.w));
        node.setAttribute('height', String(s.h));
        node.setAttribute('rx', '10');
        node.setAttribute('ry', '10');
        node.setAttribute('fill', '#ffffff');
        node.setAttribute('stroke', shouldHighlight ? '#f59e0b' : '#111827');
        node.setAttribute('stroke-width', shouldHighlight ? '2.6' : '1.5');
      } else {
        // pool/participant etc: ignore
        continue;
      }

      if (shouldHighlight) {
        node.setAttribute('filter', 'url(#atpGlow)');
        highlightEl = node;
      }

      svg.appendChild(node);

      // label
      const label = document.createElementNS(svgNS, 'text');
      label.setAttribute('x', String(s.x + s.w/2));
      label.setAttribute('y', String(s.y + s.h/2));
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('dominant-baseline', 'middle');
      label.setAttribute('font-size', '11');
      label.setAttribute('fill', '#111827');
      let txt = name || (tag.includes('task') ? '' : tag);
      if (txt.length > 42) txt = txt.slice(0, 39) + '...';
      label.textContent = txt;
      svg.appendChild(label);
    }

    return { svg, highlightEl };
  }


  // --- BPMN-JS (bpmn.io) integration for interactive modal ---
  let ATP_BPMNJS_PROMISE = null;
  function atpEnsureBpmnJsLoaded() { // Garante BPMN js loaded.
    // IMPORTANT: sempre garantir que temos o *Modeler* (com edição).
    // Algumas versões antigas carregavam apenas Viewer e deixavam window.BpmnJS definido.
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
        // Não reutiliza script antigo: pode ter sido Viewer. Sempre carrega Modeler.
        const s = document.createElement('script');
        // Modeler para permitir edição e movimentação no modal
        s.src = 'https://unpkg.com/bpmn-js@18.1.1/dist/bpmn-modeler.development.js';
        s.async = true;
        s.setAttribute('data-atp-bpmnjs', '1');
        s.onload = () => {
          try {
            if (!window.BpmnJS) throw new Error('BpmnJS não carregou');
            try { window.BpmnJS.prototype.__ATP_IS_MODELER__ = true; } catch (e) {}
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

  function atpFindBpmnElementIdByRuleNum(xml, ruleNum) { // Localiza o BPMN element ID by regra num.
    try {
      const doc = new DOMParser().parseFromString(String(xml || ''), 'text/xml');
      const num = String(ruleNum);
      const nodes = Array.from(doc.querySelectorAll('serviceTask, bpmn\\:serviceTask'));
      for (const n of nodes) {
        const name = (n.getAttribute('name') || '').trim();
        // aceita "REGRA 123" no começo
        if (name.startsWith('REGRA ' + num) || name.startsWith('REGRA\u00A0' + num)) {
          return n.getAttribute('id') || null;
        }
      }
    } catch (e) {}
    return null;
  }

  function atpCloseRuleMapModal() { // Fecha regra map modal.
    const el = document.getElementById('atpRuleMapModal');
    if (!el) return;
    try {
      const viewer = el._atpBpmnViewer;
      if (viewer && typeof viewer.destroy === 'function') viewer.destroy();
    } catch (e) {}
    try { el.remove(); } catch (e) {}
  }

  function atpOpenRuleMapModal(ruleNum) { // Abre regra map modal.
    try {
      const rules = ATP_LAST_RULES || [];
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

      // Zoom via BPMN-JS
      let zoomValue = 1;
      const clamp = (v, a, b) => Math.max(a, Math.min(b, v)); // Limita um valor dentro de um intervalo (min/max).

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
            // fallback: baixa o XML original
            const blob = new Blob([String(f.xml || '')], { type: 'application/xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = String(f.filename || ('fluxo_regra_' + ruleNum + '.bpmn'));
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { try{URL.revokeObjectURL(url);}catch(e){} try{a.remove();}catch(e){} }, 0);
            return;
          }

          // Restaura nomes originais antes de salvar, para não afetar o arquivo baixado
          try { if (overlay._atpRestoreNames) overlay._atpRestoreNames(); } catch (e) {}

          viewer.saveXML({ format: true }).then(({ xml }) => {
            try {
              const blob = new Blob([String(xml || '')], { type: 'application/xml;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = String(f.filename || ('fluxo_regra_' + ruleNum + '.bpmn'));
              document.body.appendChild(a);
              a.click();
              setTimeout(() => { try{URL.revokeObjectURL(url);}catch(e){} try{a.remove();}catch(e){} }, 0);
            } catch (e) {}
          }).catch(() => {
            // fallback: original
            try {
              const blob = new Blob([String(f.xml || '')], { type: 'application/xml;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = String(f.filename || ('fluxo_regra_' + ruleNum + '.bpmn'));
              document.body.appendChild(a);
              a.click();
              setTimeout(() => { try{URL.revokeObjectURL(url);}catch(e){} try{a.remove();}catch(e){} }, 0);
            } catch (e2) {}
          }).finally(() => {
            // Reaplica truncamento na tela (somente visual)
            try { if (overlay._atpApplyTruncation) overlay._atpApplyTruncation(); } catch (e) {}
          });
        } catch (e) {}
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

          // Exporta o que esta sendo exibido no modal (labels truncados inclusos).
          viewer.saveSVG({ format: true }).then(({ svg }) => {
            const raw = String(svg || '');
            if (!raw) throw new Error('SVG vazio');

            // Garante width/height a partir do viewBox, para o raster ficar consistente.
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
                // Serializa de volta
                const ser = new XMLSerializer();
                normalized = ser.serializeToString(svgEl);
              }
            } catch (e) {
              normalized = raw;
            }

            const blob = new Blob([normalized], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);

            const img = new Image();
            // Evita problemas com SVG externo. Mesmo assim, como eh blob local, tende a funcionar.
            img.onload = () => {
              try {
                const scale = 2; // qualidade
                const w = img.naturalWidth || img.width || 2000;
                const h = img.naturalHeight || img.height || 1000;

                const canvas = document.createElement('canvas');
                canvas.width = Math.round(w * scale);
                canvas.height = Math.round(h * scale);

                const ctx = canvas.getContext('2d');
                if (!ctx) throw new Error('canvas 2d indisponivel');

                // Fundo branco (JPEG nao suporta transparência)
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
                      try { URL.revokeObjectURL(jurl); } catch (e) {}
                      try { a.remove(); } catch (e) {}
                    }, 0);
                  } catch (e) {
                    try { alert('Falha ao exportar JPEG.'); } catch (e2) {}
                  }
                }, 'image/jpeg', 0.92);

              } catch (e) {
                try { alert('Falha ao exportar JPEG.'); } catch (e2) {}
              } finally {
                try { URL.revokeObjectURL(url); } catch (e) {}
              }
            };
            img.onerror = () => {
              try { URL.revokeObjectURL(url); } catch (e) {}
              try { alert('Falha ao exportar JPEG (erro ao carregar SVG).'); } catch (e2) {}
            };
            img.src = url;

          }).catch((err) => {
            try { console.warn(LOG_PREFIX, '[Mapa] saveSVG falhou:', err); } catch (e) {}
            try { alert('Falha ao exportar JPEG.'); } catch (e2) {}
          });
        } catch (e) {
          try { alert('Falha ao exportar JPEG.'); } catch (e2) {}
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

      // Lazy-load BPMN-JS and render
      atpEnsureBpmnJsLoaded().then((BpmnJS) => {
        try {
          const viewer = new BpmnJS({ container: canvasHost, keyboard: { bindTo: document } });
          overlay._atpBpmnViewer = viewer;

          viewer.importXML(String(f.xml || '')).then(() => {
            const canvas = viewer.get('canvas');
            const elementRegistry = viewer.get('elementRegistry');
            const modeling = (function(){ try { return viewer.get('modeling'); } catch(e) { return null; } })();

            // --- Limite de caracteres APENAS no modal (BPMN-JS) ---
            const ATP_MODAL_LABEL_MAX = 90;
            // Guarda nomes originais para NÃO alterar TXT/Bizagi e permitir download com nomes completos
            const _origNames = new Map();
            overlay._atpOrigNames = _origNames;
            overlay._atpRestoreNames = restoreOriginalNames;
            overlay._atpApplyTruncation = applyTruncation;
            // aplica truncamento já na abertura
            applyTruncation();


            try { canvas.zoom('fit-viewport'); } catch (e) {}
            try { zoomValue = canvas.zoom() || 1; } catch (e) { zoomValue = 1; }
            zoomLabel.textContent = Math.round(zoomValue * 100) + '%';

            // Se estiver sem 'modeling', é sinal de que carregou Viewer antigo (sem edição).
            try {
              const hasModeling = (function(){ try { return !!viewer.get('modeling'); } catch(e) { return false; } })();
              if (!hasModeling) {
                console.warn(LOG_PREFIX, '[Mapa] Viewer sem edição detectado. Recarregue a página para forçar Modeler.');
              }
            } catch (e) {}

            if (targetElId) {
              const el = elementRegistry.get(targetElId);
              if (el) {
                try { canvas.addMarker(targetElId, 'atp-bpmn-highlight'); } catch (e) {}
                try { canvas.scrollToElement(el); } catch (e) {}
              }
            }

            btnZoomOut.addEventListener('click', () => applyZoom(zoomValue - 0.2));
            btnZoomIn.addEventListener('click', () => applyZoom(zoomValue + 0.2));
            btnFit.addEventListener('click', () => {
              try { canvas.zoom('fit-viewport'); } catch (e) {}
              try { zoomValue = canvas.zoom() || 1; } catch (e) { zoomValue = 1; }
              zoomLabel.textContent = Math.round(zoomValue * 100) + '%';
            });

          }).catch((err) => {
            try { console.warn(LOG_PREFIX, '[Mapa] BPMN-JS importXML falhou:', err); } catch (e) {}
            try { canvasHost.textContent = 'Falha ao renderizar BPMN (bpmn-js).'; } catch (e) {}
          });
        } catch (e) {
          try { console.warn(LOG_PREFIX, '[Mapa] Falha ao instanciar BPMN-JS:', e); } catch (e2) {}
          try { canvasHost.textContent = 'Falha ao inicializar visualizador BPMN.'; } catch (e3) {}
        }
      }).catch((err) => {
        try { console.warn(LOG_PREFIX, '[Mapa] Falha ao carregar BPMN-JS:', err); } catch (e) {}
        try { canvasHost.textContent = 'Falha ao carregar BPMN-JS (verifique bloqueios de rede/CSP).'; } catch (e) {}
      });

    } catch (e) {
      try { console.warn(LOG_PREFIX, '[Mapa] Falha ao abrir modal:', e); } catch (_) {}
    }
  }

  'use strict';

  const LOG_PREFIX = '[ATP]';

// ============================================================
// Loading (overlay) – aguarda carregamento COMPLETO do eProc (window.load)
// e só some quando a análise/render estabilizar OU timeout (2 min)
// ============================================================
const ATP_LOADING_ID = 'atp-loading-overlay';

// Gate: carregamento completo do eProc (window.load)
window.__ATP_PAGE_LOADED__ = (document.readyState === 'complete');
if (!window.__ATP_PAGE_LOADED__) {
  window.addEventListener('load', () => {
    window.__ATP_PAGE_LOADED__ = true;
    setATPLoadingMsg('Carregamento completo. Analisando colisões…');
    // tenta esconder quando estabilizar (se a análise já tiver renderizado)
    try { scheduleHideATPLoading(1800); } catch {}
  }, { once: true });
}

// Controle de renderização/estabilização
// Esconde o loading somente quando:
// - a página terminou de carregar (window.load)
// - houve ao menos 1 renderização da análise
// - e passou uma janela de silêncio sem novas renderizações
// ============================================================
// Ativa o loading SOMENTE na página que contém a tabela alvo
// (tableAutomatizacaoLocalizadores). Em outras páginas do eProc,
// não exibe overlay nenhum.
// ============================================================
(function atpBootstrapLoadingOnlyOnTargetPage() {
  try {
    const TARGET_TABLE_ID = 'tableAutomatizacaoLocalizadores';

    // Heurística rápida por URL (ajuda antes do DOM existir).
    const urlLooksLikeTarget = /automatizar_localizadores/i.test(String(location.href || ''));

    // Se a URL não parece ser a tela alvo, não faz nada.
    if (!urlLooksLikeTarget) return;

    const startedAt = Date.now();
    const tickMs = 200;

    const t = setInterval(() => {
      try {
        const table = document.getElementById(TARGET_TABLE_ID);
        if (table) {
          clearInterval(t);

          // Mostra overlay somente após detectar a tabela alvo.
          showATPLoading();

          // Atualiza flags do gate do page-load
          window.__ATP_PAGE_LOADED__ = (document.readyState === 'complete');
          if (window.__ATP_PAGE_LOADED__) {
            setATPLoadingMsg('Carregamento completo. Analisando colisões…');
            try { scheduleHideATPLoading(1800); } catch {}
          } else {
            setATPLoadingMsg('Aguardando carregamento completo do eProc…');
          }
        } else if (Date.now() - startedAt > 120000) {
          // Se a tabela não apareceu em 2 min, não mostra loading.
          clearInterval(t);
        }
      } catch {}
    }, tickMs);
  } catch {}
})();
  // ======================================================================
  // Organização do código
  //  1) Utilitários
  //  2) UI (emoji / tooltip)
  //  3) CAPTURA DE DADOS (DOM -> dados)
  //  4) ANÁLISE DE COLISÕES
  //  5) LOG / Dump
  //  6) Bootstrap / Observers
  // ======================================================================

  // ==============================
  // Constantes básicas
  // ==============================

  const TABLE_ID = 'tableAutomatizacaoLocalizadores'; // ID padrão da tabela no eProc.
  let onlyConflicts = false; // Estado do filtro "apenas regras com conflito".

  // Ranking simples para calcular "severidade" visual (só para cor de fundo da linha).
  const tipoRank = { // Peso do tipo de conflito.
    'Colisão Total': 5, // Mais crítico.
    'Colisão Parcial': 4, // Quase tão crítico quanto total.
    'Looping': 5, // Crítico.
    'Looping Potencial': 5, // Crítico.
    'Contradição': 5, // Crítico (regra inexecutável/auto-contraditória).
    'Quebra de Fluxo': 4, // Médio/alto (ação sem saída de fluxo).
    'Perda de Objeto': 3, // Médio.
    'Sobreposição': 2, // Baixo/médio.
    'Sobreposição (Outros iguais)': 2 // Baixo/médio (mais restritivo).
  };

  const impactoRank = { // Peso do impacto (quando aplicável).
    'Alto': 3, // Peso 3.
    'Médio': 2, // Peso 2.
    'Baixo': 1 // Peso 1.
  };

  const ATP_CONFIG = {
  analisarLooping: false, // ← false = DESATIVADO | true = ATIVADO
  };

  // ==============================
  // REMOVER emoji (lupa -> emoji)
  // ==============================

  const REMOVER_EMOJI = { // Tabela de mapeamento value -> emoji + nota.
    "null": { glyph: "❔", note: "" }, // Indefinido.
    "0": { glyph: "🗂️➖", note: "(Remover informados)" }, // Remove apenas os informados.
    "1": { glyph: "❌", note: "(Remover TODOS)" }, // Remove todos.
    "2": { glyph: "🚫⚙️", note: "(Remover todos exceto sistema)" }, // Remove todos exceto sistema.
    "3": { glyph: "➕", note: "(Não remover; só acrescenta)" }, // Não remove; só inclui.
    "4": { glyph: "🗂️⚙️➖", note: "(Remover apenas sistema)" } // Remove apenas localizadores de sistema.
  };

  function removerEmojiInfo(val) { // Normaliza value e retorna info do mapa.
    val = (val == null || val === "" || val === "null") ? "null" : String(val); // Normaliza para string ou "null".
    return REMOVER_EMOJI[val] || REMOVER_EMOJI["null"]; // Fallback para "null".
  }

function mkEmojiSpan(val, extraClass) { // Cria <span> com emoji + nota.
    const info = removerEmojiInfo(val); // Busca emoji/nota.
    const wrap = document.createElement("span"); // Wrapper principal.
    wrap.className = "atp-remover-emoji" + (extraClass ? " " + extraClass : ""); // Classe base + extra.
    const glyph = document.createElement("span"); // Span do emoji.
    glyph.className = "atp-remover-glyph"; // Classe do emoji.
    glyph.textContent = info.glyph; // Emoji.
    wrap.appendChild(glyph); // Anexa emoji.

    if (info.note) { // Se houver nota...
      const note = document.createElement("span"); // Span da nota.
      note.className = "atp-remover-note"; // Classe da nota.
      note.textContent = info.note; // Texto da nota.
      wrap.appendChild(note); // Anexa nota.
    }
    return wrap; // Retorna o wrapper.
  }

  // ======================================================================
  // UTILITÁRIOS
  // ======================================================================

  // ============================================================================
// ATP (extra): Ordenação VISUAL ao clicar no cabeçalho "Nº / Prioridade"
// - Apenas reordena as <tr> no DOM (cliente). NÃO altera a execução real.
// - Mantido do teu script; apenas pequenos reforços de robustez.
// ============================================================================
(function () {

  // =========================
  // [ATP] Localizar Regra no Fluxo (Modal BPMN)
  // =========================
  let ATP_LAST_RULES = null;
  let ATP_BPMN_SPLIT_CACHE = null; // [{filename, xml}]
  let ATP_BPMN_SPLIT_CACHE_KEY = '';

  function atpGetBpmnSplitFilesForRules(rules) { // Obtém o BPMN split files for regras.
    try {
      const key = String((rules && rules.length) || 0);
      if (ATP_BPMN_SPLIT_CACHE && ATP_BPMN_SPLIT_CACHE_KEY === key) return ATP_BPMN_SPLIT_CACHE;
      const files = atpBuildFluxosBPMN(rules || [], { layout: 'grid', splitFiles: true }) || [];
      ATP_BPMN_SPLIT_CACHE = files;
      ATP_BPMN_SPLIT_CACHE_KEY = key;
      return files;
    } catch (e) {
      try { console.warn(LOG_PREFIX, '[Mapa] Falha ao gerar BPMN split:', e); } catch(_) {}
      return [];
    }
  }

  function atpFindBpmnFileByRuleNum(files, ruleNum) { // Localiza o BPMN file by regra num.
    const re = new RegExp('\\bREGRA\\s+' + String(ruleNum).replace(/[-/\\^$*+?.()|[\\]{}]/g, '\\$&') + '\\b', 'i');
    for (const f of (files || [])) {
      const xml = f && f.xml;
      if (xml && re.test(xml)) return f;
    }
    return null;
  }

  function atpParseBpmnToDiagram(xml) { // Extrai BPMN to diagrama.
    const dp = new DOMParser();
    const doc = dp.parseFromString(String(xml || ''), 'text/xml');
    // bounds by bpmnElement
    const shapes = [];
    const boundsByEl = new Map();

    const shapeEls = Array.from(doc.getElementsByTagNameNS('*', 'BPMNShape'));
    for (const sh of shapeEls) {
      const bpmnEl = sh.getAttribute('bpmnElement');
      const b = sh.getElementsByTagNameNS('*', 'Bounds')[0];
      if (!b || !bpmnEl) continue;
      const x = Number(b.getAttribute('x') || 0);
      const y = Number(b.getAttribute('y') || 0);
      const w = Number(b.getAttribute('width') || 0);
      const h = Number(b.getAttribute('height') || 0);
      const rec = { id: bpmnEl, x, y, w, h };
      boundsByEl.set(bpmnEl, rec);
      shapes.push(rec);
    }

    const edges = [];
    const edgeEls = Array.from(doc.getElementsByTagNameNS('*', 'BPMNEdge'));
    for (const ed of edgeEls) {
      const bpmnEl = ed.getAttribute('bpmnElement');
      if (!bpmnEl) continue;
      const wps = Array.from(ed.getElementsByTagNameNS('*', 'waypoint')).map(wp => ({
        x: Number(wp.getAttribute('x') || 0),
        y: Number(wp.getAttribute('y') || 0)
      }));
      if (wps.length < 2) continue;
      edges.push({ id: bpmnEl, waypoints: wps });
    }

    // Map element id -> {tag,name}
    const metaById = new Map();
    const proc = doc.getElementsByTagNameNS('*', 'process')[0];
    const all = proc ? Array.from(proc.getElementsByTagName('*')) : Array.from(doc.getElementsByTagName('*'));
    for (const el of all) {
      const id = el.getAttribute && el.getAttribute('id');
      if (!id) continue;
      const name = el.getAttribute('name') || '';
      const tag = (el.localName || el.tagName || '').toLowerCase();
      if (!metaById.has(id)) metaById.set(id, { tag, name });
    }

    // overall bbox
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    for (const s of shapes) {
      minX = Math.min(minX, s.x);
      minY = Math.min(minY, s.y);
      maxX = Math.max(maxX, s.x + s.w);
      maxY = Math.max(maxY, s.y + s.h);
    }
    for (const e of edges) {
      for (const p of e.waypoints) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
    }
    if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 800; maxY = 600; }

    return { shapes, edges, metaById, bbox: { minX, minY, maxX, maxY } };
  }

  function atpRenderDiagramSvg(diagram, highlightRuleNum) { // Renderiza diagrama SVG.
    const pad = 30;
    const vbX = diagram.bbox.minX - pad;
    const vbY = diagram.bbox.minY - pad;
    const vbW = (diagram.bbox.maxX - diagram.bbox.minX) + pad * 2;
    const vbH = (diagram.bbox.maxY - diagram.bbox.minY) + pad * 2;

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', `${vbX} ${vbY} ${vbW} ${vbH}`);
    svg.setAttribute('width', String(Math.min(1200, Math.max(700, vbW))));
    svg.setAttribute('height', String(Math.min(700, Math.max(420, vbH))));
    svg.classList.add('atp-map-svg');

    const defs = document.createElementNS(svgNS, 'defs');
    const marker = document.createElementNS(svgNS, 'marker');
    marker.setAttribute('id', 'atpArrow');
    marker.setAttribute('viewBox', '0 0 10 10');
    marker.setAttribute('refX', '10');
    marker.setAttribute('refY', '5');
    marker.setAttribute('markerWidth', '8');
    marker.setAttribute('markerHeight', '8');
    marker.setAttribute('orient', 'auto');
    const mp = document.createElementNS(svgNS, 'path');
    mp.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
    mp.setAttribute('fill', '#6b7280');
    marker.appendChild(mp);
    defs.appendChild(marker);

    const glow = document.createElementNS(svgNS, 'filter');
    glow.setAttribute('id', 'atpGlow');
    glow.innerHTML = '<feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="#f59e0b" flood-opacity="0.9"/>';
    defs.appendChild(glow);
    svg.appendChild(defs);

    // edges
    for (const e of (diagram.edges || [])) {
      const path = document.createElementNS(svgNS, 'path');
      const pts = e.waypoints;
      const d = pts.map((p,i)=> (i===0?`M ${p.x} ${p.y}`:`L ${p.x} ${p.y}`)).join(' ');
      path.setAttribute('d', d);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', '#6b7280');
      path.setAttribute('stroke-width', '1.6');
      path.setAttribute('marker-end', 'url(#atpArrow)');
      svg.appendChild(path);
    }

    let highlightEl = null;

    // shapes
    for (const s of (diagram.shapes || [])) {
      const meta = diagram.metaById.get(s.id) || { tag: '', name: '' };
      const tag = meta.tag;
      const name = meta.name || '';

      const isGateway = tag.includes('gateway');
      const isStart = tag.includes('startevent');
      const isEnd = tag.includes('endevent');
      const isService = tag.includes('servicetask');
      const isTask = tag === 'task' || isService;

      const shouldHighlight = isService && new RegExp('^\\s*REGRA\\s+' + String(highlightRuleNum) + '\\b', 'i').test(name);

      let node;
      if (isStart || isEnd) {
        node = document.createElementNS(svgNS, 'circle');
        node.setAttribute('cx', String(s.x + s.w/2));
        node.setAttribute('cy', String(s.y + s.h/2));
        node.setAttribute('r', String(Math.min(s.w,s.h)/2));
        node.setAttribute('fill', '#ffffff');
        node.setAttribute('stroke', shouldHighlight ? '#f59e0b' : '#111827');
        node.setAttribute('stroke-width', isEnd ? '2.2' : '1.8');
      } else if (isGateway) {
        node = document.createElementNS(svgNS, 'polygon');
        const cx = s.x + s.w/2, cy = s.y + s.h/2;
        const pts = [
          [cx, s.y],
          [s.x + s.w, cy],
          [cx, s.y + s.h],
          [s.x, cy]
        ].map(p=>p.join(',')).join(' ');
        node.setAttribute('points', pts);
        node.setAttribute('fill', '#ffffff');
        node.setAttribute('stroke', shouldHighlight ? '#f59e0b' : '#111827');
        node.setAttribute('stroke-width', shouldHighlight ? '2.6' : '1.8');
      } else if (isTask) {
        node = document.createElementNS(svgNS, 'rect');
        node.setAttribute('x', String(s.x));
        node.setAttribute('y', String(s.y));
        node.setAttribute('width', String(s.w));
        node.setAttribute('height', String(s.h));
        node.setAttribute('rx', '10');
        node.setAttribute('ry', '10');
        node.setAttribute('fill', '#ffffff');
        node.setAttribute('stroke', shouldHighlight ? '#f59e0b' : '#111827');
        node.setAttribute('stroke-width', shouldHighlight ? '2.6' : '1.5');
      } else {
        // pool/participant etc: ignore
        continue;
      }

      if (shouldHighlight) {
        node.setAttribute('filter', 'url(#atpGlow)');
        highlightEl = node;
      }

      svg.appendChild(node);

      // label
      const label = document.createElementNS(svgNS, 'text');
      label.setAttribute('x', String(s.x + s.w/2));
      label.setAttribute('y', String(s.y + s.h/2));
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('dominant-baseline', 'middle');
      label.setAttribute('font-size', '11');
      label.setAttribute('fill', '#111827');
      let txt = name || (tag.includes('task') ? '' : tag);
      if (txt.length > 42) txt = txt.slice(0, 39) + '...';
      label.textContent = txt;
      svg.appendChild(label);
    }

    return { svg, highlightEl };
  }


function atpFindBpmnElementIdByRuleNum(xml, ruleNum) { // Localiza o BPMN element ID by regra num.
    try {
      const doc = new DOMParser().parseFromString(String(xml || ''), 'text/xml');
      const num = String(ruleNum);
      const nodes = Array.from(doc.querySelectorAll('serviceTask, bpmn\\:serviceTask'));
      for (const n of nodes) {
        const name = (n.getAttribute('name') || '').trim();
        // aceita "REGRA 123" no começo
        if (name.startsWith('REGRA ' + num) || name.startsWith('REGRA\u00A0' + num)) {
          return n.getAttribute('id') || null;
        }
      }
    } catch (e) {}
    return null;
  }

  function atpCloseRuleMapModal() { // Fecha regra map modal.
    const el = document.getElementById('atpRuleMapModal');
    if (el) try { el.remove(); } catch(_) {}
  }

  function atpOpenRuleMapModal(ruleNum) { // Abre regra map modal.
    try {
      const rules = ATP_LAST_RULES || [];
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


      // Zoom (CSS transform no SVG). Mantem scroll e evita mexer em viewBox.
      let atpMapZoom = 1;
      const atpMapClamp = (v, a, b) => Math.max(a, Math.min(b, v)); // Executa map clamp.

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

      const atpMapApplyZoom = () => { // Executa map Aplica zoom.
        try {
          svg.style.transformOrigin = '0 0';
          svg.style.transform = 'scale(' + String(atpMapZoom.toFixed(3)) + ')';
          zoomLabel.textContent = Math.round(atpMapZoom * 100) + '%';
        } catch (e) {}
      };

      btnZoomOut.addEventListener('click', () => {
        atpMapZoom = atpMapClamp(atpMapZoom - 0.1, 0.2, 3);
        atpMapApplyZoom();
      });
      btnZoomIn.addEventListener('click', () => {
        atpMapZoom = atpMapClamp(atpMapZoom + 0.1, 0.2, 3);
        atpMapApplyZoom();
      });

      atpMapApplyZoom();

      actions.appendChild(btnZoomOut);
      actions.appendChild(zoomLabel);
      actions.appendChild(btnZoomIn);


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

          // Exporta o que esta sendo exibido no modal (labels truncados inclusos).
          viewer.saveSVG({ format: true }).then(({ svg }) => {
            const raw = String(svg || '');
            if (!raw) throw new Error('SVG vazio');

            // Garante width/height a partir do viewBox, para o raster ficar consistente.
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
                // Serializa de volta
                const ser = new XMLSerializer();
                normalized = ser.serializeToString(svgEl);
              }
            } catch (e) {
              normalized = raw;
            }

            const blob = new Blob([normalized], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);

            const img = new Image();
            // Evita problemas com SVG externo. Mesmo assim, como eh blob local, tende a funcionar.
            img.onload = () => {
              try {
                const scale = 2; // qualidade
                const w = img.naturalWidth || img.width || 2000;
                const h = img.naturalHeight || img.height || 1000;

                const canvas = document.createElement('canvas');
                canvas.width = Math.round(w * scale);
                canvas.height = Math.round(h * scale);

                const ctx = canvas.getContext('2d');
                if (!ctx) throw new Error('canvas 2d indisponivel');

                // Fundo branco (JPEG nao suporta transparência)
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
                      try { URL.revokeObjectURL(jurl); } catch (e) {}
                      try { a.remove(); } catch (e) {}
                    }, 0);
                  } catch (e) {
                    try { alert('Falha ao exportar JPEG.'); } catch (e2) {}
                  }
                }, 'image/jpeg', 0.92);

              } catch (e) {
                try { alert('Falha ao exportar JPEG.'); } catch (e2) {}
              } finally {
                try { URL.revokeObjectURL(url); } catch (e) {}
              }
            };
            img.onerror = () => {
              try { URL.revokeObjectURL(url); } catch (e) {}
              try { alert('Falha ao exportar JPEG (erro ao carregar SVG).'); } catch (e2) {}
            };
            img.src = url;

          }).catch((err) => {
            try { console.warn(LOG_PREFIX, '[Mapa] saveSVG falhou:', err); } catch (e) {}
            try { alert('Falha ao exportar JPEG.'); } catch (e2) {}
          });
        } catch (e) {
          try { alert('Falha ao exportar JPEG.'); } catch (e2) {}
        }
      });
      const btnClose = document.createElement('button');
      btnClose.type = 'button';
      btnClose.className = 'atp-map-btn';
      btnClose.textContent = 'Fechar';
      btnClose.addEventListener('click', atpCloseRuleMapModal);

      const btnCopy = document.createElement('button');
      btnCopy.type = 'button';
      btnCopy.className = 'atp-map-btn';
      btnCopy.textContent = 'Baixar BPMN desse fluxo';
      btnCopy.addEventListener('click', () => {
        try {
          const blob = new Blob([String(f.xml || '')], { type: 'application/xml;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = String(f.filename || ('fluxo_regra_' + ruleNum + '.bpmn'));
          document.body.appendChild(a);
          a.click();
          setTimeout(() => { try{URL.revokeObjectURL(url);}catch(e){} try{a.remove();}catch(e){} }, 0);
        } catch (e) {}
      });

      actions.appendChild(btnCopy);
      actions.appendChild(btnClose);
      top.appendChild(actions);

      const body = document.createElement('div');
      body.className = 'atp-map-body';
      const scroller = document.createElement('div');
      scroller.className = 'atp-map-scroller';
      scroller.appendChild(svg);
      body.appendChild(scroller);

      box.appendChild(top);
      box.appendChild(body);
      overlay.appendChild(box);
      document.body.appendChild(overlay);

      // centraliza tentando rolar até meio do svg
      setTimeout(() => {
        try {
          scroller.scrollLeft = Math.max(0, (svg.viewBox.baseVal.width/2) - (scroller.clientWidth/2));
          scroller.scrollTop  = Math.max(0, (svg.viewBox.baseVal.height/2) - (scroller.clientHeight/2));
        } catch(e) {}
      }, 50);

    } catch (e) {
      try { console.warn(LOG_PREFIX, '[Mapa] Falha ao abrir modal:', e); } catch(_) {}
    }
  }

  "use strict";

  const TABLE_ID = "tableAutomatizacaoLocalizadores";
  const TH_LABEL_RE = /n[ºo]\s*\/?\s*prioridade/i;

  function limparTextoLocal(s) { // Executa limpar texto local.
    return (s ?? "").toString().replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
  }

  function toIntOrNull(x) { // Executa to int or null.
    const m = String(x ?? "").match(/\d+/);
    return m ? Number(m[0]) : null;
  }

  function getRuleNumberFromCell(td) { // Obtém a regra number from cell.
    const txt = limparTextoLocal(td?.textContent || "");
    const m = txt.match(/^\s*(\d{1,6})\b/);
    return m ? Number(m[1]) : null;
  }

  function getPriorityFromCell(td) { // Obtém o priority from cell.
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

  function findPriorityColumnIndex(table) { // Localiza o priority column index.
    const thead = table?.tHead || table?.querySelector("thead");
    if (!thead) return -1;
    const ths = Array.from(thead.querySelectorAll("th"));
    for (let i = 0; i < ths.length; i++) {
      const t = limparTextoLocal(ths[i].textContent || "");
      if (TH_LABEL_RE.test(t)) return i;
    }
    return -1;
  }

  function getAllBodyRows(table) { // Obtém o all body rows.
    const tbodys = table.tBodies?.length ? Array.from(table.tBodies) : [];
    const rows = [];
    for (const tb of tbodys) for (const tr of Array.from(tb.rows)) rows.push(tr);
    return rows;
  }

  function sortTableByPriority(table, colIdx, direction) { // Executa sort tabela by priority.
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

  function ensureSortUI(table) { // Garante Ordena ui na UI.
    const thead = table.tHead || table.querySelector("thead");
    if (!thead) return;
    // Se o DataTables já foi inicializado, NÃO altere a estrutura (isso dispara TN/18)
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

  function init() { // Inicializa o módulo/rotinas associadas.
    const table = document.getElementById(TABLE_ID);
    if (table) {
      // Garante nossa coluna ANTES do DataTables “pegar” a tabela.
      const dtOn = (table.classList && table.classList.contains('dataTable')) || table.closest('.dataTables_wrapper');
      if (!dtOn) {
        try { ensureColumns(table); } catch (e) {}
      }ensureSortUI(table);
    }
  }

  init();

  const mo = new MutationObserver(() => {
    if (init._t) cancelAnimationFrame(init._t);
    init._t = requestAnimationFrame(init);
  });
  mo.observe(document.body, { childList: true, subtree: true });

})();

function parseTooltipMsgFromOnmouseover(onm) { // Extrai msg do atributo onmouseover (infraTooltipMostrar).
    return parseTooltipMsg(onm); // Reusa o parser já existente.
  }

function tooltipMsgToValue(msg) { // Converte texto do tooltip em "value" lógico (0..4, 3, null) — mesma regra do script original.
    const s = rmAcc(lower(msg || "")).replace(/\.+$/, "").trim(); // Normaliza e remove pontuação final.
    if (!s) return "null"; // Sem texto => indefinido.

    const reTodosLoc = /todos\s+(os\s+)?localizadores/; // "todos os localizadores"
    const reTodosExceto = /todos\s+(os\s+)?localizadores[\s\S]*exceto/; // "todos os localizadores ... exceto"

    if (s.includes("apenas os de sistema")) return "4"; // Apenas sistema.
    if (s.includes("nao remover") || s.includes("não remover") || s.includes("apenas acrescentar")) return "3"; // Não remover / só acrescenta.
    if (reTodosExceto.test(s) || (s.includes("exceto") && (s.includes("todos") && s.includes("localizador")))) return "2"; // Todos exceto (geralmente sistema).
    if (reTodosLoc.test(s) || s.includes("remover todos")) return "1"; // Remove todos.
    if (s.includes("localizador") && s.includes("informado")) return "0"; // Remove informados.

    return "null"; // Default.
  }

function removerPlainTextToValue(txt) { // Converte texto simples do TD em value (quando não há lupa) — mesma regra do script original.
    const s = rmAcc(lower(txt || "")).replace(/\.+$/, "").trim(); // Normaliza e remove pontuação final.
    if (!s) return null; // Vazio => nada.

    if (s === "nenhum") return "3"; // Nenhum => não remover.
    if (s.includes("manter") && s.includes("localizador") && s.includes("sistema")) return "2"; // Manter os de sistema => remove todos exceto sistema.
    if (s.includes("todos") && s.includes("localizador")) return "1"; // Todos os localizadores => remove todos.
    return null; // Caso não reconhecido.
  }

function replaceLupaImgWithEmoji(triggerEl, val) { // Esconde a lupa (IMG) e insere emoji equivalente (tooltip preservado).
    if (!triggerEl || triggerEl.nodeType !== 1) return; // Proteção.
    // O tooltip pode estar no <img> OU no pai (<a>/<span>). Então usamos o elemento "gatilho".
    const onm0 = triggerEl.getAttribute('onmouseover') || ''; // Lê onmouseover do gatilho.
    if (onm0.indexOf('Comportamento do Localizador REMOVER') === -1) return; // Se não é o tooltip certo, sai.

    // Encontra a IMG da lupa (se o próprio trigger já for IMG, ok; senão tenta dentro dele).
    const img = (triggerEl.tagName === 'IMG') ? triggerEl : (triggerEl.querySelector('img') || null); // IMG associada.
    if (!img) return; // Sem IMG, não há o que esconder/substituir.

    let msg0 = ''; // Mensagem do tooltip.
    try { msg0 = parseTooltipMsgFromOnmouseover(onm0) || ''; } catch { } // Extrai msg do onmouseover do gatilho.

    let span = null; // Possível span já existente.
    // Observação: às vezes o emoji fica após a IMG, outras após o gatilho; tentamos ambos.
    const nextImg = img.nextElementSibling; // Próximo irmão da IMG.
    const nextTrig = triggerEl.nextElementSibling; // Próximo irmão do gatilho.
    if (nextImg && nextImg.classList && nextImg.classList.contains('atp-remover-emoji-tooltip')) span = nextImg; // Emoji após IMG.
    if (!span && nextTrig && nextTrig.classList && nextTrig.classList.contains('atp-remover-emoji-tooltip')) span = nextTrig; // Emoji após gatilho.

    const currentVal = span?.dataset?.atpRemoverVal; // Value atual.
    const currentMsg = span?.dataset?.atpRemoverMsg; // Msg atual.
    if (span && String(currentVal) === String(val ?? 'null') && String(currentMsg || '') === String(msg0 || '')) { // Se nada mudou...
      img.style.display = 'none'; // Só garante lupa escondida.
      return; // Sai.
    }

    const fresh = mkEmojiSpan(val, "atp-tooltip"); // Cria novo emoji.
    fresh.classList.add('atp-remover-emoji-tooltip'); // Marca como tooltip.

    try { fresh.dataset.atpRemoverVal = String(val ?? 'null'); } catch { } // Salva value no dataset.
    try { if (msg0) fresh.dataset.atpRemoverMsg = msg0; } catch { } // Salva msg no dataset.

    fresh.style.cursor = "default"; // Cursor padrão.
    fresh.addEventListener("mouseenter", () => { // Ao passar o mouse...
      try { if (typeof window.infraTooltipMostrar === "function") window.infraTooltipMostrar(msg0, "Comportamento do Localizador REMOVER", 600); } catch { } // Mostra tooltip nativo.
    });
    fresh.addEventListener("mouseleave", () => { // Ao sair...
      try { if (typeof window.infraTooltipOcultar === "function") window.infraTooltipOcultar(); } catch { } // Esconde tooltip.
    });

    img.style.display = 'none'; // Esconde a lupa.

    if (span) span.replaceWith(fresh); // Se já tinha emoji, troca.
    else img.insertAdjacentElement("afterend", fresh); // Senão, insere após a IMG (layout mais previsível).

    // Importante: grava no TD, porque o parser usa isso como "fonte de verdade".
    const td = img.closest('td'); // TD do remover.
    if (td) { // Se achou TD...
      try { td.dataset.atpRemoverVal = String(val ?? 'null'); } catch { } // Salva VAL no TD.
      try { if (msg0) td.dataset.atpRemoverMsg = msg0; } catch { } // Salva MSG no TD.
    }

    try { img.dataset.atpEmojiApplied = "1"; } catch { } // Marca a lupa como processada.
  }

function updateAllRemoverLupasByTooltipText(root) { // Processa todas as lupas (tooltip REMOVER) dentro de um escopo.
    const scope = root || document; // Define escopo.
    // O tooltip pode estar no IMG ou em um nó pai (a/span). Então pegamos qualquer nó com o onmouseover.
    const triggers = Array.from(scope.querySelectorAll('[onmouseover*="Comportamento do Localizador REMOVER"]')); // Gatilhos.
    for (const el of triggers) { // Itera.
      const onm = el.getAttribute('onmouseover') || ''; // Lê onmouseover.
      const msg = parseTooltipMsgFromOnmouseover(onm); // Extrai msg.
      const val = tooltipMsgToValue(msg); // Converte em value.
      replaceLupaImgWithEmoji(el, val); // Substitui (usando o gatilho).
    }
  }

function replacePlainRemoverTextInTable(table, cols) { // Para linhas sem lupa, tenta reconhecer texto e inserir emoji.
    try { // Proteção.
      if (!table || !cols) return; // Guard.
      const tbodys = table.tBodies?.length ? Array.from(table.tBodies) : [table.querySelector("tbody")].filter(Boolean); // TBODYs.
      const rows = tbodys.flatMap(tb => Array.from(tb.rows)); // TRs.

      for (const tr of rows) { // Para cada linha...
        const tds = Array.from(tr.querySelectorAll(':scope > td')); // TDs.
        const td = tds[cols.colRemover] || null; // Coluna remover.
        if (!td) continue; // Guard.

        if (td.querySelector('img[src*="lupa.gif"][onmouseover*="Comportamento do Localizador REMOVER"]')) continue; // Se tem lupa, não mexe.
        if (td.querySelector('span.atp-remover-emoji')) continue; // Se já tem emoji, não mexe.

        const plain = clean(td.textContent || ""); // Texto simples.
        const val = removerPlainTextToValue(plain); // Converte para value.
        if (!val) continue; // Se não reconheceu, sai.

        // Marca no TD (para o parser de regras).
        try { td.dataset.atpRemoverVal = String(val); } catch { } // Value lógico.
        try { td.dataset.atpRemoverWildcard = (plain === 'Todos os localizadores') ? "1" : "0"; } catch { } // "Todos" tratamos como coringa.
        try { td.dataset.atpRemoverTextOriginal = plain; } catch { } // Texto original.

        const hidden = document.createElement("span"); // Span escondido do texto.
        hidden.className = "atp-remover-plain-text"; // Classe.
        hidden.textContent = plain; // Texto.

        const emoji = mkEmojiSpan(val, "atp-in-table"); // Emoji.
        emoji.dataset.atpRemoverVal = val; // Value no emoji.

        td.textContent = ""; // Limpa a célula.
        td.appendChild(hidden); // Mantém texto original para parser.
        td.appendChild(emoji); // Mostra emoji.
      }
    } catch { } // Ignora erro.
  }


  // ==============================
  // Logger: dump de TODAS as regras capturadas
  // ==============================

  const ATP_RULES_LOG = (window.__ATP_RULES_LOG = window.__ATP_RULES_LOG || { enabled: true, lastSignature: null, lastDump: null, didDumpOnce: false, force: false }); // Controle global.

  // Atalho manual para re-dumpar (sem recarregar a página).
  // Uso: window.atpDumpRegras()
  if (!window.atpDumpRegras) {
    window.atpDumpRegras = () => {
      try {
        ATP_RULES_LOG.force = true;
        ATP_RULES_LOG.didDumpOnce = false;
        logAllRules(Array.isArray(ATP_RULES_LOG.lastDump) ? ATP_RULES_LOG.lastDump : (window.__ATP_LAST_RULES || []));
      } finally {
        ATP_RULES_LOG.force = false;
      }
    };
  }

  function logAllRules(rules) { // Loga todas as regras capturadas no console (estilo [ATP][Conflito]).
    try {
      if (!ATP_RULES_LOG.enabled) return; // Se desativado, não loga.
      if (!Array.isArray(rules) || !rules.length) return; // Nada para logar.

      // Evita spam infinito: por padrão, faz dump apenas 1 vez por carregamento.
      // Se precisar novamente, rode no console: window.atpDumpRegras() (atalho abaixo).
      if (ATP_RULES_LOG.didDumpOnce && !ATP_RULES_LOG.force) return;

      // Assinatura estável (somente campos efetivamente usados na colisão).
      const signature = JSON.stringify(rules.map(r => ([
        String(r?.num ?? ''),
        String(r?.prioridade?.num ?? ''),
        String(exprCanon(r?.tipoControleCriterio, '') || ''),
        String(exprCanon(r?.localizadorRemover, '') || ''),
        String(exprCanon(r?.localizadorIncluirAcao, '') || ''),
        String(getOutrosCanonical(r) || ''),
      ])));
      if (ATP_RULES_LOG.lastSignature === signature && !ATP_RULES_LOG.force) return; // Nada mudou -> não loga novamente.
      ATP_RULES_LOG.lastSignature = signature; // Atualiza assinatura.
      ATP_RULES_LOG.lastDump = rules; // Guarda referência para inspeção posterior.
      ATP_RULES_LOG.didDumpOnce = true; // Marca que já fez dump.

      console.groupCollapsed(`[ATP][Regras] Dump de regras capturadas (${rules.length})`); // Grupo principal.

      // Loga uma regra por grupo (padrão igual ao [ATP][Conflito]).
      for (const r of rules) {
        const num = String(r?.num ?? ''); // Número.
        const pr  = String(r?.prioridade?.raw ?? ''); // Prioridade raw.
        const tipo = String(r?.tipoControleCriterio ?? ''); // Tipo.
        const header = `[ATP][Regra] #${num}`; // Cabeçalho.
        console.groupCollapsed(header); // Grupo da regra.
        // IMPORTANTE: este dump deve espelhar exatamente os mesmos campos/normalizações
        // usados na análise de colisões (os "...Canon" e flags auxiliares).
        console.log('Campos principais (mesmos da colisão):', {
          num: r?.num,
          ativa: r?.ativa !== false,

          // Prioridade
          prioridade: r?.prioridade,

          // Tipo Controle/Critério
          tipoControleCriterio: r?.tipoControleCriterio,

          // Localizadores
          localizadorIncluirAcao: r?.localizadorIncluirAcao,

          localizadorIncluirAcoes: (r?.localizadorIncluirAcao && Array.isArray(r.localizadorIncluirAcao.acoes)) ? r.localizadorIncluirAcao.acoes : [],
          localizadorRemover: r?.localizadorRemover,
          removerWildcard: !!r?.removerWildcard,

          // Comportamento do REMOVER (tooltip)
          comportamentoRemover: r?.comportamentoRemover,

          // Outros Critérios (estrutura)
          outrosCriterios: r?.outrosCriterios
        });
        console.groupEnd(); // Fecha grupo da regra.
      }

      console.groupEnd(); // Fecha grupo principal.
    } catch (e) {
      console.warn('[ATP] Falha ao logar regras:', e);
    }
  }
// ==============================
  // Logger de conflitos (console)
  // ==============================

  const ATP_CONFLICT_LOG = (window.__ATP_CONFLICT_LOG = window.__ATP_CONFLICT_LOG || { enabled: true, logged: new Set() }); // Controle global do log.

  function logConflictRead(baseRule, otherRule, rec) { // Log detalhado do conflito no console (com dedupe).
    try { // Proteção contra falhas.
      if (!ATP_CONFLICT_LOG.enabled) return; // Se desativado, não loga.
      const tipos = Array.from(rec?.tipos || []); // Tipos de conflito.
      const iNum = String(rec?.iNum ?? baseRule?.num ?? ''); // Número A.
      const jNum = String(rec?.jNum ?? otherRule?.num ?? ''); // Número B.
      const key = `${iNum}=>${jNum}|${tipos.join(',')}`; // Chave de dedupe.
      if (ATP_CONFLICT_LOG.logged.has(key)) return; // Já logado.
      ATP_CONFLICT_LOG.logged.add(key); // Marca como logado.

      console.groupCollapsed(`[ATP][Conflito] ${iNum} x ${jNum} :: ${tipos.join(' | ')}`); // Cabeçalho.
      console.log('Regra A (base):', baseRule || null); // Regra base.
      console.log('Regra B (outra):', otherRule || null); // Regra outra.

      const motivos = {}; // Motivos por tipo.
      if (rec?.motivosByTipo && typeof rec.motivosByTipo.forEach === 'function') { // Se há mapa...
        rec.motivosByTipo.forEach((set, tipo) => { motivos[tipo] = Array.from(set || []); }); // Converte sets.
      }
      console.log('Motivos detectados:', motivos); // Motivos.
      console.log('Impacto máximo:', rec?.impactoMax || null); // Impacto.
      console.groupEnd(); // Fecha grupo.
    } catch (e) { // Em erro...
      console.warn('[ATP] Falha ao logar conflito:', e); // Não quebra execução.
    }
  }
// ==============================


  function removeAlternarUI(root) { // Remove controles "[ + Expandir ]" do eProc
    if (!root || !root.querySelectorAll) return; // Guard.
    try {
      root.querySelectorAll('span[id^="alternarVisualizacao"], a[href*="alternarVisualizacaoLista"]').forEach(n => n.remove());
    } catch { /* noop */ }
  }

function stripExpandArtifacts(root) { // Remove reticências "..." do truncamento visual
    if (!root) return; // Guard.
    try {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      for (const tn of nodes) {
        const txt = String(tn.textContent || '');
        if (/^\s*\.\.\.\s*$/.test(txt)) { tn.textContent = ' '; continue; }
        tn.textContent = txt.replace(/\.\.\.\s*$/g, '');
      }
    } catch { /* noop */ }
  }

// ==============================

  

  // [MOVIDO] Funções de captura/extração de dados foram movidas para extract_dados.js
