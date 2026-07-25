# PROMPT-MESTRE — Sistema de Qualidade Big Dutchman Brasil (Módulo SQE)

> Este documento é um **prompt de reprodução fiel**. Entregue-o a uma IA de código (ou a um dev) e a aplicação deve sair **idêntica** à original: mesma stack, mesmo modelo de dados, mesmos endpoints, mesmas telas, mesmas cores, mesmo layout, mesmas regras de negócio. Onde houver código literal (schema, tema, checklist, seed, fórmulas), **copie exatamente, sem alterar uma vírgula**. Escopo deste prompt: **aplicação (banco, telas, links, imagens) + design (frontend)**. Deploy/servidor está fora deste documento.
>
> **IMPORTANTE — fonte da verdade:** as seções §0–§11 abaixo descrevem e explicam o sistema; o **ANEXO A** (ao final) contém **todos os arquivos-fonte reais, verbatim**. Para reproduzir o sistema idêntico, recrie cada arquivo do Anexo A com seu conteúdo exato. Em qualquer divergência entre a descrição e o Anexo A, **o Anexo A prevalece** (é o código real que roda).

---

## 0. Objetivo do sistema

Sistema web interno da **Big Dutchman Brasil** para a área de **Qualidade**, começando pelo módulo **SQE (Supplier Quality Engineering / Qualidade de Fornecedores no recebimento)**. O sistema controla:

- Cadastro de **fornecedores** (com escopo, classificação A/B/C/D, contatos).
- **Periodicidade de inspeção** por classificação (parâmetros editáveis).
- **Inspeções de recebimento**: formulário **Visual** (checklist de 12 grupos) e **Lote/Dimensional** (tabela de cotas), com decisão automática se a carga deve ou não ser inspecionada (contador cíclico por periodicidade).
- **RNC** (Registro de Não Conformidade): abertura manual ou automática quando uma inspeção reprova; plano de ação, custos, verificação de eficácia, histórico de status, anexos de fotos e **exportação em PDF** bilíngue.
- **Painel/Dashboard** com KPIs de qualidade de fornecedores, evolução de classificação e fechamento de trimestre fiscal.

Idioma da interface: **português do Brasil**. Moeda: **R$ (pt-BR)**. Datas: **DD/MM/YYYY**.

Menu lateral organizado em 3 grupos: **QUALIDADE - SQE** (implementado), **QUALIDADE - MANUFATURA** e **QUALIDADE - SQD** (ambos apenas "EM DESENVOLVIMENTO", desabilitados).

---

## 1. Stack e versões exatas

### Backend (`/backend`)
- **NestJS 10** (`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express` ^10.4.4)
- **Prisma 5.20** (`@prisma/client` + `prisma` ^5.20.0), provider **PostgreSQL**
- **Auth**: `@nestjs/jwt` ^10.2.0, `@nestjs/passport` ^10.0.3, `passport` ^0.7.0, `passport-jwt` ^4.0.1, `bcryptjs` ^2.4.3
- **Validação**: `class-validator` ^0.14.1, `class-transformer` ^0.5.1
- **Upload**: `multer` ^1.4.5-lts.1
- **PDF**: `pdfkit` ^0.15.0
- **Servir frontend estático (opcional)**: `@nestjs/serve-static` ^4.0.2
- `@nestjs/config` ^3.2.3, `reflect-metadata` ^0.2.2, `rxjs` ^7.8.1
- Dev: `@nestjs/cli` ^10.4.5, `ts-node` ^10.9.2, `typescript` ^5.6.2, `@types/node` ^20.16.10
- Prefixo global de API: **`/api`**. Porta default **3000** (via `process.env.PORT`), bind `0.0.0.0`.

### Frontend (`/frontend`)
- **React 18.3** + **React DOM 18.3**
- **Vite 5.4** (`@vitejs/plugin-react` ^4.3.2)
- **Ant Design 5.21** (`antd`) + **`@ant-design/icons` ^5.5.1**
- **@tanstack/react-query 5.59** (data fetching/cache)
- **react-router-dom 6.26**
- **axios 1.7**
- **dayjs 1.11** (locale pt-br)
- TypeScript ^5.6.2
- Porta dev Vite **5173**, com proxy `/api` → `http://localhost:3000`.

### Infra de desenvolvimento
- **PostgreSQL 16**. Docker Compose opcional para dev (Postgres + backend + frontend/nginx). O backend também pode servir o frontend compilado numa única porta via `ServeStaticModule` quando existir a pasta `public`.

---

## 2. Estrutura de pastas

```
/backend
  /prisma
    schema.prisma
    seed.ts
  /src
    main.ts
    app.module.ts
    /prisma            prisma.module.ts, prisma.service.ts
    /auth              auth.module.ts, auth.controller.ts, auth.service.ts,
                       jwt.strategy.ts, jwt-auth.guard.ts, roles.guard.ts,
                       roles.decorator.ts, current-user.decorator.ts
    /usuarios          usuarios.module.ts, usuarios.controller.ts, usuarios.service.ts
    /fornecedores      fornecedores.module.ts, fornecedores.controller.ts
    /itens             itens.module.ts, itens.controller.ts
    /periodicidade     periodicidade.module.ts, periodicidade.controller.ts
    /anexos            anexos.module.ts, anexos.controller.ts
    /historico         historico.module.ts, historico.controller.ts, historico.service.ts
    /dashboard         dashboard.module.ts, dashboard.controller.ts, dashboard.service.ts
    /sqe
      sqe-utils.ts
      /planejamento    planejamento.module.ts, planejamento.controller.ts
      /entregas        entregas.module.ts, entregas.controller.ts
      /inspecoes       inspecoes.module.ts, inspecoes.controller.ts, inspecoes.service.ts
      /rnc             rnc.module.ts, rnc.controller.ts, rnc.service.ts, rnc-pdf.ts
  /assets/logo-big-dutchman.png    (usado no PDF)
  package.json, tsconfig.json, nest-cli.json

/frontend
  index.html
  vite.config.ts
  /public/logo-big-dutchman.png
  /src
    main.tsx           (bootstrap + tema Ant Design + providers)
    App.tsx            (rotas)
    api.ts             (axios + interceptors + download blob)
    auth.tsx           (AuthProvider/useAuth)
    hooks.ts           (useFornecedores, useItens, opções)
    semana.ts          (cálculo de semana W##)
    /components
      AppLayout.tsx    (sider + header + menu)
      AuthImage.tsx    (imagem protegida por JWT)
    /pages
      Login.tsx
      Dashboard.tsx
      Fornecedores.tsx
      Periodicidade.tsx
      Inspecoes.tsx
      RncLista.tsx
      RncDetalhe.tsx
  package.json, tsconfig.json
```

> Existem no repositório original alguns arquivos de página **não roteados** (`Entregas.tsx`, `Itens.tsx`, `Kanban.tsx`, `Planejamento.tsx`) e os módulos backend `planejamento` e `entregas`. **A aplicação em uso NÃO os roteia no menu.** Os endpoints de planejamento/entregas existem no backend, mas o fluxo real de recebimento é feito pela tela **Inspeções** (que cria a `EntregaPortaria` internamente). Reproduza os endpoints, mas **as telas ativas são apenas as 6 roteadas** (ver §8).

---

## 3. Variáveis de ambiente (`.env`)

```
APP_PORT=8080                 # porta pública na rede local (deploy)
PORT=3000                     # porta do backend Nest (dev)
DATABASE_URL=postgresql://qualidade:senha@localhost:5432/qualidade?schema=public
POSTGRES_USER=qualidade
POSTGRES_PASSWORD=troque-esta-senha
POSTGRES_DB=qualidade
JWT_SECRET=troque-esta-chave-secreta-por-um-texto-longo-e-aleatorio
# opcionais:
FRONTEND_DIR=<pasta com o build do frontend>   # ativa ServeStaticModule se existir
UPLOAD_DIR=<pasta de uploads>                   # default: <cwd>/uploads
```

- JWT expira em **12h**. Segredo default de dev: `'dev-secret-trocar-em-producao'`.
- CORS liberado (`origin: true, credentials: true`).
- `ValidationPipe` global: `{ whitelist: true, transform: true, forbidNonWhitelisted: false }`.

---

## 4. Modelo de dados — Prisma schema (COPIAR LITERAL)

Provider `postgresql`, generator `prisma-client-js`. Núcleo compartilhado + módulo SQE.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ---------------------- NUCLEO ----------------------

enum Papel {
  QUALIDADE
  PRODUCAO
  ADMIN
}

model Usuario {
  id        Int      @id @default(autoincrement())
  nome      String
  email     String   @unique
  senhaHash String
  papel     Papel    @default(QUALIDADE)
  ativo     Boolean  @default(true)
  createdAt DateTime @default(now())

  planejamentos   PlanejamentoSemanal[] @relation("PlanejamentoCriadoPor")
  entregas        EntregaPortaria[]     @relation("EntregaConfirmadoPor")
  inspecoesVisual InspecaoVisual[]      @relation("InspVisualInspetor")
  inspecoesLote   InspecaoLote[]        @relation("InspLoteInspetor")
  rncs            Rnc[]                 @relation("RncCriadoPor")
  anexos          Anexo[]
  historicos      HistoricoStatus[]
}

enum Classificacao {
  A
  B
  C
  D
}

enum EsforcoQualidade {
  BAIXO
  MEDIO
  ALTO
}

model Fornecedor {
  id     Int    @id @default(autoincrement())
  codigo String @unique
  nome   String
  cnpj   String?

  endereco String?

  tipoFornecimento    String?
  categoriaInspecao   String?
  planoInspecao       String?
  controlesPrincipais String?
  escopoTexto         String?
  esforcoQualidade    EsforcoQualidade @default(MEDIO)

  classificacaoFornecimento Classificacao @default(C)
  fazVisual Boolean @default(true)
  fazLote   Boolean @default(false)

  contadorEntregas    Int @default(0)   // ciclico: zera quando dispara inspecao
  totalEntregas       Int @default(0)   // acumulado historico
  totalInspecoes      Int @default(0)   // acumulado historico
  lotesInspecionados  Int @default(0)   // trimestre corrente
  lotesReprovados     Int @default(0)   // trimestre corrente

  ativo     Boolean  @default(true)
  createdAt DateTime @default(now())

  contatos         Contato[]
  itens            Item[]
  planejamentos    PlanejamentoSemanal[]
  entregas         EntregaPortaria[]
  inspecoesVisual  InspecaoVisual[]
  inspecoesLote    InspecaoLote[]
  rncs             Rnc[]
  historicoClasses HistoricoClassificacao[]
}

model Contato {
  id           Int        @id @default(autoincrement())
  fornecedorId Int
  fornecedor   Fornecedor @relation(fields: [fornecedorId], references: [id], onDelete: Cascade)
  nome         String
  email        String?
  telefone     String?
  funcao       String?

  @@index([fornecedorId])
}

model Item {
  id           Int         @id @default(autoincrement())
  codigo       String      @unique
  descricao    String
  unidade      String?
  fornecedorId Int?
  fornecedor   Fornecedor? @relation(fields: [fornecedorId], references: [id])
  createdAt    DateTime    @default(now())

  planejamentos   PlanejamentoSemanal[]
  entregas        EntregaPortaria[]
  inspecoesVisual InspecaoVisual[]
  inspecoesLote   InspecaoLote[]
  rncs            Rnc[]
}

model PeriodicidadeConfig {
  id                 Int           @id @default(autoincrement())
  classificacao      Classificacao @unique
  periodicidadeTexto String
  frequenciaN        Int
  tipoInspecao       String        @default("Amostragem")
  nivelInspecaoTexto String
  nivelRomano        String
  percentualAmostra  Int
  nqa                Float
  conformidadeMin    Float
  updatedAt          DateTime      @updatedAt
}

model Anexo {
  id           Int      @id @default(autoincrement())
  entidadeTipo String
  entidadeId   Int
  nomeArquivo  String
  caminho      String
  mimeType     String?
  tamanho      Int?
  uploadedById Int?
  uploadedBy   Usuario? @relation(fields: [uploadedById], references: [id])
  createdAt    DateTime @default(now())

  @@index([entidadeTipo, entidadeId])
}

model HistoricoStatus {
  id             Int      @id @default(autoincrement())
  entidadeTipo   String
  entidadeId     Int
  statusAnterior String?
  statusNovo     String
  comentario     String?
  usuarioId      Int?
  usuario        Usuario? @relation(fields: [usuarioId], references: [id])
  createdAt      DateTime @default(now())

  @@index([entidadeTipo, entidadeId])
}

model HistoricoClassificacao {
  id                   Int           @id @default(autoincrement())
  fornecedorId         Int
  fornecedor           Fornecedor    @relation(fields: [fornecedorId], references: [id])
  trimestreFiscal      String
  periodoInicio        DateTime
  periodoFim           DateTime
  classificacaoInicial Classificacao
  lotesInspecionados   Int
  lotesReprovados      Int
  pctConformidade      Float
  classificacaoApurada Classificacao
  createdAt            DateTime      @default(now())

  @@index([fornecedorId])
}

// ---------------------- MODULO SQE ----------------------

enum StatusPlanejamento {
  PENDENTE
  ENTREGUE
}

model PlanejamentoSemanal {
  id               Int                @id @default(autoincrement())
  semanaReferencia String
  fornecedorId     Int
  fornecedor       Fornecedor         @relation(fields: [fornecedorId], references: [id])
  itemId           Int?
  item             Item?              @relation(fields: [itemId], references: [id])
  dataPrevista     DateTime?
  status           StatusPlanejamento @default(PENDENTE)
  criadoPorId      Int?
  criadoPor        Usuario?           @relation("PlanejamentoCriadoPor", fields: [criadoPorId], references: [id])
  createdAt        DateTime           @default(now())

  entregas EntregaPortaria[]
}

model EntregaPortaria {
  id                     Int                  @id @default(autoincrement())
  planejamentoId         Int?
  planejamento           PlanejamentoSemanal? @relation(fields: [planejamentoId], references: [id])
  fornecedorId           Int
  fornecedor             Fornecedor           @relation(fields: [fornecedorId], references: [id])
  itemId                 Int?
  item                   Item?                @relation(fields: [itemId], references: [id])
  dataEntrega            DateTime             @default(now())
  semanaReferencia       String?
  semana                 String?
  ano                    Int?
  notaFiscal             String?
  po                     String?
  quantidade             Float?
  numeroEntregaAcumulado Int?
  passivelInspecao       Boolean              @default(false)
  confirmadoPorId        Int?
  confirmadoPor          Usuario?             @relation("EntregaConfirmadoPor", fields: [confirmadoPorId], references: [id])
  createdAt              DateTime             @default(now())

  inspecoesVisual InspecaoVisual[]
  inspecoesLote   InspecaoLote[]
}

enum ResultadoInspecao {
  APROVADO
  REPROVADO
}

enum OrigemInspecao {
  PLANO_INSPECAO
  HOMOLOGACAO
  DEVOLUCAO
  RETRABALHO
  RELATORIO_OCORRENCIA
  OUTROS
}

model InspecaoVisual {
  id           Int              @id @default(autoincrement())
  entregaId    Int?
  entrega      EntregaPortaria? @relation(fields: [entregaId], references: [id])
  fornecedorId Int
  fornecedor   Fornecedor       @relation(fields: [fornecedorId], references: [id])
  itemId       Int
  item         Item             @relation(fields: [itemId], references: [id])

  desenhoRev      String?
  toleranciasNorm String?
  notaFiscal      String?
  po              String?
  qtdInspecionada Float?
  qtdTotal        Float?
  relatorioNumero String?
  origem          OrigemInspecao @default(PLANO_INSPECAO)

  checklist Json           // [{ grupo, itens: [{ texto, status }] }]

  observacoes  String?
  resultado    ResultadoInspecao @default(APROVADO)
  dataInspecao DateTime          @default(now())
  semana       String?
  ano          Int?
  inspetorId   Int?
  inspetor     Usuario?          @relation("InspVisualInspetor", fields: [inspetorId], references: [id])
  createdAt    DateTime          @default(now())

  rncs Rnc[]
}

model InspecaoLote {
  id           Int              @id @default(autoincrement())
  entregaId    Int?
  entrega      EntregaPortaria? @relation(fields: [entregaId], references: [id])
  fornecedorId Int
  fornecedor   Fornecedor       @relation(fields: [fornecedorId], references: [id])
  itemId       Int
  item         Item             @relation(fields: [itemId], references: [id])

  desenhoRev      String?
  toleranciasNorm String?
  notaFiscal      String?
  po              String?
  qtdInspecionada Float?
  qtdTotal        Float?
  relatorioNumero String?
  origem          OrigemInspecao @default(PLANO_INSPECAO)

  cotas Json           // [{ localizacao, especificado, tolUpper, tolLower, medido, instrumento, conforme }]

  observacoes  String?
  resultado    ResultadoInspecao @default(APROVADO)
  dataInspecao DateTime          @default(now())
  semana       String?
  ano          Int?
  inspetorId   Int?
  inspetor     Usuario?          @relation("InspLoteInspetor", fields: [inspetorId], references: [id])
  createdAt    DateTime          @default(now())

  rncs Rnc[]
}

enum StatusRnc {
  EM_ANDAMENTO
  FINALIZADA
  CANCELADA
}

enum VerificacaoEficacia {
  PENDENTE
  APROVADO
  REPROVADO
  NAO_APLICAVEL
}

enum NivelPlano {
  SATISFATORIO
  EXCELENTE
  NAO_APLICAVEL
}

