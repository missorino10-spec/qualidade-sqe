# Guia — Colocar o Sistema de Qualidade (SQE) na nuvem

> Objetivo: rodar o sistema num servidor na internet, **com os dados armazenados e com backup**, sem depender da TI e pelo **menor custo possível**.
>
> Você já tem tudo pronto (Docker + scripts). Sua parte se resume a: criar a conta do provedor e **colar 1 comando**.

---

## 1. Análise: qual a opção mais barata

O sistema roda em **um único servidor (VPS)** com 4 contêineres: banco PostgreSQL, backend, frontend e a porta de entrada web. Consumo real estimado: **~1,2 GB de RAM** e ~5 GB de disco no primeiro ano.

| Provedor | Custo/mês | Specs | Região Brasil | Observação |
|---|---|---|---|---|
| **Oracle Cloud "Always Free"** | **R$ 0** | até 4 vCPU ARM / 24 GB RAM / 200 GB | ✅ Vinhedo-SP | Grátis permanente. Melhor custo-benefício absoluto |
| **Hetzner** CX22 | ~R$ 25 | 2 vCPU / 4 GB / 40 GB | ❌ (EUA/Europa) | Mais barato entre os pagos, muito estável |
| **AWS Lightsail** | ~R$ 28 | 1 vCPU / 1 GB / 40 GB | ✅ São Paulo | 1 GB é apertado (o script cria swap) |
| **Vultr** | ~R$ 30 | 1 vCPU / 1 GB / 25 GB | ✅ São Paulo | Alternativa equivalente |
| **DigitalOcean** | ~R$ 34 | 1 vCPU / 1 GB / 25 GB | ❌ | Mais caro pelo mesmo recurso |

*Valores de referência — confirme no site do provedor, pois mudam.*

### Veredito

**🏆 Mais barato: Oracle Cloud "Always Free" — R$ 0/mês, para sempre.**

E não é "grátis capenga": são até 4 vCPU e 24 GB de RAM (muito acima do necessário), 200 GB de disco, **com região no Brasil (Vinhedo-SP)** — o que ajuda em latência e em LGPD, já que os dados de qualidade ficam em território nacional.

**Ressalvas honestas do plano grátis da Oracle:**
- Exige **cartão de crédito na verificação** (cobra ~R$ 5 de teste e estorna; não vira assinatura).
- A instância é **ARM** — sem problema: o Docker do projeto compila em ARM normalmente.
- Às vezes **falta capacidade ARM** na região no momento da criação. Se acontecer, tente outra região ou repita mais tarde.
- Contas gratuitas ociosas já foram desativadas pela Oracle no passado. **Por isso o backup externo é obrigatório** (o script já cuida disso).

**Se você preferir previsibilidade a custo zero:** vá de **Hetzner (~R$ 25/mês)** — mais simples de criar e sem loteria de capacidade. O mesmo comando de instalação funciona nos dois.

---

## 2. Passo 1 — Subir o código para o GitHub

O servidor vai **baixar o código do GitHub**. Além disso, o GitHub funciona como uma cópia de segurança do código.

O repositório local **já está preparado** (89 arquivos, 825 KB, `.env` e binários pesados excluídos). Falta apenas publicá-lo:

1. Acesse [github.com/new](https://github.com/new)
2. **Repository name:** `qualidade-sqe`
3. **⚠️ Marque `Private`** — é um sistema interno da empresa; nunca deixe público
4. **Não** marque nada em "Initialize this repository" (sem README, sem .gitignore)
5. Clique em **Create repository**

Depois disso, me avise que eu rodo o commit e o push. Vou precisar de duas informações suas:
- Seu **nome de usuário do GitHub**
- O **e-mail** da sua conta GitHub

*(Necessários porque todo commit carrega a identidade do autor — não posso inventar esses dados.)*

---

## 3. Passo 2 — Criar o servidor

### Opção A — Oracle Cloud (grátis)

1. Crie a conta em [cloud.oracle.com](https://cloud.oracle.com) → **Start for free**
   - Escolha a região **Brazil East (São Paulo)** ou **Brazil Southeast (Vinhedo)** — a região **não pode ser alterada depois**
2. No menu: **Compute → Instances → Create Instance**
   - **Image:** Ubuntu 22.04
   - **Shape:** `VM.Standard.A1.Flex` (ARM) → **4 OCPUs / 24 GB** (tudo dentro do Always Free)
   - **SSH keys:** escolha *Generate a key pair* e **baixe a chave privada** (guarde bem — é sua senha de acesso)
3. Crie a instância e **anote o IP público**
4. Libere as portas: **Networking → Virtual Cloud Networks → sua VCN → Security Lists → Default**
   - *Add Ingress Rules* → Source `0.0.0.0/0`, protocolo TCP, portas **80** e **443**

### Opção B — Hetzner (~R$ 25/mês)

1. Conta em [hetzner.com/cloud](https://www.hetzner.com/cloud) → **New Project → Add Server**
2. **Image:** Ubuntu 22.04 · **Type:** CX22 · adicione sua chave SSH
3. Anote o IP público (o firewall já vem liberado por padrão)

---

## 4. Passo 3 — Instalar (o único comando que você digita)

Conecte no servidor:

```bash
ssh -i sua-chave.key ubuntu@IP-DO-SERVIDOR     # Oracle usa o usuário "ubuntu"
ssh root@IP-DO-SERVIDOR                        # Hetzner usa "root"
```

E cole **este bloco** (troque `SEU-USUARIO` pelo seu usuário do GitHub):

```bash
sudo apt-get update && sudo apt-get install -y git && \
sudo git clone https://github.com/SEU-USUARIO/qualidade-sqe.git /opt/qualidade && \
cd /opt/qualidade && \
sudo bash deploy-nuvem/instalar-nuvem.sh
```

Pronto. O script faz sozinho: instala o Docker, cria swap, libera o firewall, **gera senhas fortes aleatórias**, sobe os 4 contêineres e **agenda o backup diário**. Leva de 5 a 10 minutos.

Ao final ele mostra o endereço de acesso, algo como `http://IP-DO-SERVIDOR`.

### Com domínio próprio (ativa HTTPS automático e grátis)

Se você tiver um domínio, aponte um registro **A** para o IP do servidor e rode:

```bash
sudo DOMINIO=qualidade.suaempresa.com.br bash deploy-nuvem/instalar-nuvem.sh
```

O Caddy emite e renova o certificado sozinho — o sistema passa a abrir em `https://`.

---

## 5. ⚠️ Primeira coisa depois de instalar: guardar a senha do admin

O sistema nasce com **um único usuário**, o administrador. O e-mail e a senha
são sorteados pelo instalador e aparecem **uma só vez**, no resumo final:

```
  Usuario ADMIN criado na instalacao:
    E-mail: admin@qualidade.local
    Senha:  <sorteada na hora>
```

Se esse resumo se perder, a senha continua no `.env` da raiz
(`SEED_ADMIN_PASSWORD`), que só o root lê. Para escolher o e-mail do admin,
rode o instalador com `SEED_ADMIN_EMAIL=voce@suaempresa.com.br`.

Entre com ele e cadastre as pessoas reais em **Colaboradores**, cada uma com a
própria senha. Não existe mais senha padrão: o backend se recusa a subir sem
essas duas variáveis, justamente para nunca haver um `123456` exposto na internet.

**Sem domínio/HTTPS, as senhas trafegam sem criptografia.** Priorize apontar um domínio.

---

## 6. Onde ficam os dados (a sua pergunta central)

| O quê | Onde fica | Sobrevive a quê |
|---|---|---|
| **Banco de dados** (histórico, RNCs, inspeções, fornecedores) | Volume Docker `postgres_data`, no disco do servidor | Reinício e atualização do sistema |
| **Anexos e fotos** | Volume Docker `uploads_data` | Reinício e atualização |
| **Backups diários** | `/var/backups/qualidade` (retenção 14 dias) | Perda dos volumes |
| **Cópia externa** *(opcional, recomendado)* | Google Drive / OneDrive / S3 via rclone | **Perda total do servidor** |

O backup roda **todo dia às 02:00** e gera um arquivo único com o banco + os anexos.

### Ativar a cópia externa (proteção contra perder o servidor inteiro)

Enquanto o backup ficar só no servidor, se o servidor morrer você perde tudo junto. Para enviar a cópia para fora:

```bash
sudo apt install -y rclone
rclone config        # crie um destino com o nome exato: backup
```

O `backup.sh` detecta sozinho e passa a enviar a cópia a cada execução.

### Comandos do dia a dia

```bash
sudo ./deploy-nuvem/backup.sh              # backup manual agora
sudo ./deploy-nuvem/restaurar.sh --listar  # ver backups disponíveis
sudo ./deploy-nuvem/restaurar.sh <arquivo> # restaurar ("se der merda")
```

A restauração pede confirmação digitada e **salva o estado atual antes de sobrescrever** — dá para voltar atrás.

---

## 7. Atualizar o sistema depois de mexer no código

Na sua máquina, envie as mudanças; no servidor:

```bash
cd /opt/qualidade && sudo git pull && sudo bash deploy-nuvem/instalar-nuvem.sh
```

O instalador é seguro para repetir: **preserva o `.env`, o banco e os anexos**.

---

## 8. Resumo dos custos

| Item | Oracle (grátis) | Hetzner |
|---|---|---|
| Servidor | R$ 0 | ~R$ 25/mês |
| Banco de dados | R$ 0 (no próprio servidor) | R$ 0 |
| HTTPS/certificado | R$ 0 (Let's Encrypt) | R$ 0 |
| Backup | R$ 0 (local) | R$ 0 |
| Domínio *(opcional)* | ~R$ 40/ano | ~R$ 40/ano |
| **Total** | **R$ 0/mês** | **~R$ 25/mês** |
