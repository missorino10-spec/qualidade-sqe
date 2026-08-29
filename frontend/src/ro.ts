// R.O — Gestao de Reclamacoes da Qualidade.
// Espelho de backend/src/comum/ro.ts. As listas suspensas em si vem do
// servidor (GET /ro/reclamacoes/listas): aqui ficam so os rotulos e as cores
// que a lista e o formulario precisam ter em maos.

export const DOC_RO = 'RO_DOCUMENTO';
export const FOTO_RO = 'RO_FOTO';

export type OpcaoRo = { value: string; label: string };

export type ListasRo = {
  dadosCompletos: OpcaoRo[];
  aceita: OpcaoRo[];
  classificacao: OpcaoRo[];
  procedencia: OpcaoRo[];
  prioridade: OpcaoRo[];
  areaResponsavel: OpcaoRo[];
  necessidadeContencao: OpcaoRo[];
  metodoAnalise: OpcaoRo[];
  statusAcao: OpcaoRo[];
  verificacaoEficacia: OpcaoRo[];
  motivoEncerramento: OpcaoRo[];
  status: OpcaoRo[];
};

export const LISTAS_VAZIAS: ListasRo = {
  dadosCompletos: [],
  aceita: [],
  classificacao: [],
  procedencia: [],
  prioridade: [],
  areaResponsavel: [],
  necessidadeContencao: [],
  metodoAnalise: [],
  statusAcao: [],
  verificacaoEficacia: [],
  motivoEncerramento: [],
  status: [],
};

export function rotuloDe(opcoes: OpcaoRo[], valor?: string | null): string {
  if (!valor) return '-';
  return opcoes.find((o) => o.value === valor)?.label ?? valor;
}

export const COR_PRIORIDADE_RO: Record<string, string> = {
  CRITICA: 'red',
  ALTA: 'volcano',
  MEDIA: 'gold',
  BAIXA: 'blue',
};

export const COR_STATUS_RO: Record<string, string> = {
  RECEBIDA_SAC: 'default',
  EM_TRIAGEM: 'processing',
  AGUARDANDO_SAC: 'orange',
  DIRECIONADA: 'processing',
  CONTENCAO: 'volcano',
  INVESTIGACAO: 'processing',
  ACOES_CORRETIVAS: 'processing',
  AGUARDANDO_EFICACIA: 'gold',
  RETORNO_SAC: 'cyan',
  ENCERRADA: 'green',
  REABERTA: 'red',
  NAO_ACEITA: 'default',
};

export const COR_STATUS_ACAO_RO: Record<string, string> = {
  NAO_INICIADA: 'default',
  EM_ANDAMENTO: 'processing',
  CONCLUIDA: 'green',
  ATRASADA: 'red',
  CANCELADA: 'default',
};

// Os quatro blocos da planilha, na ordem. O bloco de Anexos nao entra: ele nao
// tem flag de concluido.
export const BLOCOS_RO: { numero: number; titulo: string }[] = [
  { numero: 1, titulo: '1. Dados recebidos' },
  { numero: 2, titulo: '2. Triagem e direcionamento da Qualidade' },
  { numero: 3, titulo: '3. Tratativa interna' },
  { numero: 4, titulo: '4. Retorno ao SAC e encerramento' },
];

export type TarefaRo = {
  chave: string;
  tipo: 'CONTENCAO' | 'ACAO_CORRETIVA';
  descricao?: string;
  responsavel?: string;
  prazo?: string;
  status?: string;
};
