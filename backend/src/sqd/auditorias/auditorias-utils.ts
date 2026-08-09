// Catalogo e motor de nota da AUDITORIA DE FORNECEDORES.
//
// Transcrito da planilha "Checklist Auditoria": a aba "Checklist (2)" traz os
// textos das 46 perguntas, a aba "Pontuacao" traz os pesos e a aba "Resumo"
// traz a media por bloco e a regua de classificacao.
//
// Duas correcoes de aritmetica em relacao a planilha, fechadas com a Qualidade:
//
//   1. Os pesos dos 12 blocos somam 110% na planilha (que mesmo assim imprime
//      "TOTAL 1"). Aqui a nota e normalizada pela soma dos pesos dos blocos
//      efetivamente avaliados, entao "tudo Sim" da exatamente 100,0 e um bloco
//      inteiro em N/A sai da conta e rebalanceia o restante sozinho.
//
//   2. Na planilha a formula da coluna "Pontuacao" so existe na primeira linha,
//      entao o AVERAGEIF do Resumo media apenas as linhas Sim/Parcial e descarta
//      silenciosamente todo "Nao". Aqui "Nao" vale zero e entra na media.

export type RespostaAuditoria = 'SIM' | 'PARCIAL' | 'NAO' | 'NAO_APLICAVEL';

// Legenda da aba "Resumo": Sim = 1.0 | Parcial = 0.5 | Nao = 0.0 | N/A = fora
const VALOR_RESPOSTA: Record<Exclude<RespostaAuditoria, 'NAO_APLICAVEL'>, number> =
  {
    SIM: 1,
    PARCIAL: 0.5,
    NAO: 0,
  };

export type PerguntaAuditoria = { codigo: string; texto: string };
export type BlocoAuditoria = {
  codigo: string;
  nome: string;
  peso: number; // peso do bloco em pontos percentuais, como na planilha
  perguntas: PerguntaAuditoria[];
};

