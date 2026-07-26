# Plano de deploy — Sistema de Qualidade (SQE)

> Coloque este arquivo na raiz do repositório e diga ao Claude Code:
> "Leia o PLANO_DEPLOY.md e execute o Passo 0."

---

## 1. Objetivo

Publicar esta aplicação na nuvem como **protótipo navegável**, acessível por link,
para demonstração ao dono da área da Qualidade.

Não é a instalação definitiva. A casa final do sistema será o servidor interno da
empresa. Esta versão em nuvem existe para provar que a aplicação funciona e para
sustentar a conversa com o TI.

Objetivo secundário, igualmente importante: **transformar este processo em método
replicável** para todas as próximas aplicações.

---

## 2. Regras inegociáveis

1. **Nenhum dado real da empresa.** O banco sobe vazio. Todo registro criado para a
   demonstração é fictício. Sem nomes reais de fornecedores, sem não-conformidades
   reais, sem anexos reais.
2. **Não mexer na versão que funciona.** Trabalhar em branch separada
   (`deploy/cloud`). A `main` continua rodando localmente, intacta.
3. **Mudar só o obrigatório.** Não refatorar, não "melhorar", não trocar biblioteca,
   não reescrever nada que já funciona.
4. **Confirmar antes de codar.** Antes de qualquer alteração, explicar o que vai
   mudar, em quais arquivos, e aguardar meu "executar".
5. **Nenhuma credencial no repositório.** Chaves e senhas só em variáveis de
   ambiente. Verificar que `.env` está no `.gitignore`.

---

## 3. Stack de destino

| Peça | Onde vai rodar |
|---|---|
| Frontend | Render — Static Site (gratuito, não hiberna) |
| Backend | Render — Web Service (a partir do Dockerfile existente) |
| Banco de dados | Supabase — PostgreSQL gerenciado |
| Arquivos / uploads | Supabase Storage |
| Código | GitHub (repositório já existe) |

**Autenticação permanece como está.** A aplicação já tem JWT próprio funcionando.
Não usar Supabase Auth. Não tocar no fluxo de login.

O Supabase entra apenas como banco de dados e armazenamento de arquivos.

---

## 4. O que muda e o que não muda

**Muda:**
- String de conexão do banco (`DATABASE_URL` aponta para o Supabase)
- Gravação de uploads: de disco local para Supabase Storage
- Configuração de CORS (frontend e backend passam a ter domínios diferentes)
- Variáveis de ambiente: saem do `.env` local, vão para o painel do Render
- O container `postgres` do compose deixa de ser usado em produção

**Não muda:**
- Lógica de negócio
- Telas e componentes do frontend
- Autenticação JWT
- Modelo de dados / schema

---

## 5. Passo 0 — Inventário (fazer antes de qualquer alteração)

Antes de tocar em uma linha de código, mapear e me apresentar em texto:

1. Linguagem e framework do backend, e como ele é iniciado
2. Framework do frontend e comando de build
3. Conteúdo e estrutura do `docker-compose.yml` — o que cada serviço faz
4. Como o schema do banco é criado hoje (migrations? script SQL? ORM?)
5. Onde e como os uploads são gravados hoje (caminho, biblioteca, função)
6. Lista completa das variáveis de ambiente usadas
7. Como o JWT é emitido e validado, e onde o segredo vem
8. Se existe algum caminho ou configuração cravado no código (`localhost`, IP,
   porta fixa, caminho absoluto de pasta)

**Entregar isso como relatório e parar.** Não seguir para o Passo 1 sem meu aval.

---

## 6. Passos de execução

Cada passo termina com verificação. Não avançar com passo anterior quebrado.

### Passo 1 — Branch de trabalho
Criar `deploy/cloud` a partir da `main`. Confirmar que `.env` está ignorado
e que não há segredo commitado no histórico.

### Passo 2 — Projeto no Supabase
Criar projeto (região mais próxima do Brasil). Guardar a connection string do
Postgres e a chave de serviço. Nada disso vai para o repositório.

### Passo 3 — Schema no Supabase
Rodar contra o Supabase o mesmo mecanismo que hoje cria as tabelas localmente
(migrations ou DDL). **Somente estrutura — nenhuma linha de dado.**
Verificar: todas as tabelas existem e estão vazias.

### Passo 4 — Backend apontando para o Supabase
Alterar apenas a origem da conexão, via variável de ambiente.
Verificar: subir o backend **local** conectado ao banco do Supabase e confirmar
que responde. Isolar o problema de banco antes de introduzir o problema de deploy.

### Passo 5 — Uploads para o Supabase Storage
Substituir a gravação em disco por Supabase Storage.
**Motivo: o disco do Render é efêmero — arquivo salvo em disco desaparece no
próximo deploy.** Este passo não é opcional.
Verificar: upload e download funcionando com o backend rodando local.

### Passo 6 — Deploy do backend no Render
Criar Web Service a partir do repositório, usando o Dockerfile existente.
Cadastrar todas as variáveis de ambiente no painel.
Verificar: a URL pública do backend responde.

### Passo 7 — Deploy do frontend no Render
Criar Static Site. Configurar a URL do backend como variável de build.
Ajustar o CORS no backend para aceitar o domínio do frontend.
Verificar: o frontend abre e conversa com o backend.

### Passo 8 — Usuário administrador inicial
Banco vazio significa nenhum usuário. Criar o primeiro admin por script,
com senha forte, e registrar como isso foi feito.
Verificar: login funciona ponta a ponta.

### Passo 9 — Teste completo e documentação
Percorrer o fluxo inteiro do sistema como um usuário faria, incluindo upload
de arquivo. Documentar em `DEPLOY.md` o passo a passo real executado — este é
o entregável que torna o processo replicável.

---

## 7. Armadilhas conhecidas

- **Disco efêmero no Render.** Qualquer arquivo escrito no sistema de arquivos
  desaparece no redeploy. Tudo que precisa persistir vai para o Supabase.
- **Hibernação no plano gratuito.** O Web Service dorme após 15 minutos parado e
  leva 30 a 50 segundos para acordar. Abrir o link antes de qualquer demonstração,
  ou usar o plano pago no mês da apresentação.
- **Pausa do Supabase.** Projeto gratuito é pausado após 7 dias sem requisição.
- **Sem backup automático no plano gratuito do Supabase.** Para o protótipo, sem
  problema (os dados são fictícios). Para produção, seria inaceitável.
- **CORS.** Assim que frontend e backend passam a ter domínios distintos, requisição
  bloqueada por CORS é o erro mais provável. Conferir isso primeiro se algo falhar.
- **Configuração cravada no código.** Qualquer `localhost` ou porta fixa esquecida
  no código vai quebrar em produção. Foi mapeado no Passo 0 — usar aquela lista.

---

## 8. Critério de pronto

- [ ] Link público abre em qualquer navegador, fora da rede da empresa
- [ ] Login funciona
- [ ] Cadastro e consulta funcionam
- [ ] Upload de arquivo funciona e o arquivo continua lá após um redeploy
- [ ] Nenhum dado real da empresa em lugar nenhum
- [ ] Nenhuma credencial no repositório
- [ ] `DEPLOY.md` escrito, com o passo a passo real, replicável para o próximo projeto
