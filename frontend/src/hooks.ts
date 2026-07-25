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

export function useItens() {
  return useQuery<any[]>({
    queryKey: ['itens'],
    queryFn: async () => (await api.get('/itens')).data,
  });
}

export function opcoesFornecedor(lista?: any[]) {
  return (lista ?? []).map((f) => ({ value: f.id, label: `${f.codigo} — ${f.nome}` }));
}

export function opcoesItem(lista?: any[]) {
  return (lista ?? []).map((i) => ({
    value: i.id,
    label: `${i.codigo} — ${i.descricao}`,
  }));
}
