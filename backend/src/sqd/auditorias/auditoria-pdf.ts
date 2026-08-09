import PDFDocument from 'pdfkit';
import {
  CINZA,
  LARANJA,
  LABEL_STATUS,
  M,
  PRETO,
  RODAPE,
  VERDE,
  VERMELHO,
  W,
  X0,
  X1,
  ferramentas,
  fmtData,
  txt,
} from '../homologacoes/homologacao-pdf';
import { BLOCOS_AUDITORIA } from './auditorias-utils';

// Os dois PDFs da auditoria usam o mesmo desenho dos demais formularios do SQD.
//
// 1) Registro da auditoria: capa de controle, com o cabecalho, o resultado, o
//    prazo de reavaliacao e o historico das rodadas.
// 2) Checklist preenchido: o "Anexo 1" do relatorio de auditoria, com as 46
//    perguntas, as respostas, as evidencias e o resumo por bloco.

const LABEL_RESULTADO: Record<string, string> = {
  APROVADO: 'Aprovado',
  APROVADO_CONDICIONALMENTE: 'Aprovado Condicionalmente',
  REPROVADO: 'Reprovado',
  CANCELADO: 'Cancelado',
};

const LABEL_RESPOSTA: Record<string, string> = {
  SIM: 'Sim',
  PARCIAL: 'Parcial',
  NAO: 'Não',
  NAO_APLICAVEL: 'N/A',
};

const LABEL_CLASSIFICACAO: Record<string, string> = {
  SATISFATORIO: 'Satisfatório',
  ATENCAO: 'Atenção',
  CRITICO: 'Crítico',
};

function corResultado(resultado?: string | null): string {
  if (resultado === 'APROVADO') return VERDE;
  if (resultado === 'REPROVADO') return VERMELHO;
  if (resultado === 'APROVADO_CONDICIONALMENTE') return LARANJA;
  return PRETO;
}

function corClassificacao(classificacao?: string | null): string {
  if (classificacao === 'SATISFATORIO') return VERDE;
  if (classificacao === 'CRITICO') return VERMELHO;
  if (classificacao === 'ATENCAO') return LARANJA;
  return CINZA;
}

