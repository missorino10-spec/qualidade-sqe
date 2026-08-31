// Unidade de medida do ITEM (cadastro de itens).
//
// Era campo aberto e virou lista fechada: o mesmo material aparecia como "PC",
// "PÇ", "Peça" e "peca". A lista abaixo e a das unidades usadas no dia a dia da
// fabrica, aprovada com a Qualidade.
//
// O valor gravado e a sigla - e ela que sai na coluna "Unid." e nos relatorios.
export const UNIDADES_ITEM: { value: string; label: string }[] = [
  { value: 'PÇ', label: 'PÇ — Peça' },
  { value: 'UN', label: 'UN — Unidade' },
  { value: 'CJ', label: 'CJ — Conjunto' },
  { value: 'JG', label: 'JG — Jogo' },
  { value: 'PAR', label: 'PAR — Par' },
  { value: 'KG', label: 'KG — Quilograma' },
  { value: 'G', label: 'G — Grama' },
  { value: 'TON', label: 'TON — Tonelada' },
  { value: 'M', label: 'M — Metro' },
  { value: 'MM', label: 'MM — Milímetro' },
  { value: 'M²', label: 'M² — Metro quadrado' },
  { value: 'M³', label: 'M³ — Metro cúbico' },
  { value: 'L', label: 'L — Litro' },
  { value: 'CX', label: 'CX — Caixa' },
  { value: 'RL', label: 'RL — Rolo' },
  { value: 'BR', label: 'BR — Barra' },
  { value: 'CH', label: 'CH — Chapa' },
  { value: 'SC', label: 'SC — Saco' },
];

/**
 * Opcoes do <Select>, ja com o que estiver gravado no item.
 *
 * Os 14.401 itens que vieram da planilha estao sem unidade e um esta como
 * "Peça", fora da lista. Nesses a lista ganha o valor atual marcado como fora
 * da lista: abrir o item para editar nao pode apagar em silencio o que ja
 * estava la, nem travar o formulario num valor que a lista nao tem.
 */
export function opcoesUnidadeItem(atual?: string | null) {
  const valor = String(atual ?? '').trim();
  if (!valor || UNIDADES_ITEM.some((u) => u.value === valor)) {
    return UNIDADES_ITEM;
  }
  return [{ value: valor, label: `${valor} (fora da lista)` }, ...UNIDADES_ITEM];
}
