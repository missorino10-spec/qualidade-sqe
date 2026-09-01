// Base COMPARTILHADA dos relatorios de inspecao (SQE, Manufatura e SQD).
//
// Tudo o que e igual nos tres modulos mora aqui: o checklist visual oficial
// (BDBR.QUA.FMR.06.07 rev. 07), as tabelas de tolerancia ISO 2768 / DIN 7168
// e o motor de calculo das cotas do dimensional (BDBR.QUA.FMR.011.06 rev. 06).
//
// O frontend tem um espelho deste arquivo em frontend/src/inspecao.ts, para
// mostrar o calculo na tela enquanto o inspetor digita. O backend recalcula
// tudo no salvamento, entao a tela nunca e a fonte de verdade.

// ---------------------------------------------------------------------------
// Tolerancias
// ---------------------------------------------------------------------------

// Unidade da cota:
//   - "mm": dimensao linear, unica em que a norma da a tolerancia pronta.
//   - "graus": angulo, escrito em graus e minutos num campo so ("0°30'").
//   - "raio": raio em milimetros.
//
// So o "mm" tem tabela. A tabela angular da norma e indexada pelo COMPRIMENTO
// DO MENOR LADO do angulo, em milimetros - medida que o formulario nao tem -,
// entao sugerir a tolerancia pelo valor do angulo daria numero errado (45°
// caia na faixa "10 a 50" e recebia ±0°30'). Em graus e em raio quem informa a
// tolerancia e o inspetor, com a tabela a vista na tela.
export type UnidadeCota = 'mm' | 'graus' | 'raio';

export const UNIDADES_COTA: { value: UnidadeCota; label: string }[] = [
  { value: 'mm', label: 'mm' },
  { value: 'graus', label: 'graus' },
  { value: 'raio', label: 'raio (mm)' },
];

export function unidadeDaCota(valor: unknown): UnidadeCota {
  return valor === 'graus' || valor === 'raio' ? valor : 'mm';
}

// Norma de referencia da cota.
//
// ISO 2768 e DIN 7168 usam a MESMA tabela (classe m para dimensao, K para
// forma e posicao) e sao as unicas em que o sistema sabe a tolerancia. Nas
// outras duas quem informa e o inspetor:
//   - "OUTROS": ele digita o nome da norma e a tolerancia; upper e lower saem
//     calculados igual as duas de cima.
//   - "NA": ele digita os proprios limites; a tolerancia vira opcional.
//
// Na opcao "Outros" o texto digitado E o valor gravado - nao ha coluna
// separada. Por isso os registros antigos, que guardavam a norma como texto
// livre, continuam legiveis sem conversao nenhuma.
export type NormaPadrao = 'ISO2768' | 'DIN7168' | 'NA' | 'OUTROS';
export type NormaTolerancia = NormaPadrao | (string & {});

// Escolhido "Outros" e ainda sem o nome digitado. Fica gravado assim mesmo:
// no papel sai "Outros (norma informada)", que e honesto, em vez de um campo
// vazio ou de uma norma que o inspetor nao escolheu.
export const NORMA_OUTROS = 'OUTROS';

export const NORMAS_TOLERANCIA: Record<NormaPadrao, string> = {
  ISO2768: 'ISO 2768 - mK',
  DIN7168: 'DIN 7168 - mK',
  NA: 'N/A (tolerância informada)',
  OUTROS: 'Outros (norma informada)',
};

// Rotulo curto: a norma tambem e mostrada por cota, numa coluna estreita da
// tabela, onde o texto cheio nao cabe.
export const NORMAS_CURTAS: Record<NormaPadrao, string> = {
  ISO2768: 'ISO 2768-mK',
  DIN7168: 'DIN 7168-mK',
  NA: 'N/A',
  OUTROS: 'Outros',
};

