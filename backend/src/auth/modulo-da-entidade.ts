import { ModuloSistema } from '@prisma/client';
import { EVID } from '../comum/inspecao';
import { DOC_8D, EVID_8D } from '../comum/oitod';
import { DOC_5G, EVID_5G } from '../comum/cincog';
import { FOTO_ICAQ } from '../comum/icaq';
import { DESVIO } from '../comum/desvio-qualidade';
import { DOC_RO, FOTO_RO } from '../comum/ro';
import {
  TIPO_ANEXO_RELATORIO,
  TIPO_ANEXO_PLANO_ACAO,
} from '../sqd/homologacoes/homologacoes.service';
import {
  TIPO_ANEXO_RELATORIO_ITEM,
  TIPO_ANEXO_PLANO_ACAO_ITEM,
} from '../sqd/homologacoes-itens/homologacoes-itens.service';
import {
  TIPO_ANEXO_RELATORIO_AUDITORIA,
  TIPO_ANEXO_PLANO_ACAO_AUDITORIA,
} from '../sqd/auditorias/auditorias.service';

/**
 * De-para "entidadeTipo" -> modulo dono.
 *
 * Anexo e HistoricoStatus sao tabelas genericas: guardam so um rotulo de texto
 * e um id. Sem este mapa qualquer pessoa logada baixaria o anexo de uma RNC ou
 * leria o historico de uma homologacao sem ter o modulo liberado.
 *
 * Os rotulos vem das mesmas constantes que gravam o anexo, entao renomear uma
 * delas quebra a compilacao aqui em vez de abrir um buraco em silencio.
 */
export const MODULO_DA_ENTIDADE: Record<string, ModuloSistema> = {
  // SQE
  RNC: ModuloSistema.SQE,
  [DESVIO.rnc]: ModuloSistema.SQE,
  [EVID.sqeVisual]: ModuloSistema.SQE,
  [EVID.sqeDimensional]: ModuloSistema.SQE,
  [EVID.sqeVisualDesvio]: ModuloSistema.SQE,

  // MANUFATURA
  [EVID.manufaturaDimensional]: ModuloSistema.MANUFATURA,
  [EVID.manufaturaVisual]: ModuloSistema.MANUFATURA,
  [EVID.manufaturaVisualInspecao]: ModuloSistema.MANUFATURA,
  [EVID.alertaErrado]: ModuloSistema.MANUFATURA,
  [EVID.alertaCerto]: ModuloSistema.MANUFATURA,
  [EVID_8D.geral]: ModuloSistema.MANUFATURA,
  [EVID_8D.situacaoAtual]: ModuloSistema.MANUFATURA,
  [EVID_8D.estratificacao]: ModuloSistema.MANUFATURA,
  [EVID_8D.resultados]: ModuloSistema.MANUFATURA,
  [EVID_5G.evidencias]: ModuloSistema.MANUFATURA,
  // Documento que motivou a abertura do 8D / 5G
  [DOC_8D]: ModuloSistema.MANUFATURA,
  [DOC_5G]: ModuloSistema.MANUFATURA,
  // Foto de evidencia de uma linha do checklist do ICAQ
  [FOTO_ICAQ]: ModuloSistema.MANUFATURA,

  // SQD
  [TIPO_ANEXO_RELATORIO]: ModuloSistema.SQD,
  [TIPO_ANEXO_PLANO_ACAO]: ModuloSistema.SQD,
  [TIPO_ANEXO_RELATORIO_ITEM]: ModuloSistema.SQD,
  [TIPO_ANEXO_PLANO_ACAO_ITEM]: ModuloSistema.SQD,
  [EVID.homologacaoItemDimensional]: ModuloSistema.SQD,
  [EVID.homologacaoItemVisual]: ModuloSistema.SQD,
  [EVID.homologacaoItemVisualDesvio]: ModuloSistema.SQD,
  [DESVIO.homologacaoItem]: ModuloSistema.SQD,
  [TIPO_ANEXO_RELATORIO_AUDITORIA]: ModuloSistema.SQD,
  [TIPO_ANEXO_PLANO_ACAO_AUDITORIA]: ModuloSistema.SQD,

  // R.O - o formulario recebido da Sala de Controle e as fotos de evidencia
  [DOC_RO]: ModuloSistema.RO,
  [FOTO_RO]: ModuloSistema.RO,
};

/**
 * Rotulo que ninguem reconhece e rotulo negado. Se um dia entrar um tipo novo
 * sem passar por aqui, ele fecha em vez de abrir para todo mundo.
 */
export function moduloDaEntidade(tipo?: string | null): ModuloSistema | null {
  if (!tipo) return null;
  return MODULO_DA_ENTIDADE[tipo] ?? null;
}
