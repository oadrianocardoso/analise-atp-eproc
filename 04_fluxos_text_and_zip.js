try { console.log('[ATP][LOAD] 04_fluxos_text_and_zip.js carregado com sucesso'); } catch (e) {}
/**
 * ATP MODULAR - 04_fluxos_text_and_zip.js
 * Extraído de ATP-versao estavel com bpmno.js
 */

function atpBuildFluxosText(rules) { // Constrói fluxos text.
  try {
    // 1) Indexa regras por origem (cláusula REMOVER)
    const byFrom = new Map(); // fromKey -> array<{rule, toKeys}>
    const allFrom = new Set();
    const allTo = new Set();

    for (const r of (rules || [])) {
      const fromKeys = atpClausesToKeys(r.localizadorRemover);
      const toKeys   = atpClausesToKeys(r.localizadorIncluirAcao);
      for (const fk of fromKeys) {
        allFrom.add(fk);
        if (!byFrom.has(fk)) byFrom.set(fk, []);
        byFrom.get(fk).push({ rule: r, toKeys });
      }
      for (const tk of toKeys) allTo.add(tk);
    }
  const startKeys = Array.from(allFrom).filter(k => !allTo.has(k)).sort((a,b)=>a.localeCompare(b));
  const allKeys = Array.from(allFrom).sort((a,b)=>a.localeCompare(b));

    // 2) Agrupa em fluxos (componentes alcançáveis a partir de cada início)
    const assigned = new Set();
    const fluxos = [];

    function expandFrom(seed) { // Executa expand from.
      const q = [seed];
      const seen = new Set([seed]);
      while (q.length) {
        const k = q.shift();
        const outs = byFrom.get(k) || [];
        for (const item of outs) {
          for (const tk of (item.toKeys || [])) {
            if (!tk) continue;
            if (!seen.has(tk) && allFrom.has(tk)) { // só expande para nós que são origens também
              seen.add(tk);
              q.push(tk);
            }
          }
        }
      }
      return seen;
    }

    // 2a) Fluxos a partir de startKeys
    for (const sk of (startKeys.length ? startKeys : allKeys)) {
      if (assigned.has(sk)) continue;
      const comp = expandFrom(sk);
      for (const n of comp) assigned.add(n);
      fluxos.push({ starts: [sk], nodes: Array.from(comp).sort((a,b)=>a.localeCompare(b)) });
    }

    // 2b) Sobras (ciclos puros onde ninguém é "start")
    for (const k of allKeys) {
      if (assigned.has(k)) continue;
      const comp = expandFrom(k);
      for (const n of comp) assigned.add(n);
      fluxos.push({ starts: [k], nodes: Array.from(comp).sort((a,b)=>a.localeCompare(b)) });
    }

    // 3) Renderiza texto (pseudo-código por localizador)
    const lines = [];
    lines.push('Extrato de Fluxos Detectados (ATP / eProc)');
    lines.push('Data/Hora: ' + new Date().toLocaleString());
    lines.push('Total de fluxos: ' + fluxos.length);
    lines.push('');

    fluxos.forEach((fl, idxF) => {
      const title = `FLUXO ${String(idxF+1).padStart(2,'0')} — Início(s): [${fl.starts.join(' | ')}]`;
      lines.push(title);
      lines.push('-'.repeat(Math.min(120, title.length)));
      lines.push('');

      // edges map para SCC
      const edges = new Map();
      for (const n of fl.nodes) {
        const outs = [];
        const items = byFrom.get(n) || [];
        for (const it of items) {
          for (const tk of (it.toKeys || [])) if (fl.nodes.includes(tk)) outs.push(tk);
        }
        edges.set(n, Array.from(new Set(outs)));
      }
      const comps = atpTarjanSCC(fl.nodes, edges)
        .filter(comp => comp.length > 1 || ((edges.get(comp[0])||[]).includes(comp[0])));

      const endNodes = fl.nodes.filter(n => !(byFrom.get(n)||[]).length || !(edges.get(n)||[]).some(tk => fl.nodes.includes(tk)));

      // Caminhos completos (continua a partir do destino, até não haver continuação)
      function flowIndent(level) { // Executa flow indent.
        // Indentação por blocos (apenas espaços), para leitura leiga.
        // Cada nível = 2 espaços.
        return '  '.repeat(Math.max(0, level|0));
      }

      function flowCondText(r) { // Executa flow cond text.
        const cond = clean((r.tipoControleCriterio && r.tipoControleCriterio.canonical) || r.tipoControleCriterio || r.tipoControle || '');
        const outrosHuman = atpHumanizeOutrosCriteriosExpr(r && r.outrosCriterios);
        const parts = [];
        if (cond) parts.push(cond);
        if (outrosHuman) parts.push('Outros Critérios: ' + outrosHuman);
        return parts.length ? parts.join(' E ') : 'condições configuradas';
      }

      function flowPrintActions(lines, r, detailIndent) { // Executa flow print actions.
        const arr = (r.localizadorIncluirAcao && r.localizadorIncluirAcao.acoes) ? r.localizadorIncluirAcao.acoes : [];
        if (!arr || !arr.length) return;

        // detailIndent já aponta para o nível dos itens "- REMOVER/- INCLUIR"
        lines.push(`${detailIndent}- AÇÕES:`);
        for (const a of arr) {
          const etapa = clean(a.etapa || '');
          const acao  = clean(a.acao  || '');
          lines.push(`${detailIndent}    • ${acao || 'AÇÃO'}`);
          if (etapa) lines.push(`${detailIndent}      - Etapa: ${etapa}`);
          const vars = a.vars || a.variaveis || [];
          if (Array.isArray(vars) && vars.length) {
            for (const v of vars) {
              const nn = clean(v.nome || v.key || '');
              const vv = clean(v.valor || v.value || '');
              if (nn || vv) lines.push(`${detailIndent}      - ${nn || 'Variável'}: ${vv}`);
            }
          }
        }
      }

      function dfsFlowFrom(nodeKey, level, pathSet) { // Executa dfs fluxo from.
        const ind = flowIndent(level);              // nível do LOCALIZADOR
        const indSE = ind + '  ';                   // nível do SE (dentro do LOCALIZADOR)
        const indTHEN = indSE + '  ';               // nível do ENTÃO (dentro do SE)
        const indDet = indTHEN + '  ';              // nível dos detalhes "- REMOVER/- INCLUIR" (dentro do ENTÃO)
        const indDet2 = indDet + '  ';              // nível do detalhe extra (mensagens/alertas)

        lines.push(`${ind}LOCALIZADOR: ${nodeKey}`);

        const itemsRaw = (byFrom.get(nodeKey) || []);
        if (!itemsRaw.length) {
          lines.push(`${indSE}FIM: (Sem regras de saída detectadas para este localizador)`);
          lines.push('');
          return;
        }

        // Ordena por número de regra (estável)
        const items = itemsRaw.slice().sort((a,b)=> (a.rule?.num||0) - (b.rule?.num||0));

        // Marca no caminho atual (para ciclos)
        const nextPath = new Set(pathSet);
        nextPath.add(nodeKey);

        for (const it of items) {
          const r = it.rule;

          lines.push(`${indSE}SE (${flowCondText(r)})`);
          lines.push(`${indTHEN}ENTÃO aplicar REGRA ${r.num}:`);
          lines.push(`${indDet}- REMOVER: ${(r.localizadorRemover && r.localizadorRemover.canonical) ? r.localizadorRemover.canonical : '(vazio)'}`);
          lines.push(`${indDet}- INCLUIR: ${(r.localizadorIncluirAcao && r.localizadorIncluirAcao.canonical) ? r.localizadorIncluirAcao.canonical : '(vazio)'}`);

          // Ações (array)
          flowPrintActions(lines, r, indDet);

          const destAll = (it.toKeys || []).filter(Boolean);
          const destsLabel = destAll.length ? destAll.join(' | ') : '(nenhum)';
          lines.push(`${indDet}- VAI PARA: [${destsLabel}]`);
          lines.push('');

          // Expande (continua o fluxo) para cada destino que também é nó do fluxo
          const destExpand = destAll.filter(tk => fl.nodes.includes(tk) && (byFrom.get(tk) || []).length);

          if (!destExpand.length) continue;

          for (const dk of destExpand) {
            if (nextPath.has(dk)) {
              // ciclo no ramo atual
              lines.push(`${indDet2}ALERTA: CICLO detectado (voltou para "${dk}")`);
              lines.push('');
              continue;
            }
            dfsFlowFrom(dk, level + 3, nextPath);
          }
        }

        lines.push('');
      }

      // Para cada início, imprime o fluxo completo encadeado
      for (const sk of fl.starts) {
        dfsFlowFrom(sk, 0, new Set());
      }
if (endNodes.length) {
        lines.push('FINS DETECTADOS (sem continuação dentro deste fluxo):');
        for (const e of endNodes) lines.push('  - ' + e);
        lines.push('');
      }

      if (comps.length) {
        lines.push('CICLOS DETECTADOS:');
        comps.forEach((c, i) => lines.push('  - Ciclo ' + (i+1) + ': {' + c.sort((a,b)=>a.localeCompare(b)).join(' | ') + '}'));
        lines.push('');
      }

      lines.push('');
      lines.push('='.repeat(90));
      lines.push('');
    });

    return lines.join('\n');
  } catch (e) {
    return 'Falha ao gerar extrato de fluxos: ' + String(e && e.message ? e.message : e);
  }
}

