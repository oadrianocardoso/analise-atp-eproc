
  // debounce/window.tDebounce(guarded) — evita redeclaração em módulos carregados múltiplas vezes
  try {
    if (typeof window.debounce !== 'function') {
      window.debounce = function (fn, wait) { // Agrupa chamadas rápidas e executa fn apenas após 'wait' ms sem novos disparos.
        let t = null;
        return function () {
          const ctx = this;
          const args = arguments;
          if (t) clearTimeout(t);
          t = setTimeout(() => {
            t = null;
            try { fn.apply(ctx, args); } catch (e) { try { console.warn('[ATP][UI] debounce fn erro:', e); } catch (_) {} }
          }, Math.max(0, wait || 0));
        };
      };
    }
    if (typeof window.tDebounce !== 'function') {
      window.tDebounce = function (fn, wait) { // Alias compatível: tDebounce -> debounce
        return window.debounce(fn, wait);
      };
    }
  } catch (e) {}

try { console.log('[ATP][LOAD] 06_conflicts_ui_init_and_close.js carregado com sucesso'); } catch (e) {}
/**
 * ATP MODULAR - 06_conflicts_ui_init_and_close.js
 * Extraído de ATP-versao estavel com bpmno.js
 */


// ID safe (não depende de const TABLE_ID e evita TDZ)
window.ATP_TABLE_ID = window.ATP_TABLE_ID || 'tableAutomatizacaoLocalizadores';
function recalc(table) { // Recalcula tudo (parse -> analyze -> render).
    if (!document.body.contains(table)) return;
    // Aguarda o eProc terminar de preencher os TDs (evita capturar linhas “vazias”)
    if (!atpWaitTablePopulationOrRetry(table)) {
      schedule(() => recalc(table), 200);
      return;
    } // Se tabela sumiu do DOM, não faz nada.
    // Evita mexer na estrutura durante redraw/processamento do DataTables (reduz TN/18 intermitente)
    if (table.classList && table.classList.contains('dataTable') && table.querySelector('.dataTables_processing')) {
      schedule(() => recalc(table), 250);
      return;
    }
    // Só garante/insere colunas ANTES do DataTables inicializar.
    if (!(table.classList && table.classList.contains('dataTable')) && !table.closest('.dataTables_wrapper')) {
      ensureColumns(table);
    }
    const cols = mapColumns(table); // Mapeia colunas.
    updateAllRemoverLupasByTooltipText(table); // Troca lupas do REMOVER por emoji (mantendo tooltip).
    replacePlainRemoverTextInTable(table, cols); // Para linhas sem lupa, tenta inserir emoji.
    const rules = parseRules(table, cols);
    ATP_LAST_RULES = rules;
    // Loga todas as regras capturadas (console).
    if (typeof logAllRules === "function") logAllRules(rules); // Extrai regras. // Extrai regras.
    if (!rules.length) { try { markATPRenderTick(); } catch (e) {} return; } // Se nada, sai.
    const conflicts = analyze(rules); // Analisa conflitos.
    render(table, rules, conflicts);
    try { markATPRenderTick(); } catch (e) {}
// Renderiza.
  }

  // ==============================
  // Descoberta da tabela e inicialização
  // ==============================

  function findTable() { // Tenta achar a tabela pelo ID; fallback por "parecido".
    const direct = document.getElementById(window.ATP_TABLE_ID || 'tableAutomatizacaoLocalizadores'); // Busca direta.
    if (direct) return direct; // Se achou, retorna.
    const candidates = Array.from(document.querySelectorAll('table')); // Todas tabelas.
    const wanted = [ // Heurística: padrões que o header deve ter.
      /n[ºo]\s*\/?\s*prioridade/i, // Cabeçalho Nº/Prioridade.
      /localizador.*remover/i, // Cabeçalho remover.
      /tipo.*(controle|crit[ée]rio)/i, // Cabeçalho tipo/critério.
      /localizador.*(incluir|a[cç][aã]o)/i, // Cabeçalho incluir/ação.
      /outros\s*crit[ée]rios/i // Cabeçalho outros critérios.
    ];
    let best = null; // Melhor candidata.
    let bestScore = 0; // Pontuação.
    for (const c of candidates) { // Para cada tabela...
      const ths = Array.from((c.tHead || c).querySelectorAll('th')); // Pega THs.
      if (!ths.length) continue; // Sem THs, ignora.
      const text = ths.map(th => clean(th.textContent)).join(' | '); // Texto do header.
      const score = wanted.reduce((acc, re) => acc + (re.test(text) ? 1 : 0), 0); // Conta quantos padrões bate.
      if (score > bestScore) { best = c; bestScore = score; } // Atualiza melhor.
    }
    return (bestScore >= 3) ? best : null; // Exige pelo menos 3 padrões para aceitar.
  }

