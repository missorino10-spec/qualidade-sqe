import PDFDocument from 'pdfkit';
import { join } from 'path';
import { existsSync } from 'fs';
import { semanaAno } from '../../sqe/sqe-utils';
import { nomeCurto } from '../../comum/nome';

// Relatorio do Custo da Nao Qualidade — espelha a aba "Defeitos e CNQ" da
// planilha de indicadores: uma linha por apontamento (Data, Item, Maquina,
// Descricao do Defeito, Quantidade, CNQ, Observacoes, Acao) e, no fim, o
// resumo por defeito e por maquina que a planilha usa para o TOP de defeitos.
// A pagina e deitada porque a planilha tambem e larga.

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

// As datas do lancamento sao datas puras (sem hora), gravadas como meia-noite
// UTC: formatar no fuso do servidor faria 28/07 virar 27/07 a oeste de
// Greenwich.
function fmtData(d?: Date | string | null): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

// A semana sai do trecho ISO da data (a mesma logica de fmtData): passar a
// Date crua para semanaAno faria o lancamento de 28/07 cair na semana de 27/07
// em qualquer servidor a oeste de Greenwich.
function semanaDaData(d?: Date | string | null): string {
  if (!d) return '';
  const iso = (typeof d === 'string' ? d : d.toISOString()).slice(0, 10);
  const [ano, mes, dia] = iso.split('-').map(Number);
  return semanaAno(new Date(ano, mes - 1, dia)).semana;
}

function hojeNoBrasil(): string {
  return new Date().toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
  });
}

function txt(v: any): string {
  return v == null || v === '' ? '' : String(v);
}

