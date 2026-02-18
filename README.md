# 🔍 Análise de ATP eProc

Este script ajuda a **identificar problemas nas regras de Automatização de Localizadores (ATP)** do eProc e também permite **gerar relatórios de conflitos e de fluxos detectados** para entender melhor o que está acontecendo.

---

## ✅ O que ele faz?

Quando você abre a tela **Automatização de Localizadores** no eProc, o script:

* Analisa as regras da tabela automaticamente
* Destaca **conflitos entre as regras**
* Mostra **explicações e sugestões**
* Permite **exportar relatórios dos fluxos detectados em TXT**
* Permite **agrupar a visualização por fluxo**
* Exporta **fluxos em BPMN** para importar pelo Bizagi

---

## ⚠️ O que são “Conflitos”?

Conflitos são situações em que regras podem se atrapalhar, por exemplo:

* **Colisão**: regras repetidas ou quase iguais
* **Sobreposição**: uma regra mais ampla pode “passar na frente” de outra
* **Perda de Objeto**: uma regra remove o localizador que outra regra precisa
* **Quebra de Fluxo**: a regra roda, mas não muda o localizador
* **Contradição**: a própria regra tem critérios impossíveis

---

## 🖥️ Exemplo de Alerta de Conflitos

<img width="1228" height="813" alt="image" src="https://github.com/user-attachments/assets/1b188ec4-3882-4fa9-aec2-a699b8f104c4"  />
*Exemplo da coluna “Conflitos” mostrando conflitos detectados entre as regras.*

---

## 🖥️ Relatório de Colisões

Gera um relatório técnico em .txt com todas as colisões identificadas entre as regras de ATP, pronto para auditoria e revisão.

* Consolida os conflitos detectados na análise (ex.: Colisão Total, Colisão Parcial, Sobreposição, Perda de Objeto, Perda de Objeto Condicional, Contradição, Quebra de Fluxo e Looping Potencial).
* Exibe resumo por tipo de colisão e total de ocorrências.
* Lista cada caso com:
* regra A x regra B (ou própria regra, quando aplicável),
* tipo da colisão,
* motivo técnico (Por quê),
* sugestão de correção (Sugestão).
* Padroniza a descrição para facilitar triagem, validação com equipe de negócio e priorização de ajustes.
* Inclui mini-guia de referência no final para interpretação rápida dos tipos de conflito.

<img width="1045" height="494" alt="image" src="https://github.com/user-attachments/assets/11874819-6ea4-4a11-a591-f6434cf1dbbc" />

---

## 🖥️ Visualizar Fluxo BPMN

Abre um visualizador interativo do fluxo da regra selecionada, convertido para BPMN, sem sair da tela do eProc.
* Mostra o fluxo em diagrama (eventos, decisões e tarefas) para leitura rápida da lógica da regra.
* Destaca visualmente a regra/passo atual no mapa, facilitando auditoria e depuração.
* Permite comparar a sequência de execução entre regras e identificar gargalos, sobreposições e quebras de fluxo.
* Usa os dados já extraídos pelo script (REMOVER, INCLUIR/Ação, Tipo de Controle e Outros Critérios) para montar o desenho do processo.

<img width="1795" height="848" alt="fluxo_correto" src="https://github.com/user-attachments/assets/10058f0c-3043-430f-80b9-d618c3ab7aaf" />

---

## 🔄 Exportar fluxo em BPMN (para Bizagi)

O script também pode exportar um **arquivo BPMN** para abrir no Bizagi (ou outra ferramenta), para visualizar o fluxo como diagrama.

Útil para:

* enxergar o processo “andando” entre localizadores
* apresentar o fluxo para equipe/gestão
* identificar pontos onde o fluxo quebra ou volta

<img width="2188" height="812" alt="image" src="https://github.com/user-attachments/assets/0ae9bbe5-2570-4aec-8025-9d697aeab3f4" />
*Exemplo do BPMN aberto no Bizagi.*

---

## 🧾 Exportar “Extrato do Fluxo” em TXT

Além de mostrar na tela, o script pode gerar um **relatório em TXT**, ideal para:

* enviar para alguém revisar
* anexar em chamado / documentação
* registrar evidências de conflito e sugestões
* guardar histórico do que foi analisado

O TXT normalmente inclui:

* data/hora e URL
* resumo por tipo de conflito
* lista detalhada de pares A x B com explicação (“por quê”)
* sugestões de correção

<img width="947" height="644" alt="image" src="https://github.com/user-attachments/assets/6e222bcf-bb2f-4003-9038-cde01470944d" />
*Exemplo do arquivo TXT exportado (abrindo no Bloco de Notas).*

---

## 🛠️ Como instalar

### 1️⃣ Instale a extenção Tampermonkey no Google Chrome

https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo?pli=1

### 2️⃣ Instale o script

1. Abra o link do script https://raw.githubusercontent.com/oadrianocardoso/analise-atp-eproc/main/analise-atp-eproc.user.js
2. Clique em **Install** no Tampermonkey
3. <img width="638" height="338" alt="image" src="https://github.com/user-attachments/assets/5b13b3b0-d20e-4907-8138-0bb8382f24ec" />
4. Acesse o menu **Gerenciar Extensão**
5. <img width="342" height="505" alt="image" src="https://github.com/user-attachments/assets/4d6d236b-3c8f-44ff-928a-9db0ea1b2369" />
6. Habilite a opção **Permitir scripts de usuário**
7. <img width="687" height="776" alt="image" src="https://github.com/user-attachments/assets/7013568f-7871-4f9d-b5cd-75b63d9a4f82" />

### 3️⃣ Usar no dia a dia

1. Entre no eProc
2. Abra a tela **Automatizar Tramitação Processual**
3. Aguarde alguns segundos
4. Os botões do script aparecerão na tela
5. <img width="895" height="85" alt="image" src="https://github.com/user-attachments/assets/6d534fc7-48c2-488e-bb46-99be02a2075a" />

---

## 🔒 É seguro?

Sim ✔️

* Não altera regras
* Não grava nada no eProc
* Não envia dados para fora
* Funciona só no seu navegador

Para parar de usar, basta **desativar no Tampermonkey**.

---

## ⚠️ Importante

Este script é uma ferramenta de **análise e apoio**.
Ele **não substitui testes** no sistema.