export const BLOCOS_AUDITORIA: BlocoAuditoria[] = [
  {
    codigo: '4.1',
    nome: 'Abertura e governança',
    peso: 5,
    perguntas: [
      {
        codigo: '4.1.1',
        texto:
          'Existe responsável definido pelo processo do item e pelo plano de ação da RNC (owner)?',
      },
      {
        codigo: '4.1.2',
        texto:
          'Qual a definição interna de item crítico e quais controles adicionais são aplicados?',
      },
      {
        codigo: '4.1.3',
        texto:
          'Histórico do desvio: quando começou, recorrência, impacto e ações já tomadas.',
      },
    ],
  },
  {
    codigo: '4.2',
    nome: 'Desenvolvimento / mudanças de engenharia',
    peso: 10,
    perguntas: [
      { codigo: '4.2.1', texto: 'Realiza projetos de melhoria contínua?' },
      {
        codigo: '4.2.2',
        texto:
          'Existe processo documentado de desenvolvimento de novos produtos?',
      },
      {
        codigo: '4.2.3',
        texto:
          'Existe padronização para revisão de desenhos e alterações de engenharia (ECN/ECO)?',
      },
      {
        codigo: '4.2.4',
        texto:
          'Há registros de testes e validações de protótipos (quando aplicável)?',
      },
      {
        codigo: '4.2.5',
        texto:
          'São utilizados PFMEA/DFMEA e/ou plano de controle em novos projetos/mudanças relevantes?',
      },
    ],
  },
  {
    codigo: '4.3',
    nome: 'Gestão de documentação e instruções',
    peso: 10,
    perguntas: [
      {
        codigo: '4.3.1',
        texto: 'Existe procedimento de controle e revisão de documentos?',
      },
      {
        codigo: '4.3.2',
        texto:
          'Existem instruções de trabalho/padrões de processo definidos para etapas críticas e disponíveis aos operadores?',
      },
      {
        codigo: '4.3.3',
        texto: 'Existem procedimentos escritos para processos críticos?',
      },
    ],
  },
  {
    codigo: '4.4',
    nome: 'Planejamento e controle de produção (PCP)',
    peso: 10,
    perguntas: [
      {
        codigo: '4.4.1',
        texto: 'A produção segue um planejamento formal (ordens, sequenciamento)?',
      },
      {
        codigo: '4.4.2',
        texto:
          'A revisão do desenho está indicada na OP e nos documentos de processo?',
      },
      {
        codigo: '4.4.3',
        texto:
          'Existe controle de mudanças de processo (novos equipamentos, métodos) e como o PCP é comunicado?',
      },
    ],
  },
  {
    codigo: '4.5',
    nome: 'Materiais e logística (recebimento/armazenagem/expedição)',
    peso: 15,
    perguntas: [
      {
        codigo: '4.5.1',
        texto:
          'Existe controle formal de estoque e registros de recebimento/expedição?',
      },
      {
        codigo: '4.5.2',
        texto:
          'Existe inspeção de entrada de materiais e critérios de aceitação definidos?',
      },
      {
        codigo: '4.5.3',
        texto:
          'Como tratam material fora de especificação (segregação e bloqueio)?',
      },
      {
        codigo: '4.5.4',
        texto:
          'Produtos/materiais são armazenados com identificação adequada e critérios de preservação?',
      },
      {
        codigo: '4.5.5',
        texto:
          'Há procedimentos de embalagem padronizados e controles para evitar deformação/danos?',
      },
      {
        codigo: '4.5.6',
        texto: 'Existe rastreabilidade do material/lote até o produto expedido?',
      },
    ],
  },
  {
    codigo: '4.6',
    nome: 'Produtos e processos (FMEA / controle / terceirizados)',
    peso: 15,
    perguntas: [
      { codigo: '4.6.1', texto: 'São realizados FMEAs de processo/produto?' },
      {
        codigo: '4.6.2',
        texto:
          'Existem registros de inspeções ou medições em etapas críticas de produção?',
      },
      {
        codigo: '4.6.3',
        texto:
          'Processos terceirizados possuem critérios de monitoramento definidos?',
      },
    ],
  },
  {
    codigo: '4.7',
    nome: 'Produção — execução e estabilidade',
    peso: 15,
    perguntas: [
      {
        codigo: '4.7.1',
        texto:
          'Quais operações geram as dimensões críticas (corte, dobra, furação, solda, montagem etc.) e como são controladas?',
      },
      {
        codigo: '4.7.2',
        texto:
          'Quais parâmetros são críticos e como são definidos/registrados (pressão, curso, batentes, programas CNC)?',
      },
      {
        codigo: '4.7.3',
        texto: 'Existe checklist de setup e aprovação de 1ª peça (First Article)?',
      },
      {
        codigo: '4.7.4',
        texto:
          'Existe registro de inspeção em processo e plano de reação quando a medida foge do especificado?',
      },
    ],
  },
  {
    codigo: '4.8',
    nome: 'Manutenção e confiabilidade dos equipamentos',
    peso: 10,
    perguntas: [
      {
        codigo: '4.8.1',
        texto:
          'Existe plano de manutenção preventiva e registros de execução (datas, atividades, responsáveis)?',
      },
      {
        codigo: '4.8.2',
        texto:
          'Como controlam quebras/manutenção corretiva e o impacto no produto (reinspeção pós-manutenção, nova liberação de setup)?',
      },
      {
        codigo: '4.8.3',
        texto:
          'Existe critério para bloquear produção quando equipamento apresenta instabilidade (folga, desgaste, repetibilidade)?',
      },
      {
        codigo: '4.8.4',
        texto:
          'Há verificação periódica de gabaritos/dispositivos de produção (além dos instrumentos de medição)?',
      },
    ],
  },
  {
    codigo: '4.9',
    nome: 'Qualidade — sistema e gestão de NC',
    peso: 7,
    perguntas: [
      { codigo: '4.9.1', texto: 'Possui certificação ISO 9001 ou similar?' },
      {
        codigo: '4.9.2',
        texto: 'Existe sistema de inspeção de entrada e inspeção final?',
      },
      {
        codigo: '4.9.3',
        texto:
          'São aplicados checklists/instruções de inspeção de processo/produto e existem registros?',
      },
      {
        codigo: '4.9.4',
        texto:
          'Existe sistema de segregação e identificação de materiais conformes/não conformes?',
      },
      {
        codigo: '4.9.5',
        texto: 'Há registros de não conformidades internas e tratativas (PDCA/8D)?',
      },
      {
        codigo: '4.9.6',
        texto:
          'Reclamações de clientes são registradas, analisadas e respondidas formalmente?',
      },
      {
        codigo: '4.9.7',
        texto:
          'Existem indicadores de Qualidade (PPM, % conformidade) e são analisados?',
      },
    ],
  },
  {
    codigo: '4.10',
    nome: 'Metrologia e medição',
    peso: 7,
    perguntas: [
      {
        codigo: '4.10.1',
        texto:
          'Qual método de medição para a(s) dimensão(ões) crítica(s): instrumento, fixação e pontos de medição.',
      },
      {
        codigo: '4.10.2',
        texto:
          'Existe gestão de calibração de instrumentos de medição e certificados válidos?',
      },
      {
        codigo: '4.10.3',
        texto:
          'Existe MSA (R&R) para a medição crítica ou validação interna equivalente?',
      },
      {
        codigo: '4.10.4',
        texto:
          'Existe alinhamento entre inspeção em processo x inspeção final (mesmo critério e método)?',
      },
    ],
  },
  {
    codigo: '4.12',
    nome: 'Indicadores de eficiência e produtividade',
    peso: 3,
    perguntas: [
      {
        codigo: '4.12.1',
        texto:
          'Há indicadores de eficiência (OEE, produtividade, refugo, retrabalho)?',
      },
      {
        codigo: '4.12.2',
        texto:
          'Como os indicadores são usados para ações de melhoria e prevenção de NC?',
      },
    ],
  },
  {
    codigo: '4.13',
    nome: 'Treinamento e competência',
    peso: 3,
    perguntas: [
      {
        codigo: '4.13.1',
        texto:
          'Os operadores são treinados e certificados para os postos de trabalho críticos?',
      },
      {
        codigo: '4.13.2',
        texto: 'Como é feita a reciclagem e o controle de mudança de operador?',
      },
    ],
  },
];

