try { console.log('[ATP][LOAD] 04-styles.js carregado com sucesso'); } catch (e) { }

function injectStyle() {
  if (document.getElementById('atp-slim-style')) return;
  const st = document.createElement('style');
  st.id = 'atp-slim-style';
  st.textContent = `
      td[data-atp-col="conflita"], th[data-atp-col="conflita-th"]{width:260px;max-width:260px;overflow-wrap:anywhere;word-wrap:break-word;vertical-align:top;}
      .atp-conf-num{font-weight:700;margin-right:4px;}
      .atp-conf-tipo{font-weight:700;padding:1px 4px;border-radius:4px;}
      .atp-conf-tipo.collision{background:#fecaca;}
      .atp-conf-tipo.overlap{background:#fed7aa;}
      .atp-conf-tipo.objectloss{background:#fde68a;}
      .atp-conf-tipo.loop{background:#fee2e2;}      .atp-conf-tipo.contradiction{background:#c7d2fe;}
      .atp-conf-tipo.breakflow{background:#bbf7d0;}
      .atp-compare-btn{margin-top:5px !important;}
      .atp-compare-btn:hover{background:#e5e7eb;}
      .atp-sev-2{background:#fff7ed;}
      .atp-sev-3{background:#fff1f2;}
      .atp-sev-4{background:#ffe4e6;}
      .atp-sev-5{background:#fecdd3;}
      .atp-remover-emoji{display:table;align-items:center;gap:6px;font-size:12px;line-height:1;margin-top: 15px;}
      .atp-remover-glyph{font-size:14px;}
      .atp-remover-note{font-size:14px;}
      .atp-remover-plain-text{display:none;} /* Mantém o texto original escondido (para parser) */

      .atp-map-icon{display:inline-flex;align-items:center;justify-content:center;margin-top:3px;width:18px;height:18px;border:1px solid #d1d5db;border-radius:6px;background:#f9fafb;cursor:pointer;font-size:13px;line-height:1;user-select:none;}
      .atp-map-icon:hover{background:#e5e7eb;}
      /* Modal do Mapa: fullscreen */
      .atp-map-overlay{position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:999999;display:flex;align-items:stretch;justify-content:stretch;padding:0;}
      .atp-map-box{background:#fff;border-radius:0;max-width:none;max-height:none;width:100vw;height:100vh;box-shadow:0 10px 35px rgba(0,0,0,.35);display:flex;flex-direction:column;overflow:hidden;}
      .atp-map-top{display:flex;gap:10px;align-items:flex-start;justify-content:space-between;padding:12px 14px;border-bottom:1px solid #e5e7eb;}
      .atp-map-title{font-weight:800;color:#111827;font-size:14px;margin-bottom:2px;}
      .atp-map-sub{font-size:12px;color:#6b7280;}
      .atp-map-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center;}
      .atp-map-btn{padding:6px 10px;border:1px solid #d1d5db;border-radius:10px;background:#f9fafb;cursor:pointer;font-size:12px;}
      .atp-map-zoom{display:inline-block;min-width:44px;text-align:center;font-weight:700;color:#111827;font-size:12px;}
      .atp-map-btn:hover{background:#eef2f7;}
      .atp-map-body{flex:1;padding:0;overflow:hidden;position:relative;}
      .atp-map-canvas{width:100%;height:100%;}
      .atp-map-canvas .djs-container, .atp-map-canvas .djs-container svg{width:100% !important;height:100% !important;}
      .atp-map-canvas .bjs-container, .atp-map-canvas .bjs-container svg{width:100% !important;height:100% !important;}
      .atp-map-canvas svg{display:block;}
      .atp-map-canvas .djs-container{min-height:100%;}

      .atp-rf-canvas{width:100%;height:100%;background:transparent;}
      .atp-rf-canvas .react-flow{background:transparent !important;}
      .atp-rf-panel-left{background:#ffffff;border:1px solid #d1d5db;border-radius:12px;padding:10px;max-width:min(650px,58vw);box-shadow:0 8px 26px rgba(15,23,42,.15);}
      .atp-rf-panel-right{display:flex;align-items:center;gap:8px;}
      .atp-rf-panel-lanes{background:#ffffff;border:1px solid #d1d5db;border-radius:12px;padding:10px;max-width:min(760px,66vw);box-shadow:0 8px 26px rgba(15,23,42,.12);}
      .atp-rf-status-title{font-size:12px;font-weight:800;color:#0f172a;margin-bottom:4px;}
      .atp-rf-status-body{font-size:12px;line-height:1.45;color:#334155;word-break:break-word;}
      .atp-rf-exec-btn{font-weight:700;}

      .atp-rf-node-box{min-width:240px;max-width:320px;padding:10px 12px;border:1px solid #cbd5e1;border-radius:14px;background:#ffffff;box-shadow:0 10px 24px rgba(15,23,42,.08);}
      .atp-rf-node-kind{display:inline-flex;align-items:center;justify-content:center;padding:2px 8px;border-radius:999px;border:1px solid #c7d2fe;font-size:10px;font-weight:800;letter-spacing:.3px;margin-bottom:6px;width:max-content;}
      .atp-rf-node-title{font-size:12px;font-weight:700;color:#111827;line-height:1.35;word-break:break-word;}
      .atp-rf-node-sub{font-size:11px;color:#475569;line-height:1.3;margin-top:4px;word-break:break-word;}
      .atp-rf-kind-node .atp-rf-node-kind{background:#e0f2fe;border-color:#bae6fd;color:#0c4a6e;}
      .atp-rf-kind-entrada .atp-rf-node-kind{background:#dcfce7;border-color:#86efac;color:#14532d;}
      .atp-rf-kind-entrada{border-color:#86efac;}
      .atp-rf-kind-regra .atp-rf-node-kind{background:#ffedd5;border-color:#fdba74;color:#9a3412;}
      .atp-rf-kind-regra{border-color:#fdba74;background:#fffaf0;}
      .atp-rf-kind-saida .atp-rf-node-kind{background:#e5e7eb;border-color:#cbd5e1;color:#111827;}
      .atp-rf-kind-saida{border-color:#cbd5e1;background:#f8fafc;}

      .atp-rf-decision-node{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;width:128px;height:128px;}
      .atp-rf-decision-diamond{width:76px;height:76px;transform:rotate(45deg);background:#ffedd5;border:2px solid #fb923c;border-radius:14px;display:flex;align-items:center;justify-content:center;color:#9a3412;font-size:24px;font-weight:800;box-shadow:0 8px 18px rgba(249,115,22,.25);}
      .atp-rf-decision-diamond::before{content:'?';transform:rotate(-45deg);}
      .atp-rf-decision-label{font-size:11px;font-weight:800;letter-spacing:.4px;color:#9a3412;text-transform:uppercase;}

      .atp-rf-node-visited .atp-rf-node-box{border-color:#16a34a;box-shadow:0 0 0 2px rgba(34,197,94,.20);}
      .atp-rf-node-current .atp-rf-node-box{border-color:#d97706;box-shadow:0 0 0 3px rgba(245,158,11,.24);}
      .atp-rf-node-skip .atp-rf-node-box{border-color:#dc2626;box-shadow:0 0 0 2px rgba(220,38,38,.2);}
      .atp-rf-node-current .atp-rf-decision-diamond{border-color:#d97706;box-shadow:0 0 0 3px rgba(245,158,11,.24);}

      .atp-rf-edge .react-flow__edge-path{transition:stroke .25s ease, stroke-width .25s ease, stroke-dasharray .25s ease;}
      .atp-rf-edge .react-flow__edge-text{font-weight:700;fill:#111827;}

      .atp-map-scroller{overflow:auto;max-height:72vh;border:1px solid #e5e7eb;border-radius:10px;background:#fff;}
      .atp-map-svg{text-rendering:geometricPrecision;}
      .atp-dashboard-icon{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;margin-left:8px;border:1px solid #d1d5db;border-radius:6px;background:#f9fafb;cursor:pointer;font-size:16px;line-height:1;}
      #btnDashboardUsoATP{margin-left:8px !important;}
      .atp-dashboard-icon:hover{background:#e5e7eb;}
      .atp-dash-overlay{position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:999999;display:flex;align-items:center;justify-content:center;padding:16px;}
      .atp-dash-box{background:#fff;border-radius:12px;width:min(920px,96vw);max-height:90vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 10px 35px rgba(0,0,0,.35);}
      .atp-dash-top{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 14px;border-bottom:1px solid #e5e7eb;}
      .atp-dash-title{font-weight:800;color:#111827;font-size:14px;}
      .atp-dash-body{padding:14px;overflow:auto;}
      .atp-dash-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:14px;}
      .atp-dash-kpi{border:1px solid #e5e7eb;border-radius:10px;padding:10px;background:#fafafa;}
      .atp-dash-kpi-num{font-weight:800;font-size:20px;color:#111827;line-height:1.1;}
      .atp-dash-kpi-lbl{font-size:12px;color:#4b5563;}
      .atp-dash-sec-title{font-weight:700;font-size:13px;color:#111827;margin:10px 0 8px;}
      .atp-dash-bars{display:flex;flex-direction:column;gap:8px;}
      .atp-dash-bar-row{display:grid;grid-template-columns:260px 1fr 56px;align-items:center;gap:8px;}
      .atp-dash-bar-label{font-size:12px;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .atp-dash-bar-track{height:10px;border-radius:999px;background:#e5e7eb;overflow:hidden;}
      .atp-dash-bar-fill{height:100%;background:#2563eb;}
      .atp-dash-bar-val{font-size:12px;color:#374151;text-align:right;}
      .atp-dash-foot{margin-top:12px;font-size:11px;color:#6b7280;}
      @media (max-width: 768px){
        .atp-dash-grid{grid-template-columns:1fr;}
        .atp-dash-bar-row{grid-template-columns:1fr;}
        .atp-rf-panel-left{max-width:min(92vw,92vw);}
        .atp-rf-node-box{min-width:190px;max-width:250px;padding:8px 10px;}
      }

    `;
  document.head.appendChild(st);
}