// ============================================================
// Extrato de Fluxos: Exportação BPMN 2.0 (Bizagi Modeler)
// ============================================================

// =========================================================
// Opção B (teste): Vista agrupada por Fluxo (headers colapsáveis)
// - Implementação "safe": não altera a tabela original (evita DataTables / colunas).
// - Ao ativar, a tabela original é ocultada e renderizamos uma visão agrupada (clonando linhas).
// =========================================================
function atpComputeFluxosData(rules) { // Executa compute fluxos dados.
  const allFrom = new Set();
  const allTo = new Set();
  const byFrom = new Map(); // fromKey -> [{rule, toKeys}]
  const fluxos = [];
  const assigned = new Set();

  for (const r of (rules || [])) {
    const fromKeys = atpClausesToKeys(r.localizadorRemover);
    const toKeys   = atpClausesToKeys(r.localizadorIncluirAcao);
    for (const fk of fromKeys) {
      allFrom.add(fk);
      if (!byFrom.has(fk)) byFrom.set(fk, []);
      byFrom.get(fk).push({ rule: r, toKeys });
    }
    for (const tk of toKeys) allTo.add(tk);
  }

  // ------------------------------------------------------------
  // Continuidade implícita por refinamento AND (E/&&)
  // Regra: se existe REMOVER "A && B" e existe algum ponto que INCLUI "A" (mesmo que não exista REMOVER "A" isolado),
  // então "A" NÃO deve ser tratado como fim e "A && B" NÃO deve ser tratado como início.
  // Implementação: criamos arestas implícitas A -> (A && B) e promovemos A a nó de origem virtual quando necessário.
  // ------------------------------------------------------------
  // materializa arestas implícitas base -> refinado
  const __fromKeysSnapshot = Array.from(allFrom);
  for (const child of __fromKeysSnapshot) {
    if (String(child).indexOf('&&') === -1) continue;
    const base = __atpPickBestBaseKey(child, allFrom, allTo);
    if (!base || base === child) continue;

    // promove base a nó de origem virtual (para que expandFrom consiga caminhar)
    if (!allFrom.has(base)) allFrom.add(base);
    if (!byFrom.has(base)) byFrom.set(base, []);

    // adiciona aresta implícita base -> child (sem regra real)
    const arr = byFrom.get(base);
    const exists = arr.some(it => (it && it.__implied && it.toKeys && it.toKeys.includes(child)));
    if (!exists) {
      arr.push({ rule: null, toKeys: [child], __implied: true, __label: 'REFINAMENTO (E/&&)' });
    }

    // marca child como "destino" para que não vire startKey
    allTo.add(child);
  }

  const startKeys = Array.from(allFrom).filter(k => !allTo.has(k)).sort((a,b)=>a.localeCompare(b));
  const allKeys = Array.from(allFrom).sort((a,b)=>a.localeCompare(b));

  function expandFrom(start) { // Executa expand from.
    const q = [start];
    const seen = new Set([start]);
    while (q.length) {
      const cur = q.shift();
      const outs = byFrom.get(cur) || [];
      for (const item of outs) {
        for (const tk of (item.toKeys || [])) {
          if (!tk) continue;
          if (!seen.has(tk) && allFrom.has(tk)) { // só expande para nós que são origens também
            seen.add(tk);
            q.push(tk);
          }
        }
      }
    }
    return seen;
  }

  // Fluxos a partir de startKeys; se não houver start, usa allKeys como "sementes".
  for (const sk of ((startKeys.length ? startKeys : allKeys))) {
    if (assigned.has(sk)) continue;
    const comp = expandFrom(sk);
    for (const n of comp) assigned.add(n);
    fluxos.push({ starts: [sk], nodes: Array.from(comp).sort((a,b)=>a.localeCompare(b)) });
  }

  // Sobras (ciclos puros onde ninguém é "start")
  for (const k of allKeys) {
    if (assigned.has(k)) continue;
    const comp = expandFrom(k);
    for (const n of comp) assigned.add(n);
    fluxos.push({ starts: [k], nodes: Array.from(comp).sort((a,b)=>a.localeCompare(b)) });
  }

  // Map rápido: nodeKey -> flowId
  const keyToFlow = new Map();
  fluxos.forEach((fl, i) => {
    for (const n of (fl.nodes || [])) keyToFlow.set(n, i);
  });

  return { fluxos, keyToFlow, byFrom, startKeys, allFrom, allTo };
}




try { console.log('[ATP][OK] 04_fluxos_text_and_zip.js inicializado'); } catch (e) {}
