import PDFDocument from 'pdfkit';
import { join } from 'path';
import { existsSync } from 'fs';
import {
  ACOES_HOMOLOGACAO,
  SLA_HOMOLOGACAO_DIAS,
  SLA_RESPOSTA_FORNECEDOR_DIAS,
} from '../sqd-utils';

// Mesma identidade visual dos PDFs da RNC, da inspecao e do 8D. Exportados
// porque a homologacao de itens usa exatamente o mesmo desenho.
export const LARANJA = '#E8792B';
export const PRETO = '#000000';
export const CINZA = '#555555';
export const VERDE = '#237804';
export const VERMELHO = '#A8071A';
const LOGO_PATH = join(process.cwd(), 'assets', 'logo-big-dutchman.png');

export const M = 40;
export const X0 = M;
export const X1 = 555;
export const W = X1 - X0;
export const RODAPE = 55;

const LABEL_RESULTADO: Record<string, string> = {
  APROVADO: 'Aprovado',
  APROVADO_CONDICIONALMENTE: 'Aprovado Condicionalmente',
  REPROVADO: 'Reprovado',
};

export const LABEL_STATUS: Record<string, string> = {
  EM_ANDAMENTO: 'Em andamento',
  FINALIZADO: 'Finalizado',
  CANCELADO: 'Cancelado',
};

export const LABEL_PLANO: Record<string, string> = {
  EM_ANDAMENTO: 'Em andamento',
  FINALIZADO: 'Finalizado',
  CANCELADO: 'Cancelado',
  NAO_APLICAVEL: 'Não aplicável',
};

export const LABEL_EFETIVIDADE: Record<string, string> = {
  NAO_APLICAVEL_CANCELADO: 'Não aplicável / Cancelado',
  NAO_IMPLEMENTADO_ATRASADO: 'Não implementado / Atrasado',
  EFETIVO: 'Efetivo',
  PARCIALMENTE_EFETIVO: 'Parcialmente efetivo',
  INEFICAZ: 'Ineficaz',
};

const LABEL_SOLICITANTE: Record<string, string> = {
  COMPRAS: 'Compras',
  ENGENHARIA: 'Engenharia',
  NC: 'N/C',
};

const LABEL_RESPOSTA: Record<string, string> = {
  SIM: 'Sim',
  NAO: 'Não',
  NA: 'N/A',
};

// Datas do registro sao datas puras (sem hora), gravadas como meia-noite UTC:
// formatar no fuso do servidor faria 08/08 virar 07/08 a oeste de Greenwich.
export function fmtData(d?: Date | string | null): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

// Data de emissao do documento: instante real, no fuso da fabrica.
function hojeNoBrasil(): string {
  return new Date().toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
  });
}

export function txt(v: any): string {
  return v == null || v === '' ? '' : String(v);
}

// Nota no padrao brasileiro, uma casa decimal: 87,5
function fmtNota(v?: number | null): string {
  return v == null
    ? ''
    : Number(v).toLocaleString('pt-BR', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      });
}

// Relogio do PDF: "3 (dentro do SLA)" — a mesma leitura da tela.
export function fmtPrazo(dias?: number | null, sla?: number): string {
  if (dias == null) return '';
  if (sla == null) return String(dias);
  return `${dias} (${dias <= sla ? 'dentro do SLA' : 'fora do SLA'})`;
}

function corResultado(resultado?: string | null): string {
  if (resultado === 'APROVADO') return VERDE;
  if (resultado === 'REPROVADO') return VERMELHO;
  if (resultado === 'APROVADO_CONDICIONALMENTE') return LARANJA;
  return PRETO;
}

