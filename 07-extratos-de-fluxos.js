try { console.log('[ATP][LOAD] 07-extratos-de-fluxos.js carregado com sucesso'); } catch (e) {}

function atpBuildFluxosText(rules) {

  try {

    let data = null;

    if (window.ATP && window.ATP.extract && typeof window.ATP.extract.getFluxosData === 'function') {
      data = window.ATP.extract.getFluxosData(rules || []);
    }

    if (!data && window.ATP && window.ATP.fluxosData && typeof window.ATP.fluxosData === 'object') {
      data = window.ATP.fluxosData;
    }

    if (!data && typeof atpComputeFluxosData === 'function') {
      data = atpComputeFluxosData(rules || []);
    }

    const fluxos = Array.isArray(data) ? data : (data && Array.isArray(data.fluxos) ? data.fluxos : []);

    if (!fluxos || !fluxos.length) {

      if (typeof atpBuildFluxosText_LEGACY === 'function') return atpBuildFluxosText_LEGACY(rules);
      return "Nenhum fluxo encontrado.\n";
    }

    const byFrom = (data && data.byFrom instanceof Map) ? data.byFrom : null;
    if (!byFrom) {
      if (typeof atpBuildFluxosText_LEGACY === 'function') return atpBuildFluxosText_LEGACY(rules);
      return 'Nenhum fluxo encontrado.\n';
    }

    return atpRenderFluxosTextDetailed(fluxos, byFrom);
  } catch (e) {
    console.warn('[ATP][TXT] Falha ao gerar fluxos canônicos:', e);
    if (typeof atpBuildFluxosText_LEGACY === 'function') return atpBuildFluxosText_LEGACY(rules);
    return "Falha ao gerar fluxos em texto.\n";
  }
}

function atpRenderFluxosTextDetailed(fluxos, byFrom) {
  try {
    const lines = [];
    lines.push('Extrato de Fluxos Detectados (ATP / eProc)');
    lines.push('Data/Hora: ' + new Date().toLocaleString());
    lines.push('Total de fluxos: ' + String((fluxos || []).length));
    lines.push('');

    function flowIndent(level) { return '  '.repeat(Math.max(0, level | 0)); }

    function flowCondText(r) {
      const cond = clean((r && r.tipoControleCriterio && r.tipoControleCriterio.canonical) || (r && r.tipoControleCriterio) || (r && r.tipoControle) || '');
      const outrosHuman = atpHumanizeOutrosCriteriosExpr(r && r.outrosCriterios);
      const parts = [];
      if (cond) parts.push(cond);
      if (outrosHuman) parts.push('Outros Critérios: ' + outrosHuman);
      return parts.length ? parts.join(' E ') : 'condições configuradas';
    }

    function flowPrintActions(linesRef, r, detailIndent) {
      const arr = (r && r.localizadorIncluirAcao && r.localizadorIncluirAcao.acoes) ? r.localizadorIncluirAcao.acoes : [];
      if (!arr || !arr.length) return;
      linesRef.push(`${detailIndent}- AÇÕES:`);
      for (const a of arr) {
        const etapa = clean(a && a.etapa || '');
        const acao  = clean(a && a.acao  || '');
        linesRef.push(`${detailIndent}    • ${acao || 'AÇÃO'}`);
        if (etapa) linesRef.push(`${detailIndent}      - Etapa: ${etapa}`);
        const vars = (a && (a.vars || a.variaveis)) || [];
        if (Array.isArray(vars) && vars.length) {
          for (const v of vars) {
            const nn = clean((v && (v.nome || v.key)) || '');
            const vv = clean((v && (v.valor || v.value)) || '');
            if (nn || vv) linesRef.push(`${detailIndent}      - ${nn || 'Variável'}: ${vv}`);
          }
        }
      }
    }

    (fluxos || []).forEach((fl, idxF) => {
      const startsArr = (fl && fl.starts && fl.starts.length) ? fl.starts : ((fl && fl.startKeys) || []);
      const nodesArr = Array.isArray(fl && fl.nodes) ? fl.nodes : (Array.isArray(fl && fl.nodeIds) ? fl.nodeIds : []);

      const title = `FLUXO ${String(idxF + 1).padStart(2, '0')} — Início(s): [${(startsArr || []).join(' | ')}]`;
      lines.push(title);
      lines.push('-'.repeat(120));
      lines.push('');

      function dfsFlowFrom(nodeKey, level, pathSet) {
        const indL = flowIndent(level);
        const indSE = flowIndent(level + 1);
        const indTHEN = flowIndent(level + 2);
        const indDet = flowIndent(level + 3);
        const indDet2 = flowIndent(level + 3);

        lines.push(`${indL}LOCALIZADOR: ${nodeKey}`);

        const itemsRaw = (byFrom.get(nodeKey) || []).filter(Boolean);
        const items = itemsRaw.slice().sort((a, b) => ((a && a.rule && a.rule.num) || 0) - ((b && b.rule && b.rule.num) || 0));

        const nextPath = new Set(pathSet);
        nextPath.add(nodeKey);

        for (const it of items) {
          const r = it.rule;
          if (!r) continue;

          lines.push(`${indSE}SE (${flowCondText(r)})`);
          lines.push(`${indTHEN}ENTÃO aplicar REGRA ${r.num}:`);
          lines.push(`${indDet}- REMOVER: ${(r.localizadorRemover && r.localizadorRemover.canonical) ? r.localizadorRemover.canonical : '(vazio)'}`);
          lines.push(`${indDet}- INCLUIR: ${(r.localizadorIncluirAcao && r.localizadorIncluirAcao.canonical) ? r.localizadorIncluirAcao.canonical : '(vazio)'}`);
          flowPrintActions(lines, r, indDet);

          const destAll = (it.toKeys || []).filter(Boolean);
          const destsLabel = destAll.length ? destAll.join(' | ') : '(nenhum)';
          lines.push(`${indDet}- VAI PARA: [${destsLabel}]`);
          lines.push('');

          const destExpand = destAll.filter(tk => nodesArr.includes(tk) && (byFrom.get(tk) || []).some(x => x && x.rule));
          if (!destExpand.length) continue;

          for (const dk of destExpand) {
            if (nextPath.has(dk)) {
              lines.push(`${indDet2}ALERTA: CICLO detectado (voltou para "${dk}")`);
              lines.push('');
              continue;
            }
            dfsFlowFrom(dk, level + 3, nextPath);
          }
        }

        lines.push('');
      }

      for (const sk of (startsArr && startsArr.length ? startsArr : [])) {
        dfsFlowFrom(sk, 0, new Set());
      }

      lines.push('');
    });

    return lines.join('\n') + '\n';
  } catch (e) {
    return 'Falha ao gerar extrato de fluxos: ' + String(e && e.message ? e.message : e);
  }
}