function ensureColumns(table) {
  try {
    if (!table) return;

    const dtOn = (table.classList && table.classList.contains('dataTable')) ||
      table.closest('.dataTables_wrapper');
    if (dtOn) return;

    const thead = table.querySelector('thead');
    if (thead) {
      const hr = thead.querySelector('tr');
      const thAcoes = (function () {
        try {
          if (!hr) return null;
          const ths = Array.from(hr.children).filter(n => n && n.tagName === 'TH');
          if (!ths.length) return null;
          const byText = ths.find(th => ((th.textContent || '').trim().toLowerCase()).includes('ações'));
          if (byText) return byText;
          return ths[ths.length - 1];
        } catch (e) { return null; }
      })();
      if (hr && !hr.querySelector('th[data-atp-col="conflita"]')) {
        const th = document.createElement('th');
        th.dataset.atpCol = 'conflita';
        th.textContent = 'Conflitos';
        th.className = 'infraTh sorting_disabled';
        th.style.whiteSpace = 'nowrap';
        if (thAcoes && thAcoes.parentNode === hr) hr.insertBefore(th, thAcoes);
        else hr.appendChild(th);
      }
    }

    const tbody = table.querySelector('tbody');
    if (!tbody) return;

    const trs = tbody.querySelectorAll('tr');
    trs.forEach(tr => {
      const existing = tr.querySelector('td[data-atp-col="conflita"]');

      if (existing) {
        try {
          const tds0 = Array.from(tr.children).filter(n => n && n.tagName === 'TD');
          const tdAcoes0 = (function () {
            try {
              if (!tds0.length) return null;

              const byIcons = tds0.find(td => td !== existing && td.querySelector && td.querySelector('i.material-icons, .material-icons, .custom-switch'));
              if (byIcons) return byIcons;
              return tds0[tds0.length - 1];
            } catch (e) { return null; }
          })();
          if (tdAcoes0 && existing.nextSibling !== tdAcoes0) {
            tr.insertBefore(existing, tdAcoes0);
          }
        } catch (e) { }
        return;
      }
      const td = document.createElement('td');
      td.dataset.atpCol = 'conflita';
      td.textContent = '';
      try {
        const tds = Array.from(tr.children).filter(n => n && n.tagName === 'TD');
        const tdAcoes = (function () {
          try {
            if (!tds.length) return null;
            const byIcons = tds.find(x => x.querySelector && x.querySelector('i.material-icons, .material-icons, .custom-switch'));
            if (byIcons) return byIcons;
            return tds[tds.length - 1];
          } catch (e) { return null; }
        })();
        if (tdAcoes) tr.insertBefore(td, tdAcoes);
        else tr.appendChild(td);
      } catch (e) { tr.appendChild(td); }
    });
  } catch (e) { }
}

