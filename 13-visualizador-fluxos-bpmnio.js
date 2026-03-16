try { console.log('[ATP][LOAD] 13-visualizador-fluxos-bpmnio.js carregado com sucesso'); } catch (e) {}
(function () {
  'use strict';

  const LOG = '[ATP][BPMNIO]';
  const BTN_ID = 'btnVisualizarFluxosBpmnIoATP';
  const MODAL_ID = 'atpFluxoBpmnIoModal';
  const SEL_ID = 'atpSelFluxoBpmnIo';
  const SRC = 'https://unpkg.com/bpmn-js@18.1.1/dist/bpmn-modeler.development.js';
  const PROM_KEY = '__ATP_BPMNIO_MODELER_PROMISE__';
  const SCRIPT_ATTR = 'data-atp-bpmnio-modeler';
  const CSS = [
    'https://unpkg.com/bpmn-js@18.1.1/dist/assets/diagram-js.css',
    'https://unpkg.com/bpmn-js@18.1.1/dist/assets/bpmn-js.css',
    'https://unpkg.com/bpmn-js@18.1.1/dist/assets/bpmn-font/css/bpmn.css'
  ];
  const MAX_PATHS = 160;
  const MAX_DEPTH = 120;
  const FB_LOADING_ID = 'atp-bpmnio-fallback-loading';
  let PROM = null;
  let loadingDepth = 0;

  const t = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  const tKeepNl = (v) => String(v == null ? '' : v)
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
  const cutKeepNl = (v, max) => {
    const s = tKeepNl(v || '');
    const lim = Math.max(1, Number(max) || 1);
    return s.length > lim ? (s.slice(0, Math.max(1, lim - 3)).trim() + '...') : s;
  };
  const esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, Math.round(Number(v) || 0)));
  const hash = (v) => { const s = String(v == null ? '' : v); let h = 0; for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; } return Math.abs(h).toString(36); };
  const sortNums = (arr) => arr.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  const avg = (arr, fb) => arr.length ? (arr.reduce((x, y) => x + y, 0) / arr.length) : (Number(fb) || 0);
  const hasGlobalLoading = () => (
    typeof window.showATPLoading === 'function' &&
    typeof window.hideATPLoading === 'function'
  );
  const ensureFallbackLoading = () => {
    try {
      let el = document.getElementById(FB_LOADING_ID);
      if (el) return el;
      el = document.createElement('div');
      el.id = FB_LOADING_ID;
      el.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(243,244,246,.78);display:none;align-items:center;justify-content:center;font-family:Arial,Helvetica,sans-serif;';
      el.innerHTML = ''
        + '<div style="background:#fff;border:1px solid #d1d5db;border-radius:8px;padding:16px 20px;box-shadow:0 10px 25px rgba(0,0,0,.15);text-align:center;min-width:260px;">'
        + '<div style="width:32px;height:32px;margin:0 auto 10px;border:3px solid #e5e7eb;border-top-color:#2563eb;border-radius:50%;animation:atpBpmnIoSpin .8s linear infinite;"></div>'
        + '<div id="atpBpmnIoFallbackLoadingMsg" style="font-size:13px;color:#374151;">Carregando...</div>'
        + '</div>';
      if (!document.getElementById('atp-bpmnio-fallback-loading-style')) {
        const st = document.createElement('style');
        st.id = 'atp-bpmnio-fallback-loading-style';
        st.textContent = '@keyframes atpBpmnIoSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}';
        (document.head || document.documentElement).appendChild(st);
      }
      (document.documentElement || document.body).appendChild(el);
      return el;
    } catch (_) {
      return null;
    }
  };
  const setAnyLoadingMsg = (msg) => {
    try { if (typeof window.setATPLoadingMsg === 'function') window.setATPLoadingMsg(String(msg || 'Carregando...')); } catch (_) {}
    try {
      const m = document.getElementById('atpBpmnIoFallbackLoadingMsg');
      if (m) m.textContent = String(msg || 'Carregando...');
    } catch (_) {}
  };
  const showAnyLoading = (msg) => {
    loadingDepth = Math.max(0, Number(loadingDepth) || 0) + 1;
    if (hasGlobalLoading()) {
      try { window.showATPLoading(); } catch (_) {}
      setAnyLoadingMsg(msg);
      return;
    }
    const el = ensureFallbackLoading();
    setAnyLoadingMsg(msg);
    try { if (el) el.style.display = 'flex'; } catch (_) {}
  };
  const hideAnyLoading = () => {
    loadingDepth = Math.max(0, (Number(loadingDepth) || 0) - 1);
    if (loadingDepth > 0) return;
    if (hasGlobalLoading()) {
      try { window.hideATPLoading(); } catch (_) {}
    }
    try {
      const el = document.getElementById(FB_LOADING_ID);
      if (el) el.style.display = 'none';
    } catch (_) {}
  };

  function ensureCss() {
    for (const href of CSS) {
      try {
        if (!href) continue;
        if (document.querySelector(`link[data-atp-bpmnio-css="${href}"]`) || document.querySelector(`link[href="${href}"]`)) continue;
        const l = document.createElement('link');
        l.rel = 'stylesheet'; l.href = href; l.setAttribute('data-atp-bpmnio-css', href); document.head.appendChild(l);
      } catch (_) {}
    }
  }

  function ensureViewer() {
    if (window.BpmnJS && window.BpmnJS.prototype && (window.BpmnJS.prototype.__ATP_BPMNIO_MODELER__ || typeof window.BpmnJS.prototype.createDiagram === 'function')) return Promise.resolve(window.BpmnJS);
    try { const gp = window[PROM_KEY]; if (gp && typeof gp.then === 'function') return gp; } catch (_) {}
    if (PROM) return PROM;
    PROM = new Promise((resolve, reject) => {
      try {
        ensureCss();
        const done = () => {
          if (!window.BpmnJS) { reject(new Error('BpmnJS indisponivel')); return; }
          try { window.BpmnJS.prototype.__ATP_BPMNIO_MODELER__ = true; } catch (_) {}
          resolve(window.BpmnJS);
        };
        const ex = document.querySelector(`script[${SCRIPT_ATTR}="1"]`) || document.querySelector('script[src*="bpmn-modeler.development.js"]');
        if (ex) {
          if (window.BpmnJS) { done(); return; }
          ex.addEventListener('load', done, { once: true });
          ex.addEventListener('error', (e) => reject(e || new Error('Falha ao carregar bpmn.io')), { once: true });
          return;
        }
        const s = document.createElement('script');
        s.src = SRC; s.async = true; s.setAttribute(SCRIPT_ATTR, '1');
        s.onload = done; s.onerror = (e) => reject(e || new Error('Falha ao carregar bpmn.io'));
        document.head.appendChild(s);
      } catch (e) { reject(e); }
    }).catch((e) => { const f = PROM; PROM = null; try { if (window[PROM_KEY] === f) delete window[PROM_KEY]; } catch (_) {} throw e; });
    try { window[PROM_KEY] = PROM; } catch (_) {}
    return PROM;
  }

  function getRules() {
    let rules = [];
    try { if (typeof window.atpGetLastRules === 'function') { const r = window.atpGetLastRules(); if (Array.isArray(r)) rules = r; } } catch (_) {}
    if (!rules.length && Array.isArray(window.__ATP_LAST_RULES__)) rules = window.__ATP_LAST_RULES__;
    if (!rules.length) {
      try {
        const table = (typeof findTable === 'function') ? findTable() : document.getElementById(window.ATP_TABLE_ID || 'tableAutomatizacaoLocalizadores');
        if (table && typeof ensureColumns === 'function' && typeof mapColumns === 'function' && typeof parseRules === 'function') {
          try { ensureColumns(table); } catch (_) {}
          let cols = null; try { cols = mapColumns(table); } catch (_) { cols = null; }
          rules = parseRules(table, cols || {});
          if (typeof window.atpSetLastRules === 'function') window.atpSetLastRules(rules);
          else window.__ATP_LAST_RULES__ = Array.isArray(rules) ? rules : [];
        }
      } catch (e) { try { console.warn(LOG, 'Falha ao reconstruir rules:', e); } catch (_) {} }
    }
    return Array.isArray(rules) ? rules : [];
  }

  function toMap(v) {
    if (v instanceof Map) return v;
    const m = new Map(); if (!v || typeof v !== 'object') return m;
    for (const k of Object.keys(v)) m.set(k, Array.isArray(v[k]) ? v[k] : []);
    return m;
  }

  function getFluxosData(rules) {
    let data = null;
    try { if (window.ATP && window.ATP.extract && typeof window.ATP.extract.getFluxosData === 'function') data = window.ATP.extract.getFluxosData(rules || []); } catch (_) {}
    if (!data) { try { if (typeof atpComputeFluxosData === 'function') data = atpComputeFluxosData(rules || []); } catch (_) {} }
    if (!data || typeof data !== 'object') data = {};
    if (!Array.isArray(data.fluxos)) data.fluxos = [];
    data.byFrom = toMap(data.byFrom);
    return data;
  }

  function ruleNum(r) {
    const raw = t(r && r.num || '');
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return String(Math.trunc(n));
    // Mantem o valor bruto (incluindo expressoes com &&) sem refinamento intermediario.
    return raw;
  }
  function ruleCond(rule) {
    if (!rule || typeof rule !== 'object') return '';
    const parts = [];
    const tipo = t(rule.tipoControleCriterio && rule.tipoControleCriterio.canonical ? rule.tipoControleCriterio.canonical : (rule.tipoControleCriterio || rule.tipoControle || ''));
    if (tipo) parts.push(tipo);
    let outros = '';
    try { outros = (typeof atpHumanizeOutrosCriteriosExpr === 'function') ? t(atpHumanizeOutrosCriteriosExpr(rule.outrosCriterios)) : t(rule.outrosCriterios && rule.outrosCriterios.canonical || ''); } catch (_) {}
    if (outros) parts.push('Outros Criterios: ' + outros);
    return parts.join(' E ');
  }
  function ruleAction(rule) {
    const arr = (rule && rule.localizadorIncluirAcao && rule.localizadorIncluirAcao.acoes) || [];
    return Array.isArray(arr) ? arr.map((a) => t(a && a.acao || '')).filter(Boolean).join(' | ') : '';
  }
  function cutText(v, max) {
    const s = t(v || '');
    const lim = Math.max(1, Number(max) || 1);
    return s.length > lim ? (s.slice(0, lim).trim() + '...') : s;
  }
  function ruleTipoCriterio(rule) {
    if (!rule || typeof rule !== 'object') return '';
    const base = t(rule.tipoControleCriterio && rule.tipoControleCriterio.canonical
      ? rule.tipoControleCriterio.canonical
      : (rule.tipoControleCriterio || rule.tipoControle || ''));
    return t(base);
  }
  function ruleOutrosCriterios(rule) {
    if (!rule || typeof rule !== 'object') return '';
    let outros = '';
    try { outros = (typeof atpHumanizeOutrosCriteriosExpr === 'function') ? t(atpHumanizeOutrosCriteriosExpr(rule.outrosCriterios)) : t(rule.outrosCriterios && rule.outrosCriterios.canonical || ''); } catch (_) {}
    return t(outros);
  }

  function buildGraph(flow, byFrom) {
    const nodes = Array.isArray(flow && flow.nodes) ? flow.nodes.map(t).filter(Boolean) : [];
    const nodeSet = new Set(nodes), out = new Map(), inD = new Map();
    for (const n of nodeSet) { out.set(n, []); inD.set(n, 0); }
    for (const from of nodeSet) {
      const items = Array.isArray(byFrom.get(from)) ? byFrom.get(from) : [];
      for (const item of items) {
        const toKeys = Array.isArray(item && item.toKeys) ? item.toKeys : [];
        for (const toRaw of toKeys) {
          const to = t(toRaw); if (!to || !nodeSet.has(to)) continue;
          out.get(from).push({ from, to, rule: item && item.rule ? item.rule : null, implied: !!(item && item.__implied), impliedLabel: t(item && item.__label || '') });
          inD.set(to, (inD.get(to) || 0) + 1);
        }
      }
      out.get(from).sort((a, b) => {
        const an = Number(ruleNum(a && a.rule)), bn = Number(ruleNum(b && b.rule));
        const af = Number.isFinite(an), bf = Number.isFinite(bn);
        if (af && bf && an !== bn) return an - bn;
        if (af && !bf) return -1; if (!af && bf) return 1;
        return t(a && a.to || '').localeCompare(t(b && b.to || ''), 'pt-BR');
      });
    }
    return { nodeSet, out, inD };
  }

  function enumeratePaths(flow, graph) {
    const nodeSet = graph.nodeSet;
    const starts = (Array.isArray(flow && flow.starts) ? flow.starts : []).map(t).filter((n) => nodeSet.has(n));
    const fallback = Array.from(nodeSet).filter((n) => (graph.inD.get(n) || 0) === 0).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const seeds = starts.length ? starts : (fallback.length ? fallback : (nodeSet.size ? [Array.from(nodeSet)[0]] : []));
    const paths = [], sigs = new Set();
    const push = (tokens, meta) => {
      const sig = tokens.map((x) => x.type === 'locator' ? ('L:' + t(x.key)) : x.type === 'rule' ? ('R:' + t(x.ruleNum || '?') + ':' + t(x.from) + '>' + t(x.to)) : x.type === 'cycle' ? ('C:' + t(x.target)) : 'X').join('|');
      if (sigs.has(sig)) return;
      sigs.add(sig); paths.push({ tokens, meta: meta || {} });
    };
    const dfs = (node, tokens, visited, depth) => {
      if (paths.length >= MAX_PATHS) return;
      const outs = graph.out.get(node) || [];
      if (!outs.length) { push(tokens, { terminal: true }); return; }
      if (depth >= MAX_DEPTH) { push(tokens.concat([{ type: 'cutoff' }]), { cutoff: true }); return; }
      for (const e of outs) {
        const rt = {
          type: 'rule',
          ruleNum: ruleNum(e.rule),
          from: e.from,
          to: e.to,
          implied: !!e.implied,
          impliedLabel: t(e.impliedLabel || ''),
          condText: ruleCond(e.rule),
          actionText: ruleAction(e.rule),
          tipoCrit: ruleTipoCriterio(e.rule),
          outrosCrit: ruleOutrosCriterios(e.rule)
        };
        if (visited.has(e.to)) { push(tokens.concat([rt, { type: 'cycle', target: e.to }]), { cycle: true }); continue; }
        const nv = new Set(visited); nv.add(e.to);
        dfs(e.to, tokens.concat([rt, { type: 'locator', key: e.to }]), nv, depth + 1);
        if (paths.length >= MAX_PATHS) break;
      }
    };
    for (const seed of seeds) { dfs(seed, [{ type: 'locator', key: seed }], new Set([seed]), 0); if (paths.length >= MAX_PATHS) break; }
    if (!paths.length && seeds.length) for (const seed of seeds) push([{ type: 'locator', key: seed }], { terminal: true });
    return paths;
  }

  function tokenSig(tok) {
    if (!tok || typeof tok !== 'object') return 't:?';
    if (tok.type === 'locator') return 'locator:' + t(tok.key);
    if (tok.type === 'rule') return ['rule', t(tok.ruleNum || ''), t(tok.from || ''), t(tok.to || ''), tok.implied ? '1' : '0'].join(':');
    if (tok.type === 'cycle') return 'cycle:' + t(tok.target || '');
    if (tok.type === 'cutoff') return 'cutoff';
    return 't:' + t(tok.type || '?');
  }

  function tokenSpec(tok) {
    if (!tok || typeof tok !== 'object') return { type: 'task', name: 'Passo', doc: '', branch: '' };
    if (tok.type === 'locator') return { type: 'task', name: t(tok.key) || 'Localizador', doc: '', branch: t(tok.key || '') };
    if (tok.type === 'rule') {
      const n = t(tok.ruleNum || '');
      const baseName = 'Regra Nº ' + (n || '?');
      const acoes = t(tok.actionText || '');
      const tipoCrit = t(tok.tipoCrit || '');
      const outrosCrit = t(tok.outrosCrit || '');
      const name = [
        baseName,
        'Ações: ' + (acoes || '-'),
        'Criérios: ' + (tipoCrit || '-'),
        'Outros Critérios: ' + (outrosCrit || '-')
      ].join('\n');
      const doc = [tok.from ? ('REMOVER: ' + t(tok.from)) : '', tok.to ? ('INCLUIR: ' + t(tok.to)) : '', tok.condText ? ('SE: ' + t(tok.condText)) : '', tok.actionText ? ('ACAO: ' + t(tok.actionText)) : ''].filter(Boolean).join(' | ');
      return { type: 'serviceTask', name, doc, branch: n ? ('Regra ' + n) : 'Regra' };
    }
    if (tok.type === 'cycle') return { type: 'task', name: 'CICLO para: ' + t(tok.target || ''), doc: 'Fluxo interrompido para evitar repeticao infinita.', branch: 'ciclo' };
    if (tok.type === 'cutoff') return { type: 'task', name: 'TRUNCADO (limite de profundidade)', doc: 'Fluxo interrompido por seguranca de visualizacao.', branch: 'limite' };
    return { type: 'task', name: t(tok.type || 'Passo'), doc: '', branch: t(tok.type || '') };
  }

  function dims(type) {
    if (type === 'startEvent' || type === 'endEvent') return { w: 36, h: 36 };
    if (type === 'exclusiveGateway') return { w: 60, h: 60 };
    if (type === 'serviceTask') return { w: 280, h: 120 };
    return { w: 220, h: 120 };
  }

  function buildBpmnFromFlow(data, flowIdx) {
    const fluxos = Array.isArray(data && data.fluxos) ? data.fluxos : [];
    const flow = fluxos[flowIdx];
    if (!flow) throw new Error('Fluxo selecionado nao existe.');

    const graph = buildGraph(flow, toMap(data && data.byFrom));
    if (!graph || !graph.nodeSet || !graph.nodeSet.size) throw new Error('Fluxo sem nos visualizaveis.');

    const seedCandidates = (Array.isArray(flow.starts) ? flow.starts : []).map(t).filter((k) => graph.nodeSet.has(k));
    const fallbackSeeds = Array.from(graph.nodeSet)
      .filter((k) => (graph.inD.get(k) || 0) === 0)
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const seeds = seedCandidates.length
      ? seedCandidates
      : (fallbackSeeds.length ? fallbackSeeds : [Array.from(graph.nodeSet)[0]]);
    if (!seeds.length) throw new Error('Fluxo sem pontos de inicio.');

    let seqId = 0;
    const nextId = (p, laneNo) => `${p}_${String(flowIdx + 1).padStart(2, '0')}_${String((laneNo | 0) + 1).padStart(2, '0')}_${++seqId}`;

    const lanes = [];
    const createLane = (name) => {
      const idx = lanes.length;
      const ln = {
        idx,
        laneId: nextId('Lane', idx),
        laneName: t(name || `Pool Virtual ${String(idx + 1).padStart(2, '0')}`),
        refs: []
      };
      lanes.push(ln);
      return idx;
    };
    const pushRef = (laneIdx, id) => {
      const lane = lanes[laneIdx];
      if (!lane || !id) return;
      if (!lane.refs.includes(id)) lane.refs.push(id);
    };

    const elements = [];
    const flows = [];
    const edgeSet = new Set();
    const pushEdge = (a, b, nm) => {
      const aa = t(a || '');
      const bb = t(b || '');
      if (!aa || !bb) return;
      const nn = t(nm || '');
      const sig = `${aa}>>>${bb}>>>${nn}`;
      if (edgeSet.has(sig)) return;
      edgeSet.add(sig);
      flows.push({ id: nextId('Flow', 0), a: aa, b: bb, nm: nn });
    };

    const createEl = (type, lane, col, name, doc, extra) => {
      const laneIdx = clamp(lane, 0, Math.max(0, lanes.length - 1));
      const prefix = type === 'startEvent' ? 'startEvent'
        : type === 'endEvent' ? 'endEvent'
          : type === 'exclusiveGateway' ? 'exclusiveGateway'
            : type === 'serviceTask' ? 'rule'
              : 'locator';
      const fullName = cutKeepNl(name || '', 3000);
      const el = Object.assign({
        id: nextId(prefix, laneIdx),
        type,
        name: cutKeepNl(name || '', 200),
        tooltip: fullName,
        doc: t(doc || ''),
        lane: laneIdx,
        col: Math.max(0, Number(col) || 0)
      }, extra || {});
      elements.push(el);
      pushRef(laneIdx, el.id);
      return el;
    };

    const locatorByKey = new Map();
    const gatewayByKey = new Map();
    const endByKey = new Map();
    const ruleByKey = new Map();
    const locatorMaxCol = new Map();
    const buildingLocators = new Set();
    const expandedLocators = new Set();

    const ensureLocatorDecision = (locKey, laneIdx, startCol) => {
      const lk = t(locKey || '');
      let locEl = locatorByKey.get(lk) || null;
      let gwEl = gatewayByKey.get(lk) || null;
      let created = false;
      if (!locEl) {
        locEl = createEl('task', laneIdx, startCol, lk, '', { key: lk });
        locatorByKey.set(lk, locEl);
        created = true;
      }
      if (!gwEl) {
        gwEl = createEl('exclusiveGateway', laneIdx, startCol + 1, 'Decisao', '', { key: lk });
        gatewayByKey.set(lk, gwEl);
        created = true;
      }
      pushEdge(locEl.id, gwEl.id, '');
      return { locEl, gwEl, created };
    };

    const ensureEndFor = (locKey, laneIdx, col) => {
      const lk = t(locKey || '');
      let endEl = endByKey.get(lk) || null;
      if (!endEl) {
        endEl = createEl('endEvent', laneIdx, col, 'Fim', '', { key: lk });
        endByKey.set(lk, endEl);
      }
      return endEl;
    };
    const ruleKeyOf = (edgeLike) => {
      const n = t(ruleNum(edgeLike && edgeLike.rule));
      if (n) return `REGRA:${n}`;
      const from = t(edgeLike && edgeLike.from || '');
      const to = t(edgeLike && edgeLike.to || '');
      const lbl = t(edgeLike && edgeLike.impliedLabel || '');
      return `EDGE:${from}>>>${to}>>>${lbl}`;
    };

    const buildBranchFromLocator = (locKey, laneIdx, startCol, trail, depth) => {
      const lk = t(locKey || '');
      const safeTrail = trail instanceof Set ? trail : new Set();
      if (depth > MAX_DEPTH) {
        const cut = createEl('task', laneIdx, startCol, 'TRUNCADO (limite de profundidade)', 'Fluxo interrompido por seguranca de visualizacao.');
        const endCut = createEl('endEvent', laneIdx, startCol + 1, 'Fim', '');
        pushEdge(cut.id, endCut.id, '');
        return { entryId: cut.id, maxCol: startCol + 1 };
      }
      const pair = ensureLocatorDecision(lk, laneIdx, startCol);
      const locEl = pair.locEl;
      const gwEl = pair.gwEl;

      if (expandedLocators.has(lk)) {
        return { entryId: locEl.id, maxCol: Number(locatorMaxCol.get(lk) || (gwEl.col || (startCol + 1))) };
      }
      if (buildingLocators.has(lk)) {
        return { entryId: locEl.id, maxCol: Number(locatorMaxCol.get(lk) || (gwEl.col || (startCol + 1))) };
      }
      buildingLocators.add(lk);

      const outs = (graph.out.get(lk) || []).slice();
      if (!outs.length) {
        const endEl = ensureEndFor(lk, laneIdx, startCol + 2);
        pushEdge(gwEl.id, endEl.id, '');
        locatorMaxCol.set(lk, Math.max(startCol + 2, Number(endEl.col) || 0));
        buildingLocators.delete(lk);
        expandedLocators.add(lk);
        return { entryId: locEl.id, maxCol: startCol + 2 };
      }

      let maxCol = startCol + 2;
      const nextTrail = new Set(safeTrail);
      nextTrail.add(lk);
      let branchPos = 0;

      for (const e of outs) {
        branchPos++;
        const toKey = t(e && e.to || '');
        const num = t(ruleNum(e && e.rule));
        const acoes = t(ruleAction(e && e.rule));
        const tipoCrit = ruleTipoCriterio(e && e.rule);
        const outrosCrit = ruleOutrosCriterios(e && e.rule);
        const ruleBaseName = `Regra Nº ${num || '?'}`;
        const ruleName = [
          ruleBaseName,
          `Ações: ${acoes || '-'}`,
          `Criérios: ${tipoCrit || '-'}`,
          `Outros Critérios: ${outrosCrit || '-'}`
        ].join('\n');
        const ruleDoc = [
          e && e.from ? (`REMOVER: ${t(e.from)}`) : '',
          e && e.to ? (`INCLUIR: ${t(e.to)}`) : '',
          e && e.rule ? (`SE: ${t(ruleCond(e.rule))}`) : '',
          e && e.rule ? (`ACAO: ${t(ruleAction(e.rule))}`) : ''
        ].filter(Boolean).join(' | ');

        const branchLaneName = num ? `Pool Virtual Regra ${num}` : `Pool Virtual Ramo ${branchPos}`;
        const rKey = ruleKeyOf(e);
        let ruleEl = ruleByKey.get(rKey) || null;
        let branchLaneIdx = laneIdx;
        if (!ruleEl) {
          // Mantem a primeira regra alinhada horizontalmente com a decisao de origem.
          branchLaneIdx = (branchPos === 1) ? laneIdx : createLane(branchLaneName);
          ruleEl = createEl('serviceTask', branchLaneIdx, startCol + 2, ruleName, ruleDoc, { from: t(e && e.from), to: toKey, ruleNum: num, ruleKey: rKey });
          ruleByKey.set(rKey, ruleEl);
        } else {
          branchLaneIdx = clamp(ruleEl.lane, 0, Math.max(0, lanes.length - 1));
        }
        pushEdge(gwEl.id, ruleEl.id, '');

        if (!toKey || !graph.nodeSet.has(toKey)) {
          const endInvalid = createEl('endEvent', branchLaneIdx, startCol + 3, 'Fim', '');
          pushEdge(ruleEl.id, endInvalid.id, '');
          maxCol = Math.max(maxCol, startCol + 3);
          continue;
        }

        const child = buildBranchFromLocator(toKey, branchLaneIdx, startCol + 3, nextTrail, depth + 1);
        pushEdge(ruleEl.id, child.entryId, '');
        maxCol = Math.max(maxCol, Number(child.maxCol) || (startCol + 3));
      }

      locatorMaxCol.set(lk, maxCol);
      buildingLocators.delete(lk);
      expandedLocators.add(lk);
      return { entryId: locEl.id, maxCol };
    };

    const rootLane = createLane('Pool Virtual Base');
    const startEl = createEl('startEvent', rootLane, 0, 'Inicio', '');

    let maxCol = 0;
    if (seeds.length === 1) {
      const branch = buildBranchFromLocator(seeds[0], rootLane, 1, new Set(), 0);
      pushEdge(startEl.id, branch.entryId, '');
      maxCol = Math.max(maxCol, Number(branch.maxCol) || 1);
    } else {
      const rootGw = createEl('exclusiveGateway', rootLane, 1, 'Decisao', '', { key: '__ROOT__' });
      pushEdge(startEl.id, rootGw.id, '');
      maxCol = 1;
      for (const seed of seeds) {
        const seedLane = createLane(`Pool Virtual Inicio ${seed}`);
        const branch = buildBranchFromLocator(seed, seedLane, 2, new Set(), 0);
        pushEdge(rootGw.id, branch.entryId, '');
        maxCol = Math.max(maxCol, Number(branch.maxCol) || 2);
      }
    }

    const laneY0 = 70;
    const laneH = 120;
    const laneGap = 8;
    const stageX0 = 160;
    const colStep = 340;

    const xById = new Map();
    let maxRight = stageX0;
    for (const e of elements) {
      const cx = Math.round(stageX0 + (Math.max(0, Number(e.col) || 0) * colStep));
      xById.set(e.id, cx);
      const d = dims(e.type);
      maxRight = Math.max(maxRight, cx + (d.w / 2));
    }
    const cyLane = (idx) => Math.round((laneY0 + idx * (laneH + laneGap)) + laneH / 2);
    const bounds = new Map();
    for (const e of elements) {
      const d = dims(e.type);
      const cx = Math.round(Number(xById.get(e.id)) || stageX0);
      const cy = cyLane(clamp(e.lane, 0, Math.max(0, lanes.length - 1)));
      bounds.set(e.id, { x: Math.round(cx - d.w / 2), y: Math.round(cy - d.h / 2), w: d.w, h: d.h });
    }

    const obstaclePad = 10;
    const allObstacles = Array.from(bounds.entries()).map(([id, b]) => ({
      id,
      x: b.x - obstaclePad,
      y: b.y - obstaclePad,
      w: b.w + obstaclePad * 2,
      h: b.h + obstaclePad * 2
    }));
    const hasRectHit = (p1, p2, r) => {
      const x1 = Number(p1 && p1.x) || 0;
      const y1 = Number(p1 && p1.y) || 0;
      const x2 = Number(p2 && p2.x) || 0;
      const y2 = Number(p2 && p2.y) || 0;
      if (x1 === x2) {
        const x = x1, ya = Math.min(y1, y2), yb = Math.max(y1, y2);
        return x >= r.x && x <= (r.x + r.w) && yb >= r.y && ya <= (r.y + r.h);
      }
      if (y1 === y2) {
        const y = y1, xa = Math.min(x1, x2), xb = Math.max(x1, x2);
        return y >= r.y && y <= (r.y + r.h) && xb >= r.x && xa <= (r.x + r.w);
      }
      const xa = Math.min(x1, x2), xb = Math.max(x1, x2), ya = Math.min(y1, y2), yb = Math.max(y1, y2);
      return xb >= r.x && xa <= (r.x + r.w) && yb >= r.y && ya <= (r.y + r.h);
    };
    const isSegmentBlocked = (p1, p2, obstacles) => {
      for (const r of obstacles) if (hasRectHit(p1, p2, r)) return true;
      return false;
    };
    const normalizePts = (pts) => {
      const out = [];
      for (const p of pts || []) {
        const np = { x: Math.round(Number(p && p.x) || 0), y: Math.round(Number(p && p.y) || 0) };
        const last = out.length ? out[out.length - 1] : null;
        if (!last || last.x !== np.x || last.y !== np.y) out.push(np);
      }
      return out;
    };
    const orthogonalizePts = (pts) => {
      const src = normalizePts(pts);
      if (src.length <= 1) return src;
      const out = [src[0]];
      for (let i = 1; i < src.length; i++) {
        const prev = out[out.length - 1];
        const cur = src[i];
        if (prev.x !== cur.x && prev.y !== cur.y) out.push({ x: cur.x, y: prev.y });
        out.push(cur);
      }
      return normalizePts(out);
    };
    const isPolylineClear = (pts, obstacles) => {
      for (let i = 1; i < pts.length; i++) {
        if (isSegmentBlocked(pts[i - 1], pts[i], obstacles)) return false;
      }
      return true;
    };
    const usedSegments = [];
    const samePt = (a, b) => (Number(a && a.x) === Number(b && b.x)) && (Number(a && a.y) === Number(b && b.y));
    const inRange = (v, a, b) => {
      const lo = Math.min(a, b), hi = Math.max(a, b);
      return v >= lo && v <= hi;
    };
    const segmentConflict = (a1, a2, b1, b2) => {
      const aV = Number(a1.x) === Number(a2.x);
      const bV = Number(b1.x) === Number(b2.x);
      const aH = Number(a1.y) === Number(a2.y);
      const bH = Number(b1.y) === Number(b2.y);
      if ((!aV && !aH) || (!bV && !bH)) return true;
      if (aV && bV) {
        if (Number(a1.x) !== Number(b1.x)) return false;
        const aLo = Math.min(Number(a1.y), Number(a2.y)), aHi = Math.max(Number(a1.y), Number(a2.y));
        const bLo = Math.min(Number(b1.y), Number(b2.y)), bHi = Math.max(Number(b1.y), Number(b2.y));
        const lo = Math.max(aLo, bLo), hi = Math.min(aHi, bHi);
        if (hi < lo) return false;
        if (hi === lo) {
          const p = { x: Number(a1.x), y: lo };
          const endpointTouch = (samePt(p, a1) || samePt(p, a2)) && (samePt(p, b1) || samePt(p, b2));
          return !endpointTouch;
        }
        return true;
      }
      if (aH && bH) {
        if (Number(a1.y) !== Number(b1.y)) return false;
        const aLo = Math.min(Number(a1.x), Number(a2.x)), aHi = Math.max(Number(a1.x), Number(a2.x));
        const bLo = Math.min(Number(b1.x), Number(b2.x)), bHi = Math.max(Number(b1.x), Number(b2.x));
        const lo = Math.max(aLo, bLo), hi = Math.min(aHi, bHi);
        if (hi < lo) return false;
        if (hi === lo) {
          const p = { x: lo, y: Number(a1.y) };
          const endpointTouch = (samePt(p, a1) || samePt(p, a2)) && (samePt(p, b1) || samePt(p, b2));
          return !endpointTouch;
        }
        return true;
      }
      const v1 = aV ? a1 : b1;
      const v2 = aV ? a2 : b2;
      const h1 = aV ? b1 : a1;
      const h2 = aV ? b2 : a2;
      const ip = { x: Number(v1.x), y: Number(h1.y) };
      if (!inRange(ip.x, Number(h1.x), Number(h2.x)) || !inRange(ip.y, Number(v1.y), Number(v2.y))) return false;
      const endpointTouch = (samePt(ip, a1) || samePt(ip, a2)) && (samePt(ip, b1) || samePt(ip, b2));
      return !endpointTouch;
    };
    const isPolylineFreeFromLines = (pts) => {
      for (let i = 1; i < pts.length; i++) {
        const a1 = pts[i - 1], a2 = pts[i];
        for (const s of usedSegments) {
          if (segmentConflict(a1, a2, s.a, s.b)) return false;
        }
      }
      return true;
    };
    const reservePolyline = (pts) => {
      for (let i = 1; i < pts.length; i++) usedSegments.push({ a: pts[i - 1], b: pts[i] });
    };
    const outCountBySourceId = new Map();
    const inCountByTargetId = new Map();
    const outOrderByFlowId = new Map();
    const inOrderByFlowId = new Map();
    const sourceTrunkX = new Map();
    const targetTrunkX = new Map();
    for (const fl of flows) {
      outCountBySourceId.set(fl.a, Number(outCountBySourceId.get(fl.a) || 0) + 1);
      inCountByTargetId.set(fl.b, Number(inCountByTargetId.get(fl.b) || 0) + 1);
    }
    const outGroupBySource = new Map();
    const inGroupByTarget = new Map();
    for (const fl of flows) {
      if (!outGroupBySource.has(fl.a)) outGroupBySource.set(fl.a, []);
      outGroupBySource.get(fl.a).push(fl);
      if (!inGroupByTarget.has(fl.b)) inGroupByTarget.set(fl.b, []);
      inGroupByTarget.get(fl.b).push(fl);
    }
    for (const [srcId, arr] of outGroupBySource.entries()) {
      const sb = bounds.get(srcId);
      const sy = sb ? (sb.y + sb.h / 2) : 0;
      arr.sort((f1, f2) => {
        const b1 = bounds.get(f1.b), b2 = bounds.get(f2.b);
        const y1 = b1 ? (b1.y + b1.h / 2) : 0;
        const y2 = b2 ? (b2.y + b2.h / 2) : 0;
        const d1 = Math.abs(y1 - sy), d2 = Math.abs(y2 - sy);
        if (d1 !== d2) return d1 - d2;
        if (y1 !== y2) return y1 - y2;
        return String(f1.b).localeCompare(String(f2.b), 'pt-BR');
      });
      for (let i = 0; i < arr.length; i++) outOrderByFlowId.set(arr[i].id, i + 1);
    }
    for (const [tgtId, arr] of inGroupByTarget.entries()) {
      const tb = bounds.get(tgtId);
      const ty = tb ? (tb.y + tb.h / 2) : 0;
      arr.sort((f1, f2) => {
        const b1 = bounds.get(f1.a), b2 = bounds.get(f2.a);
        const y1 = b1 ? (b1.y + b1.h / 2) : 0;
        const y2 = b2 ? (b2.y + b2.h / 2) : 0;
        const d1 = Math.abs(y1 - ty), d2 = Math.abs(y2 - ty);
        if (d1 !== d2) return d1 - d2;
        if (y1 !== y2) return y1 - y2;
        return String(f1.a).localeCompare(String(f2.a), 'pt-BR');
      });
      for (let i = 0; i < arr.length; i++) inOrderByFlowId.set(arr[i].id, i + 1);
    }

    const way = new Map();
    for (const f of flows) {
      const sb = bounds.get(f.a), tb = bounds.get(f.b); if (!sb || !tb) continue;
      const obstacles = allObstacles.filter((o) => o.id !== f.a && o.id !== f.b);
      const tryRoute = (pts) => {
        const p = orthogonalizePts(pts);
        return (isPolylineClear(p, obstacles) && isPolylineFreeFromLines(p)) ? p : null;
      };
      const scx = sb.x + (sb.w / 2), scy = sb.y + (sb.h / 2);
      const tcx = tb.x + (tb.w / 2), tcy = tb.y + (tb.h / 2);
      const dxCT = tcx - scx, dyCT = tcy - scy;
      const outCount = Number(outCountBySourceId.get(f.a) || 0);
      const inCount = Number(inCountByTargetId.get(f.b) || 0);
      const outOrder = Number(outOrderByFlowId.get(f.id) || 1);
      const inOrder = Number(inOrderByFlowId.get(f.id) || 1);
      const isOneToMany = outCount > 1;
      const isManyToOne = inCount > 1;

      // Em relacoes 1:N (split) e N:1 (merge), forca geometria ortogonal no padrao do print.
      if (isOneToMany) {
        const sx = Math.round(sb.x + sb.w);
        const sy = Math.round(sb.y + sb.h / 2);
        const tx = Math.round(tb.x);
        const ty = Math.round(tb.y + tb.h / 2);
        const isLeftReturn = tx < sx;
        if (isLeftReturn) {
          // Para retorno a esquerda, usa roteamento geral com checagem de colisao.
        } else {
        const trunkX = sourceTrunkX.has(f.a) ? sourceTrunkX.get(f.a) : (sx + 24);
        if (!sourceTrunkX.has(f.a)) sourceTrunkX.set(f.a, trunkX);
        if (outOrder === 1) {
          const straight = orthogonalizePts([{ x: sx, y: sy }, { x: tx, y: ty }]);
          way.set(f.id, straight);
          reservePolyline(straight);
          continue;
        }
        const forcedSplit = orthogonalizePts([
          { x: sx, y: sy },
          { x: trunkX, y: sy },
          { x: trunkX, y: ty },
          { x: tx, y: ty }
        ]);
        way.set(f.id, forcedSplit);
        reservePolyline(forcedSplit);
        continue;
        }
      }
      if (isManyToOne) {
        const sx = Math.round(sb.x + sb.w);
        const sy = Math.round(sb.y + sb.h / 2);
        const tx = Math.round(tb.x);
        const ty = Math.round(tb.y + tb.h / 2);
        const isLeftReturn = tx < sx;
        if (isLeftReturn) {
          // Para retorno a esquerda, usa roteamento geral com checagem de colisao.
        } else {
        const trunkX = targetTrunkX.has(f.b) ? targetTrunkX.get(f.b) : Math.max(sx + 24, tx - 86);
        if (!targetTrunkX.has(f.b)) targetTrunkX.set(f.b, trunkX);
        if (inOrder === 1) {
          const straight = orthogonalizePts([{ x: sx, y: sy }, { x: tx, y: ty }]);
          way.set(f.id, straight);
          reservePolyline(straight);
          continue;
        }
        const forcedMerge = orthogonalizePts([
          { x: sx, y: sy },
          { x: trunkX, y: sy },
          { x: trunkX, y: ty },
          { x: tx, y: ty }
        ]);
        way.set(f.id, forcedMerge);
        reservePolyline(forcedMerge);
        continue;
        }
      }
      const portPenalty = (side, isSource) => {
        // Menor penalidade para o lado naturalmente "apontado" para o alvo.
        if (side === 'right') return isSource ? (dxCT >= 0 ? 0 : 55) : (dxCT >= 0 ? 55 : 0);
        if (side === 'left') return isSource ? (dxCT <= 0 ? 0 : 55) : (dxCT <= 0 ? 55 : 0);
        if (side === 'bottom') return isSource ? (dyCT >= 0 ? 8 : 48) : (dyCT >= 0 ? 48 : 8);
        return isSource ? (dyCT <= 0 ? 8 : 48) : (dyCT <= 0 ? 48 : 8); // top
      };
      const sourcePorts = [
        { x: sb.x + sb.w, y: sb.y + sb.h / 2, side: 'right' },
        { x: sb.x, y: sb.y + sb.h / 2, side: 'left' },
        { x: sb.x + sb.w / 2, y: sb.y, side: 'top' },
        { x: sb.x + sb.w / 2, y: sb.y + sb.h, side: 'bottom' }
      ].map((p) => ({ ...p, pen: portPenalty(p.side, true) }));
      const targetPorts = [
        { x: tb.x, y: tb.y + tb.h / 2, side: 'left' },
        { x: tb.x + tb.w, y: tb.y + tb.h / 2, side: 'right' },
        { x: tb.x + tb.w / 2, y: tb.y, side: 'top' },
        { x: tb.x + tb.w / 2, y: tb.y + tb.h, side: 'bottom' }
      ].map((p) => ({ ...p, pen: portPenalty(p.side, false) }));

      let best = null;
      let bestScore = Number.POSITIVE_INFINITY;
      const evalRoute = (pts, scoreBase) => {
        const rt = tryRoute(pts);
        if (!rt) return;
        let len = 0;
        for (let i = 1; i < rt.length; i++) len += Math.abs(rt[i].x - rt[i - 1].x) + Math.abs(rt[i].y - rt[i - 1].y);
        const bends = Math.max(0, rt.length - 2);
        const score = scoreBase + len + bends * 20;
        if (score < bestScore) { bestScore = score; best = rt; }
      };

      for (const sp of sourcePorts) {
        for (const tp of targetPorts) {
          const S = { x: Math.round(sp.x), y: Math.round(sp.y) };
          const T = { x: Math.round(tp.x), y: Math.round(tp.y) };
          const base = (Number(sp.pen) || 0) + (Number(tp.pen) || 0);
	          if (S.x === T.x || S.y === T.y) {
	            evalRoute([S, T], base);
	          } else {
	            evalRoute([S, { x: T.x, y: S.y }, T], base);
	            evalRoute([S, { x: S.x, y: T.y }, T], base);
            const detours = [40, -40, 80, -80, 140, -140, 220, -220];
            for (const dx of detours) {
              evalRoute([S, { x: S.x + dx, y: S.y }, { x: S.x + dx, y: T.y }, T], base + Math.abs(dx));
            }
            for (const dy of detours) {
              evalRoute([S, { x: S.x, y: S.y + dy }, { x: T.x, y: S.y + dy }, T], base + Math.abs(dy));
            }
            for (const dx of detours) {
              evalRoute([S, { x: T.x + dx, y: S.y }, { x: T.x + dx, y: T.y }, T], base + Math.abs(dx) + 8);
            }
	            for (const dy of detours) {
	              evalRoute([S, { x: S.x, y: T.y + dy }, { x: T.x, y: T.y + dy }, T], base + Math.abs(dy) + 8);
	            }
	            // Para conexoes que retornam para a esquerda, tenta um "corredor" externo
	            // para reduzir sobreposicoes com shapes/linhas do miolo.
	            if (dxCT < 0 && S.x > T.x) {
	              const leftDetours = [40, 80, 120, 180, 260, 340];
	              const minX = Math.min(S.x, T.x);
                const minObsY = allObstacles.reduce((m, o) => Math.min(m, Number(o.y) || 0), Number.POSITIVE_INFINITY);
                const maxObsY = allObstacles.reduce((m, o) => Math.max(m, (Number(o.y) || 0) + (Number(o.h) || 0)), Number.NEGATIVE_INFINITY);
                const safeTopY = Math.round(minObsY - 70);
                const safeBottomY = Math.round(maxObsY + 70);
	              for (const off of leftDetours) {
	                const corridorX = minX - off;
	                evalRoute(
	                  [S, { x: corridorX, y: S.y }, { x: corridorX, y: T.y }, T],
	                  base + 16 + off
	                );
                  // Corredores externos (acima/abaixo) para fugir do miolo carregado.
                  evalRoute(
                    [S, { x: corridorX, y: S.y }, { x: corridorX, y: safeTopY }, { x: T.x - 24, y: safeTopY }, { x: T.x - 24, y: T.y }, T],
                    base + 28 + off
                  );
                  evalRoute(
                    [S, { x: corridorX, y: S.y }, { x: corridorX, y: safeBottomY }, { x: T.x - 24, y: safeBottomY }, { x: T.x - 24, y: T.y }, T],
                    base + 28 + off
                  );
	              }
	            }
	          }
	        }
	      }

	      if (!best) {
	        const sx = Math.round(sb.x + sb.w), sy = Math.round(sb.y + sb.h / 2);
	        const tx = Math.round(tb.x), ty = Math.round(tb.y + tb.h / 2);
	        const isLeftReturn = (tx < sx);
	        const corridorLeft = Math.min(sx, tx) - 120;
	        const fallbackCandidates = isLeftReturn
	          ? [
	              [{ x: sx, y: sy }, { x: corridorLeft, y: sy }, { x: corridorLeft, y: ty }, { x: tx, y: ty }],
	              [{ x: sx, y: sy }, { x: corridorLeft - 80, y: sy }, { x: corridorLeft - 80, y: ty }, { x: tx, y: ty }],
	              [{ x: sx, y: sy }, { x: sx, y: ty }, { x: tx, y: ty }]
	            ]
	          : (Math.abs(sy - ty) <= 2)
	            ? [
	                [{ x: sx, y: sy }, { x: tx, y: sy }, { x: tx, y: ty }],
	                [{ x: sx, y: sy }, { x: sx, y: sy + 60 }, { x: tx, y: sy + 60 }, { x: tx, y: ty }],
	                [{ x: sx, y: sy }, { x: sx, y: sy - 60 }, { x: tx, y: sy - 60 }, { x: tx, y: ty }]
	              ]
	            : [
	                [{ x: sx, y: sy }, { x: tx, y: sy }, { x: tx, y: ty }],
	                [{ x: sx, y: sy }, { x: sx, y: ty }, { x: tx, y: ty }]
	              ];
	        for (const cand of fallbackCandidates) {
	          const rt = tryRoute(cand);
	          if (rt) { best = rt; break; }
	        }
        if (!best) best = orthogonalizePts(fallbackCandidates[0]);
      }
      const finalRoute = orthogonalizePts(best);
      way.set(f.id, finalRoute);
      reservePolyline(finalRoute);
    }

    const processId = `Process_ATP_Fluxo_${String(flowIdx + 1).padStart(2, '0')}_${hash(JSON.stringify(flow || {}))}`;
    const x = [];
    x.push('<?xml version="1.0" encoding="UTF-8"?>');
    x.push('<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"');
    x.push('  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"');
    x.push('  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"');
    x.push('  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"');
    x.push('  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"');
    x.push(`  id="Defs_${hash(processId)}"`);
    x.push(`  targetNamespace="http://atp.eproc/fluxos/${hash(processId)}">`);
    x.push(`  <bpmn:process id="${processId}" isExecutable="false">`);

    for (const e of elements) {
      if (e.type === 'startEvent') x.push(`    <bpmn:startEvent id="${e.id}" name="${esc(e.name)}" />`);
      else if (e.type === 'endEvent') x.push(`    <bpmn:endEvent id="${e.id}" name="${esc(e.name)}" />`);
      else if (e.type === 'serviceTask') {
        x.push(`    <bpmn:serviceTask id="${e.id}" name="${esc(e.name)}">`);
        if (e.doc) x.push(`      <bpmn:documentation>${esc(e.doc)}</bpmn:documentation>`);
        x.push('    </bpmn:serviceTask>');
      } else if (e.type === 'exclusiveGateway') {
        x.push(`    <bpmn:exclusiveGateway id="${e.id}" name="${esc(e.name || 'Decisao')}" />`);
      } else {
        x.push(`    <bpmn:task id="${e.id}" name="${esc(e.name)}" />`);
      }
    }

    for (const f of flows) x.push(`    <bpmn:sequenceFlow id="${f.id}" sourceRef="${f.a}" targetRef="${f.b}" />`);

    x.push('  </bpmn:process>');
    x.push(`  <bpmndi:BPMNDiagram id="BPMNDiagram_${processId}">`);
    x.push(`    <bpmndi:BPMNPlane id="BPMNPlane_${processId}" bpmnElement="${processId}">`);

    for (const e of elements) {
      const b = bounds.get(e.id); if (!b) continue;
      x.push(`      <bpmndi:BPMNShape id="DI_${e.id}" bpmnElement="${e.id}">`);
      x.push(`        <dc:Bounds x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" />`);
      x.push('      </bpmndi:BPMNShape>');
    }

    for (const f of flows) {
      const wps = way.get(f.id) || [];
      x.push(`      <bpmndi:BPMNEdge id="DI_${f.id}" bpmnElement="${f.id}">`);
      for (const p of wps) x.push(`        <di:waypoint x="${Math.round(Number(p.x) || 0)}" y="${Math.round(Number(p.y) || 0)}" />`);
      x.push('      </bpmndi:BPMNEdge>');
    }

    x.push('    </bpmndi:BPMNPlane>');
    x.push('  </bpmndi:BPMNDiagram>');
    x.push('</bpmn:definitions>');

    const tooltipById = {};
    for (const e of elements) tooltipById[e.id] = cutKeepNl(e && e.tooltip ? e.tooltip : e.name, 3000);

    const starts = Array.isArray(flow.starts) ? flow.starts.map(t).filter(Boolean) : [];
    const safe = t(starts[0] || 'inicio').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'inicio';
    return {
      xml: x.join('\n'),
      filename: `fluxo_${String(flowIdx + 1).padStart(2, '0')}_${safe}_arvore_pool_virtual.bpmn`,
      pathsCount: flows.length,
      tooltipById
    };
  }

  function closeModal() {
    const el = document.getElementById(MODAL_ID);
    if (!el) return;
    try { if (typeof el._atpClearChainSelection === 'function') el._atpClearChainSelection(); } catch (_) {}
    try { const viewer = el._atpBpmnIoViewer; if (viewer && typeof viewer.destroy === 'function') viewer.destroy(); } catch (_) {}
    try { el.remove(); } catch (_) {}
  }

  function flowLabel(flow, idx) {
    try { if (window.ATP && window.ATP.extract && typeof window.ATP.extract.buildFluxoOptionLabel === 'function') return window.ATP.extract.buildFluxoOptionLabel(flow, idx); } catch (_) {}
    const starts = (flow && Array.isArray(flow.starts) && flow.starts.length) ? flow.starts.join(' | ') : '(sem inicio)';
    const nodesN = (flow && Array.isArray(flow.nodes)) ? flow.nodes.length : 0;
    return `Fluxo ${String((idx | 0) + 1).padStart(2, '0')} - Inicio(s): [${starts}] - Nos: ${nodesN}`;
  }

  function openModal() {
    const startLoading = (msg) => showAnyLoading(msg || 'Carregando visualizador...');
    const stopLoading = () => hideAnyLoading();

    const rules = getRules();
    if (!rules.length) { stopLoading(); alert('Nao foi possivel obter as regras da tabela para montar o fluxo.'); return; }
    const data = getFluxosData(rules);
    const fluxos = Array.isArray(data.fluxos) ? data.fluxos : [];
    if (!fluxos.length) { stopLoading(); alert('Nenhum fluxo detectado para visualizar.'); return; }

    closeModal();
    const overlay = document.createElement('div');
    overlay.id = MODAL_ID; overlay.className = 'atp-map-overlay';
    overlay.addEventListener('click', (ev) => { if (ev.target === overlay) closeModal(); });
    const box = document.createElement('div'); box.className = 'atp-map-box';
    const top = document.createElement('div'); top.className = 'atp-map-top';
    const titleWrap = document.createElement('div');
    const title = document.createElement('div'); title.className = 'atp-map-title'; title.textContent = 'Visualizador de Fluxos (BPMN.io - Arvore de Decisao)';
    const sub = document.createElement('div'); sub.className = 'atp-map-sub'; sub.textContent = 'Cada localizador gera uma decisao, cada decisao abre N regras e cada regra segue em sua pool virtual com o ramo completo.';
    titleWrap.appendChild(title); titleWrap.appendChild(sub);
    const actions = document.createElement('div'); actions.className = 'atp-map-actions';

    const sel = document.createElement('select');
    sel.id = SEL_ID; sel.className = 'infraSelect'; sel.style.minWidth = '460px';
    fluxos.forEach((fl, i) => { const o = document.createElement('option'); o.value = String(i); o.textContent = flowLabel(fl, i); sel.appendChild(o); });
    const btnRender = document.createElement('button'); btnRender.type = 'button'; btnRender.className = 'atp-map-btn'; btnRender.textContent = 'Renderizar';
    const btnZoomOut = document.createElement('button'); btnZoomOut.type = 'button'; btnZoomOut.className = 'atp-map-btn'; btnZoomOut.textContent = '-';
    const zoomLab = document.createElement('span'); zoomLab.className = 'atp-map-zoom'; zoomLab.textContent = '100%';
    const btnZoomIn = document.createElement('button'); btnZoomIn.type = 'button'; btnZoomIn.className = 'atp-map-btn'; btnZoomIn.textContent = '+';
    const btnFit = document.createElement('button'); btnFit.type = 'button'; btnFit.className = 'atp-map-btn'; btnFit.textContent = 'Fit';
    const btnDown = document.createElement('button'); btnDown.type = 'button'; btnDown.className = 'atp-map-btn'; btnDown.textContent = 'Baixar BPMN';
    const btnClose = document.createElement('button'); btnClose.type = 'button'; btnClose.className = 'atp-map-btn'; btnClose.textContent = 'Fechar';
    btnClose.addEventListener('click', closeModal);
    actions.appendChild(sel); actions.appendChild(btnRender); actions.appendChild(btnZoomOut); actions.appendChild(zoomLab); actions.appendChild(btnZoomIn); actions.appendChild(btnFit); actions.appendChild(btnDown); actions.appendChild(btnClose);
    top.appendChild(titleWrap); top.appendChild(actions);

    const body = document.createElement('div'); body.className = 'atp-map-body';
    const canvas = document.createElement('div'); canvas.className = 'atp-map-canvas'; body.appendChild(canvas);
    box.appendChild(top); box.appendChild(body); overlay.appendChild(box); document.body.appendChild(overlay);

    const st = { data, viewer: null, xml: '', filename: '', tooltipById: {}, zoom: 1, chainIds: new Set(), chainMarkerBackup: new Map(), impactBound: false, lastElementClickTs: 0 };
    const ATP_CHAIN_MARKER = 'atp-chain-selected';
    const setZoom = (v) => { const n = Number(v); if (!Number.isFinite(n)) return; st.zoom = n; zoomLab.textContent = Math.round(n * 100) + '%'; };
    const extractMarkerId = (markerUrl) => {
      const m = String(markerUrl || '').match(/url\(#([^)]+)\)/);
      return m && m[1] ? String(m[1]) : '';
    };
    const ensureOrangeMarker = (baseMarkerId) => {
      try {
        const svg = canvas && canvas.querySelector ? canvas.querySelector('svg') : null;
        if (!svg || !baseMarkerId) return '';
        let defs = svg.querySelector('defs');
        if (!defs) {
          defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
          svg.insertBefore(defs, svg.firstChild || null);
        }
        const markers = Array.from(defs.querySelectorAll('marker'));
        let base = null;
        for (const m of markers) { if (String(m.id || '') === String(baseMarkerId)) { base = m; break; } }
        if (!base) return '';
        const orangeId = String(baseMarkerId) + '__atp_orange';
        for (const m of markers) { if (String(m.id || '') === orangeId) return orangeId; }
        const clone = base.cloneNode(true);
        clone.setAttribute('id', orangeId);
        const paints = Array.from(clone.querySelectorAll('*'));
        for (const p of paints) {
          try {
            if (p.hasAttribute('stroke')) p.setAttribute('stroke', '#f97316');
            if (p.hasAttribute('fill') && String(p.getAttribute('fill') || '').toLowerCase() !== 'none') p.setAttribute('fill', '#f97316');
            p.setAttribute('style', String(p.getAttribute('style') || '')
              .replace(/stroke\s*:[^;]+;?/gi, '')
              .replace(/fill\s*:[^;]+;?/gi, '')
              + ';stroke:#f97316;fill:#f97316;');
          } catch (_) {}
        }
        defs.appendChild(clone);
        return orangeId;
      } catch (_) {
        return '';
      }
    };
    const clearChainSelection = () => {
      try {
        if (!st.viewer) return;
        const elementRegistry = st.viewer.get('elementRegistry');
        const canvasApi = st.viewer.get('canvas');
        if (!canvasApi) return;
        for (const [id, prev] of Array.from(st.chainMarkerBackup || [])) {
          try {
            const el = elementRegistry && elementRegistry.get(id);
            if (!el) continue;
            const gfx = elementRegistry.getGraphics(el);
            const path = gfx && gfx.querySelector && gfx.querySelector('.djs-visual > path');
            if (!path) continue;
            const prevEnd = String(prev && prev.end || '');
            const prevStart = String(prev && prev.start || '');
            if (prevEnd) path.setAttribute('marker-end', prevEnd); else path.removeAttribute('marker-end');
            if (prevStart) path.setAttribute('marker-start', prevStart); else path.removeAttribute('marker-start');
          } catch (_) {}
        }
        st.chainMarkerBackup = new Map();
        for (const id of Array.from(st.chainIds || [])) {
          try { canvasApi.removeMarker(id, ATP_CHAIN_MARKER); } catch (_) {}
        }
        st.chainIds = new Set();
      } catch (_) {}
    };
    overlay._atpClearChainSelection = clearChainSelection;
    const colorConnectionArrow = (connId) => {
      try {
        if (!st.viewer) return;
        const id = String(connId || '');
        if (!id) return;
        const elementRegistry = st.viewer.get('elementRegistry');
        const el = elementRegistry && elementRegistry.get(id);
        const bo = el && el.businessObject;
        if (!el || !bo || String(bo.$type || '') !== 'bpmn:SequenceFlow') return;
        const gfx = elementRegistry.getGraphics(el);
        const path = gfx && gfx.querySelector && gfx.querySelector('.djs-visual > path');
        if (!path) return;
        if (!st.chainMarkerBackup.has(id)) {
          st.chainMarkerBackup.set(id, {
            end: String(path.getAttribute('marker-end') || ''),
            start: String(path.getAttribute('marker-start') || '')
          });
        }
        const mEndId = extractMarkerId(path.getAttribute('marker-end'));
        const mStartId = extractMarkerId(path.getAttribute('marker-start'));
        const endOrange = ensureOrangeMarker(mEndId);
        const startOrange = ensureOrangeMarker(mStartId);
        if (endOrange) path.setAttribute('marker-end', 'url(#' + endOrange + ')');
        if (startOrange) path.setAttribute('marker-start', 'url(#' + startOrange + ')');
      } catch (_) {}
    };
    const addChainMarker = (id) => {
      try {
        if (!st.viewer) return;
        const sid = String(id || '');
        if (!sid || st.chainIds.has(sid)) return;
        const canvasApi = st.viewer.get('canvas');
        if (!canvasApi) return;
        canvasApi.addMarker(sid, ATP_CHAIN_MARKER);
        st.chainIds.add(sid);
        colorConnectionArrow(sid);
      } catch (_) {}
    };
    const normalizeClickedElement = (el) => {
      try {
        if (!el) return null;
        const bo = el.businessObject;
        if (!bo) return el;
        if (String(bo.$type || '') === 'bpmn:Label' && bo.labelTarget && bo.labelTarget.id) {
          return st.viewer.get('elementRegistry').get(String(bo.labelTarget.id)) || el;
        }
        if (el.type === 'label' && el.labelTarget && el.labelTarget.id) {
          return st.viewer.get('elementRegistry').get(String(el.labelTarget.id)) || el;
        }
        return el;
      } catch (_) {
        return el || null;
      }
    };
    const highlightImpactFromElement = (rawEl) => {
      try {
        clearChainSelection();
        if (!st.viewer) return;
        const el = normalizeClickedElement(rawEl);
        if (!el || !el.businessObject) return;
        const bo = el.businessObject;
        const bType = String(bo.$type || '');

        // Destaca apenas 1 grau para frente: no clicado -> linhas de saida -> nos de destino.
        const elementRegistry = st.viewer.get('elementRegistry');
        const resolveElementById = (id) => {
          try { return elementRegistry && elementRegistry.get(String(id || '')); } catch (_) { return null; }
        };
        const highlightOneDegreeForward = (nodeEl) => {
          if (!nodeEl || !nodeEl.id) return;
          addChainMarker(String(nodeEl.id));
          const outgoing = Array.from((nodeEl && nodeEl.outgoing) || []);
          for (const conn of outgoing) {
            const fid = String(conn && conn.id || '');
            if (fid) addChainMarker(fid);
            const targetEl = (conn && conn.target) ? conn.target : null;
            const tid = String(targetEl && targetEl.id || '');
            if (tid) addChainMarker(tid);
          }
        };

        if (bType === 'bpmn:SequenceFlow') {
          addChainMarker(el.id);
          if (bo.sourceRef && bo.sourceRef.id) addChainMarker(String(bo.sourceRef.id));
          if (bo.targetRef && bo.targetRef.id) {
            addChainMarker(String(bo.targetRef.id));
            const targetEl = resolveElementById(String(bo.targetRef.id));
            if (targetEl) highlightOneDegreeForward(targetEl);
          }
          return;
        }

        const isFlowNode = !!(bo && typeof bo.$instanceOf === 'function' && bo.$instanceOf('bpmn:FlowNode'));
        const outgoing = Array.from((el && el.outgoing) || []);
        if (!isFlowNode && !outgoing.length) return;
        highlightOneDegreeForward(el);
      } catch (_) {}
    };
    const bindImpactHandlers = () => {
      try {
        if (!st.viewer || st.impactBound) return;
        st.impactBound = true;
        const eventBus = st.viewer.get('eventBus');
        if (!eventBus) return;
        eventBus.on('element.click', (ev) => {
          try {
            st.lastElementClickTs = Date.now();
            highlightImpactFromElement(ev && ev.element);
          } catch (_) {}
        });
        eventBus.on('canvas.click', () => {
          try {
            if ((Date.now() - Number(st.lastElementClickTs || 0)) < 120) return;
            clearChainSelection();
          } catch (_) {}
        });
      } catch (_) {}
    };
    const setModalLoading = (on, msg) => {
      try {
        if (on) {
          // Evita abrir duas vezes (clique no botao + render inicial).
          if ((Number(loadingDepth) || 0) > 0) setAnyLoadingMsg(msg || 'Renderizando fluxo...');
          else startLoading(msg || 'Renderizando fluxo...');
        } else {
          stopLoading();
        }
      } catch (_) {}
      try {
        btnRender.disabled = !!on;
        sel.disabled = !!on;
      } catch (_) {}
    };
    const importXml = (xml) => ensureViewer().then((BpmnJS) => {
      if (!st.viewer) {
        st.viewer = new BpmnJS({ container: canvas, keyboard: { bindTo: overlay } });
        overlay._atpBpmnIoViewer = st.viewer;
        bindImpactHandlers();
      }
      clearChainSelection();
      return st.viewer.importXML(xml).then(() => {
        const cv = st.viewer.get('canvas');
        cv.zoom('fit-viewport');
        setZoom(cv.zoom());
        try {
          const elementRegistry = st.viewer.get('elementRegistry');
          const setTitle = (gfx, txt) => {
            if (!gfx || !txt) return;
            let tEl = gfx.querySelector('title');
            if (!tEl) {
              tEl = document.createElementNS('http://www.w3.org/2000/svg', 'title');
              gfx.insertBefore(tEl, gfx.firstChild || null);
            }
            tEl.textContent = cutKeepNl(txt, 3000);
          };
          Object.keys(st.tooltipById || {}).forEach((id) => {
            try {
              const el = elementRegistry && elementRegistry.get(String(id));
              if (!el) return;
              const gfx = elementRegistry.getGraphics(el);
              setTitle(gfx, st.tooltipById[id]);
              const lbl = elementRegistry.get(String(id) + '_label');
              if (lbl) setTitle(elementRegistry.getGraphics(lbl), st.tooltipById[id]);
            } catch (_) {}
          });
        } catch (_) {}
      });
    });
    let renderToken = 0;
    const render = () => {
      const token = ++renderToken;
      const idx = parseInt(String(sel.value || '0'), 10);
      const i = Number.isFinite(idx) ? Math.max(0, Math.min(idx, fluxos.length - 1)) : 0;
      sel.value = String(i);
      sub.textContent = 'Gerando BPMN...';
      setModalLoading(true, 'Gerando BPMN...');
      try {
        const b = buildBpmnFromFlow(st.data, i);
        st.xml = b.xml; st.filename = b.filename; st.tooltipById = b.tooltipById || {};
        importXml(st.xml)
          .then(() => {
            if (token !== renderToken) return;
            sub.textContent = `Fluxo ${String(i + 1).padStart(2, '0')} renderizado em arvore com ${b.pathsCount} caminho(s)/pool(s) virtual(is).`;
          })
          .catch((e) => {
            try { console.warn(LOG, 'Falha ao importar XML:', e); } catch (_) {}
            if (token !== renderToken) return;
            sub.textContent = 'Falha ao renderizar no bpmn.io (bloqueio de rede/CSP).';
          })
          .finally(() => { if (token === renderToken) setModalLoading(false); });
      } catch (e) {
        try { console.warn(LOG, 'Falha ao montar BPMN:', e); } catch (_) {}
        sub.textContent = 'Falha ao gerar BPMN do fluxo selecionado.';
        setModalLoading(false);
      }
    };
    btnRender.addEventListener('click', render); sel.addEventListener('change', render);
    btnDown.addEventListener('click', () => {
      try {
        if (!st.xml) return;
        const blob = new Blob([st.xml], { type: 'application/xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = st.filename || 'fluxo_arvore_pool_virtual.bpmn';
        document.body.appendChild(a); a.click();
        setTimeout(() => { try { URL.revokeObjectURL(url); } catch (_) {} try { a.remove(); } catch (_) {} }, 0);
      } catch (_) {}
    });
    const zoomTo = (target) => {
      if (!st.viewer) return;
      try { const cv = st.viewer.get('canvas'); const z = Math.max(0.2, Math.min(3, target)); cv.zoom(z); setZoom(cv.zoom()); } catch (_) {}
    };
    btnZoomIn.addEventListener('click', () => zoomTo((st.zoom || 1) + 0.1));
    btnZoomOut.addEventListener('click', () => zoomTo((st.zoom || 1) - 0.1));
    btnFit.addEventListener('click', () => { if (!st.viewer) return; try { const cv = st.viewer.get('canvas'); cv.zoom('fit-viewport'); setZoom(cv.zoom()); } catch (_) {} });
    render();
  }

  function ensureButton() {
    const host = document.getElementById('dvFiltrosOpcionais');
    if (!host) return;
    const anchor = host.querySelector('#btnExtratoFluxosATP');
    const existing = host.querySelector('#' + BTN_ID);
    if (existing) {
      // Reposiciona com segurança sem recriar handler/loading.
      if (anchor && anchor.parentNode === host && existing.previousSibling !== anchor) {
        anchor.insertAdjacentElement('afterend', existing);
      }
      return;
    }
    const btn = document.createElement('button');
    btn.type = 'button'; btn.id = BTN_ID; btn.className = 'infraButton';
    btn.textContent = 'Visualizar Fluxos'; btn.style.marginLeft = '8px';
    btn.addEventListener('click', () => {
      try {
        if (btn.dataset.atpBusy === '1') return;
        btn.dataset.atpBusy = '1';
        btn.disabled = true;
        showAnyLoading('Abrindo visualizador de fluxos...');
        setTimeout(() => {
          try { openModal(); } catch (_) { try { hideAnyLoading(); } catch (_) {} } finally {
            btn.dataset.atpBusy = '0';
            btn.disabled = false;
          }
        }, 0);
      } catch (_) {
        try {
          btn.dataset.atpBusy = '0';
          btn.disabled = false;
          hideAnyLoading();
        } catch (_) {}
      }
    });
    const dash = host.querySelector('#btnDashboardUsoATP');
    if (anchor && anchor.parentNode === host) {
      anchor.insertAdjacentElement('afterend', btn);
      return;
    }
    if (dash && dash.parentNode === host) {
      host.insertBefore(btn, dash);
      return;
    }
    host.appendChild(btn);
  }

  function boot() {
    ensureButton();
    try { const mo = new MutationObserver(() => ensureButton()); mo.observe(document.body, { childList: true, subtree: true }); } catch (_) {}
  }

  try { window.atpEnsureFluxosBpmnIoButton = ensureButton; } catch (_) {}
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
  try { console.log('[ATP][OK] 13-visualizador-fluxos-bpmnio.js inicializado'); } catch (e) {}
})();
;
