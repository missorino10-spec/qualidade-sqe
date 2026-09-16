import { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import { LockOutlined, UnlockOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, queryDeFiltro } from '../api';
import Tabela from '../components/Tabela';
import {
  LegendaIdf,
  NotaIdf,
  NotaIdfCompacta,
} from '../components/NotaIdf';
import { CabecalhoPagina } from '../design/painel';
import { BotaoEditar, ExportarLista } from '../design/acoes';
import { COR, ESPACO, TEXTO } from '../design/tokens';
import { dataBR, numeroBR } from '../formatos';
import { ACAO_CLASSE } from '../fornecedor';
import { useAuth } from '../auth';

const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

// Media das notas que existem. Periodo sem nota nao entra na conta - a mesma
// regra do backend, para o cartao do topo bater com a coluna da tabela.
function mediaIdf(valores: (number | null | undefined)[]): number | null {
  const notas = valores.filter(
    (v): v is number => v !== null && v !== undefined,
  );
  if (!notas.length) return null;
  return notas.reduce((s, v) => s + v, 0) / notas.length;
}

// "2 de 3 meses apurados" — o que o tooltip do trimestre precisa dizer para o
// numero parcial nao parecer errado.
function detalheTrimestre(t: any): string | undefined {
  if (!t) return undefined;
  const meses = `${t.mesesApurados} de ${t.mesesDoPeriodo} meses apurados`;
  return t.fechado ? `${t.rotulo} fechado · ${meses}` : `${t.rotulo} · ${meses}`;
}

// Nota de criterio: mostra a efetiva e avisa quando ela veio digitada a mao.
function Nota({ auto, manual }: { auto: number | null; manual: number | null }) {
  if (manual !== null && manual !== undefined)
    return (
      <Tooltip title={`Nota manual. Cálculo automático: ${auto === null ? 'sem dado' : numeroBR(auto, 2)}`}>
        <Tag color="gold" style={{ fontWeight: 600 }}>
          {numeroBR(manual, 2)}
        </Tag>
      </Tooltip>
    );
  if (auto === null || auto === undefined)
    return <Typography.Text type="secondary">—</Typography.Text>;
  return <span style={{ fontWeight: 600 }}>{numeroBR(auto, 2)}</span>;
}

export default function AvaliacaoFornecedores() {
  const qc = useQueryClient();
  const { usuario } = useAuth();
  const podeFechar =
    usuario?.papel === 'ADMIN' || usuario?.papel === 'QUALIDADE';

  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [editando, setEditando] = useState<any | null>(null);
  // Fornecedor cujo historico esta aberto. A tela mostra uma competencia por
  // vez; aqui e a trajetoria dele, ano a ano.
  const [historicoDe, setHistoricoDe] = useState<any | null>(null);
  const [form] = Form.useForm();

  const { data, isLoading } = useQuery<any>({
    queryKey: ['avaliacao-fornecedores', ano, mes],
    queryFn: async () =>
      (await api.get('/avaliacao-fornecedores', { params: { ano, mes } })).data,
  });

  const { data: consolidado } = useQuery<any>({
    queryKey: ['avaliacao-consolidado', ano],
    queryFn: async () =>
      (await api.get('/avaliacao-fornecedores/consolidado', { params: { ano } }))
        .data,
  });

  // Historico do fornecedor: so competencias FECHADAS, de todos os anos. E a
  // unica leitura do sistema que atravessa o ano - o consolidado para em 31/12.
  const { data: historico, isFetching: carregandoHistorico } = useQuery<any[]>({
    queryKey: ['avaliacao-historico', historicoDe?.fornecedorId],
    enabled: !!historicoDe,
    queryFn: async () =>
      (
        await api.get(
          `/avaliacao-fornecedores/fornecedor/${historicoDe.fornecedorId}`,
        )
      ).data,
  });

  function recarregar() {
    qc.invalidateQueries({ queryKey: ['avaliacao-fornecedores'] });
    qc.invalidateQueries({ queryKey: ['avaliacao-consolidado'] });
    qc.invalidateQueries({ queryKey: ['evolucao-fornecedores'] });
    qc.invalidateQueries({ queryKey: ['fornecedores'] });
  }

  const salvar = useMutation({
    mutationFn: async (v: any) =>
      api.put(`/avaliacao-fornecedores/${editando.fornecedorId}/${ano}/${mes}`, {
        notaC1Manual: v.notaC1Manual ?? null,
        notaC2Manual: v.notaC2Manual ?? null,
        notaC3Manual: v.notaC3Manual ?? null,
        justificativa: v.justificativa ?? null,
      }),
    onSuccess: () => {
      message.success('Notas atualizadas.');
      recarregar();
      setEditando(null);
      form.resetFields();
    },
    onError: (e: any) =>
      message.error(
        e?.response?.data?.message ?? 'Não foi possível salvar as notas.',
      ),
  });

  const fechar = useMutation({
    mutationFn: async () =>
      (await api.post('/avaliacao-fornecedores/fechar', { ano, mes })).data,
    onSuccess: (res: any) => {
      // Quem reclassifica o cadastro e o TRIMESTRE. O mes so congela: so ha o
      // que anunciar de mudanca de classe quando o terceiro mes fecha junto.
      message.success(
        res.trimestre
          ? `Competência ${res.competencia} fechada e trimestre ${res.trimestre.rotulo} concluído. ${res.trimestre.avaliados} fornecedor(es) avaliado(s), ${res.trimestre.reclassificados} com mudança de classe no cadastro.`
          : `Competência ${res.competencia} fechada — ${res.fechados} fornecedor(es). A classe do cadastro só muda quando o trimestre inteiro fechar.`,
        6,
      );
      recarregar();
    },
    onError: (e: any) =>
      message.error(
        e?.response?.data?.message ?? 'Não foi possível fechar a competência.',
      ),
  });

  const reabrir = useMutation({
    mutationFn: async () =>
      (await api.post('/avaliacao-fornecedores/reabrir', { ano, mes })).data,
    onSuccess: () => {
      message.success('Competência reaberta.');
      recarregar();
    },
    onError: (e: any) =>
      message.error(
        e?.response?.data?.message ?? 'Não foi possível reabrir a competência.',
      ),
  });

  function abrirEdicao(linha: any) {
    setEditando(linha);
    form.setFieldsValue({
      notaC1Manual: linha.notaC1Manual,
      notaC2Manual: linha.notaC2Manual,
      notaC3Manual: linha.notaC3Manual,
      justificativa: linha.justificativa,
    });
  }

  const linhas: any[] = data?.linhas ?? [];
  const avaliados = linhas.filter((l) => l.idf !== null);
  const resumo = consolidado?.resumo;

  // O trimestre e o periodo que manda: o anterior e o que esta valendo no
  // cadastro de cada fornecedor, o atual e o que vai valer quando fechar.
  const tAnterior = data?.trimestreAnterior;
  const tAtual = data?.trimestreAtual;
  const rotAnterior = tAnterior?.rotulo ?? 'Trimestre anterior';
  const rotAtual = tAtual?.rotulo ?? 'Trimestre atual';
  const mediaAnterior = mediaIdf(linhas.map((l) => l.trimestreAnterior?.idf));
  const mediaAtual = mediaIdf(linhas.map((l) => l.trimestreAtual?.idf));
  const variacao =
    mediaAnterior !== null && mediaAtual !== null
      ? mediaAtual - mediaAnterior
      : null;
  const faltamFechar = tAtual
    ? tAtual.meses.filter((m: number) => !tAtual.mesesFechados.includes(m))
    : [];
  // O ano fecha junto com o 12o mes: nao existe botao, e consequencia.
  const anoFechado = !!consolidado?.anoFechado;

  return (
    <Space direction="vertical" size={ESPACO.lg} style={{ width: '100%' }}>
      <CabecalhoPagina
        titulo="Avaliação de fornecedores — IDF"
        descricao="IDF = Conformidade (50%) + Resposta à RNC (30%) + Plano de ação (20%). A apuração é mensal, mas quem define a classe do fornecedor — e com ela a periodicidade de inspeção — é o TRIMESTRE. O fechamento é automático: passado o dia 26, o mês fecha sozinho; o terceiro mês fecha o trimestre e reclassifica, e o quarto trimestre conclui o ano."
        acoes={
          <Space wrap>
            <Select
              value={mes}
              onChange={setMes}
              style={{ width: 140 }}
              options={MESES.map((m, i) => ({ value: i + 1, label: m }))}
            />
            <Select
              value={ano}
              onChange={setAno}
              style={{ width: 100 }}
              options={[0, 1, 2, 3].map((d) => ({
                value: hoje.getFullYear() - d,
                label: String(hoje.getFullYear() - d),
              }))}
            />
            {podeFechar &&
              (data?.fechada ? (
                <Button
                  icon={<UnlockOutlined />}
                  loading={reabrir.isPending}
                  onClick={() =>
                    Modal.confirm({
                      title: 'Reabrir competência',
                      content: `As notas voltam a ser recalculadas a partir dos dados atuais das inspeções e das RNCs, e o trimestre ${rotAtual} volta a ficar parcial. A competência fica aberta até você fechá-la de novo — o fechamento automático não desfaz a reabertura. A classe já aplicada nos fornecedores não é revertida: ela se atualiza quando o trimestre fechar de novo. Deseja continuar?`,
                      okText: 'Reabrir',
                      cancelText: 'Cancelar',
                      onOk: () => reabrir.mutate(),
                    })
                  }
                >
                  Reabrir competência
                </Button>
              ) : (
                <Button
                  type="primary"
                  icon={<LockOutlined />}
                  loading={fechar.isPending}
                  onClick={() =>
                    Modal.confirm({
                      title: `Antecipar o fechamento de ${MESES[mes - 1]}/${ano}`,
                      content:
                        faltamFechar.length > 1
                          ? `Esta competência fecharia sozinha depois do dia 26. Fechar agora congela as notas de ${MESES[mes - 1]} antes disso. A classe dos fornecedores NÃO muda: ela é reescrita quando o trimestre ${rotAtual} fechar (${faltamFechar.map((m: number) => MESES[m - 1]).join(', ')} ainda em aberto). Deseja continuar?`
                          : `Esta competência fecharia sozinha depois do dia 26. Fechar agora congela as notas de ${MESES[mes - 1]} e conclui o trimestre ${rotAtual}: a classe apurada passa a valer no cadastro de cada fornecedor — o que muda a periodicidade de inspeção no recebimento. Deseja continuar?`,
                      okText: 'Fechar agora',
                      cancelText: 'Cancelar',
                      onOk: () => fechar.mutate(),
                    })
                  }
                >
                  Fechar agora
                </Button>
              ))}
          </Space>
        }
      />

      <Alert
        type={data?.fechada ? 'success' : 'info'}
        showIcon
        message={
          data?.fechada
            ? `Competência ${MESES[mes - 1]}/${ano} fechada — números congelados`
            : `Competência ${MESES[mes - 1]}/${ano} em aberto — números recalculados a cada consulta`
        }
        description={
          data
            ? `Período de apuração: ${new Date(data.periodoInicio).toLocaleDateString('pt-BR')} a ${new Date(data.periodoFim).toLocaleDateString('pt-BR')}. A competência fecha no dia 26 e, passada essa data, é fechada automaticamente — RNC aberta até o dia 26 conta neste mês, do dia 27 em diante cai no mês seguinte. O tempo de resposta é contado do envio da RNC ao fornecedor até o retorno dele — RNC ainda não enviada fica de fora do C2 e do C3.`
            : undefined
        }
      />

      {/* Onde o trimestre esta. E a informacao que responde "quando isso vai
          virar classificação no cadastro?" — sem ela, o número parcial da
          tabela nao tem contexto. */}
      {tAtual && (
        <Alert
          type={tAtual.fechado ? 'success' : 'warning'}
          showIcon
          message={
            tAtual.fechado
              ? `Trimestre ${rotAtual} concluído — a classe apurada já está aplicada no cadastro dos fornecedores`
              : `Trimestre ${rotAtual} em curso — ${tAtual.mesesFechados.length} de 3 meses fechados`
          }
          description={
            tAtual.fechado
              ? `Quem está valendo hoje na periodicidade de inspeção é a classe de ${rotAtual}. Ela só muda quando o próximo trimestre fechar.`
              : `A classe que está valendo hoje no cadastro é a de ${rotAnterior}. Ela será reescrita sozinha quando ${faltamFechar
                  .map((m: number) => MESES[m - 1])
                  .join(', ')} ${faltamFechar.length > 1 ? 'fecharem' : 'fechar'} — cada mês fecha após o dia 26 e é o fechamento do trimestre que reclassifica, não o do mês.`
          }
        />
      )}

      <Row gutter={[ESPACO.lg, ESPACO.lg]}>
        <Col flex="1 1 180px">
          <Card size="small">
            <Statistic
              title="Fornecedores avaliados"
              value={avaliados.length}
              suffix={`/ ${linhas.length}`}
              valueStyle={{ color: TEXTO.forte }}
            />
          </Card>
        </Col>
        <Col flex="1 1 180px">
          <Card size="small">
            <Statistic
              title={`IDF médio — ${MESES[mes - 1]}`}
              value={mediaIdf(avaliados.map((l) => l.idf)) ?? 0}
              precision={2}
              decimalSeparator=","
              valueStyle={{ color: TEXTO.forte }}
            />
          </Card>
        </Col>
        {/* Como estava x como está: o cartao que o usuario pediu para
            enxergar o desempenho do trimestre enquanto ele corre. */}
        <Col flex="1 1 220px">
          <Card size="small">
            <Statistic
              title={`IDF médio — ${rotAtual}${tAtual?.fechado ? '' : ' (parcial)'}`}
              value={mediaAtual ?? 0}
              precision={2}
              decimalSeparator=","
              valueStyle={{
                color:
                  variacao === null
                    ? TEXTO.forte
                    : variacao >= 0
                      ? COR.sucesso
                      : COR.critico,
              }}
              suffix={
                variacao === null ? undefined : (
                  <Typography.Text
                    style={{ fontSize: 13 }}
                    type="secondary"
                  >
                    {variacao >= 0 ? '▲' : '▼'} {numeroBR(Math.abs(variacao), 2)}{' '}
                    vs {rotAnterior}
                  </Typography.Text>
                )
              }
            />
          </Card>
        </Col>
        <Col flex="1 1 150px">
          <Card size="small">
            <Statistic
              title={`Em atenção (C) — ${MESES[mes - 1]}`}
              value={avaliados.filter((l) => l.classificacao === 'C').length}
              valueStyle={{ color: COR.atencao }}
            />
          </Card>
        </Col>
        <Col flex="1 1 150px">
          <Card size="small">
            <Statistic
              title={`Críticos (D) — ${MESES[mes - 1]}`}
              value={avaliados.filter((l) => l.classificacao === 'D').length}
              valueStyle={{ color: COR.critico }}
            />
          </Card>
        </Col>
      </Row>

      {/* O recorte desta tela nao e um intervalo de datas: e a competencia
          escolhida no cabeçalho. A exportacao recebe o mesmo ano e mes e sai
          com a apuracao que esta na tabela abaixo. */}
      <Card
        title={`Apuração de ${MESES[mes - 1]} de ${ano}`}
        extra={
          <ExportarLista
            url={`/avaliacao-fornecedores/relatorio${queryDeFiltro({ ano, mes })}`}
            nome={`idf-${ano}-${String(mes).padStart(2, '0')}`}
          />
        }
      >
        <Tabela
          busca="Buscar fornecedor"
          rowKey="fornecedorId"
          size="small"
          loading={isLoading}
          dataSource={linhas}
          pagination={false}
          scroll={{ x: 'max-content' }}
          columns={[
            { title: 'Código', dataIndex: 'codigo', width: 100 },
            {
              // O nome abre a trajetoria do fornecedor. A tabela mostra uma
              // competencia; quem decide se o fornecedor melhorou ou piorou
              // precisa ver a sequencia.
              title: 'Fornecedor',
              dataIndex: 'nome',
              render: (v: string, r: any) => (
                <Button
                  type="link"
                  style={{ padding: 0, height: 'auto', textAlign: 'left' }}
                  onClick={() => setHistoricoDe(r)}
                >
                  {v}
                </Button>
              ),
            },
            {
              title: 'Lotes insp.',
              dataIndex: 'lotesInspecionados',
              width: 100,
              align: 'center',
            },
            {
              title: 'Reprov.',
              dataIndex: 'lotesReprovados',
              width: 90,
              align: 'center',
            },
            {
              title: 'Conformidade',
              dataIndex: 'pctConformidade',
              width: 120,
              align: 'center',
              render: (v: number, r: any) =>
                r.lotesInspecionados ? `${numeroBR(v, 1)}%` : '—',
            },
            {
              title: 'C1 (50%)',
              width: 95,
              align: 'center',
              render: (_: any, r: any) => (
                <Nota auto={r.notaC1Auto} manual={r.notaC1Manual} />
              ),
            },
            {
              title: 'RNCs',
              dataIndex: 'rncsConsideradas',
              width: 80,
              align: 'center',
            },
            {
              title: 'Resposta (do envio)',
              dataIndex: 'horasRespostaMedia',
              width: 150,
              align: 'center',
              render: (v: number | null) =>
                v === null || v === undefined ? '—' : `${numeroBR(v, 1)} h`,
            },
            {
              title: 'C2 (30%)',
              width: 95,
              align: 'center',
              render: (_: any, r: any) => (
                <Nota auto={r.notaC2Auto} manual={r.notaC2Manual} />
              ),
            },
            {
              title: 'C3 (20%)',
              width: 95,
              align: 'center',
              render: (_: any, r: any) => (
                <Nota auto={r.notaC3Auto} manual={r.notaC3Manual} />
              ),
            },
            {
              // O numero e a letra andam juntos: a coluna "Classificação"
              // separada foi absorvida aqui.
              title: `IDF — ${MESES[mes - 1]}`,
              dataIndex: 'idf',
              width: 120,
              align: 'center',
              render: (v: number | null, r: any) => (
                <NotaIdf
                  valor={v}
                  classe={r.classificacao}
                  tamanho="lg"
                  vazio="Sem avaliação"
                  detalhe={
                    v === null
                      ? 'Sem recebimento na competência — fica de fora da média do trimestre.'
                      : undefined
                  }
                />
              ),
            },
            {
              // O que esta valendo AGORA no cadastro do fornecedor.
              title: rotAnterior,
              width: 120,
              align: 'center',
              render: (_: any, r: any) => (
                <NotaIdf
                  valor={r.trimestreAnterior?.idf}
                  classe={r.trimestreAnterior?.classificacao}
                  parcial={!r.trimestreAnterior?.fechado}
                  detalhe={detalheTrimestre(r.trimestreAnterior)}
                />
              ),
            },
            {
              // O que VAI valer quando o trimestre fechar.
              title: `${rotAtual}${tAtual?.fechado ? '' : ' (parcial)'}`,
              width: 130,
              align: 'center',
              render: (_: any, r: any) => (
                <NotaIdf
                  valor={r.trimestreAtual?.idf}
                  classe={r.trimestreAtual?.classificacao}
                  tamanho="lg"
                  parcial={!r.trimestreAtual?.fechado}
                  detalhe={detalheTrimestre(r.trimestreAtual)}
                />
              ),
            },
            {
              // A acao segue o trimestre em curso, que e o periodo que comanda.
              title: 'Ação',
              width: 250,
              render: (_: any, r: any) =>
                r.trimestreAtual?.classificacao ? (
                  <Typography.Text style={{ fontSize: 12 }} type="secondary">
                    {ACAO_CLASSE[r.trimestreAtual.classificacao]}
                  </Typography.Text>
                ) : null,
            },
            {
              title: 'Notas',
              width: 80,
              align: 'center',
              render: (_: any, r: any) => (
                <BotaoEditar
                  emTabela
                  onClick={() => abrirEdicao(r)}
                  disabled={!podeFechar || r.fechada}
                  motivo={
                    r.fechada
                      ? 'Competência fechada. Reabra para alterar.'
                      : 'Somente Qualidade ou Administrador.'
                  }
                />
              ),
            },
          ]}
        />
        <div style={{ marginTop: ESPACO.md }}>
          <LegendaIdf />
        </div>
      </Card>

      <Card
        title={
          <Space size={8}>
            {`Consolidado de ${ano} — trimestres calendário e anual`}
            {anoFechado ? (
              <Tag color="green">Ano fechado</Tag>
            ) : (
              <Tag>Ano em curso</Tag>
            )}
          </Space>
        }
        extra={
          <Space wrap>
            {resumo && (
              <Typography.Text type="secondary">
                {resumo.avaliados} avaliado(s) · média geral{' '}
                {numeroBR(resumo.mediaGeral ?? 0, 2)} · A {resumo.porClasse.A} ·
                B {resumo.porClasse.B} · C {resumo.porClasse.C} · D{' '}
                {resumo.porClasse.D}
              </Typography.Text>
            )}
            <ExportarLista
              url={`/avaliacao-fornecedores/consolidado/relatorio?ano=${ano}`}
              nome={`idf-consolidado-${ano}`}
            />
          </Space>
        }
      >
        <Tabela
          busca="Buscar fornecedor"
          rowKey="fornecedorId"
          size="small"
          dataSource={consolidado?.linhas ?? []}
          pagination={false}
          scroll={{ x: 'max-content' }}
          columns={[
            { title: 'Código', dataIndex: 'codigo', width: 100, fixed: 'left' },
            { title: 'Fornecedor', dataIndex: 'nome', fixed: 'left' },
            // Os 12 meses: numero com a inicial da classe do lado. Com 12
            // colunas seguidas, etiqueta cheia viraria parede de cor.
            ...MESES.map((m, i) => ({
              title: m.slice(0, 3),
              width: 78,
              align: 'center' as const,
              render: (_: any, r: any) => (
                <NotaIdfCompacta
                  valor={r.meses[i]}
                  classe={r.classesMes?.[i]}
                  parcial={!consolidado?.mesesFechados?.[i]}
                  detalhe={`${m} de ${ano}`}
                />
              ),
            })),
            ...[1, 2, 3, 4].map((t) => ({
              title: `${t}T`,
              width: 110,
              align: 'center' as const,
              render: (_: any, r: any) => (
                <NotaIdf
                  valor={r.trimestres[t - 1]}
                  classe={r.classesTrimestre[t - 1]}
                  parcial={!r.trimestresFechados?.[t - 1]}
                  vazio="—"
                  detalhe={
                    r.trimestresFechados?.[t - 1]
                      ? `${t}T/${ano} fechado`
                      : `${t}T/${ano} · ${r.trimestresApurados?.[t - 1] ?? 0} de 3 meses apurados`
                  }
                />
              ),
            })),
            {
              // O que esta valendo: so os trimestres ja fechados.
              title: 'Anual consolidado',
              width: 140,
              align: 'center',
              render: (_: any, r: any) => (
                <NotaIdf
                  valor={r.anualConsolidado}
                  classe={r.classeAnualConsolidado}
                  tamanho="lg"
                  vazio="Sem trimestre fechado"
                  detalhe="Média dos trimestres já fechados — é o desempenho oficial do ano até aqui."
                />
              ),
            },
            {
              // Como ficaria somando o trimestre que ainda corre.
              title: 'Anual projetado',
              width: 140,
              align: 'center',
              render: (_: any, r: any) => (
                <NotaIdf
                  valor={r.anualProjetado}
                  classe={r.classeAnualProjetado}
                  tamanho="lg"
                  parcial={!anoFechado}
                  detalhe={
                    anoFechado
                      ? 'Ano fechado: igual ao consolidado, já não há trimestre em curso.'
                      : 'Média de todos os trimestres com nota, inclusive o que ainda está em curso.'
                  }
                />
              ),
            },
          ]}
        />
        <div style={{ marginTop: ESPACO.md }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Número em <i>itálico</i> e mais claro = período ainda em aberto,
            recalculado a cada consulta. <b>Anual consolidado</b> considera só os
            trimestres fechados; <b>Anual projetado</b> soma também o trimestre
            em curso.{' '}
            {anoFechado
              ? 'Os 12 meses estão fechados: o resultado deste ano está congelado e os dois números coincidem.'
              : 'O ano fecha sozinho quando o 12º mês fechar — a partir daí os dois números coincidem.'}
          </Typography.Text>
        </div>
      </Card>

      <Modal
        title={`Notas manuais — ${editando?.nome ?? ''}`}
        open={!!editando}
        onCancel={() => setEditando(null)}
        onOk={() => form.submit()}
        confirmLoading={salvar.isPending}
        okText="Salvar"
        cancelText="Cancelar"
      >
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: ESPACO.lg }}
          message="A nota manual substitui o cálculo automático"
          description="Use apenas quando houver critério externo que o sistema não enxerga. Deixe o campo vazio para o critério voltar a ser calculado pelos dados das inspeções e das RNCs."
        />
        <Form
          form={form}
          layout="vertical"
          onFinish={(v) => salvar.mutate(v)}
        >
          <Form.Item
            name="notaC1Manual"
            label={`C1 — Conformidade (automático: ${editando?.notaC1Auto === null || editando?.notaC1Auto === undefined ? 'sem dado' : numeroBR(editando?.notaC1Auto, 2)})`}
          >
            <InputNumber style={{ width: '100%' }} min={0} max={10} step={1} />
          </Form.Item>
          <Form.Item
            name="notaC2Manual"
            label={`C2 — Resposta à RNC (automático: ${editando?.notaC2Auto === null || editando?.notaC2Auto === undefined ? 'sem dado' : numeroBR(editando?.notaC2Auto, 2)})`}
          >
            <InputNumber style={{ width: '100%' }} min={0} max={10} step={1} />
          </Form.Item>
          <Form.Item
            name="notaC3Manual"
            label={`C3 — Plano de ação (automático: ${editando?.notaC3Auto === null || editando?.notaC3Auto === undefined ? 'sem dado' : numeroBR(editando?.notaC3Auto, 2)})`}
          >
            <InputNumber style={{ width: '100%' }} min={0} max={10} step={1} />
          </Form.Item>
          <Form.Item name="justificativa" label="Justificativa">
            <Input.TextArea
              rows={3}
              placeholder="Por que a nota foi digitada a mão"
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Trajetoria do fornecedor. O consolidado ao lado mostra 12 meses de UM
          ano e so o numero; aqui vem todo o historico fechado, com C1/C2/C3 ao
          lado - que e o que responde "piorou por que?". */}
      <Modal
        title={`Histórico do IDF — ${historicoDe?.nome ?? ''}`}
        open={!!historicoDe}
        onCancel={() => setHistoricoDe(null)}
        footer={null}
        width={980}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: ESPACO.lg }}
          // Enquanto carrega nao se afirma nada: "nenhuma competencia" antes da
          // resposta chegar seria mentira, e a media vazia nao pode sair como
          // 0,00 - zero e nota valida, e a pior de todas.
          message={
            carregandoHistorico || !historico
              ? 'Buscando o histórico…'
              : historico.length
                ? `${historico.length} competência(s) fechada(s) · IDF médio ${
                    mediaIdf(historico.map((h) => h.idf)) === null
                      ? 'sem nota no período'
                      : numeroBR(mediaIdf(historico.map((h) => h.idf)), 2)
                  }`
                : 'Nenhuma competência fechada ainda'
          }
          description="Só entram competências já fechadas — são os números congelados, os mesmos que valeram para classificar o fornecedor. O mês em aberto não aparece aqui porque ainda muda a cada consulta."
        />
        <Tabela
          rowKey="id"
          size="small"
          loading={carregandoHistorico}
          dataSource={historico ?? []}
          pagination={false}
          scroll={{ x: 'max-content', y: 420 }}
          columns={[
            {
              title: 'Competência',
              width: 130,
              render: (_: any, r: any) => `${MESES[r.mes - 1]}/${r.ano}`,
            },
            {
              title: 'Lotes insp.',
              dataIndex: 'lotesInspecionados',
              width: 100,
              align: 'center',
            },
            {
              title: 'Reprov.',
              dataIndex: 'lotesReprovados',
              width: 90,
              align: 'center',
            },
            {
              title: 'Conformidade',
              dataIndex: 'pctConformidade',
              width: 120,
              align: 'center',
              render: (v: number, r: any) =>
                r.lotesInspecionados ? `${numeroBR(v, 1)}%` : '—',
            },
            {
              title: 'C1 (50%)',
              width: 95,
              align: 'center',
              render: (_: any, r: any) => (
                <Nota auto={r.notaC1Auto} manual={r.notaC1Manual} />
              ),
            },
            {
              title: 'C2 (30%)',
              width: 95,
              align: 'center',
              render: (_: any, r: any) => (
                <Nota auto={r.notaC2Auto} manual={r.notaC2Manual} />
              ),
            },
            {
              title: 'C3 (20%)',
              width: 95,
              align: 'center',
              render: (_: any, r: any) => (
                <Nota auto={r.notaC3Auto} manual={r.notaC3Manual} />
              ),
            },
            {
              title: 'IDF',
              dataIndex: 'idf',
              width: 110,
              align: 'center',
              render: (v: number | null, r: any) => (
                <NotaIdf valor={v} classe={r.classificacao} tamanho="lg" />
              ),
            },
            {
              title: 'Fechada em',
              dataIndex: 'fechadaEm',
              width: 110,
              render: (v: string | null) => (v ? dataBR(v) : '—'),
            },
            {
              // So aparece quando alguem digitou nota a mao - e a unica coisa
              // aqui que nao saiu de conta nenhuma.
              title: 'Justificativa da nota manual',
              dataIndex: 'justificativa',
              render: (v: string | null) =>
                v ? (
                  <Typography.Text style={{ fontSize: 12 }}>{v}</Typography.Text>
                ) : (
                  <Typography.Text type="secondary">—</Typography.Text>
                ),
            },
          ]}
        />
        <div style={{ marginTop: ESPACO.md }}>
          <LegendaIdf />
        </div>
      </Modal>
    </Space>
  );
}