function mapColumns(table) {
  const thead = table.tHead || table.querySelector('thead');
  if (!thead) return null;
  const ths = Array.from(thead.querySelectorAll('th'));
  const find = (labels, fallback) => {
    const idx = ths.findIndex(th => labels.some(lbl => lower(th.textContent || '').includes(lbl)));
    return (idx >= 0) ? idx : fallback;
  };
  return {
    colNumPrior: find(['nº', 'no', 'n°', 'prioridade'], 1),
    colRemover: find(['localizador remover', 'remover'], 3),
    colTipo: find(['tipo de controle', 'tipo / critério', 'tipo / criterio', 'tipo'], 4),
    colIncluir: find(['localizador incluir', 'ação', 'acao', 'incluir'], 5),
    colOutros: find(['outros critérios', 'outros outrosCriterios', 'critérios', 'outrosCriterios'], 6)
  };
}

const ATP_TIPOS_TOOLTIPS = {
  'COLISÃO TOTAL': 'COLISÃO TOTAL = Quando "Prioridade", "Localizador REMOVER", "Tipo de Controle / Critério", "Localizador INCLUIR / Ação" e "Outros Critérios" são iguais.',
  'COLISÃO PARCIAL': 'COLISÃO PARCIAL = Quando "Localizador REMOVER", "Tipo de Controle / Critério", "Localizador INCLUIR / Ação" e "Outros Critérios" são iguais, mas a "Prioridade" é diferente.',
  'SOBREPOSIÇÃO': 'SOBREPOSIÇÃO = Quando "Localizador REMOVER" e "Tipo de Controle / Critério" são iguais, uma regra é mais ampla em "Outros Critérios" (ou idêntica) e executa antes da outra.',
  'POSSÍVEL SOBREPOSIÇÃO': 'POSSÍVEL SOBREPOSIÇÃO = Quando "Localizador REMOVER" e "Tipo de Controle / Critério" são iguais, há diferença de abrangência em "Outros Critérios" e as prioridades de execução são equivalentes.',
  'PERDA DE OBJETO': 'PERDA DE OBJETO = Quando uma regra anterior remove o processo do(s) localizador(es) informado(s), impedindo que a regra seguinte capture o objeto necessário.',
  'PERDA DE OBJETO CONDICIONAL': 'PERDA DE OBJETO CONDICIONAL = Quando uma regra pode remover parte do conjunto que outra regra exige em combinação (AND), bloqueando disparos em parte dos casos.',
  'CONTRADIÇÃO': 'CONTRADIÇÃO = Quando a própria regra contém critérios mutuamente exclusivos no mesmo ramo (AND), tornando-a logicamente impossível.',
  'QUEBRA DE FLUXO': 'QUEBRA DE FLUXO = Quando a regra executa Ação Programada, mas mantém os mesmos localizadores (INCLUIR == REMOVER), podendo reexecutar em ciclo.',
  'LOOPING': 'LOOPING = Quando regras se retroalimentam (uma remove o que a outra inclui, e vice-versa), gerando repetição.',
  'LOOPING POTENCIAL': 'LOOPING POTENCIAL = Quando duas regras se retroalimentam (uma remove o que a outra inclui, e vice-versa), gerando repetição.'
};

