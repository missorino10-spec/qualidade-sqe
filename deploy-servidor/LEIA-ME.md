# Sistema de Qualidade (SQE) — instalação no servidor da fábrica

Guia para o TI. Da máquina zerada até o sistema no ar, acessível pelo
navegador de qualquer computador da rede.

O sistema roda **dentro do seu servidor**. Não depende de internet, não
depende de nuvem, e os dados não saem da empresa.

**Instalação nativa no Windows:** Node.js e PostgreSQL instalados
direto na máquina. Sem Docker, sem WSL, sem Linux no meio. São dois
programas que o TI já conhece, dois serviços na lista de serviços do
Windows, e tudo o que der problema aparece no Visualizador de Eventos
como qualquer outro programa.

> Se você prefere rodar em Linux com contêiner, o `docker-compose.yml` na
> raiz do repositório continua válido e funciona. Este guia cobre o
> caminho nativo, que é o que está em produção na fábrica.

---

## Antes de começar

| O que | Mínimo |
|---|---|
| Sistema operacional | Windows Server 2019 ou mais novo (serve Windows 10/11 também) |
| Memória | 8 GB (4 GB funciona, mas fica apertado na importação de planilha) |
| Disco livre | 20 GB |
| Porta na rede | 8080 (pode ser trocada) |
| Conta | Administrador local da máquina, para rodar os três passos |
| Internet | Só **durante a instalação** (baixar o código, o Node e o PostgreSQL). Depois o sistema funciona sem ela |

**Nada de conta de serviço.** O sistema sobe como `SYSTEM`, a conta
interna do Windows. Ela não tem senha, logo não expira — a causa mais
comum de "o sistema parou de subir do nada" simplesmente não existe aqui.

---

## Instalação — três passos

Não é preciso copiar pasta nenhuma para o servidor: **o código é baixado do
GitHub** pelo próprio instalador, de
`github.com/missorino10-spec/qualidade-sqe` (ramo `main`, repositório
público — não pede senha nem token).

Os três passos podem ser executados **quantas vezes for preciso**. Nenhum
deles apaga dado, nenhum deles sorteia senha de novo se já existir uma.

### Passo 1 — preparar o Windows

PowerShell **como administrador**:

```powershell
mkdir C:\QualidadeSQE -Force; cd C:\QualidadeSQE
curl.exe -fsSL -o 1-preparar-windows.ps1 `
  https://raw.githubusercontent.com/missorino10-spec/qualidade-sqe/main/deploy-servidor/1-preparar-windows.ps1
powershell -ExecutionPolicy Bypass -File .\1-preparar-windows.ps1
```

Instala Node.js, Git e PostgreSQL 17; cria as pastas em
`C:\QualidadeSQE\`; abre a porta 8080 no firewall; e sorteia as senhas,
gravando-as em **`C:\QualidadeSQE\CREDENCIAIS.txt`**.

Dois detalhes que valem saber:

- O instalador do Node é **conferido pelo SHA256** publicado pela
  nodejs.org antes de rodar. Se não bater, o arquivo é apagado e o passo
  para — é a diferença entre instalar o Node e instalar o que alguém pôs
  no caminho.
- A porta **5432 do PostgreSQL não é aberta** no firewall, de propósito.
  Quem fala com o banco é o próprio sistema, de dentro da máquina.

No fim ele mostra o **IP do servidor**. Anote: é o endereço que a fábrica
vai usar.

> **Se o PowerShell já estava aberto antes do passo 1**, feche e abra de
> novo antes do passo 2. O instalador do Node ajusta o PATH do Windows,
> mas uma janela já aberta continua com o PATH antigo e não acha o `node`.

### Passo 2 — instalar o sistema

PowerShell **como administrador**, em uma janela nova:

```powershell
cd C:\QualidadeSQE
curl.exe -fsSL -o 2-instalar.ps1 `
  https://raw.githubusercontent.com/missorino10-spec/qualidade-sqe/main/deploy-servidor/2-instalar.ps1
powershell -ExecutionPolicy Bypass -File .\2-instalar.ps1
```

