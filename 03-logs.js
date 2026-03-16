try { console.log('[ATP][LOAD] logs.js carregado com sucesso'); } catch (e) { }

window.__ATP_LAST_RULES__ = window.__ATP_LAST_RULES__ || [];

window.atpSetLastRules = function (rules) {
  window.__ATP_LAST_RULES__ = Array.isArray(rules) ? rules : [];
};

window.atpGetLastRules = function () {
  return Array.isArray(window.__ATP_LAST_RULES__) ? window.__ATP_LAST_RULES__ : [];
};

const ATP_RULES_LOG = (window.__ATP_RULES_LOG = window.__ATP_RULES_LOG || { enabled: true, lastSignature: null, lastDump: null, didDumpOnce: false, force: false });

if (!window.atpDumpRegras) {
  window.atpDumpRegras = () => {
    try {
      ATP_RULES_LOG.force = true;
      ATP_RULES_LOG.didDumpOnce = false;
      const rules = (typeof atpGetLastRules === 'function') ? atpGetLastRules() : (window.__ATP_LAST_RULES__ || []);
      logAllRules(Array.isArray(ATP_RULES_LOG.lastDump) ? ATP_RULES_LOG.lastDump : rules);
    } finally {
      ATP_RULES_LOG.force = false;
    }
  };
}

function atpSafeJson(value) {
  try {
    const cache = new Set();
    return JSON.stringify(value, (k, v) => {
      if (typeof v === 'object' && v !== null) {
        if (cache.has(v)) return '[Circular]';
        cache.add(v);
      }
      if (v instanceof Set) return Array.from(v);
      if (v instanceof Map) return Array.from(v.entries());
      return v;
    }, 2);
  } catch (_) {
    return '[unserializable]';
  }
}

function atpFlattenPaths(value, prefix, out, seen, depth, maxDepth) {
  const path = String(prefix || 'rule');
  const d = Number(depth) || 0;
  const lim = Number(maxDepth) || 6;
  if (d > lim) {
    out.push({ var: path, value: '[depth-limit]' });
    return;
  }
  if (value == null) {
    out.push({ var: path, value: value });
    return;
  }
  const t = typeof value;
  if (t !== 'object') {
    out.push({ var: path, value });
    return;
  }
  if (seen.has(value)) {
    out.push({ var: path, value: '[Circular]' });
    return;
  }
  seen.add(value);
  if (Array.isArray(value)) {
    out.push({ var: path + '.length', value: value.length });
    for (let i = 0; i < value.length; i++) atpFlattenPaths(value[i], `${path}[${i}]`, out, seen, d + 1, lim);
    return;
  }
  if (value instanceof Set) {
    const arr = Array.from(value);
    out.push({ var: path + '.size', value: arr.length });
    for (let i = 0; i < arr.length; i++) atpFlattenPaths(arr[i], `${path}{${i}}`, out, seen, d + 1, lim);
    return;
  }
  if (value instanceof Map) {
    const arr = Array.from(value.entries());
    out.push({ var: path + '.size', value: arr.length });
    for (let i = 0; i < arr.length; i++) {
      out.push({ var: `${path}.key(${i})`, value: arr[i][0] });
      atpFlattenPaths(arr[i][1], `${path}.val(${i})`, out, seen, d + 1, lim);
    }
    return;
  }
  const keys = Object.keys(value);
  if (!keys.length) {
    out.push({ var: path, value: '{}' });
    return;
  }
  for (const k of keys) atpFlattenPaths(value[k], `${path}.${k}`, out, seen, d + 1, lim);
}

function atpBuildRuleRows(rule, idx) {
  const rows = [];
  rows.push({ var: 'rules[index]', value: idx });
  atpFlattenPaths(rule, 'rule', rows, new Set(), 0, 7);
  return rows;
}

