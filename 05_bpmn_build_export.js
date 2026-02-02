try { console.log('[ATP][LOAD] 05_bpmn_build_export.js carregado com sucesso'); } catch (e) {}
/**
 * ATP MODULAR - 05_bpmn_build_export.js
 * Extraído de ATP-versao estavel com bpmno.js
 */


// ===== Layout Engine (Contrato Visual Único) =====
(function () {
  'use strict';

  const START_X = 120;
  const START_Y = 120;
  const H_GAP   = 220;
  const V_GAP   = 110;
  const NODE_W  = 140;
  const NODE_H  = 70;

  // Portas contextuais (não forçar lateral sempre)
  const PORT_PAD = 10;
  const MIN_H_SEG = 40;
  const EDGE_BEND_PAD = 18;

  const center = (b) => ({ x: b.x + b.w/2, y: b.y + b.h/2 });
  const portPoint = (b, side) => {
    if (side === 'left')   return { x: b.x - PORT_PAD,     y: b.y + b.h/2 };
    if (side === 'right')  return { x: b.x + b.w + PORT_PAD, y: b.y + b.h/2 };
    if (side === 'top')    return { x: b.x + b.w/2, y: b.y - PORT_PAD };
    if (side === 'bottom') return { x: b.x + b.w/2, y: b.y + b.h + PORT_PAD };
    return { x: b.x + b.w + PORT_PAD, y: b.y + b.h/2 };
  };

  function pickPorts(srcB, tgtB) {
    const s = center(srcB), t = center(tgtB);
    const dx = t.x - s.x;
    const dy = t.y - s.y;

    // Heurística: se vertical domina, usar top/bottom; senão left/right
    if (Math.abs(dy) > Math.max(35, Math.abs(dx) * 0.6)) {
      if (dy > 0) return { out: 'bottom', inp: 'top' };
      return { out: 'top', inp: 'bottom' };
    }
    if (dx >= 0) return { out: 'right', inp: 'left' };
    return { out: 'left', inp: 'right' };
  }

  function orthogonalWaypointsAuto(srcB, tgtB) {
    const p = pickPorts(srcB, tgtB);
    const s = portPoint(srcB, p.out);
    const t = portPoint(tgtB, p.inp);

    // Reta
    if (Math.round(s.x) === Math.round(t.x) || Math.round(s.y) === Math.round(t.y)) return [s, t];

    // L padrão (horizontal primeiro)
    let mid = { x: t.x, y: s.y };

    // Evitar dobra colada no alvo quando indo por L/R
    if (p.out === 'right' && p.inp === 'left') {
      let midX = Math.max(s.x + MIN_H_SEG, (s.x + t.x)/2);
      if (midX >= tgtB.x - EDGE_BEND_PAD) midX = Math.max(s.x + MIN_H_SEG, tgtB.x - EDGE_BEND_PAD);
      return [{x:s.x,y:s.y},{x:midX,y:s.y},{x:midX,y:t.y},{x:t.x,y:t.y}];
    }

    return [s, mid, t];
  }

  function computeLayoutSymmetric(flow) {
    const outgoing = {}, incoming = {}, level = {}, pos = {};
    for (const n of flow.nodes) { outgoing[n.id] = []; incoming[n.id] = []; }
    for (const e of flow.edges) {
      if (!outgoing[e.from]) outgoing[e.from] = [];
      if (!incoming[e.to]) incoming[e.to] = [];
      outgoing[e.from].push(e.to);
      incoming[e.to].push(e.from);
    }

    // Entradas (sem incoming)
    const entryIds = flow.nodes.map(n => n.id).filter(id => (incoming[id]||[]).length === 0);
    if (!entryIds.length && flow.nodes.length) entryIds.push(flow.nodes[0].id);

    // BFS colunas
    const q = [...entryIds];
    for (const id of entryIds) level[id] = 0;
    while (q.length) {
      const id = q.shift();
      for (const to of (outgoing[id]||[])) {
        if (level[to] == null) { level[to] = (level[id] ?? 0) + 1; q.push(to); }
      }
    }

    // DFS ordem (proximidade)
    const execIndex = {};
    let counter = 0;
    const visiting = new Set(), visited = new Set();
    function dfs(id) {
      if (visited.has(id) || visiting.has(id)) return;
      visiting.add(id);
      if (execIndex[id] == null) execIndex[id] = counter++;
      for (const to of (outgoing[id]||[])) dfs(to);
      visiting.delete(id);
      visited.add(id);
    }
    entryIds.forEach(dfs);
    for (const n of flow.nodes) if (execIndex[n.id] == null) execIndex[n.id] = counter++;

    const proximityScore = (id) => {
      let s = execIndex[id] * 10;
      for (const p of (incoming[id]||[])) s += Math.abs((execIndex[id]||0) - (execIndex[p]||0));
      for (const c of (outgoing[id]||[])) s += Math.abs((execIndex[c]||0) - (execIndex[id]||0));
      return s;
    };

    // gateway blocks (fan-out) — SIMÉTRICO
    const blocks = {};
    const typeById = {};
    for (const n of flow.nodes) typeById[n.id] = n.type || 'task';

    for (const n of flow.nodes) {
      if (typeById[n.id] === 'gateway' && (outgoing[n.id]||[]).length > 1) {
        const targets = (outgoing[n.id]||[]).slice().sort((a,b)=>proximityScore(a)-proximityScore(b));
        blocks[n.id] = targets;
      }
    }

    // colunas
    const columns = {};
    for (const n of flow.nodes) {
      const col = level[n.id] ?? 0;
      (columns[col] ||= []).push(n.id);
    }
    const cols = Object.keys(columns).map(Number).sort((a,b)=>a-b);

    for (const col of cols) {
      let cursorY = START_Y;

      const gatewaysHere = columns[col]
        .filter(id => blocks[id])
        .sort((a,b)=>proximityScore(a)-proximityScore(b));

      for (const gwId of gatewaysHere) {
        pos[gwId] = { x: START_X + col*H_GAP, y: cursorY, w: NODE_W, h: NODE_H };

        const targets = blocks[gwId];
        const blockX = START_X + (col+1)*H_GAP;
        const baseY = cursorY;

        const mid = Math.floor((targets.length - 1) / 2);
        for (let i=0;i<targets.length;i++) {
          const tId = targets[i];
          const off = (i - mid) * V_GAP; // simétrico
          pos[tId] = { x: blockX, y: baseY + off, w: NODE_W, h: NODE_H };
        }

        // avança cursor para o "envelope" do bloco
        const span = (targets.length ? (targets.length-1) : 0) * V_GAP;
        cursorY += Math.max(V_GAP, span + (V_GAP*1.3));
      }

      const freeIds = columns[col]
        .filter(id => !pos[id] && !blocks[id])
        .sort((a,b)=>proximityScore(a)-proximityScore(b));

      for (const id of freeIds) {
        pos[id] = { x: START_X + col*H_GAP, y: cursorY, w: NODE_W, h: NODE_H };
        cursorY += V_GAP;
      }
    }

    return pos;
  }

  function parseBpmnToFlowModel(doc) {
    const ns = { bpmn: 'http://www.omg.org/spec/BPMN/20100524/MODEL' };
    const proc = doc.getElementsByTagNameNS(ns.bpmn, 'process')[0] || null;

    const nodes = [];
    const nodeTypeById = {};
    const addNodes = (tag, type) => {
      const els = (proc ? proc.getElementsByTagNameNS(ns.bpmn, tag) : doc.getElementsByTagNameNS(ns.bpmn, tag));
      for (const el of Array.from(els)) {
        const id = el.getAttribute('id');
        if (!id || nodeTypeById[id]) continue;
        nodeTypeById[id] = type;
        nodes.push({ id, type });
      }
    };

    addNodes('startEvent', 'start');
    addNodes('endEvent', 'end');
    addNodes('exclusiveGateway', 'gateway');
    addNodes('inclusiveGateway', 'gateway');
    addNodes('parallelGateway', 'gateway');
    // tasks
    ['serviceTask','task','userTask','scriptTask','subProcess'].forEach(t=>addNodes(t,'task'));

    const edges = [];
    const sfs = proc ? proc.getElementsByTagNameNS(ns.bpmn, 'sequenceFlow') : doc.getElementsByTagNameNS(ns.bpmn, 'sequenceFlow');
    for (const sf of Array.from(sfs)) {
      const from = sf.getAttribute('sourceRef');
      const to   = sf.getAttribute('targetRef');
      if (from && to) edges.push({ from, to });
    }

    const known = new Set(nodes.map(n=>n.id));
    for (const e of edges) {
      if (!known.has(e.from)) { nodes.push({id:e.from, type:'task'}); known.add(e.from); }
      if (!known.has(e.to))   { nodes.push({id:e.to, type:'task'}); known.add(e.to); }
    }

    return { nodes, edges };
  }

  function rewriteDiagramDI(doc, layout) {
    const NS = {
      bpmndi: 'http://www.omg.org/spec/BPMN/20100524/DI',
      dc: 'http://www.omg.org/spec/DD/20100524/DC',
      di: 'http://www.omg.org/spec/DD/20100524/DI'
    };

    const shapes = Array.from(doc.getElementsByTagNameNS(NS.bpmndi, 'BPMNShape'));
    for (const sh of shapes) {
      const bpmnEl = sh.getAttribute('bpmnElement');
      const b = bpmnEl ? layout[bpmnEl] : null;
      if (!b) continue;
      const bounds = sh.getElementsByTagNameNS(NS.dc, 'Bounds')[0];
      if (!bounds) continue;
      bounds.setAttribute('x', String(Math.round(b.x)));
      bounds.setAttribute('y', String(Math.round(b.y)));
      bounds.setAttribute('width', String(Math.round(b.w)));
      bounds.setAttribute('height', String(Math.round(b.h)));
    }

    const getB = (id) => layout[id] || null;

    const edges = Array.from(doc.getElementsByTagNameNS(NS.bpmndi, 'BPMNEdge'));
    for (const ed of edges) {
      const flowId = ed.getAttribute('bpmnElement');
      if (!flowId) continue;

      // localizar o sequenceFlow correspondente
      let sf = null;
      try {
        // CSS.escape pode falhar em alguns contextos; fallback simples
        const esc = (window.CSS && CSS.escape) ? CSS.escape(flowId) : flowId.replace(/"/g,'\\"');
        sf = doc.querySelector('sequenceFlow[id="'+esc+'"]');
      } catch (e) {
        // fallback manual
        const sfs = Array.from(doc.getElementsByTagName('sequenceFlow'));
        sf = sfs.find(x=>x.getAttribute('id')===flowId) || null;
      }
      if (!sf) continue;

      const src = sf.getAttribute('sourceRef');
      const tgt = sf.getAttribute('targetRef');
      const srcB = src ? getB(src) : null;
      const tgtB = tgt ? getB(tgt) : null;
      if (!srcB || !tgtB) continue;

      const wps = orthogonalWaypointsAuto(srcB, tgtB);

      const old = Array.from(ed.getElementsByTagNameNS(NS.di, 'waypoint'));
      old.forEach(n => n.parentNode.removeChild(n));

      for (const p of wps) {
        const wp = doc.createElementNS(NS.di, 'di:waypoint');
        wp.setAttribute('x', String(Math.round(p.x)));
        wp.setAttribute('y', String(Math.round(p.y)));
        ed.appendChild(wp);
      }
    }
  }

  function applyUniqueLayout(xml) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'application/xml');
      if (doc.getElementsByTagName('parsererror').length) return xml;

      const flow = parseBpmnToFlowModel(doc);
      const layout = computeLayoutSymmetric(flow);

      rewriteDiagramDI(doc, layout);

      const serializer = new XMLSerializer();
      return serializer.serializeToString(doc);
    } catch (e) {
      try { console.warn('[ATP][LAYOUT] Falha ao aplicar layout único:', e); } catch (_) {}
      return xml;
    }
  }

  // expõe para o builder
  window.__ATP_UNIQUE_LAYOUT__ = window.__ATP_UNIQUE_LAYOUT__ || {};
  window.__ATP_UNIQUE_LAYOUT__.apply = applyUniqueLayout;

  try { console.log('[ATP][LAYOUT] Layout Único (Opção A) pronto'); } catch (e) {}
})();


