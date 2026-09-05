// R.O — Gestao de Reclamacoes da Qualidade.
// Espelho de backend/src/comum/ro.ts. As listas suspensas em si vem do
// servidor (GET /ro/reclamacoes/listas): aqui ficam so os rotulos e as cores
// que a lista e o formulario precisam ter em maos.

import { TAG } from './design/tokens';

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

// A escala de cores e a mesma do sistema inteiro (design/tokens): cada estagio
// da reclamacao entra em uma das seis faixas, em vez de escolher a sua propria
// cor. Quem ve "Em andamento" aqui ve o mesmo azul que ve no 8D e na RNC.
export const COR_STATUS_RO: Record<string, string> = {
  RECEBIDA_SAC: TAG.neutro,
  EM_TRIAGEM: TAG.andamento,
  AGUARDANDO_SAC: TAG.pendencia,
  DIRECIONADA: TAG.andamento,
  CONTENCAO: TAG.andamento,
  INVESTIGACAO: TAG.andamento,
  ACOES_CORRETIVAS: TAG.andamento,
  AGUARDANDO_EFICACIA: TAG.pendencia,
  RETORNO_SAC: TAG.andamento,
  ENCERRADA: TAG.sucesso,
  REABERTA: TAG.critico,
  NAO_ACEITA: TAG.neutro,
};

export const COR_STATUS_ACAO_RO: Record<string, string> = {
  NAO_INICIADA: TAG.neutro,
  EM_ANDAMENTO: TAG.andamento,
  CONCLUIDA: TAG.sucesso,
  ATRASADA: TAG.critico,
  CANCELADA: TAG.neutro,
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
