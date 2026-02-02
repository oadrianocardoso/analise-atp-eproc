// ==UserScript==
// @name         Análise de ATP eProc
// @namespace    https://tjsp.eproc/automatizacoes
// @version      9.0
// @description  Análise de conflitos de ATP (Colisão, Sobreposição, Perda de Objeto e Looping)
// @author       ADRIANO AUGUSTO CARDOSO E SANTOS
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
 *    - Quando há PERDA DE OBJETO, o script mantém o rótulo de SOBREPOSIÇÃO
 *      (pois há cobertura/ordem) e ADICIONA também o rótulo "Perda de Objeto"
 *      (modo analítico: exibe todos os tipos aplicáveis).
 *
 * -----------------------------------------------------------------------------------------
 *
 * 6) CONTRADIÇÃO
 *    Ocorre quando a PRÓPRIA regra contém critérios mutuamente exclusivos no mesmo
 *    ramo lógico (conector "E" / AND), tornando a regra logicamente impossível
 *    ou inválida.
 *
 *    Exemplos comuns:
 *    - Seleção simultânea de condições COM e SEM o mesmo atributo
 *      (ex.: prazo, representação processual, procurador, etc.).
 *    - Estados incompatíveis do mesmo campo
 *      (ex.: "Justiça Gratuita-Deferida" E "Justiça Gratuita-Indeferida").
 *    - Condições exclusivas no mesmo polo
 *      (ex.: APENAS UMA parte e MAIS DE UMA parte no mesmo polo).
 *
 *    Efeito:
 *    - A regra não consegue encontrar nenhum processo válido ou se torna
 *      praticamente inexecutável.
 *
 *    Sugestão:
 *    - Remover seleções incompatíveis ou dividir a lógica em regras distintas.
 *
 * -----------------------------------------------------------------------------------------
 *
 * 7) LOOPING POTENCIAL (opcional)
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

  const LOG_PREFIX = '[ATP]';

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
    'Looping Potencial': 5, // Crítico.
    'Contradição': 5, // Crítico (regra inexecutável/auto-contraditória).
    'Quebra de Fluxo': 4, // Médio/alto (ação sem saída de fluxo).
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
      const dtOn = (table.classList && table.classList.contains('dataTable')) || table.closest('.dataTables_wrapper');
      if (!dtOn) {
        try { ensureColumns(table); } catch (e) {}
      }ensureSortUI(table);
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

          localizadorIncluirAcoes: (r?.localizadorIncluirAcao && Array.isArray(r.localizadorIncluirAcao.acoes)) ? r.localizadorIncluirAcao.acoes : [],
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

      const isBlue = (d) => {
        const st = String(d.getAttribute('style') || '').toLowerCase();
        return st.includes('color: blue') && st.includes('font-weight: bold');
      };
      const isBlackStage = (d) => {
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
        const isStageNode = (node) => {
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

        const pushVar = (nome, valor) => {
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
  // -----------------------------------------------------------------------------
  // DI helpers – garantem setas sempre conectadas (centro → centro, com dobra em L)
  // -----------------------------------------------------------------------------
  function atpCenter(shape) {
    return {
      x: shape.x + shape.width / 2,
      y: shape.y + shape.height / 2
    };
  }

  // Portas laterais (evita conexão na borda superior/inferior)
  function atpSidePort(shape, side) {
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
  function atpHumanizeOutrosCriteriosExpr(outrosExpr) {
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

function setsEqual(a, b) { // Compara Sets.
    if (a.size !== b.size) return false; // Tamanhos diferentes => falso.
    for (const v of a) if (!b.has(v)) return false; // Algum elemento não existe => falso.
    return true; // Igual.
  }

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


  function detectContradictions(rule) { // Detecta contradições internas (self) em Outros Critérios, baseadas nos selects do front-end.
    const oc = rule?.outrosCriterios;
    const groups = oc?.groups || [];
    const motivos = [];

    // Helpers
    const norm = (s) => clean(String(s || '')).toLowerCase();
    const add = (msg) => { if (msg && !motivos.includes(msg)) motivos.push(msg); };

    // Detecta contradição dentro de um "ramo" (clause) — ou seja, termos ligados por AND.
    const analyzeClause = (terms, contextLabel) => {
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
        const normKey = (s) => clean(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

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

        const matchAnyRemBranch = (() => {
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


// ============================================================
// EXTRATO DE FLUXOS (texto estilo IF/THEN, fechamento completo)
// ============================================================
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
  // nodes: array<string>, edgesMap: Map<string, Array<string>>
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

function atpBuildFluxosText(rules) {
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

    function expandFrom(seed) {
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
      function flowIndent(level) {
        // Indentação por blocos (apenas espaços), para leitura leiga.
        // Cada nível = 2 espaços.
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

      function dfsFlowFrom(nodeKey, level, pathSet) {
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
function atpComputeFluxosData(rules) {
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

function atpEnsureGroupedViewStyles() {
  if (document.getElementById('atpFluxosGroupedStyles')) return;
  const style = document.createElement('style');
  style.id = 'atpFluxosGroupedStyles';
  style.textContent = `
    #atpFluxosGroupedView { border:1px solid #e5e7eb; border-radius:10px; margin-top:10px; background:#fff; }
    #atpFluxosGroupedTopbar { display:flex; gap:8px; align-items:center; justify-content:space-between; padding:10px 12px; border-bottom:1px solid #e5e7eb; background:#f9fafb; }
    #atpFluxosGroupedTopbar .left { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
    #atpFluxosGroupedTopbar .title { font-weight:700; color:#111827; }
    .atpFlowBlock { border-top:1px solid #e5e7eb; }
    .atpFlowHeader { cursor:pointer; user-select:none; display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 12px; background:#ffffff; }
    .atpFlowHeader:hover { background:#f3f4f6; }
    .atpFlowHeader .meta { font-size:12px; color:#4b5563; }
    .atpFlowHeader .hTitle { font-weight:700; color:#111827; }
    .atpFlowBody { padding:0 12px 12px 12px; }
    .atpFlowBody[hidden] { display:none !important; }
    .atpFlowBadge { display:inline-block; font-size:11px; padding:2px 8px; border-radius:999px; border:1px solid #e5e7eb; background:#f9fafb; color:#111827; }
    .atpFlowBadgeStart { border-color:#c7d2fe; background:#eef2ff; }
    .atpFlowBadgeCycle { border-color:#fecaca; background:#fef2f2; }
    .atpMiniHint { font-size:12px; color:#6b7280; }
    .atpGroupedTableWrap { overflow:auto; border:1px solid #e5e7eb; border-radius:10px; }
    .atpGroupedTableWrap table { width:100%; }
  `;
  document.head.appendChild(style);
}

function atpIsGroupedViewActive(table) {
  return !!document.getElementById('atpFluxosGroupedView') && table && table.dataset && table.dataset.atpGroupedView === '1';
}

function atpGroupedViewOff(table) {
  try {
    const el = document.getElementById('atpFluxosGroupedView');
    if (el) el.remove();
    if (table) {
      table.style.display = '';
      table.dataset.atpGroupedView = '';
    }
  } catch (e) {}
}

function atpGroupedViewOn(table, rules, data) {
  if (!table) return;
  atpEnsureGroupedViewStyles();

  // Marca / oculta tabela original
  table.dataset.atpGroupedView = '1';
  table.style.display = 'none';

  const container = document.createElement('div');
  container.id = 'atpFluxosGroupedView';

  // Topbar
  const top = document.createElement('div');
  top.id = 'atpFluxosGroupedTopbar';

  const left = document.createElement('div');
  left.className = 'left';

  const title = document.createElement('div');
  title.className = 'title';
  title.textContent = 'Vista Agrupada por Fluxo (Opção B — teste)';

  const hint = document.createElement('div');
  hint.className = 'atpMiniHint';
  hint.textContent = 'Clique no cabeçalho do fluxo para colapsar/expandir. Esta vista clona as linhas (não altera a tabela original).';

  left.appendChild(title);
  left.appendChild(hint);

  const right = document.createElement('div');
  right.style.display = 'flex';
  right.style.gap = '8px';
  right.style.alignItems = 'center';

  const btnExpandAll = document.createElement('button');
  btnExpandAll.type='button';
  btnExpandAll.className='infraButton';
  btnExpandAll.textContent='Expandir tudo';

  const btnCollapseAll = document.createElement('button');
  btnCollapseAll.type='button';
  btnCollapseAll.className='infraButton';
  btnCollapseAll.textContent='Colapsar tudo';

  const btnBack = document.createElement('button');
  btnBack.type='button';
  btnBack.className='infraButton';
  btnBack.textContent='Voltar à tabela normal';

  btnBack.addEventListener('click', ()=> atpGroupedViewOff(table));

  right.appendChild(btnExpandAll);
  right.appendChild(btnCollapseAll);
  right.appendChild(btnBack);

  top.appendChild(left);
  top.appendChild(right);
  container.appendChild(top);

  // Agrupa regras por flowId
  const byFlow = new Map(); // flowId -> Array<rule>
  for (const r of (rules || [])) {
    const fromKeys = atpClausesToKeys(r.localizadorRemover);
    let flowId = null;
    for (const fk of fromKeys) {
      if (data.keyToFlow.has(fk)) { flowId = data.keyToFlow.get(fk); break; }
    }
    if (flowId == null) continue;
    if (!byFlow.has(flowId)) byFlow.set(flowId, []);
    byFlow.get(flowId).push(r);
  }

  function mkBadge(text, cls) {
    const b = document.createElement('span');
    b.className = 'atpFlowBadge' + (cls ? (' ' + cls) : '');
    b.textContent = text;
    return b;
  }

  const flowBlocks = [];

  (data.fluxos || []).forEach((fl, i) => {
    const rulesHere = byFlow.get(i) || [];
    // Contadores
    const uniqueLocs = new Set();
    for (const r of rulesHere) {
      const fks = atpClausesToKeys(r.localizadorRemover);
      const tks = atpClausesToKeys(r.localizadorIncluirAcao);
      fks.forEach(k=>uniqueLocs.add('F:'+k));
      tks.forEach(k=>uniqueLocs.add('T:'+k));
    }

    const isStart = (data.startKeys || []).includes((fl.starts||[])[0]);
    const badge = isStart ? mkBadge('Start', 'atpFlowBadgeStart') : mkBadge('Ciclo', 'atpFlowBadgeCycle');

    const block = document.createElement('div');
    block.className = 'atpFlowBlock';

    const header = document.createElement('div');
    header.className = 'atpFlowHeader';

    const leftH = document.createElement('div');
    leftH.style.display='flex';
    leftH.style.flexDirection='column';
    leftH.style.gap='2px';

    const t = document.createElement('div');
    t.className = 'hTitle';
    t.textContent = `FLUXO ${String(i+1).padStart(2,'0')} — Início(s): [${(fl.starts||[]).join(' | ')}]`;

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = `Regras: ${rulesHere.length} • Localizadores (aprox): ${uniqueLocs.size} • Nós(origens): ${(fl.nodes||[]).length}`;

    leftH.appendChild(t);
    leftH.appendChild(meta);

    const rightH = document.createElement('div');
    rightH.style.display='flex';
    rightH.style.gap='8px';
    rightH.style.alignItems='center';
    rightH.appendChild(badge);

    const caret = document.createElement('span');
    caret.textContent = '▼';
    caret.style.fontWeight='700';
    caret.style.color='#374151';
    rightH.appendChild(caret);

    header.appendChild(leftH);
    header.appendChild(rightH);

    const body = document.createElement('div');
    body.className = 'atpFlowBody';

    // Tabela clonada (thead igual)
    const wrap = document.createElement('div');
    wrap.className = 'atpGroupedTableWrap';

    const t2 = document.createElement('table');
    t2.className = table.className || '';
    // thead
    if (table.tHead) t2.appendChild(table.tHead.cloneNode(true));
    const tb = document.createElement('tbody');

    // Clona linhas das regras do fluxo
    for (const r of rulesHere) {
      const tr = r.tr;
      if (!tr) continue;
      const cloned = tr.cloneNode(true);
      // remove possíveis marcas de processamento/hidden
      cloned.style.display = '';
      tb.appendChild(cloned);
    }
    t2.appendChild(tb);
    wrap.appendChild(t2);
    body.appendChild(wrap);

    // Toggle
    header.addEventListener('click', ()=> {
      const hid = body.hasAttribute('hidden');
      if (hid) { body.removeAttribute('hidden'); caret.textContent='▼'; }
      else { body.setAttribute('hidden',''); caret.textContent='▶'; }
    });

    block.appendChild(header);
    block.appendChild(body);
    container.appendChild(block);
    flowBlocks.push({body, caret});
  });

  btnExpandAll.addEventListener('click', ()=> {
    for (const b of flowBlocks) { b.body.removeAttribute('hidden'); b.caret.textContent='▼'; }
  });
  btnCollapseAll.addEventListener('click', ()=> {
    for (const b of flowBlocks) { b.body.setAttribute('hidden',''); b.caret.textContent='▶'; }
  });

  // Insere após tabela original
  table.parentNode.insertBefore(container, table.nextSibling);
}

function atpToggleGroupedView(table, rules) {
  try {
    if (!table) return;
    if (atpIsGroupedViewActive(table)) {
      atpGroupedViewOff(table);
      return;
    }
    const data = atpComputeFluxosData(rules);
    atpGroupedViewOn(table, rules, data);
  } catch (e) {
    console.warn(LOG_PREFIX, 'Falha na vista agrupada (Opção B)', e);
    try { atpGroupedViewOff(table); } catch (e2) {}
  }
}



function atpEnsureJSZip() {
  return new Promise(function (resolve, reject) {
    try {
      if (window.JSZip) return resolve(window.JSZip);

      var existing = document.getElementById('atp_jszip_loader');
      if (existing) {
        // Já está carregando: aguarda
        var tries = 0;
        var t = setInterval(function () {
          tries++;
          if (window.JSZip) { clearInterval(t); return resolve(window.JSZip); }
          if (tries > 80) { clearInterval(t); return reject(new Error('Timeout carregando JSZip')); }
        }, 100);
        return;
      }

      var sc = document.createElement('script');
      sc.id = 'atp_jszip_loader';
      sc.async = true;
      sc.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
      sc.onload = function () {
        if (window.JSZip) resolve(window.JSZip);
        else reject(new Error('JSZip carregou, mas window.JSZip não está disponível'));
      };
      sc.onerror = function () { reject(new Error('Falha ao carregar JSZip (CDN)')); };
      (document.head || document.documentElement).appendChild(sc);
    } catch (e) {
      reject(e);
    }
  });
}

function atpBuildFluxosBPMN(rules, opts) {
  opts = opts || {};
  try {
    // ============================================================
    // BPMN 2.0 + BPMNDI (Bizagi) — CADA FLUXO EM UMA POOL
    // - Um participant/pool + um process por "início" estrutural
    // - Nó = Localizador (Task)
    // - Aresta = Regra (SequenceFlow) REMOVER -> INCLUIR
    // - Gateway exclusivo quando um localizador tem múltiplas saídas
    // - Layout L->R por níveis (BFS), pools empilhadas verticalmente
    //
    // IMPORTANTE: usa o shape do parseRules():
    //   r.localizadorRemover = { canonical, clauses[] }
    //   r.localizadorIncluirAcao = { canonical, clauses[], acoes[] }
    // ============================================================

    if (!Array.isArray(rules) || !rules.length) return null;

    // Sanitiza texto para XML 1.0 (remove caracteres inválidos / surrogates soltos)
const xmlSanitize = (s) => {
  const str = String(s == null ? '' : s);
  let out = '';
  for (const ch of str) { // itera por codepoint
    const cp = ch.codePointAt(0);
    const ok = (cp === 0x9 || cp === 0xA || cp === 0xD ||
      (cp >= 0x20 && cp <= 0xD7FF) ||
      (cp >= 0xE000 && cp <= 0xFFFD) ||
      (cp >= 0x10000 && cp <= 0x10FFFF));
    if (ok) out += ch;
  }
  return out;
};

const xmlEsc = (s) => xmlSanitize(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

    const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

    function hashCode(str) {
      str = String(str == null ? '' : str);
      let h = 0;
      for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0; }
      return h;
    }

    const makeId = (prefix, raw) => {
      const base = norm(raw).toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
      return prefix + '_' + (base || 'x') + '_' + Math.abs(hashCode(raw)).toString(36);
    };


const getRuleLabel = (r) => {
      const num = (r && (r.num || r.numero || r.id || '')) + '';

      // Tipo de Controle / Critério (preferir canonical)
      const tipo = norm(r && (r.tipoControleCriterio?.canonical || r.tipoControleCriterio?.text || r.tipoControleCriterio || r.tipoControle || r.tipo || r.criterio || r.gatilho || ''));

      // Outros Critérios (k=v) — filtra campos internos e serializa Sets/Objects com segurança
      const IGNORE_KEYS = new Set(['clauses','groups','map','canonical','raw','text','expr','expression']);
      const seenKV = new Set();
      const partsOutros = [];

      function valToStr(v) {
        if (v == null) return '';
        if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return norm(String(v));

        if (typeof v === 'object') {
          if (v.canonical) return norm(String(v.canonical));
          if (v.text) return norm(String(v.text));
          if (v.raw) return norm(String(v.raw));

          if (Array.isArray(v)) {
            const arr = v.map(valToStr).filter(Boolean);
            return arr.join(', ');
          }
          if (v instanceof Set) {
            const arr = Array.from(v).map(valToStr).filter(Boolean);
            return arr.join(' && ');
          }

          try {
            const shallow = {};
            for (const [k2, v2] of Object.entries(v)) {
              const kk = norm(String(k2 || ''));
              if (!kk) continue;
              if (IGNORE_KEYS.has(kk.toLowerCase())) continue;
              const vv = valToStr(v2);
              if (!vv) continue;
              shallow[kk] = vv;
            }
            const keys = Object.keys(shallow);
            if (keys.length) {
              return keys.map(k => `${k}=${shallow[k]}`).join('; ');
            }
          } catch (e) {}
        }

        const s = norm(String(v));
        if (/^\[object\s+.*\]$/i.test(s)) return '';
        return s;
      }

      try {
        const outros = (r && r.outrosCriterios && typeof r.outrosCriterios === 'object') ? r.outrosCriterios : null;
        for (const [k, v] of Object.entries(outros || {})) {
          const kkRaw = norm(String(k || ''));
          if (!kkRaw) continue;
          const kk = kkRaw.toLowerCase();
          if (IGNORE_KEYS.has(kk)) continue;

          const vv = valToStr(v);
          if (!vv) continue;

          const sig = kk + '=' + vv;
          if (seenKV.has(sig)) continue;
          seenKV.add(sig);

          partsOutros.push(`${kkRaw}=${vv}`);
        }
      } catch (e) {}

      const parts = [];
      parts.push(('REGRA ' + num).trim());
      if (tipo) parts.push('Tipo/Critério: ' + tipo);
      const outrosHuman = atpHumanizeOutrosCriteriosExpr(r && r.outrosCriterios);
      if (outrosHuman) parts.push('Outros Critérios: ' + outrosHuman);

      let label = parts.join(' — ').trim();
      if (label.length > 420) label = label.slice(0, 417) + '...';
      return label;
    };

    // ---- Build global graph (MESMA LÓGICA/CHAVES DO TXT)
    const allFrom = new Set();
    const allTo   = new Set();
    const outGlobal = new Map(); // fromKey -> Set(toKey)
    const edgeMeta  = new Map(); // "from||to" -> Array<labels>

    for (const r of (rules || [])) {
      // IMPORTANTE: usa exatamente as mesmas chaves do TXT (clauses -> atpClauseKey)
      const fromKeys = atpClausesToKeys(r && r.localizadorRemover);
      const toKeys   = atpClausesToKeys(r && r.localizadorIncluirAcao);

      for (const fk of fromKeys) {
        const fromK = norm(fk);
        if (!fromK) continue;

        allFrom.add(fromK);
        if (!outGlobal.has(fromK)) outGlobal.set(fromK, new Set());

        for (const tk of toKeys) {
          const toK = norm(tk);
          if (!toK) continue;

          allTo.add(toK);
          outGlobal.get(fromK).add(toK);

          const key = fromK + '||' + toK;
          const arr = edgeMeta.get(key) || [];
          arr.push(getRuleLabel(r));
          edgeMeta.set(key, arr);
        }
      }
    }

    // Ordenação determinística (igual ao TXT): chaves em pt-BR e starts derivados nessa mesma ordem
    const allKeys = Array.from(allFrom).sort((a,b)=>String(a).localeCompare(String(b), 'pt-BR'));

    // Detecta inícios exatamente como no TXT: FROM que não é TO
    let starts = allKeys.filter(k => !allTo.has(k));
    if (!starts.length) starts = allKeys.slice();
// Monta fluxos na mesma ordem/critério do TXT (assigned + expansão)
    const assigned = new Set();
    const fluxos = [];
    const expandFrom = (startKey) => {
      const q = [startKey];
      const vis = new Set([startKey]);
      while (q.length) {
        const u = q.shift();
        const outs = outGlobal.get(u);
        if (!outs) continue;
        for (const v of outs) {
          // MESMA LÓGICA DO TXT: só expande para nós que também são origem (allFrom)
          if (!v) continue;
          if (!vis.has(v) && allFrom.has(v)) { vis.add(v); q.push(v); }
        }
      }
      return vis;
    };

    for (const st of starts) {
      if (assigned.has(st)) continue;
      const nodes = expandFrom(st);
      for (const n of nodes) assigned.add(n);
      fluxos.push({ starts: [st], nodes });
    }
    // Sobras (ciclos sem início)
    for (const k of allKeys) {
      if (assigned.has(k)) continue;
      const nodes = expandFrom(k);
      for (const n of nodes) assigned.add(n);
      fluxos.push({ starts: [k], nodes });
    }

    // Adiciona nós terminais (destinos que NÃO são origem) ao mesmo fluxo,
    // sem expandir, para o BPMN refletir o agrupamento do TXT e ainda desenhar os fins.
    for (const fl of fluxos) {
      const full = new Set(fl.nodes);
      for (const u of fl.nodes) {
        const outs = outGlobal.get(u);
        if (!outs) continue;
        for (const v of outs) {
          if (!v) continue;
          if (!full.has(v) && !allFrom.has(v)) full.add(v);
        }
      }
      fl.nodes = Array.from(full);
    }

    // subgraph signature to avoid duplicate pools (segurança extra)
    const flowSigs = new Set();


    // ============================================================
    // Modo ZIP: retorna 1 arquivo BPMN por fluxo (cada pool/processo isolado)
    // ============================================================
    if (opts && opts.splitFiles) {
      const files = [];
      let fileIndex = 0;

      const buildOne = (fluxo, idx) => {
        // Cabeçalho
        const collabId1 = 'Collab_ATP_' + idx;
        const procId = 'Process_Fluxo_' + idx;
        const partId = 'Participant_Fluxo_' + idx;

        let x = '';
        x += '<?xml version="1.0" encoding="UTF-8"?>\n';
        x += '<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n';
        x += '  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"\n';
        x += '  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"\n';
        x += '  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"\n';
        x += '  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"\n';
        x += '  id="Definitions_ATP_' + idx + '" targetNamespace="http://tjsp.eproc/atp">\n';
        x += '  <bpmn:collaboration id="' + collabId1 + '">\n';

        const startName = (fluxo && fluxo.starts && fluxo.starts.length) ? String(fluxo.starts[0]) : ('Fluxo ' + idx);
        x += '    <bpmn:participant id="' + partId + '" name="Fluxo ' + idx + ' — ' + xmlEsc(startName) + '" processRef="' + procId + '"/>\n';
        x += '  </bpmn:collaboration>\n';
        x += '  <bpmn:process id="' + procId + '" isExecutable="false">\n';

        // ---- Nós e arestas (reuso da lógica do builder principal)
        const nodes = Array.from((fluxo && fluxo.nodes) ? fluxo.nodes : []);
        // nodeSet (origens) segue a lógica do TXT: apenas localizadores que são origem (REMOVER).
        const nodeSet = new Set(nodes);

        // Para o BPMN ficar tão "completo" quanto o TXT, precisamos também desenhar os destinos
        // que NÃO são origem (nós terminais): o TXT lista as regras e mostra o "VAI PARA" mesmo
        // quando não há continuação. Aqui, criamos tasks para esses destinos e conectamos as arestas,
        // mas NÃO expandimos o fluxo a partir deles.
        const terminalSet = new Set();
        for (const n of nodes) {
          const outs = outGlobal.get(n);
          if (!outs) continue;
          for (const t of outs) {
            if (!t) continue;
            if (!nodeSet.has(t)) terminalSet.add(t);
          }
        }
        const nodesAll = nodes.concat(Array.from(terminalSet));
        const nodeSetAll = new Set(nodesAll);
const startId = 'Start_' + procId;
        x += '    <bpmn:startEvent id="' + startId + '" name="Início"/>\n';

        // tasks por localizador
        const taskIdByNode = new Map();
        for (const n of nodes) {
          const tid = makeId('Task_' + procId, n);
          taskIdByNode.set(n, tid);
          x += '    <bpmn:task id="' + tid + '" name="' + xmlEsc(n) + '"/>\n';
        }


// gateways: quando múltiplas saídas (ou múltiplas regras para o mesmo destino)
// IMPORTANTE: se há 1 único destino, mas 2+ regras (labels) para o mesmo par from->to,
// também precisamos de gateway, senão perderíamos regras (165/166 etc.).
const gwIdByNode = new Map();
const outLocal = new Map();
for (const n of nodes) {
  const outs = outGlobal.get(n);
  const arr = outs ? Array.from(outs).filter(t => nodeSetAll.has(t)) : [];
  outLocal.set(n, arr);

  // conta "ramos" = soma dos labels por destino (mínimo 1 por destino)
  let branches = 0;
  for (const t of arr) {
    const labels = edgeMeta.get(n + '||' + t) || [];
    branches += Math.max(1, labels.length);
  }

  if (branches > 1) {
    const gid = makeId('Gw_' + procId, n);
    gwIdByNode.set(n, gid);
    x += '    <bpmn:exclusiveGateway id="' + gid + '" name="Decisão"/>';
  }
}

// ends para nós sem saída

        let endCount = 0;
        const endIdByNode = new Map();
        for (const n of nodesAll) {
          const outs = outGlobal.get(n);
          const arr = outs ? Array.from(outs).filter(t => nodeSetAll.has(t)) : [];
          if (!arr.length) {
            endCount++;
            const eid = 'End_' + procId + '_' + endCount;
            endIdByNode.set(n, eid);
            x += '    <bpmn:endEvent id="' + eid + '" name="Fim"/>\n';
          }
        }


// ServiceTasks (entre decisão/gateway e localizador destino)
// Nesta versão, SEMPRE criamos uma serviceTask para cada regra (label),
// inclusive quando múltiplas regras apontam para o mesmo destino.
const svcTaskMeta = new Map();    // id -> {from,to,label}
const svcIdsByEdge = new Map();   // "from||to" -> Array<svcId>

let svcCount = 0;
for (const from of nodesAll) {
  const outs = outGlobal.get(from);
  if (!outs) continue;

  for (const to of outs) {
    if (!nodeSetAll.has(to)) continue;

    const labels = edgeMeta.get(from + '||' + to) || [];
    const labs = labels.length ? labels : ['REGRA ?'];

    for (let li = 0; li < labs.length; li++) {
      svcCount++;
      // id único e estável: inclui contador + hash simples da regra (quando houver)
      const sid = 'Svc_' + procId + '_' + svcCount;
      const label = labs[li];

      svcTaskMeta.set(sid, { from, to, label });
      const k = from + '||' + to;
      const arr = svcIdsByEdge.get(k) || [];
      arr.push(sid);
      svcIdsByEdge.set(k, arr);

      x += '    <bpmn:serviceTask id="' + sid + '" name="' + xmlEsc(label) + '"/>';
    }
  }
}

// flows

        let flowCount = 0;
        const edgesForDI = []; // {id, src, dst}
        const addFlow = (srcId, dstId, name) => {
          flowCount++;
          const fid = 'Flow_' + procId + '_' + flowCount;
          x += '    <bpmn:sequenceFlow id="' + fid + '" sourceRef="' + srcId + '" targetRef="' + dstId + '"' + (name ? (' name="' + xmlEsc(name) + '"') : '') + '/>\n';
          edgesForDI.push({ id: fid, src: srcId, dst: dstId });
        };

        // Start -> (cada start do fluxo)
        const startsList = (fluxo && fluxo.starts && fluxo.starts.length) ? fluxo.starts : (nodes.length ? [nodes[0]] : []);
        for (const st of startsList) {
          if (!taskIdByNode.has(st)) continue;
          addFlow(startId, taskIdByNode.get(st), '');
        }


// Node -> (gateway?) -> targets
        for (const from of nodes) {
          const outs = outLocal.get(from) || [];
          const fromTaskId = taskIdByNode.get(from);
          const gwId = gwIdByNode.get(from);

          if (gwId) {
            // Task -> Gateway
            addFlow(fromTaskId, gwId, '');

            // Gateway -> (uma serviceTask por regra) -> Destino
            for (const to of outs) {
              const toTaskId = taskIdByNode.get(to);
              const edgeKey = from + '||' + to;
              const svcIds = svcIdsByEdge.get(edgeKey) || [];

              // Se por algum motivo não existir, ainda assim liga direto
              if (!svcIds.length) {
                addFlow(gwId, toTaskId, '');
                continue;
              }

              for (const sid of svcIds) {
                addFlow(gwId, sid, '');
                addFlow(sid, toTaskId, '');
              }
            }
          } else {
            // Sem gateway: deve haver apenas 1 "ramo" (1 destino com 1 regra),
            // mas ainda assim desenhamos Task -> ServiceTask -> Destino.
            if (outs.length) {
              for (const to of outs) {
                const toTaskId = taskIdByNode.get(to);
                const edgeKey = from + '||' + to;
                const svcIds = svcIdsByEdge.get(edgeKey) || [];

                if (svcIds.length) {
                  // Em modo sem gateway, usamos o primeiro (há só 1).
                  const sid = svcIds[0];
                  addFlow(fromTaskId, sid, '');
                  addFlow(sid, toTaskId, '');
                } else {
                  // fallback
                  addFlow(fromTaskId, toTaskId, '');
                }
              }
            } else {
              const eid = endIdByNode.get(from);
              if (eid) addFlow(fromTaskId, eid, '');
            }
          }
        }

        x += '  </bpmn:process>';


        // ---- BPMNDI (grid simples)
        x += '  <bpmndi:BPMNDiagram id="BPMNDiagram_' + procId + '">\n';
        x += '    <bpmndi:BPMNPlane id="BPMNPlane_' + procId + '" bpmnElement="' + collabId1 + '">\n';

        // Pool bounds / layout grid
        const padX = 40, padY = 40;

        const nodeW = 240, nodeH = 80;     // tasks (localizadores)
        const gwW = 50, gwH = 50;          // gateway
        const svcW = 220, svcH = 60;       // serviceTask (informações da regra)

        // Espaçamento padrão (Bizagi-safe)
        const GAP = 100; // >= 100px horizontal e vertical
        function applyHorizontalGap(x, gap) { return Math.round(x + (gap || GAP)); }
        const gapX = GAP, gapY = GAP;

        // Largura de uma "coluna" de nível: Task -> Gateway -> ServiceTask -> (respiro até a próxima Task)
        // Isso evita gateway/servicetask colidirem com tasks do nível seguinte.
        const COL_W = nodeW + GAP + gwW + GAP + svcW + GAP;
        const bandGap = nodeH + GAP;

        // ==============================
        // LAYOUT EM 2 FASES
        // 1) Planejar: calcular "peso/altura" de subárvores (quantos slots verticais cada ramo precisa)
        // 2) Posicionar: atribuir X por nível (BFS) e Y por árvore (top-down)
        // ==============================

        // níveis por BFS (para eixo X)
        const level = new Map();
        const parent = new Map(); // v -> u (árvore-base; usado para medir subárvore sem duplicar merges)
        const q = [];
        for (const st of startsList) {
          if (!level.has(st)) { level.set(st, 0); q.push(st); }
        }
        while (q.length) {
          const u = q.shift();
          const lu = level.get(u) || 0;
          const outs = outLocal.get(u) || [];
          for (const v of outs) {
            if (!level.has(v)) {
              level.set(v, lu + 1);
              parent.set(v, u);
              q.push(v);
            }
          }
        }

        // Adjacência (somente nós do fluxo)
        const children = new Map(); // node -> [node,...]
        for (const n of nodes) {
          const outs = outLocal.get(n) || [];
          const arr = outs.filter(t => taskIdByNode.has(t));
          children.set(n, arr);
        }

        // Medida de "unidades" verticais (slots) por subárvore.
        // Para DAGs com merges, usamos a árvore-base (parent) para não explodir altura.
        // Para arestas "extra" (não pertencem à árvore-base), reservamos 1 slot (evita empilhamento no gateway).
        const memoUnits = new Map();
        const visiting = new Set();

        function measureUnits(u) {
          if (memoUnits.has(u)) return memoUnits.get(u);
          if (visiting.has(u)) return 1; // ciclo defensivo
          visiting.add(u);

          const outs = children.get(u) || [];
          let sum = 0;

          for (const v of outs) {
            if (parent.get(v) === u) sum += measureUnits(v);
            else sum += 1;
          }
          if (!sum) sum = 1;

          visiting.delete(u);
          memoUnits.set(u, sum);
          return sum;
        }

        // Coordenadas (nodes): nodeName -> {x,y}
        const pos = new Map();
        let maxX = 0, maxY = 0;

        function placeSubtree(u, topY, spanPx) {
          if (!taskIdByNode.has(u)) return;

          const lv = level.has(u) ? (level.get(u) || 0) : 0;
          const x0 = padX + 140 + (lv * COL_W);
          const y0 = Math.round(topY + (spanPx - nodeH) / 2);

          if (!pos.has(u)) pos.set(u, { x: x0, y: y0 });

          const p0 = pos.get(u);
          maxX = Math.max(maxX, p0.x + nodeW);
          maxY = Math.max(maxY, p0.y + nodeH);

          const outs = children.get(u) || [];
          let yCursor = topY;

          for (const v of outs) {
            const units = (parent.get(v) === u) ? measureUnits(v) : 1;
            const childSpan = units * bandGap;

            if (!pos.has(v)) placeSubtree(v, yCursor, childSpan);

            const pv = pos.get(v);
            if (pv) {
              maxX = Math.max(maxX, pv.x + nodeW);
              maxY = Math.max(maxY, pv.y + nodeH);
            }

            yCursor += childSpan;
          }
        }

        // Posiciona cada start como um "bloco" empilhado
        let yStartCursor = padY + 60;
        const startsOrdered = startsList.slice().filter(s=>taskIdByNode.has(s));
        for (const st of startsOrdered) {
          const units = measureUnits(st);
          const span = units * bandGap;
          placeSubtree(st, yStartCursor, span);
          yStartCursor += span;
        }

        // Se nada foi posicionado (fallback), coloca tudo em linha
        if (!pos.size) {
          let i = 0;
          for (const n of nodes) {
            pos.set(n, { x: padX + 140 + (i * (nodeW + GAP)), y: padY + 60 });
            i++;
          }
          maxX = padX + 140 + (nodes.length * (nodeW + GAP)) + nodeW;
          maxY = padY + 60 + nodeH;
        }

        // Gateways: ao lado direito da task de origem, com GAP real.
        // Ajuste importante (Bizagi-safe): quando houver múltiplas saídas, centraliza o gateway
        // verticalmente no "bloco" de ramos (em vez de grudar no centro da task de origem).
        // Isso evita aquele "poste" vertical gigante no split, principalmente quando os ramos são terminais.
        const gwPos = new Map(); // gatewayId -> {x,y,w,h}
        for (const [n, gid] of gwIdByNode.entries()) {
          const p0 = pos.get(n) || { x: padX + 140, y: padY + 60 };
          const gx = applyHorizontalGap(p0.x + nodeW, GAP);

          // y default: centro da task origem
          let gy = Math.round(p0.y + (nodeH - gwH) / 2);

          try {
            const outs = (children && children.get(n)) ? (children.get(n) || []) : [];
            if (outs && outs.length >= 2) {
              // centra o gateway entre os centros dos destinos
              const centers = [];
              for (const v of outs) {
                const pv = pos.get(v);
                if (pv) centers.push(pv.y + (nodeH / 2));
              }
              if (centers.length >= 2) {
                centers.sort((a,b)=>a-b);
                const mid = (centers[0] + centers[centers.length - 1]) / 2;
                gy = Math.round(mid - (gwH / 2));
              }
            }
          } catch (e) {}

          gwPos.set(gid, { x: gx, y: gy, w: gwW, h: gwH });
          maxX = Math.max(maxX, gx + gwW);
          maxY = Math.max(maxY, gy + gwH);
        }

        // End events: próximos da task terminal (com GAP)
        const END_W = 36, END_H = 36;
        for (const [n, eid] of endIdByNode.entries()) {
          const p0 = pos.get(n);
          if (!p0) continue;
          const ex = applyHorizontalGap(p0.x + nodeW, GAP);
          const ey = Math.round(p0.y + (nodeH - END_H) / 2);
          maxX = Math.max(maxX, ex + END_W);
          maxY = Math.max(maxY, ey + END_H);
        }

// Ajuste de altura do pool: quando há múltiplas serviceTasks (múltiplas regras) para o mesmo REMOVER→INCLUIR,
        // nós "espalhamos" verticalmente as serviceTasks para não empilhar. Reserve altura extra para não cortar o diagrama.
        let __maxSvcStack = 1;
        try {
          const __tmp = new Map(); // pair -> count
          for (const meta of (svcTaskMeta ? svcTaskMeta.values() : [])) {
            if (!meta || !meta.from || !meta.to) continue;
            const k = String(meta.from) + '||' + String(meta.to);
            __tmp.set(k, (__tmp.get(k) || 0) + 1);
          }
          for (const v of __tmp.values()) __maxSvcStack = Math.max(__maxSvcStack, v || 1);
        } catch (e) {}
        // Shape: participant
        const poolW = Math.max(680, maxX - padX + 60);
        const poolH = Math.max(160, (maxY - padY + 60) + ((__maxSvcStack>1)?((__maxSvcStack-1)*(svcH+20)):0));
        x += '      <bpmndi:BPMNShape id="DI_' + partId + '" bpmnElement="' + partId + '">\n';
        x += '        <dc:Bounds x="' + padX + '" y="' + padY + '" width="' + poolW + '" height="' + poolH + '"/>\n';
        x += '      </bpmndi:BPMNShape>\n';
        // Shape: start (alinha verticalmente com o 1o no do fluxo)
        const startX = padX + 40;
        let startY = padY + 60;
        try {
          const __st0 = (startsOrdered && startsOrdered.length) ? startsOrdered[0] : ((startsList && startsList.length) ? startsList[0] : null);
          const __p0 = __st0 ? pos.get(__st0) : null;
          if (__p0) startY = Math.round(__p0.y + (nodeH - 36) / 2);
        } catch (e) {}
        x += '      <bpmndi:BPMNShape id="DI_' + startId + '" bpmnElement="' + startId + '">\n';
        x += '        <dc:Bounds x="' + startX + '" y="' + startY + '" width="36" height="36"/>\n';
        x += '      </bpmndi:BPMNShape>\n';

        // Shapes: tasks
        for (const n of nodes) {
          const tid = taskIdByNode.get(n);
          const p = pos.get(n) || { x: padX + 280, y: padY + 60 };
          x += '      <bpmndi:BPMNShape id="DI_' + tid + '" bpmnElement="' + tid + '">\n';
          x += '        <dc:Bounds x="' + p.x + '" y="' + p.y + '" width="' + nodeW + '" height="' + nodeH + '"/>\n';
          x += '      </bpmndi:BPMNShape>\n';
          if (gwIdByNode.has(n)) {
            const gid = gwIdByNode.get(n);
            const gp = (gwPos && gwPos.get(gid)) ? gwPos.get(gid) : null;
            const gx = gp ? gp.x : applyHorizontalGap(p.x + nodeW, GAP);
            const gy = gp ? gp.y : (p.y + (nodeH/2) - 25);
            x += '      <bpmndi:BPMNShape id="DI_' + gid + '" bpmnElement="' + gid + '">\n';
            x += '        <dc:Bounds x="' + gx + '" y="' + gy + '" width="' + gwW + '" height="' + gwH + '"/>\n';
            x += '      </bpmndi:BPMNShape>\n';
          }
          if (endIdByNode.has(n)) {
            const eid = endIdByNode.get(n);
            const ex = applyHorizontalGap(p.x + nodeW, GAP);
            const ey = Math.round(p.y + (nodeH - 36) / 2);
            x += '      <bpmndi:BPMNShape id="DI_' + eid + '" bpmnElement="' + eid + '">\n';
            x += '        <dc:Bounds x="' + ex + '" y="' + ey + '" width="36" height="36"/>\n';
            x += '      </bpmndi:BPMNShape>\n';
          }
        }

        // Shapes: service tasks (entre task origem e task destino; via gateway quando existir)
        // Shapes: service tasks (entre task origem e task destino; via gateway quando existir)
        const svcPos = new Map(); // sid -> {x,y,w,h}

        // Agrupa serviceTasks por par REMOVER→INCLUIR para espalhar verticalmente (evita empilhamento)
        const __svcGroups = new Map(); // "from||to" -> [sid, sid, ...]
        try {
          for (const [sid, meta] of svcTaskMeta.entries()) {
            if (!meta || !meta.from || !meta.to) continue;
            const k = String(meta.from) + '||' + String(meta.to);
            if (!__svcGroups.has(k)) __svcGroups.set(k, []);
            __svcGroups.get(k).push(sid);
          }
          for (const arr of __svcGroups.values()) arr.sort((a,b)=>String(a).localeCompare(String(b)));
        } catch (e) {}

        for (const [sid, meta] of svcTaskMeta.entries()) {
          if (!meta) continue;

          const from = meta.from, to = meta.to;
          const pFrom = pos.get(from) || { x: padX + 140, y: padY + 60 };
          const pTo   = pos.get(to)   || { x: (pFrom.x + COL_W), y: pFrom.y };

          const viaGw = !!gwIdByNode.get(from);

          // X: depois do gateway (se existir) ou depois da task
          let sx;
          if (viaGw) {
            const gid = gwIdByNode.get(from);
            const gp = (gid && gwPos && gwPos.get(gid)) ? gwPos.get(gid) : { x: applyHorizontalGap(pFrom.x + nodeW, GAP), y: pFrom.y, w: gwW, h: gwH };
            sx = applyHorizontalGap(gp.x + gwW, GAP);
          } else {
            sx = applyHorizontalGap(pFrom.x + nodeW, GAP);
          }

          // Y: alinha na "faixa" do ramo (centro do destino). Isso elimina empilhamento em splits.
          const __k = String(from) + '||' + String(to);
          const __arr = __svcGroups.get(__k) || [sid];
          const __idx = Math.max(0, __arr.indexOf(sid));
          const __n = Math.max(1, __arr.length);
          const __step = (svcH + 10); // empilha só quando várias regras pro MESMO destino
          const __offset = (__idx - ((__n - 1) / 2)) * __step;

          const baseCy = (pTo.y + (nodeH/2));
          const sy = Math.round((baseCy - (svcH/2)) + __offset);

          svcPos.set(sid, { x: sx, y: sy, w: svcW, h: svcH });

          x += '      <bpmndi:BPMNShape id="DI_' + sid + '" bpmnElement="' + sid + '">\n';
          x += '        <dc:Bounds x="' + sx + '" y="' + sy + '" width="' + svcW + '" height="' + svcH + '"/>\n';
          x += '      </bpmndi:BPMNShape>\n';
        }

// Edges (simples: linha reta)
        const centerOf = (elId) => {
          // start
          if (elId === startId) return { x: startX + 36, y: startY + 18 };

          // tasks (localizadores)
          for (const [n, tid] of taskIdByNode.entries()) {
            if (tid === elId) {
              const p = pos.get(n) || { x: padX + 280, y: padY + 60 };
              return { x: p.x + nodeW, y: p.y + (nodeH/2) };
            }
          }

          // serviceTasks (regras)
          if (typeof svcPos !== 'undefined' && svcPos.has(elId)) {
            const p0 = svcPos.get(elId);
            return { x: p0.x + (p0.w), y: p0.y + (p0.h/2) };
          }

          // gateways
          for (const [n, gid] of gwIdByNode.entries()) {
            if (gid === elId) {
              const gp = (typeof gwPos !== 'undefined' && gwPos && gwPos.get(gid)) ? gwPos.get(gid) : null;
              if (gp) return { x: gp.x + gp.w, y: gp.y + (gp.h/2) };
              const p = pos.get(n) || { x: padX + 280, y: padY + 60 };
              return { x: applyHorizontalGap(p.x + nodeW, GAP) + gwW, y: p.y + (nodeH/2) };
            }
          }

          // ends
          for (const [n, eid] of endIdByNode.entries()) {
            if (eid === elId) {
              const p = pos.get(n) || { x: padX + 280, y: padY + 60 };
              return { x: p.x + nodeW + 96, y: p.y + (nodeH/2) };
            }
          }

          return { x: padX + 100, y: padY + 100 };
        };


        // ---- DI routing: assign a distinct "corridor" (midX) per outgoing edge of the same source
        // This avoids the "vertical bus" effect where multiple orthogonal connectors share the same midX.
        const ROUTE_MIN_CLEAR = 100;
        const ROUTE_CORRIDOR_GAP = 70; // horizontal separation between corridors

        const __diGetBoundsById = (function(){
          // returns {x,y,w,h} for any element id (task/serviceTask/gateway/start/end)
          return function(elId){
            // Start
            if (elId === startId) return { x: padX + 40, y: padY + 80, w: 36, h: 36 };
            // tasks (localizadores)
            for (let ii = 0; ii < nodes.length; ii++) {
              const n = nodes[ii];
              const tid = taskIdByNode.get(n);
              if (tid === elId) {
                const p0 = pos.get(n) || { x: padX + 280, y: padY + 60 };
                return { x: p0.x, y: p0.y, w: nodeW, h: nodeH };
              }
            }
            // service tasks (regras)
            for (const [sid, s] of svcPos.entries()) {
              if (sid === elId) return { x: s.x, y: s.y, w: s.w, h: s.h };
            }
            // gateways
            for (const [n, gid] of gwIdByNode.entries()) {
              if (gid === elId) {
                const p = pos.get(n) || { x: padX + 280, y: padY + 60 };
                const gp = (typeof gwPos !== 'undefined' && gwPos && gwPos.get(gid)) ? gwPos.get(gid) : null;
                if (gp) return { x: gp.x, y: gp.y, w: gp.w, h: gp.h };
                const gx = p.x + nodeW + gapX;
                const gy = p.y + (nodeH/2) - (gwH/2);
                return { x: gx, y: gy, w: gwW, h: gwH };
              }
            }
            // end events
            for (const [n, eid] of endIdByNode.entries()) {
              if (eid === elId) {
                const p = pos.get(n) || { x: padX + 280, y: padY + 60 };
                const ex = applyHorizontalGap(p.x + nodeW, GAP);
                const ey = Math.round(p.y + (nodeH - 36) / 2);
                return { x: ex, y: ey, w: 36, h: 36 };
              }
            }
            // fallback
            return { x: padX + 280, y: padY + 60, w: 2, h: 2 };
          };
        })();

        const __diCorridorIndexByFlowId = new Map();
        const __diOutBySrc = new Map(); // srcId -> [{fid, ty}]

        // precompute targetY rank per source
        for (const e0 of edgesForDI) {
          const sb0 = __diGetBoundsById(e0.src);
          const tb0 = __diGetBoundsById(e0.dst);
          const fromC0 = { x: sb0.x + sb0.w/2, y: sb0.y + sb0.h/2 };
          const toC0   = { x: tb0.x + tb0.w/2, y: tb0.y + tb0.h/2 };
          const leftToRight0 = (toC0.x >= fromC0.x);
          const pA0 = { x: leftToRight0 ? (sb0.x + sb0.w) : sb0.x, y: sb0.y + sb0.h/2 };
          const pB0 = { x: leftToRight0 ? tb0.x : (tb0.x + tb0.w), y: tb0.y + tb0.h/2 };

          // Only allocate corridors when there is a vertical delta (the "bus" issue)
          const needsCorridor = Math.abs(pA0.y - pB0.y) > 1;
          if (!needsCorridor) {
            __diCorridorIndexByFlowId.set(e0.id, 0);
            continue;
          }

          const arr0 = __diOutBySrc.get(e0.src) || [];
          arr0.push({ fid: e0.id, ty: pB0.y });
          __diOutBySrc.set(e0.src, arr0);
        }

        for (const [srcId, arr] of __diOutBySrc.entries()) {
          arr.sort((a,b)=> (a.ty - b.ty));
          for (let i = 0; i < arr.length; i++) {
            __diCorridorIndexByFlowId.set(arr[i].fid, i);
          }
        }

        for (const e of edgesForDI) {
          const a = centerOf(e.src);
          const b = centerOf(e.dst);
          x += '      <bpmndi:BPMNEdge id="DI_' + e.id + '" bpmnElement="' + e.id + '">';

          // Waypoints somente pelas laterais (L/R), com dobra em "L"
          const sb = (function(elId){
            // tasks (localizadores)
            for (let ii = 0; ii < nodes.length; ii++) {
              const n = nodes[ii];
              const tid = taskIdByNode.get(n);
              if (tid === elId) {
                const p0 = pos.get(n) || { x: padX + 280, y: padY + 60 };
                return { x: p0.x, y: p0.y, w: nodeW, h: nodeH };
              }
            }
            // service tasks (regras)
            for (const [sid, s] of svcPos.entries()) {
              if (sid === elId) return { x: s.x, y: s.y, w: s.w, h: s.h };
            }
            // gateways
            for (const [n, gid] of gwIdByNode.entries()) {
              if (gid === elId) {
                const p = pos.get(n) || { x: padX + 280, y: padY + 60 };
                const gp = (typeof gwPos !== 'undefined' && gwPos && gwPos.get(gid)) ? gwPos.get(gid) : null;
                 if (gp) return { x: gp.x, y: gp.y, w: gp.w, h: gp.h };
                 const gx = p.x + nodeW + gapX;
                 const gy = p.y + (nodeH/2) - (gwH/2);
                 return { x: gx, y: gy, w: gwW, h: gwH };
              }
            }
            // start
            if (elId === startId) {
              const sx = startX;
              const sy = startY;
              return { x: sx, y: sy, w: 36, h: 36 };
            }
            // end
            for (const [n, eid] of endIdByNode.entries()) {
              if (eid === elId) {
                const p = pos.get(n) || { x: padX + 280, y: padY + 60 };
                const ex = applyHorizontalGap(p.x + nodeW, GAP);
                const ey = Math.round(p.y + (nodeH - 36) / 2);
                return { x: ex, y: ey, w: 36, h: 36 };
              }
            }
            // fallback
            return { x: a.x, y: a.y, w: 2, h: 2 };
          })(e.src);

          const tb = (function(elId){
            // same helper for target
            // tasks (localizadores)
            for (let ii = 0; ii < nodes.length; ii++) {
              const n = nodes[ii];
              const tid = taskIdByNode.get(n);
              if (tid === elId) {
                const p0 = pos.get(n) || { x: padX + 280, y: padY + 60 };
                return { x: p0.x, y: p0.y, w: nodeW, h: nodeH };
              }
            }
            // service tasks (regras)
            for (const [sid, s] of svcPos.entries()) {
              if (sid === elId) return { x: s.x, y: s.y, w: s.w, h: s.h };
            }
            // gateways
            for (const [n, gid] of gwIdByNode.entries()) {
              if (gid === elId) {
                const p = pos.get(n) || { x: padX + 280, y: padY + 60 };
                const gp = (typeof gwPos !== 'undefined' && gwPos && gwPos.get(gid)) ? gwPos.get(gid) : null;
                 if (gp) return { x: gp.x, y: gp.y, w: gp.w, h: gp.h };
                 const gx = p.x + nodeW + gapX;
                 const gy = p.y + (nodeH/2) - (gwH/2);
                 return { x: gx, y: gy, w: gwW, h: gwH };
              }
            }
            // end (target may be end)
            for (const [n, eid] of endIdByNode.entries()) {
              if (eid === elId) {
                const p = pos.get(n) || { x: padX + 280, y: padY + 60 };
                const ex = applyHorizontalGap(p.x + nodeW, GAP);
                const ey = Math.round(p.y + (nodeH - 36) / 2);
                return { x: ex, y: ey, w: 36, h: 36 };
              }
            }
            // fallback
            return { x: b.x, y: b.y, w: 2, h: 2 };
          })(e.dst);

          const fromC = { x: sb.x + sb.w/2, y: sb.y + sb.h/2 };
          const toC   = { x: tb.x + tb.w/2, y: tb.y + tb.h/2 };
          const leftToRight = (toC.x >= fromC.x);

          const pA = { x: leftToRight ? (sb.x + sb.w) : sb.x, y: sb.y + sb.h/2 };
          const pB = { x: leftToRight ? tb.x : (tb.x + tb.w), y: tb.y + tb.h/2 };
          const minClear = ROUTE_MIN_CLEAR;
          const corrIdx = __diCorridorIndexByFlowId.has(e.id) ? __diCorridorIndexByFlowId.get(e.id) : 0;
          // Spread connectors leaving the same source into distinct corridors
          const corrShift = (corrIdx || 0) * ROUTE_CORRIDOR_GAP;
          let midX;
          if (leftToRight) midX = Math.max(pA.x + minClear + corrShift, (pA.x + pB.x)/2 + corrShift);
          else midX = Math.min(pA.x - minClear - corrShift, (pA.x + pB.x)/2 - corrShift);
          // Clamp midX to avoid overshooting the target and coming back
          if (leftToRight) midX = Math.min(midX, pB.x - 20);
          else midX = Math.max(midX, pB.x + 20);

          const wps = [
            { x: pA.x, y: pA.y },
            { x: midX, y: pA.y },
            { x: midX, y: pB.y },
            { x: pB.x, y: pB.y }
          ];

          for (let wi = 0; wi < wps.length; wi++) {
            x += '        <di:waypoint x="' + wps[wi].x + '" y="' + wps[wi].y + '"/>';
          }
          x += '      </bpmndi:BPMNEdge>';
        }

        x += '    </bpmndi:BPMNPlane>\n';
        x += '  </bpmndi:BPMNDiagram>\n';
        x += '</bpmn:definitions>\n';
        return x;
      };

      for (let i = 0; i < fluxos.length; i++) {
        const fluxo = fluxos[i];
        const nodes = Array.from(fluxo.nodes || []);
        const sig = nodes.slice().sort().join('||');
        if (flowSigs.has(sig)) continue;
        flowSigs.add(sig);

        fileIndex++;
        const xmlOne = buildOne(fluxo, fileIndex);
        const startK = (fluxo.starts && fluxo.starts[0]) ? norm(String(fluxo.starts[0])) : ('fluxo_' + fileIndex);
        const safe = (startK || '').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80);
        files.push({
          filename: ('fluxo_' + String(fileIndex).padStart(2, '0') + '_' + (safe || 'inicio') + '.bpmn'),
          xml: xmlOne
        });
      }

      return files;
    }

    // ---- XML header / namespaces
    const collabId = 'Collab_ATP';
    let xml = '';
    xml += '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n';
    xml += '  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"\n';
    xml += '  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"\n';
    xml += '  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"\n';
    xml += '  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"\n';
    xml += '  id="Definitions_ATP" targetNamespace="http://tjsp.eproc/atp">\n';
    xml += '  <bpmn:collaboration id="' + collabId + '">\n';

    let processesXML = '';
    let diShapes = '';
    let diEdges  = '';

    // Layout constants
    const POOL_X = 40;
    const POOL_PAD_X = 40;
    const POOL_PAD_Y = 40;
    const TASK_W = 240;
    const TASK_H = 80;
    const GW_W = 50;
    const GW_H = 50;
    const START_W = 36;
    const START_H = 36;
    const END_W = 36;
    const END_H = 36;

    const DX = 360; // spacing per level
    const DY = 130; // spacing per lane within pool

    let poolY = 40;
    let fluxoCount = 0;

    // Helper to compute reachable subgraph from a start

    // For each start, build pool/process
    for (const fl of fluxos) {
      const startLoc = (fl && fl.starts && fl.starts[0]) ? fl.starts[0] : '';

      const startName = norm(startLoc);
      if (!startName) continue;

      const nodesSet = new Set((fl && fl.nodes) ? Array.from(fl.nodes) : []);
      if (!nodesSet.size) continue;

      if (!nodesSet.size) continue;

      // Build edges within subgraph
      const nodes = Array.from(nodesSet);
      const nodeSet = new Set(nodes);

      const out = new Map(); // u -> Array(v)
      const edges = [];
      for (const u of nodes) {
        const outs = outGlobal.get(u);
        if (!outs) continue;
        for (const v of outs) {
          if (!nodeSet.has(v)) continue;
          edges.push([u, v]);
          if (!out.has(u)) out.set(u, []);
          out.get(u).push(v);
        }
      }

      // Signature
      const sig = nodes.slice().sort().join('||') + '##' + edges.slice().sort((a,b)=> (a[0]+a[1]).localeCompare(b[0]+b[1])).map(e=>e[0]+'->'+e[1]).join('|');
      const sigHash = Math.abs(hashCode(sig)).toString(36);
      if (flowSigs.has(sigHash)) continue;
      flowSigs.add(sigHash);

      fluxoCount++;
      const procId = 'Process_Fluxo_' + fluxoCount;
      const partId = 'Participant_Fluxo_' + fluxoCount;

      xml += '    <bpmn:participant id="' + partId + '" name="' + xmlEsc('Fluxo ' + fluxoCount + ' — ' + startName) + '" processRef="' + procId + '"/>\n';

      // ---- Build process
      let p = '';
      p += '  <bpmn:process id="' + procId + '" isExecutable="false">\n';

      const startEventId = 'Start_' + procId;
      p += '    <bpmn:startEvent id="' + startEventId + '" name="Início"/>\n';

      // IDs for nodes
      const taskId = new Map();
      nodes.forEach(n => taskId.set(n, makeId('Task_' + procId, n)));

      // Gateways
      const gwId = new Map(); // u -> gwId
      for (const [u, vs] of out.entries()) {
        const uniq = Array.from(new Set(vs));
        if (uniq.length > 1) {
          gwId.set(u, makeId('Gw_' + procId, u));
        }
      }

      // Terminals (no outgoing)
      const terminals = nodes.filter(n => !(out.get(n) && out.get(n).length));
      const endId = new Map();
      terminals.forEach((n,i) => endId.set(n, 'End_' + procId + '_' + (i+1)));

      // Emit tasks + gateways + ends
      for (const n of nodes) {
        p += '    <bpmn:task id="' + taskId.get(n) + '" name="' + xmlEsc(n) + '"/>\n';
      }
      for (const [u, gid] of gwId.entries()) {
        p += '    <bpmn:exclusiveGateway id="' + gid + '" name="Decisão"/>\n';
      }
      for (const [n, eid] of endId.entries()) {
        p += '    <bpmn:endEvent id="' + eid + '" name="Fim"/>\n';
      }

      // Sequence flows
      let flowN = 0;
      const mkFlowId = () => 'Flow_' + procId + '_' + (++flowN);

      // Start -> start task(s) (mesma semântica do TXT: pode haver múltiplos inícios)
      const flowIds = []; // for DI edges
      const startKeys = (fl && Array.isArray(fl.starts) && fl.starts.length)
        ? fl.starts.map(norm).filter(Boolean)
        : (startName ? [startName] : []);

      for (const sk of startKeys) {
        const tid = taskId.get(sk);
        if (!tid) continue;
        const fStart = mkFlowId();
        p += '    <bpmn:sequenceFlow id="' + fStart + '" sourceRef="' + startEventId + '" targetRef="' + tid + '"/>\n';
        flowIds.push([fStart, startEventId, tid]);
      }

      for (const u of nodes) {
        const vs = out.get(u) || [];
        const uniq = Array.from(new Set(vs));
        if (!uniq.length) continue;

        const uTask = taskId.get(u);
        const gid = gwId.get(u);

        if (gid) {
          const fUG = mkFlowId();
          p += '    <bpmn:sequenceFlow id="' + fUG + '" sourceRef="' + uTask + '" targetRef="' + gid + '"/>\n';
          flowIds.push([fUG, uTask, gid]);

          for (const v of uniq) {
            const key = u + '||' + v;
            const labels = edgeMeta.get(key) || [];
            const label = labels.length ? labels[0] : ''; // pega o 1o (curto). (Opcional: join)
            const fGV = mkFlowId();
            p += '    <bpmn:sequenceFlow id="' + fGV + '" sourceRef="' + gid + '" targetRef="' + taskId.get(v) + '"' + (label ? (' name="' + xmlEsc(label) + '"') : '') + '/>\n';
            flowIds.push([fGV, gid, taskId.get(v)]);
          }
        } else {
          for (const v of uniq) {
            const key = u + '||' + v;
            const labels = edgeMeta.get(key) || [];
            const label = labels.length ? labels[0] : '';
            const fUV = mkFlowId();
            p += '    <bpmn:sequenceFlow id="' + fUV + '" sourceRef="' + uTask + '" targetRef="' + taskId.get(v) + '"' + (label ? (' name="' + xmlEsc(label) + '"') : '') + '/>\n';
            flowIds.push([fUV, uTask, taskId.get(v)]);
          }
        }
      }

      // Task -> End for terminals
      for (const n of terminals) {
        const eid = endId.get(n);
        const fTE = mkFlowId();
        p += '    <bpmn:sequenceFlow id="' + fTE + '" sourceRef="' + taskId.get(n) + '" targetRef="' + eid + '"/>\n';
        flowIds.push([fTE, taskId.get(n), eid]);
      }

      p += '  </bpmn:process>\n';
      processesXML += p;

      // ---- Layout per pool (BFS levels)
      // levels
      let levels = new Map();
      const q = [startName];
      levels.set(startName, 0);
      while (q.length) {
        const u = q.shift();
        const lv = levels.get(u) || 0;
        const vs = out.get(u) || [];
        for (const v of vs) {
          if (!levels.has(v)) { levels.set(v, lv + 1); q.push(v); }
        }
      }

      // group nodes by level
      const byLevel = new Map();
      for (const n of nodes) {
        const lv = levels.has(n) ? levels.get(n) : 0;
        if (!byLevel.has(lv)) byLevel.set(lv, []);
        byLevel.get(lv).push(n);
      }
      // deterministic order within level
      for (const [lv, arr] of byLevel.entries()) {
        arr.sort((a,b)=>a.localeCompare(b));
      }

      // positions
      const pos = new Map(); // elementId -> {x,y,w,h}
      const startX = POOL_X + POOL_PAD_X;
      const startY = poolY + POOL_PAD_Y;

      // Start event
      pos.set(startEventId, { x: startX, y: startY + 10, w: START_W, h: START_H });

      let maxLv = 0;
      let maxY = startY;

      if (opts.layout === 'grid') {
        // --- Grid layout (simple, Bizagi-friendly)
        const allNodes = Array.from(nodes).slice().sort((a,b)=>a.localeCompare(b));
        const cols = Math.max(1, Math.ceil(Math.sqrt(allNodes.length)));
        const dx = Math.max(260, DX * 0.8);
        const dy = Math.max(110, DY * 0.9);

        for (let i = 0; i < allNodes.length; i++) {
          const n = allNodes[i];
          const col = i % cols;
          const row = Math.floor(i / cols);
          const x = startX + dx * (col + 1);
          const y = startY + dy * row;
          pos.set(taskId.get(n), { x, y, w: TASK_W, h: TASK_H });
          maxY = Math.max(maxY, y + TASK_H);
          maxLv = Math.max(maxLv, col);
        }
      } else {
        // --- Layout per pool (BFS levels)
        for (const [lv, arr] of byLevel.entries()) {
          if (lv > maxLv) maxLv = lv;
          for (let i = 0; i < arr.length; i++) {
            const n = arr[i];
            const x = startX + DX * (lv + 1);
            const y = startY + DY * i;
            pos.set(taskId.get(n), { x, y, w: TASK_W, h: TASK_H });
            maxY = Math.max(maxY, y + TASK_H);
          }
        }
      }

      // Gateways near their source task
      for (const [u, gid] of gwId.entries()) {
        const uPos = pos.get(taskId.get(u));
        const x = (uPos ? (uPos.x + TASK_W + 100) : (startX + DX));
        const y = (uPos ? (uPos.y + (TASK_H - GW_H)/2) : startY);
        pos.set(gid, { x, y, w: GW_W, h: GW_H });
        maxY = Math.max(maxY, y + GW_H);
      }

      // End events near terminal tasks
      for (const n of terminals) {
        const tPos = pos.get(taskId.get(n));
        const x = (tPos ? (tPos.x + TASK_W + 120) : (startX + DX * (maxLv + 2)));
        const y = (tPos ? (tPos.y + 20) : startY);
        pos.set(endId.get(n), { x, y, w: END_W, h: END_H });
        maxY = Math.max(maxY, y + END_H);
      }

      // pool bounds
      const maxX = Math.max(...Array.from(pos.values()).map(p=>p.x + p.w)) + POOL_PAD_X;
      const poolH = (maxY - poolY) + POOL_PAD_Y;
      const poolW = maxX - POOL_X;

      // DI: participant pool shape
      diShapes += '    <bpmndi:BPMNShape id="DI_' + partId + '" bpmnElement="' + partId + '">\n';
      diShapes += '      <dc:Bounds x="' + POOL_X + '" y="' + poolY + '" width="' + poolW + '" height="' + poolH + '"/>\n';
      diShapes += '    </bpmndi:BPMNShape>\n';

      // DI shapes for elements in this process
      const addShape = (elId) => {
        const p0 = pos.get(elId);
        if (!p0) return;
        diShapes += '    <bpmndi:BPMNShape id="DI_' + elId + '" bpmnElement="' + elId + '">\n';
        diShapes += '      <dc:Bounds x="' + p0.x + '" y="' + p0.y + '" width="' + p0.w + '" height="' + p0.h + '"/>\n';
        diShapes += '    </bpmndi:BPMNShape>\n';
      };

      addShape(startEventId);
      nodes.forEach(n => addShape(taskId.get(n)));
      for (const gid of gwId.values()) addShape(gid);
      for (const eid of endId.values()) addShape(eid);

      // DI edges (simple orthogonal)
      const center = (p0) => ({ cx: p0.x + p0.w/2, cy: p0.y + p0.h/2 });
      const rightMid = (p0) => ({ x: p0.x + p0.w, y: p0.y + p0.h/2 });
      const leftMid  = (p0) => ({ x: p0.x, y: p0.y + p0.h/2 });

      for (const [fid, srcEl, dstEl] of flowIds) {
        const ps = pos.get(srcEl);
        const pt = pos.get(dstEl);
        if (!ps || !pt) continue;
        const a = rightMid(ps);
        const b = leftMid(pt);
        const midX = (a.x + b.x) / 2;

        diEdges += '    <bpmndi:BPMNEdge id="DI_' + fid + '" bpmnElement="' + fid + '">\n';
        diEdges += '      <di:waypoint x="' + a.x + '" y="' + a.y + '"/>\n';
        diEdges += '      <di:waypoint x="' + midX + '" y="' + a.y + '"/>\n';
        diEdges += '      <di:waypoint x="' + midX + '" y="' + b.y + '"/>\n';
        diEdges += '      <di:waypoint x="' + b.x + '" y="' + b.y + '"/>\n';
        diEdges += '    </bpmndi:BPMNEdge>\n';
      }

      poolY += poolH + 40; // next pool
    }

    xml += '  </bpmn:collaboration>\n';
    xml += processesXML;

    xml += '  <bpmndi:BPMNDiagram id="BPMNDiagram_ATP">\n';
    xml += '    <bpmndi:BPMNPlane id="BPMNPlane_ATP" bpmnElement="' + collabId + '">\n';
    xml += diShapes;
    xml += diEdges;
    xml += '    </bpmndi:BPMNPlane>\n';
    xml += '  </bpmndi:BPMNDiagram>\n';
    xml += '</bpmn:definitions>\n';

    return xml;
  } catch (e) {
    console.warn(LOG_PREFIX, 'Falha ao gerar BPMN (pools por fluxo)', e);
    return null;
  }
}

function atpEnsureReportButton(host, afterLabelEl, tableRef) {
  try {
    if (!host || host.querySelector('#btnGerarRelatorioColisoes')) return;

    // =========================
    // Botão 1: Relatório Conflitos
    // =========================
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

        // Pega todas as células de conflito renderizadas pelo script.
        var cells = Array.from(table.querySelectorAll('td[data-atp-col="conflita"]'));

        // Monta registros A x B (DEDUP por par + tipo)
        var records = [];
        var countsByTipo = Object.create(null);
        var seenPairs = new Set();

        function pairKey(tipo, a, b) {
          // Contradição é intrarregra (self).
          if (String(b) === '(Própria Regra)' || String(b) === '(própria regra)') {
            return String(tipo) + '|' + String(a || '') + '|SELF';
          }
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
          } catch (e) {}

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

            // Sugestões no pq (se houver)
            var sugestoes = [];
            try {
              var reSug = /Sugest[aã]o:\s*([^|]+)(?:\||$)/gi;
              var m;
              while ((m = reSug.exec(pqRaw)) !== null) {
                var s = clean(m[1] || '');
                if (s) sugestoes.push(s);
              }
            } catch (e) {}

            // Remove trechos de sugestão do pq técnico
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

            // Definição (tooltip padrão do tipo)
            var def = '';
            try { def = getTipoTooltip(tipo) || ''; } catch (e) {}
            def = String(def || '').replace(/<br\s*\/?>/gi, '\n').trim();

            // Normaliza A/B
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

        // Ordena só para estabilidade
        records.sort(function (x, y) {
          var ax = Number(x.a), ay = Number(y.a);
          if (Number.isFinite(ax) && Number.isFinite(ay) && ax !== ay) return ax - ay;
          if (String(x.a) !== String(y.a)) return String(x.a).localeCompare(String(y.a));
          var bx = Number(x.b), by = Number(y.b);
          if (Number.isFinite(bx) && Number.isFinite(by) && bx !== by) return bx - by;
          if (String(x.b) !== String(y.b)) return String(x.b).localeCompare(String(y.b));
          return String(x.tipo).localeCompare(String(y.tipo));
        });

        // Formata
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
            lines.push('Regra A(' + r.a + ') x (Própria Regra)');
          } else {
            lines.push('Regra A(' + r.a + ') x Regra B(' + r.b + ')');
          }
          lines.push('Tipo: ' + r.tipo);
          if (r.def) lines.push('Definição: ' + r.def);
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

    // =========================
    // Botão 2: Extrato de Fluxos (TXT)
    // =========================
    const btnFluxos = document.createElement('button');
    btnFluxos.type = 'button';
    btnFluxos.className = 'infraButton';
    btnFluxos.id = 'btnExtratoFluxosATP';
    btnFluxos.textContent = 'Gerar Extrato de Fluxos';
    btnFluxos.style.marginLeft = '8px';

// =========================
// Botão 2b: Vista Agrupada por Fluxo (Opção B — teste)
// =========================
const btnFluxosGroup = document.createElement('button');
btnFluxosGroup.type = 'button';
btnFluxosGroup.className = 'infraButton';
btnFluxosGroup.id = 'btnAgruparFluxosATP';
btnFluxosGroup.textContent = 'Agrupar por Fluxo';
btnFluxosGroup.style.marginLeft = '8px';


    btnFluxos.addEventListener('mouseenter', () => { btnFluxos.style.background = '#e5e7eb'; });
    btnFluxos.addEventListener('mouseleave', () => { btnFluxos.style.background = '#f3f4f6'; });

    btnFluxos.addEventListener('click', function () {
      try {
        var table = tableRef || findTable();
        if (!table) return;

        try { ensureColumns(table); } catch (e) {}
        var cols = null;
        try { cols = mapColumns(table); } catch (e) { cols = null; }
        if (!cols) cols = {};

        const rules = parseRules(table, cols);
        const txt = atpBuildFluxosText(rules);

        var blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'extrato_fluxos_ATP.txt';
        document.body.appendChild(a);
        a.click();
        setTimeout(function(){ URL.revokeObjectURL(url); try{a.remove();}catch(e){} }, 0);
      } catch (e) {
        console.warn(LOG_PREFIX, 'Falha ao gerar Extrato de Fluxos', e);
      }
    });

    // =========================

btnFluxosGroup.addEventListener('click', function () {
  try {
    var table = tableRef || findTable();
    if (!table) return;

    try { ensureColumns(table); } catch (e) {}
    var cols = null;
    try { cols = mapColumns(table); } catch (e) { cols = null; }
    if (!cols) cols = {};

    const rules = parseRules(table, cols);
    atpToggleGroupedView(table, rules);
  } catch (e) {
    console.warn(LOG_PREFIX, 'Falha ao abrir vista agrupada (Opção B)', e);
  }
});

// Botão 3: Exportar BPMN (Grid)
    // =========================
    const btnBPMNGrid = document.createElement('button');
    btnBPMNGrid.type = 'button';
    btnBPMNGrid.className = 'infraButton';
    btnBPMNGrid.id = 'btnExtratoFluxosBPMNGrid_ATP';
    btnBPMNGrid.textContent = 'Exportar BPMN para Bizagi';
    btnBPMNGrid.style.marginLeft = '8px';

    btnBPMNGrid.addEventListener('mouseenter', () => { btnBPMNGrid.style.background = '#e5e7eb'; });
    btnBPMNGrid.addEventListener('mouseleave', () => { btnBPMNGrid.style.background = '#f3f4f6'; });

    btnBPMNGrid.addEventListener('click', function () {
      try {
        var table = tableRef || findTable();
        if (!table) return;

        try { ensureColumns(table); } catch (e) {}
        var cols = null;
        try { cols = mapColumns(table); } catch (e) { cols = null; }
        if (!cols) cols = {};

        const rules = parseRules(table, cols);

        // Gera 1 BPMN por fluxo e compacta em ZIP (como já fazíamos antes)
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
              setTimeout(function(){ URL.revokeObjectURL(url); try{a.remove();}catch(e){} }, 0);
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

    // Inserção no host
    if (afterLabelEl && afterLabelEl.parentNode === host) {
      const anchor = afterLabelEl.nextSibling;
      host.insertBefore(btnFluxos, anchor);
      host.insertBefore(btnFluxosGroup, anchor);
      host.insertBefore(btnBPMNGrid, anchor);
      host.insertBefore(btn, btnFluxos); // mantém ordem: Relatório -> Fluxos -> BPMN
    } else {
      host.appendChild(btn);
      host.appendChild(btnFluxos);
      host.appendChild(btnFluxosGroup);
      host.appendChild(btnBPMNGrid);
    }
  } catch (e) {}
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


  // ==============================
  // Sincronização: aguarda o eProc terminar de popular os TDs (evita linhas “vazias” intermitentes)
  // ==============================
  const __atpReadyState = new WeakMap(); // table -> { t0:number, tries:number }

  function atpIsTablePopulated(table) {
    try {
      const tb = table && table.tBodies && table.tBodies[0];
      if (!tb) return false;

      const rows = Array.from(tb.rows || []).filter(r => r && r.cells && r.cells.length >= 6);
      if (!rows.length) return false;

      // Amostra 5 linhas (espalhadas) pra reduzir custo.
      const sample = [];
      const n = rows.length;
      const pick = (k) => rows[Math.min(n - 1, Math.max(0, k))];
      sample.push(pick(0));
      sample.push(pick(Math.floor(n * 0.25)));
      sample.push(pick(Math.floor(n * 0.50)));
      sample.push(pick(Math.floor(n * 0.75)));
      sample.push(pick(n - 1));

      let ok = 0;
      for (const tr of sample) {
        if (!tr || !tr.cells) continue;
        const cells = Array.from(tr.cells);

        // Ignora checkbox e ações (normalmente primeira e última).
        const slice = cells.slice(1, Math.max(2, cells.length - 1));

        const textLen = slice.reduce((acc, td) => acc + ((td && td.textContent) ? td.textContent.trim().length : 0), 0);

        // Sinais típicos do eProc quando já terminou de montar conteúdo.
        const hasSignals =
          tr.querySelector('[id^="dadosResumidos_"],[id^="dadosCompletos_"]') ||
          tr.querySelector('.selPrioridade') ||
          /\bPor\s+(Evento|Documento|Data|Tempo|Tipo)\b/i.test(tr.textContent || '') ||
          /Executar\s+Ação\s+Programada/i.test(tr.textContent || '');

        if (textLen >= 40 && hasSignals) ok++;
      }

      // Considera “pronto” se pelo menos 2/5 amostras parecem completas.
      return ok >= 2;
    } catch (e) {}
    return false;
  }

  function atpWaitTablePopulationOrRetry(table) {
    // Retorna true se pode prosseguir; false se deve re-agendar.
    try {
      if (!table) return false;

      const now = Date.now();
      const st = __atpReadyState.get(table) || { t0: now, tries: 0 };
      st.tries++;
      __atpReadyState.set(table, st);

      // Se já está populada, segue.
      if (atpIsTablePopulated(table)) return true;

      // Janela máxima de espera (evita loop eterno se o eProc mudar).
      if ((now - st.t0) > 12000) return true;

      return false;
    } catch (e) {}
    return true;
  }

function recalc(table) { // Recalcula tudo (parse -> analyze -> render).
    if (!document.body.contains(table)) return;
    // Aguarda o eProc terminar de preencher os TDs (evita capturar linhas “vazias”)
    if (!atpWaitTablePopulationOrRetry(table)) {
      schedule(() => recalc(table), 200);
      return;
    } // Se tabela sumiu do DOM, não faz nada.
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
}

)(); // Fim do IIFE.
