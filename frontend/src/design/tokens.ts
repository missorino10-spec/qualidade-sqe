// Tokens do Design System.
//
// Estes valores JA existiam espalhados como hex solto no meio do JSX (o verde
// #3f8600 aparecia em 11 lugares, o vermelho #cf1322 em 15). Nada foi trocado
// de cor: o que muda e que agora cada cor tem NOME e significado, e quem le o
// codigo escolhe pelo significado ("critico") e nao pelo hex.
//
// Regra de uso: nunca escreva hex direto numa tela. Se falta um tom, ele entra
// aqui primeiro.

// ---------------------------------------------------------------------------
// Marca — a identidade Big Dutchman. Nao mexer sem decisao do usuario.
// ---------------------------------------------------------------------------
export const MARCA = {
  /** Laranja principal: acao primaria, item de menu ativo, foco. */
  laranja: '#D37119',
  /** Laranja escuro: hover do primario e links. */
  laranjaEscuro: '#B85F12',
  /** Grafite quente do menu lateral. */
  grafite: '#2B2622',
  /** Grafite mais fundo: submenu aberto e rodape do menu. */
  grafiteFundo: '#221E1B',
  /** Grafite mais claro: hover do menu. */
  grafiteHover: '#3A332D',
} as const;

// ---------------------------------------------------------------------------
// Semantica — a cor comunica um estado, nunca decora.
// Um estado = uma cor, no sistema inteiro.
// ---------------------------------------------------------------------------
export const COR = {
  /** Aprovado, conforme, dentro da meta, finalizado com sucesso. */
  sucesso: '#3F8600',
  /** Ressalva: aprovado condicionalmente, plano de acao aberto, em atencao. */
  atencao: '#D46B08',
  /** Reprovado, vencido, fora da meta, nao conforme. */
  critico: '#CF1322',
  /** Aguardando terceiro (fornecedor, amostra, checklist). Nao e erro. */
  informativo: '#0958D9',
  /** Prazo se aproximando — entre o atencao e o critico. */
  alerta: '#D4B106',
  /** Numero sem carga de julgamento: totais, contagens, medidas. */
  neutro: '#595959',
} as const;

// ---------------------------------------------------------------------------
// Texto — hierarquia de leitura. Tres niveis bastam.
// ---------------------------------------------------------------------------
export const TEXTO = {
  /** Titulo e valor de indicador. */
  forte: '#1F1B18',
  /** Corpo, celula de tabela. */
  padrao: '#3D3733',
  /** Rotulo, legenda, rodape de cartao, unidade. */
  suave: '#7A736D',
} as const;

// ---------------------------------------------------------------------------
// Superficies e bordas — o que da profundidade sem sombra pesada.
// ---------------------------------------------------------------------------
export const SUPERFICIE = {
  /** Fundo da area de conteudo. Cinza levissimo para o cartao branco destacar. */
  pagina: '#F4F5F6',
  /** Cartao, modal, tabela. */
  cartao: '#FFFFFF',
  /** Cabecalho de tabela e faixas de agrupamento. */
  sutil: '#FAFAFA',
  /** Linha da tabela sob o cursor. */
  realce: '#FBF3EA',
} as const;

export const BORDA = {
  /** Divisoria discreta: entre linhas de tabela e dentro do cartao. */
  suave: '#F0F0F0',
  /** Contorno de cartao, campo e tabela. */
  padrao: '#E4E1DE',
} as const;

// ---------------------------------------------------------------------------
// Escala de espacamento. Multiplos de 4 — a escala que o codigo ja usava de
// fato (4, 8, 12, 16, 24), agora nomeada para parar de variar por tela.
// ---------------------------------------------------------------------------
export const ESPACO = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const RAIO = {
  /** Tag, badge e campo pequeno. */
  sm: 4,
  /** Botao, campo, cartao. */
  md: 6,
  /** Cartao de destaque e modal. */
  lg: 8,
} as const;

// Sombra de sistema corporativo: quase imperceptivel, so o suficiente para o
// cartao descolar do fundo. Nada de sombra difusa de landing page.
export const SOMBRA = {
  cartao: '0 1px 2px rgba(31, 27, 24, 0.04)',
  elevada: '0 4px 12px rgba(31, 27, 24, 0.08)',
  cabecalho: '0 1px 0 rgba(31, 27, 24, 0.06)',
} as const;

// Cor de um percentual medido contra meta: verde bate, amarelo chega perto,
// vermelho nao bate. Usada pelos cartoes de indicador dos paineis.
export function corDaMeta(valor: number, meta: number): string {
  if (valor >= meta) return COR.sucesso;
  if (valor >= meta * 0.9) return COR.alerta;
  return COR.critico;
}
