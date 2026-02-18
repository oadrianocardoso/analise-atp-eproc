try { console.log('[ATP][LOAD] 06-analisador-de-colisoes.js carregado com sucesso'); } catch (e) {}

  function parseRules(table, cols) {
    const list = [];
    const tbodys = table.tBodies?.length ? Array.from(table.tBodies) : [table.querySelector("tbody")].filter(Boolean);
    const rows = tbodys.flatMap(tb => Array.from(tb.rows));

    for (const tr of rows) {
      const tds = Array.from(tr.querySelectorAll(':scope > td'));
      if (!tds.length) continue;

      delete tr.dataset.atpInactive;
      const tdAcoes = tds.find(td => td.querySelector('input.custom-control-input')) || null;
      const chkAtiva = tdAcoes?.querySelector('input.custom-control-input') || null;
      const ativa = chkAtiva ? !!chkAtiva.checked : true;
      if (chkAtiva && !ativa) {
        tr.dataset.atpInactive = "1";
        tr.style.display = "none";
        continue;
      }

      const tdNumPrior = tds[cols.colNumPrior] || tds[1];
      const tdRemover  = tds[cols.colRemover]  || tds[3];
      const tdTipo     = tds[cols.colTipo]     || tds[4];
      const tdIncluir  = tds[cols.colIncluir]  || tds[5];
      const tdOutros   = tds[cols.colOutros]   || tds[6];

      const num = extrairNumeroRegra(tdNumPrior);
      if (!num) continue;

      const prioridadeTexto = extrairPrioridade(tdNumPrior);
      const prioridade = parsePriority(prioridadeTexto);

      const outrosCriterios = extrairOutrosCriterios(tdOutros);

      const localizadorRemover = extrairOrigemRemoverExpr(tdRemover);

      const removerWildcard = !!(tdRemover && tdRemover.dataset && tdRemover.dataset.atpRemoverWildcard === '1');

      const comportamentoRemover = extrairComportamentoRemover(tdRemover);

      const localizadorIncluirAcao = extrairLocalizadorIncluirAcao(tdIncluir);

      const tipoControleCriterio = extrairTipoControleCriterio(tdTipo);

      list.push({
        num,
        prioridade,
        localizadorRemover,

        removerWildcard,
        comportamentoRemover,

        localizadorIncluirAcao,

        tipoControleCriterio,

        outrosCriterios,
        ativa,
        tr
      });
    }

    return list;
  }

  function analyze(rules) {
    const conflictsByRule = new Map();

    const ensureBucket = (baseNum) => {
      if (!conflictsByRule.has(baseNum)) conflictsByRule.set(baseNum, new Map());
      return conflictsByRule.get(baseNum);
    };

    const upsert = (baseNum, otherNum, tipo, impacto, motivo) => {
      const bucket = ensureBucket(baseNum);
      const rec = bucket.get(otherNum) || { tipos: new Set(), impactoMax: 'Baixo', motivos: new Set(), motivosByTipo: new Map() };
      rec.tipos.add(tipo);
      if ((impactoRank[impacto] || 0) > (impactoRank[rec.impactoMax] || 0)) rec.impactoMax = impacto;
      if (motivo) {
        rec.motivos.add(motivo);
        if (!rec.motivosByTipo) rec.motivosByTipo = new Map();
        const set = rec.motivosByTipo.get(tipo) || new Set();
        set.add(motivo);
        rec.motivosByTipo.set(tipo, set);
      }
      bucket.set(otherNum, rec);
    };

    const prioKey = (r) => {
      const n = r?.prioridade?.num;
      if (Number.isFinite(n)) return `N:${n}`;
      const raw = clean(r?.prioridade?.raw || r?.prioridade?.text || '');
      return `T:${raw}`;
    };

    const prioEq = (a, b) => prioKey(a) === prioKey(b);
    const prioNum = (r) => (Number.isFinite(r?.prioridade?.num) ? r.prioridade.num : null);
    const prioLabel = (r) => {
      const n = prioNum(r);
      if (n != null) return `${n}ª`;
      const txt = clean(r?.prioridade?.text || r?.prioridade?.raw || '');
      return txt || '[*]';
    };

    const execOrder = (r) => {
      const n = prioNum(r);
      return (n == null) ? Number.POSITIVE_INFINITY : n;
    };

    const ruleNumVal = (r) => {
      const n = Number(r && r.num);
      return Number.isFinite(n) ? n : (parseInt(String(r && r.num || ''), 10) || 0);
    };

    const pickKeepDropTotal = (A, B) => {
      const aN = ruleNumVal(A), bN = ruleNumVal(B);
      const keep = (aN <= bN) ? A : B;
      const drop = (aN <= bN) ? B : A;
      return { keep, drop, reason: 'duplicada (colisão total)' };
    };

    const pickKeepDropParcial = (A, B) => {
      const oa = execOrder(A), ob = execOrder(B);
      let keep = A, drop = B;

      if (oa !== ob) {
        keep = (oa < ob) ? A : B;
        drop = (oa < ob) ? B : A;
      } else {

        const aN = ruleNumVal(A), bN = ruleNumVal(B);
        keep = (aN <= bN) ? A : B;
        drop = (aN <= bN) ? B : A;
      }
      return { keep, drop, reason: 'redundante (colisão parcial)' };
    };

    const normMsg = (s) => rmAcc(clean(s)).toLowerCase();
    const MSG_PERDA_OBJETO = normMsg('Remover o processo do(s) localizador(es) informado(s).');

    const exprTermsUnion = (expr) => {
      const out = new Set();
      const clauses = Array.isArray(expr?.clauses) ? expr.clauses : [];
      for (const set of clauses) {
        if (!(set instanceof Set)) continue;
        for (const t of set) {
          const tt = clean(t);
          if (!tt) continue;
          if (tt === '[*]') continue;
          if (tt === 'E' || tt === 'OU') continue;
          out.add(tt);
        }
      }
      return out;
    };

    const hasIntersection = (aSet, bSet) => {
      if (!aSet || !bSet || !aSet.size || !bSet.size) return false;
      for (const x of aSet) if (bSet.has(x)) return true;
      return false;
    };

    const _termKV = (term) => {
      const s = clean(term);
      if (!s) return null;
      const i = s.indexOf(':');
      if (i > 0) {
        const k = clean(s.slice(0, i));
        const v = clean(s.slice(i + 1));
        if (!k) return null;
        return { k, v: v || '[*]' };
      }

      return { k: s, v: '[*]' };
    };

    const _clauseToMap = (clauseSet) => {
      const m = new Map();
      if (!(clauseSet instanceof Set)) return m;
      for (const raw of clauseSet) {
        const kv = _termKV(raw);
        if (!kv) continue;
        if (!m.has(kv.k)) m.set(kv.k, new Set());
        m.get(kv.k).add(kv.v);
      }
      return m;
    };

    const _mapValuesIntersect = (sa, sb) => {
      if (!sa || !sb) return true;
      for (const v of sa) if (sb.has(v)) return true;
      return false;
    };

    const outrosPossiblyOverlap = (ruleA, ruleB) => {
      const clausesA = Array.isArray(ruleA?.outrosCriterios?.clauses) ? ruleA.outrosCriterios.clauses : [];
      const clausesB = Array.isArray(ruleB?.outrosCriterios?.clauses) ? ruleB.outrosCriterios.clauses : [];

      const listA = clausesA.length ? clausesA : [new Set()];
      const listB = clausesB.length ? clausesB : [new Set()];

      for (const ca of listA) {
        const ma = _clauseToMap(ca);
        for (const cb of listB) {
          const mb = _clauseToMap(cb);

          let compatible = true;
          for (const [k, sa] of ma.entries()) {
            if (!mb.has(k)) continue;
            const sb = mb.get(k);
            if (!_mapValuesIntersect(sa, sb)) {
              compatible = false;
              break;
            }
          }
          if (compatible) return true;
        }
      }
      return false;
    };

    for (let i = 0; i < rules.length; i++) {
      const A = rules[i];
      for (let j = i + 1; j < rules.length; j++) {
        const B = rules[j];

        const removerEq = (exprCanon(A.localizadorRemover, '') === exprCanon(B.localizadorRemover, ''));
        const tipoEq    = (exprCanon(A.tipoControleCriterio, '') === exprCanon(B.tipoControleCriterio, ''));
        const incluirEq = (exprCanon(A.localizadorIncluirAcao, '') === exprCanon(B.localizadorIncluirAcao, ''));
        const outrosEq  = (relationOutros(A, B) === 'identicos');

        if (removerEq && tipoEq && incluirEq && outrosEq) {
          if (prioEq(A, B)) {
            const kd = pickKeepDropTotal(A, B);
            const sug = `Sugestão: Excluir a regra ${kd.drop.num}, mantendo a ${kd.keep.num}.`;
            upsert(A.num, B.num, 'Colisão Total', 'Alto', 'Prioridade, Localizador REMOVER, Tipo de Controle / Critério, Localizador INCLUIR / Ação e Outros Critérios idênticos. ' + sug);
            upsert(B.num, A.num, 'Colisão Total', 'Alto', 'Prioridade, Localizador REMOVER, Tipo de Controle / Critério, Localizador INCLUIR / Ação e Outros Critérios idênticos. ' + sug);
          } else {
            const kd = pickKeepDropParcial(A, B);
            const sug = `Sugestão: Excluir a regra ${kd.drop.num}, mantendo a ${kd.keep.num} (executa antes).`;
            upsert(A.num, B.num, 'Colisão Parcial', 'Médio', 'Localizador REMOVER, Tipo de Controle / Critério, Localizador INCLUIR / Ação e Outros Critérios idênticos; prioridades diferentes. ' + sug);
            upsert(B.num, A.num, 'Colisão Parcial', 'Médio', 'Localizador REMOVER, Tipo de Controle / Critério, Localizador INCLUIR / Ação e Outros Critérios idênticos; prioridades diferentes. ' + sug);
          }

        }

        if (removerEq && tipoEq) {

          const pa = prioNum(A);
          const pb = prioNum(B);
          const oa = (pa == null) ? Number.POSITIVE_INFINITY : pa;
          const ob = (pb == null) ? Number.POSITIVE_INFINITY : pb;

          const relAB = relationOutros(A, B);

          if (oa === ob && (relAB === 'A_mais_ampla' || relAB === 'B_mais_ampla')) {
            const ampla = (relAB === 'A_mais_ampla') ? A : B;
            const rest  = (relAB === 'A_mais_ampla') ? B : A;
            upsert(rest.num, ampla.num, 'Possível Sobreposição', 'Baixo',
              `Mesmo Localizador REMOVER e mesmo Tipo de Controle / Critério; prioridades equivalentes. ` +
              `A regra ${ampla.num} é mais ampla em "Outros Critérios" e pode capturar processos da mais restrita. ` + `Sugestão: Definir a prioridade da regra ${rest.num} para executar antes da ${ampla.num} (ou ajustar "Outros Critérios" para não sobrepor).`);
          }

          if (oa !== ob) {
            const earlier = (oa < ob) ? A : B;
            const later   = (oa < ob) ? B : A;

            const relEL = relationOutros(earlier, later);
            const earlierCobreLater = (relEL === 'identicos' || relEL === 'A_mais_ampla');

            if (earlierCobreLater) {
              const detalheOutros = (relEL === 'identicos')
                ? 'Outros idênticos'
                : 'Regra anterior é mais ampla em "Outros Critérios"';
              const pEarlier = prioLabel(earlier);
              const pLater = prioLabel(later);

              const sugOrdem = `Sugestão: Alterar a prioridade da regra ${later.num} (${pLater}) para menor que a regra ${earlier.num} (${pEarlier}), ou tornar a regra ${earlier.num} mais restritiva.`;

              const beh = normMsg(exprCanon(earlier.comportamentoRemover, ''));

              upsert(later.num, earlier.num, 'Sobreposição', 'Médio',
                `Mesmo Localizador REMOVER e mesmo Tipo de Controle / Critério; ${detalheOutros}. ` +
                `Prioridade ${pEarlier} executa antes de ${pLater}. ` + sugOrdem);

              if (beh === MSG_PERDA_OBJETO) {
                upsert(later.num, earlier.num, 'Perda de Objeto', 'Alto',
                  `Mesmo Localizador REMOVER e mesmo Tipo de Controle / Critério; ${detalheOutros}. ` +
                  `Regra ${earlier.num} (prioridade ${pEarlier}) executa antes ` +
                  `e remove o processo do(s) localizador(es) informado(s), impedindo que sejam capturados pela regra ${later.num}. ` + sugOrdem);
              }
            }
          }
        }

        const Arem = exprTermsUnion(A.localizadorRemover);
        const Ainc = exprTermsUnion(A.localizadorIncluirAcao);
        const Brem = exprTermsUnion(B.localizadorRemover);
        const Binc = exprTermsUnion(B.localizadorIncluirAcao);

if (typeof ATP_CONFIG === 'undefined' || ATP_CONFIG?.analisarPerdaObjetoCondicional !== false) {
        try {

          const paPOC = prioNum(A);
          const pbPOC = prioNum(B);
          const oaPOC = (paPOC == null) ? Number.POSITIVE_INFINITY : paPOC;
          const obPOC = (pbPOC == null) ? Number.POSITIVE_INFINITY : pbPOC;

          if (!(Number.isFinite(oaPOC) && Number.isFinite(obPOC) && oaPOC > obPOC)) {
            const tA_POC = exprTermsUnion(A.tipoControleCriterio);
            const tB_POC = exprTermsUnion(B.tipoControleCriterio);

            if (hasIntersection(tA_POC, tB_POC)) {

              if (outrosPossiblyOverlap(A, B)) {

                const clausesA_POC = Array.isArray(A.localizadorRemover?.clauses) ? A.localizadorRemover.clauses : [];
                const aHasAndInRemover = clausesA_POC.some(cl => {
                  if (!(cl instanceof Set)) return false;
                  const meaningful = Array.from(cl).filter(t => {
                    const tt = clean(t);
                    return tt && tt !== '[*]' && tt !== 'E' && tt !== 'OU';
                  });
                  return meaningful.length >= 2;
                });
                if (aHasAndInRemover) continue;

                const clausesB_POC = Array.isArray(B.localizadorRemover?.clauses) ? B.localizadorRemover.clauses : [];
                let registeredPOC = false;

                for (const clause of clausesB_POC) {
                  if (registeredPOC) break;
                  if (!(clause instanceof Set)) continue;

                  const terms = Array.from(clause)
                    .map(clean)
                    .filter(x => x && x !== '[*]' && x !== 'E' && x !== 'OU');

                  if (terms.length < 2) continue;

                  for (const x of terms) {
                    if (!Arem.has(x)) continue;

                    const y = terms.find(t => t !== x) || null;
                    if (!y) continue;

                    const impactoPOC = (oaPOC < obPOC) ? 'Alto' : 'Médio';

                    upsert(B.num, A.num, 'Perda de Objeto Condicional', impactoPOC,
                      `A regra ${A.num} remove "${x}" e a regra ${B.num} exige "${x}" E "${y}" ao mesmo tempo (AND) no Localizador REMOVER. ` +
                      `Como há interseção possível entre os critérios das regras, a regra ${A.num} pode consumir "${x}" antes, impedindo o disparo da regra ${B.num} (ao menos em parte dos casos).`);

                    registeredPOC = true;
                    break;
                  }
                }
              }
            }
          }
        } catch (e) {}
        }

    if (ATP_CONFIG.analisarLooping) {

      if (hasIntersection(Arem, Binc) && hasIntersection(Brem, Ainc)) {
        upsert(A.num, B.num, 'Looping Potencial', 'Alto', 'A remove algo que B inclui e B remove algo que A inclui.');
        upsert(B.num, A.num, 'Looping Potencial', 'Alto', 'A remove algo que B inclui e B remove algo que A inclui.');
      }
    }
      }
    }

    for (const r of (rules || [])) {
      try {
        const motivos = detectContradictions(r);
        if (motivos && motivos.length) {
          const sugest = 'Sugestão: Em “Outros Critérios”, remova seleções mutuamente exclusivas do mesmo campo (ex.: COM e SEM; APENAS UMA e MAIS DE UMA; estados diferentes do mesmo Dado Complementar). Se a intenção for abranger alternativas, separe em regras distintas ou use conector OU quando disponível.';
          upsert(r.num, -1, 'Contradição', 'Alto', motivos.join(' | ') + '\n' + sugest);
        }
      } catch (e) {}
    }

    for (const r of (rules || [])) {
      try {
        const acoesAll = (r?.localizadorIncluirAcao && Array.isArray(r.localizadorIncluirAcao.acoes))
          ? r.localizadorIncluirAcao.acoes : [];
        if (!acoesAll.length) continue;

        const normKey = (s) => clean(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

        const IGNORE_ACOES = new Set([
          'ALTERAR SITUACAO AUTOMATICAMENTE',
          'ALTERAR SITUACAO DA JUSTICA GRATUITA DA PARTE',
          'INSERIR DADO COMPLEMENTAR NO PROCESSO',
          'RETIFICAR AUTUACAO',
          'VERIFICACAO DE DADOS PROCESSUAIS'
        ]);

        const acoes = acoesAll.filter(a => {
          const nome = normKey(a?.acao || '');
          if (!nome) return false;
          if (IGNORE_ACOES.has(nome)) return false;

          if (nome === 'LANCAR EVENTO AUTOMATIZADO') {
            const vars = Array.isArray(a?.vars) ? a.vars : [];
            const temConclusos = vars.some(v => normKey(v?.valor || '').includes('CONCLUSOS'));
            if (temConclusos) return false;
          }
          return true;
        });

        if (!acoes.length) continue;

        const remSet = exprTermsUnion(r.localizadorRemover);
        const incSet = exprTermsUnion(r.localizadorIncluirAcao);

        const remClauses = Array.isArray(r?.localizadorRemover?.clauses) ? r.localizadorRemover.clauses : [];
        const remIsOr = remClauses.length > 1;

        const incHas = incSet.size > 0;

        const matchAnyRemBranch = (() => {
          if (!remIsOr || !incHas) return false;

          for (const clause of remClauses) {
            if (!(clause instanceof Set)) continue;
            const branch = new Set();
            for (const t of clause) {
              const tt = clean(t);
              if (!tt) continue;
              if (tt === '[*]' || tt === 'E' || tt === 'OU') continue;
              branch.add(tt);
            }
            if (branch.size && setsEqual(branch, incSet)) return true;
          }
          return false;
        })();

        if (incHas && (setsEqual(remSet, incSet) || matchAnyRemBranch)) {

          const titulos = [...new Set(acoes.map(a => clean(a?.acao || '')).filter(Boolean))];
          const resumoAcoes = titulos.length
            ? (titulos.slice(0, 4).join(' | ') + (titulos.length > 4 ? ' | …' : ''))
            : '(ação programada)';

          const sug = 'Sugestão: Defina um Localizador INCLUIR diferente do Localizador REMOVER (próximo passo do fluxo) após executar a ação, evitando reexecução no ciclo seguinte.';
          upsert(r.num, -1, 'Quebra de Fluxo', 'Alto',
            `A regra executa Ação Programada (${resumoAcoes}), mas mantém exatamente os mesmos Localizadores (INCLUIR == REMOVER). Isso pode fazer a regra rodar novamente em novo ciclo e gerar erro/duplicidade.\n` + sug);
        }
      } catch (e) {}
    }
    return conflictsByRule;
  }

  function severity(rec) {
    if (!rec?.tipos?.size) return 0;
    const imp = rec.impactoMax || 'Médio';
    const impScore = impactoRank[imp] || 1;
    let max = 0;
    for (const t of rec.tipos) max = Math.max(max, (tipoRank[t] || 0) * impScore);
    if (max <= 3) return 2;
    if (max <= 6) return 3;
    if (max <= 10) return 4;
    return 5;
  }

function tipoClass(t) {
  return ({
    'Colisão Total': 'collision',
    'Colisão Parcial': 'collision',
    'Sobreposição': 'overlap',
    'Possível Sobreposição': 'overlap',
    'Perda de Objeto': 'objectloss',
    'Perda de Objeto Condicional': 'objectloss',
    'Looping': 'loop',
    'Looping Potencial': 'loop',
    'Contradição': 'contradiction',
    'Quebra de Fluxo': 'breakflow'
  }[t] || '');
}

function setNumeroRegraAndSearch(nums) {
    try {
      const txt = document.getElementById('txtNumeroRegra');
      const btn = document.getElementById('sbmPesquisar');
      if (txt) {
        txt.value = nums.join(';');
        txt.dispatchEvent(new Event('input', { bubbles: true }));
        txt.dispatchEvent(new Event('change', { bubbles: true }));
      }
      setTimeout(() => {
        if (btn) btn.click();
        else if (typeof window.enviarFormularioAutomatizacao === 'function') window.enviarFormularioAutomatizacao();
      }, 100);
    } catch (_) {  }
  }

function makeCompareButton(ruleNum, confTd) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'atp-compare-btn infraButton';
    btn.textContent = 'Comparar';
    btn.addEventListener('click', () => {
      const others = (confTd.dataset.atpConfNums || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      const all = Array.from(new Set([...others, String(ruleNum)]))
        .sort((a, b) => Number(a) - Number(b));
      setNumeroRegraAndSearch(all);
    });
    return btn;
  }

function applyFilter(table) {
    const bodies = table.tBodies?.length ? Array.from(table.tBodies) : [table.querySelector('tbody')].filter(Boolean);
    const rows = bodies.flatMap(tb => Array.from(tb.rows));
    rows.forEach(tr => {
      if (!onlyConflicts) { tr.style.display = ''; return; }
      tr.style.display = (tr.dataset.atpHasConflict === '1') ? '' : 'none';
    });
  }

function render(table, rules, conflictsByRule) {
    const cols = mapColumns(table);
    const ruleByNum = new Map((rules || []).map(r => [String(r.num), r]));
    const bodies = table.tBodies?.length ? Array.from(table.tBodies) : [table.querySelector('tbody')].filter(Boolean);
    const rows = bodies.flatMap(tb => Array.from(tb.rows));
    const rowByNum = new Map();

    rows.forEach(tr => {
      const tds = tr.querySelectorAll(':scope > td');
      const num = extrairNumeroRegra(tds[cols.colNumPrior]);
      if (num) rowByNum.set(num, tr);
    });

    for (const r of rules) {
      const tr = rowByNum.get(r.num);
      if (!tr) continue;
      const confTd = tr.querySelector('td[data-atp-col="conflita"]');
      if (!confTd) continue;
      const adj = conflictsByRule.get(r.num);

      if (adj && adj.size) {
        for (const [otherNum, rec0] of adj.entries()) {
          const otherRule = ruleByNum.get(String(otherNum));
          const rec = Object.assign({ iNum: String(r.num), jNum: String(otherNum) }, rec0);
          if (typeof logConflictRead === "function") logConflictRead(r, otherRule, rec);
        }
      }
      let html = '';
      let maxSev = 0;

      if (adj && adj.size) {
        const others = [...adj.keys()].sort((a, b) => {
          const na = Number(a), nb = Number(b);
          const fa = Number.isFinite(na), fb = Number.isFinite(nb);
          if (fa && fb) return na - nb;
          if (fa && !fb) return -1;
          if (!fa && fb) return 1;
          return String(a).localeCompare(String(b));
        });

        const compNums = others
          .map(x => Number(x))
          .filter(n => Number.isFinite(n) && n > 0)
          .sort((a, b) => a - b);

        if (compNums.length) confTd.dataset.atpConfNums = compNums.join(',');
        else delete confTd.dataset.atpConfNums;

for (const n of others) {
          const rec = adj.get(n);
          const tipos = [...(rec.tipos || [])].sort((a, b) => (tipoRank[b] || 0) - (tipoRank[a] || 0));
          const impacto = rec.impactoMax || 'Médio';
          const spans = tipos.map(tipo => {
            const set = rec.motivosByTipo?.get?.(tipo);
            const motivo = (set && set.size) ? Array.from(set).join(' | ') : '';
            const tip = motivo ? `${tipo} (${impacto}) — ${motivo}` : `${tipo} (${impacto})`;
            return `<span class="atp-conf-tipo ${esc(tipoClass(tipo))}" data-atp-tipo="${esc(tipo)}" data-atp-impacto="${esc(impacto)}" data-atp-porque="${esc(motivo)}">${esc(tipo)}</span>`;
          }).join(' ');
          const nLabel = (Number(n) < 0) ? '(Própria Regra)' : esc(n);
          html += `<div><span class="atp-conf-num">${nLabel}:</span> ${spans}</div>`;
          maxSev = Math.max(maxSev, severity(rec));
        }

        tr.dataset.atpHasConflict = '1';
      } else {
        delete tr.dataset.atpHasConflict;
        delete confTd.dataset.atpConfNums;
      }

      ATP_SUPPRESS_OBSERVER = true;
      try {
        const prev = confTd.dataset.atpRenderedHtml || '';
        if (prev !== html) {
          confTd.innerHTML = html;
          confTd.dataset.atpRenderedHtml = html;
        }
      } finally {

        setTimeout(() => { ATP_SUPPRESS_OBSERVER = false; }, 0);
      }
      bindTipoConflitoTooltips(confTd);
      confTd.querySelector('.atp-compare-btn')?.remove();
      if (confTd.dataset.atpConfNums) confTd.appendChild(makeCompareButton(r.num, confTd));

      try {
        const tds = tr.querySelectorAll(':scope > td');
        const tdNum = tds[cols.colNumPrior];
        if (tdNum && !tdNum.querySelector('.atp-map-icon')) {
          const ico = document.createElement('span');
          ico.className = 'atp-map-icon';
          ico.title = 'Localizar esta regra no fluxo (BPMN)';
          ico.textContent = '🗺️';
          ico.addEventListener('click', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            atpOpenRuleMapModal(r.num);
          });

          const wrap = document.createElement('div');
          wrap.style.display = 'flex';
          wrap.style.justifyContent = 'center';
          wrap.style.width = '100%';
          wrap.appendChild(ico);
          tdNum.appendChild(wrap);
        }
      } catch (e) {}

      tr.classList.remove('atp-sev-2', 'atp-sev-3', 'atp-sev-4', 'atp-sev-5');
      if (maxSev >= 2) tr.classList.add(`atp-sev-${maxSev}`);
    }

    applyFilter(table);

    try { markATPRenderTick(); } catch (e) {}
}

