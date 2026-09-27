# Sistema de Qualidade (SQE) — instalação no servidor da fábrica

Guia para o TI. Da máquina zerada até o sistema no ar, acessível pelo
navegador de qualquer computador da rede.

O sistema roda **dentro do seu servidor**. Não depende de internet, não
depende de nuvem, e os dados não saem da empresa.

---

## Antes de começar

| O que | Mínimo |
|---|---|
| Sistema operacional | Windows Server 2019 ou mais novo (build 19041+) |
| Virtualização | Habilitada na BIOS. Se o servidor for uma VM, precisa de *nested virtualization* ligada |
| Memória | 8 GB (4 GB funciona, mas fica apertado na importação de planilha) |
| Disco livre | 20 GB |
| Porta na rede | 8080 (pode ser trocada) |
| Conta | Uma conta de serviço no domínio, **com senha que não expira** |
| Internet | Só **durante a instalação** (baixar o código e o Docker). Depois o sistema funciona sem ela |
| Token do GitHub | Token de leitura do repositório, no cofre de senhas do TI |

**Sobre o token:** o código fica num repositório **privado** no GitHub —
`missorino10-spec/qualidade-sqe`. Para baixá-lo é preciso um token de
leitura. Ele é usado só na instalação e **não fica gravado no servidor**.

**Sobre a conta:** faça os três passos logado com a **mesma conta** que vai
rodar o sistema depois. O WSL registra a distribuição Linux por usuário —
se você instalar com a sua conta pessoal e agendar com outra, a tarefa
agendada simplesmente não enxerga o Linux e o sistema não sobe no boot.

**Sobre a senha da conta:** se ela expirar, o sistema para de subir no dia
seguinte. Marque "a senha nunca expira" no Active Directory.

---

## Instalação — três passos

Não é preciso copiar pasta nenhuma para o servidor: **o código é baixado do
GitHub** pelo próprio instalador. Guarde o token de leitura à mão.

### Passo 1 — preparar o Windows

PowerShell **como administrador**:

```powershell
mkdir C:\QualidadeSQE -Force; cd C:\QualidadeSQE
curl.exe -fsSL -H "Authorization: token SEU_TOKEN" -o 1-preparar-windows.ps1 `
  https://raw.githubusercontent.com/missorino10-spec/qualidade-sqe/main/deploy-servidor/1-preparar-windows.ps1
powershell -ExecutionPolicy Bypass -File .\1-preparar-windows.ps1
```

Liga o WSL2, instala o Ubuntu, abre a porta 8080 no firewall e cria
`C:\QualidadeSQE\` (backups e logs).

**O Windows provavelmente vai pedir para reiniciar.** Reinicie e rode o
passo 1 de novo — ele pode ser executado quantas vezes for preciso, não
desfaz nada.

No fim ele mostra o **IP do servidor**. Anote: é o endereço que a fábrica
vai usar.

### Passo 2 — instalar o sistema

Ainda no PowerShell:

```powershell
wsl -d Ubuntu-22.04 -u root
curl -fsSL -H "Authorization: token SEU_TOKEN" -o /tmp/instalar.sh \
  https://raw.githubusercontent.com/missorino10-spec/qualidade-sqe/main/deploy-servidor/2-instalar.sh
