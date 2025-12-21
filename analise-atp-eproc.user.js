// ==UserScript==
// @name         Análise de ATP eProc
// @namespace    https://tjsp.eproc/automatizacoes
// @version      2.18.6
// @description  Colisão Total/Parcial, Sobreposição, Perda de Objeto (direcionada) e Looping (multi-localizadores); ignora regras desativadas (quando checkbox existe); coluna única de conflitos com tooltip e botão Comparar; filtro; REMOVER com dropdown custom (emoji por option + observação) e troca do ícone/“lupa” do tooltip REMOVER conforme texto do tooltip e/ou opção selecionada.
// @author
// @run-at       document-end
// @noframes
// @match        https://eproc1g.tjsp.jus.br/eproc/*
// @match        https://eproc-1g-sp-hml.tjsp.jus.br/*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/oadrianocardoso/analise-atp-eproc/main/analise-atp-eproc.user.js
// @downloadURL  https://raw.githubusercontent.com/oadrianocardoso/analise-atp-eproc/main/analise-atp-eproc.user.js
// ==/UserScript==

(function () {
  "use strict";

  let filterOnlyConflicts = false;

  const tipoRank    = { "Colisão Total": 5, "Colisão Parcial": 4, "Perda de Objeto": 3, "Looping": 5, "Sobreposição": 2 };
  const impactoRank = { "Alto": 3, "Médio": 2, "Baixo": 1 };

  // ==========================================================
  // LIMPEZA igual ao exportador
  // ==========================================================
  function limparTexto(elOrStr){
    if (!elOrStr) return "";
    const s = (typeof elOrStr === "string") ? elOrStr : (elOrStr.textContent || "");
    return s.replace(/\u00A0/g," ").replace(/\s+/g," ").trim();
  }

  function limparTextoRemoverBase(td){
    // Para "origem" (Localizador REMOVER), ignora o sufixo dinâmico inserido pelo script (emoji/nota),
    // pois ele muda conforme a opção (Remover todos / marcados) e não deve quebrar o agrupamento.
    try{
      if(!td) return '';
      const clone = td.cloneNode(true);
      const extra = clone.querySelector('.atp-remover-emoji');
      if(extra) extra.remove();
      return limparTexto(clone.textContent || '');
    }catch(e){
      return limparTexto((td && (td.textContent||td.innerText)) || '');
    }
  }
  const lower = s => limparTexto(s).toLowerCase();
  const esc   = s => String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  const rmAcc = s => s?.normalize?.("NFD").replace(/[\u0300-\u036f]/g,"") ?? s;

  let debounceTimer = null, idleHandle = null, pendingRecalc = false;
  function scheduleIdle(fn, wait=160){
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      pendingRecalc = true;
      if ("requestIdleCallback" in window) {
        if (idleHandle) cancelIdleCallback(idleHandle);
        idleHandle = requestIdleCallback(() => { pendingRecalc = false; fn(); }, { timeout: 1200 });
      } else {
        setTimeout(() => { if (pendingRecalc) { pendingRecalc = false; fn(); } }, 0);
      }
    }, wait);
  }

  function mapColumns(table){
    const thead = table.tHead || table.querySelector("thead");
    if (!thead) return null;
    const ths = Array.from(thead.querySelectorAll("th"));
    const find = (labels) => {
      const idx = ths.findIndex(th => labels.some(lbl => lower(th.textContent||"").includes(lbl)));
      return idx >= 0 ? idx : null;
    };
    return {
      colNumPrior: find(["nº","no","n°","prioridade"]) ?? 1,
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
      if (n.nodeType === 3) out += n.nodeValue;
      else if (n.nodeType === 1) {
        if (n.tagName === "IMG") return;
        if (n.tagName === "BR") out += " ";
        else out += " " + (n.textContent || "");
      }
    });
    return limparTexto(out);
  }

  function getNumeroRegra(td) {
    const m = limparTexto(td?.textContent||"").match(/^\s*(\d{1,6})\b/);
    return m ? m[1] : "";
  }

  function getPrioridadeTexto(td){
    const sel = td?.querySelector("select");
    if (sel){
      const opt = sel.selectedOptions?.[0] || sel.querySelector("option[selected]") || sel.options?.[sel.selectedIndex];
      if (opt) return limparTexto(opt.textContent || "");
    }
    const raw = limparTexto(td?.textContent || "");
    const m = raw.match(/([0-9]{1,4})/);
    return m ? m[1] : raw;
  }

  function parsePriority(p) {
    if (!p) return { raw: "[*]", num: null, text: "[*]" };
    const m = String(p).match(/\d+/);
    return m ? { raw: p, num: Number(m[0]), text: String(p).trim() } : { raw: p, num: null, text: String(p).trim() };
  }

  function prioritiesEqual(pa, pb){
    if (pa?.num != null && pb?.num != null) return pa.num === pb.num;
    const ta = lower(pa?.raw || pa?.text || "");
    const tb = lower(pb?.raw || pb?.text || "");
    if (!ta || !tb || ta === "[*]" || tb === "[*]") return false;
    return !/\d/.test(ta) && !/\d/.test(tb);
  }


