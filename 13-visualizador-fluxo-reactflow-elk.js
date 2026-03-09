try { console.log('[ATP][LOAD] 13-visualizador-fluxo-reactflow-elk.js carregado com Drawflow'); } catch (e) { }

(function () {
  'use strict';

  const MODAL_ID = 'atpNodeRedModal';
  const STYLE_ID = 'atp-drawflow-style';
  const DRAWFLOW_CSS_URL = 'https://cdn.jsdelivr.net/npm/drawflow@0.0.60/dist/drawflow.min.css';
  const DRAWFLOW_JS_URL = 'https://cdn.jsdelivr.net/npm/drawflow@0.0.60/dist/drawflow.min.js';
  let ATP_DRAWFLOW_PROMISE = null;

  function dfEsc(value) {
    if (typeof esc === 'function') return esc(value);
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function dfTrunc(value, max) {
    const s = String(value == null ? '' : value);
    const lim = Math.max(8, Number(max) || 120);
    return s.length <= lim ? s : (s.slice(0, lim - 1) + '...');
  }

  function ensureDrawflowAssets() {
    if (!document.querySelector('link[data-atp-drawflow-css="1"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = DRAWFLOW_CSS_URL;
      link.setAttribute('data-atp-drawflow-css', '1');
      document.head.appendChild(link);
    }

    if (document.getElementById(STYLE_ID)) return;
    const st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = `
      .atp-df-wrap{
        position:absolute;
        inset:0;
        overflow:hidden;
        background:
          linear-gradient(0deg, rgba(148,163,184,.12) 1px, transparent 1px),
          linear-gradient(90deg, rgba(148,163,184,.12) 1px, transparent 1px),
          #eef2f7;
        background-size:24px 24px;
      }
      .atp-df-canvas{position:absolute;inset:0;}
      .atp-df-canvas #drawflow{width:100%;height:100%;background:transparent;}
      .atp-df-canvas .drawflow{background:transparent;}
      .atp-df-canvas .drawflow .parent-drawflow{background:transparent;}
      .atp-df-canvas .drawflow-node{
        width:auto !important;
        min-width:220px;
        border-radius:12px !important;
        border-width:2px !important;
        box-shadow:0 10px 24px rgba(15,23,42,.12) !important;
        background:#fff !important;
      }
      .atp-df-canvas .drawflow-node .drawflow_content_node{padding:0 !important;background:transparent !important;}
      .atp-df-node{
        width:100%;
        min-width:220px;
        max-width:260px;
        box-sizing:border-box;
        padding:10px 14px;
        font-family:Arial, Helvetica, sans-serif;
      }
      .atp-df-node-title{
        font-size:12px;
        font-weight:700;
        line-height:1.25;
        color:#0f172a;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      }
      .atp-df-node-sub{
        margin-top:4px;
        font-size:10px;
        line-height:1.25;
        color:#475569;
        max-height:28px;
        overflow:hidden;
      }
      .atp-df-kind-start{border-color:#38bdf8 !important;background:#effaff !important;}
      .atp-df-kind-start .atp-df-node-title{color:#0c4a6e;}
      .atp-df-kind-loc{border-color:#8b5cf6 !important;background:#f5f0ff !important;}
      .atp-df-kind-loc .atp-df-node-title{color:#4c1d95;}
      .atp-df-kind-rule{border-color:#fb923c !important;background:#fff7ed !important;}
      .atp-df-kind-rule .atp-df-node-title{color:#9a3412;}
      .atp-df-kind-refine{border-color:#6366f1 !important;background:#eef2ff !important;}
      .atp-df-kind-refine .atp-df-node-title{color:#3730a3;}
      .atp-df-kind-end{border-color:#22c55e !important;background:#f0fdf4 !important;}
      .atp-df-kind-end .atp-df-node-title{color:#166534;}
      .atp-df-canvas .drawflow-node .input,
      .atp-df-canvas .drawflow-node .output{
        width:12px;
        height:12px;
        border-width:2px;
        background:#fff;
      }
      .atp-df-canvas .drawflow-node .output{right:-8px;}
      .atp-df-canvas .drawflow-node .input{left:-8px;}
      .atp-df-canvas .atp-df-kind-start .output,
      .atp-df-canvas .atp-df-kind-start .input{border-color:#0284c7;background:#0ea5e9;}
      .atp-df-canvas .atp-df-kind-loc .output,
      .atp-df-canvas .atp-df-kind-loc .input{border-color:#6d28d9;background:#8b5cf6;}
      .atp-df-canvas .atp-df-kind-rule .output,
      .atp-df-canvas .atp-df-kind-rule .input{border-color:#ea580c;background:#f97316;}
      .atp-df-canvas .atp-df-kind-refine .output,
      .atp-df-canvas .atp-df-kind-refine .input{border-color:#4338ca;background:#6366f1;}
      .atp-df-canvas .atp-df-kind-end .output,
      .atp-df-canvas .atp-df-kind-end .input{border-color:#16a34a;background:#22c55e;}
      .atp-df-canvas svg .connection path{stroke:#64748b !important;stroke-width:3px !important;fill:none !important;}
      .atp-df-help{font-size:11px;color:#475569;margin-left:10px;}
    `;
    document.head.appendChild(st);
  }

  function ensureDrawflowLoaded() {
    if (typeof window.Drawflow === 'function') return Promise.resolve(window.Drawflow);
    if (ATP_DRAWFLOW_PROMISE) return ATP_DRAWFLOW_PROMISE;

    ATP_DRAWFLOW_PROMISE = new Promise((resolve, reject) => {
      try {
        const existing = document.querySelector('script[data-atp-drawflow-js="1"]')
          || document.querySelector(`script[src="${DRAWFLOW_JS_URL}"]`);
        if (existing) {
          existing.addEventListener('load', () => {
            if (typeof window.Drawflow === 'function') resolve(window.Drawflow);
            else reject(new Error('Drawflow carregou sem expor window.Drawflow'));
          }, { once: true });
          existing.addEventListener('error', () => reject(new Error('Falha ao carregar Drawflow.')), { once: true });
          setTimeout(() => {
            if (typeof window.Drawflow === 'function') resolve(window.Drawflow);
          }, 300);
          return;
        }

        const s = document.createElement('script');
        s.src = DRAWFLOW_JS_URL;
        s.async = true;
        s.setAttribute('data-atp-drawflow-js', '1');
        s.onload = () => {
          if (typeof window.Drawflow === 'function') resolve(window.Drawflow);
          else reject(new Error('Drawflow carregou sem expor window.Drawflow'));
        };
        s.onerror = () => reject(new Error('Falha ao carregar Drawflow.'));
        document.head.appendChild(s);
      } catch (e) {
        reject(e);
      }
    }).catch((e) => {
      ATP_DRAWFLOW_PROMISE = null;
      throw e;
    });

    return ATP_DRAWFLOW_PROMISE;
  }

  function getRulesStateFallback() {
    if (typeof window.atpGetLastRules === 'function') {
      const rules = window.atpGetLastRules();
      if (Array.isArray(rules)) return rules;
    }
    return Array.isArray(window.__ATP_LAST_RULES__) ? window.__ATP_LAST_RULES__ : [];
  }

  function resolveFluxosData(rules) {
    try {
      if (window.ATP && window.ATP.extract && typeof window.ATP.extract.getFluxosData === 'function') {
        const data = window.ATP.extract.getFluxosData(rules || []);
        if (data && typeof data === 'object') return data;
      }
    } catch (e) {
      try { console.warn('[ATP][DF] Falha ao obter fluxos via ATP.extract.getFluxosData:', e); } catch (_) { }
    }
    if (typeof atpComputeFluxosData === 'function') return atpComputeFluxosData(rules || []);
    return { fluxos: [], byFrom: new Map() };
  }

  function buildRuleTitle(item) {
    if (!item || !item.rule) return 'REFINAMENTO';
    const r = item.rule;
    const num = String((r && (r.num || r.numero || r.id || '?')) || '?');
    const pr = r && r.prioridade && (r.prioridade.num ?? r.prioridade.raw ?? r.prioridade.text);
    return pr != null && pr !== '' ? `REGRA ${num} - P${pr}` : `REGRA ${num}`;
  }

  function buildRuleSubtitle(item) {
    if (!item || !item.rule) return 'Desdobra condicao composta (AND / &&).';
    const r = item.rule;
    const tipo = clean((r && (r.tipoControleCriterio && (r.tipoControleCriterio.canonical || r.tipoControleCriterio.text))) || r.tipoControleCriterio || r.tipoControle || '');
    const outros = (typeof atpHumanizeOutrosCriteriosExpr === 'function') ? atpHumanizeOutrosCriteriosExpr(r && r.outrosCriterios) : '';
    const parts = [];
    if (tipo) parts.push(tipo);
    if (outros) parts.push(outros);
    return dfTrunc(parts.join(' | ') || 'Regra de encaminhamento.', 110);
  }

  function sortFlowItems(items) {
    return (items || []).slice().sort((a, b) => {
      const ra = a && a.rule ? Number(a.rule.num || a.rule.numero || 0) : Number.MAX_SAFE_INTEGER;
      const rb = b && b.rule ? Number(b.rule.num || b.rule.numero || 0) : Number.MAX_SAFE_INTEGER;
      return ra - rb || buildRuleTitle(a).localeCompare(buildRuleTitle(b));
    });
  }

  function makeGraphKey(prefix, value) {
    return prefix + '::' + String(value || '');
  }

  function buildDrawflowGraph(flow, data) {
    const nodeSet = new Set(Array.isArray(flow && flow.nodes) ? flow.nodes : []);
    const starts = Array.isArray(flow && flow.starts) && flow.starts.length ? flow.starts.slice() : Array.from(nodeSet).slice(0, 1);
    const byFrom = (data && data.byFrom instanceof Map) ? data.byFrom : new Map();
    const graph = { nodes: [], edges: [], roots: [], byKey: new Map() };
    let seq = 0;

    function addNode(key, kind, title, subtitle, meta) {
      if (graph.byKey.has(key)) return graph.byKey.get(key);
      const node = {
        id: 'df_' + (++seq),
        key,
        kind,
        title: String(title || ''),
        subtitle: String(subtitle || ''),
        meta: meta || {},
        x: 0,
        y: 0,
        inputs: [],
        outputs: [],
        depth: 0
      };
      graph.nodes.push(node);
      graph.byKey.set(key, node);
      return node;
    }

    function addEdge(fromNode, toNode, kind) {
      const edgeKey = `${fromNode.id}->${toNode.id}`;
      if (graph.edges.some((e) => e.key === edgeKey)) return;
      graph.edges.push({ key: edgeKey, from: fromNode.id, to: toNode.id, kind: kind || 'default' });
      fromNode.outputs.push(toNode.id);
      toNode.inputs.push(fromNode.id);
    }

    function localNode(localizador) {
      const outs = sortFlowItems((byFrom.get(localizador) || []).filter((item) => {
        const targets = Array.isArray(item && item.toKeys) ? item.toKeys : [];
        return targets.some((tk) => nodeSet.has(tk));
      }));
      const isStart = starts.includes(localizador);
      const isEnd = !outs.length;
      const kind = isStart ? 'start' : (isEnd ? 'end' : 'loc');
      const sub = isStart ? 'Inicio do fluxo' : (isEnd ? 'Sem regras de saida' : 'Localizador');
      return addNode(makeGraphKey('loc', localizador), kind, dfTrunc(localizador, 54), sub, { full: String(localizador || '') });
    }

    for (const key of Array.from(nodeSet).sort((a, b) => String(a).localeCompare(String(b)))) localNode(key);

    for (const from of Array.from(nodeSet).sort((a, b) => String(a).localeCompare(String(b)))) {
      const source = localNode(from);
      const items = sortFlowItems(byFrom.get(from) || []);
      items.forEach((item, idx) => {
        const targets = Array.from(new Set((item && item.toKeys ? item.toKeys : []).filter((tk) => nodeSet.has(tk))));
        if (!targets.length) return;
        const ruleNode = addNode(
          makeGraphKey('rule', `${from}::${idx}::${buildRuleTitle(item)}`),
          item && item.rule ? 'rule' : 'refine',
          buildRuleTitle(item),
          buildRuleSubtitle(item),
          { full: buildRuleTitle(item) + ' - ' + buildRuleSubtitle(item) }
        );
        addEdge(source, ruleNode, 'rule');
        targets.forEach((target) => addEdge(ruleNode, localNode(target), 'flow'));
      });
    }

    graph.roots = starts
      .map((st) => graph.byKey.get(makeGraphKey('loc', st)))
      .filter(Boolean)
      .map((n) => n.id);

    return graph;
  }

  function layoutGraph(graph) {
    const byId = new Map((graph.nodes || []).map((n) => [n.id, n]));
    const out = new Map();
    const inc = new Map();
    for (const n of (graph.nodes || [])) {
      out.set(n.id, []);
      inc.set(n.id, []);
    }
    for (const e of (graph.edges || [])) {
      out.get(e.from).push(e.to);
      inc.get(e.to).push(e.from);
    }

    const roots = (graph.roots || []).length
      ? graph.roots.slice()
      : (graph.nodes || []).filter((n) => (inc.get(n.id) || []).length === 0).map((n) => n.id);

    const depth = {};
    const q = roots.slice();
    roots.forEach((id) => { depth[id] = 0; });
    while (q.length) {
      const u = q.shift();
      const du = Number(depth[u] || 0);
      for (const v of (out.get(u) || [])) {
        const cand = du + 1;
        if (depth[v] == null || cand > depth[v]) {
          depth[v] = cand;
          q.push(v);
        }
      }
    }

    let maxDepth = 0;
    for (const n of (graph.nodes || [])) {
      if (depth[n.id] == null) depth[n.id] = 0;
      n.depth = depth[n.id];
      maxDepth = Math.max(maxDepth, n.depth);
    }

    const byDepth = {};
    for (const n of (graph.nodes || [])) (byDepth[n.depth] = byDepth[n.depth] || []).push(n.id);
    for (const d of Object.keys(byDepth)) byDepth[d].sort((a, b) => String(a).localeCompare(String(b)));

    let maxY = 0;
    for (let d = 0; d <= maxDepth; d++) {
      const ids = byDepth[d] || [];
      let cursorY = 60;
      for (const id of ids) {
        const node = byId.get(id);
        if (!node) continue;
        node.x = 80 + d * 310;
        node.y = cursorY;
        cursorY += 120;
        maxY = Math.max(maxY, node.y);
      }
    }

    return {
      width: Math.max(1200, 220 + (maxDepth + 1) * 320),
      height: Math.max(720, maxY + 220)
    };
  }

  function closeNodeRedModal() {
    const el = document.getElementById(MODAL_ID);
    if (!el) return;
    try { window.removeEventListener('resize', el._atpResizeHandler); } catch (_) { }
    try { el.remove(); } catch (_) { }
  }

  function fitEditor(modal) {
    try {
      const editor = modal && modal._atpDrawflow;
      if (!editor || !editor.precanvas) return;
      const wrap = modal._atpViewport;
      const bounds = modal._atpBounds;
      if (!wrap || !bounds) return;
      const zoom = Math.max(0.45, Math.min(1,
        (wrap.clientWidth - 120) / bounds.width,
        (wrap.clientHeight - 120) / bounds.height
      ));
      editor.zoom = zoom;
      editor.zoom_last_value = zoom;
      const tx = Math.round((wrap.clientWidth - bounds.width * zoom) / 2);
      const ty = Math.round((wrap.clientHeight - bounds.height * zoom) / 2);
      editor.canvas_x = tx;
      editor.canvas_y = ty;
      editor.precanvas.style.transform = `translate(${tx}px, ${ty}px) scale(${zoom})`;
      if (modal._atpZoomLabel) modal._atpZoomLabel.textContent = Math.round(zoom * 100) + '%';
    } catch (_) { }
  }

  function syncZoomLabel(modal) {
    try {
      const editor = modal && modal._atpDrawflow;
      if (!editor || !modal._atpZoomLabel) return;
      modal._atpZoomLabel.textContent = Math.round((Number(editor.zoom) || 1) * 100) + '%';
    } catch (_) { }
  }

  function nodeHtml(node) {
    return [
      '<div class="atp-df-node">',
      `<div class="atp-df-node-title">${dfEsc(node.title)}</div>`,
      `<div class="atp-df-node-sub">${dfEsc(node.subtitle || '')}</div>`,
      '</div>'
    ].join('');
  }

  function openFlowNodeRedModal(opts) {
    try {
      ensureDrawflowAssets();
      return ensureDrawflowLoaded().then(() => {
        closeNodeRedModal();
        try { if (typeof atpCloseRuleMapModal === 'function') atpCloseRuleMapModal(); } catch (_) { }

        const rules = Array.isArray(opts && opts.rules) ? opts.rules : getRulesStateFallback();
        if (!rules.length) {
          alert('Nao foi possivel obter as regras carregadas.');
          return Promise.resolve();
        }

        const data = resolveFluxosData(rules);
        const fluxos = Array.isArray(data && data.fluxos) ? data.fluxos : [];
        const flowIdx = Math.max(0, Number(opts && opts.flowIdx) || 0);
        const flow = fluxos[flowIdx];
        if (!flow) {
          alert('Fluxo selecionado nao encontrado.');
          return Promise.resolve();
        }

        const graph = buildDrawflowGraph(flow, data);
        const bounds = layoutGraph(graph);

        const overlay = document.createElement('div');
        overlay.id = MODAL_ID;
        overlay.className = 'atp-map-overlay';
        overlay.addEventListener('click', (ev) => { if (ev.target === overlay) closeNodeRedModal(); });

        const box = document.createElement('div');
        box.className = 'atp-map-box';

        const top = document.createElement('div');
        top.className = 'atp-map-top';
        const starts = (flow && flow.starts && flow.starts.length) ? flow.starts.join(' | ') : '(sem inicio)';
        top.innerHTML = `<div><div class="atp-map-title">Fluxo ${String(flowIdx + 1).padStart(2, '0')} (Drawflow)</div><div class="atp-map-sub">${dfEsc(starts)}<span class="atp-df-help">${graph.nodes.length} nos unicos</span></div></div>`;

        const actions = document.createElement('div');
        actions.className = 'atp-map-actions';

        const btnZoomOut = document.createElement('button');
        btnZoomOut.type = 'button';
        btnZoomOut.className = 'atp-map-btn';
        btnZoomOut.textContent = '-';

        const zoomLabel = document.createElement('span');
        zoomLabel.className = 'atp-map-zoom';
        zoomLabel.textContent = '100%';

        const btnZoomIn = document.createElement('button');
        btnZoomIn.type = 'button';
        btnZoomIn.className = 'atp-map-btn';
        btnZoomIn.textContent = '+';

        const btnFit = document.createElement('button');
        btnFit.type = 'button';
        btnFit.className = 'atp-map-btn';
        btnFit.textContent = 'Fit';

        const btnClose = document.createElement('button');
        btnClose.type = 'button';
        btnClose.className = 'atp-map-btn';
        btnClose.textContent = 'Fechar';
        btnClose.addEventListener('click', closeNodeRedModal);

        actions.appendChild(btnZoomOut);
        actions.appendChild(zoomLabel);
        actions.appendChild(btnZoomIn);
        actions.appendChild(btnFit);
        actions.appendChild(btnClose);
        top.appendChild(actions);

        const body = document.createElement('div');
        body.className = 'atp-map-body';

        const wrap = document.createElement('div');
        wrap.className = 'atp-df-wrap';

        const canvas = document.createElement('div');
        canvas.className = 'atp-df-canvas';
        const drawflowHost = document.createElement('div');
        drawflowHost.id = 'drawflow';
        canvas.appendChild(drawflowHost);
        wrap.appendChild(canvas);
        body.appendChild(wrap);

        box.appendChild(top);
        box.appendChild(body);
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        const editor = new window.Drawflow(drawflowHost);
        editor.reroute = false;
        editor.force_first_input = false;
        editor.editor_mode = 'fixed';
        editor.start();

        const byId = new Map();
        for (const node of graph.nodes) {
          const inputs = Math.max(1, node.inputs.length || (node.kind === 'start' ? 0 : 1));
          const outputs = Math.max(1, node.outputs.length || (node.kind === 'end' ? 0 : 1));
          const className = 'atp-df-kind-' + node.kind + ' node-' + node.kind;
          const drawflowId = editor.addNode(
            node.kind,
            inputs,
            outputs,
            node.x,
            node.y,
            className,
            { key: node.key, kind: node.kind, title: node.title },
            nodeHtml(node)
          );
          byId.set(node.id, { drawflowId });
        }

        const inputCounters = new Map();
        const outputCounters = new Map();
        for (const edge of graph.edges) {
          const src = byId.get(edge.from);
          const tgt = byId.get(edge.to);
          if (!src || !tgt) continue;
          const so = (outputCounters.get(edge.from) || 0) + 1;
          const ti = (inputCounters.get(edge.to) || 0) + 1;
          outputCounters.set(edge.from, so);
          inputCounters.set(edge.to, ti);
          try {
            editor.addConnection(src.drawflowId, tgt.drawflowId, `output_${so}`, `input_${ti}`);
          } catch (e) {
            try { editor.addConnection(src.drawflowId, tgt.drawflowId, 'output_1', 'input_1'); } catch (_) { }
          }
        }

        overlay._atpDrawflow = editor;
        overlay._atpViewport = wrap;
        overlay._atpBounds = bounds;
        overlay._atpZoomLabel = zoomLabel;

        btnZoomOut.addEventListener('click', () => {
          try { editor.zoom_out(); } catch (_) { }
          syncZoomLabel(overlay);
        });
        btnZoomIn.addEventListener('click', () => {
          try { editor.zoom_in(); } catch (_) { }
          syncZoomLabel(overlay);
        });
        btnFit.addEventListener('click', () => fitEditor(overlay));

        overlay._atpResizeHandler = () => fitEditor(overlay);
        window.addEventListener('resize', overlay._atpResizeHandler);
        setTimeout(() => {
          fitEditor(overlay);
          syncZoomLabel(overlay);
        }, 60);

        return Promise.resolve();
      }).catch((e) => {
        try { console.warn('[ATP][DF] Falha ao carregar Drawflow:', e); } catch (_) { }
        alert('Falha ao carregar Drawflow para abrir o fluxo.');
        return Promise.reject(e);
      });
    } catch (e) {
      try { console.warn('[ATP][DF] Falha ao abrir visualizador Drawflow:', e); } catch (_) { }
      alert('Falha ao abrir visualizador Drawflow.');
      return Promise.reject(e);
    }
  }

  window.atpOpenFlowReactModal = openFlowNodeRedModal;
  window.atpOpenFlowDrawflowModal = openFlowNodeRedModal;
  window.atpCloseFlowReactModal = closeNodeRedModal;
  window.atpCloseFlowDrawflowModal = closeNodeRedModal;

  try { console.log('[ATP][OK] 13-visualizador-fluxo-reactflow-elk.js inicializado com Drawflow'); } catch (e) { }
})();
