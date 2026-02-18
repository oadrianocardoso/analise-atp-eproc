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

    for (const r of rules) {
      const num = String(r?.num ?? '');
      const pr = String(r?.prioridade?.raw ?? '');
      const tipo = String(r?.tipoControleCriterio ?? '');
      const header = `[ATP][Regra] #${num}`;
      console.groupCollapsed(header);

      console.log('Campos principais (mesmos da colisão):', {
        num: r?.num,
        ativa: r?.ativa !== false,

        prioridade: r?.prioridade,

        tipoControleCriterio: r?.tipoControleCriterio,

        localizadorIncluirAcao: r?.localizadorIncluirAcao,

        localizadorIncluirAcoes: (r?.localizadorIncluirAcao && Array.isArray(r.localizadorIncluirAcao.acoes)) ? r.localizadorIncluirAcao.acoes : [],
        localizadorRemover: r?.localizadorRemover,
        removerWildcard: !!r?.removerWildcard,

        comportamentoRemover: r?.comportamentoRemover,

        outrosCriterios: r?.outrosCriterios
      });
      console.groupEnd();
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
