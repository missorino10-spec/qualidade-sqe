// Utilitarios do modulo SQD.
// A semana e a numeracao seguem a mesma regra do SQE e da Manufatura
// (semana de domingo a sabado, numero = prefixo + 4 digitos + ano).

export type RespostaSqd = 'SIM' | 'NAO' | 'NA';

// Numeracao dos documentos do SQD: HFOR0001/2026 (homologacao de fornecedor)
// e HITE0001/2026 (homologacao de item).
export function numeroSqd(
  prefixo: 'HFOR' | 'HITE',
  sequencial: number,
  ano: number,
): string {
  return `${prefixo}${String(sequencial).padStart(4, '0')}/${ano}`;
}

// ---------------------------------------------------------------------------
// Catalogo do formulario BDBR.QUA.FMR.024.03 - AUTOAVALIACAO DE FORNECEDORES.
// Transcrito das abas "Auditoria" (textos) e "Criterios" (pontos e pesos).
// Cada bloco soma 100 pontos; os pesos dos 10 blocos somam 100%.
// ---------------------------------------------------------------------------

export type PerguntaSqd = { codigo: string; texto: string; pontos: number };
export type BlocoSqd = {
  letra: string;
  nome: string;
  peso: number;
  perguntas: PerguntaSqd[];
};

