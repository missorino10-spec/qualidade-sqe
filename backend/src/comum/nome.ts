// Nome curto para os campos de assinatura dos relatorios.
//
// O cadastro guarda o nome completo, mas a celula do formulario tem largura
// fixa: "Danilo Martins Missorino" nao cabe e empurra o layout. Na assinatura
// o que identifica a pessoa e primeiro nome + sobrenome de familia.
//
// So muda a exibicao - o nome completo continua intacto no banco.

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

function chave(palavra: string): string {
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
  if (SUFIXOS.has(chave(resto[i]))) {
    sufixo = resto[i];
    i--;
  }
  while (i >= 0 && CONECTIVOS.has(chave(resto[i]))) i--;

  return [primeiro, i >= 0 ? resto[i] : '', sufixo].filter(Boolean).join(' ');
}
