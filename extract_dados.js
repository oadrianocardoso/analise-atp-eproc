try { console.log('[ATP][LOAD] extract_dados.js carregado com sucesso'); } catch (e) {}
/**
 * ATP MODULAR - extract_dados.js
 * Funções de extração/normalização de dados (DOM -> estrutura interna).
 * (Movidas do 01_bpmn_modal_and_core.js)
 */

// ======================================================================
  // CAPTURA DE DADOS (DOM -> valores para comparação)
  // ======================================================================

 // Extrai o "Destino da ação" (INCLUIR) com prioridade para dadosCompletos_.

  function extrairNumeroRegra(td) { // Extrai o número da regra (início do texto).
    const m = clean(td && td.textContent || '').match(/^\s*(\d{1,6})\b/); // Captura 1..6 dígitos no começo.
    return m ? m[1] : ''; // Retorna número (string) ou vazio.
  }

function extrairPrioridade(td) { // Extrai texto de prioridade (preferindo <select>).
    const sel = td?.querySelector?.('select'); // Procura um select dentro da célula.
    if (sel) { // Se existir...
      const opt = sel.selectedOptions?.[0] || sel.options?.[sel.selectedIndex]; // Opção selecionada.
      if (opt) return clean(opt.textContent || ''); // Retorna o texto da opção.
    }
    const raw = clean(td && td.textContent || ''); // Fallback: texto da célula.
    const m = raw.match(/([0-9]{1,4})/); // Pega primeiro número se existir.
    return m ? m[1] : raw; // Retorna número ou texto bruto.
  }

function extrairCondicaoExecucao(tdOutros) { // Pega o texto mais completo de "Outros Critérios" (completo > resumido > td).
    if (!tdOutros) return "[*]"; // Guard.
    const divComp = tdOutros.querySelector('div[id^="dadosCompletos_"]'); // Completo.
    if (divComp && clean(divComp.innerText || divComp.textContent || "")) return clean(divComp.innerText || divComp.textContent || ""); // Preferência: completo.
    return clean(tdOutros.innerText || tdOutros.textContent || "") || "[*]"; // Fallback: TD.
  }
