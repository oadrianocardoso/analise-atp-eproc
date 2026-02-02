try { console.log('[ATP][LOAD] 02_dom_and_style.js carregado com sucesso'); } catch (e) {}
/**
 * ATP MODULAR - 02_dom_and_style.js
 * Extraído de ATP-versao estavel com bpmno.js
 */

  function injectStyle() { // Injeta CSS (uma vez).
    if (document.getElementById('atp-slim-style')) return; // Se já existe, não reinjeta.
    const st = document.createElement('style'); // Cria tag <style>.
    st.id = 'atp-slim-style'; // Define ID para controle.
    st.textContent = `
      td[data-atp-col="conflita"], th[data-atp-col="conflita-th"]{width:260px;max-width:260px;overflow-wrap:anywhere;word-wrap:break-word;vertical-align:top;}
      .atp-conf-num{font-weight:700;margin-right:4px;}
      .atp-conf-tipo{font-weight:700;padding:1px 4px;border-radius:4px;}
      .atp-conf-tipo.collision{background:#fecaca;}
      .atp-conf-tipo.overlap{background:#fed7aa;}
      .atp-conf-tipo.objectloss{background:#fde68a;}
      .atp-conf-tipo.loop{background:#fee2e2;}
      \.atp-conf-tipo\.contradiction\{background:#c7d2fe;\}
      .atp-conf-tipo.breakflow{background:#bbf7d0;}
      .atp-compare-btn{margin-top:4px;padding:2px 6px;border:1px solid #1f2937;border-radius:6px;font-size:11px;background:#f3f4f6;cursor:pointer;}
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

      .atp-map-scroller{overflow:auto;max-height:72vh;border:1px solid #e5e7eb;border-radius:10px;background:#fff;}
      .atp-map-svg{text-rendering:geometricPrecision;}

    `; // CSS mínimo (sem features paralelas).
    document.head.appendChild(st); // Aplica no <head>.
  }

