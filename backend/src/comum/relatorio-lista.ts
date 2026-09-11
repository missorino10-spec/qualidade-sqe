// Relatorio de LISTA — o papel (e a planilha) de uma tela de lancamentos.
//
// Toda tela que lista registros exporta a MESMA coisa: o recorte que o filtro
// esta mostrando, nas mesmas colunas da tela. Antes disso cada modulo que
// quisesse exportar teria de desenhar o proprio PDF; aqui a tela so declara as
// colunas e de onde sai cada valor, e o desenho e o mesmo em todas.
//
// O visual segue o relatorio de CNQ, que foi o primeiro: A4 deitada, faixa
// laranja, cabecalho com logo e filtros, rodape paginado.
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import type { Response } from 'express';
import { join } from 'path';
import { existsSync } from 'fs';
import { nomeCurto } from './nome';

const LARANJA = '#E8792B';
const PRETO = '#000000';
const CINZA = '#555555';
const FUNDO = '#F2F2F2';
const LOGO_PATH = join(process.cwd(), 'assets', 'logo-big-dutchman.png');

const M = 34;
const X0 = M;
const X1 = 808; // A4 deitada (841,89) menos a margem da direita
const W = X1 - X0;
const RODAPE = 42;

export type TipoColuna = 'texto' | 'numero' | 'moeda' | 'data' | 'percentual';

export type ColunaRelatorio<T = any> = {
  titulo: string;
  /** Peso relativo da largura no PDF. Sem peso, todas as colunas empatam. */
  peso?: number;
  /** Valor cru. O tipo decide a formatacao no PDF e o formato na planilha. */
  valor: (registro: T) => any;
  tipo?: TipoColuna;
  negrito?: boolean;
};

export type Relatorio<T = any> = {
  titulo: string;
  /** Recorte que o filtro da tela esta mostrando, em "rotulo: valor". */
  filtros?: { rotulo: string; valor: string }[];
  colunas: ColunaRelatorio<T>[];
  linhas: T[];
  /** Cartoes de total no topo, como os da tela. */
  totais?: { rotulo: string; valor: string }[];
  emitidoPor?: string;
};

// Datas puras chegam como meia-noite UTC: formatar no fuso do servidor faria
// 28/07 virar 27/07 a oeste de Greenwich.
function fmtData(d: any): string {
  if (!d) return '';
  const data = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(data.getTime())) return String(d);
  return data.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

function fmtNumero(v: any, casas = 2): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

export function formatar(valor: any, tipo: TipoColuna = 'texto'): string {
  if (valor === null || valor === undefined || valor === '') return '';
  if (tipo === 'data') return fmtData(valor);
  if (tipo === 'moeda') return `R$ ${fmtNumero(valor)}`;
  if (tipo === 'percentual') return `${fmtNumero(valor, 1)}%`;
  if (tipo === 'numero') {
    const n = Number(valor);
    if (!Number.isFinite(n)) return String(valor);
    return Number.isInteger(n) ? n.toLocaleString('pt-BR') : fmtNumero(n);
  }
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não';
  return String(valor);
}

function alinhaDireita(tipo?: TipoColuna): boolean {
  return tipo === 'numero' || tipo === 'moeda' || tipo === 'percentual';
}

function hojeNoBrasil(): string {
  return new Date().toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
  });
}

// Nome de arquivo sem acento e sem espaco: alguns navegadores e o Windows
// estragam o download quando o nome vem com caractere fora do ASCII.
export function nomeArquivo(titulo: string, extensao: string): string {
  const base = titulo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .toLowerCase();
  const hoje = new Date().toISOString().slice(0, 10);
  return `${base}-${hoje}.${extensao}`;
}

