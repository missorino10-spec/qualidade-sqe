# Guia de Instalação — Sistema de Qualidade (SQE)

Guia rápido para o TI subir o sistema num servidor/VM da empresa.
Os usuários da Qualidade acessam apenas pelo **navegador**, pela rede local.
Ninguém instala nada no próprio PC.

---

## 1. O que é preciso no servidor

- 1 servidor ou VM (Windows Server ou Linux) na rede da empresa.
- **Docker** instalado (é o único pré-requisito).
  - Windows Server: instalar **Docker Desktop** (https://www.docker.com/products/docker-desktop/).
  - Linux: instalar **Docker Engine + plugin Compose** (https://docs.docker.com/engine/install/).
- Recomendado: 2 vCPU, 4 GB de RAM, 20 GB de disco livre.

---

## 2. Copiar os arquivos

1. Copiar a pasta do sistema para o servidor (ex.: `C:\Sistemas\Qualidade` ou `/opt/qualidade`).
2. Abrir o arquivo **`.env`** que está na raiz da pasta e ajustar:

   ```
   APP_PORT=8090                 # porta de acesso (mude se 8090 estiver em uso)
   POSTGRES_PASSWORD=...         # troque por uma senha forte
   JWT_SECRET=...                # troque por um texto longo e aleatório
   SEED_ADMIN_EMAIL=...          # e-mail do administrador (o 1º e único usuário)
   SEED_ADMIN_PASSWORD=...       # senha dele, mínimo 12 caracteres
   ```

   > A senha do banco e a JWT_SECRET **só precisam ser definidas uma vez**, antes de subir.
   >
   > As duas `SEED_ADMIN_*` são **obrigatórias**: sem elas o contêiner do backend
   > para no boot de propósito, para o sistema nunca subir sem usuário nenhum.

---

## 3. Subir o sistema

Abrir um terminal **dentro da pasta do sistema** e rodar:

```bash
docker compose up -d --build
```

- A primeira vez demora alguns minutos (baixa imagens e compila).
- Ao terminar, os 3 contêineres ficam de pé: `qualidade-postgres`, `qualidade-backend`, `qualidade-frontend`.
- O sistema reinicia sozinho se o servidor for reiniciado (`restart: unless-stopped`).

Conferir se está no ar:

```bash
docker compose ps
```

---

## 4. Acessar

No navegador de qualquer PC da rede:

```
http://IP-DO-SERVIDOR:8090
```

(troque `IP-DO-SERVIDOR` pelo IP fixo da máquina; a porta é a do `.env`).

**Primeiro login (admin):**

- Usuário: o `SEED_ADMIN_EMAIL` que foi posto no `.env`
- Senha: o `SEED_ADMIN_PASSWORD` do mesmo arquivo

Não existe senha padrão. Esse é o **único** usuário que a instalação cria; as
demais pessoas entram depois, cadastradas na tela de **Colaboradores**.

> Se o acesso pela rede não abrir, liberar a porta (ex.: 8090) no **firewall** do servidor.

---

## 5. Comandos do dia a dia

| Ação | Comando (dentro da pasta) |
|------|---------------------------|
| Ver status | `docker compose ps` |
| Ver logs | `docker compose logs -f` |
| Parar | `docker compose stop` |
| Iniciar de novo | `docker compose start` |
| Atualizar versão nova | `docker compose up -d --build` |

> **Importante:** os dados ficam em volumes do Docker (`postgres_data`, `uploads_data`) e
> **não** se perdem ao parar/atualizar. Só um `docker compose down -v` apagaria tudo — **não usar** em produção.

---

## 6. Backup dos dados (recomendado)

Gerar um backup do banco a qualquer momento:

```bash
docker compose exec -T postgres pg_dump -U qualidade qualidade > backup-qualidade-AAAA-MM-DD.sql
```

Restaurar um backup (com o sistema no ar):

```bash
cat backup-qualidade-AAAA-MM-DD.sql | docker compose exec -T postgres psql -U qualidade -d qualidade
```

> Sugestão: agendar esse `pg_dump` uma vez por dia (Agendador de Tarefas do Windows ou cron no Linux)
> e guardar os arquivos `.sql` num local seguro.
