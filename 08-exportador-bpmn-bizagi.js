try { console.log('[ATP][LOAD] 08-exportador-bpmn-bizagi.js carregado com sucesso'); } catch (e) { }

(function () {
  'use strict';

  const START_X = 120;
  const START_Y = 120;
  const H_GAP = 220;
  const V_GAP = 110;
  const NODE_W = 140;
  const NODE_H = 70;

  const PORT_PAD = 10;
  const MIN_H_SEG = 40;
  const EDGE_BEND_PAD = 18;

  const center = (b) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
  const portPoint = (b, side) => {
    if (side === 'left') return { x: b.x - PORT_PAD, y: b.y + b.h / 2 };
    if (side === 'right') return { x: b.x + b.w + PORT_PAD, y: b.y + b.h / 2 };
    if (side === 'top') return { x: b.x + b.w / 2, y: b.y - PORT_PAD };
    if (side === 'bottom') return { x: b.x + b.w / 2, y: b.y + b.h + PORT_PAD };
    return { x: b.x + b.w + PORT_PAD, y: b.y + b.h / 2 };
  };

  function pickPorts(srcB, tgtB) {
    const s = center(srcB), t = center(tgtB);
    const dx = t.x - s.x;
    const dy = t.y - s.y;

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

    if (Math.round(s.x) === Math.round(t.x) || Math.round(s.y) === Math.round(t.y)) return [s, t];

    let mid = { x: t.x, y: s.y };

    if (p.out === 'right' && p.inp === 'left') {
      let midX = Math.max(s.x + MIN_H_SEG, (s.x + t.x) / 2);
      if (midX >= tgtB.x - EDGE_BEND_PAD) midX = Math.max(s.x + MIN_H_SEG, tgtB.x - EDGE_BEND_PAD);
      return [{ x: s.x, y: s.y }, { x: midX, y: s.y }, { x: midX, y: t.y }, { x: t.x, y: t.y }];
    }

    return [s, mid, t];
  }

  function computeLayoutSymmetric(flow) {

    const GAP_Y_MIN = 50;
    const COL_W = 260;
    const ROW_H = 90;
    const PAD_X = 40;
    const PAD_Y = 40;

    const outgoing = {}, incoming = {}, level = {}, pos = {};
    for (const n of flow.nodes) { outgoing[n.id] = []; incoming[n.id] = []; }

    for (const e of flow.edges) {
      if (!outgoing[e.from]) outgoing[e.from] = [];
      if (!incoming[e.to]) incoming[e.to] = [];
      outgoing[e.from].push(e.to);
      incoming[e.to].push(e.from);
    }

    const q = [];
    for (const n of flow.nodes) {
      if (!incoming[n.id] || incoming[n.id].length === 0) {
        level[n.id] = 0;
        q.push(n.id);
      }
    }
    if (!q.length && flow.nodes.length) { level[flow.nodes[0].id] = 0; q.push(flow.nodes[0].id); }

    while (q.length) {
      const u = q.shift();
      const lu = level[u] || 0;
      for (const v of (outgoing[u] || [])) {
        const cand = lu + 1;
        if (level[v] == null || cand > level[v]) {
          level[v] = cand;
          q.push(v);
        }
      }
    }

    const dims = (n) => {
      if (n.type === 'gateway') return { w: 50, h: 50 };
      if (n.type === 'start' || n.type === 'end') return { w: 36, h: 36 };
      if (n.type === 'service') return { w: 150, h: 64 };
      return { w: 170, h: 70 };
    };

    const targetCY = {};
    let baseCY = PAD_Y + 120;

    const maxLevel = Math.max(...flow.nodes.map(n => level[n.id] ?? 0), 0);
    for (let L = 0; L <= maxLevel; L++) {
      const ids = flow.nodes.filter(n => (level[n.id] ?? 0) === L).map(n => n.id);
      ids.forEach((id, idx) => { targetCY[id] = baseCY + idx * ROW_H; });
      baseCY += Math.max(0, ids.length - 1) * 6;
    }

    const relaxPasses = 6;
    for (let pass = 0; pass < relaxPasses; pass++) {
      for (const n of flow.nodes) {
        const id = n.id;
        const parents = incoming[id] || [];
        if (!parents.length) continue;
        let sum = 0, cnt = 0;
        for (const p of parents) {
          if (targetCY[p] != null) { sum += targetCY[p]; cnt++; }
        }
        if (cnt) targetCY[id] = (targetCY[id] * 0.6) + (sum / cnt) * 0.4;
      }
    }

    const byLevel = {};
    for (const n of flow.nodes) {
      const L = level[n.id] ?? 0;
      (byLevel[L] = byLevel[L] || []).push(n.id);
    }
    const nodeById = Object.fromEntries(flow.nodes.map(n => [n.id, n]));

    const centerY = (id) => (targetCY[id] ?? (PAD_Y + 200));
    const setCenterY = (id, cy) => { targetCY[id] = cy; };

    for (let L = 0; L <= maxLevel; L++) {
      const ids = byLevel[L] || [];
      for (const pid of ids) {
        const kids = (outgoing[pid] || []).filter(k => (level[k] ?? 0) === (L + 1));
        if (!kids.length) continue;
        const pcy = centerY(pid);

        if (kids.length === 1) {
          setCenterY(kids[0], pcy);
        } else {
          const totalH = (kids.length * ROW_H) + ((kids.length - 1) * GAP_Y_MIN);
          let top = pcy - totalH / 2 + ROW_H / 2;
          for (let i = 0; i < kids.length; i++) {
            setCenterY(kids[i], top + i * (ROW_H + GAP_Y_MIN));
          }
        }
      }
    }

    const colNodes = {};
    for (const n of flow.nodes) {
      const L = level[n.id] ?? 0;
      (colNodes[L] = colNodes[L] || []).push(n.id);
    }

    const placeColumn = (L) => {
      const ids = (colNodes[L] || []).slice();
      ids.sort((a, b) => (centerY(a) - centerY(b)));

      let cursorY = PAD_Y;
      for (const id of ids) {
        const n = nodeById[id];
        const d = dims(n);
        const wantCY = centerY(id);
        let topY = wantCY - d.h / 2;
        if (topY < cursorY) topY = cursorY;
        pos[id] = { x: PAD_X + L * COL_W, y: topY, w: d.w, h: d.h };
        cursorY = topY + d.h + GAP_Y_MIN;
      }

      for (let i = ids.length - 2; i >= 0; i--) {
        const a = ids[i], b = ids[i + 1];
        const A = pos[a], B = pos[b];
        const maxTop = (B.y - GAP_Y_MIN - A.h);
        if (A.y > maxTop) A.y = maxTop;
      }

      for (const id of ids) targetCY[id] = pos[id].y + pos[id].h / 2;
    };

    for (let L = 0; L <= maxLevel; L++) placeColumn(L);

    const NORM_NAME = (s) => (s || '').toString().trim().replace(/\s+/g, ' ').toUpperCase();
    const CATEGORY = (name) => {
      let s = NORM_NAME(name);
      if (!s) return '';
      s = s.replace(/\([^\)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
      s = s.split(' - ')[0].split(':')[0].trim();
      if (s.length > 24) s = s.slice(0, 24).trim();
      if (s.startsWith('REFIN')) return 'REFINAMENTO';
      if (s.startsWith('PETIC')) return 'PETICIONAMENTO';
      if (s.startsWith('ARQUIV')) return 'ARQUIVAR';
      if (s.startsWith('FINAL')) return 'FINALIZAR';
      if (s.startsWith('ENCAM')) return 'ENCAMINHAR';
      return s;
    };

    const nodeCat = {};
    const catNodes = {};
    for (const n of flow.nodes) {
      if (n.type !== 'task') continue;
      const cat = CATEGORY(n.name);
      if (!cat) continue;
      const indeg = (incoming[n.id] || []).length;
      const outdeg = (outgoing[n.id] || []).length;
      if (indeg >= 2 && outdeg <= 1) {
        nodeCat[n.id] = cat;
        (catNodes[cat] = catNodes[cat] || []).push(n.id);
      }
    }

    const hubs = {};
    for (const cat of Object.keys(catNodes)) {
      const ids = catNodes[cat];
      let minX = Infinity;
      let sumY = 0, cnt = 0;
      for (const id of ids) {
        const b = pos[id];
        if (!b) continue;
        if (b.x < minX) minX = b.x;
        sumY += (b.y + b.h / 2);
        cnt++;
      }
      if (!cnt || !isFinite(minX)) continue;
      hubs[cat] = { x: Math.round(minX - 48), y: Math.round(sumY / cnt) };
    }

    let channelX = Infinity;
    for (const cat of Object.keys(hubs)) channelX = Math.min(channelX, hubs[cat].x - 96);
    if (!isFinite(channelX)) channelX = null;

    pos.__ATP_NODE_CAT__ = nodeCat;
    pos.__ATP_HUBS__ = hubs;
    pos.__ATP_CHANNEL_X__ = channelX;

    pos.__ATP_ALL_BOXES__ = Object.keys(pos).filter(k => !k.startsWith('__')).map(k => ({ id: k, ...pos[k] }));
    pos.__ATP_GAP_Y_MIN__ = GAP_Y_MIN;

    return pos;
  }

  function layoutDER(flow, opts) {
    opts = opts || {};
    const X_STEP = (opts.X_STEP != null) ? opts.X_STEP : 340;
    const Y_GAP_MIN = (opts.Y_GAP_MIN != null) ? opts.Y_GAP_MIN : 50;
    const PAD_X = (opts.PAD_X != null) ? opts.PAD_X : 60;
    const PAD_Y = (opts.PAD_Y != null) ? opts.PAD_Y : 60;

    const nodes = flow.nodes || [];
    const edges = flow.edges || [];
    const byId = {};
    for (const n of nodes) byId[n.id] = n;

    const dims = (n) => {
      if (n.type === 'gateway') return { w: 50, h: 50 };
      if (n.type === 'start' || n.type === 'end') return { w: 36, h: 36 };
      if (n.type === 'service') return { w: 150, h: 64 };
      return { w: 170, h: 70 };
    };

    const out = {}, inc = {};
    for (const n of nodes) { out[n.id] = []; inc[n.id] = []; }
    for (const e of edges) {
      if (!out[e.from]) out[e.from] = [];
      if (!inc[e.to]) inc[e.to] = [];
      out[e.from].push(e.to);
      inc[e.to].push(e.from);
    }

    let root = null;
    for (const n of nodes) { if (n.type === 'start') { root = n.id; break; } }
    if (!root) for (const n of nodes) { if ((inc[n.id] || []).length === 0) { root = n.id; break; } }
    if (!root && nodes.length) root = nodes[0].id;
    if (!root) return { __ATP_ALL_BOXES__: [], __ATP_GAP_Y_MIN__: Y_GAP_MIN };

    const depth = {};
    const q = [root];
    depth[root] = 0;
    while (q.length) {
      const u = q.shift();
      const du = depth[u] || 0;
      const kids = out[u] || [];
      for (const v of kids) {
        const cand = du + 1;
        if (depth[v] == null || cand < depth[v]) {
          depth[v] = cand;
          q.push(v);
        }
      }
    }
    const maxD = Math.max(...Object.values(depth).concat([0]));
    for (const n of nodes) if (depth[n.id] == null) depth[n.id] = maxD + 1;

    const treeChildren = {};
    const visited = new Set();
    for (const n of nodes) treeChildren[n.id] = [];
    visited.add(root);
    const stack = [root];
    while (stack.length) {
      const u = stack.pop();
      const kids = (out[u] || []).slice().sort((a, b) => (depth[a] - depth[b]) || (a < b ? -1 : 1));
      for (const v of kids) {
        if (!visited.has(v)) {
          visited.add(v);
          treeChildren[u].push(v);
          stack.push(v);
        }
      }
    }

    const leftovers = nodes.map(n => n.id).filter(id => !visited.has(id)).sort((a, b) => (depth[a] - depth[b]) || (a < b ? -1 : 1));
    for (const id of leftovers) treeChildren[root].push(id);

    const nodeDim = {};
    for (const n of nodes) nodeDim[n.id] = dims(n);

    const subH = {};
    const calcSubH = (id) => {
      if (subH[id] != null) return subH[id];
      const kids = treeChildren[id] || [];
      const selfH = nodeDim[id].h;
      if (!kids.length) return (subH[id] = selfH);
      let sum = 0;
      for (const k of kids) sum += calcSubH(k);
      sum += (kids.length - 1) * Y_GAP_MIN;
      return (subH[id] = Math.max(selfH, sum));
    };
    calcSubH(root);

    const posY = {};
    const place = (id, topY) => {
      const kids = treeChildren[id] || [];
      const selfH = nodeDim[id].h;
      if (!kids.length) {
        posY[id] = topY;
        return topY + selfH;
      }
      let cursor = topY;
      const childTops = [];
      for (const k of kids) {
        childTops.push({ id: k, top: cursor });
        cursor = place(k, cursor);
        cursor += Y_GAP_MIN;
      }
      cursor -= Y_GAP_MIN;
      const blockTop = topY;
      const blockBottom = cursor;
      const blockCenter = (blockTop + blockBottom) / 2;
      posY[id] = blockCenter - selfH / 2;
      return Math.max(blockBottom, posY[id] + selfH);
    };
    place(root, PAD_Y);

    const cols = {};
    for (const n of nodes) {
      const d = depth[n.id] || 0;
      (cols[d] = cols[d] || []).push(n.id);
    }
    for (const dStr of Object.keys(cols)) {
      const ids = cols[dStr].slice().sort((a, b) => (posY[a] || 0) - (posY[b] || 0));
      let cursor = PAD_Y;
      for (const id of ids) {
        const h = nodeDim[id].h;
        let y = posY[id];
        if (y == null) y = cursor;
        if (y < cursor) y = cursor;
        posY[id] = y;
        cursor = y + h + Y_GAP_MIN;
      }
    }

    const layout = {};
    for (const n of nodes) {
      const d = depth[n.id] || 0;
      const dd = nodeDim[n.id];
      const x = PAD_X + d * X_STEP;
      const y = Math.round(posY[n.id] != null ? posY[n.id] : PAD_Y);
      layout[n.id] = { x: Math.round(x), y, w: dd.w, h: dd.h };
    }
    layout.__ATP_ALL_BOXES__ = nodes.map(n => ({ id: n.id, x: layout[n.id].x, y: layout[n.id].y, w: layout[n.id].w, h: layout[n.id].h }));
    layout.__ATP_GAP_Y_MIN__ = Y_GAP_MIN;
    return layout;
  }

  function routeOrthogonalAvoidBoxes(srcB, tgtB, boxes, ignoreIds) {
    const ignore = new Set(ignoreIds || []);
    const pad = 10;

    const segHits = (x1, y1, x2, y2, b) => {
      const left = b.x - pad, right = b.x + b.w + pad, top = b.y - pad, bottom = b.y + b.h + pad;
      if (x1 === x2) {
        const x = x1;
        const yMin = Math.min(y1, y2), yMax = Math.max(y1, y2);
        return (x >= left && x <= right && yMax >= top && yMin <= bottom);
      }
      if (y1 === y2) {
        const y = y1;
        const xMin = Math.min(x1, x2), xMax = Math.max(x1, x2);
        return (y >= top && y <= bottom && xMax >= left && xMin <= right);
      }
      return false;
    };

    const pathHits = (pts) => {
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], c = pts[i + 1];
        for (const b of boxes) {
          if (ignore.has(b.id)) continue;
          if (segHits(a.x, a.y, c.x, c.y, b)) return true;
        }
      }
      return false;
    };

    const s = { x: srcB.x + srcB.w, y: srcB.y + srcB.h / 2 };
    const t = { x: tgtB.x, y: tgtB.y + tgtB.h / 2 };

    const buildL = (midX) => ([
      { x: s.x, y: s.y },
      { x: midX, y: s.y },
      { x: midX, y: t.y },
      { x: t.x, y: t.y }
    ]);

    let midX = Math.round((s.x + t.x) / 2);
    midX = Math.max(midX, s.x + 30);
    midX = Math.min(midX, t.x - 30);

    let wps = buildL(midX);
    if (!pathHits(wps)) return wps;

    for (let k = 1; k <= 30; k++) {
      const alt = buildL(midX + 40 * k);
      if (!pathHits(alt)) return alt;
    }
    for (let k = 1; k <= 30; k++) {
      const alt = buildL(midX - 40 * k);
      if (!pathHits(alt)) return alt;
    }

    const detourY = (s.y < t.y) ? (Math.min(s.y, t.y) - 80) : (Math.max(s.y, t.y) + 80);
    const alt = [
      { x: s.x, y: s.y },
      { x: midX, y: s.y },
      { x: midX, y: detourY },
      { x: t.x, y: detourY },
      { x: t.x, y: t.y }
    ];
    return alt;
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

    ['serviceTask', 'task', 'userTask', 'scriptTask', 'subProcess'].forEach(t => addNodes(t, 'task'));

    const edges = [];
    const sfs = proc ? proc.getElementsByTagNameNS(ns.bpmn, 'sequenceFlow') : doc.getElementsByTagNameNS(ns.bpmn, 'sequenceFlow');
    for (const sf of Array.from(sfs)) {
      const from = sf.getAttribute('sourceRef');
      const to = sf.getAttribute('targetRef');
      if (from && to) edges.push({ from, to });
    }

    const known = new Set(nodes.map(n => n.id));
    for (const e of edges) {
      if (!known.has(e.from)) { nodes.push({ id: e.from, type: 'task' }); known.add(e.from); }
      if (!known.has(e.to)) { nodes.push({ id: e.to, type: 'task' }); known.add(e.to); }
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

      let sf = null;
      try {

        const esc = (window.CSS && CSS.escape) ? CSS.escape(flowId) : flowId.replace(/"/g, '\\"');
        sf = doc.querySelector('sequenceFlow[id="' + esc + '"]');
      } catch (e) {
        // fallback manual
        const sfs = Array.from(doc.getElementsByTagName('sequenceFlow'));
        sf = sfs.find(x => x.getAttribute('id') === flowId) || null;
      }
      if (!sf) continue;

      const src = sf.getAttribute('sourceRef');
      const tgt = sf.getAttribute('targetRef');
      const srcB = src ? getB(src) : null;
      const tgtB = tgt ? getB(tgt) : null;
      if (!srcB || !tgtB) continue;

      // Roteamento via Hubs Virtuais + Anti-sobreposição de linhas (layout-only)
      const nodeCat = layout.__ATP_NODE_CAT__ || null;
      const hubs = layout.__ATP_HUBS__ || null;
      const channelX = (layout.__ATP_CHANNEL_X__ != null) ? layout.__ATP_CHANNEL_X__ : null;
      const boxes = layout.__ATP_ALL_BOXES__ || [];
      const GAP = layout.__ATP_GAP_Y_MIN__ || 50;

      const segIntersectsBox = (x1, y1, x2, y2, b) => {
        // segmentos ortogonais (h/v) com margem
        const left = b.x - 10, right = b.x + b.w + 10, top = b.y - 10, bottom = b.y + b.h + 10;
        if (x1 === x2) { // vertical
          const x = x1;
          const yMin = Math.min(y1, y2), yMax = Math.max(y1, y2);
          if (x >= left && x <= right && yMax >= top && yMin <= bottom) return true;
        } else if (y1 === y2) { // horizontal
          const y = y1;
          const xMin = Math.min(x1, x2), xMax = Math.max(x1, x2);
          if (y >= top && y <= bottom && xMax >= left && xMin <= right) return true;
        }
        return false;
      };

      const pathHitsAnyBox = (pts, ignoreIds) => {
        const ignore = new Set(ignoreIds || []);
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i], c = pts[i + 1];
          for (const b of boxes) {
            if (ignore.has(b.id)) continue;
            if (segIntersectsBox(a.x, a.y, c.x, c.y, b)) return true;
          }
        }
        return false;
      };

      const s = { x: srcB.x + srcB.w, y: srcB.y + srcB.h / 2 };
      const t = { x: tgtB.x, y: tgtB.y + tgtB.h / 2 };

      let wps;

      const cat = (nodeCat && nodeCat[tgt]) ? nodeCat[tgt] : '';
      const hub = (cat && hubs) ? hubs[cat] : null;

      const buildRoute = (midX, viaHub, forcedChannelX) => {
        if (viaHub && hub && (forcedChannelX != null)) {
          return [
            { x: s.x, y: s.y },
            { x: forcedChannelX, y: s.y },
            { x: forcedChannelX, y: hub.y },
            { x: hub.x, y: hub.y },
            { x: t.x, y: hub.y },
            { x: t.x, y: t.y }
          ];
        }
        return [
          { x: s.x, y: s.y },
          { x: midX, y: s.y },
          { x: midX, y: t.y },
          { x: t.x, y: t.y }
        ];
      };

      let midX = Math.round((s.x + t.x) / 2);
      midX = Math.max(midX, s.x + 30);
      midX = Math.min(midX, t.x - 30);

      // tenta com hub primeiro
      if (hub && channelX != null) {
        wps = buildRoute(midX, true, channelX);
        if (pathHitsAnyBox(wps, [src, tgt])) {
          let ok = false;
          for (let k = 1; k <= 20; k++) {
            const tryChannel = channelX - 40 * k;
            const alt = buildRoute(midX, true, tryChannel);
            if (!pathHitsAnyBox(alt, [src, tgt])) { wps = alt; ok = true; break; }
          }
          if (!ok) wps = buildRoute(midX, false, null);
        }
      } else {
        wps = buildRoute(midX, false, null);
      }

      // se ainda colidir, empurra midX para fora até limpar
      if (pathHitsAnyBox(wps, [src, tgt])) {
        let ok = false;
        for (let step = 1; step <= 30; step++) {
          const tryX = midX + 40 * step;
          const alt = buildRoute(tryX, false, null);
          if (!pathHitsAnyBox(alt, [src, tgt])) { wps = alt; ok = true; break; }
        }
        if (!ok) {
          for (let step = 1; step <= 30; step++) {
            const tryX = midX - 40 * step;
            const alt = buildRoute(tryX, false, null);
            if (!pathHitsAnyBox(alt, [src, tgt])) { wps = alt; ok = true; break; }
          }
        }
      }

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
      const layout = layoutDER(flow, { X_STEP: 340, Y_GAP_MIN: 50 });

      rewriteDiagramDI(doc, layout);

      const serializer = new XMLSerializer();
      return serializer.serializeToString(doc);
    } catch (e) {
      try { console.warn('[ATP][LAYOUT] Falha ao aplicar layout único:', e); } catch (_) { }
      return xml;
    }
  }

  // expõe para o builder
  window.__ATP_UNIQUE_LAYOUT__ = window.__ATP_UNIQUE_LAYOUT__ || {};
  window.__ATP_UNIQUE_LAYOUT__.apply = applyUniqueLayout;

  try { console.log('[ATP][LAYOUT] Layout único (Opção A) pronto'); } catch (e) { }
})();

