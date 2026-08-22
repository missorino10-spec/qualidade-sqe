// Utilitarios do modulo MANUFATURA.
// A semana e o trimestre fiscal sao os mesmos do SQE (regra da empresa),
// entao reaproveitamos de sqe-utils em vez de duplicar a regra.

// SETV/PRODV sao a inspecao VISUAL: serie propria, separada da do dimensional,
// para que cada documento tenha a sua sequencia continua.
export type PrefixoManufatura =
  | 'SET'
  | 'PROD'
  | 'SETV'
  | 'PRODV'
  | 'CNQ'
  | '8D'
  | '5G';

// Numeracao dos documentos da manufatura, no mesmo padrao do SQE:
// SET0001/2026, PROD0001/2026, SETV0001/2026, PRODV0001/2026, CNQ0001/2026,
// 8D0001/2026, 5G0001/2026.
export function numeroManufatura(
  prefixo: PrefixoManufatura,
  sequencial: number,
  ano: number,
): string {
  return `${prefixo}${String(sequencial).padStart(4, '0')}/${ano}`;
}

// PPM = pecas com defeito por milhao de pecas produzidas.
// E o indicador que a planilha usa em todas as abas de maquina.
export function calcularPpm(produzidas: number, comDefeito: number): number {
  if (!produzidas) return 0;
  return Math.round((comDefeito / produzidas) * 1_000_000);
}

// O resultado "aprovado com observacao" conta como aprovado nos indicadores:
// o item foi liberado, apenas com uma ressalva registrada.
export function contaComoAprovado(resultado: string): boolean {
  return resultado === 'APROVADO' || resultado === 'APROVADO_COM_OBSERVACAO';
}

// Status da inspecao-mae a partir do resultado da ULTIMA tentativa: enquanto a
// ultima estiver reprovada a inspecao segue PENDENTE, esperando reinspecao.
export function statusPorResultado(resultado: string) {
  if (resultado === 'REPROVADO') return 'PENDENTE' as const;
  if (resultado === 'APROVADO_COM_OBSERVACAO')
    return 'APROVADA_COM_OBSERVACAO' as const;
  return 'APROVADA' as const;
}
