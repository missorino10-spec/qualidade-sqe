// ICAQ - Auditoria do Controle Autonomo da Qualidade.
// Espelho do "Checklist ICAQ": as dez verificacoes, as quatro dimensoes com
// seus pesos e a regra de ponderacao, na mesma ordem do formulario em papel.

export const DIMENSOES_ICAQ = [
  { nome: 'Execução correta da medição', peso: 0.5 },
  { nome: 'Confiabilidade do resultado', peso: 0.25 },
  { nome: 'Preenchimento do checklist', peso: 0.15 },
  { nome: 'Reação ao desvio', peso: 0.1 },
] as const;

export type DimensaoIcaq = (typeof DIMENSOES_ICAQ)[number]['nome'];

export type VerificacaoIcaq = {
  numero: number;
  dimensao: DimensaoIcaq;
  peso: number;
  verificacao: string;
};

// A ordem e a numeracao sao as da planilha - as dimensoes aparecem
// intercaladas de proposito, seguindo a sequencia da auditoria no chao de
// fabrica, e nao agrupadas por peso.
export const VERIFICACOES_ICAQ: VerificacaoIcaq[] = [
  {
    numero: 1,
    dimensao: 'Execução correta da medição',
    peso: 0.5,
    verificacao: 'Operador conhece a característica a ser controlada',
  },
  {
    numero: 2,
    dimensao: 'Execução correta da medição',
    peso: 0.5,
    verificacao: 'Utiliza o instrumento especificado',
  },
  {
    numero: 3,
    dimensao: 'Confiabilidade do resultado',
    peso: 0.25,
    verificacao: 'Instrumento está identificado e válido',
  },
  {
    numero: 4,
    dimensao: 'Execução correta da medição',
    peso: 0.5,
    verificacao: 'Medição é realizada conforme método definido',
  },
  {
    numero: 5,
    dimensao: 'Confiabilidade do resultado',
    peso: 0.25,
    verificacao: 'Resultado da Qualidade confirma a medição do operador',
  },
  {
    numero: 6,
    dimensao: 'Execução correta da medição',
    peso: 0.5,
    verificacao: 'Frequência de medição é respeitada',
  },
  {
    numero: 7,
    dimensao: 'Preenchimento do checklist',
    peso: 0.15,
    verificacao: 'Checklist está completo e legível',
  },
  {
    numero: 8,
    dimensao: 'Confiabilidade do resultado',
    peso: 0.25,
    verificacao: 'Registro corresponde ao valor efetivamente medido',
  },
  {
    numero: 9,
    dimensao: 'Reação ao desvio',
    peso: 0.1,
    verificacao: 'Desvio é identificado corretamente',
  },
  {
    numero: 10,
    dimensao: 'Reação ao desvio',
    peso: 0.1,
    verificacao: 'Reação prevista e executada corretamente',
  },
];

// Quantas verificacoes existem em cada dimensao. E o COUNTIF da formula da
// planilha: o peso da dimensao se divide igualmente entre as perguntas dela,
// entao acrescentar uma pergunta redistribui sozinho.
export function perguntasPorDimensao(dimensao: string): number {
  return VERIFICACOES_ICAQ.filter((v) => v.dimensao === dimensao).length;
}

// Pontos de uma linha: peso da dimensao dividido pelo numero de perguntas
// dela, e so quando Conforme. Nao conforme vale zero - a planilha nao preve
// "nao aplicavel".
export function pontosDaLinha(dimensao: string, resultado: string): number {
  if (resultado !== 'CONFORME') return 0;
  const quantas = perguntasPorDimensao(dimensao);
  if (!quantas) return 0;
  const dim = DIMENSOES_ICAQ.find((d) => d.nome === dimensao);
  if (!dim) return 0;
  return dim.peso / quantas;
}

export type ClassificacaoIcaqTexto = 'CONFORME' | 'ATENCAO' | 'NAO_CONFORME';

// 90% a 100% Conforme | 80% a 89,99% Atencao | abaixo de 80% Nao conforme.
export function classificarIcaq(nota: number): ClassificacaoIcaqTexto {
  if (nota >= 90) return 'CONFORME';
  if (nota >= 80) return 'ATENCAO';
  return 'NAO_CONFORME';
}

// Monta as dez linhas a partir das respostas da tela, ja com os pontos, e
// devolve a nota de 0 a 100 e a classificacao.
//
// A dimensao, o peso e o texto da verificacao saem daqui e sao gravados na
// linha: se o formulario for revisado amanha, as auditorias antigas continuam
// contando a historia que elas contavam.
export function montarItensIcaq(respostas: any[]) {
  const porNumero = new Map<number, any>();
  for (const r of respostas ?? []) porNumero.set(Number(r?.numero), r);

  const itens = VERIFICACOES_ICAQ.map((v) => {
    const r = porNumero.get(v.numero) ?? {};
    const resultado = r.resultado === 'CONFORME' ? 'CONFORME' : 'NAO_CONFORME';
    return {
      numero: v.numero,
      dimensao: v.dimensao,
      peso: v.peso,
      verificacao: v.verificacao,
      resultado: resultado as 'CONFORME' | 'NAO_CONFORME',
      pontos: pontosDaLinha(v.dimensao, resultado),
      evidencia: String(r.evidencia ?? '').trim() || null,
      responsavel: String(r.responsavel ?? '').trim() || null,
    };
  });

  const soma = itens.reduce((t, i) => t + i.pontos, 0);
  // Duas casas ja no arredondamento: a soma de fracoes como 0,25/3 nunca fecha
  // exatamente em 100 em ponto flutuante.
  const nota = Math.round(soma * 100 * 100) / 100;

  return { itens, nota, classificacao: classificarIcaq(nota) };
}

export const TURNOS_ICAQ = [
  { valor: 'PRIMEIRO_TURNO', rotulo: '1º turno' },
  { valor: 'SEGUNDO_TURNO', rotulo: '2º turno' },
  { valor: 'TERCEIRO_TURNO', rotulo: '3º turno' },
  { valor: 'COMERCIAL', rotulo: 'Comercial' },
] as const;

export function rotuloTurnoIcaq(valor?: string | null): string {
  return TURNOS_ICAQ.find((t) => t.valor === valor)?.rotulo ?? '-';
}

export function rotuloClassificacaoIcaq(valor?: string | null): string {
  if (valor === 'CONFORME') return 'Conforme';
  if (valor === 'ATENCAO') return 'Atenção';
  if (valor === 'NAO_CONFORME') return 'Não conforme';
  return '-';
}