function atpBuildFluxosBPMN(rules, opts) { // Constrói fluxos bpmn.
  opts = opts || {};
  const NO_POOL = (opts.noPool !== false); // default: true (sem pool)
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

    const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

    const getRuleLabel = (r) => {
      const num = (r && (r.num || r.numero || r.id || '')) + '';

      const tipo = norm(r && (r.tipoControleCriterio?.canonical || r.tipoControleCriterio?.text || r.tipoControleCriterio || r.tipoControle || r.tipo || r.criterio || r.gatilho || ''));

      const IGNORE_KEYS = new Set(['clauses', 'groups', 'map', 'canonical', 'raw', 'text', 'expr', 'expression']);
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
      } catch (e) { }

      const parts = [];
      parts.push(('REGRA ' + num).trim());
      if (tipo) parts.push('Tipo/Critério: ' + tipo);
      const outrosHuman = atpHumanizeOutrosCriteriosExpr(r && r.outrosCriterios);
      if (outrosHuman) parts.push('Outros Critérios: ' + outrosHuman);

      return parts.join(' — ').trim();
    };

    const allFrom = new Set();
    const allTo = new Set();
    const outGlobal = new Map();
    const edgeMeta = new Map();
    const edgeMetaSeen = new Map();

    const addEdgeMetaLabelUnique = (edgeKey, label) => {
      const k = String(edgeKey || '');
      const raw = String(label == null ? '' : label);
      const dedupe = norm(raw).toUpperCase();
      if (!k || !dedupe) return;

      let seen = edgeMetaSeen.get(k);
      if (!seen) {
        seen = new Set();
        edgeMetaSeen.set(k, seen);
      }
      if (seen.has(dedupe)) return;
      seen.add(dedupe);

      const arr = edgeMeta.get(k) || [];
      arr.push(raw);
      edgeMeta.set(k, arr);
    };

    for (const r of (rules || [])) {

      const fromKeys = Array.from(new Set(atpClausesToKeys(r && r.localizadorRemover).map(norm).filter(Boolean)));
      const toKeys = Array.from(new Set(atpClausesToKeys(r && r.localizadorIncluirAcao).map(norm).filter(Boolean)));
      const ruleLabel = getRuleLabel(r);

      for (const fk of fromKeys) {
        const fromK = fk;
        if (!fromK) continue;

        allFrom.add(fromK);
        if (!outGlobal.has(fromK)) outGlobal.set(fromK, new Set());

        for (const tk of toKeys) {
          const toK = tk;
          if (!toK) continue;

          allTo.add(toK);
          outGlobal.get(fromK).add(toK);

          const key = fromK + '||' + toK;
          addEdgeMetaLabelUnique(key, ruleLabel);
        }
      }
    }

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
      addEdgeMetaLabelUnique(key, 'REFINAMENTO (E/&&)');
    }

    const allKeys = Array.from(allFrom).sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));

    let starts = allKeys.filter(k => !allTo.has(k));
    if (!starts.length) starts = allKeys.slice();

    const assigned = new Set();
    const fluxos = [];
    const expandFrom = (startKey) => {
      const q = [startKey];
      const vis = new Set([startKey]);
      while (q.length) {
        const u = q.shift();
        const outs = outGlobal.get(u);
        if (!outs) continue;
        for (const v of outs) {

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

    for (const k of allKeys) {
      if (assigned.has(k)) continue;
      const nodes = expandFrom(k);
      for (const n of nodes) assigned.add(n);
      fluxos.push({ starts: [k], nodes });
    }

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

    const flowSigs = new Set();

    if (opts && opts.splitFiles) {
      const files = [];
      let fileIndex = 0;

      const buildOne = (fluxo, idx) => {

        const procId = 'Process_Fluxo_' + idx;

        let x = '';
        x += '<?xml version="1.0" encoding="UTF-8"?>\n';
        x += '<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n';
        x += '  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"\n';
        x += '  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"\n';
        x += '  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"\n';
        x += '  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"\n';
        x += '  id="Definitions_ATP_' + idx + '" targetNamespace="http://tjsp.eproc/atp">\n';

        const startName = (fluxo && fluxo.starts && fluxo.starts.length) ? String(fluxo.starts[0]) : ('Fluxo ' + idx);
        x += '  <bpmn:process id="' + procId + '" isExecutable="false">\n';

        const nodes = Array.from((fluxo && fluxo.nodes) ? fluxo.nodes : []);

        const nodeSet = new Set(nodes);

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

        const taskIdByNode = new Map();
        for (const n of nodesAll) {
          const tid = makeId('Task_' + procId, n);
          taskIdByNode.set(n, tid);
          x += '    <bpmn:task id="' + tid + '" name="' + xmlEsc(n) + '"/>\n';
        }

        const gwIdByNode = new Map();
        const outLocal = new Map();
        for (const n of nodes) {
          const outs = outGlobal.get(n);
          const arr = outs ? Array.from(outs).filter(t => nodeSetAll.has(t)) : [];
          outLocal.set(n, arr);

          let branches = 0;
          for (const t of arr) {
            const labels = edgeMeta.get(n + '||' + t) || [];
            branches += Math.max(1, labels.length);
          }

          if (branches > 1) {
            const gid = makeId('Gw_' + procId, n);
            gwIdByNode.set(n, gid);
            x += '    <bpmn:exclusiveGateway id="' + gid + '" name="Decisóo"/>';
          }
        }

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

        const svcTaskMeta = new Map();
        const svcIdsByEdge = new Map();

        let svcCount = 0;
        for (const from of nodesAll) {
          const outs = outGlobal.get(from);
          if (!outs) continue;

          for (const to of outs) {
            if (!nodeSetAll.has(to)) continue;

            const labels = edgeMeta.get(from + '||' + to) || [];
            const labs = labels.length ? labels : ['REGRA ?'];

            for (let li = 0; li < labs.length; li++) {
              const label = labs[li];

              const fullLabel = String(label == null ? '' : label);

              const isRef = /^\s*REFINAMENTO\b/i.test(fullLabel);
              if (isRef) {

                continue;
              }

              svcCount++;

              const sid = 'Svc_' + procId + '_' + svcCount;

              svcTaskMeta.set(sid, { from, to, label });
              const k = from + '||' + to;
              const arr = svcIdsByEdge.get(k) || [];
              arr.push(sid);
              svcIdsByEdge.set(k, arr);

              let shortLabel = truncateBpmnName(fullLabel, 420);
              let docLabel = truncateBpmnDoc(fullLabel, 5000);

              x += '    <bpmn:serviceTask id="' + sid + '" name="' + xmlEsc(shortLabel) + '">\n';
              x += '      <bpmn:documentation>' + xmlEsc(docLabel) + '</bpmn:documentation>\n';
              x += '    </bpmn:serviceTask>\n';
            }
          }
        }

        let flowCount = 0;
        const edgesForDI = [];
        const addFlow = (srcId, dstId, name) => {
          flowCount++;
          const fid = 'Flow_' + procId + '_' + flowCount;
          x += '    <bpmn:sequenceFlow id="' + fid + '" sourceRef="' + srcId + '" targetRef="' + dstId + '"' + (name ? (' name="' + xmlEsc(name) + '"') : '') + '/>\n';
          edgesForDI.push({ id: fid, src: srcId, dst: dstId });
        };

        const startsList = (fluxo && fluxo.starts && fluxo.starts.length) ? fluxo.starts : (nodes.length ? [nodes[0]] : []);
        for (const st of startsList) {
          if (!taskIdByNode.has(st)) continue;
          addFlow(startId, taskIdByNode.get(st), '');
        }

        for (const from of nodes) {
          const outs = outLocal.get(from) || [];
          const fromTaskId = taskIdByNode.get(from);
          const gwId = gwIdByNode.get(from);

          if (gwId) {

            addFlow(fromTaskId, gwId, '');

            for (const to of outs) {
              const toTaskId = taskIdByNode.get(to);
              const edgeKey = from + '||' + to;
              const svcIds = svcIdsByEdge.get(edgeKey) || [];

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

            if (outs.length) {
              for (const to of outs) {
                const toTaskId = taskIdByNode.get(to);
                const edgeKey = from + '||' + to;
                const svcIds = svcIdsByEdge.get(edgeKey) || [];

                if (svcIds.length) {

                  const sid = svcIds[0];
                  addFlow(fromTaskId, sid, '');
                  addFlow(sid, toTaskId, '');
                } else {

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

        x += '  <bpmndi:BPMNDiagram id="BPMNDiagram_' + procId + '">\n';
        x += '    <bpmndi:BPMNPlane id="BPMNPlane_' + procId + '" bpmnElement="' + procId + '">\n';

        const padX = 40, padY = 40;

        const nodeW = 240, nodeH = 80;
        const gwW = 50, gwH = 50;
        const svcW = 220, svcH = 60;

        const GAP = 100;
        function applyHorizontalGap(x, gap) { return Math.round(x + (gap || GAP)); }
        const gapX = GAP, gapY = GAP;

        const COL_W = nodeW + GAP + gwW + GAP + svcW + GAP;
        const bandGap = nodeH + GAP;

        const END_W = 36, END_H = 36;

        const branchesByFrom = new Map();
        function getBranches(from) {
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

        const posNode = new Map();
        const gwPos = new Map();
        const svcPos = new Map();
        const endPos = new Map();

        let maxX = 0, maxY = 0;
        function setBoundsMax(x0, y0, w0, h0) {
          maxX = Math.max(maxX, x0 + w0);
          maxY = Math.max(maxY, y0 + h0);
        }

        const __nodeSet = new Set(nodesAll || []);

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

        const q = [];
        for (const n of __reach) if ((indeg.get(n) || 0) === 0) q.push(n);

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

        const byLevel = Array.from({ length: maxLevel + 1 }, () => []);
        for (const n of topo) {
          const l = level.get(n) || 0;
          byLevel[l].push(n);
        }

        const startX0 = padX + 40;
        const baseXTask = applyHorizontalGap(startX0 + 36, GAP);

        const maxRows = Math.max(1, ...byLevel.map(arr => arr.length || 0));
        const colHeight = (maxRows * nodeH) + ((maxRows - 1) * gapY);

        for (let l = 0; l < byLevel.length; l++) {
          const col = byLevel[l];
          const xTask = baseXTask + (l * COL_W);

          const topY = padY + 60 + Math.max(0, Math.floor((colHeight - ((col.length * nodeH) + ((col.length - 1) * gapY))) / 2));
          for (let i = 0; i < col.length; i++) {
            const n = col[i];
            if (!taskIdByNode.has(n)) continue;
            const y = topY + i * (nodeH + gapY);
            posNode.set(n, { x: Math.round(xTask), y: Math.round(y) });
            setBoundsMax(xTask, y, nodeW, nodeH);
          }
        }

        const svcStackByEdge = new Map();
        function nextSvcOffset(edgeKey) {
          const c = svcStackByEdge.get(edgeKey) || 0;
          svcStackByEdge.set(edgeKey, c + 1);

          return (c - 0) * Math.min(24, Math.floor(gapY / 4));
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
              const gy = Math.round(pFrom.y + (nodeH / 2) - (gwH / 2));
              gwPos.set(gid, { x: gx, y: gy, w: gwW, h: gwH });
              setBoundsMax(gx, gy, gwW, gwH);
            }
          }

          for (const b of br) {
            const to = b.to;
            if (!to || !posNode.has(to)) continue;
            const pTo = posNode.get(to);
            const midY = Math.round(((pFrom.y + nodeH / 2) + (pTo.y + nodeH / 2)) / 2);

            const edgeKey = String(from) + '||' + String(to);
            const off = nextSvcOffset(edgeKey);

            const gx0 = hasGw ? applyHorizontalGap(pFrom.x + nodeW, GAP) : null;
            const xSvc = hasGw
              ? applyHorizontalGap(gx0 + gwW, GAP)
              : applyHorizontalGap(pFrom.x + nodeW, GAP);
            const ySvc = Math.round(midY - svcH / 2 + off);

            if (b.sid) {
              svcPos.set(b.sid, { x: xSvc, y: ySvc, w: svcW, h: svcH });
              setBoundsMax(xSvc, ySvc, svcW, svcH);
            }
          }

          if (!outs.length) {
            const eid = endIdByNode.get(from);
            if (eid) {
              const ex = applyHorizontalGap(pFrom.x + nodeW, GAP);
              const ey = Math.round(pFrom.y + (nodeH / 2) - (END_H / 2));
              endPos.set(eid, { x: ex, y: ey, w: END_W, h: END_H });
              setBoundsMax(ex, ey, END_W, END_H);
            }
          }
        }

        maxY = Math.max(maxY, padY + 60 + colHeight + padY);

        let __maxSvcStack = 1;
        try {
          const __tmp = new Map();
          for (const meta of (svcTaskMeta ? svcTaskMeta.values() : [])) {
            if (!meta || !meta.from || !meta.to) continue;
            const k = String(meta.from) + '||' + String(meta.to);
            __tmp.set(k, (__tmp.get(k) || 0) + 1);
          }
          for (const v of __tmp.values()) __maxSvcStack = Math.max(__maxSvcStack, v || 1);
        } catch (e) { }

        const startX = padX + 40;
        let startY = padY + 60;
        try {
          const __st0 = (startsOrdered && startsOrdered.length) ? startsOrdered[0] : ((startsList && startsList.length) ? startsList[0] : null);
          const __p0 = __st0 ? posNode.get(__st0) : null;
          if (__p0) startY = Math.round(__p0.y + (nodeH - 36) / 2);
        } catch (e) { }
        x += '      <bpmndi:BPMNShape id="DI_' + startId + '" bpmnElement="' + startId + '">\n';
        x += '        <dc:Bounds x="' + startX + '" y="' + startY + '" width="36" height="36"/>\n';
        x += '      </bpmndi:BPMNShape>\n';

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
            const gy = gp ? gp.y : (p.y + (nodeH / 2) - 25);
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

        for (const [sid, p0] of svcPos.entries()) {
          x += '      <bpmndi:BPMNShape id="DI_' + sid + '" bpmnElement="' + sid + '">\n';
          x += '        <dc:Bounds x="' + p0.x + '" y="' + p0.y + '" width="' + p0.w + '" height="' + p0.h + '"/>\n';
          x += '      </bpmndi:BPMNShape>\n';
        }

        const __svcDockYBySid = new Map();
        try {
          const DOCK_MARGIN = 12;
          const DOCK_MIN_GAP = 8;

          const byTo = new Map();
          for (const [sid, meta] of svcTaskMeta.entries()) {
            if (!meta || !meta.to) continue;
            const t = String(meta.to);
            const arr = byTo.get(t) || [];
            arr.push(sid);
            byTo.set(t, arr);
          }

          for (const [toNode, sids] of byTo.entries()) {

            const toTid = taskIdByNode.get(toNode);
            if (!toTid) continue;
            const tb = (function () {
              console.log('[ATP][HUBS] virtual hubs build active');
              const p0 = posNode.get(toNode);
              if (!p0) return null;
              return { x: p0.x, y: p0.y, w: nodeW, h: nodeH };
            })();
            if (!tb) continue;
            const minY = tb.y + DOCK_MARGIN;
            const maxY = tb.y + tb.h - DOCK_MARGIN;

            const arr = (sids || []).slice().filter(id => svcPos.has(id));
            arr.sort((a, b) => {
              const pa = svcPos.get(a); const pb = svcPos.get(b);
              const ya = pa ? (pa.y + pa.h / 2) : 0;
              const yb = pb ? (pb.y + pb.h / 2) : 0;
              return (ya - yb) || String(a).localeCompare(String(b));
            });

            const docks = [];
            for (let i = 0; i < arr.length; i++) {
              const sid = arr[i];
              const sp = svcPos.get(sid);
              const desired = sp ? (sp.y + sp.h / 2) : ((minY + maxY) / 2);
              let dy = Math.max(minY, Math.min(maxY, desired));
              if (i > 0) dy = Math.max(dy, docks[i - 1] + DOCK_MIN_GAP);
              docks.push(dy);
            }

            if (docks.length) {
              const overflow = docks[docks.length - 1] - maxY;
              if (overflow > 0) {
                for (let i = docks.length - 1; i >= 0; i--) {
                  docks[i] -= overflow;
                  if (i < docks.length - 1) docks[i] = Math.min(docks[i], docks[i + 1] - DOCK_MIN_GAP);
                  docks[i] = Math.max(docks[i], minY);
                }
              }
            }

            for (let i = 0; i < arr.length; i++) __svcDockYBySid.set(arr[i], Math.round(docks[i]));
          }
        } catch (e) { }

        const ROUTE_MIN_CLEAR = 100;
        const ROUTE_CORRIDOR_GAP = 70;

        const __diGetBoundsById = (function () {

          return function (elId) {

            if (elId === startId) return { x: padX + 40, y: padY + 80, w: 36, h: 36 };

            for (let ii = 0; ii < nodes.length; ii++) {
              const n = nodes[ii];
              const tid = taskIdByNode.get(n);
              if (tid === elId) {
                const p0 = posNode.get(n) || { x: padX + 280, y: padY + 60 };
                return { x: p0.x, y: p0.y, w: nodeW, h: nodeH };
              }
            }

            for (const [sid, s] of svcPos.entries()) {
              if (sid === elId) return { x: s.x, y: s.y, w: s.w, h: s.h };
            }

            for (const [n, gid] of gwIdByNode.entries()) {
              if (gid === elId) {
                const p = posNode.get(n) || { x: padX + 280, y: padY + 60 };
                const gp = (typeof gwPos !== 'undefined' && gwPos && gwPos.get(gid)) ? gwPos.get(gid) : null;
                if (gp) return { x: gp.x, y: gp.y, w: gp.w, h: gp.h };
                const gx = p.x + nodeW + gapX;
                const gy = p.y + (nodeH / 2) - (gwH / 2);
                return { x: gx, y: gy, w: gwW, h: gwH };
              }
            }

            for (const [n, eid] of endIdByNode.entries()) {
              if (eid === elId) {
                const p = posNode.get(n) || { x: padX + 280, y: padY + 60 };
                const ex = applyHorizontalGap(p.x + nodeW, GAP);
                const ey = Math.round(p.y + (nodeH - 36) / 2);
                return { x: ex, y: ey, w: 36, h: 36 };
              }
            }

            return { x: padX + 280, y: padY + 60, w: 2, h: 2 };
          };
        })();

        const __diCorridorIndexByFlowId = new Map();
        const __diOutBySrc = new Map();

        for (const e0 of edgesForDI) {
          const sb0 = __diGetBoundsById(e0.src);
          const tb0 = __diGetBoundsById(e0.dst);
          const fromC0 = { x: sb0.x + sb0.w / 2, y: sb0.y + sb0.h / 2 };
          const toC0 = { x: tb0.x + tb0.w / 2, y: tb0.y + tb0.h / 2 };
          const leftToRight0 = (toC0.x >= fromC0.x);
          const pA0 = { x: leftToRight0 ? (sb0.x + sb0.w) : sb0.x, y: sb0.y + sb0.h / 2 };
          const pB0 = { x: leftToRight0 ? tb0.x : (tb0.x + tb0.w), y: tb0.y + tb0.h / 2 };

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
          arr.sort((a, b) => (a.ty - b.ty));
          for (let i = 0; i < arr.length; i++) {
            __diCorridorIndexByFlowId.set(arr[i].fid, i);
          }
        }

        const centerOf = (elId) => {
          const bb = __diGetBoundsById(elId);
          return { x: bb.x + bb.w / 2, y: bb.y + bb.h / 2 };
        };

        for (const e of edgesForDI) {
          const a = centerOf(e.src);
          const b = centerOf(e.dst);
          x += '      <bpmndi:BPMNEdge id="DI_' + e.id + '" bpmnElement="' + e.id + '">';

          const sb = (function (elId) {

            for (let ii = 0; ii < nodes.length; ii++) {
              const n = nodes[ii];
              const tid = taskIdByNode.get(n);
              if (tid === elId) {
                const p0 = posNode.get(n) || { x: padX + 280, y: padY + 60 };
                return { x: p0.x, y: p0.y, w: nodeW, h: nodeH };
              }
            }

            for (const [sid, s] of svcPos.entries()) {
              if (sid === elId) return { x: s.x, y: s.y, w: s.w, h: s.h };
            }

            for (const [n, gid] of gwIdByNode.entries()) {
              if (gid === elId) {
                const p = posNode.get(n) || { x: padX + 280, y: padY + 60 };
                const gp = (typeof gwPos !== 'undefined' && gwPos && gwPos.get(gid)) ? gwPos.get(gid) : null;
                if (gp) return { x: gp.x, y: gp.y, w: gp.w, h: gp.h };
                const gx = p.x + nodeW + gapX;
                const gy = p.y + (nodeH / 2) - (gwH / 2);
                return { x: gx, y: gy, w: gwW, h: gwH };
              }
            }

            if (elId === startId) {
              const sx = startX;
              const sy = startY;
              return { x: sx, y: sy, w: 36, h: 36 };
            }

            for (const [n, eid] of endIdByNode.entries()) {
              if (eid === elId) {
                const p = posNode.get(n) || { x: padX + 280, y: padY + 60 };
                const ex = applyHorizontalGap(p.x + nodeW, GAP);
                const ey = Math.round(p.y + (nodeH - 36) / 2);
                return { x: ex, y: ey, w: 36, h: 36 };
              }
            }

            return { x: a.x, y: a.y, w: 2, h: 2 };
          })(e.src);

          const tb = (function (elId) {

            for (let ii = 0; ii < nodes.length; ii++) {
              const n = nodes[ii];
              const tid = taskIdByNode.get(n);
              if (tid === elId) {
                const p0 = posNode.get(n) || { x: padX + 280, y: padY + 60 };
                return { x: p0.x, y: p0.y, w: nodeW, h: nodeH };
              }
            }

            for (const [sid, s] of svcPos.entries()) {
              if (sid === elId) return { x: s.x, y: s.y, w: s.w, h: s.h };
            }

            for (const [n, gid] of gwIdByNode.entries()) {
              if (gid === elId) {
                const p = posNode.get(n) || { x: padX + 280, y: padY + 60 };
                const gp = (typeof gwPos !== 'undefined' && gwPos && gwPos.get(gid)) ? gwPos.get(gid) : null;
                if (gp) return { x: gp.x, y: gp.y, w: gp.w, h: gp.h };
                const gx = p.x + nodeW + gapX;
                const gy = p.y + (nodeH / 2) - (gwH / 2);
                return { x: gx, y: gy, w: gwW, h: gwH };
              }
            }

            for (const [n, eid] of endIdByNode.entries()) {
              if (eid === elId) {
                const p = posNode.get(n) || { x: padX + 280, y: padY + 60 };
                const ex = applyHorizontalGap(p.x + nodeW, GAP);
                const ey = Math.round(p.y + (nodeH - 36) / 2);
                return { x: ex, y: ey, w: 36, h: 36 };
              }
            }

            return { x: b.x, y: b.y, w: 2, h: 2 };
          })(e.dst);

          const fromC = { x: sb.x + sb.w / 2, y: sb.y + sb.h / 2 };
          const toC = { x: tb.x + tb.w / 2, y: tb.y + tb.h / 2 };
          const leftToRight = (toC.x >= fromC.x);

          const pA = { x: leftToRight ? (sb.x + sb.w) : sb.x, y: sb.y + sb.h / 2 };

          let dockY = null;
          try {
            if (typeof __svcDockYBySid !== 'undefined' && __svcDockYBySid && __svcDockYBySid.has(e.src)) {
              dockY = __svcDockYBySid.get(e.src);
            }
          } catch (e) { dockY = null; }

          const pB = { x: leftToRight ? tb.x : (tb.x + tb.w), y: (dockY != null ? dockY : (tb.y + tb.h / 2)) };
          const minClear = ROUTE_MIN_CLEAR;
          const corrIdx = __diCorridorIndexByFlowId.has(e.id) ? __diCorridorIndexByFlowId.get(e.id) : 0;

          const corrShift = (corrIdx || 0) * ROUTE_CORRIDOR_GAP;
          let midX;
          if (leftToRight) midX = Math.max(pA.x + minClear + corrShift, (pA.x + pB.x) / 2 + corrShift);
          else midX = Math.min(pA.x - minClear - corrShift, (pA.x + pB.x) / 2 - corrShift);

          if (leftToRight) midX = Math.min(midX, pB.x - 20);
          else midX = Math.max(midX, pB.x + 20);

          let wps;

          if (!leftToRight) {
            const dyB = (toC.y - fromC.y);

            let useTop;
            if (Math.abs(dyB) >= 30) {
              useTop = (dyB < 0);
            } else {

              let h = 0;
              try {
                const s = String(e.id || e.src || '') + '|' + String(e.dst || '');
                for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
              } catch (_) { h = 0; }
              useTop = ((h & 1) === 0);
            }

            const pA2 = { x: sb.x + sb.w / 2, y: useTop ? sb.y : (sb.y + sb.h) };
            const pB2 = { x: tb.x + tb.w / 2, y: useTop ? tb.y : (tb.y + tb.h) };

            const MARGIN = 40;
            const corridorY = useTop
              ? (Math.min(sb.y, tb.y) - MARGIN)
              : (Math.max(sb.y + sb.h, tb.y + tb.h) + MARGIN);

            wps = [
              { x: pA2.x, y: pA2.y },
              { x: pA2.x, y: corridorY },
              { x: pB2.x, y: corridorY },
              { x: pB2.x, y: pB2.y }
            ];
          } else {

            wps = [
              { x: pA.x, y: pA.y },
              { x: midX, y: pA.y },
              { x: midX, y: pB.y },
              { x: pB.x, y: pB.y }
            ];
          }

          for (let wi = 0; wi < wps.length; wi++) {
            x += '        <di:waypoint x="' + wps[wi].x + '" y="' + wps[wi].y + '"/>';
          }
          x += '      </bpmndi:BPMNEdge>';
        }

        x += '    </bpmndi:BPMNPlane>\n';
        x += '  </bpmndi:BPMNDiagram>\n';
        x += '</bpmn:definitions>\n';

        try {
          if (!opts || !opts.__skipUniqueLayout) {
            x = (window.__ATP_UNIQUE_LAYOUT__ && window.__ATP_UNIQUE_LAYOUT__.apply) ? window.__ATP_UNIQUE_LAYOUT__.apply(x) : x;
          }
        } catch (e) {
          try { console.warn('[ATP][LAYOUT] Falha ao aplicar layout único no XML final do fluxo:', e); } catch (_) { }
        }

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

    let xml = '';
    xml += '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n';
    xml += '  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"\n';
    xml += '  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"\n';
    xml += '  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"\n';
    xml += '  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"\n';
    xml += '  id="Definitions_ATP" targetNamespace="http://tjsp.eproc/atp">\n';

    let processesXML = '';
    let diShapes = '';
    let diEdges = '';

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

    const DX = 420;
    const DY = 240;

    let poolY = 40;
    let fluxoCount = 0;

    for (const fl of fluxos) {
      const startLoc = (fl && fl.starts && fl.starts[0]) ? fl.starts[0] : '';

      const startName = norm(startLoc);
      if (!startName) continue;

      const nodesSet = new Set((fl && fl.nodes) ? Array.from(fl.nodes) : []);
      if (!nodesSet.size) continue;

      if (!nodesSet.size) continue;

      const nodes = Array.from(nodesSet);
      const nodeSet = new Set(nodes);

      const out = new Map();
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

      const sig = nodes.slice().sort().join('||') + '##' + edges.slice().sort((a, b) => (a[0] + a[1]).localeCompare(b[0] + b[1])).map(e => e[0] + '->' + e[1]).join('|');
      const sigHash = Math.abs(hashCode(sig)).toString(36);
      if (flowSigs.has(sigHash)) continue;
      flowSigs.add(sigHash);

      fluxoCount++;
      const procId = 'Process_Fluxo_' + fluxoCount;

      let p = '';
      p += '  <bpmn:process id="' + procId + '" isExecutable="false">\n';

      const startEventId = 'Start_' + procId;
      p += '    <bpmn:startEvent id="' + startEventId + '" name="Início"/>\n';

      const taskId = new Map();
      nodes.forEach(n => taskId.set(n, makeId('Task_' + procId, n)));

      const gwId = new Map();
      for (const [u, vs] of out.entries()) {
        const uniq = Array.from(new Set(vs));
        if (uniq.length > 1) {
          gwId.set(u, makeId('Gw_' + procId, u));
        }
      }

      const terminals = nodes.filter(n => !(out.get(n) && out.get(n).length));
      const endId = new Map();
      terminals.forEach((n, i) => endId.set(n, 'End_' + procId + '_' + (i + 1)));

      for (const n of nodes) {
        p += '    <bpmn:task id="' + taskId.get(n) + '" name="' + xmlEsc(n) + '"/>\n';
      }
      for (const [u, gid] of gwId.entries()) {
        p += '    <bpmn:exclusiveGateway id="' + gid + '" name="Decisóo"/>\n';
      }
      for (const [n, eid] of endId.entries()) {
        p += '    <bpmn:endEvent id="' + eid + '" name="Fim"/>\n';
      }

      let flowN = 0;
      const mkFlowId = () => 'Flow_' + procId + '_' + (++flowN);

      const flowIds = [];
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
            const label = labels.length ? labels[0] : '';
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

      for (const n of terminals) {
        const eid = endId.get(n);
        const fTE = mkFlowId();
        p += '    <bpmn:sequenceFlow id="' + fTE + '" sourceRef="' + taskId.get(n) + '" targetRef="' + eid + '"/>\n';
        flowIds.push([fTE, taskId.get(n), eid]);
      }

      p += '  </bpmn:process>\n';
      processesXML += p;

      let levels = new Map();
      const q = [];
      for (const sk of startKeys) {
        if (!sk) continue;
        if (!levels.has(sk)) {
          levels.set(sk, 0);
          q.push(sk);
        }
      }

      if (!q.length && startName) { levels.set(startName, 0); q.push(startName); }
      while (q.length) {
        const u = q.shift();
        const lv = levels.get(u) || 0;
        const vs = out.get(u) || [];
        for (const v of vs) {
          if (!levels.has(v)) { levels.set(v, lv + 1); q.push(v); }
        }
      }

      const byLevel = new Map();
      for (const n of nodes) {
        const lv = levels.has(n) ? levels.get(n) : 0;
        if (!byLevel.has(lv)) byLevel.set(lv, []);
        byLevel.get(lv).push(n);
      }

      for (const [lv, arr] of byLevel.entries()) {
        arr.sort((a, b) => a.localeCompare(b));
      }

      const pos = new Map();
      const startX = POOL_X + POOL_PAD_X;
      const startY = poolY + POOL_PAD_Y;

      const GAP_MIN = 50;

      const startSet = new Set([startEventId]);
      const gwSet = new Set(Array.from(gatewayId.values()));
      const endSet = new Set(Array.from(endId.values()));

      const isStart = (id) => startSet.has(id);
      const isGateway = (id) => gwSet.has(id);
      const isEnd = (id) => endSet.has(id);
      const isTask = (id) => (!isStart(id) && !isGateway(id) && !isEnd(id));

      const dimsOf = (id) => {
        if (isStart(id) || isEnd(id)) return { w: EV_W, h: EV_H };
        if (isGateway(id)) return { w: GW_W, h: GW_H };
        return { w: TASK_W, h: TASK_H };
      };

      const allEls = [];
      allEls.push(startEventId);
      for (const id of taskId.values()) allEls.push(id);
      for (const id of gatewayId.values()) allEls.push(id);
      for (const id of endId.values()) allEls.push(id);

      const outEl = new Map();
      const inEl = new Map();
      for (const id of allEls) { outEl.set(id, []); inEl.set(id, []); }
      for (const [fid, srcEl, dstEl] of flowIds) {
        if (!outEl.has(srcEl)) outEl.set(srcEl, []);
        if (!inEl.has(dstEl)) inEl.set(dstEl, []);
        outEl.get(srcEl).push(dstEl);
        inEl.get(dstEl).push(srcEl);
      }

      const levelEl = new Map();
      const qEl = [];
      levelEl.set(startEventId, 0);
      qEl.push(startEventId);
      while (qEl.length) {
        const u = qEl.shift();
        const lu = levelEl.get(u) || 0;
        const vs = outEl.get(u) || [];
        for (const v of vs) {
          const cand = lu + 1;
          if (!levelEl.has(v) || cand > levelEl.get(v)) {
            levelEl.set(v, cand);
            qEl.push(v);
          }
        }
      }

      const maxLv = Math.max(0, ...Array.from(levelEl.values()));

      const targetCY = new Map();

      for (let lv = 0; lv <= maxLv; lv++) {
        const ids = allEls.filter(id => (levelEl.get(id) ?? 0) === lv);
        ids.sort((a, b) => a.localeCompare(b));
        for (let i = 0; i < ids.length; i++) {
          targetCY.set(ids[i], startY + 120 + i * (TASK_H + 30));
        }
      }

      const centerY = (id) => targetCY.get(id) ?? (startY + 200);
      const setCY = (id, cy) => targetCY.set(id, cy);

      for (let lv = 0; lv <= maxLv; lv++) {
        const parents = allEls.filter(id => (levelEl.get(id) ?? 0) === lv);
        parents.sort((a, b) => a.localeCompare(b));
        for (const pid of parents) {
          const kidsAll = (outEl.get(pid) || []);

          const kids = kidsAll.filter(k => (levelEl.get(k) ?? (lv + 1)) === lv + 1);
          if (!kids.length) continue;

          const pcy = centerY(pid);

          if (kids.length === 1) {
            setCY(kids[0], pcy);
          } else {

            const kidDims = kids.map(k => dimsOf(k));
            const totalH = kidDims.reduce((acc, d) => acc + d.h, 0) + GAP_MIN * (kids.length - 1);
            let top = pcy - totalH / 2;
            for (let i = 0; i < kids.length; i++) {
              const d = kidDims[i];
              const cy = top + d.h / 2;
              setCY(kids[i], cy);
              top += d.h + GAP_MIN;
            }
          }
        }
      }

      const X_STEP = TASK_W + H_GAP;
      const placeColumn = (lv) => {
        const ids = allEls.filter(id => (levelEl.get(id) ?? 0) === lv);
        ids.sort((a, b) => centerY(a) - centerY(b));

        let cursor = startY;
        for (const id of ids) {
          const d = dimsOf(id);
          let topY = centerY(id) - d.h / 2;
          if (topY < cursor) topY = cursor;
          const x = startX + lv * X_STEP + (isGateway(id) ? 40 : 0) + (isStart(id) ? 0 : 0);
          pos.set(id, { x, y: topY, w: d.w, h: d.h });
          cursor = topY + d.h + GAP_MIN;
        }

        for (let i = ids.length - 2; i >= 0; i--) {
          const A = pos.get(ids[i]);
          const B = pos.get(ids[i + 1]);
          const maxTop = B.y - GAP_MIN - A.h;
          if (A.y > maxTop) A.y = maxTop;
        }

        for (const id of ids) {
          const p = pos.get(id);
          targetCY.set(id, p.y + p.h / 2);
        }
      };

      for (let lv = 0; lv <= maxLv; lv++) placeColumn(lv);

      const firstKids = (outEl.get(startEventId) || []);
      if (firstKids.length === 1 && pos.has(firstKids[0])) {
        const kid = pos.get(firstKids[0]);
        const st = pos.get(startEventId);
        st.y = (kid.y + kid.h / 2) - st.h / 2;
      }

      const boxes = [];
      for (const [id, p] of pos.entries()) boxes.push({ id, x: p.x, y: p.y, w: p.w, h: p.h });
      pos.__ATP_ALL_BOXES__ = boxes;

      if (!NO_POOL) {
        diShapes += '    <bpmndi:BPMNShape id="DI_' + partId + '" bpmnElement="' + procId + '">\n';
        diShapes += '      <dc:Bounds x="' + POOL_X + '" y="' + poolY + '" width="' + poolW + '" height="' + poolH + '"/>\n';
        diShapes += '    </bpmndi:BPMNShape>\n';
      }

      const addShape = (elId) => {
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

      const center = (p0) => ({ cx: p0.x + p0.w / 2, cy: p0.y + p0.h / 2 });
      const rightMid = (p0) => ({ x: p0.x + p0.w, y: p0.y + p0.h / 2 });
      const leftMid = (p0) => ({ x: p0.x, y: p0.y + p0.h / 2 });

      for (const [fid, srcEl, dstEl] of flowIds) {
        const ps = pos.get(srcEl);
        const pt = pos.get(dstEl);
        if (!ps || !pt) continue;
        const a = rightMid(ps);
        const b = leftMid(pt);

        const boxes = pos.__ATP_ALL_BOXES__ || [];
        const segHits = (x1, y1, x2, y2, bb) => {
          const pad = 8;
          const L = bb.x - pad, R = bb.x + bb.w + pad, T = bb.y - pad, B = bb.y + bb.h + pad;
          if (x1 === x2) {
            const x = x1, yMin = Math.min(y1, y2), yMax = Math.max(y1, y2);
            return (x >= L && x <= R && yMax >= T && yMin <= B);
          }
          if (y1 === y2) {
            const y = y1, xMin = Math.min(x1, x2), xMax = Math.max(x1, x2);
            return (y >= T && y <= B && xMax >= L && xMin <= R);
          }
          return false;
        };
        const pathHitsAny = (pts, ignoreA, ignoreB) => {
          for (let i = 0; i < pts.length - 1; i++) {
            const p1 = pts[i], p2 = pts[i + 1];
            for (const bb of boxes) {
              if (bb.id === ignoreA || bb.id === ignoreB) continue;
              if (segHits(p1.x, p1.y, p2.x, p2.y, bb)) return true;
            }
          }
          return false;
        };

        let midX = Math.round((a.x + b.x) / 2);

        const build = (mx) => ([
          { x: a.x, y: a.y },
          { x: mx, y: a.y },
          { x: mx, y: b.y },
          { x: b.x, y: b.y },
        ]);

        let pts = build(midX);
        if (pathHitsAny(pts, srcEl, dstEl)) {

          let ok = false;
          for (let k = 1; k <= 30; k++) {
            const mx = midX + 40 * k;
            const tpts = build(mx);
            if (!pathHitsAny(tpts, srcEl, dstEl)) { pts = tpts; ok = true; break; }
          }
          if (!ok) {
            for (let k = 1; k <= 30; k++) {
              const mx = midX - 40 * k;
              const tpts = build(mx);
              if (!pathHitsAny(tpts, srcEl, dstEl)) { pts = tpts; ok = true; break; }
            }
          }
        }

        diEdges += '    <bpmndi:BPMNEdge id="DI_' + fid + '" bpmnElement="' + fid + '">\n';
        for (const p of pts) {
          diEdges += '      <di:waypoint x="' + p.x + '" y="' + p.y + '"/>\n';
        }
        diEdges += '    </bpmndi:BPMNEdge>\n';
      }

      poolY += poolH + 40;
    }
    xml += processesXML;

    xml += '  <bpmndi:BPMNDiagram id="BPMNDiagram_ATP">\n';
    xml += '    <bpmndi:BPMNPlane id="BPMNPlane_ATP" bpmnElement="' + procId + '">\n';
    xml += diShapes;
    xml += diEdges;
    xml += '    </bpmndi:BPMNPlane>\n';
    xml += '  </bpmndi:BPMNDiagram>\n';
    xml += '</bpmn:definitions>\n';

    try {
      const applier = window.__ATP_UNIQUE_LAYOUT__ && window.__ATP_UNIQUE_LAYOUT__.apply;
      if (typeof applier === 'function') {
        const before = xml;
        xml = applier(xml);
        if (xml !== before) console.log('[ATP][LAYOUT] applyUniqueLayout() aplicado no XML');
      } else {
        console.warn('[ATP][LAYOUT] Applier não encontrado (window.__ATP_UNIQUE_LAYOUT__.apply)');
      }
    } catch (e2) {
      console.warn('[ATP][LAYOUT] Erro ao aplicar layout único:', e2);
    }

    return xml;
  } catch (e) {
    console.warn(LOG_PREFIX, 'Falha ao gerar BPMN (pools por fluxo)', e);
    return null;
  }
}

try { console.log('[ATP][OK] 08-exportador-bpmn-bizagi.js inicializado'); } catch (e) { }
