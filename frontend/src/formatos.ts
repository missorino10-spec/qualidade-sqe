// Datas "puras" (sem hora) — data da inspecao, data de abertura do 8D, data do
// lancamento de CNQ — trafegam como meia-noite UTC: "2026-07-28T00:00:00.000Z".
//
// Formatar isso com dayjs no fuso do navegador (Brasil = UTC-3) transforma
// 28/07 em 27/07. Pior: reabrir um registro para editar gravaria a data um dia
// antes a cada vez. Por isso o trecho ISO e lido direto, sem conversao de fuso.
//
// Datas com hora de verdade (ex.: "aprovado em") continuam usando dayjs normal,
// porque nesse caso o fuso local e justamente o que se quer mostrar.

function trechoIso(valor: string | Date): string {
  return (typeof valor === 'string' ? valor : valor.toISOString()).slice(0, 10);
}

// "2026-07-28T00:00:00.000Z" -> "28/07/2026"
export function dataBR(valor?: string | Date | null): string {
  if (!valor) return '-';
  const [ano, mes, dia] = trechoIso(valor).split('-');
  return `${dia}/${mes}/${ano}`;
}

// "2026-07-28T00:00:00.000Z" -> "2026-07-28" (valor de <input type="date">)
export function dataInput(valor?: string | Date | null): string | undefined {
  if (!valor) return undefined;
  return trechoIso(valor);
}

// O <Statistic> do antd nao segue o locale: por padrao imprime 4,000 e 75.0.
// Espalhar isso nos cards deixa o numero no padrao brasileiro: 4.000 e 75,0.
export const separadoresBR = {
  groupSeparator: '.',
  decimalSeparator: ',',
} as const;
