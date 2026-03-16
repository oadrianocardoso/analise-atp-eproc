// ==UserScript==
// @name         Análise de ATP eProc (LOCAL)
// @namespace    https://github.com/oadrianocardoso/analise-atp-eproc
// @description  Script para análise avançada de regras de ATP no eProc, com detecção de colisões e geração de relatórios.
// @author       ADRIANO AUGUSTO CARDOSO E SANTOS
// @version      11.1
// @downloadURL  file:///C:/Users/Adriano/Desktop/PROJETOS/analise-atp-eproc/analise-atp-eproc.user.js
// @updateURL    file:///C:/Users/Adriano/Desktop/PROJETOS/analise-atp-eproc/analise-atp-eproc.user.js
// @homepageURL  https://github.com/oadrianocardoso/analise-atp-eproc
// @supportURL   https://github.com/oadrianocardoso/analise-atp-eproc/issues
// @run-at       document-start
// @noframes
// @match        *://*/controlador.php?acao=automatizar_localizadores*
// @match        *://*/*/controlador.php?acao=automatizar_localizadores*
// @match        *://*/*/*/controlador.php?acao=automatizar_localizadores*
// @grant        none
// @require      file:///C:/Users/Adriano/Desktop/PROJETOS/analise-atp-eproc/01-config.js
// @require      file:///C:/Users/Adriano/Desktop/PROJETOS/analise-atp-eproc/02-utilitarios.js
// @require      file:///C:/Users/Adriano/Desktop/PROJETOS/analise-atp-eproc/03-logs.js
// @require      file:///C:/Users/Adriano/Desktop/PROJETOS/analise-atp-eproc/04-styles.js
// @require      file:///C:/Users/Adriano/Desktop/PROJETOS/analise-atp-eproc/05-extrator-de-dados.js
// @require      file:///C:/Users/Adriano/Desktop/PROJETOS/analise-atp-eproc/06-analisador-de-colisoes.js
// @require      file:///C:/Users/Adriano/Desktop/PROJETOS/analise-atp-eproc/07-extratos-de-fluxos.js
// @require      file:///C:/Users/Adriano/Desktop/PROJETOS/analise-atp-eproc/11-coordenador-de-fluxos.js
// @require      file:///C:/Users/Adriano/Desktop/PROJETOS/analise-atp-eproc/10-ui-inicializacao.js
// @require      file:///C:/Users/Adriano/Desktop/PROJETOS/analise-atp-eproc/13-visualizador-fluxos-bpmnio.js?v=11.0
// @require      file:///C:/Users/Adriano/Desktop/PROJETOS/analise-atp-eproc/12-monitor-de-acesso.js
// ==/UserScript==

/*
RESUMO DO SISTEMA (ATP)

1) O QUE O SISTEMA FAZ
- Carrega módulos especializados para analisar regras de ATP no eProc.
- Extrai dados da tabela de regras (número, prioridade, remover, incluir, tipo/critério e outros critérios).
- Detecta conflitos entre regras e marca visualmente a tabela.
- Gera relatório de colisões em TXT.
- Gera extrato de fluxos em TXT.
- Visualiza fluxos detectados em bmpn.io (swimlanes por caminho, sem mistura entre caminhos independentes).

2) COMO O FLUXO INTERNO FUNCIONA
- Configuração e constantes globais: 01-config.js
- Funções utilitárias (normalização, parsing, helpers): 02-utilitarios.js
- Logging técnico de regras e conflitos: 03-logs.js
- Injeção de estilos e componentes visuais: 04-styles.js
- Extração de dados da tabela: 05-extrator-de-dados.js
- Análise de colisões: 06-analisador-de-colisoes.js
- Geração de extrato de fluxos (texto): 07-extratos-de-fluxos.js
- Coordenação de dados de fluxos para UI: 11-coordenador-de-fluxos.js
- Inicialização da UI, filtros e eventos: 10-ui-inicializacao.js
- Visualizador bmpn.io por fluxos detectados: 13-visualizador-fluxos-bmpnio.js

3) COLISÕES DETECTADAS (RESUMO)
- Colisão Total
  Quando prioridade, remover, tipo/critério, incluir/ação e outros critérios são equivalentes.
- Colisão Parcial
  Mesmo conjunto lógico da total, mas com prioridade diferente.
- Sobreposição
  Regra mais ampla pode executar antes de outra mais restrita no mesmo contexto.
- Possível Sobreposição
  Há indício de sobreposição sem ordem de execução conclusiva.
- Perda de Objeto
  Regra anterior remove localizador necessário para a regra seguinte.
- Perda de Objeto Condicional
  Consumo condicional de gatilho (AND) em cenários compatíveis.
- Contradição
  A própria regra contém critérios mutuamente exclusivos.
- Quebra de Fluxo
  Ação programada sem avanço real de localizador (risco de reexecução/ciclo).
- Looping / Looping Potencial
  Retroalimentação entre regras por remover/incluir.
*/

