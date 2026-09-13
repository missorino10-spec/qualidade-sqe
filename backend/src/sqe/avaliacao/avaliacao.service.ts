import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { pctConformidade } from '../sqe-utils';
import {
  Classificacao,
  arredondar,
  calcularIdf,
  classificarPorIdf,
  competencia,
  competenciaDe,
  media,
  mesesDoTrimestre,
  notaConformidade,
  notaPlanoAcao,
  notaTempoResposta,
  trimestreCalendario,
} from './idf';

// Numeros de um criterio dentro da competencia, antes de qualquer nota manual.
type Apuracao = {
  lotesInspecionados: number;
  lotesReprovados: number;
  pctConformidade: number;
  notaC1Auto: number | null;
  rncsConsideradas: number;
  horasRespostaMedia: number | null;
  notaC2Auto: number | null;
  notaC3Auto: number | null;
};

const ZERADA: Apuracao = {
  lotesInspecionados: 0,
  lotesReprovados: 0,
  pctConformidade: 0,
  notaC1Auto: null,
  rncsConsideradas: 0,
  horasRespostaMedia: null,
  notaC2Auto: null,
  notaC3Auto: null,
};

// Um mes de apuracao. A competencia nao e o mes civil (fecha no dia 26), por
// isso ela viaja sempre como o par ano/mes e nunca como Date.
type Comp = { ano: number; mes: number };

// IDF efetivo de um fornecedor num mes, ja com as notas manuais aplicadas.
type Celula = {
  idf: number | null;
  classificacao: Classificacao | null;
  fechada: boolean;
  lotesInspecionados: number;
  lotesReprovados: number;
};

// Todas as competencias de um recorte ja resolvidas. O painel inteiro - tabela
// mensal, trimestres e consolidado - le por aqui, entao os tres numeros nunca
// divergem entre si.
type Quadro = {
  celulas: Map<string, Map<number, Celula>>;
  mesesFechados: Set<string>;
};

// Resultado de um trimestre para um fornecedor.
type ResumoTrimestre = {
  trimestre: number;
  ano: number;
  rotulo: string;
  idf: number | null;
  classificacao: Classificacao | null;
  mesesApurados: number;
  mesesDoPeriodo: number;
  fechado: boolean;
  lotesInspecionados: number;
  lotesReprovados: number;
};

const chave = (ano: number, mes: number) => `${ano}-${mes}`;

// Trimestre anterior ao informado, virando o ano quando for o primeiro.
function trimestreAnterior(ano: number, trimestre: number) {
  return trimestre === 1
    ? { ano: ano - 1, trimestre: 4 }
    : { ano, trimestre: trimestre - 1 };
}

function compsDoTrimestre(ano: number, trimestre: number): Comp[] {
  return mesesDoTrimestre(trimestre).map((mes) => ({ ano, mes }));
}

// Competencia imediatamente anterior, virando o ano em janeiro.
function compAnterior({ ano, mes }: Comp): Comp {
  return mes === 1 ? { ano: ano - 1, mes: 12 } : { ano, mes: mes - 1 };
}

const antesDe = (a: Comp, b: Comp) =>
  a.ano < b.ano || (a.ano === b.ano && a.mes < b.mes);

// Competencias de "de" ate "ate", inclusive, em ordem crescente. O teto existe
// so para o laco nunca correr solto se vier uma data absurda do banco.
function compsEntre(de: Comp, ate: Comp, teto = 60): Comp[] {
  const lista: Comp[] = [];
  let atual = de;
  while (!antesDe(ate, atual) && lista.length < teto) {
    lista.push(atual);
    atual =
      atual.mes === 12
        ? { ano: atual.ano + 1, mes: 1 }
        : { ano: atual.ano, mes: atual.mes + 1 };
  }
  return lista;
}

@Injectable()
export class AvaliacaoService {
  constructor(private prisma: PrismaService) {}

  // Competencia corrente pela regra do dia 26.
  competenciaAtual() {
    const { ano, mes } = competenciaDe(new Date());
    return { ano, mes, ...competencia(ano, mes) };
  }

  // ---------------------------------------------------------------------------
  // FECHAMENTO AUTOMATICO
  //
  // Passou o dia 26, a competencia venceu e fecha sozinha - ninguem precisa
  // clicar todo mes. O terceiro mes de um trimestre arrasta o trimestre junto
  // (e com ele a reclassificacao no cadastro), e o quarto trimestre conclui o
  // ano. O botao de fechar continua existindo so para antecipar o mes corrente.
  //
  // O gatilho e a propria consulta ao painel: quem abre a tela poe em dia o que
  // venceu. E de proposito que nao existe agendador - assim o fechamento nao
  // depende do servidor estar de pe a meia-noite (na nuvem ele hiberna) e o
  // sistema se acerta sozinho depois de qualquer parada, inclusive quando ele
  // for para o servidor da empresa.
  // ---------------------------------------------------------------------------

