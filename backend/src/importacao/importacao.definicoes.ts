import { ModuloSistema } from '@prisma/client';

// ---------------------------------------------------------------------------
// O que cada cadastro aceita receber por planilha.
//
// Este arquivo e so a DESCRICAO das colunas; quem le, valida e grava e o
// importacao.service.ts. A separacao existe porque a mesma descricao serve para
// tres coisas diferentes: montar a planilha que o usuario baixa, conferir a que
// ele devolve e escrever a aba de instrucoes.
//
// Regra das celulas em branco (repetida na aba "Como preencher"):
//   coluna obrigatoria em branco  -> a LINHA e recusada;
//   coluna de escolha em branco   -> MANTEM o que ja esta no sistema;
//   demais colunas em branco      -> o campo fica VAZIO (a planilha manda).
//
// Nao entram na planilha, de proposito, os numeros que o proprio sistema
// mantem (contador de entregas, inspecoes realizadas, setups...) e os contatos
// do fornecedor, que continuam sendo editados na tela: importacao nunca os
// apaga.
// ---------------------------------------------------------------------------

export type TipoColuna =
  | 'texto'
  | 'inteiro'
  | 'moeda'
  | 'data'
  | 'escolha'
  | 'sim-nao';

export interface OpcaoColuna {
  /** O que o usuario ve e digita na planilha. */
  texto: string;
  /** O que vai para o banco. */
  valor: any;
}

export interface ColunaImport {
  titulo: string;
  campo: string;
  tipo: TipoColuna;
  obrigatorio?: boolean;
  opcoes?: OpcaoColuna[];
  ajuda?: string;
}

export interface CadastroImport {
  chave: string;
  titulo: string;
  /** Nome do arquivo baixado, sem extensao. */
  arquivo: string;
  /**
   * Modulo que o usuario precisa ter para importar. null = area do admin
   * (Colaboradores e Acessos), onde so o ADMIN entra.
   */
  modulo: ModuloSistema | null;
  /** Coluna que identifica o registro entre uma importacao e a seguinte. */
  campoChave: string;
  rotuloChave: string;
  /** Campo booleano que a inativacao desliga ("ativo" ou "ativa"). */
  campoAtivo: string;
  /**
   * Se o cadastro aceita a opcao "esta planilha e a lista completa". Os
   * Instrumentos ficam de fora: 36 das 53 linhas do inventario estao sem
   * codigo e tres codigos se repetem, entao nao existe chave em que apoiar a
   * frase "quem sumiu da planilha deve ser inativado".
   */
  podeInativar: boolean;
  colunas: ColunaImport[];
}

const SIM_NAO: OpcaoColuna[] = [
  { texto: 'Sim', valor: true },
  { texto: 'Não', valor: false },
];

const NIVEIS_ACESSO: OpcaoColuna[] = [
  { texto: 'Sem acesso', valor: null },
  { texto: 'Visualizar', valor: 'VISUALIZAR' },
  { texto: 'Editar', valor: 'EDITAR' },
];

// Uma coluna por modulo, na mesma ordem da tela de Acessos. O campo sai como
// "acesso:SQE" para o service saber que ela nao e uma coluna do Usuario.
function colunaAcesso(modulo: string, titulo: string): ColunaImport {
  return {
    titulo,
    campo: `acesso:${modulo}`,
    tipo: 'escolha',
    opcoes: NIVEIS_ACESSO,
  };
}

