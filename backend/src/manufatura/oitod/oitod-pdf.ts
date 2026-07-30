import PDFDocument from 'pdfkit';
import { join } from 'path';
import { existsSync } from 'fs';

const LARANJA = '#E8792B';
const PRETO = '#000000';
const CINZA = '#555555';
const LOGO_PATH = join(process.cwd(), 'assets', 'logo-big-dutchman.png');

const M = 40;
const X0 = M;
const X1 = 555;
const W = X1 - X0;
const RODAPE = 55;

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
};

const LABEL_TURNO: Record<string, string> = {
  COMERCIAL: 'Comercial',
  SEGUNDO_TURNO: '2º turno',
};

// Diagrama 6M da secao 2 do formulario.
const SEIS_M: { chave: string; label: string }[] = [
  { chave: 'maquina', label: 'Máquina' },
  { chave: 'metodo', label: 'Método' },
  { chave: 'material', label: 'Material' },
  { chave: 'maoDeObra', label: 'Mão de obra' },
  { chave: 'medicao', label: 'Medição' },
  { chave: 'meioAmbiente', label: 'Meio ambiente' },
];

// Datas do formulario sao datas puras (sem hora), gravadas como meia-noite UTC:
// formatar no fuso do servidor faria 28/07 virar 27/07 a oeste de Greenwich.
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

