// Rotulos e cores compartilhados pelas telas do SQD.
// As opcoes vieram das listas de validacao do BDBR.QUA.FMR.029.01
// (abas "2026" e "Base de Dados").

import { dataBR } from '../../formatos';

export const labelResultado: Record<string, string> = {
  APROVADO: 'Aprovado',
  APROVADO_CONDICIONALMENTE: 'Aprovado Condicionalmente',
  REPROVADO: 'Reprovado',
};
export const corResultado: Record<string, string> = {
  APROVADO: 'green',
  APROVADO_CONDICIONALMENTE: 'orange',
  REPROVADO: 'red',
};

export const labelStatusHomologacao: Record<string, string> = {
  EM_ANDAMENTO: 'Em andamento',
  FINALIZADO: 'Finalizado',
  CANCELADO: 'Cancelado',
};
export const corStatusHomologacao: Record<string, string> = {
  EM_ANDAMENTO: 'blue',
  FINALIZADO: 'green',
  CANCELADO: 'default',
};

export const labelStatusPlanoAcao: Record<string, string> = {
  EM_ANDAMENTO: 'Em andamento',
  FINALIZADO: 'Finalizado',
  CANCELADO: 'Cancelado',
  NAO_APLICAVEL: 'Não aplicável',
};

export const labelEfetividade: Record<string, string> = {
  NAO_APLICAVEL_CANCELADO: 'Não aplicável / Cancelado',
  NAO_IMPLEMENTADO_ATRASADO: 'Não implementado / Atrasado',
  EFETIVO: 'Efetivo',
  PARCIALMENTE_EFETIVO: 'Parcialmente efetivo',
  INEFICAZ: 'Ineficaz',
};

export const labelSolicitante: Record<string, string> = {
  COMPRAS: 'Compras',
  ENGENHARIA: 'Engenharia',
  NC: 'N/C',
};

// Lista de validacao da coluna "Ação" do FMR.029.01 (mesmos codigos do backend,
// em sqd-utils.ts). No banco fica o codigo; aqui, o texto da planilha.
export const labelAcao: Record<string, string> = {
  FORNECEDOR_NOTIFICADO_DECISAO:
    'Fornecedor notificado sobre decisão; Aguardando retorno.',
  FORNECEDOR_NOTIFICADO_APROVACAO: 'Fornecedor notificado sobre aprovação.',
  ACAO_INTERNA_NECESSARIA:
    'Ação interna necessária; Aguardando retorno do setor responsável.',
  AGUARDANDO_DOCUMENTOS: 'Aguardando envio dos documentos para análise.',
  RELATORIO_SUBMETIDO_COMPRAS:
    'Relatório submetido a compras; Aguardando definição.',
};

export const labelResposta: Record<string, string> = {
  SIM: 'Sim',
  NAO: 'Não',
  NA: 'N/A',
};

// ---------------------------------------------------------------------------
// Homologacao de Itens (BDBR.QUA.FMR.025.01). Aqui nao ha nota nem faixa: o
// item e homologado pelo relatorio de inspecao (abas Amostra e Visual).

export const labelResultadoItem: Record<string, string> = {
  APROVADO: 'Aprovado',
  REPROVADO: 'Reprovado',
  CANCELADO: 'Cancelado',
};
export const corResultadoItem: Record<string, string> = {
  APROVADO: 'green',
  REPROVADO: 'red',
  CANCELADO: 'default',
};

export const labelMotivoItem: Record<string, string> = {
  PRIMEIRO_FORNECIMENTO: 'Primeiro fornecimento',
  ALTERACAO_MATERIAL: 'Alteração de material',
  ALTERACAO_PROCESSO: 'Alteração de processo',
};

// Mesma lista do fornecedor, mais "Fornecedor" — que so aparece no FMR.025.01.
export const labelSolicitanteItem: Record<string, string> = {
  COMPRAS: 'Compras',
  ENGENHARIA: 'Engenharia',
  NC: 'N/C',
  FORNECEDOR: 'Fornecedor',
};

