
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
            atpOpenFlowBpmnModal(f, idx);
          } catch (e) {
            try { console.warn(LOG_PREFIX, '[Fluxos/UI] Falha ao visualizar fluxo:', e); } catch(_) {}
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