Baixa o código para `C:\QualidadeSQE\app`, cria o banco e o usuário do
PostgreSQL, escreve o `backend\.env`, monta o sistema e as telas, e cria
o acesso principal.

Demora: a primeira vez leva alguns minutos (ele monta o sistema do zero).

No fim, o script **confere o resultado contra o banco**: quantas tabelas
existem, quantos usuários, quantas máquinas, se a tela compilada está no
lugar. Não é "deu certo" na fé — são números.

### Passo 3 — ligar o início automático

PowerShell **como administrador**:

```powershell
cd C:\QualidadeSQE
powershell -ExecutionPolicy Bypass -File .\app\deploy-servidor\3-ativar-inicio-automatico.ps1
```

Ele põe o serviço do PostgreSQL em início automático e cria **uma** tarefa
agendada:

| Tarefa | Quando | Para quê |
|---|---|---|
| `QualidadeSQE` | ao ligar o servidor | sobe o sistema e o mantém de pé |

Uma só, e não três como na versão antiga em Docker. A tarefa roda
`iniciar-sqe.ps1`, que **fica em pé junto com o sistema**: enquanto o
sistema está no ar, a tarefa aparece como `Running` no Agendador. Se o
sistema cair, a tarefa cai com ele e o Windows a reinicia sozinho (três
tentativas, de minuto em minuto). Não existe vigia de 10 minutos porque
não existe janela de 10 minutos.

No fim ele **sobe a tarefa e prova que o sistema responde**, e grava os
dados de acesso em `C:\QualidadeSQE\PRIMEIRO-ACESSO.txt`.

---

## A trava

Os scripts que mexem em banco (`2-instalar.ps1` e `restaurar.ps1`) leem a
`DATABASE_URL` do `.env` e **param na hora** se ela não for o banco local
desta máquina. Endereço de nuvem (Supabase, Render, AWS, Neon) aborta a
execução.

Isso existe porque um `restaurar.ps1` apontado para o banco errado é
irreversível. A trava não é desconfiança do TI: é que ninguém deveria
depender de ter lido o `.env` com atenção às 23h de um sábado.

---

## Primeiro acesso

1. De qualquer computador da rede, abra: **`http://IP-DO-SERVIDOR:8080`**
2. Entre com o usuário e a senha de `C:\QualidadeSQE\PRIMEIRO-ACESSO.txt`
3. **Troque a senha** e, em *Colaboradores*, cadastre as pessoas da
   Qualidade com as permissões de cada uma
4. Apague o `PRIMEIRO-ACESSO.txt` e guarde o `CREDENCIAIS.txt` no cofre de
   senhas do TI (ele tem a senha do banco — sem ela não há restauração)

O sistema começa **vazio**, de propósito. Os cadastros reais entram no
primeiro dia pela importação de planilha (*Cadastros → Importar*), a
partir do modelo em branco que o próprio sistema gera.

**Sugestão para a fábrica:** peça ao TI um nome amigável no DNS interno
(ex.: `qualidade`) apontando para o IP do servidor. Aí o endereço vira
`http://qualidade:8080` e ninguém precisa decorar números.

---

## O sistema volta sozinho?

Sim:

| O que aconteceu | Quem resolve | Em quanto tempo |
|---|---|---|
| O sistema travou ou fechou | o Windows reinicia a tarefa | ~1 minuto |
| O banco travou | o serviço `postgresql-x64-17` religa | ~30 segundos |
| O servidor reiniciou | a tarefa `QualidadeSQE`, no boot | ~1 minuto |

Para acompanhar: `C:\QualidadeSQE\logs\backend.log`. É tudo o que o
sistema escreveu desde que subiu — inclusive os erros.

**Ver se está no ar, sem abrir navegador:**

```powershell
Get-ScheduledTask -TaskName QualidadeSQE | Select-Object State
(Invoke-WebRequest http://localhost:8080 -UseBasicParsing).StatusCode
```

`Running` e `200` é o que se espera.

---

## Backup