function extrairLocalizadorIncluirAcao(tdIncluir) { // Extrai o "Destino da ação" (INCLUIR) como expressão {canonical, clauses, acoes[]}.
  if (!tdIncluir) return { canonical: '', clauses: [], acoes: [] }; // Guard.

  // ------------------------------------------------------------
  // 0) Sempre tenta extrair AÇÕES PROGRAMADAS (array), SEM afetar canonical/clauses.
  // ------------------------------------------------------------
  const acoes = (function extrairAcoesProgramadas() {
    try {
      const root = tdIncluir.cloneNode(true);

      // Remove o trecho "destino" (antes do 2º <br>) para sobrar só a parte de ações.
      const brs = Array.from(root.querySelectorAll('br'));
      if (brs.length >= 2) {
        // Remove tudo até o 2º <br> (inclusive), para evitar "misturar" o destino com as ações.
        let node = root.firstChild;
        const stop = brs[1];
        // Remove nós até alcançar o 2º <br>
        while (node && node !== stop) {
          const next = node.nextSibling;
          node.remove();
          node = next;
        }
        if (node === stop) node.remove(); // remove o 2º <br>
      }

      // Agora, dentro do "restante", cada bloco costuma ter:
      // - div preto (#n-ETAPA)
      // - div azul (AÇÃO)
      // - variáveis: "Label: <span bold>Valor</span><br>"
      const divs = Array.from(root.querySelectorAll('div'));

      const isBlue = (d) => { // Executa is blue.
        const st = String(d.getAttribute('style') || '').toLowerCase();
        return st.includes('color: blue') && st.includes('font-weight: bold');
      };
      const isBlackStage = (d) => { // Executa is black stage.
        const st = String(d.getAttribute('style') || '').toLowerCase();
        if (!(st.includes('color: black') && st.includes('font-weight: bold'))) return false;
        const t = clean(d.textContent || '');
        return /^#\d+\s*-\s*/.test(t) || /^#\d+\b/.test(t);
      };

      // Indexa os divs por ordem de DOM para achar "próximo stage".
      const blueDivs = divs.filter(isBlue);
      if (!blueDivs.length) return [];

      const result = [];

      for (const blue of blueDivs) {
        // Etapa costuma ser o div preto imediatamente anterior.
        let etapa = '';
        let prev = blue.previousElementSibling;
        while (prev && prev.tagName === 'DIV') {
          if (isBlackStage(prev)) { etapa = clean(prev.textContent || ''); break; }
          // às vezes tem um div "Executar Ação Programada:" no meio — ignora.
          prev = prev.previousElementSibling;
        }

        const acao = clean(blue.textContent || '');
        const vars = [];

        // Coleta nós após o div azul até o próximo "div preto de etapa" (ou fim).
        const collected = [];
        let n = blue.nextSibling;

        // Função: detecta se um node é um div "stage".
        const isStageNode = (node) => { // Executa is stage node.
          if (!node || node.nodeType !== 1) return false;
          if (node.tagName !== 'DIV') return false;
          return isBlackStage(node);
        };

        while (n) {
          if (isStageNode(n)) break;
          // Se encontrar outro div azul, também pode indicar mudança, mas normalmente vem após um stage.
          if (n.nodeType === 1 && n.tagName === 'DIV' && isBlue(n)) break;
          collected.push(n);
          n = n.nextSibling;
        }

        // Parse de variáveis: label aparece em TEXT antes do span bold.
        let pendingLabel = null;

        const pushVar = (nome, valor) => { // Executa push var.
          const n = clean(nome || '');
          const v = clean(valor || '');
          if (!n || !v) return;
          vars.push({ nome: n, valor: v });
        };

        for (const node of collected) {
          // Texto "Label: "
          if (node.nodeType === 3) { // TEXT
            const txt = String(node.textContent || '');
            if (txt.includes(':')) {
              // pega o último label antes do ':' (ex.: "Modelo: ")
              const parts = txt.split(':');
              const label = clean(parts[0] || '');
              if (label) pendingLabel = label;
            }
            continue;
          }

          if (node.nodeType !== 1) continue; // Só ELEMENT daqui pra baixo.

          // Se houver <br>, não faz nada.
          if (node.tagName === 'BR') continue;

          // Span bold -> valor da variável
          if (node.tagName === 'SPAN') {
            const st = String(node.getAttribute('style') || '').toLowerCase();
            const isBold = st.includes('font-weight:bold') || st.includes('font-weight: bold');
            if (isBold && pendingLabel) {
              pushVar(pendingLabel, node.textContent || '');
              pendingLabel = null;
            }
            continue;
          }

          // Alguns casos vêm com "Label:" dentro de um elemento (raro), então varre texto interno.
          if (pendingLabel) {
            // procura primeiro span bold dentro do elemento
            const sp = node.querySelector && node.querySelector('span[style*="font-weight"]');
            if (sp) {
              pushVar(pendingLabel, sp.textContent || '');
              pendingLabel = null;
            }
          } else {
            // tenta capturar padrões "Label: <span bold>..."
            const textNodes = [];
            try {
              const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null);
              while (walker.nextNode()) textNodes.push(walker.currentNode);
            } catch {}
            for (const tn of textNodes) {
              const t = String(tn.textContent || '');
              if (t.includes(':')) {
                const label = clean(t.split(':')[0] || '');
                if (label) {
                  const sp = node.querySelector && node.querySelector('span[style*="font-weight"]');
                  if (sp) pushVar(label, sp.textContent || '');
                }
              }
            }
          }
        }

        // Só adiciona se houver ação (mesmo que sem vars).
        if (acao) result.push({ etapa, acao, vars });
      }

      return result;
    } catch {
      return [];
    }
  })();

  // ------------------------------------------------------------
  // 1) Captura do DESTINO (localizadores INCLUIR) — mantém comportamento anterior.
  // ------------------------------------------------------------

  // 1a) Prioridade: dadosCompletos_*
  const divComp = tdIncluir.querySelector('div[id^="dadosCompletos_"]');
  if (divComp) {
    const root = divComp.cloneNode(true); // Clona só o conteúdo completo.
    removeAlternarUI(root); // Remove UI de expandir (se existir).
    stripExpandArtifacts(root); // Remove artefatos tipo "... [ + Expandir ]" (por segurança).
    const expr = parsearExpressaoLogicaLocalizadores(root); // {canonical, clauses}
    return { canonical: expr?.canonical || '', clauses: expr?.clauses || [], acoes };
  }

  // 1b) Fallback: usa o conteúdo do td (pega antes do 2º <br>)
  const clone = tdIncluir.cloneNode(true); // Clona td.
  const brs = Array.from(clone.querySelectorAll('br')); // Lista de <br>.
  if (brs.length >= 2) {
    const secondBr = brs[1]; // Segundo <br>.
    let node = secondBr; // Começa daqui.
    while (node) { // Remove daqui pra frente.
      const next = node.nextSibling;
      node.remove();
      node = next;
    }
  }

  // Remove possíveis ruídos (caso existam)
  clone.querySelectorAll('img, span.atp-remover-emoji, span.atp-remover-plain-text').forEach(n => n.remove());

  // Tenta parsear E/OU do pedaço capturado
  const expr = parsearExpressaoLogicaLocalizadores(clone);
  if (expr && expr.canonical) return { canonical: expr.canonical, clauses: expr.clauses, acoes };

  // Se não der para parsear, usa texto simples
  const txt = clean(clone.textContent || '');
  if (!txt) return { canonical: '', clauses: [], acoes };
  return { canonical: txt, clauses: [new Set([txt])], acoes };
}

