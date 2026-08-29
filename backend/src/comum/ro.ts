// R.O - Gestao de Reclamacoes da Qualidade.
//
// As listas abaixo sao as validacoes da planilha
// "especificacao_controle_reclamacoes_qualidade.xlsx", na mesma ordem em que
// aparecem la. O frontend tem um espelho em frontend/src/ro.ts.

// Anexos: dois campos opcionais, num bloco unico. Nenhum dos dois trava o
// encerramento de bloco nenhum.
// - o formulario que a Sala de Controle mandou (arquivo de qualquer formato)
// - fotos / evidencias da tratativa
export const DOC_RO = 'RO_DOCUMENTO';
export const FOTO_RO = 'RO_FOTO';

export type OpcaoRo = { value: string; label: string };

// 2. Triagem -------------------------------------------------------------
export const COMPLETUDE_SAC_RO: OpcaoRo[] = [
  { value: 'SIM', label: 'Sim' },
  { value: 'NAO', label: 'Não' },
  { value: 'PARCIAL', label: 'Parcial' },
];

export const ACEITE_RO: OpcaoRo[] = [
  { value: 'SIM', label: 'Sim' },
  { value: 'NAO', label: 'Não' },
  { value: 'AGUARDANDO', label: 'Aguardando' },
];

export const CLASSIFICACAO_RO: OpcaoRo[] = [
  { value: 'DEFEITO_FUNCIONAL', label: 'Defeito funcional' },
  { value: 'FALHA_DESEMPENHO', label: 'Falha de desempenho' },
  { value: 'PROBLEMA_DIMENSIONAL', label: 'Problema dimensional' },
  { value: 'MATERIAL_INCORRETO', label: 'Material incorreto' },
  { value: 'QUANTIDADE_INCORRETA', label: 'Quantidade incorreta' },
  { value: 'EMBALAGEM', label: 'Embalagem' },
  { value: 'DOCUMENTACAO', label: 'Documentação' },
  { value: 'MONTAGEM_INSTALACAO', label: 'Montagem / instalação' },
  { value: 'SOFTWARE_COMUNICACAO', label: 'Software / comunicação' },
  { value: 'ENTREGA_LOGISTICA', label: 'Entrega / logística' },
  { value: 'SEGURANCA', label: 'Segurança' },
  { value: 'BEM_ESTAR_ANIMAL', label: 'Bem-estar animal' },
  { value: 'MEIO_AMBIENTE', label: 'Meio ambiente' },
  { value: 'OUTRO', label: 'Outro' },
];

export const PROCEDENCIA_RO: OpcaoRo[] = [
  { value: 'PROCEDENTE', label: 'Procedente' },
  { value: 'PARCIALMENTE_PROCEDENTE', label: 'Parcialmente procedente' },
  { value: 'NAO_PROCEDENTE', label: 'Não procedente' },
  { value: 'INCONCLUSIVA', label: 'Inconclusiva' },
];

export const PRIORIDADE_RO: OpcaoRo[] = [
  { value: 'CRITICA', label: 'Crítica' },
  { value: 'ALTA', label: 'Alta' },
  { value: 'MEDIA', label: 'Média' },
  { value: 'BAIXA', label: 'Baixa' },
];

export const AREA_RESPONSAVEL_RO: OpcaoRo[] = [
  { value: 'QUALIDADE_PRODUCAO', label: 'Qualidade Produção' },
  { value: 'SQE', label: 'SQE' },
  { value: 'SQD', label: 'SQD' },
  { value: 'ENGENHARIA', label: 'Engenharia' },
  { value: 'LOGISTICA', label: 'Logística' },
  { value: 'SERVICO_ASSISTENCIA', label: 'Serviço / Assistência Técnica' },
  { value: 'EQUIPE_MULTIFUNCIONAL', label: 'Equipe multifuncional' },
];

// 3. Tratativa interna ---------------------------------------------------
export const SIM_NAO_RO: OpcaoRo[] = [
  { value: 'SIM', label: 'Sim' },
  { value: 'NAO', label: 'Não' },
];

export const METODO_ANALISE_RO: OpcaoRo[] = [
  { value: 'CINCO_PORQUES', label: '5 Porquês' },
  { value: 'ISHIKAWA', label: 'Ishikawa' },
  { value: 'PARETO', label: 'Pareto' },
  { value: 'FMEA', label: 'FMEA' },
  { value: 'OITO_D', label: '8D' },
  { value: 'TESTE_REPRODUCAO', label: 'Teste / reprodução' },
  { value: 'ANALISE_DADOS', label: 'Análise de dados' },
  { value: 'AUDITORIA', label: 'Auditoria' },
  { value: 'OUTRO', label: 'Outro' },
];