function atpBuildFluxosText_LEGACY(rules) {
  try {

    const byFrom = new Map();
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

    const assigned = new Set();
    const fluxos = [];

    function expandFrom(seed) {
      const q = [seed];
      const seen = new Set([seed]);
      while (q.length) {
        const k = q.shift();
        const outs = byFrom.get(k) || [];
        for (const item of outs) {
          for (const tk of (item.toKeys || [])) {
            if (!tk) continue;
            if (!seen.has(tk) && allFrom.has(tk)) {
              seen.add(tk);
              q.push(tk);
            }
          }
        }
      }
      return seen;
    }

    for (const sk of (startKeys.length ? startKeys : allKeys)) {
      if (assigned.has(sk)) continue;
      const comp = expandFrom(sk);
      for (const n of comp) assigned.add(n);
      fluxos.push({ starts: [sk], nodes: Array.from(comp).sort((a,b)=>a.localeCompare(b)) });
    }

    for (const k of allKeys) {
      if (assigned.has(k)) continue;
      const comp = expandFrom(k);
      for (const n of comp) assigned.add(n);
      fluxos.push({ starts: [k], nodes: Array.from(comp).sort((a,b)=>a.localeCompare(b)) });
    }

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

      function flowIndent(level) {

        return '  '.repeat(Math.max(0, level|0));
      }

      function flowCondText(r) {
        const cond = clean((r.tipoControleCriterio && r.tipoControleCriterio.canonical) || r.tipoControleCriterio || r.tipoControle || '');
        const outrosHuman = atpHumanizeOutrosCriteriosExpr(r && r.outrosCriterios);
        const parts = [];
        if (cond) parts.push(cond);
        if (outrosHuman) parts.push('Outros Critérios: ' + outrosHuman);
        return parts.length ? parts.join(' E ') : 'condições configuradas';
      }

      function flowPrintActions(lines, r, detailIndent) {
        const arr = (r.localizadorIncluirAcao && r.localizadorIncluirAcao.acoes) ? r.localizadorIncluirAcao.acoes : [];
        if (!arr || !arr.length) return;

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

      function dfsFlowFrom(nodeKey, level, pathSet) {
        const ind = flowIndent(level);
        const indSE = ind + '  ';
        const indTHEN = indSE + '  ';
        const indDet = indTHEN + '  ';
        const indDet2 = indDet + '  ';

        lines.push(`${ind}LOCALIZADOR: ${nodeKey}`);

        const itemsRaw = (byFrom.get(nodeKey) || []);
        if (!itemsRaw.length) {
          lines.push(`${indSE}FIM: (Sem regras de saída detectadas para este localizador)`);
          lines.push('');
          return;
        }

        const items = itemsRaw.slice().sort((a,b)=> (a.rule?.num||0) - (b.rule?.num||0));

        const nextPath = new Set(pathSet);
        nextPath.add(nodeKey);

        for (const it of items) {
          const r = it.rule;

          lines.push(`${indSE}SE (${flowCondText(r)})`);
          lines.push(`${indTHEN}ENTÃO aplicar REGRA ${r.num}:`);
          lines.push(`${indDet}- REMOVER: ${(r.localizadorRemover && r.localizadorRemover.canonical) ? r.localizadorRemover.canonical : '(vazio)'}`);
          lines.push(`${indDet}- INCLUIR: ${(r.localizadorIncluirAcao && r.localizadorIncluirAcao.canonical) ? r.localizadorIncluirAcao.canonical : '(vazio)'}`);

          flowPrintActions(lines, r, indDet);

          const destAll = (it.toKeys || []).filter(Boolean);
          const destsLabel = destAll.length ? destAll.join(' | ') : '(nenhum)';
          lines.push(`${indDet}- VAI PARA: [${destsLabel}]`);
          lines.push('');

          const destExpand = destAll.filter(tk => fl.nodes.includes(tk) && (byFrom.get(tk) || []).length);

          if (!destExpand.length) continue;

          for (const dk of destExpand) {
            if (nextPath.has(dk)) {

              lines.push(`${indDet2}ALERTA: CICLO detectado (voltou para "${dk}")`);
              lines.push('');
              continue;
            }
            dfsFlowFrom(dk, level + 3, nextPath);
          }
        }

        lines.push('');
      }

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

function atpComputeFluxosData(rules) {
  const allFrom = new Set();
  const allTo = new Set();
  const byFrom = new Map();
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

  const __fromKeysSnapshot = Array.from(allFrom);
  for (const child of __fromKeysSnapshot) {
    if (String(child).indexOf('&&') === -1) continue;
    const base = __atpPickBestBaseKey(child, allFrom, allTo);
    if (!base || base === child) continue;

    if (!allFrom.has(base)) allFrom.add(base);
    if (!byFrom.has(base)) byFrom.set(base, []);

    const arr = byFrom.get(base);
    const exists = arr.some(it => (it && it.__implied && it.toKeys && it.toKeys.includes(child)));
    if (!exists) {
      arr.push({ rule: null, toKeys: [child], __implied: true, __label: 'REFINAMENTO (E/&&)' });
    }

    allTo.add(child);
  }

  const startKeys = Array.from(allFrom).filter(k => !allTo.has(k)).sort((a,b)=>a.localeCompare(b));
  const allKeys = Array.from(allFrom).sort((a,b)=>a.localeCompare(b));

  function expandFrom(start) {
    const q = [start];
    const seen = new Set([start]);
    while (q.length) {
      const cur = q.shift();
      const outs = byFrom.get(cur) || [];
      for (const item of outs) {
        for (const tk of (item.toKeys || [])) {
          if (!tk) continue;
          // Continua fluxo somente quando INCLUIR reaparece como REMOVER.
          if (!seen.has(tk) && allFrom.has(tk)) {
            seen.add(tk);
            q.push(tk);
          }
        }
      }
    }
    return seen;
  }

  // Fluxo por início (REMOVER que não está em nenhum INCLUIR).
  for (const sk of ((startKeys.length ? startKeys : allKeys))) {
    if (assigned.has(sk)) continue;
    const comp = expandFrom(sk);
    for (const n of comp) assigned.add(n);
    fluxos.push({ starts: [sk], nodes: Array.from(comp).sort((a,b)=>a.localeCompare(b)) });
  }

  // Completa nós restantes para ciclos/ilhas sem início explícito.
  for (const k of allKeys) {
    if (assigned.has(k)) continue;
    const comp = expandFrom(k);
    for (const n of comp) assigned.add(n);
    fluxos.push({ starts: [k], nodes: Array.from(comp).sort((a,b)=>a.localeCompare(b)) });
  }

  // Acrescenta nós terminais (INCLUIR que não vira REMOVER) no fluxo em que aparecem.
  for (const fl of fluxos) {
    const full = new Set(fl.nodes || []);
    for (const u of (fl.nodes || [])) {
      const outs = byFrom.get(u) || [];
      for (const it of outs) {
        for (const tk of (it && it.toKeys ? it.toKeys : [])) {
          if (!tk) continue;
          if (!full.has(tk) && !allFrom.has(tk)) full.add(tk);
        }
      }
    }
    fl.nodes = Array.from(full).sort((a, b) => String(a).localeCompare(String(b)));
  }

  const keyToFlow = new Map();
  fluxos.forEach((fl, i) => {
    for (const n of (fl.nodes || [])) {
      // Em sobreposição, preserva o primeiro fluxo detectado (mais estável para UI).
      if (!keyToFlow.has(n)) keyToFlow.set(n, i);
    }
  });

  return { fluxos, keyToFlow, byFrom, startKeys, allFrom, allTo };
}

try { console.log('[ATP][OK] 07-extratos-de-fluxos.js inicializado'); } catch (e) {}
;