function extrairLocalizadorRemover(td) { // Extrai expressão de REMOVER (SEM dadosResumidos_).
  if (!td) return { canonical: '', clauses: [] }; // Guard.

  // 1) Prioridade: dadosCompletos_*
  const divComp = td.querySelector('div[id^="dadosCompletos_"]');
  if (divComp) {
    const root = divComp.cloneNode(true);
    removeAlternarUI(root);
    stripExpandArtifacts(root);
    return parsearExpressaoLogicaLocalizadores(root); // { canonical, clauses }
  }

  // 2) Fallback MELHORADO: clona o TD e parseia (assim <br> não "cola" itens)
  const root = td.cloneNode(true);

  // Remove UI do REMOVER (lupa/emoji/texto escondido)
  root.querySelectorAll('img, span.atp-remover-emoji, span.atp-remover-plain-text').forEach(n => n.remove());

  // Remove spans de tooltip (se existirem)
  root.querySelectorAll('span[onmouseover*="Comportamento do Localizador REMOVER"]').forEach(n => n.remove());

  // Parseia usando o mesmo parser (que já trata <br> como quebra)
  const expr = parsearExpressaoLogicaLocalizadores(root);
  if (expr && expr.canonical) return expr;

  // Último fallback (não deve mais colar, mas fica por segurança)
  const txt = clean(root.textContent || '');
  if (!txt) return { canonical: '', clauses: [] };
  return { canonical: txt, clauses: [new Set([txt])] };
}


function extrairOrigemRemoverExpr(td) { // Antes: extrairTextoOrigem(td) retornava string. Agora retorna expressão.
  return extrairLocalizadorRemover(td); // Mesmo formato {canonical, clauses}
}

function extrairComportamentoRemover(tdRemover) { // Agora retorna expressão {canonical, clauses}.
  if (!tdRemover) return { canonical: '', clauses: [] };

  const el = tdRemover.querySelector(
    '[onmouseover*="infraTooltipMostrar"][onmouseover*="Comportamento do Localizador REMOVER"]'
  );
  if (!el) return { canonical: '', clauses: [] };

  const om = el.getAttribute('onmouseover') || '';
  const idx = om.indexOf('infraTooltipMostrar(');
  if (idx === -1) return { canonical: '', clauses: [] };

  const slice = om.slice(idx);
  const m = slice.match(/infraTooltipMostrar\(\s*'([^']*)'/);
  const msg = m ? (m[1] || '') : '';
  const canonical = clean(msg);

  if (!canonical) return { canonical: '', clauses: [] };
  return { canonical, clauses: [new Set([canonical])] }; // Cláusula única (comportamento não tem E/OU)
}

