try { console.log('[ATP][LOAD] 13-visualizador-fluxo-n8n.js carregado com sucesso'); } catch (e) {}

(function () {
  'use strict';

  const MOD = '[ATP][N8N]';
  const NODE_W = 260;
  const NODE_H = 96;
  const GAP_X = 320;
  const GAP_Y = 150;

  const c = (v) => {
    if (typeof clean === 'function') return clean(v);
    return String(v == null ? '' : v).replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
  };

  const trunc = (v, n) => {
    if (typeof atpTrunc === 'function') return atpTrunc(v, n);
    const s = String(v == null ? '' : v);
    if (s.length <= n) return s;
    return s.slice(0, Math.max(0, n - 1)).trimEnd() + '...';
  };

  const uniq = (arr) => Array.from(new Set((arr || []).filter(Boolean)));
  const h = (v) => String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  function asMapByFrom(raw) {
    if (raw instanceof Map) return raw;
    const out = new Map();
    if (raw && typeof raw === 'object') {
      Object.keys(raw).forEach((k) => out.set(k, Array.isArray(raw[k]) ? raw[k] : []));
    }
    return out;
  }

  function closeFlowN8nModal() {
    const el = document.getElementById('atpFlowN8nModal');
    if (!el) return;
    try {
      if (typeof el._atpEscHandler === 'function') {
        document.removeEventListener('keydown', el._atpEscHandler, true);
      }
    } catch (e) {}
    try { el.remove(); } catch (e) {}
  }

  function buildRuleConditionText(rule) {
    try {
      if (!rule || typeof rule !== 'object') return '';

      const chunks = [];
      const tipo = rule.tipoControleCriterio || null;
      const pares = Array.isArray(tipo && tipo.pares) ? tipo.pares : [];
      if (pares.length) {
        const terms = pares
          .map((p) => {
            const controle = c((p && p.controle) || '');
            const criterio = c((p && p.criterio) || '');
            if (controle && criterio) return `${controle}: ${criterio}`;
            return controle || criterio;
          })
          .filter(Boolean);
        if (terms.length) chunks.push(terms.join(' OU '));
      } else {
        const txt = c((tipo && tipo.canonical) || tipo || '');
        if (txt) chunks.push(txt);
      }

      const outros = (typeof atpHumanizeOutrosCriteriosExpr === 'function')
        ? c(atpHumanizeOutrosCriteriosExpr(rule.outrosCriterios))
        : c((rule.outrosCriterios && rule.outrosCriterios.canonical) || '');
      if (outros) chunks.push(outros);

      if (!chunks.length) {
        const acoes = (rule.localizadorIncluirAcao && Array.isArray(rule.localizadorIncluirAcao.acoes))
          ? rule.localizadorIncluirAcao.acoes
          : [];
        const ac = acoes
          .map((a) => c((a && (a.acao || a.etapa)) || ''))
          .filter(Boolean);
        if (ac.length) chunks.push(ac.join(' | '));
      }

      return chunks.join(' E ');
    } catch (e) {
      return '';
    }
  }

  function edgeLabel(item, toKey) {
    if (item && item.rule) {
      const ruleNum = c(item.rule.num || '');
      const cond = buildRuleConditionText(item.rule);
      const head = ruleNum ? `Regra ${ruleNum}` : 'Regra';
      const main = cond ? `${head}: ${cond}` : head;
      return {
        short: cond || head,
        full: `${main} => ${toKey}`
      };
    }
    if (item && item.__implied) {
      const txt = c(item.__label || 'Refinamento de condicao');
      return {
        short: txt,
        full: `${txt} => ${toKey}`
      };
    }
    return {
      short: 'Avancar',
      full: `Avancar para ${toKey}`
    };
  }

  function computeLayout(nodeIds, edges, starts) {
    const outgoing = new Map();
    const indeg = new Map();

    nodeIds.forEach((n) => {
      outgoing.set(n, []);
      indeg.set(n, 0);
    });
    edges.forEach((e) => {
      if (!outgoing.has(e.from)) outgoing.set(e.from, []);
      outgoing.get(e.from).push(e);
      indeg.set(e.to, (indeg.get(e.to) || 0) + 1);
    });

    const depth = new Map();
    const q = [];
    const seeds = uniq((starts && starts.length) ? starts : nodeIds.filter((n) => (indeg.get(n) || 0) === 0));
    seeds.forEach((s) => {
      depth.set(s, 0);
      q.push(s);
    });

    while (q.length) {
      const cur = q.shift();
      const d = depth.get(cur) || 0;
      const outs = outgoing.get(cur) || [];
      outs.forEach((e) => {
        const nd = d + 1;
        const prev = depth.get(e.to);
        if (prev == null || nd < prev) {
          depth.set(e.to, nd);
          q.push(e.to);
        }
      });
    }

    let maxDepth = 0;
    depth.forEach((v) => { if (v > maxDepth) maxDepth = v; });
    nodeIds.forEach((n) => {
      if (!depth.has(n)) {
        maxDepth += 1;
        depth.set(n, maxDepth);
      }
    });

    const levels = new Map();
    nodeIds.forEach((n) => {
      const d = depth.get(n) || 0;
      if (!levels.has(d)) levels.set(d, []);
      levels.get(d).push(n);
    });

    const pos = new Map();
    const depthKeys = Array.from(levels.keys()).sort((a, b) => a - b);
    let maxRows = 1;
    depthKeys.forEach((dk) => {
      const arr = levels.get(dk) || [];
      arr.sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));
      if (arr.length > maxRows) maxRows = arr.length;
      arr.forEach((nodeKey, row) => {
        pos.set(nodeKey, {
          x: 120 + (dk * GAP_X),
          y: 90 + (row * GAP_Y),
          w: NODE_W,
          h: NODE_H
        });
      });
    });

    const sceneW = Math.max(1200, 280 + (depthKeys.length * GAP_X));
    const sceneH = Math.max(720, 220 + (maxRows * GAP_Y));
    return { pos, sceneW, sceneH };
  }

  function pathForEdge(a, b) {
    const sx = a.x + a.w;
    const sy = a.y + (a.h / 2);
    const tx = b.x;
    const ty = b.y + (b.h / 2);

    let bend = Math.max(90, Math.abs(tx - sx) * 0.45);
    if (tx <= sx) bend = 120;
    const c1x = sx + bend;
    const c2x = tx - bend;
    return `M ${sx} ${sy} C ${c1x} ${sy}, ${c2x} ${ty}, ${tx} ${ty}`;
  }

  function buildModel(data, flowIdx) {
    const fluxos = (data && Array.isArray(data.fluxos)) ? data.fluxos : [];
    const fluxo = fluxos[flowIdx] || null;
    if (!fluxo) return null;

    const nodeIds = uniq([].concat(
      Array.isArray(fluxo.nodes) ? fluxo.nodes : [],
      Array.isArray(fluxo.starts) ? fluxo.starts : []
    ));
    if (!nodeIds.length) return null;

    const nodeSet = new Set(nodeIds);
    const byFrom = asMapByFrom(data && data.byFrom);
    const edges = [];
    let seq = 0;

    nodeIds.forEach((from) => {
      const items = Array.isArray(byFrom.get(from)) ? byFrom.get(from).slice() : [];
      items.sort((a, b) => {
        const an = Number(a && a.rule && a.rule.num);
        const bn = Number(b && b.rule && b.rule.num);
        if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
        if (Number.isFinite(an)) return -1;
        if (Number.isFinite(bn)) return 1;
        return 0;
      });

      items.forEach((item, idx) => {
        const toKeys = uniq((item && item.toKeys) || []);
        toKeys.forEach((to) => {
          if (!nodeSet.has(to)) return;
          const lbl = edgeLabel(item, to);
          seq += 1;
          edges.push({
            id: `e_${String(seq)}_${String(idx)}`,
            from,
            to,
            rule: item && item.rule ? item.rule : null,
            implied: !!(item && item.__implied),
            shortLabel: c(lbl.short),
            fullLabel: c(lbl.full)
          });
        });
      });
    });

    const outgoing = new Map();
    nodeIds.forEach((n) => outgoing.set(n, []));
    edges.forEach((e) => {
      if (!outgoing.has(e.from)) outgoing.set(e.from, []);
      outgoing.get(e.from).push(e);
    });

    const startsRaw = uniq(Array.isArray(fluxo.starts) ? fluxo.starts.filter((s) => nodeSet.has(s)) : []);
    const starts = startsRaw.length ? startsRaw : [nodeIds[0]];
    const layout = computeLayout(nodeIds, edges, starts);

    return {
      flowIdx,
      fluxo,
      nodeIds,
      edges,
      outgoing,
      starts,
      layout
    };
  }

  function openFlowN8nModal(opts) {
    try {
      const o = opts || {};
      const flowIdx = Number.isFinite(Number(o.flowIdx)) ? Number(o.flowIdx) : 0;
      const rules = Array.isArray(o.rules) ? o.rules : [];
      const data = (o.data && typeof o.data === 'object')
        ? o.data
        : ((window.ATP && window.ATP.extract && typeof window.ATP.extract.getFluxosData === 'function')
            ? window.ATP.extract.getFluxosData(rules)
            : (typeof atpComputeFluxosData === 'function' ? atpComputeFluxosData(rules) : null));

      const model = buildModel(data, flowIdx);
      if (!model) {
        alert('Nao foi possivel montar o fluxo selecionado.');
        return;
      }

      try {
        if (typeof atpCloseRuleMapModal === 'function') atpCloseRuleMapModal();
      } catch (e) {}
      closeFlowN8nModal();

      const overlay = document.createElement('div');
      overlay.id = 'atpFlowN8nModal';
      overlay.className = 'atp-n8n-overlay';
      overlay.addEventListener('click', (ev) => {
        if (ev.target === overlay) closeFlowN8nModal();
      });

      const title = `Visualizar Fluxo ${String((model.flowIdx | 0) + 1).padStart(2, '0')} (N8N-like)`;
      const startsTxt = model.starts.join(' | ');
      overlay.innerHTML = [
        '<div class="atp-n8n-box">',
        '  <div class="atp-n8n-top">',
        '    <div>',
        `      <div class="atp-n8n-title">${h(title)}</div>`,
        `      <div class="atp-n8n-sub">Inicios: ${h(startsTxt)} | Nos: ${h(model.nodeIds.length)} | Transicoes: ${h(model.edges.length)}</div>`,
        '    </div>',
        '    <div class="atp-n8n-actions">',
        '      <button type="button" class="atp-n8n-btn primary" data-atp-play>Play</button>',
        '      <button type="button" class="atp-n8n-btn" data-atp-reset>Reiniciar</button>',
        '      <button type="button" class="atp-n8n-btn" data-atp-zoom-out>-</button>',
        '      <span class="atp-n8n-zoom" data-atp-zoom>100%</span>',
        '      <button type="button" class="atp-n8n-btn" data-atp-zoom-in>+</button>',
        '      <button type="button" class="atp-n8n-btn" data-atp-fit>Fit</button>',
        '      <button type="button" class="atp-n8n-btn" data-atp-close>Fechar</button>',
        '    </div>',
        '  </div>',
        '  <div class="atp-n8n-main">',
        '    <div class="atp-n8n-canvas" data-atp-canvas>',
        '      <div class="atp-n8n-scene" data-atp-scene>',
        `        <svg class="atp-n8n-edges" data-atp-edges width="${model.layout.sceneW}" height="${model.layout.sceneH}" viewBox="0 0 ${model.layout.sceneW} ${model.layout.sceneH}">`,
        '          <defs>',
        '            <marker id="atpN8nArrow" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto">',
        '              <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b"></path>',
        '            </marker>',
        '          </defs>',
        '        </svg>',
        `        <div class="atp-n8n-nodes" data-atp-nodes style="width:${model.layout.sceneW}px;height:${model.layout.sceneH}px;"></div>`,
        '      </div>',
        '    </div>',
        '    <aside class="atp-n8n-panel">',
        '      <div class="atp-n8n-panel-block">',
        '        <div class="atp-n8n-panel-title">Inicio da simulacao</div>',
        '        <select class="atp-n8n-start" data-atp-start></select>',
        '      </div>',
        '      <div class="atp-n8n-panel-block">',
        '        <div class="atp-n8n-panel-title">Status</div>',
        '        <div class="atp-n8n-status" data-atp-status>Pronto para simular. Clique em Play.</div>',
        '      </div>',
        '      <div class="atp-n8n-panel-block">',
        '        <div class="atp-n8n-panel-title">Proxima fase</div>',
        '        <div data-atp-options class="atp-n8n-empty">Clique em Play para iniciar.</div>',
        '      </div>',
        '      <div class="atp-n8n-panel-block">',
        '        <div class="atp-n8n-panel-title">Historico</div>',
        '        <ol class="atp-n8n-history" data-atp-history></ol>',
        '      </div>',
        '    </aside>',
        '  </div>',
        '</div>'
      ].join('');

      document.body.appendChild(overlay);

      const canvas = overlay.querySelector('[data-atp-canvas]');
      const scene = overlay.querySelector('[data-atp-scene]');
      const svg = overlay.querySelector('[data-atp-edges]');
      const nodesHost = overlay.querySelector('[data-atp-nodes]');
      const startSel = overlay.querySelector('[data-atp-start]');
      const statusEl = overlay.querySelector('[data-atp-status]');
      const optionsEl = overlay.querySelector('[data-atp-options]');
      const historyEl = overlay.querySelector('[data-atp-history]');
      const zoomLabel = overlay.querySelector('[data-atp-zoom]');

      const nodeEls = new Map();
      const edgeEls = new Map();
      const view = { x: 24, y: 24, scale: 1 };
      const sim = {
        running: false,
        current: null,
        visitedNodes: new Set(),
        visitedEdges: new Set(),
        history: []
      };

      const applyView = () => {
        scene.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
        if (zoomLabel) zoomLabel.textContent = `${Math.round(view.scale * 100)}%`;
      };

      const fitView = () => {
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const sx = (rect.width - 80) / model.layout.sceneW;
        const sy = (rect.height - 80) / model.layout.sceneH;
        const scale = Math.max(0.25, Math.min(2.8, Math.min(sx, sy)));
        view.scale = scale;
        view.x = Math.round((rect.width - (model.layout.sceneW * scale)) / 2);
        view.y = Math.round((rect.height - (model.layout.sceneH * scale)) / 2);
        applyView();
      };

      const focusNode = (nodeKey) => {
        if (!canvas || !model.layout.pos.has(nodeKey)) return;
        const rect = canvas.getBoundingClientRect();
        const p = model.layout.pos.get(nodeKey);
        const cx = p.x + (p.w / 2);
        const cy = p.y + (p.h / 2);
        view.x = Math.round((rect.width / 2) - (cx * view.scale));
        view.y = Math.round((rect.height / 2) - (cy * view.scale));
        applyView();
      };

      const updateGraphHighlight = () => {
        model.nodeIds.forEach((k) => {
          const el = nodeEls.get(k);
          if (!el) return;
          el.classList.toggle('start', model.starts.includes(k));
          el.classList.toggle('visited', sim.visitedNodes.has(k));
          el.classList.toggle('active', sim.current === k);
        });

        model.edges.forEach((e) => {
          const p = edgeEls.get(e.id);
          if (!p) return;
          p.classList.toggle('visited', sim.visitedEdges.has(e.id));
          p.classList.toggle('active', sim.running && sim.current === e.to && sim.visitedEdges.has(e.id));
          const nextNow = sim.running && sim.current && e.from === sim.current && !sim.visitedEdges.has(e.id);
          p.classList.toggle('next', !!nextNow);
        });
      };

      const nextOptions = (nodeKey) => {
        const list = Array.isArray(model.outgoing.get(nodeKey)) ? model.outgoing.get(nodeKey) : [];
        return list.map((edge) => ({
          edge,
          main: trunc(edge.shortLabel || 'Opcao', 170),
          sub: `Ir para ${edge.to}`
        }));
      };

      const renderHistory = () => {
        historyEl.innerHTML = '';
        if (!sim.history.length) {
          const li = document.createElement('li');
          li.className = 'atp-n8n-empty';
          li.textContent = 'Sem passos executados.';
          historyEl.appendChild(li);
          return;
        }
        sim.history.forEach((h) => {
          const li = document.createElement('li');
          li.textContent = `${h.from} -> ${h.to} (${h.label})`;
          historyEl.appendChild(li);
        });
      };

      const renderOptions = () => {
        optionsEl.innerHTML = '';

        if (!sim.running) {
          const p = document.createElement('div');
          p.className = 'atp-n8n-empty';
          p.textContent = 'Clique em Play para iniciar.';
          optionsEl.appendChild(p);
          statusEl.textContent = 'Pronto para simular. Clique em Play.';
          updateGraphHighlight();
          renderHistory();
          return;
        }

        const cur = sim.current;
        if (!cur) {
          statusEl.textContent = 'Nao foi possivel determinar o no atual.';
          const p = document.createElement('div');
          p.className = 'atp-n8n-empty';
          p.textContent = 'No atual nao definido.';
          optionsEl.appendChild(p);
          updateGraphHighlight();
          renderHistory();
          return;
        }

        statusEl.textContent = `Fase atual: ${cur}`;

        const optsList = nextOptions(cur);
        if (!optsList.length) {
          const p = document.createElement('div');
          p.className = 'atp-n8n-empty';
          p.textContent = 'Fluxo finalizado. Nao ha opcoes de continuidade nesta fase.';
          optionsEl.appendChild(p);
          updateGraphHighlight();
          renderHistory();
          return;
        }

        const q = document.createElement('div');
        q.className = 'atp-n8n-question';
        q.textContent = 'O que vem a seguir? Escolha uma opcao para continuar a simulacao.';
        optionsEl.appendChild(q);

        const box = document.createElement('div');
        box.className = 'atp-n8n-options';
        optionsEl.appendChild(box);

        optsList.forEach((opt) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'atp-n8n-option';
          btn.title = opt.edge.fullLabel || opt.main;
          btn.innerHTML = [
            `<div class="atp-n8n-option-main">${h(opt.main)}</div>`,
            `<div class="atp-n8n-option-sub">${h(opt.sub)}</div>`
          ].join('');
          btn.addEventListener('click', () => {
            sim.visitedEdges.add(opt.edge.id);
            sim.current = opt.edge.to;
            sim.visitedNodes.add(opt.edge.to);
            sim.history.push({
              from: opt.edge.from,
              to: opt.edge.to,
              label: trunc(opt.edge.shortLabel || 'Opcao', 90)
            });
            renderOptions();
            updateGraphHighlight();
            focusNode(opt.edge.to);
          });
          box.appendChild(btn);
        });

        updateGraphHighlight();
        renderHistory();
      };

      model.edges.forEach((e) => {
        const pa = model.layout.pos.get(e.from);
        const pb = model.layout.pos.get(e.to);
        if (!pa || !pb) return;
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', 'atp-n8n-edge');
        path.setAttribute('d', pathForEdge(pa, pb));
        path.setAttribute('data-id', e.id);
        path.setAttribute('title', e.fullLabel || e.shortLabel || `${e.from} -> ${e.to}`);
        svg.appendChild(path);
        edgeEls.set(e.id, path);
      });

      model.nodeIds.forEach((nodeKey) => {
        const p = model.layout.pos.get(nodeKey);
        if (!p) return;
        const outs = Array.isArray(model.outgoing.get(nodeKey)) ? model.outgoing.get(nodeKey).length : 0;
        const div = document.createElement('div');
        div.className = 'atp-n8n-node';
        div.style.left = `${p.x}px`;
        div.style.top = `${p.y}px`;
        div.style.width = `${p.w}px`;
        div.style.height = `${p.h}px`;
        div.innerHTML = [
          `<div class="atp-n8n-node-title">${h(trunc(nodeKey, 120))}</div>`,
          `<div class="atp-n8n-node-meta"><span>Saidas: ${h(outs)}</span><span>${model.starts.includes(nodeKey) ? 'Inicio' : ''}</span></div>`
        ].join('');
        div.addEventListener('click', () => {
          focusNode(nodeKey);
          if (!sim.running && model.starts.includes(nodeKey)) {
            startSel.value = nodeKey;
            statusEl.textContent = `Inicio selecionado: ${nodeKey}`;
          }
        });
        nodesHost.appendChild(div);
        nodeEls.set(nodeKey, div);
      });

      startSel.innerHTML = '';
      model.starts.forEach((st) => {
        const op = document.createElement('option');
        op.value = st;
        op.textContent = st;
        startSel.appendChild(op);
      });
      if (model.starts.length === 1) startSel.disabled = true;

      const startPlay = () => {
        const startNode = c(startSel.value || model.starts[0] || model.nodeIds[0] || '');
        if (!startNode) {
          alert('Nao foi possivel iniciar a simulacao.');
          return;
        }
        sim.running = true;
        sim.current = startNode;
        sim.visitedNodes = new Set([startNode]);
        sim.visitedEdges = new Set();
        sim.history = [];
        renderOptions();
        focusNode(startNode);
      };

      const resetPlay = () => {
        sim.running = false;
        sim.current = null;
        sim.visitedNodes = new Set();
        sim.visitedEdges = new Set();
        sim.history = [];
        renderOptions();
      };

      overlay.querySelector('[data-atp-play]').addEventListener('click', startPlay);
      overlay.querySelector('[data-atp-reset]').addEventListener('click', resetPlay);
      overlay.querySelector('[data-atp-close]').addEventListener('click', closeFlowN8nModal);
      overlay.querySelector('[data-atp-zoom-in]').addEventListener('click', () => {
        view.scale = Math.min(2.8, view.scale + 0.12);
        applyView();
      });
      overlay.querySelector('[data-atp-zoom-out]').addEventListener('click', () => {
        view.scale = Math.max(0.25, view.scale - 0.12);
        applyView();
      });
      overlay.querySelector('[data-atp-fit]').addEventListener('click', fitView);

      let isPanning = false;
      let panX = 0;
      let panY = 0;
      canvas.addEventListener('mousedown', (ev) => {
        if (ev.button !== 0) return;
        if (ev.target && ev.target.closest && ev.target.closest('.atp-n8n-node')) return;
        isPanning = true;
        panX = ev.clientX;
        panY = ev.clientY;
        ev.preventDefault();
      });
      canvas.addEventListener('mousemove', (ev) => {
        if (!isPanning) return;
        const dx = ev.clientX - panX;
        const dy = ev.clientY - panY;
        panX = ev.clientX;
        panY = ev.clientY;
        view.x += dx;
        view.y += dy;
        applyView();
      });
      canvas.addEventListener('mouseup', () => { isPanning = false; });
      canvas.addEventListener('mouseleave', () => { isPanning = false; });
      canvas.addEventListener('wheel', (ev) => {
        ev.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const px = ev.clientX - rect.left;
        const py = ev.clientY - rect.top;
        const prev = view.scale;
        const step = ev.deltaY < 0 ? 1.08 : 0.92;
        const next = Math.max(0.25, Math.min(2.8, prev * step));
        view.scale = next;
        view.x = px - (((px - view.x) / prev) * next);
        view.y = py - (((py - view.y) / prev) * next);
        applyView();
      }, { passive: false });

      const onEsc = (ev) => {
        if (ev.key === 'Escape') closeFlowN8nModal();
      };
      overlay._atpEscHandler = onEsc;
      document.addEventListener('keydown', onEsc, true);

      fitView();
      resetPlay();
      if (model.starts[0]) focusNode(model.starts[0]);
    } catch (e) {
      try { console.warn(MOD, 'Falha ao abrir modal N8N-like:', e); } catch (_) {}
      alert('Falha ao abrir visualizador de fluxo.');
    }
  }

  window.ATP = window.ATP || {};
  window.ATP.flowN8n = window.ATP.flowN8n || {};
  window.ATP.flowN8n.open = openFlowN8nModal;
  window.ATP.flowN8n.close = closeFlowN8nModal;
  window.atpOpenFlowN8nModal = openFlowN8nModal;
  window.atpCloseFlowN8nModal = closeFlowN8nModal;

  try { console.log('[ATP][OK] 13-visualizador-fluxo-n8n.js inicializado'); } catch (e) {}
})();
;