model Rnc {
  id         Int    @id @default(autoincrement())
  numero     String @unique   // {seq3}/{aa} ex: 149/26
  ano        Int
  sequencial Int

  inspecaoVisualId Int?
  inspecaoVisual   InspecaoVisual? @relation(fields: [inspecaoVisualId], references: [id])
  inspecaoLoteId   Int?
  inspecaoLote     InspecaoLote?   @relation(fields: [inspecaoLoteId], references: [id])

  dataAbertura DateTime @default(now())
  semana       String?
  solicitante  String   @default("Qualidade")

  itemId         Int
  item           Item       @relation(fields: [itemId], references: [id])
  quantidadeLote Float?
  po             String?
  notaFiscal     String?

  fornecedorId Int
  fornecedor   Fornecedor @relation(fields: [fornecedorId], references: [id])

  tipoDesvio      String
  reincidencia    Boolean @default(false)
  descricaoDesvio String

  quantidadePecas Float?
  valorUnitario   Float?
  valorTotal      Float?

  disposicao            String?
  houveRetorno          Boolean?
  dataRetorno           DateTime?
  tempoRetornoDias      Int?
  fornecedorAceitou     String?
  fornecedorEnviouPlano Boolean?
  nivelPlano            NivelPlano?
  status                StatusRnc @default(EM_ANDAMENTO)
  motivoCancelamento    String?
  verificacaoEficacia   VerificacaoEficacia @default(PENDENTE)
  dataVerificacao       DateTime?

  evidencias  String?
  observacoes String?

  criadoPorId Int?
  criadoPor   Usuario? @relation("RncCriadoPor", fields: [criadoPorId], references: [id])
  createdAt   DateTime @default(now())

  @@unique([ano, sequencial])
}
```

---

## 5. Regras de negócio (o "cérebro" do SQE) — `sqe-utils.ts` (COPIAR LITERAL)

### 5.1 Semana (domingo→sábado) e ano
Semana no formato `"YYYY-Www"` (referência) e `"W##"` + ano (exibição), contando de **domingo a sábado**:

```ts
export function semanaReferencia(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const year = date.getUTCFullYear();
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const dayOfYear = Math.floor((date.getTime() - jan1.getTime()) / 86400000);
  const week = Math.floor((dayOfYear + jan1.getUTCDay()) / 7) + 1;
  return `${year}-W${String(week).padStart(2, '0')}`;
}
export function semanaAno(d: Date): { semana: string; ano: number } {
  const ref = semanaReferencia(d);
  const [ano, semana] = ref.split('-');
  return { semana, ano: Number(ano) };
}
```
(O frontend replica `semanaAno` em `semana.ts`, retornando `{ semana: "W##", ano }`.)

### 5.2 Trimestre fiscal (ano fiscal começa em OUTUBRO)
Out–Dez = Q1, Jan–Mar = Q2, Abr–Jun = Q3, Jul–Set = Q4. Label `FYyy-Qn` (ex.: `FY26-Q3`). O ano fiscal `fy` é o ano do fim (setembro). Início = dia 1 do mês inicial; fim = último dia do trimestre 23:59:59. (Reproduza a função `trimestreFiscal` exatamente com essa lógica de meses.)

### 5.3 Conformidade e reclassificação
```ts
// % conformidade = (inspecionados - reprovados) / inspecionados * 100, 1 casa
pctConformidade(insp, reprov) = insp ? round(((insp-reprov)/insp)*1000)/10 : 0
// bandas: A>=98, B>=90, C>=80, D<80
classificarPorConformidade(pct): 'A'|'B'|'C'|'D'
```

### 5.4 Checklist Visual padrão — 12 grupos (Doc **BDBR.QUA.FMR.06.07**) (COPIAR LITERAL)
`CHECKLIST_VISUAL_PADRAO` = lista de 12 grupos; cada item inicia com status `'NAO_APLICAVEL'`. `checklistVisualInicial()` mapeia para `[{ grupo, itens: [{ texto, status }] }]`.

```
1. Condicoes Gerais: Identificacao do material conforme documentacao; Embalagem adequada e sem avarias
2. Corte: Dimensoes de corte conforme desenho; Ausencia de rebarbas; Esquadro/alinhamento; Acabamento das bordas
3. Dobra: Angulo de dobra conforme especificacao; Ausencia de trincas na dobra; Raio de dobra adequado
4. Usinagem: Furacao conforme desenho; Roscas conformes; Acabamento superficial
5. Solda: Cordao de solda continuo; Ausencia de porosidade; Ausencia de respingos; Penetracao adequada; Alinhamento das pecas soldadas; Ausencia de trincas
6. Zincagem Eletrolitica: Uniformidade da camada; Ausencia de oxidacao; Aderencia do revestimento; Aspecto visual; Ausencia de bolhas/descascamento
7. Galvanizacao a Fogo: Uniformidade da camada; Ausencia de escorrimento excessivo; Aderencia; Ausencia de falhas de revestimento; Aspecto visual
8. Pintura Epoxi: Cor conforme especificacao; Uniformidade da pintura; Aderencia; Ausencia de escorrimento; Ausencia de falhas/riscos; Espessura adequada
9. Tubos: Diametro conforme especificacao; Ausencia de amassamento
10. Injecao: Ausencia de rebarbas; Ausencia de bolhas/chupados; Cor conforme padrao; Dimensional conforme desenho; Acabamento superficial
11. Malha de Arame: Abertura da malha conforme especificacao; Soldas dos pontos de cruzamento; Ausencia de oxidacao; Acabamento das pontas
12. Condicoes Finais: Quantidade conforme nota fiscal; Identificacao/etiquetagem final; Embalagem para expedicao
```
(Textos sem acento, exatamente como acima — fidelidade à planilha.)

### 5.5 Contador cíclico de periodicidade (decisão de inspecionar)
Cada fornecedor tem `contadorEntregas` (cíclico) e `frequenciaN` vindo da `PeriodicidadeConfig` da sua classificação.
- `avaliarRecebimento(fornecedorId)`: `proximoContador = contadorEntregas + 1`; **`precisaInspecionar = proximoContador >= frequenciaN`**. Retorna fornecedor (id, nome, codigo, classificação, fazVisual, fazLote), a config de periodicidade, `frequenciaN`, `contadorAtual`, `proximoContador`, `precisaInspecionar`.
- Quando **não precisa inspecionar** (`registrarRecebimento`): cria `EntregaPortaria` com semana/ano, `numeroEntregaAcumulado=novoContador`, `passivelInspecao`; incrementa `totalEntregas`; `contadorEntregas = passivelInspecao ? 0 : novoContador`.
- Quando **inspeciona** (`criarVisual`/`criarLote`): cria (ou reaproveita, no encadeamento) a `EntregaPortaria`, cria a inspeção, e `atualizarContadores`: `totalEntregas +1`, `totalInspecoes +1`, `lotesInspecionados +1`, `lotesReprovados +1` (se reprovado), **`contadorEntregas = 0`**.

### 5.6 Escopo e encadeamento Visual → Lote
- `fazVisual`/`fazLote` do fornecedor definem a sequência de etapas. Ordem fixa: **Visual → Lote**. Se não faz nenhum, faz Visual.
- Um único recebimento (1 `EntregaPortaria`) pode ter Visual **e** Lote: a entrega é criada no Visual e **reaproveitada** no Lote (`entregaId` passado adiante). No Lote encadeado (`encadeadoAposVisual=true`), o backend **só** incrementa `lotesInspecionados`/`lotesReprovados` (a entrega/inspeção já foram contadas no Visual).

### 5.7 Resultado automático
- **Visual**: `REPROVADO` se qualquer item do checklist tiver `status === 'REPROVADO'`, senão `APROVADO`.
- **Lote**: `REPROVADO` se qualquer cota tiver `conforme === false`, senão `APROVADO`.
- Reprovado → abre **RNC automática** vinculada à inspeção. No Visual, o `tipoDesvio` lista os itens reprovados (`Visual: <itens>`); no Lote, `tipoDesvio = 'Dimensional'`.

### 5.8 RNC
- Numeração: **`{sequencial:3dígitos}/{aa}`** (ex.: `001/26`), sequencial **por ano** (`@@unique([ano, sequencial])`).
- `valorTotal = quantidadePecas * valorUnitario` (quando ambos presentes).
- `reincidencia` sugerida automaticamente se já existe RNC do mesmo fornecedor+item.
- `tempoRetornoDias = round((dataRetorno - dataAbertura)/dia)`.
- Toda mudança de status grava em `HistoricoStatus` (entidadeTipo `"RNC"`).
- **Cancelar** exige `motivo` (obrigatório), grava `motivoCancelamento`, status `CANCELADA`. **Reabrir** volta para `EM_ANDAMENTO` e limpa `motivoCancelamento`. **Excluir** (só ADMIN) remove anexos + histórico + a RNC.
- RNCs **canceladas saem dos KPIs**.

### 5.9 KPIs (dashboard) — universo = todas as cargas recebidas (`EntregaPortaria`)
Filtro opcional por período (`de`/`ate` sobre `dataEntrega`; RNC sobre `dataAbertura`). `pct(parte,total)= total? round(parte/total*1000)/10 : 0`.
- **pctFornecedoresInspecionados** = fornecedores distintos inspecionados / fornecedores distintos recebidos.
- **pctItensInspecionados** = itens distintos inspecionados / itens distintos recebidos.
- **pctAprovacaoRecebimento** = (totalCargas − cargasReprovadas) / totalCargas (carga não inspecionada conta como aceita).
- **pctRespostaRnc** = RNCs com `houveRetorno===true` / total RNC (não canceladas).
- **pctEficaciaResposta** e **pctEficaciaEncerramento** = RNCs finalizadas com `verificacaoEficacia==='APROVADO'` / RNCs finalizadas.
- **tempoMedioRespostaRncDias** = média de `tempoRetornoDias` (1 casa).
- **custosEvitadosReais** = soma de `valorTotal` das RNCs (não canceladas), 2 casas.
- **contadores**: entregas (=totalCargas), inspecoes (cargas inspecionadas), recebimentosSemInspecao, rncsTotal, rncsAbertas (EM_ANDAMENTO), rncsEncerradas (FINALIZADA).
- **evolucaoFornecedores**: por fornecedor ativo, calcula conformidade e classificação apurada; `tendencia` UPGRADE/DOWNGRADE/IGUAL comparando ordem {A:1,B:2,C:3,D:4} apurada vs. atual.
- **fecharTrimestre**: cria snapshot em `HistoricoClassificacao` (label do trimestre fiscal), atualiza `classificacaoFornecimento = apurada`, **zera** `lotesInspecionados` e `lotesReprovados`. Retorna `{ trimestre, fornecedoresProcessados }`.

---

## 6. Backend — Auth, guards e endpoints

### 6.1 Autenticação e papéis
- **Papéis**: `QUALIDADE`, `PRODUCAO`, `ADMIN`.
- Login com **bcrypt** (`bcrypt.compare`), rejeita usuário inativo. Retorna:
  ```json
  { "access_token": "<jwt 12h>", "usuario": { "id", "nome", "email", "papel" } }
  ```
  Payload JWT: `{ sub, email, nome, papel }`. Secret `process.env.JWT_SECRET || 'dev-secret-trocar-em-producao'`.
- `JwtStrategy` (passport-jwt, Bearer) → `req.user = { id, email, nome, papel }`.
- `@CurrentUser()` injeta `AuthUser`. `JwtAuthGuard = AuthGuard('jwt')`.
- `RolesGuard` + `@Roles(...)` (metadata `'roles'`): sem roles → libera; com roles → exige `user.papel` na lista.

### 6.2 Endpoints (todos sob prefixo `/api`)

**Auth** (`/auth`)
- `POST /auth/login` `{ email, senha(min3) }` → token+usuario. **Público.**
- `GET /auth/me` (JWT) → usuário atual.

**Usuários** (`/usuarios`) — **todo o controller exige `@Roles('ADMIN')`** + JWT
- `GET /usuarios` → lista sem senha (id, nome, email, papel, ativo, createdAt), ordenada por nome.
- `POST /usuarios` `{ nome, email, senha(min4), papel? }` (default QUALIDADE, bcrypt hash).
- `PATCH /usuarios/:id` `{ nome?, email?, senha?(min4), papel?, ativo? }`.

**Fornecedores** (`/fornecedores`) — JWT + RolesGuard
- `GET /fornecedores` → todos, ordenados por nome, com `contatos`. (Só JWT.)
- `GET /fornecedores/:id` → um, com contatos.
- `POST /fornecedores` (`QUALIDADE`,`ADMIN`) — DTO abaixo; cria com defaults (esforço MEDIO, classificação C, fazVisual true, fazLote false), contatos `create` (máx 2).
- `PATCH /fornecedores/:id` (`QUALIDADE`,`ADMIN`) — se `contatos` enviado, apaga os antigos e recria (máx 2).
  - DTO Fornecedor (todos opcionais): `codigo, nome, cnpj, endereco, tipoFornecimento, categoriaInspecao, planoInspecao, controlesPrincipais, escopoTexto, esforcoQualidade('BAIXO'|'MEDIO'|'ALTO'), classificacaoFornecimento('A'|'B'|'C'|'D'), fazVisual, fazLote, ativo, contatos[{ nome, email?, telefone?, funcao? }]`.

**Itens** (`/itens`) — JWT + RolesGuard
- `GET /itens?fornecedorId=` → itens (com fornecedor id/nome), ordenados por descrição.
- `POST /itens` (`QUALIDADE`,`ADMIN`) `{ codigo, descricao, unidade?, fornecedorId? }`.
- `PATCH /itens/:id` (`QUALIDADE`,`ADMIN`).

**Periodicidade** (`/periodicidade`) — JWT + RolesGuard
- `GET /periodicidade` → 4 registros (A,B,C,D) ordenados por classificação.
- `PATCH /periodicidade/:classificacao` (`QUALIDADE`,`ADMIN`) `{ periodicidadeTexto?, frequenciaN?, tipoInspecao?, nivelInspecaoTexto?, nivelRomano?, percentualAmostra?, nqa?, conformidadeMin? }`.

**Inspeções** (`/inspecoes`) — JWT + RolesGuard
- `GET /inspecoes/template-visual` → checklist inicial (12 grupos).
- `GET /inspecoes?fornecedorId=` → **lista unificada** Visual + Lote + **recebimentos sem inspeção** (entregas sem nenhuma inspeção), cada linha com `tipoFormulario` ∈ `VISUAL|LOTE|RECEBIMENTO`; recebimento tem `resultado:'SEM_INSPECAO'`, `dataInspecao=dataEntrega`, `rncs:[]`. Ordenada por `createdAt` desc.
- `GET /inspecoes/avaliar?fornecedorId=` → decisão de inspecionar (§5.5).
- `POST /inspecoes/recebimento` (`QUALIDADE`,`ADMIN`) `{ fornecedorId, itemId?, dataEntrega?, notaFiscal?, po?, qtdTotal? }` → registra recebimento sem inspeção.
- `GET /inspecoes/visual/:id` / `GET /inspecoes/lote/:id` → detalhe (com `tipoFormulario`).
- `POST /inspecoes/visual` (`QUALIDADE`,`ADMIN`) — DTO cabeçalho + `checklist[]`.
- `POST /inspecoes/lote` (`QUALIDADE`,`ADMIN`) — DTO cabeçalho + `cotas[]` + `encadeadoAposVisual?`.
  - Retorno de ambos: `{ inspecao, rnc|null }`.
  - DTO cabeçalho: `entregaId?, fornecedorId(int, obrigatório), itemId?, itemCodigo?, itemDescricao?, desenhoRev?, toleranciasNorm?, notaFiscal?, po?, qtdInspecionada?, qtdTotal?, relatorioNumero?, origem?(enum OrigemInspecao), observacoes?, resultado?('APROVADO'|'REPROVADO'), dataInspecao?, disposicao?`.
  - Resolução de item: usa `itemId`; senão acha/cria por `itemCodigo`; senão por `itemDescricao`(+fornecedor); senão cria `AUTO-<timestamp>` "Item nao especificado".
- `DELETE /inspecoes/visual/:id` e `DELETE /inspecoes/lote/:id` (**`ADMIN`**) `?cascade=true`. Se houver RNC vinculada e `cascade!=true` → **409** com `{ message, rncs:[{id,numero}] }`. Ao excluir, **reverte contadores** do fornecedor e remove a `EntregaPortaria` se ela ficou sem inspeções.

**RNC** (`/rnc`) — JWT + RolesGuard
- `GET /rnc?status=&fornecedorId=&de=&ate=` → lista (include fornecedor, item, inspeções, criadoPor), ordenada por `dataAbertura` desc.
- `GET /rnc/reincidencia?fornecedorId=&itemId=` → `{ reincidencia: boolean }`.
- `GET /rnc/:id` → RNC + `historico` + `anexos`.
- `GET /rnc/:id/pdf` → PDF inline (nome `RNC-<num com - >.pdf`), inclui fotos anexadas (image/*).
- `POST /rnc` (`QUALIDADE`,`ADMIN`) — DTO create (`descricaoDesvio` obrigatório; demais opcionais).
- `PATCH /rnc/:id` (`QUALIDADE`,`ADMIN`) — DTO atualizar (plano de ação, custos, status, eficácia, etc.).
- `PATCH /rnc/:id/status` (`QUALIDADE`,`ADMIN`) `{ status, comentario? }`.
- `PATCH /rnc/:id/cancelar` (`QUALIDADE`,`ADMIN`) `{ motivo }`.
- `PATCH /rnc/:id/reabrir` (`QUALIDADE`,`ADMIN`).
- `DELETE /rnc/:id` (**`ADMIN`**).

**Anexos** (`/anexos`) — só JWT
- `POST /anexos?entidadeTipo=&entidadeId=` (multipart, campo `file`, limite **20MB**, disco em `UPLOAD_DIR`, nome `${timestamp}-${rand}${ext}`).
- `GET /anexos?entidadeTipo=&entidadeId=` → lista desc.
- `GET /anexos/:id/download` → download do arquivo original.

**Dashboard** (`/dashboard`) — JWT
- `GET /dashboard/kpis-sqe?de=&ate=` (§5.9).
- `GET /dashboard/evolucao-fornecedores`.
- `GET /dashboard/historico-classificacao?fornecedorId=`.
- `POST /dashboard/fechar-trimestre` (`QUALIDADE`,`ADMIN`).

**Planejamento** (`/planejamento-semanal`) e **Entregas** (`/entregas`) — existem (JWT+Roles), usados por integrações/fluxos alternativos; não têm tela roteada. Reproduzir conforme código (entrega cria `EntregaPortaria`, avança contador cíclico, marca planejamento como ENTREGUE).

---

## 7. Seed (`prisma/seed.ts`) — dados iniciais (COPIAR LITERAL)

Senha de todos os usuários seed: **`123456`** (bcrypt, 10 rounds).

**Usuários** (upsert por email):
| nome | email | papel |
|---|---|---|
| Administrador | admin@bigdutchman.com.br | ADMIN |
| Analista Qualidade | qualidade@bigdutchman.com.br | QUALIDADE |
| Operador Producao | producao@bigdutchman.com.br | PRODUCAO |

**PeriodicidadeConfig** (upsert por classificação):
| Classe | periodicidadeTexto | freqN | tipo | nivelInspecaoTexto | romano | %amostra | NQA | conformidadeMin |
|---|---|---|---|---|---|---|---|---|
| A | 1 a cada 5 entregas | 5 | Amostragem | Inspecao Reduzida (30% dos itens) | I | 30 | 4.0 | 98 |
| B | 1 a cada 3 entregas | 3 | Amostragem | Inspecao Normal (50% dos itens) | II | 50 | 2.5 | 90 |
| C | Todas as entregas | 1 | Integral | Inspecao Intensiva (100% dos itens) | III | 100 | 1.0 | 80 |
| D | Todas as entregas | 1 | Integral | Inspecao Intensiva (100% dos itens) | III | 100 | 1.0 | 0 |

**Fornecedores** (upsert por código; `fazVisual=true` para todos): 32 registros — `codigo | nome | tipoFornecimento | categoriaInspecao | esforcoQualidade | classificacaoFornecimento | fazLote`:

```
780949 | Inobram | Paineis eletricos | Eletrico/Montagem | BAIXO | A | false
793940 | Metalurgica Barra do Pirai S/A | Materia-prima | Materia-prima | MEDIO | C | true
780962 | Lubing do Brasil Ltda | Tubos e pecas injetadas em plastico | Plastico injetado | BAIXO | A | false
780891 | Metalurgica Bello Ltda | Aramados | Aramados | ALTO | D | true
782950 | Brastil | Tubos de aco | Tubos | ALTO | D | true
781071 | Sew-Eurodrive Brasil Ltda | Motoredutores | Eletromecanico | BAIXO | B | false
788996 | Helptech | Pecas injetadas | Plastico injetado | ALTO | D | true
795392 | Cabomaq-Forestieri | Cabos eletricos | Eletrico | BAIXO | A | false
793036 | MM Plast | Tubos extrudados PVC | Plastico extrudado | ALTO | D | true
781051 | Polijet | Pecas injetadas | Plastico injetado | ALTO | A | true
791605 | Fusopar Parafusos | Parafusos, Porcas, Arruelas | Fixadores | ALTO | D | true
781091 | Weg Linhares | Motores e Motoredutores | Eletromecanico | BAIXO | C | false
781064 | Robustec | Pecas metal mecanica | Metalmecanica | BAIXO | D | false
782896 | Dancor | Conjunto moto bomba | Eletromecanico | BAIXO | A | false
791452 | Buzas | Conjuntos/Pecas caldeiraria | Solda/Caldeiraria | ALTO | A | true
788484 | Confortcel | Placas Evaporativas | Componentes | BAIXO | C | false
790124 | Santae | Pecas Plastico/PVC | Plastico injetado | ALTO | A | true
797193 | Morlan | Materia-prima | Materia-prima | MEDIO | A | true
795544 | Maccaferri | Materia-prima | Materia-prima | MEDIO | D | true
788638 | CRB Metalurgica | Pecas usinadas | Usinagem | ALTO | D | true
782461 | Weg Equipamentos | Motores eletricos | Eletromecanico | BAIXO | C | false
785405 | Tigre | Tubos/Conexao PVC | PVC | ALTO | C | true
793135 | Bekaert Ropes | Cabos de aco | Cabos de aco | MEDIO | C | true
771274 | Barbieri S.R.L. | Esteiras Plastico | Estrutural | BAIXO | C | false
790068 | Acotubo | Conjuntos/Pecas caldeiraria | Solda/Caldeiraria | ALTO | D | true
789706 | Acotech | Conjuntos/Pecas caldeiraria | Solda/Caldeiraria | ALTO | D | true
781070 | Scareli | Conjuntos/Pecas caldeiraria | Solda/Caldeiraria | ALTO | D | true
781025 | Parafusos Rudge Ramos | Parafusos, Porcas, Arruelas | Fixadores | ALTO | D | true
780988 | Metalurgica Luzi | Pecas trefiladas | Conformacao a frio | ALTO | D | true
781092 | Weg Drives | Paineis eletricos e Inversores | Eletrico/Montagem | MEDIO | C | false
```
(São 30 linhas na tabela acima; o seed original itera exatamente esta lista. Reproduza integralmente.)

---

## 8. Frontend — Design system e comportamento

### 8.1 Bootstrap e TEMA Ant Design (`main.tsx`) (COPIAR LITERAL)
Providers na ordem: `ConfigProvider` (locale `ptBR`, tema) → `QueryClientProvider` → `AuthProvider` → `BrowserRouter` → `App`. `dayjs.locale('pt-br')`. QueryClient com `refetchOnWindowFocus:false`. Import `'antd/dist/reset.css'`.

**Tema (tokens e componentes) — cores EXATAS:**
```ts
theme={{
  token: {
    colorPrimary: '#D37119',
    colorInfo:    '#D37119',
    colorLink:    '#B85F12',
    borderRadius: 6,
    fontFamily: "'Inter', 'Segoe UI', Roboto, -apple-system, BlinkMacSystemFont, sans-serif",
  },
  components: {
    Layout: { siderBg: '#2B2622', triggerBg: '#1F1B18', headerBg: '#ffffff' },
    Menu:   { darkItemBg: '#2B2622', darkSubMenuItemBg: '#221E1B',
              darkItemSelectedBg: '#D37119', darkItemHoverBg: '#3A332D' },
  },
}}
```
> Paleta da marca: laranja Big Dutchman **#D37119** (primária), **#B85F12** (link/escuro), marrom escuro do sider **#2B2622**. Verde de sucesso usado em Statistics: **#3f8600**. Vermelho de erro/perigo: **#cf1322**. Cinza neutro: **#8c8c8c**.

### 8.2 Camada de API (`api.ts`)
- axios `baseURL: '/api'`. Interceptor de request injeta `Authorization: Bearer <localStorage.token>`.
- Interceptor de response: em **401**, limpa `token`/`usuario` do localStorage e redireciona para `/login`.
- `baixarBlobUrl(url)` e `abrirPdfEmNovaAba(url)`: baixam recurso protegido por JWT como blob (para PDF e imagens que `<img src>`/`href` nativos não conseguem autenticar).

### 8.3 Auth (`auth.tsx`)
- `AuthProvider` guarda `usuario` (lido de `localStorage.usuario`). `login(email,senha)` → `POST /auth/login`, salva `token` e `usuario`. `logout()` limpa. `useAuth()` expõe `{ usuario, login, logout }`. Tipo usuário: `{ id, nome, email, papel: 'QUALIDADE'|'PRODUCAO'|'ADMIN' }`.

### 8.4 Hooks e helpers
- `useFornecedores()` → `GET /fornecedores` (query key `['fornecedores']`). `useItens()` → `GET /itens`.
- `opcoesFornecedor(lista)` → `{ value:id, label:'<codigo> — <nome>' }`. `opcoesItem` → `'<codigo> — <descricao>'`.

### 8.5 Rotas (`App.tsx`)
Componente `Privado` = se não há `usuario` → `<Navigate to="/login">`, senão embrulha em `<AppLayout>`. Rotas:
| path | página |
|---|---|
| `/login` | Login (público) |
| `/` | Dashboard (Painel) |
| `/periodicidade` | Periodicidade |
| `/fornecedores` | Fornecedores |
| `/inspecoes` | Inspecoes |
| `/rnc` | RncLista |
| `/rnc/:id` | RncDetalhe |
| `*` | redireciona para `/` |

### 8.6 Layout (`AppLayout.tsx`)
- `Layout` full-height. **Sider** dark, `width=230`, `breakpoint="lg"`, `collapsedWidth="0"`. Topo do sider: `div` altura 72, centralizado, com **logo** `/logo-big-dutchman.png` altura 28 (SEM texto embaixo).
- **Menu** `theme="dark" mode="inline"`, `selectedKeys=[selecionado]` (raiz `/` ou primeiro segmento do path). Itens (grupos colapsáveis):
  - **QUALIDADE - SQE** (icon `ExperimentOutlined`), filhos:
    - `/` Painel (`DashboardOutlined`)
    - `/inspecoes` Inspeções (`AuditOutlined`)
    - `/rnc` RNC (`WarningOutlined`)
    - `/fornecedores` Fornecedores (`ShopOutlined`)
    - `/periodicidade` Periodicidade (`SlidersOutlined`)
  - **QUALIDADE - MANUFATURA** (icon `ToolOutlined`) → filho único `EM DESENVOLVIMENTO` (disabled).
  - **QUALIDADE - SQD** (icon `SafetyCertificateOutlined`) → filho único `EM DESENVOLVIMENTO` (disabled).
  - Ao clicar, se `key` começa com `/`, navega.
- **Header** branco, `0 24px`, sombra `0 1px 4px rgba(0,0,0,0.08)`, com `Typography.Text strong` (15px) **"Big Dutchman Brasil — Sistema de Qualidade"** à esquerda e, à direita, `Dropdown` com Avatar (`UserOutlined`) + `usuario.nome` + `(papel)` e opção **Sair** (`LogoutOutlined`) que faz logout e vai para `/login`.
- **Content** com `margin: 24`.

### 8.7 Logo/imagens
- `frontend/public/logo-big-dutchman.png` — logo usada no sider e no Login.
- `backend/assets/logo-big-dutchman.png` — logo usada no cabeçalho do PDF da RNC.
- (Se não tiver os PNGs, use um placeholder com o texto "Big Dutchman" na cor laranja; o PDF já tem fallback textual.)

---

## 9. Telas (fiéis, campo a campo)

### 9.1 Login (`/login`)
- Fundo em **gradiente** `linear-gradient(135deg, #2B2622 0%, #B85F12 100%)`, centralizado. `Card` largura 380, sombra forte.
- Topo do card: logo (altura 40), `Typography.Title level=3` **"Sistema de Qualidade"** cor `#D37119`, subtítulo secundário **"Big Dutchman Brasil — Módulo SQE"**.
- Form vertical, `requiredMark={false}`: **E-mail** (prefix `MailOutlined`, placeholder `seu@email.com`, required), **Senha** (`Input.Password`, prefix `LockOutlined`, required). Botão primário block size large **"Entrar"** com loading. Erro → `message.error('Usuário ou senha inválidos')`. Sucesso → navega `/`.

### 9.2 Dashboard / Painel (`/`)
Título `level=4` **"Painel Resumo — Qualidade de Fornecedores (SQE)"** com `RangePicker` (DD/MM/YYYY, placeholders Início/Fim) que filtra os KPIs (`de`/`ate`).
- **8 KPIs** em Cards (`Statistic`), grid `xs=24 sm=12 lg=6`:
  1. Fornecedores inspecionados (%) — `FileSearchOutlined`
  2. Itens inspecionados (%) — `FileSearchOutlined`
  3. Aprovação no recebimento (%) — verde `#3f8600`, `CheckCircleOutlined`
  4. Custos evitados (R$) — cor `#D37119`, `DollarOutlined`, formato pt-BR 2 casas
  5. Resposta às RNCs (%)
  6. Eficácia das respostas (%)
  7. Eficácia no encerramento (%)
  8. Tempo médio de resposta (dias) — `ClockCircleOutlined`
- **6 contadores** (Cards `size=small`, grid `xs=12 sm=8 lg=4`): Entregas; Inspeções; Recebimentos s/ inspeção (cinza `#8c8c8c`); RNCs (total); RNCs em andamento (vermelho `#cf1322`); RNCs finalizadas (verde `#3f8600`).
- **Card "Evolução e Histórico dos Fornecedores"**: botão **"Fechar trimestre"** (`ReconciliationOutlined`, visível só para ADMIN/QUALIDADE) que abre `Modal.confirm` explicando (registra histórico, reclassifica, zera contadores) e chama `POST /dashboard/fechar-trimestre` (toast com trimestre e nº processados). Tabela (`GET /dashboard/evolucao-fornecedores`): Código, Fornecedor, **Classificação atual** (Tag), **Apurada no período** (Tag), **Conformidade** (%1 casa), Cargas recebidas, Lotes insp., Reprovados, **Tendência** (Tag: Melhorou/verde `ArrowUp`, Piorou/vermelho `ArrowDown`, Estável/`Minus`).
- **Card "RNCs em andamento"**: tabela das RNCs `EM_ANDAMENTO` (Número, Abertura, Fornecedor, Item, Tipo de desvio, Status), clique na linha → `/rnc/:id`. Empty: "Nenhuma RNC em andamento".
- **Mapa de cor por classe** (reutilizado em várias telas): `A:'green', B:'blue', C:'orange', D:'red'`.

### 9.3 Fornecedores (`/fornecedores`)
Card "Fornecedores" com botão primário **"Novo Fornecedor"** (`PlusOutlined`). Tabela: Código, Nome, Tipo de fornecimento, **Classificação** (Tag por cor de classe), **Escopo** (Tags `Visual`/geekblue, `Lote`/purple), **Situação** (Ativo/verde | Inativo), **Ações** (Editar).
- **Modal** (largura 760) Novo/Editar com seções (`Divider`):
  - **Identificação**: Código (req), Nome (req), CNPJ, Endereço.
  - **Escopo e Classificação**: Tipo de fornecimento, Categoria de inspeção, Plano de inspeção (resumo), Controles principais (textarea), Escopo (texto livre, textarea), **Classificação de fornecimento** (Select: `A — Excelente`, `B — Bom`, `C — Regular`, `D — Crítico`), **Esforço de qualidade** (Baixo/Médio/Alto), **Inspeção Visual** (Switch Sim/Não), **Inspeção de Lote** (Switch Sim/Não).
  - **Contatos (até 2)** via `Form.List`: Nome (req), E-mail, Telefone, Função; botão "Adicionar contato" some ao chegar em 2.
  - Se editando: Switch **"Fornecedor ativo"**.
  - Defaults ao criar: esforço MEDIO, classificação C, fazVisual true, fazLote false. Salvar filtra contatos sem nome; `POST` (novo) ou `PATCH` (editar).

### 9.4 Periodicidade (`/periodicidade`)
Card "Periodicidade de Inspeção por Classificação" com texto de ajuda no `extra` e um `Alert` "Como funciona". Tabela (sem paginação, `GET /periodicidade`): **Classificação** (Tag colorida bold), Periodicidade, Frequência (1 a cada N), Tipo, Nível de inspeção, Nível (romano), **Amostra** (%), **NQA** (1 casa), **Conformidade mín.** (%), Ações (Editar).
- **Modal** "Editar Classificação X" (`PATCH /periodicidade/:classificacao`): periodicidadeTexto, frequenciaN (min 1), tipoInspecao, nivelInspecaoTexto, nivelRomano, percentualAmostra (0–100), nqa (min 0 step 0.1), conformidadeMin (0–100).

### 9.5 Inspeções (`/inspecoes`)
Card "Inspeções de Recebimento" com botão **"Nova Inspeção"**.
- **Tabela** (`GET /inspecoes`): Data (DD/MM/YYYY, sort desc default), Semana, Ano, **Formulário** (Tag; filtros Visual/Lote-Dimensional/Recebimento), Fornecedor (filtro), Item (filtro), **Resultado** (Tag; filtros — cores: `APROVADO:green, REPROVADO:red, SEM_INSPECAO:default`; labels: Aprovado / Reprovado / **Sem Inspeção Recomendada**), **RNC** (link para `/rnc/:id` com número, se houver). Coluna de **exclusão** (lixeira) só para **ADMIN** e não para linhas `RECEBIMENTO`.
- **Modal "Nova Inspeção de Recebimento"** (largura 900):
  - Seleciona **Fornecedor** (Select com busca). Data/Semana/Ano exibidos (calculados de hoje via `semanaAno`, desabilitados).
  - Chama `GET /inspecoes/avaliar?fornecedorId=` e mostra um `Descriptions`: Classificação (Tag), Periodicidade, "Entregas no ciclo" (`proximoContador de frequenciaN`), Escopo (Tags Visual/Lote), **Decisão**: laranja "Esta entrega DEVE ser inspecionada" **ou** verde "Fora do ciclo — recebimento sem inspeção".
  - **Se fora do ciclo**: mostra só Nota Fiscal + PO; botão "Registrar recebimento sem inspeção" → `POST /inspecoes/recebimento`.
  - **Se deve inspecionar**: `Steps` (quando Visual+Lote). Campos comuns: Item (descrição, req), Código do item, Nota Fiscal, PO, Qtd. inspecionada, Qtd. total do lote, Desenho/Revisão, Tolerâncias/Norma, Nº do relatório.
    - **Visual** (`ChecklistVisual`): render dos 12 grupos (Cards), cada item com `Radio.Group` Aprovado/Reprovado/N/A; botões por grupo "Todos Aprovados" e "N/A"; container com scroll (`maxHeight 55vh`). Divider "Checklist Visual (Doc. BDBR.QUA.FMR.06.07)".
    - **Lote** (`TabelaCotas`): tabela editável de cotas — Localização/Cota, Especificado, Tol.+, Tol.-, Medido, Instrumento, **Conforme?** (Radio Sim/Não), remover; botão "Adicionar cota". Divider "Dimensional (Doc. BDBR.QUA.FMR.011.06)".
  - Observações (textarea). **Alert** de resultado automático (erro se algum Reprovado/Não-conforme; sucesso caso contrário).
  - **Se REPROVADO**: campo **Disposição** (req) + **Upload de fotos** (`beforeUpload=>false`, multiple, image/*). Ao salvar reprovado, cria a inspeção; as fotos são enviadas via `POST /anexos?entidadeTipo=RNC&entidadeId=<rnc.id>`.
  - Encadeamento: ao terminar a etapa Visual havendo Lote, avança o passo reusando a mesma entrega. Ao final, `Modal.confirm` se gerou RNC ("Deseja abrir a primeira agora?" → `/rnc/:id`), senão toast de sucesso.
  - Exclusão (ADMIN): `DELETE /inspecoes/{visual|lote}/:id`; se retornar 409 com RNCs, `Modal.confirm` oferece excluir inspeção + RNC(s) (`?cascade=true`).

### 9.6 RNC — Lista (`/rnc`)
Card "RNC — Registros de Não Conformidade" com Select "Filtrar por status" + botão **"Abrir RNC"**.
- Mapas exportados (reutilizados no Dashboard/Detalhe): `corStatusRnc = { EM_ANDAMENTO:'orange', FINALIZADA:'green', CANCELADA:'default' }`; `labelStatusRnc = { EM_ANDAMENTO:'Em andamento', FINALIZADA:'Finalizada', CANCELADA:'Cancelada' }`. Eficácia: cores `PENDENTE:default, APROVADO:green, REPROVADO:red, NAO_APLICAVEL:default`; labels Pendente/Aprovada/Reprovada/N/A.
- **Tabela** (`GET /rnc?status=`), clique na linha → detalhe: Número, Abertura (sort), Semana, Ano, Fornecedor (filtro), Item (filtro), Tipo de desvio (filtro), **Reincidência** (Tag Sim/Não), **Valor (R$)** (sort, pt-BR), **Status** (Tag), **Eficácia** (Tag).
- **Modal "Abrir RNC"** (largura 680): Data/Semana/Ano (hoje, desabilitados); Fornecedor (Select busca, req); Item descrição (req) + Código do item; Nota Fiscal, PO, Qtd. do lote; Tipo de desvio; **Descrição do desvio** (req, textarea); Qtd. de peças afetadas, Valor unitário (R$, 2 casas); Disposição. `POST /rnc` → toast e navega para a RNC criada.

### 9.7 RNC — Detalhe (`/rnc/:id`)
Cabeçalho: botão **Voltar**, título **"RNC <numero>"**, Tag de status. Ações (à direita): **Exportar PDF** (`abrirPdfEmNovaAba('/rnc/:id/pdf')`), **Editar**; se finalizada/cancelada → **Reabrir**, senão → **Cancelar RNC** (danger) + **Finalizar** (primary); **Excluir** só ADMIN.
- Alerts contextuais: se cancelada mostra motivo; se veio de inspeção, "Esta RNC foi gerada por uma inspeção {visual|lote} (#id)".
- **Card "Dados da RNC"** (`Descriptions` 2 col): Abertura, Solicitante, Fornecedor (código — nome), Item (código — descrição), Nota Fiscal, PO, Qtd. do lote, Reincidência (Tag), Tipo de desvio, Descrição do desvio, Qtd. de peças, Valor unitário, **Valor total** (negrito), Disposição.
- **Card "Plano de Ação"**: Houve retorno?, Data de retorno, Tempo de retorno (dias), Fornecedor aceitou, Enviou plano de ação, Nível do plano, **Verificação de eficácia** (Tag), Data da verificação, Observações.
- **Card "Evidências / Fotos (até 5)"** — `MAX_FOTOS = 5`: Upload (customRequest → `POST /anexos?entidadeTipo=RNC&entidadeId=id`), preview em `Image.PreviewGroup` usando `AuthImage` (imagem via blob autenticado). Botão mostra contador `(n/5)`, desabilita ao atingir 5.
- **Card "Histórico de Status"** (`Timeline`): cada evento com cor do status, label, data/hora + usuário e comentário.
- **Modais**:
  - **Editar** (`PATCH /rnc/:id`): tipoDesvio, reincidência (Switch), descrição, qtd peças, valor unitário, disposição, houve retorno (Switch), data de retorno (DatePicker), enviou plano (Switch), fornecedor aceitou (Select: `Sim` / `Não (Ver observações)`), nível do plano (Select: Satisfatório/Excelente/Não se aplica), observações.
  - **Finalizar** (`PATCH /rnc/:id` com `status:FINALIZADA`, `dataVerificacao=now`): verificação de eficácia (req: Aprovada/Reprovada/Não se aplica), evidências, comentário (histórico).
  - **Cancelar** (`PATCH /rnc/:id/cancelar`): parágrafo explicando que sai dos KPIs mas fica na lista; **Motivo** (req).
  - **Excluir**: `Modal.confirm` (se veio de inspeção, avisa que remove só a RNC).

### 9.8 `AuthImage.tsx`
Componente que busca `/anexos/:id/download` como blob (com JWT), gera object-URL e renderiza `Image` (120×120, objectFit cover, radius 6), revogando a URL ao desmontar.

---

## 10. PDF da RNC (`rnc-pdf.ts`) — formulário oficial bilíngue

Gerado com **pdfkit**, A4, margem 40. Fiel ao formulário **BDBR.QUA.FMR.003.05** (bilíngue PT/EN). Cores: laranja `#E8792B`, preto, cinza `#555`. Estrutura:
- **Cabeçalho**: logo (`backend/assets/logo-big-dutchman.png`, fallback texto "Big Dutchman" laranja); caixa de código no topo direito com `Código/Code: BDBR.QUA.FMR.003.05`, `Data Rev./Rev. Date: 03/12/2025`, `Revisão/Revision: 05`; título central **"Relatório de Não Conformidade" / "Non Conformance Report"**.
- **Linha 1**: RNC Nº (laranja), Data de Abertura, Responsável, Setor ("Qualidade / Quality"), Fornecedor, Código.
- **Linha 2**: Código do Item, Quantidade do Lote, NF, PO, Descrição Item.
- **Linha 3** (destaque laranja): Quantidade Afetada, Reincidência? (Sim/Yes | Não/No).
- **Seções** com título bilíngue: **Descrição do Desvio** (prefixa `[tipoDesvio]`), **Disposição**, **Registro Fotográfico** (até 4 fotos anexadas em grid; se nenhuma: "Sem registro fotográfico. / No photographic record.").
- **Rodapé** centralizado: "Big Dutchman Brasil — Sistema de Qualidade · Emitido em <data/hora pt-BR>".

---

## 11. Checklist de fidelidade (ao terminar, confirme)

- [ ] Prisma schema idêntico (enums, campos Json `checklist`/`cotas`, `@@unique([ano,sequencial])`, índices).
- [ ] Semana **domingo→sábado**; trimestre fiscal **começa em outubro**; bandas A≥98/B≥90/C≥80/D<80.
- [ ] Checklist Visual com os **12 grupos** e textos exatos (sem acento); itens iniciam `NAO_APLICAVEL`.
- [ ] Contador cíclico: `precisaInspecionar = contador+1 >= frequenciaN`; zera ao inspecionar.
- [ ] Encadeamento Visual→Lote reusa a mesma `EntregaPortaria` (1 recebimento).
- [ ] RNC automática ao reprovar; numeração `NNN/aa` por ano; canceladas fora dos KPIs.
- [ ] KPIs calculados sobre o total de cargas recebidas (fórmulas da §5.9).
- [ ] Tema Ant Design com as cores exatas (#D37119, #B85F12, #2B2622, etc.); locale pt-BR.
- [ ] Menu com 3 grupos (SQE ativo; Manufatura e SQD "EM DESENVOLVIMENTO" desabilitados); logo sem texto.
- [ ] 6 rotas ativas; interceptor 401 → `/login`; JWT no header via axios.
- [ ] Seed: 3 usuários (senha `123456`), 4 periodicidades, 30 fornecedores da tabela.
- [ ] PDF da RNC bilíngue, código `BDBR.QUA.FMR.003.05`, com registro fotográfico.
- [ ] Papéis/permissões: exclusões restritas a ADMIN; criações/edições a QUALIDADE+ADMIN; `/usuarios` só ADMIN.

---

**Fim do prompt-mestre.** Reproduza tudo acima exatamente. Onde este documento cita "COPIAR LITERAL", use o texto/código exatamente como está.

---

# ANEXO A — Código-fonte completo (VERBATIM)

> Esta seção contém **todos os arquivos-fonte reais** da aplicação, copiados **exatamente como estão** (sem alterar uma vírgula). Cada bloco indica o caminho relativo do arquivo. Para reproduzir o sistema idêntico, recrie cada arquivo abaixo com o conteúdo exato do respectivo bloco. Em caso de qualquer divergência entre as seções descritivas (§0–§11) e este anexo, **este anexo prevalece** (é o código real).

---

## A.1 Backend — configuração

### `backend/package.json`

```json
{
  "name": "qualidade-backend",
  "version": "0.1.0",
  "description": "Sistema de Qualidade - Backend (Modulo SQE)",
  "author": "Big Dutchman Brasil",
  "private": true,
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:prod": "node dist/main.js",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate deploy",
    "prisma:seed": "ts-node prisma/seed.ts",
    "db:setup": "prisma migrate deploy && ts-node prisma/seed.ts"
  },
  "prisma": {
    "seed": "ts-node prisma/seed.ts"
  },
  "dependencies": {
    "@nestjs/common": "^10.4.4",
    "@nestjs/config": "^3.2.3",
    "@nestjs/core": "^10.4.4",
    "@nestjs/jwt": "^10.2.0",
    "@nestjs/passport": "^10.0.3",
    "@nestjs/platform-express": "^10.4.4",
    "@nestjs/serve-static": "^4.0.2",
    "@prisma/client": "^5.20.0",
    "bcryptjs": "^2.4.3",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.1",
    "multer": "^1.4.5-lts.1",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "pdfkit": "^0.15.0",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.4.5",
    "@nestjs/schematics": "^10.1.4",
    "@types/bcryptjs": "^2.4.6",
    "@types/express": "^4.17.21",
    "@types/multer": "^1.4.12",
    "@types/node": "^20.16.10",
    "@types/passport-jwt": "^4.0.1",
    "@types/pdfkit": "^0.13.5",
    "prisma": "^5.20.0",
    "ts-node": "^10.9.2",
    "typescript": "^5.6.2"
  }
}

```

### `backend/tsconfig.json`

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": false,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": true,
    "noImplicitAny": false,
    "strictBindCallApply": false,
    "forceConsistentCasingInFileNames": false,
    "noFallthroughCasesInSwitch": false,
    "esModuleInterop": true,
    "resolveJsonModule": true
  }
}

```

### `backend/nest-cli.json`

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true
  }
}

```

---

## A.2 Backend — Prisma (schema + seed)

### `backend/prisma/schema.prisma`

```prisma
// ============================================================
// Sistema de Qualidade - Big Dutchman Brasil
// Schema do banco de dados (PostgreSQL)
// Nucleo compartilhado + Modulo SQE (recebimento de fornecedores)
// ============================================================

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ---------------------- NUCLEO ----------------------

enum Papel {
  QUALIDADE
  PRODUCAO
  ADMIN
}

model Usuario {
  id        Int      @id @default(autoincrement())
  nome      String
  email     String   @unique
  senhaHash String
  papel     Papel    @default(QUALIDADE)
  ativo     Boolean  @default(true)
  createdAt DateTime @default(now())

  planejamentos   PlanejamentoSemanal[] @relation("PlanejamentoCriadoPor")
  entregas        EntregaPortaria[]     @relation("EntregaConfirmadoPor")
  inspecoesVisual InspecaoVisual[]      @relation("InspVisualInspetor")
  inspecoesLote   InspecaoLote[]        @relation("InspLoteInspetor")
  rncs            Rnc[]                 @relation("RncCriadoPor")
  anexos          Anexo[]
  historicos      HistoricoStatus[]
}

// Classificacao de fornecimento (definida manualmente, base no trimestre anterior)
enum Classificacao {
  A
  B
  C
  D
}

enum EsforcoQualidade {
  BAIXO
  MEDIO
  ALTO
}

model Fornecedor {
  id     Int    @id @default(autoincrement())
  codigo String @unique
  nome   String
  cnpj   String?

  // Dados complementares (opcionais no MVP)
  endereco String?

  // Escopo / classificacao (planilha "Escopo" + "Base de Fornecedores")
  tipoFornecimento    String? // ex: Paineis eletricos, Materia-prima, Parafusos
  categoriaInspecao   String? // ex: Eletrico/Montagem, Plastico injetado, Fixadores
  planoInspecao       String? // resumo textual do escopo
  controlesPrincipais String? // texto detalhado do que checar
  escopoTexto         String? // texto livre do escopo (aba Escopo)
  esforcoQualidade    EsforcoQualidade @default(MEDIO)

  // Classificacao de fornecimento (manual) - define periodicidade/nivel/NQA
  classificacaoFornecimento Classificacao @default(C)
  // Escopo de inspeicao: quais formularios o sistema deve abrir
  fazVisual Boolean @default(true)
  fazLote   Boolean @default(false)

  // Contadores
  contadorEntregas    Int @default(0) // ciclico: zera quando dispara inspecao
  totalEntregas       Int @default(0) // acumulado historico (dashboard)
  totalInspecoes      Int @default(0) // acumulado historico (dashboard)
  lotesInspecionados  Int @default(0) // trimestre corrente
  lotesReprovados     Int @default(0) // trimestre corrente

  ativo     Boolean  @default(true)
  createdAt DateTime @default(now())

  contatos         Contato[]
  itens            Item[]
  planejamentos    PlanejamentoSemanal[]
  entregas         EntregaPortaria[]
  inspecoesVisual  InspecaoVisual[]
  inspecoesLote    InspecaoLote[]
  rncs             Rnc[]
  historicoClasses HistoricoClassificacao[]
}

// Ate 2 contatos por fornecedor (cadastro simples)
model Contato {
  id           Int        @id @default(autoincrement())
  fornecedorId Int
  fornecedor   Fornecedor @relation(fields: [fornecedorId], references: [id], onDelete: Cascade)
  nome         String
  email        String?
  telefone     String?
  funcao       String?

  @@index([fornecedorId])
}

model Item {
  id           Int         @id @default(autoincrement())
  codigo       String      @unique
  descricao    String
  unidade      String?
  fornecedorId Int?
  fornecedor   Fornecedor? @relation(fields: [fornecedorId], references: [id])
  createdAt    DateTime    @default(now())

  planejamentos   PlanejamentoSemanal[]
  entregas        EntregaPortaria[]
  inspecoesVisual InspecaoVisual[]
  inspecoesLote   InspecaoLote[]
  rncs            Rnc[]
}

// Tabela de referencia de periodicidade por classificacao (pre-setada e editavel)
model PeriodicidadeConfig {
  id                Int           @id @default(autoincrement())
  classificacao     Classificacao @unique
  periodicidadeTexto String       // ex: "1 a cada 5 entregas"
  frequenciaN       Int           // 5, 3, 1
  tipoInspecao      String        @default("Amostragem")
  nivelInspecaoTexto String       // ex: "Inspecao Reduzida (30% itens)"
  nivelRomano       String        // I, II, III
  percentualAmostra Int           // 30, 50, 100
  nqa               Float         // 4.0, 2.5, 1.0
  // bandas de conformidade para reclassificacao
  conformidadeMin   Float         // A>=98, B>=90, C>=80, D>=0
  updatedAt         DateTime      @updatedAt
}

// Anexo polimorfico: serve para qualquer entidade (Inspecao, RNC, modulos futuros)
model Anexo {
  id           Int      @id @default(autoincrement())
  entidadeTipo String // ex: "RNC", "INSPECAO_VISUAL", "INSPECAO_LOTE"
  entidadeId   Int
  nomeArquivo  String
  caminho      String
  mimeType     String?
  tamanho      Int?
  uploadedById Int?
  uploadedBy   Usuario? @relation(fields: [uploadedById], references: [id])
  createdAt    DateTime @default(now())

  @@index([entidadeTipo, entidadeId])
}

// Historico de status polimorfico: registra toda mudanca de status de qualquer entidade
model HistoricoStatus {
  id             Int      @id @default(autoincrement())
  entidadeTipo   String // ex: "RNC"
  entidadeId     Int
  statusAnterior String?
  statusNovo     String
  comentario     String?
  usuarioId      Int?
  usuario        Usuario? @relation(fields: [usuarioId], references: [id])
  createdAt      DateTime @default(now())

  @@index([entidadeTipo, entidadeId])
}

// Historico de classificacao por trimestre fiscal (out->set)
model HistoricoClassificacao {
  id                    Int           @id @default(autoincrement())
  fornecedorId          Int
  fornecedor            Fornecedor    @relation(fields: [fornecedorId], references: [id])
  trimestreFiscal       String        // ex: "FY26-Q3"
  periodoInicio         DateTime
  periodoFim            DateTime
  classificacaoInicial  Classificacao // classificacao de fornecimento do periodo
  lotesInspecionados    Int
  lotesReprovados       Int
  pctConformidade       Float
  classificacaoApurada  Classificacao // calculada pela conformidade
  createdAt             DateTime      @default(now())

  @@index([fornecedorId])
}

// ---------------------- MODULO SQE ----------------------

enum StatusPlanejamento {
  PENDENTE
  ENTREGUE
}

model PlanejamentoSemanal {
  id               Int                @id @default(autoincrement())
  semanaReferencia String // ex: "2026-W28"
  fornecedorId     Int
  fornecedor       Fornecedor         @relation(fields: [fornecedorId], references: [id])
  itemId           Int?
  item             Item?              @relation(fields: [itemId], references: [id])
  dataPrevista     DateTime?
  status           StatusPlanejamento @default(PENDENTE)
  criadoPorId      Int?
  criadoPor        Usuario?           @relation("PlanejamentoCriadoPor", fields: [criadoPorId], references: [id])
  createdAt        DateTime           @default(now())

  entregas EntregaPortaria[]
}

model EntregaPortaria {
  id              Int                  @id @default(autoincrement())
  planejamentoId  Int?
  planejamento    PlanejamentoSemanal? @relation(fields: [planejamentoId], references: [id])
  fornecedorId    Int
  fornecedor      Fornecedor           @relation(fields: [fornecedorId], references: [id])
  itemId          Int?
  item            Item?                @relation(fields: [itemId], references: [id])
  dataEntrega     DateTime             @default(now())
  semanaReferencia String?             // W do recebimento (domingo->sabado)
  semana          String?              // semana no formato W## (ex: W28)
  ano             Int?                 // ano do recebimento
  notaFiscal      String?
  po              String?
  quantidade      Float?
  // Decisao automatica de inspecao
  numeroEntregaAcumulado Int?          // valor do contador no momento
  passivelInspecao       Boolean       @default(false) // sistema decidiu inspecionar?
  confirmadoPorId Int?
  confirmadoPor   Usuario?             @relation("EntregaConfirmadoPor", fields: [confirmadoPorId], references: [id])
  createdAt       DateTime             @default(now())

  inspecoesVisual InspecaoVisual[]
  inspecoesLote   InspecaoLote[]
}

enum ResultadoInspecao {
  APROVADO
  REPROVADO
}

enum OrigemInspecao {
  PLANO_INSPECAO
  HOMOLOGACAO
  DEVOLUCAO
  RETRABALHO
  RELATORIO_OCORRENCIA
  OUTROS
}

// Formulario VISUAL - Doc BDBR.QUA.FMR.06.07
// Checklist de 12 grupos armazenado em JSON (fiel a planilha)
model InspecaoVisual {
  id           Int              @id @default(autoincrement())
  entregaId    Int?
  entrega      EntregaPortaria? @relation(fields: [entregaId], references: [id])
  fornecedorId Int
  fornecedor   Fornecedor       @relation(fields: [fornecedorId], references: [id])
  itemId       Int
  item         Item             @relation(fields: [itemId], references: [id])

  // Cabecalho comum
  desenhoRev      String?
  toleranciasNorm String?
  notaFiscal      String?
  po              String?
  qtdInspecionada Float?
  qtdTotal        Float?
  relatorioNumero String?
  origem          OrigemInspecao @default(PLANO_INSPECAO)

  // Checklist (12 grupos) - JSON: [{ grupo, itens: [{ texto, status }] }]
  checklist Json

  observacoes String?
  resultado   ResultadoInspecao @default(APROVADO)
  dataInspecao DateTime         @default(now())
  semana       String?          // semana da inspecao no formato W## (ex: W28)
  ano          Int?             // ano da inspecao
  inspetorId   Int?
  inspetor     Usuario?         @relation("InspVisualInspetor", fields: [inspetorId], references: [id])
  createdAt    DateTime         @default(now())

  rncs Rnc[]
}

// Formulario LOTE / DIMENSIONAL - Doc BDBR.QUA.FMR.011.06
model InspecaoLote {
  id           Int              @id @default(autoincrement())
  entregaId    Int?
  entrega      EntregaPortaria? @relation(fields: [entregaId], references: [id])
  fornecedorId Int
  fornecedor   Fornecedor       @relation(fields: [fornecedorId], references: [id])
  itemId       Int
  item         Item             @relation(fields: [itemId], references: [id])

  // Cabecalho comum
  desenhoRev      String?
  toleranciasNorm String?
  notaFiscal      String?
  po              String?
  qtdInspecionada Float?
  qtdTotal        Float?
  relatorioNumero String?
  origem          OrigemInspecao @default(PLANO_INSPECAO)

  // Tabela de cotas - JSON: [{ localizacao, especificado, tolUpper, tolLower, pecas:[..], instrumento, desvioMin, desvioMax }]
  cotas Json

  observacoes String?
  resultado   ResultadoInspecao @default(APROVADO)
  dataInspecao DateTime         @default(now())
  semana       String?          // semana da inspecao no formato W## (ex: W28)
  ano          Int?             // ano da inspecao
  inspetorId   Int?
  inspetor     Usuario?         @relation("InspLoteInspetor", fields: [inspetorId], references: [id])
  createdAt    DateTime         @default(now())

  rncs Rnc[]
}

// RNC - Doc BDBR.QUA.FMR.003.03 (controle interno)
enum StatusRnc {
  EM_ANDAMENTO
  FINALIZADA
  CANCELADA
}

enum VerificacaoEficacia {
  PENDENTE
  APROVADO
  REPROVADO
  NAO_APLICAVEL
}

enum NivelPlano {
  SATISFATORIO
  EXCELENTE
  NAO_APLICAVEL
}

model Rnc {
  id     Int    @id @default(autoincrement())
  numero String @unique // formato {seq}/{aa} - ex: 149/26
  ano    Int    // ano da RNC (para gerar sequencial por ano)
  sequencial Int // sequencial dentro do ano

  // origem (inspecao reprovada)
  inspecaoVisualId Int?
  inspecaoVisual   InspecaoVisual? @relation(fields: [inspecaoVisualId], references: [id])
  inspecaoLoteId   Int?
  inspecaoLote     InspecaoLote?   @relation(fields: [inspecaoLoteId], references: [id])

  // Informacoes do documento
  dataAbertura DateTime @default(now())
  semana       String?  // semana da abertura no formato W## (ex: W28)
  solicitante  String   @default("Qualidade")

  // Informacoes do item
  itemId       Int
  item         Item       @relation(fields: [itemId], references: [id])
  quantidadeLote Float?
  po           String?
  notaFiscal   String?

  // Informacoes do fornecedor
  fornecedorId Int
  fornecedor   Fornecedor @relation(fields: [fornecedorId], references: [id])

  // Informacoes sobre o desvio
  tipoDesvio      String  // texto livre
  reincidencia    Boolean @default(false)
  descricaoDesvio String

  // Custos RNC
  quantidadePecas Float?
  valorUnitario   Float?
  valorTotal      Float?  // = quantidadePecas * valorUnitario

  // Plano de acao
  disposicao         String? // texto livre
  houveRetorno       Boolean?
  dataRetorno        DateTime?
  tempoRetornoDias   Int?     // = dataRetorno - dataAbertura
  fornecedorAceitou  String?  // "Sim" / "Nao (Ver observacoes)"
  fornecedorEnviouPlano Boolean?
  nivelPlano         NivelPlano?
  status             StatusRnc @default(EM_ANDAMENTO)
  motivoCancelamento String?  // motivo quando status = CANCELADA
  verificacaoEficacia VerificacaoEficacia @default(PENDENTE)
  dataVerificacao    DateTime?

  evidencias  String?
  observacoes String?

  criadoPorId Int?
  criadoPor   Usuario? @relation("RncCriadoPor", fields: [criadoPorId], references: [id])
  createdAt   DateTime @default(now())

  @@unique([ano, sequencial])
}

```

### `backend/prisma/seed.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const senhaHash = await bcrypt.hash('123456', 10);

  // Usuarios
  const admin = await prisma.usuario.upsert({
    where: { email: 'admin@bigdutchman.com.br' },
    update: {},
    create: {
      nome: 'Administrador',
      email: 'admin@bigdutchman.com.br',
      senhaHash,
      papel: 'ADMIN',
    },
  });

  await prisma.usuario.upsert({
    where: { email: 'qualidade@bigdutchman.com.br' },
    update: {},
    create: {
      nome: 'Analista Qualidade',
      email: 'qualidade@bigdutchman.com.br',
      senhaHash,
      papel: 'QUALIDADE',
    },
  });

  await prisma.usuario.upsert({
    where: { email: 'producao@bigdutchman.com.br' },
    update: {},
    create: {
      nome: 'Operador Producao',
      email: 'producao@bigdutchman.com.br',
      senhaHash,
      papel: 'PRODUCAO',
    },
  });

  // Tabela de periodicidade por classificacao (pre-setada e editavel)
  const periodicidades = [
    {
      classificacao: 'A' as const,
      periodicidadeTexto: '1 a cada 5 entregas',
      frequenciaN: 5,
      tipoInspecao: 'Amostragem',
      nivelInspecaoTexto: 'Inspecao Reduzida (30% dos itens)',
      nivelRomano: 'I',
      percentualAmostra: 30,
      nqa: 4.0,
      conformidadeMin: 98,
    },
    {
      classificacao: 'B' as const,
      periodicidadeTexto: '1 a cada 3 entregas',
      frequenciaN: 3,
      tipoInspecao: 'Amostragem',
      nivelInspecaoTexto: 'Inspecao Normal (50% dos itens)',
      nivelRomano: 'II',
      percentualAmostra: 50,
      nqa: 2.5,
      conformidadeMin: 90,
    },
    {
      classificacao: 'C' as const,
      periodicidadeTexto: 'Todas as entregas',
      frequenciaN: 1,
      tipoInspecao: 'Integral',
      nivelInspecaoTexto: 'Inspecao Intensiva (100% dos itens)',
      nivelRomano: 'III',
      percentualAmostra: 100,
      nqa: 1.0,
      conformidadeMin: 80,
    },
    {
      classificacao: 'D' as const,
      periodicidadeTexto: 'Todas as entregas',
      frequenciaN: 1,
      tipoInspecao: 'Integral',
      nivelInspecaoTexto: 'Inspecao Intensiva (100% dos itens)',
      nivelRomano: 'III',
      percentualAmostra: 100,
      nqa: 1.0,
      conformidadeMin: 0,
    },
  ];
  for (const p of periodicidades) {
    await prisma.periodicidadeConfig.upsert({
      where: { classificacao: p.classificacao },
      update: p,
      create: p,
    });
  }

  // Fornecedores (aba ESCOPO - Planilha de Planejamento de Inspecoes)
  // Campos sem informacao ficam em branco. Classificacao sem info -> 'C' (default de trabalho).
  const fornecedores = [
    {
      codigo: '780949',
      nome: 'Inobram',
      tipoFornecimento: 'Paineis eletricos',
      categoriaInspecao: 'Eletrico/Montagem',
      esforcoQualidade: 'BAIXO' as const,
      classificacaoFornecimento: 'A' as const,
      fazLote: false,
    },
    {
      codigo: '793940',
      nome: 'Metalurgica Barra do Pirai S/A',
      tipoFornecimento: 'Materia-prima',
      categoriaInspecao: 'Materia-prima',
      esforcoQualidade: 'MEDIO' as const,
      classificacaoFornecimento: 'C' as const,
      fazLote: true,
    },
    {
      codigo: '780962',
      nome: 'Lubing do Brasil Ltda',
      tipoFornecimento: 'Tubos e pecas injetadas em plastico',
      categoriaInspecao: 'Plastico injetado',
      esforcoQualidade: 'BAIXO' as const,
      classificacaoFornecimento: 'A' as const,
      fazLote: false,
    },
    {
      codigo: '780891',
      nome: 'Metalurgica Bello Ltda',
      tipoFornecimento: 'Aramados',
      categoriaInspecao: 'Aramados',
      esforcoQualidade: 'ALTO' as const,
      classificacaoFornecimento: 'D' as const,
      fazLote: true,
    },
    {
      codigo: '782950',
      nome: 'Brastil',
      tipoFornecimento: 'Tubos de aco',
      categoriaInspecao: 'Tubos',
      esforcoQualidade: 'ALTO' as const,
      classificacaoFornecimento: 'D' as const,
      fazLote: true,
    },
    {
      codigo: '781071',
      nome: 'Sew-Eurodrive Brasil Ltda',
      tipoFornecimento: 'Motoredutores',
      categoriaInspecao: 'Eletromecanico',
      esforcoQualidade: 'BAIXO' as const,
      classificacaoFornecimento: 'B' as const,
      fazLote: false,
    },
    {
      codigo: '788996',
      nome: 'Helptech',
      tipoFornecimento: 'Pecas injetadas',
      categoriaInspecao: 'Plastico injetado',
      esforcoQualidade: 'ALTO' as const,
      classificacaoFornecimento: 'D' as const,
      fazLote: true,
    },
    {
      codigo: '795392',
      nome: 'Cabomaq-Forestieri',
      tipoFornecimento: 'Cabos eletricos',
      categoriaInspecao: 'Eletrico',
      esforcoQualidade: 'BAIXO' as const,
      classificacaoFornecimento: 'A' as const,
      fazLote: false,
    },
    {
      codigo: '793036',
      nome: 'MM Plast',
      tipoFornecimento: 'Tubos extrudados PVC',
      categoriaInspecao: 'Plastico extrudado',
      esforcoQualidade: 'ALTO' as const,
      classificacaoFornecimento: 'D' as const,
      fazLote: true,
    },
    {
      codigo: '781051',
      nome: 'Polijet',
      tipoFornecimento: 'Pecas injetadas',
      categoriaInspecao: 'Plastico injetado',
      esforcoQualidade: 'ALTO' as const,
      classificacaoFornecimento: 'A' as const,
      fazLote: true,
    },
    {
      codigo: '791605',
      nome: 'Fusopar Parafusos',
      tipoFornecimento: 'Parafusos, Porcas, Arruelas',
      categoriaInspecao: 'Fixadores',
      esforcoQualidade: 'ALTO' as const,
      classificacaoFornecimento: 'D' as const,
      fazLote: true,
    },
    {
      codigo: '781091',
      nome: 'Weg Linhares',
      tipoFornecimento: 'Motores e Motoredutores',
      categoriaInspecao: 'Eletromecanico',
      esforcoQualidade: 'BAIXO' as const,
      classificacaoFornecimento: 'C' as const,
      fazLote: false,
    },
    {
      codigo: '781064',
      nome: 'Robustec',
      tipoFornecimento: 'Pecas metal mecanica',
      categoriaInspecao: 'Metalmecanica',
      esforcoQualidade: 'BAIXO' as const,
      classificacaoFornecimento: 'D' as const,
      fazLote: false,
    },
    {
      codigo: '782896',
      nome: 'Dancor',
      tipoFornecimento: 'Conjunto moto bomba',
      categoriaInspecao: 'Eletromecanico',
      esforcoQualidade: 'BAIXO' as const,
      classificacaoFornecimento: 'A' as const,
      fazLote: false,
    },
    {
      codigo: '791452',
      nome: 'Buzas',
      tipoFornecimento: 'Conjuntos/Pecas caldeiraria',
      categoriaInspecao: 'Solda/Caldeiraria',
      esforcoQualidade: 'ALTO' as const,
      classificacaoFornecimento: 'A' as const,
      fazLote: true,
    },
    {
      codigo: '788484',
      nome: 'Confortcel',
      tipoFornecimento: 'Placas Evaporativas',
      categoriaInspecao: 'Componentes',
      esforcoQualidade: 'BAIXO' as const,
      classificacaoFornecimento: 'C' as const,
      fazLote: false,
    },
    {
      codigo: '790124',
      nome: 'Santae',
      tipoFornecimento: 'Pecas Plastico/PVC',
      categoriaInspecao: 'Plastico injetado',
      esforcoQualidade: 'ALTO' as const,
      classificacaoFornecimento: 'A' as const,
      fazLote: true,
    },
    {
      codigo: '797193',
      nome: 'Morlan',
      tipoFornecimento: 'Materia-prima',
      categoriaInspecao: 'Materia-prima',
      esforcoQualidade: 'MEDIO' as const,
      classificacaoFornecimento: 'A' as const,
      fazLote: true,
    },
    {
      codigo: '795544',
      nome: 'Maccaferri',
      tipoFornecimento: 'Materia-prima',
      categoriaInspecao: 'Materia-prima',
      esforcoQualidade: 'MEDIO' as const,
      classificacaoFornecimento: 'D' as const,
      fazLote: true,
    },
    {
      codigo: '788638',
      nome: 'CRB Metalurgica',
      tipoFornecimento: 'Pecas usinadas',
      categoriaInspecao: 'Usinagem',
      esforcoQualidade: 'ALTO' as const,
      classificacaoFornecimento: 'D' as const,
      fazLote: true,
    },
    {
      codigo: '782461',
      nome: 'Weg Equipamentos',
      tipoFornecimento: 'Motores eletricos',
      categoriaInspecao: 'Eletromecanico',
      esforcoQualidade: 'BAIXO' as const,
      classificacaoFornecimento: 'C' as const,
      fazLote: false,
    },
    {
      codigo: '785405',
      nome: 'Tigre',
      tipoFornecimento: 'Tubos/Conexao PVC',
      categoriaInspecao: 'PVC',
      esforcoQualidade: 'ALTO' as const,
      classificacaoFornecimento: 'C' as const,
      fazLote: true,
    },
    {
      codigo: '793135',
      nome: 'Bekaert Ropes',
      tipoFornecimento: 'Cabos de aco',
      categoriaInspecao: 'Cabos de aco',
      esforcoQualidade: 'MEDIO' as const,
      classificacaoFornecimento: 'C' as const,
      fazLote: true,
    },
    {
      codigo: '771274',
      nome: 'Barbieri S.R.L.',
      tipoFornecimento: 'Esteiras Plastico',
      categoriaInspecao: 'Estrutural',
      esforcoQualidade: 'BAIXO' as const,
      classificacaoFornecimento: 'C' as const,
      fazLote: false,
    },
    {
      codigo: '790068',
      nome: 'Acotubo',
      tipoFornecimento: 'Conjuntos/Pecas caldeiraria',
      categoriaInspecao: 'Solda/Caldeiraria',
      esforcoQualidade: 'ALTO' as const,
      classificacaoFornecimento: 'D' as const,
      fazLote: true,
    },
    {
      codigo: '789706',
      nome: 'Acotech',
      tipoFornecimento: 'Conjuntos/Pecas caldeiraria',
      categoriaInspecao: 'Solda/Caldeiraria',
      esforcoQualidade: 'ALTO' as const,
      classificacaoFornecimento: 'D' as const,
      fazLote: true,
    },
    {
      codigo: '781070',
      nome: 'Scareli',
      tipoFornecimento: 'Conjuntos/Pecas caldeiraria',
      categoriaInspecao: 'Solda/Caldeiraria',
      esforcoQualidade: 'ALTO' as const,
      classificacaoFornecimento: 'D' as const,
      fazLote: true,
    },
    {
      codigo: '781025',
      nome: 'Parafusos Rudge Ramos',
      tipoFornecimento: 'Parafusos, Porcas, Arruelas',
      categoriaInspecao: 'Fixadores',
      esforcoQualidade: 'ALTO' as const,
      classificacaoFornecimento: 'D' as const,
      fazLote: true,
    },
    {
      codigo: '780988',
      nome: 'Metalurgica Luzi',
      tipoFornecimento: 'Pecas trefiladas',
      categoriaInspecao: 'Conformacao a frio',
      esforcoQualidade: 'ALTO' as const,
      classificacaoFornecimento: 'D' as const,
      fazLote: true,
    },
    {
      codigo: '781092',
      nome: 'Weg Drives',
      tipoFornecimento: 'Paineis eletricos e Inversores',
      categoriaInspecao: 'Eletrico/Montagem',
      esforcoQualidade: 'MEDIO' as const,
      classificacaoFornecimento: 'C' as const,
      fazLote: false,
    },
  ];

  for (const f of fornecedores) {
    await prisma.fornecedor.upsert({
      where: { codigo: f.codigo },
      update: {
        nome: f.nome,
        tipoFornecimento: f.tipoFornecimento,
        categoriaInspecao: f.categoriaInspecao,
        esforcoQualidade: f.esforcoQualidade,
        classificacaoFornecimento: f.classificacaoFornecimento,
        fazVisual: true,
        fazLote: f.fazLote,
      },
      create: {
        codigo: f.codigo,
        nome: f.nome,
        tipoFornecimento: f.tipoFornecimento,
        categoriaInspecao: f.categoriaInspecao,
        esforcoQualidade: f.esforcoQualidade,
        classificacaoFornecimento: f.classificacaoFornecimento,
        fazVisual: true,
        fazLote: f.fazLote,
      },
    });
  }

  console.log(
    `Seed concluido. ${fornecedores.length} fornecedores. Usuario admin:`,
    admin.email,
    '/ senha: 123456',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

```

---

## A.3 Backend — bootstrap e módulo raiz

### `backend/src/main.ts`

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Prefixo global /api (o nginx faz proxy de /api -> backend)
  app.setGlobalPrefix('api');

  // CORS liberado para a rede local
  app.enableCors({ origin: true, credentials: true });

  // Validacao automatica dos DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`Backend rodando na porta ${port}`);
}
bootstrap();

```

### `backend/src/app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { existsSync } from 'fs';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { FornecedoresModule } from './fornecedores/fornecedores.module';
import { PeriodicidadeModule } from './periodicidade/periodicidade.module';
import { ItensModule } from './itens/itens.module';
import { AnexosModule } from './anexos/anexos.module';
import { HistoricoModule } from './historico/historico.module';
import { PlanejamentoModule } from './sqe/planejamento/planejamento.module';
import { EntregasModule } from './sqe/entregas/entregas.module';
import { InspecoesModule } from './sqe/inspecoes/inspecoes.module';
import { RncModule } from './sqe/rnc/rnc.module';
import { DashboardModule } from './dashboard/dashboard.module';

// Pasta com o frontend ja compilado (usada no pacote portatil, onde o proprio
// backend serve as telas numa unica porta). No modo Docker/dev o nginx serve o
// frontend e esta pasta pode nao existir — por isso so ativamos se ela existir.
const frontendDir =
  process.env.FRONTEND_DIR || join(process.cwd(), 'public');
const servirFrontend = existsSync(frontendDir);

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ...(servirFrontend
      ? [
          ServeStaticModule.forRoot({
            rootPath: frontendDir,
            exclude: ['/api*'],
          }),
        ]
      : []),
    PrismaModule,
    AuthModule,
    UsuariosModule,
    FornecedoresModule,
    PeriodicidadeModule,
    ItensModule,
    AnexosModule,
    HistoricoModule,
    PlanejamentoModule,
    EntregasModule,
    InspecoesModule,
    RncModule,
    DashboardModule,
  ],
})
export class AppModule {}

```

---

## A.4 Backend — Prisma module

### `backend/src/prisma/prisma.module.ts`

```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}

```

### `backend/src/prisma/prisma.service.ts`

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }
}

```

---

## A.5 Backend — Auth

### `backend/src/auth/auth.controller.ts`

```typescript
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser, AuthUser } from './current-user.decorator';

class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(3)
  senha: string;
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.senha);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return user;
  }
}

```

### `backend/src/auth/auth.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret-trocar-em-producao',
      signOptions: { expiresIn: '12h' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}

```

### `backend/src/auth/auth.service.ts`

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async login(email: string, senha: string) {
    const usuario = await this.prisma.usuario.findUnique({ where: { email } });
    if (!usuario || !usuario.ativo) {
      throw new UnauthorizedException('Usuario ou senha invalidos');
    }
    const ok = await bcrypt.compare(senha, usuario.senhaHash);
    if (!ok) {
      throw new UnauthorizedException('Usuario ou senha invalidos');
    }
    const payload = {
      sub: usuario.id,
      email: usuario.email,
      nome: usuario.nome,
      papel: usuario.papel,
    };
    return {
      access_token: await this.jwt.signAsync(payload),
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        papel: usuario.papel,
      },
    };
  }
}

```

### `backend/src/auth/current-user.decorator.ts`

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthUser {
  id: number;
  email: string;
  nome: string;
  papel: string;
}

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

```

### `backend/src/auth/jwt-auth.guard.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

```

### `backend/src/auth/jwt.strategy.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  sub: number;
  email: string;
  nome: string;
  papel: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'dev-secret-trocar-em-producao',
    });
  }

  async validate(payload: JwtPayload) {
    return {
      id: payload.sub,
      email: payload.email,
      nome: payload.nome,
      papel: payload.papel,
    };
  }
}

```

### `backend/src/auth/roles.decorator.ts`

```typescript
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

```

### `backend/src/auth/roles.guard.ts`

```typescript
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }
    const { user } = context.switchToHttp().getRequest();
    return !!user && requiredRoles.includes(user.papel);
  }
}

```

---

## A.6 Backend — Usuários / Fornecedores / Itens / Periodicidade

### `backend/src/usuarios/usuarios.controller.ts`

```typescript
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { UsuariosService } from './usuarios.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

class CreateUsuarioDto {
  @IsString() nome: string;
  @IsEmail() email: string;
  @IsString() @MinLength(4) senha: string;
  @IsOptional() @IsIn(['QUALIDADE', 'PRODUCAO', 'ADMIN']) papel?: any;
}

class UpdateUsuarioDto {
  @IsOptional() @IsString() nome?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MinLength(4) senha?: string;
  @IsOptional() @IsIn(['QUALIDADE', 'PRODUCAO', 'ADMIN']) papel?: any;
  @IsOptional() @IsBoolean() ativo?: boolean;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('usuarios')
export class UsuariosController {
  constructor(private service: UsuariosService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  create(@Body() dto: CreateUsuarioDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUsuarioDto) {
    return this.service.update(id, dto);
  }
}

```

### `backend/src/usuarios/usuarios.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { UsuariosController } from './usuarios.controller';

@Module({
  providers: [UsuariosService],
  controllers: [UsuariosController],
})
export class UsuariosModule {}

```

### `backend/src/usuarios/usuarios.service.ts`

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

const selectSemSenha = {
  id: true,
  nome: true,
  email: true,
  papel: true,
  ativo: true,
  createdAt: true,
};

@Injectable()
export class UsuariosService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.usuario.findMany({
      select: selectSemSenha,
      orderBy: { nome: 'asc' },
    });
  }

  async create(data: {
    nome: string;
    email: string;
    senha: string;
    papel?: 'QUALIDADE' | 'PRODUCAO' | 'ADMIN';
  }) {
    const senhaHash = await bcrypt.hash(data.senha, 10);
    return this.prisma.usuario.create({
      data: {
        nome: data.nome,
        email: data.email,
        senhaHash,
        papel: data.papel ?? 'QUALIDADE',
      },
      select: selectSemSenha,
    });
  }

  async update(
    id: number,
    data: {
      nome?: string;
      email?: string;
      senha?: string;
      papel?: 'QUALIDADE' | 'PRODUCAO' | 'ADMIN';
      ativo?: boolean;
    },
  ) {
    const existe = await this.prisma.usuario.findUnique({ where: { id } });
    if (!existe) throw new NotFoundException('Usuario nao encontrado');
    const patch: any = {
      nome: data.nome,
      email: data.email,
      papel: data.papel,
      ativo: data.ativo,
    };
    if (data.senha) {
      patch.senhaHash = await bcrypt.hash(data.senha, 10);
    }
    return this.prisma.usuario.update({
      where: { id },
      data: patch,
      select: selectSemSenha,
    });
  }
}

```

### `backend/src/fornecedores/fornecedores.controller.ts`

```typescript
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

class ContatoDto {
  @IsString() nome: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() telefone?: string;
  @IsOptional() @IsString() funcao?: string;
}

class FornecedorDto {
  @IsOptional() @IsString() codigo?: string;
  @IsOptional() @IsString() nome?: string;
  @IsOptional() @IsString() cnpj?: string;
  @IsOptional() @IsString() endereco?: string;
  @IsOptional() @IsString() tipoFornecimento?: string;
  @IsOptional() @IsString() categoriaInspecao?: string;
  @IsOptional() @IsString() planoInspecao?: string;
  @IsOptional() @IsString() controlesPrincipais?: string;
  @IsOptional() @IsString() escopoTexto?: string;
  @IsOptional() @IsIn(['BAIXO', 'MEDIO', 'ALTO']) esforcoQualidade?: any;
  @IsOptional() @IsIn(['A', 'B', 'C', 'D']) classificacaoFornecimento?: any;
  @IsOptional() @IsBoolean() fazVisual?: boolean;
  @IsOptional() @IsBoolean() fazLote?: boolean;
  @IsOptional() @IsBoolean() ativo?: boolean;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContatoDto)
  contatos?: ContatoDto[];
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('fornecedores')
export class FornecedoresController {
  constructor(private prisma: PrismaService) {}

  @Get()
  findAll() {
    return this.prisma.fornecedor.findMany({
      orderBy: { nome: 'asc' },
      include: { contatos: true },
    });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.prisma.fornecedor.findUnique({
      where: { id },
      include: { contatos: true },
    });
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Post()
  create(@Body() dto: FornecedorDto) {
    const { contatos, ...rest } = dto;
    return this.prisma.fornecedor.create({
      data: {
        codigo: rest.codigo!,
        nome: rest.nome!,
        cnpj: rest.cnpj,
        endereco: rest.endereco,
        tipoFornecimento: rest.tipoFornecimento,
        categoriaInspecao: rest.categoriaInspecao,
        planoInspecao: rest.planoInspecao,
        controlesPrincipais: rest.controlesPrincipais,
        escopoTexto: rest.escopoTexto,
        esforcoQualidade: rest.esforcoQualidade ?? 'MEDIO',
        classificacaoFornecimento: rest.classificacaoFornecimento ?? 'C',
        fazVisual: rest.fazVisual ?? true,
        fazLote: rest.fazLote ?? false,
        contatos: contatos?.length
          ? { create: contatos.slice(0, 2) }
          : undefined,
      },
      include: { contatos: true },
    });
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: FornecedorDto,
  ) {
    const { contatos, ...rest } = dto;
    // Substitui os contatos (ate 2) se enviados
    if (contatos) {
      await this.prisma.contato.deleteMany({ where: { fornecedorId: id } });
    }
    return this.prisma.fornecedor.update({
      where: { id },
      data: {
        ...rest,
        contatos: contatos?.length
          ? { create: contatos.slice(0, 2) }
          : undefined,
      },
      include: { contatos: true },
    });
  }
}

```

### `backend/src/fornecedores/fornecedores.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { FornecedoresController } from './fornecedores.controller';

@Module({
  controllers: [FornecedoresController],
})
export class FornecedoresModule {}

```

### `backend/src/itens/itens.controller.ts`

```typescript
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

class CreateItemDto {
  @IsString() codigo: string;
  @IsString() descricao: string;
  @IsOptional() @IsString() unidade?: string;
  @IsOptional() @Type(() => Number) @IsInt() fornecedorId?: number;
}

class UpdateItemDto {
  @IsOptional() @IsString() codigo?: string;
  @IsOptional() @IsString() descricao?: string;
  @IsOptional() @IsString() unidade?: string;
  @IsOptional() @Type(() => Number) @IsInt() fornecedorId?: number;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('itens')
export class ItensController {
  constructor(private prisma: PrismaService) {}

  @Get()
  findAll(@Query('fornecedorId') fornecedorId?: string) {
    return this.prisma.item.findMany({
      where: fornecedorId ? { fornecedorId: Number(fornecedorId) } : undefined,
      include: { fornecedor: { select: { id: true, nome: true } } },
      orderBy: { descricao: 'asc' },
    });
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Post()
  create(@Body() dto: CreateItemDto) {
    return this.prisma.item.create({ data: dto });
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateItemDto) {
    return this.prisma.item.update({ where: { id }, data: dto });
  }
}

```

### `backend/src/itens/itens.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ItensController } from './itens.controller';

@Module({
  controllers: [ItensController],
})
export class ItensModule {}

```

### `backend/src/periodicidade/periodicidade.controller.ts`

```typescript
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { IsInt, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

class UpdatePeriodicidadeDto {
  @IsOptional() @IsString() periodicidadeTexto?: string;
  @IsOptional() @Type(() => Number) @IsInt() frequenciaN?: number;
  @IsOptional() @IsString() tipoInspecao?: string;
  @IsOptional() @IsString() nivelInspecaoTexto?: string;
  @IsOptional() @IsString() nivelRomano?: string;
  @IsOptional() @Type(() => Number) @IsInt() percentualAmostra?: number;
  @IsOptional() @Type(() => Number) @IsNumber() nqa?: number;
  @IsOptional() @Type(() => Number) @IsNumber() conformidadeMin?: number;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('periodicidade')
export class PeriodicidadeController {
  constructor(private prisma: PrismaService) {}

  @Get()
  findAll() {
    return this.prisma.periodicidadeConfig.findMany({
      orderBy: { classificacao: 'asc' },
    });
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Patch(':classificacao')
  update(
    @Param('classificacao') classificacao: string,
    @Body() dto: UpdatePeriodicidadeDto,
  ) {
    return this.prisma.periodicidadeConfig.update({
      where: { classificacao: classificacao as any },
      data: dto,
    });
  }
}

```

### `backend/src/periodicidade/periodicidade.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { PeriodicidadeController } from './periodicidade.controller';

@Module({
  controllers: [PeriodicidadeController],
})
export class PeriodicidadeModule {}

```

---

## A.7 Backend — Anexos / Histórico

### `backend/src/anexos/anexos.controller.ts`

```typescript
import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';

const UPLOAD_DIR = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');
if (!existsSync(UPLOAD_DIR)) {
  mkdirSync(UPLOAD_DIR, { recursive: true });
}

@UseGuards(JwtAuthGuard)
@Controller('anexos')
export class AnexosController {
  constructor(private prisma: PrismaService) {}

  // Upload: /api/anexos?entidadeTipo=RNC&entidadeId=1  (multipart, campo "file")
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req, file, cb) => {
          const unico = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `${unico}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Query('entidadeTipo') entidadeTipo: string,
    @Query('entidadeId') entidadeId: string,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) throw new BadRequestException('Arquivo obrigatorio');
    if (!entidadeTipo || !entidadeId) {
      throw new BadRequestException('entidadeTipo e entidadeId obrigatorios');
    }
    return this.prisma.anexo.create({
      data: {
        entidadeTipo,
        entidadeId: Number(entidadeId),
        nomeArquivo: file.originalname,
        caminho: file.filename,
        mimeType: file.mimetype,
        tamanho: file.size,
        uploadedById: user.id,
      },
    });
  }

  @Get()
  listar(
    @Query('entidadeTipo') entidadeTipo: string,
    @Query('entidadeId') entidadeId: string,
  ) {
    return this.prisma.anexo.findMany({
      where: { entidadeTipo, entidadeId: Number(entidadeId) },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get(':id/download')
  async download(@Param('id') id: string, @Res() res: Response) {
    const anexo = await this.prisma.anexo.findUnique({
      where: { id: Number(id) },
    });
    if (!anexo) throw new NotFoundException('Anexo nao encontrado');
    const caminhoAbs = join(UPLOAD_DIR, anexo.caminho);
    if (!existsSync(caminhoAbs)) {
      throw new NotFoundException('Arquivo fisico nao encontrado');
    }
    res.download(caminhoAbs, anexo.nomeArquivo);
  }
}

```

### `backend/src/anexos/anexos.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { AnexosController } from './anexos.controller';

@Module({
  controllers: [AnexosController],
})
export class AnexosModule {}

```

### `backend/src/historico/historico.controller.ts`

```typescript
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { HistoricoService } from './historico.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('historico')
export class HistoricoController {
  constructor(private service: HistoricoService) {}

  @Get(':entidadeTipo/:entidadeId')
  listar(
    @Param('entidadeTipo') entidadeTipo: string,
    @Param('entidadeId') entidadeId: string,
  ) {
    return this.service.listar(entidadeTipo, Number(entidadeId));
  }
}

```

### `backend/src/historico/historico.module.ts`

```typescript
import { Global, Module } from '@nestjs/common';
import { HistoricoService } from './historico.service';
import { HistoricoController } from './historico.controller';

@Global()
@Module({
  providers: [HistoricoService],
  controllers: [HistoricoController],
  exports: [HistoricoService],
})
export class HistoricoModule {}

```

### `backend/src/historico/historico.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HistoricoService {
  constructor(private prisma: PrismaService) {}

  registrar(params: {
    entidadeTipo: string;
    entidadeId: number;
    statusAnterior?: string | null;
    statusNovo: string;
    comentario?: string | null;
    usuarioId?: number | null;
  }) {
    return this.prisma.historicoStatus.create({
      data: {
        entidadeTipo: params.entidadeTipo,
        entidadeId: params.entidadeId,
        statusAnterior: params.statusAnterior ?? null,
        statusNovo: params.statusNovo,
        comentario: params.comentario ?? null,
        usuarioId: params.usuarioId ?? null,
      },
    });
  }

  listar(entidadeTipo: string, entidadeId: number) {
    return this.prisma.historicoStatus.findMany({
      where: { entidadeTipo, entidadeId },
      include: { usuario: { select: { id: true, nome: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  remover(entidadeTipo: string, entidadeId: number) {
    return this.prisma.historicoStatus.deleteMany({
      where: { entidadeTipo, entidadeId },
    });
  }
}

```

---

## A.8 Backend — SQE (utils, planejamento, entregas, inspeções, RNC)

### `backend/src/sqe/sqe-utils.ts`

```typescript
// Utilitarios do modulo SQE: semana (domingo->sabado), trimestre fiscal (out->set),
// bandas de conformidade e checklist padrao do formulario visual.

export type Classificacao = 'A' | 'B' | 'C' | 'D';

// Semana no formato "YYYY-Www", contando semanas de DOMINGO a SABADO.
// Ex: 05/07/2026 (dom) ate 11/07/2026 (sab) = 2026-W28.
export function semanaReferencia(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const year = date.getUTCFullYear();
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const dayOfYear = Math.floor((date.getTime() - jan1.getTime()) / 86400000);
  const week = Math.floor((dayOfYear + jan1.getUTCDay()) / 7) + 1;
  return `${year}-W${String(week).padStart(2, '0')}`;
}

// Semana no formato "W##" (2 digitos) e ano, contando semanas de DOMINGO a SABADO.
// Ex: 05/07/2026 => { semana: "W28", ano: 2026 }.
export function semanaAno(d: Date): { semana: string; ano: number } {
  const ref = semanaReferencia(d); // "2026-W28"
  const [ano, semana] = ref.split('-');
  return { semana, ano: Number(ano) };
}

// Trimestre fiscal da empresa: ano fiscal comeca em outubro.
// Out-Dez=Q1, Jan-Mar=Q2, Abr-Jun=Q3, Jul-Set=Q4.
export function trimestreFiscal(d: Date): {
  label: string;
  inicio: Date;
  fim: Date;
} {
  const mes = d.getMonth(); // 0-11
  const ano = d.getFullYear();
  let fy: number; // ano fiscal (ano do fim, set)
  let q: number;
  let inicioMes: number;
  let inicioAno: number;
  if (mes >= 9) {
    // Out(9), Nov(10), Dez(11) => Q1, ano fiscal = ano+1
    fy = ano + 1;
    q = 1;
    inicioMes = 9;
    inicioAno = ano;
  } else if (mes <= 2) {
    fy = ano;
    q = 2;
    inicioMes = 0;
    inicioAno = ano;
  } else if (mes <= 5) {
    fy = ano;
    q = 3;
    inicioMes = 3;
    inicioAno = ano;
  } else {
    fy = ano;
    q = 4;
    inicioMes = 6;
    inicioAno = ano;
  }
  const inicio = new Date(inicioAno, inicioMes, 1);
  const fim = new Date(inicioAno, inicioMes + 3, 0, 23, 59, 59); // ultimo dia do trimestre
  const label = `FY${String(fy).slice(-2)}-Q${q}`;
  return { label, inicio, fim };
}

// % de conformidade = (inspecionados - reprovados) / inspecionados * 100
export function pctConformidade(
  inspecionados: number,
  reprovados: number,
): number {
  if (!inspecionados) return 0;
  return Math.round(((inspecionados - reprovados) / inspecionados) * 1000) / 10;
}

// Classificacao apurada pela % de conformidade (bandas oficiais)
// A>=98, B 90-97.99, C 80-89.99, D<80
export function classificarPorConformidade(pct: number): Classificacao {
  if (pct >= 98) return 'A';
  if (pct >= 90) return 'B';
  if (pct >= 80) return 'C';
  return 'D';
}

// Checklist padrao do formulario VISUAL (Doc BDBR.QUA.FMR.06.07) - 12 grupos.
// Reproduzido fielmente da planilha (principio de fidelidade).
export const CHECKLIST_VISUAL_PADRAO = [
  {
    grupo: '1. Condicoes Gerais',
    itens: [
      'Identificacao do material conforme documentacao',
      'Embalagem adequada e sem avarias',
    ],
  },
  {
    grupo: '2. Corte',
    itens: [
      'Dimensoes de corte conforme desenho',
      'Ausencia de rebarbas',
      'Esquadro/alinhamento',
      'Acabamento das bordas',
    ],
  },
  {
    grupo: '3. Dobra',
    itens: [
      'Angulo de dobra conforme especificacao',
      'Ausencia de trincas na dobra',
      'Raio de dobra adequado',
    ],
  },
  {
    grupo: '4. Usinagem',
    itens: [
      'Furacao conforme desenho',
      'Roscas conformes',
      'Acabamento superficial',
    ],
  },
  {
    grupo: '5. Solda',
    itens: [
      'Cordao de solda continuo',
      'Ausencia de porosidade',
      'Ausencia de respingos',
      'Penetracao adequada',
      'Alinhamento das pecas soldadas',
      'Ausencia de trincas',
    ],
  },
  {
    grupo: '6. Zincagem Eletrolitica',
    itens: [
      'Uniformidade da camada',
      'Ausencia de oxidacao',
      'Aderencia do revestimento',
      'Aspecto visual',
      'Ausencia de bolhas/descascamento',
    ],
  },
  {
    grupo: '7. Galvanizacao a Fogo',
    itens: [
      'Uniformidade da camada',
      'Ausencia de escorrimento excessivo',
      'Aderencia',
      'Ausencia de falhas de revestimento',
      'Aspecto visual',
    ],
  },
  {
    grupo: '8. Pintura Epoxi',
    itens: [
      'Cor conforme especificacao',
      'Uniformidade da pintura',
      'Aderencia',
      'Ausencia de escorrimento',
      'Ausencia de falhas/riscos',
      'Espessura adequada',
    ],
  },
  {
    grupo: '9. Tubos',
    itens: ['Diametro conforme especificacao', 'Ausencia de amassamento'],
  },
  {
    grupo: '10. Injecao',
    itens: [
      'Ausencia de rebarbas',
      'Ausencia de bolhas/chupados',
      'Cor conforme padrao',
      'Dimensional conforme desenho',
      'Acabamento superficial',
    ],
  },
  {
    grupo: '11. Malha de Arame',
    itens: [
      'Abertura da malha conforme especificacao',
      'Soldas dos pontos de cruzamento',
      'Ausencia de oxidacao',
      'Acabamento das pontas',
    ],
  },
  {
    grupo: '12. Condicoes Finais',
    itens: [
      'Quantidade conforme nota fiscal',
      'Identificacao/etiquetagem final',
      'Embalagem para expedicao',
    ],
  },
];

export function checklistVisualInicial() {
  return CHECKLIST_VISUAL_PADRAO.map((g) => ({
    grupo: g.grupo,
    itens: g.itens.map((texto) => ({ texto, status: 'NAO_APLICAVEL' })),
  }));
}

```

### `backend/src/sqe/planejamento/planejamento.controller.ts`

```typescript
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser, AuthUser } from '../../auth/current-user.decorator';

class CreatePlanejamentoDto {
  @IsString() semanaReferencia: string;
  @Type(() => Number) @IsInt() fornecedorId: number;
  @IsOptional() @Type(() => Number) @IsInt() itemId?: number;
  @IsOptional() @IsString() dataPrevista?: string;
}

const includePadrao = {
  fornecedor: { select: { id: true, nome: true, codigo: true } },
  item: { select: { id: true, descricao: true, codigo: true } },
};

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('planejamento-semanal')
export class PlanejamentoController {
  constructor(private prisma: PrismaService) {}

  @Get()
  findAll(@Query('semana') semana?: string) {
    return this.prisma.planejamentoSemanal.findMany({
      where: semana ? { semanaReferencia: semana } : undefined,
      include: includePadrao,
      orderBy: { createdAt: 'desc' },
    });
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Post()
  create(@Body() dto: CreatePlanejamentoDto, @CurrentUser() user: AuthUser) {
    return this.prisma.planejamentoSemanal.create({
      data: {
        semanaReferencia: dto.semanaReferencia,
        fornecedorId: dto.fornecedorId,
        itemId: dto.itemId ?? null,
        dataPrevista: dto.dataPrevista ? new Date(dto.dataPrevista) : null,
        criadoPorId: user.id,
      },
      include: includePadrao,
    });
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Patch(':id/entregue')
  marcarEntregue(@Param('id', ParseIntPipe) id: number) {
    return this.prisma.planejamentoSemanal.update({
      where: { id },
      data: { status: 'ENTREGUE' },
      include: includePadrao,
    });
  }
}

```

### `backend/src/sqe/planejamento/planejamento.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { PlanejamentoController } from './planejamento.controller';

@Module({
  controllers: [PlanejamentoController],
})
export class PlanejamentoModule {}

```

### `backend/src/sqe/entregas/entregas.controller.ts`

```typescript
import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { IsInt, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser, AuthUser } from '../../auth/current-user.decorator';
import { semanaReferencia } from '../sqe-utils';

class CreateEntregaDto {
  @IsOptional() @Type(() => Number) @IsInt() planejamentoId?: number;
  @Type(() => Number) @IsInt() fornecedorId: number;
  @IsOptional() @Type(() => Number) @IsInt() itemId?: number;
  @IsOptional() @IsString() dataEntrega?: string;
  @IsOptional() @IsString() notaFiscal?: string;
  @IsOptional() @IsString() po?: string;
  @IsOptional() @Type(() => Number) @IsNumber() quantidade?: number;
}

const includePadrao = {
  fornecedor: {
    select: {
      id: true,
      nome: true,
      codigo: true,
      classificacaoFornecimento: true,
      fazVisual: true,
      fazLote: true,
    },
  },
  item: { select: { id: true, descricao: true, codigo: true } },
};

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('entregas')
export class EntregasController {
  constructor(private prisma: PrismaService) {}

  @Get()
  findAll(@Query('fornecedorId') fornecedorId?: string) {
    return this.prisma.entregaPortaria.findMany({
      where: fornecedorId ? { fornecedorId: Number(fornecedorId) } : undefined,
      include: {
        ...includePadrao,
        inspecoesVisual: { select: { id: true, resultado: true } },
        inspecoesLote: { select: { id: true, resultado: true } },
      },
      orderBy: { dataEntrega: 'desc' },
    });
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Post()
  async create(@Body() dto: CreateEntregaDto, @CurrentUser() user: AuthUser) {
    const fornecedor = await this.prisma.fornecedor.findUniqueOrThrow({
      where: { id: dto.fornecedorId },
    });

    // Frequencia de inspecao conforme a classificacao de fornecimento
    const config = await this.prisma.periodicidadeConfig.findUnique({
      where: { classificacao: fornecedor.classificacaoFornecimento },
    });
    const frequenciaN = config?.frequenciaN ?? 1;

    // Contador ciclico: incrementa; se atingir a frequencia, dispara inspecao e zera.
    const novoContador = fornecedor.contadorEntregas + 1;
    const passivelInspecao = novoContador >= frequenciaN;

    const data = dto.dataEntrega ? new Date(dto.dataEntrega) : new Date();

    const entrega = await this.prisma.entregaPortaria.create({
      data: {
        planejamentoId: dto.planejamentoId ?? null,
        fornecedorId: dto.fornecedorId,
        itemId: dto.itemId ?? null,
        dataEntrega: data,
        semanaReferencia: semanaReferencia(data),
        notaFiscal: dto.notaFiscal ?? null,
        po: dto.po ?? null,
        quantidade: dto.quantidade ?? null,
        numeroEntregaAcumulado: novoContador,
        passivelInspecao,
        confirmadoPorId: user.id,
      },
      include: includePadrao,
    });

    // Atualiza contadores do fornecedor
    await this.prisma.fornecedor.update({
      where: { id: fornecedor.id },
      data: {
        totalEntregas: { increment: 1 },
        contadorEntregas: passivelInspecao ? 0 : novoContador,
      },
    });

    // Marca o planejamento vinculado como ENTREGUE
    if (dto.planejamentoId) {
      await this.prisma.planejamentoSemanal.update({
        where: { id: dto.planejamentoId },
        data: { status: 'ENTREGUE' },
      });
    }

    return entrega;
  }
}

```

### `backend/src/sqe/entregas/entregas.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { EntregasController } from './entregas.controller';

@Module({
  controllers: [EntregasController],
})
export class EntregasModule {}

```

### `backend/src/sqe/inspecoes/inspecoes.controller.ts`

```typescript
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { InspecoesService } from './inspecoes.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser, AuthUser } from '../../auth/current-user.decorator';

const ORIGENS = [
  'PLANO_INSPECAO',
  'HOMOLOGACAO',
  'DEVOLUCAO',
  'RETRABALHO',
  'RELATORIO_OCORRENCIA',
  'OUTROS',
];

class CabecalhoDto {
  @IsOptional() @Type(() => Number) @IsInt() entregaId?: number;
  @Type(() => Number) @IsInt() fornecedorId: number;
  @IsOptional() @Type(() => Number) @IsInt() itemId?: number;
  @IsOptional() @IsString() itemCodigo?: string;
  @IsOptional() @IsString() itemDescricao?: string;
  @IsOptional() @IsString() desenhoRev?: string;
  @IsOptional() @IsString() toleranciasNorm?: string;
  @IsOptional() @IsString() notaFiscal?: string;
  @IsOptional() @IsString() po?: string;
  @IsOptional() @Type(() => Number) @IsNumber() qtdInspecionada?: number;
  @IsOptional() @Type(() => Number) @IsNumber() qtdTotal?: number;
  @IsOptional() @IsString() relatorioNumero?: string;
  @IsOptional() @IsIn(ORIGENS) origem?: any;
  @IsOptional() @IsString() observacoes?: string;
  @IsOptional() @IsIn(['APROVADO', 'REPROVADO']) resultado?: any;
  @IsOptional() @IsString() dataInspecao?: string;
  @IsOptional() @IsString() disposicao?: string;
}

class CreateVisualDto extends CabecalhoDto {
  @IsOptional() @IsArray() checklist?: any[];
}

class CreateLoteDto extends CabecalhoDto {
  @IsOptional() @IsArray() cotas?: any[];
  @IsOptional() @IsBoolean() encadeadoAposVisual?: boolean;
}

class RecebimentoDto {
  @Type(() => Number) @IsInt() fornecedorId: number;
  @IsOptional() @Type(() => Number) @IsInt() itemId?: number;
  @IsOptional() @IsString() dataEntrega?: string;
  @IsOptional() @IsString() notaFiscal?: string;
  @IsOptional() @IsString() po?: string;
  @IsOptional() @Type(() => Number) @IsNumber() qtdTotal?: number;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inspecoes')
export class InspecoesController {
  constructor(
    private service: InspecoesService,
    private prisma: PrismaService,
  ) {}

  // Template do checklist visual (12 grupos)
  @Get('template-visual')
  templateVisual() {
    return this.service.templateVisual();
  }

  @Get()
  findAll(@Query('fornecedorId') fornecedorId?: string) {
    return this.service.listarTodas(
      fornecedorId ? Number(fornecedorId) : undefined,
    );
  }

  // Avalia se o fornecedor deve ser inspecionado nesta entrega
  @Get('avaliar')
  avaliar(@Query('fornecedorId', ParseIntPipe) fornecedorId: number) {
    return this.service.avaliarRecebimento(fornecedorId);
  }

  // Registra recebimento sem inspecao (ciclo de periodicidade nao exige)
  @Roles('QUALIDADE', 'ADMIN')
  @Post('recebimento')
  recebimento(@Body() dto: RecebimentoDto, @CurrentUser() user: AuthUser) {
    return this.service.registrarRecebimento(dto, user.id);
  }

  @Get('visual/:id')
  async findVisual(@Param('id', ParseIntPipe) id: number) {
    const insp = await this.prisma.inspecaoVisual.findUnique({
      where: { id },
      include: {
        fornecedor: { select: { id: true, nome: true, codigo: true } },
        item: { select: { id: true, descricao: true, codigo: true } },
        inspetor: { select: { id: true, nome: true } },
        rncs: { select: { id: true, numero: true, status: true } },
      },
    });
    if (!insp) throw new NotFoundException('Inspeção não encontrada');
    return { ...insp, tipoFormulario: 'VISUAL' };
  }

  @Get('lote/:id')
  async findLote(@Param('id', ParseIntPipe) id: number) {
    const insp = await this.prisma.inspecaoLote.findUnique({
      where: { id },
      include: {
        fornecedor: { select: { id: true, nome: true, codigo: true } },
        item: { select: { id: true, descricao: true, codigo: true } },
        inspetor: { select: { id: true, nome: true } },
        rncs: { select: { id: true, numero: true, status: true } },
      },
    });
    if (!insp) throw new NotFoundException('Inspeção não encontrada');
    return { ...insp, tipoFormulario: 'LOTE' };
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Post('visual')
  criarVisual(@Body() dto: CreateVisualDto, @CurrentUser() user: AuthUser) {
    return this.service.criarVisual(dto, user.id);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Post('lote')
  criarLote(@Body() dto: CreateLoteDto, @CurrentUser() user: AuthUser) {
    return this.service.criarLote(dto, user.id);
  }

  // Exclusao permanente - restrito a ADMIN.
  // cascade=true tambem apaga as RNCs vinculadas.
  @Roles('ADMIN')
  @Delete('visual/:id')
  deletarVisual(
    @Param('id', ParseIntPipe) id: number,
    @Query('cascade') cascade?: string,
  ) {
    return this.service.deletarVisual(id, cascade === 'true');
  }

  @Roles('ADMIN')
  @Delete('lote/:id')
  deletarLote(
    @Param('id', ParseIntPipe) id: number,
    @Query('cascade') cascade?: string,
  ) {
    return this.service.deletarLote(id, cascade === 'true');
  }
}

```

### `backend/src/sqe/inspecoes/inspecoes.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { InspecoesController } from './inspecoes.controller';
import { InspecoesService } from './inspecoes.service';
import { RncModule } from '../rnc/rnc.module';

@Module({
  imports: [RncModule],
  controllers: [InspecoesController],
  providers: [InspecoesService],
})
export class InspecoesModule {}

```

### `backend/src/sqe/inspecoes/inspecoes.service.ts`

```typescript
import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RncService } from '../rnc/rnc.service';
import {
  checklistVisualInicial,
  semanaAno,
  semanaReferencia,
} from '../sqe-utils';

const includeVisual = {
  fornecedor: { select: { id: true, nome: true, codigo: true } },
  item: { select: { id: true, descricao: true, codigo: true } },
  inspetor: { select: { id: true, nome: true } },
  rncs: { select: { id: true, numero: true, status: true } },
};

@Injectable()
export class InspecoesService {
  constructor(
    private prisma: PrismaService,
    private rnc: RncService,
  ) {}

  templateVisual() {
    return checklistVisualInicial();
  }

  // Lista unificada de inspecoes (visual + lote) + recebimentos sem inspecao,
  // ordenada por data (mais recente primeiro), para a tela de Inspecoes.
  async listarTodas(fornecedorId?: number) {
    const where = fornecedorId ? { fornecedorId } : {};
    const [visuais, lotes, entregas] = await Promise.all([
      this.prisma.inspecaoVisual.findMany({
        where,
        include: includeVisual,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.inspecaoLote.findMany({
        where,
        include: includeVisual,
        orderBy: { createdAt: 'desc' },
      }),
      // Recebimentos que nao geraram inspecao (sem inspecao recomendada)
      this.prisma.entregaPortaria.findMany({
        where: {
          ...where,
          inspecoesVisual: { none: {} },
          inspecoesLote: { none: {} },
        },
        include: {
          fornecedor: { select: { id: true, nome: true, codigo: true } },
          item: { select: { id: true, descricao: true, codigo: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    const marcar = (arr: any[], tipo: string) =>
      arr.map((i) => ({ ...i, tipoFormulario: tipo }));
    const recebimentos = entregas.map((e) => ({
      ...e,
      tipoFormulario: 'RECEBIMENTO',
      resultado: 'SEM_INSPECAO',
      dataInspecao: e.dataEntrega,
      rncs: [],
    }));
    return [
      ...marcar(visuais, 'VISUAL'),
      ...marcar(lotes, 'LOTE'),
      ...recebimentos,
    ].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  // Exclusao de inspecao (restrito a ADMIN no controller).
  // Se houver RNC vinculada e cascade=false, bloqueia e retorna a RNC.
  async deletarVisual(id: number, cascade: boolean) {
    const insp = await this.prisma.inspecaoVisual.findUnique({
      where: { id },
      include: {
        rncs: { select: { id: true, numero: true } },
        entrega: {
          include: {
            inspecoesVisual: { select: { id: true } },
            inspecoesLote: { select: { id: true } },
          },
        },
      },
    });
    if (!insp) throw new ConflictException('Inspecao nao encontrada');
    await this.removerRncsVinculadas(insp.rncs, cascade);
    await this.prisma.inspecaoVisual.delete({ where: { id } });
    await this.reverterInspecao(insp, 'VISUAL');
    return { ok: true };
  }

  async deletarLote(id: number, cascade: boolean) {
    const insp = await this.prisma.inspecaoLote.findUnique({
      where: { id },
      include: {
        rncs: { select: { id: true, numero: true } },
        entrega: {
          include: {
            inspecoesVisual: { select: { id: true } },
            inspecoesLote: { select: { id: true } },
          },
        },
      },
    });
    if (!insp) throw new ConflictException('Inspecao nao encontrada');
    await this.removerRncsVinculadas(insp.rncs, cascade);
    await this.prisma.inspecaoLote.delete({ where: { id } });
    await this.reverterInspecao(insp, 'LOTE');
    return { ok: true };
  }

  // Desfaz os incrementos feitos ao criar a inspecao e limpa a carga recebida
  // (EntregaPortaria) quando ela nao tem mais nenhuma inspecao. Assim uma
  // inspecao excluida por engano nao vira "recebimento sem inspecao" fantasma.
  private async reverterInspecao(insp: any, tipo: 'VISUAL' | 'LOTE') {
    const reprovado = insp.resultado === 'REPROVADO';
    const entrega = insp.entrega;
    const restamVisual = (entrega?.inspecoesVisual ?? []).filter(
      (v: any) => !(tipo === 'VISUAL' && v.id === insp.id),
    );
    const restamLote = (entrega?.inspecoesLote ?? []).filter(
      (l: any) => !(tipo === 'LOTE' && l.id === insp.id),
    );
    // Lote encadeado apos Visual nao gerou credito de entrega/inspecao no
    // fornecedor (so contou lote); os demais casos sim.
    const encadeadoLote = tipo === 'LOTE' && restamVisual.length > 0;
    const teveCreditoEntrega = !encadeadoLote;

    const f = await this.prisma.fornecedor.findUnique({
      where: { id: insp.fornecedorId },
    });
    if (f) {
      await this.prisma.fornecedor.update({
        where: { id: insp.fornecedorId },
        data: {
          totalEntregas: teveCreditoEntrega
            ? Math.max(0, f.totalEntregas - 1)
            : undefined,
          totalInspecoes: teveCreditoEntrega
            ? Math.max(0, f.totalInspecoes - 1)
            : undefined,
          lotesInspecionados: Math.max(0, f.lotesInspecionados - 1),
          lotesReprovados: reprovado
            ? Math.max(0, f.lotesReprovados - 1)
            : undefined,
        },
      });
    }

    // Carga sem nenhuma inspecao restante: remove a EntregaPortaria.
    if (entrega && restamVisual.length === 0 && restamLote.length === 0) {
      await this.prisma.entregaPortaria
        .delete({ where: { id: entrega.id } })
        .catch(() => undefined);
    }
  }

  private async removerRncsVinculadas(
    rncs: { id: number; numero: string }[],
    cascade: boolean,
  ) {
    if (!rncs.length) return;
    if (!cascade) {
      throw new ConflictException({
        message: 'Existe RNC vinculada a esta inspecao.',
        rncs,
      });
    }
    for (const r of rncs) {
      await this.rnc.remover(r.id);
    }
  }

  // Avalia, na abertura de uma inspecao, se o fornecedor deve ser inspecionado
  // nesta entrega (classificacao + periodicidade + contador ciclico).
  async avaliarRecebimento(fornecedorId: number) {
    const fornecedor = await this.prisma.fornecedor.findUniqueOrThrow({
      where: { id: fornecedorId },
    });
    const config = await this.prisma.periodicidadeConfig.findUnique({
      where: { classificacao: fornecedor.classificacaoFornecimento },
    });
    const frequenciaN = config?.frequenciaN ?? 1;
    const proximoContador = fornecedor.contadorEntregas + 1;
    const precisaInspecionar = proximoContador >= frequenciaN;

    return {
      fornecedor: {
        id: fornecedor.id,
        nome: fornecedor.nome,
        codigo: fornecedor.codigo,
        classificacaoFornecimento: fornecedor.classificacaoFornecimento,
        fazVisual: fornecedor.fazVisual,
        fazLote: fornecedor.fazLote,
      },
      periodicidade: config,
      frequenciaN,
      contadorAtual: fornecedor.contadorEntregas,
      proximoContador,
      precisaInspecionar,
    };
  }

  // Resolve o item a partir de texto livre (a Qualidade define o item na inspecao).
  // Reaproveita item existente por codigo/descricao ou cria um novo.
  private async resolverItemId(dto: any): Promise<number> {
    if (dto.itemId) return dto.itemId;
    const codigo = (dto.itemCodigo ?? '').trim();
    const descricao = (dto.itemDescricao ?? '').trim();

    if (codigo) {
      const existente = await this.prisma.item.findUnique({
        where: { codigo },
      });
      if (existente) return existente.id;
      const criado = await this.prisma.item.create({
        data: {
          codigo,
          descricao: descricao || codigo,
          fornecedorId: dto.fornecedorId ?? null,
        },
      });
      return criado.id;
    }

    if (descricao) {
      const existente = await this.prisma.item.findFirst({
        where: { descricao, fornecedorId: dto.fornecedorId ?? null },
      });
      if (existente) return existente.id;
      const criado = await this.prisma.item.create({
        data: {
          codigo: `AUTO-${Date.now()}`,
          descricao,
          fornecedorId: dto.fornecedorId ?? null,
        },
      });
      return criado.id;
    }

    const criado = await this.prisma.item.create({
      data: {
        codigo: `AUTO-${Date.now()}`,
        descricao: 'Item nao especificado',
        fornecedorId: dto.fornecedorId ?? null,
      },
    });
    return criado.id;
  }

  // Registra uma entrega sem inspecao (quando o ciclo de periodicidade nao
  // exige inspecao neste recebimento). Avanca o contador ciclico.
  async registrarRecebimento(dto: any, usuarioId: number) {
    const fornecedor = await this.prisma.fornecedor.findUniqueOrThrow({
      where: { id: dto.fornecedorId },
    });
    const config = await this.prisma.periodicidadeConfig.findUnique({
      where: { classificacao: fornecedor.classificacaoFornecimento },
    });
    const frequenciaN = config?.frequenciaN ?? 1;
    const novoContador = fornecedor.contadorEntregas + 1;
    const passivelInspecao = novoContador >= frequenciaN;

    const data = dto.dataEntrega ? new Date(dto.dataEntrega) : new Date();
    const { semana, ano } = semanaAno(data);
    const entrega = await this.prisma.entregaPortaria.create({
      data: {
        fornecedorId: dto.fornecedorId,
        itemId: dto.itemId ?? null,
        dataEntrega: data,
        semanaReferencia: semanaReferencia(data),
        semana,
        ano,
        notaFiscal: dto.notaFiscal ?? null,
        po: dto.po ?? null,
        quantidade: dto.qtdTotal ?? dto.quantidade ?? null,
        numeroEntregaAcumulado: novoContador,
        passivelInspecao,
        confirmadoPorId: usuarioId,
      },
    });

    await this.prisma.fornecedor.update({
      where: { id: fornecedor.id },
      data: {
        totalEntregas: { increment: 1 },
        contadorEntregas: passivelInspecao ? 0 : novoContador,
      },
    });

    return { entrega, inspecionado: false, passivelInspecao };
  }

  // Atualiza contadores do fornecedor apos uma inspecao (a inspecao tambem
  // conta como uma entrega recebida e zera o contador ciclico).
  private async atualizarContadores(fornecedorId: number, reprovado: boolean) {
    await this.prisma.fornecedor.update({
      where: { id: fornecedorId },
      data: {
        totalEntregas: { increment: 1 },
        totalInspecoes: { increment: 1 },
        lotesInspecionados: { increment: 1 },
        lotesReprovados: reprovado ? { increment: 1 } : undefined,
        contadorEntregas: 0,
      },
    });
  }

  // Toda inspecao representa uma carga recebida: cria (ou reaproveita, no
  // encadeamento Visual->Lote) a EntregaPortaria correspondente. Uma unica
  // entrega por recebimento, mesmo que faca Visual + Lote.
  private async entregaDaInspecao(
    dto: any,
    itemId: number,
    dataInsp: Date,
    usuarioId: number,
  ): Promise<number> {
    if (dto.entregaId) return dto.entregaId;
    const { semana, ano } = semanaAno(dataInsp);
    const entrega = await this.prisma.entregaPortaria.create({
      data: {
        fornecedorId: dto.fornecedorId,
        itemId,
        dataEntrega: dataInsp,
        semanaReferencia: semanaReferencia(dataInsp),
        semana,
        ano,
        notaFiscal: dto.notaFiscal ?? null,
        po: dto.po ?? null,
        quantidade: dto.qtdTotal ?? null,
        passivelInspecao: true,
        confirmadoPorId: usuarioId,
      },
    });
    return entrega.id;
  }

  async criarVisual(dto: any, usuarioId: number) {
    const itemId = await this.resolverItemId(dto);
    const dataInsp = dto.dataInspecao ? new Date(dto.dataInspecao) : new Date();
    const { semana, ano } = semanaAno(dataInsp);
    const entregaId = await this.entregaDaInspecao(
      dto,
      itemId,
      dataInsp,
      usuarioId,
    );
    const insp = await this.prisma.inspecaoVisual.create({
      data: {
        entregaId,
        fornecedorId: dto.fornecedorId,
        itemId,
        dataInspecao: dataInsp,
        semana,
        ano,
        desenhoRev: dto.desenhoRev ?? null,
        toleranciasNorm: dto.toleranciasNorm ?? null,
        notaFiscal: dto.notaFiscal ?? null,
        po: dto.po ?? null,
        qtdInspecionada: dto.qtdInspecionada ?? null,
        qtdTotal: dto.qtdTotal ?? null,
        relatorioNumero: dto.relatorioNumero ?? null,
        origem: dto.origem ?? 'PLANO_INSPECAO',
        checklist: dto.checklist ?? checklistVisualInicial(),
        observacoes: dto.observacoes ?? null,
        resultado: dto.resultado ?? 'APROVADO',
        inspetorId: usuarioId,
      },
      include: includeVisual,
    });

    const reprovado = insp.resultado === 'REPROVADO';
    await this.atualizarContadores(dto.fornecedorId, reprovado);

    let rnc: any = null;
    if (reprovado) {
      const itensReprovados = this.itensReprovados(dto.checklist);
      rnc = await this.rnc.create(
        {
          inspecaoVisualId: insp.id,
          fornecedorId: dto.fornecedorId,
          itemId,
          notaFiscal: dto.notaFiscal,
          po: dto.po,
          quantidadeLote: dto.qtdTotal,
          quantidadePecas: dto.qtdTotal,
          tipoDesvio: itensReprovados.length
            ? `Visual: ${itensReprovados.join('; ')}`
            : 'Inspeção Visual reprovada',
          descricaoDesvio:
            dto.observacoes ||
            (itensReprovados.length
              ? `Itens reprovados: ${itensReprovados.join('; ')}`
              : 'Não conformidade identificada na inspeção visual.'),
          disposicao: dto.disposicao ?? null,
        },
        usuarioId,
      );
    }

    return { inspecao: insp, rnc };
  }

  async criarLote(dto: any, usuarioId: number) {
    const itemId = await this.resolverItemId(dto);
    const dataInsp = dto.dataInspecao ? new Date(dto.dataInspecao) : new Date();
    const { semana, ano } = semanaAno(dataInsp);
    // Encadeado apos Visual: reaproveita a mesma entrega (dto.entregaId).
    const entregaId = await this.entregaDaInspecao(
      dto,
      itemId,
      dataInsp,
      usuarioId,
    );
    const insp = await this.prisma.inspecaoLote.create({
      data: {
        entregaId,
        fornecedorId: dto.fornecedorId,
        itemId,
        dataInspecao: dataInsp,
        semana,
        ano,
        desenhoRev: dto.desenhoRev ?? null,
        toleranciasNorm: dto.toleranciasNorm ?? null,
        notaFiscal: dto.notaFiscal ?? null,
        po: dto.po ?? null,
        qtdInspecionada: dto.qtdInspecionada ?? null,
        qtdTotal: dto.qtdTotal ?? null,
        relatorioNumero: dto.relatorioNumero ?? null,
        origem: dto.origem ?? 'PLANO_INSPECAO',
        cotas: dto.cotas ?? [],
        observacoes: dto.observacoes ?? null,
        resultado: dto.resultado ?? 'APROVADO',
        inspetorId: usuarioId,
      },
      include: includeVisual,
    });

    const reprovado = insp.resultado === 'REPROVADO';
    // Quando o Lote e a segunda etapa de um recebimento que ja fez o Visual
    // (encadeamento Visual->Lote), a entrega ja foi contabilizada no Visual;
    // aqui contamos apenas a inspecao de lote e a eventual reprova.
    if (dto.encadeadoAposVisual) {
      await this.prisma.fornecedor.update({
        where: { id: dto.fornecedorId },
        data: {
          lotesInspecionados: { increment: 1 },
          lotesReprovados: reprovado ? { increment: 1 } : undefined,
        },
      });
    } else {
      await this.atualizarContadores(dto.fornecedorId, reprovado);
    }

    let rnc: any = null;
    if (reprovado) {
      rnc = await this.rnc.create(
        {
          inspecaoLoteId: insp.id,
          fornecedorId: dto.fornecedorId,
          itemId,
          notaFiscal: dto.notaFiscal,
          po: dto.po,
          quantidadeLote: dto.qtdTotal,
          quantidadePecas: dto.qtdTotal,
          tipoDesvio: 'Dimensional',
          descricaoDesvio:
            dto.observacoes ||
            'Não conformidade dimensional identificada na inspeção de lote.',
          disposicao: dto.disposicao ?? null,
        },
        usuarioId,
      );
    }

    return { inspecao: insp, rnc };
  }

  private itensReprovados(checklist: any): string[] {
    if (!Array.isArray(checklist)) return [];
    const reprovados: string[] = [];
    for (const grupo of checklist) {
      for (const item of grupo.itens ?? []) {
        if (item.status === 'REPROVADO') reprovados.push(item.texto);
      }
    }
    return reprovados;
  }
}

```

### `backend/src/sqe/rnc/rnc.controller.ts`

```typescript
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { join } from 'path';
import { existsSync } from 'fs';
import type { Response } from 'express';
import { RncService } from './rnc.service';
import { gerarPdfRnc } from './rnc-pdf';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser, AuthUser } from '../../auth/current-user.decorator';

class CreateRncDto {
  @IsOptional() @Type(() => Number) @IsInt() inspecaoVisualId?: number;
  @IsOptional() @Type(() => Number) @IsInt() inspecaoLoteId?: number;
  @Type(() => Number) @IsInt() fornecedorId: number;
  @IsOptional() @Type(() => Number) @IsInt() itemId?: number;
  @IsOptional() @IsString() itemCodigo?: string;
  @IsOptional() @IsString() itemDescricao?: string;
  @IsOptional() @Type(() => Number) @IsNumber() quantidadeLote?: number;
  @IsOptional() @IsString() po?: string;
  @IsOptional() @IsString() notaFiscal?: string;
  @IsOptional() @IsString() tipoDesvio?: string;
  @IsOptional() @IsBoolean() reincidencia?: boolean;
  @IsString() descricaoDesvio: string;
  @IsOptional() @Type(() => Number) @IsNumber() quantidadePecas?: number;
  @IsOptional() @Type(() => Number) @IsNumber() valorUnitario?: number;
  @IsOptional() @IsString() disposicao?: string;
  @IsOptional() @IsString() observacoes?: string;
}

class AtualizarRncDto {
  @IsOptional() @IsString() tipoDesvio?: string;
  @IsOptional() @IsBoolean() reincidencia?: boolean;
  @IsOptional() @IsString() descricaoDesvio?: string;
  @IsOptional() @Type(() => Number) @IsNumber() quantidadePecas?: number;
  @IsOptional() @Type(() => Number) @IsNumber() valorUnitario?: number;
  @IsOptional() @IsString() disposicao?: string;
  @IsOptional() @IsBoolean() houveRetorno?: boolean;
  @IsOptional() @IsString() dataRetorno?: string;
  @IsOptional() @IsString() fornecedorAceitou?: string;
  @IsOptional() @IsBoolean() fornecedorEnviouPlano?: boolean;
  @IsOptional()
  @IsIn(['SATISFATORIO', 'EXCELENTE', 'NAO_APLICAVEL'])
  nivelPlano?: any;
  @IsOptional()
  @IsIn(['EM_ANDAMENTO', 'FINALIZADA', 'CANCELADA'])
  status?: any;
  @IsOptional()
  @IsIn(['PENDENTE', 'APROVADO', 'REPROVADO', 'NAO_APLICAVEL'])
  verificacaoEficacia?: any;
  @IsOptional() @IsString() dataVerificacao?: string;
  @IsOptional() @IsString() evidencias?: string;
  @IsOptional() @IsString() observacoes?: string;
  @IsOptional() @IsString() comentario?: string;
}

class MudarStatusDto {
  @IsIn(['EM_ANDAMENTO', 'FINALIZADA', 'CANCELADA']) status: string;
  @IsOptional() @IsString() comentario?: string;
}

class CancelarRncDto {
  @IsString() motivo: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('rnc')
export class RncController {
  constructor(
    private service: RncService,
    private prisma: PrismaService,
  ) {}

  @Get()
  findAll(
    @Query('status') status?: string,
    @Query('fornecedorId') fornecedorId?: string,
    @Query('de') de?: string,
    @Query('ate') ate?: string,
  ) {
    return this.service.findAll({
      status,
      fornecedorId: fornecedorId ? Number(fornecedorId) : undefined,
      de,
      ate,
    });
  }

  @Get('reincidencia')
  async reincidencia(
    @Query('fornecedorId') fornecedorId: string,
    @Query('itemId') itemId: string,
  ) {
    const sugere = await this.service.sugereReincidencia(
      Number(fornecedorId),
      Number(itemId),
    );
    return { reincidencia: sugere };
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Get(':id/pdf')
  async pdf(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const rnc = await this.prisma.rnc.findUnique({
      where: { id },
      include: {
        fornecedor: { select: { nome: true, codigo: true } },
        item: { select: { descricao: true, codigo: true } },
      },
    });
    if (!rnc) throw new NotFoundException('RNC nao encontrada');

    // Fotos anexadas a RNC entram no Registro Fotografico do formulario.
    const uploadDir = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');
    const anexos = await this.prisma.anexo.findMany({
      where: { entidadeTipo: 'RNC', entidadeId: id },
      orderBy: { createdAt: 'asc' },
    });
    const fotos = anexos
      .filter((a) => (a.mimeType ?? '').startsWith('image/'))
      .map((a) => join(uploadDir, a.caminho))
      .filter((p) => existsSync(p));

    const nomeArquivo = `RNC-${rnc.numero.replace('/', '-')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${nomeArquivo}"`,
    );
    const doc = gerarPdfRnc(rnc, fotos);
    doc.pipe(res);
    doc.end();
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Post()
  create(@Body() dto: CreateRncDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user.id);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Patch(':id')
  atualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AtualizarRncDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.atualizar(id, dto, user.id);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Patch(':id/status')
  mudarStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MudarStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.mudarStatus(id, dto.status, dto.comentario, user.id);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Patch(':id/cancelar')
  cancelar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelarRncDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.cancelar(id, dto.motivo, user.id);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Patch(':id/reabrir')
  reabrir(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.reabrir(id, user.id);
  }

  // Remocao permanente do banco - restrito a ADMIN.
  @Roles('ADMIN')
  @Delete(':id')
  remover(@Param('id', ParseIntPipe) id: number) {
    return this.service.remover(id);
  }
}

```

### `backend/src/sqe/rnc/rnc.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { RncService } from './rnc.service';
import { RncController } from './rnc.controller';

@Module({
  providers: [RncService],
  controllers: [RncController],
  exports: [RncService],
})
export class RncModule {}

```

### `backend/src/sqe/rnc/rnc.service.ts`

```typescript
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { HistoricoService } from '../../historico/historico.service';
import { semanaAno } from '../sqe-utils';

const ENTIDADE = 'RNC';

const includePadrao = {
  fornecedor: { select: { id: true, nome: true, codigo: true } },
  item: { select: { id: true, descricao: true, codigo: true } },
  inspecaoVisual: { select: { id: true, resultado: true } },
  inspecaoLote: { select: { id: true, resultado: true } },
  criadoPor: { select: { id: true, nome: true } },
};

@Injectable()
export class RncService {
  constructor(
    private prisma: PrismaService,
    private historico: HistoricoService,
  ) {}

  // Gera numero no formato {seq}/{aa} - ex: 149/26 (sequencial por ano)
  private async gerarNumero(): Promise<{
    numero: string;
    ano: number;
    sequencial: number;
  }> {
    const ano = new Date().getFullYear();
    const ultima = await this.prisma.rnc.findFirst({
      where: { ano },
      orderBy: { sequencial: 'desc' },
    });
    const sequencial = (ultima?.sequencial ?? 0) + 1;
    const numero = `${String(sequencial).padStart(3, '0')}/${String(ano).slice(-2)}`;
    return { numero, ano, sequencial };
  }

  findAll(filtros: {
    status?: string;
    fornecedorId?: number;
    de?: string;
    ate?: string;
  }) {
    return this.prisma.rnc.findMany({
      where: {
        status: filtros.status ? (filtros.status as any) : undefined,
        fornecedorId: filtros.fornecedorId ?? undefined,
        dataAbertura: {
          gte: filtros.de ? new Date(filtros.de) : undefined,
          lte: filtros.ate ? new Date(filtros.ate) : undefined,
        },
      },
      include: includePadrao,
      orderBy: { dataAbertura: 'desc' },
    });
  }

  async findOne(id: number) {
    const rnc = await this.prisma.rnc.findUnique({
      where: { id },
      include: includePadrao,
    });
    if (!rnc) throw new NotFoundException('RNC nao encontrada');
    const historico = await this.historico.listar(ENTIDADE, id);
    const anexos = await this.prisma.anexo.findMany({
      where: { entidadeTipo: ENTIDADE, entidadeId: id },
      orderBy: { createdAt: 'desc' },
    });
    return { ...rnc, historico, anexos };
  }

  // Sugere se e reincidencia: mesmo fornecedor + item ja teve RNC antes
  async sugereReincidencia(
    fornecedorId: number,
    itemId: number,
  ): Promise<boolean> {
    const anterior = await this.prisma.rnc.findFirst({
      where: { fornecedorId, itemId },
    });
    return !!anterior;
  }

  // Resolve o item a partir de texto livre (a Qualidade define o item ao abrir
  // a RNC). Reaproveita item existente por codigo/descricao ou cria um novo.
  private async resolverItemId(data: any): Promise<number> {
    if (data.itemId) return data.itemId;
    const codigo = (data.itemCodigo ?? '').trim();
    const descricao = (data.itemDescricao ?? '').trim();

    if (codigo) {
      const existente = await this.prisma.item.findUnique({
        where: { codigo },
      });
      if (existente) return existente.id;
      const criado = await this.prisma.item.create({
        data: {
          codigo,
          descricao: descricao || codigo,
          fornecedorId: data.fornecedorId ?? null,
        },
      });
      return criado.id;
    }

    if (descricao) {
      const existente = await this.prisma.item.findFirst({
        where: { descricao, fornecedorId: data.fornecedorId ?? null },
      });
      if (existente) return existente.id;
      const criado = await this.prisma.item.create({
        data: {
          codigo: `AUTO-${Date.now()}`,
          descricao,
          fornecedorId: data.fornecedorId ?? null,
        },
      });
      return criado.id;
    }

    const criado = await this.prisma.item.create({
      data: {
        codigo: `AUTO-${Date.now()}`,
        descricao: 'Item nao especificado',
        fornecedorId: data.fornecedorId ?? null,
      },
    });
    return criado.id;
  }

  async create(data: any, usuarioId: number) {
    const { numero, ano, sequencial } = await this.gerarNumero();
    const itemId = await this.resolverItemId(data);
    const reincidencia =
      data.reincidencia ??
      (await this.sugereReincidencia(data.fornecedorId, itemId));
    const valorTotal =
      data.quantidadePecas != null && data.valorUnitario != null
        ? data.quantidadePecas * data.valorUnitario
        : (data.valorTotal ?? null);

    const { semana } = semanaAno(new Date());

    const rnc = await this.prisma.rnc.create({
      data: {
        numero,
        ano,
        sequencial,
        semana,
        inspecaoVisualId: data.inspecaoVisualId ?? null,
        inspecaoLoteId: data.inspecaoLoteId ?? null,
        solicitante: data.solicitante ?? 'Qualidade',
        itemId,
        quantidadeLote: data.quantidadeLote ?? null,
        po: data.po ?? null,
        notaFiscal: data.notaFiscal ?? null,
        fornecedorId: data.fornecedorId,
        tipoDesvio: data.tipoDesvio ?? '',
        reincidencia,
        descricaoDesvio: data.descricaoDesvio ?? '',
        quantidadePecas: data.quantidadePecas ?? null,
        valorUnitario: data.valorUnitario ?? null,
        valorTotal,
        disposicao: data.disposicao ?? null,
        observacoes: data.observacoes ?? null,
        criadoPorId: usuarioId,
      },
      include: includePadrao,
    });
    await this.historico.registrar({
      entidadeTipo: ENTIDADE,
      entidadeId: rnc.id,
      statusAnterior: null,
      statusNovo: 'EM_ANDAMENTO',
      comentario: 'RNC aberta',
      usuarioId,
    });
    return rnc;
  }

  // Atualiza os campos de controle/plano de acao (planilha 3)
  async atualizar(id: number, data: any, usuarioId: number) {
    const rnc = await this.prisma.rnc.findUnique({ where: { id } });
    if (!rnc) throw new NotFoundException('RNC nao encontrada');

    const quantidadePecas = data.quantidadePecas ?? rnc.quantidadePecas;
    const valorUnitario = data.valorUnitario ?? rnc.valorUnitario;
    const valorTotal =
      quantidadePecas != null && valorUnitario != null
        ? quantidadePecas * valorUnitario
        : rnc.valorTotal;

    const dataAbertura = rnc.dataAbertura;
    const dataRetorno = data.dataRetorno
      ? new Date(data.dataRetorno)
      : rnc.dataRetorno;
    const tempoRetornoDias = dataRetorno
      ? Math.round(
          (dataRetorno.getTime() - dataAbertura.getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : rnc.tempoRetornoDias;

    const statusAnterior = rnc.status;
    const novoStatus = data.status ?? rnc.status;

    const atualizada = await this.prisma.rnc.update({
      where: { id },
      data: {
        tipoDesvio: data.tipoDesvio ?? rnc.tipoDesvio,
        reincidencia: data.reincidencia ?? rnc.reincidencia,
        descricaoDesvio: data.descricaoDesvio ?? rnc.descricaoDesvio,
        quantidadePecas,
        valorUnitario,
        valorTotal,
        disposicao: data.disposicao ?? rnc.disposicao,
        houveRetorno: data.houveRetorno ?? rnc.houveRetorno,
        dataRetorno,
        tempoRetornoDias,
        fornecedorAceitou: data.fornecedorAceitou ?? rnc.fornecedorAceitou,
        fornecedorEnviouPlano:
          data.fornecedorEnviouPlano ?? rnc.fornecedorEnviouPlano,
        nivelPlano: data.nivelPlano ?? rnc.nivelPlano,
        status: novoStatus,
        verificacaoEficacia:
          data.verificacaoEficacia ?? rnc.verificacaoEficacia,
        dataVerificacao: data.dataVerificacao
          ? new Date(data.dataVerificacao)
          : rnc.dataVerificacao,
        evidencias: data.evidencias ?? rnc.evidencias,
        observacoes: data.observacoes ?? rnc.observacoes,
      },
      include: includePadrao,
    });

    if (novoStatus !== statusAnterior) {
      await this.historico.registrar({
        entidadeTipo: ENTIDADE,
        entidadeId: id,
        statusAnterior,
        statusNovo: novoStatus,
        comentario: data.comentario ?? `Status alterado para ${novoStatus}`,
        usuarioId,
      });
    }
    return atualizada;
  }

  async mudarStatus(
    id: number,
    novoStatus: string,
    comentario: string | undefined,
    usuarioId: number,
  ) {
    const rnc = await this.prisma.rnc.findUnique({ where: { id } });
    if (!rnc) throw new NotFoundException('RNC nao encontrada');
    const atualizada = await this.prisma.rnc.update({
      where: { id },
      data: { status: novoStatus as any },
      include: includePadrao,
    });
    await this.historico.registrar({
      entidadeTipo: ENTIDADE,
      entidadeId: id,
      statusAnterior: rnc.status,
      statusNovo: novoStatus,
      comentario: comentario ?? null,
      usuarioId,
    });
    return atualizada;
  }

  // Cancela a RNC (motivo obrigatorio). Sai dos KPIs, permanece na lista.
  // O motivo NAO vai para o historico de status - so aparece ao abrir a RNC.
  async cancelar(id: number, motivo: string, usuarioId: number) {
    const rnc = await this.prisma.rnc.findUnique({ where: { id } });
    if (!rnc) throw new NotFoundException('RNC nao encontrada');
    if (!motivo || !motivo.trim())
      throw new BadRequestException('Informe o motivo do cancelamento.');
    const atualizada = await this.prisma.rnc.update({
      where: { id },
      data: {
        status: 'CANCELADA' as any,
        motivoCancelamento: motivo.trim(),
      },
      include: includePadrao,
    });
    await this.historico.registrar({
      entidadeTipo: ENTIDADE,
      entidadeId: id,
      statusAnterior: rnc.status,
      statusNovo: 'CANCELADA',
      comentario: 'RNC cancelada',
      usuarioId,
    });
    return atualizada;
  }

  // Reabre a RNC (a partir de FINALIZADA ou CANCELADA) para EM_ANDAMENTO.
  async reabrir(id: number, usuarioId: number) {
    const rnc = await this.prisma.rnc.findUnique({ where: { id } });
    if (!rnc) throw new NotFoundException('RNC nao encontrada');
    const atualizada = await this.prisma.rnc.update({
      where: { id },
      data: {
        status: 'EM_ANDAMENTO' as any,
        motivoCancelamento: null,
      },
      include: includePadrao,
    });
    await this.historico.registrar({
      entidadeTipo: ENTIDADE,
      entidadeId: id,
      statusAnterior: rnc.status,
      statusNovo: 'EM_ANDAMENTO',
      comentario: 'RNC reaberta',
      usuarioId,
    });
    return atualizada;
  }

  // Remocao permanente do banco (restrito a ADMIN no controller).
  // Remove anexos, historico e vinculos antes de apagar a RNC.
  async remover(id: number) {
    const rnc = await this.prisma.rnc.findUnique({ where: { id } });
    if (!rnc) throw new NotFoundException('RNC nao encontrada');
    await this.prisma.anexo.deleteMany({
      where: { entidadeTipo: ENTIDADE, entidadeId: id },
    });
    await this.historico.remover(ENTIDADE, id);
    await this.prisma.rnc.delete({ where: { id } });
    return { ok: true, id };
  }
}

```

### `backend/src/sqe/rnc/rnc-pdf.ts`

```typescript
import PDFDocument from 'pdfkit';
import { join } from 'path';
import { existsSync } from 'fs';

const LARANJA = '#E8792B';
const PRETO = '#000000';
const CINZA = '#555555';
const LOGO_PATH = join(process.cwd(), 'assets', 'logo-big-dutchman.png');

const M = 40; // margem
const X0 = M;
const X1 = 555; // borda direita (A4 595 - 40)
const W = X1 - X0; // largura util (515)

function fmtData(d?: Date | null): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('pt-BR');
}

function simNao(v?: boolean | null): string {
  if (v == null) return 'Não / No';
  return v ? 'Sim / Yes' : 'Não / No';
}

// Gera o PDF da RNC fiel ao formulario BDBR.QUA.FMR.003.05 (bilingue PT/EN),
// incluindo o Registro Fotografico com as fotos anexadas a RNC.
export function gerarPdfRnc(rnc: any, fotos: string[] = []): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: 'A4', margin: M });

  // ---------- Celula bilingue com borda ----------
  const cell = (
    x: number,
    y: number,
    w: number,
    h: number,
    ptLabel: string,
    enLabel: string,
    valor: string,
    opts: { labelFill?: string; valorColor?: string; valorSize?: number } = {},
  ) => {
    doc.lineWidth(0.8).strokeColor(PRETO).rect(x, y, w, h).stroke();
    if (opts.labelFill) {
      doc.rect(x + 0.4, y + 0.4, w - 0.8, 15).fill(opts.labelFill);
    }
    doc
      .font('Helvetica-Bold')
      .fontSize(6.5)
      .fillColor(opts.labelFill ? '#FFFFFF' : PRETO)
      .text(ptLabel, x + 3, y + 2, { width: w - 6, lineBreak: false });
    doc
      .font('Helvetica-Oblique')
      .fontSize(5)
      .fillColor(opts.labelFill ? '#FFEFE2' : CINZA)
      .text(enLabel, x + 3, y + 9, { width: w - 6, lineBreak: false });
    doc
      .font('Helvetica')
      .fontSize(opts.valorSize ?? 8.5)
      .fillColor(opts.valorColor ?? PRETO)
      .text(valor || '', x + 3, y + 17, {
        width: w - 6,
        height: h - 18,
        ellipsis: true,
      });
  };

  // ---------- Secao de texto (titulo bilingue + area de valor) ----------
  const secao = (
    y: number,
    ptTitulo: string,
    enTitulo: string,
    valor: string,
    altura: number,
  ) => {
    doc.lineWidth(0.8).strokeColor(PRETO).rect(X0, y, W, 16).stroke();
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor(PRETO)
      .text(ptTitulo, X0 + 4, y + 2, { width: W - 8, continued: true })
      .font('Helvetica-Oblique')
      .fontSize(6.5)
      .fillColor(CINZA)
      .text(`   ${enTitulo}`);
    doc.lineWidth(0.8).strokeColor(PRETO).rect(X0, y + 16, W, altura).stroke();
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(PRETO)
      .text(valor || '', X0 + 5, y + 21, {
        width: W - 10,
        height: altura - 8,
      });
    return y + 16 + altura;
  };

  // ---------- Cabecalho ----------
  if (existsSync(LOGO_PATH)) {
    doc.image(LOGO_PATH, X0, 34, { width: 120 });
  } else {
    doc.font('Helvetica-Bold').fontSize(16).fillColor(LARANJA).text('Big Dutchman', X0, 40);
  }

  // Caixa de codigo (topo direito)
  const cbX = 400;
  const cbW = X1 - cbX;
  doc.lineWidth(0.8).strokeColor(PRETO).rect(cbX, 34, cbW, 46).stroke();
  const codLinha = (i: number, pt: string, en: string, v: string) => {
    const yy = 36 + i * 15;
    if (i > 0) doc.moveTo(cbX, 34 + i * 15).lineTo(X1, 34 + i * 15).stroke();
    doc
      .font('Helvetica-Bold')
      .fontSize(6)
      .fillColor(PRETO)
      .text(`${pt} / ${en}:`, cbX + 3, yy + 1, { width: cbW - 6, lineBreak: false });
    doc
      .font('Helvetica')
      .fontSize(7)
      .text(v, cbX + 3, yy + 7, { width: cbW - 6, lineBreak: false });
  };
  codLinha(0, 'Código', 'Code', 'BDBR.QUA.FMR.003.05');
  codLinha(1, 'Data Rev.', 'Rev. Date', '03/12/2025');
  codLinha(2, 'Revisão', 'Revision', '05');

  // Titulo central
  doc
    .font('Helvetica-Bold')
    .fontSize(14)
    .fillColor(PRETO)
    .text('Relatório de Não Conformidade', 160, 42, { width: 235, align: 'center' });
  doc
    .font('Helvetica-Oblique')
    .fontSize(9)
    .fillColor(CINZA)
    .text('Non Conformance Report', 160, 60, { width: 235, align: 'center' });

  let y = 92;

  // ---------- Linha 1: identificacao ----------
  const r1 = [
    { w: 70, pt: 'RNC Nº', en: 'NCR Nº', v: rnc.numero, orange: true },
    { w: 78, pt: 'Data de Abertura', en: 'Opening Date', v: fmtData(rnc.dataAbertura) },
    { w: 95, pt: 'Responsável', en: 'Responsible', v: rnc.solicitante ?? 'Qualidade' },
    { w: 82, pt: 'Setor', en: 'Department', v: 'Qualidade / Quality' },
    { w: 110, pt: 'Fornecedor', en: 'Vendor', v: rnc.fornecedor?.nome ?? '' },
    { w: 80, pt: 'Código', en: 'Code', v: rnc.fornecedor?.codigo ?? '' },
  ];
  let x = X0;
  for (const c of r1) {
    cell(x, y, c.w, 34, c.pt, c.en, c.v ?? '', {
      valorColor: c.orange ? LARANJA : PRETO,
      valorSize: c.orange ? 9.5 : 8.5,
    });
    x += c.w;
  }
  y += 34;

  // ---------- Linha 2: item ----------
  const r2 = [
    { w: 80, pt: 'Código do Item', en: 'Item Code', v: rnc.item?.codigo ?? '' },
    { w: 80, pt: 'Quantidade do Lote', en: 'Batch Quantity', v: String(rnc.quantidadeLote ?? '') },
    { w: 70, pt: 'NF', en: 'Invoice', v: rnc.notaFiscal ?? '' },
    { w: 70, pt: 'PO', en: 'PO', v: rnc.po ?? '' },
    { w: 215, pt: 'Descrição Item', en: 'Item Description', v: rnc.item?.descricao ?? '' },
  ];
  x = X0;
  for (const c of r2) {
    cell(x, y, c.w, 34, c.pt, c.en, c.v);
    x += c.w;
  }
  y += 34;

  // ---------- Linha 3: qtd afetada / reincidencia (destaque laranja) ----------
  cell(X0, y, 257, 30, 'Quantidade Afetada', 'Quantity Affected', String(rnc.quantidadePecas ?? ''), {
    labelFill: LARANJA,
  });
  cell(X0 + 257, y, W - 257, 30, 'Reincidência?', 'Reincidence?', simNao(rnc.reincidencia), {
    labelFill: LARANJA,
  });
  y += 30;

  // ---------- Descricao do desvio ----------
  const desvio =
    (rnc.tipoDesvio ? `[${rnc.tipoDesvio}] ` : '') + (rnc.descricaoDesvio ?? '');
  y = secao(y, 'Descrição do Desvio', 'Deviation Description', desvio, 95);

  // ---------- Disposicao ----------
  y = secao(y, 'Disposição', 'Disposition', rnc.disposicao ?? '', 80);

  // ---------- Registro fotografico ----------
  doc.lineWidth(0.8).strokeColor(PRETO).rect(X0, y, W, 16).stroke();
  doc
    .font('Helvetica-Bold')
    .fontSize(8)
    .fillColor(PRETO)
    .text('Registro Fotográfico (Quando necessário)', X0 + 4, y + 2, {
      width: W - 8,
      continued: true,
    })
    .font('Helvetica-Oblique')
    .fontSize(6.5)
    .fillColor(CINZA)
    .text('   Photographic Record (When necessary)');
  y += 16;

  const areaTop = y;
  const areaAltura = doc.page.height - 60 - areaTop;
  doc.lineWidth(0.8).strokeColor(PRETO).rect(X0, areaTop, W, areaAltura).stroke();

  const validas = fotos.filter((p) => existsSync(p)).slice(0, 4);
  if (validas.length) {
    const cols = validas.length === 1 ? 1 : 2;
    const linhas = Math.ceil(validas.length / cols);
    const padding = 8;
    const cellW = (W - padding * (cols + 1)) / cols;
    const cellH = (areaAltura - padding * (linhas + 1)) / linhas;
    validas.forEach((p, i) => {
      const col = i % cols;
      const lin = Math.floor(i / cols);
      const px = X0 + padding + col * (cellW + padding);
      const py = areaTop + padding + lin * (cellH + padding);
      try {
        doc.image(p, px, py, {
          fit: [cellW, cellH],
          align: 'center',
          valign: 'center',
        });
      } catch {
        /* imagem invalida: ignora */
      }
    });
  } else {
    doc
      .font('Helvetica-Oblique')
      .fontSize(9)
      .fillColor(CINZA)
      .text('Sem registro fotográfico. / No photographic record.', X0 + 6, areaTop + 8, {
        width: W - 12,
      });
  }

  // ---------- Rodape ----------
  doc
    .font('Helvetica')
    .fontSize(7)
    .fillColor(CINZA)
    .text(
      `Big Dutchman Brasil — Sistema de Qualidade · Emitido em ${new Date().toLocaleString('pt-BR')}`,
      X0,
      doc.page.height - 45,
      { width: W, align: 'center' },
    );

  return doc;
}

