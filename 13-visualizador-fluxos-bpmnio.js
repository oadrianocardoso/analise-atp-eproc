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
  let PROM = null;

  const t = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  const esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, Math.round(Number(v) || 0)));
  const hash = (v) => { const s = String(v == null ? '' : v); let h = 0; for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; } return Math.abs(h).toString(36); };
  const sortNums = (arr) => arr.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  const avg = (arr, fb) => arr.length ? (arr.reduce((x, y) => x + y, 0) / arr.length) : (Number(fb) || 0);

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

  function ruleNum(r) { const n = Number(r && r.num); return Number.isFinite(n) ? String(n) : t(r && r.num || ''); }
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
        const rt = { type: 'rule', ruleNum: ruleNum(e.rule), from: e.from, to: e.to, implied: !!e.implied, impliedLabel: t(e.impliedLabel || ''), condText: ruleCond(e.rule), actionText: ruleAction(e.rule) };
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
    if (tok.type === 'locator') return { type: 'task', name: t(tok.key) ? ('Localizador: ' + t(tok.key)) : 'Localizador', doc: '', branch: t(tok.key || '') };
    if (tok.type === 'rule') {
      const n = t(tok.ruleNum || '');
      const name = n ? ('REGRA ' + n) : (t(tok.impliedLabel || '') || 'Regra de Continuidade');
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
    if (type === 'serviceTask') return { w: 280, h: 90 };
    return { w: 220, h: 74 };
  }

  function buildBpmnFromFlow(data, flowIdx) {
    const fluxos = Array.isArray(data && data.fluxos) ? data.fluxos : [];
    const flow = fluxos[flowIdx];
    if (!flow) throw new Error('Fluxo selecionado nao existe.');
    const graph = buildGraph(flow, toMap(data && data.byFrom));
    const paths = enumeratePaths(flow, graph);
    if (!paths.length) throw new Error('Fluxo sem caminhos visualizaveis.');

    let seqId = 0;
    const nextId = (p, laneNo) => `${p}_${String(flowIdx + 1).padStart(2, '0')}_${String((laneNo | 0) + 1).padStart(2, '0')}_${++seqId}`;
    const pathLaneCount = Math.max(1, paths.length);
    let lanes = paths.map((path, i) => ({
      idx: i,
      laneId: nextId('Lane', i),
      laneName: `Pool Virtual ${String(i + 1).padStart(2, '0')}`,
      path,
      refs: []
    }));

    const ensureSet = (m, k) => {
      if (!m.has(k)) m.set(k, new Set());
      return m.get(k);
    };
    const locPathSet = new Map();
    const rulePathSet = new Map();
    const edgeSig = (from, to, rule, implied, impliedLabel) =>
      `${t(from)}>>>${t(to)}>>>${ruleNum(rule)}>>>${implied ? '1' : '0'}>>>${t(impliedLabel || '')}`;
    const ruleTokKey = (tk) => {
      const n = t(tk && tk.ruleNum || '');
      if (n) return 'REGRA:' + n;
      return 'EDGE:' + edgeSig(tk && tk.from, tk && tk.to, { num: tk && tk.ruleNum }, !!(tk && tk.implied), tk && tk.impliedLabel);
    };
    const ruleEdgeKey = (e) => {
      const n = t(ruleNum(e && e.rule));
      if (n) return 'REGRA:' + n;
      return 'EDGE:' + edgeSig(e && e.from, e && e.to, e && e.rule, !!(e && e.implied), e && e.impliedLabel);
    };
    for (let p = 0; p < paths.length; p++) {
      const tokens = Array.isArray(paths[p] && paths[p].tokens) ? paths[p].tokens : [];
      for (const tk of tokens) {
        if (!tk || typeof tk !== 'object') continue;
        if (tk.type === 'locator') {
          const k = t(tk.key || '');
          if (k) ensureSet(locPathSet, k).add(p);
        } else if (tk.type === 'rule') {
          ensureSet(rulePathSet, ruleTokKey(tk)).add(p);
        }
      }
    }

    const allPathIdx = paths.map((_, i) => i);
    const lanePick = (setLike, fb) => {
      const arr = sortNums(Array.from(setLike || []));
      return clamp(avg(arr, fb), 0, pathLaneCount - 1);
    };
    const pushRef = (laneIdx, id) => {
      const lane = lanes[laneIdx];
      if (!lane) return;
      if (!lane.refs.includes(id)) lane.refs.push(id);
    };

    const locNodes = new Map();
    for (const key of Array.from(graph.nodeSet).sort((a, b) => a.localeCompare(b, 'pt-BR'))) {
      const lane = lanePick(locPathSet.get(key), 0);
      const id = nextId('locator', lane);
      const el = { id, type: 'task', name: `Localizador: ${key}`, doc: '', lane, stage: 1, key };
      locNodes.set(key, el);
      pushRef(lane, id);
    }

    const ruleNodes = new Map();
    for (const from of graph.nodeSet) {
      const outs = graph.out.get(from) || [];
      for (const e of outs) {
        const sig = ruleEdgeKey(e);
        if (ruleNodes.has(sig)) continue;
        const lane = lanePick(rulePathSet.get(sig) || locPathSet.get(from), 0);
        const num = ruleNum(e.rule);
        const name = num ? `REGRA ${num}` : (t(e.impliedLabel || '') || 'Regra de Continuidade');
        const doc = [
          `REMOVER: ${t(e.from)}`,
          `INCLUIR: ${t(e.to)}`,
          e.rule ? (`SE: ${t(ruleCond(e.rule))}`) : '',
          e.rule ? (`ACAO: ${t(ruleAction(e.rule))}`) : ''
        ].filter(Boolean).join(' | ');
        const id = nextId('rule', lane);
        const el = { id, type: 'serviceTask', name, doc, lane, stage: 2, sig, from: e.from, to: e.to };
        ruleNodes.set(sig, el);
        pushRef(lane, id);
      }
    }

    const gwNodes = new Map();
    for (const from of graph.nodeSet) {
      const outs = graph.out.get(from) || [];
      if (outs.length <= 1) continue;
      const lane = lanePick(locPathSet.get(from), 0);
      const id = nextId('exclusiveGateway', lane);
      const el = { id, type: 'exclusiveGateway', name: 'Decisao', doc: '', lane, stage: 2, key: from };
      gwNodes.set(from, el);
      pushRef(lane, id);
    }

    const seedCandidates = (Array.isArray(flow.starts) ? flow.starts : []).map(t).filter((k) => graph.nodeSet.has(k));
    const fallbackSeeds = Array.from(graph.nodeSet).filter((k) => (graph.inD.get(k) || 0) === 0).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const seeds = seedCandidates.length ? seedCandidates : (fallbackSeeds.length ? fallbackSeeds : (graph.nodeSet.size ? [Array.from(graph.nodeSet)[0]] : []));
    if (!seeds.length) throw new Error('Fluxo sem pontos de inicio.');

    // Nivel do localizador no fluxo (quantidade de transicoes regra->saida a partir da entrada).
    const locatorLevel = new Map();
    const qLoc = [];
    for (const s of seeds) {
      const k = t(s || '');
      if (!k || !graph.nodeSet.has(k) || locatorLevel.has(k)) continue;
      locatorLevel.set(k, 0);
      qLoc.push(k);
    }
    while (qLoc.length) {
      const cur = qLoc.shift();
      const base = Number(locatorLevel.get(cur) || 0);
      const outs = graph.out.get(cur) || [];
      for (const e of outs) {
        const to = t(e && e.to || '');
        if (!to || !graph.nodeSet.has(to)) continue;
        const cand = base + 1;
        const old = locatorLevel.get(to);
        if (!Number.isFinite(old) || cand < old) {
          locatorLevel.set(to, cand);
          qLoc.push(to);
        }
      }
    }
    for (const k of graph.nodeSet) if (!locatorLevel.has(k)) locatorLevel.set(k, 0);
    const locLevel = (k) => Number(locatorLevel.get(t(k || '')) || 0);
    const locInCount = (k) => Number(graph.inD.get(t(k || '')) || 0);

    const startLane = lanePick(new Set(allPathIdx), 0);
    const startEl = { id: nextId('startEvent', startLane), type: 'startEvent', name: 'Inicio', doc: '', lane: startLane, stage: 0 };
    pushRef(startLane, startEl.id);

    let rootGw = null;
    if (seeds.length > 1) {
      const id = nextId('exclusiveGateway', startLane);
      rootGw = { id, type: 'exclusiveGateway', name: 'Decisao', doc: '', lane: startLane, stage: 1 };
      pushRef(startLane, id);
    }

    const endNodes = new Map();
    for (const k of graph.nodeSet) {
      const outs = graph.out.get(k) || [];
      if (outs.length) continue;
      const lane = lanePick(locPathSet.get(k), 0);
      const id = nextId('endEvent', lane);
      const el = { id, type: 'endEvent', name: 'Fim', doc: '', lane, stage: null, key: k };
      endNodes.set(k, el);
      pushRef(lane, id);
    }

    const rawEdges = [];
    const rawEdgeSet = new Set();
    const pushRawEdge = (a, b, nm) => {
      if (!a || !b) return;
      const nmT = t(nm || '');
      const sig = `${t(a)}>>>${t(b)}>>>${nmT}`;
      if (rawEdgeSet.has(sig)) return;
      rawEdgeSet.add(sig);
      rawEdges.push({ a, b, nm: nmT });
    };

    if (rootGw) {
      pushRawEdge(startEl.id, rootGw.id, '');
      for (const k of seeds) pushRawEdge(rootGw.id, locNodes.get(k).id, k);
    } else {
      pushRawEdge(startEl.id, locNodes.get(seeds[0]).id, '');
    }

    for (const from of graph.nodeSet) {
      const fromLoc = locNodes.get(from);
      const outs = graph.out.get(from) || [];
      if (!outs.length) continue;

      if (outs.length > 1) {
        const gw = gwNodes.get(from);
        pushRawEdge(fromLoc.id, gw.id, '');
        for (const e of outs) {
          const sig = ruleEdgeKey(e);
          const rn = ruleNodes.get(sig);
          pushRawEdge(gw.id, rn.id, ruleNum(e.rule) ? (`Regra ${ruleNum(e.rule)}`) : '');
          pushRawEdge(rn.id, locNodes.get(e.to).id, '');
        }
      } else {
        const e = outs[0];
        const sig = ruleEdgeKey(e);
        const rn = ruleNodes.get(sig);
        pushRawEdge(fromLoc.id, rn.id, '');
        pushRawEdge(rn.id, locNodes.get(e.to).id, '');
      }
    }

    for (const [k, endEl] of endNodes.entries()) pushRawEdge(locNodes.get(k).id, endEl.id, '');

    const adj = new Map();
    const addAdj = (a, b) => {
      if (!adj.has(a)) adj.set(a, []);
      adj.get(a).push(b);
    };
    for (const e of rawEdges) addAdj(e.a, e.b);

    const stageById = new Map();
    const setInf = (id) => stageById.set(id, Number.POSITIVE_INFINITY);
    setInf(startEl.id);
    if (rootGw) setInf(rootGw.id);
    for (const e of locNodes.values()) setInf(e.id);
    for (const e of gwNodes.values()) setInf(e.id);
    for (const e of ruleNodes.values()) setInf(e.id);
    for (const e of endNodes.values()) setInf(e.id);

    stageById.set(startEl.id, 0);
    const q = [startEl.id];
    while (q.length) {
      const cur = q.shift();
      const base = stageById.get(cur);
      if (!Number.isFinite(base)) continue;
      const outs = adj.get(cur) || [];
      for (const nxt of outs) {
        const cand = base + 1;
        const old = stageById.get(nxt);
        if (!Number.isFinite(old) || cand < old) {
          stageById.set(nxt, cand);
          q.push(nxt);
        }
      }
    }

    for (const e of locNodes.values()) if (!Number.isFinite(stageById.get(e.id))) stageById.set(e.id, 1);
    for (const e of gwNodes.values()) if (!Number.isFinite(stageById.get(e.id))) stageById.set(e.id, 2);
    for (const e of ruleNodes.values()) if (!Number.isFinite(stageById.get(e.id))) stageById.set(e.id, 2);
    if (rootGw && !Number.isFinite(stageById.get(rootGw.id))) stageById.set(rootGw.id, 1);

    const nonEndStageSet = new Set();
    for (const [id, st] of stageById.entries()) {
      if (!Number.isFinite(st)) continue;
      let isEnd = false;
      for (const e of endNodes.values()) { if (e.id === id) { isEnd = true; break; } }
      if (!isEnd) nonEndStageSet.add(st);
    }
    const sortedStages = Array.from(nonEndStageSet).sort((a, b) => a - b);
    const remap = new Map();
    sortedStages.forEach((s, i) => remap.set(s, i));
    for (const [id, st] of Array.from(stageById.entries())) {
      if (!Number.isFinite(st)) continue;
      if (remap.has(st)) stageById.set(id, remap.get(st));
    }

    let maxStage = 0;
    for (const [id, v] of stageById.entries()) {
      let isEnd = false;
      for (const e of endNodes.values()) { if (e.id === id) { isEnd = true; break; } }
      if (isEnd) continue;
      maxStage = Math.max(maxStage, Number(v) || 0);
    }
    const endStage = maxStage + 1;

    const elements = [startEl];
    if (rootGw) elements.push(rootGw);
    for (const e of locNodes.values()) { e.stage = stageById.get(e.id) || 1; elements.push(e); }
    for (const e of gwNodes.values()) { e.stage = stageById.get(e.id) || 2; elements.push(e); }
    for (const e of ruleNodes.values()) { e.stage = stageById.get(e.id) || 2; elements.push(e); }
    for (const e of endNodes.values()) { e.stage = endStage; elements.push(e); }

    const flows = rawEdges.map((e) => ({ id: nextId('Flow', 0), a: e.a, b: e.b, nm: e.nm }));

    // Compacta raias: remove lanes vazias e reindexa para evitar espacos verticais desnecessarios.
    const usedLaneIdx = Array.from(new Set(elements.map((e) => clamp(e.lane, 0, pathLaneCount - 1)))).sort((a, b) => a - b);
    const laneRemap = new Map();
    usedLaneIdx.forEach((oldIdx, newIdx) => laneRemap.set(oldIdx, newIdx));

    for (const e of elements) {
      const oldIdx = clamp(e.lane, 0, pathLaneCount - 1);
      e.lane = laneRemap.has(oldIdx) ? laneRemap.get(oldIdx) : 0;
    }

    lanes = usedLaneIdx.map((oldIdx, newIdx) => ({
      idx: newIdx,
      laneId: nextId('Lane', newIdx),
      laneName: `Pool Virtual ${String(oldIdx + 1).padStart(2, '0')}`,
      refs: []
    }));
    for (const e of elements) {
      const laneObj = lanes[e.lane];
      if (!laneObj) continue;
      if (!laneObj.refs.includes(e.id)) laneObj.refs.push(e.id);
    }
    const laneCount = Math.max(1, lanes.length);

    const laneX = 70, laneY0 = 70, laneH = 120, laneGap = 8, stageX0 = laneX + 170;
    const virtualColsPerFlow = 4;
    const COL_ENTRY = 0, COL_DECISION = 1, COL_RULE = 2, COL_OUTPUT = 3;
    const virtualColStep = 340; // Coluna larga o suficiente para task (280px) + respiro.
    const columnIndexFor = (el) => {
      if (!el || typeof el !== 'object') return 0;
      if (el.type === 'startEvent') return -1;
      if (el.type === 'exclusiveGateway') {
        if (rootGw && el.id === rootGw.id) return 0.5;
        return (locLevel(el.key) * virtualColsPerFlow) + COL_DECISION;
      }
      if (el.type === 'serviceTask') {
        return (locLevel(el.from) * virtualColsPerFlow) + COL_RULE;
      }
      if (el.type === 'task' && t(el.key || '')) {
        const k = t(el.key || '');
        const lv = locLevel(k);
        if ((locInCount(k) || 0) <= 0) return (lv * virtualColsPerFlow) + COL_ENTRY;
        return (Math.max(0, lv - 1) * virtualColsPerFlow) + COL_OUTPUT;
      }
      if (el.type === 'endEvent') {
        return (locLevel(el.key) * virtualColsPerFlow) + COL_OUTPUT + 0.65;
      }
      return Number(el.stage) || 0;
    };

    // Mantem colunas fixas: resolve colisao movendo de raia (vertical), nao de coluna (horizontal).
    const colById = new Map();
    for (const e of elements) colById.set(e.id, Number(columnIndexFor(e)));
    const colKey = (v) => String(Math.round((Number(v) || 0) * 100));
    const occ = new Map(); // lane -> Set(colKey)
    const hasOcc = (lane, cKey) => {
      const s = occ.get(lane);
      return !!(s && s.has(cKey));
    };
    const addOcc = (lane, cKey) => {
      if (!occ.has(lane)) occ.set(lane, new Set());
      occ.get(lane).add(cKey);
    };
    const pickLaneForCol = (desiredLane, cKey) => {
      const d = clamp(desiredLane, 0, laneCount - 1);
      if (!hasOcc(d, cKey)) return d;
      for (let step = 1; step < laneCount; step++) {
        const up = d - step;
        if (up >= 0 && !hasOcc(up, cKey)) return up;
        const dn = d + step;
        if (dn < laneCount && !hasOcc(dn, cKey)) return dn;
      }
      return d;
    };
    const ordered = elements.slice().sort((a, b) => {
      const ac = Number(colById.get(a.id) || 0), bc = Number(colById.get(b.id) || 0);
      if (ac !== bc) return ac - bc;
      const al = clamp(a.lane, 0, laneCount - 1), bl = clamp(b.lane, 0, laneCount - 1);
      if (al !== bl) return al - bl;
      return t(a.id).localeCompare(t(b.id), 'pt-BR');
    });
    for (const e of ordered) {
      const cKey = colKey(colById.get(e.id));
      const desired = clamp(e.lane, 0, laneCount - 1);
      const picked = pickLaneForCol(desired, cKey);
      e.lane = picked;
      addOcc(picked, cKey);
    }
    for (const ln of lanes) ln.refs = [];
    for (const e of elements) pushRef(clamp(e.lane, 0, laneCount - 1), e.id);

    const xById = new Map();
    let maxRight = stageX0;
    for (const e of elements) {
      const col = Number(colById.get(e.id) || 0);
      const cx = Math.round(stageX0 + (col + 1) * virtualColStep);
      xById.set(e.id, cx);
      const d = dims(e.type);
      const right = cx + (d.w / 2);
      if (right > maxRight) maxRight = right;
    }

    const cyLane = (idx) => Math.round((laneY0 + idx * (laneH + laneGap)) + laneH / 2);

    const bounds = new Map();
    for (const e of elements) {
      const d = dims(e.type);
      const cx = Math.round(Number(xById.get(e.id)) || stageX0);
      const cy = cyLane(clamp(e.lane, 0, laneCount - 1));
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
    const isPolylineClear = (pts, obstacles) => {
      for (let i = 1; i < pts.length; i++) {
        if (isSegmentBlocked(pts[i - 1], pts[i], obstacles)) return false;
      }
      return true;
    };

    const way = new Map();
    for (const f of flows) {
      const sb = bounds.get(f.a), tb = bounds.get(f.b); if (!sb || !tb) continue;
      const obstacles = allObstacles.filter((o) => o.id !== f.a && o.id !== f.b);
      const tryRoute = (pts) => {
        const p = normalizePts(pts);
        return isPolylineClear(p, obstacles) ? p : null;
      };
      const preferRight = tb.x >= sb.x;
      const sourcePorts = preferRight
        ? [
            { x: sb.x + sb.w, y: sb.y + sb.h / 2, pen: 0 },
            { x: sb.x + sb.w / 2, y: sb.y, pen: 35 },
            { x: sb.x + sb.w / 2, y: sb.y + sb.h, pen: 35 },
            { x: sb.x, y: sb.y + sb.h / 2, pen: 70 }
          ]
        : [
            { x: sb.x, y: sb.y + sb.h / 2, pen: 0 },
            { x: sb.x + sb.w / 2, y: sb.y, pen: 35 },
            { x: sb.x + sb.w / 2, y: sb.y + sb.h, pen: 35 },
            { x: sb.x + sb.w, y: sb.y + sb.h / 2, pen: 70 }
          ];
      const targetPorts = preferRight
        ? [
            { x: tb.x, y: tb.y + tb.h / 2, pen: 0 },
            { x: tb.x + tb.w / 2, y: tb.y, pen: 35 },
            { x: tb.x + tb.w / 2, y: tb.y + tb.h, pen: 35 },
            { x: tb.x + tb.w, y: tb.y + tb.h / 2, pen: 70 }
          ]
        : [
            { x: tb.x + tb.w, y: tb.y + tb.h / 2, pen: 0 },
            { x: tb.x + tb.w / 2, y: tb.y, pen: 35 },
            { x: tb.x + tb.w / 2, y: tb.y + tb.h, pen: 35 },
            { x: tb.x, y: tb.y + tb.h / 2, pen: 70 }
          ];

      let best = null;
      let bestScore = Number.POSITIVE_INFINITY;
      const evalRoute = (pts, scoreBase) => {
        const rt = tryRoute(pts);
        if (!rt) return;
        let len = 0;
        for (let i = 1; i < rt.length; i++) {
          len += Math.abs(rt[i].x - rt[i - 1].x) + Math.abs(rt[i].y - rt[i - 1].y);
        }
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
          }
        }
      }

      if (!best) {
        // Fallback: rota ortogonal simples caso nao haja L viavel sem colisao.
        const sx = Math.round(sb.x + sb.w), sy = Math.round(sb.y + sb.h / 2);
        const tx = Math.round(tb.x), ty = Math.round(tb.y + tb.h / 2);
        best = (Math.abs(sy - ty) <= 2)
          ? [{ x: sx, y: sy }, { x: tx, y: ty }]
          : [{ x: sx, y: sy }, { x: tx, y: sy }, { x: tx, y: ty }];
      }
      way.set(f.id, normalizePts(best));
    }

    // Delimita visualmente cada ramo apos um gateway de decisao usando Group (borda pontilhada).
    // A montagem usa os caminhos enumerados para manter hierarquia: ramo interno fica dentro do ramo pai.
    const addBranchId = (set, id) => {
      const sid = t(id || '');
      if (!sid) return;
      set.add(sid);
    };
    const branchIdsByKey = new Map(); // `${from}>>>${ruleKey}` -> Set(elementId)
    const ensureBranchSet = (k) => {
      if (!branchIdsByKey.has(k)) branchIdsByKey.set(k, new Set());
      return branchIdsByKey.get(k);
    };
    for (const path of paths) {
      const toks = Array.isArray(path && path.tokens) ? path.tokens : [];
      for (let i = 0; i < toks.length; i++) {
        const tk = toks[i];
        if (!tk || tk.type !== 'rule') continue;
        const fromKey = t(tk.from || '');
        const outsFrom = graph.out.get(fromKey) || [];
        if (outsFrom.length <= 1) continue; // nao eh bifurcacao real
        const branchKey = `${fromKey}>>>${ruleTokKey(tk)}`;
        const ids = ensureBranchSet(branchKey);
        for (let j = i; j < toks.length; j++) {
          const tj = toks[j];
          if (!tj || typeof tj !== 'object') continue;
          if (tj.type === 'rule') {
            const rn = ruleNodes.get(ruleTokKey(tj));
            if (rn && rn.id) addBranchId(ids, rn.id);
            continue;
          }
          if (tj.type === 'locator') {
            const lk = t(tj.key || '');
            const ln = locNodes.get(lk);
            if (ln && ln.id) addBranchId(ids, ln.id);
            const innerGw = gwNodes.get(lk);
            if (innerGw && innerGw.id) addBranchId(ids, innerGw.id);
          }
        }
        const lastTok = toks.length ? toks[toks.length - 1] : null;
        if (lastTok && lastTok.type === 'locator') {
          const ek = t(lastTok.key || '');
          const ee = endNodes.get(ek);
          if (ee && ee.id) addBranchId(ids, ee.id);
        }
      }
    }
    // Mantem em cada ramo apenas a parte exclusiva em relacao aos ramos irmaos da mesma decisao.
    const branchUniqueIdsByKey = new Map();
    for (const [from] of gwNodes.entries()) {
      const outs = graph.out.get(from) || [];
      const keys = outs.map((e) => `${t(from)}>>>${ruleEdgeKey(e)}`);
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        const base = branchIdsByKey.get(k) || new Set();
        const others = new Set();
        for (let j = 0; j < keys.length; j++) {
          if (j === i) continue;
          const o = branchIdsByKey.get(keys[j]);
          if (!o) continue;
          for (const id of o) others.add(id);
        }
        const uniq = new Set();
        for (const id of base) if (!others.has(id)) uniq.add(id);
        branchUniqueIdsByKey.set(k, uniq.size ? uniq : base);
      }
    }
    const groupPadX = 26;
    const groupPadY = 14;
    const branchGroups = [];
    const decisionGroups = [];
    for (const [from, gw] of gwNodes.entries()) {
      const outs = graph.out.get(from) || [];
      const branchBoxesForDecision = [];
      let branchIdx = 0;
      for (const e of outs) {
        const branchKey = `${t(from)}>>>${ruleEdgeKey(e)}`;
        const ids = branchUniqueIdsByKey.get(branchKey) || branchIdsByKey.get(branchKey);
        if (!ids || !ids.size) continue;
        let minX = Number.POSITIVE_INFINITY, minY = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY, maxY = Number.NEGATIVE_INFINITY;
        for (const id of ids) {
          const b = bounds.get(id);
          if (!b) continue;
          minX = Math.min(minX, Number(b.x) || 0);
          minY = Math.min(minY, Number(b.y) || 0);
          maxX = Math.max(maxX, (Number(b.x) || 0) + (Number(b.w) || 0));
          maxY = Math.max(maxY, (Number(b.y) || 0) + (Number(b.h) || 0));
        }
        if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) continue;
        branchIdx++;
        const groupLane = clamp(gw && gw.lane, 0, laneCount - 1);
        const groupId = nextId('Group', groupLane);
        const catValId = nextId('CategoryValue', groupLane);
        const catId = nextId('Category', groupLane);
        const ruleLabel = t(ruleNum(e.rule || {}));
        const label = ruleLabel ? (`Ramo Regra ${ruleLabel}`) : (`Ramo ${String(branchIdx)}`);
        const gwB = bounds.get(gw && gw.id);
        const startAfterGw = gwB ? Math.round((Number(gwB.x) || 0) + (Number(gwB.w) || 0) + 12) : Math.round(minX - groupPadX);
        const x0 = Math.max(Math.round(minX - groupPadX), startAfterGw);
        const x1 = Math.round(maxX + groupPadX);
        const w0 = Math.max(80, x1 - x0);
        const bnd = {
          x: x0,
          y: Math.round(minY - groupPadY),
          w: w0,
          h: Math.round((maxY - minY) + (groupPadY * 2))
        };
        branchGroups.push({
          id: groupId,
          catValId,
          catId,
          label,
          bounds: bnd
        });
        branchBoxesForDecision.push(bnd);
      }
      if (branchBoxesForDecision.length) {
        let dMinX = Number.POSITIVE_INFINITY, dMinY = Number.POSITIVE_INFINITY;
        let dMaxX = Number.NEGATIVE_INFINITY, dMaxY = Number.NEGATIVE_INFINITY;
        for (const b of branchBoxesForDecision) {
          dMinX = Math.min(dMinX, Number(b.x) || 0);
          dMinY = Math.min(dMinY, Number(b.y) || 0);
          dMaxX = Math.max(dMaxX, (Number(b.x) || 0) + (Number(b.w) || 0));
          dMaxY = Math.max(dMaxY, (Number(b.y) || 0) + (Number(b.h) || 0));
        }
        if (Number.isFinite(dMinX) && Number.isFinite(dMinY) && Number.isFinite(dMaxX) && Number.isFinite(dMaxY)) {
          const groupLane = clamp(gw && gw.lane, 0, laneCount - 1);
          const gId = nextId('Group', groupLane);
          const gvId = nextId('CategoryValue', groupLane);
          const gcId = nextId('Category', groupLane);
          decisionGroups.push({
            id: gId,
            catValId: gvId,
            catId: gcId,
            label: `Ramos da Decisao ${t(from) || ''}`.trim(),
            bounds: {
              x: Math.round(dMinX - 10),
              y: Math.round(dMinY - 10),
              w: Math.round((dMaxX - dMinX) + 20),
              h: Math.round((dMaxY - dMinY) + 20)
            }
          });
        }
      }
    }
    const allGroups = []; // grupos pontilhados desativados

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
      } else if (e.type === 'exclusiveGateway') x.push(`    <bpmn:exclusiveGateway id="${e.id}" name="${esc(e.name || 'Decisao')}" />`);
      else x.push(`    <bpmn:task id="${e.id}" name="${esc(e.name)}" />`);
    }
    for (const g of allGroups) x.push(`    <bpmn:group id="${g.id}" categoryValueRef="${g.catValId}" />`);
    for (const f of flows) {
      const nm = f.nm ? ` name="${esc(f.nm)}"` : '';
      x.push(`    <bpmn:sequenceFlow id="${f.id}" sourceRef="${f.a}" targetRef="${f.b}"${nm} />`);
    }
    x.push('  </bpmn:process>');
    for (const g of allGroups) {
      x.push(`  <bpmn:category id="${g.catId}">`);
      x.push(`    <bpmn:categoryValue id="${g.catValId}" value="${esc(g.label)}" />`);
      x.push('  </bpmn:category>');
    }
    x.push(`  <bpmndi:BPMNDiagram id="BPMNDiagram_${processId}">`);
    x.push(`    <bpmndi:BPMNPlane id="BPMNPlane_${processId}" bpmnElement="${processId}">`);
    for (const g of allGroups) {
      const b = g.bounds || null;
      if (!b) continue;
      x.push(`      <bpmndi:BPMNShape id="DI_${g.id}" bpmnElement="${g.id}">`);
      x.push(`        <dc:Bounds x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" />`);
      x.push('      </bpmndi:BPMNShape>');
    }
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

    const starts = Array.isArray(flow.starts) ? flow.starts.map(t).filter(Boolean) : [];
    const safe = t(starts[0] || 'inicio').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'inicio';
    return {
      xml: x.join('\n'),
      filename: `fluxo_${String(flowIdx + 1).padStart(2, '0')}_${safe}_arvore_alinhada.bpmn`,
      pathsCount: paths.length
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
    const rules = getRules();
    if (!rules.length) { alert('Nao foi possivel obter as regras da tabela para montar o fluxo.'); return; }
    const data = getFluxosData(rules);
    const fluxos = Array.isArray(data.fluxos) ? data.fluxos : [];
    if (!fluxos.length) { alert('Nenhum fluxo detectado para visualizar.'); return; }

    closeModal();
    const overlay = document.createElement('div');
    overlay.id = MODAL_ID; overlay.className = 'atp-map-overlay';
    overlay.addEventListener('click', (ev) => { if (ev.target === overlay) closeModal(); });
    const box = document.createElement('div'); box.className = 'atp-map-box';
    const top = document.createElement('div'); top.className = 'atp-map-top';
    const titleWrap = document.createElement('div');
    const title = document.createElement('div'); title.className = 'atp-map-title'; title.textContent = 'Visualizador de Fluxos (BPMN.io - Arvore de Decisao)';
    const sub = document.createElement('div'); sub.className = 'atp-map-sub'; sub.textContent = 'Cada decisao cria caixas pontilhadas por ramo, com leitura da esquerda para direita e de cima para baixo. Clique em um item para destacar impacto de 1 nivel.';
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

    const st = { data, viewer: null, xml: '', filename: '', zoom: 1, chainIds: new Set(), chainMarkerBackup: new Map(), impactBound: false, lastElementClickTs: 0 };
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

        if (bType === 'bpmn:SequenceFlow') {
          addChainMarker(el.id);
          if (bo.sourceRef && bo.sourceRef.id) addChainMarker(String(bo.sourceRef.id));
          if (bo.targetRef && bo.targetRef.id) addChainMarker(String(bo.targetRef.id));
          return;
        }

        const incoming = Array.from((bo && bo.incoming) || []);
        const outgoing = Array.from((bo && bo.outgoing) || []);
        const isFlowNode = !!(bo && typeof bo.$instanceOf === 'function' && bo.$instanceOf('bpmn:FlowNode'));
        if (!isFlowNode && !incoming.length && !outgoing.length) return;

        addChainMarker(el.id);
        for (const f of incoming) {
          const fid = String(f && f.id || '');
          const sid = String(f && f.sourceRef && f.sourceRef.id || '');
          if (fid) addChainMarker(fid);
          if (sid) addChainMarker(sid);
        }
        for (const f of outgoing) {
          const fid = String(f && f.id || '');
          const tid = String(f && f.targetRef && f.targetRef.id || '');
          if (fid) addChainMarker(fid);
          if (tid) addChainMarker(tid);
        }
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
    const importXml = (xml) => ensureViewer().then((BpmnJS) => {
      if (!st.viewer) {
        st.viewer = new BpmnJS({ container: canvas, keyboard: { bindTo: overlay } });
        overlay._atpBpmnIoViewer = st.viewer;
        bindImpactHandlers();
      }
      clearChainSelection();
      return st.viewer.importXML(xml).then(() => { const cv = st.viewer.get('canvas'); cv.zoom('fit-viewport'); setZoom(cv.zoom()); });
    });
    const render = () => {
      const idx = parseInt(String(sel.value || '0'), 10);
      const i = Number.isFinite(idx) ? Math.max(0, Math.min(idx, fluxos.length - 1)) : 0;
      sel.value = String(i); sub.textContent = 'Gerando BPMN...';
      try {
        const b = buildBpmnFromFlow(st.data, i);
        st.xml = b.xml; st.filename = b.filename;
        sub.textContent = `Fluxo ${String(i + 1).padStart(2, '0')} renderizado em arvore com ${b.pathsCount} caminho(s)/pool(s) virtual(is).`;
        importXml(st.xml).catch((e) => { try { console.warn(LOG, 'Falha ao importar XML:', e); } catch (_) {} sub.textContent = 'Falha ao renderizar no bpmn.io (bloqueio de rede/CSP).'; });
      } catch (e) { try { console.warn(LOG, 'Falha ao montar BPMN:', e); } catch (_) {} sub.textContent = 'Falha ao gerar BPMN do fluxo selecionado.'; }
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
    if (host.querySelector('#' + BTN_ID)) return;
    const btn = document.createElement('button');
    btn.type = 'button'; btn.id = BTN_ID; btn.className = 'infraButton';
    btn.textContent = 'Visualizar Fluxos (Arvore BPMN.io)'; btn.style.marginLeft = '8px';
    btn.addEventListener('click', openModal);
    const anchor = host.querySelector('#btnExtratoFluxosATP');
    const dash = host.querySelector('#btnDashboardUsoATP');
    if (anchor && anchor.parentNode === host) { host.insertBefore(btn, anchor.nextSibling); return; }
    if (dash && dash.parentNode === host) { host.insertBefore(btn, dash); return; }
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

