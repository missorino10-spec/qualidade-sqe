import PDFDocument from 'pdfkit';
import { join } from 'path';
import { existsSync } from 'fs';
import { nomeCurto } from '../../comum/nome';
import { rotuloClassificacaoIcaq, rotuloTurnoIcaq } from './icaq-utils';

// ICAQ — espelha o "Checklist ICAQ": cabecalho de identificacao, as dez
// verificacoes ponderadas com resultado, pontos, evidencia e responsavel, a
// nota final com a classificacao e, no fim, a regra de ponderacao do proprio
// formulario.

const LARANJA = '#E8792B';
const PRETO = '#000000';
const CINZA = '#555555';
const CINZA_CLARO = '#BBBBBB';
const FUNDO = '#F2F2F2';
const LOGO_PATH = join(process.cwd(), 'assets', 'logo-big-dutchman.png');

const M = 34;
const X0 = M;
const X1 = 561;
const W = X1 - X0;
const RODAPE = 46;

// Datas do formulario sao datas puras (sem hora), gravadas como meia-noite UTC:
// formatar no fuso do servidor faria 28/07 virar 27/07 a oeste de Greenwich.
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

function fmtNumero(v: number, casas: number): string {
  return Number(v ?? 0).toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

// Fotos de evidencia da auditoria inteira, em um bloco unico no fim.
export type FotosIcaq = Buffer[];

export function gerarPdfControleAutonomo(
  reg: any,
  fotos: FotosIcaq = [],
): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: 'A4', margin: M, bufferPages: true });
  let y = 0;

  const fim = () => doc.page.height - RODAPE;

  const quebrar = () => {
    doc.addPage();
    y = M;
  };

  const espaco = (altura: number) => {
    if (y + altura > fim()) quebrar();
  };

  const alturaTexto = (
    valor: string,
    largura: number,
    tamanho: number,
    fonte = 'Helvetica',
  ) => {
    if (!valor) return 0;
    doc.font(fonte).fontSize(tamanho);
    return doc.heightOfString(valor, { width: largura });
  };

  const faixa = (titulo: string) => {
    espaco(34);
    doc.rect(X0, y, W, 17).fill(LARANJA);
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor('#FFFFFF')
      .text(titulo, X0 + 6, y + 4.5, { width: W - 12, lineBreak: false });
    y += 17;
  };

  const linha = (
    campos: { w: number; label: string; valor: string }[],
    minima = 26,
  ) => {
    const altura = Math.max(
      minima,
      ...campos.map((c) => 15 + alturaTexto(c.valor, c.w - 8, 8) + 4),
    );
    espaco(altura);
    let x = X0;
    for (const c of campos) {
      doc.lineWidth(0.7).strokeColor(PRETO).rect(x, y, c.w, altura).stroke();
      doc
        .font('Helvetica-Bold')
        .fontSize(6)
        .fillColor(CINZA)
        .text(c.label, x + 4, y + 3, { width: c.w - 8, lineBreak: false });
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(PRETO)
        .text(c.valor, x + 4, y + 12, { width: c.w - 8 });
      x += c.w;
    }
    y += altura;
  };

  const bloco = (titulo: string, valor: string, minima = 30) => {
    const texto = valor || '-';
    const altura = Math.max(minima, alturaTexto(texto, W - 12, 8.5) + 10);
    espaco(altura + 14);
    doc.rect(X0, y, W, 13).fill(FUNDO);
    doc.lineWidth(0.7).strokeColor(PRETO).rect(X0, y, W, 13).stroke();
    doc
      .font('Helvetica-Bold')
      .fontSize(7)
      .fillColor(PRETO)
      .text(titulo, X0 + 5, y + 3.5, { width: W - 10, lineBreak: false });
    doc.lineWidth(0.7).strokeColor(PRETO).rect(X0, y + 13, W, altura).stroke();
    doc
      .font('Helvetica')
      .fontSize(8.5)
      .fillColor(PRETO)
      .text(texto, X0 + 6, y + 18, { width: W - 12 });
    y += 13 + altura;
  };

  const quadroFotos = (titulo: string, imagens: Buffer[] = []) => {
    const validas = imagens.slice(0, 4);
    if (!validas.length) return;

    const colunas = validas.length === 1 ? 1 : 2;
    const linhas = Math.ceil(validas.length / colunas);
    const celulaH = validas.length === 1 ? 190 : 130;
    const altura = linhas * celulaH + (linhas + 1) * 6;
    espaco(altura + 15);

    doc.rect(X0, y, W, 13).fill(FUNDO);
    doc.lineWidth(0.7).strokeColor(PRETO).rect(X0, y, W, 13).stroke();
    doc
      .font('Helvetica-Bold')
      .fontSize(7)
      .fillColor(PRETO)
      .text(titulo, X0 + 5, y + 3.5, { width: W - 10, lineBreak: false });
    y += 13;

    doc.lineWidth(0.7).strokeColor(PRETO).rect(X0, y, W, altura).stroke();
    const celulaW = (W - (colunas + 1) * 6) / colunas;
    validas.forEach((foto, i) => {
      const col = i % colunas;
      const lin = Math.floor(i / colunas);
      try {
        doc.image(
          foto,
          X0 + 6 + col * (celulaW + 6),
          y + 6 + lin * (celulaH + 6),
          { fit: [celulaW, celulaH], align: 'center', valign: 'center' },
        );
      } catch {
        /* imagem invalida (formato nao suportado): ignora */
      }
    });
    y += altura;
  };

  type Coluna = { titulo: string; w: number; campo: string };
  const tabela = (colunas: Coluna[], linhas: any[], vazioTexto: string) => {
    const cabecalho = () => {
      const altura = Math.max(
        14,
        ...colunas.map(
          (c) => alturaTexto(c.titulo, c.w - 6, 6.5, 'Helvetica-Bold') + 6,
        ),
      );
      espaco(altura + 16);
      doc.rect(X0, y, W, altura).fill(FUNDO);
      let x = X0;
      for (const c of colunas) {
        doc.lineWidth(0.6).strokeColor(PRETO).rect(x, y, c.w, altura).stroke();
        doc
          .font('Helvetica-Bold')
          .fontSize(6.5)
          .fillColor(PRETO)
          .text(c.titulo, x + 3, y + 3, { width: c.w - 6 });
        x += c.w;
      }
      y += altura;
    };

    cabecalho();
    if (!linhas.length) {
      espaco(18);
      doc
        .font('Helvetica-Oblique')
        .fontSize(8)
        .fillColor(CINZA)
        .text(vazioTexto, X0 + 5, y + 4, { width: W - 10 });
      y += 17;
      return;
    }
    for (const l of linhas) {
      const altura = Math.max(
        15,
        ...colunas.map((c) => alturaTexto(txt(l[c.campo]), c.w - 6, 7) + 7),
      );
      if (y + altura > fim()) {
        quebrar();
        cabecalho();
      }
      let x = X0;
      for (const c of colunas) {
        doc
          .lineWidth(0.5)
          .strokeColor(CINZA_CLARO)
          .rect(x, y, c.w, altura)
          .stroke();
        doc
          .font('Helvetica')
          .fontSize(7)
          .fillColor(PRETO)
          .text(txt(l[c.campo]), x + 3, y + 3.5, { width: c.w - 6 });
        x += c.w;
      }
      y += altura;
    }
  };

  // Linha de regra do rodape do formulario: rotulo a esquerda, texto a direita.
  const regra = (rotulo: string, texto: string) => {
    const rotuloW = 120;
    const altura = Math.max(15, alturaTexto(texto, W - rotuloW - 10, 7) + 7);
    espaco(altura);
    doc.lineWidth(0.5).strokeColor(CINZA_CLARO).rect(X0, y, rotuloW, altura).stroke();
    doc
      .lineWidth(0.5)
      .strokeColor(CINZA_CLARO)
      .rect(X0 + rotuloW, y, W - rotuloW, altura)
      .stroke();
    doc
      .font('Helvetica-Bold')
      .fontSize(7)
      .fillColor(PRETO)
      .text(rotulo, X0 + 4, y + 3.5, { width: rotuloW - 8 });
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(PRETO)
      .text(texto, X0 + rotuloW + 4, y + 3.5, { width: W - rotuloW - 8 });
    y += altura;
  };

  // ---------------------------------------------------------- cabecalho
  if (existsSync(LOGO_PATH)) {
    doc.image(LOGO_PATH, X0, 30, { width: 112 });
  } else {
    doc
      .font('Helvetica-Bold')
      .fontSize(15)
      .fillColor(LARANJA)
      .text('Big Dutchman', X0, 36);
  }

  const cbX = 406;
  const cbW = X1 - cbX;
  const cbLinhas = [
    { rotulo: 'Formulário', valor: 'Checklist ICAQ' },
    { rotulo: 'Registro Nº', valor: txt(reg.numero) || '-' },
    { rotulo: 'Emissão', valor: hojeNoBrasil() },
  ];
  const cbH = cbLinhas.length * 17;
  doc.lineWidth(0.7).strokeColor(PRETO).rect(cbX, 30, cbW, cbH).stroke();
  cbLinhas.forEach((l, i) => {
    const cbY = 30 + i * 17;
    if (i > 0) doc.lineWidth(0.5).moveTo(cbX, cbY).lineTo(X1, cbY).stroke();
    doc
      .font('Helvetica-Bold')
      .fontSize(5.5)
      .fillColor(CINZA)
      .text(`${l.rotulo}:`, cbX + 3, cbY + 2, {
        width: cbW - 6,
        lineBreak: false,
      });
    doc
      .font('Helvetica')
      .fontSize(6.5)
      .fillColor(PRETO)
      .text(l.valor, cbX + 3, cbY + 8, {
        width: cbW - 6,
        lineBreak: false,
        ellipsis: true,
      });
  });

  const tituloX = 156;
  const tituloW = cbX - 10 - tituloX;
  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor(PRETO)
    .text('ICAQ — Controle Autônomo da Qualidade', tituloX, 34, {
      width: tituloW,
      align: 'center',
    });
  doc
    .font('Helvetica-Oblique')
    .fontSize(7.5)
    .fillColor(CINZA)
    .text(
      'Checklist ponderado por dimensão auditada para certificação da medição, do registro e da reação aos desvios',
      tituloX,
      doc.y + 2,
      { width: tituloW, align: 'center' },
    );

  y = 30 + cbH + 6;

  // ------------------------------------------------------ identificacao
  faixa('IDENTIFICAÇÃO');
  linha([
    { w: 90, label: 'DATA DA AUDITORIA', valor: fmtData(reg.dataAuditoria) },
    { w: 80, label: 'TURNO', valor: rotuloTurnoIcaq(reg.turno) },
    {
      w: W - 90 - 80 - 110 - 110,
      label: 'PRODUTO',
      valor: txt(reg.item?.descricao),
    },
    { w: 110, label: 'CÓDIGO', valor: txt(reg.item?.codigo) },
    { w: 110, label: 'ORDEM / LOTE', valor: txt(reg.ordemLote) },
  ]);
  linha([
    {
      w: 180,
      label: 'EQUIPAMENTO',
      valor: reg.maquina ? `${reg.maquina.codigo} — ${reg.maquina.nome}` : '',
    },
    { w: 150, label: 'OPERADOR AUDITADO', valor: txt(reg.operador) },
    {
      w: 150,
      label: 'AUDITOR DA QUALIDADE',
      valor: reg.auditor ? nomeCurto(reg.auditor.nome) : '',
    },
    { w: W - 180 - 150 - 150, label: 'REVISÃO', valor: '1.0' },
  ]);
  bloco('Observações iniciais', txt(reg.observacoesIniciais), 30);

  // ---------------------------------------------------------- checklist
  y += 5;
  faixa('CHECKLIST PONDERADO');

  const itens = (reg.itens ?? []).map((i: any) => ({
    ...i,
    _n: String(i.numero),
    _peso: `${fmtNumero((i.peso ?? 0) * 100, 0)}%`,
    _resultado: i.resultado === 'CONFORME' ? 'Conforme' : 'Não conforme',
    _pontos: fmtNumero(i.pontos ?? 0, 3),
  }));

  tabela(
    [
      { titulo: 'Nº', w: 16, campo: '_n' },
      { titulo: 'Dimensão auditada', w: 88, campo: 'dimensao' },
      { titulo: 'Peso', w: 26, campo: '_peso' },
      { titulo: 'Verificação', w: 138, campo: 'verificacao' },
      { titulo: 'Resultado', w: 52, campo: '_resultado' },
      { titulo: 'Pontos', w: 30, campo: '_pontos' },
      {
        titulo: 'Evidência / comentário',
        w: W - 16 - 88 - 26 - 138 - 52 - 30 - 72,
        campo: 'evidencia',
      },
      { titulo: 'Responsável pela tratativa', w: 72, campo: 'responsavel' },
    ],
    itens,
    'Checklist não preenchido.',
  );

  // ------------------------------------------------------------ resultado
  y += 5;
  faixa('RESULTADO DA AUDITORIA');
  linha(
    [
      { w: 120, label: 'NOTA FINAL', valor: `${fmtNumero(reg.nota, 2)}%` },
      {
        w: 150,
        label: 'CLASSIFICAÇÃO',
        valor: rotuloClassificacaoIcaq(reg.classificacao),
      },
      {
        w: W - 270,
        label: 'AUDITOR DA QUALIDADE',
        valor: reg.auditor
          ? `${nomeCurto(reg.auditor.nome)} — ${fmtData(reg.dataAuditoria)}`
          : '',
      },
    ],
    40,
  );

  // ------------------------------------------------------------ evidencias
  if (fotos.length) {
    y += 5;
    faixa('EVIDÊNCIAS FOTOGRÁFICAS');
    quadroFotos('Fotos da auditoria', fotos);
  }

  // ------------------------------------------- criterio e ponderacao
  y += 5;
  faixa('CRITÉRIO DE AVALIAÇÃO E REGRA DE PONDERAÇÃO');
  regra('Conforme', 'O requisito foi atendido de acordo com o padrão definido.');
  regra(
    'Não conforme',
    'O requisito não foi atendido, foi executado incorretamente ou não há evidência confiável.',
  );
  regra(
    'Cálculo da nota',
    'Cada dimensão recebe sua nota proporcional ao peso: Execução 50% | Confiabilidade 25% | Preenchimento 15% | Reação 10%. Cada item divide igualmente o peso da sua dimensão.',
  );
  regra(
    'Classificação',
    '90% a 100%: Conforme | 80% a 89,99%: Atenção | Abaixo de 80%: Não conforme.',
  );

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
        `Big Dutchman Brasil — Sistema de Qualidade · Controle Autônomo ${txt(reg.numero)} · Página ${i + 1} de ${paginas.count}`,
        X0,
        doc.page.height - 34,
        { width: W, align: 'center' },
      );
  }

  return doc;
}