function waitTable(timeoutMs = 120000) { // Espera a tabela aparecer (SPA/AJAX) via MutationObserver.
    const direct = findTable(); // Tenta achar já.
    if (direct) return Promise.resolve(direct); // Se achou, resolve.
    return new Promise(resolve => { // Cria promise.
      const mo = new MutationObserver(() => { // Observa mudanças no DOM.
        const tb = findTable(); // Tenta achar de novo.
        if (tb) { mo.disconnect(); resolve(tb); } // Achou => desconecta e resolve.
      });
      mo.observe(document.body, { childList: true, subtree: true }); // Observa árvore toda.
      setTimeout(() => { mo.disconnect(); resolve(null); }, timeoutMs); // Timeout: resolve null.
    });
  }

  async function init() { // Inicialização principal.
    injectStyle(); // Injeta CSS desde já.
    const table = await waitTable(); // Aguarda tabela.
    if (!table) return; // Se não achou, aborta.
    ensureColumns(table); // Garante colunas extras.
    updateAllRemoverLupasByTooltipText(table); // Troca lupas do REMOVER por emoji (mantendo tooltip).
    addOnlyConflictsCheckbox(table, () => schedule(() => applyFilter(table), 0)); // Checkbox de filtro.
    try { atpEnsureFluxosPickerUI(table); } catch (e) {}
    recalc(table); // Primeira execução.
    table.addEventListener('change', () => schedule(() => recalc(table), 200), true); // Recalcula quando altera select/checkbox.
    const root = table.parentElement || document.body; // Observa um escopo menor quando possível.
    const mo = new MutationObserver(() => {
      if (ATP_SUPPRESS_OBSERVER) return; // Ignora mutações causadas pelo próprio script.
      schedule(() => recalc(table), 250);
    }); // Observa mudanças (ex.: paginação, AJAX).
    mo.observe(root, { childList: true, subtree: true }); // Ativa observer.
  }





  // =========================
  // [ATP] Seletor de Fluxos (UI) + Visualizar no BPMN (modal bpmn-js)
  // =========================
  function atpEnsureFluxosPickerUI(table) { // Garante que o seletor de fluxos exista e esteja montado na UI.
    try {
      const host = document.getElementById('dvFiltrosOpcionais');
      if (!host || !host.parentNode) return;

      // Cria abaixo do dvFiltrosOpcionais (não dentro), conforme solicitado.
      let wrap = document.getElementById('fluxos');
      if (!wrap) {
        wrap = document.createElement('div');
        wrap.id = 'fluxos';
        wrap.style.marginTop = '8px';
        wrap.style.display = 'flex';
        wrap.style.alignItems = 'center';
        wrap.style.gap = '8px';
        wrap.style.flexWrap = 'wrap';

        const title = document.createElement('span');
        title.textContent = 'Fluxos:';
        title.style.fontWeight = '600';
        title.style.marginRight = '4px';

        const sel = document.createElement('select');
        sel.id = 'atpSelFluxo';
        sel.className = 'infraSelect';
        sel.style.minWidth = '520px';
        sel.style.maxWidth = 'min(900px, 90vw)';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'infraButton';
        btn.id = 'btnVisualizarFluxoATP';
        btn.textContent = 'Visualizar Fluxo';

        // Recarrega opções quando o usuário abrir o combo (mantém sempre atualizado)
        sel.addEventListener('mousedown', () => {
          try { atpRefreshFluxosPickerOptions(table); } catch (e) {}
        }, true);

        btn.addEventListener('click', () => {
          try {
            atpRefreshFluxosPickerOptions(table);
            const idx = parseInt(String(sel.value || '-1'), 10);
            if (!Number.isFinite(idx) || idx < 0) {
              alert('Selecione um fluxo.');
              return;
            }
            const rules = (ATP_LAST_RULES && ATP_LAST_RULES.length) ? ATP_LAST_RULES : [];
            if (!rules.length) {
              alert('Não foi possível obter as regras (tabela vazia ou não carregada).');
              return;
            }
            const files = (window.ATP && window.ATP.extract && typeof window.ATP.extract.getBpmnFilesForRules === 'function')
              ? window.ATP.extract.getBpmnFilesForRules(rules)
              : atpGetBpmnSplitFilesForRules(rules);
            const f = files && files[idx];
            if (!f || !f.xml) {
              alert('Fluxo selecionado não possui BPMN gerado.');
              return;
            }
            atpOpenFlowBpmnModal(f, idx);
          } catch (e) {
            try { console.warn(LOG_PREFIX, '[Fluxos/UI] Falha ao visualizar fluxo:', e); } catch(_) {}
          }
        });

        wrap.appendChild(title);
        wrap.appendChild(sel);
        wrap.appendChild(btn);

        host.insertAdjacentElement('afterend', wrap);
      }

      // Popula inicialmente
      atpRefreshFluxosPickerOptions(table);

    } catch (e) {}
  }

  function atpRefreshFluxosPickerOptions(table) { // Atualiza as opções do seletor de fluxos a partir dos fluxos disponíveis.
    try {
      const sel = document.getElementById('atpSelFluxo');
      if (!sel) return;

      // Garante que temos regras atuais
      let rules = (ATP_LAST_RULES && ATP_LAST_RULES.length) ? ATP_LAST_RULES : null;
      if (!rules) {
        // Faz parse rápido da tabela atual
        try { if (table) { try { ensureColumns(table); } catch(e) {} } } catch(e) {}
        let cols = null
        try { cols = mapColumns(table); } catch(e) { cols = null }
        if (!cols) cols = {};
        try { rules = parseRules(table, cols); } catch(e) { rules = [] }
        ATP_LAST_RULES = rules;
      }
      if (!rules || !rules.length) {
        sel.innerHTML = '';
        const opt = document.createElement('option');
        opt.value = '-1';
        opt.textContent = '(nenhum fluxo detectado)';
        sel.appendChild(opt);
        return;
      }

      const data = (window.ATP && window.ATP.extract && typeof window.ATP.extract.getFluxosData === 'function')
        ? window.ATP.extract.getFluxosData(rules)
        : atpComputeFluxosData(rules);
      const fluxos = (data && data.fluxos) ? data.fluxos : [];

      // Mantém seleção atual
      const prev = sel.value;
      sel.innerHTML = '';

      if (!fluxos.length) {
        const opt = document.createElement('option');
        opt.value = '-1';
        opt.textContent = '(nenhum fluxo detectado)';
        sel.appendChild(opt);
        return;
      }

      fluxos.forEach((fl, idx) => {
        const opt = document.createElement('option');
        opt.value = String(idx);
        opt.textContent = (window.ATP && window.ATP.extract && typeof window.ATP.extract.buildFluxoOptionLabel === 'function')
          ? window.ATP.extract.buildFluxoOptionLabel(fl, idx)
          : (() => {
              const starts = (fl && fl.starts && fl.starts.length) ? fl.starts.join(' | ') : '(sem início)';
              const nodesN = (fl && fl.nodes && fl.nodes.length) ? fl.nodes.length : 0;
              return `Fluxo ${String(idx+1).padStart(2,'0')} — Início(s): [${starts}] — Nós: ${nodesN}`;
            })();
        sel.appendChild(opt);
      });

      // Restaura seleção se ainda existir
      if (prev && Array.from(sel.options).some(o => o.value === prev)) sel.value = prev;
      else sel.value = '0';

    } catch (e) {}
  }

  function atpOpenFlowBpmnModal(fileObj, flowIdx) { // Abre o modal do BPMN do fluxo selecionado.
    try {
      // Reutiliza o mesmo modal do mapa (bpmn-js modeler fullscreen)
      atpCloseRuleMapModal();

      const overlay = document.createElement('div');
      overlay.id = 'atpRuleMapModal';
      overlay.className = 'atp-map-overlay';
      overlay.addEventListener('click', (ev) => { if (ev.target === overlay) atpCloseRuleMapModal(); });

      const box = document.createElement('div');
      box.className = 'atp-map-box';

      const top = document.createElement('div');
      top.className = 'atp-map-top';

      const titleTxt = `🧭 Visualizar Fluxo ${String((flowIdx|0)+1).padStart(2,'0')} (BPMN)`;
      top.innerHTML = `<div><div class="atp-map-title">${titleTxt}</div><div class="atp-map-sub">Arquivo: ${String(fileObj && fileObj.filename || '')}</div></div>`;

      const actions = document.createElement('div');
      actions.className = 'atp-map-actions';

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
            const blob = new Blob([String(fileObj.xml || '')], { type: 'application/xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = String(fileObj.filename || ('fluxo_' + String(flowIdx+1).padStart(2,'0') + '.bpmn'));
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { try{URL.revokeObjectURL(url);}catch(e){} try{a.remove();}catch(e){} }, 0);
            return;
          }

          try { if (overlay._atpRestoreNames) overlay._atpRestoreNames(); } catch (e) {}

          viewer.saveXML({ format: true }).then(({ xml }) => {
            const blob = new Blob([String(xml || '')], { type: 'application/xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = String(fileObj.filename || ('fluxo_' + String(flowIdx+1).padStart(2,'0') + '.bpmn'));
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { try{URL.revokeObjectURL(url);}catch(e){} try{a.remove();}catch(e){} }, 0);
          }).finally(() => {
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

          viewer.saveSVG({ format: true }).then(({ svg }) => {
            const raw = String(svg || '');
            if (!raw) throw new Error('SVG vazio');

            let normalized = raw;
            try {
              const parser = new DOMParser();
              const doc = parser.parseFromString(raw, 'image/svg+xml');
              const svgEl = doc.documentElement;
              if (svgEl && String(svgEl.tagName).toLowerCase() === 'svg') {
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
                normalized = new XMLSerializer().serializeToString(svgEl);
              }
            } catch (e) { normalized = raw; }

            const blob = new Blob([normalized], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);

            const img = new Image();
            img.onload = () => {
              try {
                const scale = 2;
                const w = img.naturalWidth || img.width || 2000;
                const h = img.naturalHeight || img.height || 1000;

                const canvasEl = document.createElement('canvas');
                canvasEl.width = Math.round(w * scale);
                canvasEl.height = Math.round(h * scale);

                const ctx = canvasEl.getContext('2d');
                if (!ctx) throw new Error('canvas 2d indisponivel');

                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);

                ctx.setTransform(scale, 0, 0, scale, 0, 0);
                ctx.drawImage(img, 0, 0);

                canvasEl.toBlob((jpegBlob) => {
                  try {
                    if (!jpegBlob) throw new Error('Falha ao gerar JPEG');
                    const jurl = URL.createObjectURL(jpegBlob);
                    const a = document.createElement('a');
                    a.href = jurl;
                    const base = String(fileObj.filename || ('fluxo_' + String(flowIdx+1).padStart(2,'0') + '.bpmn')).replace(/\.bpmn$/i, '');
                    a.download = base + '.jpeg';
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(() => {
                      try { URL.revokeObjectURL(jurl); } catch (e) {}
                      try { a.remove(); } catch (e) {}
                    }, 0);
                  } catch (e) {
                    alert('Falha ao exportar JPEG.');
                  }
                }, 'image/jpeg', 0.92);

              } catch (e) {
                alert('Falha ao exportar JPEG.');
              } finally {
                try { URL.revokeObjectURL(url); } catch (e) {}
              }
            };
            img.onerror = () => {
              try { URL.revokeObjectURL(url); } catch (e) {}
              alert('Falha ao exportar JPEG.');
            };
            img.src = url;

          }).catch(() => alert('Falha ao exportar JPEG.'));

        } catch (e) {
          try { alert('Falha ao exportar JPEG.'); } catch (_) {}
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
      const canvas = document.createElement('div');
      canvas.className = 'atp-map-canvas';
      canvas.id = 'atpRuleMapCanvas';
      body.appendChild(canvas);

      box.appendChild(top);
      box.appendChild(body);
      overlay.appendChild(box);
      document.body.appendChild(overlay);

      // Carrega o BPMN no modeler (editor)
      atpEnsureBpmnJsLoaded().then((BpmnJS) => {
        const viewer = new BpmnJS({ container: canvas });
        overlay._atpBpmnViewer = viewer;

        // Truncamento apenas visual + tooltip (hover) com texto completo
        const originalNames = new Map();
        const MAX_LABEL = 90;
        const truncate = (s) => { // Trunca texto/valor para um tamanho máximo.
          const str = String(s || '');
          return (str.length > MAX_LABEL) ? (str.slice(0, MAX_LABEL - 1) + '…') : str;
        };

        // Tooltip SVG (title) - mostra o texto completo ao passar o mouse
        const SVG_NS = 'http://www.w3.org/2000/svg';
        const setSvgTitle = (gfx, text) => { // Define o título/tooltip do SVG renderizado.
          try {
            if (!gfx || !text) return;
            const t = String(text);
            let titleEl = gfx.querySelector('title');
            if (!titleEl) {
              titleEl = document.createElementNS(SVG_NS, 'title');
              gfx.insertBefore(titleEl, gfx.firstChild);
            }
            titleEl.textContent = t;
          } catch (e) {}
        };

        const getDocumentationText = (bo) => { // Obtém o texto de documentação/ajuda exibido na UI.
          try {
            const docs = bo && bo.documentation;
            if (!docs) return '';
            const arr = Array.isArray(docs) ? docs : [docs];
            const first = arr.find(d => d && typeof d.text === 'string' && d.text.trim());
            return first ? String(first.text).trim() : '';
          } catch (e) {
            return '';
          }
        };

        overlay._atpApplyHoverTitles = () => {
          try {
            const elementRegistry = viewer.get('elementRegistry');
            elementRegistry.forEach((el) => {
              try {
                if (!el || !el.businessObject) return;
                const bo = el.businessObject;
                // Preferir documentation (quando existe) para mostrar texto integral.
                const docText = getDocumentationText(bo);
                const full = docText || originalNames.get(el.id) || bo.name;
                if (!full) return;

                const gfx = elementRegistry.getGraphics(el);
                setSvgTitle(gfx, full);

                // Tentar também no label (quando existir)
                try {
                  const lbl = elementRegistry.get(el.id + '_label');
                  if (lbl) setSvgTitle(elementRegistry.getGraphics(lbl), full);
                } catch (e2) {}
              } catch (e) {}
            });
          } catch (e) {}
        };
        overlay._atpRestoreNames = () => {
          try {
            const modeling = viewer.get('modeling');
            originalNames.forEach((name, id) => {
              try { modeling.updateProperties(viewer.get('elementRegistry').get(id), { name }); } catch (e) {}
            });
            try { overlay._atpApplyHoverTitles && overlay._atpApplyHoverTitles(); } catch (e) {}
          } catch (e) {}
        };
        overlay._atpApplyTruncation = () => {
          try {
            const elementRegistry = viewer.get('elementRegistry');
            const modeling = viewer.get('modeling');
            elementRegistry.forEach((el) => {
              try {
                const bo = el && el.businessObject;
                if (!bo || typeof bo.name !== 'string' || !bo.name) return;
                if (!originalNames.has(el.id)) originalNames.set(el.id, bo.name);
                const t = truncate(originalNames.get(el.id));
                if (t !== bo.name) modeling.updateProperties(el, { name: t });
              } catch (e) {}
            });
            try { overlay._atpApplyHoverTitles && overlay._atpApplyHoverTitles(); } catch (e) {}
          } catch (e) {}
        };

        viewer.importXML(String(fileObj.xml || '')).then(() => {
          try {
            const canvasApi = viewer.get('canvas');
            canvasApi.zoom('fit-viewport');
            zoomValue = canvasApi.zoom();
            zoomLabel.textContent = Math.round(zoomValue * 100) + '%';
            overlay._atpApplyTruncation();
            try { overlay._atpApplyHoverTitles && overlay._atpApplyHoverTitles(); } catch (e) {}
          } catch (e) {}
        }).catch((e) => {
          try { console.warn(LOG_PREFIX, '[Fluxos/UI] importXML falhou:', e); } catch(_) {}
          alert('Falha ao carregar BPMN no modal.');
        });

        const setZoom = (z) => { // Define o nível de zoom do visualizador.
          try {
            const canvasApi = viewer.get('canvas');
            zoomValue = clamp(z, 0.2, 3.0);
            canvasApi.zoom(zoomValue);
            zoomLabel.textContent = Math.round(zoomValue * 100) + '%';
          } catch (e) {}
        };
        btnZoomIn.addEventListener('click', () => setZoom(zoomValue + 0.1));
        btnZoomOut.addEventListener('click', () => setZoom(zoomValue - 0.1));
        btnFit.addEventListener('click', () => {
          try {
            const canvasApi = viewer.get('canvas');
            canvasApi.zoom('fit-viewport');
            zoomValue = canvasApi.zoom();
            zoomLabel.textContent = Math.round(zoomValue * 100) + '%';
          } catch (e) {}
        });

      }).catch((e) => {
        try { console.warn(LOG_PREFIX, '[Fluxos/UI] Falha ao carregar bpmn-js modeler:', e); } catch(_) {}
        alert('Não foi possível carregar o bpmn-js (modeler).');
      });

    } catch (e) {}
  }


  // --- Override do modal do mapa para usar BPMN-JS (interativo) ---
  


  


  init(); // Executa init.


try { console.log('[ATP][OK] 06_conflicts_ui_init_and_close.js inicializado'); } catch (e) {}

  try { if (typeof window.addOnlyConflictsCheckbox !== 'function') window.addOnlyConflictsCheckbox = addOnlyConflictsCheckbox; } catch(e) {}
