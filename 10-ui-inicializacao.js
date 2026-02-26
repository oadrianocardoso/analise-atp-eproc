
  try {
    if (typeof window.debounce !== 'function') {
      window.debounce = function (fn, wait) {
        let t = null;
        return function () {
          const ctx = this;
          const args = arguments;
          if (t) clearTimeout(t);
          t = setTimeout(() => {
            t = null;
            try { fn.apply(ctx, args); } catch (e) { try { console.warn('[ATP][UI] debounce fn erro:', e); } catch (_) {} }
          }, Math.max(0, wait || 0));
        };
      };
    }
    if (typeof window.tDebounce !== 'function') {
      window.tDebounce = function (fn, wait) {
        return window.debounce(fn, wait);
      };
    }
  } catch (e) {}

try { console.log('[ATP][LOAD] 10-ui-inicializacao.js carregado com sucesso'); } catch (e) {}

window.ATP_TABLE_ID = window.ATP_TABLE_ID || 'tableAutomatizacaoLocalizadores';
function atpGetRulesState() {
  if (typeof window.atpGetLastRules === 'function') {
    const rules = window.atpGetLastRules();
    return Array.isArray(rules) ? rules : [];
  }
  return Array.isArray(window.__ATP_LAST_RULES__) ? window.__ATP_LAST_RULES__ : [];
}

function atpSetRulesState(rules) {
  if (typeof window.atpSetLastRules === 'function') window.atpSetLastRules(rules);
  else window.__ATP_LAST_RULES__ = Array.isArray(rules) ? rules : [];
}

function atpEscapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function atpGetDashboardConfig() {
  const fromMonitor = window.ATP_ACCESS_MONITOR_PUBLIC || {};
  return {
    supabaseUrl: String(fromMonitor.supabaseUrl || ''),
    supabaseApiKey: String(fromMonitor.supabaseApiKey || ''),
    tableName: String(fromMonitor.tableName || '')
  };
}

function atpFormatDateKeyLocal(dt) {
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function atpFriendlyActionName(acao) {
  const map = {
    carregamento: 'Carregamento',
    clique_filtrar_regras_conflitantes: 'Filtrar Regras Conflitantes',
    clique_gerar_relatorio_colisoes: 'Gerar Relatorio de Conflitos',
    clique_gerar_extrato_fluxos: 'Gerar Extrato de Fluxos',
    clique_exportar_fluxos_bizagi: 'Exportar Fluxos para Bizagi',
    clique_dashboard_utilizacao: 'Abrir Dashboard de Utilizacao',
    clique_comparar: 'Comparar Regras',
    clique_visualizar_fluxo: 'Visualizar Fluxo'
  };
  const key = String(acao || '').trim();
  return map[key] || (key || '(sem acao)');
}

function atpBuildBarRowsHtml(items, emptyMsg) {
  if (!Array.isArray(items) || !items.length) {
    return `<div class="atp-dash-foot">${atpEscapeHtml(emptyMsg || 'Sem dados')}</div>`;
  }
  const maxVal = items.reduce((m, it) => Math.max(m, Number(it.value) || 0), 0) || 1;
  return items.map((it) => {
    const raw = Number(it.value) || 0;
    const pct = Math.max(3, Math.round((raw / maxVal) * 100));
    return [
      '<div class="atp-dash-bar-row">',
      `<div class="atp-dash-bar-label" title="${atpEscapeHtml(it.label)}">${atpEscapeHtml(it.label)}</div>`,
      '<div class="atp-dash-bar-track">',
      `<div class="atp-dash-bar-fill" style="width:${pct}%"></div>`,
      '</div>',
      `<div class="atp-dash-bar-val">${raw}</div>`,
      '</div>'
    ].join('');
  }).join('');
}

function atpBuildLast7DaysChartHtml(items) {
  const points = Array.isArray(items) ? items : [];
  if (!points.length) {
    return '<div class="atp-dash-foot">Sem dados no periodo</div>';
  }

  const w = 760;
  const h = 260;
  const padL = 44;
  const padR = 14;
  const padT = 12;
  const padB = 44;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;
  const maxVal = Math.max(1, ...points.map((p) => Number(p.value) || 0));
  const yTicks = 4;
  const n = points.length;
  const slot = chartW / Math.max(1, n);
  const barW = Math.max(8, Math.min(36, Math.floor(slot * 0.55)));

  const yGrid = [];
  for (let i = 0; i <= yTicks; i += 1) {
    const v = Math.round((maxVal * i) / yTicks);
    const y = Math.round(padT + chartH - (chartH * i) / yTicks);
    yGrid.push(`<line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" stroke="#e5e7eb" stroke-width="1" />`);
    yGrid.push(`<text x="${padL - 6}" y="${y + 4}" text-anchor="end" font-size="11" fill="#6b7280">${v}</text>`);
  }

  const bars = [];
  points.forEach((p, idx) => {
    const raw = Number(p.value) || 0;
    const xCenter = Math.round(padL + slot * idx + slot / 2);
    const x = Math.round(xCenter - barW / 2);
    const hh = Math.round((raw / maxVal) * chartH);
    const y = Math.round(padT + chartH - hh);
    const label = String(p.label || '');
    const labelShort = /^\d{4}-\d{2}-\d{2}$/.test(label)
      ? `${label.slice(8, 10)}/${label.slice(5, 7)}`
      : label;
    bars.push(`<rect x="${x}" y="${y}" width="${barW}" height="${Math.max(1, hh)}" rx="4" fill="#2563eb"><title>${atpEscapeHtml(label)}: ${raw}</title></rect>`);
    bars.push(`<text x="${xCenter}" y="${h - padB + 16}" text-anchor="middle" font-size="11" fill="#374151">${atpEscapeHtml(labelShort)}</text>`);
  });

  return [
    '<div style="width:100%;overflow-x:auto;">',
    `<svg viewBox="0 0 ${w} ${h}" style="width:100%;min-width:680px;height:auto;background:#fff;border:1px solid #e5e7eb;border-radius:10px;">`,
    ...yGrid,
    `<line x1="${padL}" y1="${padT + chartH}" x2="${w - padR}" y2="${padT + chartH}" stroke="#9ca3af" stroke-width="1.2" />`,
    `<line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + chartH}" stroke="#9ca3af" stroke-width="1.2" />`,
    ...bars,
    `<text x="${Math.round((padL + (w - padR)) / 2)}" y="${h - 8}" text-anchor="middle" font-size="12" fill="#4b5563">Data</text>`,
    `<text x="14" y="${Math.round((padT + chartH) / 2)}" text-anchor="middle" font-size="12" fill="#4b5563" transform="rotate(-90 14 ${Math.round((padT + chartH) / 2)})">Utilização</text>`,
    '</svg>',
    '</div>'
  ].join('');
}

function atpRenderDashboard(target, rows) {
  const allRows = Array.isArray(rows) ? rows : [];
  const now = new Date();
  const todayKey = atpFormatDateKeyLocal(now);
  const byAction = Object.create(null);
  const byDay = Object.create(null);

  for (const row of allRows) {
    const acao = String(row && row.acao ? row.acao : '').trim() || '(sem acao)';
    byAction[acao] = (byAction[acao] || 0) + 1;
    const dayKey = atpFormatDateKeyLocal(row && row.executed_at ? row.executed_at : '');
    if (dayKey) byDay[dayKey] = (byDay[dayKey] || 0) + 1;
  }

  const actionItems = Object.keys(byAction)
    .sort((a, b) => byAction[b] - byAction[a])
    .map((key) => ({ label: atpFriendlyActionName(key), value: byAction[key] }));

  const last7Days = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = atpFormatDateKeyLocal(d);
    last7Days.push({ label: key, value: byDay[key] || 0 });
  }

  const total = allRows.length;
  const today = byDay[todayKey] || 0;
  const uniqueActions = Object.keys(byAction).length;
  const version = (typeof ATP_VERSION !== 'undefined') ? String(ATP_VERSION) : 'N/D';
  const cfg = atpGetDashboardConfig();

  target.innerHTML = [
    '<div class="atp-dash-grid">',
    `<div class="atp-dash-kpi"><div class="atp-dash-kpi-num">${total}</div><div class="atp-dash-kpi-lbl">Eventos Consultados</div></div>`,
    `<div class="atp-dash-kpi"><div class="atp-dash-kpi-num">${today}</div><div class="atp-dash-kpi-lbl">Eventos Hoje</div></div>`,
    `<div class="atp-dash-kpi"><div class="atp-dash-kpi-num">${uniqueActions}</div><div class="atp-dash-kpi-lbl">Tipos de Ação</div></div>`,
    '</div>',
    '<div class="atp-dash-sec-title">Versao</div>',
    `<div class="atp-dash-foot">Script: ${atpEscapeHtml(version)} | Tabela: ${atpEscapeHtml(cfg.tableName || 'N/D')}</div>`,
    '<div class="atp-dash-sec-title">Utilização por Acão</div>',
    `<div class="atp-dash-bars">${atpBuildBarRowsHtml(actionItems, 'Sem acoes registradas')}</div>`,
    '<div class="atp-dash-sec-title">Utilização nos Ultimos 7 Dias</div>',
    atpBuildLast7DaysChartHtml(last7Days),
    `<div class="atp-dash-foot">Atualizado em ${atpEscapeHtml(new Date().toLocaleString())}</div>`
  ].join('');
}

