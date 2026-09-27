# DEPLOY.md — Protótipo em nuvem (Render + Supabase)

Registro do que foi realmente executado em **26/07/2026** para colocar o
Sistema de Qualidade (módulo SQE) no ar como **protótipo navegável**.

Este documento descreve o **protótipo**, não a instalação definitiva. A casa
final do sistema continua sendo um servidor interno da empresa — o objetivo
aqui é ter um link público para demonstrar à área da Qualidade e sustentar a
conversa com o TI. Para a instalação on-premise, ver `deploy-servidor/LEIA-ME.md`.

---

## 1. O que está no ar

| Peça | Onde | Endereço |
| --- | --- | --- |
| Frontend | Render — Static Site `qualidade-sqe-web` | https://qualidade-sqe-web.onrender.com |
| Backend | Render — Web Service Docker `qualidade-sqe-api` | https://qualidade-sqe-api.onrender.com |
| Banco | Supabase — projeto `qualidade-sqe` (Canada Central) | pooler `aws-0-ca-central-1.pooler.supabase.com` |
| Anexos | Supabase Storage — bucket privado `anexos` | via backend, nunca por URL pública |

Branch de trabalho: **`deploy/cloud`**. A `main` não foi tocada.
Auto-deploy ligado: qualquer push na `deploy/cloud` reconstrói os dois serviços.

**Acesso de teste:** `admin@qualidade-sqe.com` — a senha está em `backend/.env`
(arquivo local, fora do Git).

---

## 2. Por que Render + Supabase, e não um VPS

O plano anterior era um VPS único com `docker compose`. A troca aconteceu
porque, para um protótipo de demonstração, Render + Supabase não cobra nada,
não exige administrar servidor e sobe em minutos. O guia do VPS foi retirado
do repositório em 27/09/2026, quando a instalação definitiva passou a ser o
servidor da fábrica (`deploy-servidor/`); se um dia fizer falta, está no
histórico do Git.

O preço dessa escolha é o **disco efêmero**: o Render apaga o sistema de
arquivos do contêiner a cada deploy. Foi isso que obrigou a migrar os anexos
para o Supabase Storage (seção 6). Não era opcional — sem essa mudança, as
fotos das RNCs sumiriam sozinhas.

---

## 3. Regras que guiaram o trabalho

Continuam valendo para qualquer mexida futura:

1. **Nenhum dado real da empresa na nuvem.** O banco tem 1 usuário admin e os
   4 parâmetros de periodicidade. Nada mais.
2. **Branch separada `deploy/cloud`.** A `main` permanece intacta.
3. **Mudar só o estritamente necessário.** Nenhuma refatoração oportunista.
4. **Nenhuma credencial no repositório.** `backend/.env` está no `.gitignore`.

---

## 4. Supabase — banco de dados

Projeto criado pela interface: `qualidade-sqe`, região **Canada Central**.

> **Sobre a região:** o Render gratuito não tem região no Brasil. Como a
> latência que pesa é a de backend↔banco (dezenas de consultas por tela), e não
> a de usuário↔frontend, vale mais colar o banco no Render do que no Brasil.
> Canada Central é vizinha da região Virginia, onde o backend roda.

O Supabase oferece duas portas, e **as duas são necessárias**:

| Porta | Modo | Para quê |
| --- | --- | --- |
| 6543 | pooler *transaction* (PgBouncer) | a aplicação — `DATABASE_URL` |
| 5432 | conexão direta / *session* | criar e alterar tabelas — `DIRECT_URL` |

A porta 6543 **não executa DDL nem advisory locks**, então o `prisma db push`
falha se apontar para lá. Por isso foi acrescentado o `directUrl` ao
`schema.prisma` — foi a única alteração no arquivo:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

**Este projeto não tem pasta de migrations.** O schema é aplicado com
`prisma db push`, nunca com `prisma migrate deploy`.

---

## 5. Variáveis de ambiente do backend

As mesmas 8 estão em `backend/.env` (local) e cadastradas no Render:

| Variável | O que é |
| --- | --- |
| `DATABASE_URL` | Postgres do Supabase, **porta 6543**, com `?pgbouncer=true` |
| `DIRECT_URL` | Postgres do Supabase, **porta 5432** — só para DDL |
| `JWT_SECRET` | segredo de assinatura do token (`openssl rand -hex 48`) |
| `SEED_ADMIN_EMAIL` | e-mail do admin criado pelo seed |
| `SEED_ADMIN_PASSWORD` | senha do admin — mínimo 12 caracteres |
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `SUPABASE_BUCKET` | `anexos` |
| `SUPABASE_SERVICE_ROLE_KEY` | chave `service_role` — ignora as permissões do banco |

`PORT` **não** é cadastrada: o Render injeta a dele, e o `main.ts` já respeita
`process.env.PORT`.

### Duas armadilhas descobertas na prática

