// Base COMPARTILHADA do MÉTODO 5G.
//
// O conteudo fixo da aba "MÉTODO 5G" da planilha "Analise de Problemas da
// Qualidade - Padrao" mora aqui: os cinco G e as 9 avaliacoes do checklist.
// O frontend tem um espelho em frontend/src/cincog.ts.
//
// O 5G e um documento proprio (5G0001/2026): nem todo problema vira 8D, a
// maioria e resolvida indo ao posto de trabalho e restaurando as condicoes
// normais do processo.

// Os cinco G, na ordem da planilha.
export const CINCO_G: { sigla: string; tema: string; acao: string }[] = [
  { sigla: 'GEMBA', tema: 'Fábrica', acao: 'Vá ao posto de trabalho' },
  { sigla: 'GEMBUTSU', tema: 'Material', acao: 'Examine o fenômeno' },
  { sigla: 'GENJITSU', tema: 'Contexto', acao: 'Verifique os fatos e os dados' },
  { sigla: 'GENRI', tema: 'Teoria', acao: 'Siga a teoria' },
  {
    sigla: 'GENSOKU',
    tema: 'Regras e princípios',
    acao: 'Siga os padrões operacionais',
  },
];

// As 9 avaliacoes fixas da aba "MÉTODO 5G". O inspetor nao cria nem apaga
// linha: ele preenche as colunas de cada avaliacao, como no papel.
export const AVALIACOES_5G: {
  avaliacao: string;
  analise4M: string;
  objetivo: string;
}[] = [
  {
    avaliacao: 'Limpeza e organização',
    analise4M: 'Método',
    objetivo: 'Local limpo e organizado',
  },
  {
    avaliacao: 'Instrumentos de medição',
    analise4M: 'Método',
    objetivo: 'Instrumentos limpos, organizados e calibrados',
  },
  {
    avaliacao: 'Documentação do processo regularizada',
    analise4M: 'Método',
    objetivo: 'Normas, desenhos e parâmetros ok',
  },
  {
    avaliacao: 'Norma Técnica Operacional é clara e objetiva',
    analise4M: 'Método',
    objetivo: 'Norma atualizada e disponível na máquina para o operador',
  },
  {
    avaliacao: 'Condições de manuseio e armazenamento',
    analise4M: 'Material',
    objetivo:
      'Operador conta com local adequado para armazenamento de material bruto',
  },
  {
    avaliacao: 'Operador tem conhecimento e habilidade na atividade',
    analise4M: 'Mão de Obra',
    objetivo: '',
  },
  {
    avaliacao: 'Operador segue instruções de trabalho',
    analise4M: 'Mão de Obra',
    objetivo: '',
  },
  {
    avaliacao: 'Tratamento de não conformidades',
    analise4M: 'Método',
    objetivo: '',
  },
  {
    avaliacao: 'Ferramentas disponíveis e adequadas no posto de trabalho',
    analise4M: 'Máquina',
    objetivo: '',
  },
];

export const NOTA_5G =
  'Para as não conformidades encontradas, incluir evidências do processo investigado sempre que aplicável (foto ou vídeo).';

// Checklist em branco, com as 9 avaliacoes ja postas.
export function checklist5GInicial(): any[] {
  return AVALIACOES_5G.map((a) => ({
    avaliacao: a.avaliacao,
    analise4M: a.analise4M,
    objetivo: a.objetivo,
    especificado: '',
    verificado: '',
    necessitaRestauracao: '',
    comoRestaurar: '',
    responsavel: '',
    prazo: '',
    status: 'PENDENTE',
    eficaz: '',
  }));
}

// As 9 avaliacoes sao fixas: um checklist gravado incompleto (por exemplo, por
// uma chamada direta da API) volta completo, com o que ja foi preenchido no
// lugar certo. Assim nenhuma avaliacao da planilha some do registro.
export function checklist5G(salvo: unknown): any[] {
  const linhas = Array.isArray(salvo) ? salvo : [];
  if (!linhas.length) return checklist5GInicial();
  return checklist5GInicial().map((base, i) => {
    const gravada =
      linhas.find((l: any) => l?.avaliacao === base.avaliacao) ?? linhas[i];
    return gravada ? { ...base, ...gravada, avaliacao: base.avaliacao } : base;
  });
}

// Restauracoes que impedem o fechamento do 5G: avaliacao marcada como
// "necessita restauracao" e ainda sem baixa. Cancelada nao pende - foi
// decidida.
export function restauracoesPendentes(avaliacoes: unknown): any[] {
  return (Array.isArray(avaliacoes) ? avaliacoes : []).filter(
    (l: any) =>
      String(l?.necessitaRestauracao ?? '').toUpperCase() === 'SIM' &&
      l?.status !== 'CONCLUIDA' &&
      l?.status !== 'CANCELADA',
  );
}

// Fotos do 5G: um unico quadro de evidencias do processo investigado.
export const EVID_5G = {
  evidencias: 'CINCO_G_EVID',
} as const;

// Documento que motivou a abertura. Fora de EVID_5G: nao e foto de evidencia.
export const DOC_5G = 'CINCO_G_DOC';