function atpFetchUsageRows(limit) {
  const cfg = atpGetDashboardConfig();
  if (!cfg.supabaseUrl || !cfg.supabaseApiKey || !cfg.tableName) {
    return Promise.reject(new Error('Monitor de acesso nao configurado.'));
  }
  const base = cfg.supabaseUrl.replace(/\/+$/, '');
  const url = `${base}/rest/v1/${cfg.tableName}?select=executed_at,acao&order=executed_at.desc&limit=${Math.max(1, limit || 1000)}`;
  return fetch(url, {
    method: 'GET',
    headers: {
      apikey: cfg.supabaseApiKey,
      Authorization: `Bearer ${cfg.supabaseApiKey}`
    }
  }).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  });
}

function atpCloseDashboardModal() {
  try { document.getElementById('atpDashboardModal')?.remove(); } catch (_) { }
}

function atpOpenDashboardModal() {
  atpCloseDashboardModal();
  const overlay = document.createElement('div');
  overlay.id = 'atpDashboardModal';
  overlay.className = 'atp-dash-overlay';
  overlay.addEventListener('click', (ev) => { if (ev.target === overlay) atpCloseDashboardModal(); });

  const box = document.createElement('div');
  box.className = 'atp-dash-box';

  const top = document.createElement('div');
  top.className = 'atp-dash-top';
  top.innerHTML = '<div class="atp-dash-title">Dashboard de Utilização do Script</div>';

  const btnClose = document.createElement('button');
  btnClose.type = 'button';
  btnClose.className = 'atp-map-btn';
  btnClose.textContent = 'Fechar';
  btnClose.addEventListener('click', atpCloseDashboardModal);
  top.appendChild(btnClose);

  const body = document.createElement('div');
  body.className = 'atp-dash-body';
  body.innerHTML = '<div class="atp-dash-foot">Carregando dados de utilizacao...</div>';

  box.appendChild(top);
  box.appendChild(body);
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  atpFetchUsageRows(1000).then((rows) => {
    atpRenderDashboard(body, rows);
  }).catch((err) => {
    body.innerHTML = `<div class="atp-dash-foot">Nao foi possivel carregar os dados: ${atpEscapeHtml(err && err.message ? err.message : 'erro desconhecido')}</div>`;
  });
}

function atpEnsureDashboardIcon(host, refEl) {
  try {
    if (!host || host.querySelector('#btnDashboardUsoATP')) return;
    const iconBtn = document.createElement('button');
    iconBtn.type = 'button';
    iconBtn.id = 'btnDashboardUsoATP';
    iconBtn.className = 'infraButton';
    iconBtn.title = 'Dashboard de Utilização do Script';
    iconBtn.textContent = '📊';
    iconBtn.addEventListener('click', atpOpenDashboardModal);

    if (refEl && refEl.parentNode === host) host.insertBefore(iconBtn, refEl.nextSibling);
    else host.appendChild(iconBtn);
  } catch (_) { }
}

let ATP_UI_ELK_PROMISE = null;
function atpEnsureElkLoadedForBpmn() {
  if (window.ELK) return Promise.resolve(window.ELK);
  if (ATP_UI_ELK_PROMISE) return ATP_UI_ELK_PROMISE;

  ATP_UI_ELK_PROMISE = new Promise((resolve, reject) => {
    try {
      const url = 'https://unpkg.com/elkjs@0.9.3/lib/elk.bundled.js';
      const found = document.querySelector('script[data-atp-lib="elk-093"]') || document.querySelector('script[data-atp-lib="elk-ui-093"]');
      if (found) {
        if (window.ELK) { resolve(window.ELK); return; }
        found.addEventListener('load', () => window.ELK ? resolve(window.ELK) : reject(new Error('ELK não carregou.')), { once: true });
        found.addEventListener('error', (e) => reject(e), { once: true });
        return;
      }
      const s = document.createElement('script');
      s.src = url;
      s.async = true;
      s.setAttribute('data-atp-lib', 'elk-ui-093');
      s.onload = () => {
        if (!window.ELK) { reject(new Error('ELK indisponível após load.')); return; }
        resolve(window.ELK);
      };
      s.onerror = (e) => reject(e);
      document.head.appendChild(s);
    } catch (e) {
      reject(e);
    }
  });

  return ATP_UI_ELK_PROMISE;
}

function atpBpmnGetEls(doc, tag, scope) {
  const NS_BPMN = 'http://www.omg.org/spec/BPMN/20100524/MODEL';
  const root = scope || doc;
  let out = [];
  try { out = Array.from(root.getElementsByTagNameNS(NS_BPMN, tag)); } catch (_) {}
  if (out.length) return out;
  try { out = Array.from(root.getElementsByTagName(tag)); } catch (_) {}
  if (out.length) return out;
  try { out = Array.from(root.querySelectorAll(tag + ', bpmn\\:' + tag)); } catch (_) {}
  return out;
}

function atpBpmnDimsByType(type) {
  const t = String(type || '').toLowerCase();
  if (t === 'startevent' || t === 'endevent') return { width: 36, height: 36 };
  if (t.includes('gateway')) return { width: 60, height: 60 };
  if (t === 'servicetask') return { width: 260, height: 92 };
  return { width: 220, height: 86 };
}

function atpBpmnNodeKind(type) {
  const t = String(type || '').toLowerCase();
  if (t === 'startevent') return 'start';
  if (t === 'endevent') return 'end';
  if (t.indexOf('gateway') >= 0) return 'decision';
  if (t === 'servicetask') return 'action';
  return 'locator';
}

function atpBpmnEdgeStepByKinds(fromKind, toKind) {
  // Modelo-alvo:
  // Início -> Entrada -> Decisão -> Ação -> Saída -> (Decisão/Ação/Fim)
  if (fromKind === 'start') return 1;
  if (fromKind === 'decision') {
    return 1;
  }
  if (fromKind === 'action') {
    return 1;
  }
  if (fromKind === 'locator') {
    return 1;
  }
  return 1;
}