  // Competencia ja conferida neste processo: evita ir ao banco a cada consulta.
  private emDia: string | null = null;
  // Uma sincronizacao por vez: duas telas abertas juntas nao fecham em dobro.
  private sincronizacao: Promise<void> | null = null;

  private async sincronizar() {
    const atual = this.competenciaAtual();
    const marca = chave(atual.ano, atual.mes);
    if (this.emDia === marca) return;
    if (!this.sincronizacao) {
      this.sincronizacao = this.fecharVencidas(atual)
        .then(() => {
          this.emDia = marca;
        })
        .catch((e) => {
          // Fechamento e rotina de bastidor: se falhar, a tela ainda tem que
          // abrir. Fica sem marcar como em dia e a proxima consulta tenta de novo.
          console.error('[IDF] fechamento automatico falhou:', e);
        })
        .finally(() => {
          this.sincronizacao = null;
        });
    }
    await this.sincronizacao;
  }

  // Primeira competencia com dado - e dali que o fechamento comeca a varrer.
  // Sem dado nenhum nao ha o que fechar.
  private async primeiraCompetencia(): Promise<Comp | null> {
    const [visual, lote, rnc, avaliacao] = await Promise.all([
      this.prisma.inspecaoVisual.findFirst({
        where: { rascunho: false },
        orderBy: { dataInspecao: 'asc' },
        select: { dataInspecao: true },
      }),
      this.prisma.inspecaoLote.findFirst({
        where: { rascunho: false },
        orderBy: { dataInspecao: 'asc' },
        select: { dataInspecao: true },
      }),
      this.prisma.rnc.findFirst({
        where: { status: { not: 'CANCELADA' } },
        orderBy: { dataAbertura: 'asc' },
        select: { dataAbertura: true },
      }),
      this.prisma.avaliacaoFornecedor.findFirst({
        orderBy: [{ ano: 'asc' }, { mes: 'asc' }],
        select: { ano: true, mes: true },
      }),
    ]);
    const candidatas: Comp[] = [
      visual?.dataInspecao,
      lote?.dataInspecao,
      rnc?.dataAbertura,
    ]
      .filter((d): d is Date => !!d)
      .map((d) => competenciaDe(d));
    if (avaliacao) candidatas.push({ ano: avaliacao.ano, mes: avaliacao.mes });
    if (!candidatas.length) return null;
    return candidatas.reduce((menor, c) => (antesDe(c, menor) ? c : menor));
  }

  private async fecharVencidas(atual: Comp) {
    const comDado = await this.primeiraCompetencia();
    if (!comDado) return;
    // Comeca no primeiro mes do TRIMESTRE do dado mais antigo, nao no mes dele.
    // Um trimestre so fecha com os tres meses fechados: se o primeiro dado cai
    // em Agosto, Julho tem que fechar junto (vazio, sem nota) ou o 3T nunca
    // fecharia e a reclassificacao nunca aconteceria. Mes sem recebimento fica
    // de fora da media do trimestre de qualquer forma.
    const primeira: Comp = {
      ano: comDado.ano,
      mes: mesesDoTrimestre(trimestreCalendario(comDado.mes))[0],
    };
    // A competencia corrente ainda esta correndo: vence so no dia 26.
    const ultima = compAnterior(atual);
    if (antesDe(ultima, primeira)) return;

    const comps = compsEntre(primeira, ultima);
    const registros = await this.prisma.avaliacaoFornecedor.findMany({
      where: { OR: comps.map((c) => ({ ano: c.ano, mes: c.mes })) },
      select: { ano: true, mes: true, fechada: true, fechadaEm: true },
    });
    // Competencia que ja passou por um fechamento nao volta sozinha: ou esta
    // fechada, ou foi REABERTA a mao para correcao - e reabrir tem que valer
    // mais do que a rotina, senao a correcao seria desfeita na hora.
    const jaMexidas = new Set(
      registros
        .filter((r) => r.fechada || r.fechadaEm)
        .map((r) => chave(r.ano, r.mes)),
    );

    for (const c of comps) {
      if (jaMexidas.has(chave(c.ano, c.mes))) continue;
      await this.fechar(c.ano, c.mes);
    }
  }

