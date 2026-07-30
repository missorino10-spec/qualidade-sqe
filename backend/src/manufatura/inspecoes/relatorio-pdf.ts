import PDFDocument from 'pdfkit';
import { join } from 'path';
import { existsSync } from 'fs';

const LARANJA = '#E8792B';
const PRETO = '#000000';
const CINZA = '#555555';
const VERDE = '#237804';
const AMARELO = '#AD6800';
const VERMELHO = '#CF1322';
const LOGO_PATH = join(process.cwd(), 'assets', 'logo-big-dutchman.png');

const M = 40;
const X0 = M;
const X1 = 555;
const W = X1 - X0;
const RODAPE = 55;

// Checkboxes de origem, na mesma ordem do formulario em papel.
const ORIGENS: { chave: string; label: string }[] = [
  { chave: 'PLANO_INSPECAO', label: 'Plano de Inspeção' },
  { chave: 'HOMOLOGACAO', label: 'Homologação' },
  { chave: 'DEVOLUCAO', label: 'Devolução' },
  { chave: 'RETRABALHO', label: 'Retrabalho' },
  { chave: 'RELATORIO_OCORRENCIA', label: 'Relatório de Ocorrência' },
  { chave: 'LIBERACAO_SETUP', label: 'Liberação de Setup' },
  { chave: 'OUTROS', label: 'Outros' },
];

const LABEL_RESULTADO: Record<string, string> = {
  APROVADO: 'APROVADO',
  APROVADO_COM_OBSERVACAO: 'APROVADO COM OBSERVAÇÃO',
  REPROVADO: 'REPROVADO',
};

const COR_RESULTADO: Record<string, string> = {
  APROVADO: VERDE,
  APROVADO_COM_OBSERVACAO: AMARELO,
  REPROVADO: VERMELHO,
};

// As datas do formulario sao datas puras (sem hora), gravadas como meia-noite
// UTC. Formatar no fuso do servidor faria 28/07 virar 27/07 em qualquer maquina
// a oeste de Greenwich, entao o fuso e fixado em UTC.
function fmtData(d?: Date | string | null): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

// Data de emissao do documento: instante real, no fuso da fabrica (o servidor
// da nuvem roda em UTC).
function hojeNoBrasil(): string {
  return new Date().toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
  });
}

function txt(v: any): string {
  return v == null || v === '' ? '' : String(v);
}