export function gerarPdfLista<T>(rel: Relatorio<T>): PDFKit.PDFDocument {
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: M,
    bufferPages: true,
  });
  let y = 0;

  // ------------------------------------------------------------- cabecalho
  if (existsSync(LOGO_PATH)) {
    doc.image(LOGO_PATH, X0, 30, { width: 120 });
  } else {
    doc
      .font('Helvetica-Bold')
      .fontSize(16)
      .fillColor(LARANJA)
      .text('Big Dutchman', X0, 36);
  }
  doc
    .font('Helvetica-Bold')
    .fontSize(14)
    .fillColor(PRETO)
    .text(rel.titulo, 170, 34, { width: X1 - 170 - 150, align: 'center' });
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(CINZA)
    .text(
      `Emissão: ${hojeNoBrasil()}${
        rel.emitidoPor ? `\nEmitido por: ${nomeCurto(rel.emitidoPor)}` : ''
      }`,
      X1 - 150,
      36,
      { width: 150, align: 'right' },
    );
  y = 62;

  // O papel tem que dizer exatamente o recorte que esta sendo mostrado.
  const filtros = [
    ...(rel.filtros ?? []),
    { rotulo: 'Registros', valor: String(rel.linhas.length) },
  ];
  doc.lineWidth(0.8).strokeColor(PRETO).rect(X0, y, W, 18).stroke();
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(PRETO)
    .text(
      filtros.map((f) => `${f.rotulo}: ${f.valor}`).join('     |     '),
      X0 + 6,
      y + 5,
      { width: W - 12, lineBreak: false, ellipsis: true },
    );
  y += 24;

  // ------------------------------------------------------------- totais
  if (rel.totais?.length) {
    const largura = W / rel.totais.length;
    rel.totais.forEach((t, i) => {
      const x = X0 + i * largura;
      doc.rect(x, y, largura, 34).fill(FUNDO);
      doc.lineWidth(0.8).strokeColor(PRETO).rect(x, y, largura, 34).stroke();
      doc
        .font('Helvetica-Bold')
        .fontSize(6.5)
        .fillColor(CINZA)
        .text(t.rotulo.toUpperCase(), x + 6, y + 5, { width: largura - 12 });
      doc
        .font('Helvetica-Bold')
        .fontSize(13)
        .fillColor(i === 0 ? LARANJA : PRETO)
        .text(t.valor, x + 6, y + 15, { width: largura - 12 });
    });
    y += 42;
  }

  // ------------------------------------------------------------- tabela
  doc.rect(X0, y, W, 16).fill(LARANJA);
  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor('#FFFFFF')
    .text('REGISTROS DO PERÍODO', X0 + 6, y + 4, {
      width: W - 12,
      lineBreak: false,
    });
  y += 16;

  const pesoTotal = rel.colunas.reduce((t, c) => t + (c.peso ?? 60), 0);
  const larguras = rel.colunas.map((c) => ((c.peso ?? 60) / pesoTotal) * W);

  const cabecalhoTabela = () => {
    doc.rect(X0, y, W, 15).fill('#F0F0F0');
    let x = X0;
    rel.colunas.forEach((c, i) => {
      doc
        .lineWidth(0.5)
        .strokeColor('#999999')
        .rect(x, y, larguras[i], 15)
        .stroke();
      doc
        .font('Helvetica-Bold')
        .fontSize(6)
        .fillColor(PRETO)
        .text(c.titulo.toUpperCase(), x + 3, y + 5, {
          width: larguras[i] - 6,
          lineBreak: false,
          ellipsis: true,
          align: alinhaDireita(c.tipo) ? 'right' : 'left',
        });
      x += larguras[i];
    });
    y += 15;
  };
  cabecalhoTabela();

  if (!rel.linhas.length) {
    doc.lineWidth(0.5).strokeColor('#CCCCCC').rect(X0, y, W, 18).stroke();
    doc
      .font('Helvetica-Oblique')
      .fontSize(8)
      .fillColor(CINZA)
      .text('Nenhum registro no período.', X0 + 6, y + 5, { width: W - 12 });
    y += 18;
  }

  for (const registro of rel.linhas) {
    const textos = rel.colunas.map((c) => formatar(c.valor(registro), c.tipo));
    // A linha cresce ate caber o maior texto: e o que evita corte de descricao.
    const altura =
      Math.max(
        14,
        ...textos.map((t, i) => {
          if (!t) return 0;
          doc.font('Helvetica').fontSize(6.5);
          return doc.heightOfString(t, { width: larguras[i] - 6 });
        }),
      ) + 7;

    if (y + altura > doc.page.height - RODAPE) {
      doc.addPage();
      y = M;
      cabecalhoTabela();
    }

    let x = X0;
    rel.colunas.forEach((c, i) => {
      doc
        .lineWidth(0.5)
        .strokeColor('#CCCCCC')
        .rect(x, y, larguras[i], altura)
        .stroke();
      doc
        .font(c.negrito ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(6.5)
        .fillColor(PRETO)
        .text(textos[i], x + 3, y + 4, {
          width: larguras[i] - 6,
          height: altura - 6,
          align: alinhaDireita(c.tipo) ? 'right' : 'left',
        });
      x += larguras[i];
    });
    y += altura;
  }

  // ------------------------------------------------------------- rodape
  const paginas = doc.bufferedPageRange();
  for (let i = 0; i < paginas.count; i++) {
    doc.switchToPage(paginas.start + i);
    doc.page.margins.bottom = 0;
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(CINZA)
      .text(
        `Big Dutchman Brasil — Sistema de Qualidade · ${rel.titulo} · Página ${i + 1} de ${paginas.count}`,
        X0,
        doc.page.height - 30,
        { width: W, align: 'center' },
      );
  }

  return doc;
}

