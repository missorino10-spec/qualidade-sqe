# Ajustes do Fluxo SQE — Recebimento de Fornecedores

> Documento de trabalho. Vamos preenchendo etapa por etapa com o pessoal da Qualidade.
> **Nada é executado no código até o comando final do usuário.**
> Legenda: 🟢 já existe na app | 🟡 existe parcial, precisa mudar | 🔴 novo, não existe

---

## 01 — Cadastro de fornecedores (completo)
**O que foi pedido:** cadastro completo do fornecedor com: nome, CNPJ, endereço, contato,
classificação (situação atual da avaliação interna), escopo de inspeção, esforço da
qualidade para inspecionar, código do fornecedor no sistema, etc.

- Hoje na app: 🟡 existe um cadastro simples de fornecedor (poucos campos).
- Ajuste: ampliar o cadastro com todos esses campos.
- **DEFINIDO (via planilha, aba "Escopo" + "Base de Fornecedores"):** campos do cadastro:
  - **Código** do fornecedor (ex: 780949). Pode ter mais de um (ex: "782896 e 780913").
  - **Nome**
  - **Tipo de Fornecimento** (ex: Painéis elétricos, Matéria-prima, Parafusos…)
  - **Categoria de Inspeção** (ex: Elétrico/Montagem, Plástico injetado, Fixadores…)
  - **Plano de Inspeção (resumo)** (ex: "Visual + Embalagem + Dimensional por amostragem")
  - **Controles Principais** (texto detalhado do que checar)
  - **Esforço Qualidade** = **Baixo / Médio / Alto**
  - **Classificação de Fornecimento** = **A / B / C / D** (manual, definida pelo trimestre
    anterior) → dela derivam automaticamente periodicidade, nível, NQA (ver ponto 02).
- **DEFINIDO:** "Esforço da qualidade" é um **nível** (Baixo/Médio/Alto).
- **Dúvidas em aberto:**
  - **CNPJ, endereço e contato** (pedidos por você) NÃO estão nesta planilha. De onde vêm?
    Preenchimento manual no cadastro? Contato é um só ou vários (nome/e-mail/telefone)?

## 02 — Periodicidade de inspeção por classificação
**O que foi pedido:** cada classificação de avaliação tem uma periodicidade de inspeção.
Valores pré-setados, mas **editáveis a qualquer momento**.

- Hoje na app: 🔴 não existe regra de periodicidade.
- Ajuste: tabela "classificação → periodicidade", pré-preenchida e editável.
- **DEFINIDO (aba "Referência"):** tabela completa, pré-setada e editável:

  | Classif. | Periodicidade | Tipo | Nível de Inspeção | Nível | Freq (N entregas) | NQA |
  |---|---|---|---|---|---|---|
  | **A** | 1 a cada 5 entregas | Amostragem | Inspeção Reduzida (30% itens) | I | 5 | 4,0 |
  | **B** | 1 a cada 3 entregas | Amostragem | Inspeção Normal (50% itens) | II | 3 | 2,5 |
  | **C** | Todas as entregas | Amostragem | Inspeção Intensiva (100% itens) | III | 1 | 1,0 |
  | **D** | Todas as entregas | Amostragem | Inspeção Intensiva (100% itens) | III | 1 | 1,0 |

  Ou seja: a classificação define **de uma vez** a periodicidade, o % de itens da amostra
  e o NQA. Tudo isso é preenchido automaticamente a partir da classificação do fornecedor.
- **DEFINIDO:** contagem é **por fornecedor** (a planilha conta entregas por fornecedor,
  não por item).

## 03 — Registro de recebimento + decisão automática de inspeção
**O que foi pedido:** todo recebimento é registrado no dia; o próprio sistema, pelo
critério de inspeção, decide se **este** recebimento é inspecionado ou não.

- Hoje na app: 🟡 há registro de entrega, mas a decisão de inspecionar é manual (um botão).
- Ajuste: sistema decide sozinho com base na periodicidade da classificação.
- **DEFINIDO (aba "Kanban Semanal" + Instruções):** a cada entrega registrada, um
  **contador acumulado de entregas por fornecedor** é incrementado. O sistema calcula
  "Inspecionar?" automaticamente:
  - **A:** inspeciona quando o acumulado é múltiplo de 5 (MOD = 0)
  - **B:** múltiplo de 3
  - **C/D:** toda entrega