export const CODIGOS_AUDITORIA = BLOCOS_AUDITORIA.flatMap((b) =>
  b.perguntas.map((p) => p.codigo),
);

export const TOTAL_PERGUNTAS_AUDITORIA = CODIGOS_AUDITORIA.length; // 46

// ---------------------------------------------------------------------------
// Calculo da nota
// ---------------------------------------------------------------------------

export type ClassificacaoBloco = 'SATISFATORIO' | 'ATENCAO' | 'CRITICO';

export type BlocoAuditoriaCalculado = {
  codigo: string;
  nome: string;
  peso: number;
  pontuacao: number | null; // 0 a 100 dentro do bloco; null = bloco inteiro em N/A
  ponderada: number; // contribuicao do bloco na nota final (ja normalizada)
  classificacao: ClassificacaoBloco | null;
  respondidas: number;
  naoAplicaveis: number;
  criticas: { codigo: string; texto: string; resposta: RespostaAuditoria }[];
};

export type ResultadoAuditoriaCalculado = {
  blocos: BlocoAuditoriaCalculado[];
  nota: number;
  resultado: 'APROVADO' | 'APROVADO_CONDICIONALMENTE' | 'REPROVADO';
};

function arredondar(v: number, casas = 2): number {
  const f = 10 ** casas;
  return Math.round(v * f) / f;
}

// Regua da aba "Resumo", com o vocabulario do relatorio de auditoria:
//   >= 90% Satisfatorio | >= 70% Atencao | < 70% Critico
export function classificarBloco(pontuacao: number): ClassificacaoBloco {
  if (pontuacao >= 90) return 'SATISFATORIO';
  if (pontuacao >= 70) return 'ATENCAO';
  return 'CRITICO';
}

// Regra de nota definida pela Qualidade:
//   >= 90      -> Aprovado
//   80 a 89,99 -> Aprovado condicionalmente
//   < 80       -> Reprovado
export function classificarAuditoria(
  nota: number,
): 'APROVADO' | 'APROVADO_CONDICIONALMENTE' | 'REPROVADO' {
  if (nota >= 90) return 'APROVADO';
  if (nota >= 80) return 'APROVADO_CONDICIONALMENTE';
  return 'REPROVADO';
}