Um arquivo único em **`C:\QualidadeSQE\backups\`**:

```
qualidade_2026-10-31_2000.zip
```

Dentro dele vai o banco inteiro (RNCs, inspeções, fornecedores,
histórico) **e** todas as fotos e anexos enviados pela Qualidade. Os dois
juntos de propósito: um banco sem os anexos deixa a RNC apontando para
foto que não existe mais.

O script **confere que o arquivo abre e que o banco está lá dentro** antes
de dar o backup por bom. Se algo falhou no meio, ele **apaga o arquivo
incompleto** — um .zip pela metade na pasta engana mais que arquivo
nenhum. Guarda 30 dias.

Rodar um backup na hora:

```powershell
powershell -ExecutionPolicy Bypass -File C:\QualidadeSQE\app\deploy-servidor\backup.ps1
```

### Agendar o backup diário

O passo 3 não agenda o backup — essa escolha é do TI, que sabe a que hora
a fita roda. PowerShell **como administrador**:

```powershell
$a = New-ScheduledTaskAction -Execute 'powershell.exe' `
  -Argument '-NoProfile -ExecutionPolicy Bypass -File "C:\QualidadeSQE\app\deploy-servidor\backup.ps1"'
$g = New-ScheduledTaskTrigger -Daily -At 20:00
Register-ScheduledTask -TaskName 'QualidadeSQE-Backup' -Action $a -Trigger $g `
  -User 'SYSTEM' -RunLevel Highest -Force
```

**Recomendação:** inclua `C:\QualidadeSQE\backups\` na rotina de fita ou
de nuvem da empresa. A pasta fica no **mesmo disco** do sistema — isso não
protege contra o disco falhar.

### Restaurar

```powershell
# ver o que existe
powershell -ExecutionPolicy Bypass -File C:\QualidadeSQE\app\deploy-servidor\restaurar.ps1 -Listar

# restaurar
powershell -ExecutionPolicy Bypass -File C:\QualidadeSQE\app\deploy-servidor\restaurar.ps1 `
  -Arquivo C:\QualidadeSQE\backups\qualidade_2026-10-31_2000.zip
```

A restauração **substitui** os dados de agora. Por isso ela:

1. para se a `DATABASE_URL` não for o banco local (a trava);
2. pede que você **digite o nome da máquina** para confirmar — não um
   "S/N" que se responde no automático;
3. **tira um backup do estado atual** antes de tocar em qualquer coisa, e
   confere que esse backup foi criado antes de seguir;
4. confere o banco restaurado **contando tabelas e usuários**, não
   confiando no código de saída do `pg_restore` (que reclama de coisas
   inofensivas);
5. se algo der errado, mostra o caminho do backup de segurança na tela.

Os anexos são **mesclados**, nunca apagados: um arquivo que existe hoje e
não existia no backup continua lá.

---

## Operação do dia a dia

Tudo abaixo é no PowerShell, como administrador.

**Reiniciar o sistema:**
```powershell
Restart-ScheduledTask -TaskName QualidadeSQE
```

**Ver o que o sistema registrou:**
```powershell
Get-Content C:\QualidadeSQE\logs\backend.log -Tail 100
```

**Acompanhar ao vivo** (útil quando alguém está reclamando agora):
```powershell
Get-Content C:\QualidadeSQE\logs\backend.log -Wait -Tail 20
```

**Trocar a porta 8080 por outra:** edite `PORT` em
`C:\QualidadeSQE\app\backend\.env`, rode `Restart-ScheduledTask -TaskName
QualidadeSQE`, e repita o passo 1 com `-Porta <nova>` para refazer a regra
do firewall.

---

## Atualizar o sistema para uma versão nova

Rode o passo 2 de novo. Ele reconhece que já existe instalação:
**não sorteia senha nova, não reescreve o `.env`, não apaga dado nenhum**
— só traz o código novo do GitHub e reconstrói.

```powershell
powershell -ExecutionPolicy Bypass -File C:\QualidadeSQE\app\deploy-servidor\2-instalar.ps1
Restart-ScheduledTask -TaskName QualidadeSQE
```

**Tire um backup antes.** É a rede de segurança para voltar atrás se a
versão nova não agradar.

Se alguém tiver mexido nos arquivos da pasta `app` à mão, o script
**avisa e não sobrescreve** — ele prefere parar a jogar fora trabalho de
outra pessoa.