// Lista de validacao da coluna "Ação" do FMR.025.01 (aba "Base de Dados").
export const labelAcaoItem: Record<string, string> = {
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

export const labelStatusVisual: Record<string, string> = {
  APROVADO: 'Aprovado',
  REPROVADO: 'Reprovado',
  NAO_APLICAVEL: 'N/A',
};
export const corStatusVisual: Record<string, string> = {
  APROVADO: 'green',
  REPROVADO: 'red',
  NAO_APLICAVEL: 'default',
};

export const labelOrigemInspecao: Record<string, string> = {
  PLANO_INSPECAO: 'Plano de Inspeção',
  HOMOLOGACAO: 'Homologação',
  DEVOLUCAO: 'Devolução',
  RETRABALHO: 'Retrabalho',
  RELATORIO_OCORRENCIA: 'Relatório de Ocorrência',
  LIBERACAO_SETUP: 'Liberação de Setup',
  OUTROS: 'Outros',
};

// ---------------------------------------------------------------------------
// Auditoria de Fornecedores (planilha "Checklist Auditoria").
// A nota tem as mesmas faixas da homologacao de fornecedores; o que muda e o
// que acontece depois: reprovado e condicional caem no loop de reavaliacao.

export const labelResultadoAuditoria: Record<string, string> = {
  APROVADO: 'Aprovado',
  APROVADO_CONDICIONALMENTE: 'Aprovado Condicionalmente',
  REPROVADO: 'Reprovado',
  CANCELADO: 'Cancelado',
};
export const corResultadoAuditoria: Record<string, string> = {
  APROVADO: 'green',
  APROVADO_CONDICIONALMENTE: 'orange',
  REPROVADO: 'red',
  CANCELADO: 'default',
};

export const labelStatusAuditoria: Record<string, string> = {
  EM_ANDAMENTO: 'Em andamento',
  FINALIZADO: 'Finalizado',
  CANCELADO: 'Cancelado',
};
export const corStatusAuditoria: Record<string, string> = {
  EM_ANDAMENTO: 'blue',
  FINALIZADO: 'green',
  CANCELADO: 'default',
};

// Legenda da aba "Resumo": Sim = 1,0 · Parcial = 0,5 · Não = 0,0 · N/A fora.
export const labelRespostaAuditoria: Record<string, string> = {
  SIM: 'Sim',
  PARCIAL: 'Parcial',
  NAO: 'Não',
  NAO_APLICAVEL: 'N/A',
};
export const corRespostaAuditoria: Record<string, string> = {
  SIM: 'green',
  PARCIAL: 'orange',
  NAO: 'red',
  NAO_APLICAVEL: 'default',
};

// Regua por bloco da aba "Resumo", com o vocabulario do relatorio de auditoria.
export const labelClassificacaoBloco: Record<string, string> = {
  SATISFATORIO: 'Satisfatório',
  ATENCAO: 'Atenção',
  CRITICO: 'Crítico',
};
export const corClassificacaoBloco: Record<string, string> = {
  SATISFATORIO: 'green',
  ATENCAO: 'orange',
  CRITICO: 'red',
};

// Semaforo do prazo de reavaliacao (dias corridos): amarelo nos ultimos 15.
export const corSemaforoReavaliacao: Record<string, string> = {
  VERDE: 'green',
  AMARELO: 'gold',
  VERMELHO: 'red',
};

// Leitura do prazo do jeito que a Qualidade lê: "Reavaliar até 07/11/2026 ·
// faltam 30 dias".
export function textoReavaliacao(r: any): string {
  if (!r) return '-';
  const limite = dataBR(r.dataLimite);
  if (r.diasRestantes < 0) {
    return `Reavaliar até ${limite} · vencida há ${Math.abs(r.diasRestantes)} dia${Math.abs(r.diasRestantes) === 1 ? '' : 's'}`;
  }
  if (r.diasRestantes === 0) return `Reavaliar até ${limite} · vence hoje`;
  return `Reavaliar até ${limite} · faltam ${r.diasRestantes} dia${r.diasRestantes === 1 ? '' : 's'}`;
}

export function opcoes(mapa: Record<string, string>) {
  return Object.entries(mapa).map(([value, label]) => ({ value, label }));
}

// Nota com uma casa decimal no padrao brasileiro: 87,5
export function nota(v?: number | null): string {
  return v == null ? '-' : Number(v).toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}