// Opcoes do campo "Tolerâncias / Norma" (cabecalho do relatorio e coluna da
// tabela de cotas).
export const OPCOES_NORMA: { value: NormaPadrao; label: string }[] = (
  Object.keys(NORMAS_TOLERANCIA) as NormaPadrao[]
).map((value) => ({ value, label: NORMAS_TOLERANCIA[value] }));

export function ehNormaPadrao(valor: unknown): valor is NormaPadrao {
  return (
    valor === 'ISO2768' ||
    valor === 'DIN7168' ||
    valor === 'NA' ||
    valor === NORMA_OUTROS
  );
}

// So nessas duas o sistema tem a tabela de tolerancia.
export function normaTemTabela(valor: unknown): boolean {
  return valor === 'ISO2768' || valor === 'DIN7168';
}

// Nome digitado pelo inspetor na opcao "Outros" - vazio quando ele escolheu
// "Outros" mas ainda nao escreveu, e vazio nas tres opcoes fixas.
export function normaDigitada(valor: unknown): string {
  if (valor == null || valor === '' || ehNormaPadrao(valor)) return '';
  return String(valor);
}

// Valor que o <Select> deve mostrar: norma digitada aparece como "Outros".
export function normaSelecionada(valor: unknown): NormaPadrao {
  if (valor == null || valor === '') return 'ISO2768';
  return ehNormaPadrao(valor) ? valor : NORMA_OUTROS;
}

export function labelNorma(valor: unknown): string {
  if (valor == null || valor === '') return '';
  return ehNormaPadrao(valor) ? NORMAS_TOLERANCIA[valor] : String(valor);
}

export function normaCurta(valor: unknown): string {
  if (valor == null || valor === '') return '';
  return ehNormaPadrao(valor) ? NORMAS_CURTAS[valor] : String(valor);
}

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

// Tabela angular da norma. O "ate" NAO e o valor do angulo: e o comprimento do
// menor lado do angulo, em milimetros. Como o formulario nao pede esse
// comprimento, ela nao entra no calculo - fica so como consulta na tela, para
// o inspetor achar a tolerancia e digitar.
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

// Casas usadas em cada unidade: mm e raio com 2, graus com 4 (0°5' = 0,0833).
export function casasDaUnidade(unidade: UnidadeCota): number {
  return unidade === 'graus' ? 4 : 2;
}

