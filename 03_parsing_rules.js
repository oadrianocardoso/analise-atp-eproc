try { console.log('[ATP][LOAD] 03_parsing_rules.js carregado com sucesso'); } catch (e) {}
/**
 * ATP MODULAR - 03_parsing_rules.js
 * Extraído de ATP-versao estavel com bpmno.js
 */

  function parseRules(table, cols) { // Captura regras direto da tabela (modelo do 2.18.15 estável).
    const list = []; // Lista de regras.
    const tbodys = table.tBodies?.length ? Array.from(table.tBodies) : [table.querySelector("tbody")].filter(Boolean); // TBODYs.
    const rows = tbodys.flatMap(tb => Array.from(tb.rows)); // TRs.

    for (const tr of rows) { // Itera linhas.
      const tds = Array.from(tr.querySelectorAll(':scope > td')); // TDs.
      if (!tds.length) continue; // Sem TD, ignora.

      // --- Detecta "ativa" (quando existe checkbox custom-control-input no TD de ações).
      delete tr.dataset.atpInactive; // Limpa flag anterior.
      const tdAcoes = tds.find(td => td.querySelector('input.custom-control-input')) || null; // TD que contém checkbox.
      const chkAtiva = tdAcoes?.querySelector('input.custom-control-input') || null; // Checkbox.
      const ativa = chkAtiva ? !!chkAtiva.checked : true; // Se não existe, assume ativa.
      if (chkAtiva && !ativa) { // Se existe e está desativada...
        tr.dataset.atpInactive = "1"; // Marca inativa.
        tr.style.display = "none"; // Oculta.
        continue; // Não entra na análise.
      }

      // --- Células principais.
      const tdNumPrior = tds[cols.colNumPrior] || tds[1]; // Nº/Prioridade.
      const tdRemover  = tds[cols.colRemover]  || tds[3]; // Remover.
      const tdTipo     = tds[cols.colTipo]     || tds[4]; // Tipo.
      const tdIncluir  = tds[cols.colIncluir]  || tds[5]; // Incluir.
      const tdOutros   = tds[cols.colOutros]   || tds[6]; // Outros critérios.

      // --- Número.
      const num = extrairNumeroRegra(tdNumPrior); // Lê número.
      if (!num) continue; // Se não achou, ignora.

      // --- Prioridade.
      const prioridadeTexto = extrairPrioridade(tdNumPrior); // Texto da prioridade.
      const prioridade = parsePriority(prioridadeTexto); // Estrutura normalizada.

      // --- Outros Critérios: mapa + texto completo.
      const outrosCriterios = extrairOutrosCriterios(tdOutros); // Mapa label->valor.
      //const outrosRaw = extrairCondicaoExecucao(tdOutros); // Texto completo/resumido.
      // --- REMOVER / localizadorRemover (expressão + canônico) e coringa.
      const localizadorRemover = extrairOrigemRemoverExpr(tdRemover); // Expr {canonical, clauses}.
// String p/ agrupamento.
      const removerWildcard = !!(tdRemover && tdRemover.dataset && tdRemover.dataset.atpRemoverWildcard === '1'); // Flag coringa (quando TD marcou).

      // --- Comportamento REMOVER (tooltip) como expressão.
      const comportamentoRemover = extrairComportamentoRemover(tdRemover); // Expr {canonical, clauses}.
// String.

      // --- INCLUIR / Destino (ação).
      const localizadorIncluirAcao = extrairLocalizadorIncluirAcao(tdIncluir); // Expressão {canonical, clauses}.
// Canônico do INCLUIR.

      // --- TIPO CONTROLE / CRITÉRIO (agora como pares controle->critério).
      const tipoControleCriterio = extrairTipoControleCriterio(tdTipo); // Expr ampliada.
// String.



      // --- Empilha regra.
      list.push({ // Regra final.
        num, // Número.
        prioridade, // Prioridade normalizada.
        localizadorRemover, // Expr de localizadorRemover (REMOVER) {canonical, clauses}.

        removerWildcard, // Flag coringa do REMOVER.
        comportamentoRemover, // Expr do tooltip do REMOVER.

        localizadorIncluirAcao, // Incluir/localizadorIncluirAcao.

        tipoControleCriterio, // Expr do tipo/critério (pares).

        //outrosRaw, // Texto de outros critérios.
        outrosCriterios, // Mapa estruturado.
        ativa, // Flag ativa.
        tr // Referência da linha.
      });
    }

    return list; // Retorna regras.
  }

  // ==============================
  // Análise de conflitos
  // ==============================

  // ======================================================================
  // ANÁLISE DE COLISÕES
  // ======================================================================


  function analyze(rules) { // Analisa colisões conforme regras de negócio definidas.
    const conflictsByRule = new Map(); // Map<numRegra, Map<numOutra, {tipos:Set, impactoMax:string, motivos:Set}>>

    const ensureBucket = (baseNum) => { // Garante bucket da regra base.
      if (!conflictsByRule.has(baseNum)) conflictsByRule.set(baseNum, new Map()); // Cria Map interno.
      return conflictsByRule.get(baseNum); // Retorna.
    };

    const upsert = (baseNum, otherNum, tipo, impacto, motivo) => { // Insere/atualiza conflito (unidirecional).
      const bucket = ensureBucket(baseNum); // Bucket da base.
      const rec = bucket.get(otherNum) || { tipos: new Set(), impactoMax: 'Baixo', motivos: new Set(), motivosByTipo: new Map() }; // Registro.
      rec.tipos.add(tipo); // Adiciona tipo.
      if ((impactoRank[impacto] || 0) > (impactoRank[rec.impactoMax] || 0)) rec.impactoMax = impacto; // Sobe impacto.
      if (motivo) {
        rec.motivos.add(motivo); // Guarda motivo (geral).
        if (!rec.motivosByTipo) rec.motivosByTipo = new Map();
        const set = rec.motivosByTipo.get(tipo) || new Set();
        set.add(motivo);
        rec.motivosByTipo.set(tipo, set);
      }
      bucket.set(otherNum, rec); // Salva.
    };

    const prioKey = (r) => { // Chave comparável da prioridade.
      const n = r?.prioridade?.num; // Número (quando parseou).
      if (Number.isFinite(n)) return `N:${n}`; // Prioridade numérica.
      const raw = clean(r?.prioridade?.raw || r?.prioridade?.text || ''); // Texto cru.
      return `T:${raw}`; // Prioridade textual.
    };

    const prioEq = (a, b) => prioKey(a) === prioKey(b); // Igualdade de prioridade.
    const prioNum = (r) => (Number.isFinite(r?.prioridade?.num) ? r.prioridade.num : null); // Número ou null.


    // ===== Sugestões: ordem e exclusão (colisão total/parcial) =====
    const execOrder = (r) => { // Menor executa antes; null executa por último.
      const n = prioNum(r);
      return (n == null) ? Number.POSITIVE_INFINITY : n;
    };

    const ruleNumVal = (r) => { // Número da regra como inteiro (fallback 0).
      const n = Number(r && r.num);
      return Number.isFinite(n) ? n : (parseInt(String(r && r.num || ''), 10) || 0);
    };

    const pickKeepDropTotal = (A, B) => { // Colisão Total: campos idênticos => redundância.
      const aN = ruleNumVal(A), bN = ruleNumVal(B);
      const keep = (aN <= bN) ? A : B;
      const drop = (aN <= bN) ? B : A;
      return { keep, drop, reason: 'duplicada (colisão total)' };
    };

    const pickKeepDropParcial = (A, B) => { // Colisão Parcial: redundância com prioridade diferente => manter a que executa antes.
      const oa = execOrder(A), ob = execOrder(B);
      let keep = A, drop = B;

      if (oa !== ob) {
        keep = (oa < ob) ? A : B; // executa antes
        drop = (oa < ob) ? B : A; // executa depois
      } else {
        // Prioridade equivalente (inclui ambos null ou mesmo número): mantém a menor numeração.
        const aN = ruleNumVal(A), bN = ruleNumVal(B);
        keep = (aN <= bN) ? A : B;
        drop = (aN <= bN) ? B : A;
      }
      return { keep, drop, reason: 'redundante (colisão parcial)' };
    };


    const normMsg = (s) => rmAcc(clean(s)).toLowerCase(); // Normaliza texto para comparar mensagens.
    const MSG_PERDA_OBJETO = normMsg('Remover o processo do(s) localizador(es) informado(s).'); // Texto gatilho.

    const exprTermsUnion = (expr) => { // União de todos os termos (ignora conectores, ignora coringa).
      const out = new Set(); // Conjunto.
      const clauses = Array.isArray(expr?.clauses) ? expr.clauses : []; // Cláusulas.
      for (const set of clauses) { // Itera OR-cláusulas.
        if (!(set instanceof Set)) continue; // Segurança.
        for (const t of set) { // Termos.
          const tt = clean(t); // Limpa.
          if (!tt) continue; // Vazio.
          if (tt === '[*]') continue; // Coringa.
          if (tt === 'E' || tt === 'OU') continue; // Conectores.
          out.add(tt); // Adiciona.
        }
      }
      return out; // Retorna.
    };

    const hasIntersection = (aSet, bSet) => { // Verifica interseção não-vazia.
      if (!aSet || !bSet || !aSet.size || !bSet.size) return false; // Guard.
      for (const x of aSet) if (bSet.has(x)) return true; // Achou.
      return false; // Nada.
    };

    // Varre pares (i<j) e aplica as classificações.
    for (let i = 0; i < rules.length; i++) { // Regra A.
      const A = rules[i]; // A.
      for (let j = i + 1; j < rules.length; j++) { // Regra B.
        const B = rules[j]; // B.

        // Igualdades base por CANÔNICO.
        const removerEq = (exprCanon(A.localizadorRemover, '') === exprCanon(B.localizadorRemover, '')); // Localizador REMOVER igual.
        const tipoEq    = (exprCanon(A.tipoControleCriterio, '') === exprCanon(B.tipoControleCriterio, '')); // Tipo Controle/Critério igual.
        const incluirEq = (exprCanon(A.localizadorIncluirAcao, '') === exprCanon(B.localizadorIncluirAcao, '')); // Localizador INCLUIR igual.
        const outrosEq  = (relationOutros(A, B) === 'identicos'); // Outros Critérios iguais.

        // ------------------------------
        // 1) COLISÃO TOTAL / PARCIAL
        // ------------------------------
        if (removerEq && tipoEq && incluirEq && outrosEq) { // Mesmos campos principais (inclui INCLUIR).
          if (prioEq(A, B)) { // Prioridade igual.
            const kd = pickKeepDropTotal(A, B);
            const sug = `Sugestão: Excluir a regra ${kd.drop.num}, mantendo a ${kd.keep.num}.`;
            upsert(A.num, B.num, 'Colisão Total', 'Alto', 'Prioridade, Localizador REMOVER, Tipo de Controle / Critério, Localizador INCLUIR / Ação e Outros Critérios idênticos. ' + sug); // Marca A.
            upsert(B.num, A.num, 'Colisão Total', 'Alto', 'Prioridade, Localizador REMOVER, Tipo de Controle / Critério, Localizador INCLUIR / Ação e Outros Critérios idênticos. ' + sug); // Marca B.
          } else { // Prioridade diferente.
            const kd = pickKeepDropParcial(A, B);
            const sug = `Sugestão: Excluir a regra ${kd.drop.num}, mantendo a ${kd.keep.num} (executa antes).`;
            upsert(A.num, B.num, 'Colisão Parcial', 'Médio', 'Localizador REMOVER, Tipo de Controle / Critério, Localizador INCLUIR / Ação e Outros Critérios idênticos; prioridades diferentes. ' + sug); // Marca A.
            upsert(B.num, A.num, 'Colisão Parcial', 'Médio', 'Localizador REMOVER, Tipo de Controle / Critério, Localizador INCLUIR / Ação e Outros Critérios idênticos; prioridades diferentes. ' + sug); // Marca B.
          }

        }

        // ------------------------------
        // 2) SOBREPOSIÇÃO / PERDA DE OBJETO (regra mais ampla vs mais restrita)
        // ------------------------------
        if (removerEq && tipoEq) { // Base: REMOVER e Tipo iguais.
          // Regra de prioridade:
          // - 1..20 executa antes de null
          // - null executa por último (após todas as regras com prioridade definida)
          const pa = prioNum(A);
          const pb = prioNum(B);
          const oa = (pa == null) ? Number.POSITIVE_INFINITY : pa;
          const ob = (pb == null) ? Number.POSITIVE_INFINITY : pb;

          const relAB = relationOutros(A, B); // identicos / A_mais_ampla / B_mais_ampla / diferentes

          // Se prioridades iguais (inclui ambos null) e existe relação ampla/restrita, não dá pra afirmar ordem.
          if (oa === ob && (relAB === 'A_mais_ampla' || relAB === 'B_mais_ampla')) {
            const ampla = (relAB === 'A_mais_ampla') ? A : B;
            const rest  = (relAB === 'A_mais_ampla') ? B : A;
            upsert(rest.num, ampla.num, 'Possível Sobreposição', 'Baixo',
              `Mesmo Localizador REMOVER e mesmo Tipo de Controle / Critério; prioridades equivalentes. ` +
              `A regra ${ampla.num} é mais ampla em "Outros Critérios" e pode capturar processos da mais restrita. ` + `Sugestão: Definir a prioridade da regra ${rest.num} para executar antes da ${ampla.num} (ou ajustar "Outros Critérios" para não sobrepor).`);
          }

          // Se existe ordem de execução, só marca sobreposição quando a regra que executa antes é mais ampla (ou igual).
          if (oa !== ob) {
            const earlier = (oa < ob) ? A : B; // Executa antes
            const later   = (oa < ob) ? B : A; // Executa depois

            const relEL = relationOutros(earlier, later); // A_mais_ampla => earlier é mais ampla
            const earlierCobreLater = (relEL === 'identicos' || relEL === 'A_mais_ampla');

            if (earlierCobreLater) {
              const detalheOutros = (relEL === 'identicos')
                ? 'Outros idênticos'
                : 'Regra anterior é mais ampla em "Outros Critérios"';

              const sugOrdem = `Sugestão: Alterar a prioridade da regra ${later.num} (${later.prioridade.num}ª) para menor que a regra ${earlier.num} (${earlier.prioridade.num}ª), ou tornar a regra ${earlier.num} mais restritiva.`;

              // SOBREPOSIÇÃO / PERDA DE OBJETO (modo analítico):
              // - Sempre registra SOBREPOSIÇÃO quando a regra anterior cobre a posterior;
              // - Se, além disso, a regra anterior usa o comportamento de REMOVER informados (Perda de Objeto),
              //   registra também PERDA DE OBJETO (sem suprimir o rótulo de sobreposição).
              // Obs.: a UI já suporta múltiplos tipos (chips) via rec.tipos (Set).
              const beh = normMsg(exprCanon(earlier.comportamentoRemover, ''));

              // 1) Sempre: Sobreposição
              upsert(later.num, earlier.num, 'Sobreposição', 'Médio',
                `Mesmo Localizador REMOVER e mesmo Tipo de Controle / Critério; ${detalheOutros}. ` +
                `Prioridade ${earlier.prioridade.text} executa antes de ${later.prioridade.text}. ` + sugOrdem);

              // 2) Se houver perda: adiciona também Perda de Objeto
              if (beh === MSG_PERDA_OBJETO) {
                upsert(later.num, earlier.num, 'Perda de Objeto', 'Alto',
                  `Mesmo Localizador REMOVER e mesmo Tipo de Controle / Critério; ${detalheOutros}. ` +
                  `Regra ${earlier.num} (prioridade ${earlier.prioridade.text}) executa antes ` +
                  `e remove o processo do(s) localizador(es) informado(s), impedindo que sejam capturados pela regra ${later.num}. ` + sugOrdem);
              }
            }
          }
        }

        // ------------------------------
        // 3) LOOPING POTENCIAL
        // ------------------------------
        const Arem = exprTermsUnion(A.localizadorRemover); // Termos removidos por A.
        const Ainc = exprTermsUnion(A.localizadorIncluirAcao); // Termos incluídos por A.
        const Brem = exprTermsUnion(B.localizadorRemover); // Termos removidos por B.
        const Binc = exprTermsUnion(B.localizadorIncluirAcao); // Termos incluídos por B.
		if (ATP_CONFIG.analisarLooping) {

			if (hasIntersection(Arem, Binc) && hasIntersection(Brem, Ainc)) { // Condição de looping.
			  upsert(A.num, B.num, 'Looping Potencial', 'Alto', 'A remove algo que B inclui e B remove algo que A inclui.'); // Marca A.
			  upsert(B.num, A.num, 'Looping Potencial', 'Alto', 'A remove algo que B inclui e B remove algo que A inclui.'); // Marca B.
			}
		}
      }
    }


    // ===== Contradições internas (self) em Outros Critérios =====
    for (const r of (rules || [])) {
      try {
        const motivos = detectContradictions(r);
        if (motivos && motivos.length) {
          const sugest = 'Sugestão: Em “Outros Critérios”, remova seleções mutuamente exclusivas do mesmo campo (ex.: COM e SEM; APENAS UMA e MAIS DE UMA; estados diferentes do mesmo Dado Complementar). Se a intenção for abranger alternativas, separe em regras distintas ou use conector OU quando disponível.';
          upsert(r.num, -1, 'Contradição', 'Alto', motivos.join(' | ') + '\n' + sugest);
        }
      } catch (e) {}
    }


    // ===== Quebra de Fluxo (self) – Ação Programada sem saída (INCLUIR == REMOVER) =====
    for (const r of (rules || [])) {
      try {
        const acoesAll = (r?.localizadorIncluirAcao && Array.isArray(r.localizadorIncluirAcao.acoes))
          ? r.localizadorIncluirAcao.acoes : [];
        if (!acoesAll.length) continue; // Só avalia se existe Ação Programada.

        // Normaliza para comparação (remove acentos, upper).
        const normKey = (s) => clean(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase(); // Executa norm key.

        // Tipos de ação que NÃO entram em Quebra de Fluxo (podem repetir sem erro/sem necessidade de avanço por localizador).
        const IGNORE_ACOES = new Set([
          'ALTERAR SITUACAO AUTOMATICAMENTE',
          'ALTERAR SITUACAO DA JUSTICA GRATUITA DA PARTE',
          'INSERIR DADO COMPLEMENTAR NO PROCESSO',
          'RETIFICAR AUTUACAO',
          'VERIFICACAO DE DADOS PROCESSUAIS'
        ]);

        // Filtra ações relevantes para "Quebra de Fluxo".
        const acoes = acoesAll.filter(a => {
          const nome = normKey(a?.acao || '');
          if (!nome) return false;
          if (IGNORE_ACOES.has(nome)) return false;

          // Exceção: "Lançar evento automatizado" — se o valor contiver "conclusos", desconsidera.
          if (nome === 'LANCAR EVENTO AUTOMATIZADO') {
            const vars = Array.isArray(a?.vars) ? a.vars : [];
            const temConclusos = vars.some(v => normKey(v?.valor || '').includes('CONCLUSOS'));
            if (temConclusos) return false;
          }
          return true;
        });

        if (!acoes.length) continue; // Nada relevante para avaliar.

        const remSet = exprTermsUnion(r.localizadorRemover);
        const incSet = exprTermsUnion(r.localizadorIncluirAcao);

        // Quebra de Fluxo:
        // - Caso 1 (REMOVER = A E B ...): só marca se INCLUIR == REMOVER (conjunto exato).
        // - Caso 2 (REMOVER = A OU B ...): marca se INCLUIR corresponder exatamente a QUALQUER ramo do OU
        //   (ex.: REMOVER = A OU B, INCLUIR = A => quebra), pois no ciclo seguinte o processo pode continuar
        //   em um localizador que ainda satisfaz a própria regra.

        // Detecta se o REMOVER tem semântica de OU (vários ramos) pelo modelo interno (clauses[]).
        const remClauses = Array.isArray(r?.localizadorRemover?.clauses) ? r.localizadorRemover.clauses : [];
        const remIsOr = remClauses.length > 1;

        const incHas = incSet.size > 0;

        const matchAnyRemBranch = (() => { // Executa match any rem branch.
          if (!remIsOr || !incHas) return false;
          // Para cada ramo (Set) do OU, extrai termos limpos e compara com INCLUIR.
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

        // Marca quebra se:
        // - INCLUIR == REMOVER (conjunto exato), OU
        // - REMOVER for OU e INCLUIR == algum ramo do OU.
        if (incHas && (setsEqual(remSet, incSet) || matchAnyRemBranch)) {
          // Resume as ações (títulos) para ajudar o usuário a identificar a operação.
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
    return conflictsByRule; // Retorna mapa final.
  }

  // ==============================
  // Renderização (coluna "Conflita com / Tipo")
  // ==============================

  function severity(rec) { // Converte tipos+impacto em nível 0..5 (para cor de fundo).
    if (!rec?.tipos?.size) return 0; // Sem tipos => zero.
    const imp = rec.impactoMax || 'Médio'; // Impacto.
    const impScore = impactoRank[imp] || 1; // Score do impacto.
    let max = 0; // Acumulador.
    for (const t of rec.tipos) max = Math.max(max, (tipoRank[t] || 0) * impScore); // Score do tipo * impacto.
    if (max <= 3) return 2; // Faixa 2.
    if (max <= 6) return 3; // Faixa 3.
    if (max <= 10) return 4; // Faixa 4.
    return 5; // Faixa 5.
  }

function tipoClass(t) { // Mapeia tipo de conflito para classe CSS.
  return ({ // Mapa direto.
    'Colisão Total': 'collision',          // Colisão => collision.
    'Colisão Parcial': 'collision',        // Colisão => collision.
    'Sobreposição': 'overlap',             // Sobreposição => overlap.
    'Possível Sobreposição': 'overlap',    // Possível Sobreposição => overlap.
    'Perda de Objeto': 'objectloss',       // Perda => objectloss.
    'Looping': 'loop',                     // Looping => loop.
    'Looping Potencial': 'loop',           // Looping potencial => loop.
    'Contradição': 'contradiction',         // Contradição => contradiction.
    'Quebra de Fluxo': 'breakflow'        // Quebra de Fluxo => breakflow.
  }[t] || ''); // Default vazio.
}


function setNumeroRegraAndSearch(nums) { // Preenche txtNumeroRegra e clica pesquisar (Comparar).
    try { // Protege contra erros de DOM.
      const txt = document.getElementById('txtNumeroRegra'); // Input do eProc.
      const btn = document.getElementById('sbmPesquisar'); // Botão pesquisar.
      if (txt) { // Se input existe...
        txt.value = nums.join(';'); // Define valor.
        txt.dispatchEvent(new Event('input', { bubbles: true })); // Dispara input.
        txt.dispatchEvent(new Event('change', { bubbles: true })); // Dispara change.
      }
      setTimeout(() => { // Pequeno delay (evita corrida).
        if (btn) btn.click(); // Clica no botão, se existir.
        else if (typeof window.enviarFormularioAutomatizacao === 'function') window.enviarFormularioAutomatizacao(); // Fallback do eProc.
      }, 100); // Delay curto.
    } catch (_) { /* noop */ } // Ignora erro.
  }

function makeCompareButton(ruleNum, confTd) { // Cria botão "Comparar" (filtra pelo conjunto de regras).
    const btn = document.createElement('button'); // Cria botão.
    btn.type = 'button'; // Define type.
    btn.className = 'atp-compare-btn'; // Classe CSS.
    btn.textContent = 'Comparar'; // Texto.
    btn.addEventListener('click', () => { // Ao clicar...
      const others = (confTd.dataset.atpConfNums || '') // Lê dataset com números.
        .split(',') // Divide por vírgula.
        .map(s => s.trim()) // Trim.
        .filter(Boolean); // Remove vazios.
      const all = Array.from(new Set([...others, String(ruleNum)])) // Junta com a regra atual e remove duplicados.
        .sort((a, b) => Number(a) - Number(b)); // Ordena numericamente.
      setNumeroRegraAndSearch(all); // Executa pesquisa.
    }); // Fim do listener.
    return btn; // Retorna botão.
  }

function applyFilter(table) { // Aplica filtro visual de "apenas conflitos".
    const bodies = table.tBodies?.length ? Array.from(table.tBodies) : [table.querySelector('tbody')].filter(Boolean); // TBODYs.
    const rows = bodies.flatMap(tb => Array.from(tb.rows)); // TRs.
    rows.forEach(tr => { // Itera linhas.
      if (!onlyConflicts) { tr.style.display = ''; return; } // Sem filtro => mostra.
      tr.style.display = (tr.dataset.atpHasConflict === '1') ? '' : 'none'; // Com filtro => mostra só conflitos.
    });
  }

function render(table, rules, conflictsByRule) { // Renderiza conflitos na coluna extra.
    const cols = mapColumns(table); // Mapeia colunas.
    const ruleByNum = new Map((rules || []).map(r => [String(r.num), r])); // Mapa num -> objeto regra (para logs/compare).
    const bodies = table.tBodies?.length ? Array.from(table.tBodies) : [table.querySelector('tbody')].filter(Boolean); // TBODYs.
    const rows = bodies.flatMap(tb => Array.from(tb.rows)); // TRs.
    const rowByNum = new Map(); // Mapa num -> tr.

    rows.forEach(tr => { // Mapeia cada TR.
      const tds = tr.querySelectorAll(':scope > td'); // TDs.
      const num = extrairNumeroRegra(tds[cols.colNumPrior]); // Número.
      if (num) rowByNum.set(num, tr); // Salva.
    });

    for (const r of rules) { // Para cada regra...
      const tr = rowByNum.get(r.num); // Encontra TR.
      if (!tr) continue; // Se não achou, pula.
      const confTd = tr.querySelector('td[data-atp-col="conflita"]'); // Pega TD extra.
      if (!confTd) continue; // Se não existe, pula.
      const adj = conflictsByRule.get(r.num); // Conflitos desta regra.
      // Se houver conflito, loga no console (modo estável).
      if (adj && adj.size) {
        for (const [otherNum, rec0] of adj.entries()) {
          const otherRule = ruleByNum.get(String(otherNum));
          const rec = Object.assign({ iNum: String(r.num), jNum: String(otherNum) }, rec0);
          if (typeof logConflictRead === "function") logConflictRead(r, otherRule, rec);
        }
      } // Conflitos da regra.
      let html = ''; // HTML acumulado.
      let maxSev = 0; // Severidade acumulada.

      if (adj && adj.size) { // Se há conflitos...
        const others = [...adj.keys()].sort((a, b) => {
          const na = Number(a), nb = Number(b);
          const fa = Number.isFinite(na), fb = Number.isFinite(nb);
          if (fa && fb) return na - nb;
          if (fa && !fb) return -1;
          if (!fa && fb) return 1;
          return String(a).localeCompare(String(b));
        }); // Ordena (numéricos primeiro).

        // Para o botão comparar: só números positivos (ignora -1 = própria regra)
        const compNums = others
          .map(x => Number(x))
          .filter(n => Number.isFinite(n) && n > 0)
          .sort((a, b) => a - b);

        if (compNums.length) confTd.dataset.atpConfNums = compNums.join(',');
        else delete confTd.dataset.atpConfNums;

for (const n of others) { // Para cada regra conflitante...
          const rec = adj.get(n); // Registro.
          const tipos = [...(rec.tipos || [])].sort((a, b) => (tipoRank[b] || 0) - (tipoRank[a] || 0)); // Ordena tipos por criticidade.
          const impacto = rec.impactoMax || 'Médio'; // Impacto.
          const spans = tipos.map(tipo => { // Gera spans com tooltip.
            const set = rec.motivosByTipo?.get?.(tipo); // Set de motivos do tipo.
            const motivo = (set && set.size) ? Array.from(set).join(' | ') : ''; // Motivo concatenado.
            const tip = motivo ? `${tipo} (${impacto}) — ${motivo}` : `${tipo} (${impacto})`; // Tooltip.
            return `<span class="atp-conf-tipo ${esc(tipoClass(tipo))}" data-atp-tipo="${esc(tipo)}" data-atp-impacto="${esc(impacto)}" data-atp-porque="${esc(motivo)}">${esc(tipo)}</span>`; // Span.
          }).join(' '); // Junta spans.
          const nLabel = (Number(n) < 0) ? '(Própria Regra)' : esc(n);
          html += `<div><span class="atp-conf-num">${nLabel}:</span> ${spans}</div>`; // Linha do conflito.
          maxSev = Math.max(maxSev, severity(rec)); // Atualiza severidade.
        }

        tr.dataset.atpHasConflict = '1'; // Marca linha com conflito.
      } else { // Sem conflito...
        delete tr.dataset.atpHasConflict; // Remove marca.
        delete confTd.dataset.atpConfNums; // Remove números.
      }

      // Evita loop: ao mexer no DOM, o MutationObserver dispara recalc.
      ATP_SUPPRESS_OBSERVER = true;
      try {
        const prev = confTd.dataset.atpRenderedHtml || '';
        if (prev !== html) {
          confTd.innerHTML = html; // Injeta HTML.
          confTd.dataset.atpRenderedHtml = html;
        }
      } finally {
        // Solta o bloqueio no próximo tick, depois que o observer (microtask) rodar.
        setTimeout(() => { ATP_SUPPRESS_OBSERVER = false; }, 0);
      }
      bindTipoConflitoTooltips(confTd); // Tooltips fixas por tipo de conflito (hover).
      confTd.querySelector('.atp-compare-btn')?.remove(); // Evita duplicar botão.
      if (confTd.dataset.atpConfNums) confTd.appendChild(makeCompareButton(r.num, confTd));

      // Ícone 🗺️ (Localizar no Fluxo) abaixo do número da regra
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
          // coloca abaixo, sem mexer no texto do número
          const wrap = document.createElement('div');
          wrap.style.display = 'flex';
          wrap.style.justifyContent = 'flex-start';
          wrap.appendChild(ico);
          tdNum.appendChild(wrap);
        }
      } catch (e) {} // Adiciona botão se houver conflitos.

      tr.classList.remove('atp-sev-2', 'atp-sev-3', 'atp-sev-4', 'atp-sev-5'); // Limpa classes.
      if (maxSev >= 2) tr.classList.add(`atp-sev-${maxSev}`); // Aplica classe de severidade.
    }

    applyFilter(table); // Reaplica filtro após render.

    // Tick de render para controle do loading
    try { markATPRenderTick(); } catch (e) {}
}

  // ==============================
  // UI: checkbox "Apenas regras com conflito"
  // ==============================


  // ============================================================
  // Relatório de Colisões (botão único no bloco de filtros)
  // ============================================================


// ============================================================
// EXTRATO DE FLUXOS (texto estilo IF/THEN, fechamento completo)
// ============================================================
function atpClauseKey(setOrArr) { // Executa clause key.
  const arr = Array.isArray(setOrArr) ? setOrArr : Array.from(setOrArr || []);
  return arr.map(x => clean(String(x))).filter(Boolean).sort((a,b)=>a.localeCompare(b)).join(' && ');
}
function atpClausesToKeys(expr) { // Executa clauses to keys.
  const clauses = expr && Array.isArray(expr.clauses) ? expr.clauses : [];
  const keys = [];
  for (const c of clauses) {
    const k = atpClauseKey(c);
    if (k) keys.push(k);
  }
  return Array.from(new Set(keys));
}

function atpTarjanSCC(nodes, edgesMap) { // Executa tarjan scc.
  // nodes: array<string>, edgesMap: Map<string, Array<string>>
  let index = 0;
  const stack = [];
  const onStack = new Set();
  const idx = new Map();
  const low = new Map();
  const comps = [];

  function strongconnect(v) { // Executa strongconnect.
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


try { console.log('[ATP][OK] 03_parsing_rules.js inicializado'); } catch (e) {}