const ATP_MINI_HELP_TIP = [
  'COLISÃO TOTAL = Quando "Prioridade", "Localizador REMOVER", "Tipo de Controle / Critério", "Localizador INCLUIR / Ação" e "Outros Critérios" são iguais.',
  '',
  'COLISÃO PARCIAL = Quando "Localizador REMOVER", "Tipo de Controle / Critério", "Localizador INCLUIR / Ação" e "Outros Critérios" são iguais, mas a "Prioridade" é diferente.',
  '',
  'SOBREPOSIÇÃO = Quando "Localizador REMOVER" e "Tipo de Controle / Critério" são iguais, e a regra que executa antes é mais ampla (ou equivalente) em "Outros Critérios".',
  '',
  'POSSÍVEL SOBREPOSIÇÃO = Quando "Localizador REMOVER" e "Tipo de Controle / Critério" são iguais, há diferença de abrangência em "Outros Critérios" e as prioridades de execução são equivalentes.',
  '',
  'PERDA DE OBJETO = Quando uma regra anterior remove o localizador (REMOVER informados) que a regra seguinte precisaria para se aplicar.',
  '',
  'PERDA DE OBJETO CONDICIONAL = Quando uma regra remove parte do conjunto que outra regra precisa em combinação (AND), podendo impedir o disparo em parte dos casos (detecção depende da configuração de análise condicional).',
  '',
  'CONTRADIÇÃO = Quando a própria regra contém critérios mutuamente exclusivos no mesmo ramo (conector "E"/AND), tornando-a logicamente impossível (ex.: COM e SEM; APENAS UMA e MAIS DE UMA; estados diferentes do mesmo Dado Complementar).',
  '',
  'QUEBRA DE FLUXO = Quando a regra executa Ação Programada, mas mantém os mesmos localizadores (INCLUIR == REMOVER), podendo repetir a ação em novo ciclo e gerar erro.',
  '',
  'LOOPING POTENCIAL = Quando regras se retroalimentam (ciclo), gerando efeito repetido de incluir/remover (detecção depende da configuração de análise de looping).',
  '',
  'PRIORIDADE: menor número executa antes. Prioridade null executa por último (após todas as prioridades definidas).'
].join('\n');

