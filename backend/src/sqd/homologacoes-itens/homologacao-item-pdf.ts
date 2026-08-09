import PDFDocument from 'pdfkit';
// Mesmo desenho dos PDFs da homologacao de fornecedores: cabecalho, faixas
// laranja, celulas rotuladas e rodape com paginacao. Aqui so mudam os campos.
import {
  CINZA,
  LABEL_EFETIVIDADE,
  LABEL_PLANO,
  LABEL_STATUS,
  LARANJA,
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
  fmtPrazo,
  txt,
} from '../homologacoes/homologacao-pdf';
import {
  ACOES_HOMOLOGACAO_ITEM,
  SLA_HOMOLOGACAO_ITEM_DIAS,
  SLA_RESPOSTA_FORNECEDOR_ITEM_DIAS,
} from './itens-utils';

const LABEL_RESULTADO: Record<string, string> = {
  APROVADO: 'Aprovado',
  REPROVADO: 'Reprovado',
  CANCELADO: 'Cancelado',
};

const LABEL_SOLICITANTE: Record<string, string> = {
  COMPRAS: 'Compras',
  ENGENHARIA: 'Engenharia',
  NC: 'N/C',
  FORNECEDOR: 'Fornecedor',
};

const LABEL_MOTIVO: Record<string, string> = {
  PRIMEIRO_FORNECIMENTO: 'Primeiro Fornecimento',
  ALTERACAO_MATERIAL: 'Alteração de Material',
  ALTERACAO_PROCESSO: 'Alteração de Processo',
};

const LABEL_ORIGEM: Record<string, string> = {
  PLANO_INSPECAO: 'Plano de Inspeção',
  HOMOLOGACAO: 'Homologação',
  DEVOLUCAO: 'Devolução',
  RETRABALHO: 'Retrabalho',
  RELATORIO_OCORRENCIA: 'Relatório de Ocorrência',
  LIBERACAO_SETUP: 'Liberação de Setup',
  OUTROS: 'Outros',
};

const LABEL_VISUAL: Record<string, string> = {
  APROVADO: 'Aprovado',
  REPROVADO: 'Reprovado',
  NAO_APLICAVEL: 'N/A',
};

function corResultado(resultado?: string | null): string {
  if (resultado === 'APROVADO') return VERDE;
  if (resultado === 'REPROVADO') return VERMELHO;
  return PRETO;
}

// Numero com virgula decimal, sem casas fixas: a planilha mostra a medida como
// ela foi digitada (12,5 e nao 12,50).
function num(v: any): string {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}

function moeda(v?: number | null): string {
  return v == null
    ? ''
    : v.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      });
}