export const STATUS_ACAO_RO: OpcaoRo[] = [
  { value: 'NAO_INICIADA', label: 'Não iniciada' },
  { value: 'EM_ANDAMENTO', label: 'Em andamento' },
  { value: 'CONCLUIDA', label: 'Concluída' },
  { value: 'ATRASADA', label: 'Atrasada' },
  { value: 'CANCELADA', label: 'Cancelada' },
];

export const EFICACIA_RO: OpcaoRo[] = [
  { value: 'EFICAZ', label: 'Eficaz' },
  { value: 'PARCIALMENTE_EFICAZ', label: 'Parcialmente eficaz' },
  { value: 'INEFICAZ', label: 'Ineficaz' },
  { value: 'NAO_APLICAVEL', label: 'Não aplicável' },
];

// 4. Retorno e encerramento ----------------------------------------------
export const MOTIVO_ENCERRAMENTO_RO: OpcaoRo[] = [
  { value: 'PROCEDENTE_COM_ACAO', label: 'Procedente com ação' },
  { value: 'NAO_PROCEDENTE', label: 'Não procedente' },
  { value: 'DUPLICADA', label: 'Duplicada' },
  { value: 'CANCELADA', label: 'Cancelada' },
  { value: 'INCONCLUSIVA', label: 'Inconclusiva' },
];

export const STATUS_RO: OpcaoRo[] = [
  { value: 'RECEBIDA_SAC', label: 'Recebida do SAC' },
  { value: 'EM_TRIAGEM', label: 'Em triagem' },
  { value: 'AGUARDANDO_SAC', label: 'Aguardando SAC' },
  { value: 'DIRECIONADA', label: 'Direcionada' },
  { value: 'CONTENCAO', label: 'Contenção' },
  { value: 'INVESTIGACAO', label: 'Investigação' },
  { value: 'ACOES_CORRETIVAS', label: 'Ações corretivas' },
  { value: 'AGUARDANDO_EFICACIA', label: 'Aguardando eficácia' },
  { value: 'RETORNO_SAC', label: 'Retorno SAC' },
  { value: 'ENCERRADA', label: 'Encerrada' },
  { value: 'REABERTA', label: 'Reaberta' },
  { value: 'NAO_ACEITA', label: 'Não aceita' },
];

export const TIPO_TAREFA_RO: OpcaoRo[] = [
  { value: 'CONTENCAO', label: 'Contenção' },
  { value: 'ACAO_CORRETIVA', label: 'Ação corretiva' },
];

function mapa(opcoes: OpcaoRo[]): Record<string, string> {
  return Object.fromEntries(opcoes.map((o) => [o.value, o.label]));
}

export const ROTULO_RO: Record<string, Record<string, string>> = {
  dadosCompletos: mapa(COMPLETUDE_SAC_RO),
  aceita: mapa(ACEITE_RO),
  classificacao: mapa(CLASSIFICACAO_RO),
  procedencia: mapa(PROCEDENCIA_RO),
  prioridade: mapa(PRIORIDADE_RO),
  areaResponsavel: mapa(AREA_RESPONSAVEL_RO),
  necessidadeContencao: mapa(SIM_NAO_RO),
  metodoAnalise: mapa(METODO_ANALISE_RO),
  statusAcoes: mapa(STATUS_ACAO_RO),
  verificacaoEficacia: mapa(EFICACIA_RO),
  motivoEncerramento: mapa(MOTIVO_ENCERRAMENTO_RO),
  status: mapa(STATUS_RO),
  tipo: mapa(TIPO_TAREFA_RO),
};

// Rotulo de um valor de lista. Valor desconhecido volta como veio, para nao
// sumir da tela nem do PDF.
export function rotuloRo(campo: string, valor?: string | null): string {
  if (!valor) return '';
  return ROTULO_RO[campo]?.[valor] ?? valor;
}

// Os quatro blocos da planilha, na ordem. O bloco de Anexos NAO entra aqui:
// ele nao tem flag de concluido.
export const BLOCOS_RO: { numero: number; titulo: string }[] = [
  { numero: 1, titulo: '1. Dados recebidos' },
  { numero: 2, titulo: '2. Triagem e direcionamento da Qualidade' },
  { numero: 3, titulo: '3. Tratativa interna' },
  { numero: 4, titulo: '4. Retorno ao SAC e encerramento' },
];