function getTipoTooltip(tipo) {
  const t = clean(String(tipo || '')).toUpperCase();
  return ATP_TIPOS_TOOLTIPS[t] || '';
}

function bindTipoConflitoTooltips(root) {
  const scope = root || document;
  const els = Array.from(scope.querySelectorAll('.atp-conf-tipo[data-atp-tipo]'));

  els.forEach(el => {
    if (el.dataset.atpTipBound === '1') return;
    el.dataset.atpTipBound = '1';

    const tipo = (el.getAttribute('data-atp-tipo') || el.textContent || '').trim();
    const base = (getTipoTooltip(tipo) || '').trim();

    const rawPQ = (el.getAttribute('data-atp-porque') || '').trim();

    let pqTxt = rawPQ;
    let sugTxt = '';
    if (rawPQ) {
      const parts = rawPQ.split(/(?:\r?\n)?\s*Sugestão:\s*/i);
      pqTxt = (parts[0] || '').trim();
      sugTxt = (parts[1] || '').trim();
    }

    const msg =

      `<b>Por quê:</b> ${pqTxt || '(não informado)'}\n\n` +
      `<b>Sugestão:</b> ${sugTxt || '(nenhuma)'}`;

    if (!base && !rawPQ && !tipo) return;

    el.style.cursor = 'help';

    el.addEventListener('mouseenter', () => {
      try {
        if (typeof window.infraTooltipMostrar === 'function') {
          window.infraTooltipMostrar(msg, 'Tipo de Conflito (ATP)', 680);

          setTimeout(() => {
            const tip =
              document.querySelector('#divInfraTooltip') ||
              document.querySelector('.infraTooltip') ||
              document.querySelector('[id*="Tooltip"]') ||
              document.querySelector('[class*="Tooltip"]');

            if (tip) tip.style.whiteSpace = 'pre-wrap';
          }, 0);
        } else {

          el.setAttribute('title', msg);
        }
      } catch { }
    });

    el.addEventListener('mouseleave', () => {
      try {
        if (typeof window.infraTooltipOcultar === 'function') window.infraTooltipOcultar();
      } catch { }
    });
  });
}

function getOutrosCanonical(rule) {
  const oc = rule?.outrosCriterios;
  if (oc && typeof oc === 'object' && 'canonical' in oc) return clean(oc.canonical || '');
  if (typeof oc === 'string') return clean(oc);
  return '';
}

