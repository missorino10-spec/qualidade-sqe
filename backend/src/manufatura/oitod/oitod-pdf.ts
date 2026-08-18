import PDFDocument from 'pdfkit';
import { join } from 'path';
import { existsSync } from 'fs';
import {
  CINCO_G,
  ESPINHAS_6M,
  EVID_8D,
  NOTA_5G,
  causasPotenciaisNormalizadas,
  checklist5G,
  labelSituacaoAcao,
  planoAcaoNormalizado,
} from '../../comum/oitod';

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
};

const LABEL_TURNO: Record<string, string> = {
  COMERCIAL: 'Comercial',
  SEGUNDO_TURNO: '2º turno',
};

// As perguntas do 5W 1H, na ordem do quadro 1.2 da planilha.
const CINCO_W_1H: { chave: string; label: string }[] = [
  { chave: 'oQue', label: 'O QUÊ?' },
  { chave: 'quando', label: 'QUANDO?' },
  { chave: 'onde', label: 'ONDE?' },
  { chave: 'quem', label: 'QUEM?' },
  { chave: 'qual', label: 'QUAL?' },
  { chave: 'como', label: 'COMO?' },
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

function moeda(v: any): string {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return '';
  return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

function lista(v: unknown): any[] {
  return Array.isArray(v) ? v : [];
}

// As fotos chegam ja baixadas do Storage, separadas pelo passo a que pertencem
// (as chaves sao as de EVID_8D). O PDF e sincrono, entao nada e buscado aqui.
export type FotosOitoD = Partial<Record<keyof typeof EVID_8D, Buffer[]>>;

// Analise de Problemas da Qualidade / 8D — Doc BDBR.QUA.FMR.007.01.
// O documento segue passo a passo a planilha usada hoje pela Qualidade.
export function gerarPdfOitoD(
  d8: any,
  fotos: FotosOitoD = {},
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

  // Altura que o texto ocupa numa dada largura. E o que evita o layout torto:
  // toda celula cresce ate caber o conteudo em vez de cortar.
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

  // ------------------------------------------------------------ primitivas
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

  // Linha de celulas rotuladas, com altura calculada pelo maior conteudo.
  const linha = (
    campos: { w: number; label: string; valor: string; cor?: string }[],
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
        .fillColor(c.cor ?? PRETO)
        .text(c.valor, x + 4, y + 12, { width: c.w - 8 });
      x += c.w;
    }
    y += altura;
  };

  // Bloco de texto corrido que cresce com o conteudo (e nunca corta).
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

  // Quadro de imagem do passo: a planilha reserva um retangulo para foto,
  // fluxo ou grafico. Sem foto o quadro nem aparece, para nao gastar papel.
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

  // Tabela com quebra de linha dentro da celula e cabecalho repetido a cada
  // pagina nova.
  type Coluna = { titulo: string; w: number; campo: string };
  const tabela = (colunas: Coluna[], linhas: any[], vazioTexto: string) => {
    const cabecalho = () => {
      const altura = Math.max(
        14,
        ...colunas.map((c) => alturaTexto(c.titulo, c.w - 6, 6.5, 'Helvetica-Bold') + 6),
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

  // ------------------------------------------------- diagrama espinha de peixe
  // Desenho vetorial do 6M + 1D: espinha central apontando para o efeito, tres
  // espinhas por cima e quatro por baixo, cada uma com a sua causa escrita na
  // cunha. E o mesmo desenho da planilha, so que preenchido com o registro.
  const espinhaDePeixe = (efeito: string, causas: Record<string, any>) => {
    const ALTURA = 250;
    const CAIXA_EFEITO_W = 92;
    espaco(ALTURA + 6);

    const topo = y + 4;
    const eixoY = topo + ALTURA / 2;
    const inicio = X0 + 6;
    const pontaSeta = X1 - CAIXA_EFEITO_W - 8;

    // Espinha central com a seta.
    doc
      .lineWidth(1.6)
      .strokeColor(PRETO)
      .moveTo(inicio, eixoY)
      .lineTo(pontaSeta, eixoY)
      .stroke();
    doc
      .fillColor(PRETO)
      .moveTo(pontaSeta + 10, eixoY)
      .lineTo(pontaSeta - 1, eixoY - 5.5)
      .lineTo(pontaSeta - 1, eixoY + 5.5)
      .fill();

    // Caixa do efeito.
    const caixaX = X1 - CAIXA_EFEITO_W;
    const caixaAltura = Math.max(
      40,
      alturaTexto(efeito || '-', CAIXA_EFEITO_W - 10, 7.5) + 22,
    );
    doc
      .lineWidth(1.1)
      .strokeColor(LARANJA)
      .rect(caixaX, eixoY - caixaAltura / 2, CAIXA_EFEITO_W, caixaAltura)
      .stroke();
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor(LARANJA)
      .text('EFEITO', caixaX, eixoY - caixaAltura / 2 + 5, {
        width: CAIXA_EFEITO_W,
        align: 'center',
      });
    doc
      .font('Helvetica')
      .fontSize(7.5)
      .fillColor(PRETO)
      .text(efeito || '-', caixaX + 5, eixoY - caixaAltura / 2 + 17, {
        width: CAIXA_EFEITO_W - 10,
        align: 'center',
      });

    const cima = ESPINHAS_6M.filter((e) => e.lado === 'cima');
    const baixo = ESPINHAS_6M.filter((e) => e.lado === 'baixo');
    const util = pontaSeta - inicio;
    const RECUO = 46; // deslocamento horizontal da diagonal
    const ALTA = ALTURA / 2 - 22; // altura da diagonal

    const desenharLado = (grupo: typeof ESPINHAS_6M, paraCima: boolean) => {
      const passo = util / (grupo.length + 0.6);
      grupo.forEach((esp, i) => {
        const base = inicio + passo * (i + 1) + RECUO * 0.55;
        const pontaX = base - RECUO;
        const pontaY = paraCima ? eixoY - ALTA : eixoY + ALTA;

        doc
          .lineWidth(1)
          .strokeColor(PRETO)
          .moveTo(base, eixoY)
          .lineTo(pontaX, pontaY)
          .stroke();

        // Caixa do M, na ponta da espinha.
        const cx = pontaX - 38;
        const cy = paraCima ? pontaY - 13 : pontaY;
        doc.rect(cx, cy, 76, 13).fill(LARANJA);
        doc
          .font('Helvetica-Bold')
          .fontSize(7)
          .fillColor('#FFFFFF')
          .text(esp.label.toUpperCase(), cx, cy + 3.5, {
            width: 76,
            align: 'center',
            lineBreak: false,
          });

        // Causa escrita na cunha, ao lado da diagonal.
        const causa = txt(causas?.[esp.chave]);
        if (!causa) return;
        const larguraTexto = 84;
        const alturaCausa = alturaTexto(causa, larguraTexto, 6);
        const ty = paraCima ? cy + 15 : cy - 2 - alturaCausa;
        doc
          .font('Helvetica')
          .fontSize(6)
          .fillColor(PRETO)
          .text(causa, cx - 4, ty, {
            width: larguraTexto,
            align: 'center',
            height: ALTA - 20,
            ellipsis: true,
          });
      });
    };

    desenharLado(cima, true);
    desenharLado(baixo, false);

    y = topo + ALTURA;
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
    { rotulo: 'Registro Nº', valor: txt(d8.numero) || '-' },
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
    .text('Análise de Problemas da Qualidade', tituloX, 34, {
      width: tituloW,
      align: 'center',
    });
  doc
    .font('Helvetica-Oblique')
    .fontSize(8)
    .fillColor(CINZA)
    .text('8D / Registro de Melhoria', tituloX, doc.y + 2, {
      width: tituloW,
      align: 'center',
    });

  y = 30 + cbH + 6;

  // ------------------------------------------------------ identificacao
  faixa('IDENTIFICAÇÃO');
  linha([
    { w: 74, label: 'DATA INÍCIO', valor: fmtData(d8.dataAbertura) },
    { w: 150, label: 'DEPARTAMENTO', valor: txt(d8.departamento) },
    { w: 160, label: 'ÁREA DE APLICAÇÃO', valor: txt(d8.areaAplicacao) },
    {
      w: W - 74 - 150 - 160,
      label: 'STATUS',
      valor: LABEL_STATUS[d8.status] ?? txt(d8.status),
    },
  ]);
  linha([
    { w: 190, label: 'COORDENADOR', valor: txt(d8.responsavel) },
    { w: W - 190, label: 'GRUPO DE TRABALHO', valor: txt(d8.equipe) },
  ]);
  linha([
    { w: 180, label: 'PRODUTO / ITEM', valor: txt(d8.produtoItem) },
    { w: 120, label: 'CÓDIGO / DESENHO', valor: txt(d8.codigoDesenho) },
    { w: 110, label: 'LOCAL', valor: txt(d8.local) },
    {
      w: W - 180 - 120 - 110,
      label: 'ORIGEM',
      valor: LABEL_ORIGEM[d8.origem] ?? txt(d8.origem),
    },
  ]);
  linha([
    { w: 160, label: 'PROCESSO / OPERAÇÃO', valor: txt(d8.processoOperacao) },
    { w: 150, label: 'EQUIPAMENTO', valor: txt(d8.equipamento) },
    {
      w: 80,
      label: 'TURNO',
      valor: LABEL_TURNO[d8.turno] ?? txt(d8.turno),
    },
    { w: W - 160 - 150 - 80, label: 'QTD. AFETADA', valor: txt(d8.qtdAfetada) },
  ]);
  linha([
    { w: W / 2, label: 'INSPEÇÃO VINCULADA', valor: txt(d8.inspecao?.numero) || '-' },
    { w: W / 2, label: 'CNQ VINCULADO', valor: txt(d8.cnq?.numero) || '-' },
  ]);

  // ------------------------------------------------------------- passo 1
  y += 5;
  faixa('PASSO 1 — PROBLEMA');
  bloco('Problema', txt(d8.descricaoProblema), 34);

  y += 4;
  subtitulo('1.1 — Objetivos');
  bloco('Objetivo (SMART, medido contra a perda causal)', txt(d8.objetivos), 30);
  linha([
    { w: 380, label: 'PERDA ATACADA', valor: txt(d8.perdaAtacada) },
    { w: W - 380, label: 'VALOR (R$/ANO)', valor: moeda(d8.perdaValorAno) },
  ]);

  y += 4;
  subtitulo('1.2 — Descrição do Problema (5W 1H)');
  const cinco = d8.descricao5W1H ?? {};
  for (const p of CINCO_W_1H) {
    linha([{ w: W, label: p.label, valor: txt(cinco[p.chave]) }], 24);
  }

  y += 4;
  subtitulo('1.3 — Situação Atual');
  bloco(
    'Mapa de processo/produto, fluxo, desenho do fenômeno',
    txt(d8.situacaoAtual),
    34,
  );
  quadroFotos('Registro da situação atual', fotos.situacaoAtual);

  y += 4;
  subtitulo('1.4 — Estratificação (Pareto)');
  bloco('Estratificação', txt(d8.estratificacao), 34);
  quadroFotos('Gráfico de Pareto / estratificação', fotos.estratificacao);

  // ------------------------------------------------------------- passo 2
  y += 5;
  faixa(
    'PASSO 2 — REESTABELECER AS CONDIÇÕES NORMAIS DO PROCESSO (MÉTODO 5G)',
  );
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

  const linhas5G = checklist5G(d8.metodo5G);
  // As onze colunas da aba "MÉTODO 5G" nao cabem na largura do A4 em pe: o
  // quadro e partido em dois - a avaliacao e, embaixo, a restauracao - com o
  // mesmo numero de linha ligando os dois.
  const dados5G = linhas5G.map((l: any, i: number) => ({
    ...l,
    _n: String(i + 1),
    prazo: fmtData(l.prazo) || txt(l.prazo),
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
      { titulo: 'Prazo', w: 60, campo: 'prazo' },
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
  quadroFotos('Evidências do processo investigado (5G)', fotos.metodo5G);

  // ------------------------------------------------------------- passo 3
  y += 4;
  faixa('PASSO 3 — PLANEJAR AS ATIVIDADES (CRONOGRAMA E RESPONSABILIDADES)');
  tabela(
    [
      { titulo: 'Atividade', w: 236, campo: 'atividade' },
      { titulo: 'Responsável', w: 120, campo: 'responsavel' },
      { titulo: 'Início', w: 60, campo: '_inicio' },
      { titulo: 'Fim', w: 60, campo: '_fim' },
      { titulo: 'Status', w: W - 236 - 120 - 120, campo: '_status' },
    ],
    lista(d8.cronograma).map((l: any) => ({
      ...l,
      _inicio: fmtData(l.inicio) || txt(l.inicio),
      _fim: fmtData(l.fim) || txt(l.fim),
      _status: labelSituacaoAcao[l.status] ?? txt(l.status),
    })),
    'Nenhuma atividade planejada.',
  );

  // ------------------------------------------------------------- passo 4
  y += 5;
  faixa('PASSO 4 — ANÁLISE DE CAUSA RAIZ (6M + 1D)');
  espinhaDePeixe(txt(d8.efeito), d8.causas6M ?? {});

  y += 4;
  subtitulo('Causas levantadas por espinha');
  tabela(
    [
      { titulo: 'Espinha (6M + 1D)', w: 110, campo: '_m' },
      { titulo: 'Causas levantadas', w: W - 110, campo: '_causa' },
    ],
    ESPINHAS_6M.map((e) => ({
      _m: e.label,
      _causa: txt((d8.causas6M ?? {})[e.chave]),
    })),
    '',
  );

  y += 4;
  subtitulo('Causas potenciais × 5 Porquês');
  tabela(
    [
      { titulo: 'Causa potencial', w: 125, campo: 'causa' },
      { titulo: 'Por quê 1', w: 80, campo: 'porque1' },
      { titulo: 'Por quê 2', w: 80, campo: 'porque2' },
      { titulo: 'Por quê 3', w: 80, campo: 'porque3' },
      { titulo: 'Por quê 4', w: 80, campo: 'porque4' },
      { titulo: 'Por quê 5', w: W - 125 - 80 * 4, campo: 'porque5' },
    ],
    causasPotenciaisNormalizadas(d8.causasPotenciais, d8.porques, d8.causaRaiz),
    'Nenhuma causa potencial registrada.',
  );

  y += 4;
  bloco('Causa raiz confirmada', txt(d8.causaRaiz), 34);

  // ------------------------------------------------------------- passo 5
  y += 5;
  faixa('PASSO 5 — PLANO DE AÇÃO');
  tabela(
    [
      {
        titulo: 'O QUÊ? (ação corretiva)',
        w: 120,
        campo: 'oQue',
      },
      { titulo: 'POR QUÊ? (causa)', w: 95, campo: 'porQue' },
      { titulo: 'COMO? (como fazer)', w: 100, campo: 'como' },
      { titulo: 'QUEM?', w: 55, campo: 'quem' },
      { titulo: 'QUANDO?', w: 45, campo: '_quando' },
      { titulo: 'QUANTO CUSTA? (R$)', w: 50, campo: '_custo' },
      {
        titulo: 'SITUAÇÃO',
        w: W - 120 - 95 - 100 - 55 - 45 - 50,
        campo: '_situacao',
      },
    ],
    planoAcaoNormalizado(d8.planoAcao).map((a: any) => ({
      ...a,
      _quando: fmtData(a.quando) || txt(a.quando),
      _custo: moeda(a.custo),
      _situacao: labelSituacaoAcao[a.situacao] ?? txt(a.situacao),
    })),
    'Nenhuma ação registrada.',
  );

  const pad = d8.padronizacao ?? {};
  const padronizacao = [
    pad.documentos ? `Documentos: ${txt(pad.documentos)}` : '',
    pad.treinamentos ? `Treinamentos: ${txt(pad.treinamentos)}` : '',
    txt(pad.observacoes),
  ]
    .filter(Boolean)
    .join('\n');
  y += 4;
  bloco('Padronização (documentos e treinamentos)', padronizacao, 30);

  // ------------------------------------------------------------- passo 6
  y += 5;
  faixa('PASSO 6 — VERIFICAÇÃO DOS RESULTADOS');
  espaco(14);
  doc
    .font('Helvetica-Oblique')
    .fontSize(6.5)
    .fillColor(CINZA)
    .text(
      'Monitorar o resultado por pelo menos 3 meses após a implantação das ações.',
      X0 + 5,
      y + 3,
      { width: W - 10 },
    );
  y += 14;
  bloco('Resultados observados', txt(d8.verificacaoResultados), 36);
  quadroFotos('Registro dos resultados (antes / depois)', fotos.resultados);

  const v = d8.verificacaoEficacia ?? {};
  if (
    [
      v.criterio,
      v.metodo,
      v.amostra,
      v.resultadoEsperado,
      v.resultadoObtido,
      v.responsavel,
    ].some((c) => txt(c))
  ) {
    linha([
      { w: 180, label: 'CRITÉRIO', valor: txt(v.criterio) },
      { w: 160, label: 'MÉTODO', valor: txt(v.metodo) },
      { w: W - 180 - 160, label: 'AMOSTRA', valor: txt(v.amostra) },
    ]);
    linha([
      { w: 180, label: 'RESULTADO ESPERADO', valor: txt(v.resultadoEsperado) },
      { w: 180, label: 'RESULTADO OBTIDO', valor: txt(v.resultadoObtido) },
      { w: 70, label: 'DATA', valor: fmtData(v.data) },
      {
        w: W - 180 - 180 - 70,
        label: 'EFICAZ?',
        valor: v.eficaz === true ? 'Sim' : v.eficaz === false ? 'Não' : '',
      },
    ]);
    linha([
      { w: W, label: 'RESPONSÁVEL PELA VERIFICAÇÃO', valor: txt(v.responsavel) },
    ]);
  }

  // Fotos soltas, anexadas antes de cada passo ter o seu proprio quadro.
  quadroFotos('Evidências anexadas ao 8D', fotos.geral);

  // ------------------------------------------------------------ conclusao
  y += 5;
  faixa('CONCLUSÃO / FECHAMENTO');
  linha([
    { w: 110, label: 'DATA TÉRMINO', valor: fmtData(d8.dataTermino) },
    {
      w: W - 110,
      label: 'CUSTOS E INVESTIMENTOS',
      valor: txt(d8.custosInvestimentos),
    },
  ]);
  bloco('Benefícios e ganhos financeiros', txt(d8.beneficiosGanhos), 30);
  bloco('Resultados (índices)', txt(d8.resultadosIndices), 30);
  linha(
    [
      {
        w: W / 3,
        label: 'APROVAÇÃO DA QUALIDADE',
        valor: d8.aprovadoPor
          ? `${txt(d8.aprovadoPor.nome)} — ${fmtData(d8.aprovadoEm)}`
          : '',
      },
      { w: W / 3, label: 'APROVAÇÃO DA PRODUÇÃO', valor: txt(d8.aprovacaoProducao) },
      {
        w: W / 3,
        label: 'VERIFICAÇÃO (GERENTE DA ÁREA)',
        valor: txt(d8.verificacaoGerente),
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
        `Big Dutchman Brasil — Sistema de Qualidade · Análise de Problemas ${txt(d8.numero)} · Página ${i + 1} de ${paginas.count}`,
        X0,
        doc.page.height - 34,
        { width: W, align: 'center' },
      );
  }

  return doc;
}
