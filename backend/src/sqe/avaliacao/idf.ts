// IDF - Indice de Desempenho do Fornecedor.
//
// Espelha a planilha "Monitoramento e Avaliacao Fornecedores", com as regras
// que a Qualidade fechou por cima dela:
//
//   IDF = C1 x 50% + C2 x 30% + C3 x 20%
//
//   C1  % de conformidade do recebimento   >=98:10  95:8  90:6  85:4  80:2  <80:0
//   C2  horas para responder a RNC         <=72:10  120:8 168:6 216:4 264:2 >264:0
//   C3  nivel do plano de acao da RNC      EXCELENTE:10  SATISFATORIO:6  RUIM:0
//
//   IDF >= 9 = A Estrategico . >= 7 = B Aprovado . >= 5 = C Em Atencao . D Critico
//
// O ciclo e mensal -> trimestre CALENDARIO -> ano, e cada nivel so faz media
// sobre os periodos que tem dado: mes sem recebimento nao zera nada, apenas
// fica de fora da conta.

export type Classificacao = 'A' | 'B' | 'C' | 'D';

export const PESO = { c1: 0.5, c2: 0.3, c3: 0.2 } as const;

// Dia em que a competencia fecha. Como folha de pagamento: o que entrou ate o
// dia 26 conta neste mes, do 27 em diante cai no mes seguinte.
export const DIA_CORTE = 26;

// Janela da competencia: 27 do mes anterior ate 26 do mes, inclusive.
export function competencia(
  ano: number,
  mes: number,
): { inicio: Date; fim: Date; label: string } {
  const inicio = new Date(ano, mes - 2, DIA_CORTE + 1, 0, 0, 0, 0);
  const fim = new Date(ano, mes - 1, DIA_CORTE, 23, 59, 59, 999);
  return { inicio, fim, label: `${ano}-${String(mes).padStart(2, '0')}` };
}

// Competencia em que uma data cai: ate o dia 26 e o mes corrente, depois o
// seguinte (virando o ano quando for dezembro).
export function competenciaDe(d: Date): { ano: number; mes: number } {
  const ano = d.getFullYear();
  const mes = d.getMonth() + 1;
  if (d.getDate() <= DIA_CORTE) return { ano, mes };
  return mes === 12 ? { ano: ano + 1, mes: 1 } : { ano, mes: mes + 1 };
}

// C1 - conformidade. Sem lote inspecionado no mes o fornecedor nao pontua:
// devolve null e a competencia inteira fica de fora das medias.
export function notaConformidade(pct: number | null): number | null {
  if (pct === null) return null;
  if (pct >= 98) return 10;
  if (pct >= 95) return 8;
  if (pct >= 90) return 6;
  if (pct >= 85) return 4;
  if (pct >= 80) return 2;
  return 0;
}

// C2 - tempo de resposta. Base de 72h e mais 48h a cada degrau.
export function notaTempoResposta(horas: number): number {
  if (horas <= 72) return 10;
  if (horas <= 120) return 8;
  if (horas <= 168) return 6;
  if (horas <= 216) return 4;
  if (horas <= 264) return 2;
  return 0;
}

// C3 - nivel do plano de acao, direto do campo que a Qualidade preenche na RNC
// quando o fornecedor responde. NAO_APLICAVEL nao e nota: sai da media (e se
// todas as RNCs do mes forem assim, o criterio nao pesa contra o fornecedor).
// RNC sem plano respondido no fechamento vale 0 - perde o indicador do mes.
export function notaPlanoAcao(nivel: string | null): number | null {
  if (nivel === 'NAO_APLICAVEL') return null;
  if (nivel === 'EXCELENTE') return 10;
  if (nivel === 'SATISFATORIO') return 6;
  return 0; // RUIM ou ainda sem resposta
}

export function media(valores: number[]): number | null {
  if (!valores.length) return null;
  const soma = valores.reduce((a, b) => a + b, 0);
  return arredondar(soma / valores.length);
}

export function arredondar(v: number, casas = 2): number {
  const f = Math.pow(10, casas);
  return Math.round(v * f) / f;
}

// O IDF so existe com os tres criterios em maos. Faltando qualquer um, a
// competencia nao fecha nota e sai da media do trimestre.
export function calcularIdf(
  c1: number | null,
  c2: number | null,
  c3: number | null,
): number | null {
  if (c1 === null || c2 === null || c3 === null) return null;
  return arredondar(c1 * PESO.c1 + c2 * PESO.c2 + c3 * PESO.c3);
}

export function classificarPorIdf(idf: number | null): Classificacao | null {
  if (idf === null) return null;
  if (idf >= 9) return 'A';
  if (idf >= 7) return 'B';
  if (idf >= 5) return 'C';
  return 'D';
}

export const ROTULO_CLASSE: Record<Classificacao, string> = {
  A: 'Estratégico',
  B: 'Aprovado',
  C: 'Em Atenção',
  D: 'Crítico',
};

// Trimestre calendario (Jan-Mar = 1T), e nao o trimestre fiscal out->set que o
// resto do SQE usa. Foi decisao da Qualidade: a avaliacao de fornecedor segue
// o calendario civil.
export function trimestreCalendario(mes: number): number {
  return Math.floor((mes - 1) / 3) + 1;
}

export function mesesDoTrimestre(trimestre: number): number[] {
  const primeiro = (trimestre - 1) * 3 + 1;
  return [primeiro, primeiro + 1, primeiro + 2];
}
