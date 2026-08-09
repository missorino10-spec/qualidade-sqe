// Catalogos e calculos da HOMOLOGACAO DE ITENS (SQD).
//
// Fontes: BDBR.QUA.FMR.025.01 (Registro de Homologacao de Itens) para as
// listas do registro, e o modelo de relatorios de inspecao para as duas abas
// que compoem a analise: AMOSTRAS (BDBR.QUA.FMR.011.06 rev. 06) e VISUAL
// (BDBR.QUA.FMR.06.07 rev. 07).

// Lista de validacao da coluna "Ação" (aba "Base de Dados", C1:C7). Sao 7
// itens, diferentes dos 5 da homologacao de fornecedores. No banco fica o
// codigo, para a redacao poder mudar sem mexer nos registros.
export const ACOES_HOMOLOGACAO_ITEM: Record<string, string> = {
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

export const CODIGOS_ACAO_ITEM = Object.keys(ACOES_HOMOLOGACAO_ITEM);

// Prazos da aba "KPI's" do FMR.025.01: 3 dias uteis, os mesmos do modulo de
// fornecedores.
export const SLA_HOMOLOGACAO_ITEM_DIAS = 3;
export const SLA_RESPOSTA_FORNECEDOR_ITEM_DIAS = 3;

// ---------------------------------------------------------------------------
// Aba AMOSTRAS - tolerancia automatica.
//
// A planilha calcula a tolerancia a partir da medida especificada (formula da
// coluna K), no padrao ISO 2768 - media. Acima de 1000 mm a celula fica vazia
// e a tolerancia e informada a mao.
// ---------------------------------------------------------------------------
export function toleranciaPadrao(especificado: number): number | null {
  if (!Number.isFinite(especificado)) return null;
  const v = Math.abs(especificado);
  if (v < 6) return 0.1;
  if (v < 30) return 0.2;
  if (v < 120) return 0.3;
  if (v < 400) return 0.5;
  if (v < 1000) return 0.8;
  return null;
}

export type CotaItem = {
  localizacao?: string;
  especificado?: string | number | null;
  tolerancia?: string | number | null;
  upper?: string | number | null;
  lower?: string | number | null;
  pecas?: (string | number | null)[];
  instrumento?: string;
  desvioMin?: string | number | null;
  desvioMax?: string | number | null;
};

function numero(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function arredondar2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Refaz as formulas da aba AMOSTRAS para a cota: tolerancia (quando nao veio
// preenchida a mao), upper/lower e o desvio minimo/maximo entre as pecas.
// Rodar no salvamento mantem o PDF igual ao que a tela mostrou.
export function calcularCota(cota: CotaItem): CotaItem {
  const especificado = numero(cota.especificado);
  if (especificado === null) return { ...cota };

  const informada = numero(cota.tolerancia);
  const tolerancia = informada ?? toleranciaPadrao(especificado);
  if (tolerancia === null) return { ...cota };

  const upper = arredondar2(especificado + tolerancia);
  const lower = arredondar2(especificado - tolerancia);

  const medidas = (cota.pecas ?? [])
    .map(numero)
    .filter((n): n is number => n !== null);

  let desvioMin: number | null = null;
  let desvioMax: number | null = null;
  if (medidas.length) {
    const min = Math.min(...medidas);
    const max = Math.max(...medidas);
    desvioMin = arredondar2(min < lower ? lower - min : 0);
    desvioMax = arredondar2(max > upper ? max - upper : 0);
  }

  return {
    ...cota,
    tolerancia,
    upper,
    lower,
    desvioMin: desvioMin ?? cota.desvioMin ?? '',
    desvioMax: desvioMax ?? cota.desvioMax ?? '',
  };
}

// ---------------------------------------------------------------------------
// Aba VISUAL - BDBR.QUA.FMR.06.07 rev. 07.
// 12 grupos, 48 itens, com o texto literal do formulario.
// ---------------------------------------------------------------------------

export type StatusVisual = 'APROVADO' | 'REPROVADO' | 'NAO_APLICAVEL';

export type GrupoVisual = {
  grupo: string;
  itens: { texto: string; status: StatusVisual }[];
};

export const CHECKLIST_VISUAL_SQD: { grupo: string; itens: string[] }[] = [
  {
    grupo: '1. CONDIÇÕES GERAIS / GENERAL CONDITIONS',
    itens: [
      'Peça limpa, sem resíduos de óleo, cavacos, rebarbas, sujeiras e manchas.',
      'Superfícies livres de oxidação, trincas, amassados, batidas e deformações.',
    ],
  },
  {
    grupo: '2. CORTE / CUTTING',
    itens: [
      'Peça livre de cantos vivos e rebarbas.',
      'Sem trincas ou descontinuidades visíveis nas regiões cortadas.',
      'Ausência de microtrincas na borda cortada.',
      'Sem empenamento aparente.',
    ],
  },
  {
    grupo: '3. DOBRA / BENDING',
    itens: [
      'Dobra uniforme, sem marcas excessivas.',
      'Ausência de trincas na região de dobra.',
      'Sem retorno elástico excessivo.',
    ],
  },
  {
    grupo: '4. USINAGEM / MACHINING',
    itens: [
      'Peça livre de cantos vivos e rebarbas.',
      'Ausência de trincas, riscos profundos e porosidade.',
      'Roscas com filetes completos, sem rebarbas, descontinuidades ou empastamento.',
    ],
  },
  {
    grupo: '5. SOLDA / WELDING',
    itens: [
      'Cordões de solda contínuos, sem porosidade visível.',
      'Ausência de mordeduras, respingos ou excesso de material.',
      'Cordão uniforme, sem falhas de enchimento.',
      'Início e término da solda sem crateras.',
      'Conferir distorções e alinhamento pós-solda.',
      'Processo de solda de acordo com o projeto.',
    ],
  },
  {
    grupo: '6. ZINCAGEM ELETROLÍTICA / ELECTROLYTIC ZINC',
    itens: [
      'Camada uniforme, sem manchas, pontos queimados ou falhas de cobertura.',
      'Ausência de descascamentos ou bolhas.',
      'Conferir brilho/tonalidade conforme especificação (clara, azulada, amarelada, etc.).',
      'Verificar se não há excesso de material acumulado em cantos e roscas.',
      'Banho do lote homogêneo, sem diferença de tonalidade entre as peças do mesmo lote.',
    ],
  },
  {
    grupo: '7. GALVANIZAÇÃO A FOGO / HOT DIP GALVANIZING',
    itens: [
      'Camada contínua e uniforme em todas as superfícies, incluindo cantos e furos.',
      'Ausência de áreas sem cobertura.',
      'Camada sem escorrimentos excessivos, bolhas ou encrustações.',
      'Superfície sem descascamentos, lascas ou destacamento.',
      'Conferir espessura mínima conforme especificado em desenho/norma.',
    ],
  },
  {
    grupo: '8. PINTURA EPÓXI / EPOXY COATING',
    itens: [
      'Cobertura uniforme em todas as superfícies, sem áreas falhas.',
      'Ausência de escorrimentos, bolhas, crateras ou pontos de contaminação.',
      'Cor e tonalidade conforme especificação do projeto.',
      'Espessura da camada conforme especificado em projeto.',
      'Ausência de descascamentos, riscos, batidas ou perda de aderência.',
      'Acabamento homogêneo, sem variações excessivas de brilho/opacidade.',
    ],
  },
  {
    grupo: '9. TUBOS / PIPES',
    itens: [
      'Diâmetro interno do tubo livre de costura.',
      'Peças não apresentam ovalização aparente.',
    ],
  },
  {
    grupo: '10. INJEÇÃO / MOLDING',
    itens: [
      'Superfície homogênea, livre de queimaduras, linhas de fluxo e manchas.',
      'Peças livres de rebarbas e marcas acentuadas de pinos extratores.',
      'Ausência de bolhas, descontinuidades, porosidade, afundamentos e delaminação.',
      'Cor e tonalidade conforme especificação do projeto.',
      'Datador atualizado de acordo conforme mês de recebimento do lote.',
    ],
  },
  {
    grupo: '11. MALHA DE ARAME / WIRE MESH',
    itens: [
      'Peças livres de oxidação.',
      'Peças livres de rebarbas, cantos vivos e material sobressalente.',
      'Arames livres de solda frágil.',
      'Peças livres de quebra de solda.',
    ],
  },
  {
    grupo: '12. CONDIÇÕES FINAIS / FINAL CONDITIONS',
    itens: [
      'Conferir proteção contra oxidação durante armazenamento/transporte.',
      'Conferir embalagem e integridade das peças.',
      'Garantir conformidade para liberação final.',
    ],
  },
];

// Checklist em branco: como no papel, tudo comeca em "Não aplicável" e o
// inspetor marca so o que o item exige.
export function checklistVisualInicial(): GrupoVisual[] {
  return CHECKLIST_VISUAL_SQD.map((g) => ({
    grupo: g.grupo,
    itens: g.itens.map((texto) => ({
      texto,
      status: 'NAO_APLICAVEL' as StatusVisual,
    })),
  }));
}

// A aba VISUAL so e aprovada se nenhum item estiver reprovado.
export function resultadoVisual(
  checklist: GrupoVisual[] | null | undefined,
): 'APROVADO' | 'REPROVADO' {
  const reprovou = (checklist ?? []).some((g) =>
    (g.itens ?? []).some((i) => i.status === 'REPROVADO'),
  );
  return reprovou ? 'REPROVADO' : 'APROVADO';
}
