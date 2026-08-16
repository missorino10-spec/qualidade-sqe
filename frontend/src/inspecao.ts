// Base COMPARTILHADA dos relatorios de inspecao (SQE, Manufatura e SQD).
//
// Tudo o que e igual nos tres modulos mora aqui: o checklist visual oficial
// (BDBR.QUA.FMR.06.07 rev. 07), as tabelas de tolerancia ISO 2768 / DIN 7168
// e o motor de calculo das cotas do dimensional (BDBR.QUA.FMR.011.06 rev. 06).
//
// ESPELHO de backend/src/comum/inspecao.ts. Existe para a tela mostrar o
// calculo enquanto o inspetor digita; o backend recalcula tudo no salvamento,
// entao a tela nunca e a fonte de verdade. Ao mexer aqui, mexa la tambem.

// ---------------------------------------------------------------------------
// Tolerancias
// ---------------------------------------------------------------------------

// Unidade da cota. Em "mm" vale a tabela linear; em "graus" vale a angular.
// O inspetor digita so o numero (ex: 30) e escolhe a unidade; nao ha conversao
// manual.
export type UnidadeCota = 'mm' | 'graus';

// Norma de referencia. ISO 2768 e DIN 7168 usam a MESMA tabela; em "NA" o
// inspetor digita a tolerancia a mao (o resto do calculo continua automatico).
export type NormaTolerancia = 'ISO2768' | 'DIN7168' | 'NA';

export const NORMAS_TOLERANCIA: Record<NormaTolerancia, string> = {
  ISO2768: 'ISO 2768 - m (média)',
  DIN7168: 'DIN 7168 - m (média)',
  NA: 'N/A (tolerância informada)',
};

// A empresa trabalha sempre na classe "m" (media), por decisao do processo.
// Faixa e "acima do limite anterior ATE o limite, inclusive" - por isso 6 mm
// cai na faixa de 0,1 e nao na de 0,2.
export const TOLERANCIA_LINEAR_M: { ate: number; tolerancia: number }[] = [
  { ate: 3, tolerancia: 0.1 },
  { ate: 6, tolerancia: 0.1 },
  { ate: 30, tolerancia: 0.2 },
  { ate: 120, tolerancia: 0.3 },
  { ate: 400, tolerancia: 0.5 },
  { ate: 1000, tolerancia: 0.8 },
  { ate: 2000, tolerancia: 1.2 },
  { ate: 4000, tolerancia: 2 },
];

// Abaixo de 0,5 mm a norma nao cobre: a tolerancia fica em branco para o
// inspetor digitar.
export const LIMITE_MINIMO_LINEAR = 0.5;

// Angular em graus decimais (a norma traz em graus/minutos):
// 1° | 0°30' = 0,5 | 0°20' = 0,3333 | 0°10' = 0,1667 | 0°5' = 0,0833.
// A linha "m" vem vazia na planilha de origem; por decisao do processo ela
// repete a linha "f" (fino).
export const TOLERANCIA_ANGULAR_M: { ate: number; tolerancia: number }[] = [
  { ate: 10, tolerancia: 1 },
  { ate: 50, tolerancia: 0.5 },
  { ate: 120, tolerancia: 1 / 3 },
  { ate: 400, tolerancia: 1 / 6 },
  { ate: Infinity, tolerancia: 1 / 12 },
];

export function arredondar(n: number, casas: number): number {
  const f = Math.pow(10, casas);
  return Math.round(n * f) / f;
}

// Casas usadas em cada unidade: mm com 2, graus com 4 (0°5' = 0,0833).
export function casasDaUnidade(unidade: UnidadeCota): number {
  return unidade === 'graus' ? 4 : 2;
}

// Tolerancia da tabela para a medida especificada. Retorna null quando a
// medida esta fora do alcance da norma (ai o campo abre para digitacao).
export function toleranciaPadrao(
  especificado: number,
  unidade: UnidadeCota = 'mm',
): number | null {
  if (!Number.isFinite(especificado)) return null;
  const v = Math.abs(especificado);
  if (v <= 0) return null;

  const tabela =
    unidade === 'graus' ? TOLERANCIA_ANGULAR_M : TOLERANCIA_LINEAR_M;
  if (unidade === 'mm' && v < LIMITE_MINIMO_LINEAR) return null;

  const faixa = tabela.find((f) => v <= f.ate);
  if (!faixa) return null;
  return arredondar(faixa.tolerancia, casasDaUnidade(unidade));
}