function detectContradictions(rule) {
  const oc = rule?.outrosCriterios;
  const groups = oc?.groups || [];
  const motivos = [];

  const norm = (s) => clean(String(s || '')).toLowerCase();
  const add = (msg) => { if (msg && !motivos.includes(msg)) motivos.push(msg); };

  const analyzeClause = (terms, contextLabel) => {

    const kv = new Map();
    for (const t of terms) {
      const p = String(t || '');
      const eq = p.indexOf('=');
      if (eq <= 0) continue;
      const k = p.slice(0, eq);
      const v = p.slice(eq + 1);
      if (!kv.has(k)) kv.set(k, []);
      kv.get(k).push(v);
    }

    for (const [k, vals] of kv.entries()) {
      if (k !== 'dadocomplementardoprocesso') continue;
      const byGrupo = new Map();
      for (const v of vals) {
        const raw = clean(v);
        const parts = raw.split('-').map(s => clean(s)).filter(Boolean);
        if (parts.length < 2) continue;
        const grupo = parts.slice(0, -1).join('-');
        const estado = parts[parts.length - 1];
        if (!byGrupo.has(grupo)) byGrupo.set(grupo, new Set());
        byGrupo.get(grupo).add(estado);
      }
      for (const [grupo, estados] of byGrupo.entries()) {
        if (estados.size >= 2) {
          add(`${contextLabel}Dado Complementar do Processo: "${grupo}" com múltiplos valores ao mesmo tempo (${Array.from(estados).join(', ')}).`);
        }
      }
    }

    for (const [k, vals] of kv.entries()) {
      if (k !== 'prazomultiplo' && k !== 'prazo') continue;
      const bucket = new Map();
      for (const v of vals) {
        const txtv = clean(v);
        let m = txtv.match(/^Processos\s+(COM|SEM)\s+prazo\s+aberto\/ag\.\s*abertura(\s+.*)?$/i);
        if (m) {
          const pol = m[1].toUpperCase();
          const scope = clean(m[2] || '').toUpperCase();
          const sig = `ABERTO${scope ? ' ' + scope : ''}`;
          if (!bucket.has(sig)) bucket.set(sig, new Set());
          bucket.get(sig).add(pol);
          continue;
        }

        m = txtv.match(/^Processos\s+(COM|SEM)\s+prazo\s+aberto\/ag\.\s*abertura\s+(DO\s+PÓLO\s+PASSIVO|DO\s+PÓLO\s+ATIVO|DE\s+ENTIDADES\s+DO\s+PÓLO\s+PASSIVO|DE\s+ENTIDADES\s+DO\s+PÓLO\s+ATIVO|DE\s+PERITOS|DE\s+UNIDADES\s+EXTERNAS\/APS)$/i);
        if (m) {
          const pol = m[1].toUpperCase();
          const scope = clean(m[2] || '').toUpperCase();
          const sig = `ABERTO ${scope}`;
          if (!bucket.has(sig)) bucket.set(sig, new Set());
          bucket.get(sig).add(pol);
        }
      }
      for (const [sig, set] of bucket.entries()) {
        if (set.has('COM') && set.has('SEM')) {
          add(`${contextLabel}Prazo múltiplo: marcado como COM e SEM no mesmo critério (${sig.replace(/^ABERTO/, 'prazo aberto/ag. abertura')}).`);
        }
      }
    }

    for (const [k, vals] of kv.entries()) {
      if (k !== 'litisconsorcio') continue;
      const polMap = new Map();
      for (const v of vals) {
        const t = clean(v);
        const m = t.match(/^Processos\s+com\s+(APENAS\s+UMA|MAIS\s+DE\s+UMA)\s+parte\s+no\s+PÓLO\s+(PASSIVO|ATIVO)/i);
        if (!m) continue;
        const quant = norm(m[1]).includes('apenas') ? 'UMA' : 'MAIS';
        const polo = m[2].toUpperCase();
        if (!polMap.has(polo)) polMap.set(polo, new Set());
        polMap.get(polo).add(quant);
      }
      for (const [polo, set] of polMap.entries()) {
        if (set.has('UMA') && set.has('MAIS')) {
          add(`${contextLabel}Litisconsórcio: "${polo}" marcado como APENAS UMA e MAIS DE UMA parte ao mesmo tempo.`);
        }
      }
    }

    for (const [k, vals] of kv.entries()) {
      if (k !== 'representacaoprocessualdaspartes') continue;
      const polMap = new Map();
      for (const v of vals) {
        const t = clean(v);
        const m = t.match(/^Processos\s+(COM|SEM)\s+procurador\/advogado\s+no\s+PÓLO\s+(PASSIVO|ATIVO)/i);
        if (!m) continue;
        const pol = m[1].toUpperCase();
        const polo = m[2].toUpperCase();
        if (!polMap.has(polo)) polMap.set(polo, new Set());
        polMap.get(polo).add(pol);
      }
      for (const [polo, set] of polMap.entries()) {
        if (set.has('COM') && set.has('SEM')) {
          add(`${contextLabel}Representação processual: "${polo}" marcado como COM e SEM procurador/advogado ao mesmo tempo.`);
        }
      }
    }
  };

  for (const g of groups) {
    const clauses = g?.clauses ? Array.from(g.clauses) : [];
    const head = g?.header ? `${clean(g.header)}: ` : '';
    const ctx = head ? `${head}` : '';
    for (const clause of clauses) {
      const terms = Array.from(clause || []);
      analyzeClause(terms, ctx);
    }
  }

  return motivos;
}