function atpBpmnComputeFlowStageColumns(nodes, edges, inDegree) {
  const listNodes = Array.isArray(nodes) ? nodes : [];
  const listEdges = Array.isArray(edges) ? edges : [];
  const nodeById = new Map(listNodes.map(n => [String(n && n.id || ''), n]).filter(p => p[0]));
  const outById = new Map();
  const predById = new Map();
  const cols = new Map();
  const hardMaxCol = Math.max(10, (listNodes.length || 10) + 8);

  for (const n of listNodes) {
    const id = String(n && n.id || '');
    if (!id) continue;
    outById.set(id, []);
    predById.set(id, []);
  }
  for (const e of listEdges) {
    const sid = String(e && e.source || '');
    const tid = String(e && e.target || '');
    if (!sid || !tid) continue;
    if (!outById.has(sid)) outById.set(sid, []);
    if (!predById.has(tid)) predById.set(tid, []);
    outById.get(sid).push(tid);
    predById.get(tid).push(sid);
  }

  const seeds = [];
  for (const n of listNodes) {
    const id = String(n && n.id || '');
    if (!id) continue;
    const kind = atpBpmnNodeKind(n.type);
    if (kind === 'start') {
      cols.set(id, 0);
      seeds.push(id);
    }
  }
  for (const n of listNodes) {
    const id = String(n && n.id || '');
    if (!id || cols.has(id)) continue;
    const kind = atpBpmnNodeKind(n.type);
    if (kind === 'locator' && Number(inDegree.get(id) || 0) === 0) {
      cols.set(id, 1);
      seeds.push(id);
    }
  }

  // Árvore: define coluna no primeiro caminho encontrado (evita colapso em coluna final por ciclos).
  const q = seeds.slice();
  const seen = new Set(q);
  while (q.length) {
    const sid = String(q.shift() || '');
    if (!sid) continue;
    const sCol = Number(cols.get(sid));
    if (!Number.isFinite(sCol)) continue;
    const sNode = nodeById.get(sid);
    const sKind = atpBpmnNodeKind(sNode && sNode.type);
    const outs = (outById.get(sid) || []).slice().sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));
    for (const tid of outs) {
      const tNode = nodeById.get(tid);
      const tKind = atpBpmnNodeKind(tNode && tNode.type);
      const step = atpBpmnEdgeStepByKinds(sKind, tKind);
      const proposed = Math.min(hardMaxCol, sCol + step);
      if (!cols.has(tid)) cols.set(tid, proposed);
      if (!seen.has(tid)) {
        seen.add(tid);
        q.push(tid);
      }
    }
  }

  // Passo de consistência único para garantir avanço até o fim sem "explodir" ciclos.
  const ordered = Array.from(nodeById.keys()).sort((a, b) => {
    const ca = Number(cols.get(a) || 0);
    const cb = Number(cols.get(b) || 0);
    if (ca !== cb) return ca - cb;
    return String(a).localeCompare(String(b), 'pt-BR');
  });
  for (const sid of ordered) {
    const sCol = Number(cols.get(sid));
    if (!Number.isFinite(sCol)) continue;
    const sNode = nodeById.get(sid);
    const sKind = atpBpmnNodeKind(sNode && sNode.type);
    for (const tid of (outById.get(sid) || [])) {
      const tNode = nodeById.get(tid);
      const tKind = atpBpmnNodeKind(tNode && tNode.type);
      const step = atpBpmnEdgeStepByKinds(sKind, tKind);
      const proposed = Math.min(hardMaxCol, sCol + step);
      const cur = Number(cols.get(tid));
      if (!Number.isFinite(cur)) cols.set(tid, proposed);
      else if (proposed > cur && proposed <= cur + 3) cols.set(tid, proposed);
    }
  }

  // Garantia: FIM sempre à direita dos predecessores.
  for (const n of listNodes) {
    const id = String(n && n.id || '');
    if (!id) continue;
    if (atpBpmnNodeKind(n.type) !== 'end') continue;
    const preds = predById.get(id) || [];
    let maxPred = 0;
    for (const p of preds) {
      const cp = Number(cols.get(p));
      if (Number.isFinite(cp)) maxPred = Math.max(maxPred, cp);
    }
    const cur = Number(cols.get(id));
    const want = Math.min(hardMaxCol, maxPred + 1);
    if (!Number.isFinite(cur) || cur < want) cols.set(id, want);
  }

  // Fallback para nós não alcançados.
  for (const n of listNodes) {
    const id = String(n && n.id || '');
    if (!id || cols.has(id)) continue;
    const kind = atpBpmnNodeKind(n && n.type);
    if (kind === 'start') cols.set(id, 0);
    else if (kind === 'locator') cols.set(id, 1);
    else if (kind === 'decision') cols.set(id, 2);
    else if (kind === 'action') cols.set(id, 3);
    else cols.set(id, 5);
  }

  return cols;
}