function getRemoverBehaviorText(td){
  let parts = [];

  // (0) dataset direto no TD (casos "Nenhum", "Todos os localizadores", etc.)
  const tdVal = td?.dataset?.atpRemoverVal;
  const tdMsg = td?.dataset?.atpRemoverMsg;
  if (tdMsg) parts.push(limparTexto(tdMsg));
  if (tdVal != null && tdVal !== "") parts.push("VAL=" + String(tdVal));

  // (1) tenta capturar tooltip infraTooltipMostrar a partir de QUALQUER elemento (img ou span) que carregue o tooltip
  const tipEl = td?.querySelector('[onmouseover*="Comportamento do Localizador REMOVER"]');
  if (tipEl){
    const onm = tipEl.getAttribute("onmouseover") || "";
    const msg = parseTooltipMsgFromOnmouseover(onm);
    if (msg) parts.push(limparTexto(msg));

    // se o elemento já foi trocado por emoji, pode ter dataset
    const dv = tipEl.dataset?.atpRemoverVal;
    const dm = tipEl.dataset?.atpRemoverMsg;
    if (dm) parts.push(limparTexto(dm));
    if (dv != null && dv !== "") parts.push("VAL=" + String(dv));
  }

  // (2) fallback antigo (img)
  const img = td?.querySelector('img[onmouseover*="infraTooltipMostrar"]');
  if (img){
    const js = img.getAttribute("onmouseover") || "";
    const m = js.match(/infraTooltipMostrar\('([^']*)'/);
    if (m) parts.push(limparTexto(m[1]));
    const t = img.getAttribute("title"); if (t) parts.push(limparTexto(t));
    const a = img.getAttribute("alt");   if (a) parts.push(limparTexto(a));
  }

  const tt = td?.getAttribute?.("title"); if (tt) parts.push(limparTexto(tt));
  parts.push(textWithoutImages(td));
  return parts.filter(Boolean).join(" | ");
}

  function comportamentoRemove(txt){
    const s = lower(txt || "");

    // Se o tooltip/emoji guardou um VAL=, usamos isso como fonte de verdade
    const mv = (s.match(/\bval\s*=\s*([0-9]+)\b/) || [])[1];
    if (mv === "3") return false; // não remover
    if (mv === "0" || mv === "1" || mv === "2" || mv === "4") return true;
    if (/na[oõ]\s*remover\b/.test(s)) return false;
    if (/apenas\s+acrescentar\s+o\s+indicado/.test(s)) return false;
    return /remover\s+o\s+processo.*localizador(?:es)?\s+informado(?:s)?|remover\s+o\s+processo\s+de\s+todos\s+localizadores|remover\s+os\s+processos\s+de\s+todos\s+os\s+localizadores|remover\s+.*localizador/.test(s);
  }

  function normalizarChave(label) {
    if (!label) return null;
    let key = label.replace(/:/g,"").trim();
    key = key.normalize("NFD").replace(/[\u0300-\u036f]/g,"");
    key = key.toLowerCase().replace(/[^a-z0-9]/g,"");
    return key || null;
  }

  function extrairMapaCriterios(tdOutros) {
    const criterios = {};
    if (!tdOutros) return criterios;

    const divs = tdOutros.querySelectorAll("div.ml-0.pt-2");
    divs.forEach(div => {
      const span = div.querySelector("span.lblFiltro, span.font-weight-bold");
      if (!span) return;
      const label = (span.textContent || "").trim();
      const key = normalizarChave(label);
      if (!key) return;

      let valor = (div.textContent || "").replace(label, "");
      valor = valor.replace(/\u00a0/g, " ");
      valor = valor.replace(/\s+/g," ").trim();
      criterios[key] = valor;
    });

    return criterios;
  }

  function splitValues(raw){
    if (!raw) return new Set();
    const base = rmAcc(lower(raw))
      .replace(/\s*\(\s*\)\s*/g,"")
      .replace(/[|]+/g,"|")
      .replace(/,+/g,",")
      .replace(/\s{2,}/g," ")
      .replace(/[.;]\s*$/,"")
      .trim();
    return new Set(base.split(/;|\||,|\s+ou\s+|\s+e\s+/i).map(s => s.trim()).filter(Boolean));
  }

  function parseOutrosFromCriterios(criterios){
    const res = { grupos: new Map(), livre: new Set() };
    if (!criterios) return res;

    for (const [key, val] of Object.entries(criterios)) {
      if (!val) continue;
      const vals = splitValues(val);
      if (!res.grupos.has(key)) res.grupos.set(key, new Set());
      const set = res.grupos.get(key);
      vals.forEach(v => set.add(v));
    }
    return res;
  }

  function outrosIdenticos(a, b){
    if (a.grupos.size !== b.grupos.size || a.livre.size !== b.livre.size) return false;
    for (const [k, setA] of a.grupos.entries()){
      const setB = b.grupos.get(k);
      if (!setB || setA.size !== setB.size) return false;
      for (const v of setA) if (!setB.has(v)) return false;
    }
    for (const v of a.livre) if (!b.livre.has(v)) return false;
    return true;
  }

  // Retorna true quando B contém TODOS os critérios de A e possui MAIS critérios/valores.
  // Logo: A é MAIS AMPLA (menos restritiva) e B é MAIS RESTRITA (filtra mais).
  function outrosSubAemB(a, b){
    for (const [k, setA] of a.grupos.entries()){
      const setB = b.grupos.get(k);
      if (!setB) return false;
      for (const v of setA) if (!setB.has(v)) return false;
    }
    for (const v of a.livre) if (!b.livre.has(v)) return false;

    const hasMore = (b.grupos.size > a.grupos.size) ||
                    Array.from(b.grupos.keys()).some(k => (a.grupos.get(k)?.size ?? 0) < b.grupos.get(k).size) ||
                    (b.livre.size > a.livre.size);
    return hasMore;
  }

  function buildOutrosEstrutura(rule){
    if (rule.criterios && Object.keys(rule.criterios).length){
      return parseOutrosFromCriterios(rule.criterios);
    }
    return { grupos: new Map(), livre: new Set() };
  }

  function relationOutros(ruleA, ruleB) {
    const sa = buildOutrosEstrutura(ruleA);
    const sb = buildOutrosEstrutura(ruleB);

    if (outrosIdenticos(sa, sb)) return "identicos";
    if (outrosSubAemB(sa, sb))   return "sub_a_em_b"; // A mais ampla, B mais restrita
    if (outrosSubAemB(sb, sa))   return "sub_b_em_a"; // B mais ampla, A mais restrita
    return "diferentes";
  }

  function locSiglas(cellText){
    const parts = limparTexto(cellText).split(/\s*\|\s*/).map(s => s.trim()).filter(Boolean);
    const set = new Set();
    for (const p of parts){
      if (p === "E" || p === "OU") continue;
      const idx = p.indexOf(" - ");
      if (idx > 0){
        const sigla = lower(p.slice(0, idx));
        if (sigla) set.add(sigla);
      }
    }
    return set;
  }

  function getCondicaoExecucao(tdCond){
    if (!tdCond) return "[*]";
    const divComp = tdCond.querySelector('div[id^="dadosCompletos_"]');
    const divRes  = tdCond.querySelector('div[id^="dadosResumidos_"]');

    if (divComp && limparTexto(divComp)) return limparTexto(divComp);
    if (divRes && limparTexto(divRes))   return limparTexto(divRes);
    return limparTexto(tdCond);
  }

  // ==========================================================
  // EXTRAÇÃO DE REGRAS
  // ✅ FIX: se NÃO existir checkbox na linha, considera ATIVA
  // ==========================================================
  function parseRulesFromTable(table, cols) {
    const list = [];
    const tbodys = table.tBodies?.length ? Array.from(table.tBodies) : [table.querySelector("tbody")].filter(Boolean);
    const rows = tbodys.flatMap(tb => Array.from(tb.rows));

    for (const tr of rows) {
      const tds = Array.from(tr.querySelectorAll(':scope > td'));
      if (!tds.length) continue;

      delete tr.dataset.atpInactive;
      if (!filterOnlyConflicts) tr.style.display = "";

      const tdNumPrior = tds[cols.colNumPrior] || tds[1];
      const tdRemover  = tds[cols.colRemover]  || tds[3];
      const tdTipo     = tds[cols.colTipo]     || tds[4];
      const tdIncluir  = tds[cols.colIncluir]  || tds[5];
      const tdOutros   = tds[cols.colOutros]   || tds[6];

      const tdAcoes = tds.find(td => td.querySelector('input.custom-control-input')) || null;
      const chkAtiva = tdAcoes?.querySelector('input.custom-control-input') || null;

      // ✅ se não achou checkbox, assume ativa; se achou, respeita checked
      const ativa = chkAtiva ? !!chkAtiva.checked : true;

      if (chkAtiva && !ativa) {
        tr.dataset.atpInactive = "1";
        tr.style.display = "none";
        continue;
      }

      const num = getNumeroRegra(tdNumPrior);
      if (!num) continue;

      const prioridadeTexto = getPrioridadeTexto(tdNumPrior);
      const criterios       = extrairMapaCriterios(tdOutros);

      list.push({
        num,
        prioridade: parsePriority(prioridadeTexto),
        origem: (tdRemover?.dataset?.atpRemoverWildcard === "1") ? "[*]" : limparTextoRemoverBase(tdRemover),
        comportamento: getRemoverBehaviorText(tdRemover) || "[*]",
        destino: limparTexto(tdIncluir),
        tipoRaw: limparTexto(tdTipo) || "[*]",
        outrosRaw: getCondicaoExecucao(tdOutros) || "[*]",
        criterios,
        ativa,
        tr
      });
    }
    return list;
  }

  // ==========================================================
  // ANÁLISE (alerta sempre na regra que SOFRE)
  // ==========================================================

