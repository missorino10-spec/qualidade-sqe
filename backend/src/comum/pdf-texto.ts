// Valor de celula que nunca vaza do quadro.
//
// O `ellipsis` do pdfkit sozinho nao resolve: ele corta pelo limite de altura,
// entao um nome comprido numa celula estreita ainda quebra a linha e encosta na
// borda de baixo. Aqui a fonte encolhe primeiro, ate o texto caber nas linhas
// que o quadro comporta; so se nem no piso couber e que entram as reticencias.

export function valorDeCelula(
  doc: PDFKit.PDFDocument,
  texto: string,
  x: number,
  y: number,
  largura: number,
  altura: number,
  tamanho: number,
  piso = 5.5,
) {
  // Quantas linhas o quadro comporta no tamanho original. Celulas de 2 linhas
  // (a RNC tem varias) continuam podendo usar as duas.
  const linhas = Math.max(1, Math.floor(altura / (tamanho * 1.2)));
  let fs = tamanho;
  while (fs > piso && doc.fontSize(fs).widthOfString(texto) > largura * linhas) {
    fs -= 0.25;
  }
  doc.fontSize(fs).text(texto, x, y, { width: largura, height: altura, ellipsis: true });
}
