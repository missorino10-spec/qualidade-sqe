// Tabela de cotas do RELATORIO DE INSPECAO DIMENSIONAL (BDBR.QUA.FMR.011.06)
// no PDF. E a MESMA tabela nos tres modulos; so muda a coluna do que foi
// encontrado: Max/Min no lote e uma coluna por peca nas amostras.

import {
  UNIDADES_COTA,
  gruposDeDesenho,
  normaCurta,
  textoCota,
  unidadeDaCota,
} from './inspecao';

const PRETO = '#000000';
const CINZA = '#555555';
const VERDE = '#237804';
const VERMELHO = '#CF1322';

// Valor de um campo da cota no formato da unidade dela: mm e raio com virgula
// decimal, angulo em graus e minutos ("0°30'"). O simbolo ja vem no texto.
function val(cota: any, campo: string): string {
  return textoCota(cota?.[campo], unidadeDaCota(cota?.unidade));
}

function rotuloUnidade(cota: any): string {
  const unidade = unidadeDaCota(cota?.unidade);
  return UNIDADES_COTA.find((u) => u.value === unidade)?.label ?? unidade;
}

type Coluna = { titulo: string; peso: number; valor: (c: any) => string };

// Quantas colunas de peca a tabela precisa (0 = relatorio de lote, Max/Min).
function qtdPecas(cotas: any[]): number {
  return Math.max(
    0,
    ...cotas.map((c) => (Array.isArray(c.pecas) ? c.pecas.length : 0)),
  );
}

// "pecasForcado" existe por causa da peca de conjunto: sao varias tabelas no
// mesmo relatorio e todas precisam ter as MESMAS colunas, contadas no relatorio
// inteiro. Sem isso um desenho ainda vazio sairia com Max/Min no lugar das
// colunas de peca.
function colunas(cotas: any[], pecasForcado?: number): Coluna[] {
  const pecas = pecasForcado ?? qtdPecas(cotas);
  const encontrado: Coluna[] = pecas
    ? Array.from({ length: pecas }, (_, p) => ({
        titulo: `PEÇA ${String(p + 1).padStart(2, '0')}`,
        peso: 34,
        valor: (c: any) => textoCota(c.pecas?.[p], unidadeDaCota(c.unidade)),
      }))
    : [
        { titulo: 'ENC. Máx.', peso: 38, valor: (c) => val(c, 'encontradoMax') },
        { titulo: 'ENC. Mín.', peso: 38, valor: (c) => val(c, 'encontradoMin') },
      ];

  return [
    { titulo: 'LOCALIZAÇÃO', peso: 90, valor: (c) => String(c.localizacao ?? '') },
    { titulo: 'ESPECIF.', peso: 44, valor: (c) => val(c, 'especificado') },
    { titulo: 'UN.', peso: 30, valor: rotuloUnidade },
    // A norma e por cota: a mesma peca pode ter cota pela ISO 2768 e cota com
    // tolerancia de desenho.
    { titulo: 'NORMA', peso: 48, valor: (c) => normaCurta(c.norma) },
    {
      titulo: 'TOLER.',
      peso: 42,
      valor: (c) => (val(c, 'tolerancia') ? `±${val(c, 'tolerancia')}` : ''),
    },
    { titulo: 'UPPER', peso: 38, valor: (c) => val(c, 'upper') },
    { titulo: 'LOWER', peso: 38, valor: (c) => val(c, 'lower') },
    ...encontrado,
    { titulo: 'INSTRUMENTO', peso: 58, valor: (c) => String(c.instrumento ?? '') },
    { titulo: 'DESV. Mín.', peso: 42, valor: (c) => val(c, 'desvioMin') },
    { titulo: 'DESV. Máx.', peso: 42, valor: (c) => val(c, 'desvioMax') },
    {
      titulo: 'CONFORME',
      peso: 52,
      valor: (c) =>
        c.conforme === false ? 'Não' : c.conforme === true ? 'Sim' : '-',
    },
  ];
}

// Escreve o valor da celula numa linha so, encolhendo a fonte ate caber. O
// pdfkit quebra a linha mesmo com lineBreak:false quando o texto passa da
// largura, e a sobra caia por cima da linha de baixo da tabela (com 5 colunas
// de peca as celulas ficam bem estreitas).
function celula(
  doc: PDFKit.PDFDocument,
  texto: string,
  x: number,
  y: number,
  largura: number,
  tamanho: number,
) {
  let fs = tamanho;
  while (fs > 4 && doc.fontSize(fs).widthOfString(texto) > largura) {
    fs -= 0.25;
  }
  doc.fontSize(fs).text(texto, x, y, {
    width: largura,
    height: fs * 1.3,
    lineBreak: false,
    ellipsis: true,
  });
}

// Titulo do cabecalho: pode quebrar entre palavras ("DESV." / "Máx."), mas
// nunca no meio de uma palavra. O pdfkit parte "INSTRUMENTO" em "INSTRUMENT" +
// "O" quando a celula e estreita, entao a fonte encolhe ate a maior palavra
// caber inteira.
function tituloCabecalho(
  doc: PDFKit.PDFDocument,
  titulo: string,
  x: number,
  y: number,
  largura: number,
) {
  let fs = 5.5;
  const palavras = titulo.split(' ');
  while (
    fs > 3.5 &&
    palavras.some((p) => doc.fontSize(fs).widthOfString(p) > largura)
  ) {
    fs -= 0.25;
  }
  doc.fontSize(fs).text(titulo, x, y, {
    width: largura,
    height: ALTURA_CABECALHO - 7,
    ellipsis: true,
  });
}

