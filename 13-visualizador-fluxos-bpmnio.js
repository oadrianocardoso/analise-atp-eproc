try { console.log('[ATP][LOAD] 13-visualizador-fluxos-bpmnio.js carregado com sucesso'); } catch (e) { }

(function () {
  'use strict';

  const LOG_PREFIX = '[ATP][BPMNIO]';
  const BTN_ID = 'btnVisualizarFluxosBpmnIoATP';
  const MODAL_ID = 'atpFluxoBpmnIoModal';
  const SELECT_ID = 'atpSelFluxoBpmnIo';
  const VIEWER_SRC = 'https://unpkg.com/bpmn-js@18.1.1/dist/bpmn-navigated-viewer.development.js';
  const VIEWER_PROMISE_KEY = '__ATP_BPMNIO_VIEWER_PROMISE__';
  const VIEWER_CSS = [
    'https://unpkg.com/bpmn-js@18.1.1/dist/assets/diagram-js.css',
    'https://unpkg.com/bpmn-js@18.1.1/dist/assets/bpmn-js.css',
    'https://unpkg.com/bpmn-js@18.1.1/dist/assets/bpmn-font/css/bpmn.css'
  ];
  const MAX_PATHS_PER_FLOW = 160;
  const MAX_DEPTH_PER_PATH = 120;

  let ATP_BPMNIO_VIEWER_PROMISE = null;

  function txt(v) {
    return String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  }

  function xmlEsc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function hashStr(v) {
    const s = String(v == null ? '' : v);
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = ((h << 5) - h) + s.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h).toString(36);
  }

  function ensureCss(urls) {
    const list = Array.isArray(urls) ? urls : [];
    for (const href of list) {
      if (!href) continue;
      try {
        const already = document.querySelector(`link[data-atp-bpmnio-css="${href}"]`) ||
          document.querySelector(`link[href="${href}"]`);
        if (already) continue;
        const l = document.createElement('link');
        l.rel = 'stylesheet';
        l.href = href;
        l.setAttribute('data-atp-bpmnio-css', href);
        document.head.appendChild(l);
      } catch (e) {
        try { console.warn(LOG_PREFIX, 'Falha ao injetar CSS do bpmn.io:', href, e); } catch (_) { }
      }
    }
  }

  function ensureBpmnIoViewerLoaded() {
    if (window.BpmnJS && window.BpmnJS.prototype && window.BpmnJS.prototype.__ATP_BPMNIO_NAV__) {
      return Promise.resolve(window.BpmnJS);
    }
    try {
      const gp = window[VIEWER_PROMISE_KEY];
      if (gp && typeof gp.then === 'function') return gp;
    } catch (_) { }
    if (ATP_BPMNIO_VIEWER_PROMISE) return ATP_BPMNIO_VIEWER_PROMISE;

    ATP_BPMNIO_VIEWER_PROMISE = new Promise((resolve, reject) => {
      try {
        ensureCss(VIEWER_CSS);

        const done = () => {
          if (!window.BpmnJS) {
            reject(new Error('BpmnJS indisponivel apos carregamento.'));
            return;
          }
          try { window.BpmnJS.prototype.__ATP_BPMNIO_NAV__ = true; } catch (_) { }
          resolve(window.BpmnJS);
        };

        const existing = document.querySelector('script[data-atp-bpmnio-viewer="1"]') ||
          document.querySelector('script[src*="bpmn-navigated-viewer.development.js"]');
        if (existing) {
          if (window.BpmnJS) { done(); return; }
          existing.addEventListener('load', done, { once: true });
          existing.addEventListener('error', (e) => reject(e || new Error('Falha ao carregar bpmn.io viewer.')), { once: true });
          return;
        }

        const s = document.createElement('script');
        s.src = VIEWER_SRC;
        s.async = true;
        s.setAttribute('data-atp-bpmnio-viewer', '1');
        s.onload = done;
        s.onerror = (e) => reject(e || new Error('Falha ao carregar bpmn.io viewer.'));
        document.head.appendChild(s);
      } catch (e) {
        reject(e);
      }
    }).catch((e) => {
      const failed = ATP_BPMNIO_VIEWER_PROMISE;
      ATP_BPMNIO_VIEWER_PROMISE = null;
      try {
        if (window[VIEWER_PROMISE_KEY] === failed) delete window[VIEWER_PROMISE_KEY];
      } catch (_) { }
      throw e;
    });

    try { window[VIEWER_PROMISE_KEY] = ATP_BPMNIO_VIEWER_PROMISE; } catch (_) { }
    return ATP_BPMNIO_VIEWER_PROMISE;
  }

  function getRulesSnapshot() {
    let rules = [];
    try {
      if (typeof window.atpGetLastRules === 'function') {
        const r = window.atpGetLastRules();
        if (Array.isArray(r)) rules = r;
      }
    } catch (_) { }

    if (!rules.length && Array.isArray(window.__ATP_LAST_RULES__)) {
      rules = window.__ATP_LAST_RULES__;
    }

    if (!rules.length) {
      try {
        const table = (typeof findTable === 'function')
          ? findTable()
          : document.getElementById(window.ATP_TABLE_ID || 'tableAutomatizacaoLocalizadores');
        if (table && typeof ensureColumns === 'function' && typeof mapColumns === 'function' && typeof parseRules === 'function') {
          try { ensureColumns(table); } catch (_) { }
          let cols = null;
          try { cols = mapColumns(table); } catch (_) { cols = null; }
          rules = parseRules(table, cols || {});
          if (typeof window.atpSetLastRules === 'function') window.atpSetLastRules(rules);
          else window.__ATP_LAST_RULES__ = Array.isArray(rules) ? rules : [];
        }
      } catch (e) {
        try { console.warn(LOG_PREFIX, 'Falha ao reconstruir rules para visualizador:', e); } catch (_) { }
      }
    }

    return Array.isArray(rules) ? rules : [];
  }

  function toMapMaybe(v) {
    if (v instanceof Map) return v;
    const m = new Map();
    if (!v || typeof v !== 'object') return m;
    for (const k of Object.keys(v)) {
      const arr = Array.isArray(v[k]) ? v[k] : [];
      m.set(k, arr);
    }
    return m;
  }

  function getFluxosDataForRules(rules) {
    let data = null;
    try {
      if (window.ATP && window.ATP.extract && typeof window.ATP.extract.getFluxosData === 'function') {
        data = window.ATP.extract.getFluxosData(rules || []);
      }
    } catch (e) {
      try { console.warn(LOG_PREFIX, 'Falha em ATP.extract.getFluxosData:', e); } catch (_) { }
    }

    if (!data) {
      try {
        if (typeof atpComputeFluxosData === 'function') data = atpComputeFluxosData(rules || []);
      } catch (e) {
        try { console.warn(LOG_PREFIX, 'Falha em atpComputeFluxosData:', e); } catch (_) { }
      }
    }

    if (!data || typeof data !== 'object') data = {};
    if (!Array.isArray(data.fluxos)) data.fluxos = [];
    data.byFrom = toMapMaybe(data.byFrom);
    return data;
  }

  function ruleNum(r) {
    const n = Number(r && r.num);
    if (Number.isFinite(n)) return String(n);
    return txt(r && r.num || '');
  }

  function edgeComparator(a, b) {
    const an = Number(ruleNum(a && a.rule));
    const bn = Number(ruleNum(b && b.rule));
    const af = Number.isFinite(an), bf = Number.isFinite(bn);
    if (af && bf && an !== bn) return an - bn;
    if (af && !bf) return -1;
    if (!af && bf) return 1;
    const at = txt(a && a.to || '');
    const bt = txt(b && b.to || '');
    return at.localeCompare(bt, 'pt-BR');
  }

  function buildFlowGraph(flow, byFrom) {
    const nodes = Array.isArray(flow && flow.nodes) ? flow.nodes.map(txt).filter(Boolean) : [];
    const nodeSet = new Set(nodes);
    const out = new Map();
    const inDegree = new Map();

    for (const n of nodeSet) {
      out.set(n, []);
      inDegree.set(n, 0);
    }

    for (const from of nodeSet) {
      const items = Array.isArray(byFrom.get(from)) ? byFrom.get(from) : [];
      for (const item of items) {
        const dests = Array.isArray(item && item.toKeys) ? item.toKeys : [];
        for (const toRaw of dests) {
          const to = txt(toRaw);
          if (!to || !nodeSet.has(to)) continue;
          const edge = {
            from,
            to,
            rule: item && item.rule ? item.rule : null,
            implied: !!(item && item.__implied),
            impliedLabel: txt(item && item.__label || '')
          };
          out.get(from).push(edge);
          inDegree.set(to, (inDegree.get(to) || 0) + 1);
        }
      }
      out.get(from).sort(edgeComparator);
    }

    return { nodeSet, out, inDegree };
  }

  function ruleCondText(rule) {
    if (!rule || typeof rule !== 'object') return '';
    const parts = [];
    const tipo = txt(rule.tipoControleCriterio && rule.tipoControleCriterio.canonical
      ? rule.tipoControleCriterio.canonical
      : (rule.tipoControleCriterio || rule.tipoControle || ''));
    if (tipo) parts.push(tipo);

    let outros = '';
    try {
      if (typeof atpHumanizeOutrosCriteriosExpr === 'function') {
        outros = txt(atpHumanizeOutrosCriteriosExpr(rule.outrosCriterios));
      } else {
        outros = txt(rule.outrosCriterios && rule.outrosCriterios.canonical || '');
      }
    } catch (_) { }
    if (outros) parts.push('Outros Critérios: ' + outros);

    return parts.join(' E ');
  }

  function ruleActionText(rule) {
    const arr = (rule && rule.localizadorIncluirAcao && rule.localizadorIncluirAcao.acoes) || [];
    if (!Array.isArray(arr) || !arr.length) return '';
    const labels = arr
      .map((a) => txt(a && a.acao || ''))
      .filter(Boolean);
    return labels.join(' | ');
  }

  function enumerateFlowPaths(flow, graph) {
    const nodeSet = graph.nodeSet;
    const startsRaw = Array.isArray(flow && flow.starts) ? flow.starts : [];
    const starts = startsRaw.map(txt).filter((n) => nodeSet.has(n));

    const fallback = Array.from(nodeSet)
      .filter((n) => (graph.inDegree.get(n) || 0) === 0)
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const seeds = starts.length ? starts : (fallback.length ? fallback : (nodeSet.size ? [Array.from(nodeSet)[0]] : []));

    const paths = [];
    const signatures = new Set();

    const pushPath = (tokens, meta) => {
      const sig = tokens.map((t) => {
        if (t.type === 'locator') return 'L:' + txt(t.key);
        if (t.type === 'rule') return 'R:' + txt(t.ruleNum || '?') + ':' + txt(t.from) + '>' + txt(t.to);
        if (t.type === 'cycle') return 'C:' + txt(t.target);
        if (t.type === 'cutoff') return 'X';
        return '?';
      }).join('|');
      if (signatures.has(sig)) return;
      signatures.add(sig);
      paths.push({ tokens, meta: meta || {} });
    };

    const dfs = (node, tokens, visited, depth) => {
      if (paths.length >= MAX_PATHS_PER_FLOW) return;

      const outs = graph.out.get(node) || [];
      if (!outs.length) {
        pushPath(tokens, { terminal: true });
        return;
      }
      if (depth >= MAX_DEPTH_PER_PATH) {
        pushPath(tokens.concat([{ type: 'cutoff' }]), { cutoff: true });
        return;
      }

      for (const edge of outs) {
        const rt = {
          type: 'rule',
          ruleNum: ruleNum(edge.rule),
          from: edge.from,
          to: edge.to,
          implied: !!edge.implied,
          impliedLabel: txt(edge.impliedLabel || ''),
          condText: ruleCondText(edge.rule),
          actionText: ruleActionText(edge.rule)
        };

        if (visited.has(edge.to)) {
          pushPath(tokens.concat([rt, { type: 'cycle', target: edge.to }]), { cycle: true });
          continue;
        }

        const nextVisited = new Set(visited);
        nextVisited.add(edge.to);
        const nextTokens = tokens.concat([rt, { type: 'locator', key: edge.to }]);
        dfs(edge.to, nextTokens, nextVisited, depth + 1);
        if (paths.length >= MAX_PATHS_PER_FLOW) break;
      }
    };

    for (const seed of seeds) {
      dfs(seed, [{ type: 'locator', key: seed }], new Set([seed]), 0);
      if (paths.length >= MAX_PATHS_PER_FLOW) break;
    }

    if (!paths.length && seeds.length) {
      for (const seed of seeds) pushPath([{ type: 'locator', key: seed }], { terminal: true });
    }

    return paths;
  }

  function dimsByType(type) {
    if (type === 'startEvent' || type === 'endEvent') return { w: 36, h: 36 };
    if (type === 'serviceTask') return { w: 280, h: 90 };
    return { w: 220, h: 74 };
  }

  function buildLaneModels(paths, flowIdx) {
    const lanes = [];
    let seq = 0;
    const nextId = (prefix, laneNo) => `${prefix}_${String(flowIdx + 1).padStart(2, '0')}_${String(laneNo + 1).padStart(2, '0')}_${++seq}`;

    paths.forEach((path, laneNo) => {
      const laneId = nextId('Lane', laneNo);
      const laneName = `Caminho ${String(laneNo + 1).padStart(2, '0')}`;
      const elements = [];
      const seqFlows = [];
      const flowNodeRefs = [];

      const pushEl = (type, name, doc) => {
        const id = nextId(type, laneNo);
        elements.push({ id, type, name: txt(name), doc: txt(doc) });
        flowNodeRefs.push(id);
        return id;
      };
      const pushFlow = (from, to, name) => {
        seqFlows.push({ id: nextId('Flow', laneNo), from, to, name: txt(name) });
      };

      const startId = pushEl('startEvent', 'Início', '');
      let prev = startId;

      const tokens = Array.isArray(path && path.tokens) ? path.tokens : [];
      for (const token of tokens) {
        if (token.type === 'locator') {
          const key = txt(token.key);
          const id = pushEl('task', `Localizador: ${key}`, '');
          pushFlow(prev, id, '');
          prev = id;
          continue;
        }
        if (token.type === 'rule') {
          const n = txt(token.ruleNum || '');
          const title = n ? `REGRA ${n}` : (token.impliedLabel || 'Regra de Continuidade');
          const docs = [
            token.from ? ('REMOVER: ' + txt(token.from)) : '',
            token.to ? ('INCLUIR: ' + txt(token.to)) : '',
            token.condText ? ('SE: ' + txt(token.condText)) : '',
            token.actionText ? ('AÇÃO: ' + txt(token.actionText)) : ''
          ].filter(Boolean).join(' | ');
          const id = pushEl('serviceTask', title, docs);
          pushFlow(prev, id, '');
          prev = id;
          continue;
        }
        if (token.type === 'cycle') {
          const id = pushEl('task', `CICLO para: ${txt(token.target)}`, 'Fluxo interrompido para evitar repetição infinita.');
          pushFlow(prev, id, 'ciclo');
          prev = id;
          continue;
        }
        if (token.type === 'cutoff') {
          const id = pushEl('task', 'TRUNCADO (limite de profundidade)', 'Fluxo interrompido por segurança de visualização.');
          pushFlow(prev, id, 'limite');
          prev = id;
        }
      }

      const endId = pushEl('endEvent', 'Fim', '');
      pushFlow(prev, endId, '');

      lanes.push({
        laneId,
        laneName,
        elements,
        seqFlows,
        flowNodeRefs,
        pathMeta: (path && path.meta) || {}
      });
    });

    return lanes;
  }

  function layoutLaneModels(lanes) {
    const laneX = 70;
    const laneY0 = 70;
    const laneH = 220;
    const laneGap = 24;
    const nodeStepX = 300;
    const nodeX0 = laneX + 130;

    const maxEls = Math.max(1, ...lanes.map((l) => (l.elements || []).length));
    const laneW = Math.max(1100, 300 + (maxEls * nodeStepX));
    const laneBounds = new Map();
    const nodeBounds = new Map();
    const edgeWaypoints = new Map();

    lanes.forEach((lane, i) => {
      const y = laneY0 + i * (laneH + laneGap);
      laneBounds.set(lane.laneId, { x: laneX, y, w: laneW, h: laneH });

      const centerY = y + Math.round(laneH / 2);
      lane.elements.forEach((el, idx) => {
        const d = dimsByType(el.type);
        const cx = nodeX0 + idx * nodeStepX;
        nodeBounds.set(el.id, {
          x: Math.round(cx - d.w / 2),
          y: Math.round(centerY - d.h / 2),
          w: d.w,
          h: d.h
        });
      });

      lane.seqFlows.forEach((sf) => {
        const sb = nodeBounds.get(sf.from);
        const tb = nodeBounds.get(sf.to);
        if (!sb || !tb) return;
        const yMid = Math.round(sb.y + (sb.h / 2));
        const p1 = { x: Math.round(sb.x + sb.w), y: yMid };
        const p2 = { x: Math.round(tb.x), y: Math.round(tb.y + (tb.h / 2)) };
        edgeWaypoints.set(sf.id, [p1, p2]);
      });
    });

    return {
      laneBounds,
      nodeBounds,
      edgeWaypoints,
      width: laneX + laneW + 70,
      height: laneY0 + (lanes.length * laneH) + (Math.max(0, lanes.length - 1) * laneGap) + 80
    };
  }

  function buildBpmnFromFlow(data, flowIdx) {
    const fluxos = Array.isArray(data && data.fluxos) ? data.fluxos : [];
    const flow = fluxos[flowIdx];
    if (!flow) throw new Error('Fluxo selecionado não existe.');

    const byFrom = toMapMaybe(data && data.byFrom);
    const graph = buildFlowGraph(flow, byFrom);
    const paths = enumerateFlowPaths(flow, graph);
    if (!paths.length) throw new Error('Fluxo sem caminhos visualizaveis.');
    const lanes = buildLaneModels(paths, flowIdx);
    const layout = layoutLaneModels(lanes);

    const processId = `Process_ATP_Fluxo_${String(flowIdx + 1).padStart(2, '0')}_${hashStr(JSON.stringify(flow || {}))}`;
    const laneSetId = `LaneSet_${hashStr(processId)}`;

    const lines = [];
    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push('<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"');
    lines.push('  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"');
    lines.push('  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"');
    lines.push('  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"');
    lines.push('  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"');
    lines.push(`  id="Defs_${hashStr(processId)}"`);
    lines.push(`  targetNamespace="http://atp.eproc/fluxos/${hashStr(processId)}">`);
    lines.push(`  <bpmn:process id="${processId}" isExecutable="false">`);
    lines.push(`    <bpmn:laneSet id="${laneSetId}">`);
    for (const lane of lanes) {
      lines.push(`      <bpmn:lane id="${lane.laneId}" name="${xmlEsc(lane.laneName)}">`);
      for (const ref of lane.flowNodeRefs) lines.push(`        <bpmn:flowNodeRef>${ref}</bpmn:flowNodeRef>`);
      lines.push('      </bpmn:lane>');
    }
    lines.push('    </bpmn:laneSet>');

    for (const lane of lanes) {
      for (const el of lane.elements) {
        if (el.type === 'startEvent') {
          lines.push(`    <bpmn:startEvent id="${el.id}" name="${xmlEsc(el.name)}" />`);
        } else if (el.type === 'endEvent') {
          lines.push(`    <bpmn:endEvent id="${el.id}" name="${xmlEsc(el.name)}" />`);
        } else if (el.type === 'serviceTask') {
          lines.push(`    <bpmn:serviceTask id="${el.id}" name="${xmlEsc(el.name)}">`);
          if (el.doc) lines.push(`      <bpmn:documentation>${xmlEsc(el.doc)}</bpmn:documentation>`);
          lines.push('    </bpmn:serviceTask>');
        } else {
          lines.push(`    <bpmn:task id="${el.id}" name="${xmlEsc(el.name)}" />`);
        }
      }
      for (const sf of lane.seqFlows) {
        const nm = sf.name ? ` name="${xmlEsc(sf.name)}"` : '';
        lines.push(`    <bpmn:sequenceFlow id="${sf.id}" sourceRef="${sf.from}" targetRef="${sf.to}"${nm} />`);
      }
    }

    lines.push('  </bpmn:process>');
    lines.push(`  <bpmndi:BPMNDiagram id="BPMNDiagram_${processId}">`);
    lines.push(`    <bpmndi:BPMNPlane id="BPMNPlane_${processId}" bpmnElement="${processId}">`);

    for (const lane of lanes) {
      const lb = layout.laneBounds.get(lane.laneId);
      if (!lb) continue;
      lines.push(`      <bpmndi:BPMNShape id="DI_${lane.laneId}" bpmnElement="${lane.laneId}" isHorizontal="true">`);
      lines.push(`        <dc:Bounds x="${lb.x}" y="${lb.y}" width="${lb.w}" height="${lb.h}" />`);
      lines.push('      </bpmndi:BPMNShape>');
    }

    for (const lane of lanes) {
      for (const el of lane.elements) {
        const b = layout.nodeBounds.get(el.id);
        if (!b) continue;
        lines.push(`      <bpmndi:BPMNShape id="DI_${el.id}" bpmnElement="${el.id}">`);
        lines.push(`        <dc:Bounds x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" />`);
        lines.push('      </bpmndi:BPMNShape>');
      }
    }

    for (const lane of lanes) {
      for (const sf of lane.seqFlows) {
        const wps = layout.edgeWaypoints.get(sf.id) || [];
        lines.push(`      <bpmndi:BPMNEdge id="DI_${sf.id}" bpmnElement="${sf.id}">`);
        for (const p of wps) {
          lines.push(`        <di:waypoint x="${Math.round(Number(p.x) || 0)}" y="${Math.round(Number(p.y) || 0)}" />`);
        }
        lines.push('      </bpmndi:BPMNEdge>');
      }
    }

    lines.push('    </bpmndi:BPMNPlane>');
    lines.push('  </bpmndi:BPMNDiagram>');
    lines.push('</bpmn:definitions>');

    const starts = Array.isArray(flow.starts) ? flow.starts.map(txt).filter(Boolean) : [];
    const safeStart = txt(starts[0] || 'inicio').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'inicio';
    const fileName = `fluxo_${String(flowIdx + 1).padStart(2, '0')}_${safeStart}_swimlanes.bpmn`;
    return { xml: lines.join('\n'), filename: fileName, pathsCount: lanes.length, diagram: { w: layout.width, h: layout.height } };
  }

  function closeModal() {
    const el = document.getElementById(MODAL_ID);
    if (!el) return;
    try {
      const viewer = el._atpBpmnIoViewer;
      if (viewer && typeof viewer.destroy === 'function') viewer.destroy();
    } catch (_) { }
    try { el.remove(); } catch (_) { }
  }

  function buildFlowLabel(flow, idx) {
    try {
      if (window.ATP && window.ATP.extract && typeof window.ATP.extract.buildFluxoOptionLabel === 'function') {
        return window.ATP.extract.buildFluxoOptionLabel(flow, idx);
      }
    } catch (_) { }
    const starts = (flow && Array.isArray(flow.starts) && flow.starts.length) ? flow.starts.join(' | ') : '(sem início)';
    const nodesN = (flow && Array.isArray(flow.nodes)) ? flow.nodes.length : 0;
    return `Fluxo ${String((idx | 0) + 1).padStart(2, '0')} - Inicio(s): [${starts}] - Nos: ${nodesN}`;
  }

  function openModal() {
    const rules = getRulesSnapshot();
    if (!rules.length) {
      alert('Nao foi possivel obter as regras da tabela para montar o fluxo.');
      return;
    }

    const data = getFluxosDataForRules(rules);
    const fluxos = Array.isArray(data.fluxos) ? data.fluxos : [];
    if (!fluxos.length) {
      alert('Nenhum fluxo detectado para visualizar.');
      return;
    }

    closeModal();

    const overlay = document.createElement('div');
    overlay.id = MODAL_ID;
    overlay.className = 'atp-map-overlay';
    overlay.addEventListener('click', (ev) => { if (ev.target === overlay) closeModal(); });

    const box = document.createElement('div');
    box.className = 'atp-map-box';

    const top = document.createElement('div');
    top.className = 'atp-map-top';

    const titleWrap = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'atp-map-title';
    title.textContent = 'Visualizador de Fluxos (BPMN.io / Swimlanes)';
    const subtitle = document.createElement('div');
    subtitle.className = 'atp-map-sub';
    subtitle.textContent = 'Cada caminho independente em sua propria raia (sem mistura de caminhos).';
    titleWrap.appendChild(title);
    titleWrap.appendChild(subtitle);

    const actions = document.createElement('div');
    actions.className = 'atp-map-actions';

    const sel = document.createElement('select');
    sel.id = SELECT_ID;
    sel.className = 'infraSelect';
    sel.style.minWidth = '460px';
    fluxos.forEach((fl, idx) => {
      const opt = document.createElement('option');
      opt.value = String(idx);
      opt.textContent = buildFlowLabel(fl, idx);
      sel.appendChild(opt);
    });

    const btnRender = document.createElement('button');
    btnRender.type = 'button';
    btnRender.className = 'atp-map-btn';
    btnRender.textContent = 'Renderizar';

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

    const btnDownload = document.createElement('button');
    btnDownload.type = 'button';
    btnDownload.className = 'atp-map-btn';
    btnDownload.textContent = 'Baixar BPMN';

    const btnClose = document.createElement('button');
    btnClose.type = 'button';
    btnClose.className = 'atp-map-btn';
    btnClose.textContent = 'Fechar';
    btnClose.addEventListener('click', closeModal);

    actions.appendChild(sel);
    actions.appendChild(btnRender);
    actions.appendChild(btnZoomOut);
    actions.appendChild(zoomLabel);
    actions.appendChild(btnZoomIn);
    actions.appendChild(btnFit);
    actions.appendChild(btnDownload);
    actions.appendChild(btnClose);

    top.appendChild(titleWrap);
    top.appendChild(actions);

    const body = document.createElement('div');
    body.className = 'atp-map-body';

    const canvas = document.createElement('div');
    canvas.className = 'atp-map-canvas';
    body.appendChild(canvas);

    box.appendChild(top);
    box.appendChild(body);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const state = {
      data,
      viewer: null,
      xml: '',
      filename: '',
      zoom: 1
    };

    const setZoomLabel = (v) => {
      const n = Number(v);
      if (!Number.isFinite(n)) return;
      state.zoom = n;
      zoomLabel.textContent = Math.round(n * 100) + '%';
    };

    const importXml = (xml) => {
      return ensureBpmnIoViewerLoaded().then((BpmnJS) => {
        if (!state.viewer) {
          state.viewer = new BpmnJS({ container: canvas });
          overlay._atpBpmnIoViewer = state.viewer;
        }
        return state.viewer.importXML(xml).then(() => {
          const cv = state.viewer.get('canvas');
          cv.zoom('fit-viewport');
          setZoomLabel(cv.zoom());
        });
      });
    };

    const renderSelected = () => {
      const idx = parseInt(String(sel.value || '0'), 10);
      const safeIdx = Number.isFinite(idx) ? Math.max(0, Math.min(idx, fluxos.length - 1)) : 0;
      sel.value = String(safeIdx);
      subtitle.textContent = 'Gerando BPMN...';
      try {
        const built = buildBpmnFromFlow(state.data, safeIdx);
        state.xml = built.xml;
        state.filename = built.filename;
        subtitle.textContent = `Fluxo ${String(safeIdx + 1).padStart(2, '0')} renderizado com ${built.pathsCount} caminho(s)/raia(s).`;
        importXml(state.xml).catch((e) => {
          try { console.warn(LOG_PREFIX, 'Falha ao importar XML no bpmn.io:', e); } catch (_) { }
          subtitle.textContent = 'Falha ao renderizar no bpmn.io (verifique bloqueio de rede/CSP).';
        });
      } catch (e) {
        try { console.warn(LOG_PREFIX, 'Falha ao montar BPMN do fluxo:', e); } catch (_) { }
        subtitle.textContent = 'Falha ao gerar BPMN do fluxo selecionado.';
      }
    };

    btnRender.addEventListener('click', renderSelected);
    sel.addEventListener('change', renderSelected);

    btnDownload.addEventListener('click', () => {
      try {
        if (!state.xml) return;
        const blob = new Blob([state.xml], { type: 'application/xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = state.filename || 'fluxo_swimlanes.bpmn';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          try { URL.revokeObjectURL(url); } catch (_) { }
          try { a.remove(); } catch (_) { }
        }, 0);
      } catch (e) {
        try { console.warn(LOG_PREFIX, 'Falha ao baixar BPMN gerado:', e); } catch (_) { }
      }
    });

    const setZoom = (target) => {
      if (!state.viewer) return;
      try {
        const canvasApi = state.viewer.get('canvas');
        const z = Math.max(0.2, Math.min(3, target));
        canvasApi.zoom(z);
        setZoomLabel(canvasApi.zoom());
      } catch (_) { }
    };

    btnZoomIn.addEventListener('click', () => setZoom((state.zoom || 1) + 0.1));
    btnZoomOut.addEventListener('click', () => setZoom((state.zoom || 1) - 0.1));
    btnFit.addEventListener('click', () => {
      if (!state.viewer) return;
      try {
        const canvasApi = state.viewer.get('canvas');
        canvasApi.zoom('fit-viewport');
        setZoomLabel(canvasApi.zoom());
      } catch (_) { }
    });

    renderSelected();
  }

  function ensureViewerButton() {
    const host = document.getElementById('dvFiltrosOpcionais');
    if (!host) return;
    if (host.querySelector('#' + BTN_ID)) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = BTN_ID;
    btn.className = 'infraButton';
    btn.textContent = '🧭 Visualizar Fluxos (BPMN.io)';
    btn.style.marginLeft = '8px';
    btn.addEventListener('click', openModal);

    const anchor = host.querySelector('#btnExtratoFluxosATP');
    const dashboard = host.querySelector('#btnDashboardUsoATP');

    if (anchor && anchor.parentNode === host) {
      host.insertBefore(btn, anchor.nextSibling);
      return;
    }
    if (dashboard && dashboard.parentNode === host) {
      host.insertBefore(btn, dashboard);
      return;
    }
    host.appendChild(btn);
  }

  function boot() {
    ensureViewerButton();
    try {
      const mo = new MutationObserver(() => ensureViewerButton());
      mo.observe(document.body, { childList: true, subtree: true });
    } catch (_) { }
  }

  try { window.atpEnsureFluxosBpmnIoButton = ensureViewerButton; } catch (_) { }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  try { console.log('[ATP][OK] 13-visualizador-fluxos-bpmnio.js inicializado'); } catch (e) { }
})();
;