function relationOutros(ruleA, ruleB) {

  const ocA = ruleA?.outrosCriterios;
  const ocB = ruleB?.outrosCriterios;

  const groupsCanon = (oc) => {
    if (!oc) return [];
    if (typeof oc === 'string') return clean(oc) ? [clean(oc)] : [];
    if (typeof oc === 'object') {
      if (Array.isArray(oc.groups) && oc.groups.length) {
        return oc.groups.map(g => clean(g?.canonical || '')).filter(Boolean);
      }
      if ('canonical' in oc) {
        const c = clean(oc.canonical || '');
        return c ? [c] : [];
      }
    }
    return [];
  };

  const a = groupsCanon(ocA);
  const b = groupsCanon(ocB);

  if (!a.length && !b.length) return 'identicos';
  if (!a.length && b.length) return 'A_mais_ampla';
  if (a.length && !b.length) return 'B_mais_ampla';

  const setA = new Set(a);
  const setB = new Set(b);

  const eq = (setA.size === setB.size) && Array.from(setA).every(x => setB.has(x));
  if (eq) return 'identicos';

  const aSubsetB = Array.from(setA).every(x => setB.has(x));
  const bSubsetA = Array.from(setB).every(x => setA.has(x));

  if (aSubsetB && !bSubsetA) return 'A_mais_ampla';
  if (bSubsetA && !aSubsetB) return 'B_mais_ampla';

  return 'diferentes';
}

const REMOVER_EMOJI = {
  "null": { glyph: "❔", note: "" },
  "0": { glyph: "🗂️➖", note: "(Remover informados)" },
  "1": { glyph: "❌", note: "(Remover TODOS)" },
  "2": { glyph: "🚫⚙️", note: "(Remover todos exceto sistema)" },
  "3": { glyph: "➕", note: "(Não remover; Apenas acrescentar)" },
  "4": { glyph: "🗂️⚙️➖", note: "(Remover apenas sistema)" }
};

function removerEmojiInfo(val) {
  val = (val == null || val === "" || val === "null") ? "null" : String(val);

  const map = (typeof REMOVER_EMOJI !== 'undefined') ? REMOVER_EMOJI : { "null": { glyph: "", note: "" } };
  return map[val] || map["null"];
}

function mkEmojiSpan(val, extraClass) {
  const info = removerEmojiInfo(val);
  const wrap = document.createElement("span");
  wrap.className = "atp-remover-emoji" + (extraClass ? " " + extraClass : "");
  const glyph = document.createElement("span");
  glyph.className = "atp-remover-glyph";
  glyph.textContent = info.glyph;
  wrap.appendChild(glyph);

  if (info.note) {
    const note = document.createElement("span");
    note.className = "atp-remover-note";
    note.textContent = info.note;
    wrap.appendChild(note);
  }
  return wrap;
}

function parseTooltipMsgFromOnmouseover(onm) {
  return parseTooltipMsg(onm);
}

function tooltipMsgToValue(msg) {
  const s = rmAcc(lower(msg || "")).replace(/\.+$/, "").trim();
  if (!s) return "null";

  const reTodosLoc = /todos\s+(os\s+)?localizadores/;
  const reTodosExceto = /todos\s+(os\s+)?localizadores[\s\S]*exceto/;

  if (s.includes("apenas os de sistema")) return "4";
  if (s.includes("nao remover") || s.includes("não remover") || s.includes("apenas acrescentar")) return "3";
  if (reTodosExceto.test(s) || (s.includes("exceto") && (s.includes("todos") && s.includes("localizador")))) return "2";
  if (reTodosLoc.test(s) || s.includes("remover todos")) return "1";
  if (s.includes("localizador") && s.includes("informado")) return "0";

  return "null";
}

function removerPlainTextToValue(txt) {
  const s = rmAcc(lower(txt || "")).replace(/\.+$/, "").trim();
  if (!s) return null;

  if (s === "nenhum") return "3";
  if (s.includes("manter") && s.includes("localizador") && s.includes("sistema")) return "2";
  if (s.includes("todos") && s.includes("localizador")) return "1";
  return null;
}

