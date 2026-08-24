import { SetMetadata } from '@nestjs/common';
import { ModuloSistema } from '@prisma/client';

export const MODULO_KEY = 'modulo-sistema';

export interface ModuloOpcoes {
  /**
   * Deixa o GET aberto para qualquer pessoa logada. E o caso dos cadastros
   * (fornecedores, itens, maquinas, instrumentos): a lista alimenta os
   * combos dos lancamentos, entao bloquear a leitura travaria o trabalho de
   * quem tem SQE mas nao tem Cadastros.
   */
  leituraLivre?: boolean;
  /**
   * Modulos que, tendo nivel EDITAR, podem CRIAR neste cadastro mesmo sem
   * acesso ao submenu. E o atalho do inspetor: fornecedor eventual e item
   * novo que ainda nao esta na base. Nao libera editar nem excluir.
   */
  criacaoLivrePara?: ModuloSistema[];
}

export interface ModuloMeta extends ModuloOpcoes {
  modulo: ModuloSistema;
}

export const Modulo = (modulo: ModuloSistema, opcoes: ModuloOpcoes = {}) =>
  SetMetadata(MODULO_KEY, { modulo, ...opcoes } as ModuloMeta);