// Planilha do mesmo recorte. Numero sai como NUMERO (e nao como texto), senao
// quem exporta para conferir nao consegue somar a coluna no Excel.
export async function gerarExcelLista<T>(rel: Relatorio<T>): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Big Dutchman Brasil — Sistema de Qualidade';
  wb.created = new Date();
  const ws = wb.addWorksheet(rel.titulo.slice(0, 28) || 'Relatório');

  const totalColunas = rel.colunas.length;
  const mesclar = (linha: number) =>
    ws.mergeCells(linha, 1, linha, Math.max(totalColunas, 1));

  ws.addRow([rel.titulo]);
  mesclar(1);
  ws.getCell('A1').font = { bold: true, size: 14 };

  const recorte = [
    ...(rel.filtros ?? []),
    { rotulo: 'Registros', valor: String(rel.linhas.length) },
    { rotulo: 'Emissão', valor: hojeNoBrasil() },
    ...(rel.emitidoPor
      ? [{ rotulo: 'Emitido por', valor: nomeCurto(rel.emitidoPor) }]
      : []),
  ];
  ws.addRow([recorte.map((f) => `${f.rotulo}: ${f.valor}`).join('  |  ')]);
  mesclar(2);
  ws.getCell('A2').font = { size: 9, color: { argb: 'FF555555' } };
  ws.addRow([]);

  const cabecalho = ws.addRow(rel.colunas.map((c) => c.titulo));
  cabecalho.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  cabecalho.alignment = { vertical: 'middle', wrapText: true };
  cabecalho.height = 24;
  cabecalho.eachCell((celula) => {
    celula.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE8792B' },
    };
  });

  for (const registro of rel.linhas) {
    const linha = ws.addRow(
      rel.colunas.map((c) => {
        const v = c.valor(registro);
        if (v === null || v === undefined || v === '') return null;
        if (c.tipo === 'data') {
          const d = v instanceof Date ? v : new Date(v);
          return Number.isNaN(d.getTime()) ? String(v) : d;
        }
        if (c.tipo === 'numero' || c.tipo === 'moeda' || c.tipo === 'percentual') {
          const n = Number(v);
          return Number.isFinite(n) ? n : String(v);
        }
        if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
        return typeof v === 'object' ? formatar(v) : v;
      }),
    );
    linha.alignment = { vertical: 'top', wrapText: true };
    rel.colunas.forEach((c, i) => {
      const celula = linha.getCell(i + 1);
      if (c.tipo === 'data') celula.numFmt = 'dd/mm/yyyy';
      if (c.tipo === 'moeda') celula.numFmt = 'R$ #,##0.00';
      if (c.tipo === 'percentual') celula.numFmt = '0.0"%"';
      if (c.tipo === 'numero') celula.numFmt = '#,##0.##';
      if (c.negrito) celula.font = { bold: true };
    });
  }

  // Largura pela maior celula da coluna, com teto para a descricao longa nao
  // empurrar o resto da planilha para fora da tela.
  rel.colunas.forEach((c, i) => {
    const maior = rel.linhas.reduce((max, r) => {
      const texto = formatar(c.valor(r), c.tipo);
      return Math.max(max, texto.length);
    }, c.titulo.length);
    ws.getColumn(i + 1).width = Math.min(Math.max(maior + 2, 10), 45);
  });

  ws.views = [{ state: 'frozen', ySplit: 4 }];
  ws.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: 4, column: totalColunas },
  };

  // O writeBuffer do exceljs devolve o Buffer dele, que nao casa com o tipo do
  // Node; o conteudo e o mesmo.
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export type FormatoRelatorio = 'pdf' | 'excel';

// Um endpoint so entrega os dois formatos: "?formato=excel" troca o papel pela
// planilha. Assim a tela nao precisa de duas rotas nem de dois filtros.
export async function responderRelatorio<T>(
  res: Response,
  rel: Relatorio<T>,
  formato?: string,
): Promise<void> {
  if (formato === 'excel' || formato === 'xlsx') {
    const buffer = await gerarExcelLista(rel);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${nomeArquivo(rel.titulo, 'xlsx')}"`,
    );
    res.end(buffer);
    return;
  }
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `inline; filename="${nomeArquivo(rel.titulo, 'pdf')}"`,
  );
  const doc = gerarPdfLista(rel);
  doc.pipe(res);
  doc.end();
}

// Rotulo do recorte de datas, do jeito que aparece no cabecalho do relatorio.
export function periodoTexto(de?: string, ate?: string): string {
  if (!de && !ate) return 'Todo o período';
  return `${de ? fmtData(de) : '...'} a ${ate ? fmtData(ate) : '...'}`;
}
