// ==UserScript==
// @name         Análise de ATP eProc
// @namespace    https://tjsp.eproc/automatizacoes
// @version      3.5
// @description  Análise de conflitos de ATP (Colisão, Sobreposição, Perda de Objeto e Looping)
// @run-at       document-start
// @noframes
// @match        https://eproc1g.tjsp.jus.br/eproc/*
// @match        https://eproc-1g-sp-hml.tjsp.jus.br/*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/oadrianocardoso/analise-atp-eproc/main/analise-atp-eproc.user.js
// @downloadURL  https://raw.githubusercontent.com/oadrianocardoso/analise-atp-eproc/main/analise-atp-eproc.user.js

/*******************************************************************************************
 * SCRIPT: Análise de ATP eProc
 * -----------------------------------------------------------------------------------------
 * Finalidade
 * ----------
 * Este UserScript realiza uma análise estática das regras de Automatização de Localizadores
 * (ATP) configuradas no sistema eProc do TJSP, com o objetivo de identificar conflitos
 * lógicos entre regras que possam causar comportamento inesperado na execução automática
 * do sistema.
 *
 * O script NÃO altera dados no banco, NÃO interfere na execução real das regras e NÃO muda
 * a ordem de processamento do eProc. Ele atua exclusivamente na camada de interface (DOM),
 * auxiliando o usuário humano na auditoria e revisão das regras.
 *
 * -----------------------------------------------------------------------------------------
 * O que o script faz
 * ------------------
 * 1) Lê a tabela de Automatização de Localizadores do eProc diretamente do HTML.
 * 2) Extrai, normaliza e estrutura os campos relevantes de cada regra:
 *    - Número da regra
 *    - Prioridade (numérica ou indefinida / null)
 *    - Localizador REMOVER (expressão lógica com E / OU)
 *    - Comportamento do REMOVER (tooltip)
 *    - Tipo de Controle / Critério
 *    - Localizador INCLUIR / Ação
 *    - Outros Critérios (estrutura em grupos AND / OR)
 * 3) Analisa todas as combinações de regras (A x B) e classifica conflitos conforme
 *    regras de negócio pré-definidas.
 * 4) Exibe os conflitos diretamente na tabela do eProc, em uma coluna adicional
 *    "Conflita com / Tipo", com:
 *    - Tipo do conflito
 *    - Impacto (Baixo, Médio, Alto)
 *    - Explicação técnica ("Por quê")
 *    - Sugestões práticas de correção
 * 5) Disponibiliza:
 *    - Filtro "Apenas regras com conflito"
 *    - Botão "Comparar" (filtra regras conflitantes)
 *    - Botão "Gerar Relatório de Conflitos" (exporta relatório em TXT)
 *
 * -----------------------------------------------------------------------------------------
 * Importante sobre PRIORIDADE
 * ---------------------------
 * - Prioridades numéricas (1 a 20) executam ANTES de prioridades indefinidas (null).
 * - Prioridade null é tratada como a última a executar.
 * - Quanto MENOR o número da prioridade, MAIS CEDO a regra executa.
 *
 * Essa regra reflete o comportamento real do eProc.
 *
 * -----------------------------------------------------------------------------------------
 * Tipos de Conflito Detectados (Regras de Negócio)
 * -----------------------------------------------
 *
 * 1) COLISÃO TOTAL
 *    Ocorre quando DUAS regras possuem TODOS os campos abaixo idênticos:
 *    - Prioridade
 *    - Localizador REMOVER
 *    - Tipo de Controle / Critério
 *    - Localizador INCLUIR / Ação
 *    - Outros Critérios
 *
 *    Efeito:
 *    - Regras totalmente redundantes.
 *
 *    Sugestão:
 *    - Manter apenas uma delas (normalmente a de menor numeração).
 *
 * -----------------------------------------------------------------------------------------
 *
 * 2) COLISÃO PARCIAL
 *    Ocorre quando as regras possuem:
 *    - Localizador REMOVER igual
 *    - Tipo de Controle / Critério igual
 *    - Localizador INCLUIR / Ação igual
 *    - Outros Critérios iguais
 *    - Prioridades DIFERENTES
 *
 *    Efeito:
 *    - Uma regra é redundante em relação à outra.
 *
 *    Sugestão:
 *    - Manter a regra que executa primeiro (menor prioridade numérica).
 *
 * -----------------------------------------------------------------------------------------
 *
 * 3) SOBREPOSIÇÃO
 *    Ocorre quando:
 *    - Localizador REMOVER é igual
 *    - Tipo de Controle / Critério é igual
 *    - Existe relação de abrangência nos "Outros Critérios"
 *      (uma regra é mais ampla que a outra)
 *    - A regra MAIS AMPLA executa ANTES da mais restrita
 *
 *    Efeito:
 *    - A regra mais ampla pode capturar processos que deveriam ser tratados
 *      pela regra mais específica.
 *
 *    Sugestão:
 *    - Ajustar a prioridade para que a regra mais restrita execute antes,
 *      ou tornar a regra mais ampla menos abrangente.
 *
 * -----------------------------------------------------------------------------------------
 *
 * 4) POSSÍVEL SOBREPOSIÇÃO
 *    Ocorre quando:
 *    - Localizador REMOVER é igual
 *    - Tipo de Controle / Critério é igual
 *    - Existe relação ampla/restrita nos Outros Critérios
 *    - As prioridades são equivalentes (ambas numéricas iguais ou ambas null)
 *
 *    Efeito:
 *    - Não é possível garantir a ordem de execução.
 *
 *    Sugestão:
 *    - Definir prioridades explícitas para evitar ambiguidade.
 *
 * -----------------------------------------------------------------------------------------
 *
 * 5) PERDA DE OBJETO
 *    Ocorre quando:
 *    - Localizador REMOVER é igual
 *    - Tipo de Controle / Critério é igual
 *    - A regra que executa ANTES:
 *        • é mais ampla ou idêntica
 *        • possui comportamento "Remover o processo do(s) localizador(es) informado(s)"
 *
 *    Efeito:
 *    - A regra posterior nunca será executada, pois o localizador necessário
 *      já foi removido.
 *
 *    Regra Importante:
 *    - Quando há PERDA DE OBJETO, o script NÃO classifica como sobreposição,
 *      exibindo APENAS "Perda de Objeto".
 *
 * -----------------------------------------------------------------------------------------
 *
 * 6) LOOPING POTENCIAL (opcional)
 *    Detectado apenas se ATP_CONFIG.analisarLooping === true.
 *
 *    Ocorre quando:
 *    - Regra A remove algo que a Regra B inclui
 *    - Regra B remove algo que a Regra A inclui
 *
 *    Efeito:
 *    - Ciclo infinito de inclusão e remoção de localizadores.
 *
 *    Observação:
 *    - Por padrão, esta análise fica DESATIVADA por segurança.
 *
 * -----------------------------------------------------------------------------------------
 * Observações Finais
 * ------------------
 * - O script reflete o comportamento real do eProc, mas NÃO substitui testes
 *   funcionais em ambiente controlado.
 * - Todas as análises são heurísticas seguras, voltadas à prevenção de erros
 *   de configuração.
 * - O objetivo é apoiar auditoria, governança e manutenção das regras de ATP.
 *
 *******************************************************************************************/

// ==/UserScript==

