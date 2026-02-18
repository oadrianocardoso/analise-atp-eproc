try { console.log('[ATP][LOAD] 12-monitor-de-acesso.js carregado com sucesso'); } catch (e) { }
(function () {
  'use strict';

  const DEFAULTS = {
    enabled: true,
    supabaseUrl: 'https://kmzhotuozofgnmhojxog.supabase.co',
    supabaseApiKey: 'sb_publishable_toIow1P88PYcrwoq2vvS7Q_2v_v46sC',
    tableName: 'atp_execucoes',
    waitMaxMs: 30000
  };

  const cfg = Object.assign({}, DEFAULTS, (window.ATP_ACCESS_MONITOR_CONFIG || {}));
  if (!cfg.enabled) return;
  window.ATP_ACCESS_MONITOR_PUBLIC = {
    supabaseUrl: cfg.supabaseUrl,
    supabaseApiKey: cfg.supabaseApiKey,
    tableName: cfg.tableName
  };

  const endpoint = `${String(cfg.supabaseUrl || '').replace(/\/+$/, '')}/rest/v1/${cfg.tableName}`;
  if (!cfg.supabaseUrl || !cfg.supabaseApiKey || !cfg.tableName) return;

  function getSelectedOrgao() {
    try {
      const sel = document.getElementById('selOrgao');
      if (!sel) return '';
      const opt = sel.options && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex] : null;
      if (opt && String(opt.textContent || '').trim()) return String(opt.textContent || '').trim();
      return String(sel.value || '').trim();
    } catch (e) {
      return '';
    }
  }

  function getUsuarioHeader() {
    try {
      const el = document.querySelector('.header.bg-gray-grad .text-center.font-weight-bold span');
      if (el && String(el.textContent || '').trim()) return String(el.textContent || '').trim();
      const spans = Array.from(document.querySelectorAll('span'));
      const found = spans.find((s) => /\([A-Z]\d+\)/i.test(String(s.textContent || '')));
      return found ? String(found.textContent || '').trim() : '';
    } catch (e) {
      return '';
    }
  }

  function saveExecution(acao) {
    const orgao = getSelectedOrgao();
    const usuario = getUsuarioHeader();

    const payload = [{
      executed_at: new Date().toISOString(),
      sel_orgao: orgao || '',
      usuario: usuario || '',
      acao: String(acao || '')
    }];

    fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: cfg.supabaseApiKey,
        Authorization: `Bearer ${cfg.supabaseApiKey}`
      },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(() => { });
  }

  function getActionFromClickTarget(target) {
    try {
      if (!target || typeof target.closest !== 'function') return '';
      if (target.closest('#btnFiltrarConflitosSlim')) return 'clique_filtrar_regras_conflitantes';
      if (target.closest('#btnGerarRelatorioColisoes')) return 'clique_gerar_relatorio_colisoes';
      if (target.closest('#btnExtratoFluxosATP')) return 'clique_gerar_extrato_fluxos';
      if (target.closest('#btnExtratoFluxosBPMNGrid_ATP')) return 'clique_exportar_fluxos_bizagi';
      if (target.closest('#btnVisualizarFluxoATP')) return 'clique_visualizar_fluxo';
      if (target.closest('#btnDashboardUsoATP')) return 'clique_dashboard_utilizacao';
      if (target.closest('.atp-compare-btn')) return 'clique_comparar';
      return '';
    } catch (e) {
      return '';
    }
  }

  function bindDelegatedClicks() {
    try {
      if (document.documentElement && document.documentElement.dataset.atpAccessDelegatedBound === '1') return;
      if (document.documentElement) document.documentElement.dataset.atpAccessDelegatedBound = '1';
      document.addEventListener('click', (ev) => {
        const acao = getActionFromClickTarget(ev && ev.target ? ev.target : null);
        if (acao) saveExecution(acao);
      }, true);
    } catch (e) { }
  }

  function boot() {
    saveExecution('carregamento');
    bindDelegatedClicks();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  try { console.log('[ATP][OK] 12-monitor-de-acesso.js inicializado'); } catch (e) { }
})();