  // Apura C1, C2 e C3 de todos os fornecedores em varias competencias de uma
  // vez. Uma unica passada no banco cobrindo a janela inteira e depois cada
  // registro cai na sua competencia pela regra do dia 26 - o painel precisa de
  // ate 12 meses e nao pode fazer 12 rodadas de consulta.
  private async apurarCompetencias(
    comps: Comp[],
  ): Promise<Map<string, Map<number, Apuracao>>> {
    const janelas = comps.map((c) => competencia(c.ano, c.mes));
    const inicio = new Date(
      Math.min(...janelas.map((j) => j.inicio.getTime())),
    );
    const fim = new Date(Math.max(...janelas.map((j) => j.fim.getTime())));
    const alvo = new Set(comps.map((c) => chave(c.ano, c.mes)));
    // Data fora do recorte pedido devolve null e o registro e ignorado.
    const balde = (d: Date | null): string | null => {
      if (!d) return null;
      const { ano, mes } = competenciaDe(d);
      const k = chave(ano, mes);
      return alvo.has(k) ? k : null;
    };

    const janela = { gte: inicio, lte: fim };
    const [visuais, lotes, rncs] = await Promise.all([
      this.prisma.inspecaoVisual.findMany({
        where: { rascunho: false, dataInspecao: janela },
        select: {
          id: true,
          fornecedorId: true,
          entregaId: true,
          resultado: true,
          dataInspecao: true,
        },
      }),
      this.prisma.inspecaoLote.findMany({
        where: { rascunho: false, dataInspecao: janela },
        select: {
          id: true,
          fornecedorId: true,
          entregaId: true,
          resultado: true,
          dataInspecao: true,
        },
      }),
      this.prisma.rnc.findMany({
        where: { status: { not: 'CANCELADA' }, dataAbertura: janela },
        select: {
          fornecedorId: true,
          dataAbertura: true,
          dataEnvioFornecedor: true,
          dataRetorno: true,
          nivelPlano: true,
        },
      }),
    ]);

    // C1 - a unidade e o RECEBIMENTO, nao o formulario: um recebimento com
    // Visual + Lote conta um lote so e reprova uma vez so.
    const recebimentos = new Map<string, Map<number, Map<string, boolean>>>();
    const somar = (
      k: string,
      fornecedorId: number,
      id: string,
      reprovou: boolean,
    ) => {
      let daComp = recebimentos.get(k);
      if (!daComp) {
        daComp = new Map();
        recebimentos.set(k, daComp);
      }
      let doFornecedor = daComp.get(fornecedorId);
      if (!doFornecedor) {
        doFornecedor = new Map();
        daComp.set(fornecedorId, doFornecedor);
      }
      doFornecedor.set(id, (doFornecedor.get(id) ?? false) || reprovou);
    };
    for (const v of visuais) {
      const k = balde(v.dataInspecao);
      if (!k) continue;
      somar(
        k,
        v.fornecedorId,
        v.entregaId ? `e${v.entregaId}` : `v${v.id}`,
        v.resultado === 'REPROVADO',
      );
    }
    for (const l of lotes) {
      const k = balde(l.dataInspecao);
      if (!k) continue;
      somar(
        k,
        l.fornecedorId,
        l.entregaId ? `e${l.entregaId}` : `l${l.id}`,
        l.resultado === 'REPROVADO',
      );
    }

    // C2 e C3 - uma nota por RNC, depois a media do mes. A RNC que a Qualidade
    // ainda nao enviou ao fornecedor fica de fora dos dois criterios: o relogio
    // nem comecou e nao ha o que cobrar de quem nao foi avisado.
    type AccRnc = { horas: number[]; notasC2: number[]; notasC3: number[] };
    const rncPorComp = new Map<string, Map<number, AccRnc>>();
    for (const r of rncs) {
      if (!r.dataEnvioFornecedor) continue;
      const k = balde(r.dataAbertura);
      if (!k) continue;
      let daComp = rncPorComp.get(k);
      if (!daComp) {
        daComp = new Map();
        rncPorComp.set(k, daComp);
      }
      let acc = daComp.get(r.fornecedorId);
      if (!acc) {
        acc = { horas: [], notasC2: [], notasC3: [] };
        daComp.set(r.fornecedorId, acc);
      }
      if (r.dataRetorno) {
        const h =
          (r.dataRetorno.getTime() - r.dataEnvioFornecedor.getTime()) / 3600000;
        acc.horas.push(Math.max(0, h));
        acc.notasC2.push(notaTempoResposta(Math.max(0, h)));
      } else {
        // Sem resposta ate o fechamento: perde o indicador do mes.
        acc.notasC2.push(0);
      }
      acc.notasC3.push(notaPlanoAcao(r.nivelPlano));
    }

    const resultado = new Map<string, Map<number, Apuracao>>();
    for (const c of comps) {
      const k = chave(c.ano, c.mes);
      const rec = recebimentos.get(k) ?? new Map<number, Map<string, boolean>>();
      const rnc = rncPorComp.get(k) ?? new Map<number, AccRnc>();
      const daComp = new Map<number, Apuracao>();
      const ids = new Set<number>([...rec.keys(), ...rnc.keys()]);
      for (const id of ids) {
        const doFornecedor = rec.get(id);
        const inspecionados = doFornecedor ? doFornecedor.size : 0;
        const reprovados = doFornecedor
          ? [...doFornecedor.values()].filter(Boolean).length
          : 0;
        const pct = inspecionados
          ? pctConformidade(inspecionados, reprovados)
          : 0;

        const acc = rnc.get(id);
        const temRnc = !!acc && acc.notasC2.length > 0;
        // Recebeu no mes e nao gerou RNC - ou gerou e nenhuma chegou a ser
        // enviada: nota maxima automatica nos dois criterios que dependem dela.
        const semRncComRecebimento = !temRnc && inspecionados > 0;

        daComp.set(id, {
          lotesInspecionados: inspecionados,
          lotesReprovados: reprovados,
          pctConformidade: pct,
          notaC1Auto: notaConformidade(inspecionados ? pct : null),
          rncsConsideradas: acc ? acc.notasC2.length : 0,
          horasRespostaMedia: acc && acc.horas.length ? media(acc.horas) : null,
          notaC2Auto: temRnc
            ? media(acc!.notasC2)
            : semRncComRecebimento
              ? 10
              : null,
          notaC3Auto: temRnc
            ? media(acc!.notasC3)
            : semRncComRecebimento
              ? 10
              : null,
        });
      }
      resultado.set(k, daComp);
    }
    return resultado;
  }

