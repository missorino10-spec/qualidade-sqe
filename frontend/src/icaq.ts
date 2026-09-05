// ICAQ - Auditoria do Controle Autonomo da Qualidade.
//
// Os textos das dez verificacoes NAO moram aqui: eles vem do backend por
// GET /manufatura/controle-autonomo/modelo, para o formulario existir num
// lugar so. O que fica neste arquivo e o que a tela precisa saber por conta
// propria: rotulos, cores e a mesma conta de pontos que o servidor faz, para
// a nota aparecer enquanto a pessoa marca as linhas.
//
// ESPELHO de backend/src/manufatura/controle-autonomo/icaq-utils.ts.

import { TAG } from './design/tokens';

export type VerificacaoIcaq = {
  numero: number;
  dimensao: string;
  peso: number;
  verificacao: string;
};

// Foto de evidencia de uma linha do checklist. O anexo aponta para o id da
// LINHA (ItemControleAutonomo), nao para a auditoria.
// ESPELHO de backend/src/comum/icaq.ts.
export const FOTO_ICAQ = 'ICAQ_FOTO';

export const MAX_FOTOS_ICAQ = 4;

export const TURNOS_ICAQ = [
  { value: 'PRIMEIRO_TURNO', label: '1º turno' },
  { value: 'SEGUNDO_TURNO', label: '2º turno' },
  { value: 'TERCEIRO_TURNO', label: '3º turno' },
  { value: 'COMERCIAL', label: 'Comercial' },
];

export function rotuloTurnoIcaq(valor?: string | null): string {
  return TURNOS_ICAQ.find((t) => t.value === valor)?.label ?? '-';
}

export const labelClassificacaoIcaq: Record<string, string> = {
  CONFORME: 'Conforme',
  ATENCAO: 'Atenção',
  NAO_CONFORME: 'Não conforme',
};

export const corClassificacaoIcaq: Record<string, string> = {
  CONFORME: TAG.sucesso,
  ATENCAO: TAG.pendencia,
  NAO_CONFORME: TAG.critico,
};

// Pontos de uma linha: o peso da dimensao dividido pelo numero de perguntas
// dela, e so quando Conforme. E o COUNTIF da formula da planilha.
export function pontosDaLinha(
  modelo: VerificacaoIcaq[],
  dimensao: string,
  resultado?: string,
): number {
  if (resultado !== 'CONFORME') return 0;
  const linhas = modelo.filter((v) => v.dimensao === dimensao);
  if (!linhas.length) return 0;
  return linhas[0].peso / linhas.length;
}

// 90% a 100% Conforme | 80% a 89,99% Atencao | abaixo de 80% Nao conforme.
export function classificarIcaq(nota: number): string {
  if (nota >= 90) return 'CONFORME';
  if (nota >= 80) return 'ATENCAO';
  return 'NAO_CONFORME';
}

// Nota de 0 a 100 a partir do que esta marcado na tela. Duas casas ja no
// arredondamento: a soma de fracoes como 0,25/3 nunca fecha exatamente em 100
// em ponto flutuante.
export function notaIcaq(
  modelo: VerificacaoIcaq[],
  respostas: Record<number, { resultado?: string }>,
): number {
  const soma = modelo.reduce(
    (t, v) => t + pontosDaLinha(modelo, v.dimensao, respostas[v.numero]?.resultado),
    0,
  );
  return Math.round(soma * 100 * 100) / 100;
}