function atpBuildFluxosBPMN(rules, opts) { // Constrói fluxos bpmn.
  opts = opts || {};
  try {
    // ============================================================
    // BPMN 2.0 + BPMNDI (Bizagi) — CADA FLUXO EM UMA POOL
    // - Um participant/pool + um process por "início" estrutural
    // - Nó = Localizador (Task)
    // - Aresta = Regra (SequenceFlow) REMOVER -> INCLUIR
    // - Gateway exclusivo quando um localizador tem múltiplas saídas
    // - Layout L->R por níveis (BFS), pools empilhadas verticalmente
    //
    // IMPORTANTE: usa o shape do parseRules():
    //   r.localizadorRemover = { canonical, clauses[] }
    //   r.localizadorIncluirAcao = { canonical, clauses[], acoes[] }
    // ============================================================

    if (!Array.isArray(rules) || !rules.length) return null;

    // Sanitiza texto para XML 1.0 (remove caracteres inválidos / surrogates soltos)
const xmlEsc = (s) => xmlSanitize(s) // Executa xml esc.
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

    const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); // Executa norm.

    const getRuleLabel = (r) => { // Obtém a regra label.
      const num = (r && (r.num || r.numero || r.id || '')) + '';

      // Tipo de Controle / Critério (preferir canonical)
      const tipo = norm(r && (r.tipoControleCriterio?.canonical || r.tipoControleCriterio?.text || r.tipoControleCriterio || r.tipoControle || r.tipo || r.criterio || r.gatilho || ''));

      // Outros Critérios (k=v) — filtra campos internos e serializa Sets/Objects com segurança
      const IGNORE_KEYS = new Set(['clauses','groups','map','canonical','raw','text','expr','expression']);
      const seenKV = new Set();
      const partsOutros = [];

      try {
        const outros = (r && r.outrosCriterios && typeof r.outrosCriterios === 'object') ? r.outrosCriterios : null;
        for (const [k, v] of Object.entries(outros || {})) {
          const kkRaw = norm(String(k || ''));
          if (!kkRaw) continue;
          const kk = kkRaw.toLowerCase();
          if (IGNORE_KEYS.has(kk)) continue;

          const vv = valToStr(v);
          if (!vv) continue;

          const sig = kk + '=' + vv;
          if (seenKV.has(sig)) continue;
          seenKV.add(sig);

          partsOutros.push(`${kkRaw}=${vv}`);
        }
      } catch (e) {}

      const parts = [];
      parts.push(('REGRA ' + num).trim());
      if (tipo) parts.push('Tipo/Critério: ' + tipo);
      const outrosHuman = atpHumanizeOutrosCriteriosExpr(r && r.outrosCriterios);
      if (outrosHuman) parts.push('Outros Critérios: ' + outrosHuman);

      // IMPORTANTE:
      // - Retornamos o texto COMPLETO aqui.
      // - O truncamento (se necessário) deve ser aplicado apenas no atributo name do BPMN,
      //   preservando o texto integral em <bpmn:documentation> (para tooltip/hover e auditoria).
      return parts.join(' — ').trim();
    };

    // Truncamento Bizagi-safe para atributos name (sem perder o texto integral)
    // Documentação pode ser maior, mas ainda colocamos um teto por segurança.
    // ---- Build global graph (MESMA LÓGICA/CHAVES DO TXT)
    const allFrom = new Set();
    const allTo   = new Set();
    const outGlobal = new Map(); // fromKey -> Set(toKey)
    const edgeMeta  = new Map(); // "from||to" -> Array<labels>

    for (const r of (rules || [])) {
      // IMPORTANTE: usa exatamente as mesmas chaves do TXT (clauses -> atpClauseKey)
      const fromKeys = atpClausesToKeys(r && r.localizadorRemover);
      const toKeys   = atpClausesToKeys(r && r.localizadorIncluirAcao);

      for (const fk of fromKeys) {
        const fromK = norm(fk);
        if (!fromK) continue;

        allFrom.add(fromK);
        if (!outGlobal.has(fromK)) outGlobal.set(fromK, new Set());

        for (const tk of toKeys) {
          const toK = norm(tk);
          if (!toK) continue;

          allTo.add(toK);
          outGlobal.get(fromK).add(toK);

          const key = fromK + '||' + toK;
          const arr = edgeMeta.get(key) || [];
          arr.push(getRuleLabel(r));
          edgeMeta.set(key, arr);
        }
      }
    }



    // ------------------------------------------------------------
    // Continuidade implícita por refinamento AND (E/&&) — igual ao TXT
    // Ex.: se existe REMOVER "A && B" e existe algum ponto que INCLUI "A", então adicionamos aresta implícita A -> (A && B)
    // para que (A && B) não vire um novo início e para que o BPMN desenhe o garfo como continuação do nó-base.
    // ------------------------------------------------------------
    const __fromSnapshot2 = Array.from(allFrom);
    for (const child of __fromSnapshot2) {
      if (String(child).indexOf('&&') === -1) continue;
      const base = __atpPickBestBaseKey2(child, allFrom, allTo);
      if (!base || base === child) continue;

      if (!allFrom.has(base)) allFrom.add(base);
      if (!outGlobal.has(base)) outGlobal.set(base, new Set());

      outGlobal.get(base).add(child);
      allTo.add(child);

      const key = base + '||' + child;
      const arr = edgeMeta.get(key) || [];
      // etiqueta especial para diferenciar de regras reais
      if (!arr.includes('REFINAMENTO (E/&&)')) arr.push('REFINAMENTO (E/&&)');
      edgeMeta.set(key, arr);
    }
    // Ordenação determinística (igual ao TXT): chaves em pt-BR e starts derivados nessa mesma ordem
    const allKeys = Array.from(allFrom).sort((a,b)=>String(a).localeCompare(String(b), 'pt-BR'));

    // Detecta inícios exatamente como no TXT: FROM que não é TO
    let starts = allKeys.filter(k => !allTo.has(k));
    if (!starts.length) starts = allKeys.slice();
// Monta fluxos na mesma ordem/critério do TXT (assigned + expansão)
    const assigned = new Set();
    const fluxos = [];
    const expandFrom = (startKey) => { // Executa expand from.
      const q = [startKey];
      const vis = new Set([startKey]);
      while (q.length) {
        const u = q.shift();
        const outs = outGlobal.get(u);
        if (!outs) continue;
        for (const v of outs) {
          // MESMA LÓGICA DO TXT: só expande para nós que também são origem (allFrom)
          if (!v) continue;
          if (!vis.has(v) && allFrom.has(v)) { vis.add(v); q.push(v); }
        }
      }
      return vis;
    };

    for (const st of starts) {
      if (assigned.has(st)) continue;
      const nodes = expandFrom(st);
      for (const n of nodes) assigned.add(n);
      fluxos.push({ starts: [st], nodes });
    }
    // Sobras (ciclos sem início)
    for (const k of allKeys) {
      if (assigned.has(k)) continue;
      const nodes = expandFrom(k);
      for (const n of nodes) assigned.add(n);
      fluxos.push({ starts: [k], nodes });
    }

    // Adiciona nós terminais (destinos que NÃO são origem) ao mesmo fluxo,
    // sem expandir, para o BPMN refletir o agrupamento do TXT e ainda desenhar os fins.
    for (const fl of fluxos) {
      const full = new Set(fl.nodes);
      for (const u of fl.nodes) {
        const outs = outGlobal.get(u);
        if (!outs) continue;
        for (const v of outs) {
          if (!v) continue;
          if (!full.has(v) && !allFrom.has(v)) full.add(v);
        }
      }
      fl.nodes = Array.from(full);
    }

    // subgraph signature to avoid duplicate pools (segurança extra)
    const flowSigs = new Set();


    // ============================================================
    // Modo ZIP: retorna 1 arquivo BPMN por fluxo (cada pool/processo isolado)
    // ============================================================
    if (opts && opts.splitFiles) {
      const files = [];
      let fileIndex = 0;

      const buildOne = (fluxo, idx) => { // Constrói one.
        // Cabeçalho
        const collabId1 = 'Collab_ATP_' + idx;
        const procId = 'Process_Fluxo_' + idx;
        const partId = 'Participant_Fluxo_' + idx;

        let x = '';
        x += '<?xml version="1.0" encoding="UTF-8"?>\n';
        x += '<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n';
        x += '  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"\n';
        x += '  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"\n';
        x += '  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"\n';
        x += '  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"\n';
        x += '  id="Definitions_ATP_' + idx + '" targetNamespace="http://tjsp.eproc/atp">\n';
        x += '  <bpmn:collaboration id="' + collabId1 + '">\n';

        const startName = (fluxo && fluxo.starts && fluxo.starts.length) ? String(fluxo.starts[0]) : ('Fluxo ' + idx);
        x += '    <bpmn:participant id="' + partId + '" name="Fluxo ' + idx + ' — ' + xmlEsc(startName) + '" processRef="' + procId + '"/>\n';
        x += '  </bpmn:collaboration>\n';
        x += '  <bpmn:process id="' + procId + '" isExecutable="false">\n';

        // ---- Nós e arestas (reuso da lógica do builder principal)
        const nodes = Array.from((fluxo && fluxo.nodes) ? fluxo.nodes : []);
        // nodeSet (origens) segue a lógica do TXT: apenas localizadores que são origem (REMOVER).
        const nodeSet = new Set(nodes);

        // Para o BPMN ficar tão "completo" quanto o TXT, precisamos também desenhar os destinos
        // que NÃO são origem (nós terminais): o TXT lista as regras e mostra o "VAI PARA" mesmo
        // quando não há continuação. Aqui, criamos tasks para esses destinos e conectamos as arestas,
        // mas NÃO expandimos o fluxo a partir deles.
        const terminalSet = new Set();
        for (const n of nodes) {
          const outs = outGlobal.get(n);
          if (!outs) continue;
          for (const t of outs) {
            if (!t) continue;
            if (!nodeSet.has(t)) terminalSet.add(t);
          }
        }
        const nodesAll = nodes.concat(Array.from(terminalSet));
        const nodeSetAll = new Set(nodesAll);
const startId = 'Start_' + procId;
        x += '    <bpmn:startEvent id="' + startId + '" name="Início"/>\n';

        // tasks por localizador
        const taskIdByNode = new Map();
        for (const n of nodesAll) {
          const tid = makeId('Task_' + procId, n);
          taskIdByNode.set(n, tid);
          x += '    <bpmn:task id="' + tid + '" name="' + xmlEsc(n) + '"/>\n';
        }


// gateways: quando múltiplas saídas (ou múltiplas regras para o mesmo destino)
// IMPORTANTE: se há 1 único destino, mas 2+ regras (labels) para o mesmo par from->to,
// também precisamos de gateway, senão perderíamos regras (165/166 etc.).
const gwIdByNode = new Map();
const outLocal = new Map();
for (const n of nodes) {
  const outs = outGlobal.get(n);
  const arr = outs ? Array.from(outs).filter(t => nodeSetAll.has(t)) : [];
  outLocal.set(n, arr);

  // conta "ramos" = soma dos labels por destino (mínimo 1 por destino)
  let branches = 0;
  for (const t of arr) {
    const labels = edgeMeta.get(n + '||' + t) || [];
    branches += Math.max(1, labels.length);
  }

  if (branches > 1) {
    const gid = makeId('Gw_' + procId, n);
    gwIdByNode.set(n, gid);
    x += '    <bpmn:exclusiveGateway id="' + gid + '" name="Decisão"/>';
  }
}

// ends para nós sem saída

        let endCount = 0;
        const endIdByNode = new Map();
        for (const n of nodesAll) {
          const outs = outGlobal.get(n);
          const arr = outs ? Array.from(outs).filter(t => nodeSetAll.has(t)) : [];
          if (!arr.length) {
            endCount++;
            const eid = 'End_' + procId + '_' + endCount;
            endIdByNode.set(n, eid);
            x += '    <bpmn:endEvent id="' + eid + '" name="Fim"/>\n';
          }
        }


// ServiceTasks (entre decisão/gateway e localizador destino)
// Nesta versão, SEMPRE criamos uma serviceTask para cada regra (label),
// inclusive quando múltiplas regras apontam para o mesmo destino.
const svcTaskMeta = new Map();    // id -> {from,to,label}
const svcIdsByEdge = new Map();   // "from||to" -> Array<svcId>

let svcCount = 0;
for (const from of nodesAll) {
  const outs = outGlobal.get(from);
  if (!outs) continue;

  for (const to of outs) {
    if (!nodeSetAll.has(to)) continue;

    const labels = edgeMeta.get(from + '||' + to) || [];
    const labs = labels.length ? labels : ['REGRA ?'];

    for (let li = 0; li < labs.length; li++) {
      svcCount++;
      // id único e estável: inclui contador + hash simples da regra (quando houver)
      const sid = 'Svc_' + procId + '_' + svcCount;
      const label = labs[li];

      svcTaskMeta.set(sid, { from, to, label });
      const k = from + '||' + to;
      const arr = svcIdsByEdge.get(k) || [];
      arr.push(sid);
      svcIdsByEdge.set(k, arr);

      // name truncado para não estourar visual/importadores; texto completo vai em documentation
      const fullLabel = String(label == null ? '' : label);
      const shortLabel = truncateBpmnName(fullLabel, 420);
      const docLabel = truncateBpmnDoc(fullLabel, 5000);

      x += '    <bpmn:serviceTask id="' + sid + '" name="' + xmlEsc(shortLabel) + '">\n';
      x += '      <bpmn:documentation>' + xmlEsc(docLabel) + '</bpmn:documentation>\n';
      x += '    </bpmn:serviceTask>\n';
    }
  }
}

// flows

        let flowCount = 0;
        const edgesForDI = []; // {id, src, dst}
        const addFlow = (srcId, dstId, name) => { // Adiciona o fluxo.
          flowCount++;
          const fid = 'Flow_' + procId + '_' + flowCount;
          x += '    <bpmn:sequenceFlow id="' + fid + '" sourceRef="' + srcId + '" targetRef="' + dstId + '"' + (name ? (' name="' + xmlEsc(name) + '"') : '') + '/>\n';
          edgesForDI.push({ id: fid, src: srcId, dst: dstId });
        };

        // Start -> (cada start do fluxo)
        const startsList = (fluxo && fluxo.starts && fluxo.starts.length) ? fluxo.starts : (nodes.length ? [nodes[0]] : []);
        for (const st of startsList) {
          if (!taskIdByNode.has(st)) continue;
          addFlow(startId, taskIdByNode.get(st), '');
        }


// Node -> (gateway?) -> targets
        for (const from of nodes) {
          const outs = outLocal.get(from) || [];
          const fromTaskId = taskIdByNode.get(from);
          const gwId = gwIdByNode.get(from);

          if (gwId) {
            // Task -> Gateway
            addFlow(fromTaskId, gwId, '');

            // Gateway -> (uma serviceTask por regra) -> Destino
            for (const to of outs) {
              const toTaskId = taskIdByNode.get(to);
              const edgeKey = from + '||' + to;
              const svcIds = svcIdsByEdge.get(edgeKey) || [];

              // Se por algum motivo não existir, ainda assim liga direto
              if (!svcIds.length) {
                addFlow(gwId, toTaskId, '');
                continue;
              }

              for (const sid of svcIds) {
                addFlow(gwId, sid, '');
                addFlow(sid, toTaskId, '');
              }
            }
          } else {
            // Sem gateway: deve haver apenas 1 "ramo" (1 destino com 1 regra),
            // mas ainda assim desenhamos Task -> ServiceTask -> Destino.
            if (outs.length) {
              for (const to of outs) {
                const toTaskId = taskIdByNode.get(to);
                const edgeKey = from + '||' + to;
                const svcIds = svcIdsByEdge.get(edgeKey) || [];

                if (svcIds.length) {
                  // Em modo sem gateway, usamos o primeiro (há só 1).
                  const sid = svcIds[0];
                  addFlow(fromTaskId, sid, '');
                  addFlow(sid, toTaskId, '');
                } else {
                  // fallback
                  addFlow(fromTaskId, toTaskId, '');
                }
              }
            } else {
              const eid = endIdByNode.get(from);
              if (eid) addFlow(fromTaskId, eid, '');
            }
          }
        }

        x += '  </bpmn:process>';


        // ---- BPMNDI (grid simples)
        x += '  <bpmndi:BPMNDiagram id="BPMNDiagram_' + procId + '">\n';
        x += '    <bpmndi:BPMNPlane id="BPMNPlane_' + procId + '" bpmnElement="' + collabId1 + '">\n';

        // Pool bounds / layout grid
        const padX = 40, padY = 40;

        const nodeW = 240, nodeH = 80;     // tasks (localizadores)
        const gwW = 50, gwH = 50;          // gateway
        const svcW = 220, svcH = 60;       // serviceTask (informações da regra)

        // Espaçamento padrão (Bizagi-safe)
        const GAP = 100; // >= 100px horizontal e vertical
        function applyHorizontalGap(x, gap) { return Math.round(x + (gap || GAP)); } // Aplica horizontal gap.
        const gapX = GAP, gapY = GAP;

        // Largura de uma "coluna" de nível: Task -> Gateway -> ServiceTask -> (respiro até a próxima Task)
        // Isso evita gateway/servicetask colidirem com tasks do nível seguinte.
        const COL_W = nodeW + GAP + gwW + GAP + svcW + GAP;
        const bandGap = nodeH + GAP;

        // ==============================
        // LAYOUT (Camadas / Horizontal-first)
        //
        // Por que existe: o layout em "árvore por decisão" pode explodir a altura
        // quando há muitos ramos (ou quando refinamentos AND viram subárvores).
        //
        // Nova estratégia (Bizagi-safe):
        // - calcula "níveis" (longest path) no grafo de localizadores do fluxo
        // - posiciona por colunas (X cresce por nível)
        // - empilha por nível (Y compacto), deixando o diagrama predominantemente horizontal
        // - gateways e serviceTasks ficam entre colunas, alinhados ao Y do ramo
        //
        // OBS: isto NÃO muda a lógica do fluxo; apenas a geometria no BPMNDI.
        // ==============================

        const END_W = 36, END_H = 36;

        // Pré-cálculo: para cada origem, lista de ramos (1 ramo por regra/serviceTask)
        // ramo = { sid, to, isRefine }
        const branchesByFrom = new Map();
        function getBranches(from) { // Obtém o branches.
          if (branchesByFrom.has(from)) return branchesByFrom.get(from);
          const outs = outLocal.get(from) || [];
          const arr = [];
          for (const to of outs) {
            const edgeKey = String(from) + '||' + String(to);
            const svcIds = svcIdsByEdge.get(edgeKey) || [];
            const __labs = edgeMeta.get(edgeKey) || [];
            const __isRefine = Array.isArray(__labs) && __labs.includes('REFINAMENTO (E/&&)');
            if (svcIds && svcIds.length) {
              for (const sid of svcIds) arr.push({ sid, to, isRefine: __isRefine });
            } else {
              arr.push({ sid: null, to, isRefine: __isRefine });
            }
          }
          branchesByFrom.set(from, arr);
          return arr;
        }

        // Posições (shapes)
        const posNode = new Map(); // nodeName -> {x,y} (task bounds)
        const gwPos = new Map();   // gatewayId -> {x,y,w,h}
        const svcPos = new Map();  // serviceTaskId -> {x,y,w,h}
        const endPos = new Map();  // endEventId -> {x,y,w,h}

        let maxX = 0, maxY = 0;
        function setBoundsMax(x0, y0, w0, h0) { // Define o bounds max.
          maxX = Math.max(maxX, x0 + w0);
          maxY = Math.max(maxY, y0 + h0);
        }

        // ------------------------------
        // 1) Níveis (longest path)
        // ------------------------------
        const __nodeSet = new Set(nodesAll || []);

        // Trabalha apenas com nós alcançáveis a partir dos starts do fluxo (evita coluna única gigante)
        const __roots = (fluxo && fluxo.starts && fluxo.starts.length) ? Array.from(fluxo.starts).filter(n => __nodeSet.has(n)) : [];
        const __reach = new Set();
        const __rq = [];
        for (const r of (__roots.length ? __roots : (nodesAll && nodesAll.length ? [nodesAll[0]] : []))) {
          if (r && __nodeSet.has(r) && !__reach.has(r)) { __reach.add(r); __rq.push(r); }
        }
        while (__rq.length) {
          const u = __rq.shift();
          const outs = outLocal.get(u) || [];
          for (const v of outs) {
            if (!v || !__nodeSet.has(v) || __reach.has(v)) continue;
            __reach.add(v);
            __rq.push(v);
          }
        }
        const indeg = new Map();
        const adj = new Map();
        for (const n of __reach) {
          indeg.set(n, 0);
          adj.set(n, []);
        }
        for (const u of __reach) {
          const outs = outLocal.get(u) || [];
          for (const v of outs) {
            if (!__nodeSet.has(v)) continue;
            adj.get(u).push(v);
            indeg.set(v, (indeg.get(v) || 0) + 1);
          }
        }

        // Kahn topo (com fallback estável)
        const q = [];
        for (const n of __reach) if ((indeg.get(n) || 0) === 0) q.push(n);
        // Se tudo estiver em ciclo, escolhe um nó qualquer como "start"
        if (!q.length && nodesAll && nodesAll.length) q.push(nodesAll[0]);

        const topo = [];
        const indeg2 = new Map(indeg);
        while (q.length) {
          const u = q.shift();
          if (!__reach.has(u)) continue;
          if (topo.includes(u)) continue;
          topo.push(u);
          for (const v of (adj.get(u) || [])) {
            indeg2.set(v, (indeg2.get(v) || 0) - 1);
            if ((indeg2.get(v) || 0) === 0) q.push(v);
          }
        }
        // Acrescenta os que ficaram (ciclos/resíduos)
        for (const n of __reach) if (!topo.includes(n)) topo.push(n);

        const level = new Map();
        for (const n of topo) level.set(n, 0);
        for (const u of topo) {
          const lu = level.get(u) || 0;
          for (const v of (adj.get(u) || [])) {
            level.set(v, Math.max(level.get(v) || 0, lu + 1));
          }
        }

        let maxLevel = 0;
        for (const n of __reach) maxLevel = Math.max(maxLevel, level.get(n) || 0);

        // Agrupa por nível
        const byLevel = Array.from({length: maxLevel + 1}, () => []);
        for (const n of topo) {
          const l = level.get(n) || 0;
          byLevel[l].push(n);
        }

        // ------------------------------
        // 2) Posicionamento (compacto)
        // ------------------------------
        const startX0 = padX + 40;
        const baseXTask = applyHorizontalGap(startX0 + 36, GAP);

        // altura por coluna = qtd máxima de nós em qualquer nível
        const maxRows = Math.max(1, ...byLevel.map(arr => arr.length || 0));
        const colHeight = (maxRows * nodeH) + ((maxRows - 1) * gapY);

        for (let l = 0; l < byLevel.length; l++) {
          const col = byLevel[l];
          const xTask = baseXTask + (l * COL_W);
          // centraliza a coluna no pool
          const topY = padY + 60 + Math.max(0, Math.floor((colHeight - ((col.length * nodeH) + ((col.length - 1) * gapY))) / 2));
          for (let i = 0; i < col.length; i++) {
            const n = col[i];
            if (!taskIdByNode.has(n)) continue;
            const y = topY + i * (nodeH + gapY);
            posNode.set(n, { x: Math.round(xTask), y: Math.round(y) });
            setBoundsMax(xTask, y, nodeW, nodeH);
          }
        }

        // Gateways e ServiceTasks
        // - gateway (se houver 2+ saídas) fica entre colunas
        // - serviceTask fica após gateway (ou após task se não houver gateway)
        // - empilha serviceTasks do mesmo edge com pequeno offset para não colidir
        const svcStackByEdge = new Map();
        function nextSvcOffset(edgeKey) { // Executa next svc offset.
          const c = svcStackByEdge.get(edgeKey) || 0;
          svcStackByEdge.set(edgeKey, c + 1);
          // offset vertical pequeno, Bizagi-safe
          return (c - 0) * Math.min(24, Math.floor(gapY/4));
        }

        for (const from of nodeSet) {
          if (!posNode.has(from)) continue;
          const pFrom = posNode.get(from);
          const br = getBranches(from);
          const outs = outLocal.get(from) || [];

          const hasGw = outs.length >= 2;
          if (hasGw) {
            const gid = gwIdByNode.get(from);
            if (gid) {
              const gx = applyHorizontalGap(pFrom.x + nodeW, GAP);
              const gy = Math.round(pFrom.y + (nodeH/2) - (gwH/2));
              gwPos.set(gid, { x: gx, y: gy, w: gwW, h: gwH });
              setBoundsMax(gx, gy, gwW, gwH);
            }
          }

          for (const b of br) {
            const to = b.to;
            if (!to || !posNode.has(to)) continue;
            const pTo = posNode.get(to);
            const midY = Math.round(((pFrom.y + nodeH/2) + (pTo.y + nodeH/2)) / 2);

            const edgeKey = String(from) + '||' + String(to);
            const off = nextSvcOffset(edgeKey);

            // x do serviceTask: entre gateway e destino
            const gx0 = hasGw ? applyHorizontalGap(pFrom.x + nodeW, GAP) : null;
            const xSvc = hasGw
              ? applyHorizontalGap(gx0 + gwW, GAP)
              : applyHorizontalGap(pFrom.x + nodeW, GAP);
            const ySvc = Math.round(midY - svcH/2 + off);

            if (b.sid) {
              svcPos.set(b.sid, { x: xSvc, y: ySvc, w: svcW, h: svcH });
              setBoundsMax(xSvc, ySvc, svcW, svcH);
            }
          }

          // EndEvent para terminais
          if (!outs.length) {
            const eid = endIdByNode.get(from);
            if (eid) {
              const ex = applyHorizontalGap(pFrom.x + nodeW, GAP);
              const ey = Math.round(pFrom.y + (nodeH/2) - (END_H/2));
              endPos.set(eid, { x: ex, y: ey, w: END_W, h: END_H });
              setBoundsMax(ex, ey, END_W, END_H);
            }
          }
        }

        // maxY: pelo menos o tamanho da coluna
        maxY = Math.max(maxY, padY + 60 + colHeight + padY);

// Ajuste de altura do pool: quando há múltiplas serviceTasks (múltiplas regras) para o mesmo REMOVER→INCLUIR,
        // nós "espalhamos" verticalmente as serviceTasks para não empilhar. Reserve altura extra para não cortar o diagrama.
        let __maxSvcStack = 1;
        try {
          const __tmp = new Map(); // pair -> count
          for (const meta of (svcTaskMeta ? svcTaskMeta.values() : [])) {
            if (!meta || !meta.from || !meta.to) continue;
            const k = String(meta.from) + '||' + String(meta.to);
            __tmp.set(k, (__tmp.get(k) || 0) + 1);
          }
          for (const v of __tmp.values()) __maxSvcStack = Math.max(__maxSvcStack, v || 1);
        } catch (e) {}
        // Shape: participant
        const poolW = Math.max(680, maxX - padX + 60);
        const poolH = Math.max(160, (maxY - padY + 60) + ((__maxSvcStack>1)?((__maxSvcStack-1)*(svcH+20)):0));
        x += '      <bpmndi:BPMNShape id="DI_' + partId + '" bpmnElement="' + partId + '">\n';
        x += '        <dc:Bounds x="' + padX + '" y="' + padY + '" width="' + poolW + '" height="' + poolH + '"/>\n';
        x += '      </bpmndi:BPMNShape>\n';
        // Shape: start (alinha verticalmente com o 1o no do fluxo)
        const startX = padX + 40;
        let startY = padY + 60;
        try {
          const __st0 = (startsOrdered && startsOrdered.length) ? startsOrdered[0] : ((startsList && startsList.length) ? startsList[0] : null);
          const __p0 = __st0 ? posNode.get(__st0) : null;
          if (__p0) startY = Math.round(__p0.y + (nodeH - 36) / 2);
        } catch (e) {}
        x += '      <bpmndi:BPMNShape id="DI_' + startId + '" bpmnElement="' + startId + '">\n';
        x += '        <dc:Bounds x="' + startX + '" y="' + startY + '" width="36" height="36"/>\n';
        x += '      </bpmndi:BPMNShape>\n';

        // Shapes: tasks
        for (const n of nodesAll) {
          const tid = taskIdByNode.get(n);
          const p = posNode.get(n) || { x: padX + 280, y: padY + 60 };
          x += '      <bpmndi:BPMNShape id="DI_' + tid + '" bpmnElement="' + tid + '">\n';
          x += '        <dc:Bounds x="' + p.x + '" y="' + p.y + '" width="' + nodeW + '" height="' + nodeH + '"/>\n';
          x += '      </bpmndi:BPMNShape>\n';
          if (gwIdByNode.has(n)) {
            const gid = gwIdByNode.get(n);
            const gp = (gwPos && gwPos.get(gid)) ? gwPos.get(gid) : null;
            const gx = gp ? gp.x : applyHorizontalGap(p.x + nodeW, GAP);
            const gy = gp ? gp.y : (p.y + (nodeH/2) - 25);
            x += '      <bpmndi:BPMNShape id="DI_' + gid + '" bpmnElement="' + gid + '">\n';
            x += '        <dc:Bounds x="' + gx + '" y="' + gy + '" width="' + gwW + '" height="' + gwH + '"/>\n';
            x += '      </bpmndi:BPMNShape>\n';
          }
          if (endIdByNode.has(n)) {
            const eid = endIdByNode.get(n);
            const ex = applyHorizontalGap(p.x + nodeW, GAP);
            const ey = Math.round(p.y + (nodeH - 36) / 2);
            x += '      <bpmndi:BPMNShape id="DI_' + eid + '" bpmnElement="' + eid + '">\n';
            x += '        <dc:Bounds x="' + ex + '" y="' + ey + '" width="36" height="36"/>\n';
            x += '      </bpmndi:BPMNShape>\n';
          }
        }
        // Shapes: service tasks (regras)
        for (const [sid, p0] of svcPos.entries()) {
          x += '      <bpmndi:BPMNShape id="DI_' + sid + '" bpmnElement="' + sid + '">\n';
          x += '        <dc:Bounds x="' + p0.x + '" y="' + p0.y + '" width="' + p0.w + '" height="' + p0.h + '"/>\n';
          x += '      </bpmndi:BPMNShape>\n';
        }

// ---- "Dock points" no DESTINO (porta na borda esquerda)
        // Objetivo: alinhar melhor a ServiceTask (REGRA) com a Task de destino.
        // Estratégia Bizagi-safe:
        //  - Para cada destino (Task/localizador), calculamos um ponto de entrada Y por serviceTask.
        //  - O ponto tenta ficar no mesmo Y do centro da serviceTask, mas é "clampado" dentro da altura do destino.
        //  - Para múltiplas entradas no mesmo destino, garantimos espaçamento mínimo entre portas.
        const __svcDockYBySid = new Map(); // sid -> dockY (entrada no destino)
        try {
          const DOCK_MARGIN = 12;
          const DOCK_MIN_GAP = 8;

          // agrupa serviceTasks por destino (meta.to)
          const byTo = new Map(); // toNode -> [sid]
          for (const [sid, meta] of svcTaskMeta.entries()) {
            if (!meta || !meta.to) continue;
            const t = String(meta.to);
            const arr = byTo.get(t) || [];
            arr.push(sid);
            byTo.set(t, arr);
          }

          for (const [toNode, sids] of byTo.entries()) {
            // bounds do destino (task localizador)
            const toTid = taskIdByNode.get(toNode);
            if (!toTid) continue;
            const tb = (function(){
              const p0 = posNode.get(toNode);
              if (!p0) return null;
              return { x: p0.x, y: p0.y, w: nodeW, h: nodeH };
            })();
            if (!tb) continue;
            const minY = tb.y + DOCK_MARGIN;
            const maxY = tb.y + tb.h - DOCK_MARGIN;

            // ordena pelo centroY da serviceTask (mantém a "leitura" vertical)
            const arr = (sids || []).slice().filter(id => svcPos.has(id));
            arr.sort((a,b)=>{
              const pa = svcPos.get(a); const pb = svcPos.get(b);
              const ya = pa ? (pa.y + pa.h/2) : 0;
              const yb = pb ? (pb.y + pb.h/2) : 0;
              return (ya - yb) || String(a).localeCompare(String(b));
            });

            // primeira passada: clamp + monotonic + gap
            const docks = [];
            for (let i=0;i<arr.length;i++) {
              const sid = arr[i];
              const sp = svcPos.get(sid);
              const desired = sp ? (sp.y + sp.h/2) : ((minY + maxY)/2);
              let dy = Math.max(minY, Math.min(maxY, desired));
              if (i > 0) dy = Math.max(dy, docks[i-1] + DOCK_MIN_GAP);
              docks.push(dy);
            }
            // segunda passada: se estourou maxY, empurra para cima mantendo gaps
            if (docks.length) {
              const overflow = docks[docks.length - 1] - maxY;
              if (overflow > 0) {
                for (let i=docks.length-1; i>=0; i--) {
                  docks[i] -= overflow;
                  if (i < docks.length-1) docks[i] = Math.min(docks[i], docks[i+1] - DOCK_MIN_GAP);
                  docks[i] = Math.max(docks[i], minY);
                }
              }
            }

            for (let i=0;i<arr.length;i++) __svcDockYBySid.set(arr[i], Math.round(docks[i]));
          }
        } catch (e) {}

// Edges (simples: linha reta)
        // ---- DI routing: assign a distinct "corridor" (midX) per outgoing edge of the same source
        // This avoids the "vertical bus" effect where multiple orthogonal connectors share the same midX.
        const ROUTE_MIN_CLEAR = 100;
        const ROUTE_CORRIDOR_GAP = 70; // horizontal separation between corridors

        const __diGetBoundsById = (function(){
          // returns {x,y,w,h} for any element id (task/serviceTask/gateway/start/end)
          return function(elId){
            // Start
            if (elId === startId) return { x: padX + 40, y: padY + 80, w: 36, h: 36 };
            // tasks (localizadores)
            for (let ii = 0; ii < nodes.length; ii++) {
              const n = nodes[ii];
              const tid = taskIdByNode.get(n);
              if (tid === elId) {
                const p0 = posNode.get(n) || { x: padX + 280, y: padY + 60 };
                return { x: p0.x, y: p0.y, w: nodeW, h: nodeH };
              }
            }
            // service tasks (regras)
            for (const [sid, s] of svcPos.entries()) {
              if (sid === elId) return { x: s.x, y: s.y, w: s.w, h: s.h };
            }
            // gateways
            for (const [n, gid] of gwIdByNode.entries()) {
              if (gid === elId) {
                const p = posNode.get(n) || { x: padX + 280, y: padY + 60 };
                const gp = (typeof gwPos !== 'undefined' && gwPos && gwPos.get(gid)) ? gwPos.get(gid) : null;
                if (gp) return { x: gp.x, y: gp.y, w: gp.w, h: gp.h };
                const gx = p.x + nodeW + gapX;
                const gy = p.y + (nodeH/2) - (gwH/2);
                return { x: gx, y: gy, w: gwW, h: gwH };
              }
            }
            // end events
            for (const [n, eid] of endIdByNode.entries()) {
              if (eid === elId) {
                const p = posNode.get(n) || { x: padX + 280, y: padY + 60 };
                const ex = applyHorizontalGap(p.x + nodeW, GAP);
                const ey = Math.round(p.y + (nodeH - 36) / 2);
                return { x: ex, y: ey, w: 36, h: 36 };
              }
            }
            // fallback
            return { x: padX + 280, y: padY + 60, w: 2, h: 2 };
          };
        })();

        const __diCorridorIndexByFlowId = new Map();
        const __diOutBySrc = new Map(); // srcId -> [{fid, ty}]

        // precompute targetY rank per source
        for (const e0 of edgesForDI) {
          const sb0 = __diGetBoundsById(e0.src);
          const tb0 = __diGetBoundsById(e0.dst);
          const fromC0 = { x: sb0.x + sb0.w/2, y: sb0.y + sb0.h/2 };
          const toC0   = { x: tb0.x + tb0.w/2, y: tb0.y + tb0.h/2 };
          const leftToRight0 = (toC0.x >= fromC0.x);
          const pA0 = { x: leftToRight0 ? (sb0.x + sb0.w) : sb0.x, y: sb0.y + sb0.h/2 };
          const pB0 = { x: leftToRight0 ? tb0.x : (tb0.x + tb0.w), y: tb0.y + tb0.h/2 };

          // Only allocate corridors when there is a vertical delta (the "bus" issue)
          const needsCorridor = Math.abs(pA0.y - pB0.y) > 1;
          if (!needsCorridor) {
            __diCorridorIndexByFlowId.set(e0.id, 0);
            continue;
          }

          const arr0 = __diOutBySrc.get(e0.src) || [];
          arr0.push({ fid: e0.id, ty: pB0.y });
          __diOutBySrc.set(e0.src, arr0);
        }

        for (const [srcId, arr] of __diOutBySrc.entries()) {
          arr.sort((a,b)=> (a.ty - b.ty));
          for (let i = 0; i < arr.length; i++) {
            __diCorridorIndexByFlowId.set(arr[i].fid, i);
          }
        }

        // centerOf: calcula centro do elemento a partir do bounds DI (função local, sem dependência global).
        const centerOf = (elId) => {
          const bb = __diGetBoundsById(elId);
          return { x: bb.x + bb.w / 2, y: bb.y + bb.h / 2 };
        };

        for (const e of edgesForDI) {
          const a = centerOf(e.src);
          const b = centerOf(e.dst);
          x += '      <bpmndi:BPMNEdge id="DI_' + e.id + '" bpmnElement="' + e.id + '">';

          // Waypoints somente pelas laterais (L/R), com dobra em "L"
          const sb = (function(elId){
            // tasks (localizadores)
            for (let ii = 0; ii < nodes.length; ii++) {
              const n = nodes[ii];
              const tid = taskIdByNode.get(n);
              if (tid === elId) {
                const p0 = posNode.get(n) || { x: padX + 280, y: padY + 60 };
                return { x: p0.x, y: p0.y, w: nodeW, h: nodeH };
              }
            }
            // service tasks (regras)
            for (const [sid, s] of svcPos.entries()) {
              if (sid === elId) return { x: s.x, y: s.y, w: s.w, h: s.h };
            }
            // gateways
            for (const [n, gid] of gwIdByNode.entries()) {
              if (gid === elId) {
                const p = posNode.get(n) || { x: padX + 280, y: padY + 60 };
                const gp = (typeof gwPos !== 'undefined' && gwPos && gwPos.get(gid)) ? gwPos.get(gid) : null;
                 if (gp) return { x: gp.x, y: gp.y, w: gp.w, h: gp.h };
                 const gx = p.x + nodeW + gapX;
                 const gy = p.y + (nodeH/2) - (gwH/2);
                 return { x: gx, y: gy, w: gwW, h: gwH };
              }
            }
            // start
            if (elId === startId) {
              const sx = startX;
              const sy = startY;
              return { x: sx, y: sy, w: 36, h: 36 };
            }
            // end
            for (const [n, eid] of endIdByNode.entries()) {
              if (eid === elId) {
                const p = posNode.get(n) || { x: padX + 280, y: padY + 60 };
                const ex = applyHorizontalGap(p.x + nodeW, GAP);
                const ey = Math.round(p.y + (nodeH - 36) / 2);
                return { x: ex, y: ey, w: 36, h: 36 };
              }
            }
            // fallback
            return { x: a.x, y: a.y, w: 2, h: 2 };
          })(e.src);

          const tb = (function(elId){
            // same helper for target
            // tasks (localizadores)
            for (let ii = 0; ii < nodes.length; ii++) {
              const n = nodes[ii];
              const tid = taskIdByNode.get(n);
              if (tid === elId) {
                const p0 = posNode.get(n) || { x: padX + 280, y: padY + 60 };
                return { x: p0.x, y: p0.y, w: nodeW, h: nodeH };
              }
            }
            // service tasks (regras)
            for (const [sid, s] of svcPos.entries()) {
              if (sid === elId) return { x: s.x, y: s.y, w: s.w, h: s.h };
            }
            // gateways
            for (const [n, gid] of gwIdByNode.entries()) {
              if (gid === elId) {
                const p = posNode.get(n) || { x: padX + 280, y: padY + 60 };
                const gp = (typeof gwPos !== 'undefined' && gwPos && gwPos.get(gid)) ? gwPos.get(gid) : null;
                 if (gp) return { x: gp.x, y: gp.y, w: gp.w, h: gp.h };
                 const gx = p.x + nodeW + gapX;
                 const gy = p.y + (nodeH/2) - (gwH/2);
                 return { x: gx, y: gy, w: gwW, h: gwH };
              }
            }
            // end (target may be end)
            for (const [n, eid] of endIdByNode.entries()) {
              if (eid === elId) {
                const p = posNode.get(n) || { x: padX + 280, y: padY + 60 };
                const ex = applyHorizontalGap(p.x + nodeW, GAP);
                const ey = Math.round(p.y + (nodeH - 36) / 2);
                return { x: ex, y: ey, w: 36, h: 36 };
              }
            }
            // fallback
            return { x: b.x, y: b.y, w: 2, h: 2 };
          })(e.dst);

          const fromC = { x: sb.x + sb.w/2, y: sb.y + sb.h/2 };
          const toC   = { x: tb.x + tb.w/2, y: tb.y + tb.h/2 };
          const leftToRight = (toC.x >= fromC.x);

          const pA = { x: leftToRight ? (sb.x + sb.w) : sb.x, y: sb.y + sb.h/2 };

          // Docking: serviceTask (REGRA) -> Task(destino)
          // Usa um "dock point" na borda esquerda do destino, escolhido por destino
          // (garantindo um espaçamento minimo entre entradas no mesmo destino).
          let dockY = null;
          try {
            if (typeof __svcDockYBySid !== 'undefined' && __svcDockYBySid && __svcDockYBySid.has(e.src)) {
              dockY = __svcDockYBySid.get(e.src);
            }
          } catch (e) { dockY = null; }

          const pB = { x: leftToRight ? tb.x : (tb.x + tb.w), y: (dockY != null ? dockY : (tb.y + tb.h/2)) };
          const minClear = ROUTE_MIN_CLEAR;
          const corrIdx = __diCorridorIndexByFlowId.has(e.id) ? __diCorridorIndexByFlowId.get(e.id) : 0;
          // Spread connectors leaving the same source into distinct corridors
          const corrShift = (corrIdx || 0) * ROUTE_CORRIDOR_GAP;
          let midX;
          if (leftToRight) midX = Math.max(pA.x + minClear + corrShift, (pA.x + pB.x)/2 + corrShift);
          else midX = Math.min(pA.x - minClear - corrShift, (pA.x + pB.x)/2 - corrShift);
          // Clamp midX to avoid overshooting the target and coming back
          if (leftToRight) midX = Math.min(midX, pB.x - 20);
          else midX = Math.max(midX, pB.x + 20);

          const wps = [
            { x: pA.x, y: pA.y },
            { x: midX, y: pA.y },
            { x: midX, y: pB.y },
            { x: pB.x, y: pB.y }
          ];

          for (let wi = 0; wi < wps.length; wi++) {
            x += '        <di:waypoint x="' + wps[wi].x + '" y="' + wps[wi].y + '"/>';
          }
          x += '      </bpmndi:BPMNEdge>';
        }

        x += '    </bpmndi:BPMNPlane>\n';
        x += '  </bpmndi:BPMNDiagram>\n';
        x += '</bpmn:definitions>\n';
        return x;
      };

      for (let i = 0; i < fluxos.length; i++) {
        const fluxo = fluxos[i];
        const nodes = Array.from(fluxo.nodes || []);
        const sig = nodes.slice().sort().join('||');
        if (flowSigs.has(sig)) continue;
        flowSigs.add(sig);

        fileIndex++;
        const xmlOne = buildOne(fluxo, fileIndex);
        const startK = (fluxo.starts && fluxo.starts[0]) ? norm(String(fluxo.starts[0])) : ('fluxo_' + fileIndex);
        const safe = (startK || '').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80);
        files.push({
          filename: ('fluxo_' + String(fileIndex).padStart(2, '0') + '_' + (safe || 'inicio') + '.bpmn'),
          xml: xmlOne
        });
      }

      return files;
    }

    // ---- XML header / namespaces
    const collabId = 'Collab_ATP';
    let xml = '';
    xml += '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n';
    xml += '  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"\n';
    xml += '  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"\n';
    xml += '  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"\n';
    xml += '  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"\n';
    xml += '  id="Definitions_ATP" targetNamespace="http://tjsp.eproc/atp">\n';
    xml += '  <bpmn:collaboration id="' + collabId + '">\n';

    let processesXML = '';
    let diShapes = '';
    let diEdges  = '';

    // Layout constants
    const POOL_X = 40;
    const POOL_PAD_X = 40;
    const POOL_PAD_Y = 40;
    const TASK_W = 240;
    const TASK_H = 80;
    const GW_W = 50;
    const GW_H = 50;
    const START_W = 36;
    const START_H = 36;
    const END_W = 36;
    const END_H = 36;

    // OBS: Bizagi costuma "encavalar" shapes quando o espaçamento vertical fica perto da altura do task.
    // Por isso, usamos gaps mais generosos e ainda aplicamos um resolvedor anti-overlap no final.
    const DX = 420; // spacing per level (horizontal)
    const DY = 240; // spacing per lane within pool (vertical)

    let poolY = 40;
    let fluxoCount = 0;

    // Helper to compute reachable subgraph from a start

    // For each start, build pool/process
    for (const fl of fluxos) {
      const startLoc = (fl && fl.starts && fl.starts[0]) ? fl.starts[0] : '';

      const startName = norm(startLoc);
      if (!startName) continue;

      const nodesSet = new Set((fl && fl.nodes) ? Array.from(fl.nodes) : []);
      if (!nodesSet.size) continue;

      if (!nodesSet.size) continue;

      // Build edges within subgraph
      const nodes = Array.from(nodesSet);
      const nodeSet = new Set(nodes);

      const out = new Map(); // u -> Array(v)
      const edges = [];
      for (const u of nodes) {
        const outs = outGlobal.get(u);
        if (!outs) continue;
        for (const v of outs) {
          if (!__nodeSet.has(v)) continue;
          edges.push([u, v]);
          if (!out.has(u)) out.set(u, []);
          out.get(u).push(v);
        }
      }

      // Signature
      const sig = nodes.slice().sort().join('||') + '##' + edges.slice().sort((a,b)=> (a[0]+a[1]).localeCompare(b[0]+b[1])).map(e=>e[0]+'->'+e[1]).join('|');
      const sigHash = Math.abs(hashCode(sig)).toString(36);
      if (flowSigs.has(sigHash)) continue;
      flowSigs.add(sigHash);

      fluxoCount++;
      const procId = 'Process_Fluxo_' + fluxoCount;
      const partId = 'Participant_Fluxo_' + fluxoCount;

      xml += '    <bpmn:participant id="' + partId + '" name="' + xmlEsc('Fluxo ' + fluxoCount + ' — ' + startName) + '" processRef="' + procId + '"/>\n';

      // ---- Build process
      let p = '';
      p += '  <bpmn:process id="' + procId + '" isExecutable="false">\n';

      const startEventId = 'Start_' + procId;
      p += '    <bpmn:startEvent id="' + startEventId + '" name="Início"/>\n';

      // IDs for nodes
      const taskId = new Map();
      nodes.forEach(n => taskId.set(n, makeId('Task_' + procId, n)));

      // Gateways
      const gwId = new Map(); // u -> gwId
      for (const [u, vs] of out.entries()) {
        const uniq = Array.from(new Set(vs));
        if (uniq.length > 1) {
          gwId.set(u, makeId('Gw_' + procId, u));
        }
      }

      // Terminals (no outgoing)
      const terminals = nodes.filter(n => !(out.get(n) && out.get(n).length));
      const endId = new Map();
      terminals.forEach((n,i) => endId.set(n, 'End_' + procId + '_' + (i+1)));

      // Emit tasks + gateways + ends
      for (const n of nodes) {
        p += '    <bpmn:task id="' + taskId.get(n) + '" name="' + xmlEsc(n) + '"/>\n';
      }
      for (const [u, gid] of gwId.entries()) {
        p += '    <bpmn:exclusiveGateway id="' + gid + '" name="Decisão"/>\n';
      }
      for (const [n, eid] of endId.entries()) {
        p += '    <bpmn:endEvent id="' + eid + '" name="Fim"/>\n';
      }

      // Sequence flows
      let flowN = 0;
      const mkFlowId = () => 'Flow_' + procId + '_' + (++flowN); // Executa mk fluxo ID.

      // Start -> start task(s) (mesma semântica do TXT: pode haver múltiplos inícios)
      const flowIds = []; // for DI edges
      const startKeys = (fl && Array.isArray(fl.starts) && fl.starts.length)
        ? fl.starts.map(norm).filter(Boolean)
        : (startName ? [startName] : []);

      for (const sk of startKeys) {
        const tid = taskId.get(sk);
        if (!tid) continue;
        const fStart = mkFlowId();
        p += '    <bpmn:sequenceFlow id="' + fStart + '" sourceRef="' + startEventId + '" targetRef="' + tid + '"/>\n';
        flowIds.push([fStart, startEventId, tid]);
      }

      for (const u of nodes) {
        const vs = out.get(u) || [];
        const uniq = Array.from(new Set(vs));
        if (!uniq.length) continue;

        const uTask = taskId.get(u);
        const gid = gwId.get(u);

        if (gid) {
          const fUG = mkFlowId();
          p += '    <bpmn:sequenceFlow id="' + fUG + '" sourceRef="' + uTask + '" targetRef="' + gid + '"/>\n';
          flowIds.push([fUG, uTask, gid]);

          for (const v of uniq) {
            const key = u + '||' + v;
            const labels = edgeMeta.get(key) || [];
            const label = labels.length ? labels[0] : ''; // pega o 1o (curto). (Opcional: join)
            const fGV = mkFlowId();
            p += '    <bpmn:sequenceFlow id="' + fGV + '" sourceRef="' + gid + '" targetRef="' + taskId.get(v) + '"' + (label ? (' name="' + xmlEsc(label) + '"') : '') + '/>\n';
            flowIds.push([fGV, gid, taskId.get(v)]);
          }
        } else {
          for (const v of uniq) {
            const key = u + '||' + v;
            const labels = edgeMeta.get(key) || [];
            const label = labels.length ? labels[0] : '';
            const fUV = mkFlowId();
            p += '    <bpmn:sequenceFlow id="' + fUV + '" sourceRef="' + uTask + '" targetRef="' + taskId.get(v) + '"' + (label ? (' name="' + xmlEsc(label) + '"') : '') + '/>\n';
            flowIds.push([fUV, uTask, taskId.get(v)]);
          }
        }
      }

      // Task -> End for terminals
      for (const n of terminals) {
        const eid = endId.get(n);
        const fTE = mkFlowId();
        p += '    <bpmn:sequenceFlow id="' + fTE + '" sourceRef="' + taskId.get(n) + '" targetRef="' + eid + '"/>\n';
        flowIds.push([fTE, taskId.get(n), eid]);
      }

      p += '  </bpmn:process>\n';
      processesXML += p;

      // ---- Layout per pool (BFS levels)
      // levels (BFS) — IMPORTANT: inicia a BFS a partir de TODOS os "inícios" detectados no fluxo.
      // Isso evita que vários nós fiquem sem nível (lv=0) e acabem empilhados na primeira coluna.
      let levels = new Map();
      const q = [];
      for (const sk of startKeys) {
        if (!sk) continue;
        if (!levels.has(sk)) {
          levels.set(sk, 0);
          q.push(sk);
        }
      }
      // fallback (segurança)
      if (!q.length && startName) { levels.set(startName, 0); q.push(startName); }
      while (q.length) {
        const u = q.shift();
        const lv = levels.get(u) || 0;
        const vs = out.get(u) || [];
        for (const v of vs) {
          if (!levels.has(v)) { levels.set(v, lv + 1); q.push(v); }
        }
      }

      // group nodes by level
      const byLevel = new Map();
      for (const n of nodes) {
        const lv = levels.has(n) ? levels.get(n) : 0;
        if (!byLevel.has(lv)) byLevel.set(lv, []);
        byLevel.get(lv).push(n);
      }
      // deterministic order within level
      for (const [lv, arr] of byLevel.entries()) {
        arr.sort((a,b)=>a.localeCompare(b));
      }

      // positions
      const pos = new Map(); // elementId -> {x,y,w,h}
      const startX = POOL_X + POOL_PAD_X;
      const startY = poolY + POOL_PAD_Y;

      // Start event
      pos.set(startEventId, { x: startX, y: startY + 10, w: START_W, h: START_H });

      let maxLv = 0;
      let maxY = startY;

      // --- Post-layout collision resolver (prevents shape overlap in Bizagi)
      if (opts.layout === 'grid') {
        // --- Grid layout (simple, Bizagi-friendly)
        const allNodes = Array.from(nodes).slice().sort((a,b)=>a.localeCompare(b));
        const cols = Math.max(1, Math.ceil(Math.sqrt(allNodes.length)));
        // IMPORTANT: guarantee spacing >= shape size + min gaps (avoids overlap)
        // Gaps mínimos (mais folgados) para evitar sobreposição no Bizagi.
        const MIN_V_GAP = 160;
        const MIN_H_GAP = 260;
        const dx = Math.max(DX, TASK_W + MIN_H_GAP);
        const dy = Math.max(DY, TASK_H + MIN_V_GAP);

        for (let i = 0; i < allNodes.length; i++) {
          const n = allNodes[i];
          const col = i % cols;
          const row = Math.floor(i / cols);
          const x = startX + dx * (col + 1);
          const y = startY + dy * row;
          pos.set(taskId.get(n), { x, y, w: TASK_W, h: TASK_H });
          maxY = Math.max(maxY, y + TASK_H);
          maxLv = Math.max(maxLv, col);
        }
      } else {
        // --- Layout per pool (BFS levels)
        // IMPORTANT: guarantee spacing >= shape size + min gaps (avoids overlap)
        // Gaps mínimos (mais folgados) para evitar sobreposição no Bizagi.
        const MIN_V_GAP = 160;
        const MIN_H_GAP = 260;
        const dx = Math.max(DX, TASK_W + MIN_H_GAP);
        const dy = Math.max(DY, TASK_H + MIN_V_GAP);
        for (const [lv, arr] of byLevel.entries()) {
          if (lv > maxLv) maxLv = lv;
          for (let i = 0; i < arr.length; i++) {
            const n = arr[i];
            const x = startX + dx * (lv + 1);
            const y = startY + dy * i;
            pos.set(taskId.get(n), { x, y, w: TASK_W, h: TASK_H });
            maxY = Math.max(maxY, y + TASK_H);
          }
        }
      }

      // Gateways near their source task
      for (const [u, gid] of gwId.entries()) {
        const uPos = pos.get(taskId.get(u));
        const x = (uPos ? (uPos.x + TASK_W + 100) : (startX + DX));
        const y = (uPos ? (uPos.y + (TASK_H - GW_H)/2) : startY);
        pos.set(gid, { x, y, w: GW_W, h: GW_H });
        maxY = Math.max(maxY, y + GW_H);
      }

      // End events near terminal tasks
      for (const n of terminals) {
        const tPos = pos.get(taskId.get(n));
        const x = (tPos ? (tPos.x + TASK_W + 120) : (startX + DX * (maxLv + 2)));
        const y = (tPos ? (tPos.y + 20) : startY);
        pos.set(endId.get(n), { x, y, w: END_W, h: END_H });
        maxY = Math.max(maxY, y + END_H);
      }

      // Final anti-overlap pass (tasks/gateways/ends)
      // This is critical for big columns of rules (prevents "encavalado").
      // Gap extra no pós-processamento para evitar "encavalado" em colunas com muitos itens.
      resolveOverlaps(pos, 140);

      // recompute bounds after overlap fixes
      maxY = Math.max(...Array.from(pos.values()).map(p0 => p0.y + p0.h));

      // pool bounds
      const maxX = Math.max(...Array.from(pos.values()).map(p=>p.x + p.w)) + POOL_PAD_X;
      const poolH = (maxY - poolY) + POOL_PAD_Y;
      const poolW = maxX - POOL_X;

      // DI: participant pool shape
      diShapes += '    <bpmndi:BPMNShape id="DI_' + partId + '" bpmnElement="' + partId + '">\n';
      diShapes += '      <dc:Bounds x="' + POOL_X + '" y="' + poolY + '" width="' + poolW + '" height="' + poolH + '"/>\n';
      diShapes += '    </bpmndi:BPMNShape>\n';

      // DI shapes for elements in this process
      const addShape = (elId) => { // Adiciona o shape.
        const p0 = pos.get(elId);
        if (!p0) return;
        diShapes += '    <bpmndi:BPMNShape id="DI_' + elId + '" bpmnElement="' + elId + '">\n';
        diShapes += '      <dc:Bounds x="' + p0.x + '" y="' + p0.y + '" width="' + p0.w + '" height="' + p0.h + '"/>\n';
        diShapes += '    </bpmndi:BPMNShape>\n';
      };

      addShape(startEventId);
      nodes.forEach(n => addShape(taskId.get(n)));
      for (const gid of gwId.values()) addShape(gid);
      for (const eid of endId.values()) addShape(eid);

      // DI edges (simple orthogonal)
      const center = (p0) => ({ cx: p0.x + p0.w/2, cy: p0.y + p0.h/2 }); // Executa center.
      const rightMid = (p0) => ({ x: p0.x + p0.w, y: p0.y + p0.h/2 }); // Executa right mid.
      const leftMid  = (p0) => ({ x: p0.x, y: p0.y + p0.h/2 }); // Executa left mid.

      for (const [fid, srcEl, dstEl] of flowIds) {
        const ps = pos.get(srcEl);
        const pt = pos.get(dstEl);
        if (!ps || !pt) continue;
        const a = rightMid(ps);
        const b = leftMid(pt);
        const midX = (a.x + b.x) / 2;

        diEdges += '    <bpmndi:BPMNEdge id="DI_' + fid + '" bpmnElement="' + fid + '">\n';
        diEdges += '      <di:waypoint x="' + a.x + '" y="' + a.y + '"/>\n';
        diEdges += '      <di:waypoint x="' + midX + '" y="' + a.y + '"/>\n';
        diEdges += '      <di:waypoint x="' + midX + '" y="' + b.y + '"/>\n';
        diEdges += '      <di:waypoint x="' + b.x + '" y="' + b.y + '"/>\n';
        diEdges += '    </bpmndi:BPMNEdge>\n';
      }

      poolY += poolH + 40; // next pool
    }

    xml += '  </bpmn:collaboration>\n';
    xml += processesXML;

    xml += '  <bpmndi:BPMNDiagram id="BPMNDiagram_ATP">\n';
    xml += '    <bpmndi:BPMNPlane id="BPMNPlane_ATP" bpmnElement="' + collabId + '">\n';
    xml += diShapes;
    xml += diEdges;
    xml += '    </bpmndi:BPMNPlane>\n';
    xml += '  </bpmndi:BPMNDiagram>\n';
    xml += '</bpmn:definitions>\n';

    return xml;
  } catch (e) {
    console.warn(LOG_PREFIX, 'Falha ao gerar BPMN (pools por fluxo)', e);
    return null;
  }
}

