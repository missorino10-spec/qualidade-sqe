// Rotulos e cores compartilhados pelas telas do SQD.
// As opcoes vieram das listas de validacao do BDBR.QUA.FMR.029.01
// (abas "2026" e "Base de Dados").

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

export const labelResposta: Record<string, string> = {
  SIM: 'Sim',
  NAO: 'Não',
  NA: 'N/A',
};

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