// Ferramentas de desenho compartilhadas pelos dois documentos. Cada uma devolve
// o "y" atualizado, porque o layout e sequencial de cima para baixo.
export function ferramentas(doc: PDFKit.PDFDocument) {
  const estado = { y: 0 };

  const espaco = (altura: number) => {
    if (estado.y + altura > doc.page.height - RODAPE) {
      doc.addPage();
      estado.y = M;
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
    doc
      .lineWidth(0.8)
      .strokeColor(PRETO)
      .rect(x, estado.y, largura, altura)
      .stroke();
    doc
      .font('Helvetica-Bold')
      .fontSize(6.5)
      .fillColor(CINZA)
      // Sem quebra: o rotulo tem uma linha so, senao ele invade o valor.
      .text(label, x + 3, estado.y + 3, {
        width: largura - 6,
        lineBreak: false,
        ellipsis: true,
      });
    doc
      .font(opts.negrito ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(8.5)
      .fillColor(opts.valorColor ?? PRETO)
      .text(valor, x + 3, estado.y + 13, {
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
    estado.y += altura;
  };

  const faixa = (titulo: string) => {
    espaco(18);
    doc.rect(X0, estado.y, W, 16).fill(LARANJA);
    doc
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .fillColor('#FFFFFF')
      .text(titulo, X0 + 5, estado.y + 4, { width: W - 10, lineBreak: false });
    estado.y += 16;
  };

  const bloco = (titulo: string, valor: string, altura = 40) => {
    espaco(altura + 16);
    doc
      .lineWidth(0.8)
      .strokeColor(PRETO)
      .rect(X0, estado.y, W, 16)
      .stroke();
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor(PRETO)
      .text(titulo, X0 + 4, estado.y + 4, { width: W - 8, lineBreak: false });
    doc
      .lineWidth(0.8)
      .strokeColor(PRETO)
      .rect(X0, estado.y + 16, W, altura)
      .stroke();
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(PRETO)
      .text(valor || '-', X0 + 5, estado.y + 21, {
        width: W - 10,
        height: altura - 8,
      });
    estado.y += 16 + altura;
  };

  const cabecalho = (
    titulo: string,
    subtitulo: string,
    formulario: string,
    numero: string,
    // A auditoria numera o proprio documento (AUD0001/2026), entao o rotulo
    // da caixa do cabecalho e trocavel.
    rotuloNumero = 'Homologação Nº',
  ) => {
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
      { rotulo: 'Formulário', valor: formulario },
      { rotulo: rotuloNumero, valor: numero || '-' },
      { rotulo: 'Emissão', valor: hojeNoBrasil() },
    ];
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
      .text(titulo, tituloX, 38, { width: tituloW, align: 'center' });
    doc
      .font('Helvetica-Oblique')
      .fontSize(8)
      .fillColor(CINZA)
      .text(subtitulo, tituloX, doc.y + 2, {
        width: tituloW,
        align: 'center',
      });

    estado.y = 34 + cbH + 6;
  };

  const rodape = (legenda: string) => {
    const paginas = doc.bufferedPageRange();
    for (let i = 0; i < paginas.count; i++) {
      doc.switchToPage(paginas.start + i);
      doc.page.margins.bottom = 0;
      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor(CINZA)
        .text(
          `Big Dutchman Brasil — Sistema de Qualidade · ${legenda} · Página ${i + 1} de ${paginas.count}`,
          X0,
          doc.page.height - 40,
          { width: W, align: 'center' },
        );
    }
  };

  return { estado, espaco, cell, linha, faixa, bloco, cabecalho, rodape };
}

// Registro de Homologação de Fornecedores — Doc. BDBR.QUA.FMR.029.01.
export function gerarPdfRegistroHomologacao(h: any): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: 'A4', margin: M, bufferPages: true });
  const t = ferramentas(doc);

  t.cabecalho(
    'Registro de Homologação de Fornecedores',
    'Supplier Approval Record',
    'BDBR.QUA.FMR.029.01',
    txt(h.numero),
  );

  // ------------------------------------------------ 1. identificacao
  t.faixa('1. IDENTIFICAÇÃO DO FORNECEDOR');
  t.linha(
    [
      {
        w: 100,
        label: 'HOMOLOGAÇÃO Nº',
        valor: txt(h.numero),
        cor: LARANJA,
        negrito: true,
      },
      { w: 60, label: 'SEMANA', valor: txt(h.semana) },
      { w: W - 100 - 60 - 110, label: 'FORNECEDOR', valor: txt(h.fornecedorNome) },
      { w: 110, label: 'CÓDIGO', valor: txt(h.codigoFornecedor) },
    ],
    30,
  );
  t.linha([
    { w: 150, label: 'CNPJ', valor: txt(h.cnpj) },
    { w: 130, label: 'INSCRIÇÃO ESTADUAL', valor: txt(h.inscricaoEstadual) },
    {
      w: W - 150 - 130,
      label: 'SOLICITANTE',
      valor: LABEL_SOLICITANTE[h.solicitante] ?? txt(h.solicitante),
    },
  ]);
  t.linha([
    { w: 180, label: 'SEGMENTO', valor: txt(h.segmento) },
    {
      w: 180,
      label: 'RESPONSÁVEL PELAS INFORMAÇÕES',
      valor: txt(h.responsavelInfo),
    },
    { w: W - 180 - 180, label: 'SETOR', valor: txt(h.setor) },
  ]);
  t.bloco('Escopo do fornecedor', txt(h.escopoFornecedor), 34);
  t.bloco('Processos terceirizados', txt(h.processosTerceirizados), 34);

  // ------------------------------------------------ 2. prazos
  t.estado.y += 6;
  t.faixa('2. PRAZOS DO PROCESSO (DIAS ÚTEIS)');
  t.linha([
    { w: 128, label: 'DATA DA SOLICITAÇÃO', valor: fmtData(h.dataSolicitacao) },
    {
      w: 128,
      label: 'RETORNO DO FORNECEDOR',
      valor: fmtData(h.dataRetornoFornecedor),
    },
    {
      w: 130,
      label: 'ENVIO DO RELATÓRIO',
      valor: fmtData(h.dataEnvioRelatorio),
    },
    {
      w: W - 128 - 128 - 130,
      label: 'FINALIZAÇÃO',
      valor: fmtData(h.dataFinalizacao),
    },
  ]);
  t.linha([
    {
      w: 190,
      label: `RESPOSTA DO FORNECEDOR (SLA ${SLA_RESPOSTA_FORNECEDOR_DIAS})`,
      valor: fmtPrazo(h.tempoRespostaDiasUteis, SLA_RESPOSTA_FORNECEDOR_DIAS),
    },
    {
      w: 190,
      label: `LEAD TIME DO RELATÓRIO (SLA ${SLA_HOMOLOGACAO_DIAS})`,
      valor: fmtPrazo(h.leadTimeDiasUteis, SLA_HOMOLOGACAO_DIAS),
    },
    {
      w: W - 190 - 190,
      label: 'TEMPO TOTAL DO CICLO',
      valor: h.tempoTotalDiasUteis == null ? '' : String(h.tempoTotalDiasUteis),
    },
  ]);

  // ------------------------------------------------ 3. resultado
  t.estado.y += 6;
  t.faixa('3. RESULTADO E CONTROLE');
  t.linha(
    [
      {
        w: 90,
        label: 'NOTA FINAL',
        valor: h.nota == null ? '' : `${fmtNota(h.nota)}%`,
        cor: corResultado(h.resultado),
        negrito: true,
      },
      {
        w: 175,
        label: 'RESULTADO DA AUTOAVALIAÇÃO',
        valor: h.resultado
          ? LABEL_RESULTADO[h.resultado]
          : 'Aguardando retorno do fornecedor',
        cor: corResultado(h.resultado),
        negrito: true,
      },
      {
        w: 110,
        label: 'STATUS DA HOMOLOGAÇÃO',
        valor: LABEL_STATUS[h.statusHomologacao] ?? txt(h.statusHomologacao),
        negrito: true,
      },
      {
        w: W - 90 - 175 - 110,
        label: 'STATUS DO PLANO DE AÇÃO',
        valor: h.statusPlanoAcao ? LABEL_PLANO[h.statusPlanoAcao] : '',
      },
    ],
    30,
  );
  t.linha([
    {
      w: 190,
      label: 'DATA DE REAVALIAÇÃO',
      valor: fmtData(h.dataReavaliacao),
    },
    {
      w: W - 190,
      label: 'EFETIVIDADE DO PLANO DE AÇÃO',
      valor: h.efetividadePlanoAcao
        ? LABEL_EFETIVIDADE[h.efetividadePlanoAcao]
        : '',
    },
  ]);
  t.bloco('Ação', h.acao ? (ACOES_HOMOLOGACAO[h.acao] ?? txt(h.acao)) : '', 30);
  t.bloco('Observações', txt(h.observacoes), 40);

  // ------------------------------------------------ 4. encerramento
  t.estado.y += 6;
  t.faixa('4. ENCERRAMENTO');
  const pendencias: string[] = h.pendenciasFinalizacao ?? [];
  t.bloco(
    h.statusHomologacao === 'FINALIZADO'
      ? 'Ciclo encerrado'
      : 'Pendências para encerrar o ciclo',
    h.statusHomologacao === 'FINALIZADO'
      ? `Homologação finalizada em ${fmtData(h.dataFinalizacao)}.`
      : pendencias.length
        ? `Ainda falta ${pendencias.join(', ')}.`
        : 'Nenhuma pendência: o ciclo pode ser encerrado.',
    30,
  );
  t.linha(
    [
      { w: W / 2, label: 'REGISTRADO POR', valor: txt(h.criadoPor?.nome) },
      { w: W / 2, label: 'QUALIDADE (VISTO)', valor: '' },
    ],
    40,
  );

  t.rodape(`Homologação ${txt(h.numero)}`);
  return doc;
}

