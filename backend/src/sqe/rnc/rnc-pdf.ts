import PDFDocument from 'pdfkit';
import { join } from 'path';
import { existsSync } from 'fs';
import { desenharTabelaCotas } from '../../comum/cotas-pdf';
import { rotuloTipoDesvio } from '../../comum/tipo-desvio';
import { nomeCurto } from '../../comum/nome';
import { valorDeCelula } from '../../comum/pdf-texto';

const LARANJA = '#E8792B';
const PRETO = '#000000';
const CINZA = '#555555';
const LOGO_PATH = join(process.cwd(), 'assets', 'logo-big-dutchman.png');

const M = 40; // margem
const X0 = M;
const X1 = 555; // borda direita (A4 595 - 40)
const W = X1 - X0; // largura util (515)

// Data PURA, gravada como meia-noite UTC: tem que ser lida em UTC. Sem o
// timeZone, o Node formata no fuso do servidor - em UTC-3 a meia-noite do dia
// 20 vira 21h do dia 19 e a RNC sai impressa com a data de ontem.
function fmtData(d?: Date | null): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

function simNao(v?: boolean | null): string {
  if (v == null) return 'Não / No';
  return v ? 'Sim / Yes' : 'Não / No';
}

// Gera o PDF da RNC fiel ao formulario BDBR.QUA.FMR.003.05 (bilingue PT/EN),
// incluindo o Registro Fotografico com as fotos anexadas a RNC.
//
// As fotos chegam como bytes (e nao como caminho de arquivo) porque ficam
// guardadas no Supabase Storage, nao no disco do servidor.
export function gerarPdfRnc(rnc: any, fotos: Buffer[] = []): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: 'A4', margin: M, bufferPages: true });

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
    doc.font('Helvetica').fillColor(opts.valorColor ?? PRETO);
    valorDeCelula(
      doc,
      valor || '',
      x + 3,
      y + 17,
      w - 6,
      h - 18,
      opts.valorSize ?? 8.5,
    );
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
  // 17 pt por linha: com 15 o valor encostava na divisoria da linha seguinte e
  // saia riscado no PDF.
  const cbLinhaH = 17;
  doc.lineWidth(0.8).strokeColor(PRETO).rect(cbX, 34, cbW, cbLinhaH * 3).stroke();
  const codLinha = (i: number, pt: string, en: string, v: string) => {
    const topo = 34 + i * cbLinhaH;
    if (i > 0) doc.lineWidth(0.5).moveTo(cbX, topo).lineTo(X1, topo).stroke();
    doc
      .font('Helvetica-Bold')
      .fontSize(5.5)
      .fillColor(PRETO)
      .text(`${pt} / ${en}:`, cbX + 3, topo + 2, { width: cbW - 6, lineBreak: false });
    doc
      .font('Helvetica')
      .fontSize(7)
      .text(v, cbX + 3, topo + 8.5, { width: cbW - 6, lineBreak: false });
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
  // As celulas tem 44 pt (e nao 34) para o valor caber em duas linhas: nomes de
  // fornecedor e numeros de PO duplos estavam sendo cortados com reticencias, o
  // que e inaceitavel num documento oficial.
  const ALTURA_ID = 44;
  const r1 = [
    { w: 76, pt: 'RNC Nº', en: 'NCR Nº', v: rnc.numero, orange: true },
    { w: 74, pt: 'Data de Abertura', en: 'Opening Date', v: fmtData(rnc.dataAbertura) },
    // Responsavel = quem abriu a RNC. O "solicitante" so entra como reserva
    // para as RNCs antigas, gravadas antes do usuario ser carimbado.
    {
      w: 90,
      pt: 'Responsável',
      en: 'Responsible',
      v: nomeCurto(rnc.criadoPor?.nome) || rnc.solicitante || 'Qualidade',
    },
    { w: 80, pt: 'Setor', en: 'Department', v: 'Qualidade / Quality' },
    // "Supplier", e nao "Vendor": e o termo que a casa usa nos formularios do
    // SQD (Supplier Audit Record, Supplier Approval Record).
    { w: 115, pt: 'Fornecedor', en: 'Supplier', v: rnc.fornecedor?.nome ?? '' },
    { w: 80, pt: 'Código', en: 'Code', v: rnc.fornecedor?.codigo ?? '' },
  ];
  let x = X0;
  for (const c of r1) {
    cell(x, y, c.w, ALTURA_ID, c.pt, c.en, c.v ?? '', {
      valorColor: c.orange ? LARANJA : PRETO,
      valorSize: c.orange ? 9 : 8,
    });
    x += c.w;
  }
  y += ALTURA_ID;

  // ---------- Linha 2: item ----------
  const r2 = [
    { w: 80, pt: 'Código do Item', en: 'Item Code', v: rnc.item?.codigo ?? '' },
    { w: 80, pt: 'Quantidade do Lote', en: 'Batch Quantity', v: String(rnc.quantidadeLote ?? '') },
    { w: 70, pt: 'NF', en: 'Invoice', v: rnc.notaFiscal ?? '' },
    { w: 75, pt: 'PO', en: 'PO', v: rnc.po ?? '' },
    { w: 210, pt: 'Descrição Item', en: 'Item Description', v: rnc.item?.descricao ?? '' },
  ];
  x = X0;
  for (const c of r2) {
    cell(x, y, c.w, ALTURA_ID, c.pt, c.en, c.v, { valorSize: 8 });
    x += c.w;
  }
  y += ALTURA_ID;

  // ---------- Linha 3: qtd afetada / reincidencia (destaque laranja) ----------
  cell(X0, y, 257, 30, 'Quantidade Afetada', 'Quantity Affected', String(rnc.quantidadePecas ?? ''), {
    labelFill: LARANJA,
  });
  // "Recurrence", e nao "Reincidence": reincidence nao existe como termo da
  // qualidade em ingles, e um decalque do portugues.
  cell(X0 + 257, y, W - 257, 30, 'Reincidência?', 'Recurrence?', simNao(rnc.reincidencia), {
    labelFill: LARANJA,
  });
  y += 30;

  // ---------- Descricao do desvio ----------
  // As cotas reprovadas saem DENTRO do quadro da descricao, e nao mais num
  // anexo no fim do PDF: quem le a RNC ve o desvio e a medicao que o comprova
  // no mesmo lugar. As cotas vem da inspecao vinculada (leitura ao vivo), e
  // nao de uma copia gravada na RNC.
  const cotas: any[] = Array.isArray(rnc.inspecaoLote?.cotas)
    ? rnc.inspecaoLote.cotas
    : [];
  const reprovadas = cotas.filter((c) => c?.conforme === false);

  const tipo = rotuloTipoDesvio(rnc.tipoDesvio);
  const desvio = (tipo ? `[${tipo}] ` : '') + (rnc.descricaoDesvio ?? '');

  // Cotas que nao couberam na folha 1 e continuam na pagina seguinte.
  let sobraCotas: any[] = [];

  if (!reprovadas.length) {
    y = secao(y, 'Descrição do Desvio', 'Deviation Description', desvio, 95);
  } else {
    const ALTURA_TEXTO = 46;
    const ALT_CAB = 22; // cabecalho da tabela de cotas
    const ALT_LINHA = 16;
    const AREA_FOTO_MIN = 120;
    // O formulario oficial e de uma folha so. Medindo do fim util da pagina
    // para tras - registro fotografico (16 da faixa + area minima) e
    // disposicao (16 + 80) -, sobra o teto que o quadro da descricao pode
    // ocupar sem empurrar o resto do formulario para fora.
    const teto = doc.page.height - 60 - AREA_FOTO_MIN - 16 - 96;
    const inicioTabela = y + 16 + ALTURA_TEXTO + 12;
    const cabem = Math.max(
      1,
      Math.floor((teto - inicioTabela - ALT_CAB) / ALT_LINHA),
    );
    const naFolha = reprovadas.slice(0, cabem);
    sobraCotas = reprovadas.slice(cabem);
    const altura =
      ALTURA_TEXTO + 12 + ALT_CAB + naFolha.length * ALT_LINHA + 6;

    doc.lineWidth(0.8).strokeColor(PRETO).rect(X0, y, W, 16).stroke();
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor(PRETO)
      .text('Descrição do Desvio', X0 + 4, y + 2, {
        width: W - 8,
        continued: true,
      })
      .font('Helvetica-Oblique')
      .fontSize(6.5)
      .fillColor(CINZA)
      .text('   Deviation Description');
    doc.lineWidth(0.8).strokeColor(PRETO).rect(X0, y + 16, W, altura).stroke();
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(PRETO)
      .text(desvio || '', X0 + 5, y + 21, {
        width: W - 10,
        height: ALTURA_TEXTO - 8,
      });
    doc
      .font('Helvetica-Bold')
      .fontSize(7)
      .fillColor(CINZA)
      .text(
        'Cotas reprovadas / Rejected dimensions',
        X0 + 5,
        y + 16 + ALTURA_TEXTO,
        { width: W - 10 },
      );
    desenharTabelaCotas(doc, naFolha, {
      x0: X0 + 5,
      largura: W - 10,
      y: inicioTabela,
      margem: M,
      rodape: 60,
    });
    y += 16 + altura;
  }

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

  const validas = fotos.slice(0, 4);
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

  // ---------- Continuacao das cotas reprovadas ----------
  // So existe quando ha mais cotas do que cabem no quadro da descricao na
  // folha 1. No caso normal (poucas cotas) o PDF continua com uma pagina so.
  if (sobraCotas.length) {
    doc.addPage();
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor(PRETO)
      .text('Cotas Reprovadas (continuação)', X0, M, { width: W });
    doc
      .font('Helvetica-Oblique')
      .fontSize(8)
      .fillColor(CINZA)
      .text(
        `Rejected Dimensions — RNC ${rnc.numero} · inspeção dimensional do recebimento`,
        X0,
        M + 15,
        { width: W },
      );
    desenharTabelaCotas(doc, sobraCotas, {
      x0: X0,
      largura: W,
      y: M + 34,
      margem: M,
      rodape: 60,
    });
  }

  // ---------- Rodape ----------
  // O rodape fica abaixo da margem inferior: sem zerar a margem, o pdfkit
  // entende que o texto "transbordou" e cria uma pagina em branco extra.
  const paginas = doc.bufferedPageRange();
  for (let i = 0; i < paginas.count; i++) {
    doc.switchToPage(paginas.start + i);
    doc.page.margins.bottom = 0;
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(CINZA)
      .text(
        `Big Dutchman Brasil — Sistema de Qualidade · RNC ${rnc.numero ?? ''} · Página ${i + 1} de ${paginas.count}`,
        X0,
        doc.page.height - 40,
        { width: W, align: 'center' },
      );
  }

  return doc;
}