function extrairTipoControleCriterio(td) { // Extrai pares "Por X: criterio" e devolve expressão (OR).
  if (!td) return { canonical: '', clauses: [], controles: [], pares: [], header: '', rawTerms: [] };

  const divComp = td.querySelector('div[id^="dadosCompletos_"]'); // Preferência.
  const base = divComp ? divComp : td;

  const root = base.cloneNode(true);
  root.querySelectorAll('img, .atp-remover-emoji, .atp-remover-plain-text').forEach(n => n.remove());

  const full = clean(root.textContent || '');
  if (!full) return { canonical: '', clauses: [], controles: [], pares: [], header: '', rawTerms: [] };

  const slash = full.indexOf('/');
  if (slash === -1) { // Sem "/", tenta parse genérico
    const expr = parsearExpressaoLogicaLocalizadores(root);
    if (expr && expr.canonical) return { ...expr, controles: [], pares: [], header: '', rawTerms: [] };
    return { canonical: full, clauses: [new Set([full])], controles: [], pares: [], header: '', rawTerms: [] };
  }

  // Header: antes do "/"
  const header = clean(full.slice(0, slash));
  const rawControles = header.split(/\s+ou\s+/i).map(s => clean(s)).filter(Boolean);
  const controles = rawControles.map(c => (/^por\s+/i.test(c) ? c : ('Por ' + c)));

  // Corpo: depois do "/"
  const body = clean(full.slice(slash + 1));

  // Termos separados por OU (sempre OR)
  const rawTerms = body.split(/\s+OU\s+/).map(s => clean(s)).filter(Boolean);

  // Função: normaliza controle com base em um rótulo (EVENTO/PETIÇÃO/DOCUMENTO...) se existir
  const mapControleByLabel = (label) => { // Executa map controle by label.
    const L = clean(label || '').toLowerCase();
    if (!L) return '';
    // exemplos possíveis
    if (L.startsWith('evento')) return 'Por Evento';
    if (L.startsWith('peti')) return 'Por Petição';
    if (L.startsWith('document')) return 'Por Documento';
    return ''; // desconhecido
  };

  // Função: remove prefixo "EVENTO -", "PETIÇÃO -", "DOCUMENTO -"
  const stripPrefix = (t) => { // Executa strip prefix.
    let x = clean(t);
    x = x.replace(/^(EVENTO|PETIÇÃO|PETICAO|DOCUMENTO)\s*-\s*/i, '');
    return clean(x);
  };

  const pares = [];

  if (controles.length === 1) {
    // 1 controle -> todos os termos pertencem a ele (e são OR)
    const ctrl = controles[0];
    for (const t of rawTerms) {
      const criterio = stripPrefix(t);
      if (criterio) pares.push({ controle: ctrl, criterio });
    }
  } else {
    // Vários controles -> tenta mapear cada termo pelo rótulo do termo (EVENTO/PETIÇÃO/DOCUMENTO - ...)
    // Se não conseguir mapear, cai na distribuição por ordem.
    const byOrder = [];
    for (const t of rawTerms) {
      const m = t.match(/^(EVENTO|PETIÇÃO|PETICAO|DOCUMENTO)\s*-\s*/i);
      const label = m ? m[1] : '';
      const mapped = mapControleByLabel(label);
      const criterio = stripPrefix(t);

      if (mapped && controles.some(c => clean(c).toLowerCase() === mapped.toLowerCase())) {
        pares.push({ controle: mapped, criterio });
      } else {
        byOrder.push(criterio);
      }
    }

    // Restante sem rótulo: distribui por ordem 1:1
    const n = Math.min(byOrder.length, controles.length);
    for (let i = 0; i < n; i++) {
      if (byOrder[i]) pares.push({ controle: controles[i], criterio: byOrder[i] });
    }
  }

  // Cada par vira um termo OR (uma cláusula por par)
  const parts = pares.map(p => `${p.controle}: ${p.criterio}`).map(clean).filter(Boolean);
  const canonical = parts.join(' || ');
  const clauses = parts.map(x => new Set([x]));

  return { canonical, clauses, controles, pares, header, rawTerms };
}


