-- Correcao do periodo de calibracao do inventario de instrumentos.
--
-- A planilha BDBR.QUA.FMR.004.01 traz "PERIODO (ANOS) = 1" nas 52 linhas, mas a
-- PROXIMA CALIBRACAO de todas elas e a data da calibracao + 730 dias. Quem manda
-- e a data do certificado: o periodo real e de 2 anos e o "1" da planilha esta
-- errado. A carga preservou o que estava no papel; aqui o numero e corrigido.
--
-- A proxima calibracao NAO muda: ja esta em +2 anos.
--
-- So mexe na linha que tem as duas marcas do erro (periodo 1 E proxima em +730
-- dias), entao rodar de novo nao faz efeito nem atropela quem ajustou a mao.
UPDATE "Instrumento"
SET "periodoAnos" = 2
WHERE "periodoAnos" = 1
  AND "dataCalibracao" IS NOT NULL
  AND "proximaCalibracao" IS NOT NULL
  AND "proximaCalibracao"::date = ("dataCalibracao"::date + INTERVAL '730 days')::date;