function atpEnsureReportButton(host, afterLabelEl, tableRef) { // Garante report botão.
  try {
    if (!host || host.querySelector('#btnGerarRelatorioColisoes')) return;

    // =========================
    // Botão 1: Relatório Conflitos
    // =========================
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'infraButton';
    btn.id = 'btnGerarRelatorioColisoes';
    btn.textContent = 'Gerar Relatório de Conflitos';

    btn.addEventListener('mouseenter', () => { btn.style.background = '#e5e7eb'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = '#f3f4f6'; });

    btn.addEventListener('click', function () {
      try {
        var table = tableRef || findTable();
        if (!table) return;

        // Garante que colunas extras / datasets estejam prontos.
        try { ensureColumns(table); } catch (e) {}
        var cols = null;
        try { cols = mapColumns(table); } catch (e) { cols = null; }

        // Pega todas as células de conflito renderizadas pelo script.
        var cells = Array.from(table.querySelectorAll('td[data-atp-col="conflita"]'));

        // Monta registros A x B (DEDUP por par + tipo)
        var records = [];
        var countsByTipo = Object.create(null);
        var seenPairs = new Set();

        cells.forEach(function (td) {
          if (!td) return;
          var tr = td.closest('tr');
          if (!tr) return;

          // Descobre o nº da regra A (pela coluna Nº/Prioridade, quando possível)
          var numA = '';
          try {
            if (cols && typeof cols.idxNum === 'number' && cols.idxNum >= 0) {
              var tds = tr.querySelectorAll('td');
              var tdNum = tds[cols.idxNum];
              numA = tdNum ? clean(tdNum.textContent || '') : '';
            }
            // fallback: tenta achar algum número na linha
            if (!numA) {
              var raw = clean(tr.textContent || '');
              var mm = raw.match(/\b(\d{1,6})\b/);
              if (mm) numA = mm[1];
            }
          } catch (e) {}

          // Cada <div> representa um conflito B para essa regra A
          var confDivs = Array.from(td.querySelectorAll(':scope > div')).filter(function (d) {
            return d && d.querySelector('.atp-conf-num') && d.querySelector('.atp-conf-tipo[data-atp-tipo]');
          });

          confDivs.forEach(function (div) {
            var nEl = div.querySelector('.atp-conf-num');
            var numB = nEl ? clean(String(nEl.textContent || '')).replace(':', '') : '';

            var sp = div.querySelector('.atp-conf-tipo[data-atp-tipo]');
            var tipo = sp ? clean(sp.getAttribute('data-atp-tipo') || sp.textContent || '') : '';
            var impacto = sp ? clean(sp.getAttribute('data-atp-impacto') || '') : '';
            var pqRaw = sp ? clean(sp.getAttribute('data-atp-porque') || '') : '';

            // Sugestões no pq (se houver)
            var sugestoes = [];
            try {
              var reSug = /Sugest[aã]o:\s*([^|]+)(?:\||$)/gi;
              var m;
              while ((m = reSug.exec(pqRaw)) !== null) {
                var s = clean(m[1] || '');
                if (s) sugestoes.push(s);
              }
            } catch (e) {}

            // Remove trechos de sugestão do pq técnico
            var pq = String(pqRaw || '')
              .replace(/\s*(\|\s*)?Sugest[aã]o:\s*[^|]+/gi, '')
              .replace(/\s*\|\s*/g, ' | ')
              .trim();
            pq = pq.replace(/^\|\s*|\s*\|$/g, '').trim();

            if (!tipo) return;

            var aVal = numA || '(não identificado)';
            var bVal = numB || '(não identificado)';

            var tipoLower = String(tipo || '').toLowerCase();
            var isContradicao = (tipoLower === 'contradição' || tipoLower === 'contradicao');
            if (isContradicao) bVal = '(Própria Regra)';

            var k = pairKey(tipo, aVal, bVal);
            if (seenPairs.has(k)) return;
            seenPairs.add(k);

            countsByTipo[tipo] = (countsByTipo[tipo] || 0) + 1;

            // Definição (tooltip padrão do tipo)
            var def = '';
            try { def = getTipoTooltip(tipo) || ''; } catch (e) {}
            def = String(def || '').replace(/<br\s*\/?>/gi, '\n').trim();

            // Normaliza A/B
            var normA = aVal, normB = bVal;
            if (!isContradicao) {
              var an = Number(aVal), bn = Number(bVal);
              if (Number.isFinite(an) && Number.isFinite(bn) && an > bn) {
                normA = bVal;
                normB = aVal;
              } else if (!Number.isFinite(an) || !Number.isFinite(bn)) {
                if (String(aVal) > String(bVal)) {
                  normA = bVal;
                  normB = aVal;
                }
              }
            } else {
              normA = aVal;
              normB = '(Própria Regra)';
            }

            records.push({
              a: normA,
              b: normB,
              tipo: String(tipo),
              impacto: impacto,
              def: def,
              pq: pq,
              sugestoes: sugestoes
            });
          });
        });

        // Ordena só para estabilidade
        records.sort(function (x, y) {
          var ax = Number(x.a), ay = Number(y.a);
          if (Number.isFinite(ax) && Number.isFinite(ay) && ax !== ay) return ax - ay;
          if (String(x.a) !== String(y.a)) return String(x.a).localeCompare(String(y.a));
          var bx = Number(x.b), by = Number(y.b);
          if (Number.isFinite(bx) && Number.isFinite(by) && bx !== by) return bx - by;
          if (String(x.b) !== String(y.b)) return String(x.b).localeCompare(String(y.b));
          return String(x.tipo).localeCompare(String(y.tipo));
        });

        // Formata
        var lines = [];
        lines.push('Relatório de Colisões (ATP / eProc)');
        lines.push('Data/Hora: ' + (new Date()).toLocaleString());
        lines.push('');
        lines.push('Total de conflitos listados: ' + String(records.length));
        lines.push('Resumo por tipo:');
        Object.keys(countsByTipo).sort(function (a, b) { return countsByTipo[b] - countsByTipo[a]; }).forEach(function (t) {
          lines.push('- ' + t + ': ' + countsByTipo[t]);
        });
        lines.push('');
        lines.push('Detalhamento:');

        records.forEach(function (r) {
          lines.push('');
          if (String(r.b) === '(Própria Regra)' || String(r.tipo || '').toLowerCase() === 'contradição' || String(r.tipo || '').toLowerCase() === 'contradicao') {
            lines.push('Regra A(' + r.a + ') x (Própria Regra)');
          } else {
            lines.push('Regra A(' + r.a + ') x Regra B(' + r.b + ')');
          }
          lines.push('Tipo: ' + r.tipo);
          if (r.def) lines.push('Definição: ' + r.def);
          if (r.pq) lines.push('Colisão: ' + r.pq);
          if (r.sugestoes && r.sugestoes.length) {
            lines.push('Sugestão:');
            r.sugestoes.forEach(function (s) { lines.push('- ' + s); });
          }
        });

        if (!records.length) {
          lines.push('');
          lines.push('Nenhuma colisão foi encontrada.');
        }

        var content = lines.join('\n');
        var blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'relatorio_colisoes_ATP.txt';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () {

  // =========================
  // [ATP] Localizar Regra no Fluxo (Modal BPMN)
  // =========================
  let ATP_LAST_RULES = null;
  let ATP_BPMN_SPLIT_CACHE = null; // [{filename, xml}]
  let ATP_BPMN_SPLIT_CACHE_KEY = '';

  


  


  


  






  


  


          try { URL.revokeObjectURL(url); } catch (e) {}
          try { a.remove(); } catch (e) {}
        }, 0);
      } catch (e) {
        console.warn(LOG_PREFIX, 'Falha ao gerar relatório:', e);
      }
    });

    // =========================
    // Botão 2: Extrato de Fluxos (TXT)
    // =========================
    const btnFluxos = document.createElement('button');
    btnFluxos.type = 'button';
    btnFluxos.className = 'infraButton';
    btnFluxos.id = 'btnExtratoFluxosATP';
    btnFluxos.textContent = 'Gerar Extrato de Fluxos';
    btnFluxos.style.marginLeft = '8px';

    btnFluxos.addEventListener('mouseenter', () => { btnFluxos.style.background = '#e5e7eb'; });
    btnFluxos.addEventListener('mouseleave', () => { btnFluxos.style.background = '#f3f4f6'; });

    btnFluxos.addEventListener('click', function () {
      try {
        var table = tableRef || findTable();
        if (!table) return;

        try { ensureColumns(table); } catch (e) {}
        var cols = null;
        try { cols = mapColumns(table); } catch (e) { cols = null; }
        if (!cols) cols = {};

        const rules = parseRules(table, cols);
    ATP_LAST_RULES = rules;
        const txt = atpBuildFluxosText(rules);

        var blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'extrato_fluxos_ATP.txt';
        document.body.appendChild(a);
        a.click();
        setTimeout(function(){ URL.revokeObjectURL(url); try{a.remove();}catch(e){} }, 0);
      } catch (e) {
        console.warn(LOG_PREFIX, 'Falha ao gerar Extrato de Fluxos', e);
      }
    });



// Botão 3: Exportar BPMN (Grid)
    // =========================
    const btnBPMNGrid = document.createElement('button');
    btnBPMNGrid.type = 'button';
    btnBPMNGrid.className = 'infraButton';
    btnBPMNGrid.id = 'btnExtratoFluxosBPMNGrid_ATP';
    btnBPMNGrid.textContent = 'Exportar BPMN para Bizagi';
    btnBPMNGrid.style.marginLeft = '8px';

    btnBPMNGrid.addEventListener('mouseenter', () => { btnBPMNGrid.style.background = '#e5e7eb'; });
    btnBPMNGrid.addEventListener('mouseleave', () => { btnBPMNGrid.style.background = '#f3f4f6'; });

    btnBPMNGrid.addEventListener('click', function () {
      try {
        var table = tableRef || findTable();
        if (!table) return;

        try { ensureColumns(table); } catch (e) {}
        var cols = null;
        try { cols = mapColumns(table); } catch (e) { cols = null; }
        if (!cols) cols = {};

        const rules = parseRules(table, cols);
    ATP_LAST_RULES = rules;

        // Gera 1 BPMN por fluxo e compacta em ZIP (como já fazíamos antes)
        atpEnsureJSZip().then(function (JSZip) {
          try {
            const files = atpBuildFluxosBPMN(rules, { layout: 'grid', splitFiles: true });
            if (!files || !files.length) {
              console.warn(LOG_PREFIX, '[ATP][Fluxos/BPMN] ZIP vazio: nenhum BPMN foi gerado.');
              return;
            }

            var zip = new JSZip();
            files.forEach(function (f) {
              zip.file(f.filename, f.xml);
            });

            zip.generateAsync({ type: 'blob' }).then(function (blob) {
              var url = URL.createObjectURL(blob);
              var a = document.createElement('a');
              a.href = url;
              a.download = 'extrato_fluxos_ATP_grid.zip';
              document.body.appendChild(a);
              a.click();
              setTimeout(function(){ URL.revokeObjectURL(url); try{a.remove();}catch(e){} }, 0);
            }).catch(function (e) {
              console.warn(LOG_PREFIX, '[ATP][Fluxos/BPMN] Falha ao gerar ZIP', e);
            });
          } catch (e) {
            console.warn(LOG_PREFIX, '[ATP][Fluxos/BPMN] Falha ao montar BPMNs', e);
          }
        }).catch(function (e) {
          console.warn(LOG_PREFIX, '[ATP][Fluxos/BPMN] Não foi possível carregar JSZip', e);
        });
      } catch (e) {
        console.warn(LOG_PREFIX, 'Falha ao exportar BPMN (Grid)', e);
      }
    });

    // Inserção no host
    if (afterLabelEl && afterLabelEl.parentNode === host) {
      const anchor = afterLabelEl.nextSibling;
      host.insertBefore(btnFluxos, anchor);
      host.insertBefore(btnBPMNGrid, anchor);
      host.insertBefore(btn, btnFluxos); // mantém ordem: Relatório -> Fluxos -> BPMN
    } else {
      host.appendChild(btn);
      host.appendChild(btnFluxos);
      host.appendChild(btnBPMNGrid);
    }
  } catch (e) {}
}