```

---

## A.9 Backend — Dashboard

### `backend/src/dashboard/dashboard.controller.ts`

```typescript
import {
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private service: DashboardService) {}

  @Get('kpis-sqe')
  kpisSqe(@Query('de') de?: string, @Query('ate') ate?: string) {
    return this.service.kpisSqe(de, ate);
  }

  @Get('evolucao-fornecedores')
  evolucaoFornecedores() {
    return this.service.evolucaoFornecedores();
  }

  @Get('historico-classificacao')
  historicoClassificacao(@Query('fornecedorId') fornecedorId?: string) {
    return this.service.historicoClassificacao(
      fornecedorId ? Number(fornecedorId) : undefined,
    );
  }

  @UseGuards(RolesGuard)
  @Roles('QUALIDADE', 'ADMIN')
  @Post('fechar-trimestre')
  fecharTrimestre() {
    return this.service.fecharTrimestre();
  }
}

```

### `backend/src/dashboard/dashboard.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  providers: [DashboardService],
  controllers: [DashboardController],
})
export class DashboardModule {}

```

### `backend/src/dashboard/dashboard.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  classificarPorConformidade,
  pctConformidade,
  trimestreFiscal,
} from '../sqe/sqe-utils';

function pct(parte: number, total: number): number {
  if (!total) return 0;
  return Math.round((parte / total) * 1000) / 10;
}

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async kpisSqe(de?: string, ate?: string) {
    const periodoData: any = {};
    if (de) periodoData.gte = new Date(de);
    if (ate) periodoData.lte = new Date(ate);
    const temPeriodo = de || ate;

    const entregaWhere = temPeriodo ? { dataEntrega: periodoData } : {};
    // RNCs canceladas saem dos KPIs.
    const rncWhere: any = { status: { not: 'CANCELADA' } };
    if (temPeriodo) rncWhere.dataAbertura = periodoData;

    // Universo dos KPIs = todas as cargas recebidas (EntregaPortaria).
    // Cada inspecao gera 1 carga; Visual+Lote da mesma entrega = 1 carga.
    // Todos os percentuais sao calculados sobre esse total de cargas recebidas.
    const [entregas, rncs] = await Promise.all([
      this.prisma.entregaPortaria.findMany({
        where: entregaWhere,
        include: {
          inspecoesVisual: { select: { resultado: true } },
          inspecoesLote: { select: { resultado: true } },
        },
      }),
      this.prisma.rnc.findMany({ where: rncWhere }),
    ]);

    const foiInspecionada = (e: any) =>
      e.inspecoesVisual.length > 0 || e.inspecoesLote.length > 0;
    const foiReprovada = (e: any) =>
      e.inspecoesVisual.some((i: any) => i.resultado === 'REPROVADO') ||
      e.inspecoesLote.some((i: any) => i.resultado === 'REPROVADO');

    const cargasInspecionadas = entregas.filter(foiInspecionada);
    const recebimentosSemInspecao = entregas.length - cargasInspecionadas.length;

    // 1 e 2 - fornecedores/itens inspecionados x recebidos (sobre o total recebido)
    const fornRecebidos = new Set(entregas.map((e) => e.fornecedorId));
    const itensRecebidos = new Set(
      entregas.filter((e) => e.itemId).map((e) => e.itemId),
    );
    const fornInspecionados = new Set(
      cargasInspecionadas.map((e) => e.fornecedorId),
    );
    const itensInspecionados = new Set(
      cargasInspecionadas.filter((e) => e.itemId).map((e) => e.itemId),
    );

    // 3 - aprovacao no recebimento (Opcao B: sobre o TOTAL de cargas recebidas;
    // carga nao inspecionada conta como aceita no recebimento).
    const totalCargas = entregas.length;
    const cargasReprovadas = entregas.filter(foiReprovada).length;
    const cargasAprovadas = totalCargas - cargasReprovadas;

    // 4 - % resposta a RNC (RNCs com retorno do fornecedor / total)
    const totalRnc = rncs.length;
    const rncComResposta = rncs.filter((r) => r.houveRetorno === true).length;

    // 5 e 7 - eficacia (RNCs finalizadas com eficacia aprovada)
    const rncFinalizadas = rncs.filter((r) => r.status === 'FINALIZADA');
    const rncEficazes = rncFinalizadas.filter(
      (r) => r.verificacaoEficacia === 'APROVADO',
    ).length;

    // 6 - tempo medio de retorno (dias)
    const tempos = rncs
      .filter((r) => r.tempoRetornoDias != null)
      .map((r) => r.tempoRetornoDias as number);
    const tempoMedio = tempos.length
      ? Math.round((tempos.reduce((a, b) => a + b, 0) / tempos.length) * 10) / 10
      : 0;

    // 8 - custos evitados = soma do Valor Total das RNCs
    const custosEvitados = rncs.reduce(
      (acc, r) => acc + (r.valorTotal ?? 0),
      0,
    );

    return {
      periodo: { de: de ?? null, ate: ate ?? null },
      indicadores: {
        pctFornecedoresInspecionados: pct(
          fornInspecionados.size,
          fornRecebidos.size,
        ),
        pctItensInspecionados: pct(itensInspecionados.size, itensRecebidos.size),
        pctAprovacaoRecebimento: pct(cargasAprovadas, totalCargas),
        pctRespostaRnc: pct(rncComResposta, totalRnc),
        pctEficaciaResposta: pct(rncEficazes, rncFinalizadas.length),
        tempoMedioRespostaRncDias: tempoMedio,
        pctEficaciaEncerramento: pct(rncEficazes, rncFinalizadas.length),
        custosEvitadosReais: Math.round(custosEvitados * 100) / 100,
      },
      contadores: {
        entregas: totalCargas,
        inspecoes: cargasInspecionadas.length,
        recebimentosSemInspecao,
        rncsTotal: totalRnc,
        rncsAbertas: rncs.filter((r) => r.status === 'EM_ANDAMENTO').length,
        rncsEncerradas: rncFinalizadas.length,
      },
    };
  }

  // Evolucao/historico de classificacao dos fornecedores (para o painel)
  async evolucaoFornecedores() {
    const fornecedores = await this.prisma.fornecedor.findMany({
      where: { ativo: true },
      orderBy: { nome: 'asc' },
    });

    return fornecedores.map((f) => {
      const conformidade = pctConformidade(
        f.lotesInspecionados,
        f.lotesReprovados,
      );
      const classificacaoAtual =
        f.lotesInspecionados > 0
          ? classificarPorConformidade(conformidade)
          : f.classificacaoFornecimento;
      const ordem = { A: 1, B: 2, C: 3, D: 4 } as Record<string, number>;
      let tendencia: 'UPGRADE' | 'DOWNGRADE' | 'IGUAL' = 'IGUAL';
      if (ordem[classificacaoAtual] < ordem[f.classificacaoFornecimento])
        tendencia = 'UPGRADE';
      else if (ordem[classificacaoAtual] > ordem[f.classificacaoFornecimento])
        tendencia = 'DOWNGRADE';

      return {
        id: f.id,
        codigo: f.codigo,
        nome: f.nome,
        classificacaoFornecimento: f.classificacaoFornecimento,
        classificacaoAtual,
        pctConformidade: conformidade,
        lotesInspecionados: f.lotesInspecionados,
        lotesReprovados: f.lotesReprovados,
        totalEntregas: f.totalEntregas,
        totalInspecoes: f.totalInspecoes,
        tendencia,
      };
    });
  }

  // Historico de classificacao por trimestre fiscal
  async historicoClassificacao(fornecedorId?: number) {
    return this.prisma.historicoClassificacao.findMany({
      where: fornecedorId ? { fornecedorId } : undefined,
      include: { fornecedor: { select: { nome: true, codigo: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Fecha o trimestre fiscal: snapshot no historico + atualiza classificacao + zera contadores.
  // Chamado automaticamente na virada do trimestre (ou manualmente pela Qualidade/Admin).
  async fecharTrimestre() {
    const { label, inicio, fim } = trimestreFiscal(new Date());
    const fornecedores = await this.prisma.fornecedor.findMany({
      where: { ativo: true },
    });
    const resultados: any[] = [];
    for (const f of fornecedores) {
      const conformidade = pctConformidade(
        f.lotesInspecionados,
        f.lotesReprovados,
      );
      const apurada =
        f.lotesInspecionados > 0
          ? classificarPorConformidade(conformidade)
          : f.classificacaoFornecimento;

      const snapshot = await this.prisma.historicoClassificacao.create({
        data: {
          fornecedorId: f.id,
          trimestreFiscal: label,
          periodoInicio: inicio,
          periodoFim: fim,
          classificacaoInicial: f.classificacaoFornecimento,
          lotesInspecionados: f.lotesInspecionados,
          lotesReprovados: f.lotesReprovados,
          pctConformidade: conformidade,
          classificacaoApurada: apurada,
        },
      });

      // Nova classificacao de fornecimento = apurada; zera contadores do periodo
      await this.prisma.fornecedor.update({
        where: { id: f.id },
        data: {
          classificacaoFornecimento: apurada,
          lotesInspecionados: 0,
          lotesReprovados: 0,
        },
      });
      resultados.push(snapshot);
    }
    return { trimestre: label, fornecedoresProcessados: resultados.length };
  }
}

```

---

## A.10 Frontend — configuração

### `frontend/package.json`

```json
{
  "name": "qualidade-frontend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@ant-design/icons": "^5.5.1",
    "@tanstack/react-query": "^5.59.0",
    "antd": "^5.21.2",
    "axios": "^1.7.7",
    "dayjs": "^1.11.13",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.2"
  },
  "devDependencies": {
    "@types/react": "^18.3.10",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.2",
    "typescript": "^5.6.2",
    "vite": "^5.4.8"
  }
}

```

### `frontend/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"]
}

```

### `frontend/vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      // Em desenvolvimento, encaminha /api para o backend local
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});

```

### `frontend/index.html`

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Qualidade - Big Dutchman</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>

```

---

## A.11 Frontend — núcleo (main, App, api, auth, hooks, semana)

### `frontend/src/main.tsx`

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider } from 'antd';
import ptBR from 'antd/locale/pt_BR';
import 'antd/dist/reset.css';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import { AuthProvider } from './auth';
import App from './App';