// Formulario 8D / Registro de Melhoria — Doc BDBR.QUA.FMR.007.01 (rev. 1).
export function gerarPdfOitoD(d8: any): PDFKit.PDFDocument {
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

  const faixa = (titulo: string) => {
    espaco(18);
    doc.rect(X0, y, W, 16).fill(LARANJA);
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

  const cbX = 395;
  const cbW = X1 - cbX;
  const cbLinhas = [
    { rotulo: 'Formulário', valor: 'BDBR.QUA.FMR.007.01' },
    { rotulo: '8D Nº', valor: txt(d8.numero) || '-' },
    { rotulo: 'Emissão', valor: hojeNoBrasil() },
  ];
  // 17 por linha (e nao 16): o ponto extra evita que a ultima linha encoste na
  // borda inferior do quadro e saia cortada.
  const cbH = cbLinhas.length * 17;
  doc.lineWidth(0.8).strokeColor(PRETO).rect(cbX, 34, cbW, cbH).stroke();
  cbLinhas.forEach((l, i) => {
    const cbY = 34 + i * 17;
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

  const tituloX = 165;
  const tituloW = cbX - 10 - tituloX;
  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor(PRETO)
    .text('Formulário 8D / Registro de Melhoria', tituloX, 38, {
      width: tituloW,
      align: 'center',
    });
  doc
    .font('Helvetica-Oblique')
    .fontSize(8)
    .fillColor(CINZA)
    .text('8D Report / Improvement Record', tituloX, doc.y + 2, {
      width: tituloW,
      align: 'center',
    });

  // O corpo comeca abaixo do quadro de identificacao; se comecasse antes, a
  // primeira faixa cobriria a ultima linha do quadro ("Emissão").
  y = 34 + cbH + 6;

  // ---------------------------------------------- 1. dados / cabecalho
  faixa('1. DADOS DO REGISTRO');
  linha(
    [
      {
        w: 92,
        label: '8D Nº',
        valor: txt(d8.numero),
        cor: LARANJA,
        negrito: true,
      },
      { w: 78, label: 'DATA DE ABERTURA', valor: fmtData(d8.dataAbertura) },
      {
        w: 90,
        label: 'STATUS',
        valor: LABEL_STATUS[d8.status] ?? txt(d8.status),
        negrito: true,
      },
      {
        w: 100,
        label: 'ORIGEM',
        valor: LABEL_ORIGEM[d8.origem] ?? txt(d8.origem),
      },
      {
        w: W - 92 - 78 - 90 - 100,
        label: 'EMPRESA / UNIDADE',
        valor: txt(d8.empresaUnidade),
      },
    ],
    30,
  );

  linha([
    { w: 215, label: 'PRODUTO / ITEM', valor: txt(d8.produtoItem) },
    { w: 120, label: 'CÓDIGO / DESENHO', valor: txt(d8.codigoDesenho) },
    { w: W - 215 - 120, label: 'LOCAL', valor: txt(d8.local) },
  ]);

  linha([
    { w: 150, label: 'PROCESSO / OPERAÇÃO', valor: txt(d8.processoOperacao) },
    { w: 130, label: 'EQUIPAMENTO', valor: txt(d8.equipamento) },
    {
      w: 100,
      label: 'TURNO',
      valor: LABEL_TURNO[d8.turno] ?? txt(d8.turno),
    },
    { w: W - 150 - 130 - 100, label: 'QTD. AFETADA', valor: txt(d8.qtdAfetada) },
  ]);

  linha([
    { w: 180, label: 'RESPONSÁVEL', valor: txt(d8.responsavel) },
    { w: W - 180, label: 'EQUIPE 8D', valor: txt(d8.equipe) },
  ]);

  linha([
    {
      w: 257,
      label: 'INSPEÇÃO VINCULADA',
      valor: txt(d8.inspecao?.numero) || '-',
    },
    { w: W - 257, label: 'CNQ VINCULADO', valor: txt(d8.cnq?.numero) || '-' },
  ]);

  bloco('Descrição do problema (5W2H)', txt(d8.descricaoProblema), 60);

  // ---------------------------------------------- 2. causa raiz
  y += 6;
  faixa('2. ANÁLISE DE CAUSA RAIZ');
  bloco('Efeito / problema', txt(d8.efeito), 30);

  const causas = d8.causas6M ?? {};
  espaco(20);
  doc
    .font('Helvetica-Bold')
    .fontSize(8)
    .fillColor(PRETO)
    .text('Diagrama 6M', X0 + 2, y + 3, { width: W - 4 });
  y += 16;
  for (const m of SEIS_M) {
    espaco(26);
    doc.lineWidth(0.8).strokeColor(PRETO).rect(X0, y, 90, 24).stroke();
    doc
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .fillColor(PRETO)
      .text(m.label, X0 + 4, y + 8, { width: 82, lineBreak: false });
    doc.lineWidth(0.8).strokeColor(PRETO).rect(X0 + 90, y, W - 90, 24).stroke();
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(PRETO)
      .text(txt(causas[m.chave]) || '-', X0 + 94, y + 6, {
        width: W - 98,
        height: 18,
        ellipsis: true,
      });
    y += 24;
  }

  const porques = Array.isArray(d8.porques) ? d8.porques : [];
  y += 6;
  espaco(20);
  doc
    .font('Helvetica-Bold')
    .fontSize(8)
    .fillColor(PRETO)
    .text('5 Porquês', X0 + 2, y + 3, { width: W - 4 });
  y += 16;
  for (let i = 0; i < Math.max(5, porques.length); i++) {
    espaco(22);
    doc.lineWidth(0.8).strokeColor(PRETO).rect(X0, y, 70, 20).stroke();
    doc
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .fillColor(PRETO)
      .text(`Por quê ${i + 1}?`, X0 + 4, y + 6, { width: 62, lineBreak: false });
    doc.lineWidth(0.8).strokeColor(PRETO).rect(X0 + 70, y, W - 70, 20).stroke();
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(PRETO)
      .text(txt(porques[i]) || '-', X0 + 74, y + 5, {
        width: W - 78,
        height: 14,
        ellipsis: true,
      });
    y += 20;
  }

  // ---------------------------------------------- 3. causa raiz confirmada
  y += 6;
  faixa('3. CAUSA RAIZ CONFIRMADA');
  bloco('Causa raiz', txt(d8.causaRaiz), 44);

  // ---------------------------------------------- 4. plano de acao
  y += 6;
  faixa('4. PLANO DE AÇÃO CORRETIVA');
  const acoes = Array.isArray(d8.planoAcao) ? d8.planoAcao : [];
  const colunas = [
    { titulo: 'ID', w: 26, campo: 'id' },
    { titulo: 'Ação', w: 140, campo: 'acao' },
    { titulo: 'Tipo', w: 62, campo: 'tipo' },
    { titulo: 'Responsável', w: 80, campo: 'responsavel' },
    { titulo: 'Prazo', w: 52, campo: 'prazo' },
    { titulo: 'Status', w: 58, campo: 'status' },
    {
      titulo: 'Evidência',
      w: W - 26 - 140 - 62 - 80 - 52 - 58,
      campo: 'evidencia',
    },
  ];
  const cabecalhoAcoes = () => {
    espaco(18);
    doc.rect(X0, y, W, 15).fill('#F0F0F0');
    let x = X0;
    for (const c of colunas) {
      doc.lineWidth(0.5).strokeColor('#999999').rect(x, y, c.w, 15).stroke();
      doc
        .font('Helvetica-Bold')
        .fontSize(7)
        .fillColor(PRETO)
        .text(c.titulo, x + 3, y + 4, { width: c.w - 6, lineBreak: false });
      x += c.w;
    }
    y += 15;
  };
  cabecalhoAcoes();
  if (!acoes.length) {
    espaco(18);
    doc
      .font('Helvetica-Oblique')
      .fontSize(8)
      .fillColor(CINZA)
      .text('Nenhuma ação registrada.', X0 + 4, y + 4, { width: W - 8 });
    y += 18;
  }
  for (const a of acoes) {
    if (y + 16 > doc.page.height - RODAPE) {
      doc.addPage();
      y = M;
      cabecalhoAcoes();
    }
    let x = X0;
    for (const c of colunas) {
      doc.lineWidth(0.5).strokeColor('#CCCCCC').rect(x, y, c.w, 16).stroke();
      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor(PRETO)
        .text(txt(a[c.campo]), x + 3, y + 5, {
          width: c.w - 6,
          lineBreak: false,
          ellipsis: true,
        });
      x += c.w;
    }
    y += 16;
  }

  // ---------------------------------------------- 5. padronizacao
  y += 6;
  faixa('5. PADRONIZAÇÃO');
  const pad = d8.padronizacao ?? {};
  bloco(
    'Documentos atualizados / treinamentos',
    [txt(pad.documentos), txt(pad.treinamentos), txt(pad.observacoes)]
      .filter(Boolean)
      .join('\n'),
    44,
  );

  // ---------------------------------------------- 6. evidencias
  y += 6;
  faixa('6. EVIDÊNCIAS ANTES / DEPOIS');
  espaco(20);
  doc
    .font('Helvetica-Oblique')
    .fontSize(8)
    .fillColor(CINZA)
    .text(
      'As fotos de antes e depois estão anexadas ao registro no sistema.',
      X0 + 4,
      y + 4,
      { width: W - 8 },
    );
  y += 18;

  // ---------------------------------------------- 7. verificacao da eficacia
  y += 6;
  faixa('7. VERIFICAÇÃO DA EFICÁCIA');
  const v = d8.verificacaoEficacia ?? {};
  linha([
    { w: 180, label: 'CRITÉRIO', valor: txt(v.criterio) },
    { w: 150, label: 'MÉTODO', valor: txt(v.metodo) },
    { w: W - 180 - 150, label: 'AMOSTRA', valor: txt(v.amostra) },
  ]);
  linha([
    { w: 170, label: 'RESULTADO ESPERADO', valor: txt(v.resultadoEsperado) },
    { w: 170, label: 'RESULTADO OBTIDO', valor: txt(v.resultadoObtido) },
    { w: 70, label: 'DATA', valor: fmtData(v.data) },
    {
      w: W - 170 - 170 - 70,
      label: 'EFICAZ?',
      valor: v.eficaz === true ? 'Sim' : v.eficaz === false ? 'Não' : '',
      negrito: true,
    },
  ]);
  linha([
    { w: W, label: 'RESPONSÁVEL PELA VERIFICAÇÃO', valor: txt(v.responsavel) },
  ]);

  // ---------------------------------------------- aprovacoes
  y += 8;
  faixa('APROVAÇÕES');
  linha(
    [
      {
        w: W / 2,
        label: 'QUALIDADE',
        valor: d8.aprovadoPor
          ? `${txt(d8.aprovadoPor.nome)} — ${fmtData(d8.aprovadoEm)}`
          : '',
      },
      { w: W / 2, label: 'PRODUÇÃO', valor: txt(d8.aprovacaoProducao) },
    ],
    40,
  );

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
        `Big Dutchman Brasil — Sistema de Qualidade · 8D ${txt(d8.numero)} · Página ${i + 1} de ${paginas.count}`,
        X0,
        doc.page.height - 40,
        { width: W, align: 'center' },
      );
  }

  return doc;
}
