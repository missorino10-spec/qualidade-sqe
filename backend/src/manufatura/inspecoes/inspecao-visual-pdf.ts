import PDFDocument from 'pdfkit';
import { join } from 'path';
import { existsSync } from 'fs';
import {
  FotoEvidencia,
  desenharFotosEvidencia,
} from '../../comum/fotos-evidencia';
import { ORIGENS_INSPECAO } from '../../comum/inspecao';
import { nomeCurto } from '../../comum/nome';
import { valorDeCelula } from '../../comum/pdf-texto';

// Relatorio de Inspecao Visual da Manufatura.
// Mesmo cabecalho e mesma identidade visual do 011.06 (dimensional), mas sem
// cotas: e um campo aberto com o que o inspetor observou, mais as fotos da
// evidencia daquele momento.

const LARANJA = '#E8792B';
const PRETO = '#000000';
const CINZA = '#555555';
const LOGO_PATH = join(process.cwd(), 'assets', 'logo-big-dutchman.png');

const M = 40;
const X0 = M;
const X1 = 555;
const W = X1 - X0;
const RODAPE = 55;

const ORIGENS = ORIGENS_INSPECAO.map((o) => ({
  chave: o.value,
  label: o.label,
}));

// As datas do formulario sao datas puras (sem hora), gravadas como meia-noite
// UTC. Formatar no fuso do servidor faria 28/07 virar 27/07 em qualquer maquina
// a oeste de Greenwich, entao o fuso e fixado em UTC.
function fmtData(d?: Date | string | null): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

function hojeNoBrasil(): string {
  return new Date().toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
  });
}

function txt(v: any): string {
  return v == null || v === '' ? '' : String(v);
}