export function calcularAuditoria(
  respostas: Record<string, RespostaAuditoria>,
): ResultadoAuditoriaCalculado {
  const parciais = BLOCOS_AUDITORIA.map((b) => {
    let soma = 0;
    let respondidas = 0;
    let naoAplicaveis = 0;
    const criticas: BlocoAuditoriaCalculado['criticas'] = [];

    for (const p of b.perguntas) {
      const r = respostas[p.codigo] ?? 'NAO';
      if (r === 'NAO_APLICAVEL') {
        naoAplicaveis += 1;
        continue;
      }
      soma += VALOR_RESPOSTA[r];
      respondidas += 1;
      if (r !== 'SIM') criticas.push({ codigo: p.codigo, texto: p.texto, resposta: r });
    }

    // Bloco inteiro em N/A nao e avaliado: sai da conta e o peso dele e
    // redistribuido entre os demais pela normalizacao abaixo.
    const pontuacao =
      respondidas === 0 ? null : arredondar((soma / respondidas) * 100);

    return {
      codigo: b.codigo,
      nome: b.nome,
      peso: b.peso,
      pontuacao,
      ponderada: 0,
      classificacao: pontuacao === null ? null : classificarBloco(pontuacao),
      respondidas,
      naoAplicaveis,
      criticas,
    } as BlocoAuditoriaCalculado;
  });

  // Normalizacao: os pesos da planilha somam 110, entao a nota e dividida pela
  // soma dos pesos dos blocos avaliados. Tudo "Sim" fecha 100,0.
  const pesoAvaliado = parciais.reduce(
    (s, b) => s + (b.pontuacao === null ? 0 : b.peso),
    0,
  );

  const blocos = parciais.map((b) => ({
    ...b,
    ponderada:
      b.pontuacao === null || pesoAvaliado === 0
        ? 0
        : arredondar((b.pontuacao * b.peso) / pesoAvaliado),
  }));

  const nota =
    pesoAvaliado === 0
      ? 0
      : arredondar(
          blocos.reduce(
            (s, b) => s + (b.pontuacao === null ? 0 : b.pontuacao * b.peso),
            0,
          ) / pesoAvaliado,
        );

  return { blocos, nota, resultado: classificarAuditoria(nota) };
}

// ---------------------------------------------------------------------------
// Reavaliacao
// ---------------------------------------------------------------------------

// Prazos definidos pela Qualidade, em DIAS CORRIDOS (prazo de calendario),
// contados da data da rodada que gerou o resultado. Aprovado nao reavalia.
export const PRAZO_REAVALIACAO_DIAS: Record<string, number> = {
  REPROVADO: 90,
  APROVADO_CONDICIONALMENTE: 180,
};

export function prazoReavaliacaoDias(resultado?: string | null): number | null {
  if (!resultado) return null;
  return PRAZO_REAVALIACAO_DIAS[resultado] ?? null;
}

export function somarDiasCorridos(data: Date, dias: number): Date {
  const d = new Date(
    Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate()),
  );
  d.setUTCDate(d.getUTCDate() + dias);
  return d;
}

// Dias corridos entre duas datas. Positivo = falta prazo, negativo = vencido.
export function diasCorridosEntre(inicio: Date, fim: Date): number {
  const a = Date.UTC(
    inicio.getUTCFullYear(),
    inicio.getUTCMonth(),
    inicio.getUTCDate(),
  );
  const b = Date.UTC(fim.getUTCFullYear(), fim.getUTCMonth(), fim.getUTCDate());
  return Math.round((b - a) / 86400000);
}

// Semaforo do prazo de reavaliacao, usado na lista e no detalhe:
//   VERDE    - no prazo
//   AMARELO  - faltam 15 dias ou menos
//   VERMELHO - vencido
export type SemaforoReavaliacao = 'VERDE' | 'AMARELO' | 'VERMELHO';

export const DIAS_ALERTA_REAVALIACAO = 15;

export function semaforoReavaliacao(diasRestantes: number): SemaforoReavaliacao {
  if (diasRestantes < 0) return 'VERMELHO';
  if (diasRestantes <= DIAS_ALERTA_REAVALIACAO) return 'AMARELO';
  return 'VERDE';
}
