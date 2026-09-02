// Contagem de DIAS UTEIS do sistema inteiro: prazo da R.O, prazos do SQD e os
// indicadores de prazo do painel do SQE. Todo mundo conta igual, senao "5 dias
// uteis" significaria uma coisa numa tela e outra em outra.
//
// Dia util = segunda a sexta que NAO esta no calendario de feriados. O
// calendario vem do banco (model Feriado) como um conjunto de datas no formato
// "AAAA-MM-DD"; quem chama passa esse conjunto. Sem ele, a conta e so
// segunda-a-sexta.

export type Feriados = ReadonlySet<string>;

// Chave do dia em UTC. As datas do sistema sao gravadas a meia-noite UTC, e a
// coluna "data" do feriado e @db.Date - comparar por texto evita qualquer
// surpresa de fuso.
export function chaveDia(data: Date): string {
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, '0')}-${String(
    data.getUTCDate(),
  ).padStart(2, '0')}`;
}

function meiaNoiteUTC(data: Date): Date {
  return new Date(
    Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate()),
  );
}

export function ehDiaUtil(data: Date, feriados?: Feriados): boolean {
  const dow = data.getUTCDay();
  if (dow === 0 || dow === 6) return false;
  return !feriados?.has(chaveDia(data));
}

// Dias uteis ENTRE duas datas. Mesmo dia = 0. Fim antes do inicio = 0.
export function diasUteisEntre(
  inicio: Date,
  fim: Date,
  feriados?: Feriados,
): number {
  const a = meiaNoiteUTC(inicio);
  const b = meiaNoiteUTC(fim);
  if (b <= a) return 0;

  let dias = 0;
  const cursor = new Date(a);
  while (cursor < b) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (ehDiaUtil(cursor, feriados)) dias += 1;
  }
  return dias;
}

// Data que cai N dias uteis DEPOIS do inicio. Usada pelos prazos que o sistema
// calcula e grava (prazo de conclusao da R.O).
export function somarDiasUteis(
  inicio: Date,
  dias: number,
  feriados?: Feriados,
): Date {
  const data = new Date(inicio.getTime());
  let restantes = dias;
  while (restantes > 0) {
    data.setUTCDate(data.getUTCDate() + 1);
    if (ehDiaUtil(data, feriados)) restantes--;
  }
  return data;
}