export const BLOCOS_AUTOAVALIACAO: BlocoSqd[] = [
  {
    letra: 'A',
    nome: 'Gestão',
    peso: 10,
    perguntas: [
      {
        codigo: 'A1',
        pontos: 40,
        texto:
          'Existe um organograma formal com definição clara de responsabilidades e hierarquia?',
      },
      {
        codigo: 'A2',
        pontos: 30,
        texto:
          'A empresa possui plano estratégico formalizado com metas e indicadores de desempenho?',
      },
      {
        codigo: 'A3',
        pontos: 30,
        texto: 'Há política de compliance e código de conduta implementados?',
      },
    ],
  },
  {
    letra: 'B',
    nome: 'Dados Gerais',
    peso: 10,
    perguntas: [
      {
        codigo: 'B1',
        pontos: 20,
        texto: 'A empresa possui registro formal (CNPJ, IE)?',
      },
      {
        codigo: 'B2',
        pontos: 40,
        texto: 'Os dados cadastrais estão atualizados?',
      },
      {
        codigo: 'B3',
        pontos: 40,
        texto: 'Possui alvarás e licenças necessários à operação?',
      },
    ],
  },
  {
    letra: 'C',
    nome: 'Saúde Financeira',
    peso: 10,
    perguntas: [
      {
        codigo: 'C1',
        pontos: 40,
        texto: 'Possui balanço patrimonial dos últimos 2 anos?',
      },
      {
        codigo: 'C2',
        pontos: 30,
        texto: 'Realiza fechamento contábil mensal e auditoria anual?',
      },
      {
        codigo: 'C3',
        pontos: 30,
        texto: 'Não possui pendências fiscais relevantes?',
      },
    ],
  },
  {
    letra: 'D',
    nome: 'Desenvolvimento de Produtos e Processos',
    peso: 10,
    perguntas: [
      {
        codigo: 'D1',
        pontos: 20,
        texto: 'Realiza projetos de melhoria contínua?',
      },
      {
        codigo: 'D2',
        pontos: 20,
        texto:
          'Existe processo documentado de desenvolvimento de novos produtos?',
      },
      {
        codigo: 'D3',
        pontos: 20,
        texto:
          'Existe padronização para revisão de desenhos e alterações de engenharia?',
      },
      {
        codigo: 'D4',
        pontos: 20,
        texto: 'Há registros de testes e validações de protótipos?',
      },
      {
        codigo: 'D5',
        pontos: 20,
        texto: 'São utilizados planos de controle ou FMEA em novos projetos?',
      },
    ],
  },
  {
    letra: 'E',
    nome: 'Produtos e Processos',
    peso: 15,
    perguntas: [
      {
        codigo: 'E1',
        pontos: 10,
        texto: 'São realizados FMEAs de processo/produto?',
      },
      {
        codigo: 'E2',
        pontos: 10,
        texto: 'A empresa possui rastreabilidade do produto?',
      },
      {
        codigo: 'E3',
        pontos: 20,
        texto:
          'Existem registros de inspeções ou medições em etapas críticas de produção?',
      },
      {
        codigo: 'E4',
        pontos: 20,
        texto: 'Possui procedimentos escritos para processos críticos?',
      },
      {
        codigo: 'E5',
        pontos: 20,
        texto:
          'Existe controle de mudanças de processo (novos equipamentos, métodos)?',
      },
      {
        codigo: 'E6',
        pontos: 10,
        texto:
          'Processos terceirizados possuem critérios de monitoramento definidos?',
      },
      {
        codigo: 'E7',
        pontos: 10,
        texto:
          'Existem instruções de trabalho ou padrões de processo definidos?',
      },
    ],
  },
  {
    // A planilha pula o F5 (vai de F4 para F6); aqui a numeracao foi
    // regularizada para F1..F5, mantendo a ordem e os pontos originais.
    letra: 'F',
    nome: 'Produção',
    peso: 10,
    perguntas: [
      {
        codigo: 'F1',
        pontos: 20,
        texto: 'A empresa possui plano de manutenção preventiva?',
      },
      {
        codigo: 'F2',
        pontos: 20,
        texto: 'Existem instruções de trabalho visíveis?',
      },
      {
        codigo: 'F3',
        pontos: 20,
        texto:
          'A produção segue um planejamento formal (ordens, sequenciamento)?',
      },
      {
        codigo: 'F4',
        pontos: 20,
        texto:
          'Há indicadores de eficiência (OEE, produtividade, refugo, retrabalho)?',
      },
      {
        codigo: 'F5',
        pontos: 20,
        texto:
          'Os operadores são treinados e certificados para os postos de trabalho críticos?',
      },
    ],
  },
  {
    letra: 'G',
    nome: 'Qualidade',
    peso: 15,
    perguntas: [
      {
        codigo: 'G1',
        pontos: 5,
        texto: 'Possui certificação ISO 9001 ou similar?',
      },
      {
        codigo: 'G2',
        pontos: 20,
        texto:
          'Existe sistema de inspeção de entrada de materiais e inspeção final?',
      },
      {
        codigo: 'G3',
        pontos: 10,
        texto:
          'São aplicados checklists ou instruções de inspeção de processo/produto?',
      },
      {
        codigo: 'G4',
        pontos: 20,
        texto: 'Há registros de não conformidades e tratativas internas? PDCA?',
      },
      {
        codigo: 'G5',
        pontos: 20,
        texto:
          'Reclamações de clientes são registradas, analisadas e respondidas formalmente?',
      },
      {
        codigo: 'G6',
        pontos: 5,
        texto:
          'Existe sistema de segregação e identificação de materiais conformes/não conformes?',
      },
      {
        codigo: 'G7',
        pontos: 5,
        texto: 'Possui Procedimento de Controle/Revisão de documentos?',
      },
      {
        codigo: 'G8',
        pontos: 5,
        texto: 'Possui Gestão de calibração de instrumentos de medição?',
      },
      {
        codigo: 'G9',
        pontos: 10,
        texto: 'Existem indicadores de Qualidade (PPM, % Conformidade)?',
      },
    ],
  },
  {
    letra: 'H',
    nome: 'Logística',
    peso: 10,
    perguntas: [
      {
        codigo: 'H1',
        pontos: 20,
        texto:
          'A empresa possui controle de estoque formal (mesmo que manual)?',
      },
      {
        codigo: 'H2',
        pontos: 20,
        texto:
          'Existe controle de recebimento e expedição (registro de entrada/saída)?',
      },
      {
        codigo: 'H3',
        pontos: 20,
        texto: 'Há procedimentos de embalagem padronizados?',
      },
      {
        codigo: 'H4',
        pontos: 20,
        texto: 'Produtos são armazenados com identificação adequada?',
      },
      {
        codigo: 'H5',
        pontos: 20,
        texto:
          'Há critérios de preservação de produto final (embalagem, empilhamento, etc.)?',
      },
    ],
  },
  {
    letra: 'I',
    nome: 'Competitividade',
    peso: 5,
    perguntas: [
      {
        codigo: 'I1',
        pontos: 30,
        texto: 'Há programa de redução de custos operacionais ativo?',
      },
      {
        codigo: 'I2',
        pontos: 30,
        texto:
          'Há programa de fidelização ou parcerias de longo prazo em clientes?',
      },
      {
        codigo: 'I3',
        pontos: 40,
        texto:
          'Existe análise de satisfação de clientes realizada periodicamente?',
      },
    ],
  },
  {
    letra: 'J',
    nome: 'Meio Ambiente (ESG)',
    peso: 5,
    perguntas: [
      {
        codigo: 'J1',
        pontos: 10,
        texto: 'Possui certificação ISO 14001 ou similar?',
      },
      {
        codigo: 'J2',
        pontos: 20,
        texto:
          'A empresa possui práticas básicas de separação de resíduos e reciclagem?',
      },
      {
        codigo: 'J3',
        pontos: 40,
        texto: 'O fornecedor cumpre a legislação ambiental aplicável?',
      },
      {
        codigo: 'J4',
        pontos: 30,
        texto:
          'Existe preocupação com saúde e segurança dos colaboradores (EPI, treinamentos)?',
      },
    ],
  },
];

export const CODIGOS_AUTOAVALIACAO = BLOCOS_AUTOAVALIACAO.flatMap((b) =>
  b.perguntas.map((p) => p.codigo),
);

// ---------------------------------------------------------------------------
// Calculo do resultado (abas "Criterios" e "Resultados").
// ---------------------------------------------------------------------------

