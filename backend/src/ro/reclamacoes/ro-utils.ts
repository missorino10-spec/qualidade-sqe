// Regras de calculo do R.O que valem para o service e para o PDF.

// A planilha numera "RO-2026-0001": ano com quatro digitos e sequencial com
// quatro, reiniciando a cada ano.
export function numeroRo(sequencial: number, ano: number): string {
  return `RO-${ano}-${String(sequencial).padStart(4, '0')}`;
}

// Prazo de conclusao: 5 dias uteis contados do recebimento na Qualidade
// ("Calculado pelo sistema (5 dias uteis)" na planilha). Sabado e domingo nao
// contam; feriado nao entra porque o sistema nao tem calendario de feriados.
export function somarDiasUteis(inicio: Date, dias: number): Date {
  const data = new Date(inicio.getTime());
  let restantes = dias;
  while (restantes > 0) {
    data.setUTCDate(data.getUTCDate() + 1);
    const dow = data.getUTCDay();
    if (dow !== 0 && dow !== 6) restantes--;
  }
  return data;
}

export function custoTotalRo(
  quantidade?: number | null,
  valorUnitario?: number | null,
): number | null {
  if (quantidade == null || valorUnitario == null) return null;
  return Number(quantidade) * Number(valorUnitario);
}

type Tarefa = {
  tipo: string;
  descricao?: string | null;
  prazo?: Date | string | null;
  status?: string | null;
};

function venceu(prazo?: Date | string | null): boolean {
  if (!prazo) return false;
  const hoje = new Date();
  hoje.setUTCHours(0, 0, 0, 0);
  return new Date(prazo).getTime() < hoje.getTime();
}

/**
 * "Status das ações" (F21) e a leitura das linhas do plano de acao corretiva,
 * nao um campo digitado: a planilha tem os dois lado a lado e quem preenche as
 * linhas ja disse tudo. Fica gravado no registro para a lista e o PDF nao
 * recalcularem.
 */
export function derivarStatusAcoes(tarefas: Tarefa[]): string | null {
  const acoes = tarefas.filter((t) => t.tipo === 'ACAO_CORRETIVA');
  if (!acoes.length) return null;

  const vivas = acoes.filter((a) => a.status !== 'CANCELADA');
  if (!vivas.length) return 'CANCELADA';

  if (vivas.every((a) => a.status === 'CONCLUIDA')) return 'CONCLUIDA';
  if (
    vivas.some((a) => a.status === 'ATRASADA' || (a.status !== 'CONCLUIDA' && venceu(a.prazo)))
  ) {
    return 'ATRASADA';
  }
  if (vivas.some((a) => a.status !== 'NAO_INICIADA')) return 'EM_ANDAMENTO';
  return 'NAO_INICIADA';
}

function preenchido(valor: any): boolean {
  if (valor == null) return false;
  if (typeof valor === 'string') return valor.trim() !== '';
  return true;
}

/**
 * Flag de concluido por bloco (decisao 4: automatico, nao e checkbox).
 * O bloco fecha quando os campos que a planilha pede nele estao preenchidos.
 *
 * Ficam DE FORA da conta, de proposito:
 * - o que o sistema calcula sozinho (numero, recebimento, prazo, custo total,
 *   status das acoes);
 * - "Pendências para Sala Controle", que a planilha marca como "se aplicável";
 * - evidencias em texto e os dois anexos, que sao opcionais.
 */
export function camposFaltandoRo(reg: any): Record<number, string[]> {
  const tarefas: Tarefa[] = reg.tarefas ?? [];
  const temTarefa = (tipo: string) =>
    tarefas.some(
      (t) => t.tipo === tipo && String(t.descricao ?? '').trim() !== '',
    );

  const falta: Record<number, string[]> = { 1: [], 2: [], 3: [], 4: [] };

  const exige = (bloco: number, campo: string, rotulo: string) => {
    if (!preenchido(reg[campo])) falta[bloco].push(rotulo);
  };

  exige(1, 'cliente', 'Cliente / representante');
  exige(1, 'produtoCodigo', 'Código do produto');
  exige(1, 'produtoDescricao', 'Descrição do item');
  exige(1, 'quantidadeAfetada', 'Quantidade afetada');
  exige(1, 'valorUnitario', 'Valor unitário');
  exige(1, 'tipoInformado', 'Tipo informado pela Sala de Controle');
  exige(1, 'resultadoAnaliseSac', 'Resultado da análise da Sala de Controle');
  exige(1, 'origemIndicada', 'Origem indicada pela Sala de Controle');

  exige(2, 'dadosCompletos', 'Dados da Sala de Controle completos?');
  exige(2, 'aceita', 'Reclamação aceita para tratativa?');
  exige(2, 'classificacao', 'Classificação Qualidade');
  exige(2, 'procedencia', 'Procedência para tratamento');
  exige(2, 'prioridade', 'Prioridade');
  exige(2, 'areaResponsavel', 'Área responsável Qualidade');
  exige(2, 'responsavelId', 'Responsável interno');

  exige(3, 'necessidadeContencao', 'Necessidade de contenção');
  exige(3, 'metodoAnalise', 'Método de análise de causa');
  exige(3, 'causaImediata', 'Causa imediata');
  exige(3, 'causaSistemica', 'Causa sistêmica');
  exige(3, 'verificacaoEficacia', 'Verificação de eficácia');
  // O plano de contencao so e exigido quando a propria triagem disse que
  // precisa conter.
  if (reg.necessidadeContencao === 'SIM' && !temTarefa('CONTENCAO')) {
    falta[3].push('Plano de contenção (ao menos uma tarefa)');
  }
  if (!temTarefa('ACAO_CORRETIVA')) {
    falta[3].push('Ações corretivas (ao menos uma ação)');
  }

  exige(4, 'resumoConclusao', 'Resumo da conclusão para a Sala de Controle');
  exige(4, 'dataRetornoSac', 'Data do retorno para a Sala de Controle');
  exige(4, 'motivoEncerramento', 'Motivo de encerramento');
  exige(4, 'status', 'Status da reclamação');

  return falta;
}

export function blocosCompletosRo(reg: any): number[] {
  const falta = camposFaltandoRo(reg);
  return [1, 2, 3, 4].filter((n) => falta[n].length === 0);
}