  // Le o banco de um recorte de competencias: o que esta gravado e o que a
  // apuracao diz hoje.
  private async lerRecorte(comps: Comp[]) {
    const [gravados, apuracoes] = await Promise.all([
      this.prisma.avaliacaoFornecedor.findMany({
        where: { OR: comps.map((c) => ({ ano: c.ano, mes: c.mes })) },
      }),
      this.apurarCompetencias(comps),
    ]);
    return { gravados, apuracoes };
  }

  // Resolve o IDF de cada fornecedor em cada mes do recorte. Competencia
  // fechada devolve o numero congelado; aberta recalcula na hora e so preserva
  // o que foi digitado a mao. E a mesma regra do `montar`, sem o cadastro.
  private montarQuadro(
    comps: Comp[],
    gravados: any[],
    apuracoes: Map<string, Map<number, Apuracao>>,
  ): Quadro {
    const gravadoPor = new Map<string, any>();
    const mesesFechados = new Set<string>();
    for (const g of gravados) {
      const k = chave(g.ano, g.mes);
      gravadoPor.set(`${k}|${g.fornecedorId}`, g);
      if (g.fechada) mesesFechados.add(k);
    }

    const celulas = new Map<string, Map<number, Celula>>();
    for (const c of comps) {
      const k = chave(c.ano, c.mes);
      const apurado = apuracoes.get(k) ?? new Map<number, Apuracao>();
      const daComp = new Map<number, Celula>();
      const ids = new Set<number>(apurado.keys());
      for (const g of gravados)
        if (g.ano === c.ano && g.mes === c.mes) ids.add(g.fornecedorId);

      for (const id of ids) {
        const g = gravadoPor.get(`${k}|${id}`);
        if (g?.fechada) {
          daComp.set(id, {
            idf: g.idf,
            classificacao: g.classificacao,
            fechada: true,
            lotesInspecionados: g.lotesInspecionados,
            lotesReprovados: g.lotesReprovados,
          });
          continue;
        }
        const a = apurado.get(id) ?? ZERADA;
        const idf = calcularIdf(
          g?.notaC1Manual ?? a.notaC1Auto,
          g?.notaC2Manual ?? a.notaC2Auto,
          g?.notaC3Manual ?? a.notaC3Auto,
        );
        daComp.set(id, {
          idf,
          classificacao: classificarPorIdf(idf),
          fechada: false,
          lotesInspecionados: a.lotesInspecionados,
          lotesReprovados: a.lotesReprovados,
        });
      }
      celulas.set(k, daComp);
    }
    return { celulas, mesesFechados };
  }