// ==========================================================
// ANÁLISE (alerta sempre na regra que SOFRE)
// - "origem" pode ser "[*]" (coringa) quando a tela mostra: Nenhum / Todos os localizadores / Manter os localizadores de sistema
//   => nesses casos, a regra NÃO filtra por Localizador REMOVER (aplica a todos os processos)
// ==========================================================
function analyzeConflicts(rules) {
  const conflictsByRule = new Map();

  function ensureBucket(baseNum){
    let bucket = conflictsByRule.get(baseNum);
    if (!bucket) { bucket = new Map(); conflictsByRule.set(baseNum, bucket); }
    return bucket;
  }

  function upsert(baseNum, otherNum, tipo, impacto, motivo){
    const bucket = ensureBucket(baseNum);
    const ex = bucket.get(otherNum) || { iNum: baseNum, jNum: otherNum, tipos: new Set(), motivosByTipo: new Map(), impactoMax: "Baixo" };
    ex.tipos.add(tipo);
    if (!ex.motivosByTipo.has(tipo)) ex.motivosByTipo.set(tipo, new Set());
    ex.motivosByTipo.get(tipo).add(motivo);
    if (impactoRank[impacto] > impactoRank[ex.impactoMax]) ex.impactoMax = impacto;
    bucket.set(otherNum, ex);
  }

  function addOnBoth(aNum, bNum, tipo, impacto, motivo){
    upsert(aNum, bNum, tipo, impacto, motivo);
    upsert(bNum, aNum, tipo, impacto, motivo);
  }

  function comparePair(A, B){
    const rel = relationOutros(A, B);
    const pA  = A.prioridade.num, pB = B.prioridade.num;
    const known = (pA != null && pB != null);

    // 1) Idênticos -> colisões
    if (rel === "identicos") {
      if ((known && pA === pB) || (!known && prioritiesEqual(A.prioridade, B.prioridade))) {
        addOnBoth(A.num, B.num, "Colisão Total", "Alto", "Prioridade, REMOVER, TIPO e CRITÉRIOS idênticos.");
      } else {
        addOnBoth(A.num, B.num, "Colisão Parcial", "Alto", "REMOVER, TIPO e CRITÉRIOS idênticos; prioridades diferentes.");
      }

      // Perda de objeto: se anterior remove, o posterior pode ser esvaziado (critérios idênticos)
      if (known) {
        const anterior  = (pA < pB) ? A : (pB < pA ? B : null);
        const posterior = (pA < pB) ? B : (pB < pA ? A : null);
        if (anterior && posterior && comportamentoRemove(anterior.comportamento)) {
          upsert(posterior.num, anterior.num, "Perda de Objeto", "Médio", "Regra anterior com 'remover' pode esvaziar esta (critérios idênticos).");
        }
      }
      return;
    }

    // Sem prioridade numérica não dá pra decidir execução
    if (!known) return;

    // 2) Inclusão/Subset (mais critérios = mais restrita)
    // rel === "sub_a_em_b" => A é mais ampla, B é mais restrita
    if (rel === "sub_a_em_b") {
      // Se A executa antes (pA < pB), então B (mais restrita) "sofre"
      if (pA < pB) {
        upsert(B.num, A.num, "Sobreposição", "Médio", "Regra mais ampla executa antes; esta (mais restrita) fica sobreposta.");
        if (comportamentoRemove(A.comportamento)) {
          upsert(B.num, A.num, "Perda de Objeto", "Médio", "Regra anterior (mais ampla) com 'remover' pode esvaziar esta.");
        }
      }
    }

    // rel === "sub_b_em_a" => B é mais ampla, A é mais restrita
    if (rel === "sub_b_em_a") {
      // Se B executa antes (pB < pA), então A (mais restrita) "sofre"
      if (pB < pA) {
        upsert(A.num, B.num, "Sobreposição", "Médio", "Regra mais ampla executa antes; esta (mais restrita) fica sobreposta.");
        if (comportamentoRemove(B.comportamento)) {
          upsert(A.num, B.num, "Perda de Objeto", "Médio", "Regra anterior (mais ampla) com 'remover' pode esvaziar esta.");
        }
      }
    }
  }

  // Agrupa por TIPO e (origem específica ou coringa)
  const byTipo = new Map();
  for (const r of rules) {
    const tipoKey = (r.tipoRaw || "[*]");
    let slot = byTipo.get(tipoKey);
    if (!slot) { slot = { specific: new Map(), wildcard: [] }; byTipo.set(tipoKey, slot); }

    const isWildcard = (r.origem === "[*]") || (r.tr?.querySelector?.(':scope > td')?.[0]?.dataset?.atpRemoverWildcard === "1");
    if (isWildcard) {
      slot.wildcard.push(r);
    } else {
      const oKey = (r.origem || "");
      let arr = slot.specific.get(oKey);
      if (!arr) { arr = []; slot.specific.set(oKey, arr); }
      arr.push(r);
    }
  }

  // Comparações:
  // (a) dentro de cada origem específica (mantém performance)
  // (b) coringas vs todo mundo do mesmo tipo
  const processed = new Set();

  for (const slot of byTipo.values()) {
    // (a) buckets específicos
    for (const arr of slot.specific.values()) {
      if (!arr || arr.length < 2) continue;
      for (let x=0; x<arr.length; x++){
        const A = arr[x];
        for (let y=x+1; y<arr.length; y++){
          const B = arr[y];
          const k = (Number(A.num) < Number(B.num)) ? `${A.num}#${B.num}` : `${B.num}#${A.num}`;
          if (processed.has(k)) continue;
          processed.add(k);
          comparePair(A,B);
        }
      }
    }

    // (b) coringas vs todos no tipo
    if (slot.wildcard && slot.wildcard.length) {
      const all = [];
      slot.specific.forEach(arr => { if (arr && arr.length) all.push(...arr); });
      all.push(...slot.wildcard);

      for (let i=0; i<slot.wildcard.length; i++){
        const W = slot.wildcard[i];
        for (let j=0; j<all.length; j++){
          const R = all[j];
          if (R === W) continue;
          const k = (Number(W.num) < Number(R.num)) ? `${W.num}#${R.num}` : `${R.num}#${W.num}`;
          if (processed.has(k)) continue;
          processed.add(k);
          comparePair(W,R);
        }
      }
    }
  }

  // 3) Looping (multi-localizadores) — requer TIPO igual e critérios idênticos
  for (let i=0; i<rules.length; i++){
    const A = rules[i];
    for (let j=i+1; j<rules.length; j++){
      const B = rules[j];
      if (lower(A.tipoRaw) !== lower(B.tipoRaw)) continue;
      if (relationOutros(A, B) !== "identicos") continue;

      const remA = locSiglas(A.origem), incA = locSiglas(A.destino);
      const remB = locSiglas(B.origem), incB = locSiglas(B.destino);
      if (!remA.size || !incA.size || !remB.size || !incB.size) continue;

      const aRemAlgumQueBInclui = [...remA].some(x => incB.has(x));
      const bRemAlgumQueAInclui = [...remB].some(x => incA.has(x));
      if (aRemAlgumQueBInclui && bRemAlgumQueAInclui){
        const motivo = `Looping potencial: A remove ${A.origem} e inclui ${A.destino}; B remove ${B.origem} e inclui ${B.destino}; Critérios idênticos.`;
        addOnBoth(A.num, B.num, "Looping", "Alto", motivo);
      }
    }
  }

  return conflictsByRule;
}

  function injectStyle(){
    if (document.getElementById("atp-conf-inline-style")) return;
    const style = document.createElement("style");
    style.id = "atp-conf-inline-style";
    style.textContent = `
      .atp-badge{display:inline-block;padding:2px 6px;border-radius:6px;font-size:11px;margin-right:6px;background:#e5e7eb;}
      .atp-badge.collision{background:#fecaca}
      .atp-badge.overlap{background:#fed7aa}
      .atp-badge.objectloss{background:#fde68a}
      .atp-badge.loop{background:#fee2e2}
      .atp-muted{color:#6b7280}
      .atp-sev-3{background:#fff1f2}
      .atp-sev-2{background:#fff7ed}
      .atp-sev-4{background:#ffe4e6}
      .atp-sev-5{background:#fecdd3}

      th[data-atp-col="motivo-th"],
      td[data-atp-col="motivo"]{display:none !important;}

      th[data-atp-col="conflita-th"]{width:260px;min-width:260px;max-width:260px;}
      td[data-atp-col="conflita"]{width:260px;max-width:260px;word-wrap:break-word;overflow-wrap:anywhere;}

      .atp-compare-btn{margin-top:4px;padding:2px 6px;border:1px solid #1f2937;border-radius:6px;font-size:11px;background:#f3f4f6;cursor:pointer;}
      .atp-compare-btn:hover{background:#e5e7eb}

      .atp-conf-num{font-weight:bold;margin-right:3px;}
      .atp-conf-tipo{font-weight:bold;padding:1px 4px;border-radius:4px;}
      .atp-conf-tipo.collision{background:#fecaca;}
      .atp-conf-tipo.overlap{background:#fed7aa;}
      .atp-conf-tipo.objectloss{background:#fde68a;}
      .atp-conf-tipo.loop{background:#fee2e2;}

      .atp-remover-emoji{display:inline-flex;align-items:center;gap:6px;vertical-align:middle;white-space:nowrap}
      .atp-remover-emoji .atp-remover-glyph{font-size:14px;line-height:1}
      .atp-remover-emoji .atp-remover-note{font-size:12px;opacity:.9}
      .atp-remover-emoji.atp-in-table{margin-left:6px}

  /* Emoji do tooltip "REMOVER" (substitui lupa.gif) */
  .atp-remover-emoji-tooltip{
    display:block;
    margin-top:2px;
    font-size:12px;
    line-height:1.2;
    width:fit-content;
    max-width:100%;
    white-space:nowrap;
    padding:1px 6px;
    border-radius:6px;
    background:#f3f4f6;
    border:1px solid #e5e7eb;
    user-select:none;
  }

      .atp-remover-wrap{display:inline-flex;align-items:center;gap:6px;position:relative}
      .atp-remover-fake{
        display:inline-flex;align-items:center;gap:8px;
        border:1px solid #cbd5e1;border-radius:6px;
        padding:2px 8px;background:#fff;cursor:pointer;
        user-select:none;min-height:24px;
      }
      .atp-remover-caret{margin-left:6px;font-size:10px;opacity:.7}
      .atp-remover-menu{
        position:absolute;left:0;top:calc(100% + 4px);
        background:#fff;border:1px solid #cbd5e1;border-radius:8px;
        box-shadow:0 10px 25px rgba(0,0,0,.12);
        padding:4px;z-index:999999;
        min-width:420px;display:none;
        max-height:260px;overflow:auto;
      }
      .atp-remover-menu.open{display:block}
      .atp-remover-item{
        display:flex;align-items:center;gap:10px;
        padding:6px 8px;border-radius:6px;cursor:pointer;
        font-size:12px;
      }
      .atp-remover-item:hover{background:#f1f5f9}
      .atp-remover-item.active{background:#e2e8f0}
      .atp-remover-item .atp-remover-glyph{font-size:14px}
      select.atp-remover-hidden{
        position:absolute !important;
        opacity:0 !important;
        pointer-events:none !important;
        width:1px !important;
        height:1px !important;
      }
      .atp-remover-plain-text{display:none !important;}
    `;
    document.head.appendChild(style);
  }

  function ensureColumns(table){
    const thead = table.tHead || table.querySelector("thead");
    if (!thead) return;

    const ths = Array.from(thead.querySelectorAll("th"));
    let hasConfl = false, hasMot = false;
    ths.forEach(th => {
      const t = th.textContent || "";
      if (/Conflita com/i.test(t)) hasConfl = true;
      if (/Tipo\s*\/\s*Motivo/i.test(t)) hasMot = true;
    });

    const headerRow = thead.rows[0] || thead.querySelector("tr");
    if (!hasConfl) {
      const th1 = document.createElement("th");
      th1.textContent = "Conflita com / Tipo";
      th1.style.whiteSpace = "nowrap";
      th1.setAttribute("data-atp-col", "conflita-th");
      headerRow.appendChild(th1);
    } else {
      const thConf = ths.find(th => /Conflita com/i.test(th.textContent||""));
      if (thConf) thConf.setAttribute("data-atp-col","conflita-th");
    }

    if (!hasMot) {
      const th2 = document.createElement("th");
      th2.textContent = "Tipo / Motivo";
      th2.style.whiteSpace = "nowrap";
      th2.setAttribute("data-atp-col", "motivo-th");
      headerRow.appendChild(th2);
    } else {
      const thMot = ths.find(th => /Tipo\s*\/\s*Motivo/i.test(th.textContent||""));
      if (thMot) thMot.setAttribute("data-atp-col","motivo-th");
    }

    const tbodys = table.tBodies?.length ? Array.from(table.tBodies) : [table.querySelector("tbody")].filter(Boolean);
    const rows = tbodys.flatMap(tb => Array.from(tb.rows));
    rows.forEach(tr => {
      let confTd = tr.querySelector('td[data-atp-col="conflita"]');
      let motTd  = tr.querySelector('td[data-atp-col="motivo"]');
      if (!confTd) { confTd = document.createElement("td"); confTd.dataset.atpCol = "conflita"; confTd.style.verticalAlign = "top"; tr.appendChild(confTd); }
      if (!motTd)  { motTd  = document.createElement("td"); motTd.dataset.atpCol  = "motivo";  motTd.style.verticalAlign  = "top"; tr.appendChild(motTd); }
    });

    injectStyle();
  }

  function severityForRec(rec) {
    if (!rec || !rec.tipos || !rec.tipos.size) return 0;
    const imp = rec.impacto || "Médio";
    const impScore = impactoRank[imp] || 1;
    let maxScore = 0;
    for (const t of rec.tipos) {
      const trk = tipoRank[t] || 0;
      maxScore = Math.max(maxScore, trk * impScore);
    }

    // score (1..15) => severidade visual 2..5
    if (maxScore <= 3)  return 2;
    if (maxScore <= 6)  return 3;
    if (maxScore <= 10) return 4;
    return 5;
  }

  function setNumeroRegraAndSearch(numsList){
    try{
      const txt = document.getElementById("txtNumeroRegra");
      const btn = document.getElementById("sbmPesquisar");

      if (txt) {
        txt.value = numsList.join(";");
        txt.dispatchEvent(new Event("input", { bubbles:true }));
        txt.dispatchEvent(new Event("change", { bubbles:true }));
        txt.dispatchEvent(new KeyboardEvent("keyup", { bubbles:true, key:"Enter" }));
      }

      setTimeout(() => {
        if (btn) btn.click();
        else if (typeof window.enviarFormularioAutomatizacao === "function") window.enviarFormularioAutomatizacao();
      }, 120);
    }catch{}
  }

  function makeCompareButton(ruleNum, confTd){
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "atp-compare-btn";
    btn.textContent = "Comparar";
    btn.addEventListener("click", () => {
      const rawNums = (confTd.dataset.atpConfNums || "")
        .split(",")
        .map(s => s.trim())
        .filter(Boolean);

      const all = rawNums.concat(String(ruleNum));
      const uniq = Array.from(new Set(all))
        .map(x => x.trim())
        .filter(Boolean)
        .sort((a,b)=> Number(a)-Number(b));

      setNumeroRegraAndSearch(uniq);
    });
    return btn;
  }

  const REMOVER_EMOJI = {
    "null": { glyph:"❔",   note:"" },
    "0":    { glyph:"❌📌", note:"(Remover marcados)" },
    "1":    { glyph:"❌❌", note:"(Remover todos)" },
    "2":    { glyph:"❌⚙️", note:"(Remover todos, exceto de sistema)" },
    "3":    { glyph:"➕➕", note:"(Não remover, apenas adicionar)" },
    "4":    { glyph:"❌🤖", note:"(Remover apenas de sistema)" }
  };

  function removerEmojiInfo(val){
    val = (val == null || val === "" || val === "null") ? "null" : String(val);
    return REMOVER_EMOJI[val] || REMOVER_EMOJI["null"];
  }

  function mkEmojiSpan(val, extraClass){
    const info = removerEmojiInfo(val);
    const wrap = document.createElement("span");
    wrap.className = "atp-remover-emoji" + (extraClass ? " " + extraClass : "");
    const glyph = document.createElement("span");
    glyph.className = "atp-remover-glyph";
    glyph.textContent = info.glyph;
    wrap.appendChild(glyph);

    if (info.note) {
      const note = document.createElement("span");
      note.className = "atp-remover-note";
      note.textContent = info.note;
      wrap.appendChild(note);
    }
    return wrap;
  }

  function parseTooltipMsgFromOnmouseover(onm){
    if (!onm) return "";
    const m = onm.match(/infraTooltipMostrar\(\s*'([^']*)'\s*,\s*'Comportamento do Localizador REMOVER'/);
    return m ? limparTexto(m[1]) : "";
  }

  function tooltipMsgToValue(msg){
    const s = rmAcc(lower(msg || "")).replace(/\.+$/,"").trim();

    if (!s) return "null";

    // Normaliza padrões comuns do tooltip do eProc (variações com/sem "os", plural etc.)
    const reTodosLoc    = /todos\s+(os\s+)?localizadores/;
    const reTodosExceto = /todos\s+(os\s+)?localizadores[\s\S]*exceto/;

    if (s.includes("apenas os de sistema")) return "4";
    if (s.includes("nao remover") || s.includes("não remover") || s.includes("apenas acrescentar")) return "3";
    if (reTodosExceto.test(s) || (s.includes("exceto") && (s.includes("todos") && s.includes("localizador")))) return "2";
    if (reTodosLoc.test(s) || s.includes("remover todos")) return "1";
    if (s.includes("localizador") && s.includes("informado")) return "0";

    return "null";
  }


  // Quando NÃO há tooltip (lupa.gif) no REMOVER, o eProc às vezes mostra texto direto na célula:
  // - "Nenhum" => não remover (VAL=3)
  // - "Todos os localizadores" => remover todos (VAL=1)