export function gerarPdfInspecaoVisual(
  insp: any,
  fotos: FotoEvidencia[] = [],
): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: 'A4', margin: M, bufferPages: true });
  let y = 0;

  const espaco = (altura: number) => {
    if (y + altura > doc.page.height - RODAPE) {
      doc.addPage();
      y = M;
    }
  };

  const cell = (
    x: number,
    largura: number,
    altura: number,
    label: string,
    valor: string,
    opts: { valorColor?: string; negrito?: boolean } = {},
  ) => {
    doc.lineWidth(0.8).strokeColor(PRETO).rect(x, y, largura, altura).stroke();
    doc
      .font('Helvetica-Bold')
      .fontSize(6.5)
      .fillColor(CINZA)
      .text(label, x + 3, y + 3, { width: largura - 6, lineBreak: false });
    doc
      .font(opts.negrito ? 'Helvetica-Bold' : 'Helvetica')
      .fillColor(opts.valorColor ?? PRETO);
    valorDeCelula(doc, valor, x + 3, y + 13, largura - 6, altura - 15, 8.5);
  };

  const linha = (
    campos: {
      w: number;
      label: string;
      valor: string;
      cor?: string;
      negrito?: boolean;
    }[],
    altura = 28,
  ) => {
    espaco(altura);
    let x = X0;
    for (const c of campos) {
      cell(x, c.w, altura, c.label, c.valor, {
        valorColor: c.cor,
        negrito: c.negrito,
      });
      x += c.w;
    }
    y += altura;
  };

  const faixa = (titulo: string, cor = LARANJA) => {
    espaco(18);
    doc.rect(X0, y, W, 16).fill(cor);
    doc
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .fillColor('#FFFFFF')
      .text(titulo, X0 + 5, y + 4, { width: W - 10, lineBreak: false });
    y += 16;
  };

  const bloco = (titulo: string, valor: string, altura = 46) => {
    espaco(altura + 16);
    doc.lineWidth(0.8).strokeColor(PRETO).rect(X0, y, W, 16).stroke();
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor(PRETO)
      .text(titulo, X0 + 4, y + 4, { width: W - 8, lineBreak: false });
    doc.lineWidth(0.8).strokeColor(PRETO).rect(X0, y + 16, W, altura).stroke();
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(PRETO)
      .text(valor || '-', X0 + 5, y + 21, { width: W - 10, height: altura - 8 });
    y += 16 + altura;
  };

  // ---------------------------------------------------------- cabecalho
  const cabecalho = () => {
    if (existsSync(LOGO_PATH)) {
      doc.image(LOGO_PATH, X0, 34, { width: 120 });
    } else {
      doc
        .font('Helvetica-Bold')
        .fontSize(16)
        .fillColor(LARANJA)
        .text('Big Dutchman', X0, 40);
    }

    const cbX = 395;
    const cbW = X1 - cbX;
    const cbLinhas: { rotulo: string; valores: string[] }[] = [
      { rotulo: 'Rel. Nº', valores: [txt(insp?.numero) || '-'] },
      { rotulo: 'Rev.', valores: [txt(insp?.revisao) || '01'] },
      { rotulo: 'Emissão', valores: [hojeNoBrasil()] },
    ];
    const alturaLinha = (l: { valores: string[] }) => 9 + l.valores.length * 8;
    const cbH = cbLinhas.reduce((t, l) => t + alturaLinha(l), 0);
    doc.lineWidth(0.8).strokeColor(PRETO).rect(cbX, 34, cbW, cbH).stroke();

    let cbY = 34;
    for (const l of cbLinhas) {
      if (cbY > 34)
        doc.lineWidth(0.5).moveTo(cbX, cbY).lineTo(X1, cbY).stroke();
      doc
        .font('Helvetica-Bold')
        .fontSize(5.5)
        .fillColor(CINZA)
        .text(`${l.rotulo}:`, cbX + 3, cbY + 2, {
          width: cbW - 6,
          lineBreak: false,
        });
      l.valores.forEach((v, i) => {
        doc
          .font('Helvetica')
          .fontSize(6.5)
          .fillColor(PRETO)
          .text(v, cbX + 3, cbY + 8 + i * 8, {
            width: cbW - 6,
            lineBreak: false,
            ellipsis: true,
          });
      });
      cbY += alturaLinha(l);
    }

    const tituloX = 165;
    const tituloW = cbX - 10 - tituloX;
    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor(PRETO)
      .text('Relatório de Inspeção Visual', tituloX, 38, {
        width: tituloW,
        align: 'center',
      });
    doc
      .font('Helvetica-Oblique')
      .fontSize(8)
      .fillColor(CINZA)
      .text('Visual Inspection Report', tituloX, doc.y + 2, {
        width: tituloW,
        align: 'center',
      });
    y = 34 + cbH + 6;
  };

  // ---------------------------------------------------------- origem
  const origemChecklist = () => {
    espaco(30);
    doc.lineWidth(0.8).strokeColor(PRETO).rect(X0, y, W, 28).stroke();
    doc
      .font('Helvetica-Bold')
      .fontSize(6.5)
      .fillColor(CINZA)
      .text('ORIGEM DA INSPEÇÃO', X0 + 3, y + 3, { width: W - 6 });
    let x = X0 + 4;
    for (const o of ORIGENS) {
      const marcado = insp?.origem === o.chave;
      doc.lineWidth(0.6).strokeColor(PRETO).rect(x, y + 14, 7, 7).stroke();
      if (marcado) {
        doc
          .font('Helvetica-Bold')
          .fontSize(7)
          .fillColor(PRETO)
          .text('X', x + 1, y + 14.5, { lineBreak: false });
      }
      doc
        .font('Helvetica')
        .fontSize(6.5)
        .fillColor(PRETO)
        .text(o.label, x + 10, y + 15, { width: 82, lineBreak: false });
      x += 10 + Math.min(82, doc.widthOfString(o.label) + 6);
    }
    if (insp?.origem === 'OUTROS' && insp?.origemOutros) {
      doc
        .font('Helvetica-Oblique')
        .fontSize(6.5)
        .fillColor(CINZA)
        .text(`(${txt(insp.origemOutros)})`, x + 4, y + 15, {
          width: X1 - x - 8,
          lineBreak: false,
          ellipsis: true,
        });
    }
    y += 28;
  };

  // ---------------------------------------------------------- corpo
  cabecalho();

  linha(
    [
      {
        w: 92,
        label: 'RELATÓRIO Nº',
        valor: txt(insp.numero),
        cor: LARANJA,
        negrito: true,
      },
      { w: 62, label: 'DATA', valor: fmtData(insp.dataInspecao) },
      {
        w: W - 92 - 62 - 90,
        label: 'CENTRO DE TRABALHO',
        valor: txt(insp.maquina?.nome),
      },
      {
        w: 90,
        label: 'TIPO',
        valor: insp.tipo === 'SETUP' ? 'Setup' : 'Produção',
      },
    ],
    30,
  );

  linha([
    { w: 90, label: 'Nº ITEM', valor: txt(insp.itemCodigo) },
    { w: 215, label: 'DESCRIÇÃO', valor: txt(insp.itemDescricao) },
    { w: 65, label: 'DESENHO', valor: txt(insp.desenho) },
    { w: 45, label: 'REVISÃO', valor: txt(insp.desenhoRevisao) },
    { w: W - 90 - 215 - 65 - 45, label: 'PO', valor: txt(insp.po) },
  ]);

  linha([
    { w: 110, label: 'QTD. INSPECIONADA', valor: txt(insp.qtdInspecionada) },
    { w: 100, label: 'QTD. TOTAL', valor: txt(insp.qtdTotal) },
    { w: 70, label: 'SEMANA', valor: txt(insp.semana) },
    {
      w: W - 110 - 100 - 70,
      label: 'INSPETOR',
      valor: nomeCurto(insp.inspetor?.nome),
    },
  ]);

  origemChecklist();

  y += 6;
  faixa('INSPEÇÃO VISUAL');
  bloco('O que foi observado', txt(insp.observacoes), 120);

  // Evidencia fotografica e opcional: o bloco so vai para o papel quando o
  // inspetor subiu foto.
  if (fotos.length) {
    y += 6;
    faixa('REGISTRO FOTOGRÁFICO');
    y = desenharFotosEvidencia(doc, fotos, {
      x0: X0,
      largura: W,
      y,
      margem: M,
      rodape: RODAPE,
    });
  }

  y += 6;
  linha(
    [
      // Quem assina e quem lancou a inspecao, tirado do login. Os campos
      // digitados so respondem pelas inspecoes antigas.
      {
        w: 170,
        label: 'ELABORADO POR',
        valor: nomeCurto(insp.inspetor?.nome) || txt(insp.elaboradoPor),
      },
      {
        w: 170,
        label: 'INSPECIONADO POR',
        valor: nomeCurto(insp.inspetor?.nome) || txt(insp.inspecionadoPor),
      },
      {
        w: W - 170 - 170,
        label: 'DATA',
        valor: fmtData(insp.dataInspecao),
      },
    ],
    34,
  );

  // ---------------------------------------------------------- rodape
  const paginas = doc.bufferedPageRange();
  for (let i = 0; i < paginas.count; i++) {
    doc.switchToPage(paginas.start + i);
    doc.page.margins.bottom = 0;
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(CINZA)
      .text(
        `Big Dutchman Brasil — Sistema de Qualidade · Inspeção visual ${txt(insp.numero)} · Página ${i + 1} de ${paginas.count}`,
        X0,
        doc.page.height - 40,
        { width: W, align: 'center' },
      );
  }

  return doc;
}
