-- R.O - Gestao de Reclamacoes da Qualidade: tabelas.

CREATE TABLE IF NOT EXISTS "Reclamacao" (
  "id"                  SERIAL PRIMARY KEY,
  "numero"              TEXT NOT NULL,
  "ano"                 INTEGER NOT NULL,
  "sequencial"          INTEGER NOT NULL,

  -- 1. Dados recebidos da Sala de Controle
  "cliente"             TEXT,
  "produtoCodigo"       TEXT,
  "produtoDescricao"    TEXT,
  "quantidadeAfetada"   DOUBLE PRECISION,
  "valorUnitario"       DOUBLE PRECISION,
  "tipoInformado"       TEXT,
  "resultadoAnaliseSac" TEXT,
  "origemIndicada"      TEXT,
  "recebidoEm"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- 2. Triagem e direcionamento da Qualidade
  "dadosCompletos"      "CompletudeSacRo",
  "aceita"              "AceiteRo",
  "classificacao"       "ClassificacaoRo",
  "procedencia"         "ProcedenciaRo",
  "prioridade"          "PrioridadeRo",
  "areaResponsavel"     "AreaResponsavelRo",
  "responsavelId"       INTEGER,
  "prazoConclusao"      TIMESTAMP(3),
  "pendenciasSac"       TEXT,
  "custoTotal"          DOUBLE PRECISION,

  -- 3. Tratativa interna
  "necessidadeContencao" "SimNaoRo",
  "metodoAnalise"        "MetodoAnaliseRo",
  "causaImediata"        TEXT,
  "causaSistemica"       TEXT,
  "statusAcoes"          "StatusAcaoRo",
  "verificacaoEficacia"  "EficaciaRo",
  "evidencias"           TEXT,

  -- 4. Retorno ao SAC e encerramento
  "resumoConclusao"    TEXT,
  "dataRetornoSac"     TIMESTAMP(3),
  "motivoEncerramento" "MotivoEncerramentoRo",
  "status"             "StatusRo" NOT NULL DEFAULT 'RECEBIDA_SAC',

  "criadoPorId" INTEGER,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Reclamacao_responsavelId_fkey"
    FOREIGN KEY ("responsavelId") REFERENCES "Usuario"("id") ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT "Reclamacao_criadoPorId_fkey"
    FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "Reclamacao_numero_key" ON "Reclamacao"("numero");
CREATE UNIQUE INDEX IF NOT EXISTS "Reclamacao_ano_sequencial_key" ON "Reclamacao"("ano", "sequencial");
CREATE INDEX IF NOT EXISTS "Reclamacao_recebidoEm_idx" ON "Reclamacao"("recebidoEm");
CREATE INDEX IF NOT EXISTS "Reclamacao_status_idx" ON "Reclamacao"("status");

CREATE TABLE IF NOT EXISTS "TarefaReclamacao" (
  "id"           SERIAL PRIMARY KEY,
  "reclamacaoId" INTEGER NOT NULL,
  "tipo"         "TipoTarefaRo" NOT NULL,
  "ordem"        INTEGER NOT NULL,
  "descricao"    TEXT NOT NULL,
  "responsavel"  TEXT,
  "prazo"        TIMESTAMP(3),
  "status"       "StatusAcaoRo" NOT NULL DEFAULT 'NAO_INICIADA',
  CONSTRAINT "TarefaReclamacao_reclamacaoId_fkey"
    FOREIGN KEY ("reclamacaoId") REFERENCES "Reclamacao"("id") ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "TarefaReclamacao_reclamacaoId_tipo_idx"
  ON "TarefaReclamacao"("reclamacaoId", "tipo");

CREATE TABLE IF NOT EXISTS "BlocoReclamacao" (
  "id"             SERIAL PRIMARY KEY,
  "reclamacaoId"   INTEGER NOT NULL,
  "numero"         INTEGER NOT NULL,
  "concluidoEm"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "concluidoPorId" INTEGER,
  CONSTRAINT "BlocoReclamacao_reclamacaoId_fkey"
    FOREIGN KEY ("reclamacaoId") REFERENCES "Reclamacao"("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "BlocoReclamacao_concluidoPorId_fkey"
    FOREIGN KEY ("concluidoPorId") REFERENCES "Usuario"("id") ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "BlocoReclamacao_reclamacaoId_numero_key"
  ON "BlocoReclamacao"("reclamacaoId", "numero");