export type BlocoCalculado = {
  letra: string;
  nome: string;
  peso: number;
  pontuacao: number; // 0 a 100 dentro do bloco
  ponderada: number; // pontuacao * peso / 100
  critico: boolean; // bloco abaixo de 90 (o relatorio destaca esses)
  reprovadas: { codigo: string; texto: string }[];
  naoAplicaveis: string[];
};

export type ResultadoCalculado = {
  blocos: BlocoCalculado[];
  nota: number;
  resultado: 'APROVADO' | 'APROVADO_CONDICIONALMENTE' | 'REPROVADO';
};

function arredondar(v: number, casas = 2): number {
  const f = 10 ** casas;
  return Math.round(v * f) / f;
}

// Faixas confirmadas com a Qualidade:
//   >= 90         -> Aprovado
//   80 a 89,99    -> Aprovado condicionalmente
//   < 80          -> Reprovado
export function classificarNota(
  nota: number,
): 'APROVADO' | 'APROVADO_CONDICIONALMENTE' | 'REPROVADO' {
  if (nota >= 90) return 'APROVADO';
  if (nota >= 80) return 'APROVADO_CONDICIONALMENTE';
  return 'REPROVADO';
}

// "Sim" ganha os pontos da pergunta, "Nao" ganha zero. Uma pergunta marcada
// como "N/A" sai da conta e o bloco e rebalanceado para 100 pontos - assim o
// N/A nao penaliza o fornecedor. Se o bloco inteiro for N/A, ele conta como
// 100 (nao ha o que avaliar).
export function calcularAutoavaliacao(
  respostas: Record<string, RespostaSqd>,
): ResultadoCalculado {
  const blocos: BlocoCalculado[] = BLOCOS_AUTOAVALIACAO.map((b) => {
    let base = 0; // soma dos pontos das perguntas avaliadas (sem N/A)
    let obtidos = 0;
    const reprovadas: { codigo: string; texto: string }[] = [];
    const naoAplicaveis: string[] = [];

    for (const p of b.perguntas) {
      const r = respostas[p.codigo] ?? 'NAO';
      if (r === 'NA') {
        naoAplicaveis.push(p.codigo);
        continue;
      }
      base += p.pontos;
      if (r === 'SIM') obtidos += p.pontos;
      else reprovadas.push({ codigo: p.codigo, texto: p.texto });
    }

    const pontuacao = base === 0 ? 100 : arredondar((obtidos / base) * 100);
    return {
      letra: b.letra,
      nome: b.nome,
      peso: b.peso,
      pontuacao,
      ponderada: arredondar((pontuacao * b.peso) / 100),
      critico: pontuacao < 90,
      reprovadas,
      naoAplicaveis,
    };
  });

  const nota = arredondar(
    blocos.reduce((s, b) => s + (b.pontuacao * b.peso) / 100, 0),
  );

  return { blocos, nota, resultado: classificarNota(nota) };
}

// Contagem em DIAS UTEIS (segunda a sexta) entre duas datas. Mesmo dia = 0.
// Serve para os tres relogios da homologacao: a resposta do fornecedor, o lead
// time da planilha e o tempo total ate o fechamento.
export function diasUteisEntre(inicio: Date, fim: Date): number {
  const a = new Date(
    Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), inicio.getUTCDate()),
  );
  const b = new Date(
    Date.UTC(fim.getUTCFullYear(), fim.getUTCMonth(), fim.getUTCDate()),
  );
  if (b <= a) return 0;

  let dias = 0;
  const cursor = new Date(a);
  while (cursor < b) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const dow = cursor.getUTCDay();
    if (dow !== 0 && dow !== 6) dias += 1;
  }
  return dias;
}

// Prazo da planilha (aba "KPI's"): da solicitacao ate o envio do relatorio.
export const SLA_HOMOLOGACAO_DIAS = 3;
// Prazo dado ao fornecedor para devolver a autoavaliacao, contado da abertura
// do registro (a data da solicitacao e a mesma em que o formulario e enviado).
export const SLA_RESPOSTA_FORNECEDOR_DIAS = 3;

// Lista de validacao da coluna "Ação" do FMR.029.01. O texto e o da planilha;
// no banco fica o codigo, para a redacao poder mudar sem mexer nos registros.
export const ACOES_HOMOLOGACAO: Record<string, string> = {
  FORNECEDOR_NOTIFICADO_DECISAO:
    'Fornecedor notificado sobre decisão; Aguardando retorno.',
  FORNECEDOR_NOTIFICADO_APROVACAO: 'Fornecedor notificado sobre aprovação.',
  ACAO_INTERNA_NECESSARIA:
    'Ação interna necessária; Aguardando retorno do setor responsável.',
  AGUARDANDO_DOCUMENTOS: 'Aguardando envio dos documentos para análise.',
  RELATORIO_SUBMETIDO_COMPRAS:
    'Relatório submetido a compras; Aguardando definição.',
};

export const CODIGOS_ACAO = Object.keys(ACOES_HOMOLOGACAO);