function extrairOutrosCriterios(tdOutros) { // Extrai Outros Critérios como expressão estruturada: {canonical, clauses, groups}
  // Regras:
  // - Tenta usar o bloco completo: div[id^="dadosCompletos_"] (mesma lógica dos demais TDs).
  // - Se não existir, usa o próprio tdOutros como raiz.
  // - Cada <div class="ml-0 pt-2"> é um "grupo" de critério.
  // - Dentro do grupo:
  //   - Variável (label): <span class="lblFiltro">...</span> OU <span class="font-weight-bold">...</span> (quando termina com ":")
  //   - Conector: <span style="font-weight:bold">E|OU</span> OU <span class="font-weight-bold">E|OU</span> (ou b/strong)
  //   - Textos fora dos spans (e dentro de divs internas) são valores.
  //
  // Saída:
  //  - groups: [{ canonical, clauses, tokens }]
  //  - canonical: string estável (ordena grupos)
  //  - clauses: lista "achatada" de cláusulas de cada grupo (utilitário)
  const empty = { canonical: '', clauses: [], groups: [] };
  if (!tdOutros) return empty;

  const root = (() => { // Executa root.
    if (tdOutros.matches && tdOutros.matches('div[id^="dadosCompletos_"]')) return tdOutros;
    const found = tdOutros.querySelector ? tdOutros.querySelector('div[id^="dadosCompletos_"]') : null;
    return found || tdOutros;
  })();

  const groupsEls = Array.from(root.querySelectorAll ? root.querySelectorAll('div.ml-0.pt-2') : []);
  if (!groupsEls.length) {
    const raw = clean(root.innerText || root.textContent || '');
    return raw
      ? { canonical: raw, clauses: [new Set([raw])], groups: [{ canonical: raw, clauses: [new Set([raw])], tokens: [{ type: 'term', value: raw }] }] }
      : empty;
  }

  const txt = (n) => clean((n && (n.textContent || n.innerText)) || ''); // Executa txt.

  const isConnector = (el) => { // Executa is connector.
    if (!el || el.nodeType !== 1) return false;
    const t = txt(el);
    if (!(t === 'E' || t === 'OU')) return false;
    return !!(el.matches && el.matches('span[style*="font-weight:bold"], span.font-weight-bold, b, strong'));
  };

  const isLabel = (el) => { // Executa is label.
    if (!el || el.nodeType !== 1) return false;
    if (!(el.matches && el.matches('span'))) return false;

    // lblFiltro sempre é label
    if (el.classList && el.classList.contains('lblFiltro')) return true;

    // font-weight-bold usado como label quando termina com ":"
    if (el.classList && el.classList.contains('font-weight-bold')) {
      const t = txt(el);
      if (!t) return false;
      if (t === 'E' || t === 'OU') return false;
      return t.trim().endsWith(':');
    }

    return false;
  };

  const labelKey = (labelText) => normalizarChave(labelText); // Executa label key.

  const extractGroup = (groupEl) => { // Executa extract grupo.
    const tokens = []; // {type:'term'|'op', ...}
    let currentKey = null;
    let buf = '';

    const flush = () => { // Executa flush.
      const v = clean(buf);
      if (currentKey && v) {
        const term = `${currentKey}=${v}`;
        tokens.push({ type: 'term', key: currentKey, value: v, term });
      }
      buf = '';
    };

    // DFS que respeita label/conector e acumula textos como valores
    const walk = (node) => { // Executa walk.
      for (const child of Array.from(node.childNodes || [])) {
        if (child.nodeType === 3) { // text
          buf += ' ' + (child.textContent || '');
          continue;
        }
        if (child.nodeType !== 1) continue;

        const el = child;

        // Label
        if (isLabel(el)) {
          flush();
          currentKey = labelKey(txt(el));
          continue; // não desce para não coletar o próprio label
        }

        // Conector
        if (isConnector(el)) {
          flush();
          tokens.push({ type: 'op', value: txt(el) }); // E / OU
          continue; // não desce
        }

        // Elementos estruturais (divs internas etc.)
        if ((el.tagName || '').toUpperCase() === 'BR') {
          buf += ' ';
          continue;
        }

        walk(el);
      }
    };

    walk(groupEl);
    flush();

    // Se não conseguiu montar termos (ex.: label não detectada), cai para RAW do grupo
    if (!tokens.some(t => t.type === 'term')) {
      const raw = clean(groupEl.innerText || groupEl.textContent || '');
      if (!raw) return { canonical: '', clauses: [], tokens: [] };
      return { canonical: raw, clauses: [new Set([raw])], tokens: [{ type: 'term', value: raw }] };
    }

    // Monta clauses OR (separadas por OU) com termos AND (E explícito ou implícito)
    const clauses = [];
    let current = new Set();
    let lastOp = null;

    const pushClause = () => { // Executa push clause.
      if (current.size) clauses.push(current);
      current = new Set();
    };

    for (const t of tokens) {
      if (t.type === 'op') { lastOp = t.value; continue; }
      const term = clean(t.term || t.value || '');
      if (!term) continue;
      if (lastOp === 'OU') pushClause();
      current.add(term);
      lastOp = null;
    }
    pushClause();

    // Canonical: ordena termos/cláusulas para estabilidade
    const norm = clauses.map(s => Array.from(s).map(clean).filter(Boolean).sort());
    norm.sort((a, b) => a.join('||').localeCompare(b.join('||')));
    const canonical = norm.map(arr => arr.join(' && ')).join(' || ');

    return { canonical, clauses: norm.map(arr => new Set(arr)), tokens };
  };

  const groups = groupsEls.map(extractGroup).filter(g => g && g.canonical);
  if (!groups.length) return empty;

  const canonical = groups.map(g => g.canonical).sort((a, b) => a.localeCompare(b)).join(' && ');

  const clauses = [];
  for (const g of groups) for (const c of (g.clauses || [])) clauses.push(c);

  return { canonical, clauses, groups };
}


  // REMOVER (coluna) - extração + normalização para colisões
  // ==============================

  const esc = (s) => String(s ?? '') // Escapa HTML para uso seguro em innerHTML.
    .replace(/&/g, '&amp;') // Escapa &.
    .replace(/</g, '&lt;') // Escapa <.
    .replace(/>/g, '&gt;') // Escapa >.
    .replace(/"/g, '&quot;') // Escapa ".
    .replace(/'/g, '&#39;'); // Escapa '.


  // ======================================================================
  // PARSER LÓGICO (E / OU) PARA LOCALIZADORES
  // ======================================================================


function parsearExpressaoLogicaLocalizadores(root) { // Parseia expressão com E/OU (bold) e também separa termos por <br>.
  // Saída: { clauses: Array<Set<string>>, canonical: string }
  if (!root) return { clauses: [], canonical: '' }; // Guard.

  const tokens = []; // Sequência de {type:'term'|'op', value:string}
  let buf = ''; // Buffer do termo atual.

  const flush = () => { // Fecha o termo atual e empilha como token.
    const t = clean(buf); // Normaliza.
    if (t) tokens.push({ type: 'term', value: t }); // Empilha termo.
    buf = ''; // Zera buffer.
  };

  const walk = (node) => { // Percorre DOM em ordem visual.
    const kids = Array.from(node.childNodes || []);
    for (const k of kids) {
      if (k.nodeType === 3) { // Texto
        buf += ' ' + (k.textContent || '');
        continue;
      }
      if (k.nodeType !== 1) continue; // Só elementos.

      const el = k;
      const tag = (el.tagName || '').toUpperCase();

      if (tag === 'BR') { // <br> delimita item -> evita texto "colado"
        flush(); // Fecha termo antes do br.
        continue;
      }

      const isBold = !!(el.matches && el.matches('span[style*="font-weight:bold"], span.font-weight-bold, b, strong'));
      const txt = clean(el.textContent || '');

      if (isBold && (txt === 'E' || txt === 'OU')) { // Conector explícito.
        flush(); // Fecha termo anterior.
        tokens.push({ type: 'op', value: txt }); // Empilha operador.
        continue;
      }

      walk(el); // Desce.
    }
  };

  walk(root); // Inicia caminhada.
  flush(); // Fecha último termo.

  // Monta cláusulas OR (separadas por OU) com termos AND (E ou implícito por separação).
  const clauses = [];
  let current = new Set();
  let lastOp = null;

  const pushClause = () => { // Executa push clause.
    if (current.size) clauses.push(current);
    current = new Set();
  };

  for (const t of tokens) {
    if (t.type === 'op') { lastOp = t.value; continue; }
    const term = clean(t.value);
    if (!term) continue;

    if (lastOp === 'OU') pushClause(); // OU inicia nova cláusula.
    current.add(term); // AND (E explícito ou implícito).
    lastOp = null;
  }
  pushClause();

  // Canonical: ordena termos dentro da cláusula e ordena cláusulas.
  const norm = clauses.map(s => Array.from(s).map(clean).filter(Boolean).sort());
  norm.sort((a, b) => a.join('||').localeCompare(b.join('||')));
  const canonical = norm.map(arr => arr.join(' && ')).join(' || ');

  return { clauses: norm.map(arr => new Set(arr)), canonical };
}


// Utilitários de texto // ==============================

  const clean = (x) => { // Normaliza texto (espacos, nbsp, trim).
    const s = (typeof x === 'string') ? x : ((x && x.textContent) ? x.textContent : ''); // Pega string ou textContent.
    return s.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim(); // Converte NBSP, colapsa espaços e corta.
  };
  // -----------------------------------------------------------------------------
  // DI helpers – garantem setas sempre conectadas (centro → centro, com dobra em L)
  // -----------------------------------------------------------------------------
  function atpCenter(shape) { // Executa center.
    return {
      x: shape.x + shape.width / 2,
      y: shape.y + shape.height / 2
    };
  }

  // Portas laterais (evita conexão na borda superior/inferior)
  function atpSidePort(shape, side) { // Executa side port.
    const cy = shape.y + shape.height / 2;
    if (side === 'L') return { x: shape.x, y: cy };
    return { x: shape.x + shape.width, y: cy }; // 'R'
  }

  // Waypoints com conexão SOMENTE pelas laterais (esquerda/direita).
  // Mantém dobra em "L" e um corredor horizontal no meio.
  // -----------------------------------------------------------------------------
// Humanização de "Outros Critérios" (exibição)
// - Internamente continua canonical/map estruturado
// - Aqui convertemos para algo legível (TXT e BPMN)
// -----------------------------------------------------------------------------
  function atpHumanizeOutrosCriteriosExpr(outrosExpr) { // Executa humanize outros critérios expr.
    try {
      if (!outrosExpr) return '';

      let raw = '';

      // Preferir canonical bruto
      if (typeof outrosExpr === 'string') {
        raw = outrosExpr;
      } else if (outrosExpr && typeof outrosExpr.canonical === 'string') {
        raw = outrosExpr.canonical;
      } else if (outrosExpr && outrosExpr.map && typeof outrosExpr.map === 'object') {
        raw = Object.entries(outrosExpr.map)
          .filter(([k, v]) => clean(k) && clean(v))
          .map(([k, v]) => `${k}=${v}`)
          .join(' && ');
      }

      if (!raw) return '';

      return raw
        .replace(/^canonical=/gi, '')
        .replace(/&&/g, ' E ')
        .replace(/eventotipodepeticao=/gi, 'Tipo de Petição: ')
        .replace(/localizadorquenaocontenhanenhum=/gi, 'Localizador NÃO contém: ')
        .replace(/dadocomplementar=/gi, 'Dado Complementar: ')
        .replace(/prazo=/gi, 'Prazo: ')
        .replace(/\s+/g, ' ')
        .trim();

    } catch (e) {
      try { console.warn('[ATP][Humanize] Falha ao humanizar Outros Critérios:', e); } catch(_) {}
      return '';
    }
  }




// -----------------------------------------------------------------------------
// Monta documentação (legível) para tasks de regra (TXT e BPMN)
// -----------------------------------------------------------------------------
  const lower = (x) => clean(x).toLowerCase(); // Versão em minúsculas (após limpeza).

  const rmAcc = (v) => { // Remove acentos (compatível, sem optional chaining).
    const s0 = (v == null) ? '' : String(v); // Normaliza para string.
    return s0.normalize ? s0.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : s0; // Remove diacríticos.
  }; // Remove acentos.


  const exprCanon = (expr, fallback) => { // Canonicaliza string ou {canonical}.
    const base = (expr && typeof expr === 'object') ? (expr.canonical || '') : (expr || '');
    const out = clean(base);
    return out || (fallback == null ? '' : String(fallback));
  };

  const exprTermSet = (expr) => { // Converte expr.clauses em Set<string> de termos.
    const out = new Set();
    if (!expr) return out;
    if (typeof expr === 'string') { const t = clean(expr); if (t) out.add(t); return out; }
    const clauses = expr.clauses;
    if (!clauses || !clauses.length) {
      const t = clean(expr.canonical || '');
      if (t) out.add(t);
      return out;
    }
    for (const c of clauses) {
      if (!c) continue;
      if (c instanceof Set) { for (const v of c) { const t = clean(v); if (t) out.add(t); } continue; }
      if (Array.isArray(c)) { for (const v of c) { const t = clean(v); if (t) out.add(t); } continue; }
      const t = clean(String(c));
      if (t) out.add(t);
    }
    return out;
  };



  // ==========================================================
  // Captura de dados (copiado/adaptado do 2.18.15 estável)
  // - Extrai "Outros Critérios" em mapa (label->valor)
  // ==========================================================

  try { console.log('[ATP][OK] 01_bpmn_modal_and_core.js inicializado'); } catch (e) {}
