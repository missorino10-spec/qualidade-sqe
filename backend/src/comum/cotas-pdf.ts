// Tabela de cotas do RELATORIO DE INSPECAO DIMENSIONAL (BDBR.QUA.FMR.011.06)
// no PDF. E a MESMA tabela nos tres modulos; so muda a coluna do que foi
// encontrado: Max/Min no lote e uma coluna por peca nas amostras.

const PRETO = '#000000';
const CINZA = '#555555';
const VERDE = '#237804';
const VERMELHO = '#CF1322';

function br(v: unknown): string {
  if (v === null || v === undefined || v === '') return '';
  return String(v).replace('.', ',');
}

function un(cota: any): string {
  return cota?.unidade === 'graus' ? '°' : '';
}

type Coluna = { titulo: string; peso: number; valor: (c: any) => string };

// Quantas colunas de peca a tabela precisa (0 = relatorio de lote, Max/Min).
function qtdPecas(cotas: any[]): number {
  return Math.max(
    0,
    ...cotas.map((c) => (Array.isArray(c.pecas) ? c.pecas.length : 0)),
  );
}

function colunas(cotas: any[]): Coluna[] {
  const pecas = qtdPecas(cotas);
  const encontrado: Coluna[] = pecas
    ? Array.from({ length: pecas }, (_, p) => ({
        titulo: `PEÇA ${String(p + 1).padStart(2, '0')}`,
        peso: 30,
        valor: (c: any) => br(c.pecas?.[p]),
      }))
    : [
        { titulo: 'ENC. Máx.', peso: 38, valor: (c) => br(c.encontradoMax) },
        { titulo: 'ENC. Mín.', peso: 38, valor: (c) => br(c.encontradoMin) },
      ];

  return [
    { titulo: 'LOCALIZAÇÃO', peso: 90, valor: (c) => String(c.localizacao ?? '') },
    {
      titulo: 'ESPECIF.',
      peso: 44,
      valor: (c) => (br(c.especificado) ? `${br(c.especificado)}${un(c)}` : ''),
    },
    { titulo: 'UN.', peso: 26, valor: (c) => (c.unidade === 'graus' ? 'graus' : 'mm') },
    {
      titulo: 'TOLER.',
      peso: 42,
      valor: (c) => (br(c.tolerancia) ? `±${br(c.tolerancia)}${un(c)}` : ''),
    },
    { titulo: 'UPPER', peso: 38, valor: (c) => br(c.upper) },
    { titulo: 'LOWER', peso: 38, valor: (c) => br(c.lower) },
    ...encontrado,
    { titulo: 'INSTRUMENTO', peso: 58, valor: (c) => String(c.instrumento ?? '') },
    { titulo: 'DESV. Mín.', peso: 36, valor: (c) => br(c.desvioMin) },
    { titulo: 'DESV. Máx.', peso: 36, valor: (c) => br(c.desvioMax) },
    {
      titulo: 'CONFORME',
      peso: 40,
      valor: (c) =>
        c.conforme === false ? 'Não' : c.conforme === true ? 'Sim' : '-',
    },
  ];
}

export function desenharTabelaCotas(
  doc: PDFKit.PDFDocument,
  cotasBrutas: unknown,
  opts: {
    x0: number;
    largura: number;
    y: number;
    margem: number;
    rodape: number;
  },
): number {
  const cotas: any[] = Array.isArray(cotasBrutas) ? cotasBrutas : [];
  const { x0, largura, margem, rodape } = opts;
  let y = opts.y;

  const cols = colunas(cotas);
  // Os pesos viram larguras reais: assim a tabela fecha na borda direita com
  // qualquer numero de colunas de peca.
  const total = cols.reduce((t, c) => t + c.peso, 0);
  const larguras = cols.map((c) => (c.peso / total) * largura);

  const cabecalho = () => {
    if (y + 30 > doc.page.height - rodape) {
      doc.addPage();
      y = margem;
    }
    doc.rect(x0, y, largura, 15).fill('#F0F0F0');
    let x = x0;
    cols.forEach((c, i) => {
      doc.lineWidth(0.5).strokeColor('#999999').rect(x, y, larguras[i], 15).stroke();
      doc
        .font('Helvetica-Bold')
        .fontSize(5.5)
        .fillColor(PRETO)
        .text(c.titulo, x + 2, y + 5, {
          width: larguras[i] - 4,
          lineBreak: false,
          ellipsis: true,
        });
      x += larguras[i];
    });
    y += 15;
  };
  cabecalho();

  if (!cotas.length) {
    doc
      .font('Helvetica-Oblique')
      .fontSize(8)
      .fillColor(CINZA)
      .text('Nenhuma cota registrada.', x0 + 4, y + 4, { width: largura - 8 });
    return y + 18;
  }

  for (const cota of cotas) {
    if (y + 16 > doc.page.height - rodape) {
      doc.addPage();
      y = margem;
      cabecalho();
    }
    let x = x0;
    cols.forEach((c, i) => {
      doc.lineWidth(0.5).strokeColor('#CCCCCC').rect(x, y, larguras[i], 16).stroke();
      const conformeCol = c.titulo === 'CONFORME';
      doc
        .font(conformeCol ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(6.5)
        .fillColor(
          conformeCol
            ? cota.conforme === false
              ? VERMELHO
              : VERDE
            : PRETO,
        )
        .text(c.valor(cota), x + 2, y + 5, {
          width: larguras[i] - 4,
          lineBreak: false,
          ellipsis: true,
        });
      x += larguras[i];
    });
    y += 16;
  }

  return y;
}
