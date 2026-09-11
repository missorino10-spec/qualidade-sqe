// Classificacao de fornecimento (A, B, C e D).
//
// A cor da etiqueta estava repetida em tres telas - cadastro, periodicidade e
// painel do SQE. Basta uma delas ficar para tras numa mudanca para o mesmo
// fornecedor aparecer verde numa tela e azul na outra.

export const corClasse: Record<string, string> = {
  A: 'green',
  B: 'blue',
  C: 'orange',
  D: 'red',
};

// O que cada classe significa no IDF - Indice de Desempenho do Fornecedor.
// A classe sai do IDF e e ela que define a periodicidade de inspecao.
export const ROTULO_CLASSE: Record<string, string> = {
  A: 'Estratégico',
  B: 'Aprovado',
  C: 'Em Atenção',
  D: 'Crítico',
};

// Acao que a classe dispara, do formulario de monitoramento de fornecedores.
export const ACAO_CLASSE: Record<string, string> = {
  A: 'Revisão semestral — manter parceria',
  B: 'Revisão trimestral — monitoramento padrão',
  C: 'Revisão mensal — plano de desenvolvimento obrigatório',
  D: 'Ação imediata — suspensão e auditoria',
};
