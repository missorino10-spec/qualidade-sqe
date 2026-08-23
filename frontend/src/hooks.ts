import { useQuery } from '@tanstack/react-query';
import { api } from './api';

export interface OpcaoBasica {
  id: number;
  nome?: string;
  descricao?: string;
  codigo?: string;
}

export function useFornecedores() {
  return useQuery<any[]>({
    queryKey: ['fornecedores'],
    queryFn: async () => (await api.get('/fornecedores')).data,
  });
}

// A base de itens tem ~14.400 codigos: nenhuma tela baixa a lista inteira.
// Quem precisa escolher um item usa o SelectItem/CamposItem, que buscam no
// servidor conforme o usuario digita.

export function opcoesFornecedor(lista?: any[]) {
  return (lista ?? []).map((f) => ({ value: f.id, label: `${f.codigo} — ${f.nome}` }));
}