bash /tmp/instalar.sh
```

Ele pede o token de novo (agora para baixar o código inteiro). Digite e
tecle Enter — não aparece na tela.

Instala o Docker, **baixa o código do GitHub** para `/opt/qualidade-sqe`,
sorteia as senhas do banco e do acesso principal, e sobe o sistema.

Demora: a primeira vez leva alguns minutos (ele monta o sistema do zero).

No fim, o script **faz um login de verdade** para provar que telas, API,
banco e o acesso principal estão todos de pé — e grava os dados de acesso
em `C:\QualidadeSQE\PRIMEIRO-ACESSO.txt`.

### Passo 3 — ligar o início automático e o backup

PowerShell **como administrador**:

```powershell
cd C:\QualidadeSQE
powershell -ExecutionPolicy Bypass -File .\3-ativar-inicio-automatico.ps1
```

(o passo 2 já deixou este script nessa pasta)

Ele pede a senha da conta de serviço e cria três tarefas agendadas:

| Tarefa | Quando | Para quê |
|---|---|---|
| `QualidadeSQE-Iniciar` | ao ligar o servidor | sobe o sistema |
| `QualidadeSQE-Vigia` | a cada 10 minutos | confere e religa se caiu |
| `QualidadeSQE-Backup` | todo dia às 20:00 | copia banco + anexos |

No fim ele executa a tarefa de boot e confere o sistema **pelo IP do
servidor** (não por `localhost`), ou seja: testa o mesmo caminho que a
fábrica vai usar, firewall incluso.

> Se der erro de permissão, a conta precisa do direito **"Fazer logon como
> tarefa em lote"** — `secpol.msc` → Políticas Locais → Atribuição de
> direitos de usuário.

---

## Primeiro acesso

1. De qualquer computador da rede, abra: **`http://IP-DO-SERVIDOR:8080`**
2. Entre com o usuário e a senha de `C:\QualidadeSQE\PRIMEIRO-ACESSO.txt`
3. **Troque a senha** e, em *Colaboradores*, cadastre as pessoas da
   Qualidade com as permissões de cada uma
4. Apague o `PRIMEIRO-ACESSO.txt` (ou guarde no cofre de senhas do TI)

O sistema começa **vazio**, de propósito. Os cadastros reais entram no
primeiro dia pela importação de planilha (*Cadastros → Importar*), a
partir do modelo em branco que o próprio sistema gera.

**Sugestão para a fábrica:** peça ao TI um nome amigável no DNS interno
(ex.: `qualidade`) apontando para o IP do servidor. Aí o endereço vira
`http://qualidade:8080` e ninguém precisa decorar números.

---

## O sistema volta sozinho?

Sim, e por quatro caminhos diferentes — cada um cobre um jeito de cair:

| O que aconteceu | Quem resolve | Em quanto tempo |
|---|---|---|
| Uma parte do sistema travou | o próprio Docker religa | ~10 segundos |
| O serviço do Docker caiu | o systemd do Linux religa | ~30 segundos |
| O Linux desligou | a tarefa Vigia acorda | até 10 minutos |
| O servidor reiniciou | a tarefa Iniciar, no boot | ~1 minuto |

Quando o servidor é desligado de forma normal, o sistema recebe o aviso,
**termina de gravar o que estava em andamento** e só então fecha o banco —
uma importação de planilha no meio do caminho não é cortada.

Para acompanhar: `C:\QualidadeSQE\logs\inicio.log`. Ele só escreve quando
**mudou** alguma coisa; se estiver quieto, é porque está tudo no ar.

---

## Backup

Todo dia às 20:00, um arquivo único em **`C:\QualidadeSQE\backups\`**:

```
qualidade_2026-09-21_2000.tar.gz
```

Dentro dele vai o banco inteiro (RNCs, inspeções, fornecedores,
histórico) **e** todas as fotos e anexos enviados pela Qualidade.

O arquivo fica no disco do **Windows** de propósito: assim ele entra no
backup corporativo do servidor junto com o resto, e o TI não precisa
saber que existe um Linux no meio.

O script **confere que o arquivo abre** antes de dar o backup por bom — um
arquivo corrompido não é contado como backup feito. Guarda 30 dias.

**Recomendação:** inclua `C:\QualidadeSQE\backups\` na rotina de fita ou
de nuvem da empresa. Backup que fica só no mesmo servidor não protege
contra o servidor pegar fogo.

Rodar um backup na hora, sem esperar as 20:00:

```powershell
wsl -d Ubuntu-22.04 -u root -e bash -lc /opt/qualidade-sqe/deploy-servidor/backup.sh
```

### Restaurar

```powershell
# ver o que existe
wsl -d Ubuntu-22.04 -u root -e bash -lc "/opt/qualidade-sqe/deploy-servidor/restaurar.sh --listar"