function ensureColumns(table) { // DataTables-safe: injeta apenas nossa coluna (sem padding de TDs vazios)
  try {
    if (!table) return;

    // Se DataTables já "pegou" a tabela, não mexe na estrutura (evita TN/18 e layout quebrado).
    const dtOn = (table.classList && table.classList.contains('dataTable')) ||
                 table.closest('.dataTables_wrapper');
    if (dtOn) return;

    // THEAD
    const thead = table.querySelector('thead');
    if (thead) {
      const hr = thead.querySelector('tr');
      const thAcoes = (function(){
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

    // TBODY
    const tbody = table.querySelector('tbody');
    if (!tbody) return;

    const trs = tbody.querySelectorAll('tr');
    trs.forEach(tr => {
      const existing = tr.querySelector('td[data-atp-col="conflita"]');
      // Se já existe, só garante posição (antes de Ações) e sai.
      if (existing) {
        try {
          const tds0 = Array.from(tr.children).filter(n => n && n.tagName === 'TD');
          const tdAcoes0 = (function(){
            try {
              if (!tds0.length) return null;
              // coluna de ações costuma ter ícones/links e fica ao final
              const byIcons = tds0.find(td => td !== existing && td.querySelector && td.querySelector('i.material-icons, .material-icons, .custom-switch'));
              if (byIcons) return byIcons;
              return tds0[tds0.length - 1];
            } catch (e) { return null; }
          })();
          if (tdAcoes0 && existing.nextSibling !== tdAcoes0) {
            tr.insertBefore(existing, tdAcoes0);
          }
        } catch (e) {}
        return;
      }
      const td = document.createElement('td');
      td.dataset.atpCol = 'conflita';
      td.textContent = ''; // preenchido depois pela análise
      try {
        const tds = Array.from(tr.children).filter(n => n && n.tagName === 'TD');
        const tdAcoes = (function(){
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
  } catch (e) {}
} // ensureColumns

  // ==============================
  // Mapeamento de colunas (por título)
  // ==============================

  function mapColumns(table) { // Descobre índices das colunas relevantes pelo header.
    const thead = table.tHead || table.querySelector('thead'); // Pega THEAD.
    if (!thead) return null; // Sem THEAD, sem mapeamento.
    const ths = Array.from(thead.querySelectorAll('th')); // Lista de THs.
    const find = (labels, fallback) => { // Função auxiliar para achar índice por rótulos.
      const idx = ths.findIndex(th => labels.some(lbl => lower(th.textContent || '').includes(lbl))); // Procura label.
      return (idx >= 0) ? idx : fallback; // Retorna índice ou fallback.
    };
    return { // Retorna objeto com índices (com fallback compatível com seu script original).
      colNumPrior: find(['nº', 'no', 'n°', 'prioridade'], 1), // Coluna Nº/Prioridade.
      colRemover:  find(['localizador remover', 'remover'], 3), // Coluna REMOVER.
      colTipo:     find(['tipo de controle', 'tipo / critério', 'tipo / criterio', 'tipo'], 4), // Coluna TIPO.
      colIncluir:  find(['localizador incluir', 'ação', 'acao', 'incluir'], 5), // Coluna INCLUIR.
      colOutros:   find(['outros critérios', 'outros outrosCriterios', 'critérios', 'outrosCriterios'], 6) // Coluna OUTROS.
    };
  }

  // ==============================
  // Extração: número e prioridade
  // ==============================

// ==============================
  // OUTROS CRITÉRIOS: extrair como mapa {chave: valor}
  // ==============================

  // ============================================================
  // Tooltip (descrição fixa por tipo de conflito) - padrão eProc
  // ============================================================
  const ATP_TIPOS_TOOLTIPS = {
    'COLISÃO TOTAL': 'COLISÃO TOTAL = Quando "Prioridade", "Localizador REMOVER", "Tipo de Controle / Critério" e "Outros Critérios" são iguais.',
    'COLISÃO PARCIAL': 'COLISÃO PARCIAL = Quando "Localizador REMOVER", "Tipo de Controle / Critério" e "Outros Critérios" são iguais, mas a "Prioridade" é diferente.',
    'SOBREPOSIÇÃO': 'SOBREPOSIÇÃO = Quando "Localizador REMOVER", "Tipo de Controle / Critério" são iguais, mas a "Prioridade" de A é menor que a "Prioridade" de B.',
    'POSSÍVEL SOBREPOSIÇÃO': 'POSSÍVEL SOBREPOSIÇÃO = Quando "Localizador REMOVER", "Tipo de Controle / Critério" são iguais, mas a "Prioridade" de A e B são indefinidas.',
    'PERDA DE OBJETO': 'PERDA DE OBJETO = Quando "Localizador REMOVER", "Tipo de Controle / Critério" são iguais, mas a "Prioridade" de A é menor que à "Prioridade" de B e A tem como comportamento do localizador "Remover o processo do(s) localizador(es) informado(s)."',
    'QUEBRA DE FLUXO': 'QUEBRA DE FLUXO = Quando a regra executa Ação Programada, mas não inclui um Localizador de destino diferente do(s) Localizador(es) REMOVER, podendo repetir a ação em novo ciclo e gerar erro.'
  };
  // ============================================================
  // Mini-help (tooltip do filtro "Apenas regras com conflito")
  // ============================================================
  const ATP_MINI_HELP_TIP = [
    'COLISÃO TOTAL = Quando "Prioridade", "Localizador REMOVER", "Tipo de Controle / Critério" e "Outros Critérios" são iguais.',
    '',
    'COLISÃO PARCIAL = Quando "Localizador REMOVER", "Tipo de Controle / Critério" e "Outros Critérios" são iguais, mas a "Prioridade" é diferente.',
    '',
    'SOBREPOSIÇÃO = Quando "Localizador REMOVER" e "Tipo de Controle / Critério" são iguais, mas uma regra mais ampla pode executar antes de outra mais específica.',
    '',
    'POSSÍVEL SOBREPOSIÇÃO = Quando "Localizador REMOVER" e "Tipo de Controle / Critério" são iguais, mas uma regra mais ampla pode executar antes de outra mais específica e as prioridades de execução são idênticas',
    '',
    'PERDA DE OBJETO = Quando uma regra anterior remove o localizador (REMOVER informados) que a regra seguinte precisaria para se aplicar.',
    '',
    'CONTRADIÇÃO = Quando a própria regra contém critérios mutuamente exclusivos no mesmo ramo (conector "E"/AND), tornando-a logicamente impossível (ex.: COM e SEM; APENAS UMA e MAIS DE UMA; estados diferentes do mesmo Dado Complementar).',
    '',
    'QUEBRA DE FLUXO = Quando a regra executa Ação Programada, mas não inclui um Localizador de destino diferente do(s) Localizador(es) REMOVER, podendo repetir a ação em novo ciclo e gerar erro.',
    '',
    'LOOPING = Quando regras se retroalimentam (ciclo), gerando efeito repetido de incluir/remover.',
    '',
    'PRIORIDADE: menor número executa antes. Prioridade null executa por último (após todas as prioridades definidas).'
  ].join('\n');


  function getTipoTooltip(tipo) { // Obtém o tipo tooltip.
    const t = clean(String(tipo || '')).toUpperCase();
    return ATP_TIPOS_TOOLTIPS[t] || '';
  }

  function bindTipoConflitoTooltips(root) { // Executa bind tipo conflito tooltips.
  const scope = root || document;
  const els = Array.from(scope.querySelectorAll('.atp-conf-tipo[data-atp-tipo]'));

  els.forEach(el => {
    if (el.dataset.atpTipBound === '1') return;
    el.dataset.atpTipBound = '1';

    const tipo = (el.getAttribute('data-atp-tipo') || el.textContent || '').trim();
    const base = (getTipoTooltip(tipo) || '').trim();

    // Pode vir "Por quê ... Sugestão: ..." no mesmo campo
    const rawPQ = (el.getAttribute('data-atp-porque') || '').trim();

    // 1) Separa Por quê / Sugestão
    let pqTxt = rawPQ;
    let sugTxt = '';
    if (rawPQ) {
      const parts = rawPQ.split(/(?:\r?\n)?\s*Sugestão:\s*/i);
      pqTxt = (parts[0] || '').trim();
      sugTxt = (parts[1] || '').trim();
    }

    // 2) Monta a mensagem no formato solicitado
    //    Tipo da Colisão:
    //    Por quê:
    //    Sugestão:
    const msg =
      //`Tipo da Colisão:${base || tipo || '(não informado)'}\n\n` +
      `<b>Por quê:</b> ${pqTxt || '(não informado)'}\n\n` +
      `<b>Sugestão:</b> ${sugTxt || '(nenhuma)'}`;

    // Se não há nada útil, não cria tooltip
    if (!base && !rawPQ && !tipo) return;

    el.style.cursor = 'help';

    el.addEventListener('mouseenter', () => {
      try {
        if (typeof window.infraTooltipMostrar === 'function') {
          window.infraTooltipMostrar(msg, 'Tipo de Conflito (ATP)', 680);

          // Força o tooltip do eProc a respeitar quebras de linha (\n)
          setTimeout(() => {
            const tip =
              document.querySelector('#divInfraTooltip') ||
              document.querySelector('.infraTooltip') ||
              document.querySelector('[id*="Tooltip"]') ||
              document.querySelector('[class*="Tooltip"]');

            if (tip) tip.style.whiteSpace = 'pre-wrap';
          }, 0);
        } else {
          // fallback: tooltip nativo (respeita \n em muitos browsers)
          el.setAttribute('title', msg);
        }
      } catch {}
    });

    el.addEventListener('mouseleave', () => {
      try {
        if (typeof window.infraTooltipOcultar === 'function') window.infraTooltipOcultar();
      } catch {}
    });
  });
}


  function getOutrosCanonical(rule) { // Canonical "Outros Critérios" (prioriza struct {canonical}).
    const oc = rule?.outrosCriterios;
    if (oc && typeof oc === 'object' && 'canonical' in oc) return clean(oc.canonical || '');
    if (typeof oc === 'string') return clean(oc);
    return '';
  }


  function detectContradictions(rule) { // Detecta contradições internas (self) em Outros Critérios, baseadas nos selects do front-end.
    const oc = rule?.outrosCriterios;
    const groups = oc?.groups || [];
    const motivos = [];

    // Helpers
    const norm = (s) => clean(String(s || '')).toLowerCase(); // Executa norm.
    const add = (msg) => { if (msg && !motivos.includes(msg)) motivos.push(msg); }; // Executa add.

    // Detecta contradição dentro de um "ramo" (clause) — ou seja, termos ligados por AND.
    const analyzeClause = (terms, contextLabel) => { // Executa analyze clause.
      // Map key -> array de values
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

      // ---------- 1) Dado Complementar do Processo (compSelIdDadoComplementarProcesso)
      // Formato de valor no front: "<Grupo>-<Estado>" (ex.: "Justiça Gratuita-Deferida")
      // Regra: dentro do mesmo ramo AND, não pode haver 2+ estados para o mesmo Grupo.
      for (const [k, vals] of kv.entries()) {
        if (k !== 'dadocomplementardoprocesso') continue;
        const byGrupo = new Map(); // grupo -> Set(estados)
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

      // ---------- 2) Prazo múltiplo (selPrazoMultiplo)
      // Contradições tratadas:
      // - Geral: "COM prazo aberto/ag. abertura" vs "SEM prazo aberto/ag. abertura"
      // - Por escopo: PASSIVO/ATIVO/ENTIDADES/PERITOS/UNIDADES EXTERNAS/APS (aberto/ag. abertura)
      // Observação: não marcamos aberto vs fechado (pode coexistir em tese).
      for (const [k, vals] of kv.entries()) {
        if (k !== 'prazomultiplo' && k !== 'prazo') continue;
        const bucket = new Map(); // assinatura -> Set(COM|SEM)
        for (const v of vals) {
          const txtv = clean(v);
          let m = txtv.match(/^Processos\s+(COM|SEM)\s+prazo\s+aberto\/ag\.\s*abertura(\s+.*)?$/i);
          if (m) {
            const pol = m[1].toUpperCase();
            const scope = clean(m[2] || '').toUpperCase(); // "", "DO PÓLO PASSIVO", etc
            const sig = `ABERTO${scope ? ' ' + scope : ''}`;
            if (!bucket.has(sig)) bucket.set(sig, new Set());
            bucket.get(sig).add(pol);
            continue;
          }
          // Alguns textos vêm como "Processos COM prazo aberto/ag. abertura DO PÓLO PASSIVO" (sem espaço extra)
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

      // ---------- 3) Litisconsórcio (compSelTipoLitisconsorcio)
      // "APENAS UMA parte" vs "MAIS DE UMA parte" no mesmo polo.
      for (const [k, vals] of kv.entries()) {
        if (k !== 'litisconsorcio') continue;
        const polMap = new Map(); // PASSIVO|ATIVO -> Set(UMA|MAIS)
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

      // ---------- 4) Representação Processual (compSelTipoRepresentacaoProcessual)
      // "COM procurador/advogado" vs "SEM procurador/advogado" no mesmo polo.
      for (const [k, vals] of kv.entries()) {
        if (k !== 'representacaoprocessualdaspartes') continue;
        const polMap = new Map(); // PASSIVO|ATIVO -> Set(COM|SEM)
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

    // Varre grupos/cláusulas (cada Set é um ramo AND)
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

function relationOutros(ruleA, ruleB) { // Compara "Outros Critérios" considerando AND entre grupos (ml-0 pt-2).
  // Retorno:
  // - 'identicos'      => mesmos grupos (independente da ordem)
  // - 'A_mais_ampla'   => A é mais ampla (menos ou igual restrições) e B tem restrições a mais
  // - 'B_mais_ampla'   => B é mais ampla
  // - 'diferentes'     => não comparável com segurança (grupos distintos sem relação de subconjunto)
  const ocA = ruleA?.outrosCriterios;
  const ocB = ruleB?.outrosCriterios;

  const groupsCanon = (oc) => { // Executa groups canon.
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

  // Sem "Outros" => mais amplo (menos restrições)
  if (!a.length && !b.length) return 'identicos';
  if (!a.length && b.length)  return 'A_mais_ampla';
  if (a.length && !b.length)  return 'B_mais_ampla';

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

  // ==============================
  // REMOVER: "remove ou não remove?"
  // ==============================

  // ==============================
  // Parser: extrai regras da tabela
  // ==============================

  // ======================================================================
  // CAPTURA DAS REGRAS DA TABELA (HTML -> objetos)
  // ======================================================================



try { console.log('[ATP][OK] 02_dom_and_style.js inicializado'); } catch (e) {}
