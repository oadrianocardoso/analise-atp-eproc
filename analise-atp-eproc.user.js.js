// ==UserScript==
// @name         Análise de ATP eProc
// @version      10.2
// @description  Análise de conflitos de ATP (Colisão, Sobreposição, Perda de Objeto e Looping)
// @author       ADRIANO AUGUSTO CARDOSO E SANTOS
// @run-at       document-start
// @noframes
// @match        https://eproc1g.tjsp.jus.br/eproc/*
// @match        https://eproc-1g-sp-hml.tjsp.jus.br/*
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/oadrianocardoso/analise-atp-eproc/main/analise-atp-eproc.user.js.js
// @updateURL    https://raw.githubusercontent.com/oadrianocardoso/analise-atp-eproc/main/analise-atp-eproc.user.js.js
// @homepageURL  https://github.com/oadrianocardoso/analise-atp-eproc/
// @supportURL   https://github.com/oadrianocardoso/analise-atp-eproc/

// @require      file:///C:/Users/Adriano/Downloads/ATP_MODULAR/utils.js
// @require      file:///C:/Users/Adriano/Downloads/ATP_MODULAR/02_dom_and_style.js
// @require      file:///C:/Users/Adriano/Downloads/ATP_MODULAR/03_parsing_rules.js
// @require      file:///C:/Users/Adriano/Downloads/ATP_MODULAR/extract_dados.js
// @require      file:///C:/Users/Adriano/Downloads/ATP_MODULAR/extract_fluxos.js
// @require      file:///C:/Users/Adriano/Downloads/ATP_MODULAR/04_fluxos_text_and_zip.js
// @require      file:///C:/Users/Adriano/Downloads/ATP_MODULAR/05_bpmn_build_export.js
// @require      file:///C:/Users/Adriano/Downloads/ATP_MODULAR/06_conflicts_ui_init_and_close.js
// @require      file:///C:/Users/Adriano/Downloads/ATP_MODULAR/01_bpmn_modal_and_core.js
// ==/UserScript==

(function () {
  'use strict';
  console.log('[ATP][LOADER] Loader LOCAL modular ativo (9.0.28-modular-local)');
})();