# restaurar
wsl -d Ubuntu-22.04 -u root
/opt/qualidade-sqe/deploy-servidor/restaurar.sh /mnt/c/QualidadeSQE/backups/qualidade_2026-09-21_2000.tar.gz
```

A restauração **substitui** os dados de agora, então ela pede que você
digite `RESTAURAR` por extenso para confirmar. E antes de tocar em
qualquer coisa ela guarda sozinha uma cópia do estado atual
(`antes-da-restauracao_*.dump`), para o caso de ter sido o backup errado.

---

## Operação do dia a dia

Tudo abaixo é no PowerShell, como administrador.

**Ver se está no ar:**
```powershell
wsl -d Ubuntu-22.04 -u root -e bash -lc "cd /opt/qualidade-sqe && docker compose ps"
```

**Forçar uma conferência (sem esperar os 10 minutos):**
```powershell
powershell -ExecutionPolicy Bypass -File C:\QualidadeSQE\iniciar.ps1
```

**Reiniciar o sistema:**
```powershell
wsl -d Ubuntu-22.04 -u root -e bash -lc "cd /opt/qualidade-sqe && docker compose restart"
```

**Ver o que o sistema registrou:**
```powershell
wsl -d Ubuntu-22.04 -u root -e bash -lc "cd /opt/qualidade-sqe && docker compose logs --tail=100 backend"
```

**Trocar a porta 8080 por outra:** edite `APP_PORT` em
`/opt/qualidade-sqe/.env`, rode `docker compose up -d`, e repita os
passos 1 e 3 com `-Porta <nova>` (para refazer firewall e tarefas).

---

## Atualizar o sistema para uma versão nova

Rode o passo 2 de novo. Ele reconhece que já existe instalação:
**não sorteia senha nova, não apaga dado nenhum** — só troca o código pelo
que está no GitHub e reconstrói.

```powershell
wsl -d Ubuntu-22.04 -u root
curl -fsSL -H "Authorization: token SEU_TOKEN" -o /tmp/instalar.sh \
  https://raw.githubusercontent.com/missorino10-spec/qualidade-sqe/main/deploy-servidor/2-instalar.sh
bash /tmp/instalar.sh
```

**Tire um backup antes** (comando na seção anterior). É a rede de segurança
para voltar atrás se a versão nova não agradar.

Para saber qual versão está instalada:

```powershell
wsl -d Ubuntu-22.04 -u root -e bash -lc "git -C /opt/qualidade-sqe log -1 --format='%h %ad %s' --date=short"
```

---

## Se alguém não consegue abrir o sistema

Na ordem, do mais comum para o mais raro:

1. **Só um computador não abre** → é rede/proxy daquela máquina, não é o
   servidor. Teste o mesmo endereço em outro micro.
2. **Ninguém da rede abre, mas no servidor funciona** → firewall ou
   encaminhamento de porta. Rode `C:\QualidadeSQE\iniciar.ps1`: ele
   refaz o encaminhamento (o IP interno do Linux muda a cada boot, e é a
   causa mais comum desse sintoma).
3. **Nem no servidor abre** → veja `docker compose ps`. Se algum item não
   estiver "Up", veja os logs do passo anterior.
4. **Depois de trocar a senha da conta de serviço** → as três tarefas
   param de rodar. Rode o passo 3 de novo com a senha nova.

---

## Onde fica o quê

| Caminho | O que é |
|---|---|
| `github.com/missorino10-spec/qualidade-sqe`, ramo `main` | o código de onde tudo vem (privado) |
| `/opt/qualidade-sqe` (dentro do WSL) | o sistema instalado |
| `/opt/qualidade-sqe/.env` | senhas do banco e do acesso principal — **não versionar, não compartilhar** |
| `C:\QualidadeSQE\backups\` | os backups diários |
| `C:\QualidadeSQE\logs\inicio.log` | o que a vigia fez |
| `C:\QualidadeSQE\logs\backup.log` | o que o backup fez |
| `C:\QualidadeSQE\iniciar.ps1` | o script que mantém tudo no ar |

Os dados ficam em volumes do Docker (`postgres_data` e `uploads_data`),
dentro do WSL. **Nunca** rode `docker compose down -v` no servidor: o `-v`
apaga esses volumes, ou seja, apaga o banco e os anexos.

---

## Por que WSL2 e não Docker Desktop

O Docker Desktop exige licença paga para empresas deste porte e precisa de
alguém logado na máquina para funcionar. O WSL2 com Docker Engine é
gratuito, roda sem ninguém logado, é o mesmo Docker por baixo e é a forma
suportada pela Microsoft no Windows Server.
