try { console.log('[ATP][LOAD] 13-visualizador-fluxos-bpmnio.js carregado com sucesso'); } catch (e) {}
(function () {
  'use strict';

  const LOG = '[ATP][BPMNIO]';
  const BTN_ID = 'btnVisualizarFluxosBpmnIoATP';
  const MODAL_ID = 'atpFluxoBpmnIoModal';
  const SEL_ID = 'atpSelFluxoBpmnIo';
  const SRC = 'https://unpkg.com/bpmn-js@18.1.1/dist/bpmn-navigated-viewer.development.js';
  const PROM_KEY = '__ATP_BPMNIO_VIEWER_PROMISE__';
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
    if (window.BpmnJS && window.BpmnJS.prototype && window.BpmnJS.prototype.__ATP_BPMNIO_NAV__) return Promise.resolve(window.BpmnJS);
    try { const gp = window[PROM_KEY]; if (gp && typeof gp.then === 'function') return gp; } catch (_) {}
    if (PROM) return PROM;
    PROM = new Promise((resolve, reject) => {
      try {
        ensureCss();
        const done = () => {
          if (!window.BpmnJS) { reject(new Error('BpmnJS indisponivel')); return; }
          try { window.BpmnJS.prototype.__ATP_BPMNIO_NAV__ = true; } catch (_) {}
          resolve(window.BpmnJS);
        };
        const ex = document.querySelector('script[data-atp-bpmnio-viewer="1"]') || document.querySelector('script[src*="bpmn-navigated-viewer.development.js"]');
        if (ex) {
          if (window.BpmnJS) { done(); return; }
          ex.addEventListener('load', done, { once: true });
          ex.addEventListener('error', (e) => reject(e || new Error('Falha ao carregar bpmn.io')), { once: true });
          return;
        }
        const s = document.createElement('script');
        s.src = SRC; s.async = true; s.setAttribute('data-atp-bpmnio-viewer', '1');
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
    const laneCount = Math.max(1, paths.length);
    const lanes = paths.map((path, i) => ({ idx: i, laneId: nextId('Lane', i), laneName: `Pool Virtual ${String(i + 1).padStart(2, '0')}`, path, refs: [] }));

    let trieSeq = 0;
    const mkTrie = (tok, parent) => ({ id: 'tr_' + (++trieSeq), tok: tok || null, parent: parent || null, children: [], bySig: new Map(), leaf: new Set(), stage: null, lane: 0, gwId: '', gwStage: null, bpmnId: '', branch: '' });
    const root = mkTrie(null, null);
    for (let p = 0; p < paths.length; p++) {
      const path = paths[p]; let cur = root; cur.leaf.add(p);
      const toks = Array.isArray(path && path.tokens) ? path.tokens : [];
      for (const tok of toks) {
        const sg = tokenSig(tok); let ch = cur.bySig.get(sg);
        if (!ch) { ch = mkTrie(tok, cur); cur.bySig.set(sg, ch); cur.children.push(ch); }
        ch.leaf.add(p); cur = ch;
      }
    }

    const setStages = (node, stage) => {
      if (node !== root) node.stage = Number.isFinite(node.stage) ? Math.max(node.stage, stage) : stage;
      const ch = node.children || []; if (!ch.length) return;
      if (node !== root && ch.length > 1) { node.gwStage = (node.stage || stage) + 1; for (const c of ch) setStages(c, node.gwStage + 1); return; }
      const nx = (node === root) ? (ch.length > 1 ? 2 : 1) : ((node.stage || stage) + 1);
      for (const c of ch) setStages(c, nx);
    };
    for (const c of (root.children || [])) setStages(c, (root.children || []).length > 1 ? 2 : 1);

    const nodes = [];
    const walk = [root];
    while (walk.length) {
      const cur = walk.shift();
      for (const c of (cur.children || [])) {
        const ls = sortNums(Array.from(c.leaf));
        c.lane = clamp(avg(ls, 0), 0, laneCount - 1);
        nodes.push(c); walk.push(c);
      }
    }

    const allLeaf = paths.map((_, i) => i);
    const startLane = clamp(avg(allLeaf, 0), 0, laneCount - 1);
    const els = [];
    const pushEl = (type, name, doc, lane, stage) => {
      const id = nextId(type, lane);
      els.push({ id, type, name: t(name || ''), doc: t(doc || ''), lane, stage });
      lanes[lane].refs.push(id);
      return id;
    };

    const startId = pushEl('startEvent', 'Inicio', '', startLane, 0);
    let rootGwId = '';
    if ((root.children || []).length > 1) rootGwId = pushEl('exclusiveGateway', 'Decisao', '', startLane, 1);

    for (const n of nodes) {
      const sp = tokenSpec(n.tok);
      n.bpmnId = pushEl(sp.type, sp.name, sp.doc, n.lane, Number.isFinite(n.stage) ? n.stage : 1);
      n.branch = sp.branch;
    }
    for (const n of nodes) {
      if ((n.children || []).length > 1) n.gwId = pushEl('exclusiveGateway', 'Decisao', '', n.lane, Number.isFinite(n.gwStage) ? n.gwStage : ((n.stage || 1) + 1));
    }

    const endIds = [];
    for (let i = 0; i < paths.length; i++) endIds[i] = pushEl('endEvent', 'Fim', '', i, null);

    const flows = [];
    const addF = (a, b, nm) => { if (!a || !b) return; flows.push({ id: nextId('Flow', 0), a, b, nm: t(nm || '') }); };
    if ((root.children || []).length) {
      if (rootGwId) {
        addF(startId, rootGwId, '');
        for (const c of root.children) addF(rootGwId, c.bpmnId, t(c.branch || ''));
      } else addF(startId, root.children[0].bpmnId, '');
    }
    for (const n of nodes) {
      const ch = n.children || [];
      if (!ch.length) {
        const li = sortNums(Array.from(n.leaf));
        const pick = li.length ? li[0] : 0;
        addF(n.bpmnId, endIds[Math.max(0, Math.min(pick, endIds.length - 1))], '');
      } else if (ch.length === 1) addF(n.bpmnId, ch[0].bpmnId, '');
      else {
        addF(n.bpmnId, n.gwId, '');
        for (const c of ch) addF(n.gwId, c.bpmnId, t(c.branch || ''));
      }
    }

    let maxStage = 0;
    for (const e of els) if (Number.isFinite(e.stage)) maxStage = Math.max(maxStage, e.stage);
    const endStage = maxStage + 1;
    for (const e of els) if (!Number.isFinite(e.stage)) e.stage = endStage;

    const laneX = 70, laneY0 = 70, laneH = 180, laneGap = 22, stageX0 = laneX + 170, stageStep = 250;
    const laneW = Math.max(1500, stageX0 + (endStage + 1) * stageStep + 120);
    const laneBounds = new Map();
    for (const ln of lanes) laneBounds.set(ln.laneId, { x: laneX, y: laneY0 + ln.idx * (laneH + laneGap), w: laneW, h: laneH });
    const cyLane = (idx) => Math.round((laneY0 + idx * (laneH + laneGap)) + laneH / 2);

    const bounds = new Map();
    for (const e of els) {
      const d = dims(e.type), cx = Math.round(stageX0 + e.stage * stageStep), cy = cyLane(clamp(e.lane, 0, laneCount - 1));
      bounds.set(e.id, { x: Math.round(cx - d.w / 2), y: Math.round(cy - d.h / 2), w: d.w, h: d.h });
    }
    const way = new Map();
    for (const f of flows) {
      const sb = bounds.get(f.a), tb = bounds.get(f.b); if (!sb || !tb) continue;
      const sx = Math.round(sb.x + sb.w), sy = Math.round(sb.y + sb.h / 2), tx = Math.round(tb.x), ty = Math.round(tb.y + tb.h / 2);
      if (Math.abs(sy - ty) <= 2) way.set(f.id, [{ x: sx, y: sy }, { x: tx, y: ty }]);
      else {
        const mx = Math.round((sx + tx) / 2);
        way.set(f.id, [{ x: sx, y: sy }, { x: mx, y: sy }, { x: mx, y: ty }, { x: tx, y: ty }]);
      }
    }

    const processId = `Process_ATP_Fluxo_${String(flowIdx + 1).padStart(2, '0')}_${hash(JSON.stringify(flow || {}))}`;
    const laneSetId = `LaneSet_${hash(processId)}`;
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
    x.push(`    <bpmn:laneSet id="${laneSetId}">`);
    for (const ln of lanes) {
      x.push(`      <bpmn:lane id="${ln.laneId}" name="${esc(ln.laneName)}">`);
      for (const r of ln.refs) x.push(`        <bpmn:flowNodeRef>${r}</bpmn:flowNodeRef>`);
      x.push('      </bpmn:lane>');
    }
    x.push('    </bpmn:laneSet>');
    for (const e of els) {
      if (e.type === 'startEvent') x.push(`    <bpmn:startEvent id="${e.id}" name="${esc(e.name)}" />`);
      else if (e.type === 'endEvent') x.push(`    <bpmn:endEvent id="${e.id}" name="${esc(e.name)}" />`);
      else if (e.type === 'serviceTask') {
        x.push(`    <bpmn:serviceTask id="${e.id}" name="${esc(e.name)}">`);
        if (e.doc) x.push(`      <bpmn:documentation>${esc(e.doc)}</bpmn:documentation>`);
        x.push('    </bpmn:serviceTask>');
      } else if (e.type === 'exclusiveGateway') x.push(`    <bpmn:exclusiveGateway id="${e.id}" name="${esc(e.name || 'Decisao')}" />`);
      else x.push(`    <bpmn:task id="${e.id}" name="${esc(e.name)}" />`);
    }
    for (const f of flows) {
      const nm = f.nm ? ` name="${esc(f.nm)}"` : '';
      x.push(`    <bpmn:sequenceFlow id="${f.id}" sourceRef="${f.a}" targetRef="${f.b}"${nm} />`);
    }
    x.push('  </bpmn:process>');
    x.push(`  <bpmndi:BPMNDiagram id="BPMNDiagram_${processId}">`);
    x.push(`    <bpmndi:BPMNPlane id="BPMNPlane_${processId}" bpmnElement="${processId}">`);
    for (const ln of lanes) {
      const b = laneBounds.get(ln.laneId); if (!b) continue;
      x.push(`      <bpmndi:BPMNShape id="DI_${ln.laneId}" bpmnElement="${ln.laneId}" isHorizontal="true">`);
      x.push(`        <dc:Bounds x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" />`);
      x.push('      </bpmndi:BPMNShape>');
    }
    for (const e of els) {
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
      filename: `fluxo_${String(flowIdx + 1).padStart(2, '0')}_${safe}_arvore_pool_virtual.bpmn`,
      pathsCount: paths.length
    };
  }

  function closeModal() {
    const el = document.getElementById(MODAL_ID);
    if (!el) return;
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
    const sub = document.createElement('div'); sub.className = 'atp-map-sub'; sub.textContent = 'Cada caminho vai para sua pool virtual (raia dedicada), sem mistura de nos entre caminhos.';
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

    const st = { data, viewer: null, xml: '', filename: '', zoom: 1 };
    const setZoom = (v) => { const n = Number(v); if (!Number.isFinite(n)) return; st.zoom = n; zoomLab.textContent = Math.round(n * 100) + '%'; };
    const importXml = (xml) => ensureViewer().then((BpmnJS) => {
      if (!st.viewer) { st.viewer = new BpmnJS({ container: canvas }); overlay._atpBpmnIoViewer = st.viewer; }
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