function removerPlainTextToValue(txt){
  const s = rmAcc(lower(txt || "")).replace(/\.+$/,"").trim();
  if (!s) return null;

  // Casos SEM tooltip e SEM lista de localizadores (são coringa de REMOVER)
  if (s === "nenhum") return "3";
  if (s.includes("manter") && s.includes("localizador") && s.includes("sistema")) return "2";
  if (s.includes("todos") && s.includes("localizador")) return "1";

  return null;
}




  // Troca a lupa (tooltip do REMOVER) por um span com emoji, MAS sem remover o <img>:
  // - escondemos o img (para não quebrar re-render/updates do eProc)
  // - inserimos/atualizamos um span logo depois
  // - reaplicável quando o tooltip/VAL mudar
  function replaceLupaImgWithEmoji(img, val){
    if (!img || img.nodeType !== 1) return;

    // somente lupa do tooltip correto
    const onm0 = img.getAttribute('onmouseover') || '';
    if (onm0.indexOf('Comportamento do Localizador REMOVER') === -1) return;

    // mensagem atual do tooltip (1º argumento)
    let msg0 = '';
    try { msg0 = parseTooltipMsgFromOnmouseover(onm0) || ''; } catch(e) {}

    // span existente?
    let span = null;
    const next = img.nextElementSibling;
    if (next && next.classList && next.classList.contains('atp-remover-emoji-tooltip')) {
      span = next;
    }

    // se já existe e já está no mesmo estado, só garante display do img e sai
    const currentVal = span?.dataset?.atpRemoverVal;
    const currentMsg = span?.dataset?.atpRemoverMsg;
    if (span && String(currentVal) === String(val ?? 'null') && String(currentMsg || '') === String(msg0 || '')) {
      // mantém o img escondido
      img.style.display = 'none';
      return;
    }

    // cria ou atualiza o span
    const fresh = mkEmojiSpan(val, "atp-tooltip");
    fresh.classList.add('atp-remover-emoji-tooltip');

    // guarda fonte de verdade para análises posteriores (se necessário)
    try { fresh.dataset.atpRemoverVal = String(val ?? 'null'); } catch(e) {}
    try { if (msg0) fresh.dataset.atpRemoverMsg = msg0; } catch(e) {}

    // mantém o tooltip funcionando (usa infraTooltipMostrar/Ocultar)
    fresh.style.cursor = "default";
    fresh.addEventListener("mouseenter", () => {
      try {
        if (typeof window.infraTooltipMostrar === "function") {
          window.infraTooltipMostrar(msg0, "Comportamento do Localizador REMOVER", 600);
        }
      } catch (_) {}
    });
    fresh.addEventListener("mouseleave", () => {
      try { if (typeof window.infraTooltipOcultar === "function") window.infraTooltipOcultar(); } catch (_) {}
    });

    // esconde a lupa original sem removê-la
    img.style.display = 'none';

    if (span) {
      span.replaceWith(fresh);
    } else {
      img.insertAdjacentElement("afterend", fresh);
    }

    // marca aplicada (no img, para debug)
    try { img.dataset.atpEmojiApplied = "1"; } catch(e) {}
  }


