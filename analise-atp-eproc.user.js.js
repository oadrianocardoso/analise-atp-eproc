// ==UserScript==
// @name         Análise de ATP eProc
// @namespace    https://github.com/oadrianocardoso/analise-atp-eproc
// @version      10.2.0
// @description  Análise de conflitos de ATP (Colisão, Sobreposição, Perda de Objeto e Looping)
// @author       ADRIANO AUGUSTO CARDOSO E SANTOS
// @run-at       document-start
// @noframes
// @match        https://eproc1g.tjsp.jus.br/eproc/*
// @match        https://eproc-1g-sp-hml.tjsp.jus.br/*
// @grant        none
//
// ✅ IMPORTANTE: o arquivo no Git deve se chamar exatamente: analise-atp-eproc.user.js
// e estar na branch main (ou ajuste os links)
//
// @downloadURL  https://raw.githubusercontent.com/oadrianocardoso/analise-atp-eproc/main/analise-atp-eproc.user.js
// @updateURL    https://raw.githubusercontent.com/oadrianocardoso/analise-atp-eproc/main/analise-atp-eproc.user.js
// @homepageURL  https://github.com/oadrianocardoso/analise-atp-eproc
// @supportURL   https://github.com/oadrianocardoso/analise-atp-eproc/issues
//
// ✅ MÓDULOS via Git (RAW) — ajuste os nomes conforme seus arquivos no repositório
// @require      https://raw.githubusercontent.com/oadrianocardoso/analise-atp-eproc/main/ATP_MODULAR/utils.js
// @require      https://raw.githubusercontent.com/oadrianocardoso/analise-atp-eproc/main/ATP_MODULAR/02_dom_and_style.js
// @require      https://raw.githubusercontent.com/oadrianocardoso/analise-atp-eproc/main/ATP_MODULAR/03_parsing_rules.js
// @require      https://raw.githubusercontent.com/oadrianocardoso/analise-atp-eproc/main/ATP_MODULAR/extract_dados.js
// @require      https://raw.githubusercontent.com/oadrianocardoso/analise-atp-eproc/main/ATP_MODULAR/extract_fluxos.js
// @require      https://raw.githubusercontent.com/oadrianocardoso/analise-atp-eproc/main/ATP_MODULAR/04_fluxos_text_and_zip.js
// @require      https://raw.githubusercontent.com/oadrianocardoso/analise-atp-eproc/main/ATP_MODULAR/05_bpmn_build_export.js
// @require      https://raw.githubusercontent.com/oadrianocardoso/analise-atp-eproc/main/ATP_MODULAR/06_conflicts_ui_init_and_close.js
// @require      https://raw.githubusercontent.com/oadrianocardoso/analise-atp-eproc/main/ATP_MODULAR/01_bpmn_modal_and_core.js
// ==/UserScript==


(function () {
  'use strict';
  console.log('[ATP][LOADER] Loader LOCAL modular ativo (9.0.28-modular-local)');
})();