- **Dúvida em aberto:**
  - O contador **zera após inspecionar** ou é contínuo (uso de MOD)? (na app vou usar MOD
    contínuo, que dá o mesmo resultado sem precisar zerar — confirmar se serve)

## 04 — Aviso "passível de inspeção" + sugestão pelo escopo
**O que foi pedido:** se for inspecionar, a tela avisa que é passível de inspeção e
sugere, num botão, a inspeção conforme o escopo do fornecedor: **visual**, **lote**, ou **os dois**.

- Hoje na app: 🟡 tela de inspeção existe, mas sem essa sugestão automática por escopo.
- Ajuste: aviso + botão de sugestão conforme escopo cadastrado.

## 05 — Abrir formulário(s) padrão de inspeção
**O que foi pedido:** ao clicar na sugestão, abre automaticamente o formulário padrão —
**visual** e/ou **lote**. Se o fornecedor tem os dois, faz os dois formulários.

- Hoje na app: 🟡 formulário de inspeção único e genérico.
- Ajuste: dois formulários padrão distintos (visual / lote), abertos conforme o escopo.
- **DEFINIDO (Planilha 2 — ver análise abaixo):** existem 2 formulários oficiais, cada um
  com código de documento próprio:
  - **VISUAL** (Doc BDBR.QUA.FMR.06.07) → checklist de 12 grupos, cada item = Aprovado/
    Reprovado/Não Aplicável.
  - **LOTE / DIMENSIONAL** (Doc BDBR.QUA.FMR.011.06) → tabela de cotas (medições).
  - Ambos com cabeçalho comum, "Origem da Inspeção", Evidências (fotos), Observações,
    Resultado (Aprovado/Reprovado) e assinaturas.

## 06 — Resultado: aprovado ou reprovado
**O que foi pedido:** ao finalizar o(s) relatório(s), o usuário informa aprovado ou reprovado.

- Hoje na app: 🟢 existe (aprovado/reprovado/não inspecionado).
- **DEFINIDO:** o resultado é **por formulário**. Ou seja, visual tem seu resultado e
  lote tem o seu (podem divergir: um aprova e o outro reprova).
- **Dúvida em aberto (consequência):** se o visual reprova e o lote aprova, abre-se
  **1 RNC** referente ao formulário reprovado? (assumindo que sim: 1 RNC por formulário
  reprovado — confirmar)

## 07 — Fechamento do recebimento (aprovado x reprovado)
**O que foi pedido:**
- Aprovado → conta como inspeção realizada, aponta no painel de gestão e **encerra o recebimento**.
- Reprovado → abre **automaticamente** o formulário de RNC (modelo interno) já pré-preenchido.
  - RNC deve ser **exportável em PDF**.
  - Anexar **até 5 fotos** de evidência do problema.

- Hoje na app: 🟡 abre RNC pré-preenchida ao reprovar; anexos genéricos existem.
- Ajustes: 🔴 exportar RNC em PDF; 🔴 limitar a 5 fotos.
- **DEFINIDO (Planilha 2, aba RNC — Doc BDBR.QUA.FMR.008.05):** modelo de RNC obtido.
  - ⚠️ **NUMERAÇÃO da RNC:** o formato real é **`{sequencial}/{ano2dig}`** (ex: **149/26**),
    NÃO o formato que a app gera hoje (`BDBR.QUA.FMR.003.03-...`). O código "BDBR.QUA.FMR.008.05"
    é o **código do documento/modelo** (fixo, vai no cabeçalho), não o número da RNC.
    → **AJUSTAR a geração de número da RNC** para `{seq}/{aa}`.
  - Campos do formulário RNC: ver análise da Planilha 2 abaixo.

## 08 — Submenu RNC com status editável
**O que foi pedido:** RNC finalizada fica no submenu RNC com status **ABERTA**; o status é
editável conforme a evolução e devolutivas do fornecedor. Montado conforme o controle
interno de RNC da Qualidade.

- Hoje na app: 🟡 existe lista de RNC com status e histórico; status muda por botões fixos.
- Ajuste: alinhar a lista de status ao controle interno da Qualidade.
- **Dúvidas:**
  - Qual a lista completa de status que vocês usam?
  - _(esperar planilha do controle de RNC)_