async function atpApplyElkLayoutToBpmnXml(xml) {
  const ELKClass = await atpEnsureElkLoadedForBpmn();
  const elk = new ELKClass();

  const NS = {
    bpmn: 'http://www.omg.org/spec/BPMN/20100524/MODEL',
    bpmndi: 'http://www.omg.org/spec/BPMN/20100524/DI',
    dc: 'http://www.omg.org/spec/DD/20100524/DC',
    di: 'http://www.omg.org/spec/DD/20100524/DI'
  };

  const doc = new DOMParser().parseFromString(String(xml || ''), 'application/xml');
  if (!doc || doc.getElementsByTagName('parsererror').length) {
    throw new Error('XML BPMN inválido para layout ELK.');
  }

  const proc = atpBpmnGetEls(doc, 'process')[0] || null;
  if (!proc) throw new Error('Process BPMN não encontrado.');
  const processId = String(proc.getAttribute('id') || 'Process_1');

  const nodeTags = ['startEvent', 'endEvent', 'task', 'serviceTask', 'userTask', 'scriptTask', 'exclusiveGateway', 'parallelGateway'];
  const nodeMap = new Map();
  for (const tag of nodeTags) {
    const els = atpBpmnGetEls(doc, tag, proc);
    for (const el of els) {
      const id = String(el.getAttribute('id') || '');
      if (!id || nodeMap.has(id)) continue;
      nodeMap.set(id, { id, type: tag, name: String(el.getAttribute('name') || '') });
    }
  }

  const flows = atpBpmnGetEls(doc, 'sequenceFlow', proc);
  const edges = [];
  const outDegree = new Map();
  const inDegree = new Map();
  for (const sf of flows) {
    const id = String(sf.getAttribute('id') || ('Flow_' + Math.random().toString(36).slice(2)));
    const source = String(sf.getAttribute('sourceRef') || '');
    const target = String(sf.getAttribute('targetRef') || '');
    if (!source || !target) continue;
    if (!nodeMap.has(source)) nodeMap.set(source, { id: source, type: 'task', name: source });
    if (!nodeMap.has(target)) nodeMap.set(target, { id: target, type: 'task', name: target });
    edges.push({ id, source, target });
    outDegree.set(source, (outDegree.get(source) || 0) + 1);
    inDegree.set(target, (inDegree.get(target) || 0) + 1);
  }

  const nodes = Array.from(nodeMap.values());
  if (!nodes.length) throw new Error('Sem nós BPMN para layout.');
  // Colunas estruturais por fase do fluxo (garfo): início -> entrada -> decisão -> ação -> saída -> ...
  const colById = atpBpmnComputeFlowStageColumns(nodes, edges, inDegree);

  const graph = {
    id: 'atp-bpmn-root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.considerModelOrder': 'NODES_AND_EDGES',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.partitioning.activate': 'true',
      'elk.spacing.nodeNode': '44',
      'elk.layered.spacing.nodeNodeBetweenLayers': '240',
      'elk.layered.nodePlacement.favorStraightEdges': 'true'
    },
    children: nodes.map((n) => {
      const d = atpBpmnDimsByType(n.type);
      const col = Number(colById.get(String(n.id)) || 0);
      return {
        id: n.id,
        width: d.width,
        height: d.height,
        layoutOptions: {
          'elk.partitioning.partition': String(col)
        }
      };
    }),
    edges: edges.map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] }))
  };

  const laid = await elk.layout(graph);
  const posMap = new Map();
  for (const ch of (laid.children || [])) {
    const base = nodeMap.get(ch.id) || { id: ch.id, type: 'task' };
    const d = atpBpmnDimsByType(base.type);
    posMap.set(ch.id, {
      x: Number(ch.x) || 0,
      y: Number(ch.y) || 0,
      w: Number(ch.width) || d.width,
      h: Number(ch.height) || d.height
    });
  }

  const edgeWps = new Map();
  for (const e of (laid.edges || [])) {
    const sec = e && Array.isArray(e.sections) ? e.sections[0] : null;
    if (!sec || !sec.startPoint || !sec.endPoint) continue;
    const wps = [];
    wps.push({ x: Number(sec.startPoint.x) || 0, y: Number(sec.startPoint.y) || 0 });
    for (const bp of (sec.bendPoints || [])) {
      wps.push({ x: Number(bp.x) || 0, y: Number(bp.y) || 0 });
    }
    wps.push({ x: Number(sec.endPoint.x) || 0, y: Number(sec.endPoint.y) || 0 });
    edgeWps.set(String(e.id || ''), wps);
  }
  let diagram = null;
  try { diagram = doc.getElementsByTagNameNS(NS.bpmndi, 'BPMNDiagram')[0] || null; } catch (_) {}
  if (!diagram) {
    diagram = doc.createElementNS(NS.bpmndi, 'bpmndi:BPMNDiagram');
    diagram.setAttribute('id', 'BPMNDiagram_' + processId);
    doc.documentElement.appendChild(diagram);
  }

  let plane = null;
  try { plane = diagram.getElementsByTagNameNS(NS.bpmndi, 'BPMNPlane')[0] || null; } catch (_) {}
  if (!plane) {
    plane = doc.createElementNS(NS.bpmndi, 'bpmndi:BPMNPlane');
    plane.setAttribute('id', 'BPMNPlane_' + processId);
    plane.setAttribute('bpmnElement', processId);
    diagram.appendChild(plane);
  } else if (!plane.getAttribute('bpmnElement')) {
    plane.setAttribute('bpmnElement', processId);
  }

  for (const ch of Array.from(plane.childNodes || [])) {
    const ln = (ch && ch.localName) ? String(ch.localName) : '';
    if (ln === 'BPMNShape' || ln === 'BPMNEdge') {
      try { plane.removeChild(ch); } catch (_) {}
    }
  }

  for (const n of nodes) {
    const b = posMap.get(n.id);
    if (!b) continue;
    const sh = doc.createElementNS(NS.bpmndi, 'bpmndi:BPMNShape');
    sh.setAttribute('id', 'DI_' + n.id);
    sh.setAttribute('bpmnElement', n.id);
    const bo = doc.createElementNS(NS.dc, 'dc:Bounds');
    bo.setAttribute('x', String(Math.round(b.x)));
    bo.setAttribute('y', String(Math.round(b.y)));
    bo.setAttribute('width', String(Math.round(b.w)));
    bo.setAttribute('height', String(Math.round(b.h)));
    sh.appendChild(bo);
    plane.appendChild(sh);
  }

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rectCenter = (r) => ({ x: r.x + (r.w / 2), y: r.y + (r.h / 2) });
  const isGatewayType = (n) => String(n && n.type || '').toLowerCase().indexOf('gateway') >= 0;
  const sideFromPoint = (rect, pt) => {
    const c = rectCenter(rect);
    const dx = (Number(pt && pt.x) || 0) - c.x;
    const dy = (Number(pt && pt.y) || 0) - c.y;
    if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
    return dy >= 0 ? 'bottom' : 'top';
  };
  const sideForGatewayFan = (srcRect, tgtRect, srcOutCount) => {
    const sc = rectCenter(srcRect);
    const tc = rectCenter(tgtRect);
    const dx = tc.x - sc.x;
    const dy = tc.y - sc.y;
    const hasFan = (Number(srcOutCount) || 0) > 1;
    if (hasFan && Math.abs(dy) > Math.max(10, srcRect.h * 0.22)) {
      return dy >= 0 ? 'bottom' : 'top';
    }
    if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
    return dy >= 0 ? 'bottom' : 'top';
  };
  const dockGateway = (rect, side, ref) => {
    const l = rect.x;
    const r = rect.x + rect.w;
    const t = rect.y;
    const b = rect.y + rect.h;
    const cx = rect.x + (rect.w / 2);
    const cy = rect.y + (rect.h / 2);
    const hw = Math.max(1, rect.w / 2);
    const hh = Math.max(1, rect.h / 2);
    const rx = Number(ref && ref.x) || cx;
    const ry = Number(ref && ref.y) || cy;

    if (side === 'left' || side === 'right') {
      const y = clamp(ry, t, b);
      const k = Math.max(0, 1 - (Math.abs(y - cy) / hh));
      const x = cx + ((side === 'right' ? 1 : -1) * hw * k);
      return { x, y };
    }

    const x = clamp(rx, l, r);
    const k = Math.max(0, 1 - (Math.abs(x - cx) / hw));
    const y = cy + ((side === 'bottom' ? 1 : -1) * hh * k);
    return { x, y };
  };
  const dockBySide = (rect, side, ref) => {
    const l = rect.x;
    const r = rect.x + rect.w;
    const t = rect.y;
    const b = rect.y + rect.h;
    const rx = Number(ref && ref.x) || (l + r) / 2;
    const ry = Number(ref && ref.y) || (t + b) / 2;
    if (side === 'left') return { x: l, y: clamp(ry, t, b) };
    if (side === 'right') return { x: r, y: clamp(ry, t, b) };
    if (side === 'top') return { x: clamp(rx, l, r), y: t };
    return { x: clamp(rx, l, r), y: b };
  };
  const dockForNode = (rect, meta, side, ref) => {
    if (isGatewayType(meta)) return dockGateway(rect, side, ref);
    return dockBySide(rect, side, ref);
  };
  const compactPts = (pts) => {
    const out = [];
    for (const p0 of (pts || [])) {
      const p = { x: Number(p0 && p0.x) || 0, y: Number(p0 && p0.y) || 0 };
      const prev = out.length ? out[out.length - 1] : null;
      if (prev && Math.abs(prev.x - p.x) < 0.001 && Math.abs(prev.y - p.y) < 0.001) continue;
      out.push(p);
    }
    return out;
  };
  const orthogonalizePts = (pts) => {
    const src = compactPts(pts || []);
    if (src.length < 2) return src;
    const out = [src[0]];
    for (let i = 1; i < src.length; i++) {
      const a = out[out.length - 1];
      const b = src[i];
      const ax = Number(a && a.x) || 0;
      const ay = Number(a && a.y) || 0;
      const bx = Number(b && b.x) || 0;
      const by = Number(b && b.y) || 0;
      if (Math.abs(ax - bx) < 0.001 || Math.abs(ay - by) < 0.001) {
        out.push({ x: bx, y: by });
        continue;
      }
      // Proíbe diagonais: quebra em dois segmentos ortogonais (H depois V).
      out.push({ x: bx, y: ay });
      out.push({ x: bx, y: by });
    }
    return compactPts(out);
  };
  const buildFallbackOrtho = (srcRect, tgtRect, srcMeta, tgtMeta, srcOutCount, tgtInCount) => {
    const sc = rectCenter(srcRect);
    const tc = rectCenter(tgtRect);
    const srcSide = isGatewayType(srcMeta)
      ? sideForGatewayFan(srcRect, tgtRect, srcOutCount)
      : sideFromPoint(srcRect, tc);
    const tgtSide = isGatewayType(tgtMeta) && (Number(tgtInCount) || 0) > 1
      ? sideForGatewayFan(tgtRect, srcRect, tgtInCount)
      : sideFromPoint(tgtRect, sc);
    const p1 = dockForNode(srcRect, srcMeta, srcSide, tc);
    const p2 = dockForNode(tgtRect, tgtMeta, tgtSide, sc);

    // Fallback simples.
    if (Math.abs(p1.x - p2.x) < 0.001 || Math.abs(p1.y - p2.y) < 0.001) return [p1, p2];
    const dx = Math.abs(tc.x - sc.x);
    const dy = Math.abs(tc.y - sc.y);
    if (dx >= dy) {
      const mx = (p1.x + p2.x) / 2;
      return orthogonalizePts([p1, { x: mx, y: p1.y }, { x: mx, y: p2.y }, p2]);
    }
    const my = (p1.y + p2.y) / 2;
    return orthogonalizePts([p1, { x: p1.x, y: my }, { x: p2.x, y: my }, p2]);
  };
  const snapElkEdgeToBounds = (wps, srcRect, tgtRect, srcMeta, tgtMeta, srcOutCount, tgtInCount) => {
    const pts = Array.isArray(wps) ? wps.map((p) => ({ x: Number(p.x) || 0, y: Number(p.y) || 0 })) : [];
    if (pts.length < 2 || !srcRect || !tgtRect) return pts;
    const p1 = pts[1] || rectCenter(tgtRect);
    const pPrev = pts[pts.length - 2] || rectCenter(srcRect);
    const srcSide = isGatewayType(srcMeta)
      ? sideForGatewayFan(srcRect, tgtRect, srcOutCount)
      : sideFromPoint(srcRect, p1);
    const tgtSide = isGatewayType(tgtMeta) && (Number(tgtInCount) || 0) > 1
      ? sideForGatewayFan(tgtRect, srcRect, tgtInCount)
      : sideFromPoint(tgtRect, pPrev);
    pts[0] = dockForNode(srcRect, srcMeta, srcSide, p1);
    pts[pts.length - 1] = dockForNode(tgtRect, tgtMeta, tgtSide, pPrev);
    return pts;
  };

  for (const e of edges) {
    const ed = doc.createElementNS(NS.bpmndi, 'bpmndi:BPMNEdge');
    ed.setAttribute('id', 'DI_' + e.id);
    ed.setAttribute('bpmnElement', e.id);

    let wps = edgeWps.get(e.id) || null;
    const srcMeta = nodeMap.get(e.source) || null;
    const tgtMeta = nodeMap.get(e.target) || null;
    const srcOutCount = Number(outDegree.get(e.source) || 0);
    const tgtInCount = Number(inDegree.get(e.target) || 0);
    if (!wps || wps.length < 2) {
      const s = posMap.get(e.source);
      const t = posMap.get(e.target);
      if (s && t) {
        wps = buildFallbackOrtho(s, t, srcMeta, tgtMeta, srcOutCount, tgtInCount);
      } else {
        wps = [];
      }
    } else {
      const s = posMap.get(e.source);
      const t = posMap.get(e.target);
      wps = snapElkEdgeToBounds(wps, s, t, srcMeta, tgtMeta, srcOutCount, tgtInCount);
    }

    const wpsOrtho = orthogonalizePts(wps || []);
    for (const p of wpsOrtho) {
      const wp = doc.createElementNS(NS.di, 'di:waypoint');
      wp.setAttribute('x', String(Math.round(Number(p.x) || 0)));
      wp.setAttribute('y', String(Math.round(Number(p.y) || 0)));
      ed.appendChild(wp);
    }
    plane.appendChild(ed);
  }

  return new XMLSerializer().serializeToString(doc);
}

