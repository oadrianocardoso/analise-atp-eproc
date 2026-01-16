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

## ⚠️ O que são “conflitos”?

Conflitos são situações em que regras podem se atrapalhar, por exemplo:

* **Colisão**: regras repetidas ou quase iguais
* **Sobreposição**: uma regra mais ampla pode “passar na frente” de outra
* **Perda de Objeto**: uma regra remove o localizador que outra regra precisa
* **Quebra de Fluxo**: a regra roda, mas não muda o localizador
* **Contradição**: a própria regra tem critérios impossíveis

---

## 🖥️ Exemplo de alerta de conflitos

<img width="1228" height="813" alt="image" src="https://github.com/user-attachments/assets/1b188ec4-3882-4fa9-aec2-a699b8f104c4"  />
*Exemplo da coluna “Conflitos” mostrando conflitos detectados entre as regras.*

---

## 🧭 Agrupamento por fluxo (entender a “cadeia”)

O script consegue **organizar as regras em fluxos** (cadeias), tentando mostrar:

* de onde o processo começa (localizador inicial)
* qual regra leva para qual destino
* como o fluxo continua a partir do localizador seguinte
* onde existe ramificação (mais de um caminho)

Isso ajuda a entender o “mapa” das automatizações sem precisar abrir regra por regra.

<img width="1224" height="593" alt="image" src="https://github.com/user-attachments/assets/d1ebfe90-4637-445c-a13f-5c2e6b300612" />
*Exemplo de agrupamento por fluxo / lista de fluxos.*

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

## 🔄 Exportar fluxo em BPMN (para Bizagi)

O script também pode exportar um **arquivo BPMN** para abrir no Bizagi (ou outra ferramenta), para visualizar o fluxo como diagrama.

Útil para:

* enxergar o processo “andando” entre localizadores
* apresentar o fluxo para equipe/gestão
* identificar pontos onde o fluxo quebra ou volta

<img width="2188" height="812" alt="image" src="https://github.com/user-attachments/assets/0ae9bbe5-2570-4aec-8025-9d697aeab3f4" />
*Exemplo do BPMN aberto no Bizagi.*

---

## 🛠️ Como instalar

### 1️⃣ Instale a extenção Tampermonkey no Google Chrome

https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo?pli=1

### 2️⃣ Instale o script

1. Abra o link do script https://raw.githubusercontent.com/oadrianocardoso/analise-atp-eproc/main/analise-atp-eproc.user.js
2. Clique em **Install** no Tampermonkey
<img width="638" height="338" alt="image" src="https://github.com/user-attachments/assets/5b13b3b0-d20e-4907-8138-0bb8382f24ec" />

### 3️⃣ Usar no dia a dia

1. Entre no eProc
2. Abra **Automatização de Localizadores**
3. Aguarde alguns segundos
4. Os conflitos e botões do script aparecerão na tela

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