  // Media dos meses do trimestre que tem nota. Mes sem recebimento nao zera
  // nada: fica de fora da conta, como na planilha.
  //
  // "Fechado" quer dizer que as tres competencias ja foram congeladas - e esse
  // o momento em que o trimestre manda a classe para o cadastro. Enquanto
  // faltar um mes, o numero existe e aparece, mas marcado como parcial.
  private resumoTrimestre(
    ano: number,
    trimestre: number,
    quadro: Quadro,
    fornecedorId: number,
  ): ResumoTrimestre {
    const comps = compsDoTrimestre(ano, trimestre);
    const notas: number[] = [];
    let lotesInspecionados = 0;
    let lotesReprovados = 0;
    for (const c of comps) {
      const celula = quadro.celulas.get(chave(c.ano, c.mes))?.get(fornecedorId);
      if (!celula) continue;
      lotesInspecionados += celula.lotesInspecionados;
      lotesReprovados += celula.lotesReprovados;
      if (celula.idf !== null) notas.push(celula.idf);
    }
    const idf = media(notas);
    return {
      trimestre,
      ano,
      rotulo: `${trimestre}T/${ano}`,
      idf,
      classificacao: classificarPorIdf(idf),
      mesesApurados: notas.length,
      mesesDoPeriodo: comps.length,
      fechado: comps.every((c) =>
        quadro.mesesFechados.has(chave(c.ano, c.mes)),
      ),
      lotesInspecionados,
      lotesReprovados,
    };
  }

  // Junta a apuracao com o que esta gravado. Competencia fechada devolve o que
  // foi congelado; competencia aberta recalcula o automatico na hora e so
  // preserva o que foi digitado a mao.
  private montar(fornecedor: any, gravado: any, apurado: Apuracao) {
    if (gravado?.fechada) {
      return {
        fornecedorId: fornecedor.id,
        codigo: fornecedor.codigo,
        nome: fornecedor.nome,
        classificacaoFornecimento: fornecedor.classificacaoFornecimento,
        lotesInspecionados: gravado.lotesInspecionados,
        lotesReprovados: gravado.lotesReprovados,
        pctConformidade: gravado.pctConformidade,
        notaC1Auto: gravado.notaC1Auto,
        rncsConsideradas: gravado.rncsConsideradas,
        horasRespostaMedia: gravado.horasRespostaMedia,
        notaC2Auto: gravado.notaC2Auto,
        notaC3Auto: gravado.notaC3Auto,
        notaC1Manual: gravado.notaC1Manual,
        notaC2Manual: gravado.notaC2Manual,
        notaC3Manual: gravado.notaC3Manual,
        justificativa: gravado.justificativa,
        notaC1: gravado.notaC1Manual ?? gravado.notaC1Auto,
        notaC2: gravado.notaC2Manual ?? gravado.notaC2Auto,
        notaC3: gravado.notaC3Manual ?? gravado.notaC3Auto,
        idf: gravado.idf,
        classificacao: gravado.classificacao,
        fechada: true,
        fechadaEm: gravado.fechadaEm,
      };
    }

    const c1 = gravado?.notaC1Manual ?? apurado.notaC1Auto;
    const c2 = gravado?.notaC2Manual ?? apurado.notaC2Auto;
    const c3 = gravado?.notaC3Manual ?? apurado.notaC3Auto;
    const idf = calcularIdf(c1, c2, c3);
    return {
      fornecedorId: fornecedor.id,
      codigo: fornecedor.codigo,
      nome: fornecedor.nome,
      classificacaoFornecimento: fornecedor.classificacaoFornecimento,
      ...apurado,
      notaC1Manual: gravado?.notaC1Manual ?? null,
      notaC2Manual: gravado?.notaC2Manual ?? null,
      notaC3Manual: gravado?.notaC3Manual ?? null,
      justificativa: gravado?.justificativa ?? null,
      notaC1: c1,
      notaC2: c2,
      notaC3: c3,
      idf,
      classificacao: classificarPorIdf(idf),
      fechada: false,
      fechadaEm: null,
    };
  }