dayjs.locale('pt-br');

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={ptBR}
      theme={{
        token: {
          colorPrimary: '#D37119',
          colorInfo: '#D37119',
          colorLink: '#B85F12',
          borderRadius: 6,
          fontFamily:
            "'Inter', 'Segoe UI', Roboto, -apple-system, BlinkMacSystemFont, sans-serif",
        },
        components: {
          Layout: {
            siderBg: '#2B2622',
            triggerBg: '#1F1B18',
            headerBg: '#ffffff',
          },
          Menu: {
            darkItemBg: '#2B2622',
            darkSubMenuItemBg: '#221E1B',
            darkItemSelectedBg: '#D37119',
            darkItemHoverBg: '#3A332D',
          },
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ConfigProvider>
  </React.StrictMode>,
);

```

### `frontend/src/App.tsx`

```tsx
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import { AppLayout } from './components/AppLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Fornecedores from './pages/Fornecedores';
import Inspecoes from './pages/Inspecoes';
import RncLista from './pages/RncLista';
import RncDetalhe from './pages/RncDetalhe';
import Periodicidade from './pages/Periodicidade';

function Privado({ children }: { children: JSX.Element }) {
  const { usuario } = useAuth();
  if (!usuario) return <Navigate to="/login" replace />;
  return <AppLayout>{children}</AppLayout>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Privado><Dashboard /></Privado>} />
      <Route path="/periodicidade" element={<Privado><Periodicidade /></Privado>} />
      <Route path="/fornecedores" element={<Privado><Fornecedores /></Privado>} />
      <Route path="/inspecoes" element={<Privado><Inspecoes /></Privado>} />
      <Route path="/rnc" element={<Privado><RncLista /></Privado>} />
      <Route path="/rnc/:id" element={<Privado><RncDetalhe /></Privado>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

```

### `frontend/src/api.ts`

```typescript
import axios from 'axios';

// O nginx (producao) e o proxy do Vite (dev) encaminham /api para o backend
export const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  },
);

// Baixa um arquivo protegido por JWT como blob e devolve uma object-URL.
// Necessario porque href/img src nativos do browser nao enviam o token,
// resultando em 401 nos endpoints /rnc/:id/pdf e /anexos/:id/download.
export async function baixarBlobUrl(url: string): Promise<string> {
  const resp = await api.get(url, { responseType: 'blob' });
  return URL.createObjectURL(resp.data);
}

// Abre o PDF (via blob) em nova aba, contornando o 401.
export async function abrirPdfEmNovaAba(url: string): Promise<void> {
  const objectUrl = await baixarBlobUrl(url);
  window.open(objectUrl, '_blank');
}

```

### `frontend/src/auth.tsx`

```tsx
import { createContext, useContext, useState, ReactNode } from 'react';
import { api } from './api';

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  papel: 'QUALIDADE' | 'PRODUCAO' | 'ADMIN';
}

