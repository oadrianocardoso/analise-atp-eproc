// ==UserScript==
// @name         Análise de ATP eProc
// @namespace    https://tjsp.eproc/automatizacoes
// @version      2.3.0
// @description  Adiciona colunas "Conflita com (Nº)" e "Tipo / Motivo" direto na #tableAutomatizacaoLocalizadores. Regras: COLISÃO (REMOVER, TIPO e OUTROS idênticos), SOBREPOSIÇÃO (REMOVER e TIPO iguais; OUTROS mais amplo com prioridade menor), ALERTA (REMOVER e TIPO iguais; OUTROS diferentes sem relação de subconjunto). Pares i<j, sem duplicar.
// @author       ADRIANO AUGUSTO CARDOSO E SANTOS
// @run-at       document-idle
// @match        https://eproc1g.tjsp.jus.br/eproc/*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/oadrianocardoso/analise-atp-eproc/main/analise-atp-eproc.user.js
// @downloadURL  https://raw.githubusercontent.com/oadrianocardoso/analise-atp-eproc/main/analise-atp-eproc.user.js
// ==/UserScript==

(function () {
  "use strict";

  /* ===================== Utils ===================== */
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const tipoRank = { "Colisão": 3, "Sobreposição": 2, "Alerta": 1 }; // ordem de gravidade para pintar linha
  const impactoRank = { "Alto":3, "Médio":2, "Baixo":1 };

  // normalização suave (mantém acentos e palavras como "NÃO")
  function norm(text) {
    return (text || "").replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
  }

  function getNumeroSublinhado(td) {
    if (!td) return "";
    const el = td.querySelector('span[style*="text-decoration"]');
    return el ? norm(el.textContent) : "";
  }

  function getSelectedOptionText(td) {
    if (!td) return "";
    const sel = td.querySelector("select");
    if (!sel) return "";
    let txt = "";
    if (sel.selectedOptions && sel.selectedOptions.length)       txt = sel.selectedOptions[0].textContent;
    else if (sel.querySelector("option[selected]"))               txt = sel.querySelector("option[selected]").textContent;
    else if (sel.selectedIndex >= 0 && sel.options[sel.selectedIndex]) txt = sel.options[sel.selectedIndex].textContent;
    return norm(txt).replace(/^Executar\s*/i, "");
  }

  function getFirstArgFromOnMouseOver(td) {
    if (!td) return "";
    const img = td.querySelector('img[onmouseover*="infraTooltipMostrar"]');
    if (!img) return "";
    const js = img.getAttribute("onmouseover") || "";
    const m = js.match(/infraTooltipMostrar\('([^']*)'/);
    return m ? norm(m[1]) : "";
  }

  function getLocalizadorRemoverText(td) {
    if (!td) return "";
    const clone = td.cloneNode(true);
    clone.querySelectorAll("img").forEach(img => img.remove());
    clone.querySelectorAll("br").forEach(br => br.replaceWith(" "));
    return norm(clone.textContent);
  }

  function parsePriority(p) {
    if (!p) return { raw: "[*]", num: null, text: "[*]" };
    const m = String(p).match(/\d+/);
    return m ? { raw: p, num: Number(m[0]), text: String(p).trim() } : { raw: p, num: null, text: "[*]" };
  }

  // Cria representação para igualdade estrita + tokens para relação de conjunto
  function parseCriteriaPair(tipoCtrl, outros) {
    const t = norm(tipoCtrl || "");
    const o = norm(outros   || "");
    const canonTipo   = t;
    const canonOutros = o;
    const canonFull   = `${canonTipo} || ${canonOutros}`;

    // Tokenização simples (mantém "não") — usada só para detectar subconjunto/superset
    const tokens = new Set(
      (t + " " + o)
        .split(/[;|,()/\-–—:+\[\]{}]|(?:\s+e\s+)|(?:\s+ou\s+)|(?:\s+que\s+)|\s+/gi)
        .map(s => s.trim().toLowerCase())
        .filter(Boolean)
    );

    return { canonTipo, canonOutros, canonFull, tokens };
  }

  // Relação entre OUTROS CRITÉRIOS (com TIPO igual)
  function relationOutros(a, b) {
    if (a.canonOutros === b.canonOutros) return "identicos";
    const aInB = [...a.tokens].every(t => b.tokens.has(t));
    const bInA = [...b.tokens].every(t => a.tokens.has(t));
    if (aInB && !bInA) return "sub_a_em_b"; // a é específico, b é mais amplo
    if (bInA && !aInB) return "sub_b_em_a"; // b é específico, a é mais amplo
    const intersects = [...a.tokens].some(t => b.tokens.has(t));
    return intersects ? "diferentes" : "diferentes"; // tratamos como "diferentes" (para ALERTA)
  }

  function escapeHTML(s) {
    return String(s ?? "")
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  }

  /* ===================== Parse DOM ===================== */
  function parseRulesFromTable(table) {
    const list = [];
    const bodyRows = Array.from(table.tBodies || []).flatMap(tb => Array.from(tb.rows));

    bodyRows.forEach(tr => {
      const tds = Array.from(tr.querySelectorAll(':scope > td'));
      if (tds.length < 7) return;

      const tdColunaRegra  = tds[1];
      const tdRemover      = tds[3];
      const tdTipoControle = tds[4];
      const tdIncluirAcao  = tds[5];
      const tdOutros       = tds[6];

      const num = getNumeroSublinhado(tdColunaRegra);
      if (!num) return;

      const prioridadeTexto = getSelectedOptionText(tdColunaRegra);
      const origem          = getLocalizadorRemoverText(tdRemover);
      const comportamento   = getFirstArgFromOnMouseOver(tdRemover);
      const tipoCtrl        = norm(tdTipoControle ? tdTipoControle.textContent : "");
      const destino         = norm(tdIncluirAcao ? tdIncluirAcao.textContent : "");
      const outros          = norm(tdOutros ? tdOutros.textContent : "");

      list.push({
        num,
        prioridade: parsePriority(prioridadeTexto),
        origem,
        comportamento: comportamento || "[*]",
        destino,
        tipoRaw: tipoCtrl || "[*]",
        outrosRaw: outros || "[*]",
        crit: parseCriteriaPair(tipoCtrl || "[*]", outros || "[*]"),
        tr
      });
    });

    return list;
  }

  /* ===================== Análise (pares i<j) ===================== */
  function analyzeConflicts(rules) {
    // Agrupar por (origem, tipoRaw) — só comparamos dentro desses buckets
    const buckets = new Map(); // key = origem || "" + "||" + tipoRaw
    for (const r of rules) {
      const key = `${r.origem || ""}||${r.tipoRaw}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(r);
    }

    const pairKey = (a,b) => {
      const i = String(a.num), j = String(b.num);
      return (i < j) ? `${i}|${j}` : `${j}|${i}`;
    };

    const pairs = new Map(); // key -> {iNum,jNum, tipos:Set, motivos:Set, impactoMax}

    for (const [key, list] of buckets.entries()) {
      if (!list.length) continue;

      // comparar i<j dentro do bucket
      for (let x=0; x<list.length; x++) {
        for (let y=x+1; y<list.length; y++) {
          const ri = list[x], rj = list[y];

          // Mesma origem e mesmo TIPO já garantidos pelo bucket
          const rel = relationOutros(ri.crit, rj.crit);

          let res = null;

          // 1) COLISÃO — OUTROS idênticos (independe do destino)
          if (rel === "identicos") {
            res = { tipo: "Colisão", impacto: "Alto", motivo: "Localizador REMOVER, Tipo e Outros Critérios 100% idênticos." };
          }
          // 2) SOBREPOSIÇÃO — um OUTROS é mais amplo e executa ANTES (prioridade numérica menor)
          else if (rel === "sub_a_em_b" || rel === "sub_b_em_a") {
            // Determine quem é amplo e quem é específico
            const aMaisAmploQueB = (rel === "sub_b_em_a"); // a superset de b
            const bMaisAmploQueA = (rel === "sub_a_em_b"); // b superset de a

            const pI = ri.prioridade.num;
            const pJ = rj.prioridade.num;

            if (aMaisAmploQueB && pI != null && pJ != null && pI < pJ) {
              res = { tipo: "Sobreposição", impacto: "Médio", motivo: "Regra mais ampla executa antes da específica (prioridade menor)." };
            } else if (bMaisAmploQueA && pI != null && pJ != null && pJ < pI) {
              res = { tipo: "Sobreposição", impacto: "Médio", motivo: "Regra mais ampla executa antes da específica (prioridade menor)." };
            } else {
              // amplo executa depois ou prioridades sem número → não marca conflito
              res = null;
            }
          }
          // 3) ALERTA — OUTROS diferentes sem relação de subconjunto
          else { // "diferentes"
            res = { tipo: "Alerta", impacto: "Baixo", motivo: "Localizador REMOVER e Tipo iguais; Outros Critérios diferentes." };
          }

          if (!res) continue;

          const keyPair = pairKey(ri, rj);
          const base = (String(ri.num) < String(rj.num)) ? ri : rj; // i
          const other = (base === ri) ? rj : ri; // j

          const rec = pairs.get(keyPair) || {
            iNum: base.num,
            jNum: other.num,
            tipos: new Set(),
            motivos: new Set(),
            impactoMax: "Baixo"
          };
          rec.tipos.add(res.tipo);
          rec.motivos.add(res.motivo);
          if (impactoRank[res.impacto] > impactoRank[rec.impactoMax]) rec.impactoMax = res.impacto;
          pairs.set(keyPair, rec);
        }
      }
    }

    // Mapear por regra base (i -> j>i)
    const conflictsByRule = new Map();
    for (const rec of pairs.values()) {
      const base = rec.iNum, other = rec.jNum;
      if (!conflictsByRule.has(base)) conflictsByRule.set(base, new Map());
      conflictsByRule.get(base).set(other, rec);
    }
    return conflictsByRule;
  }

  /* ===================== UI: colunas embutidas ===================== */
  function ensureColumns(table) {
    const thead = table.tHead || table.querySelector("thead");
    if (!thead) return;

    const ths = thead.querySelectorAll("th");
    const hasCols =
      Array.from(ths).some(th => /Conflita com/i.test(th.textContent)) &&
      Array.from(ths).some(th => /Tipo\s*\/\s*Motivo/i.test(th.textContent));
    if (!hasCols) {
      const headerRow = thead.rows[0] || thead.querySelector("tr");
      if (!headerRow) return;

      const th1 = document.createElement("th");
      th1.textContent = "Conflita com (Nº)";
      th1.style.whiteSpace = "nowrap";

      const th2 = document.createElement("th");
      th2.textContent = "Tipo / Motivo";
      th2.style.whiteSpace = "nowrap";

      headerRow.appendChild(th1);
      headerRow.appendChild(th2);
    }

    // garantir células nas linhas
    const bodyRows = Array.from(table.tBodies || []).flatMap(tb => Array.from(tb.rows));
    bodyRows.forEach(tr => {
      const tds = tr.querySelectorAll(':scope > td');
      const lastTwoAreNew =
        tds.length >= 2 &&
        tds[tds.length-2]?.dataset?.atpCol === "conflita" &&
        tds[tds.length-1]?.dataset?.atpCol === "motivo";
      if (lastTwoAreNew) return;

      const tdConf = document.createElement("td");
      tdConf.dataset.atpCol = "conflita";
      tdConf.style.verticalAlign = "top";

      const tdMot = document.createElement("td");
      tdMot.dataset.atpCol = "motivo";
      tdMot.style.verticalAlign = "top";

      tr.appendChild(tdConf);
      tr.appendChild(tdMot);
    });

    injectStyle();
  }

  function injectStyle() {
    if (document.getElementById("atp-conf-inline-style")) return;
    const style = document.createElement("style");
    style.id = "atp-conf-inline-style";
    style.textContent = `
      .atp-badge { display:inline-block; padding:2px 6px; border-radius:6px; font-size:11px; margin-right:6px; background:#e5e7eb; }
      .atp-badge.collision   { background:#fecaca }
      .atp-badge.overlap     { background:#fed7aa }
      .atp-badge.alert       { background:#f3f4f6 }
      .atp-muted { color:#6b7280 }
      .atp-sev-3 { background:#fff1f2 } /* Colisão */
      .atp-sev-2 { background:#fff7ed } /* Sobreposição */
      .atp-sev-1 { background:#f9fafb } /* Alerta */
      #btnRecalcATP { margin: 8px 0; padding: 6px 10px; font-weight:600; border:1px solid #065f46; background:#10b981; color:#083344; border-radius:6px; cursor:pointer; }
    `;
    document.head.appendChild(style);
  }

  function severityForRec(rec) {
    let max = 0;
    for (const t of rec.tipos) max = Math.max(max, tipoRank[t]||0);
    return max;
  }

  function renderIntoTable(table, rules, conflictsByRule) {
    // limpar
    const rows = Array.from(table.tBodies || []).flatMap(tb => Array.from(tb.rows));
    rows.forEach(tr => {
      tr.classList.remove("atp-sev-1","atp-sev-2","atp-sev-3");
      const confTd = tr.querySelector('td[data-atp-col="conflita"]');
      const motTd  = tr.querySelector('td[data-atp-col="motivo"]');
      if (confTd) confTd.textContent = "";
      if (motTd)  motTd.innerHTML = "";
    });

    const tipoClass = (t) => ({ "Colisão":"collision", "Sobreposição":"overlap", "Alerta":"alert" }[t] || "");

    // map num -> tr
    const rowMap = new Map();
    rows.forEach(tr => {
      const tds = tr.querySelectorAll(':scope > td');
      const num = getNumeroSublinhado(tds[1]);
      if (num) rowMap.set(num, tr);
    });

    for (const r of rules) {
      const adj = conflictsByRule.get(r.num);
      if (!adj || adj.size === 0) continue;

      const tr = rowMap.get(r.num);
      if (!tr) continue;

      const confTd = tr.querySelector('td[data-atp-col="conflita"]');
      const motTd  = tr.querySelector('td[data-atp-col="motivo"]');

      const others = [...adj.keys()].sort((a,b)=> String(a).localeCompare(String(b), "pt-BR", { numeric:true, sensitivity:"base" }));
      if (confTd) confTd.textContent = others.join(", ");

      const htmlParts = [];
      let maxSev = 0;
      for (const n of others) {
        const rec = adj.get(n);
        const tiposOrd = [...rec.tipos].sort((a,b)=> (tipoRank[b]-tipoRank[a]));
        if (!tiposOrd.length) continue;

        const badges = tiposOrd.map(t=> `<span class="atp-badge ${tipoClass(t)}">${t}</span>`).join(" ");
        const motivoTxt = [...rec.motivos].join(" | ");
        htmlParts.push(`<div>${badges} <span class="atp-muted">(${escapeHTML(rec.impactoMax)})</span> — ${escapeHTML(motivoTxt)}</div>`);
        maxSev = Math.max(maxSev, severityForRec(rec));
      }
      if (motTd) motTd.innerHTML = htmlParts.join("");
      if (maxSev) tr.classList.add(`atp-sev-${maxSev}`);
    }
  }

  /* ===================== Recalcular / Eventos ===================== */
  function addRecalcButton(table, onClick) {
    if (document.getElementById("btnRecalcATP")) return;
    const btn = document.createElement("button");
    btn.id = "btnRecalcATP";
    btn.type = "button";
    btn.textContent = "(Re)calcular Conflitos";
    table.parentElement.insertBefore(btn, table);
    btn.addEventListener("click", onClick);
  }

  function bindPriorityChange(table, recalc) {
    table.addEventListener("change", (e) => {
      const sel = e.target;
      if (sel && sel.tagName === "SELECT") setTimeout(recalc, 50);
    });
  }

  /* ===================== Fluxo principal ===================== */
  async function runOnce(table) {
    ensureColumns(table);
    const rules = parseRulesFromTable(table);
    const conflictsByRule = analyzeConflicts(rules);
    renderIntoTable(table, rules, conflictsByRule);
  }

  async function init() {
    let table = null;
    for (let i = 0; i < 60; i++) {
      table = document.querySelector("#tableAutomatizacaoLocalizadores");
      if (table && (table.tBodies?.length || table.querySelector("tbody"))) break;
      await sleep(500);
    }
    if (!table) return;

    ensureColumns(table);
    const recalc = () => runOnce(table);
    addRecalcButton(table, recalc);
    bindPriorityChange(table, recalc);
    runOnce(table);

    const mo = new MutationObserver(() => {
      ensureColumns(table);
      runOnce(table);
    });
    mo.observe(table, { childList: true, subtree: true });
  }

  init();
})();
