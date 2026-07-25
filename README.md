# Sistema de Qualidade — Módulo SQE (Big Dutchman Brasil)

Aplicação interna para digitalizar o processo de **SQE (Supplier Quality Engineering)** —
planejamento de inspeções, entregas, inspeções de recebimento, RNCs (Registro de Não
Conformidade) e um dashboard de indicadores. Roda 100% no servidor da empresa, na rede
local, **sem custo de licença**.

Feito para evoluir depois com os módulos **Manufatura**, **SQD** e **OEE**, que reaproveitam
o mesmo núcleo (fornecedores, itens, anexos e histórico).

---

## O que você precisa no servidor

Apenas **Docker** e **Docker Compose** instalados. Nada mais (banco de dados, backend e
frontend já vêm prontos dentro do Docker).

- Windows Server / Windows 10+ → instalar o **Docker Desktop**
- Linux → instalar o **Docker Engine** + plugin **docker compose**

Para conferir se está instalado, abra o terminal e rode:

```bash
docker --version
docker compose version
```

---

## Como colocar no ar (passo a passo)

1. Copie esta pasta inteira para o servidor.

2. Dentro da pasta, crie o arquivo de configuração a partir do exemplo:

   ```bash
   cp .env.example .env
   ```

3. Abra o `.env` e ajuste principalmente:
   - `APP_PORT` → a porta em que o sistema vai ficar acessível (padrão `8080`)
   - `POSTGRES_PASSWORD` → uma senha forte para o banco
   - `JWT_SECRET` → um texto longo e aleatório (segurança do login)

4. Suba tudo com **um único comando**:

   ```bash
   docker compose up -d --build
   ```

   Na primeira vez ele baixa e monta as imagens (demora alguns minutos). Nas próximas,
   sobe em segundos.

5. Pronto. Acesse pelo navegador de qualquer computador da rede:

   ```
   http://IP-DO-SERVIDOR:8080
   ```

   (Troque `IP-DO-SERVIDOR` pelo IP do servidor. No próprio servidor pode usar
   `http://localhost:8080`.)

---

## Primeiro acesso (usuários de teste)

O sistema já cria três usuários para você começar. Todos com a senha **`123456`**:

| Perfil    | E-mail                          | O que pode fazer                          |
| --------- | ------------------------------- | ----------------------------------------- |
| Admin     | `admin@bigdutchman.com.br`      | Tudo + gestão de usuários                 |
| Qualidade | `qualidade@bigdutchman.com.br`  | Todo o fluxo SQE (planejar, inspecionar…) |
| Produção  | `producao@bigdutchman.com.br`   | Só leitura do dashboard (futuro OEE)      |

> **Troque essas senhas depois do primeiro acesso.**

Também já vêm cadastrados 2 fornecedores e 3 itens de exemplo, para você testar o fluxo
sem precisar cadastrar nada antes.

---

## Testando o fluxo completo

1. Entre com o usuário **Qualidade**.
2. **Planejamento Semanal** → crie um planejamento para um fornecedor.
3. **Entregas / Portaria** → registre a chegada de uma entrega.
4. **Inspeções** → crie uma inspeção; marque **"Desvio identificado"** e salve.
   O sistema pergunta se quer **abrir uma RNC** na hora.
5. **RNC** → o formulário já vem pré-preenchido. Abra a RNC.
6. Na tela da RNC: **Enviar ao Fornecedor** → **Registrar Resposta** (causa raiz e ação
   corretiva) → **Encerrar** (com eficácia e custo evitado). Anexe evidências se quiser.
7. **Dashboard** → veja os indicadores e a lista de RNCs em aberto se atualizarem.

---

## Comandos úteis

```bash
# Ver se está tudo rodando
docker compose ps

# Ver os logs (mensagens do sistema)
docker compose logs -f

# Parar o sistema (sem apagar os dados)
docker compose down

# Subir de novo depois de parar
docker compose up -d

# Atualizar depois de mudar o código
docker compose up -d --build
```

Os **dados do banco** e os **arquivos anexados** ficam guardados em volumes do Docker
(`postgres_data` e `uploads_data`) e **não são apagados** com o `docker compose down`.
Para apagar tudo (inclusive os dados), use `docker compose down -v`.

---

## Como está organizado (visão geral)

```
02.1 - Qualidade/
├── backend/            NestJS + Prisma + PostgreSQL (a "cozinha": regras e banco)
│   ├── prisma/         desenho do banco de dados + dados de teste (seed)
│   └── src/            núcleo (auth, fornecedores, itens, anexos, histórico) + SQE
├── frontend/           React + Ant Design (as telas que o usuário vê)
│   └── src/pages/      Login, Dashboard, Planejamento, Entregas, Inspeções, RNC…
├── docker-compose.yml  liga banco + backend + frontend num comando só
└── .env.example        modelo de configuração (copie para .env)
```

- O **frontend** (nginx) é a única porta exposta na rede e encaminha as chamadas
  `/api` para o **backend**.
- O **backend** fala com o **PostgreSQL**, que não fica exposto para fora.

---

## Segurança (rede interna)

Este MVP foi feito para rodar **só na rede local da empresa**, por IP — sem domínio nem
HTTPS. Não há disparo de e-mail nem workflow de aprovação nesta primeira versão (será
adicionado depois). Mantenha o `JWT_SECRET` em segredo e troque as senhas dos usuários
de teste.