// Tolerancia da tabela para a medida especificada. Retorna null quando o
// sistema nao tem como saber (ai o campo abre para digitacao): fora do alcance
// da tabela linear, ou unidade em graus/raio.
export function toleranciaPadrao(
  especificado: number,
  unidade: UnidadeCota = 'mm',
): number | null {
  if (unidade !== 'mm') return null;
  if (!Number.isFinite(especificado)) return null;
  const v = Math.abs(especificado);
  if (v <= 0 || v < LIMITE_MINIMO_LINEAR) return null;

  const faixa = TOLERANCIA_LINEAR_M.find((f) => v <= f.ate);
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

// A norma nao passa do minuto, entao todo angulo e encaixado no minuto mais
// proximo. Sem isso o valor exibido e o valor gravado divergiriam a cada
// edicao (0°20' vira 0,3333, que volta como 0°20' mas nao e o mesmo numero).
function arredondarMinuto(graus: number): number {
  return arredondar(Math.round(graus * 60) / 60, 4);
}

/**
 * Angulo escrito em graus e minutos num campo so. Aceita "1°30'", "1°30",
 * "1°", "30'" e o numero puro em graus decimais ("0,5"), que e como os
 * relatorios antigos foram gravados. Devolve sempre graus decimais.
 */
export function numeroAngulo(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const texto = String(v).trim().replace(/,/g, '.');
  if (!texto) return null;

  // Numero puro: graus decimais, formato dos registros antigos.
  const puro = Number(texto);
  if (Number.isFinite(puro)) return arredondarMinuto(puro);

  const m = texto.match(
    /^(-)?\s*(?:(\d+(?:\.\d+)?)\s*°)?\s*(?:(\d+(?:\.\d+)?)\s*'\s*)?$/,
  );
  if (!m) return null;
  const [, sinal, grau, minuto] = m;
  if (grau === undefined && minuto === undefined) return null;
  const valor = Number(grau ?? 0) + Number(minuto ?? 0) / 60;
  if (!Number.isFinite(valor)) return null;
  return arredondarMinuto(sinal ? -valor : valor);
}

// Como o angulo aparece na tela e no papel: "1°" quando nao sobra minuto,
// "0°30'" quando sobra - a mesma notacao da norma.
export function textoAngulo(v: unknown): string {
  const n = numeroAngulo(v);
  if (n === null) return v === null || v === undefined ? '' : String(v);
  const total = Math.round(Math.abs(n) * 60);
  const grau = Math.floor(total / 60);
  const minuto = total % 60;
  return `${n < 0 ? '-' : ''}${grau}°${minuto ? `${minuto}'` : ''}`;
}

// Leitura e escrita de qualquer campo numerico da cota, na unidade dela.
export function numeroCota(v: unknown, unidade: UnidadeCota): number | null {
  return unidade === 'graus' ? numeroAngulo(v) : numero(v);
}

export function textoCota(v: unknown, unidade: UnidadeCota): string {
  if (v === null || v === undefined || v === '') return '';
  return unidade === 'graus' ? textoAngulo(v) : String(v).replace('.', ',');
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
  tolerancia: number | null;
  upper: number;
  lower: number;
} | null {
  const unidade = unidadeDaCota(cota.unidade);
  const casas = casasDaUnidade(unidade);

  const especificado = numeroCota(cota.especificado, unidade);
  if (especificado === null) return null;

  const norma: NormaTolerancia = cota.norma ?? 'ISO2768';
  const digitada = numeroCota(cota.tolerancia, unidade);

  // Em N/A quem manda sao os limites digitados: o desenho pode trazer campo
  // assimetrico (ex: +0,5 / -0,1), que uma tolerancia so nao representa. A
  // tolerancia continua valendo como atalho de quem tem o campo simetrico, e
  // por isso os registros antigos, que so guardavam ela, seguem batendo.
  if (norma === 'NA') {
    const upperDigitado = numeroCota(cota.upper, unidade);
    const lowerDigitado = numeroCota(cota.lower, unidade);
    if (upperDigitado !== null && lowerDigitado !== null) {
      return {
        especificado,
        unidade,
        casas,
        tolerancia:
          digitada === null ? null : arredondar(Math.abs(digitada), casas),
        upper: arredondar(Math.max(upperDigitado, lowerDigitado), casas),
        lower: arredondar(Math.min(upperDigitado, lowerDigitado), casas),
      };
    }
  }

  // Nas duas normas com tabela ela manda, e a digitada so entra quando a
  // medida esta fora do alcance (ou quando a unidade e graus/raio, que a
  // tabela nao cobre). Em norma informada pelo inspetor ("Outros") o sistema
  // nunca tem tabela: vale a digitada, com upper e lower calculados do mesmo
  // jeito.
  const daTabela = normaTemTabela(norma)
    ? toleranciaPadrao(especificado, unidade)
    : null;
  const tolerancia = daTabela ?? digitada;
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

  const { casas, unidade, tolerancia, upper, lower } = base;
  const medidas = [
    numeroCota(cota.encontradoMax, unidade),
    numeroCota(cota.encontradoMin, unidade),
  ].filter((n): n is number => n !== null);

  const d = medidas.length
    ? desvios(medidas, upper, lower, casas)
    : { desvioMin: null, desvioMax: null };
  const c = resolverConforme(medidas, upper, lower, cota.conformeManual);

  return {
    ...cota,
    unidade,
    norma: cota.norma ?? 'ISO2768',
    tolerancia: tolerancia ?? '',
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

  const { casas, unidade, tolerancia, upper, lower } = base;
  const medidas = (cota.pecas ?? [])
    .map((p) => numeroCota(p, unidade))
    .filter((n): n is number => n !== null);

  const d = medidas.length
    ? desvios(medidas, upper, lower, casas)
    : { desvioMin: null, desvioMax: null };
  const c = resolverConforme(medidas, upper, lower, cota.conformeManual);

  return {
    ...cota,
    unidade,
    norma: cota.norma ?? 'ISO2768',
    tolerancia: tolerancia ?? '',
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

// Checklist como ele deve aparecer no RELATORIO (tela de detalhe e PDF): sem os
// itens marcados como "Não aplicável". Como o checklist em branco ja nasce todo
// em NAO_APLICAVEL, o relatorio ficava tomado por dezenas de linhas "N/A" e o
// que realmente foi avaliado se perdia no meio. Grupo que sobra vazio some
// junto com o cabecalho.
//
// Vale so na LEITURA: no formulario de preenchimento o N/A continua visivel,
// senao o inspetor nao consegue voltar atras depois de marcar.
export function checklistDoRelatorio(checklist: unknown): GrupoVisual[] {
  const grupos = Array.isArray(checklist) ? (checklist as GrupoVisual[]) : [];
  return grupos
    .map((g) => ({
      ...g,
      itens: (g?.itens ?? []).filter((i) => i?.status !== 'NAO_APLICAVEL'),
    }))
    .filter((g) => g.itens.length > 0);
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

// Limite de fotos de CADA bloco de evidencias. Os formularios tem dois blocos
// independentes - um do dimensional e um do visual -, entao o limite vale por
// bloco: ate 4 fotos no dimensional e ate 4 no visual.
export const MAX_FOTOS_EVIDENCIA = 4;

// ---------------------------------------------------------------------------
// ORIGEM DA INSPECAO
// A mesma lista dos tres modulos, na ordem do formulario em papel. O enum no
// banco e um so; o que muda e o que cada modulo oferta:
//   - INSPECAO_PRODUCAO so faz sentido na Manufatura (inspecao durante a
//     producao), entao nao aparece no SQE nem no SQD.
// ---------------------------------------------------------------------------

export const ORIGENS_INSPECAO: { value: string; label: string }[] = [
  { value: 'PLANO_INSPECAO', label: 'Plano de Inspeção' },
  { value: 'HOMOLOGACAO', label: 'Homologação' },
  { value: 'DEVOLUCAO', label: 'Devolução' },
  { value: 'RETRABALHO', label: 'Retrabalho' },
  { value: 'RELATORIO_OCORRENCIA', label: 'Relatório de Ocorrência' },
  { value: 'LIBERACAO_SETUP', label: 'Liberação de Setup' },
  { value: 'INSPECAO_PRODUCAO', label: 'Inspeção de Produção' },
  { value: 'OUTROS', label: 'Outros' },
];

// Lista ofertada fora da Manufatura (sem a inspecao de producao).
export const ORIGENS_RECEBIMENTO = ORIGENS_INSPECAO.filter(
  (o) => o.value !== 'INSPECAO_PRODUCAO',
);

export const labelOrigemInspecao: Record<string, string> = Object.fromEntries(
  ORIGENS_INSPECAO.map((o) => [o.value, o.label]),
);

// ---------------------------------------------------------------------------
// CONJUNTOS: mais de um desenho na mesma inspecao
// Uma peca de conjunto e conferida por varios desenhos, e cada desenho tem as
// suas proprias cotas. O primeiro desenho continua nos campos do cabecalho
// (Desenho / Revisao), que e como todo relatorio ja gravado esta; os demais vao
// no campo "desenhos", que guarda SO os extras (do 2o em diante).
//
// As cotas seguem num array unico, cada uma marcada com "desenhoIdx" (0 = o do
// cabecalho, 1 = desenhos[0], e assim por diante). Assim tudo que ja lia a
// lista plana de cotas - resultado, RNC, indicadores - continua lendo igual.
// Relatorio antigo nao tem nem "desenhos" nem "desenhoIdx": vira um grupo so.
// ---------------------------------------------------------------------------
export type DesenhoExtra = { desenho?: string | null; revisao?: string | null };

export type GrupoDesenho = {
  // 0 = o desenho do cabecalho
  indice: number;
  desenho: string;
  revisao: string;
  cotas: any[];
};

export function desenhosExtras(valor: any): DesenhoExtra[] {
  if (!Array.isArray(valor)) return [];
  return valor
    .filter((d) => d && typeof d === 'object')
    .map((d: any) => ({
      desenho: d.desenho ?? '',
      // desenhoRevisao e o nome do campo no cabecalho de dois dos formularios;
      // aceito aqui para o payload poder vir com qualquer um dos dois.
      revisao: d.revisao ?? d.desenhoRevisao ?? '',
    }));
}

// A que desenho a cota pertence. Cota sem marca e do desenho do cabecalho.
export function desenhoDaCota(cota: any): number {
  const i = Math.trunc(Number(cota?.desenhoIdx));
  return Number.isFinite(i) && i > 0 ? i : 0;
}

export function gruposDeDesenho(
  cotas: any,
  desenhos: any,
  cabecalho: {
    desenho?: string | null;
    revisao?: string | null;
    // Campo unico dos registros antigos (desenho e revisao juntos).
    legado?: string | null;
  },
): GrupoDesenho[] {
  const extras = desenhosExtras(desenhos);
  const grupos: GrupoDesenho[] = [
    {
      indice: 0,
      desenho: cabecalho.desenho || cabecalho.legado || '-',
      revisao: cabecalho.revisao || '-',
      cotas: [],
    },
    ...extras.map((d, i) => ({
      indice: i + 1,
      desenho: d.desenho || '-',
      revisao: d.revisao || '-',
      cotas: [] as any[],
    })),
  ];
  for (const c of Array.isArray(cotas) ? cotas : []) {
    const i = desenhoDaCota(c);
    (grupos[i] ?? grupos[0]).cotas.push(c);
  }
  return grupos;
}

// ---------------------------------------------------------------------------
// EVIDENCIAS: o dimensional e o visual tem blocos de foto separados.
// As fotos vivem na tabela polimorfica Anexo, identificadas pelo entidadeTipo
// abaixo. No SQE cada formulario e um registro proprio, entao cada um tem um
// bloco so; na Manufatura e no SQD os dois convivem no mesmo registro.
// INSPECAO_VISUAL e o valor antigo do SQE - foi mantido para nao perder as
// fotos ja gravadas.
// ---------------------------------------------------------------------------
export const EVID = {
  sqeVisual: 'INSPECAO_VISUAL',
  sqeDimensional: 'INSPECAO_LOTE',
  manufaturaDimensional: 'RELATORIO_DIMENSIONAL_DIM',
  // Bloco visual que existia DENTRO do relatorio dimensional. Continua aqui
  // para nao perder as fotos ja gravadas nos relatorios antigos.
  manufaturaVisual: 'RELATORIO_DIMENSIONAL_VIS',
  // Fotos da inspecao visual da manufatura como documento proprio.
  manufaturaVisualInspecao: 'INSPECAO_VISUAL_MANUFATURA',
  homologacaoItemDimensional: 'HOMOLOGACAO_ITEM_AMOSTRAS',
  homologacaoItemVisual: 'HOMOLOGACAO_ITEM_VISUAL',
  // Fotos presas a um item REPROVADO do checklist visual. Ficam num bloco
  // proprio para nao dividir o teto de 4 fotos com a evidencia geral: sao
  // uma por desvio, e o numero de desvios e que manda.
  sqeVisualDesvio: 'INSPECAO_VISUAL_DESVIO',
  homologacaoItemVisualDesvio: 'HOMOLOGACAO_ITEM_VISUAL_DESVIO',
  // Os dois paineis de foto do Alerta da Qualidade.
  alertaErrado: 'ALERTA_QUALIDADE_ERRADO',
  alertaCerto: 'ALERTA_QUALIDADE_CERTO',
} as const;
