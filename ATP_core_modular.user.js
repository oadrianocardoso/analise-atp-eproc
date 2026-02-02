// ==UserScript==
// @name         Análise de ATP eProc (Core Modular - LOCAL Loader)
// @namespace    https://tjsp.eproc/automatizacoes
// @version      9.0.28-modular-local
// @description  Loader modular local (core) para a Análise de ATP eProc
// @author       ADRIANO AUGUSTO CARDOSO E SANTOS
// @run-at       document-start
// @noframes
// @match        https://eproc1g.tjsp.jus.br/eproc/*
// @match        https://eproc-1g-sp-hml.tjsp.jus.br/*
// @grant        none
//
// COMO USAR (LOCAL):
// 1) Coloque a pasta ATP_MODULAR em C:/ATP_MODULAR (recomendado) OU ajuste os caminhos abaixo.
// 2) No Tampermonkey, crie um novo script e cole ESTE loader.
// 3) Salve e recarregue o eProc.
//
// IMPORTANTE: sem espaços/acentos no caminho e com extensão .js nos módulos.
//
// @require      file:///C:/ATP_MODULAR/utils.js
// @require      file:///C:/ATP_MODULAR/extract_dados.js
// @require      file:///C:/ATP_MODULAR/01_bpmn_modal_and_core.js
// @require      file:///C:/ATP_MODULAR/02_dom_and_style.js
// @require      file:///C:/ATP_MODULAR/03_parsing_rules.js
// @require      file:///C:/ATP_MODULAR/04_fluxos_text_and_zip.js
// @require      file:///C:/ATP_MODULAR/05_bpmn_build_export.js
// @require      file:///C:/ATP_MODULAR/extract_fluxos.js
// @require      file:///C:/ATP_MODULAR/06_conflicts_ui_init_and_close.js
// ==/UserScript==

try { console.log('[ATP][LOADER] Core Modular LOCAL ativo (9.0.28-modular-local)'); } catch (e) {}