  // Avaliacao de todos os fornecedores ativos numa competencia, com o trimestre
  // anterior (o que esta valendo no cadastro) e o trimestre atual (o que vai
  // valer quando ele fechar) ao lado.
  async listar(ano: number, mes: number) {
    await this.sincronizar();
    const { inicio, fim, label } = competencia(ano, mes);
    const atual = { ano, trimestre: trimestreCalendario(mes) };
    const anterior = trimestreAnterior(atual.ano, atual.trimestre);
    const comps = [
      ...compsDoTrimestre(anterior.ano, anterior.trimestre),
      ...compsDoTrimestre(atual.ano, atual.trimestre),
    ];

    const [fornecedores, { gravados, apuracoes }] = await Promise.all([
      this.prisma.fornecedor.findMany({
        where: { ativo: true },
        orderBy: { nome: 'asc' },
        select: {
          id: true,
          codigo: true,
          nome: true,
          classificacaoFornecimento: true,
        },
      }),
      this.lerRecorte(comps),
    ]);
    const quadro = this.montarQuadro(comps, gravados, apuracoes);

    const kMes = chave(ano, mes);
    const apuradoDoMes = apuracoes.get(kMes) ?? new Map<number, Apuracao>();
    const gravadoDoMes = new Map(
      gravados
        .filter((g) => g.ano === ano && g.mes === mes)
        .map((g) => [g.fornecedorId, g]),
    );

    const linhas = fornecedores.map((f) => ({
      ...this.montar(
        f,
        gravadoDoMes.get(f.id),
        apuradoDoMes.get(f.id) ?? ZERADA,
      ),
      trimestreAnterior: this.resumoTrimestre(
        anterior.ano,
        anterior.trimestre,
        quadro,
        f.id,
      ),
      trimestreAtual: this.resumoTrimestre(
        atual.ano,
        atual.trimestre,
        quadro,
        f.id,
      ),
    }));

    const rotuloAnterior = `${anterior.trimestre}T/${anterior.ano}`;
    const rotuloAtual = `${atual.trimestre}T/${atual.ano}`;
    return {
      ano,
      mes,
      label,
      periodoInicio: inicio,
      periodoFim: fim,
      fechada: quadro.mesesFechados.has(kMes),
      atual: this.competenciaAtual().label === label,
      trimestreAnterior: {
        ...anterior,
        rotulo: rotuloAnterior,
        fechado: compsDoTrimestre(anterior.ano, anterior.trimestre).every((c) =>
          quadro.mesesFechados.has(chave(c.ano, c.mes)),
        ),
      },
      trimestreAtual: {
        ...atual,
        rotulo: rotuloAtual,
        fechado: compsDoTrimestre(atual.ano, atual.trimestre).every((c) =>
          quadro.mesesFechados.has(chave(c.ano, c.mes)),
        ),
        // Quais meses do trimestre ja foram congelados: e o que diz quanto
        // falta para a classe do cadastro ser reescrita.
        mesesFechados: mesesDoTrimestre(atual.trimestre).filter((m) =>
          quadro.mesesFechados.has(chave(atual.ano, m)),
        ),
        meses: mesesDoTrimestre(atual.trimestre),
      },
      linhas,
    };
  }

  // Nota digitada a mao. Limpar o campo (null) devolve o criterio ao automatico.
  async salvarNotas(
    fornecedorId: number,
    ano: number,
    mes: number,
    dto: {
      notaC1Manual?: number | null;
      notaC2Manual?: number | null;
      notaC3Manual?: number | null;
      justificativa?: string | null;
    },
    usuarioId?: number,
  ) {
    const existente = await this.prisma.avaliacaoFornecedor.findUnique({
      where: { fornecedorId_ano_mes: { fornecedorId, ano, mes } },
    });
    if (existente?.fechada)
      throw new BadRequestException(
        'Competência já fechada. Reabra antes de alterar as notas.',
      );

    const { inicio, fim } = competencia(ano, mes);
    const dados = {
      notaC1Manual: dto.notaC1Manual ?? null,
      notaC2Manual: dto.notaC2Manual ?? null,
      notaC3Manual: dto.notaC3Manual ?? null,
      justificativa: dto.justificativa?.trim() || null,
      atualizadoPorId: usuarioId ?? null,
    };
    await this.prisma.avaliacaoFornecedor.upsert({
      where: { fornecedorId_ano_mes: { fornecedorId, ano, mes } },
      create: {
        fornecedorId,
        ano,
        mes,
        periodoInicio: inicio,
        periodoFim: fim,
        ...dados,
      },
      update: dados,
    });
    return { ok: true };
  }

