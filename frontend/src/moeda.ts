// Todo valor do sistema e em REAL e aparece no formato brasileiro: R$ 2,34,
// R$ 1.300,00. Uma funcao so para nao ter cada tela formatando do seu jeito.

export function moeda(valor?: number | null): string {
  if (valor == null || Number.isNaN(Number(valor))) return '-';
  return Number(valor).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

// Para os InputNumber: o antd pede o par formatter/parser. O campo mostra
// "R$ 1.300,00" enquanto o valor guardado continua sendo o numero 1300.
export const formatarMoedaInput = (valor?: string | number) => {
  if (valor === undefined || valor === null || valor === '') return '';
  const partes = String(valor).split('.');
  const inteiro = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `R$ ${inteiro}${partes[1] != null ? `,${partes[1]}` : ''}`;
};

export const lerMoedaInput = (texto?: string) =>
  (texto ?? '').replace(/R\$\s?|\./g, '').replace(',', '.');
