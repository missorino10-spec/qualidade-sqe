import PDFDocument from 'pdfkit';
import { join } from 'path';
import { existsSync } from 'fs';
import { CINCO_G, EVID_5G, NOTA_5G, checklist5G } from '../../comum/cincog';
import { labelSituacaoAcao } from '../../comum/oitod';
import { nomeCurto } from '../../comum/nome';

// MÉTODO 5G — espelha a aba "MÉTODO 5G" da planilha "Analise de Problemas da
// Qualidade - Padrao". O corpo do documento e o checklist das 9 avaliacoes.
// As onze colunas da planilha nao cabem na largura do A4 em pe: o quadro sai
// partido em dois (avaliacao e, embaixo, restauracao), com o mesmo numero de
// linha ligando os dois, exatamente como no 8D.

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

const LABEL_STATUS: Record<string, string> = {
  AGUARDANDO: 'Aguardando',
  EM_ANDAMENTO: 'Em andamento',
  CONCLUIDO: 'Concluído',
};

const LABEL_ORIGEM: Record<string, string> = {
  RELATORIO_RO: 'Relatório R.O',
  PRODUCAO: 'Produção',
  INSPECAO_EXTRA: 'Inspeção Extra',
  SETUP: 'Setup',
  RNC: 'RNC',
  OUTROS: 'Outros',
};

// Em OUTROS o que interessa e o que foi digitado; o rotulo "Outros" sozinho nao
// diz nada a quem le o documento.
function textoOrigem(reg: any): string {
  const rotulo = LABEL_ORIGEM[reg?.origem] ?? txt(reg?.origem);
  const livre = txt(reg?.origemOutros);
  return reg?.origem === 'OUTROS' && livre ? livre : rotulo;
}

// Numero do documento e nomes dos arquivos anexados, no mesmo campo. Os dois
// sao opcionais: sem nenhum dos dois o campo sai com traco, como os demais.
function textoDocumento(reg: any, docs: string[] = []): string {
  const partes = [txt(reg?.documentoReferencia), ...docs.map((d) => txt(d))];
  return partes.filter(Boolean).join(' — ') || '-';
}

const LABEL_TURNO: Record<string, string> = {
  COMERCIAL: 'Comercial',
  SEGUNDO_TURNO: '2º turno',
};

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

export type FotosCincoG = Partial<Record<keyof typeof EVID_5G, Buffer[]>>;

