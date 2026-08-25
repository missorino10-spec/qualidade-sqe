import PDFDocument from 'pdfkit';
import { join } from 'path';
import { existsSync } from 'fs';
import { nomeCurto } from '../comum/nome';

// Inventario de Instrumentos e Equipamentos — BDBR.QUA.FMR.004.01.
//
// Copia do papel: o cabecalho tem o titulo no meio e o quadro de identificacao
// do documento na direita (Codigo, Data Criacao, Revisao, Pagina), e o corpo e
// a tabela das nove colunas da planilha, na mesma ordem.
//
// A pagina e deitada porque a planilha tambem e: em retrato as colunas de
// equipamento e localizacao ficam ilegiveis.

const LARANJA = '#E8792B';
const PRETO = '#000000';
const CINZA = '#555555';
const VERMELHO = '#C0392B';
const FUNDO = '#F2F2F2';
const LOGO_PATH = join(process.cwd(), 'assets', 'logo-big-dutchman.png');

const M = 34;
const X0 = M;
const X1 = 808; // A4 deitada (841,89) menos a margem da direita
const W = X1 - X0;
const RODAPE = 42;

// Dados do formulario, iguais aos do arquivo original.
const DOC_CODIGO = 'BDBR.QUA.FMR.004.01';
const DOC_CRIACAO = '01/09/2024';
const DOC_REVISAO = '01';

// As datas de calibracao sao datas puras (meia-noite UTC): formatar no fuso do
// servidor faria 28/07 virar 27/07 a oeste de Greenwich.
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

// Dias que faltam para a proxima calibracao. Negativo = ja venceu.
export function diasParaVencer(proxima?: Date | string | null): number | null {
  if (!proxima) return null;
  const hoje = new Date();
  const alvo = new Date(proxima);
  return Math.floor(
    (Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth(), alvo.getUTCDate()) -
      Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())) /
      86400000,
  );
}

type Coluna = {
  titulo: string;
  peso: number;
  valor: (i: any) => string;
  centro?: boolean;
};

const COLUNAS: Coluna[] = [
  { titulo: 'CÓDIGO', peso: 52, valor: (i) => txt(i.codigo) || '-' },
  { titulo: 'EQUIPAMENTO', peso: 168, valor: (i) => txt(i.equipamento) },
  { titulo: 'FABRICANTE', peso: 72, valor: (i) => txt(i.fabricante) },
  { titulo: 'Nº SÉRIE', peso: 72, valor: (i) => txt(i.numeroSerie) },
  {
    titulo: 'DATA DE CALIBRAÇÃO',
    peso: 60,
    valor: (i) => fmtData(i.dataCalibracao),
    centro: true,
  },
  {
    titulo: 'PRÓXIMA CALIBRAÇÃO',
    peso: 60,
    valor: (i) => fmtData(i.proximaCalibracao),
    centro: true,
  },
  { titulo: 'N CERTIFICADO', peso: 62, valor: (i) => txt(i.numeroCertificado) },
  {
    titulo: 'PERÍODO (ANOS)',
    peso: 42,
    valor: (i) => (i.periodoAnos == null ? '' : String(i.periodoAnos)),
    centro: true,
  },
  { titulo: 'LOCALIZAÇÃO', peso: 90, valor: (i) => txt(i.localizacao) },
];