function moeda(v: any): string {
  const n = Number(v ?? 0);
  return `R$ ${(Number.isFinite(n) ? n : 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function inteiro(v: any): string {
  const n = Number(v ?? 0);
  return (Number.isFinite(n) ? n : 0).toLocaleString('pt-BR');
}

// Total que nao bate com quantidade x valor unitario so pode ter sido digitado
// a mao no lancamento.
function totalManual(c: any): boolean {
  if (c?.valorTotal == null || c?.quantidade == null || c?.valorUnitario == null)
    return false;
  const calculado = Math.round(c.quantidade * c.valorUnitario * 100) / 100;
  return Math.round(c.valorTotal * 100) / 100 !== calculado;
}

type Coluna = {
  titulo: string;
  peso: number;
  valor: (c: any) => string;
  direita?: boolean;
  negrito?: boolean;
};

const COLUNAS: Coluna[] = [
  { titulo: 'NÚMERO', peso: 52, valor: (c) => txt(c.numero) },
  { titulo: 'DATA', peso: 44, valor: (c) => fmtData(c.data) },
  { titulo: 'SEMANA', peso: 34, valor: (c) => semanaDaData(c.data) },
  { titulo: 'MÁQUINA / LINHA', peso: 76, valor: (c) => txt(c.maquina?.nome) },
  {
    titulo: 'ITEM',
    peso: 110,
    valor: (c) =>
      [txt(c.itemCodigo), txt(c.itemDescricao)].filter(Boolean).join(' — '),
  },
  {
    titulo: 'DESCRIÇÃO DO DEFEITO',
    peso: 96,
    valor: (c) => txt(c.tipoDefeito?.nome),
  },
  { titulo: 'QTD.', peso: 32, valor: (c) => inteiro(c.quantidade), direita: true },
  {
    titulo: 'VALOR UNIT.',
    peso: 52,
    valor: (c) => moeda(c.valorUnitario),
    direita: true,
  },
  {
    titulo: 'CNQ (R$)',
    peso: 58,
    // O asterisco avisa que o total nao saiu de qtd x unitario, foi digitado.
    // Sem ele quem confere a planilha acha que a conta esta errada.
    valor: (c) => `${moeda(c.valorTotal)}${totalManual(c) ? ' *' : ''}`,
    direita: true,
    negrito: true,
  },
  { titulo: 'AÇÃO', peso: 96, valor: (c) => txt(c.acao) },
  { titulo: 'OBSERVAÇÕES', peso: 96, valor: (c) => txt(c.observacoes) },
];

// Resumo por chave (defeito ou maquina), do maior custo para o menor: e o que
// a planilha mostra no TOP de defeitos.
function resumo(
  lancamentos: any[],
  chave: (c: any) => string,
): { nome: string; qtd: number; total: number }[] {
  const mapa = new Map<string, { nome: string; qtd: number; total: number }>();
  for (const c of lancamentos) {
    const nome = chave(c) || '-';
    const atual = mapa.get(nome) ?? { nome, qtd: 0, total: 0 };
    atual.qtd += Number(c.quantidade ?? 0);
    atual.total += Number(c.valorTotal ?? 0);
    mapa.set(nome, atual);
  }
  return [...mapa.values()].sort((a, b) => b.total - a.total);
}

export function gerarPdfCnq(
  lancamentos: any[],
  filtro: { de?: string; ate?: string; maquina?: string } = {},
  // O CNQ e um relatorio de periodo, nao um documento de um lancamento so:
  // quem responde pelo papel e quem o emitiu.
  emitidoPor?: string,
): PDFKit.PDFDocument {
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: M,
    bufferPages: true,
  });
  let y = 0;

  const espaco = (altura: number) => {
    if (y + altura > doc.page.height - RODAPE) {
      doc.addPage();
      y = M;
    }
  };

  const faixa = (titulo: string) => {
    espaco(30);
    doc.rect(X0, y, W, 16).fill(LARANJA);
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor('#FFFFFF')
      .text(titulo, X0 + 6, y + 4, { width: W - 12, lineBreak: false });
    y += 16;
  };

  // ---------------------------------------------------------------- cabecalho
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
    .text('Custo da Não Qualidade (CNQ)', 170, 34, {
      width: X1 - 170 - 150,
      align: 'center',
    });
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(CINZA)
    .text(
      `Emissão: ${hojeNoBrasil()}${emitidoPor ? `\nEmitido por: ${nomeCurto(emitidoPor)}` : ''}`,
      X1 - 150,
      36,
      { width: 150, align: 'right' },
    );
  y = 62;

  // Periodo e maquina vem do filtro da tela: o papel tem que dizer exatamente
  // o recorte que esta sendo mostrado.
  const periodo =
    filtro.de || filtro.ate
      ? `${filtro.de ? fmtData(filtro.de) : '...'} a ${filtro.ate ? fmtData(filtro.ate) : '...'}`
      : 'Todo o período';
  doc.lineWidth(0.8).strokeColor(PRETO).rect(X0, y, W, 18).stroke();
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(PRETO)
    .text(
      `Período: ${periodo}     |     Máquina / linha: ${filtro.maquina ?? 'Todas'}     |     Lançamentos: ${lancamentos.length}`,
      X0 + 6,
      y + 5,
      { width: W - 12, lineBreak: false },
    );
  y += 24;

  // ---------------------------------------------------------------- totais
  const totalCnq = lancamentos.reduce(
    (t, c) => t + Number(c.valorTotal ?? 0),
    0,
  );
  const totalPecas = lancamentos.reduce(
    (t, c) => t + Number(c.quantidade ?? 0),
    0,
  );
  const totais: { rotulo: string; valor: string }[] = [
    { rotulo: 'CNQ TOTAL', valor: moeda(totalCnq) },
    { rotulo: 'PEÇAS LANÇADAS', valor: inteiro(totalPecas) },
    { rotulo: 'LANÇAMENTOS', valor: inteiro(lancamentos.length) },
  ];
  const larguraTotal = W / totais.length;
  totais.forEach((t, i) => {
    const x = X0 + i * larguraTotal;
    doc.rect(x, y, larguraTotal, 34).fill(FUNDO);
    doc.lineWidth(0.8).strokeColor(PRETO).rect(x, y, larguraTotal, 34).stroke();
    doc
      .font('Helvetica-Bold')
      .fontSize(6.5)
      .fillColor(CINZA)
      .text(t.rotulo, x + 6, y + 5, { width: larguraTotal - 12 });
    doc
      .font('Helvetica-Bold')
      .fontSize(13)
      .fillColor(i === 0 ? LARANJA : PRETO)
      .text(t.valor, x + 6, y + 15, { width: larguraTotal - 12 });
  });
  y += 42;

  // ---------------------------------------------------------------- tabela
  faixa('LANÇAMENTOS DO PERÍODO');

  const pesoTotal = COLUNAS.reduce((t, c) => t + c.peso, 0);
  const larguras = COLUNAS.map((c) => (c.peso / pesoTotal) * W);

  const cabecalhoTabela = () => {
    espaco(34);
    doc.rect(X0, y, W, 15).fill('#F0F0F0');
    let x = X0;
    COLUNAS.forEach((c, i) => {
      doc
        .lineWidth(0.5)
        .strokeColor('#999999')
        .rect(x, y, larguras[i], 15)
        .stroke();
      doc
        .font('Helvetica-Bold')
        .fontSize(6)
        .fillColor(PRETO)
        .text(c.titulo, x + 3, y + 5, {
          width: larguras[i] - 6,
          lineBreak: false,
          ellipsis: true,
          align: c.direita ? 'right' : 'left',
        });
      x += larguras[i];
    });
    y += 15;
  };
  cabecalhoTabela();

  if (!lancamentos.length) {
    doc.lineWidth(0.5).strokeColor('#CCCCCC').rect(X0, y, W, 18).stroke();
    doc
      .font('Helvetica-Oblique')
      .fontSize(8)
      .fillColor(CINZA)
      .text('Nenhum lançamento no período.', X0 + 6, y + 5, { width: W - 12 });
    y += 18;
  }

  for (const c of lancamentos) {
    // A linha cresce ate caber o maior texto: e o que evita o corte de item,
    // acao e observacoes.
    const altura =
      Math.max(
        14,
        ...COLUNAS.map((col, i) => {
          const valor = col.valor(c);
          if (!valor) return 0;
          doc.font('Helvetica').fontSize(6.5);
          return doc.heightOfString(valor, { width: larguras[i] - 6 });
        }),
      ) + 7;

    if (y + altura > doc.page.height - RODAPE) {
      doc.addPage();
      y = M;
      cabecalhoTabela();
    }

    let x = X0;
    COLUNAS.forEach((col, i) => {
      doc
        .lineWidth(0.5)
        .strokeColor('#CCCCCC')
        .rect(x, y, larguras[i], altura)
        .stroke();
      doc
        .font(col.negrito ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(6.5)
        .fillColor(PRETO)
        .text(col.valor(c), x + 3, y + 4, {
          width: larguras[i] - 6,
          height: altura - 6,
          align: col.direita ? 'right' : 'left',
        });
      x += larguras[i];
    });
    y += altura;
  }

  // Linha de total, fechando a tabela como na planilha.
  espaco(20);
  doc.rect(X0, y, W, 16).fill(FUNDO);
  doc.lineWidth(0.8).strokeColor(PRETO).rect(X0, y, W, 16).stroke();
  doc
    .font('Helvetica-Bold')
    .fontSize(8)
    .fillColor(PRETO)
    .text('TOTAL DO PERÍODO', X0 + 6, y + 5, { width: W / 2, lineBreak: false });
  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor(LARANJA)
    .text(`${inteiro(totalPecas)} peças  ·  ${moeda(totalCnq)}`, X1 - 260, y + 4, {
      width: 254,
      align: 'right',
      lineBreak: false,
    });
  y += 22;

  // ---------------------------------------------------------------- resumos
  const tabelaResumo = (
    titulo: string,
    linhas: { nome: string; qtd: number; total: number }[],
    x: number,
    largura: number,
  ) => {
    const yInicio = y;
    doc.rect(x, y, largura, 14).fill(FUNDO);
    doc.lineWidth(0.8).strokeColor(PRETO).rect(x, y, largura, 14).stroke();
    doc
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .fillColor(PRETO)
      .text(titulo, x + 5, y + 4, { width: largura - 10, lineBreak: false });
    let yy = y + 14;
    for (const l of linhas) {
      doc.lineWidth(0.4).strokeColor('#CCCCCC').rect(x, yy, largura, 13).stroke();
      doc
        .font('Helvetica')
        .fontSize(6.5)
        .fillColor(PRETO)
        .text(l.nome, x + 5, yy + 4, {
          width: largura - 150,
          lineBreak: false,
          ellipsis: true,
        });
      doc
        .font('Helvetica')
        .fontSize(6.5)
        .fillColor(CINZA)
        .text(`${inteiro(l.qtd)} pç`, x + largura - 145, yy + 4, {
          width: 50,
          align: 'right',
          lineBreak: false,
        });
      doc
        .font('Helvetica-Bold')
        .fontSize(6.5)
        .fillColor(PRETO)
        .text(moeda(l.total), x + largura - 90, yy + 4, {
          width: 85,
          align: 'right',
          lineBreak: false,
        });
      yy += 13;
    }
    return yy - yInicio;
  };

  if (lancamentos.length) {
    // Os dois resumos ficam lado a lado; a altura reservada e a do maior.
    const porDefeito = resumo(lancamentos, (c) => txt(c.tipoDefeito?.nome));
    const porMaquina = resumo(lancamentos, (c) => txt(c.maquina?.nome));
    const linhas = Math.max(porDefeito.length, porMaquina.length);
    y += 6;
    faixa('RESUMO DO PERÍODO');
    y += 4;
    espaco(14 + linhas * 13);
    const meia = (W - 12) / 2;
    const alturaA = tabelaResumo(
      'POR DESCRIÇÃO DO DEFEITO',
      porDefeito,
      X0,
      meia,
    );
    const alturaB = tabelaResumo(
      'POR MÁQUINA / LINHA',
      porMaquina,
      X0 + meia + 12,
      meia,
    );
    y += Math.max(alturaA, alturaB);
  }

  // ---------------------------------------------------------------- rodape
  const paginas = doc.bufferedPageRange();
  for (let i = 0; i < paginas.count; i++) {
    doc.switchToPage(paginas.start + i);
    doc.page.margins.bottom = 0;
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(CINZA)
      .text(
        `Big Dutchman Brasil — Sistema de Qualidade · Custo da Não Qualidade · Página ${i + 1} de ${paginas.count}`,
        X0,
        doc.page.height - 30,
        { width: W, align: 'center' },
      );
  }

  return doc;
}