// Relatorio de Inspecao Dimensional — Doc BDBR.QUA.FMR.011.06 (rev. 06).
// Um documento por INSPECAO, com TODAS as tentativas (1a inspecao e as
// reinspecoes) na sequencia, cada uma com o seu proprio numero.
export function gerarPdfRelatorioDimensional(insp: any): PDFKit.PDFDocument {
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
      .fontSize(8.5)
      .fillColor(opts.valorColor ?? PRETO)
      .text(valor, x + 3, y + 13, {
        width: largura - 6,
        height: altura - 15,
        ellipsis: true,
      });
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
  const cabecalho = (rel: any) => {
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
      { rotulo: 'Formulário', valores: ['BDBR.QUA.FMR.011.06'] },
      { rotulo: 'Rel. Nº', valores: [txt(rel?.numero) || '-'] },
      { rotulo: 'Rev.', valores: [txt(rel?.revisao) || '01'] },
      { rotulo: 'Emissão', valores: [hojeNoBrasil()] },
    ];
    // 9 (rotulo) + 8 por valor: o ponto extra evita que a ultima linha
    // encoste na borda inferior do quadro e saia cortada.
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
      .text('Relatório de Inspeção Dimensional', tituloX, 38, {
        width: tituloW,
        align: 'center',
      });
    doc
      .font('Helvetica-Oblique')
      .fontSize(8)
      .fillColor(CINZA)
      .text('Dimensional Inspection Report', tituloX, doc.y + 2, {
        width: tituloW,
        align: 'center',
      });
    // O corpo comeca abaixo do quadro de identificacao; se comecasse antes, a
    // primeira faixa cobriria a ultima linha do quadro ("Emissão").
    y = 34 + cbH + 6;
  };

  // ---------------------------------------------------------- origem
  const origemChecklist = (rel: any) => {
    espaco(30);
    doc.lineWidth(0.8).strokeColor(PRETO).rect(X0, y, W, 28).stroke();
    doc
      .font('Helvetica-Bold')
      .fontSize(6.5)
      .fillColor(CINZA)
      .text('ORIGEM DA INSPEÇÃO', X0 + 3, y + 3, { width: W - 6 });
    let x = X0 + 4;
    for (const o of ORIGENS) {
      const marcado = rel?.origem === o.chave;
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
    if (rel?.origem === 'OUTROS' && rel?.origemOutros) {
      doc
        .font('Helvetica-Oblique')
        .fontSize(6.5)
        .fillColor(CINZA)
        .text(`(${txt(rel.origemOutros)})`, x + 4, y + 15, {
          width: X1 - x - 8,
          lineBreak: false,
          ellipsis: true,
        });
    }
    y += 28;
  };

  // ---------------------------------------------------------- tabela de cotas
  const tabelaCotas = (rel: any) => {
    const cotas = Array.isArray(rel.cotas) ? rel.cotas : [];
    // Uma coluna "Encontrado" por peca inspecionada, como no formulario.
    // Limite de 10 colunas: acima disso a tabela nao cabe na folha A4.
    const qtdPecas = Math.min(
      10,
      Math.max(
        1,
        Number(rel.qtdInspecionada) || 0,
        ...cotas.map((c: any) =>
          Array.isArray(c.pecas) ? c.pecas.length : 0,
        ),
      ),
    );

    const fixasEsq = [
      { titulo: 'Localização', w: 78, campo: 'localizacao' },
      { titulo: 'Especificado', w: 48, campo: 'especificado' },
      { titulo: 'Tolerância', w: 44, campo: 'tolerancia' },
      { titulo: 'Upper', w: 34, campo: 'upper' },
      { titulo: 'Lower', w: 34, campo: 'lower' },
    ];
    const fixasDir = [
      { titulo: 'Instrumento', w: 66, campo: 'instrumento' },
      { titulo: 'Desv. Mín.', w: 38, campo: 'desvioMin' },
      { titulo: 'Desv. Máx.', w: 38, campo: 'desvioMax' },
    ];
    const usada =
      fixasEsq.reduce((s, c) => s + c.w, 0) +
      fixasDir.reduce((s, c) => s + c.w, 0);
    const wPeca = Math.max(24, (W - usada) / qtdPecas);

    const cabecalhoTabela = () => {
      espaco(28);
      doc.rect(X0, y, W, 24).fill('#F0F0F0');
      let x = X0;
      const box = (largura: number, titulo: string) => {
        doc.lineWidth(0.5).strokeColor('#999999').rect(x, y, largura, 24).stroke();
        doc
          .font('Helvetica-Bold')
          .fontSize(6.5)
          .fillColor(PRETO)
          .text(titulo, x + 2, y + 8, {
            width: largura - 4,
            align: 'center',
            lineBreak: false,
          });
        x += largura;
      };
      for (const c of fixasEsq) box(c.w, c.titulo);
      // "Encontrado" e um titulo unico cobrindo todas as pecas, com o numero da
      // peca na linha de baixo — igual ao formulario em papel. Repetir a palavra
      // em cada coluna nao caberia a partir de 4 pecas.
      const wBloco = wPeca * qtdPecas;
      doc.lineWidth(0.5).strokeColor('#999999').rect(x, y, wBloco, 12).stroke();
      doc
        .font('Helvetica-Bold')
        .fontSize(6.5)
        .fillColor(PRETO)
        .text('Encontrado', x + 2, y + 3.5, {
          width: wBloco - 4,
          align: 'center',
          lineBreak: false,
        });
      for (let p = 0; p < qtdPecas; p++) {
        doc
          .lineWidth(0.5)
          .strokeColor('#999999')
          .rect(x, y + 12, wPeca, 12)
          .stroke();
        doc
          .font('Helvetica')
          .fontSize(5.5)
          .fillColor(CINZA)
          .text(`PEÇA ${String(p + 1).padStart(2, '0')}`, x + 1, y + 15.5, {
            width: wPeca - 2,
            align: 'center',
            lineBreak: false,
          });
        x += wPeca;
      }
      for (const c of fixasDir) box(c.w, c.titulo);
      y += 24;
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
      return;
    }

    for (const cota of cotas) {
      if (y + 16 > doc.page.height - RODAPE) {
        doc.addPage();
        y = M;
        cabecalhoTabela();
      }
      let x = X0;
      const celula = (largura: number, valor: string, negrito = false) => {
        doc.lineWidth(0.5).strokeColor('#CCCCCC').rect(x, y, largura, 16).stroke();
        doc
          .font(negrito ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(7)
          .fillColor(PRETO)
          .text(valor, x + 2, y + 5, {
            width: largura - 4,
            lineBreak: false,
            ellipsis: true,
          });
        x += largura;
      };
      for (const c of fixasEsq) celula(c.w, txt(cota[c.campo]));
      const pecas = Array.isArray(cota.pecas) ? cota.pecas : [];
      for (let p = 0; p < qtdPecas; p++) celula(wPeca, txt(pecas[p]));
      for (const c of fixasDir) celula(c.w, txt(cota[c.campo]));
      y += 16;
    }
  };

  // ---------------------------------------------------------- uma tentativa
  const relatorios = Array.isArray(insp.relatorios) ? insp.relatorios : [];
  relatorios.forEach((rel: any, indice: number) => {
    if (indice > 0) doc.addPage();
    cabecalho(rel);

    if (relatorios.length > 1) {
      faixa(
        rel.tentativa === 1
          ? `1ª INSPEÇÃO — ${txt(rel.numero)}`
          : `REINSPEÇÃO ${rel.tentativa - 1} — ${txt(rel.numero)}`,
        rel.tentativa === 1 ? LARANJA : '#8C4A16',
      );
    }

    linha(
      [
        {
          w: 92,
          label: 'RELATÓRIO Nº',
          valor: txt(rel.numero),
          cor: LARANJA,
          negrito: true,
        },
        { w: 62, label: 'DATA', valor: fmtData(rel.dataInspecao) },
        {
          w: 118,
          label: 'CENTRO DE TRABALHO',
          valor: txt(insp.maquina?.nome),
        },
        {
          w: 90,
          label: 'TIPO',
          valor: insp.tipo === 'SETUP' ? 'Setup' : 'Produção',
        },
        {
          w: W - 92 - 62 - 118 - 90,
          label: 'INSPEÇÃO',
          valor: insp.extra ? 'Extra' : 'Ciclo',
        },
      ],
      30,
    );

    linha([
      { w: 90, label: 'Nº ITEM', valor: txt(rel.itemCodigo ?? insp.itemCodigo) },
      {
        w: 215,
        label: 'DESCRIÇÃO',
        valor: txt(rel.itemDescricao ?? insp.itemDescricao),
      },
      { w: 90, label: 'DESENHO / REV.', valor: txt(rel.desenhoRev) },
      { w: W - 90 - 215 - 90, label: 'PO', valor: txt(rel.po ?? insp.po) },
    ]);

    linha([
      { w: 110, label: 'QTD. INSPECIONADA', valor: txt(rel.qtdInspecionada) },
      { w: 110, label: 'QTD. TOTAL', valor: txt(rel.qtdTotal) },
      { w: 130, label: 'INSPETOR', valor: txt(rel.inspetor?.nome) },
      {
        w: W - 110 - 110 - 130,
        label: 'TENTATIVA',
        valor: String(rel.tentativa),
      },
    ]);

    origemChecklist(rel);

    y += 6;
    faixa('COTAS INSPECIONADAS');
    tabelaCotas(rel);

    // Bloco visual opcional no fim do relatorio (defeitos encontrados).
    const defeitos = Array.isArray(rel.defeitos) ? rel.defeitos : [];
    if (defeitos.length) {
      y += 6;
      faixa('DEFEITOS ENCONTRADOS');
      for (const d of defeitos) {
        espaco(14);
        doc
          .lineWidth(0.4)
          .strokeColor('#DDDDDD')
          .moveTo(X0, y + 13)
          .lineTo(X1, y + 13)
          .stroke();
        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor(PRETO)
          .text(txt(d.nome ?? d.descricao), X0 + 6, y + 3, {
            width: W - 100,
            lineBreak: false,
            ellipsis: true,
          });
        doc
          .font('Helvetica-Bold')
          .fontSize(8)
          .fillColor(VERMELHO)
          .text(`${txt(d.qtd ?? d.quantidade)} pç`, X1 - 70, y + 3, {
            width: 66,
            align: 'right',
            lineBreak: false,
          });
        y += 14;
      }
      if (rel.descricaoDesvio) {
        y += 4;
        bloco('Descrição do desvio', txt(rel.descricaoDesvio), 40);
      }
    }

    y += 6;
    bloco('Observações Finais', txt(rel.observacoesFinais), 44);

    // "Aprovado com observacao" exige a ressalva registrada.
    if (rel.observacaoResultado) {
      y += 4;
      bloco('Observação do resultado', txt(rel.observacaoResultado), 34);
    }

    y += 6;
    linha(
      [
        {
          w: 160,
          label: 'RESULTADO',
          valor: LABEL_RESULTADO[rel.resultado] ?? txt(rel.resultado),
          cor: COR_RESULTADO[rel.resultado] ?? PRETO,
          negrito: true,
        },
        { w: 130, label: 'ELABORADO POR', valor: txt(rel.elaboradoPor) },
        { w: 130, label: 'INSPECIONADO POR', valor: txt(rel.inspecionadoPor) },
        {
          w: W - 160 - 130 - 130,
          label: 'DATA',
          valor: fmtData(rel.dataInspecao),
        },
      ],
      34,
    );
  });

  if (!relatorios.length) {
    cabecalho(null);
    bloco('Inspeção', 'Nenhum relatório dimensional registrado.', 30);
  }

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
        `Big Dutchman Brasil — Sistema de Qualidade · Inspeção ${txt(insp.numero)} · Página ${i + 1} de ${paginas.count}`,
        X0,
        doc.page.height - 40,
        { width: W, align: 'center' },
      );
  }

  return doc;
}