export function gerarInventarioPdf(
  instrumentos: any[],
  // O inventario e uma foto do cadastro num instante: quem responde pelo papel
  // afixado na metrologia e quem o emitiu.
  emitidoPor?: string,
): PDFKit.PDFDocument {
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: M,
    bufferPages: true,
  });
  let y = 0;

  // ---------------------------------------------------------------- cabecalho
  const alturaCab = 56;
  const larguraQuadro = 210;
  doc.lineWidth(0.8).strokeColor(PRETO).rect(X0, 30, W, alturaCab).stroke();

  if (existsSync(LOGO_PATH)) {
    doc.image(LOGO_PATH, X0 + 8, 44, { width: 110 });
  } else {
    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .fillColor(LARANJA)
      .text('Big Dutchman', X0 + 8, 50);
  }

  doc
    .font('Helvetica-Bold')
    .fontSize(13)
    .fillColor(PRETO)
    .text('Inventário de Instrumentos e Equipamentos', X0 + 140, 50, {
      width: W - 140 - larguraQuadro,
      align: 'center',
    });

  // Quadro de identificacao do documento, na direita (como no formulario).
  const xq = X1 - larguraQuadro;
  const linhasDoc: [string, string][] = [
    ['Código', DOC_CODIGO],
    ['Data Criação', DOC_CRIACAO],
    ['Revisão', DOC_REVISAO],
    ['Página', '01 de 01'],
  ];
  const alturaLinha = alturaCab / linhasDoc.length;
  linhasDoc.forEach(([rotulo, valor], i) => {
    const yy = 30 + i * alturaLinha;
    doc
      .lineWidth(0.5)
      .strokeColor('#999999')
      .rect(xq, yy, 80, alturaLinha)
      .stroke();
    doc
      .lineWidth(0.5)
      .strokeColor('#999999')
      .rect(xq + 80, yy, larguraQuadro - 80, alturaLinha)
      .stroke();
    doc
      .font('Helvetica-Bold')
      .fontSize(6.5)
      .fillColor(CINZA)
      .text(rotulo, xq + 4, yy + alturaLinha / 2 - 3, {
        width: 72,
        lineBreak: false,
      });
    doc
      .font('Helvetica')
      .fontSize(6.5)
      .fillColor(PRETO)
      .text(valor, xq + 84, yy + alturaLinha / 2 - 3, {
        width: larguraQuadro - 88,
        lineBreak: false,
      });
  });
  y = 30 + alturaCab + 8;

  // Recorte que esta sendo impresso e a contagem de vencimentos: e a leitura
  // que o responsavel pela metrologia faz antes de qualquer outra coisa.
  const vencidos = instrumentos.filter((i) => {
    const d = diasParaVencer(i.proximaCalibracao);
    return d != null && d < 0;
  }).length;
  const aVencer = instrumentos.filter((i) => {
    const d = diasParaVencer(i.proximaCalibracao);
    return d != null && d >= 0 && d <= 30;
  }).length;

  doc.rect(X0, y, W, 18).fill(FUNDO);
  doc.lineWidth(0.8).strokeColor(PRETO).rect(X0, y, W, 18).stroke();
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(PRETO)
    .text(
      `Instrumentos: ${instrumentos.length}     |     Calibração vencida: ${vencidos}     |     Vence em até 30 dias: ${aVencer}     |     Emissão: ${hojeNoBrasil()}${emitidoPor ? `     |     Emitido por: ${nomeCurto(emitidoPor)}` : ''}`,
      X0 + 6,
      y + 5,
      { width: W - 12, lineBreak: false },
    );
  y += 26;

  // ---------------------------------------------------------------- tabela
  const pesoTotal = COLUNAS.reduce((t, c) => t + c.peso, 0);
  const larguras = COLUNAS.map((c) => (c.peso / pesoTotal) * W);

  const cabecalhoTabela = () => {
    doc.rect(X0, y, W, 20).fill('#F0F0F0');
    let x = X0;
    COLUNAS.forEach((c, i) => {
      doc
        .lineWidth(0.5)
        .strokeColor('#999999')
        .rect(x, y, larguras[i], 20)
        .stroke();
      doc
        .font('Helvetica-Bold')
        .fontSize(6)
        .fillColor(PRETO)
        .text(c.titulo, x + 3, y + 5, {
          width: larguras[i] - 6,
          align: 'center',
        });
      x += larguras[i];
    });
    y += 20;
  };
  cabecalhoTabela();

  if (!instrumentos.length) {
    doc.lineWidth(0.5).strokeColor('#CCCCCC').rect(X0, y, W, 18).stroke();
    doc
      .font('Helvetica-Oblique')
      .fontSize(8)
      .fillColor(CINZA)
      .text('Nenhum instrumento cadastrado.', X0 + 6, y + 5, { width: W - 12 });
    y += 18;
  }

  for (const inst of instrumentos) {
    const altura =
      Math.max(
        13,
        ...COLUNAS.map((col, i) => {
          const valor = col.valor(inst);
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

    // Instrumento com calibracao vencida sai com a data em vermelho: no papel
    // do chao de fabrica e isso que separa o que pode ser usado do que nao pode.
    const dias = diasParaVencer(inst.proximaCalibracao);
    const vencido = dias != null && dias < 0;

    let x = X0;
    COLUNAS.forEach((col, i) => {
      doc
        .lineWidth(0.5)
        .strokeColor('#CCCCCC')
        .rect(x, y, larguras[i], altura)
        .stroke();
      const ehProxima = col.titulo.startsWith('PRÓXIMA');
      doc
        .font(vencido && ehProxima ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(6.5)
        .fillColor(vencido && ehProxima ? VERMELHO : PRETO)
        .text(col.valor(inst), x + 3, y + 4, {
          width: larguras[i] - 6,
          height: altura - 6,
          align: col.centro ? 'center' : 'left',
        });
      x += larguras[i];
    });
    y += altura;
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
        `Big Dutchman Brasil — Sistema de Qualidade · ${DOC_CODIGO} · Página ${i + 1} de ${paginas.count}`,
        X0,
        doc.page.height - 30,
        { width: W, align: 'center' },
      );
  }

  return doc;
}