const ALTURA_CABECALHO = 22; // duas linhas: "PEÇA" / "01", "DESV." / "Máx."
const ALTURA_LINHA = 16;

export function desenharTabelaCotas(
  doc: PDFKit.PDFDocument,
  cotasBrutas: unknown,
  opts: {
    x0: number;
    largura: number;
    y: number;
    margem: number;
    rodape: number;
    // Numero de colunas de peca imposto de fora (peca de conjunto).
    pecas?: number;
  },
): number {
  const cotas: any[] = Array.isArray(cotasBrutas) ? cotasBrutas : [];
  const { x0, largura, margem, rodape } = opts;
  let y = opts.y;

  const cols = colunas(cotas, opts.pecas);
  // Os pesos viram larguras reais: assim a tabela fecha na borda direita com
  // qualquer numero de colunas de peca.
  const total = cols.reduce((t, c) => t + c.peso, 0);
  const larguras = cols.map((c) => (c.peso / total) * largura);

  const cabecalho = () => {
    if (y + ALTURA_CABECALHO + ALTURA_LINHA > doc.page.height - rodape) {
      doc.addPage();
      y = margem;
    }
    doc.rect(x0, y, largura, ALTURA_CABECALHO).fill('#F0F0F0');
    let x = x0;
    cols.forEach((c, i) => {
      doc
        .lineWidth(0.5)
        .strokeColor('#999999')
        .rect(x, y, larguras[i], ALTURA_CABECALHO)
        .stroke();
      // Aqui a quebra em duas linhas e desejada: o titulo fica inteiro dentro
      // da celula em vez de sair cortado no meio da palavra.
      doc.font('Helvetica-Bold').fillColor(PRETO);
      tituloCabecalho(doc, c.titulo, x + 2, y + 5, larguras[i] - 4);
      x += larguras[i];
    });
    y += ALTURA_CABECALHO;
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
    if (y + ALTURA_LINHA > doc.page.height - rodape) {
      doc.addPage();
      y = margem;
      cabecalho();
    }
    let x = x0;
    cols.forEach((c, i) => {
      doc
        .lineWidth(0.5)
        .strokeColor('#CCCCCC')
        .rect(x, y, larguras[i], ALTURA_LINHA)
        .stroke();
      const conformeCol = c.titulo === 'CONFORME';
      doc
        .font(conformeCol ? 'Helvetica-Bold' : 'Helvetica')
        .fillColor(
          conformeCol
            ? cota.conforme === false
              ? VERMELHO
              : VERDE
            : PRETO,
        );
      celula(doc, c.valor(cota), x + 2, y + 5, larguras[i] - 4, 6.5);
      x += larguras[i];
    });
    y += ALTURA_LINHA;
  }

  return y;
}

const ALTURA_TARJA = 14;

// Peca de conjunto: uma tabela por desenho, cada uma com a sua tarja de titulo.
// Relatorio de um desenho so cai direto no desenharTabelaCotas, sem tarja, para
// o PDF sair exatamente como sempre saiu.
export function desenharCotasPorDesenho(
  doc: PDFKit.PDFDocument,
  dados: {
    cotas: unknown;
    desenhos?: unknown;
    desenho?: string | null;
    revisao?: string | null;
    // Campo unico dos registros antigos (desenho e revisao juntos).
    legado?: string | null;
  },
  opts: {
    x0: number;
    largura: number;
    y: number;
    margem: number;
    rodape: number;
  },
): number {
  const grupos = gruposDeDesenho(dados.cotas, dados.desenhos, {
    desenho: dados.desenho,
    revisao: dados.revisao,
    legado: dados.legado,
  });
  if (grupos.length === 1) return desenharTabelaCotas(doc, dados.cotas, opts);

  // Contado no relatorio inteiro para as tabelas ficarem todas iguais.
  const pecas = qtdPecas(Array.isArray(dados.cotas) ? dados.cotas : []);
  const { x0, largura, margem, rodape } = opts;
  let y = opts.y;

  grupos.forEach((g, i) => {
    if (i) y += 10;
    if (y + ALTURA_TARJA + ALTURA_CABECALHO > doc.page.height - rodape) {
      doc.addPage();
      y = margem;
    }
    doc.rect(x0, y, largura, ALTURA_TARJA).fill('#E8E8E8');
    doc
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .fillColor(PRETO)
      .text(
        `DESENHO ${g.indice + 1} DE ${grupos.length} — Nº ${g.desenho}   Rev. ${g.revisao}`,
        x0 + 4,
        y + 4,
        { width: largura - 8, lineBreak: false, ellipsis: true },
      );
    y += ALTURA_TARJA;
    y = desenharTabelaCotas(doc, g.cotas, {
      x0,
      largura,
      y,
      margem,
      rodape,
      pecas,
    });
  });

  return y;
}
