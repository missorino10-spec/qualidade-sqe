import PDFDocument from 'pdfkit';
import { join } from 'path';
import { existsSync } from 'fs';

const LARANJA = '#E8792B';
const PRETO = '#000000';
const CINZA = '#555555';
const LOGO_PATH = join(process.cwd(), 'assets', 'logo-big-dutchman.png');

const M = 40; // margem
const X0 = M;
const X1 = 555; // borda direita (A4 595 - 40)
const W = X1 - X0; // largura util (515)

function fmtData(d?: Date | null): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('pt-BR');
}

function simNao(v?: boolean | null): string {
  if (v == null) return 'Não / No';
  return v ? 'Sim / Yes' : 'Não / No';
}

// Gera o PDF da RNC fiel ao formulario BDBR.QUA.FMR.003.05 (bilingue PT/EN),
// incluindo o Registro Fotografico com as fotos anexadas a RNC.
export function gerarPdfRnc(rnc: any, fotos: string[] = []): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: 'A4', margin: M });

  // ---------- Celula bilingue com borda ----------
  const cell = (
    x: number,
    y: number,
    w: number,
    h: number,
    ptLabel: string,
    enLabel: string,
    valor: string,
    opts: { labelFill?: string; valorColor?: string; valorSize?: number } = {},
  ) => {
    doc.lineWidth(0.8).strokeColor(PRETO).rect(x, y, w, h).stroke();
    if (opts.labelFill) {
      doc.rect(x + 0.4, y + 0.4, w - 0.8, 15).fill(opts.labelFill);
    }
    doc
      .font('Helvetica-Bold')
      .fontSize(6.5)
      .fillColor(opts.labelFill ? '#FFFFFF' : PRETO)
      .text(ptLabel, x + 3, y + 2, { width: w - 6, lineBreak: false });
    doc
      .font('Helvetica-Oblique')
      .fontSize(5)
      .fillColor(opts.labelFill ? '#FFEFE2' : CINZA)
      .text(enLabel, x + 3, y + 9, { width: w - 6, lineBreak: false });
    doc
      .font('Helvetica')
      .fontSize(opts.valorSize ?? 8.5)
      .fillColor(opts.valorColor ?? PRETO)
      .text(valor || '', x + 3, y + 17, {
        width: w - 6,
        height: h - 18,
        ellipsis: true,
      });
  };

  // ---------- Secao de texto (titulo bilingue + area de valor) ----------
  const secao = (
    y: number,
    ptTitulo: string,
    enTitulo: string,
    valor: string,
    altura: number,
  ) => {
    doc.lineWidth(0.8).strokeColor(PRETO).rect(X0, y, W, 16).stroke();
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor(PRETO)
      .text(ptTitulo, X0 + 4, y + 2, { width: W - 8, continued: true })
      .font('Helvetica-Oblique')
      .fontSize(6.5)
      .fillColor(CINZA)
      .text(`   ${enTitulo}`);
    doc.lineWidth(0.8).strokeColor(PRETO).rect(X0, y + 16, W, altura).stroke();
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(PRETO)
      .text(valor || '', X0 + 5, y + 21, {
        width: W - 10,
        height: altura - 8,
      });
    return y + 16 + altura;
  };

  // ---------- Cabecalho ----------
  if (existsSync(LOGO_PATH)) {
    doc.image(LOGO_PATH, X0, 34, { width: 120 });
  } else {
    doc.font('Helvetica-Bold').fontSize(16).fillColor(LARANJA).text('Big Dutchman', X0, 40);
  }

  // Caixa de codigo (topo direito)
  const cbX = 400;
  const cbW = X1 - cbX;
  doc.lineWidth(0.8).strokeColor(PRETO).rect(cbX, 34, cbW, 46).stroke();
  const codLinha = (i: number, pt: string, en: string, v: string) => {
    const yy = 36 + i * 15;
    if (i > 0) doc.moveTo(cbX, 34 + i * 15).lineTo(X1, 34 + i * 15).stroke();
    doc
      .font('Helvetica-Bold')
      .fontSize(6)
      .fillColor(PRETO)
      .text(`${pt} / ${en}:`, cbX + 3, yy + 1, { width: cbW - 6, lineBreak: false });
    doc
      .font('Helvetica')
      .fontSize(7)
      .text(v, cbX + 3, yy + 7, { width: cbW - 6, lineBreak: false });
  };
  codLinha(0, 'Código', 'Code', 'BDBR.QUA.FMR.003.05');
  codLinha(1, 'Data Rev.', 'Rev. Date', '03/12/2025');
  codLinha(2, 'Revisão', 'Revision', '05');

  // Titulo central
  doc
    .font('Helvetica-Bold')
    .fontSize(14)
    .fillColor(PRETO)
    .text('Relatório de Não Conformidade', 160, 42, { width: 235, align: 'center' });
  doc
    .font('Helvetica-Oblique')
    .fontSize(9)
    .fillColor(CINZA)
    .text('Non Conformance Report', 160, 60, { width: 235, align: 'center' });

  let y = 92;

  // ---------- Linha 1: identificacao ----------
  const r1 = [
    { w: 70, pt: 'RNC Nº', en: 'NCR Nº', v: rnc.numero, orange: true },
    { w: 78, pt: 'Data de Abertura', en: 'Opening Date', v: fmtData(rnc.dataAbertura) },
    { w: 95, pt: 'Responsável', en: 'Responsible', v: rnc.solicitante ?? 'Qualidade' },
    { w: 82, pt: 'Setor', en: 'Department', v: 'Qualidade / Quality' },
    { w: 110, pt: 'Fornecedor', en: 'Vendor', v: rnc.fornecedor?.nome ?? '' },
    { w: 80, pt: 'Código', en: 'Code', v: rnc.fornecedor?.codigo ?? '' },
  ];
  let x = X0;
  for (const c of r1) {
    cell(x, y, c.w, 34, c.pt, c.en, c.v ?? '', {
      valorColor: c.orange ? LARANJA : PRETO,
      valorSize: c.orange ? 9.5 : 8.5,
    });
    x += c.w;
  }
  y += 34;

  // ---------- Linha 2: item ----------
  const r2 = [
    { w: 80, pt: 'Código do Item', en: 'Item Code', v: rnc.item?.codigo ?? '' },
    { w: 80, pt: 'Quantidade do Lote', en: 'Batch Quantity', v: String(rnc.quantidadeLote ?? '') },
    { w: 70, pt: 'NF', en: 'Invoice', v: rnc.notaFiscal ?? '' },
    { w: 70, pt: 'PO', en: 'PO', v: rnc.po ?? '' },
    { w: 215, pt: 'Descrição Item', en: 'Item Description', v: rnc.item?.descricao ?? '' },
  ];
  x = X0;
  for (const c of r2) {
    cell(x, y, c.w, 34, c.pt, c.en, c.v);
    x += c.w;
  }
  y += 34;

  // ---------- Linha 3: qtd afetada / reincidencia (destaque laranja) ----------
  cell(X0, y, 257, 30, 'Quantidade Afetada', 'Quantity Affected', String(rnc.quantidadePecas ?? ''), {
    labelFill: LARANJA,
  });
  cell(X0 + 257, y, W - 257, 30, 'Reincidência?', 'Reincidence?', simNao(rnc.reincidencia), {
    labelFill: LARANJA,
  });
  y += 30;

  // ---------- Descricao do desvio ----------
  const desvio =
    (rnc.tipoDesvio ? `[${rnc.tipoDesvio}] ` : '') + (rnc.descricaoDesvio ?? '');
  y = secao(y, 'Descrição do Desvio', 'Deviation Description', desvio, 95);

  // ---------- Disposicao ----------
  y = secao(y, 'Disposição', 'Disposition', rnc.disposicao ?? '', 80);

  // ---------- Registro fotografico ----------
  doc.lineWidth(0.8).strokeColor(PRETO).rect(X0, y, W, 16).stroke();
  doc
    .font('Helvetica-Bold')
    .fontSize(8)
    .fillColor(PRETO)
    .text('Registro Fotográfico (Quando necessário)', X0 + 4, y + 2, {
      width: W - 8,
      continued: true,
    })
    .font('Helvetica-Oblique')
    .fontSize(6.5)
    .fillColor(CINZA)
    .text('   Photographic Record (When necessary)');
  y += 16;

  const areaTop = y;
  const areaAltura = doc.page.height - 60 - areaTop;
  doc.lineWidth(0.8).strokeColor(PRETO).rect(X0, areaTop, W, areaAltura).stroke();

  const validas = fotos.filter((p) => existsSync(p)).slice(0, 4);
  if (validas.length) {
    const cols = validas.length === 1 ? 1 : 2;
    const linhas = Math.ceil(validas.length / cols);
    const padding = 8;
    const cellW = (W - padding * (cols + 1)) / cols;
    const cellH = (areaAltura - padding * (linhas + 1)) / linhas;
    validas.forEach((p, i) => {
      const col = i % cols;
      const lin = Math.floor(i / cols);
      const px = X0 + padding + col * (cellW + padding);
      const py = areaTop + padding + lin * (cellH + padding);
      try {
        doc.image(p, px, py, {
          fit: [cellW, cellH],
          align: 'center',
          valign: 'center',
        });
      } catch {
        /* imagem invalida: ignora */
      }
    });
  } else {
    doc
      .font('Helvetica-Oblique')
      .fontSize(9)
      .fillColor(CINZA)
      .text('Sem registro fotográfico. / No photographic record.', X0 + 6, areaTop + 8, {
        width: W - 12,
      });
  }

  // ---------- Rodape ----------
  doc
    .font('Helvetica')
    .fontSize(7)
    .fillColor(CINZA)
    .text(
      `Big Dutchman Brasil — Sistema de Qualidade · Emitido em ${new Date().toLocaleString('pt-BR')}`,
      X0,
      doc.page.height - 45,
      { width: W, align: 'center' },
    );

  return doc;
}
