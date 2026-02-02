// ==UserScript==
// @name         Análise de ATP eProc
// @namespace    https://tjsp.eproc/automatizacoes
// @version      9.0.28
// @description  Análise de conflitos de ATP (Colisão, Sobreposição, Perda de Objeto e Looping)
// @author       ADRIANO AUGUSTO CARDOSO E SANTOS
// @run-at       document-start
// @noframes
// @match        https://eproc1g.tjsp.jus.br/eproc/*
// @match        https://eproc-1g-sp-hml.tjsp.jus.br/*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/oadrianocardoso/analise-atp-eproc/main/analise-atp-eproc.user.js
// @downloadURL  https://raw.githubusercontent.com/oadrianocardoso/analise-atp-eproc/main/analise-atp-eproc.user.js

/*******************************************************************************************
 * SCRIPT: Análise de ATP eProc
 * -----------------------------------------------------------------------------------------
 * Finalidade
 * ----------
 * Este UserScript realiza uma análise estática das regras de Automatização de Localizadores
 * (ATP) configuradas no sistema eProc do TJSP, com o objetivo de identificar conflitos
 * lógicos entre regras que possam causar comportamento inesperado na execução automática
 * do sistema.
 *
 * O script NÃO altera dados no banco, NÃO interfere na execução real das regras e NÃO muda
 * a ordem de processamento do eProc. Ele atua exclusivamente na camada de interface (DOM),
 * auxiliando o usuário humano na auditoria e revisão das regras.
 *
 * -----------------------------------------------------------------------------------------
 * O que o script faz
 * ------------------
 * 1) Lê a tabela de Automatização de Localizadores do eProc diretamente do HTML.
 * 2) Extrai, normaliza e estrutura os campos relevantes de cada regra:
 *    - Número da regra
 *    - Prioridade (numérica ou indefinida / null)
 *    - Localizador REMOVER (expressão lógica com E / OU)
 *    - Comportamento do REMOVER (tooltip)
 *    - Tipo de Controle / Critério
 *    - Localizador INCLUIR / Ação
 *    - Outros Critérios (estrutura em grupos AND / OR)
 * 3) Analisa todas as combinações de regras (A x B) e classifica conflitos conforme
 *    regras de negócio pré-definidas.
 * 4) Exibe os conflitos diretamente na tabela do eProc, em uma coluna adicional
 *    "Conflita com / Tipo", com:
 *    - Tipo do conflito
 *    - Impacto (Baixo, Médio, Alto)
 *    - Explicação técnica ("Por quê")
 *    - Sugestões práticas de correção
 * 5) Disponibiliza:
 *    - Filtro "Apenas regras com conflito"
 *    - Botão "Comparar" (filtra regras conflitantes)
 *    - Botão "Gerar Relatório de Conflitos" (exporta relatório em TXT)
 *
 * -----------------------------------------------------------------------------------------
 * Importante sobre PRIORIDADE
 * ---------------------------
 * - Prioridades numéricas (1 a 20) executam ANTES de prioridades indefinidas (null).
 * - Prioridade null é tratada como a última a executar.
 * - Quanto MENOR o número da prioridade, MAIS CEDO a regra executa.
 *
 * Essa regra reflete o comportamento real do eProc.
 *
 * -----------------------------------------------------------------------------------------
 * Tipos de Conflito Detectados (Regras de Negócio)
 * -----------------------------------------------
 *
 * 1) COLISÃO TOTAL
 *    Ocorre quando DUAS regras possuem TODOS os campos abaixo idênticos:
 *    - Prioridade
 *    - Localizador REMOVER
 *    - Tipo de Controle / Critério
 *    - Localizador INCLUIR / Ação
 *    - Outros Critérios
 *
 *    Efeito:
 *    - Regras totalmente redundantes.
 *
 *    Sugestão:
 *    - Manter apenas uma delas (normalmente a de menor numeração).
 *
 * -----------------------------------------------------------------------------------------
 *
 * 2) COLISÃO PARCIAL
 *    Ocorre quando as regras possuem:
 *    - Localizador REMOVER igual
 *    - Tipo de Controle / Critério igual
 *    - Localizador INCLUIR / Ação igual
 *    - Outros Critérios iguais
 *    - Prioridades DIFERENTES
 *
 *    Efeito:
 *    - Uma regra é redundante em relação à outra.
 *
 *    Sugestão:
 *    - Manter a regra que executa primeiro (menor prioridade numérica).
 *
 * -----------------------------------------------------------------------------------------
 *
 * 3) SOBREPOSIÇÃO
 *    Ocorre quando:
 *    - Localizador REMOVER é igual
 *    - Tipo de Controle / Critério é igual
 *    - Existe relação de abrangência nos "Outros Critérios"
 *      (uma regra é mais ampla que a outra)
 *    - A regra MAIS AMPLA executa ANTES da mais restrita
 *
 *    Efeito:
 *    - A regra mais ampla pode capturar processos que deveriam ser tratados
 *      pela regra mais específica.
 *
 *    Sugestão:
 *    - Ajustar a prioridade para que a regra mais restrita execute antes,
 *      ou tornar a regra mais ampla menos abrangente.
 *
 * -----------------------------------------------------------------------------------------
 *
 * 4) POSSÍVEL SOBREPOSIÇÃO
 *    Ocorre quando:
 *    - Localizador REMOVER é igual
 *    - Tipo de Controle / Critério é igual
 *    - Existe relação ampla/restrita nos Outros Critérios
 *    - As prioridades são equivalentes (ambas numéricas iguais ou ambas null)
 *
 *    Efeito:
 *    - Não é possível garantir a ordem de execução.
 *
 *    Sugestão:
 *    - Definir prioridades explícitas para evitar ambiguidade.
 *
 * -----------------------------------------------------------------------------------------
 *
 * 5) PERDA DE OBJETO
 *    Ocorre quando:
 *    - Localizador REMOVER é igual
 *    - Tipo de Controle / Critério é igual
 *    - A regra que executa ANTES:
 *        • é mais ampla ou idêntica
 *        • possui comportamento "Remover o processo do(s) localizador(es) informado(s)"
 *
 *    Efeito:
 *    - A regra posterior nunca será executada, pois o localizador necessário
 *      já foi removido.
 *
 *    Regra Importante:
 *    - Quando há PERDA DE OBJETO, o script mantém o rótulo de SOBREPOSIÇÃO
 *      (pois há cobertura/ordem) e ADICIONA também o rótulo "Perda de Objeto"
 *      (modo analítico: exibe todos os tipos aplicáveis).
 *
 * -----------------------------------------------------------------------------------------
 *
 * 6) CONTRADIÇÃO
 *    Ocorre quando a PRÓPRIA regra contém critérios mutuamente exclusivos no mesmo
 *    ramo lógico (conector "E" / AND), tornando a regra logicamente impossível
 *    ou inválida.
 *
 *    Exemplos comuns:
 *    - Seleção simultânea de condições COM e SEM o mesmo atributo
 *      (ex.: prazo, representação processual, procurador, etc.).
 *    - Estados incompatíveis do mesmo campo
 *      (ex.: "Justiça Gratuita-Deferida" E "Justiça Gratuita-Indeferida").
 *    - Condições exclusivas no mesmo polo
 *      (ex.: APENAS UMA parte e MAIS DE UMA parte no mesmo polo).
 *
 *    Efeito:
 *    - A regra não consegue encontrar nenhum processo válido ou se torna
 *      praticamente inexecutável.
 *
 *    Sugestão:
 *    - Remover seleções incompatíveis ou dividir a lógica em regras distintas.
 *
 * -----------------------------------------------------------------------------------------
 *
 * 7) LOOPING POTENCIAL (opcional)
 *    Detectado apenas se ATP_CONFIG.analisarLooping === true.
 *
 *    Ocorre quando:
 *    - Regra A remove algo que a Regra B inclui
 *    - Regra B remove algo que a Regra A inclui
 *
 *    Efeito:
 *    - Ciclo infinito de inclusão e remoção de localizadores.
 *
 *    Observação:
 *    - Por padrão, esta análise fica DESATIVADA por segurança.
 *
 * -----------------------------------------------------------------------------------------
 * Observações Finais
 * ------------------
 * - O script reflete o comportamento real do eProc, mas NÃO substitui testes
 *   funcionais em ambiente controlado.
 * - Todas as análises são heurísticas seguras, voltadas à prevenção de erros
 *   de configuração.
 * - O objetivo é apoiar auditoria, governança e manutenção das regras de ATP.
 *
 *******************************************************************************************/


// ==/UserScript==

// Loader LOCAL modular (edite os @require file:///)
// @version      9.0.28-modular-local

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