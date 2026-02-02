# ATP - Versão Modular (Tampermonkey)

Este ZIP separa o script **Análise de ATP eProc** em módulos, **sem alterar a lógica**: os arquivos são apenas “cortes” sequenciais do original.

## Como usar (LOCAL)
1. Extraia este ZIP para uma pasta, por exemplo: `C:\ATP_MOD\`
2. No Tampermonkey → *Create a new script* → cole **todo o conteúdo** de `ATP_loader_local.user.js`
3. Ajuste os caminhos `@require file:///C:/ATP_MODULAR/...` para a pasta onde você extraiu.
4. Salve e recarregue o eProc.

## Ordem dos módulos
A ordem é importante (dependências):
1. 01_bpmn_modal_and_core.js
2. 02_dom_and_style.js
3. 03_parsing_rules.js
4. 04_fluxos_text_and_zip.js
5. 05_bpmn_build_export.js
6. 06_conflicts_ui_init_and_close.js