**A senha do banco aparece escrita por extenso nas duas URLs, de propósito.**
A primeira tentativa foi usar uma variável `DB_PASSWORD` e referenciá-la com
`${DB_PASSWORD}` dentro das URLs. O CLI do Prisma expande isso (usa
dotenv-expand), mas o `@nestjs/config` **não expande por padrão** — a aplicação
tentaria conectar com o texto literal `${DB_PASSWORD}`. Migrations passavam, a
aplicação quebrava.

**Rodando localmente, um `.env` sozinho não basta.** O `JwtModule.register()` no
`auth.module.ts` é avaliado no momento em que o módulo é importado, ou seja,
**antes** do `ConfigModule.forRoot()` ler o `.env`. Resultado: o token era
*assinado* com o segredo de fallback e *validado* com o segredo real — todas as
rotas devolviam 401. Para testar localmente, exporte as variáveis antes de subir:

```bash
cd backend && set -a && . ./.env && set +a && node dist/src/main.js
```

Na nuvem isso **não acontece**, porque o Render coloca as variáveis em
`process.env` antes de qualquer JavaScript rodar.

---

## 6. Anexos no Supabase Storage

Bucket **privado** `anexos`. Privado é essencial: nenhum arquivo tem URL
pública, todo download continua passando pelo backend e protegido pelo JWT.

O que mudou no código (`backend/src/anexos/`):

- `storage.service.ts` (novo) — envia, baixa e trata falha de leitura.
- `anexos.controller.ts` — o multer passou de `diskStorage` para
  `memoryStorage()` (limite de 20 MB); o arquivo vai para o Storage **antes** de
  gravar a linha no banco, para nunca sobrar registro apontando para um anexo
  que não existe.
- `rnc-pdf.ts` — as fotos do Registro Fotográfico agora chegam como `Buffer`
  em vez de caminho em disco.

**Não houve mudança de schema nem migração de dados**, porque o nome gravado na
coluna `caminho` manteve exatamente o mesmo formato de antes.

### Por que `@supabase/storage-js` e não `@supabase/supabase-js`

A primeira versão usava o `supabase-js` completo e o upload quebrou em produção:

```
Node.js 20 detected without native WebSocket support
```

O `createClient` do `supabase-js` inicializa o módulo Realtime, que exige
WebSocket nativo (Node 22+). A imagem roda **Node 20**. A solução foi instalar
só o cliente de Storage e construir o `StorageClient` direto. Se um dia alguém
trocar de volta, o upload volta a quebrar.

### Apagar arquivo de teste

O Supabase **bloqueia `DELETE` direto em `storage.objects` via SQL**
(erro `42501`). Use a API:

```bash
curl -X DELETE "$SUPABASE_URL/storage/v1/object/$SUPABASE_BUCKET/<nome>" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

Curiosamente, **criar** o bucket por SQL funciona — foi assim que ele nasceu,
porque o painel do Supabase estava instável:

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('anexos', 'anexos', false) ON CONFLICT DO NOTHING;
```

---

## 7. Ajustes na imagem Docker antes de publicar

Três problemas foram corrigidos **antes** do primeiro deploy, lendo o
`Dockerfile` e o `docker-entrypoint.sh`:

1. **`prisma` estava em `devDependencies`.** O estágio de runtime roda
   `npm install --omit=dev`, então o `npx prisma db push` do entrypoint baixaria
   o pacote da internet a cada boot. Com a hibernação do plano gratuito, isso é
   um boot lento e frágil em toda madrugada. Foi movido para `dependencies`.
2. **`prisma db push --accept-data-loss`.** Uma alteração destrutiva de schema
   apagaria colunas ou tabelas em silêncio. A flag foi removida: agora o deploy
   falha e avisa.
3. **`node dist/prisma/seed.js || echo "..."`.** Engolir o erro faria o sistema
   subir sem nenhum usuário e sem aviso no log. O `|| echo` foi removido. O seed
   usa `upsert`, então rodar a cada boot é seguro.

O `docker-entrypoint.sh` precisa de quebra de linha **LF**. Há um
`.gitattributes` forçando isso — CRLF do Windows quebra no Linux.

---

## 8. Frontend — a única mudança de código que ele exigiu

`frontend/src/api.ts` tinha `baseURL: '/api'` cravado. Funciona no Docker
on-premise (o nginx faz o proxy) e em desenvolvimento (o proxy do Vite), mas no
Render o frontend é um site estático em **outro domínio** — `/api` bateria nele
mesmo e daria 404.

```ts
baseURL: import.meta.env.VITE_API_URL ?? '/api',
```

O `?? '/api'` preserva o comportamento antigo: sem a variável, nada muda.

Também foi criado `frontend/src/vite-env.d.ts` com
`/// <reference types="vite/client" />`, senão o `tsc -b` do build reclama que
`import.meta.env` não existe.

**A variável é lida no build, não em tempo de execução.** Trocar a URL do
backend exige um novo build do Static Site, não basta mexer na variável.

Configuração do Static Site no Render:

- Root directory: `frontend`
- Build: `npm install && npm run build`
- Publish: `dist`
- Variável: `VITE_API_URL = https://qualidade-sqe-api.onrender.com/api`
- **Rewrite `/*` → `/index.html`** — sem isso, recarregar a página em qualquer
  rota que não seja `/` devolve 404, porque o roteamento é do React.

CORS não precisou de nada: o `main.ts` já usa `enableCors({ origin: true })`.

---

## 9. Como o Render foi configurado

O painel do Render (`dashboard.render.com`) e o domínio `onrender.com` são
**bloqueados para navegação automatizada**. Toda a configuração foi feita pela
**API REST**, o que tem a vantagem de ficar registrado aqui e ser repetível.

```bash
# Chave criada em Account Settings → API Keys (formato rnd_*)
K=$(cat ~/.render-key)

# Descobrir o ownerId do workspace
curl -H "Authorization: Bearer $K" https://api.render.com/v1/owners

# Criar serviço (POST /v1/services) — ver payloads abaixo
# Forçar um redeploy
curl -X POST "https://api.render.com/v1/services/<srv-id>/deploys" \
  -H "Authorization: Bearer $K" -H "Content-Type: application/json" \
  -d '{"clearCache":"clear"}'

# Acompanhar o status
curl -H "Authorization: Bearer $K" \
  "https://api.render.com/v1/services/<srv-id>/deploys/<dep-id>"
```

**Backend** (`type: web_service`): repo + `branch: deploy/cloud`,
`autoDeploy: yes`, `env: docker`, `region: virginia`, `plan: free`,
`dockerfilePath: ./backend/Dockerfile`, `dockerContext: ./backend`, mais as 8
variáveis da seção 5.

> `rootDir` **não** foi usado no backend. Com `dockerfilePath` e `dockerContext`
> ambos relativos à raiz do repositório não há ambiguidade sobre onde o Docker
> resolve os `COPY`.

**Frontend** (`type: static_site`): `rootDir: frontend`,
`buildCommand: npm install && npm run build`, `publishPath: dist`,
`routes: [{ type: rewrite, source: /*, destination: /index.html }]`, mais
`VITE_API_URL`.

Antes disso, é preciso conectar o GitHub em **Account Settings → Git Deployment
Credentials → Add credential**. Logar no Render com GitHub **não** dá acesso aos
repositórios — são coisas separadas. Ao autorizar, escolha *Only select
repositories* e marque apenas este repositório.

---

## 10. Testes executados

| Teste | Resultado |
| --- | --- |
| `POST /api/auth/login` | 201, token de 236 caracteres |
| `GET /api/auth/me` | 200 — `Administrador`, papel `ADMIN` |
| `GET /api/fornecedores` com token | 200 |
| `GET /api/fornecedores` sem token | 401 |
| Preflight CORS a partir do domínio do frontend | 204, `allow-origin` correto |
| Frontend: login pela interface | painel SQE carrega, sem erro no console |
| Rota profunda (`/rnc`) recarregada | serve o `index.html` — rewrite ok |
| Upload de anexo pelo backend em produção | 200 |
| Download logo após o upload | bytes idênticos |
| **Download depois de um redeploy com cache limpo** | **bytes idênticos** |

O último é o que prova que o disco efêmero deixou de ser um problema.

Todos os dados criados nos testes foram apagados. Estado atual do banco:
1 usuário (admin), 4 parâmetros de periodicidade, 0 fornecedores, 0 itens,
0 RNCs, 0 anexos, 0 arquivos no bucket.

---

## 11. Limites deste protótipo

Coisas que são aceitáveis para demonstrar e **inaceitáveis** para produção:

- **O backend hiberna** após ~15 minutos parado; a primeira requisição depois
  disso leva 30 a 50 segundos. **Abra o link alguns minutos antes de qualquer
  demonstração.**
- **O projeto Supabase é pausado** após 7 dias sem nenhuma requisição.
- **Sem backup automático** no plano gratuito do Supabase.
- **Sem HTTPS próprio nem domínio da empresa** — os endereços são `.onrender.com`.
- Os dados são fictícios e podem ser apagados a qualquer momento.

---

## 12. Voltando para o servidor interno

Nada do que foi feito aqui impede o caminho on-premise. Quando o TI liberar:

1. Suba pela `main` (ou faça o merge da `deploy/cloud`, o que traz de brinde o
   seed sem senha embutida e a configuração de anexos por Storage).
2. Se for usar disco local de novo, o `StorageService` precisa de uma
   implementação alternativa — ou aponte para um MinIO interno, que fala o
   mesmo protocolo S3.
3. **Não** defina `VITE_API_URL` no build do frontend: sem ela o `baseURL` volta
   a ser `/api` e o nginx do `docker-compose` faz o proxy, como sempre fez.
4. Troque `JWT_SECRET`, a senha do admin e **revogue** a chave `service_role` do
   Supabase e a chave de API do Render.