  // Fecha a competencia do mes: congela os numeros do periodo e mais nada.
  //
  // Quem manda na classe do fornecedor e o TRIMESTRE, nao o mes: um mes ruim
  // isolado nao pode dobrar a inspecao do recebimento no dia seguinte. Quando
  // este fechamento completa os tres meses do trimestre, o trimestre fecha
  // junto e ai sim a classe apurada vai para o cadastro.
  async fechar(ano: number, mes: number, usuarioId?: number) {
    const atual = this.competenciaAtual();
    if (ano > atual.ano || (ano === atual.ano && mes > atual.mes))
      throw new BadRequestException(
        'Não é possível fechar uma competência futura.',
      );

    const { inicio, fim } = competencia(ano, mes);
    const [fornecedores, gravados, apuracoes] = await Promise.all([
      this.prisma.fornecedor.findMany({ where: { ativo: true } }),
      this.prisma.avaliacaoFornecedor.findMany({ where: { ano, mes } }),
      this.apurarCompetencias([{ ano, mes }]),
    ]);
    const porId = new Map(gravados.map((g) => [g.fornecedorId, g]));
    const apurado = apuracoes.get(chave(ano, mes)) ?? new Map<number, Apuracao>();

    let fechados = 0;
    for (const f of fornecedores) {
      const gravado = porId.get(f.id);
      if (gravado?.fechada) continue;
      const linha = this.montar(f, gravado, apurado.get(f.id) ?? ZERADA);
      const congelado = {
        lotesInspecionados: linha.lotesInspecionados,
        lotesReprovados: linha.lotesReprovados,
        pctConformidade: linha.pctConformidade,
        notaC1Auto: linha.notaC1Auto,
        rncsConsideradas: linha.rncsConsideradas,
        horasRespostaMedia: linha.horasRespostaMedia,
        notaC2Auto: linha.notaC2Auto,
        notaC3Auto: linha.notaC3Auto,
        idf: linha.idf,
        classificacao: linha.classificacao,
        fechada: true,
        fechadaEm: new Date(),
        atualizadoPorId: usuarioId ?? null,
      };
      await this.prisma.avaliacaoFornecedor.upsert({
        where: { fornecedorId_ano_mes: { fornecedorId: f.id, ano, mes } },
        create: {
          fornecedorId: f.id,
          ano,
          mes,
          periodoInicio: inicio,
          periodoFim: fim,
          ...congelado,
        },
        update: congelado,
      });
      fechados++;
    }

    const trimestre = trimestreCalendario(mes);
    const fechamentoTrimestre = await this.fecharTrimestre(ano, trimestre);
    return {
      competencia: `${ano}-${String(mes).padStart(2, '0')}`,
      fechados,
      trimestre: fechamentoTrimestre,
      // Mantido pela tela antiga: sem o trimestre fechado nada foi
      // reclassificado neste momento.
      reclassificados: fechamentoTrimestre?.reclassificados ?? 0,
    };
  }

  // Fecha o trimestre quando o terceiro mes dele fecha: aplica a classe apurada
  // no cadastro do fornecedor (e e ela que passa a comandar a periodicidade de
  // inspecao), registra no historico e zera os contadores do periodo.
  //
  // Devolve null enquanto faltar mes. E idempotente: reabrir um mes, corrigir e
  // fechar de novo reescreve o registro do trimestre em vez de duplicar.
  private async fecharTrimestre(ano: number, trimestre: number) {
    const comps = compsDoTrimestre(ano, trimestre);
    const [fornecedores, { gravados, apuracoes }] = await Promise.all([
      this.prisma.fornecedor.findMany({ where: { ativo: true } }),
      this.lerRecorte(comps),
    ]);
    const quadro = this.montarQuadro(comps, gravados, apuracoes);
    if (!comps.every((c) => quadro.mesesFechados.has(chave(c.ano, c.mes))))
      return null;

    const rotulo = `${trimestre}T/${ano}`;
    const periodoInicio = competencia(ano, comps[0].mes).inicio;
    const periodoFim = competencia(ano, comps[2].mes).fim;
    await this.prisma.historicoClassificacao.deleteMany({
      where: { trimestreFiscal: rotulo },
    });

    let avaliados = 0;
    let reclassificados = 0;
    for (const f of fornecedores) {
      const r = this.resumoTrimestre(ano, trimestre, quadro, f.id);
      // Sem IDF no trimestre a classe fica como esta: o fornecedor nao foi
      // avaliado e nao ha o que aplicar.
      if (r.idf === null || !r.classificacao) continue;
      avaliados++;

      await this.prisma.historicoClassificacao.create({
        data: {
          fornecedorId: f.id,
          trimestreFiscal: rotulo,
          periodoInicio,
          periodoFim,
          classificacaoInicial: f.classificacaoFornecimento,
          lotesInspecionados: r.lotesInspecionados,
          lotesReprovados: r.lotesReprovados,
          pctConformidade: r.lotesInspecionados
            ? pctConformidade(r.lotesInspecionados, r.lotesReprovados)
            : 0,
          classificacaoApurada: r.classificacao,
        },
      });
      if (r.classificacao !== f.classificacaoFornecimento) reclassificados++;

      await this.prisma.fornecedor.update({
        where: { id: f.id },
        data: {
          classificacaoFornecimento: r.classificacao,
          lotesInspecionados: 0,
          lotesReprovados: 0,
        },
      });
    }
    return { rotulo, ano, trimestre, avaliados, reclassificados };
  }

