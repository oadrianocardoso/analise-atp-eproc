// ==UserScript==
// @name         Análise de ATP eProc
// @namespace    https://tjsp.eproc/automatizacoes
// @version      3.1
// @description  Colisão Total/Parcial, Sobreposição, Perda de Objeto (direcionada) e Looping (multi-localizadores); colunas, botão Comparar, filtro e ícone REMOVER.
// @author       ADRIANO
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

  const tipoRank    = { "Colisão Total": 3, "Colisão Parcial": 3, "Sobreposição": 2, "Perda de Objeto": 2, "Looping": 3 };
  const impactoRank = { "Alto": 3, "Médio": 2, "Baixo": 1 };

  const lower = s => (s ?? "").toString().replace(/\u00A0/g," ").replace(/\s+/g," ").trim().toLowerCase();
  const norm  = s => (s ?? "").toString().replace(/\u00A0/g," ").replace(/[ \t]+/g," ").replace(/\s*\n+\s*/g," | ").trim();
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
      else if (n.nodeType === 1 && n.tagName !== "IMG") out += " " + (n.tagName==="BR" ? " " : (n.textContent||""));
    });
    return norm(out);
  }

  function getNumeroRegra(td) {
    const m = norm(td?.textContent||"").match(/^\s*(\d{1,6})\b/);
    return m ? m[1] : "";
  }

  function getPrioridadeTexto(td){
    const sel = td?.querySelector("select");
    if (sel){
      const opt = sel.selectedOptions?.[0] || sel.querySelector("option[selected]") || sel.options?.[sel.selectedIndex];
      if (opt) return norm(String(opt.textContent||"").replace(/^Executar\s*/i, ""));
    }
    const raw = norm(td?.textContent || "");
    const m = raw.match(/prioridade[^0-9]*([0-9]{1,4})/i);
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
    const img = td?.querySelector('img[onmouseover*="infraTooltipMostrar"]');
    if (img){
      const js = img.getAttribute("onmouseover") || "";
      const m = js.match(/infraTooltipMostrar\('([^']*)'/);
      if (m) parts.push(norm(m[1]));
      const t = img.getAttribute("title"); if (t) parts.push(norm(t));
      const a = img.getAttribute("alt");   if (a) parts.push(norm(a));
    }
    const tt = td?.getAttribute?.("title"); if (tt) parts.push(norm(tt));
    parts.push(textWithoutImages(td));
    return parts.filter(Boolean).join(" | ");
  }

  function comportamentoRemove(txt){
    const s = lower(txt || "");
    if (/\bna[oõ]\s*remover\b/.test(s)) return false;
    if (/apenas\s+acrescentar\s+o\s+indicado/.test(s)) return false;
    return /remover\s+o\s+processo.*localizador(?:es)?\s+informado(?:s)?|remover\s+o\s+processo\s+de\s+todos\s+localizadores|remover\s+os\s+processos\s+de\s+todos\s+os\s+localizadores|remover\s+.*localizador/.test(s);
  }

  const OUTROS_GROUP_KEYS = [
    "classe","competencia","rito","juizo do processo","representacao processual das partes",
    "documentos evento/peticao","dado complementar da parte","classificador por conteudo","digito distribuicao"
  ];

  function normalizeGroupLabel(label){
    const t = lower(rmAcc(label)).replace(/[:.\-–—\s]+$/,"").trim();
    if (/^classificador\s+(de\s+)?conteudo/.test(t))   return "classificador por conteudo";
    if (/^digito\s+(de\s+)?distribuicao/.test(t))      return "digito distribuicao";
    if (/^juizo\s+(do|da)\s+processo/.test(t))         return "juizo do processo";
    if (/^representacao\s+processual/.test(t))         return "representacao processual das partes";
    if (/^(documentos|evento|peticao)/.test(t))        return "documentos evento/peticao";
    if (/^dado\s+complementar/.test(t))                return "dado complementar da parte";
    if (/^classe\b/.test(t))                           return "classe";
    if (/^compet(ê|e)ncia\b/.test(t))                  return "competencia";
    if (/^rito\b/.test(t))                             return "rito";
    for (const k of OUTROS_GROUP_KEYS) if (t.includes(k)) return k;
    return null;
  }

  function splitValues(raw){
    if (!raw) return new Set();
    const base = rmAcc(lower(raw)).replace(/\s*\(\s*\)\s*/g,"").replace(/[|]+/g,"|").replace(/,+/g,",").replace(/\s{2,}/g," ").replace(/[.;]\s*$/,"").trim();
    return new Set(base.split(/;|\||,|\s+ou\s+|\s+e\s+/i).map(s => s.trim()).filter(Boolean));
  }

  function parseOutros(outrosRaw){
    const res = { grupos: new Map(), livre: new Set() };
    if (!outrosRaw || outrosRaw === "[*]") return res;
    const chunks = norm(outrosRaw).split(/\s*\|\s*/).map(s => s.trim()).filter(Boolean);
    for (const ch of chunks){
      const m = ch.match(/^([^:]+):\s*(.+)$/);
      if (m){
        const g = normalizeGroupLabel(m[1]);
        if (g){
          const vals = splitValues(m[2]);
          if (!res.grupos.has(g)) res.grupos.set(g, new Set());
          const tgt = res.grupos.get(g);
          vals.forEach(v => tgt.add(v));
          continue;
        }
      }
      res.livre.add(rmAcc(lower(ch)));
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

  function relationOutros(_tA, aRaw, _tB, bRaw) {
    const sa = parseOutros(aRaw), sb = parseOutros(bRaw);
    if (outrosIdenticos(sa, sb)) return "identicos";
    if (outrosSubAemB(sa, sb))   return "sub_a_em_b";
    if (outrosSubAemB(sb, sa))   return "sub_b_em_a";
    return "diferentes";
  }

  function parseRulesFromTable(table, cols) {
    const list = [];
    const tbodys = table.tBodies?.length ? Array.from(table.tBodies) : [table.querySelector("tbody")].filter(Boolean);
    const rows = tbodys.flatMap(tb => Array.from(tb.rows));
    for (const tr of rows) {
      const tds = Array.from(tr.querySelectorAll(':scope > td'));
      if (!tds.length) continue;

      const tdNumPrior = tds[cols.colNumPrior] || tds[1];
      const tdRemover  = tds[cols.colRemover]  || tds[3];
      const tdTipo     = tds[cols.colTipo]     || tds[4];
      const tdIncluir  = tds[cols.colIncluir]  || tds[5];
      const tdOutros   = tds[cols.colOutros]   || tds[6];

      const num = getNumeroRegra(tdNumPrior);
      if (!num) continue;

      const prioridadeTexto = getPrioridadeTexto(tdNumPrior);
      list.push({
        num,
        prioridade: parsePriority(prioridadeTexto),
        origem: textWithoutImages(tdRemover),
        comportamento: getRemoverBehaviorText(tdRemover) || "[*]",
        destino: norm(tdIncluir?.textContent || ""),
        tipoRaw: norm(tdTipo?.textContent || "") || "[*]",
        outrosRaw: norm(tdOutros?.textContent || "") || "[*]",
        tr
      });
    }
    return list;
  }

  // Extrai TODAS as siglas “SIGLA - Descrição” de um campo; retorna Set(siglas)
  function locSiglas(cellText){
    const parts = norm(cellText).split(/\s*\|\s*/).map(s => s.trim()).filter(Boolean);
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

  function analyzeConflicts(rules) {
    const buckets = new Map();
    for (const r of rules) {
      const key = `${r.origem || ""}||${r.tipoRaw}`;
      (buckets.get(key) || buckets.set(key, []).get(key)).push(r);
    }

    const pairKey = (a,b) => {
      const ai = Number(a.num), bi = Number(b.num);
      return ai < bi ? `${ai}|${bi}` : `${bi}|${ai}`;
    };

    const pairsMap = new Map();
    const addRec = (i, j, tipo, impacto, motivo) => {
      const key = pairKey(i,j);
      const ai = Number(i.num), bi = Number(j.num);
      const base  = ai <= bi ? i : j;
      const other = base === i ? j : i;
      const rec = pairsMap.get(key) || { iNum: base.num, jNum: other.num, tipos: new Set(), motivos: new Set(), impactoMax: "Baixo" };
      rec.tipos.add(tipo); rec.motivos.add(motivo);
      if (impactoRank[impacto] > impactoRank[rec.impactoMax]) rec.impactoMax = impacto;
      pairsMap.set(key, rec);
    };
    const addRecDirected = (baseToShow, otherRule, tipo, impacto, motivo) => {
      pairsMap.set(`FORCE|${baseToShow.num}|${otherRule.num}|${tipo}|${impacto}`,
        { iNum: baseToShow.num, jNum: otherRule.num, tipos: new Set([tipo]), motivos: new Set([motivo]), impactoMax: impacto });
    };

    // (REMOVER, TIPO) iguais
    for (const list of buckets.values()) {
      if (!list || list.length < 2) continue;
      for (let x=0; x<list.length; x++) {
        const A = list[x];
        for (let y=x+1; y<list.length; y++) {
          const B = list[y];
          const rel = relationOutros(A.tipoRaw, A.outrosRaw, B.tipoRaw, B.outrosRaw);
          const pA  = A.prioridade.num, pB = B.prioridade.num;
          const known = (pA != null && pB != null);

          if (rel === "identicos") {
            if ((known && pA === pB) || (!known && prioritiesEqual(A.prioridade, B.prioridade)))
              addRec(A, B, "Colisão Total", "Alto", "Prioridade, REMOVER, TIPO e OUTROS idênticos.");
            else
              addRec(A, B, "Colisão Parcial", "Alto", "REMOVER, TIPO e OUTROS idênticos; prioridades diferentes.");

            if (known && pA < pB && comportamentoRemove(A.comportamento))
              addRecDirected(B, A, "Perda de Objeto", "Médio", "Regra anterior com 'remover' pode esvaziar esta (critérios idênticos).");
            if (known && pB < pA && comportamentoRemove(B.comportamento))
              addRecDirected(A, B, "Perda de Objeto", "Médio", "Regra anterior com 'remover' pode esvaziar esta (critérios idênticos).");
            continue;
          }

          if (known) {
            if (rel === "sub_b_em_a" && pA < pB) addRec(A, B, "Sobreposição", "Médio", "A é mais amplo (Outros de A ⊃ B) e executa antes (prioridade menor).");
            if (rel === "sub_a_em_b" && pB < pA) addRec(B, A, "Sobreposição", "Médio", "B é mais amplo (Outros de B ⊃ A) e executa antes (prioridade menor).");
          }

          if (known && rel === "sub_b_em_a" && pA < pB && comportamentoRemove(A.comportamento))
            addRecDirected(B, A, "Perda de Objeto", "Médio", "Regra anterior com 'remover' pode esvaziar esta (A ⊃ B).");
          if (known && rel === "sub_a_em_b" && pB < pA && comportamentoRemove(B.comportamento))
            addRecDirected(A, B, "Perda de Objeto", "Médio", "Regra anterior com 'remover' pode esvaziar esta (B ⊃ A).");
        }
      }
    }

    // LOOPING (múltiplos localizadores)
    for (let i=0; i<rules.length; i++){
      const A = rules[i];
      for (let j=i+1; j<rules.length; j++){
        const B = rules[j];
        if (lower(A.tipoRaw) !== lower(B.tipoRaw)) continue;
        if (relationOutros(A.tipoRaw, A.outrosRaw, B.tipoRaw, B.outrosRaw) !== "identicos") continue;

        const remA = locSiglas(A.origem), incA = locSiglas(A.destino);
        const remB = locSiglas(B.origem), incB = locSiglas(B.destino);
        if (!remA.size || !incA.size || !remB.size || !incB.size) continue;

        const aRemAlgumQueBInclui = [...remA].some(x => incB.has(x));
        const bRemAlgumQueAInclui = [...remB].some(x => incA.has(x));
        if (aRemAlgumQueBInclui && bRemAlgumQueAInclui){
          const motivo = `Looping potencial: A remove ${A.origem} e inclui ${A.destino}; B remove ${B.origem} e inclui ${B.destino}; Outros idênticos.`;
          const key = pairKey(A,B);
          pairsMap.set(key, { iNum: Math.min(+A.num,+B.num).toString(), jNum: Math.max(+A.num,+B.num).toString(), tipos: new Set(["Looping"]), motivos: new Set([motivo]), impactoMax: "Alto" });
        }
      }
    }

    const conflictsByRule = new Map();
    for (const [k, rec] of pairsMap.entries()) {
      if (String(k).startsWith("FORCE|")) continue;
      const base = rec.iNum, other = rec.jNum;
      (conflictsByRule.get(base) || conflictsByRule.set(base, new Map()).get(base)).set(other, rec);
    }
    for (const [k, rec] of pairsMap.entries()) {
      if (!String(k).startsWith("FORCE|")) continue;
      const base = rec.iNum, other = rec.jNum;
      if (!conflictsByRule.has(base)) conflictsByRule.set(base, new Map());
      const bucket = conflictsByRule.get(base);
      const ex = bucket.get(other);
      if (ex){
        rec.tipos.forEach(t => ex.tipos.add(t));
        rec.motivos.forEach(m => ex.motivos.add(m));
        if (impactoRank[rec.impactoMax] > impactoRank[ex.impactoMax]) ex.impactoMax = rec.impactoMax;
      } else bucket.set(other, rec);
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
      th[data-atp-col="motivo-th"]{width:200px;min-width:200px;max-width:200px;}
      td[data-atp-col="motivo"]{width:200px;max-width:200px;word-wrap:break-word;overflow-wrap:anywhere;}
      .atp-compare-btn{margin-left:8px;padding:2px 6px;border:1px solid #1f2937;border-radius:6px;font-size:11px;background:#f3f4f6;cursor:pointer;}
      .atp-compare-btn:hover{background:#e5e7eb}
      img.atp-behavior-icon{vertical-align:middle;margin-left:6px}
    `;
    document.head.appendChild(style);
  }

  function ensureColumns(table){
    const thead = table.tHead || table.querySelector("thead");
    if (!thead) return;

    const ths = Array.from(thead.querySelectorAll("th"));
    let hasConfl = false, hasMot = false, motivoTh = null;
    ths.forEach(th => {
      const t = th.textContent || "";
      if (/Conflita com/i.test(t)) hasConfl = true;
      if (/Tipo\s*\/\s*Motivo/i.test(t)) { hasMot = true; motivoTh = th; }
    });

    const headerRow = thead.rows[0] || thead.querySelector("tr");
    if (!hasConfl) {
      const th1 = document.createElement("th");
      th1.textContent = "Conflita com (Nº)";
      th1.style.whiteSpace = "nowrap";
      th1.setAttribute("data-atp-col", "conflita-th");
      headerRow.appendChild(th1);
    }
    if (!hasMot) {
      const th2 = document.createElement("th");
      th2.textContent = "Tipo / Motivo";
      th2.style.whiteSpace = "nowrap";
      th2.setAttribute("data-atp-col", "motivo-th");
      th2.style.width = "200px"; th2.style.minWidth = "200px"; th2.style.maxWidth = "200px";
      headerRow.appendChild(th2);
      motivoTh = th2;
    }
    if (motivoTh) {
      motivoTh.setAttribute("data-atp-col","motivo-th");
      motivoTh.style.width = "200px"; motivoTh.style.minWidth = "200px"; motivoTh.style.maxWidth = "200px";
    }

    const tbodys = table.tBodies?.length ? Array.from(table.tBodies) : [table.querySelector("tbody")].filter(Boolean);
    const rows = tbodys.flatMap(tb => Array.from(tb.rows));
    rows.forEach(tr => {
      let confTd = tr.querySelector('td[data-atp-col="conflita"]');
      let motTd  = tr.querySelector('td[data-atp-col="motivo"]');
      if (!confTd) { confTd = document.createElement("td"); confTd.dataset.atpCol = "conflita"; confTd.style.verticalAlign = "top"; tr.appendChild(confTd); }
      if (!motTd)  { motTd  = document.createElement("td"); motTd.dataset.atpCol  = "motivo";  motTd.style.verticalAlign  = "top"; motTd.style.width="200px"; motTd.style.maxWidth="200px"; tr.appendChild(motTd); }
    });

    injectStyle();
  }

  function severityForRec(rec) {
    let max = 0; for (const t of rec.tipos) max = Math.max(max, tipoRank[t] || 0); return max;
  }

  function setNumeroRegraAndSearch(numsList){
    try{
      const txt = document.getElementById("txtNumeroRegra");
      if (txt) {
        txt.value = numsList.join("; ");
        txt.dispatchEvent(new Event("input", { bubbles:true }));
        txt.dispatchEvent(new Event("change", { bubbles:true }));
      }
      const btn = document.getElementById("sbmPesquisar");
      if (btn) btn.click();
      else if (typeof window.enviarFormularioAutomatizacao === "function") window.enviarFormularioAutomatizacao();
    }catch{}
  }

  function makeCompareButton(ruleNum, confTd){
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "atp-compare-btn";
    btn.textContent = "Comparar";
    btn.addEventListener("click", () => {
      const raw = (confTd.textContent || "").trim();
      const uniq = Array.from(new Set(
        raw.split(";").map(s=>s.trim()).filter(Boolean)
           .concat(String(ruleNum))
           .map(x => String(x).replace(/\D/g,"").trim()).filter(Boolean)
      )).sort((a,b)=> Number(a)-Number(b));
      setNumeroRegraAndSearch(uniq);
    });
    return btn;
  }

  function svgIcon(color, label){
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle cx="8" cy="8" r="7" fill="${color}" /><text x="8" y="11" text-anchor="middle" font-size="9" font-family="Arial, Helvetica, sans-serif" fill="#fff">${label}</text></svg>`;
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
  }

  const BEHAVIOR_ICON = {
    "0": { color:"#f59e0b", label:"R" }, "4": { color:"#f59e0b", label:"S" },
    "1": { color:"#ef4444", label:"T" }, "2": { color:"#fb923c", label:"E" },
    "3": { color:"#10b981", label:"+" }, "null": { color:"#9ca3af", label:"?" }
  };

  function ensureBehaviorIconHost(){
    const sel = document.getElementById("selOpcaoLocalizadorDesativacao");
    if (!sel || sel._atpIconHost) return;
    const img = document.createElement("img");
    img.className = "atp-behavior-icon"; img.width = 16; img.height = 16; img.alt = "Comportamento do Localizador REMOVER";
    sel.insertAdjacentElement("afterend", img);
    sel._atpIconHost = img;
  }

  function updateBehaviorIconFromSelect(){
    ensureBehaviorIconHost();
    const sel = document.getElementById("selOpcaoLocalizadorDesativacao");
    const img = sel? sel._atpIconHost : null; if (!img) return;
    let val = "null", text = "Selecione o Localizador REMOVER";
    if (sel) { val = (sel.value || "null").toString(); const opt = sel.options[sel.selectedIndex]; if (opt) text = opt.textContent.trim(); }
    const meta = BEHAVIOR_ICON[val] || BEHAVIOR_ICON["null"];
    img.src = svgIcon(meta.color, meta.label); img.title = text;
  }

  function bindBehaviorIcon(){
    const sel = document.getElementById("selOpcaoLocalizadorDesativacao");
    if (sel && !sel._atpIconBound){ sel.addEventListener("change", updateBehaviorIconFromSelect); sel._atpIconBound = true; }
    updateBehaviorIconFromSelect();
  }

  function renderIntoTable(table, rules, conflictsByRule, prevRendered) {
    const tbodys = table.tBodies?.length ? Array.from(table.tBodies) : [table.querySelector("tbody")].filter(Boolean);
    const rows = tbodys.flatMap(tb => Array.from(tb.rows));
    const cols = mapColumns(table);

    const rowMap = new Map();
    rows.forEach(tr => {
      const tds = tr.querySelectorAll(':scope > td');
      const num = getNumeroRegra(tds[cols?.colNumPrior ?? 1]);
      if (num) rowMap.set(num, tr);
    });

    for (const r of rules) {
      const adj = conflictsByRule.get(r.num);
      const tr  = rowMap.get(r.num);
      if (!tr) continue;

      const confTd = tr.querySelector('td[data-atp-col="conflita"]');
      const motTd  = tr.querySelector('td[data-atp-col="motivo"]');

      let confStr = "", motivoHTML = "", maxSev = 0;

      if (adj && adj.size) {
        const others = [...adj.keys()].sort((a,b)=> Number(a)-Number(b));
        confStr = others.join("; ");
        const tipoClass = (t) => ({ "Colisão Total":"collision","Colisão Parcial":"collision","Sobreposição":"overlap","Perda de Objeto":"objectloss","Looping":"loop" }[t] || "");
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
        tr.dataset.atpHasConflict = "1";
      } else {
        delete tr.dataset.atpHasConflict;
      }

      const prev = prevRendered.get(r.num) || { conf:"", html:"", sev:0 };
      if (confStr !== prev.conf && confTd){
        confTd.textContent = confStr;
        confTd.querySelector(".atp-compare-btn")?.remove();
        if (confStr.trim().length) confTd.appendChild(makeCompareButton(r.num, confTd));
      } else if (confTd && confStr.trim().length && !confTd.querySelector(".atp-compare-btn")){
        confTd.appendChild(makeCompareButton(r.num, confTd));
      }

      if (motivoHTML !== prev.html && motTd){ motTd.innerHTML = motivoHTML; motTd.title = motTd.textContent.trim(); }

      if (prev.sev !== maxSev) {
        tr.classList.remove("atp-sev-2","atp-sev-3");
        if (maxSev >= 2) tr.classList.add(`atp-sev-${maxSev}`);
      }
      prevRendered.set(r.num, { conf: confStr, html: motivoHTML, sev: maxSev });
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
    rows.forEach(tr => tr.style.display = (!only || tr.dataset.atpHasConflict === "1") ? "" : "none");
  }

  function findTargetTable() {
    let t = document.querySelector("#tableAutomatizacaoLocalizadores");
    if (t) return t;
    const candidates = Array.from(document.querySelectorAll("table"));
    const wanted = [/n[ºo]\s*\/?\s*prioridade/i,/localizador.*remover/i,/tipo.*(controle|crit[ée]rio)/i,/localizador.*(incluir|a[cç][aã]o)/i,/outros\s*crit[ée]rios/i];
    let best = null, bestScore = 0;
    for (const c of candidates) {
      const ths = Array.from((c.tHead || c).querySelectorAll("th"));
      if (!ths.length) continue;
      const text = ths.map(th => norm(th.textContent)).join(" | ");
      let s = 0; for (const re of wanted) if (re.test(text)) s++;
      if (s > bestScore) { best = c; bestScore = s; }
    }
    return bestScore >= 3 ? best : null;
  }

  function waitTable(timeoutMs = 120000) {
    const direct = findTargetTable();
    if (direct) return Promise.resolve(direct);
    return new Promise(resolve => {
      const mo = new MutationObserver(() => { const tb = findTargetTable(); if (tb) { mo.disconnect(); resolve(tb); } });
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

      const rules = parseRulesFromTable(table, cols);
      if (!rules.length) return;

      const combined = rules.map(r => `${r.num}|${r.prioridade.text}|${r.origem}|${r.comportamento}|${r.tipoRaw}|${r.destino}|${r.outrosRaw}`).join("#");
      if (combined === lastTableHash) { applyConflictFilter(table, filterOnlyConflicts); return; }
      lastTableHash = combined;

      const conflictsByRule = analyzeConflicts(rules);
      renderIntoTable(table, rules, conflictsByRule, prevRendered);
    };
    return recalc;
  }

  function bindPriorityChange(table, recalc) {
    table.addEventListener("change", (e) => { if (e.target?.tagName === "SELECT") scheduleIdle(recalc, 160); });
  }

  function start(table){
    ensureColumns(table);
    const recalc = makeRunner(table);
    addOnlyConflictsCheckbox(table, () => scheduleIdle(recalc, 0));
    bindPriorityChange(table, recalc);
    scheduleIdle(recalc, 0);

    bindBehaviorIcon();

    const scopedRoot = table.parentElement || document.body;
    const mo = new MutationObserver(() => { scheduleIdle(recalc, 240); bindBehaviorIcon(); });
    mo.observe(scopedRoot, { childList: true, subtree: true });

    const rootMo = new MutationObserver(() => {
      if (!document.body.contains(table)) { rootMo.disconnect(); init(); }
      bindBehaviorIcon();
    });
    rootMo.observe(document.body, { childList:true, subtree:true });
  }

  async function init() {
    const table = await waitTable();
    if (table) start(table); else bindBehaviorIcon();
  }

  init();
})();