export const CADASTROS: CadastroImport[] = [
  {
    chave: 'fornecedores',
    titulo: 'Fornecedores',
    arquivo: 'cadastro-fornecedores',
    modulo: ModuloSistema.CAD_FORNECEDORES,
    campoChave: 'codigo',
    rotuloChave: 'Código',
    campoAtivo: 'ativo',
    podeInativar: true,
    colunas: [
      {
        titulo: 'Código',
        campo: 'codigo',
        tipo: 'texto',
        obrigatorio: true,
        ajuda: 'Identifica o fornecedor. Não pode se repetir na planilha.',
      },
      { titulo: 'Nome', campo: 'nome', tipo: 'texto', obrigatorio: true },
      { titulo: 'CNPJ', campo: 'cnpj', tipo: 'texto' },
      { titulo: 'Endereço', campo: 'endereco', tipo: 'texto' },
      { titulo: 'Tipo de fornecimento', campo: 'tipoFornecimento', tipo: 'texto' },
      {
        titulo: 'Categoria de inspeção',
        campo: 'categoriaInspecao',
        tipo: 'texto',
      },
      { titulo: 'Plano de inspeção', campo: 'planoInspecao', tipo: 'texto' },
      {
        titulo: 'Controles principais',
        campo: 'controlesPrincipais',
        tipo: 'texto',
      },
      { titulo: 'Escopo', campo: 'escopoTexto', tipo: 'texto' },
      {
        titulo: 'Esforço da qualidade',
        campo: 'esforcoQualidade',
        tipo: 'escolha',
        opcoes: [
          { texto: 'Baixo', valor: 'BAIXO' },
          { texto: 'Médio', valor: 'MEDIO' },
          { texto: 'Alto', valor: 'ALTO' },
        ],
      },
      {
        titulo: 'Classificação de fornecimento',
        campo: 'classificacaoFornecimento',
        tipo: 'escolha',
        opcoes: [
          { texto: 'A', valor: 'A' },
          { texto: 'B', valor: 'B' },
          { texto: 'C', valor: 'C' },
          { texto: 'D', valor: 'D' },
        ],
        ajuda:
          'O fechamento trimestral do SQE reescreve esta coluna; o que for ' +
          'digitado aqui vale só até a próxima apuração.',
      },
      { titulo: 'Faz inspeção visual', campo: 'fazVisual', tipo: 'sim-nao', opcoes: SIM_NAO },
      { titulo: 'Faz inspeção por lote', campo: 'fazLote', tipo: 'sim-nao', opcoes: SIM_NAO },
      {
        titulo: 'Fornecedor eventual',
        campo: 'eventual',
        tipo: 'sim-nao',
        opcoes: SIM_NAO,
        ajuda: 'Eventual fica fora do plano de periodicidade.',
      },
      { titulo: 'Ativo', campo: 'ativo', tipo: 'sim-nao', opcoes: SIM_NAO },
    ],
  },
  {
    chave: 'itens',
    titulo: 'Itens',
    arquivo: 'cadastro-itens',
    modulo: ModuloSistema.CAD_ITENS,
    campoChave: 'codigo',
    rotuloChave: 'Código',
    campoAtivo: 'ativo',
    podeInativar: true,
    colunas: [
      {
        titulo: 'Código',
        campo: 'codigo',
        tipo: 'texto',
        obrigatorio: true,
        ajuda: 'Identifica o item. Não pode se repetir na planilha.',
      },
      { titulo: 'Descrição', campo: 'descricao', tipo: 'texto', obrigatorio: true },
      { titulo: 'Unidade', campo: 'unidade', tipo: 'texto' },
      { titulo: 'Custo unitário', campo: 'custoUnitario', tipo: 'moeda' },
      {
        titulo: 'Código do fornecedor',
        campo: 'fornecedorCodigo',
        tipo: 'texto',
        ajuda:
          'Código de um fornecedor já cadastrado. Se não existir, a linha é ' +
          'recusada.',
      },
      { titulo: 'Ativo', campo: 'ativo', tipo: 'sim-nao', opcoes: SIM_NAO },
    ],
  },
  {
    chave: 'maquinas',
    titulo: 'Máquinas',
    arquivo: 'cadastro-maquinas',
    modulo: ModuloSistema.CAD_MAQUINAS,
    campoChave: 'codigo',
    rotuloChave: 'Código',
    campoAtivo: 'ativa',
    podeInativar: true,
    colunas: [
      {
        titulo: 'Código',
        campo: 'codigo',
        tipo: 'texto',
        obrigatorio: true,
        ajuda: 'Identifica a máquina. Não pode se repetir na planilha.',
      },
      { titulo: 'Nome', campo: 'nome', tipo: 'texto', obrigatorio: true },
      {
        titulo: 'Área',
        campo: 'area',
        tipo: 'escolha',
        opcoes: [
          { texto: 'Fabricação', valor: 'FABRICACAO' },
          { texto: 'Montagem', valor: 'MONTAGEM' },
        ],
      },
      { titulo: 'Descrição', campo: 'descricao', tipo: 'texto' },
      { titulo: 'Ativa', campo: 'ativa', tipo: 'sim-nao', opcoes: SIM_NAO },
    ],
  },
  {
    chave: 'instrumentos',
    titulo: 'Instrumentos',
    arquivo: 'inventario-instrumentos',
    modulo: ModuloSistema.CAD_INSTRUMENTOS,
    campoChave: 'codigo',
    rotuloChave: 'Código',
    campoAtivo: 'ativo',
    podeInativar: false,
    colunas: [
      {
        titulo: 'Nº do sistema',
        campo: 'id',
        tipo: 'inteiro',
        ajuda:
          'Preenchido pelo sistema; não altere. É por ele que o instrumento ' +
          'já cadastrado é reconhecido, já que 36 das 53 linhas do ' +
          'inventário estão sem código. Linha nova deixa esta coluna em branco.',
      },
      {
        titulo: 'Código',
        campo: 'codigo',
        tipo: 'texto',
        ajuda:
          'Quando preenchido e único, atualiza o instrumento que já tem esse ' +
          'código. Em branco ou repetido, a linha entra como instrumento novo.',
      },
      {
        titulo: 'Equipamento',
        campo: 'equipamento',
        tipo: 'texto',
        obrigatorio: true,
      },
      { titulo: 'Fabricante', campo: 'fabricante', tipo: 'texto' },
      { titulo: 'Nº de série', campo: 'numeroSerie', tipo: 'texto' },
      { titulo: 'Data de calibração', campo: 'dataCalibracao', tipo: 'data' },
      { titulo: 'Período (anos)', campo: 'periodoAnos', tipo: 'inteiro' },
      {
        titulo: 'Próxima calibração',
        campo: 'proximaCalibracao',
        tipo: 'data',
        ajuda:
          'Em branco, o sistema sugere a data de calibração mais o período ' +
          'em anos. O que estiver escrito aqui sempre vence a conta.',
      },
      { titulo: 'Nº do certificado', campo: 'numeroCertificado', tipo: 'texto' },
      { titulo: 'Localização', campo: 'localizacao', tipo: 'texto' },
      { titulo: 'Observações', campo: 'observacoes', tipo: 'texto' },
      { titulo: 'Ativo', campo: 'ativo', tipo: 'sim-nao', opcoes: SIM_NAO },
    ],
  },
  {
    chave: 'colaboradores',
    titulo: 'Colaboradores e Acessos',
    arquivo: 'cadastro-colaboradores',
    modulo: null,
    campoChave: 'email',
    rotuloChave: 'E-mail',
    campoAtivo: 'ativo',
    podeInativar: true,
    colunas: [
      { titulo: 'Nome', campo: 'nome', tipo: 'texto', obrigatorio: true },
      {
        titulo: 'E-mail',
        campo: 'email',
        tipo: 'texto',
        obrigatorio: true,
        ajuda:
          'É o login da pessoa e identifica o cadastro. Não pode se repetir ' +
          'na planilha.',
      },
      {
        titulo: 'Perfil',
        campo: 'papel',
        tipo: 'escolha',
        opcoes: [
          { texto: 'Qualidade', valor: 'QUALIDADE' },
          { texto: 'Produção', valor: 'PRODUCAO' },
          { texto: 'Administrador', valor: 'ADMIN' },
        ],
        ajuda: 'Administrador enxerga tudo, independente das colunas de acesso.',
      },
      { titulo: 'Matrícula', campo: 'matricula', tipo: 'texto' },
      { titulo: 'Cargo', campo: 'cargo', tipo: 'texto' },
      { titulo: 'Setor', campo: 'setor', tipo: 'texto' },
      { titulo: 'Telefone', campo: 'telefone', tipo: 'texto' },
      { titulo: 'Data de admissão', campo: 'dataAdmissao', tipo: 'data' },
      { titulo: 'Ativo', campo: 'ativo', tipo: 'sim-nao', opcoes: SIM_NAO },
      colunaAcesso('SQE', 'Acesso: SQE'),
      colunaAcesso('MANUFATURA', 'Acesso: Manufatura'),
      colunaAcesso('SQD', 'Acesso: SQD'),
      colunaAcesso('RO', 'Acesso: R.O'),
      colunaAcesso('CAD_FORNECEDORES', 'Acesso: Cadastro de fornecedores'),
      colunaAcesso('CAD_ITENS', 'Acesso: Cadastro de itens'),
      colunaAcesso('CAD_MAQUINAS', 'Acesso: Cadastro de máquinas'),
      colunaAcesso('CAD_INSTRUMENTOS', 'Acesso: Cadastro de instrumentos'),
    ],
  },
];

export function acharCadastro(chave: string): CadastroImport | undefined {
  return CADASTROS.find((c) => c.chave === chave);
}
