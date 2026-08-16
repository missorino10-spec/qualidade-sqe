// Catalogos e prazos proprios da HOMOLOGACAO DE ITENS (SQD).
//
// Fonte: BDBR.QUA.FMR.025.01 (Registro de Homologacao de Itens).
// O checklist visual, as tabelas de tolerancia e o motor de calculo das cotas
// sao comuns aos tres modulos e ficam em src/comum/inspecao.ts.

// Lista de validacao da coluna "Ação" (aba "Base de Dados", C1:C7). Sao 7
// itens, diferentes dos 5 da homologacao de fornecedores. No banco fica o
// codigo, para a redacao poder mudar sem mexer nos registros.
export const ACOES_HOMOLOGACAO_ITEM: Record<string, string> = {
  FORNECEDOR_NOTIFICADO_REPROVA:
    'Fornecedor notificado sobre a reprova; Aguardando retorno.',
  AGUARDANDO_NOVAS_AMOSTRAS: 'Aguardando envio de novas amostras.',
  ACAO_INTERNA_NECESSARIA:
    'Ação interna necessária; Aguardando retorno do setor responsável.',
  AGUARDANDO_DOCUMENTOS: 'Aguardando envio dos documentos para análise.',
  RELATORIO_SUBMETIDO_ENGENHARIA:
    'Relatório submetido à engenharia; Aguardando definição.',
  RELATORIO_SUBMETIDO_COMPRAS:
    'Relatório submetido à compras; Aguardando definição.',
  FORNECEDOR_NOTIFICADO_APROVACAO:
    'Fornecedor notificado sobre aprovação e que pode seguir com a fabricação do lote.',
};

export const CODIGOS_ACAO_ITEM = Object.keys(ACOES_HOMOLOGACAO_ITEM);

// Prazos da aba "KPI's" do FMR.025.01: 3 dias uteis, os mesmos do modulo de
// fornecedores.
export const SLA_HOMOLOGACAO_ITEM_DIAS = 3;
export const SLA_RESPOSTA_FORNECEDOR_ITEM_DIAS = 3;
