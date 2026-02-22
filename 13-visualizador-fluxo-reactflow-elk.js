try { console.log('[ATP][LOAD] 13-visualizador-fluxo-reactflow-elk.js carregado com sucesso'); } catch (e) {}

(function () {
  'use strict';

  const LOG = '[ATP][RFLOW]';
  let ATP_RF_LIBS_PROMISE = null;

  function atpLoadScriptOnce(url, key) {
    return new Promise((resolve, reject) => {
      try {
        const found = document.querySelector(`script[data-atp-lib="${String(key || '')}"]`);
        if (found) {
          if (found.dataset.atpLoaded === '1') {
            resolve();
            return;
          }
          found.addEventListener('load', () => resolve(), { once: true });
          found.addEventListener('error', (ev) => reject(ev), { once: true });
          return;
        }

        const s = document.createElement('script');
        s.src = String(url || '');
        s.async = true;
        s.setAttribute('data-atp-lib', String(key || ''));
        s.onload = () => {
          try { s.dataset.atpLoaded = '1'; } catch (_) {}
          resolve();
        };
        s.onerror = (ev) => reject(ev);
        document.head.appendChild(s);
      } catch (e) {
        reject(e);
      }
    });
  }

  function atpEnsureReactFlowCss() {
    const cssUrls = [
      'https://unpkg.com/reactflow@11.11.4/dist/style.css'
    ];
    for (const href of cssUrls) {
      if (document.querySelector('link[data-atp-reactflow][href="' + href + '"]')) continue;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.setAttribute('data-atp-reactflow', '1');
      document.head.appendChild(link);
    }
  }

  function atpEnsureReactFlowElkLoaded() {
    if (window.React && window.ReactDOM && window.ReactFlow && window.ELK) {
      return Promise.resolve({
        React: window.React,
        ReactDOM: window.ReactDOM,
        ReactFlow: window.ReactFlow,
        ELK: window.ELK
      });
    }
    if (ATP_RF_LIBS_PROMISE) return ATP_RF_LIBS_PROMISE;

    atpEnsureReactFlowCss();
    ATP_RF_LIBS_PROMISE = Promise.resolve()
      .then(() => atpLoadScriptOnce('https://unpkg.com/react@18/umd/react.production.min.js', 'react-18'))
      .then(() => atpLoadScriptOnce('https://unpkg.com/react-dom@18/umd/react-dom.production.min.js', 'react-dom-18'))
      .then(() => atpLoadScriptOnce('https://unpkg.com/reactflow@11.11.4/dist/umd/index.js', 'reactflow-11'))
      .then(() => atpLoadScriptOnce('https://unpkg.com/elkjs@0.9.3/lib/elk.bundled.js', 'elk-093'))
      .then(() => {
        if (!window.React || !window.ReactDOM || !window.ReactFlow || !window.ELK) {
          throw new Error('Bibliotecas React Flow/ELK nao carregadas.');
        }
        return {
          React: window.React,
          ReactDOM: window.ReactDOM,
          ReactFlow: window.ReactFlow,
          ELK: window.ELK
        };
      });

    return ATP_RF_LIBS_PROMISE;
  }

  function atpRulePriorityNum(rule) {
    const n = rule && rule.prioridade && rule.prioridade.num;
    return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
  }

  function atpRulePriorityLabel(rule) {
    const n = atpRulePriorityNum(rule);
    if (Number.isFinite(n)) return String(n);
    const txt = clean((rule && rule.prioridade && (rule.prioridade.text || rule.prioridade.raw)) || '');
    return txt || '[*]';
  }

  function atpRuleNum(rule) {
    const n = Number(rule && rule.num);
    if (Number.isFinite(n)) return n;
    const p = parseInt(String(rule && rule.num || ''), 10);
    return Number.isFinite(p) ? p : Number.POSITIVE_INFINITY;
  }

  function atpRuleTipo(rule) {
    const canonical = clean((rule && rule.tipoControleCriterio && rule.tipoControleCriterio.canonical) || '');
    const raw = clean((rule && rule.tipoControleCriterio) || '');
    return canonical || raw || 'Sem criterio';
  }

  function atpShortText(v, max) {
    const s = String(v || '');
    const n = Math.max(10, Number(max) || 80);
    if (s.length <= n) return s;
    return s.slice(0, n - 3) + '...';
  }

  function atpSortFlowItems(a, b) {
    const aImplied = !!(a && a.__implied);
    const bImplied = !!(b && b.__implied);
    if (aImplied !== bImplied) return aImplied ? 1 : -1;

    const ar = a && a.rule ? a.rule : null;
    const br = b && b.rule ? b.rule : null;
    const pa = atpRulePriorityNum(ar);
    const pb = atpRulePriorityNum(br);
    if (pa !== pb) return pa - pb;

    const na = atpRuleNum(ar);
    const nb = atpRuleNum(br);
    if (na !== nb) return na - nb;
    return 0;
  }

  function atpBuildBranchLabel(item) {
    if (!item || item.__implied || !item.rule) return 'Refinamento (E/&&)';
    const num = item.rule && item.rule.num ? String(item.rule.num) : '?';
    const pr = atpRulePriorityLabel(item.rule);
    return `Regra ${num} | Prio ${pr}`;
  }

  function atpBuildBranchDetails(item) {
    if (!item || item.__implied || !item.rule) {
      return 'Refinamento implicito do localizador';
    }
    const tipo = atpRuleTipo(item.rule);
    return `Regra ${item.rule.num} | Prio ${atpRulePriorityLabel(item.rule)} | ${atpShortText(tipo, 80)}`;
  }

  function atpBuildRuleNodeMeta(item) {
    if (!item || item.__implied || !item.rule) {
      return {
        label: 'REGRA REFINAMENTO',
        subtitle: 'Regra implicita (E/&&)',
        fullLabel: atpBuildBranchDetails(item)
      };
    }
    const num = String(item.rule.num || '?');
    const pr = atpRulePriorityLabel(item.rule);
    return {
      label: `REGRA ${num}`,
      subtitle: `Prio ${pr}`,
      fullLabel: atpBuildBranchDetails(item)
    };
  }

  function atpFlowModelFromRules(rules, flowIdx) {
    let data = null;
    if (window.ATP && window.ATP.extract && typeof window.ATP.extract.getFluxosData === 'function') {
      data = window.ATP.extract.getFluxosData(rules || []);
    } else if (typeof atpComputeFluxosData === 'function') {
      data = atpComputeFluxosData(rules || []);
    } else {
      throw new Error('atpComputeFluxosData indisponivel.');
    }

    const fluxos = Array.isArray(data && data.fluxos) ? data.fluxos : [];
    const idx = Number(flowIdx) | 0;
    if (idx < 0 || idx >= fluxos.length) {
      throw new Error('Fluxo invalido para visualizacao.');
    }

    const fluxo = fluxos[idx];
    const byFrom = (data && data.byFrom instanceof Map) ? data.byFrom : new Map();

    const nodeSet = new Set(Array.isArray(fluxo && fluxo.nodes) ? fluxo.nodes : []);
    const starts = Array.isArray(fluxo && fluxo.starts) ? fluxo.starts.filter(Boolean) : [];

    const branchesByLocal = new Map();
    for (const from of Array.from(nodeSet)) {
      const rawItems = Array.isArray(byFrom.get(from)) ? byFrom.get(from) : [];
      const items = rawItems.slice().sort(atpSortFlowItems);
      const branches = [];

      for (const it of items) {
        const toKeys = Array.from(new Set((it && it.toKeys ? it.toKeys : []).filter(Boolean)));
        for (const tk of toKeys) {
          nodeSet.add(tk);
          branches.push({
            from,
            to: tk,
            rule: it && it.rule ? it.rule : null,
            implied: !!(it && it.__implied),
            label: atpBuildBranchLabel(it),
            details: atpBuildBranchDetails(it)
          });
        }
      }

      if (branches.length) branchesByLocal.set(from, branches);
    }

    const orderedLocals = [];
    const seenLocal = new Set();
    const pushLocal = (k) => {
      const kk = String(k || '');
      if (!kk || seenLocal.has(kk)) return;
      seenLocal.add(kk);
      orderedLocals.push(kk);
    };
    starts.forEach(pushLocal);
    Array.from(nodeSet).forEach(pushLocal);

    const laneSeeds = [];
    const laneSeedSet = new Set();
    const pushLaneSeed = (k) => {
      const kk = String(k || '');
      if (!kk || laneSeedSet.has(kk)) return;
      laneSeedSet.add(kk);
      laneSeeds.push(kk);
    };

    starts.forEach(pushLaneSeed);
    if (!laneSeeds.length) {
      const indeg = new Map();
      orderedLocals.forEach((k) => indeg.set(k, 0));
      for (const [from, branches] of branchesByLocal.entries()) {
        if (!indeg.has(from)) indeg.set(from, 0);
        for (const br of (branches || [])) {
          const to = String(br && br.to || '');
          if (!to) continue;
          indeg.set(to, (indeg.get(to) || 0) + 1);
        }
      }
      orderedLocals.filter((k) => (indeg.get(k) || 0) === 0).forEach(pushLaneSeed);
    }
    if (!laneSeeds.length && orderedLocals.length) pushLaneSeed(orderedLocals[0]);

    const laneByLocalKey = new Map();
    const bestDistByLocal = new Map();
    const laneIndexByLocal = new Map();
    const laneQueue = [];

    const enqueueLane = (localKey, laneSeedKey, laneIdx, dist) => {
      laneQueue.push({
        localKey: String(localKey || ''),
        laneSeedKey: String(laneSeedKey || ''),
        laneIdx: Number(laneIdx) || 0,
        dist: Number(dist) || 0
      });
    };

    laneSeeds.forEach((seed, idx) => enqueueLane(seed, seed, idx, 0));

    while (laneQueue.length) {
      const cur = laneQueue.shift();
      const lk = String(cur.localKey || '');
      if (!lk) continue;

      const prevDist = bestDistByLocal.has(lk) ? bestDistByLocal.get(lk) : Number.POSITIVE_INFINITY;
      const prevLane = laneIndexByLocal.has(lk) ? laneIndexByLocal.get(lk) : Number.POSITIVE_INFINITY;
      const shouldSkip = (cur.dist > prevDist) || (cur.dist === prevDist && cur.laneIdx >= prevLane);
      if (shouldSkip) continue;

      bestDistByLocal.set(lk, cur.dist);
      laneIndexByLocal.set(lk, cur.laneIdx);
      laneByLocalKey.set(lk, cur.laneSeedKey);

      const outs = branchesByLocal.get(lk) || [];
      for (const br of outs) {
        const toKey = String(br && br.to || '');
        if (!toKey) continue;
        enqueueLane(toKey, cur.laneSeedKey, cur.laneIdx, cur.dist + 1);
      }
    }

    for (const local of orderedLocals) {
      if (laneByLocalKey.has(local)) continue;
      pushLaneSeed(local);
      const idx = laneSeeds.length - 1;
      laneByLocalKey.set(local, local);
      laneIndexByLocal.set(local, idx);
    }

    const nodes = [];
    const edges = [];
    const outgoingForExec = new Map();
    const startSet = new Set(starts);
    const hasOutgoing = new Set();
    const localNodeIdByKey = new Map();
    let seq = 0;

    for (const local of orderedLocals) {
      const localId = `loc_${++seq}`;
      localNodeIdByKey.set(local, localId);
      const laneIdx = Number(laneIndexByLocal.get(local));
      const laneSeed = String(laneByLocalKey.get(local) || local);
      nodes.push({
        id: localId,
        type: 'atpNode',
        data: {
          kind: 'local',
          localKey: local,
          label: atpShortText(local, 70),
          fullLabel: local,
          isStart: startSet.has(local),
          isEnd: false,
          laneKey: laneSeed,
          laneIndex: Number.isFinite(laneIdx) ? laneIdx : 0
        },
        position: { x: 0, y: 0 },
        draggable: false
      });
    }

    for (const local of orderedLocals) {
      const fromLocalId = localNodeIdByKey.get(local);
      const branches = (branchesByLocal.get(local) || []).slice();
      if (!branches.length || !fromLocalId) continue;
      hasOutgoing.add(local);

      const hasDecision = branches.length > 1;
      let decisionNodeId = null;
      let edgeFromLocalId = null;

      if (hasDecision) {
        decisionNodeId = `dec_${++seq}`;
        const laneIdx = Number(laneIndexByLocal.get(local));
        const laneSeed = String(laneByLocalKey.get(local) || local);
        nodes.push({
          id: decisionNodeId,
          type: 'atpDecisao',
          data: {
            label: 'DECISAO',
            fullLabel: 'No de decisao',
            laneKey: laneSeed,
            laneIndex: Number.isFinite(laneIdx) ? laneIdx : 0
          },
          position: { x: 0, y: 0 },
          draggable: false
        });

        edgeFromLocalId = `edge_ld_${++seq}`;
        edges.push({
          id: edgeFromLocalId,
          source: fromLocalId,
          target: decisionNodeId,
          type: 'smoothstep',
          data: { structural: true }
        });
      }

      const options = [];
      for (const br of branches) {
        const toLocalId = localNodeIdByKey.get(br.to);
        if (!toLocalId) continue;

        const ruleNodeId = `rule_${++seq}`;
        const fakeItem = {
          __implied: !!br.implied,
          rule: br.rule || null
        };
        const meta = atpBuildRuleNodeMeta(fakeItem);
        const laneIdx = Number(laneIndexByLocal.get(local));
        const laneSeed = String(laneByLocalKey.get(local) || local);
        nodes.push({
          id: ruleNodeId,
          type: 'atpRegra',
          data: {
            kind: 'rule',
            label: meta.label,
            subtitle: meta.subtitle,
            fullLabel: meta.fullLabel,
            laneKey: laneSeed,
            laneIndex: Number.isFinite(laneIdx) ? laneIdx : 0
          },
          position: { x: 0, y: 0 },
          draggable: false
        });

        let edgeDecisionRuleId = null;
        let edgeFromLocalRuleId = null;
        if (hasDecision && decisionNodeId) {
          edgeDecisionRuleId = `edge_dr_${++seq}`;
          edges.push({
            id: edgeDecisionRuleId,
            source: decisionNodeId,
            target: ruleNodeId,
            type: 'smoothstep',
            data: { structural: false }
          });
        } else {
          edgeFromLocalRuleId = `edge_lr_${++seq}`;
          edges.push({
            id: edgeFromLocalRuleId,
            source: fromLocalId,
            target: ruleNodeId,
            type: 'smoothstep',
            data: { structural: false }
          });
        }

        const edgeRuleToDestId = `edge_rl_${++seq}`;
        edges.push({
          id: edgeRuleToDestId,
          source: ruleNodeId,
          target: toLocalId,
          type: 'smoothstep',
          data: { structural: false }
        });

        options.push({
          fromKey: local,
          toKey: br.to,
          fromNodeId: fromLocalId,
          toNodeId: toLocalId,
          decisionNodeId: hasDecision ? decisionNodeId : null,
          ruleNodeId,
          edgeFromLocalId: hasDecision ? edgeFromLocalId : edgeFromLocalRuleId,
          edgeDecisionRuleId,
          edgeRuleToDestId,
          label: br.label,
          details: br.details
        });
      }

      if (options.length) outgoingForExec.set(local, options);
    }

    nodes.forEach((n) => {
      if (!(n && n.data && n.data.kind === 'local')) return;
      const localKey = String(n.data.localKey || '');
      n.data.isEnd = !hasOutgoing.has(localKey);
      if (n.data.isStart) n.type = 'atpEntrada';
      else if (n.data.isEnd) n.type = 'atpSaida';
      else n.type = 'atpNode';
    });

    const fallbackStartKey = starts.find(k => orderedLocals.includes(k)) || orderedLocals[0] || null;
    const fallbackStartNodeId = fallbackStartKey ? (localNodeIdByKey.get(fallbackStartKey) || null) : null;
    const laneKeys = laneSeeds.slice();
    const laneLabels = laneKeys.map((k, i) => ({ key: k, index: i, label: atpShortText(k, 70) }));

    const execPlan = atpBuildExecutionPlan(outgoingForExec, fallbackStartKey);
    return {
      nodes,
      edges,
      starts,
      startNode: fallbackStartNodeId,
      laneKeys,
      laneLabels,
      outgoingForExec,
      execPlan
    };
  }

  function atpBuildExecutionPlan(outgoingForExec, startKey) {
    const steps = [];
    let currentKey = startKey || null;
    const seenTransitions = new Map();
    const LIMIT = 220;
    let endReason = 'Fim do fluxo.';

    for (let i = 0; i < LIMIT; i += 1) {
      if (!currentKey) {
        endReason = 'Fluxo sem ponto inicial.';
        break;
      }

      const options = Array.isArray(outgoingForExec.get(currentKey)) ? outgoingForExec.get(currentKey) : [];
      if (!options.length) {
        endReason = `Fim em "${currentKey}".`;
        break;
      }

      const executed = options[0];
      const discarded = options.slice(1);
      steps.push({
        fromNodeId: executed.fromNodeId,
        toNodeId: executed.toNodeId,
        executed,
        discarded
      });

      const tk = `${currentKey}>>${executed.toKey}`;
      const prev = seenTransitions.get(tk) || 0;
      seenTransitions.set(tk, prev + 1);
      if (prev >= 1) {
        endReason = `Ciclo detectado em "${currentKey}" -> "${executed.toKey}".`;
        break;
      }

      currentKey = executed.toKey;
    }

    if (steps.length >= LIMIT) {
      endReason = 'Limite maximo de etapas atingido.';
    }

    return { steps, endReason };
  }

  async function atpApplyElkLayout(nodes, edges, ELKClass, modelMeta) {
    const elk = new ELKClass();
    const dims = (n) => {
      if (n.type === 'atpDecisao') return { width: 160, height: 150 };
      if (n.type === 'atpRegra') return { width: 260, height: 100 };
      if (n.type === 'atpSubfluxo') return { width: 240, height: 86 };
      return { width: 300, height: 96 };
    };

    const startNodeIds = (nodes || [])
      .filter((n) => !!(n && n.data && n.data.isStart))
      .map((n) => String(n.id || ''))
      .filter(Boolean);

    const virtualStartId = '__atp_start_anchor__';

    const graph = {
      id: 'atp-root',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'RIGHT',
        'elk.spacing.nodeNode': '44',
        'elk.layered.spacing.nodeNodeBetweenLayers': '230',
        'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
        'elk.layered.considerModelOrder': 'NODES_AND_EDGES',
        'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
        'org.eclipse.elk.partitioning.activate': 'true',
        'elk.edgeRouting': 'ORTHOGONAL'
      },
      children: nodes.map((n) => {
        const d = dims(n);
        const laneIdx = Number(n && n.data && n.data.laneIndex);
        const child = { id: n.id, width: d.width, height: d.height };
        if (Number.isFinite(laneIdx) && laneIdx >= 0) {
          child.layoutOptions = {
            'org.eclipse.elk.partitioning.partition': String(laneIdx + 1)
          };
        }
        return child;
      }),
      edges: edges.map((e) => ({
        id: e.id,
        sources: [e.source],
        targets: [e.target]
      }))
    };

    if (startNodeIds.length) {
      graph.children.push({
        id: virtualStartId,
        width: 4,
        height: 4,
        layoutOptions: { 'org.eclipse.elk.partitioning.partition': '0' }
      });
      for (let i = 0; i < startNodeIds.length; i += 1) {
        graph.edges.push({
          id: `${virtualStartId}_e_${i + 1}`,
          sources: [virtualStartId],
          targets: [startNodeIds[i]]
        });
      }
    }

    try {
      const out = await elk.layout(graph);
      const posMap = new Map();
      for (const c of (out.children || [])) {
        posMap.set(c.id, { x: Number(c.x) || 0, y: Number(c.y) || 0 });
      }
      return nodes.map((n) => {
        const p = posMap.get(n.id) || { x: 0, y: 0 };
        return { ...n, position: { x: p.x, y: p.y } };
      });
    } catch (e) {
      try { console.warn(LOG, 'Falha no ELK layout, fallback linear:', e); } catch (_) {}
      let y = 80;
      return nodes.map((n, i) => {
        const x = 80 + ((i % 8) * 240);
        if (i % 8 === 0 && i > 0) y += 130;
        return { ...n, position: { x, y } };
      });
    }
  }

  function atpBuildExecStateEdges(baseEdges, plan, stepIndex, running) {
    const steps = (plan && Array.isArray(plan.steps)) ? plan.steps : [];
    const states = new Map();
    const visitedNodes = new Set();
    const skippedNodes = new Set();

    for (let i = 0; i <= stepIndex && i < steps.length; i += 1) {
      const st = steps[i];
      if (!st || !st.executed) continue;
      if (st.fromNodeId) visitedNodes.add(st.fromNodeId);
      if (st.toNodeId) visitedNodes.add(st.toNodeId);
      if (st.executed.decisionNodeId) visitedNodes.add(st.executed.decisionNodeId);
      if (st.executed.ruleNodeId) visitedNodes.add(st.executed.ruleNodeId);

      if (st.executed.edgeFromLocalId) states.set(st.executed.edgeFromLocalId, i === stepIndex && running ? 'active' : 'run');
      if (st.executed.edgeDecisionRuleId) states.set(st.executed.edgeDecisionRuleId, i === stepIndex && running ? 'active' : 'run');
      if (st.executed.edgeRuleToDestId) states.set(st.executed.edgeRuleToDestId, i === stepIndex && running ? 'active' : 'run');
      for (const dc of (st.discarded || [])) {
        if (!dc) continue;
        if (dc.ruleNodeId) skippedNodes.add(dc.ruleNodeId);
        if (dc.edgeFromLocalId) states.set(dc.edgeFromLocalId, 'skip');
        if (dc.edgeDecisionRuleId) states.set(dc.edgeDecisionRuleId, 'skip');
        if (dc.edgeRuleToDestId) states.set(dc.edgeRuleToDestId, 'skip');
      }
    }

    const edges = baseEdges.map((e) => {
      const state = states.get(e.id) || 'idle';
      const style = { stroke: '#6b7280', strokeWidth: 1.9 };
      let animated = false;
      let className = 'atp-rf-edge';

      if (state === 'run') {
        style.stroke = '#15803d';
        style.strokeWidth = 2.6;
        className += ' atp-rf-edge-run';
      } else if (state === 'skip') {
        style.stroke = '#dc2626';
        style.strokeWidth = 2.2;
        style.strokeDasharray = '8 5';
        className += ' atp-rf-edge-skip';
      } else if (state === 'active') {
        style.stroke = '#d97706';
        style.strokeWidth = 3.2;
        animated = true;
        className += ' atp-rf-edge-active';
      }

      return {
        ...e,
        style,
        animated,
        className
      };
    });

    return { edges, visitedNodes, skippedNodes };
  }

  function atpBuildExecStateNodes(baseNodes, visitedNodes, currentNode, skippedNodes) {
    const cur = String(currentNode || '');
    const skip = skippedNodes instanceof Set ? skippedNodes : new Set();
    return baseNodes.map((n) => {
      if (n && n.type === 'atpLane') return n;
      const classes = ['atp-rf-node'];
      if (visitedNodes.has(n.id)) classes.push('atp-rf-node-visited');
      if (n.id === cur) classes.push('atp-rf-node-current');
      if (skip.has(n.id)) classes.push('atp-rf-node-skip');
      if (n.type === 'atpDecisao') classes.push('atp-rf-node-decision-wrapper');
      return {
        ...n,
        className: classes.join(' ')
      };
    });
  }

  function atpBuildCompactGraph(model, expandedDecisionIds, threshold) {
    const outNodes = [];
    const outEdges = [];
    const edgeDetailsById = new Map();
    const nodeById = new Map();
    const seq = { n: 0 };
    const expanded = expandedDecisionIds instanceof Set ? expandedDecisionIds : new Set();
    const maxOut = Math.max(2, Number(threshold) || 6);

    const nextId = (pfx) => `${pfx}_${++seq.n}`;
    const addEdge = (edge, meta) => {
      outEdges.push(edge);
      if (meta) edgeDetailsById.set(edge.id, meta);
    };

    for (const n of (model && Array.isArray(model.nodes) ? model.nodes : [])) {
      if (!n || n.type === 'atpRegra' || n.type === 'atpLane') continue;
      const cp = {
        ...n,
        position: { x: 0, y: 0 },
        data: { ...(n.data || {}) }
      };
      nodeById.set(cp.id, cp);
      outNodes.push(cp);
    }

    const optionsByDecision = new Map();
    const directOptionsBySource = new Map();

    for (const opts of ((model && model.outgoingForExec instanceof Map) ? model.outgoingForExec.values() : [])) {
      for (const op of (opts || [])) {
        if (!op) continue;
        if (op.decisionNodeId) {
          const arr = optionsByDecision.get(op.decisionNodeId) || [];
          arr.push(op);
          optionsByDecision.set(op.decisionNodeId, arr);
        } else {
          const arr = directOptionsBySource.get(op.fromNodeId) || [];
          arr.push(op);
          directOptionsBySource.set(op.fromNodeId, arr);
        }
      }
    }

    for (const [decisionId, options] of optionsByDecision.entries()) {
      const first = options[0];
      const fromId = first && first.fromNodeId ? first.fromNodeId : null;
      const decNode = nodeById.get(decisionId);
      if (decNode) {
        decNode.data = {
          ...(decNode.data || {}),
          isHeavyDecision: options.length > maxOut
        };
      }

      if (fromId && nodeById.has(fromId) && nodeById.has(decisionId)) {
        const edgeId = (first && first.edgeFromLocalId) ? String(first.edgeFromLocalId) : nextId('cmp_ld');
        addEdge({
          id: edgeId,
          source: fromId,
          target: decisionId,
          type: 'smoothstep',
          data: { compactStructural: true }
        });
      }

      if (options.length > maxOut && !expanded.has(decisionId)) {
        const uniqDest = new Set(options.map((o) => String(o.toKey || '')).filter(Boolean));
        const hubId = `sub_${String(decisionId)}`;
        outNodes.push({
          id: hubId,
          type: 'atpSubfluxo',
          data: {
            decisionId,
            label: `Subfluxo (${options.length} regras)`,
            subtitle: `${uniqDest.size} destinos`,
            laneKey: decNode && decNode.data ? decNode.data.laneKey : null,
            laneIndex: decNode && decNode.data ? decNode.data.laneIndex : null
          },
          position: { x: 0, y: 0 },
          draggable: false
        });
        addEdge({
          id: `cmp_sub_${String(decisionId)}`,
          source: decisionId,
          target: hubId,
          type: 'smoothstep',
          label: `${options.length} regras`,
          data: { compactCollapsed: true, decisionId }
        }, {
          title: 'Subfluxo colapsado',
          lines: options.map((o) => String(o.label || o.details || `${o.fromKey} -> ${o.toKey}`))
        });
        continue;
      }

      const byDest = new Map();
      for (const op of options) {
        const k = String(op.toNodeId || '');
        if (!k) continue;
        const arr = byDest.get(k) || [];
        arr.push(op);
        byDest.set(k, arr);
      }
      for (const [toNodeId, arr] of byDest.entries()) {
        if (!nodeById.has(toNodeId)) continue;
        const edgeId = nextId('cmp_dd');
        const cnt = arr.length;
        addEdge({
          id: edgeId,
          source: decisionId,
          target: toNodeId,
          type: 'smoothstep',
          label: `${cnt} regra${cnt > 1 ? 's' : ''}`,
          data: { compact: true, decisionId }
        }, {
          title: `Decisão: ${String((nodeById.get(decisionId)?.data?.label) || decisionId)}`,
          lines: arr.map((o) => String(o.label || o.details || `${o.fromKey} -> ${o.toKey}`))
        });
      }
    }

    for (const [fromId, options] of directOptionsBySource.entries()) {
      if (!nodeById.has(fromId)) continue;
      const byDest = new Map();
      for (const op of options) {
        const k = String(op.toNodeId || '');
        if (!k) continue;
        const arr = byDest.get(k) || [];
        arr.push(op);
        byDest.set(k, arr);
      }
      for (const [toNodeId, arr] of byDest.entries()) {
        if (!nodeById.has(toNodeId)) continue;
        const edgeId = nextId('cmp_ldir');
        const cnt = arr.length;
        addEdge({
          id: edgeId,
          source: fromId,
          target: toNodeId,
          type: 'smoothstep',
          label: `${cnt} regra${cnt > 1 ? 's' : ''}`,
          data: { compact: true }
        }, {
          title: `Transição: ${String((nodeById.get(fromId)?.data?.label) || fromId)} -> ${String((nodeById.get(toNodeId)?.data?.label) || toNodeId)}`,
          lines: arr.map((o) => String(o.label || o.details || `${o.fromKey} -> ${o.toKey}`))
        });
      }
    }

    return { nodes: outNodes, edges: outEdges, edgeDetailsById };
  }

  function atpDimsByType(node) {
    if (!node) return { width: 300, height: 96 };
    if (node.type === 'atpDecisao') return { width: 160, height: 150 };
    if (node.type === 'atpRegra') return { width: 260, height: 100 };
    if (node.type === 'atpSubfluxo') return { width: 240, height: 86 };
    return { width: 300, height: 96 };
  }

  function atpBuildLaneOverlayNodes(positionedNodes, laneLabels) {
    const nodes = Array.isArray(positionedNodes) ? positionedNodes : [];
    const labels = Array.isArray(laneLabels) ? laneLabels : [];
    const lanes = new Map();

    for (const n of nodes) {
      if (!n || n.type === 'atpLane') continue;
      const laneIdx = Number(n && n.data && n.data.laneIndex);
      if (!Number.isFinite(laneIdx) || laneIdx < 0) continue;

      const d = atpDimsByType(n);
      const x = Number(n.position && n.position.x) || 0;
      const y = Number(n.position && n.position.y) || 0;
      const x2 = x + d.width;
      const y2 = y + d.height;

      const rec = lanes.get(laneIdx) || { minX: x, minY: y, maxX: x2, maxY: y2 };
      rec.minX = Math.min(rec.minX, x);
      rec.minY = Math.min(rec.minY, y);
      rec.maxX = Math.max(rec.maxX, x2);
      rec.maxY = Math.max(rec.maxY, y2);
      lanes.set(laneIdx, rec);
    }

    const PAD_X = 36;
    const PAD_Y = 26;
    const out = [];
    const idxs = Array.from(lanes.keys()).sort((a, b) => a - b);
    for (const laneIdx of idxs) {
      const b = lanes.get(laneIdx);
      if (!b) continue;
      const meta = labels.find((l) => Number(l && l.index) === laneIdx) || null;
      const title = meta ? `Lane ${String(laneIdx + 1).padStart(2, '0')} - ${String(meta.label || '')}` : `Lane ${String(laneIdx + 1).padStart(2, '0')}`;
      out.push({
        id: `lane_bg_${laneIdx}`,
        type: 'atpLane',
        position: { x: Math.round(b.minX - PAD_X), y: Math.round(b.minY - PAD_Y) },
        data: {
          label: title,
          width: Math.max(240, Math.round((b.maxX - b.minX) + (PAD_X * 2))),
          height: Math.max(160, Math.round((b.maxY - b.minY) + (PAD_Y * 2)))
        },
        draggable: false,
        selectable: false,
        connectable: false,
        deletable: false,
        zIndex: -1
      });
    }
    return out;
  }

  function atpCloseFlowReactModal() {
    const el = document.getElementById('atpFlowReactModal');
    if (!el) return;
    try {
      if (typeof el._atpUnmount === 'function') el._atpUnmount();
    } catch (_) {}
    try { el.remove(); } catch (_) {}
  }

  async function atpOpenFlowReactModal(opts) {
    const options = opts && typeof opts === 'object' ? opts : {};
    const flowIdx = Number(options.flowIdx) | 0;
    const rules = Array.isArray(options.rules) ? options.rules : [];
    if (!rules.length) throw new Error('Sem regras para visualizar.');

    try { if (typeof atpCloseRuleMapModal === 'function') atpCloseRuleMapModal(); } catch (_) {}
    atpCloseFlowReactModal();

    const libs = await atpEnsureReactFlowElkLoaded();
    const model = atpFlowModelFromRules(rules, flowIdx);
    const COMPACT_DECISION_THRESHOLD = 6;
    const fullLayoutCoreNodes = await atpApplyElkLayout(model.nodes, model.edges, libs.ELK, model);
    const fullLaneNodes = atpBuildLaneOverlayNodes(fullLayoutCoreNodes, model.laneLabels);
    const fullLayoutNodes = fullLaneNodes.concat(fullLayoutCoreNodes);

    const overlay = document.createElement('div');
    overlay.id = 'atpFlowReactModal';
    overlay.className = 'atp-map-overlay';
    overlay.addEventListener('click', (ev) => {
      if (ev.target === overlay) atpCloseFlowReactModal();
    });

    const box = document.createElement('div');
    box.className = 'atp-map-box';

    const top = document.createElement('div');
    top.className = 'atp-map-top';
    top.innerHTML = `<div><div class="atp-map-title">Visualizar Fluxo ${String(flowIdx + 1).padStart(2, '0')} (React Flow + ELK)</div><div class="atp-map-sub">Modo compacto agrega regras por aresta. Clique em arestas para detalhes e em subfluxos para expandir.</div></div>`;

    const actions = document.createElement('div');
    actions.className = 'atp-map-actions';
    const btnClose = document.createElement('button');
    btnClose.type = 'button';
    btnClose.className = 'atp-map-btn';
    btnClose.textContent = 'Fechar';
    btnClose.addEventListener('click', atpCloseFlowReactModal);
    actions.appendChild(btnClose);
    top.appendChild(actions);

    const body = document.createElement('div');
    body.className = 'atp-map-body';

    const host = document.createElement('div');
    host.className = 'atp-rf-canvas';
    body.appendChild(host);

    box.appendChild(top);
    box.appendChild(body);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const React = libs.React;
    const ReactDOM = libs.ReactDOM;
    const RF = libs.ReactFlow;

    const ReactFlowComp = RF.ReactFlow || RF.default;
    const Controls = RF.Controls;
    const MiniMap = RF.MiniMap;
    const Panel = RF.Panel;
    const MarkerType = RF.MarkerType || {};
    const Handle = RF.Handle;
    const Position = RF.Position;
    const ReactFlowProvider = RF.ReactFlowProvider;
    const useNodesState = RF.useNodesState;
    const useEdgesState = RF.useEdgesState;

    const markerClosed = MarkerType.ArrowClosed || MarkerType.Arrow || undefined;
    const styleEdges = (arr) => (arr || []).map((e) => ({
      ...e,
      markerEnd: markerClosed ? { type: markerClosed } : undefined,
      labelStyle: { fill: '#111827', fontWeight: 700, fontSize: 11 },
      labelBgStyle: { fill: '#ffffff', fillOpacity: 0.9, stroke: '#d1d5db', strokeWidth: 1 },
      labelBgPadding: [6, 4],
      labelBgBorderRadius: 6,
      style: { stroke: '#6b7280', strokeWidth: 1.9 },
      animated: false
    }));
    const fullLayoutEdges = styleEdges(model.edges || []);

    const buildCompactLayout = async (expandedSet) => {
      const compact = atpBuildCompactGraph(model, expandedSet, COMPACT_DECISION_THRESHOLD);
      const laid = await atpApplyElkLayout(compact.nodes, compact.edges, libs.ELK, model);
      const laneOverlay = atpBuildLaneOverlayNodes(laid, model.laneLabels);
      return {
        nodes: laneOverlay.concat(laid),
        edges: styleEdges(compact.edges),
        edgeDetailsById: compact.edgeDetailsById
      };
    };

    const compactInitial = await buildCompactLayout(new Set());

    function ATPNodeBox(props, kindLabel, cssKind) {
      const data = props && props.data ? props.data : {};
      const title = String(data.fullLabel || data.label || '');
      const hStyleL = { width: 8, height: 8, opacity: 0, border: 0, background: 'transparent', left: 2 };
      const hStyleR = { width: 8, height: 8, opacity: 0, border: 0, background: 'transparent', right: 2 };
      return React.createElement(
        'div',
        { className: `atp-rf-node-box atp-rf-kind-${cssKind}`, title },
        React.createElement(Handle, { type: 'target', position: Position.Left, isConnectable: false, style: hStyleL }),
        React.createElement('div', { className: 'atp-rf-node-kind' }, kindLabel),
        React.createElement('div', { className: 'atp-rf-node-title' }, String(data.label || 'Localizador')),
        data.subtitle ? React.createElement('div', { className: 'atp-rf-node-sub' }, String(data.subtitle || '')) : null,
        React.createElement(Handle, { type: 'source', position: Position.Right, isConnectable: false, style: hStyleR })
      );
    }

    function ATPNodeEntrada(props) {
      return ATPNodeBox(props, 'ENTRADA', 'entrada');
    }

    function ATPNodePadrao(props) {
      return ATPNodeBox(props, 'NODE', 'node');
    }

    function ATPNodeSaida(props) {
      return ATPNodeBox(props, 'SAIDA', 'saida');
    }

    function ATPNodeRegra(props) {
      return ATPNodeBox(props, 'REGRA', 'regra');
    }

    function ATPNodeDecisao() {
      const hStyleL = { width: 8, height: 8, opacity: 0, border: 0, background: 'transparent', left: 2 };
      const hStyleR = { width: 8, height: 8, opacity: 0, border: 0, background: 'transparent', right: 2 };
      return React.createElement(
        'div',
        { className: 'atp-rf-decision-node' },
        React.createElement(Handle, { type: 'target', position: Position.Left, isConnectable: false, style: hStyleL }),
        React.createElement('div', { className: 'atp-rf-decision-diamond' }),
        React.createElement('div', { className: 'atp-rf-decision-label' }, 'DECISAO'),
        React.createElement(Handle, { type: 'source', position: Position.Right, isConnectable: false, style: hStyleR })
      );
    }

    function ATPNodeLane(props) {
      const data = props && props.data ? props.data : {};
      const w = Math.max(180, Number(data.width) || 240);
      const h = Math.max(120, Number(data.height) || 160);
      return React.createElement(
        'div',
        {
          className: 'atp-rf-lane-box',
          style: { width: `${w}px`, height: `${h}px` },
          title: String(data.label || '')
        },
        React.createElement('div', { className: 'atp-rf-lane-label' }, String(data.label || 'Lane'))
      );
    }

    function ATPNodeSubfluxo(props) {
      const data = props && props.data ? props.data : {};
      return React.createElement(
        'div',
        { className: 'atp-rf-subfluxo-box', title: String(data.label || 'Subfluxo') },
        React.createElement('div', { className: 'atp-rf-subfluxo-title' }, String(data.label || 'Subfluxo')),
        React.createElement('div', { className: 'atp-rf-subfluxo-sub' }, String(data.subtitle || 'Clique para expandir'))
      );
    }

    const nodeTypes = {
      atpLane: ATPNodeLane,
      atpSubfluxo: ATPNodeSubfluxo,
      atpEntrada: ATPNodeEntrada,
      atpNode: ATPNodePadrao,
      atpSaida: ATPNodeSaida,
      atpRegra: ATPNodeRegra,
      atpDecisao: ATPNodeDecisao
    };

    function ATPFlowApp() {
      const [nodes, setNodes, onNodesChange] = useNodesState(compactInitial.nodes);
      const [edges, setEdges, onEdgesChange] = useEdgesState(compactInitial.edges);
      const [running, setRunning] = React.useState(false);
      const [compactMode, setCompactMode] = React.useState(true);
      const laneLabels = Array.isArray(model && model.laneLabels) ? model.laneLabels : [];
      const laneSummary = laneLabels.length
        ? laneLabels.map((l) => `${String((l.index || 0) + 1).padStart(2, '0')}: ${l.label}`).join(' | ')
        : 'Sem agrupamento por inicio';
      const [details, setDetails] = React.useState({
        title: 'Detalhes',
        body: 'Modo compacto ativo. Clique em uma aresta para ver as regras agregadas.'
      });
      const [status, setStatus] = React.useState({
        title: 'Fluxo pronto',
        body: 'Modo compacto: regras agregadas por aresta. Clique em "Modo Completo" para ver tudo.'
      });

      const baseNodesRef = React.useRef(fullLayoutNodes);
      const baseEdgesRef = React.useRef(fullLayoutEdges);
      const planRef = React.useRef(model.execPlan);
      const compactExpandedRef = React.useRef(new Set());
      const compactMetaRef = React.useRef({ edgeDetailsById: compactInitial.edgeDetailsById || new Map() });
      const compactReqRef = React.useRef(0);
      const timerRef = React.useRef(null);
      const stepRef = React.useRef(-1);

      const rebuildCompact = React.useCallback((expandedSet) => {
        const token = ++compactReqRef.current;
        const nextExpanded = expandedSet instanceof Set ? new Set(expandedSet) : new Set();
        compactExpandedRef.current = nextExpanded;
        Promise.resolve()
          .then(() => buildCompactLayout(nextExpanded))
          .then((pack) => {
            if (token !== compactReqRef.current) return;
            compactMetaRef.current = { edgeDetailsById: pack.edgeDetailsById || new Map() };
            setNodes(pack.nodes || []);
            setEdges(pack.edges || []);
          })
          .catch((e) => {
            try { console.warn(LOG, 'Falha ao rebuild de layout compacto:', e); } catch (_) {}
          });
      }, [setNodes, setEdges]);

      const applyState = React.useCallback((idx, isRunning, customStatus) => {
        const plan = planRef.current || { steps: [] };
        const info = atpBuildExecStateEdges(baseEdgesRef.current, plan, idx, isRunning);
        const currentStep = (plan.steps && idx >= 0) ? plan.steps[idx] : null;
        const currentNode = currentStep ? currentStep.executed.ruleNodeId : model.startNode;
        setEdges(info.edges);
        setNodes(atpBuildExecStateNodes(baseNodesRef.current, info.visitedNodes, currentNode, info.skippedNodes));

        if (customStatus) {
          setStatus(customStatus);
          return;
        }
        if (!currentStep) {
          setStatus({
            title: 'Fluxo pronto',
            body: 'Clique em "Modo Execucao" para animar a tomada de decisao.'
          });
          return;
        }
        const discarded = (currentStep.discarded || []).map(d => d.label).filter(Boolean);
        setStatus({
          title: `Etapa ${idx + 1} de ${plan.steps.length}`,
          body: `Executou: ${currentStep.executed.label} -> ${currentStep.executed.toKey}${discarded.length ? ` | Descartadas: ${discarded.join(' | ')}` : ' | Descartadas: nenhuma'}`
        });
      }, [setEdges, setNodes]);

      const stopExec = React.useCallback((manual) => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setRunning(false);
        const plan = planRef.current || { endReason: 'Fim.' };
        if (manual) {
          setStatus({
            title: 'Execucao pausada',
            body: 'Clique em "Modo Execucao" para continuar do inicio.'
          });
        } else {
          setStatus({
            title: 'Execucao finalizada',
            body: plan.endReason || 'Fim do fluxo.'
          });
        }
      }, []);

      const startExec = React.useCallback(() => {
        const plan = planRef.current || { steps: [], endReason: 'Fim do fluxo.' };
        if (!Array.isArray(plan.steps) || !plan.steps.length) {
          setStatus({
            title: 'Sem etapas para executar',
            body: plan.endReason || 'Nao ha regras de saida para este fluxo.'
          });
          return;
        }
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        setRunning(true);
        stepRef.current = -1;
        setDetails({
          title: 'Detalhes',
          body: 'Execução em modo completo. No modo compacto, clique em arestas para ver regras.'
        });
        applyState(-1, true, {
          title: 'Execucao iniciada',
          body: 'Avaliando regras por prioridade em cada decisao.'
        });

        timerRef.current = setInterval(() => {
          const planNow = planRef.current || { steps: [] };
          const next = stepRef.current + 1;
          if (next >= planNow.steps.length) {
            stopExec(false);
            return;
          }
          stepRef.current = next;
          applyState(next, true);
        }, 1400);
      }, [applyState, stopExec]);

      const onToggleCompact = React.useCallback(() => {
        if (running) return;
        if (compactMode) {
          setCompactMode(false);
          setNodes(baseNodesRef.current);
          setEdges(baseEdgesRef.current);
          setStatus({
            title: 'Modo completo',
            body: 'Visualização detalhada com todos os nós de regra.'
          });
          setDetails({
            title: 'Detalhes',
            body: 'Modo completo ativo. Use "Modo Compacto" para organizar o fluxo.'
          });
          return;
        }
        setCompactMode(true);
        setStatus({
          title: 'Modo compacto',
          body: 'Arestas agregadas por quantidade de regras.'
        });
        setDetails({
          title: 'Detalhes',
          body: 'Clique em uma aresta para ver as regras agregadas. Clique em subfluxo para expandir.'
        });
        rebuildCompact(compactExpandedRef.current);
      }, [compactMode, rebuildCompact, running, setEdges, setNodes]);

      const onToggleExec = React.useCallback(() => {
        if (running) {
          stopExec(true);
          return;
        }
        if (compactMode) {
          setCompactMode(false);
          setNodes(baseNodesRef.current);
          setEdges(baseEdgesRef.current);
        }
        startExec();
      }, [compactMode, running, setEdges, setNodes, startExec, stopExec]);

      const onNodeClick = React.useCallback((_, node) => {
        if (!compactMode || running || !node) return;
        let decisionId = '';
        if (node.type === 'atpSubfluxo') {
          decisionId = String(node && node.data && node.data.decisionId || '');
        } else if (node.type === 'atpDecisao' && node.data && node.data.isHeavyDecision) {
          decisionId = String(node.id || '');
        }
        if (!decisionId) return;
        const next = new Set(compactExpandedRef.current || []);
        if (next.has(decisionId)) next.delete(decisionId);
        else next.add(decisionId);
        rebuildCompact(next);
      }, [compactMode, rebuildCompact, running]);

      const onEdgeClick = React.useCallback((_, edge) => {
        if (!compactMode || !edge) return;
        const metaMap = compactMetaRef.current && compactMetaRef.current.edgeDetailsById;
        const meta = metaMap && metaMap.get ? metaMap.get(String(edge.id || '')) : null;
        if (!meta) return;
        const lines = Array.isArray(meta.lines) ? meta.lines : [];
        const txt = lines.length ? lines.slice(0, 25).join(' | ') : 'Sem regras agregadas.';
        setDetails({
          title: String(meta.title || 'Detalhes da Aresta'),
          body: txt + (lines.length > 25 ? ' | ...' : '')
        });
      }, [compactMode]);

      React.useEffect(() => {
        return () => {
          try {
            if (timerRef.current) clearInterval(timerRef.current);
          } catch (_) {}
        };
      }, []);

      return React.createElement(
        ReactFlowComp,
        {
          nodes,
          edges,
          nodeTypes,
          onNodesChange,
          onEdgesChange,
          onNodeClick,
          onEdgeClick,
          fitView: true,
          fitViewOptions: { padding: 0.15, duration: 500 },
          minZoom: 0.2,
          maxZoom: 2.4,
          nodesDraggable: false,
          nodesConnectable: false,
          elementsSelectable: true,
          proOptions: { hideAttribution: true }
        },
        React.createElement(MiniMap, { pannable: true, zoomable: true }),
        React.createElement(Controls, null),
        React.createElement(
          Panel,
          { position: 'top-right', className: 'atp-rf-panel-right' },
          React.createElement(
            'button',
            {
              type: 'button',
              className: 'atp-map-btn',
              onClick: onToggleCompact,
              disabled: running
            },
            compactMode ? 'Modo Completo' : 'Modo Compacto'
          ),
          React.createElement(
            'button',
            {
              type: 'button',
              className: 'atp-map-btn atp-rf-exec-btn',
              onClick: onToggleExec
            },
            running ? 'Parar Execucao' : 'Modo Execucao'
          )
        ),
        React.createElement(
          Panel,
          { position: 'top-left', className: 'atp-rf-panel-left' },
          React.createElement('div', { className: 'atp-rf-status-title' }, status.title),
          React.createElement('div', { className: 'atp-rf-status-body' }, status.body)
        ),
        React.createElement(
          Panel,
          { position: 'bottom-left', className: 'atp-rf-panel-lanes' },
          React.createElement('div', { className: 'atp-rf-status-title' }, 'Lanes (Por Inicio)'),
          React.createElement('div', { className: 'atp-rf-status-body' }, laneSummary)
        ),
        React.createElement(
          Panel,
          { position: 'bottom-right', className: 'atp-rf-panel-details' },
          React.createElement('div', { className: 'atp-rf-status-title' }, details.title),
          React.createElement('div', { className: 'atp-rf-status-body' }, details.body)
        )
      );
    }

    const root = ReactDOM.createRoot(host);
    overlay._atpUnmount = () => {
      try { root.unmount(); } catch (_) {}
    };

    root.render(
      React.createElement(
        ReactFlowProvider,
        null,
        React.createElement(ATPFlowApp)
      )
    );
  }

  window.atpOpenFlowReactModal = atpOpenFlowReactModal;
  window.atpCloseFlowReactModal = atpCloseFlowReactModal;

  try { console.log('[ATP][OK] 13-visualizador-fluxo-reactflow-elk.js inicializado'); } catch (e) {}
})();
;