function replaceLupaImgWithEmoji(triggerEl, val) {
  if (!triggerEl || triggerEl.nodeType !== 1) return;

  const onm0 = triggerEl.getAttribute('onmouseover') || '';
  if (onm0.indexOf('Comportamento do Localizador REMOVER') === -1) return;

  const img = (triggerEl.tagName === 'IMG') ? triggerEl : (triggerEl.querySelector('img') || null);
  if (!img) return;

  let msg0 = '';
  try { msg0 = parseTooltipMsgFromOnmouseover(onm0) || ''; } catch { }

  let span = null;

  const nextImg = img.nextElementSibling;
  const nextTrig = triggerEl.nextElementSibling;
  if (nextImg && nextImg.classList && nextImg.classList.contains('atp-remover-emoji-tooltip')) span = nextImg;
  if (!span && nextTrig && nextTrig.classList && nextTrig.classList.contains('atp-remover-emoji-tooltip')) span = nextTrig;

  const currentVal = span?.dataset?.atpRemoverVal;
  const currentMsg = span?.dataset?.atpRemoverMsg;
  if (span && String(currentVal) === String(val ?? 'null') && String(currentMsg || '') === String(msg0 || '')) {
    img.style.display = 'none';
    return;
  }

  const fresh = mkEmojiSpan(val, "atp-tooltip");
  fresh.classList.add('atp-remover-emoji-tooltip');

  try { fresh.dataset.atpRemoverVal = String(val ?? 'null'); } catch { }
  try { if (msg0) fresh.dataset.atpRemoverMsg = msg0; } catch { }

  fresh.style.cursor = "default";
  fresh.addEventListener("mouseenter", () => {
    try { if (typeof window.infraTooltipMostrar === "function") window.infraTooltipMostrar(msg0, "Comportamento do Localizador REMOVER", 600); } catch { }
  });
  fresh.addEventListener("mouseleave", () => {
    try { if (typeof window.infraTooltipOcultar === "function") window.infraTooltipOcultar(); } catch { }
  });

  img.style.display = 'none';

  if (span) span.replaceWith(fresh);
  else img.insertAdjacentElement("afterend", fresh);

  const td = img.closest('td');
  if (td) {
    try { td.dataset.atpRemoverVal = String(val ?? 'null'); } catch { }
    try { if (msg0) td.dataset.atpRemoverMsg = msg0; } catch { }
  }

  try { img.dataset.atpEmojiApplied = "1"; } catch { }
}

function updateAllRemoverLupasByTooltipText(root) {
  const scope = root || document;

  const triggers = Array.from(scope.querySelectorAll('[onmouseover*="Comportamento do Localizador REMOVER"]'));
  for (const el of triggers) {
    const onm = el.getAttribute('onmouseover') || '';
    const msg = parseTooltipMsgFromOnmouseover(onm);
    const val = tooltipMsgToValue(msg);
    replaceLupaImgWithEmoji(el, val);
  }
}

function replacePlainRemoverTextInTable(table, cols) {
  try {
    if (!table || !cols) return;
    const tbodys = table.tBodies?.length ? Array.from(table.tBodies) : [table.querySelector("tbody")].filter(Boolean);
    const rows = tbodys.flatMap(tb => Array.from(tb.rows));

    for (const tr of rows) {
      const tds = Array.from(tr.querySelectorAll(':scope > td'));
      const td = tds[cols.colRemover] || null;
      if (!td) continue;

      if (td.querySelector('img[src*="lupa.gif"][onmouseover*="Comportamento do Localizador REMOVER"]')) continue;
      if (td.querySelector('span.atp-remover-emoji')) continue;

      const plain = clean(td.textContent || "");
      const val = removerPlainTextToValue(plain);
      if (!val) continue;

      try { td.dataset.atpRemoverVal = String(val); } catch { }
      try { td.dataset.atpRemoverWildcard = (plain === 'Todos os localizadores') ? "1" : "0"; } catch { }
      try { td.dataset.atpRemoverTextOriginal = plain; } catch { }

      const hidden = document.createElement("span");
      hidden.className = "atp-remover-plain-text";
      hidden.textContent = plain;

      const emoji = mkEmojiSpan(val, "atp-in-table");
      emoji.dataset.atpRemoverVal = val;

      td.textContent = "";
      td.appendChild(hidden);
      td.appendChild(emoji);
    }
  } catch { }
}

function removeAlternarUI(root) {
  if (!root || !root.querySelectorAll) return;
  try {
    root.querySelectorAll('span[id^="alternarVisualizacao"], a[href*="alternarVisualizacaoLista"]').forEach(n => n.remove());
  } catch {  }
}

function stripExpandArtifacts(root) {
  if (!root) return;
  try {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const tn of nodes) {
      const txt = String(tn.textContent || '');
      if (/^\s*\.\.\.\s*$/.test(txt)) { tn.textContent = ' '; continue; }
      tn.textContent = txt.replace(/\.\.\.\s*$/g, '');
    }
  } catch {  }
}

try { console.log('[ATP][OK] 04-styles.js inicializado'); } catch (e) { }
;
