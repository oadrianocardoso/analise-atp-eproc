// ==UserScript==
// @name         Análise de ATP eProc
// @namespace    https://tjsp.eproc/automatizacoes
// @version      2.8.4
// @description  Analisa regras do eProc e detecta: COLISÃO TOTAL, COLISÃO PARCIAL, SOBREPOSIÇÃO e PERDA DE OBJETO (direcionada: alerta só na regra posterior). Adiciona colunas, filtro e otimizações de performance.
// @author       ADRIANO
// @run-at       document-end
// @noframes
// @match        https://eproc1g.tjsp.jus.br/eproc/*
// @match        https://eproc-1g-sp-hml.tjsp.jus.br/eproc/*
// @match        *://*/*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/oadrianocardoso/analise-atp-eproc/main/analise-atp-eproc.user.js
// @downloadURL  https://raw.githubusercontent.com/oadrianocardoso/analise-atp-eproc/main/analise-atp-eproc.user.js
// ==/UserScript==

(function () {
  "use strict";

  let filterOnlyConflicts = false;

  const tipoRank = { "Colisão Total": 3, "Colisão Parcial": 3, "Sobreposição": 2, "Perda de Objeto": 2 };
  const impactoRank = { "Alto": 3, "Médio": 2, "Baixo": 1 };

  const lower = s => (s ?? "").toString().replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  const norm  = s => (s ?? "").toString().replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
  const esc   = s => String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");

  // Debounce + idle
  let idleHandle = null, debounceTimer = null, pendingRecalc = false;
  function scheduleIdle(fn, wait=120){
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      pendingRecalc = true;
      if ("requestIdleCallback" in window) {
        if (idleHandle) cancelIdleCallback(idleHandle);
        idleHandle = requestIdleCallback(() => { pendingRecalc = false; fn(); }, { timeout: 1000 });
      } else {
        setTimeout(() => { if (pendingRecalc){ pendingRecalc=false; fn(); } }, 0);
      }
    }, wait);
  }

  function mapColumns(table){
    const thead = table.tHead || table.querySelector("thead");
    if (!thead) return null;
    const ths = Array.from(thead.querySelectorAll("th"));
    const find = (labels) => {
      const idx = ths.findIndex(th => {
        const t = lower(th.textContent || "");
        return labels.some(lbl => t.includes(lbl));
      });
      return idx >= 0 ? idx : null;
    };
    return {
      colNumPrior: find(["nº", "no", "n°", "prioridade"]) ?? 1,
      colRemover : find(["localizador remover","remover"]) ?? 3,
      colTipo    : find(["tipo de controle","tipo / critério","tipo / criterio","tipo"]) ?? 4,
      colIncluir : find(["localizador incluir","ação","acao","incluir"]) ?? 5,
      colOutros  : find(["outros critérios","outros criterios","critérios","criterios"]) ?? 6
    };
  }

  function textWithoutImages(td){
    if (!td) return "";
    let out = "";
    td.childNodes.forEach(n => {
      if (n.nodeType === 3) { out += n.nodeValue; }
      else if (n.nodeType === 1 && n.tagName !== "IMG") {
        if (n.tagName === "BR") out += " ";
        else out += " " + (n.textContent || "");
      }
    });
    return norm(out);
  }

  function getNumeroRegra(td) {
    if (!td) return "";
    let el = td.querySelector('span[style*="text-decoration"]');
    if (el && el.textContent) return (el.textContent.match(/\d{1,6}/)||[])[0] || norm(el.textContent);
    el = td.querySelector('u, b, strong');
    if (el && el.textContent) {
      const m = el.textContent.match(/\d{1,6}/);
      if (m) return m[0];
    }
    const txt = norm(td.textContent || "");
    let m = txt.match(/^\s*(\d{1,6})\b/);
    if (m) return m[1];
    m = txt.match(/(\d{1,6})/);
    return m ? m[1] : "";
  }

  function getPrioridadeTexto(td) {
    if (!td) return "";
    const sel = td.querySelector("select");
    if (sel) {
      const opt = sel.selectedOptions?.[0] || sel.querySelector("option[selected]") || sel.options?.[sel.selectedIndex];
      if (opt) return norm(String(opt.textContent || "").replace(/^Executar\s*/i, ""));
    }
    const raw = norm(td.textContent || "");
    const m = raw.match(/prioridade[^0-9]*([0-9]{1,4})/i);
    return m ? m[1] : raw;
  }

  function parsePriority(p) {
    if (!p) return { raw: "[*]", num: null, text: "[*]" };
    const m = String(p).match(/\d+/);
    return m ? { raw: p, num: Number(m[0]), text: String(p).trim() } : { raw: p, num: null, text: "[*]" };
  }

  // Captura robusta do comportamento REMOVER (tooltip + titles + texto)
  function getRemoverBehaviorText(td) {
    if (!td) return "";
    let parts = [];

    const img = td.querySelector('img[onmouseover*="infraTooltipMostrar"]');
    if (img) {
      const js = img.getAttribute("onmouseover") || "";
      const m = js.match(/infraTooltipMostrar\('([^']*)'/);
      if (m) parts.push(norm(m[1]));
      const t = img.getAttribute("title");
      if (t) parts.push(norm(t));
      const alt = img.getAttribute("alt");
      if (alt) parts.push(norm(alt));
    }

    const tdTitle = td.getAttribute && td.getAttribute("title");
    if (tdTitle) parts.push(norm(tdTitle));
    parts.push(textWithoutImages(td));

    return parts.filter(Boolean).join(" | ");
  }

  function comportamentoRemove(txt){
    const s = lower(txt);
    return /remover\s+o\s+processo.*localizador(?:es)?\s+informado(?:s)?|remover\s+os\s+processos\s+de\s+todos\s+os\s+localizadores|remover\s+.*localizador/i.test(s);
  }

  const tokenCache = new Map();
  function tokenBag(outros, tipo) {
    const key = `${tipo||""}||${outros||""}`;
    let cached = tokenCache.get(key);
    if (cached) return cached;
    const base = (tipo ? `${tipo} ` : "") + (outros || "");
    cached = new Set(
      lower(base)
        .split(/[;|,()/\-–—:+\[\]{}]|\s+e\s+|\s+ou\s+|\s+que\s+|\s+/gi)
        .map(s => s.trim())
        .filter(Boolean)
    );
    tokenCache.set(key, cached);
    return cached;
  }

  // "identicos" | "sub_a_em_b" | "sub_b_em_a" | "diferentes"
  function relationOutros(tipoA, aRaw, tipoB, bRaw) {
    if (norm(aRaw) === norm(bRaw)) return "identicos";
    const aTok = tokenBag(aRaw, tipoA);
    const bTok = tokenBag(bRaw, tipoB);
    let aInB = true, bInA = true;
    for (const t of aTok) if (!bTok.has(t)) { aInB = false; break; }
    for (const t of bTok) if (!aTok.has(t)) { bInA = false; break; }
    if (aInB && !bInA) return "sub_a_em_b";
    if (bInA && !aInB) return "sub_b_em_a";
    return "diferentes";
  }

  function hasIntersectionTokens(aRaw, bRaw){
    const A = tokenBag(aRaw, "");
    const B = tokenBag(bRaw, "");
    for (const t of A) if (B.has(t)) return true;
    return false;
  }

  function parseRulesFromTable(table, cols, prevRowSig) {
    const list = [];
    const tbodys = table.tBodies?.length ? Array.from(table.tBodies) : [table.querySelector("tbody")].filter(Boolean);
    const bodyRows = tbodys.flatMap(tb => Array.from(tb.rows));

    for (const tr of bodyRows) {
      const tds = Array.from(tr.querySelectorAll(':scope > td'));
      if (!tds.length) continue;

      const tdNumPrior   = tds[cols.colNumPrior] || tds[1];
      const tdRemover    = tds[cols.colRemover]  || tds[3];
      const tdTipo       = tds[cols.colTipo]     || tds[4];
      const tdIncluir    = tds[cols.colIncluir]  || tds[5];
      const tdOutros     = tds[cols.colOutros]   || tds[6];

      const num = getNumeroRegra(tdNumPrior);
      if (!num) continue;

      const prioridadeTexto = getPrioridadeTexto(tdNumPrior);
      const origem          = textWithoutImages(tdRemover);
      const comportamento   = getRemoverBehaviorText(tdRemover);
      const tipoCtrl        = norm(tdTipo ? tdTipo.textContent : "");
      const destino         = norm(tdIncluir ? tdIncluir.textContent : "");
      const outros          = norm(tdOutros ? tdOutros.textContent : "");

      const sig = `${num}|${prioridadeTexto}|${origem}|${comportamento}|${tipoCtrl}|${destino}|${outros}`;
      if (prevRowSig) prevRowSig.set(tr, sig);

      list.push({
        num,
        prioridade: parsePriority(prioridadeTexto),
        origem,
        comportamento: comportamento || "[*]",
        destino,
        tipoRaw: tipoCtrl || "[*]",
        outrosRaw: outros || "[*]",
        tr
      });
    }
    return list;
  }

  function analyzeConflicts(rules) {
    const buckets = new Map(); // key: origem||tipo
    for (const r of rules) {
      const key = `${r.origem || ""}||${r.tipoRaw}`;
      (buckets.get(key) || buckets.set(key, []).get(key)).push(r);
    }

    const pairsMap = new Map(); // "i|j" -> { iNum, jNum, tipos:Set, motivos:Set, impactoMax }

    const pairKey = (a,b) => {
      const i = String(a.num), j = String(b.num);
      return (i < j) ? `${i}|${j}` : `${j}|${i}`;
    };

    // addRec: registro padrão (base = menor nº por consistência)
    const addRec = (i, j, tipo, impacto, motivo) => {
      const key = pairKey(i,j);
      const base = (String(i.num) < String(j.num)) ? i : j;
      const other = (base === i) ? j : i;
      const rec = pairsMap.get(key) || {
        iNum: base.num,
        jNum: other.num,
        tipos: new Set(),
        motivos: new Set(),
        impactoMax: "Baixo"
      };
      rec.tipos.add(tipo);
      rec.motivos.add(motivo);
      if (impactoRank[impacto] > impactoRank[rec.impactoMax]) rec.impactoMax = impacto;
      pairsMap.set(key, rec);
    };

    // NOVO: addRecDirected — força que o "alerta" apareça na regra 'baseToShow'
    const addRecDirected = (baseToShow, otherRule, tipo, impacto, motivo) => {
      // Para que apareça na renderização da 'baseToShow', colocamos baseToShow como 'iNum'
      // (mesmo que seu número não seja o menor). Para isso, se pairKey inverter, ajustamos ao final.
      const keyAB = `${baseToShow.num}|${otherRule.num}`;
      const keyBA = `${otherRule.num}|${baseToShow.num}`;
      // Usamos a mesma estrutura, mas garantimos que na fase de render usar-se-á conflictsByRule.get(baseToShow.num)
      // ao inserir rec, injetaremos depois no mapa base->other.
      const rec = {
        iNum: baseToShow.num,
        jNum: otherRule.num,
        tipos: new Set([tipo]),
        motivos: new Set([motivo]),
        impactoMax: impacto
      };
      // Guardamos temporariamente com uma chave sintética única
      pairsMap.set(`FORCE|${keyAB}|${tipo}|${impacto}|${motivo}`, rec);
    };

    for (const list of buckets.values()) {
      if (!list || list.length < 2) continue;

      for (let x=0; x<list.length; x++) {
        const A = list[x];
        for (let y=x+1; y<list.length; y++) {
          const B = list[y];
          const rel = relationOutros(A.tipoRaw, A.outrosRaw, B.tipoRaw, B.outrosRaw);

          const pA = A.prioridade.num, pB = B.prioridade.num;
          const pKnown = (pA != null && pB != null);

          // COLISÃO (idênticos)
          if (rel === "identicos") {
            if (pKnown && pA === pB) addRec(A, B, "Colisão Total", "Alto", "REMOVER, TIPO e OUTROS idênticos; mesma prioridade.");
            else addRec(A, B, "Colisão Parcial", "Alto", "REMOVER, TIPO e OUTROS idênticos; prioridades diferentes.");

            // PERDA DE OBJETO direcionada (somente se prioridade menor remove; alerta na maior)
            if (pKnown && pA < pB && comportamentoRemove(A.comportamento))
              addRecDirected(B, A, "Perda de Objeto", "Médio", "Regra anterior (prioridade menor) com 'remover' pode esvaziar esta (critérios idênticos).");
            if (pKnown && pB < pA && comportamentoRemove(B.comportamento))
              addRecDirected(A, B, "Perda de Objeto", "Médio", "Regra anterior (prioridade menor) com 'remover' pode esvaziar esta (critérios idênticos).");
            continue;
          }

          // SOBREPOSIÇÃO (Outros diferentes + prioridade <=) — permanece
          if (rel === "diferentes" && pKnown) {
            if (pA <= pB) addRec(A, B, "Sobreposição", "Médio", "Outros critérios diferentes; prioridade da regra base é menor ou igual (pode sobrepor).");
            if (pB <= pA) addRec(B, A, "Sobreposição", "Médio", "Outros critérios diferentes; prioridade da regra base é menor ou igual (pode sobrepor).");
          }

          // PERDA DE OBJETO direcionada (subconjunto)
          if ((rel === "sub_a_em_b" || rel === "sub_b_em_a") && pKnown) {
            if (pA < pB && comportamentoRemove(A.comportamento))
              addRecDirected(B, A, "Perda de Objeto", "Médio", "Regra anterior (prioridade menor) com 'remover' pode esvaziar esta (subconjunto).");
            if (pB < pA && comportamentoRemove(B.comportamento))
              addRecDirected(A, B, "Perda de Objeto", "Médio", "Regra anterior (prioridade menor) com 'remover' pode esvaziar esta (subconjunto).");
          }

          // PERDA DE OBJETO direcionada (interseção textual)
          if (pKnown && hasIntersectionTokens(A.outrosRaw, B.outrosRaw)) {
            if (pA < pB && comportamentoRemove(A.comportamento))
              addRecDirected(B, A, "Perda de Objeto", "Médio", "Regra anterior (prioridade menor) com 'remover' pode esvaziar esta (interseção textual).");
            if (pB < pA && comportamentoRemove(B.comportamento))
              addRecDirected(A, B, "Perda de Objeto", "Médio", "Regra anterior (prioridade menor) com 'remover' pode esvaziar esta (interseção textual).");
          }
        }
      }
    }

    // Monta conflictsByRule combinando registros “normais” e os “direcionados”
    const conflictsByRule = new Map();

    // 1) Normais (pares simétricos baseados no menor número)
    for (const [k, rec] of pairsMap.entries()) {
      if (String(k).startsWith("FORCE|")) continue; // pula os direcionados, trata já-já
      const base = rec.iNum, other = rec.jNum;
      (conflictsByRule.get(base) || conflictsByRule.set(base, new Map()).get(base)).set(other, rec);
    }

    // 2) Direcionados (FORCE): garantir que apareçam NA REGRA BASE (alertada)
    for (const [k, rec] of pairsMap.entries()) {
      if (!String(k).startsWith("FORCE|")) continue;
      const base = rec.iNum, other = rec.jNum;
      const m = (conflictsByRule.get(base) || conflictsByRule.set(base, new Map()).get(base));
      const already = m.get(other);
      if (already) {
        // mescla com um possível registro existente
        for (const t of rec.tipos) already.tipos.add(t);
        for (const mo of rec.motivos) already.motivos.add(mo);
        if (impactoRank[rec.impactoMax] > impactoRank[already.impactoMax]) already.impactoMax = rec.impactoMax;
      } else {
        m.set(other, rec);
      }
    }

    return conflictsByRule;
  }

  function injectStyle() {
    if (document.getElementById("atp-conf-inline-style")) return;
    const style = document.createElement("style");
    style.id = "atp-conf-inline-style";
    style.textContent = `
      .atp-badge { display:inline-block; padding:2px 6px; border-radius:6px; font-size:11px; margin-right:6px; background:#e5e7eb; }
      .atp-badge.collision   { background:#fecaca }
      .atp-badge.overlap     { background:#fed7aa }
      .atp-badge.objectloss  { background:#fde68a }
      .atp-muted { color:#6b7280 }
      .atp-sev-3 { background:#fff1f2 }
      .atp-sev-2 { background:#fff7ed }
      #btnRecalcATP { margin:8px 0; padding:6px 10px; font-weight:600; border:1px solid #065f46; background:#10b981; color:#083344; border-radius:6px; cursor:pointer; }
      th[data-atp-col="motivo-th"] { width:200px; min-width:200px; max-width:200px; }
      td[data-atp-col="motivo"]    { width:200px; max-width:200px; word-wrap:break-word; overflow-wrap:anywhere; }
    `;
    document.head.appendChild(style);
  }

  function ensureColumns(table) {
    const thead = table.tHead || table.querySelector("thead");
    if (!thead) return;

    const ths = thead.querySelectorAll("th");
    let hasConfl = false, hasMot = false, motivoTh = null;

    ths.forEach(th => {
      const t = th.textContent || "";
      if (/Conflita com/i.test(t)) hasConfl = true;
      if (/Tipo\s*\/\s*Motivo/i.test(t)) { hasMot = true; motivoTh = th; }
    });

    if (!hasConfl || !hasMot) {
      const headerRow = thead.rows[0] || thead.querySelector("tr");
      if (!headerRow) return;

      if (!hasConfl) {
        const th1 = document.createElement("th");
        th1.textContent = "Conflita com (Nº)";
        th1.style.whiteSpace = "nowrap";
        th1.setAttribute("data-atp-col","conflita-th");
        headerRow.appendChild(th1);
      }
      if (!hasMot) {
        const th2 = document.createElement("th");
        th2.textContent = "Tipo / Motivo";
        th2.style.whiteSpace = "nowrap";
        th2.setAttribute("data-atp-col","motivo-th");
        th2.style.width = "200px";
        th2.style.minWidth = "200px";
        th2.style.maxWidth = "200px";
        headerRow.appendChild(th2);
        motivoTh = th2;
      }
    }

    if (motivoTh) {
      motivoTh.setAttribute("data-atp-col","motivo-th");
      motivoTh.style.width = "200px";
      motivoTh.style.minWidth = "200px";
      motivoTh.style.maxWidth = "200px";
    }

    const tbodys = table.tBodies?.length ? Array.from(table.tBodies) : [table.querySelector("tbody")].filter(Boolean);
    const bodyRows = tbodys.flatMap(tb => Array.from(tb.rows));

    bodyRows.forEach(tr => {
      let confTd = tr.querySelector('td[data-atp-col="conflita"]');
      let motTd  = tr.querySelector('td[data-atp-col="motivo"]');
      if (!confTd) {
        confTd = document.createElement("td");
        confTd.dataset.atpCol = "conflita";
        confTd.style.verticalAlign = "top";
        tr.appendChild(confTd);
      }
      if (!motTd) {
        motTd = document.createElement("td");
        motTd.dataset.atpCol = "motivo";
        motTd.style.verticalAlign = "top";
        motTd.style.width = "200px";
        motTd.style.maxWidth = "200px";
        tr.appendChild(motTd);
      }
    });

    injectStyle();
  }

  function severityForRec(rec) {
    let max = 0;
    for (const t of rec.tipos) max = Math.max(max, tipoRank[t]||0);
    return max;
  }

  function renderIntoTable(table, rules, conflictsByRule, prevRendered) {
    const tbodys = table.tBodies?.length ? Array.from(table.tBodies) : [table.querySelector("tbody")].filter(Boolean);
    const rows = tbodys.flatMap(tb => Array.from(tb.rows));
    const cols = mapColumns(table);

    const rowMap = new Map();
    rows.forEach(tr => {
      const tds = tr.querySelectorAll(':scope > td');
      const tdNumPrior = tds[cols?.colNumPrior ?? 1];
      const num = getNumeroRegra(tdNumPrior);
      if (num) rowMap.set(num, tr);
    });

    for (const r of rules) {
      const adj = conflictsByRule.get(r.num);
      const tr  = rowMap.get(r.num);
      if (!tr) continue;

      const confTd = tr.querySelector('td[data-atp-col="conflita"]');
      const motTd  = tr.querySelector('td[data-atp-col="motivo"]');

      let confStr = "", motivoHTML = "", maxSev = 0;
      let hasConflict = false;

      if (adj && adj.size) {
        hasConflict = true;
        const others = [...adj.keys()].sort((a,b)=> String(a).localeCompare(String(b), "pt-BR", { numeric:true, sensitivity:"base" }));
        confStr = others.join(", ");

        const tipoClass = (t) => ({
          "Colisão Total":"collision",
          "Colisão Parcial":"collision",
          "Sobreposição":"overlap",
          "Perda de Objeto":"objectloss"
        }[t] || "");

        const htmlParts = [];
        for (const n of others) {
          const rec = adj.get(n);
          const tiposOrd = [...rec.tipos].sort((a,b)=> (tipoRank[b]-tipoRank[a]));
          if (!tiposOrd.length) continue;
          const badges = tiposOrd.map(t=> `<span class="atp-badge ${tipoClass(t)}">${t}</span>`).join(" ");
          const motivoTxt = [...rec.motivos].join(" | ");
          htmlParts.push(`<div>${badges} <span class="atp-muted">(${esc(rec.impactoMax)})</span> — ${esc(motivoTxt)}</div>`);
          maxSev = Math.max(maxSev, severityForRec(rec));
        }
        motivoHTML = htmlParts.join("");
      }

      if (hasConflict) tr.dataset.atpHasConflict = "1"; else delete tr.dataset.atpHasConflict;

      const prev = prevRendered.get(r.num) || { conf:"", html:"", sev:0 };
      if (confStr !== prev.conf) confTd && (confTd.textContent = confStr);
      if (motivoHTML !== prev.html) motTd && (motTd.innerHTML = motivoHTML);

      if (prev.sev !== maxSev) {
        tr.classList.remove("atp-sev-2","atp-sev-3");
        if (maxSev >= 2) tr.classList.add(`atp-sev-${maxSev}`);
      }
      prevRendered.set(r.num, { conf: confStr, html: motivoHTML, sev: maxSev });
    }

    applyConflictFilter(table, filterOnlyConflicts);
  }

  function addRecalcButton(table, onClick) {
    if (document.getElementById("btnRecalcATP")) return;
    const btn = document.createElement("button");
    btn.id = "btnRecalcATP";
    btn.type = "button";
    btn.textContent = "(Re)calcular Conflitos";
    table.parentElement.insertBefore(btn, table);
    btn.addEventListener("click", () => scheduleIdle(onClick, 0));
  }

  function addOnlyConflictsCheckbox(table, onChange) {
    const host = document.getElementById("dvFiltrosOpcionais");
    if (!host) return;
    if (host.querySelector('#chkApenasConflito')) return;

    const spacer = document.createTextNode(" ");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.id = "chkApenasConflito";
    cb.className = "infraCheckBox";
    cb.style.marginLeft = "12px";

    const label = document.createElement("label");
    label.htmlFor = "chkApenasConflito";
    label.className = "infraLabelCheckBox";
    label.style.verticalAlign = "middle";
    label.textContent = "Apenas regras com conflito";

    cb.addEventListener("change", () => {
      filterOnlyConflicts = cb.checked;
      onChange();
    });

    host.appendChild(spacer);
    host.appendChild(cb);
    host.appendChild(label);
  }

  function applyConflictFilter(table, only) {
    const tbodys = table.tBodies?.length ? Array.from(table.tBodies) : [table.querySelector("tbody")].filter(Boolean);
    const bodyRows = tbodys.flatMap(tb => Array.from(tb.rows));
    for (const tr of bodyRows) {
      if (!only) {
        tr.style.display = "";
      } else {
        tr.style.display = tr.dataset.atpHasConflict === "1" ? "" : "none";
      }
    }
  }

  function findTargetTable() {
    let t = document.querySelector("#tableAutomatizacaoLocalizadores");
    if (t) return t;

    const candidates = Array.from(document.querySelectorAll("table"));
    const wanted = [
      /n[ºo]\s*\/?\s*prioridade/i,
      /localizador.*remover/i,
      /tipo.*(controle|crit[ée]rio)/i,
      /localizador.*(incluir|a[cç][aã]o)/i,
      /outros\s*crit[ée]rios/i
    ];
    const score = (table) => {
      const ths = Array.from((table.tHead || table).querySelectorAll("th"));
      if (!ths.length) return 0;
      const text = ths.map(th => norm(th.textContent)).join(" | ");
      let s = 0;
      for (const re of wanted) if (re.test(text)) s++;
      return s;
    };
    let best = null, bestScore = 0;
    for (const c of candidates) {
      const s = score(c);
      if (s > bestScore) { best = c; bestScore = s; }
    }
    return bestScore >= 3 ? best : null;
  }

  function waitTable(timeoutMs = 120000) {
    const direct = findTargetTable();
    if (direct) return Promise.resolve(direct);
    return new Promise(resolve => {
      const mo = new MutationObserver(() => {
        const tb = findTargetTable();
        if (tb) { mo.disconnect(); resolve(tb); }
      });
      mo.observe(document.body, { childList:true, subtree:true });
      setTimeout(()=>{ mo.disconnect(); resolve(null); }, timeoutMs);
    });
  }

  function makeRunner(table){
    const prevRowSig = new WeakMap();
    const prevRendered = new Map();
    let lastTableHash = "";
    let cols = mapColumns(table);

    const recalc = () => {
      if (!document.body.contains(table)) return;
      ensureColumns(table);
      cols = mapColumns(table);
      const rowSigCollector = new WeakMap();
      const rules = parseRulesFromTable(table, cols, rowSigCollector);
      if (!rules.length) return;

      let combined = "";
      for (const r of rules) combined += `${r.num}|${r.prioridade.text}|${r.origem}|${r.comportamento}|${r.tipoRaw}|${r.destino}|${r.outrosRaw}#`;
      if (combined === lastTableHash) {
        applyConflictFilter(table, filterOnlyConflicts);
        return;
      }
      lastTableHash = combined;

      const conflictsByRule = analyzeConflicts(rules);
      renderIntoTable(table, rules, conflictsByRule, prevRendered);

      for (const [tr, sig] of rowSigCollector.entries()) prevRowSig.set(tr, sig);
    };

    return recalc;
  }

  function bindPriorityChange(table, recalc) {
    table.addEventListener("change", (e) => {
      const sel = e.target;
      if (sel && sel.tagName === "SELECT") scheduleIdle(recalc, 120);
    });
  }

  function ensureColumns(table) {
    const thead = table.tHead || table.querySelector("thead");
    if (!thead) return;

    const ths = thead.querySelectorAll("th");
    let hasConfl = false, hasMot = false, motivoTh = null;

    ths.forEach(th => {
      const t = th.textContent || "";
      if (/Conflita com/i.test(t)) hasConfl = true;
      if (/Tipo\s*\/\s*Motivo/i.test(t)) { hasMot = true; motivoTh = th; }
    });

    if (!hasConfl || !hasMot) {
      const headerRow = thead.rows[0] || thead.querySelector("tr");
      if (!headerRow) return;

      if (!hasConfl) {
        const th1 = document.createElement("th");
        th1.textContent = "Conflita com (Nº)";
        th1.style.whiteSpace = "nowrap";
        th1.setAttribute("data-atp-col","conflita-th");
        headerRow.appendChild(th1);
      }
      if (!hasMot) {
        const th2 = document.createElement("th");
        th2.textContent = "Tipo / Motivo";
        th2.style.whiteSpace = "nowrap";
        th2.setAttribute("data-atp-col","motivo-th");
        th2.style.width = "200px";
        th2.style.minWidth = "200px";
        th2.style.maxWidth = "200px";
        headerRow.appendChild(th2);
        motivoTh = th2;
      }
    }

    if (motivoTh) {
      motivoTh.setAttribute("data-atp-col","motivo-th");
      motivoTh.style.width = "200px";
      motivoTh.style.minWidth = "200px";
      motivoTh.style.maxWidth = "200px";
    }

    const tbodys = table.tBodies?.length ? Array.from(table.tBodies) : [table.querySelector("tbody")].filter(Boolean);
    const bodyRows = tbodys.flatMap(tb => Array.from(tb.rows));

    bodyRows.forEach(tr => {
      let confTd = tr.querySelector('td[data-atp-col="conflita"]');
      let motTd  = tr.querySelector('td[data-atp-col="motivo"]');
      if (!confTd) {
        confTd = document.createElement("td");
        confTd.dataset.atpCol = "conflita";
        confTd.style.verticalAlign = "top";
        tr.appendChild(confTd);
      }
      if (!motTd) {
        motTd = document.createElement("td");
        motTd.dataset.atpCol = "motivo";
        motTd.style.verticalAlign = "top";
        motTd.style.width = "200px";
        motTd.style.maxWidth = "200px";
        tr.appendChild(motTd);
      }
    });

    injectStyle();
  }

  function start(table){
    ensureColumns(table);
    const recalc = makeRunner(table);

    addRecalcButton(table, recalc);
    addOnlyConflictsCheckbox(table, () => scheduleIdle(recalc, 0));
    bindPriorityChange(table, recalc);
    scheduleIdle(recalc, 0);

    const mo = new MutationObserver((mutList) => {
      const relevant = mutList.some(m => {
        const n = m.target;
        return n && table.contains(n) && !(n.closest && n.closest('td[data-atp-col]'));
      });
      if (relevant) scheduleIdle(recalc, 200);
    });
    mo.observe(table, { childList: true, subtree: true });

    const rootMo = new MutationObserver(() => {
      if (!document.body.contains(table)) {
        rootMo.disconnect();
        init();
      }
    });
    rootMo.observe(document.body, { childList:true, subtree:true });
  }

  async function init() {
    const table = await waitTable();
    if (!table) return;
    start(table);
  }

  try { console.log("[ATP] v2.8.4 ativo em:", location.href); } catch(e){}
  init();
})();
