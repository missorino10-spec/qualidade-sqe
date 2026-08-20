// Monta a frase de pendencias que aparece na tela e nos PDFs oficiais de
// homologacao e auditoria. Juntar a lista com virgulas gerava textos errados
// ("Ainda falta a autoavaliacao, o relatorio, a acao."): o verbo precisa
// concordar com o numero de itens e o ultimo item vem ligado por "e".
export function fraseFaltas(faltas: string[]): string {
  const itens = faltas.filter(Boolean);
  if (!itens.length) return '';
  const verbo = itens.length > 1 ? 'Ainda faltam' : 'Ainda falta';
  const lista =
    itens.length > 1
      ? `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`
      : itens[0];
  return `${verbo} ${lista}`;
}
