try { console.log('[ATP][LOAD] 13-visualizador-fluxo-reactflow-elk.js carregado com sucesso'); } catch (e) { }

(function () {
  'use strict';

  const MODAL_ID = 'atpNodeRedModal';
  const STYLE_ID = 'atp-node-red-style';
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function nrEsc(value) {
    if (typeof esc === 'function') return esc(value);
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function nrTrunc(value, max) {
    if (typeof atpTrunc === 'function') return atpTrunc(value, max);
    const s = String(value == null ? '' : value);
    const lim = Math.max(8, Number(max) || 80);
    return s.length <= lim ? s : (s.slice(0, lim - 1) + '…');
  }

  function ensureNodeRedStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = `
      .atp-nr-viewport{
        position:absolute;
        inset:0;
        overflow:auto;
        background:
          linear-gradient(0deg, rgba(148,163,184,.12) 1px, transparent 1px),
          linear-gradient(90deg, rgba(148,163,184,.12) 1px, transparent 1px),
          linear-gradient(0deg, rgba(148,163,184,.05) 1px, transparent 1px),
          linear-gradient(90deg, rgba(148,163,184,.05) 1px, transparent 1px),
          #eef2f7;
        background-size: 24px 24px, 24px 24px, 6px 6px, 6px 6px;
      }
      .atp-nr-host{position:relative;min-width:100%;min-height:100%;}
      .atp-nr-stage{position:relative;transform-origin:0 0;}
      .atp-nr-svg{position:absolute;inset:0;overflow:visible;pointer-events:none;}
      .atp-nr-nodes{position:absolute;inset:0;}
      .atp-nr-node{
        position:absolute;
        box-sizing:border-box;
        border-radius:10px;
        border:1px solid #94a3b8;
        background:#fff;
        box-shadow:0 10px 20px rgba(15,23,42,.08);
        color:#0f172a;
      }
      .atp-nr-node-inner{
        position:relative;
        height:100%;
        padding:8px 14px;
        display:flex;
        flex-direction:column;
        justify-content:center;
        gap:3px;
      }
      .atp-nr-node-title{
        font-size:12px;
        font-weight:700;
        line-height:1.25;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      }
      .atp-nr-node-sub{
        font-size:10px;
        color:#475569;
        line-height:1.2;
        max-height:24px;
        overflow:hidden;
      }
      .atp-nr-port{
        position:absolute;
        top:50%;
        width:10px;
        height:10px;
        margin-top:-5px;
        border-radius:999px;
        background:#475569;
        box-shadow:0 0 0 2px rgba(255,255,255,.95);
      }
      .atp-nr-port-in{left:-5px;}
      .atp-nr-port-out{right:-5px;}
      .atp-nr-kind-start{background:#e0f2fe;border-color:#38bdf8;}
      .atp-nr-kind-start .atp-nr-port{background:#0284c7;}
      .atp-nr-kind-loc{background:#ede9fe;border-color:#a78bfa;}
      .atp-nr-kind-loc .atp-nr-port{background:#7c3aed;}
      .atp-nr-kind-rule{background:#ffedd5;border-color:#fb923c;}
      .atp-nr-kind-rule .atp-nr-port{background:#ea580c;}
      .atp-nr-kind-refine{background:#e0e7ff;border-color:#818cf8;}
      .atp-nr-kind-refine .atp-nr-port{background:#4f46e5;}
      .atp-nr-kind-end{background:#dcfce7;border-color:#4ade80;}
      .atp-nr-kind-end .atp-nr-port{background:#16a34a;}
      .atp-nr-kind-cycle{background:#fee2e2;border-color:#f87171;}
      .atp-nr-kind-cycle .atp-nr-port{background:#dc2626;}
      .atp-nr-edge-path{
        fill:none;
        stroke:#334155;
        stroke-width:2.2;
        stroke-linecap:round;
        stroke-linejoin:round;
      }
      .atp-nr-edge-rule{stroke:#64748b;}
      .atp-nr-edge-output{stroke:#0f766e;}
      .atp-nr-edge-cycle{stroke:#dc2626;stroke-dasharray:7 5;}
      .atp-nr-empty{
        padding:24px;
        color:#475569;
        font-size:13px;
      }
      .atp-nr-mini{
        font-size:11px;
        color:#475569;
        margin-left:10px;
      }
    `;
    document.head.appendChild(st);
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
      try { console.warn('[ATP][NR] Falha ao obter fluxos via ATP.extract.getFluxosData:', e); } catch (_) { }
    }
    if (typeof atpComputeFluxosData === 'function') return atpComputeFluxosData(rules || []);
    return { fluxos: [], byFrom: new Map() };
  }

  function buildRuleTitle(item) {
    if (!item || !item.rule) return 'REFINAMENTO';
    const r = item.rule;
    const num = String((r && (r.num || r.numero || r.id || '?')) || '?');
    const pr = r && r.prioridade && (r.prioridade.num ?? r.prioridade.raw ?? r.prioridade.text);
    return pr != null && pr !== '' ? `REGRA ${num} · P${pr}` : `REGRA ${num}`;
  }

  function buildRuleSubtitle(item) {
    if (!item || !item.rule) return 'Desdobra condicao composta (AND / &&).';
    const r = item.rule;
    const tipo = clean((r && (r.tipoControleCriterio && (r.tipoControleCriterio.canonical || r.tipoControleCriterio.text))) || r.tipoControleCriterio || r.tipoControle || '');
    const outros = (typeof atpHumanizeOutrosCriteriosExpr === 'function') ? atpHumanizeOutrosCriteriosExpr(r && r.outrosCriterios) : '';
    const parts = [];
    if (tipo) parts.push(tipo);
    if (outros) parts.push(outros);
    return nrTrunc(parts.join(' • ') || 'Regra de encaminhamento.', 120);
  }

  function sortFlowItems(items) {
    return (items || []).slice().sort((a, b) => {
      const ra = a && a.rule ? Number(a.rule.num || a.rule.numero || 0) : Number.MAX_SAFE_INTEGER;
      const rb = b && b.rule ? Number(b.rule.num || b.rule.numero || 0) : Number.MAX_SAFE_INTEGER;
      return ra - rb || String(buildRuleTitle(a)).localeCompare(String(buildRuleTitle(b)));
    });
  }

  function nodeDims(kind, title) {
    const len = String(title || '').length;
    if (kind === 'rule' || kind === 'refine') return { w: Math.max(190, Math.min(240, 150 + len * 2)), h: 58 };
    if (kind === 'cycle') return { w: 190, h: 46 };
    if (kind === 'end') return { w: Math.max(170, Math.min(230, 130 + len * 2)), h: 40 };
    return { w: Math.max(180, Math.min(260, 140 + len * 2)), h: 40 };
  }

  function buildNodeRedModel(flow, data) {
    const nodeSet = new Set(Array.isArray(flow && flow.nodes) ? flow.nodes : []);
    const starts = Array.isArray(flow && flow.starts) && flow.starts.length ? flow.starts.slice() : Array.from(nodeSet).slice(0, 1);
    const byFrom = (data && data.byFrom instanceof Map) ? data.byFrom : new Map();
    const nodes = [];
    const edges = [];
    const children = new Map();
    const roots = [];
    let seq = 0;
    const MAX_NODES = 420;

    function pushChild(parentId, childId) {
      const arr = children.get(parentId) || [];
      arr.push(childId);
      children.set(parentId, arr);
    }

    function makeNode(kind, title, subtitle, meta) {
      if (nodes.length >= MAX_NODES) throw new Error('FLOW_TOO_LARGE');
      const dims = nodeDims(kind, title);
      const node = {
        id: 'atp_nr_' + (++seq),
        kind,
        title: String(title || ''),
        subtitle: String(subtitle || ''),
        w: dims.w,
        h: dims.h,
        meta: meta || {},
        x: 0,
        y: 0
      };
      nodes.push(node);
      return node;
    }

    function link(from, to, kind) {
      edges.push({ from, to, kind: kind || 'default' });
      pushChild(from, to);
    }

    function visibleTargets(item) {
      return Array.from(new Set((item && item.toKeys ? item.toKeys : []).filter((tk) => nodeSet.has(tk))));
    }

    function outgoingItems(localizador) {
      return sortFlowItems((byFrom.get(localizador) || []).filter((item) => visibleTargets(item).length));
    }

    function walkLocalizador(localizador, pathSet, role) {
      const outs = outgoingItems(localizador);
      const kind = role === 'start' ? 'start' : (!outs.length ? 'end' : 'loc');
      const sub = role === 'start' ? 'Inicio do fluxo' : (!outs.length ? 'Sem regras de saida' : 'Localizador');
      const locNode = makeNode(kind, nrTrunc(localizador, 54), sub, { full: String(localizador || '') });
      const nextPath = new Set(pathSet || []);
      nextPath.add(localizador);

      for (const item of outs) {
        const ruleNode = makeNode(item && item.rule ? 'rule' : 'refine', buildRuleTitle(item), buildRuleSubtitle(item), {
          full: buildRuleTitle(item) + ' — ' + buildRuleSubtitle(item)
        });
        link(locNode.id, ruleNode.id, 'rule');

        const targets = visibleTargets(item);
        if (!targets.length) continue;

        for (const target of targets) {
          if (nextPath.has(target)) {
            const cyc = makeNode('cycle', nrTrunc(target, 48), 'Ciclo detectado neste ramo', { full: String(target || '') });
            link(ruleNode.id, cyc.id, 'cycle');
            continue;
          }
          const child = walkLocalizador(target, nextPath, starts.includes(target) ? 'start' : 'default');
          link(ruleNode.id, child.id, 'output');
        }
      }

      return locNode.id;
    }

    const usedStarts = starts.length ? starts : Array.from(nodeSet).slice(0, 1);
    for (const st of usedStarts) roots.push(walkLocalizador(st, new Set(), 'start'));

    return { nodes, edges, children, roots };
  }

  function layoutNodeRedModel(model) {
    const PAD_X = 60;
    const PAD_Y = 60;
    const COL_W = 250;
    const ROW_GAP = 34;
    const ROOT_GAP = 72;
    const byId = new Map((model.nodes || []).map((n) => [n.id, n]));
    const memo = new Map();
    let maxDepth = 0;
    let maxRight = 0;
    let maxBottom = 0;

    function childIds(id) {
      return model.children.get(id) || [];
    }

    function subtreeHeight(id) {
      if (memo.has(id)) return memo.get(id);
      const node = byId.get(id);
      if (!node) return 0;
      const kids = childIds(id);
      let h = node.h;
      if (kids.length === 1) {
        h = Math.max(h, subtreeHeight(kids[0]));
      } else if (kids.length > 1) {
        let total = 0;
        for (let i = 0; i < kids.length; i++) {
          total += subtreeHeight(kids[i]);
          if (i < kids.length - 1) total += ROW_GAP;
        }
        h = Math.max(h, total);
      }
      memo.set(id, h);
      return h;
    }

    function place(id, depth, top) {
      const node = byId.get(id);
      if (!node) return;
      maxDepth = Math.max(maxDepth, depth);
      const selfH = subtreeHeight(id);
      node.x = PAD_X + depth * COL_W;
      node.y = Math.round(top + (selfH - node.h) / 2);
      maxRight = Math.max(maxRight, node.x + node.w);
      maxBottom = Math.max(maxBottom, node.y + node.h);

      const kids = childIds(id);
      if (!kids.length) return;

      let total = 0;
      for (let i = 0; i < kids.length; i++) {
        total += subtreeHeight(kids[i]);
        if (i < kids.length - 1) total += ROW_GAP;
      }
      let cursor = top + Math.max(0, (selfH - total) / 2);
      for (const kid of kids) {
        const kidH = subtreeHeight(kid);
        place(kid, depth + 1, cursor);
        cursor += kidH + ROW_GAP;
      }
    }

    let top = PAD_Y;
    for (const root of (model.roots || [])) {
      const h = subtreeHeight(root);
      place(root, 0, top);
      top += h + ROOT_GAP;
    }

    return {
      width: Math.max(900, maxRight + PAD_X),
      height: Math.max(520, maxBottom + PAD_Y),
      maxDepth
    };
  }

  function closeNodeRedModal() {
    const el = document.getElementById(MODAL_ID);
    if (!el) return;
    try { window.removeEventListener('resize', el._atpResizeHandler); } catch (_) { }
    try { el.remove(); } catch (_) { }
  }

  function applyZoom(modal, nextZoom) {
    if (!modal || !modal._atpNr) return;
    const data = modal._atpNr;
    const zoom = Math.max(0.3, Math.min(2.2, Number(nextZoom) || 1));
    modal._atpZoom = zoom;
    data.host.style.width = Math.ceil(data.stageW * zoom) + 'px';
    data.host.style.height = Math.ceil(data.stageH * zoom) + 'px';
    data.stage.style.transform = `scale(${zoom})`;
    if (data.zoomLabel) data.zoomLabel.textContent = Math.round(zoom * 100) + '%';
  }

  function fitNodeRedModal(modal) {
    if (!modal || !modal._atpNr) return;
    const data = modal._atpNr;
    const vp = data.viewport;
    const fitZoom = Math.max(0.35, Math.min(1.4,
      (Math.max(320, vp.clientWidth - 48) / data.stageW),
      (Math.max(220, vp.clientHeight - 48) / data.stageH)
    ));
    applyZoom(modal, fitZoom);
    vp.scrollLeft = Math.max(0, Math.round((data.stageW * fitZoom - vp.clientWidth) / 2));
    vp.scrollTop = Math.max(0, Math.round((data.stageH * fitZoom - vp.clientHeight) / 2));
  }

  function renderNodeElement(node) {
    const wrapper = document.createElement('div');
    wrapper.className = `atp-nr-node atp-nr-kind-${node.kind}`;
    wrapper.style.left = node.x + 'px';
    wrapper.style.top = node.y + 'px';
    wrapper.style.width = node.w + 'px';
    wrapper.style.height = node.h + 'px';
    wrapper.title = String((node.meta && node.meta.full) || node.title || '');
    wrapper.innerHTML = [
      '<div class="atp-nr-port atp-nr-port-in"></div>',
      '<div class="atp-nr-port atp-nr-port-out"></div>',
      '<div class="atp-nr-node-inner">',
      `<div class="atp-nr-node-title">${nrEsc(node.title)}</div>`,
      `<div class="atp-nr-node-sub">${nrEsc(node.subtitle || '')}</div>`,
      '</div>'
    ].join('');
    return wrapper;
  }

  function renderEdgeElement(edge, byId) {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (!from || !to) return null;
    const sx = from.x + from.w;
    const sy = from.y + (from.h / 2);
    const tx = to.x;
    const ty = to.y + (to.h / 2);
    const dx = Math.max(48, Math.round((tx - sx) * 0.55));
    const d = `M ${sx} ${sy} C ${sx + dx} ${sy}, ${tx - dx} ${ty}, ${tx} ${ty}`;
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    path.setAttribute('class', 'atp-nr-edge-path ' + (
      edge.kind === 'cycle' ? 'atp-nr-edge-cycle' :
      edge.kind === 'output' ? 'atp-nr-edge-output' :
      'atp-nr-edge-rule'
    ));
    return path;
  }

  function openFlowNodeRedModal(opts) {
    try {
      ensureNodeRedStyles();
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

      const model = buildNodeRedModel(flow, data);
      const laid = layoutNodeRedModel(model);
      const byId = new Map((model.nodes || []).map((n) => [n.id, n]));

      const overlay = document.createElement('div');
      overlay.id = MODAL_ID;
      overlay.className = 'atp-map-overlay';
      overlay.addEventListener('click', (ev) => { if (ev.target === overlay) closeNodeRedModal(); });

      const box = document.createElement('div');
      box.className = 'atp-map-box';

      const top = document.createElement('div');
      top.className = 'atp-map-top';
      const title = `🧭 Fluxo ${String(flowIdx + 1).padStart(2, '0')} (Red Node)`;
      const starts = (flow && flow.starts && flow.starts.length) ? flow.starts.join(' | ') : '(sem inicio)';
      top.innerHTML = `<div><div class="atp-map-title">${nrEsc(title)}</div><div class="atp-map-sub">${nrEsc(starts)}<span class="atp-nr-mini">${model.nodes.length} nos renderizados</span></div></div>`;

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

      const viewport = document.createElement('div');
      viewport.className = 'atp-nr-viewport';

      const host = document.createElement('div');
      host.className = 'atp-nr-host';

      const stage = document.createElement('div');
      stage.className = 'atp-nr-stage';
      stage.style.width = laid.width + 'px';
      stage.style.height = laid.height + 'px';

      const svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('class', 'atp-nr-svg');
      svg.setAttribute('width', String(laid.width));
      svg.setAttribute('height', String(laid.height));
      svg.setAttribute('viewBox', `0 0 ${laid.width} ${laid.height}`);
      for (const edge of (model.edges || [])) {
        const path = renderEdgeElement(edge, byId);
        if (path) svg.appendChild(path);
      }

      const nodesLayer = document.createElement('div');
      nodesLayer.className = 'atp-nr-nodes';
      for (const node of (model.nodes || [])) nodesLayer.appendChild(renderNodeElement(node));

      stage.appendChild(svg);
      stage.appendChild(nodesLayer);
      host.appendChild(stage);
      viewport.appendChild(host);
      body.appendChild(viewport);

      box.appendChild(top);
      box.appendChild(body);
      overlay.appendChild(box);
      document.body.appendChild(overlay);

      overlay._atpNr = {
        viewport,
        host,
        stage,
        stageW: laid.width,
        stageH: laid.height,
        zoomLabel
      };

      btnZoomOut.addEventListener('click', () => applyZoom(overlay, (overlay._atpZoom || 1) - 0.12));
      btnZoomIn.addEventListener('click', () => applyZoom(overlay, (overlay._atpZoom || 1) + 0.12));
      btnFit.addEventListener('click', () => fitNodeRedModal(overlay));

      overlay._atpResizeHandler = function () { fitNodeRedModal(overlay); };
      window.addEventListener('resize', overlay._atpResizeHandler);

      applyZoom(overlay, 1);
      setTimeout(() => fitNodeRedModal(overlay), 0);

      return Promise.resolve();
    } catch (e) {
      try { console.warn('[ATP][NR] Falha ao abrir visualizador Red Node:', e); } catch (_) { }
      alert('Falha ao abrir visualizador Red Node.');
      return Promise.reject(e);
    }
  }

  window.atpOpenFlowReactModal = openFlowNodeRedModal;
  window.atpCloseFlowReactModal = closeNodeRedModal;

  try { console.log('[ATP][OK] 13-visualizador-fluxo-reactflow-elk.js inicializado'); } catch (e) { }
})();