// ---------------------------------------------------------------------------
// Motor de calculo das cotas
// ---------------------------------------------------------------------------

export function numero(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

// Campos comuns as duas variantes do formulario dimensional.
type CotaBase = {
  localizacao?: string;
  especificado?: string | number | null;
  unidade?: UnidadeCota;
  norma?: NormaTolerancia;
  tolerancia?: string | number | null;
  upper?: string | number | null;
  lower?: string | number | null;
  instrumento?: string;
  desvioMin?: string | number | null;
  desvioMax?: string | number | null;
  // Resposta automatica do calculo (fora da faixa = reprovado).
  conformeAuto?: boolean | null;
  // Alteracao do inspetor. So vale quando o automatico deu aprovado; cota
  // calculada como reprovada fica travada.
  conformeManual?: boolean | null;
  conforme?: boolean | null;
};

// Variante do LOTE (BDBR.QUA.FMR.011.06): uma linha por cota, com o maior e o
// menor valor encontrados no lote. Usada pelo SQE e pela Manufatura.
export type CotaMaxMin = CotaBase & {
  encontradoMax?: string | number | null;
  encontradoMin?: string | number | null;
};

// Variante AMOSTRAS: uma coluna por peca (PECA 01/02/03). Usada pela
// homologacao de itens do SQD.
export type CotaPecas = CotaBase & {
  pecas?: (string | number | null)[];
};

// Resolve tolerancia/upper/lower a partir do especificado. E o miolo comum das
// duas variantes.
function limites(cota: CotaBase): {
  especificado: number;
  unidade: UnidadeCota;
  casas: number;
  tolerancia: number;
  upper: number;
  lower: number;
} | null {
  const especificado = numero(cota.especificado);
  if (especificado === null) return null;

  const unidade: UnidadeCota = cota.unidade === 'graus' ? 'graus' : 'mm';
  const casas = casasDaUnidade(unidade);
  const norma: NormaTolerancia = cota.norma ?? 'ISO2768';

  // Em N/A a tolerancia e sempre a digitada. Nas normas, a tabela manda; a
  // digitada so entra quando a medida esta fora do alcance da tabela.
  const digitada = numero(cota.tolerancia);
  const daTabela = norma === 'NA' ? null : toleranciaPadrao(especificado, unidade);
  const tolerancia = norma === 'NA' ? digitada : (daTabela ?? digitada);
  if (tolerancia === null) return null;

  return {
    especificado,
    unidade,
    casas,
    tolerancia: arredondar(Math.abs(tolerancia), casas),
    upper: arredondar(especificado + Math.abs(tolerancia), casas),
    lower: arredondar(especificado - Math.abs(tolerancia), casas),
  };
}

// Desvio no padrao da aba LOTE: abaixo do LOWER sai negativo, acima do UPPER
// sai positivo, dentro da faixa sai zero.
function desvios(
  medidas: number[],
  upper: number,
  lower: number,
  casas: number,
): { desvioMin: number; desvioMax: number } {
  const min = Math.min(...medidas);
  const max = Math.max(...medidas);
  return {
    desvioMin: arredondar(min < lower ? min - lower : 0, casas),
    desvioMax: arredondar(max > upper ? max - upper : 0, casas),
  };
}

// Conforme: o calculo decide. Se reprovou, trava em reprovado. Se aprovou, o
// inspetor pode reprovar a mao (ex: defeito que a medida nao pega).
function resolverConforme(
  medidas: number[],
  upper: number,
  lower: number,
  conformeManual: boolean | null | undefined,
): { conformeAuto: boolean | null; conforme: boolean | null } {
  if (!medidas.length) return { conformeAuto: null, conforme: null };
  const dentro = medidas.every((m) => m >= lower && m <= upper);
  if (!dentro) return { conformeAuto: false, conforme: false };
  return {
    conformeAuto: true,
    conforme: conformeManual === false ? false : true,
  };
}

// Recalcula a cota da aba LOTE (encontrado maximo e minimo).
export function calcularCotaMaxMin(cota: CotaMaxMin): CotaMaxMin {
  const base = limites(cota);
  if (!base) {
    return { ...cota, conformeAuto: null, conforme: cota.conformeManual ?? null };
  }

  const { casas, tolerancia, upper, lower } = base;
  const medidas = [numero(cota.encontradoMax), numero(cota.encontradoMin)].filter(
    (n): n is number => n !== null,
  );

  const d = medidas.length
    ? desvios(medidas, upper, lower, casas)
    : { desvioMin: null, desvioMax: null };
  const c = resolverConforme(medidas, upper, lower, cota.conformeManual);

  return {
    ...cota,
    unidade: cota.unidade === 'graus' ? 'graus' : 'mm',
    norma: cota.norma ?? 'ISO2768',
    tolerancia,
    upper,
    lower,
    desvioMin: d.desvioMin ?? '',
    desvioMax: d.desvioMax ?? '',
    conformeAuto: c.conformeAuto,
    conforme: c.conforme,
  };
}

// Recalcula a cota da aba AMOSTRAS (uma medida por peca).
export function calcularCotaPecas(cota: CotaPecas): CotaPecas {
  const base = limites(cota);
  if (!base) {
    return { ...cota, conformeAuto: null, conforme: cota.conformeManual ?? null };
  }

  const { casas, tolerancia, upper, lower } = base;
  const medidas = (cota.pecas ?? [])
    .map(numero)
    .filter((n): n is number => n !== null);

  const d = medidas.length
    ? desvios(medidas, upper, lower, casas)
    : { desvioMin: null, desvioMax: null };
  const c = resolverConforme(medidas, upper, lower, cota.conformeManual);

  return {
    ...cota,
    unidade: cota.unidade === 'graus' ? 'graus' : 'mm',
    norma: cota.norma ?? 'ISO2768',
    tolerancia,
    upper,
    lower,
    desvioMin: d.desvioMin ?? '',
    desvioMax: d.desvioMax ?? '',
    conformeAuto: c.conformeAuto,
    conforme: c.conforme,
  };
}

// Resultado do dimensional: reprova se qualquer cota reprovou.
export function resultadoDimensional(
  cotas: { conforme?: boolean | null }[] | null | undefined,
): 'APROVADO' | 'REPROVADO' {
  const reprovou = (cotas ?? []).some((c) => c.conforme === false);
  return reprovou ? 'REPROVADO' : 'APROVADO';
}

// ---------------------------------------------------------------------------
// Checklist da inspecao VISUAL - BDBR.QUA.FMR.06.07 rev. 07.
// 12 grupos, 48 itens, com o texto literal do formulario.
// ---------------------------------------------------------------------------

export type StatusVisual = 'APROVADO' | 'REPROVADO' | 'NAO_APLICAVEL';

export type GrupoVisual = {
  grupo: string;
  itens: { texto: string; status: StatusVisual }[];
};

export const CHECKLIST_VISUAL: { grupo: string; itens: string[] }[] = [
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
  return CHECKLIST_VISUAL.map((g) => ({
    grupo: g.grupo,
    itens: g.itens.map((texto) => ({
      texto,
      status: 'NAO_APLICAVEL' as StatusVisual,
    })),
  }));
}

// A inspecao visual so e aprovada se nenhum item estiver reprovado.
export function resultadoVisual(
  checklist: GrupoVisual[] | null | undefined,
): 'APROVADO' | 'REPROVADO' {
  const reprovou = (checklist ?? []).some((g) =>
    (g.itens ?? []).some((i) => i.status === 'REPROVADO'),
  );
  return reprovou ? 'REPROVADO' : 'APROVADO';
}

// Limite de fotos do bloco EVIDENCIAS / EVIDENCE do formulario visual.
export const MAX_FOTOS_EVIDENCIA = 4;
