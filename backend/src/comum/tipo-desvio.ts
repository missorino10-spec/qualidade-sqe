// Tipo de desvio da RNC. E apenas a NATUREZA da nao conformidade —
// DIMENSIONAL ou VISUAL. O detalhe (quais itens do checklist ou quais cotas
// reprovaram) fica na descricao do desvio.
//
// Espelhado em frontend/src/tipo-desvio.ts.

export const TIPO_DESVIO = {
  DIMENSIONAL: 'DIMENSIONAL',
  VISUAL: 'VISUAL',
} as const;

export const TIPOS_DESVIO = [TIPO_DESVIO.DIMENSIONAL, TIPO_DESVIO.VISUAL];

// Registros antigos gravavam o texto inteiro no tipo ("Visual: Peca livre de
// cantos vivos e rebarbas.; Sem empenamento aparente. | Dimensional"), o que
// virava um paragrafo dentro da coluna da listagem. Aqui qualquer valor e
// reduzido aos tipos que ele cita.
export function rotuloTipoDesvio(valor: unknown): string {
  const bruto = String(valor ?? '').trim();
  if (!bruto) return '';
  const semAcento = bruto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  const tipos = TIPOS_DESVIO.filter((t) => semAcento.includes(t));
  // Texto livre que nao cita nenhum dos dois tipos continua como esta: nao da
  // para adivinhar a natureza do desvio.
  return tipos.length ? tipos.join(' / ') : bruto;
}