interface AuthContextType {
  usuario: Usuario | null;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(() => {
    const raw = localStorage.getItem('usuario');
    return raw ? JSON.parse(raw) : null;
  });

  async function login(email: string, senha: string) {
    const { data } = await api.post('/auth/login', { email, senha });
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('usuario', JSON.stringify(data.usuario));
    setUsuario(data.usuario);
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    setUsuario(null);
  }

  return (
    <AuthContext.Provider value={{ usuario, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

```

### `frontend/src/hooks.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { api } from './api';

export interface OpcaoBasica {
  id: number;
  nome?: string;
  descricao?: string;
  codigo?: string;
}

export function useFornecedores() {
  return useQuery<any[]>({
    queryKey: ['fornecedores'],
    queryFn: async () => (await api.get('/fornecedores')).data,
  });
}

export function useItens() {
  return useQuery<any[]>({
    queryKey: ['itens'],
    queryFn: async () => (await api.get('/itens')).data,
  });
}

export function opcoesFornecedor(lista?: any[]) {
  return (lista ?? []).map((f) => ({ value: f.id, label: `${f.codigo} — ${f.nome}` }));
}

export function opcoesItem(lista?: any[]) {
  return (lista ?? []).map((i) => ({
    value: i.id,
    label: `${i.codigo} — ${i.descricao}`,
  }));
}

```

### `frontend/src/semana.ts`

```typescript
// Espelha a logica do backend (sqe-utils.ts): semanas de DOMINGO a SABADO,
// formato "W##" com dois digitos. Usado apenas para exibir semana/ano nos
// formularios de forma coerente com o que o backend grava.
export function semanaAno(d: Date): { semana: string; ano: number } {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const year = date.getUTCFullYear();
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const dayOfYear = Math.floor((date.getTime() - jan1.getTime()) / 86400000);
  const week = Math.floor((dayOfYear + jan1.getUTCDay()) / 7) + 1;
  return { semana: `W${String(week).padStart(2, '0')}`, ano: year };
}

```

---

## A.12 Frontend — componentes

### `frontend/src/components/AppLayout.tsx`

```tsx
import { ReactNode } from 'react';
import { Layout, Menu, Avatar, Dropdown, Typography } from 'antd';
import {
  ShopOutlined,
  AuditOutlined,
  WarningOutlined,
  LogoutOutlined,
  UserOutlined,
  SlidersOutlined,
  DashboardOutlined,
  ExperimentOutlined,
  ToolOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

const { Header, Sider, Content } = Layout;

const emDesenvolvimento = [
  {
    key: 'em-desenvolvimento',
    label: 'EM DESENVOLVIMENTO',
    disabled: true,
  },
];

const itensMenu = [
  {
    key: 'sqe',
    icon: <ExperimentOutlined />,
    label: 'QUALIDADE - SQE',
    children: [
      { key: '/', icon: <DashboardOutlined />, label: 'Painel' },
      { key: '/inspecoes', icon: <AuditOutlined />, label: 'Inspeções' },
      { key: '/rnc', icon: <WarningOutlined />, label: 'RNC' },
      { key: '/fornecedores', icon: <ShopOutlined />, label: 'Fornecedores' },
      {
        key: '/periodicidade',
        icon: <SlidersOutlined />,
        label: 'Periodicidade',
      },
    ],
  },
  {
    key: 'manufatura',
    icon: <ToolOutlined />,
    label: 'QUALIDADE - MANUFATURA',
    children: emDesenvolvimento,
  },
  {
    key: 'sqd',
    icon: <SafetyCertificateOutlined />,
    label: 'QUALIDADE - SQD',
    children: emDesenvolvimento,
  },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { usuario, logout } = useAuth();

  const selecionado =
    location.pathname === '/'
      ? '/'
      : '/' + location.pathname.split('/')[1];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="dark" breakpoint="lg" collapsedWidth="0" width={230}>
        <div
          style={{
            height: 72,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px 12px',
          }}
        >
          <img
            src="/logo-big-dutchman.png"
            alt="Big Dutchman"
            style={{ height: 28, objectFit: 'contain' }}
          />
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selecionado]}
          onClick={({ key }) => {
            if (key.startsWith('/')) navigate(key);
          }}
          items={itensMenu}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          }}
        >
          <Typography.Text strong style={{ fontSize: 15 }}>
            Big Dutchman Brasil — Sistema de Qualidade
          </Typography.Text>
          <Dropdown
            menu={{
              items: [
                {
                  key: 'logout',
                  icon: <LogoutOutlined />,
                  label: 'Sair',
                  onClick: () => {
                    logout();
                    navigate('/login');
                  },
                },
              ],
            }}
          >
            <span style={{ cursor: 'pointer' }}>
              <Avatar size="small" icon={<UserOutlined />} style={{ marginRight: 8 }} />
              {usuario?.nome}{' '}
              <Typography.Text type="secondary">({usuario?.papel})</Typography.Text>
            </span>
          </Dropdown>
        </Header>
        <Content style={{ margin: 24 }}>{children}</Content>
      </Layout>
    </Layout>
  );
}