function logAllRules(rules) {
  try {
    if (!ATP_RULES_LOG.enabled) return;
    if (!Array.isArray(rules) || !rules.length) return;

    if (ATP_RULES_LOG.didDumpOnce && !ATP_RULES_LOG.force) return;

    const signature = JSON.stringify(rules.map(r => ([
      String(r?.num ?? ''),
      String(r?.prioridade?.num ?? ''),
      String(exprCanon(r?.tipoControleCriterio, '') || ''),
      String(exprCanon(r?.localizadorRemover, '') || ''),
      String(exprCanon(r?.localizadorIncluirAcao, '') || ''),
      String(getOutrosCanonical(r) || ''),
    ])));
    if (ATP_RULES_LOG.lastSignature === signature && !ATP_RULES_LOG.force) return;
    ATP_RULES_LOG.lastSignature = signature;
    ATP_RULES_LOG.lastDump = rules;
    ATP_RULES_LOG.didDumpOnce = true;

    console.groupCollapsed(`[ATP][Regras] Dump de regras capturadas (${rules.length})`);
    console.log('Armazenamento global principal: window.__ATP_LAST_RULES__');
    console.log('Armazenamento global auxiliar: window.__ATP_RULES_LOG.lastDump');
    console.log('Total em window.__ATP_LAST_RULES__:', Array.isArray(window.__ATP_LAST_RULES__) ? window.__ATP_LAST_RULES__.length : 0);

	    for (let i = 0; i < rules.length; i++) {
	      const r = rules[i];
	      try {
	        const num = String(r?.num ?? '');
	        const header = `[ATP][Regra] #${num}`;
	        console.groupCollapsed(header);

	        const prioridade = String(r?.prioridade?.raw ?? r?.prioridade?.num ?? '');
	        const tipoCtrl = String(exprCanon(r?.tipoControleCriterio, '') || '');
	        const locRem = String(exprCanon(r?.localizadorRemover, '') || '');
	        const locIncAcao = String(exprCanon(r?.localizadorIncluirAcao, '') || '');
	        const outros = String(getOutrosCanonical(r) || '');

	        // Formato textual direto (como nas versoes antigas), para sempre aparecer no console.
	        console.log('Regra:', num || '(sem número)');
	        console.log('Prioridade:', prioridade || '(vazia)');
	        console.log('Localizador REMOVER:', locRem || '(vazio)');
	        console.log('Tipo de Controle / Critério:', tipoCtrl || '(vazio)');
	        console.log('Localizador INCLUIR / Ação:', locIncAcao || '(vazio)');
	        console.log('Outros Critérios:', outros || '(vazio)');
          console.log('Objeto bruto da regra (variável): rules[' + i + ']');
          console.log(r);

	        // Mantém objeto completo para inspeção detalhada.
	        const snap = {
	          num: r?.num ?? null,
	          ativa: r?.ativa !== false,
	          prioridade: r?.prioridade ?? null,
	          localizadorRemover: r?.localizadorRemover ?? null,
	          tipoControleCriterio: r?.tipoControleCriterio ?? null,
	          localizadorIncluirAcao: r?.localizadorIncluirAcao ?? null,
	          outrosCriterios: r?.outrosCriterios ?? null
	        };
	        console.log('Campos principais:', snap);
          const rows = atpBuildRuleRows(r, i);
          try { if (typeof console.table === 'function') console.table(rows); else console.log('Variáveis mapeadas:', rows); } catch (_) {}
          console.log('Snapshot JSON completo:', atpSafeJson(r));
	        console.groupEnd();
	      } catch (ruleErr) {
	        console.warn('[ATP] Falha ao logar uma regra específica:', ruleErr);
	      }
	    }

	    console.groupEnd();
  } catch (e) {
    console.warn('[ATP] Falha ao logar regras:', e);
  }
}

const ATP_CONFLICT_LOG = (window.__ATP_CONFLICT_LOG = window.__ATP_CONFLICT_LOG || { enabled: true, logged: new Set() });

function logConflictRead(baseRule, otherRule, rec) {
  try {
    if (!ATP_CONFLICT_LOG.enabled) return;
    const tipos = Array.from(rec?.tipos || []);
    const iNum = String(rec?.iNum ?? baseRule?.num ?? '');
    const jNum = String(rec?.jNum ?? otherRule?.num ?? '');
    const key = `${iNum}=>${jNum}|${tipos.join(',')}`;
    if (ATP_CONFLICT_LOG.logged.has(key)) return;
    ATP_CONFLICT_LOG.logged.add(key);

    console.groupCollapsed(`[ATP][Conflito] ${iNum} x ${jNum} :: ${tipos.join(' | ')}`);
    console.log('Regra A (base):', baseRule || null);
    console.log('Regra B (outra):', otherRule || null);

    const motivos = {};
    if (rec?.motivosByTipo && typeof rec.motivosByTipo.forEach === 'function') {
      rec.motivosByTipo.forEach((set, tipo) => { motivos[tipo] = Array.from(set || []); });
    }
    console.log('Motivos detectados:', motivos);
    console.log('Impacto máximo:', rec?.impactoMax || null);
    console.groupEnd();
  } catch (e) {
    console.warn('[ATP] Falha ao logar conflito:', e);
  }
}

try { console.log('[ATP][OK] logs.js inicializado'); } catch (e) { }
;