function recalc(table) {
    if (!document.body.contains(table)) return;

    if (!atpWaitTablePopulationOrRetry(table)) {
      schedule(() => recalc(table), 200);
      return;
    }

    if (table.classList && table.classList.contains('dataTable') && table.querySelector('.dataTables_processing')) {
      schedule(() => recalc(table), 250);
      return;
    }

    if (!(table.classList && table.classList.contains('dataTable')) && !table.closest('.dataTables_wrapper')) {
      ensureColumns(table);
    }
    const cols = mapColumns(table);
    updateAllRemoverLupasByTooltipText(table);
    replacePlainRemoverTextInTable(table, cols);
    const rules = parseRules(table, cols);
    atpSetRulesState(rules);

    if (typeof logAllRules === "function") logAllRules(rules);
    if (!rules.length) { try { markATPRenderTick(); } catch (e) {} return; }
    const conflicts = analyze(rules);
    render(table, rules, conflicts);
    try { markATPRenderTick(); } catch (e) {}

  }

  function findTable() {
    const direct = document.getElementById(window.ATP_TABLE_ID || 'tableAutomatizacaoLocalizadores');
    if (direct) return direct;
    const candidates = Array.from(document.querySelectorAll('table'));
    const wanted = [
      /n[ºo]\s*\/?\s*prioridade/i,
      /localizador.*remover/i,
      /tipo.*(controle|crit[ée]rio)/i,
      /localizador.*(incluir|a[cç][aã]o)/i,
      /outros\s*crit[ée]rios/i
    ];
    let best = null;
    let bestScore = 0;
    for (const c of candidates) {
      const ths = Array.from((c.tHead || c).querySelectorAll('th'));
      if (!ths.length) continue;
      const text = ths.map(th => clean(th.textContent)).join(' | ');
      const score = wanted.reduce((acc, re) => acc + (re.test(text) ? 1 : 0), 0);
      if (score > bestScore) { best = c; bestScore = score; }
    }
    return (bestScore >= 3) ? best : null;
  }

function waitTable(timeoutMs = 120000) {
    const direct = findTable();
    if (direct) return Promise.resolve(direct);
    return new Promise(resolve => {
      const mo = new MutationObserver(() => {
        const tb = findTable();
        if (tb) { mo.disconnect(); resolve(tb); }
      });
      mo.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { mo.disconnect(); resolve(null); }, timeoutMs);
    });
  }

