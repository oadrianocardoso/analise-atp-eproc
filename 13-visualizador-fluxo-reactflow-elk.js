try { console.log('[ATP][LOAD] 13-visualizador-fluxo-reactflow-elk.js desativado (React Flow removido)'); } catch (e) {}

(function () {
  'use strict';

  function atpOpenFlowReactModal() {
    return Promise.reject(new Error('React Flow visualizer removed. Use BPMN + ELK button.'));
  }

  function atpCloseFlowReactModal() {
    // no-op
  }

  window.atpOpenFlowReactModal = atpOpenFlowReactModal;
  window.atpCloseFlowReactModal = atpCloseFlowReactModal;

  try { console.log('[ATP][OK] 13-visualizador-fluxo-reactflow-elk.js desativado'); } catch (e) {}
})();