  // Reabre a competencia para corrigir. O trimestre volta a ser parcial (ele so
  // e fechado quando os tres meses estao), mas a classe ja aplicada no cadastro
  // nao e revertida: quem corrige a nota fecha de novo e ela se atualiza.
  //
  // `fechadaEm` e mantido de proposito: e a marca de que esta competencia ja
  // passou por um fechamento. Sem ela o fechamento automatico tornaria a fechar
  // a competencia na consulta seguinte e a correcao nunca aconteceria.
  async reabrir(ano: number, mes: number) {
    const { count } = await this.prisma.avaliacaoFornecedor.updateMany({
      where: { ano, mes, fechada: true },
      data: { fechada: false },
    });
    if (!count)
      throw new BadRequestException('Esta competência não está fechada.');
    return { reabertas: count, trimestre: `${trimestreCalendario(mes)}T/${ano}` };
  }

  // Consolidado do ano: os 12 meses, os 4 trimestres calendario e o anual.
  //
  // Tudo calculado ao vivo, como na tabela mensal - mes ainda em aberto aparece
  // marcado como parcial em vez de sumir. O anual vem em dois numeros: o
  // CONSOLIDADO so com os trimestres ja fechados (o que esta valendo) e o
  // PROJETADO somando tambem o trimestre em curso (como esta ficando).
  async consolidado(ano: number) {
    await this.sincronizar();
    const comps: Comp[] = Array.from({ length: 12 }, (_, i) => ({
      ano,
      mes: i + 1,
    }));
    const [fornecedores, { gravados, apuracoes }] = await Promise.all([
      this.prisma.fornecedor.findMany({
        where: { ativo: true },
        orderBy: { nome: 'asc' },
        select: { id: true, codigo: true, nome: true },
      }),
      this.lerRecorte(comps),
    ]);
    const quadro = this.montarQuadro(comps, gravados, apuracoes);
    const mesesFechados = comps.map((c) =>
      quadro.mesesFechados.has(chave(c.ano, c.mes)),
    );

    const linhas = fornecedores.map((f) => {
      const celulas = comps.map(
        (c) => quadro.celulas.get(chave(c.ano, c.mes))?.get(f.id) ?? null,
      );
      const resumos = [1, 2, 3, 4].map((t) =>
        this.resumoTrimestre(ano, t, quadro, f.id),
      );
      const comNota = resumos.filter((r) => r.idf !== null);
      const anualConsolidado = media(
        comNota.filter((r) => r.fechado).map((r) => r.idf as number),
      );
      const anualProjetado = media(comNota.map((r) => r.idf as number));
      return {
        fornecedorId: f.id,
        codigo: f.codigo,
        nome: f.nome,
        meses: celulas.map((c) => c?.idf ?? null),
        classesMes: celulas.map((c) => c?.classificacao ?? null),
        trimestres: resumos.map((r) => r.idf),
        classesTrimestre: resumos.map((r) => r.classificacao),
        trimestresFechados: resumos.map((r) => r.fechado),
        trimestresApurados: resumos.map((r) => r.mesesApurados),
        anualConsolidado,
        classeAnualConsolidado: classificarPorIdf(anualConsolidado),
        anualProjetado,
        classeAnualProjetado: classificarPorIdf(anualProjetado),
        // Mantido com o nome antigo para nao quebrar quem ja lia o consolidado.
        anual: anualProjetado,
        classificacaoAnual: classificarPorIdf(anualProjetado),
      };
    });

    const comNota = linhas.filter((l) => l.anualProjetado !== null);
    // O ano fecha quando os 12 meses fecham - nao ha o que apertar. Dali em
    // diante o consolidado e o projetado sao o mesmo numero e o resultado do
    // ano esta congelado, porque todo mes que o compoe esta congelado.
    const anoFechado = mesesFechados.every(Boolean);
    return {
      ano,
      mesesFechados,
      anoFechado,
      linhas,
      resumo: {
        avaliados: comNota.length,
        mediaGeral: media(comNota.map((l) => l.anualProjetado as number)),
        porClasse: {
          A: comNota.filter((l) => l.classeAnualProjetado === 'A').length,
          B: comNota.filter((l) => l.classeAnualProjetado === 'B').length,
          C: comNota.filter((l) => l.classeAnualProjetado === 'C').length,
          D: comNota.filter((l) => l.classeAnualProjetado === 'D').length,
        },
      },
    };
  }

  // Ficha de um fornecedor: todas as competencias fechadas, da mais nova para
  // a mais antiga.
  async historico(fornecedorId: number) {
    const registros = await this.prisma.avaliacaoFornecedor.findMany({
      where: { fornecedorId, fechada: true },
      orderBy: [{ ano: 'desc' }, { mes: 'desc' }],
    });
    return registros.map((r) => ({
      ...r,
      notaC1: r.notaC1Manual ?? r.notaC1Auto,
      notaC2: r.notaC2Manual ?? r.notaC2Auto,
      notaC3: r.notaC3Manual ?? r.notaC3Auto,
      pctConformidade: arredondar(r.pctConformidade, 1),
    }));
  }
}