function atpEnsureReportButton(host, afterLabelEl, tableRef) {
  try {
    if (!host) return;
    if (host.querySelector('#btnGerarRelatorioColisoes')) {
      atpEnsureDashboardIcon(host, host.querySelector('#btnExtratoFluxosBPMNGrid_ATP'));
      return;
    }

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'infraButton';
    btn.id = 'btnGerarRelatorioColisoes';
    btn.textContent = '📋 Gerar Relatório de Conflitos';
    btn.style.marginLeft = '8px';

    btn.addEventListener('mouseenter', () => { btn.style.background = '#e5e7eb'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = '#f3f4f6'; });

    btn.addEventListener('click', function () {
      try {
        var table = tableRef || findTable();
        if (!table) return;

        try { ensureColumns(table); } catch (e) { }
        var cols = null;
        try { cols = mapColumns(table); } catch (e) { cols = null; }

        var cells = Array.from(table.querySelectorAll('td[data-atp-col="conflita"]'));

        var records = [];
        var countsByTipo = Object.create(null);
        var seenPairs = new Set();

        cells.forEach(function (td) {
          if (!td) return;
          var tr = td.closest('tr');
          if (!tr) return;

          var numA = '';
          try {
            if (cols && typeof cols.idxNum === 'number' && cols.idxNum >= 0) {
              var tds = tr.querySelectorAll('td');
              var tdNum = tds[cols.idxNum];
              numA = tdNum ? clean(tdNum.textContent || '') : '';
            }

            if (!numA) {
              var raw = clean(tr.textContent || '');
              var mm = raw.match(/\b(\d{1,6})\b/);
              if (mm) numA = mm[1];
            }
          } catch (e) { }

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

            var sugestoes = [];
            try {
              var reSug = /Sugest[aã]o:\s*([^|]+)(?:\||$)/gi;
              var m;
              while ((m = reSug.exec(pqRaw)) !== null) {
                var s = clean(m[1] || '');
                if (s) sugestoes.push(s);
              }
            } catch (e) { }

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

            var def = '';
            try { def = getTipoTooltip(tipo) || ''; } catch (e) { }
            def = String(def || '').replace(/<br\s*\/?>/gi, '\n').trim();

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

        records.sort(function (x, y) {
          var ax = Number(x.a), ay = Number(y.a);
          if (Number.isFinite(ax) && Number.isFinite(ay) && ax !== ay) return ax - ay;
          if (String(x.a) !== String(y.a)) return String(x.a).localeCompare(String(y.a));
          var bx = Number(x.b), by = Number(y.b);
          if (Number.isFinite(bx) && Number.isFinite(by) && bx !== by) return bx - by;
          if (String(x.b) !== String(y.b)) return String(x.b).localeCompare(String(y.b));
          return String(x.tipo).localeCompare(String(y.tipo));
        });

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
            lines.push('Regra (' + r.a + ') x (Própria Regra)');
          } else {
            lines.push('Regra (' + r.a + ') x Regra (' + r.b + ')');
          }
          lines.push('Tipo: ' + r.tipo);

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
        lines.push('');
        lines.push('----------------------------------------------------------------');
        lines.push('');
        lines.push('Mini-help:');
        lines.push(String(ATP_MINI_HELP_TIP || ''));

        var content = lines.join('\n');
        var blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'relatorio_colisoes_ATP.txt';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () {
          try { URL.revokeObjectURL(url); } catch (e) { }
          try { a.remove(); } catch (e) { }
        }, 0);
      } catch (e) {
        console.warn(LOG_PREFIX, 'Falha ao gerar relatório:', e);
      }
    });

    const btnFluxos = document.createElement('button');
    btnFluxos.type = 'button';
    btnFluxos.className = 'infraButton';
    btnFluxos.id = 'btnExtratoFluxosATP';
    btnFluxos.textContent = '🧾 Gerar Extrato de Fluxos';
    btnFluxos.style.marginLeft = '8px';

    btnFluxos.addEventListener('mouseenter', () => { btnFluxos.style.background = '#e5e7eb'; });
    btnFluxos.addEventListener('mouseleave', () => { btnFluxos.style.background = '#f3f4f6'; });

    btnFluxos.addEventListener('click', function () {
      try {
        var table = tableRef || findTable();
        if (!table) return;

        try { ensureColumns(table); } catch (e) { }
        var cols = null;
        try { cols = mapColumns(table); } catch (e) { cols = null; }
        if (!cols) cols = {};

        const rules = parseRules(table, cols);
        atpSetRulesState(rules);
        const txt = atpBuildFluxosText(rules);

        var blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'extrato_fluxos_ATP.txt';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(url); try { a.remove(); } catch (e) { } }, 0);
      } catch (e) {
        console.warn(LOG_PREFIX, 'Falha ao gerar Extrato de Fluxos', e);
      }
    });

    const btnBPMNGrid = document.createElement('button');
    btnBPMNGrid.type = 'button';
    btnBPMNGrid.className = 'infraButton';
    btnBPMNGrid.id = 'btnExtratoFluxosBPMNGrid_ATP';
    btnBPMNGrid.textContent = '🗂️ Exportar Fluxos Para Bizagi';
    btnBPMNGrid.style.marginLeft = '8px';

    btnBPMNGrid.addEventListener('mouseenter', () => { btnBPMNGrid.style.background = '#e5e7eb'; });
    btnBPMNGrid.addEventListener('mouseleave', () => { btnBPMNGrid.style.background = '#f3f4f6'; });

    btnBPMNGrid.addEventListener('click', function () {
      try {
        var table = tableRef || findTable();
        if (!table) return;

        try { ensureColumns(table); } catch (e) { }
        var cols = null;
        try { cols = mapColumns(table); } catch (e) { cols = null; }
        if (!cols) cols = {};

        const rules = parseRules(table, cols);
        atpSetRulesState(rules);

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
              setTimeout(function () { URL.revokeObjectURL(url); try { a.remove(); } catch (e) { } }, 0);
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

    const btnDashboard = document.createElement('button');
    btnDashboard.type = 'button';
    btnDashboard.id = 'btnDashboardUsoATP';
    btnDashboard.className = 'infraButton';
    btnDashboard.title = 'Dashboard de Utilização do Script';
    btnDashboard.textContent = '📊';
    btnDashboard.addEventListener('click', atpOpenDashboardModal);

    if (afterLabelEl && afterLabelEl.parentNode === host) {
      const anchor = afterLabelEl.nextSibling;
      host.insertBefore(btnFluxos, anchor);
      host.insertBefore(btnBPMNGrid, anchor);
      host.insertBefore(btnDashboard, anchor);
      host.insertBefore(btn, btnFluxos);
    } else {
      host.appendChild(btn);
      host.appendChild(btnFluxos);
      host.appendChild(btnBPMNGrid);
      host.appendChild(btnDashboard);
    }
  } catch (e) { }
}

function addOnlyConflictsCheckbox(table, onToggle) {
  const host = document.getElementById('dvFiltrosOpcionais');
  if (!host) return;

  host.querySelector('#chkApenasConflitoSlim')?.remove();
  host.querySelector('label[for="chkApenasConflitoSlim"]')?.remove();

  const existingBtn = host.querySelector('#btnFiltrarConflitosSlim');
  if (existingBtn) {
    atpEnsureReportButton(host, existingBtn, table);
    return;
  }

  host.appendChild(document.createTextNode(' '));

  const btnFilter = document.createElement('button');
  btnFilter.type = 'button';
  btnFilter.id = 'btnFiltrarConflitosSlim';
  btnFilter.className = 'infraButton';
  btnFilter.textContent = '🔎 Filtrar Regras Conflitantes';
  btnFilter.setAttribute('aria-pressed', 'false');

  btnFilter.addEventListener('mouseenter', () => {
    try {
      const msg = String(ATP_MINI_HELP_TIP || '').replace(/\r?\n/g, '<br>');
      if (typeof window.infraTooltipMostrar === 'function') {
        window.infraTooltipMostrar(msg, 'Ajuda Rápida (ATP)', 720);
      } else {
        btnFilter.setAttribute('title', String(ATP_MINI_HELP_TIP || ''));
      }
    } catch { }
  });
  btnFilter.addEventListener('mouseleave', () => {
    try { if (typeof window.infraTooltipOcultar === 'function') window.infraTooltipOcultar(); } catch { }
  });

  btnFilter.addEventListener('click', () => {
    onlyConflicts = !onlyConflicts;
    btnFilter.setAttribute('aria-pressed', onlyConflicts ? 'true' : 'false');
    btnFilter.style.background = onlyConflicts ? '#dbeafe' : '';
    onToggle();
  });

  host.appendChild(btnFilter);

  atpEnsureReportButton(host, btnFilter, table);
}

function removeSortOrderControls() {
  try {
    const ids = [
      'chkOrdenacaoRegra',
      'chkOrdenacaoRegra2',
      'lblOrdenacaoRegra',
      'lblOrdenacaoRegra2'
    ];
    ids.forEach((id) => {
      try { document.getElementById(id)?.remove(); } catch (_) { }
    });

    const txtLabels = Array.from(document.querySelectorAll('label.mr-3'));
    txtLabels.forEach((el) => {
      const txt = String(el.textContent || '').trim().toLowerCase();
      if (txt.includes('ordenar regras por')) {
        try { el.remove(); } catch (_) { }
      }
    });
  } catch (_) { }
}

function forceTableLengthTo1000() {
  try {
    const sel = document.querySelector('select[name="tableAutomatizacaoLocalizadores_length"]');
    if (!sel) return;
    if (String(sel.value) === '1000') return;
    const has1000 = Array.from(sel.options || []).some(o => String(o.value) === '1000');
    if (!has1000) return;
    sel.value = '1000';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  } catch (_) { }
}

function disableAlterarPreferenciaNumRegistros() {
  try {
    window.alterarPreferenciaNumRegistros = function () { return false; };
  } catch (_) { }
}

  async function init() {
    injectStyle();
    const table = await waitTable();
    if (!table) return;
    disableAlterarPreferenciaNumRegistros();
    removeSortOrderControls();
    forceTableLengthTo1000();
    ensureColumns(table);
    updateAllRemoverLupasByTooltipText(table);
    addOnlyConflictsCheckbox(table, () => schedule(() => applyFilter(table), 0));
    try { atpEnsureFluxosPickerUI(table); } catch (e) {}
    recalc(table);
    table.addEventListener('change', () => schedule(() => recalc(table), 200), true);
    const root = table.parentElement || document.body;
    const mo = new MutationObserver(() => {
      if (ATP_SUPPRESS_OBSERVER) return;
      disableAlterarPreferenciaNumRegistros();
      removeSortOrderControls();
      forceTableLengthTo1000();
      schedule(() => recalc(table), 250);
    });
    mo.observe(root, { childList: true, subtree: true });
  }

  function atpEnsureFluxosPickerUI(table) {
    try {
      const host = document.getElementById('dvFiltrosOpcionais');
      if (!host || !host.parentNode) return;

      let wrap = document.getElementById('fluxos');
      if (!wrap) {
        wrap = document.createElement('div');
        wrap.id = 'fluxos';
        wrap.style.marginTop = '8px';
        wrap.style.display = 'flex';
        wrap.style.alignItems = 'center';
        wrap.style.gap = '8px';
        wrap.style.flexWrap = 'wrap';

        const title = document.createElement('span');
        title.textContent = 'Fluxos:';
        title.style.fontWeight = '600';
        title.style.marginRight = '4px';

        const sel = document.createElement('select');
        sel.id = 'atpSelFluxo';
        sel.className = 'infraSelect';
        sel.style.minWidth = '520px';
        sel.style.maxWidth = 'min(900px, 90vw)';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'infraButton';
        btn.id = 'btnVisualizarFluxoATP';
        btn.textContent = 'Visualizar Fluxo';

        sel.addEventListener('mousedown', () => {
          try { atpRefreshFluxosPickerOptions(table); } catch (e) {}
        }, true);

        btn.addEventListener('click', () => {
          try {
            atpRefreshFluxosPickerOptions(table);
            const idx = parseInt(String(sel.value || '-1'), 10);
            if (!Number.isFinite(idx) || idx < 0) {
              alert('Selecione um fluxo.');
              return;
            }
            const rules = atpGetRulesState();
            if (!rules.length) {
              alert('Não foi possível obter as regras (tabela vazia ou não carregada).');
              return;
            }
            const files = (window.ATP && window.ATP.extract && typeof window.ATP.extract.getBpmnFilesForRules === 'function')
              ? window.ATP.extract.getBpmnFilesForRules(rules)
              : atpGetBpmnSplitFilesForRules(rules);
            const f = files && files[idx];
            if (!f || !f.xml) {
              alert('Fluxo selecionado não possui BPMN gerado.');
              return;
            }

            atpApplyElkLayoutToBpmnXml(String(f.xml || ''))
              .then((xmlElk) => {
                const fileObj = {
                  ...f,
                  xml: String(xmlElk || f.xml || ''),
                  filename: String(f.filename || ('fluxo_' + String(idx + 1).padStart(2, '0') + '.bpmn'))
                };
                atpOpenFlowBpmnModal(fileObj, idx);
              })
              .catch((err) => {
                try { console.warn(LOG_PREFIX, '[Fluxos/UI] ELK no BPMN falhou; abrindo BPMN original:', err); } catch (_) {}
                atpOpenFlowBpmnModal(f, idx);
              });
          } catch (e) {
            try { console.warn(LOG_PREFIX, '[Fluxos/UI] Falha ao visualizar fluxo (BPMN + ELK):', e); } catch (_) {}
          }
        });

        wrap.appendChild(title);
        wrap.appendChild(sel);
        wrap.appendChild(btn);

        host.insertAdjacentElement('afterend', wrap);
      }

      atpRefreshFluxosPickerOptions(table);

    } catch (e) {}
  }

  function atpRefreshFluxosPickerOptions(table) {
    try {
      const sel = document.getElementById('atpSelFluxo');
      if (!sel) return;

      let rules = atpGetRulesState();
      if (!rules.length) {

        try { if (table) { try { ensureColumns(table); } catch(e) {} } } catch(e) {}
        let cols = null
        try { cols = mapColumns(table); } catch(e) { cols = null }
        if (!cols) cols = {};
        try { rules = parseRules(table, cols); } catch(e) { rules = [] }
        atpSetRulesState(rules);
      }
      if (!rules || !rules.length) {
        sel.innerHTML = '';
        const opt = document.createElement('option');
        opt.value = '-1';
        opt.textContent = '(nenhum fluxo detectado)';
        sel.appendChild(opt);
        return;
      }

      const data = (window.ATP && window.ATP.extract && typeof window.ATP.extract.getFluxosData === 'function')
        ? window.ATP.extract.getFluxosData(rules)
        : atpComputeFluxosData(rules);
      const fluxos = (data && data.fluxos) ? data.fluxos : [];

      const prev = sel.value;
      sel.innerHTML = '';

      if (!fluxos.length) {
        const opt = document.createElement('option');
        opt.value = '-1';
        opt.textContent = '(nenhum fluxo detectado)';
        sel.appendChild(opt);
        return;
      }

      fluxos.forEach((fl, idx) => {
        const opt = document.createElement('option');
        opt.value = String(idx);
        opt.textContent = (window.ATP && window.ATP.extract && typeof window.ATP.extract.buildFluxoOptionLabel === 'function')
          ? window.ATP.extract.buildFluxoOptionLabel(fl, idx)
          : (() => {
              const starts = (fl && fl.starts && fl.starts.length) ? fl.starts.join(' | ') : '(sem início)';
              const nodesN = (fl && fl.nodes && fl.nodes.length) ? fl.nodes.length : 0;
              return `Fluxo ${String(idx+1).padStart(2,'0')} — Início(s): [${starts}] — Nós: ${nodesN}`;
            })();
        sel.appendChild(opt);
      });

      if (prev && Array.from(sel.options).some(o => o.value === prev)) sel.value = prev;
      else sel.value = '0';

    } catch (e) {}
  }

  function atpOpenFlowBpmnModal(fileObj, flowIdx) {
    try {

      atpCloseRuleMapModal();

      const overlay = document.createElement('div');
      overlay.id = 'atpRuleMapModal';
      overlay.className = 'atp-map-overlay';
      overlay.addEventListener('click', (ev) => { if (ev.target === overlay) atpCloseRuleMapModal(); });

      const box = document.createElement('div');
      box.className = 'atp-map-box';

      const top = document.createElement('div');
      top.className = 'atp-map-top';

      const titleTxt = `🧭 Visualizar Fluxo ${String((flowIdx|0)+1).padStart(2,'0')} (BPMN)`;
      top.innerHTML = `<div><div class="atp-map-title">${titleTxt}</div><div class="atp-map-sub">Arquivo: ${String(fileObj && fileObj.filename || '')}</div></div>`;

      const actions = document.createElement('div');
      actions.className = 'atp-map-actions';

      let zoomValue = 1;
      const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

      const btnZoomOut = document.createElement('button');
      btnZoomOut.type = 'button';
      btnZoomOut.className = 'atp-map-btn';
      btnZoomOut.title = 'Zoom out';
      btnZoomOut.textContent = '-';

      const zoomLabel = document.createElement('span');
      zoomLabel.className = 'atp-map-zoom';
      zoomLabel.textContent = '100%';

      const btnZoomIn = document.createElement('button');
      btnZoomIn.type = 'button';
      btnZoomIn.className = 'atp-map-btn';
      btnZoomIn.title = 'Zoom in';
      btnZoomIn.textContent = '+';

      const btnFit = document.createElement('button');
      btnFit.type = 'button';
      btnFit.className = 'atp-map-btn';
      btnFit.title = 'Ajustar ao viewport';
      btnFit.textContent = 'Fit';

      const btnDownload = document.createElement('button');
      btnDownload.type = 'button';
      btnDownload.className = 'atp-map-btn';
      btnDownload.textContent = 'Baixar BPMN desse fluxo';
      btnDownload.addEventListener('click', () => {
        try {
          const viewer = overlay._atpBpmnViewer;
          if (!viewer || typeof viewer.saveXML !== 'function') {
            const blob = new Blob([String(fileObj.xml || '')], { type: 'application/xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = String(fileObj.filename || ('fluxo_' + String(flowIdx+1).padStart(2,'0') + '.bpmn'));
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { try{URL.revokeObjectURL(url);}catch(e){} try{a.remove();}catch(e){} }, 0);
            return;
          }

          try { if (overlay._atpRestoreNames) overlay._atpRestoreNames(); } catch (e) {}

          viewer.saveXML({ format: true }).then(({ xml }) => {
            const blob = new Blob([String(xml || '')], { type: 'application/xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = String(fileObj.filename || ('fluxo_' + String(flowIdx+1).padStart(2,'0') + '.bpmn'));
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { try{URL.revokeObjectURL(url);}catch(e){} try{a.remove();}catch(e){} }, 0);
          }).finally(() => {
            try { if (overlay._atpApplyTruncation) overlay._atpApplyTruncation(); } catch (e) {}
          });
        } catch (e) {}
      });

      const btnJpeg = document.createElement('button');
      btnJpeg.type = 'button';
      btnJpeg.className = 'atp-map-btn';
      btnJpeg.title = 'Exportar o diagrama para JPEG (imagem)';
      btnJpeg.textContent = 'Exportar JPEG';
      btnJpeg.addEventListener('click', () => {
        try {
          const viewer = overlay._atpBpmnViewer;
          if (!viewer || typeof viewer.saveSVG !== 'function') {
            alert('Exportacao JPEG indisponivel: bpmn-js nao esta pronto.');
            return;
          }

          viewer.saveSVG({ format: true }).then(({ svg }) => {
            const raw = String(svg || '');
            if (!raw) throw new Error('SVG vazio');

            let normalized = raw;
            try {
              const parser = new DOMParser();
              const doc = parser.parseFromString(raw, 'image/svg+xml');
              const svgEl = doc.documentElement;
              if (svgEl && String(svgEl.tagName).toLowerCase() === 'svg') {
                const hasW = svgEl.getAttribute('width');
                const hasH = svgEl.getAttribute('height');
                const vb = svgEl.getAttribute('viewBox');
                if ((!hasW || !hasH) && vb) {
                  const parts = vb.split(/\s+|,/).map(x => parseFloat(x)).filter(x => Number.isFinite(x));
                  if (parts.length === 4) {
                    const w = Math.max(1, parts[2]);
                    const h = Math.max(1, parts[3]);
                    if (!hasW) svgEl.setAttribute('width', String(w));
                    if (!hasH) svgEl.setAttribute('height', String(h));
                  }
                }
                normalized = new XMLSerializer().serializeToString(svgEl);
              }
            } catch (e) { normalized = raw; }

            const blob = new Blob([normalized], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);

            const img = new Image();
            img.onload = () => {
              try {
                const scale = 2;
                const w = img.naturalWidth || img.width || 2000;
                const h = img.naturalHeight || img.height || 1000;

                const canvasEl = document.createElement('canvas');
                canvasEl.width = Math.round(w * scale);
                canvasEl.height = Math.round(h * scale);

                const ctx = canvasEl.getContext('2d');
                if (!ctx) throw new Error('canvas 2d indisponivel');

                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);

                ctx.setTransform(scale, 0, 0, scale, 0, 0);
                ctx.drawImage(img, 0, 0);

                canvasEl.toBlob((jpegBlob) => {
                  try {
                    if (!jpegBlob) throw new Error('Falha ao gerar JPEG');
                    const jurl = URL.createObjectURL(jpegBlob);
                    const a = document.createElement('a');
                    a.href = jurl;
                    const base = String(fileObj.filename || ('fluxo_' + String(flowIdx+1).padStart(2,'0') + '.bpmn')).replace(/\.bpmn$/i, '');
                    a.download = base + '.jpeg';
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(() => {
                      try { URL.revokeObjectURL(jurl); } catch (e) {}
                      try { a.remove(); } catch (e) {}
                    }, 0);
                  } catch (e) {
                    alert('Falha ao exportar JPEG.');
                  }
                }, 'image/jpeg', 0.92);

              } catch (e) {
                alert('Falha ao exportar JPEG.');
              } finally {
                try { URL.revokeObjectURL(url); } catch (e) {}
              }
            };
            img.onerror = () => {
              try { URL.revokeObjectURL(url); } catch (e) {}
              alert('Falha ao exportar JPEG.');
            };
            img.src = url;

          }).catch(() => alert('Falha ao exportar JPEG.'));

        } catch (e) {
          try { alert('Falha ao exportar JPEG.'); } catch (_) {}
        }
      });
      const btnClose = document.createElement('button');
      btnClose.type = 'button';
      btnClose.className = 'atp-map-btn';
      btnClose.textContent = 'Fechar';
      btnClose.addEventListener('click', atpCloseRuleMapModal);

      actions.appendChild(btnZoomOut);
      actions.appendChild(zoomLabel);
      actions.appendChild(btnZoomIn);
      actions.appendChild(btnFit);
      actions.appendChild(btnDownload);
      actions.appendChild(btnJpeg);
      actions.appendChild(btnClose);
      top.appendChild(actions);

      const body = document.createElement('div');
      body.className = 'atp-map-body';
      const canvas = document.createElement('div');
      canvas.className = 'atp-map-canvas';
      canvas.id = 'atpRuleMapCanvas';
      body.appendChild(canvas);

      box.appendChild(top);
      box.appendChild(body);
      overlay.appendChild(box);
      document.body.appendChild(overlay);

      atpEnsureBpmnJsLoaded().then((BpmnJS) => {
        const viewer = new BpmnJS({ container: canvas });
        overlay._atpBpmnViewer = viewer;

        const originalNames = new Map();
        const MAX_LABEL = 90;
        const truncate = (s) => {
          const str = String(s || '');
          return (str.length > MAX_LABEL) ? (str.slice(0, MAX_LABEL - 1) + '…') : str;
        };

        const SVG_NS = 'http://www.w3.org/2000/svg';
        const setSvgTitle = (gfx, text) => {
          try {
            if (!gfx || !text) return;
            const t = String(text);
            let titleEl = gfx.querySelector('title');
            if (!titleEl) {
              titleEl = document.createElementNS(SVG_NS, 'title');
              gfx.insertBefore(titleEl, gfx.firstChild);
            }
            titleEl.textContent = t;
          } catch (e) {}
        };

        const getDocumentationText = (bo) => {
          try {
            const docs = bo && bo.documentation;
            if (!docs) return '';
            const arr = Array.isArray(docs) ? docs : [docs];
            const first = arr.find(d => d && typeof d.text === 'string' && d.text.trim());
            return first ? String(first.text).trim() : '';
          } catch (e) {
            return '';
          }
        };

        overlay._atpApplyHoverTitles = () => {
          try {
            const elementRegistry = viewer.get('elementRegistry');
            elementRegistry.forEach((el) => {
              try {
                if (!el || !el.businessObject) return;
                const bo = el.businessObject;

                const docText = getDocumentationText(bo);
                const full = docText || originalNames.get(el.id) || bo.name;
                if (!full) return;

                const gfx = elementRegistry.getGraphics(el);
                setSvgTitle(gfx, full);

                try {
                  const lbl = elementRegistry.get(el.id + '_label');
                  if (lbl) setSvgTitle(elementRegistry.getGraphics(lbl), full);
                } catch (e2) {}
              } catch (e) {}
            });
          } catch (e) {}
        };
        overlay._atpRestoreNames = () => {
          try {
            const modeling = viewer.get('modeling');
            originalNames.forEach((name, id) => {
              try { modeling.updateProperties(viewer.get('elementRegistry').get(id), { name }); } catch (e) {}
            });
            try { overlay._atpApplyHoverTitles && overlay._atpApplyHoverTitles(); } catch (e) {}
          } catch (e) {}
        };
        overlay._atpApplyTruncation = () => {
          try {
            const elementRegistry = viewer.get('elementRegistry');
            const modeling = viewer.get('modeling');
            elementRegistry.forEach((el) => {
              try {
                const bo = el && el.businessObject;
                if (!bo || typeof bo.name !== 'string' || !bo.name) return;
                if (!originalNames.has(el.id)) originalNames.set(el.id, bo.name);
                const t = truncate(originalNames.get(el.id));
                if (t !== bo.name) modeling.updateProperties(el, { name: t });
              } catch (e) {}
            });
            try { overlay._atpApplyHoverTitles && overlay._atpApplyHoverTitles(); } catch (e) {}
          } catch (e) {}
        };

        viewer.importXML(String(fileObj.xml || '')).then(() => {
          try {
            const canvasApi = viewer.get('canvas');
            canvasApi.zoom('fit-viewport');
            zoomValue = canvasApi.zoom();
            zoomLabel.textContent = Math.round(zoomValue * 100) + '%';
            overlay._atpApplyTruncation();
            try { overlay._atpApplyHoverTitles && overlay._atpApplyHoverTitles(); } catch (e) {}
          } catch (e) {}
        }).catch((e) => {
          try { console.warn(LOG_PREFIX, '[Fluxos/UI] importXML falhou:', e); } catch(_) {}
          alert('Falha ao carregar BPMN no modal.');
        });

        const setZoom = (z) => {
          try {
            const canvasApi = viewer.get('canvas');
            zoomValue = clamp(z, 0.2, 3.0);
            canvasApi.zoom(zoomValue);
            zoomLabel.textContent = Math.round(zoomValue * 100) + '%';
          } catch (e) {}
        };
        btnZoomIn.addEventListener('click', () => setZoom(zoomValue + 0.1));
        btnZoomOut.addEventListener('click', () => setZoom(zoomValue - 0.1));
        btnFit.addEventListener('click', () => {
          try {
            const canvasApi = viewer.get('canvas');
            canvasApi.zoom('fit-viewport');
            zoomValue = canvasApi.zoom();
            zoomLabel.textContent = Math.round(zoomValue * 100) + '%';
          } catch (e) {}
        });

      }).catch((e) => {
        try { console.warn(LOG_PREFIX, '[Fluxos/UI] Falha ao carregar bpmn-js modeler:', e); } catch(_) {}
        alert('Não foi possível carregar o bpmn-js (modeler).');
      });

    } catch (e) {}
  }

  init();

try { console.log('[ATP][OK] 10-ui-inicializacao.js inicializado'); } catch (e) {}

  try { if (typeof window.addOnlyConflictsCheckbox !== 'function') window.addOnlyConflictsCheckbox = addOnlyConflictsCheckbox; } catch(e) {}
;