// ---------------------------------------------------------------------------
// Registro de Homologação de Itens — Doc. BDBR.QUA.FMR.025.01.
// ---------------------------------------------------------------------------
export function gerarPdfRegistroHomologacaoItem(h: any): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: 'A4', margin: M, bufferPages: true });
  const t = ferramentas(doc);
  const relatorios: any[] = h.relatorios ?? [];

  t.cabecalho(
    'Registro de Homologação de Itens',
    'Item Approval Record',
    'BDBR.QUA.FMR.025.01',
    txt(h.numero),
  );

  // ------------------------------------------------ 1. identificacao
  t.faixa('1. IDENTIFICAÇÃO DO ITEM');
  t.linha(
    [
      {
        w: 100,
        label: 'HOMOLOGAÇÃO Nº',
        valor: txt(h.numero),
        cor: LARANJA,
        negrito: true,
      },
      { w: 55, label: 'REVISÃO', valor: txt(h.revisao) },
      { w: 55, label: 'SEMANA', valor: txt(h.semana) },
      {
        w: W - 100 - 55 - 55 - 105,
        label: 'FORNECEDOR',
        valor: txt(h.fornecedorNome),
      },
      { w: 105, label: 'CÓDIGO DO FORNECEDOR', valor: txt(h.codigoFornecedor) },
    ],
    30,
  );
  t.linha([
    { w: 130, label: 'CÓDIGO DO ITEM', valor: txt(h.itemCodigo) },
    {
      w: W - 130,
      label: 'DESCRIÇÃO DO ITEM',
      valor: txt(h.itemDescricao),
    },
  ]);
  t.linha([
    {
      w: 145,
      label: 'SOLICITANTE',
      valor: LABEL_SOLICITANTE[h.solicitante] ?? txt(h.solicitante),
    },
    {
      w: 190,
      label: 'MOTIVO DA SOLICITAÇÃO',
      valor: LABEL_MOTIVO[h.motivo] ?? txt(h.motivo),
    },
    {
      w: W - 145 - 190,
      label: 'CUSTO POTENCIAL EVITADO',
      valor: moeda(h.custoEvitado),
    },
  ]);

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
      label: `RESPOSTA DO FORNECEDOR (SLA ${SLA_RESPOSTA_FORNECEDOR_ITEM_DIAS})`,
      valor: fmtPrazo(
        h.tempoRespostaDiasUteis,
        SLA_RESPOSTA_FORNECEDOR_ITEM_DIAS,
      ),
    },
    {
      w: 190,
      label: `LEAD TIME DO RELATÓRIO (SLA ${SLA_HOMOLOGACAO_ITEM_DIAS})`,
      valor: fmtPrazo(h.leadTimeDiasUteis, SLA_HOMOLOGACAO_ITEM_DIAS),
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
        w: 175,
        label: 'RESULTADO DA HOMOLOGAÇÃO',
        valor: h.resultado
          ? LABEL_RESULTADO[h.resultado]
          : 'Aguardando relatório de inspeção',
        cor: corResultado(h.resultado),
        negrito: true,
      },
      {
        w: 90,
        label: 'Nº DE TENTATIVAS',
        valor: String(h.tentativas ?? relatorios.length),
        negrito: true,
      },
      {
        w: 110,
        label: 'STATUS DA HOMOLOGAÇÃO',
        valor: LABEL_STATUS[h.statusHomologacao] ?? txt(h.statusHomologacao),
        negrito: true,
      },
      {
        w: W - 175 - 90 - 110,
        label: 'STATUS DO PLANO DE AÇÃO',
        valor: h.statusPlanoAcao ? LABEL_PLANO[h.statusPlanoAcao] : '',
      },
    ],
    30,
  );
  t.linha([
    { w: 190, label: 'DATA DE REAVALIAÇÃO', valor: fmtData(h.dataReavaliacao) },
    {
      w: W - 190,
      label: 'EFETIVIDADE DO PLANO DE AÇÃO',
      valor: h.efetividadePlanoAcao
        ? LABEL_EFETIVIDADE[h.efetividadePlanoAcao]
        : '',
    },
  ]);
  t.bloco(
    'Ação',
    h.acao ? (ACOES_HOMOLOGACAO_ITEM[h.acao] ?? txt(h.acao)) : '',
    30,
  );
  t.bloco('Observações', txt(h.observacoes), 40);

  // ------------------------------------------------ 4. tentativas
  t.estado.y += 6;
  t.faixa(`4. RELATÓRIOS DE INSPEÇÃO (${relatorios.length})`);
  if (!relatorios.length) {
    t.espaco(18);
    doc
      .font('Helvetica-Oblique')
      .fontSize(8)
      .fillColor(CINZA)
      .text('Nenhum relatório de inspeção lançado.', X0 + 4, t.estado.y + 4, {
        width: W - 8,
      });
    t.estado.y += 18;
  } else {
    const colunas = [
      { titulo: 'REV.', w: 45 },
      { titulo: 'DATA DA INSPEÇÃO', w: 100 },
      { titulo: 'AMOSTRAS', w: 90 },
      { titulo: 'VISUAL', w: 90 },
      { titulo: 'RESULTADO DA TENTATIVA', w: W - 45 - 100 - 90 - 90 },
    ];
    const cabecalhoTabela = () => {
      t.espaco(16);
      let x = X0;
      for (const c of colunas) {
        doc.lineWidth(0.5).strokeColor(PRETO).rect(x, t.estado.y, c.w, 15).stroke();
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
    for (const r of relatorios) {
      if (t.estado.y + 16 > doc.page.height - RODAPE) {
        doc.addPage();
        t.estado.y = M;
        cabecalhoTabela();
      }
      const final =
        r.resultadoAmostras === 'APROVADO' && r.resultadoVisual === 'APROVADO'
          ? 'APROVADO'
          : 'REPROVADO';
      const valores = [
        txt(r.revisao),
        fmtData(r.dataInspecao),
        LABEL_RESULTADO[r.resultadoAmostras] ?? '',
        LABEL_RESULTADO[r.resultadoVisual] ?? '',
        LABEL_RESULTADO[final],
      ];
      let x = X0;
      colunas.forEach((c, i) => {
        doc
          .lineWidth(0.5)
          .strokeColor('#CCCCCC')
          .rect(x, t.estado.y, c.w, 16)
          .stroke();
        doc
          .font(i === 4 ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(7.5)
          .fillColor(
            i === 2
              ? corResultado(r.resultadoAmostras)
              : i === 3
                ? corResultado(r.resultadoVisual)
                : i === 4
                  ? corResultado(final)
                  : PRETO,
          )
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

  // ------------------------------------------------ 5. encerramento
  t.estado.y += 6;
  t.faixa('5. ENCERRAMENTO');
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

// ---------------------------------------------------------------------------
// Relatório de Inspeção — abas AMOSTRAS (BDBR.QUA.FMR.011.06 rev. 06) e
// VISUAL (BDBR.QUA.FMR.06.07 rev. 07) num documento so.
//
// O relatorio nao tem numero proprio: carrega o numero do registro mais a
// revisao, que e o numero da tentativa.
// ---------------------------------------------------------------------------
export function gerarPdfRelatorioInspecaoItem(
  h: any,
  tentativa?: number,
): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: 'A4', margin: M, bufferPages: true });
  const t = ferramentas(doc);
  const relatorios: any[] = h.relatorios ?? [];
  const r = tentativa
    ? relatorios.find((x) => x.tentativa === tentativa)
    : relatorios.at(-1);

  t.cabecalho(
    'Relatório de Inspeção',
    'Inspection Report — Amostras e Visual',
    'BDBR.QUA.FMR.011.06 / FMR.06.07',
    r ? `${txt(h.numero)} — Rev. ${txt(r.revisao)}` : txt(h.numero),
  );

  if (!r) {
    t.bloco(
      'Relatório de inspeção ainda não lançado',
      'Nenhuma amostra foi inspecionada até agora. Este documento sai completo depois que o relatório for lançado no sistema.',
      30,
    );
    t.rodape(`Relatório ${txt(h.numero)}`);
    return doc;
  }

  const final =
    r.resultadoAmostras === 'APROVADO' && r.resultadoVisual === 'APROVADO'
      ? 'APROVADO'
      : 'REPROVADO';

  // ------------------------------------------------ cabecalho do relatorio
  t.faixa('CABEÇALHO / HEADER');
  t.linha(
    [
      {
        w: 130,
        label: 'RELATÓRIO Nº',
        valor: txt(h.numero),
        cor: LARANJA,
        negrito: true,
      },
      { w: 55, label: 'REV.', valor: txt(r.revisao), negrito: true },
      {
        w: 105,
        label: 'DATA DA INSPEÇÃO',
        valor: fmtData(r.dataInspecao),
      },
      {
        w: W - 130 - 55 - 105,
        label: 'ORIGEM DA INSPEÇÃO',
        valor: LABEL_ORIGEM[r.origem] ?? txt(r.origem),
      },
    ],
    30,
  );
  t.linha([
    { w: 130, label: 'Nº DO ITEM / CÓDIGO', valor: txt(h.itemCodigo) },
    {
      w: W - 130,
      label: 'DESCRIÇÃO DO ITEM / ITEM DESCRIPTION',
      valor: txt(h.itemDescricao),
    },
  ]);
  t.linha([
    { w: 170, label: 'DESENHO E REV. / DRAWING AND REV.', valor: txt(r.desenhoRev) },
    {
      w: W - 170 - 175,
      label: 'TOLERÂNCIAS / TOLERANCES',
      valor: txt(r.tolerancias),
    },
    { w: 175, label: 'FORNECEDOR / VENDOR', valor: txt(h.fornecedorNome) },
  ]);
  t.linha([
    { w: 110, label: 'NF', valor: txt(r.nf) },
    { w: 110, label: 'PO', valor: txt(r.po) },
    {
      w: 150,
      label: 'QTD. INSPECIONADA / INSPECTED',
      valor: num(r.qtdInspecionada),
    },
    {
      w: W - 110 - 110 - 150,
      label: 'QTD. TOTAL DE PEÇAS / TOTAL',
      valor: num(r.qtdTotal),
    },
  ]);
  t.linha([
    {
      w: W / 2,
      label: 'ELABORADO POR / ELABORATED BY',
      valor: txt(r.elaboradoPor),
    },
    {
      w: W / 2,
      label: 'INSPECIONADO POR / INSPECTED BY',
      valor: txt(r.inspecionadoPor),
    },
  ]);

  // ------------------------------------------------ aba AMOSTRAS
  t.estado.y += 6;
  t.faixa('AMOSTRAS / SAMPLES — BDBR.QUA.FMR.011.06 (Rev. 06)');
  const cotas: any[] = r.cotas ?? [];
  const nPecas = Math.max(
    1,
    ...cotas.map((c) => (Array.isArray(c.pecas) ? c.pecas.length : 0)),
  );

  // As colunas fixas somam sempre a mesma largura; o que sobra e dividido
  // entre as colunas "Peça 01..N". Com muitas pecas, os dois campos de texto
  // cedem espaco para as medidas continuarem legiveis.
  let wLoc = 92;
  let wInst = 78;
  const fixas = () => wLoc + 46 + 44 + 38 + 38 + wInst + 32 + 32;
  if ((W - fixas()) / nPecas < 30) {
    wLoc = 66;
    wInst = 52;
  }
  const wPeca = (W - fixas()) / nPecas;

  const colunas = [
    { titulo: 'LOCALIZAÇÃO', w: wLoc, align: 'left' as const },
    { titulo: 'ESPECIF.', w: 46, align: 'right' as const },
    { titulo: 'TOLER.', w: 44, align: 'right' as const },
    { titulo: 'UPPER', w: 38, align: 'right' as const },
    { titulo: 'LOWER', w: 38, align: 'right' as const },
    ...Array.from({ length: nPecas }, (_, i) => ({
      titulo: `PEÇA ${String(i + 1).padStart(2, '0')}`,
      w: wPeca,
      align: 'right' as const,
    })),
    { titulo: 'INSTRUMENTO', w: wInst, align: 'left' as const },
    { titulo: 'DESV. MÍN.', w: 32, align: 'right' as const },
    { titulo: 'DESV. MÁX.', w: 32, align: 'right' as const },
  ];

  const cabecalhoCotas = () => {
    t.espaco(20);
    let x = X0;
    for (const c of colunas) {
      doc.lineWidth(0.5).strokeColor(PRETO).rect(x, t.estado.y, c.w, 19).stroke();
      doc
        .font('Helvetica-Bold')
        .fontSize(5.5)
        .fillColor(CINZA)
        .text(c.titulo, x + 2, t.estado.y + 6, {
          width: c.w - 4,
          align: c.align,
        });
      x += c.w;
    }
    t.estado.y += 19;
  };

  if (!cotas.length) {
    t.espaco(18);
    doc
      .font('Helvetica-Oblique')
      .fontSize(8)
      .fillColor(CINZA)
      .text('Nenhuma cota medida.', X0 + 4, t.estado.y + 4, { width: W - 8 });
    t.estado.y += 18;
  } else {
    cabecalhoCotas();
    for (const c of cotas) {
      if (t.estado.y + 15 > doc.page.height - RODAPE) {
        doc.addPage();
        t.estado.y = M;
        cabecalhoCotas();
      }
      const pecas = Array.isArray(c.pecas) ? c.pecas : [];
      const valores = [
        txt(c.localizacao),
        num(c.especificado),
        num(c.tolerancia),
        num(c.upper),
        num(c.lower),
        ...Array.from({ length: nPecas }, (_, i) => num(pecas[i])),
        txt(c.instrumento),
        num(c.desvioMin),
        num(c.desvioMax),
      ];
      // Fora de tolerancia sai em vermelho: e a leitura imediata da planilha.
      const foraMin = Number(c.desvioMin) > 0;
      const foraMax = Number(c.desvioMax) > 0;
      let x = X0;
      colunas.forEach((col, i) => {
        doc
          .lineWidth(0.5)
          .strokeColor('#CCCCCC')
          .rect(x, t.estado.y, col.w, 15)
          .stroke();
        const ultimoDesvio = i === colunas.length - 1;
        const penultimoDesvio = i === colunas.length - 2;
        const vermelho =
          (penultimoDesvio && foraMin) || (ultimoDesvio && foraMax);
        doc
          .font(vermelho ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(6.5)
          .fillColor(vermelho ? VERMELHO : PRETO)
          .text(valores[i], x + 2, t.estado.y + 4, {
            width: col.w - 4,
            align: col.align,
            lineBreak: false,
            ellipsis: true,
          });
        x += col.w;
      });
      t.estado.y += 15;
    }
  }

  t.estado.y += 4;
  t.bloco(
    'Observações finais / Final observations',
    txt(r.observacoesAmostras) || 'Medidas em milímetro.',
    30,
  );
  t.linha(
    [
      {
        w: W,
        label: 'RESULTADO / RESULT — AMOSTRAS',
        valor: LABEL_RESULTADO[r.resultadoAmostras] ?? '',
        cor: corResultado(r.resultadoAmostras),
        negrito: true,
      },
    ],
    30,
  );

  // ------------------------------------------------ aba VISUAL
  t.estado.y += 6;
  t.faixa('VISUAL — BDBR.QUA.FMR.06.07 (Rev. 07)');
  const grupos: any[] = r.checklistVisual ?? [];
  for (const g of grupos) {
    t.espaco(28);
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor(PRETO)
      .text(txt(g.grupo), X0, t.estado.y + 4, { width: W });
    t.estado.y += 18;

    for (const item of g.itens ?? []) {
      doc.font('Helvetica').fontSize(7.5);
      const altura = Math.max(
        15,
        doc.heightOfString(txt(item.texto), { width: W - 12 - 62 }) + 7,
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
        .fillColor(PRETO)
        .text(txt(item.texto), X0 + 5, t.estado.y + 4, { width: W - 12 - 62 });
      doc
        .font('Helvetica-Bold')
        .fontSize(7.5)
        .fillColor(
          item.status === 'REPROVADO'
            ? VERMELHO
            : item.status === 'APROVADO'
              ? VERDE
              : CINZA,
        )
        .text(LABEL_VISUAL[item.status] ?? '', X1 - 62, t.estado.y + 4, {
          width: 57,
          align: 'right',
          lineBreak: false,
        });
      t.estado.y += altura;
    }
    t.estado.y += 4;
  }

  t.bloco('Evidências / Evidence', txt(r.evidenciasVisual), 30);
  t.bloco('Observações finais', txt(r.observacoesVisual), 30);
  t.linha(
    [
      {
        w: W,
        label: 'RESULTADO / RESULT — VISUAL',
        valor: LABEL_RESULTADO[r.resultadoVisual] ?? '',
        cor: corResultado(r.resultadoVisual),
        negrito: true,
      },
    ],
    30,
  );

  // ------------------------------------------------ resultado da tentativa
  t.estado.y += 6;
  t.faixa('RESULTADO DA TENTATIVA');
  t.linha(
    [
      {
        w: 180,
        label: 'AMOSTRAS',
        valor: LABEL_RESULTADO[r.resultadoAmostras] ?? '',
        cor: corResultado(r.resultadoAmostras),
        negrito: true,
      },
      {
        w: 180,
        label: 'VISUAL',
        valor: LABEL_RESULTADO[r.resultadoVisual] ?? '',
        cor: corResultado(r.resultadoVisual),
        negrito: true,
      },
      {
        // O item so passa quando as duas abas passam.
        w: W - 180 - 180,
        label: 'HOMOLOGAÇÃO DO ITEM',
        valor: LABEL_RESULTADO[final],
        cor: corResultado(final),
        negrito: true,
      },
    ],
    30,
  );

  t.rodape(`Relatório ${txt(h.numero)} — Rev. ${txt(r.revisao)}`);
  return doc;
}