function applyRemoverTextIcons(table, cols){
  try{
    const tbodys = table.tBodies?.length ? Array.from(table.tBodies) : [table.querySelector("tbody")].filter(Boolean);
    const rows = tbodys.flatMap(tb => Array.from(tb.rows));

    for (const tr of rows){
      const tds = Array.from(tr.querySelectorAll(':scope > td'));
      if (!tds.length) continue;

      const tdRemover = tds[cols?.colRemover ?? 3] || tds[3];
      if (!tdRemover) continue;

      // Se já tem tooltip do REMOVER (img ou span), não é esse caso
      if (tdRemover.querySelector('[onmouseover*="Comportamento do Localizador REMOVER"]')) continue;
      if (tdRemover.querySelector('img[src*="lupa.gif"]')) continue;

      // Se já foi aplicado antes
      if (tdRemover.dataset?.atpRemoverVal && tdRemover.querySelector('.atp-remover-emoji')) continue;

      const plain = limparTexto(tdRemover.textContent || "");
      const val = removerPlainTextToValue(plain);
      if (!val) continue;

      // Marca como "coringa": sem filtro de Localizador REMOVER
      try { tdRemover.dataset.atpRemoverVal = String(val); } catch(e) {}
      try { tdRemover.dataset.atpRemoverWildcard = "1"; } catch(e) {}
      try { tdRemover.dataset.atpRemoverTextOriginal = plain; } catch(e) {}

      // Troca visual por emoji (mantém simples, sem tooltip)
      tdRemover.textContent = "";
      tdRemover.appendChild(mkEmojiSpan(val, "atp-in-table"));
    }
  }catch(e){}
}


  function updateAllRemoverLupasByTooltipText(root){
    const scope = root || document;
    const imgs = Array.from(scope.querySelectorAll('img[src*="lupa.gif"][onmouseover*="Comportamento do Localizador REMOVER"]'));
    for (const img of imgs) {
      const msg = parseTooltipMsgFromOnmouseover(img.getAttribute("onmouseover") || "");
      const val = tooltipMsgToValue(msg);
      replaceLupaImgWithEmoji(img, val);
    }
  }


  // Quando a célula REMOVER traz apenas texto (sem lupa/tooltip), substitui visualmente por emoji,
  // mas mantém o texto original escondido para não quebrar agrupamento/análise.
  function replacePlainRemoverTextInTable(table, cols){
    try{
      if(!table || !cols) return;
      const tbodys = table.tBodies?.length ? Array.from(table.tBodies) : [table.querySelector("tbody")].filter(Boolean);
      const rows = tbodys.flatMap(tb => Array.from(tb.rows));
      for (const tr of rows){
        const tds = Array.from(tr.querySelectorAll(':scope > td'));
        const td = tds[cols.colRemover] || null;
        if (!td) continue;

        // Se já tem lupa/tooltip ou emoji aplicado, ignora
        if (td.querySelector('img[src*="lupa.gif"][onmouseover*="Comportamento do Localizador REMOVER"]')) continue;
        if (td.querySelector('span.atp-remover-emoji')) continue;

        const plain = limparTexto(td.textContent || "");
        const val = removerPlainTextToValue(plain);
        if (!val) continue;

        const hidden = document.createElement("span");
        hidden.className = "atp-remover-plain-text";
        hidden.textContent = plain;

        const emoji = mkEmojiSpan(val, "atp-in-table");
        emoji.dataset.atpRemoverVal = val;

        td.textContent = "";
        td.appendChild(hidden);
        td.appendChild(emoji);
      }
    }catch(e){}
  }


  function updateMainRemoverIconBySelect(){
    const sel = document.getElementById("selOpcaoLocalizadorDesativacao");
    if (!sel) return;

    let anchor = sel.parentElement;
    if (!anchor) return;

    let img = anchor.querySelector('img[src*="lupa.gif"][onmouseover*="Comportamento do Localizador REMOVER"]');
    if (img) {
      replaceLupaImgWithEmoji(img, (sel.value || "null"));
      return;
    }

    const spans = Array.from(anchor.querySelectorAll("span.atp-remover-emoji"));
    if (spans.length) {
      const old = spans[0];
      const novo = mkEmojiSpan((sel.value || "null"), old.classList.contains("atp-in-table") ? "atp-in-table" : "");
      const onm = old.getAttribute("onmouseover"); if (onm) novo.setAttribute("onmouseover", onm);
      const ono = old.getAttribute("onmouseout");  if (ono) novo.setAttribute("onmouseout", ono);
      old.replaceWith(novo);
    }
  }

  function enhanceRemoverSelectWithIcons(){
    const sel = document.getElementById("selOpcaoLocalizadorDesativacao");
    if (!sel) return;
    if (sel._atpEnhancedEmoji) return;

    injectStyle();

    const wrap = document.createElement("span");
    wrap.className = "atp-remover-wrap";

    const btn = document.createElement("span");
    btn.className = "atp-remover-fake";
    btn.innerHTML = `<span class="atp-remover-glyph"></span><span class="atp-remover-note"></span><span class="atp-remover-caret">▼</span>`;

    const menu = document.createElement("div");
    menu.className = "atp-remover-menu";

    sel.classList.add("atp-remover-hidden");
    sel.parentNode.insertBefore(wrap, sel);
    wrap.appendChild(sel);
    wrap.appendChild(btn);
    wrap.appendChild(menu);

    function rebuildMenu(){
      menu.innerHTML = "";
      const cur = (sel.value || "null").toString();

      Array.from(sel.options).forEach(opt => {
        const val = (opt.value || "null").toString();
        const item = document.createElement("div");
        item.className = "atp-remover-item" + (val === cur ? " active" : "");

        const info = removerEmojiInfo(val);

        const glyph = document.createElement("span");
        glyph.className = "atp-remover-glyph";
        glyph.textContent = info.glyph;

        const note = document.createElement("span");
        note.className = "atp-remover-note";
        note.textContent = info.note || "(sem observação)";

        const txt = document.createElement("span");
        txt.textContent = (opt.textContent || "").trim() || "(vazio)";

        const right = document.createElement("div");
        right.style.display = "flex";
        right.style.flexDirection = "column";
        right.style.gap = "2px";
        right.appendChild(note);
        right.appendChild(txt);

        item.appendChild(glyph);
        item.appendChild(right);

        item.addEventListener("click", () => {
          sel.value = val;
          sel.dispatchEvent(new Event("change", { bubbles:true }));
          menu.classList.remove("open");
        });

        menu.appendChild(item);
      });
    }

    function syncButton(){
      const val = (sel.value || "null").toString();
      const info = removerEmojiInfo(val);
      btn.querySelector(".atp-remover-glyph").textContent = info.glyph;
      btn.querySelector(".atp-remover-note").textContent  = info.note || "";
      btn.title = (sel.options?.[sel.selectedIndex]?.textContent || "").trim();
    }

    function closeOnOutside(e){
      if (!wrap.contains(e.target)) menu.classList.remove("open");
    }

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      rebuildMenu();
      menu.classList.toggle("open");
    });

    document.addEventListener("click", closeOnOutside, true);

    sel.addEventListener("change", () => {
      syncButton();
      updateMainRemoverIconBySelect();
      if (menu.classList.contains("open")) rebuildMenu();
    });

    syncButton();
    sel._atpEnhancedEmoji = { wrap, btn, menu };
  }

  function watchRemoverEnhancer(){
    if (document._atpRemoverEnhWatch) return;
    document._atpRemoverEnhWatch = true;

    const mo = new MutationObserver(() => {
      if (watchRemoverEnhancer._t) cancelAnimationFrame(watchRemoverEnhancer._t);
      watchRemoverEnhancer._t = requestAnimationFrame(() => {
        enhanceRemoverSelectWithIcons();
        updateAllRemoverLupasByTooltipText(document);
        updateMainRemoverIconBySelect();
      });
    });
    mo.observe(document.body, { childList:true, subtree:true });
  }

  function renderIntoTable(table, rules, conflictsByRule, prevRendered) {
    const cols = mapColumns(table);
    const tbodys = table.tBodies?.length ? Array.from(table.tBodies) : [table.querySelector("tbody")].filter(Boolean);
    const rows = tbodys.flatMap(tb => Array.from(tb.rows));

    const rowMap = new Map();
    rows.forEach(tr => {
      const tds = tr.querySelectorAll(':scope > td');
      const num = getNumeroRegra(tds[cols?.colNumPrior ?? 1]);
      if (num) rowMap.set(num, tr);
    });

    const tipoClass = (t) => ({
      "Colisão Total":"collision",
      "Colisão Parcial":"collision",
      "Sobreposição":"overlap",
      "Perda de Objeto":"objectloss",
      "Looping":"loop"
    }[t] || "");

    for (const r of rules) {
      const adj = conflictsByRule.get(r.num);
      const tr  = rowMap.get(r.num);
      if (!tr) continue;

      const confTd = tr.querySelector('td[data-atp-col="conflita"]');
      const motTd  = tr.querySelector('td[data-atp-col="motivo"]');
      if (motTd) motTd.textContent = "";

      let confStr = "", maxSev = 0;
      let htmlParts = [];

      if (adj && adj.size) {
        const others = [...adj.keys()].sort((a,b)=> Number(a)-Number(b));
        confStr = others.join("; ");
        if (confTd) confTd.dataset.atpConfNums = others.join(",");

        for (const n of others) {
          const rec = adj.get(n);
          const tiposOrd = [...(rec.tipos || [])].sort((a,b)=> (tipoRank[b]-tipoRank[a]));
          if (!tiposOrd.length) continue;

          const impacto = rec.impactoMax || "Médio";
          const motivosByTipo = rec.motivosByTipo || {};

          // Um span por tipo de conflito (ex.: "Perda de Objeto" e "Colisão Parcial" no mesmo par)
          const tipoSpans = tiposOrd.map((tipo) => {
            const cls = tipoClass(tipo);
            const motivo = motivosByTipo[tipo] || rec.motivo || "";
            const tooltip = motivo ? `${tipo} (${impacto}) — ${motivo}` : `${tipo} (${impacto})`;
            return `<span class="atp-conf-tipo ${cls}" title="${esc(tooltip)}">${esc(tipo)}</span>`;
          }).join(' ');

          htmlParts.push(
            `<div>` +
              `<span class="atp-conf-num">${esc(n)}:</span> ` +
              tipoSpans +
            `</div>`
          );

          maxSev = Math.max(maxSev, severityForRec(rec));
        }
        tr.dataset.atpHasConflict = "1";
      } else {
        delete tr.dataset.atpHasConflict;
        if (confTd) delete confTd.dataset.atpConfNums;
      }

      if (confTd){
        confTd.innerHTML = htmlParts.join("") || "";
        confTd.querySelector(".atp-compare-btn")?.remove();
        if (confStr.trim().length) {
          const btnWrap = document.createElement("div");
          btnWrap.appendChild(makeCompareButton(r.num, confTd));
          confTd.appendChild(btnWrap);
        }
      }

      tr.classList.remove("atp-sev-2","atp-sev-3","atp-sev-4","atp-sev-5");
      if (maxSev >= 2) tr.classList.add(`atp-sev-${maxSev}`);
    }
    applyConflictFilter(table, filterOnlyConflicts);
  }

  function addOnlyConflictsCheckbox(table, onChange) {
    const host = document.getElementById("dvFiltrosOpcionais");
    if (!host || host.querySelector('#chkApenasConflito')) return;

    const spacer = document.createTextNode(" ");
    const cb = document.createElement("input");
    cb.type = "checkbox"; cb.id = "chkApenasConflito"; cb.className = "infraCheckBox"; cb.style.marginLeft = "12px";

    const label = document.createElement("label");
    label.htmlFor = "chkApenasConflito"; label.className = "infraLabelCheckBox"; label.style.verticalAlign = "middle"; label.textContent = "Apenas regras com conflito";

    cb.addEventListener("change", () => { filterOnlyConflicts = cb.checked; onChange(); });
    host.appendChild(spacer); host.appendChild(cb); host.appendChild(label);
  }

  function applyConflictFilter(table, only) {
    const tbodys = table.tBodies?.length ? Array.from(table.tBodies) : [table.querySelector("tbody")].filter(Boolean);
    const rows = tbodys.flatMap(tb => Array.from(tb.rows));

    rows.forEach(tr => {
      if (tr.dataset.atpInactive === "1") { tr.style.display = "none"; return; }
      if (!only) tr.style.display = "";
      else tr.style.display = (tr.dataset.atpHasConflict === "1") ? "" : "none";
    });
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
    let best = null, bestScore = 0;
    for (const c of candidates) {
      const ths = Array.from((c.tHead || c).querySelectorAll("th"));
      if (!ths.length) continue;
      const text = ths.map(th => limparTexto(th.textContent)).join(" | ");
      let s = 0; for (const re of wanted) if (re.test(text)) s++;
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
    const prevRendered = new Map();
    let lastTableHash = "";
    let cols = mapColumns(table);

    const recalc = () => {
      if (!document.body.contains(table)) return;
      ensureColumns(table);
      cols = mapColumns(table);

      updateAllRemoverLupasByTooltipText(table);
      // também cobre casos sem tooltip (texto direto)
      replacePlainRemoverTextInTable(table, cols);
      updateMainRemoverIconBySelect();

      const rules = parseRulesFromTable(table, cols);
      if (!rules.length) return;

      const combined = rules.map(r => `${r.num}|${r.prioridade.text}|${r.origem}|${r.comportamento}|${r.tipoRaw}|${r.destino}|${JSON.stringify(r.criterios||{})}`).join("#");
      if (combined === lastTableHash) { applyConflictFilter(table, filterOnlyConflicts); return; }
      lastTableHash = combined;

      const conflictsByRule = analyzeConflicts(rules);
      renderIntoTable(table, rules, conflictsByRule, prevRendered);
    };
    return recalc;
  }

  function bindPriorityChange(table, recalc) {
    table.addEventListener("change", (e) => {
      if (e.target?.tagName === "SELECT" || e.target?.matches('input.custom-control-input')) {
        scheduleIdle(recalc, 160);
      }
    });
  }

  function start(table){
    ensureColumns(table);
    const recalc = makeRunner(table);
    addOnlyConflictsCheckbox(table, () => scheduleIdle(recalc, 0));
    bindPriorityChange(table, recalc);

    // Recalcula conflitos quando muda o comportamento global de REMOVER (ex.: Remover marcados -> Remover todos)
    // Isso impacta a detecção de Perda de Objeto e precisa refletir imediatamente na análise.
    try{
      const selRem = document.getElementById("selOpcaoLocalizadorDesativacao");
      if (selRem && !selRem._atpRecalcHook){
        selRem.addEventListener("change", () => scheduleIdle(recalc, 0));
        selRem._atpRecalcHook = true;
      }
    }catch(e){}

    enhanceRemoverSelectWithIcons();
    updateAllRemoverLupasByTooltipText(document);
    updateMainRemoverIconBySelect();
    applyRemoverTextIcons(table, mapColumns(table));
    watchRemoverEnhancer();

    scheduleIdle(recalc, 0);

    const scopedRoot = table.parentElement || document.body;
    const mo = new MutationObserver(() => {
      scheduleIdle(recalc, 240);
      enhanceRemoverSelectWithIcons();
      updateAllRemoverLupasByTooltipText(document);
      updateMainRemoverIconBySelect();
    });
    mo.observe(scopedRoot, { childList: true, subtree: true });

    const rootMo = new MutationObserver(() => {
      if (!document.body.contains(table)) { rootMo.disconnect(); init(); }
      enhanceRemoverSelectWithIcons();
      updateAllRemoverLupasByTooltipText(document);
      updateMainRemoverIconBySelect();
    });
    rootMo.observe(document.body, { childList:true, subtree:true });
  }

  async function init() {
    injectStyle();
    enhanceRemoverSelectWithIcons();
    updateAllRemoverLupasByTooltipText(document);
    updateMainRemoverIconBySelect();
    watchRemoverEnhancer();

    const table = await waitTable();
    if (table) start(table);
  }

  init();
})();