function corResposta(resposta?: string | null): string {
  if (resposta === 'SIM') return VERDE;
  if (resposta === 'NAO') return VERMELHO;
  if (resposta === 'PARCIAL') return LARANJA;
  return CINZA;
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

// Leitura do prazo de reavaliacao, em dias corridos, do jeito que aparece na
// tela: "Reavaliar ate 07/11/2026 (faltam 30 dias)".
function fmtReavaliacao(r: any): string {
  if (!r) return 'Sem reavaliação pendente';
  const limite = fmtData(r.dataLimite);
  if (r.diasRestantes < 0) {
    return `Reavaliar até ${limite} — vencida há ${Math.abs(r.diasRestantes)} dia(s)`;
  }
  if (r.diasRestantes === 0) return `Reavaliar até ${limite} — vence hoje`;
  return `Reavaliar até ${limite} — faltam ${r.diasRestantes} dia(s)`;
}

function corReavaliacao(r: any): string {
  if (!r) return PRETO;
  if (r.semaforo === 'VERMELHO') return VERMELHO;
  if (r.semaforo === 'AMARELO') return LARANJA;
  return VERDE;
}

// ---------------------------------------------------------------------------
// Registro de Auditoria de Fornecedores
// ---------------------------------------------------------------------------
export function gerarPdfRegistroAuditoria(a: any): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: 'A4', margin: M, bufferPages: true });
  const t = ferramentas(doc);
  const rodadas: any[] = a.rodadas ?? [];

  t.cabecalho(
    'Registro de Auditoria de Fornecedores',
    'Supplier Audit Record',
    'Checklist de Auditoria',
    txt(a.numero),
    'Auditoria Nº',
  );

  // ------------------------------------------------ 1. identificacao
  t.faixa('1. IDENTIFICAÇÃO DA AUDITORIA');
  t.linha(
    [
      {
        w: 100,
        label: 'AUDITORIA Nº',
        valor: txt(a.numero),
        cor: LARANJA,
        negrito: true,
      },
      { w: 55, label: 'SEMANA', valor: txt(a.semana) },
      { w: 55, label: 'REVISÃO', valor: txt(a.revisao) },
      {
        w: W - 100 - 55 - 55 - 110,
        label: 'FORNECEDOR',
        valor: txt(a.fornecedorNome),
      },
      { w: 110, label: 'CÓDIGO', valor: txt(a.codigoFornecedor) },
    ],
    30,
  );
  t.linha([
    { w: 160, label: 'CNPJ', valor: txt(a.cnpj) },
    { w: 130, label: 'DATA DA AUDITORIA', valor: fmtData(a.dataAuditoria) },
    {
      w: W - 160 - 130,
      label: 'DATA DA ÚLTIMA RODADA',
      valor: fmtData(a.dataUltimaRodada),
    },
  ]);
  t.linha([
    { w: W / 2, label: 'MOTIVO DA AUDITORIA', valor: txt(a.motivo) },
    { w: W / 2, label: 'LOCAL DE REALIZAÇÃO', valor: txt(a.local) },
  ]);
  t.bloco('Auditores responsáveis', txt(a.auditores), 26);
  t.bloco('Participantes do fornecedor', txt(a.participantes), 26);

  // ------------------------------------------------ 2. resultado
  t.estado.y += 6;
  t.faixa('2. RESULTADO E REAVALIAÇÃO');
  t.linha(
    [
      {
        w: 110,
        label: 'NOTA FINAL (0 A 100)',
        valor: fmtNota(a.nota),
        cor: corResultado(a.resultado),
        negrito: true,
      },
      {
        w: 175,
        label: 'RESULTADO',
        valor: LABEL_RESULTADO[a.resultado] ?? '',
        cor: corResultado(a.resultado),
        negrito: true,
      },
      {
        w: W - 110 - 175,
        label: 'STATUS DA AUDITORIA',
        valor: LABEL_STATUS[a.statusAuditoria] ?? '',
      },
    ],
    30,
  );
  t.linha(
    [
      {
        w: 110,
        label: 'PRAZO (DIAS CORRIDOS)',
        valor: a.prazoReavaliacaoDias ? String(a.prazoReavaliacaoDias) : '',
      },
      {
        w: W - 110,
        label: 'REAVALIAÇÃO',
        valor: fmtReavaliacao(a.reavaliacao),
        cor: corReavaliacao(a.reavaliacao),
        negrito: true,
      },
    ],
    30,
  );
  doc
    .font('Helvetica-Oblique')
    .fontSize(6.5)
    .fillColor(CINZA)
    .text(
      'Critério: Aprovado a partir de 90 pontos. De 80 a 89,99 aprovado condicionalmente, com reavaliação em 180 dias corridos. ' +
        'Abaixo de 80 reprovado, com reavaliação em 90 dias corridos. O prazo conta da data da rodada que gerou o resultado.',
      X0,
      t.estado.y + 3,
      { width: W },
    );
  t.estado.y += 20;

  t.bloco('Conclusão / recomendação da Qualidade', txt(a.conclusao), 46);
  t.bloco('Observações', txt(a.observacoes), 34);

  // ------------------------------------------------ 3. rodadas
  t.estado.y += 6;
  t.faixa(`3. RODADAS DE AUDITORIA (${rodadas.length})`);
  if (!rodadas.length) {
    t.espaco(18);
    doc
      .font('Helvetica-Oblique')
      .fontSize(8)
      .fillColor(CINZA)
      .text('Nenhum checklist lançado.', X0 + 4, t.estado.y + 4, {
        width: W - 8,
      });
    t.estado.y += 18;
  } else {
    const colunas = [
      { titulo: 'REV.', w: 45 },
      { titulo: 'DATA', w: 80 },
      { titulo: 'NOTA', w: 55 },
      { titulo: 'RESULTADO', w: 150 },
      { titulo: 'AUDITORES', w: W - 45 - 80 - 55 - 150 },
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
    for (const r of rodadas) {
      if (t.estado.y + 16 > doc.page.height - RODAPE) {
        doc.addPage();
        t.estado.y = M;
        cabecalhoTabela();
      }
      const valores = [
        txt(r.revisao),
        fmtData(r.dataAuditoria),
        fmtNota(r.nota),
        LABEL_RESULTADO[r.resultado] ?? '',
        txt(r.auditores),
      ];
      let x = X0;
      colunas.forEach((c, i) => {
        doc
          .lineWidth(0.5)
          .strokeColor('#CCCCCC')
          .rect(x, t.estado.y, c.w, 16)
          .stroke();
        doc
          .font(i === 2 || i === 3 ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(7.5)
          .fillColor(i === 2 || i === 3 ? corResultado(r.resultado) : PRETO)
          .text(valores[i], x + 3, t.estado.y + 5, {
            width: c.w - 6,
            lineBreak: false,
            ellipsis: true,
          });
        x += c.w;
      });
      t.estado.y += 16;
    }
  }

  // ------------------------------------------------ 4. encerramento
  t.estado.y += 6;
  t.faixa('4. ENCERRAMENTO');
  const pendencias: string[] = a.pendenciasFinalizacao ?? [];
  t.bloco(
    a.statusAuditoria === 'FINALIZADO'
      ? 'Ciclo encerrado'
      : 'Pendências para encerrar o ciclo',
    a.statusAuditoria === 'FINALIZADO'
      ? `Auditoria encerrada em ${fmtData(a.dataFinalizacao)}.`
      : pendencias.length
        ? `Ainda falta ${pendencias.join(', ')}.`
        : 'Nenhuma pendência: o ciclo pode ser encerrado.',
    30,
  );
  t.linha(
    [
      { w: W / 2, label: 'REGISTRADO POR', valor: txt(a.criadoPor?.nome) },
      { w: W / 2, label: 'QUALIDADE (VISTO)', valor: '' },
    ],
    40,
  );

  t.rodape(`Auditoria ${txt(a.numero)}`);
  return doc;
}

// ---------------------------------------------------------------------------
// Checklist de Auditoria preenchido (Anexo 1 do relatório de auditoria).
//
// O checklist nao tem numero proprio: carrega o numero do registro mais a
// revisao, que e o numero da rodada.
// ---------------------------------------------------------------------------
export function gerarPdfChecklistAuditoria(
  a: any,
  rodada?: number,
): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: 'A4', margin: M, bufferPages: true });
  const t = ferramentas(doc);
  const rodadas: any[] = a.rodadas ?? [];
  const r = rodada
    ? rodadas.find((x) => x.rodada === Number(rodada))
    : rodadas.at(-1);

  t.cabecalho(
    'Checklist de Auditoria',
    'Supplier Audit Checklist',
    'Checklist de Auditoria',
    `${txt(a.numero)}${r ? ` — Rev. ${txt(r.revisao)}` : ''}`,
    'Auditoria Nº',
  );

  if (!r) {
    t.bloco(
      'Checklist não lançado',
      'Esta auditoria ainda não tem checklist preenchido.',
      30,
    );
    t.rodape(`Auditoria ${txt(a.numero)}`);
    return doc;
  }

  // ------------------------------------------------ cabecalho da planilha
  t.faixa('CHECKLIST AUDITORIA');
  t.linha([
    {
      w: W - 130 - 110,
      label: 'NOME DO FORNECEDOR',
      valor: txt(a.fornecedorNome),
    },
    { w: 130, label: 'CNPJ', valor: txt(a.cnpj) },
    { w: 110, label: 'CÓD. FORNECEDOR', valor: txt(a.codigoFornecedor) },
  ]);
  t.linha([
    {
      w: W - 110 - 55,
      label: 'AUDITORES RESPONSÁVEIS',
      valor: txt(r.auditores ?? a.auditores),
    },
    { w: 110, label: 'DATA DA AUDITORIA', valor: fmtData(r.dataAuditoria) },
    { w: 55, label: 'REVISÃO', valor: txt(r.revisao) },
  ]);
  t.linha([
    { w: W / 2, label: 'MOTIVO DA AUDITORIA', valor: txt(a.motivo) },
    {
      w: W / 2,
      label: 'LOCAL DE REALIZAÇÃO',
      valor: txt(r.local ?? a.local),
    },
  ]);
  t.bloco(
    'Participantes do fornecedor',
    txt(r.participantes ?? a.participantes),
    26,
  );

  // ------------------------------------------------ perguntas por bloco
  const respostas: any[] = r.respostas ?? [];
  const blocos: any[] = r.blocos ?? [];
  const porCodigo = new Map(respostas.map((x: any) => [x.codigo, x]));
  const blocoPorCodigo = new Map(blocos.map((b: any) => [b.codigo, b]));

  const wCodigo = 38;
  const wResposta = 52;
  const wEvidencia = 150;
  const wPergunta = W - wCodigo - wResposta - wEvidencia;

  for (const b of BLOCOS_AUDITORIA) {
    const calc: any = blocoPorCodigo.get(b.codigo);
    t.estado.y += 6;
    t.faixa(
      `${b.codigo} ${b.nome}  ·  peso ${b.peso}%` +
        (calc && calc.pontuacao != null
          ? `  ·  ${fmtNota(calc.pontuacao)}%  ·  ${LABEL_CLASSIFICACAO[calc.classificacao] ?? ''}`
          : '  ·  não avaliado'),
    );

    // cabecalho da tabela do bloco
    const cabecalhoTabela = () => {
      t.espaco(15);
      const titulos = [
        { titulo: 'Nº', w: wCodigo },
        { titulo: 'PERGUNTA', w: wPergunta },
        { titulo: 'RESPOSTA', w: wResposta },
        { titulo: 'EVIDÊNCIA / OBSERVAÇÕES', w: wEvidencia },
      ];
      let x = X0;
      for (const c of titulos) {
        doc
          .lineWidth(0.5)
          .strokeColor(PRETO)
          .rect(x, t.estado.y, c.w, 14)
          .stroke();
        doc
          .font('Helvetica-Bold')
          .fontSize(6.5)
          .fillColor(CINZA)
          .text(c.titulo, x + 3, t.estado.y + 4, {
            width: c.w - 6,
            lineBreak: false,
          });
        x += c.w;
      }
      t.estado.y += 14;
    };
    cabecalhoTabela();

    for (const p of b.perguntas) {
      const resp: any = porCodigo.get(p.codigo);
      const evidencia = txt(resp?.evidencia);
      doc.font('Helvetica').fontSize(7.5);
      const altura = Math.max(
        16,
        doc.heightOfString(p.texto, { width: wPergunta - 6 }) + 7,
        doc.heightOfString(evidencia, { width: wEvidencia - 6 }) + 7,
      );
      if (t.estado.y + altura > doc.page.height - RODAPE) {
        doc.addPage();
        t.estado.y = M;
        cabecalhoTabela();
      }

      const celulas = [
        { w: wCodigo, valor: p.codigo, cor: PRETO, align: 'left' as const },
        { w: wPergunta, valor: p.texto, cor: PRETO, align: 'left' as const },
        {
          w: wResposta,
          valor: LABEL_RESPOSTA[resp?.resposta] ?? '',
          cor: corResposta(resp?.resposta),
          align: 'center' as const,
        },
        {
          w: wEvidencia,
          valor: evidencia,
          cor: CINZA,
          align: 'left' as const,
        },
      ];
      let x = X0;
      for (const c of celulas) {
        doc
          .lineWidth(0.5)
          .strokeColor('#CCCCCC')
          .rect(x, t.estado.y, c.w, altura)
          .stroke();
        doc
          .font(c.align === 'center' ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(7.5)
          .fillColor(c.cor)
          .text(c.valor, x + 3, t.estado.y + 4, {
            width: c.w - 6,
            align: c.align,
          });
        x += c.w;
      }
      t.estado.y += altura;
    }
  }

  // ------------------------------------------------ resumo por bloco
  t.estado.y += 8;
  t.faixa('RESUMO POR BLOCO');
  const colResumo = [
    { titulo: 'BLOCO', w: W - 60 - 70 - 80 - 100 },
    { titulo: 'PESO', w: 60 },
    { titulo: 'SCORE DO BLOCO', w: 70 },
    { titulo: 'PONTOS PONDERADOS', w: 80 },
    { titulo: 'CLASSIFICAÇÃO', w: 100 },
  ];
  const cabecalhoResumo = () => {
    t.espaco(15);
    let x = X0;
    for (const c of colResumo) {
      doc
        .lineWidth(0.5)
        .strokeColor(PRETO)
        .rect(x, t.estado.y, c.w, 14)
        .stroke();
      doc
        .font('Helvetica-Bold')
        .fontSize(6.5)
        .fillColor(CINZA)
        .text(c.titulo, x + 3, t.estado.y + 4, {
          width: c.w - 6,
          lineBreak: false,
        });
      x += c.w;
    }
    t.estado.y += 14;
  };
  cabecalhoResumo();

  for (const b of BLOCOS_AUDITORIA) {
    const calc: any = blocoPorCodigo.get(b.codigo);
    if (t.estado.y + 15 > doc.page.height - RODAPE) {
      doc.addPage();
      t.estado.y = M;
      cabecalhoResumo();
    }
    const naoAvaliado = !calc || calc.pontuacao == null;
    const valores = [
      `${b.codigo} ${b.nome}`,
      `${b.peso}%`,
      naoAvaliado ? 'N/A' : `${fmtNota(calc.pontuacao)}%`,
      naoAvaliado ? '-' : fmtNota(calc.ponderada),
      naoAvaliado ? 'Não avaliado' : (LABEL_CLASSIFICACAO[calc.classificacao] ?? ''),
    ];
    let x = X0;
    colResumo.forEach((c, i) => {
      doc
        .lineWidth(0.5)
        .strokeColor('#CCCCCC')
        .rect(x, t.estado.y, c.w, 15)
        .stroke();
      doc
        .font(i === 4 ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(7.5)
        .fillColor(i === 4 && !naoAvaliado ? corClassificacao(calc.classificacao) : PRETO)
        .text(valores[i], x + 3, t.estado.y + 4, {
          width: c.w - 6,
          lineBreak: false,
          ellipsis: true,
        });
      x += c.w;
    });
    t.estado.y += 15;
  }

  // ------------------------------------------------ total
  t.estado.y += 6;
  t.linha(
    [
      {
        w: 140,
        label: 'NOTA FINAL (0 A 100)',
        valor: fmtNota(r.nota),
        cor: corResultado(r.resultado),
        negrito: true,
      },
      {
        w: W - 140,
        label: 'RESULTADO DA RODADA',
        valor: LABEL_RESULTADO[r.resultado] ?? '',
        cor: corResultado(r.resultado),
        negrito: true,
      },
    ],
    30,
  );
  doc
    .font('Helvetica-Oblique')
    .fontSize(6.5)
    .fillColor(CINZA)
    .text(
      'Legenda: Sim = 1,0 · Parcial = 0,5 · Não = 0,0 · N/A = não aplicável (sai da conta). ' +
        'A nota é a média ponderada dos blocos avaliados, normalizada pela soma dos pesos desses blocos. ' +
        'Classificação do bloco: a partir de 90% Satisfatório, a partir de 70% Atenção, abaixo de 70% Crítico.',
      X0,
      t.estado.y + 3,
      { width: W },
    );
  t.estado.y += 26;

  t.bloco('Conclusão / recomendação da Qualidade', txt(r.conclusao), 40);
  t.bloco('Observações', txt(r.observacoes), 34);
  t.linha(
    [
      { w: W / 2, label: 'AUDITOR (VISTO)', valor: '' },
      { w: W / 2, label: 'FORNECEDOR (VISTO)', valor: '' },
    ],
    40,
  );

  t.rodape(`Checklist ${txt(a.numero)} — Rev. ${txt(r.revisao)}`);
  return doc;
}