// Autoavaliação de Fornecedores — Doc. BDBR.QUA.FMR.024.03.
export function gerarPdfAutoavaliacao(h: any): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: 'A4', margin: M, bufferPages: true });
  const t = ferramentas(doc);
  const blocos: any[] = h.blocos ?? [];
  const perguntas: any[] = h.perguntas ?? [];
  const respostas: Record<string, string> = h.respostas ?? {};

  t.cabecalho(
    'Autoavaliação de Fornecedores',
    'Supplier Self-Assessment',
    'BDBR.QUA.FMR.024.03',
    txt(h.numero),
  );

  // ------------------------------------------------ 1. identificacao
  t.faixa('1. IDENTIFICAÇÃO');
  t.linha([
    { w: 250, label: 'FORNECEDOR', valor: txt(h.fornecedorNome) },
    { w: 145, label: 'CNPJ', valor: txt(h.cnpj) },
    {
      w: W - 250 - 145,
      label: 'INSCRIÇÃO ESTADUAL',
      valor: txt(h.inscricaoEstadual),
    },
  ]);
  t.linha([
    {
      w: 220,
      label: 'RESPONSÁVEL PELAS INFORMAÇÕES',
      valor: txt(h.responsavelInfo),
    },
    { w: 110, label: 'SETOR', valor: txt(h.setor) },
    {
      w: 120,
      label: 'RETORNO DO FORNECEDOR',
      valor: fmtData(h.dataRetornoFornecedor),
    },
    { w: W - 220 - 110 - 120, label: 'SEMANA', valor: txt(h.semana) },
  ]);

  if (!h.resultado) {
    t.estado.y += 6;
    t.bloco(
      'Autoavaliação ainda não lançada',
      'O fornecedor ainda não devolveu o formulário. Este documento sai completo depois que as respostas forem lançadas no sistema.',
      30,
    );
    t.rodape(`Autoavaliação ${txt(h.numero)}`);
    return doc;
  }

  // ------------------------------------------------ 2. apuracao
  t.estado.y += 6;
  t.faixa('2. APURAÇÃO POR BLOCO');
  const colunas = [
    { titulo: 'BLOCO', w: 225 },
    { titulo: 'PESO (%)', w: 55 },
    { titulo: 'PONTUAÇÃO', w: 70 },
    { titulo: 'PONDERADA', w: 75 },
    { titulo: 'SITUAÇÃO', w: W - 225 - 55 - 70 - 75 },
  ];
  const cabecalhoTabela = () => {
    t.espaco(16);
    let x = X0;
    for (const c of colunas) {
      doc
        .lineWidth(0.5)
        .strokeColor(PRETO)
        .rect(x, t.estado.y, c.w, 15)
        .stroke();
      doc
        .font('Helvetica-Bold')
        .fontSize(7)
        .fillColor(CINZA)
        .text(c.titulo, x + 3, t.estado.y + 5, {
          width: c.w - 6,
          lineBreak: false,
        });
      x += c.w;
    }
    t.estado.y += 15;
  };
  cabecalhoTabela();
  for (const b of blocos) {
    if (t.estado.y + 16 > doc.page.height - RODAPE) {
      doc.addPage();
      t.estado.y = M;
      cabecalhoTabela();
    }
    const valores = [
      `${b.letra}. ${b.nome}`,
      String(b.peso),
      fmtNota(b.pontuacao),
      fmtNota(b.ponderada),
      b.critico ? 'Crítico' : 'OK',
    ];
    let x = X0;
    colunas.forEach((c, i) => {
      doc
        .lineWidth(0.5)
        .strokeColor('#CCCCCC')
        .rect(x, t.estado.y, c.w, 16)
        .stroke();
      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor(i === 4 && b.critico ? VERMELHO : PRETO)
        .text(valores[i], x + 3, t.estado.y + 5, {
          width: c.w - 6,
          lineBreak: false,
          ellipsis: true,
        });
      x += c.w;
    });
    t.estado.y += 16;
  }

  t.estado.y += 6;
  t.linha(
    [
      {
        w: 130,
        label: 'NOTA PONDERADA FINAL',
        valor: `${fmtNota(h.nota)}%`,
        cor: corResultado(h.resultado),
        negrito: true,
      },
      {
        w: 145,
        label: 'RESULTADO',
        valor: LABEL_RESULTADO[h.resultado] ?? txt(h.resultado),
        cor: corResultado(h.resultado),
        negrito: true,
      },
      {
        // Sem ">=" nem "≥": a fonte padrao do PDF nao tem o sinal e o
        // caractere sai trocado.
        w: W - 130 - 145,
        label: 'CRITÉRIO',
        valor: '90+ aprovado · 80 a 89,99 condicional · abaixo de 80 reprovado',
      },
    ],
    38,
  );

  // ------------------------------------------------ 3. respostas
  t.estado.y += 6;
  t.faixa('3. RESPOSTAS DO FORNECEDOR');
  for (const b of perguntas) {
    const apurado = blocos.find((x: any) => x.letra === b.letra);
    t.espaco(30);
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor(PRETO)
      .text(
        `${b.letra}. ${b.nome}  —  peso ${b.peso}%  ·  ${fmtNota(apurado?.pontuacao)} pts`,
        X0,
        t.estado.y + 4,
        { width: W },
      );
    t.estado.y += 18;

    for (const p of b.perguntas) {
      const r = respostas[p.codigo] ?? 'NAO';
      const altura = Math.max(
        16,
        doc.font('Helvetica').fontSize(7.5).heightOfString(p.texto, {
          width: W - 40 - 40 - 12,
        }) + 8,
      );
      if (t.estado.y + altura > doc.page.height - RODAPE) {
        doc.addPage();
        t.estado.y = M;
      }
      doc
        .lineWidth(0.5)
        .strokeColor('#CCCCCC')
        .rect(X0, t.estado.y, W, altura)
        .stroke();
      doc
        .font('Helvetica-Bold')
        .fontSize(7.5)
        .fillColor(CINZA)
        .text(p.codigo, X0 + 3, t.estado.y + 4, { width: 34, lineBreak: false });
      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor(PRETO)
        .text(p.texto, X0 + 40, t.estado.y + 4, { width: W - 40 - 40 - 12 });
      doc
        .font('Helvetica-Bold')
        .fontSize(7.5)
        .fillColor(r === 'NAO' ? VERMELHO : r === 'SIM' ? VERDE : CINZA)
        .text(LABEL_RESPOSTA[r], X1 - 45, t.estado.y + 4, {
          width: 40,
          align: 'right',
          lineBreak: false,
        });
      t.estado.y += altura;
    }
    t.estado.y += 4;
  }

  // ------------------------------------------------ 4. pontos reprovados
  const reprovadas = blocos.flatMap((b: any) =>
    (b.reprovadas ?? []).map((r: any) => ({
      ...r,
      bloco: `${b.letra}. ${b.nome}`,
    })),
  );
  t.estado.y += 6;
  t.faixa(`4. PONTOS REPROVADOS (${reprovadas.length})`);
  if (!reprovadas.length) {
    t.espaco(18);
    doc
      .font('Helvetica-Oblique')
      .fontSize(8)
      .fillColor(CINZA)
      .text('Nenhuma pergunta reprovada.', X0 + 4, t.estado.y + 4, {
        width: W - 8,
      });
    t.estado.y += 18;
  }
  for (const r of reprovadas) {
    // A altura da linha atende a maior das duas colunas que quebram: o nome do
    // bloco (ex.: "D. Desenvolvimento de Produtos e Processos") e a pergunta.
    doc.font('Helvetica').fontSize(7.5);
    const altura = Math.max(
      16,
      doc.heightOfString(r.texto, { width: W - 190 - 12 }) + 8,
      doc.heightOfString(r.bloco, { width: 145 }) + 8,
    );
    if (t.estado.y + altura > doc.page.height - RODAPE) {
      doc.addPage();
      t.estado.y = M;
    }
    doc
      .lineWidth(0.5)
      .strokeColor('#CCCCCC')
      .rect(X0, t.estado.y, W, altura)
      .stroke();
    doc
      .font('Helvetica')
      .fontSize(7.5)
      .fillColor(CINZA)
      .text(r.bloco, X0 + 3, t.estado.y + 4, { width: 145 });
    doc
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .fillColor(PRETO)
      .text(r.codigo, X0 + 155, t.estado.y + 4, {
        width: 30,
        lineBreak: false,
      });
    doc
      .font('Helvetica')
      .fontSize(7.5)
      .fillColor(PRETO)
      .text(r.texto, X0 + 190, t.estado.y + 4, { width: W - 190 - 12 });
    t.estado.y += altura;
  }

  t.rodape(`Autoavaliação ${txt(h.numero)}`);
  return doc;
}
