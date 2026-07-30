import PDFDocument from 'pdfkit';
import { join } from 'path';
import { existsSync } from 'fs';

const LARANJA = '#E8792B';
const PRETO = '#000000';
const CINZA = '#555555';
const VERDE = '#237804';
const VERMELHO = '#CF1322';
const LOGO_PATH = join(process.cwd(), 'assets', 'logo-big-dutchman.png');

const M = 40;
const X0 = M;
const X1 = 555;
const W = X1 - X0;
const RODAPE = 55; // espaco reservado para o rodape

const LABEL_STATUS: Record<string, string> = {
  APROVADO: 'Aprovado',
  REPROVADO: 'Reprovado',
  NAO_APLICAVEL: 'N/A',
};

function fmtData(d?: Date | string | null): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('pt-BR');
}

function txt(v: any): string {
  return v == null || v === '' ? '' : String(v);
}

// Relatorio de inspecao de recebimento: um documento por INSPECAO, contendo os
// formularios que foram preenchidos (Visual e/ou Lote) exatamente como ficaram
// salvos. Serve tanto para inspecao aprovada quanto reprovada.
export function gerarPdfInspecao(insp: any): PDFKit.PDFDocument {
  // bufferPages: sem isso o rodape "Pagina X de Y" nao consegue voltar nas
  // paginas anteriores - bufferedPageRange() enxergaria so a pagina atual.
  const doc = new PDFDocument({ size: 'A4', margin: M, bufferPages: true });
  let y = 0;

  // Quebra de pagina quando o proximo bloco nao cabe.
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
      .fontSize(8.5)
      .fillColor(opts.valorColor ?? PRETO)
      .text(valor, x + 3, y + 13, {
        width: largura - 6,
        height: altura - 15,
        ellipsis: true,
      });
  };

  // Linha de celulas: cada uma com sua largura proporcional.
  const linha = (
    campos: { w: number; label: string; valor: string; cor?: string; negrito?: boolean }[],
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
  if (existsSync(LOGO_PATH)) {
    doc.image(LOGO_PATH, X0, 34, { width: 120 });
  } else {
    doc
      .font('Helvetica-Bold')
      .fontSize(16)
      .fillColor(LARANJA)
      .text('Big Dutchman', X0, 40);
  }

  const codigos = [
    insp.visual ? 'BDBR.QUA.FMR.06.07' : null,
    insp.lote ? 'BDBR.QUA.FMR.011.06' : null,
  ].filter(Boolean) as string[];

  // Cada codigo de formulario ocupa a sua propria linha: juntar os dois em uma
  // linha so estourava a largura da caixa e invadia a linha de baixo.
  const cbX = 395;
  const cbW = X1 - cbX;
  const cbLinhas: { rotulo: string; valores: string[] }[] = [
    { rotulo: 'Formulário', valores: codigos.length ? codigos : ['-'] },
    { rotulo: 'Inspeção Nº', valores: [txt(insp.numeroInspecao) || '-'] },
    { rotulo: 'Emissão', valores: [new Date().toLocaleDateString('pt-BR')] },
  ];
  const alturaLinha = (l: { valores: string[] }) => 8 + l.valores.length * 8;
  const cbH = cbLinhas.reduce((t, l) => t + alturaLinha(l), 0);
  doc.lineWidth(0.8).strokeColor(PRETO).rect(cbX, 34, cbW, cbH).stroke();

  let cbY = 34;
  for (const l of cbLinhas) {
    if (cbY > 34) {
      doc.lineWidth(0.5).moveTo(cbX, cbY).lineTo(X1, cbY).stroke();
    }
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

  // O titulo quebra em duas linhas nesta largura: o subtitulo vem depois dele,
  // nao numa coordenada fixa, senao os dois se sobrepoem.
  const tituloX = 165;
  const tituloW = cbX - 10 - tituloX;
  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor(PRETO)
    .text('Relatório de Inspeção de Recebimento', tituloX, 38, {
      width: tituloW,
      align: 'center',
    });
  doc
    .font('Helvetica-Oblique')
    .fontSize(8)
    .fillColor(CINZA)
    .text('Incoming Inspection Report', tituloX, doc.y + 2, {
      width: tituloW,
      align: 'center',
    });

  y = 92;

  // ---------------------------------------------------------- identificacao
  const reprovado = insp.resultado === 'REPROVADO';
  // Recebimento sem inspecao nao e "aprovado": nada foi verificado.
  const semInspecao = insp.resultado === 'SEM_INSPECAO';
  const labelResultado = semInspecao
    ? 'SEM INSPEÇÃO'
    : reprovado
      ? 'REPROVADO'
      : 'APROVADO';
  linha(
    [
      {
        w: 92,
        label: 'INSPEÇÃO Nº',
        valor: txt(insp.numeroInspecao),
        cor: LARANJA,
        negrito: true,
      },
      { w: 68, label: 'DATA', valor: fmtData(insp.dataInspecao) },
      {
        w: 60,
        label: 'SEMANA',
        valor: `${txt(insp.semana)}${insp.ano ? `/${insp.ano}` : ''}`,
      },
      {
        w: 115,
        label: 'INSPETOR',
        valor: txt(insp.inspetor?.nome),
      },
      {
        w: 100,
        label: 'RESULTADO',
        valor: labelResultado,
        cor: semInspecao ? CINZA : reprovado ? VERMELHO : VERDE,
        negrito: true,
      },
      {
        w: W - 92 - 68 - 60 - 115 - 100,
        label: 'TIPO',
        valor: insp.inspecaoExtra ? 'Extra' : 'Ciclo',
      },
    ],
    30,
  );

  linha([
    { w: 70, label: 'FORNECEDOR', valor: txt(insp.fornecedor?.codigo) },
    { w: 215, label: 'RAZÃO SOCIAL', valor: txt(insp.fornecedor?.nome) },
    { w: 80, label: 'CLASSIFICAÇÃO', valor: txt(insp.fornecedor?.classificacaoFornecimento) },
    {
      w: W - 70 - 215 - 80,
      label: 'RNC',
      valor: (insp.rncs ?? []).map((r: any) => r.numero).join(', ') || '-',
      cor: reprovado ? VERMELHO : PRETO,
    },
  ]);

  const formulario = insp.visual ?? insp.lote ?? {};
  linha([
    { w: 90, label: 'CÓDIGO DO ITEM', valor: txt(insp.item?.codigo) },
    { w: 215, label: 'DESCRIÇÃO', valor: txt(insp.item?.descricao) },
    { w: 80, label: 'NOTA FISCAL', valor: txt(insp.notaFiscal) },
    { w: W - 90 - 215 - 80, label: 'PO', valor: txt(insp.po) },
  ]);

  linha([
    {
      w: 90,
      label: 'QTD. INSPECIONADA',
      valor: txt(formulario.qtdInspecionada),
    },
    { w: 80, label: 'QTD. DO LOTE', valor: txt(formulario.qtdTotal) },
    { w: 130, label: 'DESENHO / REV.', valor: txt(formulario.desenhoRev) },
    {
      w: W - 90 - 80 - 130,
      label: 'TOLERÂNCIAS / NORMA',
      valor: txt(formulario.toleranciasNorm),
    },
  ]);

  // ---------------------------------------------------------- visual
  if (insp.visual) {
    faixa('INSPEÇÃO VISUAL — checklist preenchido');
    const checklist = Array.isArray(insp.visual.checklist)
      ? insp.visual.checklist
      : [];
    for (const grupo of checklist) {
      espaco(16);
      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor(PRETO)
        .text(txt(grupo.grupo), X0 + 2, y + 3, { width: W - 4 });
      y += 15;
      for (const item of grupo.itens ?? []) {
        espaco(13);
        const status = txt(item.status);
        const cor =
          status === 'REPROVADO'
            ? VERMELHO
            : status === 'APROVADO'
              ? VERDE
              : CINZA;
        doc
          .lineWidth(0.4)
          .strokeColor('#DDDDDD')
          .moveTo(X0, y + 12)
          .lineTo(X1, y + 12)
          .stroke();
        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor(PRETO)
          .text(txt(item.texto), X0 + 10, y + 2, {
            width: W - 100,
            lineBreak: false,
            ellipsis: true,
          });
        doc
          .font('Helvetica-Bold')
          .fontSize(8)
          .fillColor(cor)
          .text(LABEL_STATUS[status] ?? status, X1 - 70, y + 2, {
            width: 68,
            align: 'right',
            lineBreak: false,
          });
        y += 13;
      }
      y += 3;
    }
    if (insp.visual.observacoes) {
      y += 4;
      bloco('Observações da inspeção visual', txt(insp.visual.observacoes), 40);
    }
  }

  // ---------------------------------------------------------- lote
  if (insp.lote) {
    y += 6;
    faixa('INSPEÇÃO DE LOTE / DIMENSIONAL — cotas medidas');
    const cotas = Array.isArray(insp.lote.cotas) ? insp.lote.cotas : [];
    const colunas = [
      { titulo: 'Localização / Cota', w: 150, campo: 'localizacao' },
      { titulo: 'Especificado', w: 75, campo: 'especificado' },
      { titulo: 'Tol. +', w: 50, campo: 'tolUpper' },
      { titulo: 'Tol. -', w: 50, campo: 'tolLower' },
      { titulo: 'Medido', w: 65, campo: 'medido' },
      { titulo: 'Instrumento', w: 75, campo: 'instrumento' },
      { titulo: 'Conforme', w: W - 150 - 75 - 50 - 50 - 65 - 75, campo: 'conforme' },
    ];

    const cabecalhoTabela = () => {
      espaco(16);
      doc.rect(X0, y, W, 15).fill('#F0F0F0');
      let x = X0;
      for (const c of colunas) {
        doc
          .lineWidth(0.5)
          .strokeColor('#999999')
          .rect(x, y, c.w, 15)
          .stroke();
        doc
          .font('Helvetica-Bold')
          .fontSize(7)
          .fillColor(PRETO)
          .text(c.titulo, x + 3, y + 4, { width: c.w - 6, lineBreak: false });
        x += c.w;
      }
      y += 15;
    };
    cabecalhoTabela();

    if (!cotas.length) {
      espaco(18);
      doc
        .font('Helvetica-Oblique')
        .fontSize(8)
        .fillColor(CINZA)
        .text('Nenhuma cota registrada.', X0 + 4, y + 4, { width: W - 8 });
      y += 18;
    }

    for (const cota of cotas) {
      if (y + 16 > doc.page.height - RODAPE) {
        doc.addPage();
        y = M;
        cabecalhoTabela();
      }
      let x = X0;
      for (const c of colunas) {
        doc.lineWidth(0.5).strokeColor('#CCCCCC').rect(x, y, c.w, 16).stroke();
        const conforme = cota.conforme !== false;
        const valor =
          c.campo === 'conforme'
            ? conforme
              ? 'Sim'
              : 'Não'
            : txt(cota[c.campo]);
        doc
          .font(c.campo === 'conforme' ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(7.5)
          .fillColor(
            c.campo === 'conforme' ? (conforme ? VERDE : VERMELHO) : PRETO,
          )
          .text(valor, x + 3, y + 5, {
            width: c.w - 6,
            lineBreak: false,
            ellipsis: true,
          });
        x += c.w;
      }
      y += 16;
    }
    if (insp.lote.observacoes) {
      y += 4;
      bloco('Observações da inspeção de lote', txt(insp.lote.observacoes), 40);
    }
  }

  if (!insp.visual && !insp.lote) {
    y += 6;
    bloco(
      'Inspeção',
      'Recebimento registrado sem inspeção (fora do ciclo de periodicidade).',
      30,
    );
  }

  // ---------------------------------------------------------- assinatura
  y += 10;
  linha(
    [
      { w: W / 2, label: 'INSPETOR RESPONSÁVEL', valor: txt(insp.inspetor?.nome) },
      { w: W / 2, label: 'VISTO / DATA', valor: '' },
    ],
    38,
  );

  // ---------------------------------------------------------- rodape
  const paginas = doc.bufferedPageRange();
  for (let i = 0; i < paginas.count; i++) {
    doc.switchToPage(paginas.start + i);
    // O rodape fica abaixo da margem inferior: sem zerar a margem, o pdfkit
    // entende que o texto "transbordou" e cria uma pagina em branco extra.
    doc.page.margins.bottom = 0;
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(CINZA)
      .text(
        `Big Dutchman Brasil — Sistema de Qualidade · Inspeção ${txt(insp.numeroInspecao)} · Página ${i + 1} de ${paginas.count}`,
        X0,
        doc.page.height - 40,
        { width: W, align: 'center' },
      );
  }

  return doc;
}
