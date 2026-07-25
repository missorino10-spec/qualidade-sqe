========================================================================
 COMO GERAR A BUILD A (pacote portatil) - para VOCE (desenvolvedor)
========================================================================

Este passo roda AQUI, no PC de desenvolvimento (Windows, com internet).
O resultado e uma pasta pronta para entregar ao TI da empresa.

PASSO A PASSO:
  1) De 2 cliques em  montar-build-a.bat
     (ou rode: powershell -ExecutionPolicy Bypass -File montar-build-a.ps1)

  2) Aguarde. O script:
       - baixa o Node.js portatil e o PostgreSQL portatil (~300 MB, 1a vez)
       - compila o backend e o frontend
       - monta tudo na pasta:  deploy-portatil\Qualidade-SQE\

  3) Pronto. Entregue a pasta  Qualidade-SQE  ao TI
     (pode zipar antes). Dentro dela ja vao os arquivos:
       INSTALAR.bat, start.bat, parar.bat, backup.bat, LEIA-ME-TI.txt

OBSERVACOES:
  - Os downloads ficam em cache na pasta "_cache" (nao precisa baixar de novo).
  - As pastas "_cache" e "Qualidade-SQE" sao geradas - nao precisa versionar.
  - Para atualizar o sistema no futuro: rode montar-build-a.bat de novo e
    entregue a pasta Qualidade-SQE atualizada (os dados do servidor, na
    pasta "dados", nao sao afetados por uma nova entrega dos programas).

CONTEUDO DA BUILD A:
  Qualidade-SQE\
    node\      -> Node.js portatil (roda sem instalar)
    pgsql\     -> PostgreSQL portatil (roda sem instalar)
    app\       -> sistema compilado (backend + telas em app\public)
    dados\     -> banco de dados (criado no 1o start, no servidor)
    uploads\   -> anexos (fotos de RNC etc.)
    backups\   -> backups automaticos diarios
    logs\      -> logs de execucao
    config\    -> porta escolhida, chave JWT (gerados no servidor)
    INSTALAR.bat / start.bat / parar.bat / backup.bat / LEIA-ME-TI.txt
========================================================================