---

## Objetivo geral
Unificar todas as planilhas de hoje em um só lugar → melhorar controle e dar visibilidade
gerencial no dashboard.

## Planilhas a receber (para detalhar cada ponto)
- [x] Cadastro de fornecedores + escopo (ponto 01) → **"Planilha de Planejamento de Inspeções - 2º Tri"** (abas Escopo, Base de Fornecedores)
- [x] Critérios / periodicidade de inspeção (pontos 02 e 03) → mesma planilha (aba Referência, Instruções)
- [ ] Formulário de inspeção Visual (ponto 05)
- [ ] Formulário de inspeção de Lote / Dimensional (ponto 05)
- [ ] Modelo do formulário de RNC (ponto 07)
- [ ] Controle interno de RNC / status (ponto 08)

---

# 📗 ANÁLISE — Planilha 1: "Planejamento de Inspeções - 2º Trimestre"
> 6 abas: Referência · Escopo · Base de Fornecedores · Kanban Semanal · Painel - Resumo · Instruções.
> É a espinha dorsal do processo SQE. Resumo do que ela faz:

### Aba "Referência" → tabela de periodicidade (ver ponto 02, já transcrita)

### Aba "Escopo" → cadastro/escopo de 30 fornecedores
Campos por fornecedor: Cód. · Nome · Tipo Fornecimento · Categoria de Inspeção ·
Plano de Inspeção (resumo) · Controles Principais (texto) · Esforço Qualidade (Baixo/Médio/Alto).
- O "escopo" é descrito em TEXTO (ex: "Visual + Embalagem", "Documentos + Visual + Dimensional
  por amostragem", "Visual + Teste com calibradores", "Conferência de plaqueta + Visual"...).
- **"Lote" ≈ a parte "Dimensional por amostragem"** do plano. "Visual" é quase sempre presente.

### Aba "Base de Fornecedores" → o Kanban de conformidade (dados calculados)
Colunas: # · Fornecedor · **Classif. de Fornecimento** (manual A/B/C/D, base trimestre anterior) ·
Periodicidade (auto) · Tipo Inspeção (auto) · Nível (auto) · NQA (auto) · Freq N (auto) ·
**Lotes Inspecionados** · **Lotes Reprovados** · **% Conformidade** (auto) · **Classif. Atual** (auto).

### Aba "Kanban Semanal" → acompanhamento semana a semana (W14…W27)
Para cada fornecedor, 4 linhas por semana:
🚛 Entrega (houve?) · 🔢 Nº Entrega Acumulado · 🔍 Inspecionar? (auto) · ✅ Insp. Realizada? · ⚠️ RNC?
Cores: laranja = inspeção necessária mas não realizada (pendente); vermelho = RNC na semana.

### Aba "Painel - Resumo" → KPIs consolidados
Total Lotes Inspecionados, Total Reprovados, **% Conformidade Geral do Portfólio**,
contagem de fornecedores por Classe A/B/C/D, e **nº de fornecedores em upgrade/downgrade**
(quando Classif. Atual ≠ Classif. de Fornecimento).

---

# ⭐ CONCEITOS NOVOS DESCOBERTOS (não estavam nos 8 pontos — importantes)

1. **Duas classificações distintas:**
   - **Classif. de Fornecimento** = manual, definida no início do trimestre (base no trimestre
     anterior). **É ela que define a periodicidade/nível/NQA.**
   - **Classif. Atual** = recalculada automaticamente pela % de conformidade do período.
   - Quando as duas divergem → sinaliza **upgrade/downgrade** do fornecedor.

2. **Fórmula oficial de % Conformidade** (é o KPI central do SQE):
   `% Conf = (Lotes Inspecionados − Lotes Reprovados) / Lotes Inspecionados × 100`
   Bandas → **A ≥ 98% · B 90–97,99% · C 80–89,99% · D < 80%**.

3. **A classificação também define o tamanho da amostra:** Reduzida 30% / Normal 50% /
   Intensiva 100%, com NQA 4,0 / 2,5 / 1,0. Isso precisa aparecer na tela de inspeção.

4. **Visão Kanban Semanal** (por semana ISO, W14…W27) — provável tela nova no sistema.

5. **Painel Resumo consolidado** — deve virar (parte do) dashboard: totais, % geral,
   distribuição por classe, upgrades/downgrades.

---

# ❓ DÚVIDAS CONSOLIDADAS (D1–D6 RESPONDIDAS)

- **D1 (classificações):** ✅ SIM. Duas classificações (Fornecimento manual × Atual automática);
  a **periodicidade segue a de Fornecimento** (manual).
- **D2 (contador):** ✅ O contador segue o critério e **ZERA quando dispara a sugestão de
  inspeção** (ex: A = zera na 5ª entrega). PORÉM os **totais acumulados** de "quantas entregas"
  e "quantas inspeções realizadas" devem ser **registrados e mostrados no painel/dashboard**.
  → Modelar: contador cíclico por fornecedor (reseta no gatilho) + contadores históricos
  totais (entregas, inspeções) para o dashboard.
- **D3 (reclassificação):** ✅ SIM. Recalcula a cada **trimestre** e vira a nova "Classif. de
  Fornecimento" do trimestre seguinte.
- **D4 (cadastro):** ✅ CNPJ, endereço e contato = **preenchimento manual** e **NÃO obrigatórios**
  no MVP.
- **D5 (escopo → formulários):** ✅ SIM. Formulários anexados (ver análise da Planilha 2 abaixo):
  **Visual** e **Lote (Dimensional)**.
- **D6 (fidelidade):** ✅ O sistema deve ser **o mais fiel possível à planilha** (lógica E
  layout), para facilitar validação pelos inspetores. Melhorias só depois. Reproduzir Kanban
  Semanal e Painel Resumo. **(princípio-guia de todo o projeto)**
- **D7 (semanas):** _ainda a confirmar — a semana ISO pode ser deduzida da data do recebimento?_

---

# 📗 ANÁLISE — Planilha 2: "Modelo Relatórios de Inspeção"
> Abas: CABEÇALHO · AMOSTRAS · LOTE · VISUAL · RNC.
> **AMOSTRAS = IGNORAR** (é do fluxo SQD, fase futura).

### CABEÇALHO (comum aos formulários de inspeção)
Campos: Nº Item · Descrição do Item · Desenho e Rev. · Tolerâncias/Normas · NF · PO ·
Fornecedor · Código · Quantidade inspecionada · Quantidade total de peças · Rel. Nº · Rev. ·
Elaborado por · Inspecionado por · Data da inspeção.

### Formulário VISUAL — Doc **BDBR.QUA.FMR.06.07** (Rev 07)
- Cabeçalho comum.
- **Origem da Inspeção** (marcar): Plano de Inspeção · Homologação · Devolução · Retrabalho ·
  Relatório de Ocorrência · Outros.
- **CHECKLIST — 12 grupos**, cada item marcado como **Aprovado / Reprovado / Não Aplicável**:
  1. Condições Gerais (2 itens) · 2. Corte (4) · 3. Dobra (3) · 4. Usinagem (3) ·
  5. Solda (6) · 6. Zincagem Eletrolítica (5) · 7. Galvanização a Fogo (5) ·
  8. Pintura Epóxi (6) · 9. Tubos (2) · 10. Injeção (5) · 11. Malha de Arame (4) ·
  12. Condições Finais (3).
  _(itens exatos já extraídos; reproduzir literalmente — princípio D6)_
- **Evidências** (fotos) · **Observações finais** · **Resultado: Aprovado/Reprovado** ·
  Assinaturas (Elaborado por / Inspecionado por / Data).

### Formulário LOTE / DIMENSIONAL — Doc **BDBR.QUA.FMR.011.06** (Rev 06)
- Cabeçalho comum (com Tolerâncias).
- **Origem da Inspeção** (mesmas opções do Visual).
- **Tabela de cotas (linhas dinâmicas):** Localização · Especificado · Tolerância (Upper/Lower) ·
  Encontrado (**Peça 01, Peça 02, Peça 03…**) · Instrumento Utilizado · Desvio (Mín./Máx.).
- **Evidências** · **Observações finais** (ex: "Medidas em milímetro") ·
  **Resultado: Aprovado/Reprovado** · Assinaturas.

### Formulário RNC — Doc **BDBR.QUA.FMR.008.05** (Rev 05)
- Título: Relatório de Não Conformidade / Non Conformance Report.
- **RNC Nº** (formato `{seq}/{aa}`, ex 149/26) · Data de Abertura · Responsável · Setor
  (Qualidade) · Fornecedor · Código · Página.
- Código do Item · Quantidade do Lote · NF · PO · Descrição do Item.
- **Quantidade Afetada** · **Reincidência?** (Sim/Não).
- **Descrição do Desvio** (texto).
- **Disposição** (texto/decisão).
- **Registro Fotográfico (quando necessário)** → é aqui que entram as **até 5 fotos**.

---

# ✅ DÚVIDAS E1–E7 — RESPONDIDAS

- **E1 (checklist Visual):** ✅ mostrar **exatamente como a planilha**, fiel — todos os 12 grupos
  com opção "Não Aplicável".
- **E2 (tabela dimensional):** ✅ seguir **fielmente a planilha de inspeção** (LOTE/Dimensional).
  Colunas Peça 01/02/03… conforme o modelo; cotas digitadas manualmente.
- **E3 (Disposição na RNC — formulário):** ✅ **texto livre**.
  _(Obs: já no controle de RNCs — Planilha 3 — a coluna "Disposição" usa um conjunto fechado:
  Reposição, Retrabalho, Devolução, Aceitar como está, Inspeção, Descarte. Ver análise Planilha 3.)_
- **E4 (Reincidência):** ✅ o sistema **pode sugerir** que determinada peça+fornecedor é
  reincidente (mesma peça/fornecedor com RNC anterior); inspetor confirma.
- **E5 (status da RNC — ponto 08):** ✅ planilha de controle enviada (Planilha 3, aba 2026).
  Ver análise abaixo. Status observados: **Em andamento / Finalizada**.
- **E6 (PDF):** ✅ **visualmente idêntico e fiel** ao modelo.
- **E7 (semana ISO):** ✅ semana é sempre **domingo a sábado** (ex.: 05/07 a 11/07 = **W28**).
  _(Atenção: NÃO é a semana ISO padrão que começa na segunda — implementar semana domingo→sábado.)_

---

# 📗 ANÁLISE — Planilha 3: "Registro de Não Conformidades" (controle interno de RNC)
> Doc **BDBR.QUA.FMR.003.03** (Rev 03, Data Rev. 09/09/2025).
> Abas: 2025 · **2026** (analisar esta) · KPI's · Devoluções <> Compras · Contatos Qualidade.
> Aba 2026 tem **88 RNCs** registradas.

Esta é a planilha-mestre que controla o ciclo de vida da RNC (ponto 08). Os campos abaixo
definem as colunas da **lista/submenu de RNC** e a tela de detalhe/edição de status.

### Colunas (grupos)
**INFORMAÇÕES DO DOCUMENTO:** Nº RNC (`{seq}/{aa}`, ex 001/26) · Data de abertura e envio ·
Solicitante (ex "Qualidade").
**INFORMAÇÕES DO ITEM:** Código · Descrição · Quantidade · PO · Nº NF.
**INFORMAÇÕES DO FORNECEDOR:** Código Forn. · Nome.
**INFORMAÇÕES SOBRE O DESVIO:** Tipo de Desvio (texto livre) · Reincidência? (Sim/Não).
**CUSTOS RNC:** Quantidade (Peças) · Valor Unitário · Valor Total (= Qtd × Unit).
**INFORMAÇÕES SOBRE O PLANO DE AÇÃO:** Disposição · Houve retorno? · Data do retorno ·
Tempo do retorno (dias, = Data retorno − Data abertura) · Fornecedor aceitou a RNC? ·
Fornecedor enviou plano de ação? · Nível do plano de ação · **Status da RNC** ·
Verificação da eficácia · Data da verificação · Evidências · Observações.

### Valores fechados (selects) — extraídos dos dados reais 2026
- **Reincidência?** → Sim / Não
- **Disposição** → Reposição · Retrabalho · Devolução · Aceitar como está · Inspeção · Descarte
- **Houve retorno?** → Sim / Não
- **Fornecedor aceitou a RNC?** → Sim / Não (Ver observações)
- **Fornecedor enviou plano de ação?** → Sim / Não
- **Nível do plano de ação** → Satisfatório · Excelente · Não aplicável
- **Status da RNC** → **Em andamento · Finalizada**
- **Verificação da eficácia** → Aprovado · Reprovado · Pendente · Não aplicável
- **Tipo de Desvio** → texto livre (muita variação: Dimensional, Visual, Oxidação branca,
  Quantidade incorreta, Rebarbas, Embalagem, etc. — combinações separadas por ";" ou "/")

### Campos calculados
- **Valor Total** = Quantidade (Peças) × Valor Unitário
- **Tempo do retorno** = Data do retorno − Data de abertura (em dias)
- **Nº RNC** = sequencial do ano + "/" + ano com 2 dígitos

---

# ✅ DÚVIDAS F1–F4 — RESPONDIDAS

- **F1 (status da RNC):** ✅ **manter fielmente a planilha** → status = **Em andamento / Finalizada**.
- **F2 (custo evitado no dashboard):** ✅ **somar a coluna Valor Total** (Σ Qtd×Unit das RNCs).
- **F3 (auto-preenchimento RNC vinda da inspeção):** ✅ SIM. A RNC aberta no ato do recebimento
  já **cai direto no controle (Planilha 3 / submenu RNC) com os campos preenchidos
  automaticamente** a partir da inspeção/entrega (os que houver): Código/Descrição do item,
  Fornecedor+Código, NF, PO, Quantidade, Tipo de desvio (do que reprovou), Data de abertura,
  Solicitante=Qualidade, Nº RNC sequencial. Os demais (plano de ação, retorno, eficácia) ficam
  em branco para preenchimento durante o acompanhamento.
- **F4 (aba KPI's):** ✅ **STANDBY** — interessante, mas **não agora no MVP**. Retomar em outro
  momento para alinhar o painel gerencial aos indicadores que a Qualidade já acompanha.

---

# ✅ DÚVIDAS G1–G5 — RESPONDIDAS

- **G1 (1 RNC por formulário reprovado):** ✅ SIM. **1 RNC para cada** formulário reprovado
  (Visual reprova → 1 RNC; Lote reprova → 1 RNC; ambos → 2 RNCs).
- **G2 (escopo Visual/Lote no cadastro):** ✅ O escopo está na **Aba "Escopo" da Planilha 1**.
  No cadastro do fornecedor, guardar o **texto do escopo** (referência) + usar a solução
  proposta: **2 checkboxes "Faz inspeção Visual?" / "Faz inspeção de Lote?"** para o sistema
  decidir qual(is) formulário(s) abrir.
- **G3 (reclassificação trimestral):** ✅ **Automática**. Trimestre = **ano fiscal da empresa**
  (começa em **outubro**, encerra em **setembro** do ano seguinte). Ou seja, trimestres fiscais:
  **out–dez · jan–mar · abr–jun · jul–set**. A **% de conformidade zera a cada trimestre** para
  recalcular, MAS o **histórico deve ser mantido** (ver proposta abaixo — G3-armazenamento).
- **G4 (contato do fornecedor):** ✅ **até 2 contatos**, cadastro simples cada um:
  **nome · e-mail · telefone · função**.
- **G5 (amostra na tela de inspeção):** ✅ A tela de inspeção deve **exibir a amostra conforme a
  classificação do fornecedor** seguindo o critério pré-definido (A=Reduzida 30%/NQA 4,0;
  B=Normal 50%/NQA 2,5; C-D=Intensiva 100%/NQA 1,0) e calcular a **qtd de peças a inspecionar**.
- **G5-b (histórico no dashboard):** ✅ CONFIRMADO — incluir no **painel/dashboard uma tabela de
  evolução e histórico dos fornecedores** (classificação por trimestre fiscal, % conformidade,
  upgrades/downgrades). Alimentada pela tabela `HistoricoClassificacao` (proposta G3 confirmada).

### G3 — proposta de armazenamento do histórico de classificação
Criar tabela **`HistoricoClassificacao`** (fornecedorId, trimestreFiscal ex "FY26-Q3",
periodoInicio, periodoFim, classificacaoFornecimento [inicial], lotesInspecionados,
lotesReprovados, pctConformidade, classificacaoApurada [final], createdAt). Ao virar o
trimestre fiscal: (1) fecha o registro do trimestre corrente com os números apurados;
(2) a `classificacaoApurada` vira a `classificacaoFornecimento` do próximo trimestre;
(3) os contadores do período zeram, mas ficam preservados no histórico. Assim o dashboard
mostra a evolução trimestre a trimestre e os upgrades/downgrades. **(confirmar essa modelagem)**

---

# 🎨 DIRETRIZES DE DESIGN (identidade Big Dutchman)

O usuário pediu que toda a aplicação seja construída com **padrão de designer sênior**, usando
a **identidade visual da Big Dutchman** (logo + paleta dos relatórios enviados) e **fontes
profissionais**, com **revisão gramatical geral** de todos os textos do sistema.

- **Logo:** logotipo Big Dutchman (figura do "holandês" + wordmark laranja) no cabeçalho do
  sistema, na tela de login e no cabeçalho dos PDFs (Visual, Lote, RNC).
- **Paleta OFICIAL (extraída da logo `Logo.pptx` → `frontend/public/logo-big-dutchman.png`):**
  - **Laranja Big Dutchman = `#D37119`** (rgb 211,113,25) → **cor primária/ação** (confirmado da logo).
  - **Preto `#000000`** → contorno da logo e texto forte; texto corrido `#1F1F1F`.
  - Cinzas neutros para bordas/fundos (`#F5F5F5`, `#D9D9D9`).
  - Verde/vermelho apenas para status (Aprovado/Reprovado, conforme/não conforme).
  - **TROCAR** o tema atual `#028090` (teal) por **`#D37119`** em todo o AntD ConfigProvider.
- **Logo:** `frontend/public/logo-big-dutchman.png` (679×192, fundo transparente) — usar no
  header, login e cabeçalho dos PDFs.
- **Fontes:** fonte profissional e legível (ex.: Inter / Roboto / Segoe UI) para a interface;
  nos PDFs, fonte que aproxime do modelo oficial.
- **Layout sênior:** hierarquia clara, espaçamento consistente, tabelas limpas (padrão AntD),
  cards de KPI no dashboard, formulários fiéis às planilhas (princípio D6).
- **Revisão gramatical:** varredura em todos os rótulos, títulos, mensagens e botões do sistema
  (PT-BR correto, acentuação, concordância) antes de finalizar.
- **PDFs (Visual/Lote/RNC):** visualmente **idênticos e fiéis** aos modelos oficiais (E6),
  com logo, código do documento no cabeçalho e layout bilíngue quando o modelo tiver.

---

# 🗄️ BACKEND / PERSISTÊNCIA — tudo é salvo no servidor

Nada fica só no navegador. Fluxo: **Tela (React) → HTTP `/api` → Controller (NestJS) → Service →
Prisma → PostgreSQL (volume `postgres_data`)**; arquivos (fotos/PDF) vão para o volume
`uploads_data` em disco e o caminho é registrado na tabela `Anexo`. Dados sobrevivem a
reinício/atualização (volumes Docker).

Backend já existente: fornecedores, itens, usuarios, sqe/planejamento, sqe/entregas,
sqe/inspecoes, sqe/rnc, anexos, historico, dashboard, auth.

**Novo/estendido a criar no comando final (cada tela nova = controller + service + tabela):**
- `Fornecedor` (+ campos novos + 2 contatos + escopo/classificação)
- `Periodicidade` (tabela A/B/C/D editável) — CRUD novo
- Contadores de entrega por fornecedor (cíclico + acumulado) — campos + lógica no service
- `InspecaoVisual` (checklist 12 grupos) — tabela + endpoints novos
- `InspecaoLote` (tabela de cotas/medições) — tabela + endpoints novos
- `Rnc` refatorada (campos planilha 3 + gerador de número `{seq}/{aa}`)
- Fotos RNC (até 5) + PDF gerado → disco (`uploads`) + registro em `Anexo`
- `HistoricoClassificacao` (trimestre fiscal out→set) — tabela + endpoints
- `dashboard` (endpoints estendidos: Painel Resumo, evolução dos fornecedores, custos evitados)

**Ordem de execução:** 1) schema Prisma (todas as tabelas) → 2) services/controllers backend →
3) telas frontend → 4) PDF + design/identidade → 5) rebuild Docker (`docker compose up -d --build`).