```

### `frontend/src/components/AuthImage.tsx`

```tsx
import { useEffect, useState } from 'react';
import { Image } from 'antd';
import { baixarBlobUrl } from '../api';

// Exibe uma imagem protegida por JWT: busca via axios (com token) como blob
// e renderiza a object-URL. Assim evitamos o 401 do <img src> nativo.
export function AuthImage({
  anexoId,
  width = 120,
  height = 120,
}: {
  anexoId: number;
  width?: number;
  height?: number;
}) {
  const [src, setSrc] = useState<string>();

  useEffect(() => {
    let objectUrl: string | undefined;
    let ativo = true;
    baixarBlobUrl(`/anexos/${anexoId}/download`)
      .then((url) => {
        objectUrl = url;
        if (ativo) setSrc(url);
      })
      .catch(() => undefined);
    return () => {
      ativo = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [anexoId]);

  return (
    <Image
      width={width}
      height={height}
      style={{ objectFit: 'cover', borderRadius: 6 }}
      src={src}
    />
  );
}

```

---

## A.13 Frontend — páginas

### `frontend/src/pages/Login.tsx`

```tsx
import { useState } from 'react';
import { Button, Card, Form, Input, Typography, message } from 'antd';
import { LockOutlined, MailOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  async function onFinish(values: { email: string; senha: string }) {
    setLoading(true);
    try {
      await login(values.email, values.senha);
      navigate('/');
    } catch {
      message.error('Usuário ou senha inválidos');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #2B2622 0%, #B85F12 100%)',
      }}
    >
      <Card style={{ width: 380, boxShadow: '0 8px 30px rgba(0,0,0,0.25)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img
            src="/logo-big-dutchman.png"
            alt="Big Dutchman"
            style={{ height: 40, objectFit: 'contain', marginBottom: 12 }}
          />
          <Typography.Title level={3} style={{ marginBottom: 0, color: '#D37119' }}>
            Sistema de Qualidade
          </Typography.Title>
          <Typography.Text type="secondary">
            Big Dutchman Brasil — Módulo SQE
          </Typography.Text>
        </div>
        <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
          <Form.Item
            name="email"
            label="E-mail"
            rules={[{ required: true, message: 'Informe o e-mail' }]}
          >
            <Input prefix={<MailOutlined />} placeholder="seu@email.com" size="large" />
          </Form.Item>
          <Form.Item
            name="senha"
            label="Senha"
            rules={[{ required: true, message: 'Informe a senha' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Senha" size="large" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block size="large" loading={loading}>
            Entrar
          </Button>
        </Form>
      </Card>
    </div>
  );
}

```

### `frontend/src/pages/Dashboard.tsx`

```tsx
import { useState } from 'react';
import {
  Button,
  Card,
  Col,
  DatePicker,
  Modal,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  CheckCircleOutlined,
  DollarOutlined,
  ClockCircleOutlined,
  FileSearchOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  MinusOutlined,
  ReconciliationOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs, { Dayjs } from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import {
  corStatusRnc,
  labelStatusRnc,
} from './RncLista';
import { useAuth } from '../auth';

const { RangePicker } = DatePicker;

const corClasse: Record<string, string> = {
  A: 'green',
  B: 'blue',
  C: 'orange',
  D: 'red',
};

function tendenciaTag(t: string) {
  if (t === 'UPGRADE')
    return (
      <Tag color="green" icon={<ArrowUpOutlined />}>
        Melhorou
      </Tag>
    );
  if (t === 'DOWNGRADE')
    return (
      <Tag color="red" icon={<ArrowDownOutlined />}>
        Piorou
      </Tag>
    );
  return (
    <Tag icon={<MinusOutlined />}>Estável</Tag>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { usuario } = useAuth();
  const [periodo, setPeriodo] = useState<[Dayjs, Dayjs] | null>(null);

  const de = periodo?.[0]?.startOf('day').toISOString();
  const ate = periodo?.[1]?.endOf('day').toISOString();

  const { data: kpis, isLoading } = useQuery<any>({
    queryKey: ['kpis-sqe', de, ate],
    queryFn: async () =>
      (await api.get('/dashboard/kpis-sqe', { params: { de, ate } })).data,
  });

  const { data: rncs, isLoading: loadingRnc } = useQuery<any[]>({
    queryKey: ['rnc', 'dashboard'],
    queryFn: async () => (await api.get('/rnc')).data,
  });

  const { data: evolucao, isLoading: loadingEvo } = useQuery<any[]>({
    queryKey: ['evolucao-fornecedores'],
    queryFn: async () =>
      (await api.get('/dashboard/evolucao-fornecedores')).data,
  });

  const fecharTrimestre = useMutation({
    mutationFn: async () => (await api.post('/dashboard/fechar-trimestre')).data,
    onSuccess: (res: any) => {
      message.success(
        `Trimestre ${res.trimestre} fechado. ${res.fornecedoresProcessados} fornecedor(es) reclassificado(s).`,
      );
      qc.invalidateQueries({ queryKey: ['evolucao-fornecedores'] });
      qc.invalidateQueries({ queryKey: ['fornecedores'] });
    },
    onError: () => message.error('Não foi possível fechar o trimestre.'),
  });

  const ind = kpis?.indicadores ?? {};
  const cont = kpis?.contadores ?? {};

  const emAndamento = (rncs ?? []).filter((r) => r.status === 'EM_ANDAMENTO');

  const podeAdmin =
    usuario?.papel === 'ADMIN' || usuario?.papel === 'QUALIDADE';

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Row justify="space-between" align="middle">
        <Typography.Title level={4} style={{ margin: 0 }}>
          Painel Resumo — Qualidade de Fornecedores (SQE)
        </Typography.Title>
        <RangePicker
          format="DD/MM/YYYY"
          placeholder={['Início', 'Fim']}
          onChange={(v) => setPeriodo(v as [Dayjs, Dayjs] | null)}
        />
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Fornecedores inspecionados"
              value={ind.pctFornecedoresInspecionados ?? 0}
              suffix="%"
              precision={1}
              loading={isLoading}
              prefix={<FileSearchOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Itens inspecionados"
              value={ind.pctItensInspecionados ?? 0}
              suffix="%"
              precision={1}
              loading={isLoading}
              prefix={<FileSearchOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Aprovação no recebimento"
              value={ind.pctAprovacaoRecebimento ?? 0}
              suffix="%"
              precision={1}
              loading={isLoading}
              valueStyle={{ color: '#3f8600' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Custos evitados (R$)"
              value={ind.custosEvitadosReais ?? 0}
              precision={2}
              loading={isLoading}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#D37119' }}
              formatter={(v) =>
                Number(v).toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                })
              }
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Resposta às RNCs"
              value={ind.pctRespostaRnc ?? 0}
              suffix="%"
              precision={1}
              loading={isLoading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Eficácia das respostas"
              value={ind.pctEficaciaResposta ?? 0}
              suffix="%"
              precision={1}
              loading={isLoading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Eficácia no encerramento"
              value={ind.pctEficaciaEncerramento ?? 0}
              suffix="%"
              precision={1}
              loading={isLoading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Tempo médio de resposta"
              value={ind.tempoMedioRespostaRncDias ?? 0}
              suffix="dias"
              precision={1}
              loading={isLoading}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} align="stretch">
        {[
          { t: 'Entregas', v: cont.entregas },
          { t: 'Inspeções', v: cont.inspecoes },
          {
            t: 'Recebimentos s/ inspeção',
            v: cont.recebimentosSemInspecao,
            cor: '#8c8c8c',
          },
          { t: 'RNCs (total)', v: cont.rncsTotal },
          {
            t: 'RNCs em andamento',
            v: cont.rncsAbertas,
            cor: '#cf1322',
          },
          {
            t: 'RNCs finalizadas',
            v: cont.rncsEncerradas,
            cor: '#3f8600',
          },
        ].map((c) => (
          <Col xs={12} sm={8} lg={4} key={c.t}>
            <Card size="small" style={{ height: '100%' }}>
              <Statistic
                title={
                  <span
                    style={{
                      display: 'block',
                      minHeight: 40,
                      lineHeight: '20px',
                    }}
                  >
                    {c.t}
                  </span>
                }
                value={c.v ?? 0}
                loading={isLoading}
                valueStyle={c.cor ? { color: c.cor } : undefined}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Card
        title="Evolução e Histórico dos Fornecedores"
        extra={
          podeAdmin && (
            <Button
              icon={<ReconciliationOutlined />}
              loading={fecharTrimestre.isPending}
              onClick={() =>
                Modal.confirm({
                  title: 'Fechar trimestre fiscal',
                  content:
                    'Isto vai registrar o histórico do período, reclassificar os fornecedores pela conformidade apurada e zerar os contadores do trimestre. Deseja continuar?',
                  okText: 'Fechar trimestre',
                  cancelText: 'Cancelar',
                  onOk: () => fecharTrimestre.mutate(),
                })
              }
            >
              Fechar trimestre
            </Button>
          )
        }
      >
        <Table
          rowKey="id"
          size="small"
          loading={loadingEvo}
          dataSource={evolucao}
          pagination={false}
          columns={[
            { title: 'Código', dataIndex: 'codigo', width: 100 },
            { title: 'Fornecedor', dataIndex: 'nome' },
            {
              title: 'Classificação atual',
              dataIndex: 'classificacaoFornecimento',
              width: 150,
              align: 'center',
              render: (c: string) => <Tag color={corClasse[c]}>{c}</Tag>,
            },
            {
              title: 'Apurada no período',
              dataIndex: 'classificacaoAtual',
              width: 150,
              align: 'center',
              render: (c: string) => <Tag color={corClasse[c]}>{c}</Tag>,
            },
            {
              title: 'Conformidade',
              dataIndex: 'pctConformidade',
              width: 120,
              align: 'center',
              render: (v: number) => `${v.toFixed(1)}%`,
            },
            {
              title: 'Cargas recebidas',
              dataIndex: 'totalEntregas',
              width: 130,
              align: 'center',
            },
            {
              title: 'Lotes insp.',
              dataIndex: 'lotesInspecionados',
              width: 100,
              align: 'center',
            },
            {
              title: 'Reprovados',
              dataIndex: 'lotesReprovados',
              width: 100,
              align: 'center',
            },
            {
              title: 'Tendência',
              dataIndex: 'tendencia',
              width: 130,
              align: 'center',
              render: (t: string) => tendenciaTag(t),
            },
          ]}
        />
      </Card>

      <Card title="RNCs em andamento">
        <Table
          rowKey="id"
          size="small"
          loading={loadingRnc}
          dataSource={emAndamento}
          locale={{ emptyText: 'Nenhuma RNC em andamento' }}
          onRow={(r) => ({
            onClick: () => navigate(`/rnc/${r.id}`),
            style: { cursor: 'pointer' },
          })}
          columns={[
            { title: 'Número', dataIndex: 'numero', width: 110 },
            {
              title: 'Abertura',
              dataIndex: 'dataAbertura',
              width: 110,
              render: (d: string) => dayjs(d).format('DD/MM/YYYY'),
            },
            {
              title: 'Fornecedor',
              render: (_: any, r: any) => r.fornecedor?.nome,
            },
            { title: 'Item', render: (_: any, r: any) => r.item?.descricao },
            {
              title: 'Tipo de desvio',
              dataIndex: 'tipoDesvio',
              width: 160,
              render: (v?: string) => v ?? '-',
            },
            {
              title: 'Status',
              dataIndex: 'status',
              width: 130,
              render: (s: string) => (
                <Tag color={corStatusRnc[s]}>{labelStatusRnc[s]}</Tag>
              ),
            },
          ]}
        />
      </Card>
    </Space>
  );
}

```

### `frontend/src/pages/Fornecedores.tsx`

```tsx
import { useState } from 'react';
import {
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

const corClasse: Record<string, string> = {
  A: 'green',
  B: 'blue',
  C: 'orange',
  D: 'red',
};

const labelEsforco: Record<string, string> = {
  BAIXO: 'Baixo',
  MEDIO: 'Médio',
  ALTO: 'Alto',
};

export default function Fornecedores() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState<any | null>(null);
  const [form] = Form.useForm();

  const { data, isLoading } = useQuery<any[]>({
    queryKey: ['fornecedores'],
    queryFn: async () => (await api.get('/fornecedores')).data,
  });

  const salvar = useMutation({
    mutationFn: async (values: any) => {
      const payload = {
        ...values,
        contatos: (values.contatos ?? []).filter((c: any) => c && c.nome),
      };
      if (editando)
        return api.patch(`/fornecedores/${editando.id}`, payload);
      return api.post('/fornecedores', payload);
    },
    onSuccess: () => {
      message.success('Fornecedor salvo com sucesso.');
      qc.invalidateQueries({ queryKey: ['fornecedores'] });
      fechar();
    },
    onError: () => message.error('Não foi possível salvar o fornecedor.'),
  });

  function abrir(f?: any) {
    setEditando(f ?? null);
    form.setFieldsValue(
      f ?? {
        esforcoQualidade: 'MEDIO',
        classificacaoFornecimento: 'C',
        fazVisual: true,
        fazLote: false,
        contatos: [],
      },
    );
    setOpen(true);
  }
  function fechar() {
    setOpen(false);
    setEditando(null);
    form.resetFields();
  }

  return (
    <Card
      title="Fornecedores"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => abrir()}>
          Novo Fornecedor
        </Button>
      }
    >
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={data}
        columns={[
          { title: 'Código', dataIndex: 'codigo', width: 110 },
          { title: 'Nome', dataIndex: 'nome' },
          {
            title: 'Tipo de fornecimento',
            dataIndex: 'tipoFornecimento',
            render: (v?: string) => v ?? '-',
          },
          {
            title: 'Classificação',
            dataIndex: 'classificacaoFornecimento',
            width: 120,
            align: 'center',
            render: (c: string) => <Tag color={corClasse[c]}>{c}</Tag>,
          },
          {
            title: 'Escopo',
            width: 150,
            render: (_: any, r: any) => (
              <Space size={4}>
                {r.fazVisual && <Tag color="geekblue">Visual</Tag>}
                {r.fazLote && <Tag color="purple">Lote</Tag>}
                {!r.fazVisual && !r.fazLote && '-'}
              </Space>
            ),
          },
          {
            title: 'Situação',
            dataIndex: 'ativo',
            width: 100,
            render: (a: boolean) =>
              a ? <Tag color="green">Ativo</Tag> : <Tag>Inativo</Tag>,
          },
          {
            title: 'Ações',
            width: 90,
            render: (_: any, f: any) => (
              <Button size="small" onClick={() => abrir(f)}>
                Editar
              </Button>
            ),
          },
        ]}
      />
      <Modal
        title={editando ? 'Editar Fornecedor' : 'Novo Fornecedor'}
        open={open}
        onCancel={fechar}
        onOk={() => form.submit()}
        confirmLoading={salvar.isPending}
        okText="Salvar"
        cancelText="Cancelar"
        width={760}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(v) => salvar.mutate(v)}
          style={{ marginTop: 12 }}
        >
          <Divider orientation="left" plain>
            Identificação
          </Divider>
          <Row gutter={12}>
            <Col span={6}>
              <Form.Item
                name="codigo"
                label="Código"
                rules={[{ required: true, message: 'Informe o código.' }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="nome"
                label="Nome"
                rules={[{ required: true, message: 'Informe o nome.' }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="cnpj" label="CNPJ">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="endereco" label="Endereço">
            <Input />
          </Form.Item>

          <Divider orientation="left" plain>
            Escopo e Classificação
          </Divider>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="tipoFornecimento" label="Tipo de fornecimento">
                <Input placeholder="Ex.: Estruturas metálicas" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="categoriaInspecao" label="Categoria de inspeção">
                <Input placeholder="Ex.: Metalurgia / Montagem" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="planoInspecao" label="Plano de inspeção (resumo)">
            <Input />
          </Form.Item>
          <Form.Item name="controlesPrincipais" label="Controles principais">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="escopoTexto" label="Escopo (texto livre)">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item
                name="classificacaoFornecimento"
                label="Classificação de fornecimento"
              >
                <Select
                  options={[
                    { value: 'A', label: 'A — Excelente' },
                    { value: 'B', label: 'B — Bom' },
                    { value: 'C', label: 'C — Regular' },
                    { value: 'D', label: 'D — Crítico' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="esforcoQualidade" label="Esforço de qualidade">
                <Select
                  options={Object.entries(labelEsforco).map(([v, l]) => ({
                    value: v,
                    label: l,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item
                name="fazVisual"
                label="Inspeção Visual"
                valuePropName="checked"
              >
                <Switch checkedChildren="Sim" unCheckedChildren="Não" />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item
                name="fazLote"
                label="Inspeção de Lote"
                valuePropName="checked"
              >
                <Switch checkedChildren="Sim" unCheckedChildren="Não" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" plain>
            Contatos (até 2)
          </Divider>
          <Form.List name="contatos">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field) => (
                  <Row gutter={8} key={field.key} align="middle">
                    <Col span={6}>
                      <Form.Item
                        {...field}
                        name={[field.name, 'nome']}
                        label="Nome"
                        rules={[{ required: true, message: 'Informe o nome.' }]}
                      >
                        <Input />
                      </Form.Item>
                    </Col>
                    <Col span={7}>
                      <Form.Item
                        {...field}
                        name={[field.name, 'email']}
                        label="E-mail"
                      >
                        <Input />
                      </Form.Item>
                    </Col>
                    <Col span={5}>
                      <Form.Item
                        {...field}
                        name={[field.name, 'telefone']}
                        label="Telefone"
                      >
                        <Input />
                      </Form.Item>
                    </Col>
                    <Col span={5}>
                      <Form.Item
                        {...field}
                        name={[field.name, 'funcao']}
                        label="Função"
                      >
                        <Input />
                      </Form.Item>
                    </Col>
                    <Col span={1}>
                      <Button type="link" danger onClick={() => remove(field.name)}>
                        Remover
                      </Button>
                    </Col>
                  </Row>
                ))}
                {fields.length < 2 && (
                  <Button
                    type="dashed"
                    onClick={() => add()}
                    block
                    icon={<PlusOutlined />}
                  >
                    Adicionar contato
                  </Button>
                )}
              </>
            )}
          </Form.List>

          {editando && (
            <Form.Item
              name="ativo"
              label="Fornecedor ativo"
              valuePropName="checked"
              style={{ marginTop: 16 }}
            >
              <Switch checkedChildren="Ativo" unCheckedChildren="Inativo" />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </Card>
  );
}

```

### `frontend/src/pages/Inspecoes.tsx`

```tsx
import { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Row,
  Select,
  Space,
  Steps,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  FileTextOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { useFornecedores, opcoesFornecedor } from '../hooks';
import { semanaAno } from '../semana';

type StatusItem = 'APROVADO' | 'REPROVADO' | 'NAO_APLICAVEL';

const corResultado: Record<string, string> = {
  APROVADO: 'green',
  REPROVADO: 'red',
  SEM_INSPECAO: 'default',
};

const labelResultado: Record<string, string> = {
  APROVADO: 'Aprovado',
  REPROVADO: 'Reprovado',
  SEM_INSPECAO: 'Sem Inspeção Recomendada',
};

const labelTipo: Record<string, string> = {
  VISUAL: 'Visual',
  LOTE: 'Lote / Dimensional',
  RECEBIMENTO: 'Recebimento',
};

function ChecklistVisual({
  grupos,
  setGrupos,
}: {
  grupos: any[];
  setGrupos: (g: any[]) => void;
}) {
  function marcar(gi: number, ii: number, status: StatusItem) {
    const copia = grupos.map((g) => ({ ...g, itens: g.itens.map((x: any) => ({ ...x })) }));
    copia[gi].itens[ii].status = status;
    setGrupos(copia);
  }
  function marcarGrupo(gi: number, status: StatusItem) {
    const copia = grupos.map((g) => ({ ...g, itens: g.itens.map((x: any) => ({ ...x })) }));
    copia[gi].itens.forEach((x: any) => (x.status = status));
    setGrupos(copia);
  }

  return (
    <div style={{ maxHeight: '55vh', overflowY: 'auto', paddingRight: 8 }}>
      {grupos.map((g, gi) => (
        <Card
          key={g.grupo}
          size="small"
          title={g.grupo}
          style={{ marginBottom: 12 }}
          extra={
            <Space size={4}>
              <Button size="small" onClick={() => marcarGrupo(gi, 'APROVADO')}>
                Todos Aprovados
              </Button>
              <Button
                size="small"
                onClick={() => marcarGrupo(gi, 'NAO_APLICAVEL')}
              >
                N/A
              </Button>
            </Space>
          }
        >
          {g.itens.map((item: any, ii: number) => (
            <Row
              key={ii}
              align="middle"
              justify="space-between"
              style={{ padding: '4px 0' }}
            >
              <Col flex="auto">
                <Typography.Text>{item.texto}</Typography.Text>
              </Col>
              <Col>
                <Radio.Group
                  size="small"
                  value={item.status}
                  onChange={(e) => marcar(gi, ii, e.target.value)}
                  optionType="button"
                  buttonStyle="solid"
                >
                  <Radio.Button value="APROVADO">Aprovado</Radio.Button>
                  <Radio.Button value="REPROVADO">Reprovado</Radio.Button>
                  <Radio.Button value="NAO_APLICAVEL">N/A</Radio.Button>
                </Radio.Group>
              </Col>
            </Row>
          ))}
        </Card>
      ))}
    </div>
  );
}

function TabelaCotas({
  cotas,
  setCotas,
}: {
  cotas: any[];
  setCotas: (c: any[]) => void;
}) {
  function add() {
    setCotas([
      ...cotas,
      {
        localizacao: '',
        especificado: '',
        tolUpper: '',
        tolLower: '',
        medido: '',
        instrumento: '',
        conforme: true,
      },
    ]);
  }
  function edit(idx: number, campo: string, valor: any) {
    const copia = cotas.map((c) => ({ ...c }));
    copia[idx][campo] = valor;
    setCotas(copia);
  }
  function remove(idx: number) {
    setCotas(cotas.filter((_, i) => i !== idx));
  }

  return (
    <div>
      <Table
        size="small"
        rowKey={(_, i) => String(i)}
        dataSource={cotas}
        pagination={false}
        locale={{ emptyText: 'Nenhuma cota adicionada' }}
        columns={[
          {
            title: 'Localização / Cota',
            render: (_: any, r: any, i: number) => (
              <Input
                value={r.localizacao}
                onChange={(e) => edit(i, 'localizacao', e.target.value)}
              />
            ),
          },
          {
            title: 'Especificado',
            width: 110,
            render: (_: any, r: any, i: number) => (
              <Input
                value={r.especificado}
                onChange={(e) => edit(i, 'especificado', e.target.value)}
              />
            ),
          },
          {
            title: 'Tol. +',
            width: 80,
            render: (_: any, r: any, i: number) => (
              <Input
                value={r.tolUpper}
                onChange={(e) => edit(i, 'tolUpper', e.target.value)}
              />
            ),
          },
          {
            title: 'Tol. -',
            width: 80,
            render: (_: any, r: any, i: number) => (
              <Input
                value={r.tolLower}
                onChange={(e) => edit(i, 'tolLower', e.target.value)}
              />
            ),
          },
          {
            title: 'Medido',
            width: 100,
            render: (_: any, r: any, i: number) => (
              <Input
                value={r.medido}
                onChange={(e) => edit(i, 'medido', e.target.value)}
              />
            ),
          },
          {
            title: 'Instrumento',
            width: 130,
            render: (_: any, r: any, i: number) => (
              <Input
                value={r.instrumento}
                onChange={(e) => edit(i, 'instrumento', e.target.value)}
              />
            ),
          },
          {
            title: 'Conforme?',
            width: 120,
            render: (_: any, r: any, i: number) => (
              <Radio.Group
                size="small"
                value={r.conforme}
                onChange={(e) => edit(i, 'conforme', e.target.value)}
                optionType="button"
                buttonStyle="solid"
              >
                <Radio.Button value={true}>Sim</Radio.Button>
                <Radio.Button value={false}>Não</Radio.Button>
              </Radio.Group>
            ),
          },
          {
            title: '',
            width: 40,
            render: (_: any, __: any, i: number) => (
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => remove(i)}
              />
            ),
          },
        ]}
      />
      <Button
        type="dashed"
        block
        icon={<PlusOutlined />}
        onClick={add}
        style={{ marginTop: 8 }}
      >
        Adicionar cota
      </Button>
    </div>
  );
}

export default function Inspecoes() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const isAdmin = usuario?.papel === 'ADMIN';
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const [grupos, setGrupos] = useState<any[]>([]);
  const [cotas, setCotas] = useState<any[]>([]);
  const [fotosReprova, setFotosReprova] = useState<any[]>([]);
  const [passoIdx, setPassoIdx] = useState(0);
  const [rncsGeradas, setRncsGeradas] = useState<any[]>([]);
  // Entrega (carga) criada no passo Visual, reaproveitada no Lote encadeado:
  // uma unica carga por recebimento, mesmo fazendo Visual + Lote.
  const [entregaEncadeada, setEntregaEncadeada] = useState<number | undefined>();
  const [salvando, setSalvando] = useState(false);
  const fornecedorId = Form.useWatch('fornecedorId', form);

  const hoje = dayjs();
  const { semana: semanaHoje, ano: anoHoje } = semanaAno(hoje.toDate());

  const { data: fornecedores } = useFornecedores();

  const { data: template } = useQuery<any[]>({
    queryKey: ['template-visual'],
    queryFn: async () => (await api.get('/inspecoes/template-visual')).data,
  });

  const { data, isLoading } = useQuery<any[]>({
    queryKey: ['inspecoes'],
    queryFn: async () => (await api.get('/inspecoes')).data,
  });

  // Avalia recebimento (classificacao + periodicidade + contador ciclico)
  const { data: avaliacao } = useQuery<any>({
    queryKey: ['avaliar', fornecedorId],
    queryFn: async () =>
      (await api.get(`/inspecoes/avaliar?fornecedorId=${fornecedorId}`)).data,
    enabled: !!fornecedorId,
  });

  const precisaInspecionar = avaliacao?.precisaInspecionar ?? true;

  const fornecedorSel = useMemo(
    () => (fornecedores ?? []).find((f: any) => f.id === fornecedorId),
    [fornecedores, fornecedorId],
  );

  // Sequencia de etapas conforme escopo do fornecedor (ordem fixa Visual -> Lote)
  const passos = useMemo<('VISUAL' | 'LOTE')[]>(() => {
    if (!precisaInspecionar) return [];
    const fazVisual = !fornecedorSel || fornecedorSel.fazVisual;
    const fazLote = fornecedorSel?.fazLote;
    const seq: ('VISUAL' | 'LOTE')[] = [];
    if (fazVisual) seq.push('VISUAL');
    if (fazLote) seq.push('LOTE');
    return seq.length ? seq : ['VISUAL'];
  }, [precisaInspecionar, fornecedorSel]);

  const tipo = passos[passoIdx] ?? 'VISUAL';
  const encadeado = passos.length > 1;

  function limparEtapa() {
    setGrupos(
      template
        ? template.map((g) => ({
            ...g,
            itens: g.itens.map((x: any) => ({ ...x })),
          }))
        : [],
    );
    setCotas([]);
    setFotosReprova([]);
    form.setFieldsValue({
      itemDescricao: undefined,
      itemCodigo: undefined,
      notaFiscal: undefined,
      po: undefined,
      qtdInspecionada: undefined,
      qtdTotal: undefined,
      desenhoRev: undefined,
      toleranciasNorm: undefined,
      relatorioNumero: undefined,
      observacoes: undefined,
      disposicao: undefined,
    });
  }

  function novaInspecao() {
    form.resetFields();
    setPassoIdx(0);
    setRncsGeradas([]);
    setEntregaEncadeada(undefined);
    limparEtapa();
    form.setFieldsValue({ origem: 'PLANO_INSPECAO' });
    setOpen(true);
  }

  // Resultado automatico a partir do preenchimento
  const resultadoAuto = useMemo(() => {
    if (tipo === 'VISUAL') {
      const reprovou = grupos.some((g) =>
        g.itens.some((i: any) => i.status === 'REPROVADO'),
      );
      return reprovou ? 'REPROVADO' : 'APROVADO';
    }
    const reprovou = cotas.some((c) => c.conforme === false);
    return reprovou ? 'REPROVADO' : 'APROVADO';
  }, [tipo, grupos, cotas]);

  async function enviarFotos(rncId: number) {
    for (const f of fotosReprova) {
      const arquivo = f.originFileObj ?? f;
      const fd = new FormData();
      fd.append('file', arquivo as Blob);
      try {
        await api.post('/anexos', fd, {
          params: { entidadeTipo: 'RNC', entidadeId: rncId },
        });
      } catch {
        message.warning('Uma foto não pôde ser enviada.');
      }
    }
  }

  function invalidar() {
    qc.invalidateQueries({ queryKey: ['inspecoes'] });
    qc.invalidateQueries({ queryKey: ['entregas'] });
    qc.invalidateQueries({ queryKey: ['avaliar'] });
    qc.invalidateQueries({ queryKey: ['fornecedores'] });
  }

  function finalizarFluxo(rncs: any[]) {
    setOpen(false);
    invalidar();
    if (rncs.length) {
      Modal.confirm({
        title:
          rncs.length > 1
            ? 'Inspeções reprovadas — RNCs geradas'
            : 'Inspeção reprovada — RNC gerada',
        content: (
          <div>
            {rncs.map((r) => (
              <div key={r.id}>RNC {r.numero}</div>
            ))}
            <p style={{ marginTop: 8 }}>Deseja abrir a primeira agora?</p>
          </div>
        ),
        okText: 'Abrir RNC',
        cancelText: 'Depois',
        onOk: () => navigate(`/rnc/${rncs[0].id}`),
      });
    } else {
      message.success('Inspeção registrada. Recebimento aprovado.');
    }
  }

  async function onFinish(v: any) {
    setSalvando(true);
    try {
      // Fora do ciclo de periodicidade: registra apenas o recebimento
      if (!precisaInspecionar) {
        await api.post('/inspecoes/recebimento', {
          fornecedorId: v.fornecedorId,
          notaFiscal: v.notaFiscal,
          po: v.po,
          dataEntrega: hoje.toISOString(),
        });
        setOpen(false);
        invalidar();
        message.success(
          'Recebimento registrado sem inspeção (fora do ciclo de periodicidade).',
        );
        return;
      }

      const reprovado = resultadoAuto === 'REPROVADO';
      const rota = tipo === 'VISUAL' ? '/inspecoes/visual' : '/inspecoes/lote';
      const payload: any = {
        fornecedorId: v.fornecedorId,
        itemDescricao: v.itemDescricao,
        itemCodigo: v.itemCodigo,
        notaFiscal: v.notaFiscal,
        po: v.po,
        qtdInspecionada: v.qtdInspecionada,
        qtdTotal: v.qtdTotal,
        desenhoRev: v.desenhoRev,
        toleranciasNorm: v.toleranciasNorm,
        relatorioNumero: v.relatorioNumero,
        observacoes: v.observacoes,
        disposicao: reprovado ? v.disposicao : undefined,
        dataInspecao: hoje.toISOString(),
        resultado: resultadoAuto,
      };
      if (tipo === 'VISUAL') payload.checklist = grupos;
      else {
        payload.cotas = cotas;
        payload.encadeadoAposVisual = passoIdx > 0;
        // Reaproveita a carga criada no Visual: 1 recebimento apenas.
        if (passoIdx > 0 && entregaEncadeada) payload.entregaId = entregaEncadeada;
      }

      const res = (await api.post(rota, payload)).data;

      let rncs = rncsGeradas;
      if (res.rnc) {
        await enviarFotos(res.rnc.id);
        rncs = [...rncs, res.rnc];
        setRncsGeradas(rncs);
      }

      // Ha proxima etapa (encadeamento Visual -> Lote)?
      if (passoIdx < passos.length - 1) {
        const proximo = passos[passoIdx + 1];
        // Guarda a entrega do Visual para o Lote usar a MESMA carga.
        if (res.inspecao?.entregaId) setEntregaEncadeada(res.inspecao.entregaId);
        setPassoIdx(passoIdx + 1);
        limparEtapa();
        message.success(
          `${tipo === 'VISUAL' ? 'Visual' : 'Lote'} registrado. Prossiga com a inspeção de ${
            proximo === 'LOTE' ? 'Lote' : 'Visual'
          }.`,
        );
        return;
      }

      finalizarFluxo(rncs);
    } catch {
      message.error('Não foi possível registrar o recebimento.');
    } finally {
      setSalvando(false);
    }
  }

  async function excluirInspecao(r: any, cascade = false) {
    const rota = r.tipoFormulario === 'VISUAL' ? 'visual' : 'lote';
    try {
      await api.delete(`/inspecoes/${rota}/${r.id}`, {
        params: cascade ? { cascade: 'true' } : {},
      });
      message.success('Inspeção excluída.');
      invalidar();
    } catch (e: any) {
      const body = e?.response?.data;
      if (e?.response?.status === 409 && body?.rncs?.length) {
        Modal.confirm({
          title: 'Existe RNC vinculada a esta inspeção',
          content: (
            <div>
              <p>
                Esta inspeção gerou a(s) RNC(s) abaixo. Para excluir a inspeção é
                preciso excluir também a(s) RNC(s) vinculada(s):
              </p>
              {body.rncs.map((x: any) => (
                <div key={x.id}>
                  <a onClick={() => navigate(`/rnc/${x.id}`)}>RNC {x.numero}</a>
                </div>
              ))}
            </div>
          ),
          okText: 'Excluir inspeção + RNC(s)',
          okButtonProps: { danger: true },
          cancelText: 'Cancelar',
          onOk: () => excluirInspecao(r, true),
        });
      } else {
        message.error('Não foi possível excluir a inspeção.');
      }
    }
  }

  function confirmarExclusao(r: any) {
    Modal.confirm({
      title: `Excluir esta inspeção ${labelTipo[r.tipoFormulario]}?`,
      icon: <DeleteOutlined style={{ color: '#cf1322' }} />,
      content: 'A remoção é permanente e não pode ser desfeita.',
      okText: 'Excluir',
      okButtonProps: { danger: true },
      cancelText: 'Cancelar',
      onOk: () => excluirInspecao(r, false),
    });
  }

  const filtrosDe = (
    valores: (string | undefined)[],
  ): { text: string; value: string }[] =>
    Array.from(new Set(valores.filter(Boolean) as string[]))
      .sort()
      .map((v) => ({ text: v, value: v }));

  const filtrosFornecedor = filtrosDe(
    (data ?? []).map((r) => r.fornecedor?.nome),
  );
  const filtrosItem = filtrosDe((data ?? []).map((r) => r.item?.descricao));

  return (
    <Card
      title="Inspeções de Recebimento"
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => novaInspecao()}
        >
          Nova Inspeção
        </Button>
      }
    >
      <Table
        rowKey={(r) => `${r.tipoFormulario}-${r.id}`}
        loading={isLoading}
        dataSource={data}
        columns={[
          {
            title: 'Data',
            dataIndex: 'dataInspecao',
            width: 110,
            defaultSortOrder: 'descend',
            sorter: (a: any, b: any) =>
              dayjs(a.dataInspecao).valueOf() - dayjs(b.dataInspecao).valueOf(),
            render: (d?: string) => (d ? dayjs(d).format('DD/MM/YYYY') : '-'),
          },
          {
            title: 'Semana',
            dataIndex: 'semana',
            width: 90,
            render: (v?: string) => v ?? '-',
          },
          { title: 'Ano', dataIndex: 'ano', width: 80, render: (v?: number) => v ?? '-' },
          {
            title: 'Formulário',
            dataIndex: 'tipoFormulario',
            width: 150,
            filters: Object.entries(labelTipo).map(([value, text]) => ({
              text,
              value,
            })),
            onFilter: (v: any, r: any) => r.tipoFormulario === v,
            render: (t: string) => <Tag>{labelTipo[t] ?? t}</Tag>,
          },
          {
            title: 'Fornecedor',
            filters: filtrosFornecedor,
            onFilter: (v: any, r: any) => r.fornecedor?.nome === v,
            render: (_: any, r: any) => r.fornecedor?.nome,
          },
          {
            title: 'Item',
            filters: filtrosItem,
            onFilter: (v: any, r: any) => r.item?.descricao === v,
            render: (_: any, r: any) => r.item?.descricao ?? '-',
          },
          {
            title: 'Resultado',
            dataIndex: 'resultado',
            width: 200,
            filters: Object.entries(labelResultado).map(([value, text]) => ({
              text,
              value,
            })),
            onFilter: (v: any, r: any) => r.resultado === v,
            render: (r: string) => (
              <Tag color={corResultado[r]}>{labelResultado[r] ?? r}</Tag>
            ),
          },
          {
            title: 'RNC',
            width: 130,
            render: (_: any, r: any) =>
              r.rncs?.length ? (
                <Button
                  size="small"
                  type="link"
                  icon={<FileTextOutlined />}
                  onClick={() => navigate(`/rnc/${r.rncs[0].id}`)}
                >
                  {r.rncs[0].numero}
                </Button>
              ) : (
                '-'
              ),
          },
          ...(isAdmin
            ? [
                {
                  title: '',
                  width: 50,
                  render: (_: any, r: any) =>
                    r.tipoFormulario === 'RECEBIMENTO' ? null : (
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => confirmarExclusao(r)}
                      />
                    ),
                },
              ]
            : []),
        ]}
      />

      <Modal
        title="Nova Inspeção de Recebimento"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={salvando}
        okText={
          fornecedorId && !precisaInspecionar
            ? 'Registrar recebimento sem inspeção'
            : passoIdx < passos.length - 1
              ? `Registrar ${tipo === 'VISUAL' ? 'Visual' : 'Lote'} e continuar`
              : 'Registrar Inspeção'
        }
        cancelText="Cancelar"
        width={900}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          style={{ marginTop: 8 }}
        >
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="fornecedorId"
                label="Fornecedor"
                rules={[{ required: true, message: 'Selecione o fornecedor.' }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  disabled={passoIdx > 0}
                  options={opcoesFornecedor(fornecedores)}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* Data / Semana / Ano (automaticos a partir da data de abertura) */}
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item label="Data">
                <Input value={hoje.format('DD/MM/YYYY')} disabled />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Semana">
                <Input value={semanaHoje} disabled />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Ano">
                <Input value={String(anoHoje)} disabled />
              </Form.Item>
            </Col>
          </Row>

          {/* Decisao de recebimento: classificacao + periodicidade + contador */}
          {fornecedorId && avaliacao && (
            <Descriptions
              size="small"
              bordered
              column={2}
              style={{ marginBottom: 12 }}
            >
              <Descriptions.Item label="Classificação">
                <Tag color="blue">
                  {avaliacao.fornecedor?.classificacaoFornecimento}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Periodicidade">
                {avaliacao.periodicidade?.periodicidadeTexto ??
                  `1 a cada ${avaliacao.frequenciaN} entregas`}
              </Descriptions.Item>
              <Descriptions.Item label="Entregas no ciclo">
                {avaliacao.proximoContador} de {avaliacao.frequenciaN}
              </Descriptions.Item>
              <Descriptions.Item label="Escopo">
                {avaliacao.fornecedor?.fazVisual && (
                  <Tag color="geekblue">Visual</Tag>
                )}
                {avaliacao.fornecedor?.fazLote && (
                  <Tag color="purple">Lote</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Decisão" span={2}>
                {precisaInspecionar ? (
                  <Tag color="orange">Esta entrega DEVE ser inspecionada</Tag>
                ) : (
                  <Tag color="green">
                    Fora do ciclo — recebimento sem inspeção
                  </Tag>
                )}
              </Descriptions.Item>
            </Descriptions>
          )}

          {/* Recebimento sem inspecao: apenas NF / PO (data/semana/ano acima) */}
          {precisaInspecionar === false && fornecedorId && (
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="notaFiscal" label="Nota Fiscal">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="po" label="PO">
                  <Input />
                </Form.Item>
              </Col>
            </Row>
          )}

          {precisaInspecionar && (
            <>
              {encadeado && (
                <Steps
                  size="small"
                  current={passoIdx}
                  style={{ marginBottom: 16 }}
                  items={passos.map((p) => ({
                    title: p === 'VISUAL' ? 'Inspeção Visual' : 'Inspeção de Lote',
                  }))}
                />
              )}

              <Row gutter={12}>
                <Col span={16}>
                  <Form.Item
                    name="itemDescricao"
                    label="Item (descrição)"
                    rules={[{ required: true, message: 'Informe o item.' }]}
                  >
                    <Input placeholder="Ex.: Chapa de aço galvanizado 2mm" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="itemCodigo" label="Código do item">
                    <Input placeholder="opcional" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={12}>
                <Col span={6}>
                  <Form.Item name="notaFiscal" label="Nota Fiscal">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="po" label="PO">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="qtdInspecionada" label="Qtd. inspecionada">
                    <InputNumber style={{ width: '100%' }} min={0} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="qtdTotal" label="Qtd. total do lote">
                    <InputNumber style={{ width: '100%' }} min={0} />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={12}>
                <Col span={8}>
                  <Form.Item name="desenhoRev" label="Desenho / Revisão">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="toleranciasNorm" label="Tolerâncias / Norma">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="relatorioNumero" label="Nº do relatório">
                    <Input />
                  </Form.Item>
                </Col>
              </Row>

              <Divider orientation="left" plain>
                {tipo === 'VISUAL'
                  ? 'Checklist Visual (Doc. BDBR.QUA.FMR.06.07)'
                  : 'Dimensional (Doc. BDBR.QUA.FMR.011.06)'}
              </Divider>

              {tipo === 'VISUAL' ? (
                <ChecklistVisual grupos={grupos} setGrupos={setGrupos} />
              ) : (
                <TabelaCotas cotas={cotas} setCotas={setCotas} />
              )}

              <Form.Item
                name="observacoes"
                label="Observações"
                style={{ marginTop: 12 }}
              >
                <Input.TextArea rows={2} />
              </Form.Item>

              <Alert
                type={resultadoAuto === 'REPROVADO' ? 'error' : 'success'}
                showIcon
                message={
                  resultadoAuto === 'REPROVADO'
                    ? 'Resultado: REPROVADO — será aberta uma RNC automaticamente.'
                    : 'Resultado: APROVADO — recebimento liberado.'
                }
              />

              {/* Reprovado: capturar disposicao + fotos, que nascem vinculadas a RNC */}
              {resultadoAuto === 'REPROVADO' && (
                <div style={{ marginTop: 12 }}>
                  <Form.Item
                    name="disposicao"
                    label="Disposição"
                    rules={[
                      { required: true, message: 'Informe a disposição.' },
                    ]}
                  >
                    <Input.TextArea
                      rows={2}
                      placeholder="Ex.: Devolver ao fornecedor / Retrabalho / Uso sob concessão"
                    />
                  </Form.Item>
                  <Form.Item label="Fotos da não conformidade">
                    <Upload
                      multiple
                      accept="image/*"
                      listType="picture"
                      fileList={fotosReprova}
                      beforeUpload={() => false}
                      onChange={({ fileList }) => setFotosReprova(fileList)}
                    >
                      <Button icon={<UploadOutlined />}>Adicionar fotos</Button>
                    </Upload>
                  </Form.Item>
                </div>
              )}
            </>
          )}
        </Form>
      </Modal>
    </Card>
  );
}

```

### `frontend/src/pages/RncLista.tsx`

```tsx
import { useState } from 'react';
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tag,
  message,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useFornecedores, opcoesFornecedor } from '../hooks';
import { semanaAno } from '../semana';

export const corStatusRnc: Record<string, string> = {
  EM_ANDAMENTO: 'orange',
  FINALIZADA: 'green',
  CANCELADA: 'default',
};

export const labelStatusRnc: Record<string, string> = {
  EM_ANDAMENTO: 'Em andamento',
  FINALIZADA: 'Finalizada',
  CANCELADA: 'Cancelada',
};

const corEficacia: Record<string, string> = {
  PENDENTE: 'default',
  APROVADO: 'green',
  REPROVADO: 'red',
  NAO_APLICAVEL: 'default',
};

const labelEficacia: Record<string, string> = {
  PENDENTE: 'Pendente',
  APROVADO: 'Aprovada',
  REPROVADO: 'Reprovada',
  NAO_APLICAVEL: 'N/A',
};

export default function RncLista() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const [filtroStatus, setFiltroStatus] = useState<string | undefined>();
  const { data: fornecedores } = useFornecedores();

  const hoje = dayjs();
  const { semana: semanaHoje, ano: anoHoje } = semanaAno(hoje.toDate());

  const { data, isLoading } = useQuery<any[]>({
    queryKey: ['rnc', filtroStatus],
    queryFn: async () =>
      (await api.get('/rnc', { params: { status: filtroStatus } })).data,
  });

  const filtrosDe = (
    valores: (string | undefined)[],
  ): { text: string; value: string }[] =>
    Array.from(new Set(valores.filter(Boolean) as string[]))
      .sort()
      .map((v) => ({ text: v, value: v }));

  const filtrosFornecedor = filtrosDe((data ?? []).map((r) => r.fornecedor?.nome));
  const filtrosItem = filtrosDe((data ?? []).map((r) => r.item?.descricao));
  const filtrosTipo = filtrosDe((data ?? []).map((r) => r.tipoDesvio));

  const salvar = useMutation({
    mutationFn: async (v: any) => (await api.post('/rnc', v)).data,
    onSuccess: (rnc: any) => {
      message.success(`RNC ${rnc.numero} aberta.`);
      qc.invalidateQueries({ queryKey: ['rnc'] });
      setOpen(false);
      form.resetFields();
      navigate(`/rnc/${rnc.id}`);
    },
    onError: () => message.error('Não foi possível abrir a RNC.'),
  });

  return (
    <Card
      title="RNC — Registros de Não Conformidade"
      extra={
        <Space>
          <Select
            allowClear
            placeholder="Filtrar por status"
            style={{ width: 190 }}
            value={filtroStatus}
            onChange={setFiltroStatus}
            options={Object.entries(labelStatusRnc).map(([v, l]) => ({
              value: v,
              label: l,
            }))}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setOpen(true)}
          >
            Abrir RNC
          </Button>
        </Space>
      }
    >
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={data}
        scroll={{ x: 'max-content' }}
        onRow={(r) => ({
          onClick: () => navigate(`/rnc/${r.id}`),
          style: { cursor: 'pointer' },
        })}
        columns={[
          { title: 'Número', dataIndex: 'numero', width: 100 },
          {
            title: 'Abertura',
            dataIndex: 'dataAbertura',
            width: 110,
            defaultSortOrder: 'descend',
            sorter: (a: any, b: any) =>
              dayjs(a.dataAbertura).valueOf() - dayjs(b.dataAbertura).valueOf(),
            render: (d: string) => dayjs(d).format('DD/MM/YYYY'),
          },
          { title: 'Semana', dataIndex: 'semana', width: 90, render: (v?: string) => v ?? '-' },
          { title: 'Ano', dataIndex: 'ano', width: 80 },
          {
            title: 'Fornecedor',
            filters: filtrosFornecedor,
            onFilter: (v: any, r: any) => r.fornecedor?.nome === v,
            render: (_: any, r: any) => r.fornecedor?.nome,
          },
          {
            title: 'Item',
            filters: filtrosItem,
            onFilter: (v: any, r: any) => r.item?.descricao === v,
            render: (_: any, r: any) => r.item?.descricao,
          },
          {
            title: 'Tipo de desvio',
            dataIndex: 'tipoDesvio',
            width: 160,
            filters: filtrosTipo,
            onFilter: (v: any, r: any) => r.tipoDesvio === v,
            render: (v?: string) => v ?? '-',
          },
          {
            title: 'Reincidência',
            dataIndex: 'reincidencia',
            width: 110,
            align: 'center',
            filters: [
              { text: 'Sim', value: true },
              { text: 'Não', value: false },
            ],
            onFilter: (v: any, r: any) => r.reincidencia === v,
            render: (v: boolean) =>
              v ? <Tag color="red">Sim</Tag> : <Tag>Não</Tag>,
          },
          {
            title: 'Valor (R$)',
            dataIndex: 'valorTotal',
            width: 120,
            align: 'right',
            sorter: (a: any, b: any) =>
              (a.valorTotal ?? 0) - (b.valorTotal ?? 0),
            render: (v?: number) =>
              v
                ? Number(v).toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                  })
                : '-',
          },
          {
            title: 'Status',
            dataIndex: 'status',
            width: 130,
            filters: Object.entries(labelStatusRnc).map(([value, text]) => ({
              text,
              value,
            })),
            onFilter: (v: any, r: any) => r.status === v,
            render: (s: string) => (
              <Tag color={corStatusRnc[s]}>{labelStatusRnc[s] ?? s}</Tag>
            ),
          },
          {
            title: 'Eficácia',
            dataIndex: 'verificacaoEficacia',
            width: 110,
            filters: Object.entries(labelEficacia).map(([value, text]) => ({
              text,
              value,
            })),
            onFilter: (v: any, r: any) => r.verificacaoEficacia === v,
            render: (e: string) => (
              <Tag color={corEficacia[e]}>{labelEficacia[e] ?? e}</Tag>
            ),
          },
        ]}
      />

      <Modal
        title="Abrir RNC (Registro de Não Conformidade)"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={salvar.isPending}
        okText="Abrir RNC"
        cancelText="Cancelar"
        width={680}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(v) => salvar.mutate(v)}
          style={{ marginTop: 12 }}
        >
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item label="Data de abertura">
                <Input value={hoje.format('DD/MM/YYYY')} disabled />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Semana">
                <Input value={semanaHoje} disabled />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Ano">
                <Input value={String(anoHoje)} disabled />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="fornecedorId"
                label="Fornecedor"
                rules={[{ required: true, message: 'Selecione o fornecedor.' }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={opcoesFornecedor(fornecedores)}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="itemDescricao"
                label="Item (descrição)"
                rules={[{ required: true, message: 'Informe o item.' }]}
              >
                <Input placeholder="Ex.: Chapa de aço galvanizado 2mm" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="itemCodigo" label="Código do item">
            <Input placeholder="opcional" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="notaFiscal" label="Nota Fiscal">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="po" label="PO">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="quantidadeLote" label="Qtd. do lote">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="tipoDesvio" label="Tipo de desvio">
            <Input placeholder="Ex.: Dimensional, Visual, Acabamento" />
          </Form.Item>
          <Form.Item
            name="descricaoDesvio"
            label="Descrição do desvio"
            rules={[{ required: true, message: 'Descreva o desvio.' }]}
          >
            <Input.TextArea rows={3} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="quantidadePecas" label="Qtd. de peças afetadas">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="valorUnitario" label="Valor unitário (R$)">
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={2}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="disposicao" label="Disposição">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}

```

### `frontend/src/pages/RncDetalhe.tsx`

```tsx
import { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Form,
  Image,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Switch,
  Tag,
  Timeline,
  Typography,
  Upload,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  FilePdfOutlined,
  UploadOutlined,
  EditOutlined,
  StopOutlined,
  DeleteOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useNavigate, useParams } from 'react-router-dom';
import { api, abrirPdfEmNovaAba } from '../api';
import { AuthImage } from '../components/AuthImage';
import { useAuth } from '../auth';
import { corStatusRnc, labelStatusRnc } from './RncLista';

const labelEficacia: Record<string, string> = {
  PENDENTE: 'Pendente',
  APROVADO: 'Aprovada',
  REPROVADO: 'Reprovada',
  NAO_APLICAVEL: 'Não se aplica',
};
const corEficacia: Record<string, string> = {
  PENDENTE: 'default',
  APROVADO: 'green',
  REPROVADO: 'red',
  NAO_APLICAVEL: 'default',
};

const MAX_FOTOS = 5;

function moeda(v?: number | null) {
  return v != null
    ? Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
    : '-';
}

export default function RncDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { usuario } = useAuth();
  const isAdmin = usuario?.papel === 'ADMIN';
  const [editOpen, setEditOpen] = useState(false);
  const [encerrarOpen, setEncerrarOpen] = useState(false);
  const [cancelarOpen, setCancelarOpen] = useState(false);
  const [formEdit] = Form.useForm();
  const [formEncerrar] = Form.useForm();
  const [formCancelar] = Form.useForm();

  const { data: rnc, isLoading } = useQuery<any>({
    queryKey: ['rnc', 'detalhe', id],
    queryFn: async () => (await api.get(`/rnc/${id}`)).data,
  });

  const { data: anexos } = useQuery<any[]>({
    queryKey: ['anexos', 'RNC', id],
    queryFn: async () =>
      (
        await api.get('/anexos', {
          params: { entidadeTipo: 'RNC', entidadeId: id },
        })
      ).data,
  });

  function invalidar() {
    qc.invalidateQueries({ queryKey: ['rnc'] });
    qc.invalidateQueries({ queryKey: ['rnc', 'detalhe', id] });
  }

  const atualizar = useMutation({
    mutationFn: async (v: any) =>
      api.patch(`/rnc/${id}`, {
        ...v,
        dataRetorno: v.dataRetorno ? v.dataRetorno.toISOString() : undefined,
      }),
    onSuccess: () => {
      message.success('RNC atualizada.');
      setEditOpen(false);
      invalidar();
    },
    onError: () => message.error('Não foi possível atualizar a RNC.'),
  });

  const encerrar = useMutation({
    mutationFn: async (v: any) =>
      api.patch(`/rnc/${id}`, {
        ...v,
        status: 'FINALIZADA',
        dataVerificacao: new Date().toISOString(),
      }),
    onSuccess: () => {
      message.success('RNC finalizada.');
      setEncerrarOpen(false);
      invalidar();
    },
    onError: () => message.error('Não foi possível finalizar a RNC.'),
  });

  const reabrir = useMutation({
    mutationFn: async () => api.patch(`/rnc/${id}/reabrir`),
    onSuccess: () => {
      message.success('RNC reaberta.');
      invalidar();
    },
    onError: () => message.error('Não foi possível reabrir a RNC.'),
  });

  const cancelar = useMutation({
    mutationFn: async (v: any) =>
      api.patch(`/rnc/${id}/cancelar`, { motivo: v.motivo }),
    onSuccess: () => {
      message.success('RNC cancelada.');
      setCancelarOpen(false);
      formCancelar.resetFields();
      invalidar();
    },
    onError: () => message.error('Não foi possível cancelar a RNC.'),
  });

  const remover = useMutation({
    mutationFn: async () => api.delete(`/rnc/${id}`),
    onSuccess: () => {
      message.success('RNC excluída.');
      qc.invalidateQueries({ queryKey: ['rnc'] });
      navigate('/rnc');
    },
    onError: () => message.error('Não foi possível excluir a RNC.'),
  });

  if (isLoading || !rnc) return <Card loading />;

  const finalizada = rnc.status === 'FINALIZADA';
  const cancelada = rnc.status === 'CANCELADA';
  const inspecaoVinculada = rnc.inspecaoVisual ?? rnc.inspecaoLote;
  const tipoInspVinc = rnc.inspecaoVisual ? 'visual' : 'lote';

  function confirmarExclusao() {
    Modal.confirm({
      title: `Excluir a RNC ${rnc.numero}?`,
      icon: <DeleteOutlined style={{ color: '#cf1322' }} />,
      content: inspecaoVinculada ? (
        <div>
          <p>Esta RNC foi gerada por uma inspeção {tipoInspVinc} (#
          {inspecaoVinculada.id}). A exclusão remove <strong>apenas a RNC</strong>
          {' '}— a inspeção permanece.</p>
          <p>
            Se quiser, você pode excluir a inspeção depois, na tela de
            Inspeções.
          </p>
        </div>
      ) : (
        'A remoção é permanente e não pode ser desfeita.'
      ),
      okText: 'Excluir RNC',
      okButtonProps: { danger: true },
      cancelText: 'Cancelar',
      onOk: () => remover.mutateAsync(),
    });
  }
  const fotos = (anexos ?? []).filter((a) =>
    (a.mimeType ?? '').startsWith('image/'),
  );

  function abrirEdicao() {
    formEdit.setFieldsValue({
      tipoDesvio: rnc.tipoDesvio,
      reincidencia: rnc.reincidencia,
      descricaoDesvio: rnc.descricaoDesvio,
      quantidadePecas: rnc.quantidadePecas,
      valorUnitario: rnc.valorUnitario,
      disposicao: rnc.disposicao,
      houveRetorno: rnc.houveRetorno,
      dataRetorno: rnc.dataRetorno ? dayjs(rnc.dataRetorno) : undefined,
      fornecedorAceitou: rnc.fornecedorAceitou,
      fornecedorEnviouPlano: rnc.fornecedorEnviouPlano,
      nivelPlano: rnc.nivelPlano,
      observacoes: rnc.observacoes,
    });
    setEditOpen(true);
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Row justify="space-between" align="middle">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/rnc')}>
            Voltar
          </Button>
          <Typography.Title level={4} style={{ margin: 0 }}>
            RNC {rnc.numero}
          </Typography.Title>
          <Tag color={corStatusRnc[rnc.status]}>
            {labelStatusRnc[rnc.status]}
          </Tag>
        </Space>
        <Space wrap>
          <Button
            icon={<FilePdfOutlined />}
            onClick={() => abrirPdfEmNovaAba(`/rnc/${id}/pdf`)}
          >
            Exportar PDF
          </Button>
          <Button icon={<EditOutlined />} onClick={abrirEdicao}>
            Editar
          </Button>
          {finalizada || cancelada ? (
            <Button
              icon={<ReloadOutlined />}
              onClick={() => reabrir.mutate()}
              loading={reabrir.isPending}
            >
              Reabrir
            </Button>
          ) : (
            <>
              <Button
                icon={<StopOutlined />}
                danger
                onClick={() => {
                  formCancelar.resetFields();
                  setCancelarOpen(true);
                }}
              >
                Cancelar RNC
              </Button>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => {
                  formEncerrar.setFieldsValue({
                    verificacaoEficacia: 'APROVADO',
                  });
                  setEncerrarOpen(true);
                }}
              >
                Finalizar
              </Button>
            </>
          )}
          {isAdmin && (
            <Button
              icon={<DeleteOutlined />}
              danger
              onClick={confirmarExclusao}
              loading={remover.isPending}
            >
              Excluir
            </Button>
          )}
        </Space>
      </Row>

      {cancelada && rnc.motivoCancelamento && (
        <Alert
          type="warning"
          showIcon
          message="RNC cancelada"
          description={`Motivo: ${rnc.motivoCancelamento}`}
        />
      )}

      {inspecaoVinculada && (
        <Alert
          type="info"
          showIcon
          message={`Esta RNC foi gerada por uma inspeção ${tipoInspVinc} (#${inspecaoVinculada.id}).`}
        />
      )}

      <Row gutter={16}>
        <Col xs={24} lg={15}>
          <Card title="Dados da RNC">
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="Abertura">
                {dayjs(rnc.dataAbertura).format('DD/MM/YYYY')}
              </Descriptions.Item>
              <Descriptions.Item label="Solicitante">
                {rnc.solicitante ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Fornecedor" span={2}>
                {rnc.fornecedor?.codigo} — {rnc.fornecedor?.nome}
              </Descriptions.Item>
              <Descriptions.Item label="Item" span={2}>
                {rnc.item?.codigo} — {rnc.item?.descricao}
              </Descriptions.Item>
              <Descriptions.Item label="Nota Fiscal">
                {rnc.notaFiscal ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="PO">{rnc.po ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="Qtd. do lote">
                {rnc.quantidadeLote ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Reincidência">
                {rnc.reincidencia ? (
                  <Tag color="red">Sim</Tag>
                ) : (
                  <Tag>Não</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Tipo de desvio" span={2}>
                {rnc.tipoDesvio ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Descrição do desvio" span={2}>
                {rnc.descricaoDesvio}
              </Descriptions.Item>
              <Descriptions.Item label="Qtd. de peças">
                {rnc.quantidadePecas ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Valor unitário (R$)">
                {moeda(rnc.valorUnitario)}
              </Descriptions.Item>
              <Descriptions.Item label="Valor total (R$)" span={2}>
                <strong>{moeda(rnc.valorTotal)}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="Disposição" span={2}>
                {rnc.disposicao ?? '-'}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title="Plano de Ação" style={{ marginTop: 16 }}>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="Houve retorno?">
                {rnc.houveRetorno == null
                  ? '-'
                  : rnc.houveRetorno
                    ? 'Sim'
                    : 'Não'}
              </Descriptions.Item>
              <Descriptions.Item label="Data de retorno">
                {rnc.dataRetorno
                  ? dayjs(rnc.dataRetorno).format('DD/MM/YYYY')
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Tempo de retorno">
                {rnc.tempoRetornoDias != null
                  ? `${rnc.tempoRetornoDias} dia(s)`
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Fornecedor aceitou">
                {rnc.fornecedorAceitou ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Enviou plano de ação">
                {rnc.fornecedorEnviouPlano == null
                  ? '-'
                  : rnc.fornecedorEnviouPlano
                    ? 'Sim'
                    : 'Não'}
              </Descriptions.Item>
              <Descriptions.Item label="Nível do plano">
                {rnc.nivelPlano ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Verificação de eficácia">
                <Tag color={corEficacia[rnc.verificacaoEficacia]}>
                  {labelEficacia[rnc.verificacaoEficacia]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Data da verificação">
                {rnc.dataVerificacao
                  ? dayjs(rnc.dataVerificacao).format('DD/MM/YYYY')
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Observações" span={2}>
                {rnc.observacoes ?? '-'}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card
            title={`Evidências / Fotos (até ${MAX_FOTOS})`}
            style={{ marginTop: 16 }}
          >
            <Upload
              multiple
              accept="image/*"
              showUploadList={false}
              disabled={fotos.length >= MAX_FOTOS}
              customRequest={async ({ file, onSuccess, onError }) => {
                if (fotos.length >= MAX_FOTOS) {
                  message.warning(`Limite de ${MAX_FOTOS} fotos atingido.`);
                  return;
                }
                const fd = new FormData();
                fd.append('file', file as Blob);
                try {
                  await api.post('/anexos', fd, {
                    params: { entidadeTipo: 'RNC', entidadeId: id },
                  });
                  qc.invalidateQueries({ queryKey: ['anexos', 'RNC', id] });
                  onSuccess?.({});
                } catch (e) {
                  onError?.(e as any);
                  message.error('Falha no envio da foto.');
                }
              }}
            >
              <Button
                icon={<UploadOutlined />}
                disabled={fotos.length >= MAX_FOTOS}
              >
                Enviar foto ({fotos.length}/{MAX_FOTOS})
              </Button>
            </Upload>
            <div style={{ marginTop: 12 }}>
              <Image.PreviewGroup>
                <Space wrap>
                  {fotos.map((a: any) => (
                    <AuthImage key={a.id} anexoId={a.id} />
                  ))}
                </Space>
              </Image.PreviewGroup>
              {fotos.length === 0 && (
                <Typography.Text type="secondary">
                  Nenhuma foto anexada.
                </Typography.Text>
              )}
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={9}>
          <Card title="Histórico de Status">
            <Timeline
              items={(rnc.historico ?? []).map((h: any) => ({
                color: corStatusRnc[h.statusNovo] ?? 'gray',
                children: (
                  <div>
                    <strong>
                      {labelStatusRnc[h.statusNovo] ?? h.statusNovo}
                    </strong>
                    <div style={{ fontSize: 12, color: '#888' }}>
                      {dayjs(h.createdAt).format('DD/MM/YYYY HH:mm')}
                      {h.usuario ? ` · ${h.usuario.nome}` : ''}
                    </div>
                    {h.comentario && (
                      <div style={{ fontSize: 13 }}>{h.comentario}</div>
                    )}
                  </div>
                ),
              }))}
            />
          </Card>
        </Col>
      </Row>

      <Modal
        title="Editar RNC"
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={() => formEdit.submit()}
        confirmLoading={atualizar.isPending}
        okText="Salvar"
        cancelText="Cancelar"
        width={680}
      >
        <Form
          form={formEdit}
          layout="vertical"
          onFinish={(v) => atualizar.mutate(v)}
          style={{ marginTop: 12 }}
        >
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="tipoDesvio" label="Tipo de desvio">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="reincidencia"
                label="Reincidência"
                valuePropName="checked"
              >
                <Switch checkedChildren="Sim" unCheckedChildren="Não" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="descricaoDesvio" label="Descrição do desvio">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="quantidadePecas" label="Qtd. de peças">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="valorUnitario" label="Valor unitário (R$)">
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={2}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="disposicao" label="Disposição">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item
                name="houveRetorno"
                label="Houve retorno?"
                valuePropName="checked"
              >
                <Switch checkedChildren="Sim" unCheckedChildren="Não" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="dataRetorno" label="Data de retorno">
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="fornecedorEnviouPlano"
                label="Enviou plano?"
                valuePropName="checked"
              >
                <Switch checkedChildren="Sim" unCheckedChildren="Não" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="fornecedorAceitou" label="Fornecedor aceitou">
                <Select
                  allowClear
                  options={[
                    { value: 'Sim', label: 'Sim' },
                    {
                      value: 'Não (Ver observações)',
                      label: 'Não (Ver observações)',
                    },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="nivelPlano" label="Nível do plano">
                <Select
                  allowClear
                  options={[
                    { value: 'SATISFATORIO', label: 'Satisfatório' },
                    { value: 'EXCELENTE', label: 'Excelente' },
                    { value: 'NAO_APLICAVEL', label: 'Não se aplica' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="observacoes" label="Observações">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Finalizar RNC"
        open={encerrarOpen}
        onCancel={() => setEncerrarOpen(false)}
        onOk={() => formEncerrar.submit()}
        confirmLoading={encerrar.isPending}
        okText="Finalizar RNC"
        cancelText="Cancelar"
      >
        <Form
          form={formEncerrar}
          layout="vertical"
          onFinish={(v) => encerrar.mutate(v)}
        >
          <Form.Item
            name="verificacaoEficacia"
            label="Verificação de eficácia"
            rules={[{ required: true, message: 'Informe a eficácia.' }]}
          >
            <Select
              options={[
                { value: 'APROVADO', label: 'Aprovada' },
                { value: 'REPROVADO', label: 'Reprovada' },
                { value: 'NAO_APLICAVEL', label: 'Não se aplica' },
              ]}
            />
          </Form.Item>
          <Form.Item name="evidencias" label="Evidências da verificação">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="comentario" label="Comentário (histórico)">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Cancelar RNC"
        open={cancelarOpen}
        onCancel={() => setCancelarOpen(false)}
        onOk={() => formCancelar.submit()}
        confirmLoading={cancelar.isPending}
        okText="Cancelar RNC"
        okButtonProps={{ danger: true }}
        cancelText="Voltar"
      >
        <Typography.Paragraph type="secondary">
          A RNC cancelada sai dos indicadores (KPIs), mas continua na lista com o
          status “Cancelada”. Você pode reabri-la depois.
        </Typography.Paragraph>
        <Form
          form={formCancelar}
          layout="vertical"
          onFinish={(v) => cancelar.mutate(v)}
        >
          <Form.Item
            name="motivo"
            label="Motivo do cancelamento"
            rules={[
              { required: true, message: 'Informe o motivo do cancelamento.' },
            ]}
          >
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}

```

### `frontend/src/pages/Periodicidade.tsx`

```tsx
import { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { EditOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

const corClasse: Record<string, string> = {
  A: 'green',
  B: 'blue',
  C: 'orange',
  D: 'red',
};

export default function Periodicidade() {
  const qc = useQueryClient();
  const [editando, setEditando] = useState<any | null>(null);
  const [form] = Form.useForm();

  const { data, isLoading } = useQuery<any[]>({
    queryKey: ['periodicidade'],
    queryFn: async () => (await api.get('/periodicidade')).data,
  });

  const salvar = useMutation({
    mutationFn: async (v: any) =>
      api.patch(`/periodicidade/${editando.classificacao}`, v),
    onSuccess: () => {
      message.success('Periodicidade atualizada.');
      qc.invalidateQueries({ queryKey: ['periodicidade'] });
      setEditando(null);
      form.resetFields();
    },
    onError: () => message.error('Não foi possível salvar as alterações.'),
  });

  function abrir(registro: any) {
    setEditando(registro);
    form.setFieldsValue(registro);
  }

  return (
    <Card
      title="Periodicidade de Inspeção por Classificação"
      extra={
        <Typography.Text type="secondary">
          Parâmetros que definem quando e como cada fornecedor é inspecionado.
        </Typography.Text>
      }
    >
      <Alert
        style={{ marginBottom: 16 }}
        type="info"
        showIcon
        message="Como funciona"
        description="A classificação de fornecimento (A, B, C ou D) define a frequência de inspeção, o percentual de amostra e o NQA aplicado no recebimento. Ajuste os valores abaixo conforme a política de qualidade da empresa."
      />
      <Table
        rowKey="classificacao"
        loading={isLoading}
        dataSource={data}
        pagination={false}
        columns={[
          {
            title: 'Classificação',
            dataIndex: 'classificacao',
            width: 120,
            render: (c: string) => (
              <Tag color={corClasse[c]} style={{ fontWeight: 600 }}>
                {c}
              </Tag>
            ),
          },
          { title: 'Periodicidade', dataIndex: 'periodicidadeTexto' },
          {
            title: 'Frequência (1 a cada N)',
            dataIndex: 'frequenciaN',
            width: 170,
            align: 'center',
          },
          { title: 'Tipo', dataIndex: 'tipoInspecao', width: 120 },
          { title: 'Nível de inspeção', dataIndex: 'nivelInspecaoTexto' },
          {
            title: 'Nível',
            dataIndex: 'nivelRomano',
            width: 80,
            align: 'center',
          },
          {
            title: 'Amostra',
            dataIndex: 'percentualAmostra',
            width: 100,
            align: 'center',
            render: (v: number) => `${v}%`,
          },
          {
            title: 'NQA',
            dataIndex: 'nqa',
            width: 80,
            align: 'center',
            render: (v: number) => v.toFixed(1),
          },
          {
            title: 'Conformidade mín.',
            dataIndex: 'conformidadeMin',
            width: 140,
            align: 'center',
            render: (v: number) => `${v}%`,
          },
          {
            title: 'Ações',
            width: 90,
            render: (_: any, r: any) => (
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => abrir(r)}
              >
                Editar
              </Button>
            ),
          },
        ]}
      />

      <Modal
        title={`Editar Classificação ${editando?.classificacao ?? ''}`}
        open={!!editando}
        onCancel={() => setEditando(null)}
        onOk={() => form.submit()}
        confirmLoading={salvar.isPending}
        okText="Salvar"
        cancelText="Cancelar"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(v) => salvar.mutate(v)}
          style={{ marginTop: 12 }}
        >
          <Form.Item name="periodicidadeTexto" label="Periodicidade (descrição)">
            <Input />
          </Form.Item>
          <Form.Item
            name="frequenciaN"
            label="Frequência — inspeciona 1 a cada N entregas"
          >
            <InputNumber style={{ width: '100%' }} min={1} />
          </Form.Item>
          <Form.Item name="tipoInspecao" label="Tipo de inspeção">
            <Input />
          </Form.Item>
          <Form.Item name="nivelInspecaoTexto" label="Nível de inspeção">
            <Input />
          </Form.Item>
          <Form.Item name="nivelRomano" label="Nível (numeração romana)">
            <Input />
          </Form.Item>
          <Form.Item name="percentualAmostra" label="Percentual de amostra (%)">
            <InputNumber style={{ width: '100%' }} min={0} max={100} />
          </Form.Item>
          <Form.Item name="nqa" label="NQA">
            <InputNumber style={{ width: '100%' }} min={0} step={0.1} />
          </Form.Item>
          <Form.Item
            name="conformidadeMin"
            label="Conformidade mínima para manter a classificação (%)"
          >
            <InputNumber style={{ width: '100%' }} min={0} max={100} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}

```

### `frontend/src/pages/Entregas.tsx`

```tsx
import { useState } from 'react';
import {
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { PlusOutlined, WarningOutlined, AuditOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import {
  useFornecedores,
  useItens,
  opcoesFornecedor,
  opcoesItem,
} from '../hooks';

export default function Entregas() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const { data: fornecedores } = useFornecedores();
  const { data: itens } = useItens();

  const { data, isLoading } = useQuery<any[]>({
    queryKey: ['entregas'],
    queryFn: async () => (await api.get('/entregas')).data,
  });

  const salvar = useMutation({
    mutationFn: async (v: any) =>
      (
        await api.post('/entregas', {
          ...v,
          dataEntrega: v.dataEntrega ? v.dataEntrega.toISOString() : undefined,
        })
      ).data,
    onSuccess: (entrega: any) => {
      qc.invalidateQueries({ queryKey: ['entregas'] });
      setOpen(false);
      form.resetFields();
      if (entrega.passivelInspecao) {
        avisarInspecao(entrega);
      } else {
        message.success('Entrega registrada. Nesta entrega não há inspeção.');
      }
    },
    onError: () => message.error('Não foi possível registrar a entrega.'),
  });

  function avisarInspecao(entrega: any) {
    const forn = entrega.fornecedor ?? {};
    const escopos: string[] = [];
    if (forn.fazVisual) escopos.push('Visual');
    if (forn.fazLote) escopos.push('Lote (Dimensional)');
    Modal.confirm({
      icon: <WarningOutlined style={{ color: '#D37119' }} />,
      title: 'Entrega passível de inspeção',
      width: 480,
      content: (
        <div>
          <p style={{ marginBottom: 8 }}>
            Conforme a classificação <strong>{forn.classificacaoFornecimento}</strong>{' '}
            do fornecedor <strong>{forn.nome}</strong>, esta entrega deve ser
            inspecionada.
          </p>
          <p style={{ margin: 0 }}>
            Formulário(s) sugerido(s):{' '}
            <strong>{escopos.length ? escopos.join(' e ') : 'Visual'}</strong>.
          </p>
        </div>
      ),
      okText: 'Ir para Inspeções',
      cancelText: 'Depois',
      onOk: () =>
        navigate(
          `/inspecoes?entregaId=${entrega.id}&fornecedorId=${entrega.fornecedorId}` +
            (entrega.itemId ? `&itemId=${entrega.itemId}` : ''),
        ),
    });
  }

  return (
    <Card
      title="Entregas / Portaria"
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            form.setFieldsValue({ dataEntrega: dayjs() });
            setOpen(true);
          }}
        >
          Registrar Entrega
        </Button>
      }
    >
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={data}
        columns={[
          {
            title: 'Data',
            dataIndex: 'dataEntrega',
            width: 110,
            render: (d: string) => dayjs(d).format('DD/MM/YYYY'),
          },
          {
            title: 'Semana',
            dataIndex: 'semanaReferencia',
            width: 100,
            render: (v?: string) => v ?? '-',
          },
          { title: 'Fornecedor', render: (_: any, r: any) => r.fornecedor?.nome },
          { title: 'Item', render: (_: any, r: any) => r.item?.descricao ?? '-' },
          { title: 'Nota Fiscal', dataIndex: 'notaFiscal', width: 120 },
          { title: 'PO', dataIndex: 'po', width: 110, render: (v?: string) => v ?? '-' },
          { title: 'Qtd.', dataIndex: 'quantidade', width: 80 },
          {
            title: 'Inspeção',
            width: 150,
            render: (_: any, r: any) => {
              const temInsp =
                (r.inspecoesVisual?.length ?? 0) + (r.inspecoesLote?.length ?? 0) >
                0;
              if (temInsp) return <Tag color="green">Inspecionada</Tag>;
              if (r.passivelInspecao)
                return (
                  <Button
                    size="small"
                    icon={<AuditOutlined />}
                    onClick={() =>
                      navigate(
                        `/inspecoes?entregaId=${r.id}&fornecedorId=${r.fornecedorId}` +
                          (r.itemId ? `&itemId=${r.itemId}` : ''),
                      )
                    }
                  >
                    Inspecionar
                  </Button>
                );
              return <Typography.Text type="secondary">Sem inspeção</Typography.Text>;
            },
          },
        ]}
      />
      <Modal
        title="Registrar Entrega (Portaria)"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={salvar.isPending}
        okText="Salvar"
        cancelText="Cancelar"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(v) => salvar.mutate(v)}
          style={{ marginTop: 12 }}
        >
          <Form.Item
            name="fornecedorId"
            label="Fornecedor"
            rules={[{ required: true, message: 'Selecione o fornecedor.' }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              options={opcoesFornecedor(fornecedores)}
            />
          </Form.Item>
          <Form.Item name="itemId" label="Item">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              options={opcoesItem(itens)}
            />
          </Form.Item>
          <Form.Item name="dataEntrega" label="Data da entrega">
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Space style={{ display: 'flex' }} align="start">
            <Form.Item name="notaFiscal" label="Nota Fiscal" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
            <Form.Item name="po" label="PO" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
          </Space>
          <Form.Item name="quantidade" label="Quantidade">
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}

```

### `frontend/src/pages/Itens.tsx`

```tsx
import { useState } from 'react';
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Table,
  message,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

interface Item {
  id: number;
  codigo: string;
  descricao: string;
  unidade?: string;
  fornecedorId?: number;
  fornecedor?: { id: number; nome: string };
}

export default function Itens() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState<Item | null>(null);
  const [form] = Form.useForm();

  const { data, isLoading } = useQuery<Item[]>({
    queryKey: ['itens'],
    queryFn: async () => (await api.get('/itens')).data,
  });
  const { data: fornecedores } = useQuery<any[]>({
    queryKey: ['fornecedores'],
    queryFn: async () => (await api.get('/fornecedores')).data,
  });

  const salvar = useMutation({
    mutationFn: async (values: any) => {
      if (editando) return api.patch(`/itens/${editando.id}`, values);
      return api.post('/itens', values);
    },
    onSuccess: () => {
      message.success('Item salvo');
      qc.invalidateQueries({ queryKey: ['itens'] });
      fechar();
    },
    onError: () => message.error('Erro ao salvar'),
  });

  function abrir(i?: Item) {
    setEditando(i ?? null);
    form.setFieldsValue(
      i ?? { codigo: '', descricao: '', unidade: '', fornecedorId: undefined },
    );
    setOpen(true);
  }
  function fechar() {
    setOpen(false);
    setEditando(null);
    form.resetFields();
  }

  return (
    <Card
      title="Itens / Peças"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => abrir()}>
          Novo Item
        </Button>
      }
    >
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={data}
        columns={[
          { title: 'Código', dataIndex: 'codigo', width: 130 },
          { title: 'Descrição', dataIndex: 'descricao' },
          { title: 'Unid.', dataIndex: 'unidade', width: 80 },
          {
            title: 'Fornecedor',
            render: (_: any, i: Item) => i.fornecedor?.nome ?? '-',
          },
          {
            title: 'Ações',
            width: 100,
            render: (_: any, i: Item) => (
              <Button size="small" onClick={() => abrir(i)}>
                Editar
              </Button>
            ),
          },
        ]}
      />
      <Modal
        title={editando ? 'Editar Item' : 'Novo Item'}
        open={open}
        onCancel={fechar}
        onOk={() => form.submit()}
        confirmLoading={salvar.isPending}
        okText="Salvar"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(v) => salvar.mutate(v)}
          style={{ marginTop: 12 }}
        >
          <Form.Item name="codigo" label="Código" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="descricao" label="Descrição" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="unidade" label="Unidade">
            <Input placeholder="PC, UN, KG..." />
          </Form.Item>
          <Form.Item name="fornecedorId" label="Fornecedor">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Selecione"
              options={fornecedores?.map((f) => ({ value: f.id, label: f.nome }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}

```

### `frontend/src/pages/Kanban.tsx`

```tsx
import { useMemo } from 'react';
import {
  Card,
  Col,
  Empty,
  Row,
  Space,
  Tag,
  Typography,
  Badge,
} from 'antd';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

// Domingo (0) a Sabado (6) da semana de uma data
function intervaloSemana(d: dayjs.Dayjs) {
  const inicio = d.startOf('week'); // dayjs pt-br: domingo
  const fim = inicio.add(6, 'day');
  return { inicio, fim };
}

function rotuloSemana(ref: string | undefined, exemplo?: string) {
  if (!ref) return { titulo: 'Sem semana', sub: '' };
  if (exemplo) {
    const { inicio, fim } = intervaloSemana(dayjs(exemplo));
    return {
      titulo: ref,
      sub: `${inicio.format('DD/MM')} — ${fim.format('DD/MM')}`,
    };
  }
  return { titulo: ref, sub: '' };
}

export default function Kanban() {
  const navigate = useNavigate();

  const { data: entregas, isLoading } = useQuery<any[]>({
    queryKey: ['entregas'],
    queryFn: async () => (await api.get('/entregas')).data,
  });

  const colunas = useMemo(() => {
    const mapa = new Map<string, any[]>();
    (entregas ?? []).forEach((e) => {
      const chave = e.semanaReferencia ?? 'Sem semana';
      if (!mapa.has(chave)) mapa.set(chave, []);
      mapa.get(chave)!.push(e);
    });
    return Array.from(mapa.entries())
      .map(([semana, itens]) => ({
        semana,
        exemplo: itens[0]?.dataEntrega,
        itens: itens.sort(
          (a, b) =>
            new Date(b.dataEntrega).getTime() - new Date(a.dataEntrega).getTime(),
        ),
      }))
      .sort((a, b) => b.semana.localeCompare(a.semana));
  }, [entregas]);

  function statusEntrega(e: any) {
    const insp = [...(e.inspecoesVisual ?? []), ...(e.inspecoesLote ?? [])];
    if (insp.length) {
      const reprovada = insp.some((i: any) => i.resultado === 'REPROVADO');
      return reprovada
        ? { cor: 'red', texto: 'Reprovada' }
        : { cor: 'green', texto: 'Aprovada' };
    }
    if (e.passivelInspecao) return { cor: 'orange', texto: 'Aguardando inspeção' };
    return { cor: 'default', texto: 'Sem inspeção' };
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Typography.Title level={4} style={{ margin: 0 }}>
        Kanban Semanal — Entregas e Inspeções
      </Typography.Title>
      <Typography.Text type="secondary">
        Entregas agrupadas por semana (domingo a sábado). Clique em um cartão para
        registrar ou consultar a inspeção.
      </Typography.Text>

      {isLoading ? (
        <Card loading />
      ) : colunas.length === 0 ? (
        <Empty description="Nenhuma entrega registrada" />
      ) : (
        <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
          <Row gutter={16} wrap={false} style={{ minWidth: 'min-content' }}>
            {colunas.map((col) => {
              const { titulo, sub } = rotuloSemana(col.semana, col.exemplo);
              const pendentes = col.itens.filter(
                (e: any) =>
                  e.passivelInspecao &&
                  !(e.inspecoesVisual?.length || e.inspecoesLote?.length),
              ).length;
              return (
                <Col key={col.semana} style={{ width: 300, flex: '0 0 300px' }}>
                  <Card
                    size="small"
                    title={
                      <Space direction="vertical" size={0}>
                        <span>{titulo}</span>
                        {sub && (
                          <Typography.Text
                            type="secondary"
                            style={{ fontSize: 12 }}
                          >
                            {sub}
                          </Typography.Text>
                        )}
                      </Space>
                    }
                    extra={
                      <Badge
                        count={pendentes}
                        style={{ backgroundColor: '#D37119' }}
                        title="Pendentes de inspeção"
                      />
                    }
                    style={{
                      background: '#FAF6F2',
                      borderTop: '3px solid #D37119',
                    }}
                    bodyStyle={{ maxHeight: '65vh', overflowY: 'auto' }}
                  >
                    <Space direction="vertical" style={{ width: '100%' }} size={8}>
                      {col.itens.map((e: any) => {
                        const st = statusEntrega(e);
                        return (
                          <Card
                            key={e.id}
                            size="small"
                            hoverable
                            onClick={() =>
                              navigate(
                                `/inspecoes?entregaId=${e.id}&fornecedorId=${e.fornecedorId}` +
                                  (e.itemId ? `&itemId=${e.itemId}` : ''),
                              )
                            }
                            bodyStyle={{ padding: 10 }}
                          >
                            <Typography.Text strong style={{ fontSize: 13 }}>
                              {e.fornecedor?.nome}
                            </Typography.Text>
                            <div
                              style={{ fontSize: 12, color: '#666', margin: '2px 0' }}
                            >
                              {e.item?.descricao ?? 'Item não informado'}
                            </div>
                            <div style={{ fontSize: 12, color: '#888' }}>
                              {dayjs(e.dataEntrega).format('DD/MM')} · NF{' '}
                              {e.notaFiscal ?? '-'}
                            </div>
                            <div style={{ marginTop: 6 }}>
                              <Tag color={st.cor} style={{ marginRight: 0 }}>
                                {st.texto}
                              </Tag>
                            </div>
                          </Card>
                        );
                      })}
                    </Space>
                  </Card>
                </Col>
              );
            })}
          </Row>
        </div>
      )}
    </Space>
  );
}

```

### `frontend/src/pages/Planejamento.tsx`

```tsx
import { useState } from 'react';
import {
  Button,
  Card,
  DatePicker,
  Form,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  message,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { api } from '../api';
import {
  useFornecedores,
  useItens,
  opcoesFornecedor,
  opcoesItem,
} from '../hooks';

function semanaAtual() {
  const d = dayjs();
  const week = String(Math.ceil((d.date() + d.startOf('month').day()) / 7));
  return `${d.year()}-W${d.format('WW') || week}`;
}

export default function Planejamento() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const { data: fornecedores } = useFornecedores();
  const { data: itens } = useItens();

  const { data, isLoading } = useQuery<any[]>({
    queryKey: ['planejamento'],
    queryFn: async () => (await api.get('/planejamento-semanal')).data,
  });

  const salvar = useMutation({
    mutationFn: async (v: any) =>
      api.post('/planejamento-semanal', {
        ...v,
        dataPrevista: v.dataPrevista ? v.dataPrevista.toISOString() : undefined,
      }),
    onSuccess: () => {
      message.success('Planejamento criado');
      qc.invalidateQueries({ queryKey: ['planejamento'] });
      setOpen(false);
      form.resetFields();
    },
    onError: () => message.error('Erro ao salvar'),
  });

  const marcarEntregue = useMutation({
    mutationFn: async (id: number) =>
      api.patch(`/planejamento-semanal/${id}/entregue`),
    onSuccess: () => {
      message.success('Marcado como entregue');
      qc.invalidateQueries({ queryKey: ['planejamento'] });
    },
  });

  return (
    <Card
      title="Planejamento Semanal de Inspeções"
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            form.setFieldsValue({ semanaReferencia: semanaAtual() });
            setOpen(true);
          }}
        >
          Novo Planejamento
        </Button>
      }
    >
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={data}
        columns={[
          { title: 'Semana', dataIndex: 'semanaReferencia', width: 110 },
          { title: 'Fornecedor', render: (_: any, r: any) => r.fornecedor?.nome },
          {
            title: 'Item',
            render: (_: any, r: any) => r.item?.descricao ?? '(todos)',
          },
          {
            title: 'Data prevista',
            dataIndex: 'dataPrevista',
            render: (d?: string) => (d ? dayjs(d).format('DD/MM/YYYY') : '-'),
          },
          {
            title: 'Status',
            dataIndex: 'status',
            width: 120,
            render: (s: string) =>
              s === 'ENTREGUE' ? (
                <Tag color="green">Entregue</Tag>
              ) : (
                <Tag color="orange">Pendente</Tag>
              ),
          },
          {
            title: 'Ações',
            width: 150,
            render: (_: any, r: any) =>
              r.status !== 'ENTREGUE' && (
                <Button
                  size="small"
                  onClick={() => marcarEntregue.mutate(r.id)}
                  loading={marcarEntregue.isPending}
                >
                  Marcar entregue
                </Button>
              ),
          },
        ]}
      />
      <Modal
        title="Novo Planejamento Semanal"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={salvar.isPending}
        okText="Salvar"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(v) => salvar.mutate(v)}
          style={{ marginTop: 12 }}
        >
          <Form.Item
            name="semanaReferencia"
            label="Semana de referência"
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { value: semanaAtual(), label: `Semana atual (${semanaAtual()})` },
              ]}
              placeholder="Ex: 2026-W28"
              showSearch
            />
          </Form.Item>
          <Form.Item
            name="fornecedorId"
            label="Fornecedor"
            rules={[{ required: true }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              options={opcoesFornecedor(fornecedores)}
            />
          </Form.Item>
          <Form.Item name="itemId" label="Item (opcional)">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              options={opcoesItem(itens)}
            />
          </Form.Item>
          <Form.Item name="dataPrevista" label="Data prevista">
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}

```

---

**Fim do Anexo A.** Todos os arquivos-fonte acima são a fonte da verdade para reprodução idêntica.
