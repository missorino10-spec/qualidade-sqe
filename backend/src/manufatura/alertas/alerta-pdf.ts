import PDFDocument from 'pdfkit';
import { join } from 'path';
import { existsSync } from 'fs';
import { situacaoAlerta } from '../../comum/alerta';

// ALERTA DA QUALIDADE — espelha o .docx da empresa ("Alerta da Qualidade -
// Rebarba (Puncionadeiras)"): tarja com o titulo e a data, "Descricao do
// problema", o texto da acao obrigatoria em destaque e dois paineis de foto
// lado a lado, ERRADO (vermelho) e CERTO (verde), com "Elaborado por" e
// "Pagina 01 de 01" no rodape. E um cartaz de chao de fabrica: uma folha so,
// letra grande e as fotos ocupando o maximo possivel.

const LARANJA = '#E8792B';
const VERMELHO = '#C00000';
const VERDE = '#2E7D32';
const PRETO = '#000000';
const CINZA = '#555555';
const BRANCO = '#FFFFFF';
const LOGO_PATH = join(process.cwd(), 'assets', 'logo-big-dutchman.png');

const M = 34;
const X0 = M;
const X1 = 595.28 - M; // A4 em pe
const W = X1 - X0;
const RODAPE = 46;

// Datas puras (sem hora) sao gravadas como meia-noite UTC: formatar no fuso
// do servidor faria 07/08 virar 06/08 a oeste de Greenwich.
function fmtData(d?: Date | string | null): string {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

function txt(v: any): string {
  return v == null || v === '' ? '' : String(v);
}

export type FotosAlerta = { errado: Buffer[]; certo: Buffer[] };

export function gerarPdfAlerta(
  alerta: any,
  fotos: FotosAlerta,
): PDFKit.PDFDocument {
  // O alerta e um cartaz de uma folha so. A margem inferior fica em zero de
  // proposito: com ela o pdfkit joga o rodape e as legendas dos paineis para
  // uma segunda pagina, porque acha que o texto nao "cabe" na area util.
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: M, left: M, right: M, bottom: 0 },
  });
  let y = 28;

  // ---------------------------------------------------------------- cabecalho
  if (existsSync(LOGO_PATH)) {
    doc.image(LOGO_PATH, X0, y, { width: 110 });
  } else {
    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .fillColor(LARANJA)
      .text('Big Dutchman', X0, y + 4);
  }
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(CINZA)
    .text(txt(alerta.numero), X1 - 170, y + 2, { width: 170, align: 'right' });
  y += 30;

  // ------------------------------------------------------------ tarja do titulo
  const ALTURA_TARJA = 46;
  doc.rect(X0, y, W, ALTURA_TARJA).fill(LARANJA);

  // Icone de alerta: triangulo com "!", como no documento original.
  const cx = X0 + 30;
  const cy = y + ALTURA_TARJA / 2;
  doc
    .moveTo(cx, cy - 15)
    .lineTo(cx + 17, cy + 14)
    .lineTo(cx - 17, cy + 14)
    .closePath()
    .fillColor(BRANCO)
    .fill();
  doc
    .font('Helvetica-Bold')
    .fontSize(16)
    .fillColor(LARANJA)
    .text('!', cx - 8, cy - 5, { width: 16, align: 'center' });

  doc
    .font('Helvetica-Bold')
    .fontSize(22)
    .fillColor(BRANCO)
    .text('ALERTA DA QUALIDADE', X0 + 60, y + 12, {
      width: W - 60 - 110,
      align: 'center',
    });
  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor(BRANCO)
    .text(fmtData(alerta.data), X1 - 110, y + 17, {
      width: 100,
      align: 'right',
    });
  y += ALTURA_TARJA + 8;

  // ------------------------------------------------- descricao do problema
  const LARGURA_ROTULO = 128;
  const tituloAlerta = txt(alerta.titulo).toUpperCase();
  const alturaTitulo = Math.max(
    34,
    doc.font('Helvetica-Bold').fontSize(17).heightOfString(tituloAlerta, {
      width: W - LARGURA_ROTULO - 16,
    }) + 14,
  );
  doc.lineWidth(1).strokeColor(PRETO).rect(X0, y, W, alturaTitulo).stroke();
  doc.rect(X0, y, LARGURA_ROTULO, alturaTitulo).fill('#F2F2F2');
  doc.lineWidth(1).strokeColor(PRETO).rect(X0, y, W, alturaTitulo).stroke();
  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor(PRETO)
    .text('Descrição do\nproblema:', X0 + 8, y + alturaTitulo / 2 - 12, {
      width: LARGURA_ROTULO - 16,
    });
  doc
    .font('Helvetica-Bold')
    .fontSize(17)
    .fillColor(VERMELHO)
    .text(tituloAlerta, X0 + LARGURA_ROTULO + 8, y + 9, {
      width: W - LARGURA_ROTULO - 16,
    });
  y += alturaTitulo + 8;

  // ------------------------------------------ onde se aplica / prazo / situacao
  const situacao = situacaoAlerta(alerta);
  const escopo =
    [txt(alerta.setor), alerta.maquina ? `${alerta.maquina.codigo} — ${alerta.maquina.nome}` : '']
      .filter(Boolean)
      .join('  |  ') || '-';
  doc.rect(X0, y, W, 18).fill('#F7F7F7');
  doc.lineWidth(0.8).strokeColor('#BBBBBB').rect(X0, y, W, 18).stroke();
  doc
    .font('Helvetica')
    .fontSize(8.5)
    .fillColor(PRETO)
    .text(`Onde se aplica: ${escopo}`, X0 + 8, y + 5, { width: W * 0.5 - 12 });
  doc
    .font('Helvetica-Bold')
    .fontSize(8.5)
    .fillColor(PRETO)
    .text(
      `Prazo para corrigir: ${fmtData(alerta.prazo)}     Situação: ${situacao.texto.toUpperCase()}`,
      X0 + W * 0.5,
      y + 5,
      { width: W * 0.5 - 8, align: 'right' },
    );
  y += 18 + 8;

  // ------------------------------------------------ texto da acao obrigatoria
  const acao = txt(alerta.acao);
  const alturaAcao =
    doc.font('Helvetica-Bold').fontSize(13).heightOfString(acao, {
      width: W - 20,
      align: 'center',
    }) + 18;
  doc.lineWidth(1.2).strokeColor(VERMELHO).rect(X0, y, W, alturaAcao).stroke();
  doc
    .font('Helvetica-Bold')
    .fontSize(13)
    .fillColor(PRETO)
    .text(acao, X0 + 10, y + 9, { width: W - 20, align: 'center' });
  y += alturaAcao + 10;

  // ------------------------------------------------- paineis ERRADO / CERTO
  // Os dois paineis dividem o que sobrou da folha: o alerta e um cartaz, as
  // fotos precisam ficar o maior possivel.
  const GAP = 10;
  const larguraPainel = (W - GAP) / 2;
  const alturaPaineis = doc.page.height - RODAPE - y;

  painel(X0, 'ERRADO', VERMELHO, fotos.errado, txt(alerta.legendaErrado));
  painel(
    X0 + larguraPainel + GAP,
    'CERTO',
    VERDE,
    fotos.certo,
    txt(alerta.legendaCerto),
  );

  function painel(
    x: number,
    rotulo: string,
    cor: string,
    imagens: Buffer[],
    legenda: string,
  ) {
    const ALTURA_ROTULO = 22;
    doc.rect(x, y, larguraPainel, ALTURA_ROTULO).fill(cor);
    doc
      .font('Helvetica-Bold')
      .fontSize(13)
      .fillColor(BRANCO)
      .text(rotulo, x, y + 5, { width: larguraPainel, align: 'center' });

    let alturaLegenda = 0;
    if (legenda) {
      alturaLegenda =
        doc.font('Helvetica').fontSize(9).heightOfString(legenda, {
          width: larguraPainel - 12,
          align: 'center',
        }) + 8;
    }

    const topoFotos = y + ALTURA_ROTULO;
    const alturaFotos = alturaPaineis - ALTURA_ROTULO - alturaLegenda;
    doc
      .lineWidth(1)
      .strokeColor(cor)
      .rect(x, topoFotos, larguraPainel, alturaFotos)
      .stroke();

    if (!imagens.length) {
      doc
        .font('Helvetica-Oblique')
        .fontSize(9)
        .fillColor(CINZA)
        .text('Sem foto registrada.', x + 6, topoFotos + alturaFotos / 2 - 6, {
          width: larguraPainel - 12,
          align: 'center',
        });
    } else {
      const alturaCada = (alturaFotos - 8) / imagens.length;
      imagens.forEach((foto, i) => {
        const topo = topoFotos + 4 + i * alturaCada;
        try {
          doc.image(foto, x + 4, topo + 2, {
            fit: [larguraPainel - 8, alturaCada - 6],
            align: 'center',
            valign: 'center',
          });
        } catch {
          // Foto corrompida ou em formato que o pdfkit nao le: o quadro fica
          // vazio, mas o alerta continua saindo.
        }
      });
    }

    if (legenda) {
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(PRETO)
        .text(legenda, x + 6, topoFotos + alturaFotos + 4, {
          width: larguraPainel - 12,
          align: 'center',
        });
    }
  }

  // ------------------------------------------------------------------ rodape
  const yRodape = doc.page.height - RODAPE + 6;
  doc
    .lineWidth(0.8)
    .strokeColor('#999999')
    .moveTo(X0, yRodape)
    .lineTo(X1, yRodape)
    .stroke();
  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor(PRETO)
    .text(
      `Elaborado por: ${txt(alerta.elaboradoPor) || txt(alerta.criadoPor?.nome) || '-'}`,
      X0,
      yRodape + 7,
      { width: W * 0.6 },
    );
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(PRETO)
    .text('Página: 01 de 01', X0 + W * 0.6, yRodape + 7, {
      width: W * 0.4,
      align: 'right',
    });

  return doc;
}
