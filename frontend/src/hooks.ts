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

/**
 * Instrumentos ativos, para a coluna INSTRUMENTO UTILIZADO da grade de cotas.
 * A lista e pequena (52) e igual nos tres modulos, entao vem inteira e fica em
 * cache: o inspetor escolhe sem esperar busca no servidor.
 */
export function useInstrumentos() {
  return useQuery<any[]>({
    queryKey: ['instrumentos', 'ativos'],
    queryFn: async () => (await api.get('/instrumentos')).data,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * O que fica gravado na cota e o texto, nao o id: assim o relatorio antigo
 * continua legivel e o PDF nao precisa consultar o cadastro.
 *
 * No relatorio vale a TAG do instrumento, so ela: e por ela que se chega ao
 * certificado de calibracao. O nome do equipamento so aparece em quem ainda
 * nao tem TAG cadastrada (36 dos 53) - sem isso esses instrumentos ficariam
 * com o rotulo em branco e ninguem conseguiria escolher.
 */
export function rotuloInstrumento(i: any): string {
  const codigo = String(i?.codigo ?? '').trim();
  const equipamento = String(i?.equipamento ?? '').trim();
  if (!codigo || codigo === '-') return equipamento;
  return codigo;
}

export function opcoesInstrumento(lista?: any[]) {
  const hoje = new Date();
  const vistos = new Set<string>();
  const opcoes: { value: string; label: string }[] = [];

  for (const i of lista ?? []) {
    const rotulo = rotuloInstrumento(i);
    // Duas TAGs iguais no cadastro viram uma opcao so: com o mesmo valor nas
    // duas o inspetor nao teria como diferenciar, e o que fica gravado na cota
    // seria identico de qualquer jeito. Na tela de Cadastros os dois continuam
    // aparecendo, para poderem ser corrigidos.
    if (!rotulo || vistos.has(rotulo)) continue;
    vistos.add(rotulo);

    // Instrumento com calibracao vencida continua na lista, mas avisado: some-lo
    // faria o inspetor achar que o instrumento sumiu do cadastro.
    const vencido =
      !!i.proximaCalibracao && new Date(i.proximaCalibracao) < hoje;
    opcoes.push({
      value: rotulo,
      label: vencido ? `${rotulo} (calibração vencida)` : rotulo,
    });
  }
  return opcoes;
}
