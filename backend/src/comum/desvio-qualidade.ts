// DESVIO DE QUALIDADE
//
// E a concessao: o material fica liberado fora do especificado, mas dentro de
// um limite acordado. O limite pode ser uma QUANTIDADE de pecas, um PRAZO, ou
// os dois - quem decide e o usuario, e ao menos um dos dois e obrigatorio,
// porque e ele que faz o desvio ter fim.
//
// O documento que autoriza (a concessao assinada) e obrigatorio: sem anexo o
// desvio nao abre. Ele vive na tabela Anexo, com o entidadeTipo abaixo.
//
// As mesmas regras valem na RNC (SQE) e no Registro de Homologacao de Item
// (SQD), entao ficam aqui e nao em cada servico.

import { BadRequestException } from '@nestjs/common';

export const DESVIO = {
  rnc: 'RNC_DESVIO',
  homologacaoItem: 'HOMOLOGACAO_ITEM_DESVIO',
} as const;

export type AbrirDesvioDados = {
  aberturaEm?: string;
  quantidade?: number;
  prazoFim?: string;
  descricao?: string;
};

export type EncerrarDesvioDados = {
  encerradoEm?: string;
  observacoes?: string;
};

type ContadorDeAnexos = {
  anexo: { count(args: any): Promise<number> };
};

// Campos gravados na abertura. O registro nasce sem encerramento, entao os
// dois campos de fecho sao zerados aqui tambem (reabrir um desvio encerrado e
// abrir um desvio novo).
export async function dadosAberturaDesvio(
  prisma: ContadorDeAnexos,
  entidadeTipo: string,
  entidadeId: number,
  dados: AbrirDesvioDados,
) {
  const quantidade = dados.quantidade ?? null;
  const prazoFim = dados.prazoFim ? new Date(dados.prazoFim) : null;

  if (!dados.aberturaEm)
    throw new BadRequestException('Informe a data de abertura do desvio.');
  if (quantidade == null && !prazoFim)
    throw new BadRequestException(
      'Informe a quantidade de pecas, o prazo do desvio, ou os dois.',
    );
  if (quantidade != null && quantidade <= 0)
    throw new BadRequestException(
      'A quantidade de pecas do desvio deve ser maior que zero.',
    );

  const documentos = await prisma.anexo.count({
    where: { entidadeTipo, entidadeId },
  });
  if (!documentos)
    throw new BadRequestException(
      'Anexe o documento que autoriza o desvio antes de abri-lo.',
    );

  return {
    desvioQualidade: true,
    desvioAberturaEm: new Date(dados.aberturaEm),
    desvioQuantidade: quantidade,
    desvioPrazoFim: prazoFim,
    desvioDescricao: dados.descricao?.trim() || null,
    desvioEncerradoEm: null,
    desvioEncerramentoObs: null,
  };
}

// Campos gravados no encerramento. Como no encerramento da RNC, a data que
// vale e a que o usuario informa, e nao a hora do salvamento.
export function dadosEncerramentoDesvio(
  atual: { desvioQualidade: boolean; desvioEncerradoEm: Date | null },
  dados: EncerrarDesvioDados,
) {
  if (!atual.desvioQualidade)
    throw new BadRequestException('Nao ha desvio de qualidade aberto.');
  if (atual.desvioEncerradoEm)
    throw new BadRequestException('O desvio de qualidade ja foi encerrado.');
  if (!dados.encerradoEm)
    throw new BadRequestException(
      'Informe a data de encerramento do desvio.',
    );

  return {
    desvioEncerradoEm: new Date(dados.encerradoEm),
    desvioEncerramentoObs: dados.observacoes?.trim() || null,
  };
}
