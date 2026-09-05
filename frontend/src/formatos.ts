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

// Nome curto para os campos de assinatura - mesma regra do backend
// (src/comum/nome.ts), para a tela e o PDF nunca divergirem.
//
// O cadastro guarda o nome completo; a assinatura mostra primeiro nome +
// sobrenome de familia, que e o que identifica a pessoa e cabe na celula.

const CONECTIVOS = new Set([
  'de',
  'da',
  'das',
  'do',
  'dos',
  'e',
  'di',
  'del',
  'della',
  'van',
  'von',
  'y',
]);

// Sufixo geracional nao e sobrenome: sem tratar isso, "Joao Pedro Silva
// Junior" viraria "Joao Junior" e perderia o sobrenome de familia.
const SUFIXOS = new Set([
  'filho',
  'filha',
  'neto',
  'neta',
  'netto',
  'junior',
  'jr',
  'sobrinho',
  'segundo',
]);

function chaveNome(palavra: string): string {
  return palavra
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\./g, '')
    .toLowerCase();
}

export function nomeCurto(nome?: string | null): string {
  const partes = String(nome ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (partes.length <= 2) return partes.join(' ');

  const primeiro = partes[0];
  const resto = partes.slice(1);

  let i = resto.length - 1;
  let sufixo = '';
  if (SUFIXOS.has(chaveNome(resto[i]))) {
    sufixo = resto[i];
    i--;
  }
  while (i >= 0 && CONECTIVOS.has(chaveNome(resto[i]))) i--;

  return [primeiro, i >= 0 ? resto[i] : '', sufixo].filter(Boolean).join(' ');
}

// O <Statistic> do antd nao segue o locale: por padrao imprime 4,000 e 75.0.
// Espalhar isso nos cards deixa o numero no padrao brasileiro: 4.000 e 75,0.
export const separadoresBR = {
  groupSeparator: '.',
  decimalSeparator: ',',
} as const;

// Numero no padrao brasileiro: ponto no milhar, virgula no decimal e sempre a
// mesma quantidade de casas. Uma funcao so para nao aparecer "50.0%" ao lado de
// "526.306,40" na mesma fileira de cartoes.
export function numeroBR(valor?: number | null, casas = 0): string {
  return Number(valor ?? 0).toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}