export function gerarPdfCincoG(
  reg: any,
  fotos: FotosCincoG = {},
  // Nomes dos arquivos anexados como documento de referencia: o PDF nao carrega
  // o arquivo, so registra que ele existe e como se chama.
  docs: string[] = [],
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

  const subtitulo = (texto: string) => {
    espaco(28);
    doc.rect(X0, y, W, 14).fill(FUNDO);
    doc.lineWidth(0.7).strokeColor(PRETO).rect(X0, y, W, 14).stroke();
    doc
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .fillColor(PRETO)
      .text(texto, X0 + 5, y + 3.5, { width: W - 10, lineBreak: false });
    y += 14;
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

  const vazio = (texto: string) => {
    espaco(18);
    doc
      .font('Helvetica-Oblique')
      .fontSize(8)
      .fillColor(CINZA)
      .text(texto, X0 + 5, y + 4, { width: W - 10 });
    y += 17;
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
        doc.image(foto, X0 + 6 + col * (celulaW + 6), y + 6 + lin * (celulaH + 6), {
          fit: [celulaW, celulaH],
          align: 'center',
          valign: 'center',
        });
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
      vazio(vazioTexto);
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
    { rotulo: 'Formulário', valor: 'BDBR.QUA.FMR.007.01' },
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
      .text(`${l.rotulo}:`, cbX + 3, cbY + 2, { width: cbW - 6, lineBreak: false });
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
    .text('Método 5G', tituloX, 34, { width: tituloW, align: 'center' });
  doc
    .font('Helvetica-Oblique')
    .fontSize(8)
    .fillColor(CINZA)
    .text(
      'Reestabelecimento das condições normais do processo',
      tituloX,
      doc.y + 2,
      { width: tituloW, align: 'center' },
    );

  y = 30 + cbH + 6;

  // ------------------------------------------------------ identificacao
  faixa('IDENTIFICAÇÃO');
  linha([
    { w: 74, label: 'DATA INÍCIO', valor: fmtData(reg.dataAbertura) },
    { w: 150, label: 'DEPARTAMENTO', valor: txt(reg.departamento) },
    { w: 160, label: 'ÁREA DE APLICAÇÃO', valor: txt(reg.areaAplicacao) },
    {
      w: W - 74 - 150 - 160,
      label: 'STATUS',
      valor: LABEL_STATUS[reg.status] ?? txt(reg.status),
    },
  ]);
  linha([
    { w: 190, label: 'COORDENADOR', valor: txt(reg.responsavel) },
    { w: W - 190, label: 'GRUPO DE TRABALHO', valor: txt(reg.equipe) },
  ]);
  linha([
    { w: 180, label: 'PRODUTO / ITEM', valor: txt(reg.produtoItem) },
    { w: 120, label: 'CÓDIGO / DESENHO', valor: txt(reg.codigoDesenho) },
    { w: 110, label: 'LOCAL', valor: txt(reg.local) },
    {
      w: W - 180 - 120 - 110,
      label: 'ORIGEM',
      valor: textoOrigem(reg),
    },
  ]);
  linha([
    { w: 200, label: 'PROCESSO / OPERAÇÃO', valor: txt(reg.processoOperacao) },
    { w: 200, label: 'EQUIPAMENTO', valor: txt(reg.equipamento) },
    {
      w: W - 400,
      label: 'TURNO',
      valor: LABEL_TURNO[reg.turno] ?? txt(reg.turno),
    },
  ]);
  linha([
    {
      // Documento que motivou a abertura. O numero e digitado no formulario e o
      // arquivo fica nos anexos: aqui saem os dois, para quem le o PDF saber o
      // que procurar.
      w: W - 320,
      label: 'DOCUMENTO REFERENCIADO',
      valor: textoDocumento(reg, docs),
    },
    { w: 160, label: 'INSPEÇÃO VINCULADA', valor: txt(reg.inspecao?.numero) || '-' },
    { w: 160, label: 'CNQ VINCULADO', valor: txt(reg.cnq?.numero) || '-' },
  ]);

  // ---------------------------------------------------------- problema
  y += 5;
  faixa('PROBLEMA INVESTIGADO');
  bloco('Problema', txt(reg.descricaoProblema), 34);

  // -------------------------------------------------------- checklist 5G
  y += 5;
  faixa('MÉTODO 5G — AVALIAÇÃO DAS CONDIÇÕES DO PROCESSO');
  const legenda5G = CINCO_G.map(
    (g) => `${g.sigla} (${g.tema}): ${g.acao}.`,
  ).join('  ');
  espaco(alturaTexto(legenda5G, W - 10, 6.5) + 10);
  doc
    .font('Helvetica-Oblique')
    .fontSize(6.5)
    .fillColor(CINZA)
    .text(legenda5G, X0 + 5, y + 3, { width: W - 10 });
  y += alturaTexto(legenda5G, W - 10, 6.5) + 7;

  const dados5G = checklist5G(reg.avaliacoes).map((l: any, i: number) => ({
    ...l,
    _n: String(i + 1),
    _prazo: fmtData(l.prazo) || txt(l.prazo),
    _status: labelSituacaoAcao[l.status] ?? txt(l.status),
  }));

  tabela(
    [
      { titulo: 'Nº', w: 18, campo: '_n' },
      { titulo: 'Avaliação', w: 120, campo: 'avaliacao' },
      { titulo: 'Análise 4M', w: 50, campo: 'analise4M' },
      { titulo: 'Objetivo', w: 120, campo: 'objetivo' },
      { titulo: 'Especificado', w: 100, campo: 'especificado' },
      { titulo: 'Verificado', w: 80, campo: 'verificado' },
      {
        titulo: 'Necessita restauração?',
        w: W - 18 - 120 - 50 - 120 - 100 - 80,
        campo: 'necessitaRestauracao',
      },
    ],
    dados5G,
    'Checklist 5G não preenchido.',
  );

  y += 4;
  subtitulo('Restauração das condições normais');
  tabela(
    [
      { titulo: 'Nº', w: 18, campo: '_n' },
      { titulo: 'Como fazer a restauração?', w: 231, campo: 'comoRestaurar' },
      { titulo: 'Responsável', w: 90, campo: 'responsavel' },
      { titulo: 'Prazo', w: 60, campo: '_prazo' },
      { titulo: 'Status', w: 78, campo: '_status' },
      {
        titulo: 'Solução foi eficaz?',
        w: W - 18 - 231 - 90 - 60 - 78,
        campo: 'eficaz',
      },
    ],
    dados5G,
    '',
  );
  espaco(14);
  doc
    .font('Helvetica-Oblique')
    .fontSize(6)
    .fillColor(CINZA)
    .text(`* ${NOTA_5G}`, X0 + 3, y + 3, { width: W - 6 });
  y += alturaTexto(`* ${NOTA_5G}`, W - 6, 6) + 6;
  quadroFotos('Evidências do processo investigado', fotos.evidencias);

  // ---------------------------------------------------------- conclusao
  y += 5;
  faixa('CONCLUSÃO / FECHAMENTO');
  bloco('Conclusão', txt(reg.conclusao), 34);
  linha(
    [
      { w: 110, label: 'DATA TÉRMINO', valor: fmtData(reg.dataTermino) },
      {
        w: (W - 110) / 2,
        label: 'APROVAÇÃO DA QUALIDADE',
        valor: reg.aprovadoPor
          ? `${nomeCurto(reg.aprovadoPor.nome)} — ${fmtData(reg.aprovadoEm)}`
          : '',
      },
      {
        w: (W - 110) / 2,
        label: 'VERIFICAÇÃO (GERENTE DA ÁREA)',
        valor: txt(reg.verificacaoGerente),
      },
    ],
    40,
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
        `Big Dutchman Brasil — Sistema de Qualidade · Método 5G ${txt(reg.numero)} · Página ${i + 1} de ${paginas.count}`,
        X0,
        doc.page.height - 34,
        { width: W, align: 'center' },
      );
  }

  return doc;
}
