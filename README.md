# Sistema de Qualidade — Big Dutchman Brasil

Aplicação interna que digitaliza o trabalho da área da Qualidade. Roda no
servidor da empresa, na rede local, **sem custo de licença**. Os dados não
saem da fábrica.

## Módulos no ar

| Módulo | O que cobre |
| --- | --- |
| **SQE** | Planejamento de inspeções, entregas, inspeção de recebimento, RNC e indicadores |
| **MANUFATURA** | Inspeção dimensional, controle autônomo, 8D, alerta de qualidade, CNQ/PPM |
| **SQD** | Avaliação e auditoria de fornecedores, homologação de itens |
| **R.O** | Reclamações de campo e custo da não qualidade |

Apoiando todos eles: cadastro de fornecedores e itens, anexos e fotos,
histórico, **IDF** (índice que comanda a amostragem), calendário de feriados,
importação em massa por planilha e controle de acesso por módulo.

---

## Como instalar

### No servidor da fábrica (Windows Server + WSL2) — instalação definitiva

É o caminho suportado. O guia completo para o TI, com os três passos, o
backup e o que fazer quando algo cai, está em:

> **[`deploy-servidor/LEIA-ME.md`](deploy-servidor/LEIA-ME.md)**

Resumo: o TI baixa o `1-preparar-windows.ps1` deste repositório, roda os três
scripts de `deploy-servidor/`, e o próprio instalador traz o código do GitHub
para dentro do servidor. Não é preciso copiar pasta nenhuma.

### Na nuvem (Render + Supabase) — o protótipo de demonstração

O que está no ar hoje para demonstração, e como foi feito, está em
[`DEPLOY.md`](DEPLOY.md). Deploy automático a cada push na `main`.

### Na sua máquina, para desenvolver

```bash
cp .env.example .env     # ajuste POSTGRES_PASSWORD, JWT_SECRET e SEED_ADMIN_*
docker compose up -d --build
```

Depois abra `http://localhost:8080`.

---

## Primeiro acesso

O sistema começa **vazio**, de propósito — não existe usuário de teste nem
cadastro de exemplo.

Quem cria o primeiro e único usuário é o `SEED_ADMIN_EMAIL` /
`SEED_ADMIN_PASSWORD` do `.env`. **O backend se recusa a subir sem eles**, de
modo que nunca existe sistema no ar sem dono. No servidor da fábrica o
instalador sorteia essa senha e a grava em
`C:\QualidadeSQE\PRIMEIRO-ACESSO.txt`.

Com esse usuário você cadastra o pessoal da Qualidade em *Administração →
Colaboradores e Acessos*, e carrega os cadastros reais pela importação de
planilha. Qualquer pessoa troca a própria senha pelo menu do seu nome, no
canto superior direito.

---

## Mapa do repositório — o que é o quê

Tudo o que está aqui está **em uso**. Não há pasta antiga, versão anterior nem
rascunho: o que sai de circulação é apagado e fica no histórico do Git.

| Pasta / arquivo | O que é | Quando você mexe nisso |
|---|---|---|
| `backend/` | NestJS + Prisma + PostgreSQL — as regras de negócio e o banco | ao mudar cálculo, regra ou API |
| `backend/prisma/` | desenho do banco (`schema.prisma`), os DDLs aplicados e o seed do acesso principal | ao mudar uma tabela |
| `frontend/` | React + Ant Design — as telas (`src/pages/`, uma pasta por módulo) | ao mudar tela |
| `deploy-servidor/` | **instalar no servidor da fábrica**, backup e restauração | na instalação e na atualização |
| `scripts/` | `fotografia.js`, a rede de regressão: grava o que as 170 rotas devolvem e confere depois | antes de dizer que uma mudança não quebrou nada |
| `docker-compose.yml` | sobe banco + API + telas num comando só | raramente |
| `.env.example` | modelo de configuração (o `.env` de verdade nunca é versionado) | ao criar um ambiente novo |
| `DEPLOY.md` | como o protótipo em nuvem foi montado (Render + Supabase) | só para a nuvem |
| `PROMPT-MESTRE-SQE.md` | **registro histórico** — fotografia do sistema em 25/07/2026, quando só existia o SQE | nunca; está desatualizado de propósito |

### Os três caminhos — o que pegar em cada um

| Você quer… | Leia só isto |
|---|---|
| **Instalar no servidor da fábrica** | [`deploy-servidor/LEIA-ME.md`](deploy-servidor/LEIA-ME.md) |
| **Entender/mexer no código** | `backend/src/` e `frontend/src/` |
| **Saber como a nuvem foi montada** | [`DEPLOY.md`](DEPLOY.md) |

### Um ramo só

**`main`.** É a versão validada, é de onde o servidor da fábrica baixa e é o
que o Render publica na nuvem. Não existe segundo ramo para conferir nem
escolher.

A versão provada no servidor está marcada como **[`v1.0.0`](../../releases/tag/v1.0.0)**.

O **frontend** (nginx) é a única porta exposta na rede e encaminha `/api` para
o **backend**. O **PostgreSQL** não fica exposto para fora.

---

## Comandos úteis

```bash
docker compose ps              # ver se está tudo rodando
docker compose logs -f         # acompanhar as mensagens do sistema
docker compose down            # parar (sem apagar nada)
docker compose up -d --build   # subir de novo depois de mudar o código
```

Os dados do banco e os anexos ficam em volumes do Docker (`postgres_data` e
`uploads_data`) e sobrevivem ao `down`. **Nunca** use `docker compose down -v`
num servidor com dados: o `-v` apaga esses volumes.

---

## Duas coisas que não parecem importantes e são

**A ordenação do banco.** A imagem do PostgreSQL e o idioma de criação do
banco estão fixados no `docker-compose.yml` (provedor **ICU**, `en-US`) para
serem idênticos aos da nuvem onde o sistema foi validado. Ordenação diferente
não dá erro: dá lista fora de ordem, e passa despercebido. A variante
`-alpine` é proibida por isso.

**Datas.** Data pura é gravada à meia-noite UTC e lida em UTC; já o "hoje"
sai do relógio local. Misturar os dois faz a data pular um dia.

---

## Segurança

Feito para a **rede interna**, por IP — sem domínio nem HTTPS nesta versão.
O `.env` nunca é versionado: ele guarda as senhas do banco e a chave que
assina o login. No servidor ele é gerado na instalação, com senhas sorteadas,
e fica legível só para o root.