(function () {
  'use strict';

// ============================================================
// Loading (overlay) – aguarda carregamento COMPLETO do eProc (window.load)
// e só some quando a análise/render estabilizar OU timeout (2 min)
// ============================================================
const ATP_LOADING_ID = 'atp-loading-overlay';

function showATPLoading() {
  try {
    if (document.getElementById(ATP_LOADING_ID)) return;

    const overlay = document.createElement('div');
    overlay.id = ATP_LOADING_ID;
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 999999;
      background: rgba(243, 244, 246, 0.85);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: Arial, Helvetica, sans-serif;
    `;

    overlay.innerHTML = `
      <div style="
        background: #ffffff;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        padding: 24px 32px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.15);
        text-align: center;
        min-width: 320px;
      ">
        <div style="
          width: 42px;
          height: 42px;
          margin: 0 auto 16px;
          border: 4px solid #e5e7eb;
          border-top-color: #2563eb;
          border-radius: 50%;
          animation: atp-spin 1s linear infinite;
        "></div>

        <div style="font-size: 15px; font-weight: bold; color: #111827;">
          Análise de ATP – eProc
        </div>
        <div id="atpLoadingMsg" style="font-size: 13px; color: #374151; margin-top: 6px;">
          Aguardando carregamento completo do eProc…
        </div>
      </div>
    `;

    if (!document.getElementById('atp-loading-style')) {
      const style = document.createElement('style');
      style.id = 'atp-loading-style';
      style.textContent = `
        @keyframes atp-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `;
      (document.head || document.documentElement).appendChild(style);
    }

    (document.documentElement || document.body).appendChild(overlay);

    // timeout de segurança (2 min)
    window.__ATP_LOADING_TIMEOUT__ = setTimeout(() => {
      try {
        const el = document.getElementById(ATP_LOADING_ID);
        if (el) el.remove();
        window.__ATP_LOADING_HIDDEN__ = true;
      } catch {}
    }, 120000);
  } catch {}
}

function setATPLoadingMsg(msg) {
  try {
    const el = document.getElementById('atpLoadingMsg');
    if (el) el.textContent = msg;
  } catch {}
}

function hideATPLoading() {
  try {
    if (window.__ATP_LOADING_HIDDEN__) return;
    const overlay = document.getElementById(ATP_LOADING_ID);
    if (overlay) overlay.remove();
    window.__ATP_LOADING_HIDDEN__ = true;

    if (window.__ATP_LOADING_TIMEOUT__) {
      clearTimeout(window.__ATP_LOADING_TIMEOUT__);
      window.__ATP_LOADING_TIMEOUT__ = null;
    }
    if (window.__ATP_LOADING_HIDE_TIMER__) {
      clearTimeout(window.__ATP_LOADING_HIDE_TIMER__);
      window.__ATP_LOADING_HIDE_TIMER__ = null;
    }
  } catch {}
}

// Gate: carregamento completo do eProc (window.load)
window.__ATP_PAGE_LOADED__ = (document.readyState === 'complete');
if (!window.__ATP_PAGE_LOADED__) {
  window.addEventListener('load', () => {
    window.__ATP_PAGE_LOADED__ = true;
    setATPLoadingMsg('Carregamento completo. Analisando colisões…');
    // tenta esconder quando estabilizar (se a análise já tiver renderizado)
    try { scheduleHideATPLoading(1800); } catch {}
  }, { once: true });
}

// Controle de renderização/estabilização
function markATPRenderTick() {
  try {
    window.__ATP_LAST_RENDER_TS__ = Date.now();
    window.__ATP_RENDER_COUNT__ = (window.__ATP_RENDER_COUNT__ || 0) + 1;
    // sempre agenda hide; ele só efetiva depois do load + silêncio
    scheduleHideATPLoading(1800);
  } catch {}
}

// Esconde o loading somente quando:
// - a página terminou de carregar (window.load)
// - houve ao menos 1 renderização da análise
// - e passou uma janela de silêncio sem novas renderizações
function scheduleHideATPLoading(silenceMs = 1800) {
  try {
    if (window.__ATP_LOADING_HIDDEN__) return;

    if (window.__ATP_LOADING_HIDE_TIMER__) {
      clearTimeout(window.__ATP_LOADING_HIDE_TIMER__);
    }

    window.__ATP_LOADING_HIDE_TIMER__ = setTimeout(() => {
      try {
        window.__ATP_LOADING_HIDE_TIMER__ = null;

        // 1) aguarda window.load
        if (!window.__ATP_PAGE_LOADED__) return;

        // 2) precisa ter renderizado ao menos 1x
        if ((window.__ATP_RENDER_COUNT__ || 0) < 1) return;

        // 3) silêncio após último tick
        const last = window.__ATP_LAST_RENDER_TS__ || 0;
        if (Date.now() - last < silenceMs) {
          scheduleHideATPLoading(silenceMs);
          return;
        }

        // 4) marcador de UI pronta (botão ou coluna/células)
        const hasReportBtn = !!document.getElementById('btnGerarRelatorioColisoes');
        const hasAnyConflictCell = !!document.querySelector('#tableAutomatizacaoLocalizadores td[data-atp-cell="conflito"], #tableAutomatizacaoLocalizadores td.atp-cell-conflito');
        if (hasReportBtn || hasAnyConflictCell) {
          hideATPLoading();
        } else {
          // se a UI ainda não apareceu, tenta novamente
          scheduleHideATPLoading(silenceMs);
        }
      } catch {}
    }, silenceMs);
  } catch {}
}

// ============================================================
// Ativa o loading SOMENTE na página que contém a tabela alvo
// (tableAutomatizacaoLocalizadores). Em outras páginas do eProc,
// não exibe overlay nenhum.
// ============================================================
(function atpBootstrapLoadingOnlyOnTargetPage() {
  try {
    const TARGET_TABLE_ID = 'tableAutomatizacaoLocalizadores';

    // Heurística rápida por URL (ajuda antes do DOM existir).
    const urlLooksLikeTarget = /automatizar_localizadores/i.test(String(location.href || ''));

    // Se a URL não parece ser a tela alvo, não faz nada.
    if (!urlLooksLikeTarget) return;

    const startedAt = Date.now();
    const tickMs = 200;

    const t = setInterval(() => {
      try {
        const table = document.getElementById(TARGET_TABLE_ID);
        if (table) {
          clearInterval(t);

          // Mostra overlay somente após detectar a tabela alvo.
          showATPLoading();

          // Atualiza flags do gate do page-load
          window.__ATP_PAGE_LOADED__ = (document.readyState === 'complete');
          if (window.__ATP_PAGE_LOADED__) {
            setATPLoadingMsg('Carregamento completo. Analisando colisões…');
            try { scheduleHideATPLoading(1800); } catch {}
          } else {
            setATPLoadingMsg('Aguardando carregamento completo do eProc…');
          }
        } else if (Date.now() - startedAt > 120000) {
          // Se a tabela não apareceu em 2 min, não mostra loading.
          clearInterval(t);
        }
      } catch {}
    }, tickMs);
  } catch {}
})();
  // ======================================================================
  // Organização do código
  //  1) Utilitários
  //  2) UI (emoji / tooltip)
  //  3) CAPTURA DE DADOS (DOM -> dados)
  //  4) ANÁLISE DE COLISÕES
  //  5) LOG / Dump
  //  6) Bootstrap / Observers
  // ======================================================================

  // ==============================
  // Constantes básicas
  // ==============================

  const TABLE_ID = 'tableAutomatizacaoLocalizadores'; // ID padrão da tabela no eProc.
  let onlyConflicts = false; // Estado do filtro "apenas regras com conflito".

  // Ranking simples para calcular "severidade" visual (só para cor de fundo da linha).
  const tipoRank = { // Peso do tipo de conflito.
    'Colisão Total': 5, // Mais crítico.
    'Colisão Parcial': 4, // Quase tão crítico quanto total.
    'Looping': 5, // Crítico.
    'Perda de Objeto': 3, // Médio.
    'Sobreposição': 2, // Baixo/médio.
    'Sobreposição (Outros iguais)': 2 // Baixo/médio (mais restritivo).
  };

  const impactoRank = { // Peso do impacto (quando aplicável).
    'Alto': 3, // Peso 3.
    'Médio': 2, // Peso 2.
    'Baixo': 1 // Peso 1.
  };

  const ATP_CONFIG = {
  analisarLooping: false, // ← false = DESATIVADO | true = ATIVADO
  };

  // ==============================
  // REMOVER emoji (lupa -> emoji)
  // ==============================

  const REMOVER_EMOJI = { // Tabela de mapeamento value -> emoji + nota.
    "null": { glyph: "❔", note: "" }, // Indefinido.
    "0": { glyph: "🗂️➖", note: "(Remover informados)" }, // Remove apenas os informados.
    "1": { glyph: "❌", note: "(Remover TODOS)" }, // Remove todos.
    "2": { glyph: "🚫⚙️", note: "(Remover todos exceto sistema)" }, // Remove todos exceto sistema.
    "3": { glyph: "➕", note: "(Não remover; só acrescenta)" }, // Não remove; só inclui.
    "4": { glyph: "🗂️⚙️➖", note: "(Remover apenas sistema)" } // Remove apenas localizadores de sistema.
  };

  function removerEmojiInfo(val) { // Normaliza value e retorna info do mapa.
    val = (val == null || val === "" || val === "null") ? "null" : String(val); // Normaliza para string ou "null".
    return REMOVER_EMOJI[val] || REMOVER_EMOJI["null"]; // Fallback para "null".
  }

function mkEmojiSpan(val, extraClass) { // Cria <span> com emoji + nota.
    const info = removerEmojiInfo(val); // Busca emoji/nota.
    const wrap = document.createElement("span"); // Wrapper principal.
    wrap.className = "atp-remover-emoji" + (extraClass ? " " + extraClass : ""); // Classe base + extra.
    const glyph = document.createElement("span"); // Span do emoji.
    glyph.className = "atp-remover-glyph"; // Classe do emoji.
    glyph.textContent = info.glyph; // Emoji.
    wrap.appendChild(glyph); // Anexa emoji.

    if (info.note) { // Se houver nota...
      const note = document.createElement("span"); // Span da nota.
      note.className = "atp-remover-note"; // Classe da nota.
      note.textContent = info.note; // Texto da nota.
      wrap.appendChild(note); // Anexa nota.
    }
    return wrap; // Retorna o wrapper.
  }

  // ======================================================================
  // UTILITÁRIOS
  // ======================================================================

  // ============================================================================
// ATP (extra): Ordenação VISUAL ao clicar no cabeçalho "Nº / Prioridade"
// - Apenas reordena as <tr> no DOM (cliente). NÃO altera a execução real.
// - Mantido do teu script; apenas pequenos reforços de robustez.
// ============================================================================
(function () {
  "use strict";

  const TABLE_ID = "tableAutomatizacaoLocalizadores";
  const TH_LABEL_RE = /n[ºo]\s*\/?\s*prioridade/i;

  function limparTextoLocal(s) {
    return (s ?? "").toString().replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
  }

  function toIntOrNull(x) {
    const m = String(x ?? "").match(/\d+/);
    return m ? Number(m[0]) : null;
  }

  function getRuleNumberFromCell(td) {
    const txt = limparTextoLocal(td?.textContent || "");
    const m = txt.match(/^\s*(\d{1,6})\b/);
    return m ? Number(m[1]) : null;
  }

  function getPriorityFromCell(td) {
    const sel = td?.querySelector?.("select");
    if (sel) {
      const opt = sel.selectedOptions?.[0] || sel.querySelector("option[selected]") || sel.options?.[sel.selectedIndex];
      const t = limparTextoLocal(opt?.textContent || "");
      const n = toIntOrNull(t);
      if (n != null) return n;
    }
    const raw = limparTextoLocal(td?.textContent || "");
    return toIntOrNull(raw);
  }

  function findPriorityColumnIndex(table) {
    const thead = table?.tHead || table?.querySelector("thead");
    if (!thead) return -1;
    const ths = Array.from(thead.querySelectorAll("th"));
    for (let i = 0; i < ths.length; i++) {
      const t = limparTextoLocal(ths[i].textContent || "");
      if (TH_LABEL_RE.test(t)) return i;
    }
    return -1;
  }

  function getAllBodyRows(table) {
    const tbodys = table.tBodies?.length ? Array.from(table.tBodies) : [];
    const rows = [];
    for (const tb of tbodys) for (const tr of Array.from(tb.rows)) rows.push(tr);
    return rows;
  }

  function sortTableByPriority(table, colIdx, direction) {
    const rows = getAllBodyRows(table);
    if (!rows.length) return;

    const byTbody = new Map();
    for (const tr of rows) {
      const tb = tr.parentElement;
      if (!byTbody.has(tb)) byTbody.set(tb, []);
      byTbody.get(tb).push(tr);
    }

    const factor = (direction === "desc") ? -1 : 1;

    for (const [tbody, trList] of byTbody.entries()) {
      trList.sort((a, b) => {
        const aTds = a.querySelectorAll(":scope > td");
        const bTds = b.querySelectorAll(":scope > td");

        const aCell = aTds[colIdx] || null;
        const bCell = bTds[colIdx] || null;

        const aPri = getPriorityFromCell(aCell);
        const bPri = getPriorityFromCell(bCell);

        const aHas = (aPri != null);
        const bHas = (bPri != null);

        if (aHas && bHas && aPri !== bPri) return (aPri - bPri) * factor;
        if (aHas !== bHas) return (aHas ? -1 : 1);

        const aNum = getRuleNumberFromCell(aCell) ?? getRuleNumberFromCell(aTds[0]) ?? 0;
        const bNum = getRuleNumberFromCell(bCell) ?? getRuleNumberFromCell(bTds[0]) ?? 0;
        if (aNum !== bNum) return (aNum - bNum) * factor;

        const at = limparTextoLocal(aCell?.textContent || "");
        const bt = limparTextoLocal(bCell?.textContent || "");
        return at.localeCompare(bt) * factor;
      });

      const frag = document.createDocumentFragment();
      trList.forEach(tr => frag.appendChild(tr));
      tbody.appendChild(frag);
    }
  }

  function ensureSortUI(table) {
    const thead = table.tHead || table.querySelector("thead");
    if (!thead) return;
    // Se o DataTables já foi inicializado, NÃO altere a estrutura (isso dispara TN/18)
    if ((table.classList && table.classList.contains('dataTable')) || table.closest('.dataTables_wrapper')) return;

    const colIdx = findPriorityColumnIndex(table);
    if (colIdx < 0) return;

    const th = thead.querySelectorAll("th")[colIdx];
    if (!th || th.dataset.atpSortBound === "1") return;

    th.dataset.atpSortBound = "1";
    th.style.cursor = "pointer";
    th.title = "Ordenação visual (não altera a execução real). Clique para alternar ↑/↓.";

    const badge = document.createElement("span");
    badge.textContent = " ↕";
    badge.style.opacity = "0.65";
    badge.style.userSelect = "none";
    badge.dataset.atpSortBadge = "1";
    th.appendChild(badge);

    th.dataset.atpSortDir = "asc";

    th.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const dir = (th.dataset.atpSortDir === "asc") ? "desc" : "asc";
      th.dataset.atpSortDir = dir;
      badge.textContent = (dir === "asc") ? " ↑" : " ↓";

      sortTableByPriority(table, colIdx, dir);
    }, true);
  }

  function init() {
    const table = document.getElementById(TABLE_ID);
    if (table) {
      // Garante nossa coluna ANTES do DataTables “pegar” a tabela.
      try { ensureColumns(table); } catch (e) {}
      ensureSortUI(table);
    }
  }

  init();

  const mo = new MutationObserver(() => {
    if (init._t) cancelAnimationFrame(init._t);
    init._t = requestAnimationFrame(init);
  });
  mo.observe(document.body, { childList: true, subtree: true });

})();

function parseTooltipMsgFromOnmouseover(onm) { // Extrai msg do atributo onmouseover (infraTooltipMostrar).
    return parseTooltipMsg(onm); // Reusa o parser já existente.
  }

function tooltipMsgToValue(msg) { // Converte texto do tooltip em "value" lógico (0..4, 3, null) — mesma regra do script original.
    const s = rmAcc(lower(msg || "")).replace(/\.+$/, "").trim(); // Normaliza e remove pontuação final.
    if (!s) return "null"; // Sem texto => indefinido.

    const reTodosLoc = /todos\s+(os\s+)?localizadores/; // "todos os localizadores"
    const reTodosExceto = /todos\s+(os\s+)?localizadores[\s\S]*exceto/; // "todos os localizadores ... exceto"

    if (s.includes("apenas os de sistema")) return "4"; // Apenas sistema.
    if (s.includes("nao remover") || s.includes("não remover") || s.includes("apenas acrescentar")) return "3"; // Não remover / só acrescenta.
    if (reTodosExceto.test(s) || (s.includes("exceto") && (s.includes("todos") && s.includes("localizador")))) return "2"; // Todos exceto (geralmente sistema).
    if (reTodosLoc.test(s) || s.includes("remover todos")) return "1"; // Remove todos.
    if (s.includes("localizador") && s.includes("informado")) return "0"; // Remove informados.

    return "null"; // Default.
  }

function removerPlainTextToValue(txt) { // Converte texto simples do TD em value (quando não há lupa) — mesma regra do script original.
    const s = rmAcc(lower(txt || "")).replace(/\.+$/, "").trim(); // Normaliza e remove pontuação final.
    if (!s) return null; // Vazio => nada.

    if (s === "nenhum") return "3"; // Nenhum => não remover.
    if (s.includes("manter") && s.includes("localizador") && s.includes("sistema")) return "2"; // Manter os de sistema => remove todos exceto sistema.
    if (s.includes("todos") && s.includes("localizador")) return "1"; // Todos os localizadores => remove todos.
    return null; // Caso não reconhecido.
  }

function replaceLupaImgWithEmoji(triggerEl, val) { // Esconde a lupa (IMG) e insere emoji equivalente (tooltip preservado).
    if (!triggerEl || triggerEl.nodeType !== 1) return; // Proteção.
    // O tooltip pode estar no <img> OU no pai (<a>/<span>). Então usamos o elemento "gatilho".
    const onm0 = triggerEl.getAttribute('onmouseover') || ''; // Lê onmouseover do gatilho.
    if (onm0.indexOf('Comportamento do Localizador REMOVER') === -1) return; // Se não é o tooltip certo, sai.

    // Encontra a IMG da lupa (se o próprio trigger já for IMG, ok; senão tenta dentro dele).
    const img = (triggerEl.tagName === 'IMG') ? triggerEl : (triggerEl.querySelector('img') || null); // IMG associada.
    if (!img) return; // Sem IMG, não há o que esconder/substituir.

    let msg0 = ''; // Mensagem do tooltip.
    try { msg0 = parseTooltipMsgFromOnmouseover(onm0) || ''; } catch { } // Extrai msg do onmouseover do gatilho.

    let span = null; // Possível span já existente.
    // Observação: às vezes o emoji fica após a IMG, outras após o gatilho; tentamos ambos.
    const nextImg = img.nextElementSibling; // Próximo irmão da IMG.
    const nextTrig = triggerEl.nextElementSibling; // Próximo irmão do gatilho.
    if (nextImg && nextImg.classList && nextImg.classList.contains('atp-remover-emoji-tooltip')) span = nextImg; // Emoji após IMG.
    if (!span && nextTrig && nextTrig.classList && nextTrig.classList.contains('atp-remover-emoji-tooltip')) span = nextTrig; // Emoji após gatilho.

    const currentVal = span?.dataset?.atpRemoverVal; // Value atual.
    const currentMsg = span?.dataset?.atpRemoverMsg; // Msg atual.
    if (span && String(currentVal) === String(val ?? 'null') && String(currentMsg || '') === String(msg0 || '')) { // Se nada mudou...
      img.style.display = 'none'; // Só garante lupa escondida.
      return; // Sai.
    }

    const fresh = mkEmojiSpan(val, "atp-tooltip"); // Cria novo emoji.
    fresh.classList.add('atp-remover-emoji-tooltip'); // Marca como tooltip.

    try { fresh.dataset.atpRemoverVal = String(val ?? 'null'); } catch { } // Salva value no dataset.
    try { if (msg0) fresh.dataset.atpRemoverMsg = msg0; } catch { } // Salva msg no dataset.

    fresh.style.cursor = "default"; // Cursor padrão.
    fresh.addEventListener("mouseenter", () => { // Ao passar o mouse...
      try { if (typeof window.infraTooltipMostrar === "function") window.infraTooltipMostrar(msg0, "Comportamento do Localizador REMOVER", 600); } catch { } // Mostra tooltip nativo.
    });
    fresh.addEventListener("mouseleave", () => { // Ao sair...
      try { if (typeof window.infraTooltipOcultar === "function") window.infraTooltipOcultar(); } catch { } // Esconde tooltip.
    });

    img.style.display = 'none'; // Esconde a lupa.

    if (span) span.replaceWith(fresh); // Se já tinha emoji, troca.
    else img.insertAdjacentElement("afterend", fresh); // Senão, insere após a IMG (layout mais previsível).

    // Importante: grava no TD, porque o parser usa isso como "fonte de verdade".
    const td = img.closest('td'); // TD do remover.
    if (td) { // Se achou TD...
      try { td.dataset.atpRemoverVal = String(val ?? 'null'); } catch { } // Salva VAL no TD.
      try { if (msg0) td.dataset.atpRemoverMsg = msg0; } catch { } // Salva MSG no TD.
    }

    try { img.dataset.atpEmojiApplied = "1"; } catch { } // Marca a lupa como processada.
  }

function updateAllRemoverLupasByTooltipText(root) { // Processa todas as lupas (tooltip REMOVER) dentro de um escopo.
    const scope = root || document; // Define escopo.
    // O tooltip pode estar no IMG ou em um nó pai (a/span). Então pegamos qualquer nó com o onmouseover.
    const triggers = Array.from(scope.querySelectorAll('[onmouseover*="Comportamento do Localizador REMOVER"]')); // Gatilhos.
    for (const el of triggers) { // Itera.
      const onm = el.getAttribute('onmouseover') || ''; // Lê onmouseover.
      const msg = parseTooltipMsgFromOnmouseover(onm); // Extrai msg.
      const val = tooltipMsgToValue(msg); // Converte em value.
      replaceLupaImgWithEmoji(el, val); // Substitui (usando o gatilho).
    }
  }

function replacePlainRemoverTextInTable(table, cols) { // Para linhas sem lupa, tenta reconhecer texto e inserir emoji.
    try { // Proteção.
      if (!table || !cols) return; // Guard.
      const tbodys = table.tBodies?.length ? Array.from(table.tBodies) : [table.querySelector("tbody")].filter(Boolean); // TBODYs.
      const rows = tbodys.flatMap(tb => Array.from(tb.rows)); // TRs.

      for (const tr of rows) { // Para cada linha...
        const tds = Array.from(tr.querySelectorAll(':scope > td')); // TDs.
        const td = tds[cols.colRemover] || null; // Coluna remover.
        if (!td) continue; // Guard.

        if (td.querySelector('img[src*="lupa.gif"][onmouseover*="Comportamento do Localizador REMOVER"]')) continue; // Se tem lupa, não mexe.
        if (td.querySelector('span.atp-remover-emoji')) continue; // Se já tem emoji, não mexe.

        const plain = clean(td.textContent || ""); // Texto simples.
        const val = removerPlainTextToValue(plain); // Converte para value.
        if (!val) continue; // Se não reconheceu, sai.

        // Marca no TD (para o parser de regras).
        try { td.dataset.atpRemoverVal = String(val); } catch { } // Value lógico.
        try { td.dataset.atpRemoverWildcard = (plain === 'Todos os localizadores') ? "1" : "0"; } catch { } // "Todos" tratamos como coringa.
        try { td.dataset.atpRemoverTextOriginal = plain; } catch { } // Texto original.

        const hidden = document.createElement("span"); // Span escondido do texto.
        hidden.className = "atp-remover-plain-text"; // Classe.
        hidden.textContent = plain; // Texto.

        const emoji = mkEmojiSpan(val, "atp-in-table"); // Emoji.
        emoji.dataset.atpRemoverVal = val; // Value no emoji.

        td.textContent = ""; // Limpa a célula.
        td.appendChild(hidden); // Mantém texto original para parser.
        td.appendChild(emoji); // Mostra emoji.
      }
    } catch { } // Ignora erro.
  }


  // ==============================
  // Logger: dump de TODAS as regras capturadas
  // ==============================

  const ATP_RULES_LOG = (window.__ATP_RULES_LOG = window.__ATP_RULES_LOG || { enabled: true, lastSignature: null, lastDump: null, didDumpOnce: false, force: false }); // Controle global.

  // Atalho manual para re-dumpar (sem recarregar a página).
  // Uso: window.atpDumpRegras()
  if (!window.atpDumpRegras) {
    window.atpDumpRegras = () => {
      try {
        ATP_RULES_LOG.force = true;
        ATP_RULES_LOG.didDumpOnce = false;
        logAllRules(Array.isArray(ATP_RULES_LOG.lastDump) ? ATP_RULES_LOG.lastDump : (window.__ATP_LAST_RULES || []));
      } finally {
        ATP_RULES_LOG.force = false;
      }
    };
  }

  function logAllRules(rules) { // Loga todas as regras capturadas no console (estilo [ATP][Conflito]).
    try {
      if (!ATP_RULES_LOG.enabled) return; // Se desativado, não loga.
      if (!Array.isArray(rules) || !rules.length) return; // Nada para logar.

      // Evita spam infinito: por padrão, faz dump apenas 1 vez por carregamento.
      // Se precisar novamente, rode no console: window.atpDumpRegras() (atalho abaixo).
      if (ATP_RULES_LOG.didDumpOnce && !ATP_RULES_LOG.force) return;

      // Assinatura estável (somente campos efetivamente usados na colisão).
      const signature = JSON.stringify(rules.map(r => ([
        String(r?.num ?? ''),
        String(r?.prioridade?.num ?? ''),
        String(exprCanon(r?.tipoControleCriterio, '') || ''),
        String(exprCanon(r?.localizadorRemover, '') || ''),
        String(exprCanon(r?.localizadorIncluirAcao, '') || ''),
        String(getOutrosCanonical(r) || ''),
      ])));
      if (ATP_RULES_LOG.lastSignature === signature && !ATP_RULES_LOG.force) return; // Nada mudou -> não loga novamente.
      ATP_RULES_LOG.lastSignature = signature; // Atualiza assinatura.
      ATP_RULES_LOG.lastDump = rules; // Guarda referência para inspeção posterior.
      ATP_RULES_LOG.didDumpOnce = true; // Marca que já fez dump.

      console.groupCollapsed(`[ATP][Regras] Dump de regras capturadas (${rules.length})`); // Grupo principal.

      // Loga uma regra por grupo (padrão igual ao [ATP][Conflito]).
      for (const r of rules) {
        const num = String(r?.num ?? ''); // Número.
        const pr  = String(r?.prioridade?.raw ?? ''); // Prioridade raw.
        const tipo = String(r?.tipoControleCriterio ?? ''); // Tipo.
        const header = `[ATP][Regra] #${num}`; // Cabeçalho.
        console.groupCollapsed(header); // Grupo da regra.
        // IMPORTANTE: este dump deve espelhar exatamente os mesmos campos/normalizações
        // usados na análise de colisões (os "...Canon" e flags auxiliares).
        console.log('Campos principais (mesmos da colisão):', {
          num: r?.num,
          ativa: r?.ativa !== false,

          // Prioridade
          prioridade: r?.prioridade,

          // Tipo Controle/Critério
          tipoControleCriterio: r?.tipoControleCriterio,

          // Localizadores
          localizadorIncluirAcao: r?.localizadorIncluirAcao,
          localizadorRemover: r?.localizadorRemover,
          removerWildcard: !!r?.removerWildcard,

          // Comportamento do REMOVER (tooltip)
          comportamentoRemover: r?.comportamentoRemover,

          // Outros Critérios (estrutura)
          outrosCriterios: r?.outrosCriterios
        });
        console.groupEnd(); // Fecha grupo da regra.
      }

      console.groupEnd(); // Fecha grupo principal.
    } catch (e) {
      console.warn('[ATP] Falha ao logar regras:', e);
    }
  }
// ==============================
  // Logger de conflitos (console)
  // ==============================

  const ATP_CONFLICT_LOG = (window.__ATP_CONFLICT_LOG = window.__ATP_CONFLICT_LOG || { enabled: true, logged: new Set() }); // Controle global do log.

  function logConflictRead(baseRule, otherRule, rec) { // Log detalhado do conflito no console (com dedupe).
    try { // Proteção contra falhas.
      if (!ATP_CONFLICT_LOG.enabled) return; // Se desativado, não loga.
      const tipos = Array.from(rec?.tipos || []); // Tipos de conflito.
      const iNum = String(rec?.iNum ?? baseRule?.num ?? ''); // Número A.
      const jNum = String(rec?.jNum ?? otherRule?.num ?? ''); // Número B.
      const key = `${iNum}=>${jNum}|${tipos.join(',')}`; // Chave de dedupe.
      if (ATP_CONFLICT_LOG.logged.has(key)) return; // Já logado.
      ATP_CONFLICT_LOG.logged.add(key); // Marca como logado.

      console.groupCollapsed(`[ATP][Conflito] ${iNum} x ${jNum} :: ${tipos.join(' | ')}`); // Cabeçalho.
      console.log('Regra A (base):', baseRule || null); // Regra base.
      console.log('Regra B (outra):', otherRule || null); // Regra outra.

      const motivos = {}; // Motivos por tipo.
      if (rec?.motivosByTipo && typeof rec.motivosByTipo.forEach === 'function') { // Se há mapa...
        rec.motivosByTipo.forEach((set, tipo) => { motivos[tipo] = Array.from(set || []); }); // Converte sets.
      }
      console.log('Motivos detectados:', motivos); // Motivos.
      console.log('Impacto máximo:', rec?.impactoMax || null); // Impacto.
      console.groupEnd(); // Fecha grupo.
    } catch (e) { // Em erro...
      console.warn('[ATP] Falha ao logar conflito:', e); // Não quebra execução.
    }
  }
// ==============================


  function removeAlternarUI(root) { // Remove controles "[ + Expandir ]" do eProc
    if (!root || !root.querySelectorAll) return; // Guard.
    try {
      root.querySelectorAll('span[id^="alternarVisualizacao"], a[href*="alternarVisualizacaoLista"]').forEach(n => n.remove());
    } catch { /* noop */ }
  }

function stripExpandArtifacts(root) { // Remove reticências "..." do truncamento visual
    if (!root) return; // Guard.
    try {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      for (const tn of nodes) {
        const txt = String(tn.textContent || '');
        if (/^\s*\.\.\.\s*$/.test(txt)) { tn.textContent = ' '; continue; }
        tn.textContent = txt.replace(/\.\.\.\s*$/g, '');
      }
    } catch { /* noop */ }
  }

// ==============================

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
function extrairLocalizadorIncluirAcao(tdIncluir) { // Extrai o "Destino da ação" (INCLUIR) como expressão {canonical, clauses}.
  if (!tdIncluir) return { canonical: '', clauses: [] }; // Guard.

  // 1) Prioridade: dadosCompletos_*
  const divComp = tdIncluir.querySelector('div[id^="dadosCompletos_"]');
  if (divComp) {
    const root = divComp.cloneNode(true); // Clona só o conteúdo completo.
    removeAlternarUI(root); // Remove UI de expandir (se existir).
    stripExpandArtifacts(root); // Remove artefatos tipo "... [ + Expandir ]" (por segurança).
    return parsearExpressaoLogicaLocalizadores(root); // Trata E/OU e retorna {canonical, clauses}.
  }

  // 2) Fallback: usa o conteúdo do td (como sua função antiga), mas agora retornando expressão
  // Mantém a regra de pegar antes do <br><br> (ou dois <br>)
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
  if (expr && expr.canonical) return expr;

  // Se não der para parsear, usa texto simples
  const txt = clean(clone.textContent || '');
  if (!txt) return { canonical: '', clauses: [] };
  return { canonical: txt, clauses: [new Set([txt])] };
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
  const mapControleByLabel = (label) => {
    const L = clean(label || '').toLowerCase();
    if (!L) return '';
    // exemplos possíveis
    if (L.startsWith('evento')) return 'Por Evento';
    if (L.startsWith('peti')) return 'Por Petição';
    if (L.startsWith('document')) return 'Por Documento';
    return ''; // desconhecido
  };

  // Função: remove prefixo "EVENTO -", "PETIÇÃO -", "DOCUMENTO -"
  const stripPrefix = (t) => {
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

  const root = (() => {
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

  const txt = (n) => clean((n && (n.textContent || n.innerText)) || '');

  const isConnector = (el) => {
    if (!el || el.nodeType !== 1) return false;
    const t = txt(el);
    if (!(t === 'E' || t === 'OU')) return false;
    return !!(el.matches && el.matches('span[style*="font-weight:bold"], span.font-weight-bold, b, strong'));
  };

  const isLabel = (el) => {
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

  const labelKey = (labelText) => normalizarChave(labelText);

  const extractGroup = (groupEl) => {
    const tokens = []; // {type:'term'|'op', ...}
    let currentKey = null;
    let buf = '';

    const flush = () => {
      const v = clean(buf);
      if (currentKey && v) {
        const term = `${currentKey}=${v}`;
        tokens.push({ type: 'term', key: currentKey, value: v, term });
      }
      buf = '';
    };

    // DFS que respeita label/conector e acumula textos como valores
    const walk = (node) => {
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

    const pushClause = () => {
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


  function extractTextIgnoringNodes(root, ignoreSelectors) { // Extrai texto de um nó ignorando alguns elementos.
    if (!root) return ''; // Guard.
    const clone = root.cloneNode(true); // Clona para não mexer no DOM real.
    try { // Proteção.
      (ignoreSelectors || []).forEach(sel => { // Para cada seletor...
        clone.querySelectorAll(sel).forEach(n => n.remove()); // Remove.
      });
    } catch { /* noop */ }
    return clean(clone.innerText || clone.textContent || ''); // Retorna texto limpo.
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

  const pushClause = () => {
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

  const exprOverlaps = (a, b) => { // True se há interseção de termos (OR de singletons).
    const A = exprTermSet(a);
    const B = exprTermSet(b);
    if (!A.size || !B.size) return true; // Sem termos => trata como coringa.
    for (const t of A) if (B.has(t)) return true;
    return false;
  };


  // ==========================================================
  // Captura de dados (copiado/adaptado do 2.18.15 estável)
  // - Extrai "Outros Critérios" em mapa (label->valor)
  // ==========================================================

  function normalizarChave(label) { // Normaliza um label para virar chave estável do mapa.
    if (!label) return null; // Sem label, sem chave.
    let key = String(label).replace(/:/g, "").trim(); // Remove ":" e corta espaços.
    key = rmAcc(key).toLowerCase(); // Remove acentos e baixa.
    key = key.replace(/[^a-z0-9]+/g, ""); // Mantém só alfanum.
    return key || null; // Retorna ou null.
  }




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

    `; // CSS mínimo (sem features paralelas).
    document.head.appendChild(st); // Aplica no <head>.
  }

function ensureColumns(table) { // DataTables-safe: garante contagem consistente no THEAD e TBODY (inclui COLSPAN)
    try {
      const thead = table.tHead || table.querySelector('thead');
      if (!thead) return;

      // 1) Descobre se a coluna já existe (por data-atp-col ou pelo texto)
      const allTh = Array.from(thead.querySelectorAll('th'));
      const thExisting =
        allTh.find(th => th && th.dataset && th.dataset.atpCol === 'conflita-th') ||
        allTh.find(th => /Conflita com/i.test(th.textContent || ''));

      // Se já existir, só garante a marcação
      if (thExisting) {
        try { thExisting.dataset.atpCol = 'conflita-th'; } catch (e) {}
      }

      // 2) Para cada linha do THEAD, garante 1 TH correspondente
      const headRows = Array.from(thead.querySelectorAll('tr'));
      headRows.forEach((tr, idx) => {
        const ths = Array.from(tr.children).filter(n => n && n.tagName === 'TH');

        const has =
          ths.some(th => th.dataset && th.dataset.atpCol === 'conflita-th') ||
          ths.some(th => /Conflita com/i.test(th.textContent || ''));

        if (has) return;

        const th = document.createElement('th');
        th.dataset.atpCol = 'conflita-th';

        // Só a PRIMEIRA linha recebe o título; as demais ficam vazias
        if (idx === 0) {
          th.textContent = 'Conflita com / Tipo';
          th.style.whiteSpace = 'nowrap';
        } else {
          th.textContent = '';
        }

        tr.appendChild(th);
      });

      // Helper: conta colunas "efetivas" considerando colspan
      const effectiveCellCount = (cells) => {
        let n = 0;
        cells.forEach(c => {
          const cs = parseInt(c.getAttribute('colspan') || '1', 10);
          n += (isFinite(cs) && cs > 1) ? cs : 1;
        });
        return n;
      };

      // 3) Garante que cada TR do TBODY tenha a quantidade correta (considerando colspan)
      const firstHeadRow = headRows[0] || (thead.rows ? thead.rows[0] : null);
      const expectedCols = firstHeadRow ? effectiveCellCount(Array.from(firstHeadRow.children)) : null;

      const bodies = table.tBodies && table.tBodies.length
        ? Array.from(table.tBodies)
        : [table.querySelector('tbody')].filter(Boolean);

      const rows = bodies.flatMap(tb => Array.from(tb.rows));

      rows.forEach(tr => {
        if (!tr || tr.nodeType !== 1) return;

        const tds = Array.from(tr.children).filter(n => n && n.tagName === 'TD');
        if (!tds.length) return;

        // Caso DataTables: linha "vazia" costuma ser 1 TD com COLSPAN
        if (expectedCols && tds.length === 1) {
          const only = tds[0];
          const cs = parseInt(only.getAttribute('colspan') || '1', 10);
          if (isFinite(cs) && cs >= 1 && cs !== expectedCols) {
            // Ajusta colspan para bater com o total esperado (inclui nossa coluna)
            only.setAttribute('colspan', String(expectedCols));
            return;
          }
        }

        // Se já tem nosso TD marcado, ok
        if (tr.querySelector('td[data-atp-col="conflita"]')) {
          // mas ainda garante colspan de alguma célula que cubra tudo (caso raro)
          return;
        }

        if (!expectedCols) {
          // Fallback: adiciona 1 TD no fim
          const td = document.createElement('td');
          td.dataset.atpCol = 'conflita';
          tr.appendChild(td);
          return;
        }

        const eff = effectiveCellCount(tds);
        if (eff < expectedCols) {
          // Completa faltantes com TDs simples
          const missing = expectedCols - eff;
          for (let k = 0; k < missing; k++) {
            const td = document.createElement('td');
            if (k === missing - 1) td.dataset.atpCol = 'conflita'; // marca o último como nossa coluna
            tr.appendChild(td);
          }
        } else if (eff > expectedCols) {
          // Se sobrou coluna (muito raro), tenta remover nosso TD extra se existir no fim
          const last = tds[tds.length - 1];
          if (last && (last.dataset && last.dataset.atpCol === 'conflita')) {
            last.remove();
          }
        } else {
          // eff == expectedCols: adiciona nossa célula (1 TD) só se o row não tinha (caso: colspan compensando)
          const td = document.createElement('td');
          td.dataset.atpCol = 'conflita';
          tr.appendChild(td);
        }
      });

      injectStyle(); // Garante CSS.
    } catch (e) {}
  }

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

function parsePriority(p) { // Converte prioridade em objeto (numérico quando possível).
    const s = String(p ?? '').trim(); // Normaliza string.
    const m = s.match(/\d+/); // Extrai dígitos.
    return m ? { raw: s, num: Number(m[0]), text: s } : { raw: s || '[*]', num: null, text: s || '[*]' }; // Retorna com num ou null.
  }

  // ==============================
  // OUTROS CRITÉRIOS: extrair como mapa {chave: valor}
  // ==============================

  function normKey(label) { // Normaliza label para chave estável.
    const k = (label || '').replace(/:/g, '').trim(); // Remove ":" e trim.
    const noAcc = rmAcc(k).toLowerCase(); // Remove acento e baixa.
    return noAcc.replace(/[^a-z0-9]/g, '') || null; // Mantém só alfanumérico.
  }


function splitVals(raw) { // Converte "a, b | c" etc em Set normalizado.
    const base = rmAcc(lower(raw || '')) // Normaliza: remove acento e baixa.
      .replace(/[.;]\s*$/, '') // Remove pontuação final.
      .replace(/\s{2,}/g, ' ') // Colapsa espaços.
      .trim(); // Trim.
    if (!base) return new Set(); // Sem base, retorna set vazio.
    const tokens = base.split(/;|\||,|\s+ou\s+|\s+e\s+/i).map(s => s.trim()).filter(Boolean); // Separa por delimitadores comuns.
    return new Set(tokens); // Retorna set único.
  }

function criteriaToStructure(criteriaMap) { // Converte {k: "a,b"} em Map<k, Set(vals)>.
    const grupos = new Map(); // Mapa de grupos.
    Object.entries(criteriaMap || {}).forEach(([k, v]) => { // Itera critérios.
      if (!v) return; // Ignora vazio.
      const set = splitVals(v); // Quebra valores.
      if (!grupos.has(k)) grupos.set(k, new Set()); // Garante set.
      set.forEach(x => grupos.get(k).add(x)); // Adiciona valores.
    });
    return grupos; // Retorna estrutura.
  }

function setsEqual(a, b) { // Compara Sets.
    if (a.size !== b.size) return false; // Tamanhos diferentes => falso.
    for (const v of a) if (!b.has(v)) return false; // Algum elemento não existe => falso.
    return true; // Igual.
  }

function criteriaEqual(A, B) { // Compara Map<k,Set> por igualdade.
    if (A.size !== B.size) return false; // Diferente em número de chaves => falso.
    for (const [k, setA] of A.entries()) { // Para cada chave...
      const setB = B.get(k); // Pega set do outro.
      if (!setB || !setsEqual(setA, setB)) return false; // Se não existe ou difere => falso.
    }
    return true; // Igual.
  }

function criteriaSubAinB(A, B) { // Verifica se A ⊆ B (A mais ampla; B mais restrita).
    for (const [k, setA] of A.entries()) { // Para cada chave em A...
      const setB = B.get(k); // Precisa existir em B.
      if (!setB) return false; // Se não existe, não é subset.
      for (const v of setA) if (!setB.has(v)) return false; // Cada valor de A precisa estar em B.
    }
    // B precisa ter algo "a mais" para ser considerada mais restrita.
    const hasMoreKeys = (B.size > A.size); // B tem mais chaves.
    const hasMoreVals = Array.from(B.entries()).some(([k, setB]) => (A.get(k)?.size ?? 0) < setB.size); // B tem mais valores em alguma chave.
    return hasMoreKeys || hasMoreVals; // Retorna se B é mais restrita.
  }


  // ============================================================
  // Tooltip (descrição fixa por tipo de conflito) - padrão eProc
  // ============================================================
  const ATP_TIPOS_TOOLTIPS = {
    'COLISÃO TOTAL': 'COLISÃO TOTAL = Quando "Prioridade", "Localizador REMOVER", "Tipo de Controle / Critério" e "Outros Critérios" são iguais.',
    'COLISÃO PARCIAL': 'COLISÃO PARCIAL = Quando "Localizador REMOVER", "Tipo de Controle / Critério" e "Outros Critérios" são iguais, mas a "Prioridade" é diferente.',
    'SOBREPOSIÇÃO': 'SOBREPOSIÇÃO = Quando "Localizador REMOVER", "Tipo de Controle / Critério" são iguais, mas a "Prioridade" de A é menor que a "Prioridade" de B.',
    'POSSÍVEL SOBREPOSIÇÃO': 'POSSÍVEL SOBREPOSIÇÃO = Quando "Localizador REMOVER", "Tipo de Controle / Critério" são iguais, mas a "Prioridade" de A e B são indefinidas.',
    'PERDA DE OBJETO': 'PERDA DE OBJETO = Quando "Localizador REMOVER", "Tipo de Controle / Critério" são iguais, mas a "Prioridade" de A é menor que à "Prioridade" de B e A tem como comportamento do localizador "Remover o processo do(s) localizador(es) informado(s)."'
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
    'PERDA DE OBJETO = Quando uma regra anterior remove o localizador (REMOVER informados) que a regra seguinte precisaria para se aplicar.',
    '',
    'LOOPING = Quando regras se retroalimentam (ciclo), gerando efeito repetido de incluir/remover.',
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

  function relationOutros(ruleA, ruleB) { // Compara "Outros Critérios" considerando AND entre grupos (ml-0 pt-2).
  // Retorno:
  // - 'identicos'      => mesmos grupos (independente da ordem)
  // - 'A_mais_ampla'   => A é mais ampla (menos ou igual restrições) e B tem restrições a mais
  // - 'B_mais_ampla'   => B é mais ampla
  // - 'diferentes'     => não comparável com segurança (grupos distintos sem relação de subconjunto)
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

  function parseTooltipMsg(onm) { // Extrai mensagem do infraTooltipMostrar(...) de forma tolerante.
    const raw = String(onm || ''); // Garante string.
    // Tenta capturar 1º argumento (msg) aceitando aspas simples OU duplas.
    const m = raw.match(/infraTooltipMostrar\(\s*(?:'([^']*)'|"([^"]*)")\s*,\s*(?:'Comportamento do Localizador REMOVER'|"Comportamento do Localizador REMOVER")/); // Regex tolerante.
    const msg = m ? (m[1] ?? m[2] ?? '') : ''; // Pega grupo 1 ou 2.
    // Alguns trechos vêm HTML-escapados no atributo (ex.: &#39;), então tentamos decodificar.
    let decoded = msg; // Valor base.
    try { decoded = msg.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>'); } catch { } // Decode simples.
    return clean(decoded); // Retorna texto limpo.
  }

function removerPlainToWildcard(td) { // Detecta casos simples onde o texto indica "coringa" (ex.: Nenhum / Todos os localizadores).
    const t = clean(td && td.textContent || ''); // Texto.
    return (t === 'Nenhum' || t === 'Todos os localizadores'); // Retorna se é coringa.
  }

function doesRemove(removerText) { // Decide se a regra "remove" (true) ou só adiciona (false).
    const canon = (removerText && typeof removerText === 'object') ? (removerText.canonical || '') : (removerText || ''); // Suporta expr.
    const s = rmAcc(lower(canon)); // Normaliza.
    if (!s) return false; // Sem texto => assume que não remove.
    if (/\bnao\s+remover\b/.test(s) || /\bnão\s+remover\b/.test(s)) return false; // Detecta "não remover".
    if (/apenas\s+acrescentar/.test(s)) return false; // Detecta "apenas acrescentar".
    return /remover\s+.*localizador|remover\s+todos|remover\s+o\s+processo/.test(s); // Heurística de remover.
  }

  // ==============================
  // Parser: extrai regras da tabela
  // ==============================

  // ======================================================================
  // CAPTURA DAS REGRAS DA TABELA (HTML -> objetos)
  // ======================================================================


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

              // PERDA DE OBJETO / SOBREPOSIÇÃO: se ocorrer perda, mostra APENAS "Perda de Objeto".
              const beh = normMsg(exprCanon(earlier.comportamentoRemover, ''));
              if (beh === MSG_PERDA_OBJETO) {
                upsert(later.num, earlier.num, 'Perda de Objeto', 'Alto',
                  `Mesmo Localizador REMOVER e mesmo Tipo de Controle / Critério; ${detalheOutros}. ` +
                  `Regra ${earlier.num} (prioridade ${earlier.prioridade.text}) executa antes ` +
                  `e remove o processo do(s) localizador(es) informado(s), impedindo que sejam capturados pela regra ${later.num}. ` + sugOrdem);
              } else {
                upsert(later.num, earlier.num, 'Sobreposição', 'Médio',
                  `Mesmo Localizador REMOVER e mesmo Tipo de Controle / Critério; ${detalheOutros}. ` +
                  `Prioridade ${earlier.prioridade.text} executa antes de ${later.prioridade.text}. ` + sugOrdem);
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
    'Colisão Total': 'collision',        // Colisão => collision.
    'Colisão Parcial': 'collision',      // Colisão => collision.
    'Sobreposição': 'overlap',            // Sobreposição => overlap.
    'Possível Sobreposição': 'overlap',   // Possível Sobreposição => overlap.
    'Perda de Objeto': 'objectloss',      // Perda => objectloss.
    'Looping': 'loop'                     // Looping => loop.
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
        const others = [...adj.keys()].sort((a, b) => Number(a) - Number(b)); // Ordena.
        confTd.dataset.atpConfNums = others.join(','); // Salva para o botão comparar.

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
          html += `<div><span class="atp-conf-num">${esc(n)}:</span> ${spans}</div>`; // Linha do conflito.
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
      if (confTd.dataset.atpConfNums) confTd.appendChild(makeCompareButton(r.num, confTd)); // Adiciona botão se houver conflitos.

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

function atpEnsureReportButton(host, afterLabelEl, tableRef) {
  try {
    if (!host || host.querySelector('#btnGerarRelatorioColisoes')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'infraButton';
    btn.id = 'btnGerarRelatorioColisoes';
    btn.textContent = 'Gerar Relatório de Conflitos';

    btn.addEventListener('mouseenter', () => { btn.style.background = '#e5e7eb'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = '#f3f4f6'; });

    btn.addEventListener('click', function () {
      try {
        var table = tableRef || findTable();
        if (!table) return;

        // Garante que colunas extras / datasets estejam prontos.
        try { ensureColumns(table); } catch (e) {}
        var cols = null;
        try { cols = mapColumns(table); } catch (e) { cols = null; }

        // Reconstrói as regras (para pegar campos completos).
        var rules = [];
        try { rules = (cols ? parseRules(table, cols) : parseRules(table, mapColumns(table))); } catch (e) { rules = []; }
        var ruleByNum = new Map((rules || []).map(function (r) { return [String(r.num), r]; }));

        function fmtExpr(expr) {
          if (!expr) return '';
          if (typeof expr === 'string') return clean(expr);
          if (expr.canonical) return clean(expr.canonical);
          return clean(String(expr.text || expr.raw || ''));
        }

        function fmtOutros(outros) {
          if (!outros) return '';
          try {
            var entries = Object.entries(outros);
            if (!entries.length) return '';
            return entries.map(function (kv) {
              var k = clean(kv[0]);
              var v = clean(kv[1]);
              return k + ': ' + v;
            }).join(' | ');
          } catch (e) {
            return clean(String(outros));
          }
        }

        // Pega todas as células de conflito renderizadas pelo script.
        var cells = Array.from(table.querySelectorAll('td[data-atp-col="conflita"]'));

        // Monta registros A x B (DEDUP por par + tipo)
        var records = [];
        var countsByTipo = Object.create(null);
        var seenPairs = new Set();

        function pairKey(tipo, a, b) {
          var an = Number(a), bn = Number(b);
          if (Number.isFinite(an) && Number.isFinite(bn)) {
            var lo = Math.min(an, bn);
            var hi = Math.max(an, bn);
            return String(tipo) + '|' + String(lo) + '|' + String(hi);
          }
          var as = String(a || '');
          var bs = String(b || '');
          var loS = (as <= bs) ? as : bs;
          var hiS = (as <= bs) ? bs : as;
          return String(tipo) + '|' + loS + '|' + hiS;
        }

        cells.forEach(function (td) {
          if (!td) return;
          var tr = td.closest('tr');
          if (!tr) return;

          // Descobre o nº da regra A (pela coluna Nº/Prioridade, quando possível)
          var numA = '';
          try {
            if (cols && typeof cols.idxNum === 'number' && cols.idxNum >= 0) {
              var tds = tr.querySelectorAll('td');
              var tdNum = tds[cols.idxNum];
              numA = tdNum ? clean(tdNum.textContent || '') : '';
            }
            // fallback: tenta achar algum número na linha
            if (!numA) {
              var raw = clean(tr.textContent || '');
              var mm = raw.match(/\b(\d{1,6})\b/);
              if (mm) numA = mm[1];
            }
          } catch {}

          // Cada <div> representa um conflito B para essa regra A
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

            // Extrai sugestões do texto (padrão: "Sugestão: ...") para exportar em seção própria.
            var sugestoes = [];
            try {
              var reSug = /Sugest[aã]o:\s*([^|]+)(?:\||$)/gi;
              var m;
              while ((m = reSug.exec(pqRaw)) !== null) {
                var s = clean(m[1] || '');
                if (s) sugestoes.push(s);
              }
            } catch {}

            // Remove os trechos de sugestão do "por quê" técnico (mantém só o diagnóstico).
            var pq = String(pqRaw || '')
              .replace(/\s*(\|\s*)?Sugest[aã]o:\s*[^|]+/gi, '')
              .replace(/\s*\|\s*/g, ' | ')
              .trim();
            pq = pq.replace(/^\|\s*|\s*\|$/g, '').trim();

            if (!tipo) return;

            var aVal = numA || '(não identificado)';
            var bVal = numB || '(não identificado)';
            var keyTipo = String(tipo);

            // Dedup por (tipo + par A/B canônico)
            var k = pairKey(keyTipo, aVal, bVal);
            if (seenPairs.has(k)) return;
            seenPairs.add(k);

            // Contagem por tipo (já deduplicado)
            countsByTipo[keyTipo] = (countsByTipo[keyTipo] || 0) + 1;

            // Definição (tooltip padrão do tipo)
            var def = '';
            try { def = getTipoTooltip(tipo) || ''; } catch {}
            def = String(def || '').replace(/<br\s*\/?>/gi, '\n').trim();

            // Normaliza A/B para sempre sair "menor x maior" no relatório (evita contradição visual)
            var an = Number(aVal), bn = Number(bVal);
            var normA = aVal, normB = bVal;
            if (Number.isFinite(an) && Number.isFinite(bn) && an > bn) {
              normA = bVal;
              normB = aVal;
            } else if (!Number.isFinite(an) || !Number.isFinite(bn)) {
              if (String(aVal) > String(bVal)) {
                normA = bVal;
                normB = aVal;
              }
            }

            records.push({
              a: normA,
              b: normB,
              tipo: keyTipo,
              impacto: impacto,
              def: def,
              pq: pq,
              sugestoes: sugestoes
            });
          });
        });

        // Ordena só para ficar estável (A, depois B, depois Tipo)
        records.sort(function (x, y) {
          var ax = Number(x.a), ay = Number(y.a);
          if (Number.isFinite(ax) && Number.isFinite(ay) && ax !== ay) return ax - ay;
          if (String(x.a) !== String(y.a)) return String(x.a).localeCompare(String(y.a));
          var bx = Number(x.b), by = Number(y.b);
          if (Number.isFinite(bx) && Number.isFinite(by) && bx !== by) return bx - by;
          if (String(x.b) !== String(y.b)) return String(x.b).localeCompare(String(y.b));
          return String(x.tipo).localeCompare(String(y.tipo));
        });

        // Formata no layout "antigo" desejado
        var lines = [];
        lines.push('Relatório de Colisões (ATP / eProc)');
        lines.push('Data/Hora: ' + (new Date()).toLocaleString());
        // lines.push('URL: ' + location.href);
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
          lines.push('Regra A(' + r.a + ') x Regra B(' + r.b + ')');
          lines.push('Tipo: ' + r.tipo);
          if (r.def) {
            lines.push('Definição: ' + r.def);
          }
          if (r.pq) {
            lines.push('Colisão: ' + r.pq);
          }
          if (r.sugestoes && r.sugestoes.length) {
            lines.push('Sugestão:');
            r.sugestoes.forEach(function (s) {
              lines.push('- ' + s);
            });
          }
        });

        if (!records.length) {
          lines.push('');
          lines.push('Nenhuma colisão foi encontrada.');
        }

        var content = lines.join('\n');
        var blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'relatorio_colisoes_ATP.txt';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () {
          try { URL.revokeObjectURL(url); } catch (e) {}
          try { a.remove(); } catch (e) {}
        }, 0);
      } catch (e) {
        console.warn(LOG_PREFIX, 'Falha ao gerar relatório:', e);
      }
    });

    // Insere depois do label
    if (afterLabelEl && afterLabelEl.parentNode === host) {
      host.insertBefore(btn, afterLabelEl.nextSibling);
    } else {
      host.appendChild(btn);
    }
  } catch {}
}




function addOnlyConflictsCheckbox(table, onToggle) { // Adiciona checkbox no bloco de filtros + botão de relatório.
    const host = document.getElementById('dvFiltrosOpcionais'); // Container de filtros do eProc.
    if (!host) return;

    // Se já existe o checkbox/label, só garante o botão do relatório após o label.
    const existingCb = host.querySelector('#chkApenasConflitoSlim');
    const existingLb = host.querySelector('label[for="chkApenasConflitoSlim"]');
    if (existingCb && existingLb) {
      atpEnsureReportButton(host, existingLb, table);
      return;
    }
    if (existingCb) return; // Segurança: checkbox já existe mas label ainda não, não duplica.

    host.appendChild(document.createTextNode(' ')); // Espaço.

    const cb = document.createElement('input');
    cb.type = 'radio';
    cb.id = 'chkApenasConflitoSlim';
    cb.className = 'infraRadio';
    cb.style.marginLeft = '12px';

    const lb = document.createElement('label');
    lb.setAttribute('for', 'chkApenasConflitoSlim');
    lb.className = 'infraLabelCheckBox';
    lb.style.verticalAlign = 'middle';
    lb.style.cursor = 'help';
    lb.textContent = 'Apenas regras com conflito';

    // Tooltip mini-help no label
    lb.addEventListener('mouseenter', () => {
      try {
        const msg = String(ATP_MINI_HELP_TIP || '').replace(/\r?\n/g, '<br>');
        if (typeof window.infraTooltipMostrar === 'function') {
          window.infraTooltipMostrar(msg, 'Ajuda rápida (ATP)', 720);
        } else {
          lb.setAttribute('title', String(ATP_MINI_HELP_TIP || ''));
        }
      } catch {}
    });
    lb.addEventListener('mouseleave', () => {
      try { if (typeof window.infraTooltipOcultar === 'function') window.infraTooltipOcultar(); } catch {}
    });

    cb.addEventListener('change', () => { // Evento.
      onlyConflicts = cb.checked; // Atualiza estado.
      onToggle(); // Dispara callback.
    });

    host.appendChild(cb); // Anexa checkbox.
    host.appendChild(lb); // Anexa label.

    // Botão do relatório vem DEPOIS do label.
    atpEnsureReportButton(host, lb, table);
  }

  // ==============================
  // Runner: recalcular com debounce simples
  // ==============================

  let tDebounce = null; // Timer de debounce.
  let ATP_SUPPRESS_OBSERVER = false; // Evita loop: render->MutationObserver->recalc.
  function schedule(fn, wait = 200) { // Debounce simples por setTimeout.
    if (tDebounce) clearTimeout(tDebounce); // Cancela anterior.
    tDebounce = setTimeout(fn, wait); // Agenda novo.
  }

function recalc(table) { // Recalcula tudo (parse -> analyze -> render).
    if (!document.body.contains(table)) return; // Se tabela sumiu do DOM, não faz nada.
    // Evita mexer na estrutura durante redraw/processamento do DataTables (reduz TN/18 intermitente)
    if (table.classList && table.classList.contains('dataTable') && table.querySelector('.dataTables_processing')) {
      schedule(() => recalc(table), 250);
      return;
    }
    // Só garante/insere colunas ANTES do DataTables inicializar.
    if (!(table.classList && table.classList.contains('dataTable')) && !table.closest('.dataTables_wrapper')) {
      ensureColumns(table);
    }
    const cols = mapColumns(table); // Mapeia colunas.
    updateAllRemoverLupasByTooltipText(table); // Troca lupas do REMOVER por emoji (mantendo tooltip).
    replacePlainRemoverTextInTable(table, cols); // Para linhas sem lupa, tenta inserir emoji.
    const rules = parseRules(table, cols);
    // Loga todas as regras capturadas (console).
    if (typeof logAllRules === "function") logAllRules(rules); // Extrai regras. // Extrai regras.
    if (!rules.length) { try { markATPRenderTick(); } catch (e) {} return; } // Se nada, sai.
    const conflicts = analyze(rules); // Analisa conflitos.
    render(table, rules, conflicts);
    try { markATPRenderTick(); } catch (e) {}
// Renderiza.
  }

  // ==============================
  // Descoberta da tabela e inicialização
  // ==============================

  function findTable() { // Tenta achar a tabela pelo ID; fallback por "parecido".
    const direct = document.getElementById(TABLE_ID); // Busca direta.
    if (direct) return direct; // Se achou, retorna.
    const candidates = Array.from(document.querySelectorAll('table')); // Todas tabelas.
    const wanted = [ // Heurística: padrões que o header deve ter.
      /n[ºo]\s*\/?\s*prioridade/i, // Cabeçalho Nº/Prioridade.
      /localizador.*remover/i, // Cabeçalho remover.
      /tipo.*(controle|crit[ée]rio)/i, // Cabeçalho tipo/critério.
      /localizador.*(incluir|a[cç][aã]o)/i, // Cabeçalho incluir/ação.
      /outros\s*crit[ée]rios/i // Cabeçalho outros critérios.
    ];
    let best = null; // Melhor candidata.
    let bestScore = 0; // Pontuação.
    for (const c of candidates) { // Para cada tabela...
      const ths = Array.from((c.tHead || c).querySelectorAll('th')); // Pega THs.
      if (!ths.length) continue; // Sem THs, ignora.
      const text = ths.map(th => clean(th.textContent)).join(' | '); // Texto do header.
      const score = wanted.reduce((acc, re) => acc + (re.test(text) ? 1 : 0), 0); // Conta quantos padrões bate.
      if (score > bestScore) { best = c; bestScore = score; } // Atualiza melhor.
    }
    return (bestScore >= 3) ? best : null; // Exige pelo menos 3 padrões para aceitar.
  }

function waitTable(timeoutMs = 120000) { // Espera a tabela aparecer (SPA/AJAX) via MutationObserver.
    const direct = findTable(); // Tenta achar já.
    if (direct) return Promise.resolve(direct); // Se achou, resolve.
    return new Promise(resolve => { // Cria promise.
      const mo = new MutationObserver(() => { // Observa mudanças no DOM.
        const tb = findTable(); // Tenta achar de novo.
        if (tb) { mo.disconnect(); resolve(tb); } // Achou => desconecta e resolve.
      });
      mo.observe(document.body, { childList: true, subtree: true }); // Observa árvore toda.
      setTimeout(() => { mo.disconnect(); resolve(null); }, timeoutMs); // Timeout: resolve null.
    });
  }

  async function init() { // Inicialização principal.
    injectStyle(); // Injeta CSS desde já.
    const table = await waitTable(); // Aguarda tabela.
    if (!table) return; // Se não achou, aborta.
    ensureColumns(table); // Garante colunas extras.
    updateAllRemoverLupasByTooltipText(table); // Troca lupas do REMOVER por emoji (mantendo tooltip).
    addOnlyConflictsCheckbox(table, () => schedule(() => applyFilter(table), 0)); // Checkbox de filtro.
    recalc(table); // Primeira execução.
    table.addEventListener('change', () => schedule(() => recalc(table), 200), true); // Recalcula quando altera select/checkbox.
    const root = table.parentElement || document.body; // Observa um escopo menor quando possível.
    const mo = new MutationObserver(() => {
      if (ATP_SUPPRESS_OBSERVER) return; // Ignora mutações causadas pelo próprio script.
      schedule(() => recalc(table), 250);
    }); // Observa mudanças (ex.: paginação, AJAX).
    mo.observe(root, { childList: true, subtree: true }); // Ativa observer.
  }

  init(); // Executa init.
})(); // Fim do IIFE.
