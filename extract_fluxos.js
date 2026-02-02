try { console.log('[ATP][LOAD] extract_fluxos.js carregado com sucesso'); } catch (e) {}

/**
 * ATP MODULAR - extract_fluxos.js
 * -----------------------------------------------------------------------------
 * Centraliza e expõe a API de FLUXOS para a UI (select "Fluxos"), exportação e
 * visualização no bpmn-js.
 *
 * Não altera comportamento: apenas cria wrappers e um cache leve em window.ATP.
 */

(function () {
  'use strict';

  const LOG = '[ATP][FLUXOS]';

  // Namespace público único
  window.ATP = window.ATP || {};
  window.ATP.extract = window.ATP.extract || {};

  const asArray = (v) => (Array.isArray(v) ? v : []);

  function getFluxosData(rules) { // Calcula e devolve a estrutura {fluxos,...} para a UI.
    try {
      if (typeof atpComputeFluxosData === 'function') {
        const data = atpComputeFluxosData(asArray(rules));
        if (data && typeof data === 'object') {
          window.ATP.fluxosData = data; // cache leve
          return data;
        }
      }
    } catch (e) {
      try { console.warn(LOG, 'Falha ao calcular fluxos (atpComputeFluxosData):', e); } catch (_) {}
    }

    const empty = { fluxos: [], nodes: [], edges: [], starts: [] };
    window.ATP.fluxosData = empty;
    return empty;
  }

  function getFluxos(rules) { // Retorna apenas a lista de fluxos (array) para o select.
    const data = getFluxosData(rules);
    return asArray(data && data.fluxos);
  }

  function getBpmnFilesForRules(rules) { // Retorna os BPMN split files (para abrir/baixar fluxo).
    try {
      if (typeof atpGetBpmnSplitFilesForRules === 'function') {
        const files = atpGetBpmnSplitFilesForRules(asArray(rules));
        if (Array.isArray(files)) {
          window.ATP.bpmnSplitFiles = files; // cache leve
          return files;
        }
      }
    } catch (e) {
      try { console.warn(LOG, 'Falha ao obter BPMN split files (atpGetBpmnSplitFilesForRules):', e); } catch (_) {}
    }

    window.ATP.bpmnSplitFiles = [];
    return [];
  }

  function buildFluxoOptionLabel(fl, idx) { // Monta o label do <option> do seletor de fluxos (igual ao comportamento atual).
    try {
      const starts = (fl && fl.starts && fl.starts.length) ? fl.starts.join(' | ') : '(sem início)';
      const nodesN = (fl && fl.nodes && fl.nodes.length) ? fl.nodes.length : 0;
      return `Fluxo ${String((idx | 0) + 1).padStart(2, '0')} — Início(s): [${starts}] — Nós: ${nodesN}`;
    } catch (e) {
      return `Fluxo ${String((idx | 0) + 1).padStart(2, '0')}`;
    }
  }

  // Exports (não sobrescreve se já existir)
  window.ATP.extract.getFluxosData = window.ATP.extract.getFluxosData || getFluxosData;
  window.ATP.extract.getFluxos = window.ATP.extract.getFluxos || getFluxos;
  window.ATP.extract.getBpmnFilesForRules = window.ATP.extract.getBpmnFilesForRules || getBpmnFilesForRules;
  window.ATP.extract.buildFluxoOptionLabel = window.ATP.extract.buildFluxoOptionLabel || buildFluxoOptionLabel;

  try { console.log('[ATP][OK] extract_fluxos.js exportou ATP.extract.getFluxos*()'); } catch (e) {}
})();