Para saber qual versão está instalada:

```powershell
git -C C:\QualidadeSQE\app log -1 --format='%h %ad %s' --date=short
```

---

## Se alguém não consegue abrir o sistema

Na ordem, do mais comum para o mais raro:

1. **Só um computador não abre** → é rede/proxy daquela máquina, não é o
   servidor. Teste o mesmo endereço em outro micro.
2. **Ninguém da rede abre, mas no servidor funciona** → firewall. Rode o
   passo 1 de novo; ele refaz a regra da porta.
3. **Nem no servidor abre** → veja se a tarefa está `Running`
   (`Get-ScheduledTask -TaskName QualidadeSQE`). Se não estiver, rode
   `Start-ScheduledTask -TaskName QualidadeSQE` e olhe o
   `logs\backend.log`.
4. **Abre, mas dá "Cannot GET /"** → a pasta `backend\public` não existe
   ou está vazia: as telas não foram compiladas. Rode o passo 2 de novo.
5. **Abre a tela mas nada carrega** → o banco. Veja se o serviço
   `postgresql-x64-17` está rodando (`Get-Service postgresql-x64-17`).

---

## Onde fica o quê

```
C:\QualidadeSQE\
├── app\                      o código, clonado do GitHub
│   ├── backend\
│   │   ├── .env              senhas desta máquina — NAO versionar
│   │   ├── dist\             o sistema compilado
│   │   └── public\           as telas compiladas
│   └── deploy-servidor\      estes scripts
├── uploads\                  as fotos, certificados e laudos
├── backups\                  os .zip diários
├── logs\
│   ├── backend.log           o que o sistema escreveu
│   ├── backup.log            o que o backup fez
│   └── restauracao.log       o que a restauração fez
├── iniciar-sqe.ps1           o que a tarefa agendada executa
├── CREDENCIAIS.txt           senhas sorteadas no passo 1 — guardar no cofre
└── PRIMEIRO-ACESSO.txt       usuário e senha do primeiro login — apagar depois
```

| Arquivo | Para quê |
|---|---|
| `1-preparar-windows.ps1` | instala Node, Git e PostgreSQL; sorteia as senhas |
| `2-instalar.ps1` | baixa o código, cria o banco, monta o sistema |
| `3-ativar-inicio-automatico.ps1` | cria a tarefa que sobe tudo no boot |
| `iniciar-sqe.ps1` | sobe o sistema (é o que a tarefa executa) |
| `backup.ps1` | gera o .zip com banco + anexos |
| `restaurar.ps1` | volta o sistema para um backup |
| `comum.ps1` | as peças que os outros usam; não roda sozinho |

**Os dados que importam são dois:** o banco `qualidade` no PostgreSQL e a
pasta `C:\QualidadeSQE\uploads`. Todo o resto pode ser refeito rodando os
três passos.

---

## Por que existe o `comum.ps1`

Ele guarda as quatro coisas que todos os outros scripts precisam: ler o
`.env`, separar a `DATABASE_URL` em pedaços, achar o PostgreSQL e
consultar o banco. Está em arquivo separado por um motivo prático —
repetir isso em cinco scripts é repetir o erro em cinco scripts.

Duas armadilhas estão resolvidas lá dentro, e vale saber que existem antes
de alguém "simplificar" o código:

**A senha vem codificada para URL.** Na `DATABASE_URL`, um `@` na senha
aparece como `%40`. Sem desfazer isso, o `pg_dump` recebe a senha errada e
o backup falha de madrugada, quando ninguém está olhando.

**O PowerShell não preserva aspas duplas** ao chamar um programa externo.
Um `psql -c 'select count(*) from "Usuario"'` chega no psql como
`from Usuario`, sem aspas, e o PostgreSQL vai procurar `usuario` em
minúsculas — que não existe, porque o Prisma cria `Usuario` com U
maiúsculo. O sintoma é cruel: a consulta devolve "relação usuario não
existe" e quem lê o script jura que o banco está corrompido. Foi assim que
a conferência da restauração acusou um banco perfeito como inutilizável.
Por isso o SQL vai sempre em **arquivo** (`psql -f`), nunca em `psql -c`.
