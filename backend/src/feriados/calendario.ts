// Calendario de um ano: nacionais + estaduais de SP + municipais de Araraquara.
// Calculado na hora, sem banco e sem internet, para qualquer ano - e por isso
// que nao existe "ano que alguem esqueceu de gerar". O que a fabrica para alem
// da lei (ponte, recesso, manutencao) a Qualidade acrescenta a mao na tela.
//
// Carnaval e Corpus Christi sao ponto FACULTATIVO por lei, nao feriado, mas
// entram porque a fabrica para. Ficam com tipo FACULTATIVO so para quem olha a
// lista saber de onde vem cada dia.

type Semente = { mes: number; dia: number; descricao: string; tipo: string };

// Feriados nacionais de data fixa (Lei 662/1949, 6.802/1980 e 14.759/2023, que
// tornou o 20 de novembro feriado nacional).
// As descricoes sao texto de tela, nao comentario: vao com acento.
const FIXOS_NACIONAIS: Semente[] = [
  { mes: 1, dia: 1, descricao: 'Confraternização Universal', tipo: 'NACIONAL' },
  { mes: 4, dia: 21, descricao: 'Tiradentes', tipo: 'NACIONAL' },
  { mes: 5, dia: 1, descricao: 'Dia do Trabalho', tipo: 'NACIONAL' },
  { mes: 9, dia: 7, descricao: 'Independência do Brasil', tipo: 'NACIONAL' },
  { mes: 10, dia: 12, descricao: 'Nossa Senhora Aparecida', tipo: 'NACIONAL' },
  { mes: 11, dia: 2, descricao: 'Finados', tipo: 'NACIONAL' },
  { mes: 11, dia: 15, descricao: 'Proclamação da República', tipo: 'NACIONAL' },
  { mes: 11, dia: 20, descricao: 'Consciência Negra', tipo: 'NACIONAL' },
  { mes: 12, dia: 25, descricao: 'Natal', tipo: 'NACIONAL' },
];

// Sao Paulo (estadual) e Araraquara (municipal). O 20 de novembro tambem e
// municipal em Araraquara (Lei 6.633/2007), mas ja entrou como nacional.
const FIXOS_LOCAIS: Semente[] = [
  {
    mes: 7,
    dia: 9,
    descricao: 'Revolução Constitucionalista de 1932',
    tipo: 'ESTADUAL',
  },
  {
    mes: 7,
    dia: 11,
    descricao: 'São Bento, padroeiro de Araraquara',
    tipo: 'MUNICIPAL',
  },
  {
    mes: 8,
    dia: 22,
    descricao: 'Aniversário de Araraquara',
    tipo: 'MUNICIPAL',
  },
];

// Domingo de Pascoa pelo algoritmo de Meeus/Jones/Butcher (gregoriano).
export function domingoDePascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(ano, mes - 1, dia));
}

function somarDias(data: Date, dias: number): Date {
  const d = new Date(data.getTime());
  d.setUTCDate(d.getUTCDate() + dias);
  return d;
}

export type FeriadoGerado = { data: Date; descricao: string; tipo: string };

export function calendarioDoAno(ano: number): FeriadoGerado[] {
  const fixos = [...FIXOS_NACIONAIS, ...FIXOS_LOCAIS].map((s) => ({
    data: new Date(Date.UTC(ano, s.mes - 1, s.dia)),
    descricao: s.descricao,
    tipo: s.tipo,
  }));

  const pascoa = domingoDePascoa(ano);
  const moveis: FeriadoGerado[] = [
    {
      data: somarDias(pascoa, -48),
      descricao: 'Carnaval (segunda)',
      tipo: 'FACULTATIVO',
    },
    {
      data: somarDias(pascoa, -47),
      descricao: 'Carnaval (terça)',
      tipo: 'FACULTATIVO',
    },
    {
      data: somarDias(pascoa, -2),
      descricao: 'Sexta-feira Santa',
      tipo: 'NACIONAL',
    },
    {
      data: somarDias(pascoa, 60),
      descricao: 'Corpus Christi',
      tipo: 'FACULTATIVO',
    },
  ];

  return [...fixos, ...moveis].sort(
    (a, b) => a.data.getTime() - b.data.getTime(),
  );
}