function atpClauseKey(setOrArr) {
  const arr = Array.isArray(setOrArr) ? setOrArr : Array.from(setOrArr || []);
  return arr.map(x => clean(String(x))).filter(Boolean).sort((a,b)=>a.localeCompare(b)).join(' && ');
}
function atpClausesToKeys(expr) {
  const clauses = expr && Array.isArray(expr.clauses) ? expr.clauses : [];
  const keys = [];
  for (const c of clauses) {
    const k = atpClauseKey(c);
    if (k) keys.push(k);
  }
  return Array.from(new Set(keys));
}

function atpTarjanSCC(nodes, edgesMap) {

  let index = 0;
  const stack = [];
  const onStack = new Set();
  const idx = new Map();
  const low = new Map();
  const comps = [];

  function strongconnect(v) {
    idx.set(v, index);
    low.set(v, index);
    index++;
    stack.push(v); onStack.add(v);

    const outs = edgesMap.get(v) || [];
    for (const w of outs) {
      if (!idx.has(w)) {
        strongconnect(w);
        low.set(v, Math.min(low.get(v), low.get(w)));
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v), idx.get(w)));
      }
    }

    if (low.get(v) === idx.get(v)) {
      const comp = [];
      while (true) {
        const w = stack.pop();
        onStack.delete(w);
        comp.push(w);
        if (w === v) break;
      }
      comps.push(comp);
    }
  }

  for (const v of nodes) {
    if (!idx.has(v)) strongconnect(v);
  }
  return comps;
}

try { console.log('[ATP][OK] 06-analisador-de-colisoes.js inicializado'); } catch (e) {}
;
