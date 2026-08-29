/**
 * O que cada colaborador enxerga. SQE, MANUFATURA, SQD e R.O sao liberados por
 * modulo inteiro; CADASTROS e liberado submenu a submenu, porque mexer na base
 * de fornecedores e de itens e coisa de pouca gente.
 *
 * "Sem acesso" nao aparece aqui: e simplesmente nao ter a linha.
 */
export type Modulo =
  | 'SQE'
  | 'MANUFATURA'
  | 'SQD'
  | 'RO'
  | 'CAD_FORNECEDORES'
  | 'CAD_ITENS'
  | 'CAD_MAQUINAS'
  | 'CAD_INSTRUMENTOS';

export type Nivel = 'VISUALIZAR' | 'EDITAR';

export interface Acesso {
  modulo: Modulo;
  nivel: Nivel;
}

export const MODULOS_CADASTRO: Modulo[] = [
  'CAD_FORNECEDORES',
  'CAD_ITENS',
  'CAD_MAQUINAS',
  'CAD_INSTRUMENTOS',
];

export const ROTULO_MODULO: Record<Modulo, string> = {
  SQE: 'QUALIDADE - SQE',
  MANUFATURA: 'QUALIDADE - MANUFATURA',
  SQD: 'QUALIDADE - SQD',
  RO: 'QUALIDADE - R.O',
  CAD_FORNECEDORES: 'Cadastros › Fornecedores',
  CAD_ITENS: 'Cadastros › Itens',
  CAD_MAQUINAS: 'Cadastros › Máquinas',
  CAD_INSTRUMENTOS: 'Cadastros › Instrumentos',
};

// Ordem em que a tela de acessos e o menu mostram os modulos.
export const MODULOS: Modulo[] = [
  'SQE',
  'MANUFATURA',
  'SQD',
  'RO',
  ...MODULOS_CADASTRO,
];

// Para onde a pessoa cai depois de entrar: a primeira coisa que ela pode ver.
export const ROTA_INICIAL: Record<Modulo, string> = {
  SQE: '/',
  MANUFATURA: '/manufatura',
  SQD: '/sqd',
  RO: '/ro',
  CAD_FORNECEDORES: '/fornecedores',
  CAD_ITENS: '/itens',
  CAD_MAQUINAS: '/manufatura/maquinas',
  CAD_INSTRUMENTOS: '/instrumentos/inventario',
};
