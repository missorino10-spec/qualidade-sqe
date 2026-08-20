// Base COMPARTILHADA do 8D / Analise de Problemas da Qualidade.
//
// O conteudo fixo da planilha "Analise de Problemas da Qualidade - Padrao"
// mora aqui: as espinhas do diagrama 6M + 1D e as situacoes das acoes.
//
// ESPELHO de backend/src/comum/oitod.ts. Ao mexer aqui, mexa la tambem.
//
// O Metodo 5G nao mora mais aqui: virou documento proprio (src/cincog.ts).

// ---------------------------------------------------------------------------
// Passo 2 - espinha de peixe (6M + 1D)
// A planilha tem SETE espinhas: os 6M classicos mais "Projeto" (o 1D).
// A ordem e a mesma do desenho, de cima para baixo e da esquerda para a
// direita: as tres primeiras saem por cima, as quatro ultimas por baixo.
// ---------------------------------------------------------------------------
export type Espinha = {
  chave: string;
  label: string;
  lado: 'cima' | 'baixo';
};

export const ESPINHAS_6M: Espinha[] = [
  { chave: 'medicao', label: 'Medição', lado: 'cima' },
  { chave: 'maquina', label: 'Máquina', lado: 'cima' },
  { chave: 'meioAmbiente', label: 'Meio Ambiente', lado: 'cima' },
  { chave: 'metodo', label: 'Método', lado: 'baixo' },
  { chave: 'material', label: 'Material', lado: 'baixo' },
  { chave: 'maoDeObra', label: 'Mão de Obra', lado: 'baixo' },
  { chave: 'projeto', label: 'Projeto', lado: 'baixo' },
];

// ---------------------------------------------------------------------------
// Situacao das acoes (usada tambem pelo checklist do 5G)
// ---------------------------------------------------------------------------
export const SITUACOES_ACAO: { value: string; label: string }[] = [
  { value: 'PENDENTE', label: 'Pendente' },
  { value: 'EM_ANDAMENTO', label: 'Em andamento' },
  { value: 'CONCLUIDA', label: 'Concluída' },
  { value: 'CANCELADA', label: 'Cancelada' },
];

export const labelSituacaoAcao: Record<string, string> = Object.fromEntries(
  SITUACOES_ACAO.map((s) => [s.value, s.label]),
);

// A situacao vinha como texto livre no formato antigo ("Concluído", "Em
// andamento"). Aqui ela volta para a lista fechada da planilha.
export function situacaoAcao(valor: any): string {
  const cru = String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
  if (!cru) return 'PENDENTE';
  if (SITUACOES_ACAO.some((s) => s.value === cru)) return cru;
  if (cru.startsWith('CONCLUID')) return 'CONCLUIDA';
  if (cru.startsWith('CANCELAD')) return 'CANCELADA';
  if (cru.startsWith('EM_ANDAMENTO')) return 'EM_ANDAMENTO';
  return 'PENDENTE';
}

// ---------------------------------------------------------------------------
// Compatibilidade com os 8D abertos antes desta tela
// O plano de acao antigo tinha as colunas acao/tipo/responsavel/prazo/status e
// os 5 porques eram uma lista solta. Nada disso e apagado: na leitura, cada
// registro antigo e traduzido para o formato da planilha, e o proximo "Salvar"
// grava ja no novo. Sem isso, um 8D ja preenchido abriria em branco.
// ---------------------------------------------------------------------------
// O texto antigo veio colado do Excel e carrega tabulacoes no fim: elas somem
// na traducao para nao aparecerem na tela nem no PDF.
function limpo(valor: any): string {
  return String(valor ?? '')
    .replace(/[\t\r\n]+/g, ' ')
    .trim();
}

export function planoAcaoNormalizado(planoAcao: unknown): any[] {
  return (Array.isArray(planoAcao) ? planoAcao : []).map((a: any) => {
    if (a?.oQue !== undefined || a?.acao === undefined) {
      return { ...a, situacao: situacaoAcao(a?.situacao) };
    }
    const como = [a.tipo ? `Tipo: ${limpo(a.tipo)}` : '', limpo(a.evidencia)]
      .filter(Boolean)
      .join(' — ');
    return {
      oQue: limpo(a.acao),
      porQue: '',
      como,
      quem: limpo(a.responsavel),
      quando: limpo(a.prazo),
      custo: null,
      situacao: situacaoAcao(a.status),
    };
  });
}

export function causasPotenciaisNormalizadas(
  causasPotenciais: unknown,
  porques: unknown,
  causaRaiz?: string | null,
): any[] {
  const novas = Array.isArray(causasPotenciais) ? causasPotenciais : [];
  if (novas.length) return novas;

  const antigos = (Array.isArray(porques) ? porques : []).map((p) => limpo(p));
  if (!antigos.some(Boolean)) return [];
  return [
    {
      causa: limpo(causaRaiz),
      porque1: antigos[0] ?? '',
      porque2: antigos[1] ?? '',
      porque3: antigos[2] ?? '',
      porque4: antigos[3] ?? '',
      porque5: antigos[4] ?? '',
    },
  ];
}

// Uma acao cancelada nao pende: ela foi decidida. Linha em branco tambem nao
// conta, senao a linha vazia que o usuario acabou de adicionar travaria o 8D.
export function acaoPendente(acao: any): boolean {
  if (!acao) return false;
  const preenchida = ['oQue', 'porQue', 'como', 'quem', 'quando'].some(
    (c) => String(acao[c] ?? '').trim() !== '',
  );
  if (!preenchida) return false;
  return acao.situacao !== 'CONCLUIDA' && acao.situacao !== 'CANCELADA';
}

// Acoes que impedem o fechamento do 8D (Passo 3 - Plano de Acao).
export function acoesPendentes(planoAcao: unknown): any[] {
  return (Array.isArray(planoAcao) ? planoAcao : []).filter(acaoPendente);
}

// ---------------------------------------------------------------------------
// Fotos: cada passo da planilha tem o seu proprio quadro de imagem.
// ---------------------------------------------------------------------------
export const EVID_8D = {
  // Valor antigo, mantido para nao perder as fotos ja anexadas.
  geral: 'OITO_D',
  situacaoAtual: 'OITO_D_SITUACAO',
  estratificacao: 'OITO_D_PARETO',
  resultados: 'OITO_D_RESULTADOS',
} as const;
