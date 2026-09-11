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
  | '5G'
  | 'ICAQ';

// Numeracao dos documentos da manufatura, no mesmo padrao do SQE:
// SET0001/2026, PROD0001/2026, SETV0001/2026, PRODV0001/2026, CNQ0001/2026,
// 8D0001/2026, 5G0001/2026, ICAQ0001/2026.
export function numeroManufatura(
  prefixo: PrefixoManufatura,
  sequencial: number,
  ano: number,
): string {
  return `${prefixo}${String(sequencial).padStart(4, '0')}/${ano}`;
}

// ---------------------------------------------------------------------------
// 8D e 5G: os dois saem da mesma tela e da mesma lista, entao o relatorio dos
// dois tem as mesmas colunas. O que muda e so o titulo.
// ---------------------------------------------------------------------------
export const ROTULO_ORIGEM_DOC: Record<string, string> = {
  RELATORIO_RO: 'Relatório R.O',
  PRODUCAO: 'Produção',
  INSPECAO_EXTRA: 'Inspeção extra',
  SETUP: 'Setup',
  RNC: 'RNC',
  OUTROS: 'Outros',
};

export const ROTULO_STATUS_DOC: Record<string, string> = {
  AGUARDANDO: 'Aguardando',
  EM_ANDAMENTO: 'Em andamento',
  CONCLUIDO: 'Concluído',
};

// "Outros" sozinho nao diz de onde veio o problema: o que sai e o texto
// digitado, como na tela.
export function textoOrigemDoc(reg: any): string {
  if (reg?.origem === 'OUTROS' && reg?.origemOutros) return reg.origemOutros;
  return ROTULO_ORIGEM_DOC[reg?.origem] ?? '';
}

export function colunasDocumentoManufatura() {
  return [
    { titulo: 'Número', peso: 52, valor: (r: any) => r.numero },
    {
      titulo: 'Abertura',
      peso: 44,
      valor: (r: any) => r.dataAbertura,
      tipo: 'data' as const,
    },
    { titulo: 'Produto / item', peso: 120, valor: (r: any) => r.produtoItem },
    { titulo: 'Origem', peso: 70, valor: (r: any) => textoOrigemDoc(r) },
    {
      titulo: 'Documento',
      peso: 70,
      valor: (r: any) => r.documentoReferencia,
    },
    {
      titulo: 'Vínculo',
      peso: 62,
      valor: (r: any) => r.inspecao?.numero ?? r.cnq?.numero,
    },
    { titulo: 'Responsável', peso: 80, valor: (r: any) => r.responsavel },
    { titulo: 'Problema', peso: 140, valor: (r: any) => r.descricaoProblema },
    {
      titulo: 'Status',
      peso: 56,
      valor: (r: any) => ROTULO_STATUS_DOC[r.status] ?? r.status,
      negrito: true,
    },
  ];
}

export function totaisDocumentoManufatura(linhas: any[], rotulo: string) {
  return [
    { rotulo, valor: String(linhas.length) },
    {
      rotulo: 'Concluídos',
      valor: String(linhas.filter((r) => r.status === 'CONCLUIDO').length),
    },
    {
      rotulo: 'Em aberto',
      valor: String(linhas.filter((r) => r.status !== 'CONCLUIDO').length),
    },
  ];
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
