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

    const nodes = [];
    const edges = [];
    const outgoingForExec = new Map();
    const startSet = new Set(starts);
    let seq = 0;

    for (const local of orderedLocals) {
      nodes.push({
        id: local,
        type: 'atpLocal',
        data: {
          label: atpShortText(local, 70),
          fullLabel: local,
          isStart: startSet.has(local),
          isEnd: false
        },
        position: { x: 0, y: 0 },
        draggable: false
      });
    }

    const hasOutgoing = new Set();
    for (const local of orderedLocals) {
      const branches = (branchesByLocal.get(local) || []).slice();
      if (!branches.length) continue;
      hasOutgoing.add(local);

      if (branches.length > 1) {
        const decisionId = `dec_${++seq}`;
        nodes.push({
          id: decisionId,
          type: 'atpDecision',
          data: { label: 'Decisao' },
          position: { x: 0, y: 0 },
          draggable: false
        });

        const entryEdgeId = `edge_entry_${++seq}`;
        edges.push({
          id: entryEdgeId,
          source: local,
          target: decisionId,
          type: 'smoothstep',
          label: 'Decisao',
          data: { structural: true }
        });

        const list = [];
        branches.forEach((br, i) => {
          const edgeId = `edge_branch_${++seq}`;
          edges.push({
            id: edgeId,
            source: decisionId,
            target: br.to,
            type: 'smoothstep',
            label: br.label,
            data: { details: br.details, structural: false }
          });
          list.push({
            from: local,
            to: br.to,
            edgeId,
            entryEdgeId,
            label: br.label,
            details: br.details
          });
        });
        outgoingForExec.set(local, list);
      } else {
        const br = branches[0];
        const edgeId = `edge_branch_${++seq}`;
        edges.push({
          id: edgeId,
          source: local,
          target: br.to,
          type: 'smoothstep',
          label: br.label,
          data: { details: br.details, structural: false }
        });
        outgoingForExec.set(local, [{
          from: local,
          to: br.to,
          edgeId,
          entryEdgeId: null,
          label: br.label,
          details: br.details
        }]);
      }
    }

    nodes.forEach((n) => {
      if (n.type !== 'atpLocal') return;
      n.data.isEnd = !hasOutgoing.has(n.id);
    });

    const fallbackStart = starts.find(k => orderedLocals.includes(k)) || orderedLocals[0] || null;
    const execPlan = atpBuildExecutionPlan(outgoingForExec, fallbackStart);
    return {
      nodes,
      edges,
      starts,
      startNode: fallbackStart,
      outgoingForExec,
      execPlan
    };
  }

  function atpBuildExecutionPlan(outgoingForExec, startNode) {
    const steps = [];
    let current = startNode || null;
    const seenTransitions = new Map();
    const LIMIT = 220;
    let endReason = 'Fim do fluxo.';

    for (let i = 0; i < LIMIT; i += 1) {
      if (!current) {
        endReason = 'Fluxo sem ponto inicial.';
        break;
      }

      const options = Array.isArray(outgoingForExec.get(current)) ? outgoingForExec.get(current) : [];
      if (!options.length) {
        endReason = `Fim em "${current}".`;
        break;
      }

      const executed = options[0];
      const discarded = options.slice(1);
      steps.push({
        from: current,
        to: executed.to,
        executed,
        discarded
      });

      const tk = `${current}>>${executed.to}`;
      const prev = seenTransitions.get(tk) || 0;
      seenTransitions.set(tk, prev + 1);
      if (prev >= 1) {
        endReason = `Ciclo detectado em "${current}" -> "${executed.to}".`;
        break;
      }

      current = executed.to;
    }

    if (steps.length >= LIMIT) {
      endReason = 'Limite maximo de etapas atingido.';
    }

    return { steps, endReason };
  }

  async function atpApplyElkLayout(nodes, edges, ELKClass) {
    const elk = new ELKClass();
    const dims = (n) => {
      if (n.type === 'atpDecision') return { width: 140, height: 140 };
      return { width: 320, height: 88 };
    };

    const graph = {
      id: 'atp-root',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'RIGHT',
        'elk.spacing.nodeNode': '90',
        'elk.layered.spacing.nodeNodeBetweenLayers': '160',
        'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
        'elk.edgeRouting': 'ORTHOGONAL'
      },
      children: nodes.map((n) => {
        const d = dims(n);
        return { id: n.id, width: d.width, height: d.height };
      }),
      edges: edges.map((e) => ({
        id: e.id,
        sources: [e.source],
        targets: [e.target]
      }))
    };

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
      let y = 0;
      return nodes.map((n, idx) => {
        const isDecision = n.type === 'atpDecision';
        const x = isDecision ? 400 : (idx * 250);
        y += isDecision ? 60 : 110;
        return { ...n, position: { x, y } };
      });
    }
  }

  function atpBuildExecStateEdges(baseEdges, plan, stepIndex, running) {
    const steps = (plan && Array.isArray(plan.steps)) ? plan.steps : [];
    const states = new Map();
    const visitedNodes = new Set();

    for (let i = 0; i <= stepIndex && i < steps.length; i += 1) {
      const st = steps[i];
      if (!st || !st.executed) continue;
      visitedNodes.add(st.from);
      visitedNodes.add(st.to);

      if (st.executed.entryEdgeId) states.set(st.executed.entryEdgeId, i === stepIndex && running ? 'active' : 'run');
      states.set(st.executed.edgeId, i === stepIndex && running ? 'active' : 'run');
      for (const dc of (st.discarded || [])) {
        if (dc && dc.edgeId) states.set(dc.edgeId, 'skip');
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

    return { edges, visitedNodes };
  }

  function atpBuildExecStateNodes(baseNodes, visitedNodes, currentNode) {
    const cur = String(currentNode || '');
    return baseNodes.map((n) => {
      const classes = ['atp-rf-node'];
      if (visitedNodes.has(n.id)) classes.push('atp-rf-node-visited');
      if (n.id === cur) classes.push('atp-rf-node-current');
      if (n.type === 'atpDecision') classes.push('atp-rf-node-decision-wrapper');
      return {
        ...n,
        className: classes.join(' ')
      };
    });
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
    const layoutNodes = await atpApplyElkLayout(model.nodes, model.edges, libs.ELK);

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
    top.innerHTML = `<div><div class="atp-map-title">Visualizar Fluxo ${String(flowIdx + 1).padStart(2, '0')} (React Flow + ELK)</div><div class="atp-map-sub">Modo Execucao simula a primeira regra por prioridade em cada decisao.</div></div>`;

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
    const Background = RF.Background;
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
    const initialEdges = (model.edges || []).map((e) => ({
      ...e,
      markerEnd: markerClosed ? { type: markerClosed } : undefined,
      labelStyle: { fill: '#111827', fontWeight: 700, fontSize: 11 },
      labelBgStyle: { fill: '#ffffff', fillOpacity: 0.9, stroke: '#d1d5db', strokeWidth: 1 },
      labelBgPadding: [6, 4],
      labelBgBorderRadius: 6,
      style: { stroke: '#6b7280', strokeWidth: 1.9 },
      animated: false
    }));

    function ATPNodeLocal(props) {
      const data = props && props.data ? props.data : {};
      const title = String(data.fullLabel || data.label || '');
      const badges = [];
      if (data.isStart) badges.push('INICIO');
      if (data.isEnd) badges.push('FIM');
      const hStyle = { width: 8, height: 8, opacity: 0, border: 0 };
      return React.createElement(
        'div',
        { className: 'atp-rf-local-node', title },
        React.createElement(Handle, { type: 'target', position: Position.Left, isConnectable: false, style: hStyle }),
        React.createElement('div', { className: 'atp-rf-local-head' }, badges.map((b, i) => React.createElement('span', { className: 'atp-rf-badge', key: `${b}_${i}` }, b))),
        React.createElement('div', { className: 'atp-rf-local-title' }, String(data.label || 'Localizador')),
        React.createElement(Handle, { type: 'source', position: Position.Right, isConnectable: false, style: hStyle })
      );
    }

    function ATPNodeDecision() {
      const hStyle = { width: 8, height: 8, opacity: 0, border: 0 };
      return React.createElement(
        'div',
        { className: 'atp-rf-decision-node' },
        React.createElement(Handle, { type: 'target', position: Position.Left, isConnectable: false, style: hStyle }),
        React.createElement('div', { className: 'atp-rf-decision-diamond' }),
        React.createElement('div', { className: 'atp-rf-decision-label' }, 'Decisao'),
        React.createElement(Handle, { type: 'source', position: Position.Right, isConnectable: false, style: hStyle })
      );
    }

    const nodeTypes = {
      atpLocal: ATPNodeLocal,
      atpDecision: ATPNodeDecision
    };

    function ATPFlowApp() {
      const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes);
      const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
      const [running, setRunning] = React.useState(false);
      const [status, setStatus] = React.useState({
        title: 'Fluxo pronto',
        body: 'Clique em "Modo Execucao" para animar a tomada de decisao.'
      });

      const baseNodesRef = React.useRef(layoutNodes);
      const baseEdgesRef = React.useRef(initialEdges);
      const planRef = React.useRef(model.execPlan);
      const timerRef = React.useRef(null);
      const stepRef = React.useRef(-1);

      const applyState = React.useCallback((idx, isRunning, customStatus) => {
        const plan = planRef.current || { steps: [] };
        const info = atpBuildExecStateEdges(baseEdgesRef.current, plan, idx, isRunning);
        const currentStep = (plan.steps && idx >= 0) ? plan.steps[idx] : null;
        const currentNode = currentStep ? currentStep.to : model.startNode;
        setEdges(info.edges);
        setNodes(atpBuildExecStateNodes(baseNodesRef.current, info.visitedNodes, currentNode));

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
          body: `Executou: ${currentStep.executed.label} -> ${currentStep.to}${discarded.length ? ` | Descartadas: ${discarded.join(' | ')}` : ' | Descartadas: nenhuma'}`
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

      const onToggleExec = React.useCallback(() => {
        if (running) stopExec(true);
        else startExec();
      }, [running, startExec, stopExec]);

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
          fitView: true,
          fitViewOptions: { padding: 0.15, duration: 500 },
          minZoom: 0.2,
          maxZoom: 2.4,
          nodesDraggable: false,
          nodesConnectable: false,
          elementsSelectable: true,
          proOptions: { hideAttribution: true }
        },
        React.createElement(Background, { variant: RF.BackgroundVariant ? RF.BackgroundVariant.Dots : 'dots', gap: 18, size: 1 }),
        React.createElement(MiniMap, { pannable: true, zoomable: true }),
        React.createElement(Controls, null),
        React.createElement(
          Panel,
          { position: 'top-right', className: 'atp-rf-panel-right' },
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