function addOnlyConflictsCheckbox(table, onToggle) { // Adiciona checkbox no bloco de filtros + botão de relatório.
    const host = document.getElementById('dvFiltrosOpcionais'); // Container de filtros do eProc.
    if (!host) return;

    // Se já existe o checkbox/label, só garante o botão do relatório após o label.
    const existingCb = host.querySelector('#chkApenasConflitoSlim');
    const existingLb = host.querySelector('label[for="chkApenasConflitoSlim"]');
    if (existingCb && existingLb) {
      atpEnsureReportButton(host, existingLb, table);
      return;
    }
    if (existingCb) return; // Segurança: checkbox já existe mas label ainda não, não duplica.

    host.appendChild(document.createTextNode(' ')); // Espaço.

    const cb = document.createElement('input');
    cb.type = 'radio';
    cb.id = 'chkApenasConflitoSlim';
    cb.className = 'infraRadio';
    cb.style.marginLeft = '12px';

    const lb = document.createElement('label');
    lb.setAttribute('for', 'chkApenasConflitoSlim');
    lb.className = 'infraLabelCheckBox';
    lb.style.verticalAlign = 'middle';
    lb.style.cursor = 'help';
    lb.textContent = 'Apenas regras com conflito';

    // Tooltip mini-help no label
    lb.addEventListener('mouseenter', () => {
      try {
        const msg = String(ATP_MINI_HELP_TIP || '').replace(/\r?\n/g, '<br>');
        if (typeof window.infraTooltipMostrar === 'function') {
          window.infraTooltipMostrar(msg, 'Ajuda rápida (ATP)', 720);
        } else {
          lb.setAttribute('title', String(ATP_MINI_HELP_TIP || ''));
        }
      } catch {}
    });
    lb.addEventListener('mouseleave', () => {
      try { if (typeof window.infraTooltipOcultar === 'function') window.infraTooltipOcultar(); } catch {}
    });

    cb.addEventListener('change', () => { // Evento.
      onlyConflicts = cb.checked; // Atualiza estado.
      onToggle(); // Dispara callback.
    });

    host.appendChild(cb); // Anexa checkbox.
    host.appendChild(lb); // Anexa label.

    // Botão do relatório vem DEPOIS do label.
    atpEnsureReportButton(host, lb, table);
  }

  // ==============================
  // Runner: recalcular com debounce simples
  // ==============================

  let tDebounce = null; // Timer de debounce.
  let ATP_SUPPRESS_OBSERVER = false; // Evita loop: render->MutationObserver->recalc.
  // ==============================
  // Sincronização: aguarda o eProc terminar de popular os TDs (evita linhas “vazias” intermitentes)
  // ==============================
  const __atpReadyState = new WeakMap(); // table -> { t0:number, tries:number }

  try { console.log('[ATP][OK] 05_bpmn_build_export.js inicializado'); } catch (e) {}