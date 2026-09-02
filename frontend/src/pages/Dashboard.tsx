import { useState } from 'react';
import {
  Button,
  Card,
  Col,
  DatePicker,
  Modal,
  Row,
  Space,
  Statistic,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import {
  CheckCircleOutlined,
  DollarOutlined,
  ClockCircleOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  MinusOutlined,
  ReconciliationOutlined,
  FieldTimeOutlined,
  FileDoneOutlined,
  SafetyCertificateOutlined,
  RetweetOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dayjs } from 'dayjs';
import { api } from '../api';
import { useAuth } from '../auth';
import Tabela from '../components/Tabela';

const { RangePicker } = DatePicker;

const corClasse: Record<string, string> = {
  A: 'green',
  B: 'blue',
  C: 'orange',
  D: 'red',
};

function tendenciaTag(t: string) {
  if (t === 'UPGRADE')
    return (
      <Tag color="green" icon={<ArrowUpOutlined />}>
        Melhorou
      </Tag>
    );
  if (t === 'DOWNGRADE')
    return (
      <Tag color="red" icon={<ArrowDownOutlined />}>
        Piorou
      </Tag>
    );
  return <Tag icon={<MinusOutlined />}>Estável</Tag>;
}

// Linha pequena embaixo do cartao com os numeros crus. 100% de uma RNC so e
// muito diferente de 100% de cinquenta, e o percentual sozinho nao conta isso.
function Base({ texto }: { texto: string }) {
  return (
    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
      {texto}
    </Typography.Text>
  );
}

export default function Dashboard() {
  const qc = useQueryClient();
  const { usuario } = useAuth();
  const [periodo, setPeriodo] = useState<[Dayjs, Dayjs] | null>(null);

  const de = periodo?.[0]?.startOf('day').toISOString();
  const ate = periodo?.[1]?.endOf('day').toISOString();

  const { data: kpis, isLoading } = useQuery<any>({
    queryKey: ['kpis-sqe', de, ate],
    queryFn: async () =>
      (await api.get('/dashboard/kpis-sqe', { params: { de, ate } })).data,
  });

  const { data: evolucao, isLoading: loadingEvo } = useQuery<any[]>({
    queryKey: ['evolucao-fornecedores'],
    queryFn: async () =>
      (await api.get('/dashboard/evolucao-fornecedores')).data,
  });

  const fecharTrimestre = useMutation({
    mutationFn: async () => (await api.post('/dashboard/fechar-trimestre')).data,
    onSuccess: (res: any) => {
      message.success(
        `Trimestre ${res.trimestre} fechado. ${res.fornecedoresProcessados} fornecedor(es) reclassificado(s).`,
      );
      qc.invalidateQueries({ queryKey: ['evolucao-fornecedores'] });
      qc.invalidateQueries({ queryKey: ['fornecedores'] });
    },
    onError: () => message.error('Não foi possível fechar o trimestre.'),
  });

  const ind = kpis?.indicadores ?? {};
  const cont = kpis?.contadores ?? {};
  const base = kpis?.bases ?? {};
  const prazos = kpis?.prazos ?? {};

  const podeAdmin =
    usuario?.papel === 'ADMIN' || usuario?.papel === 'QUALIDADE';

  // Os nove indicadores do painel, na ordem e com os nomes definidos pela
  // Qualidade. Cada um traz a metrica no tooltip e os numeros crus embaixo.
  const indicadores = [
    {
      titulo: 'Aprovação de lotes no recebimento',
      metrica: 'Lotes aprovados ÷ lotes inspecionados × 100.',
      valor: ind.pctAprovacaoLotes,
      sufixo: '%',
      icone: <CheckCircleOutlined />,
      cor: '#3f8600',
      rodape: `${base.lotesAprovados ?? 0} de ${base.lotesInspecionados ?? 0} lotes inspecionados`,
    },
    {
      titulo: 'Tempo médio de resposta a RNC',
      metrica:
        'Mediana dos dias entre a emissão da RNC e a resposta do fornecedor.',
      valor: ind.medianaRespostaRncDias,
      sufixo: 'dias',
      icone: <ClockCircleOutlined />,
      rodape: `${base.rncsComResposta ?? 0} RNC(s) com resposta`,
    },
    {
      titulo: 'Savings por bloqueio de lotes com RNC',
      metrica:
        'Somatório do valor evitado pelos bloqueios validados. Cada RNC é um bloqueio.',
      valor: ind.savingsBloqueioReais,
      prefixo: <DollarOutlined />,
      moeda: true,
      cor: '#D37119',
      rodape: `${base.rncsTotal ?? 0} bloqueio(s) no período`,
    },
    {
      titulo: 'Abertura tempestiva de RNCs',
      metrica: `RNCs abertas dentro do prazo ÷ desvios que exigem RNC × 100. Prazo: ${prazos.aberturaRncDiasUteis ?? 1} dia útil da identificação do desvio.`,
      valor: ind.pctAberturaTempestiva,
      sufixo: '%',
      icone: <FieldTimeOutlined />,
      rodape: `${base.aberturasNoPrazo ?? 0} de ${base.cargasComDesvio ?? 0} desvios`,
    },
    {
      titulo: 'Planos de ação de RNC no prazo',
      metrica: `RNCs com plano recebido no prazo ÷ RNCs que exigem ação × 100. Prazo: ${prazos.planoRncDiasUteis ?? 5} dias úteis de quando o fornecedor recebe a notificação.`,
      valor: ind.pctPlanosNoPrazo,
      sufixo: '%',
      icone: <FileDoneOutlined />,
      rodape: `${base.planosNoPrazo ?? 0} de ${base.rncsTotal ?? 0} RNCs`,
    },
    {
      titulo: 'Encerramento de RNCs no prazo',
      metrica: `RNCs encerradas no prazo ÷ RNCs encerradas no período × 100. Prazo: ${prazos.encerramentoRncDiasUteis ?? 7} dias úteis após a abertura.`,
      valor: ind.pctEncerramentoNoPrazo,
      sufixo: '%',
      icone: <FieldTimeOutlined />,
      rodape: `${base.encerramentosNoPrazo ?? 0} de ${base.rncsEncerradasPeriodo ?? 0} encerradas`,
    },
    {
      titulo: 'Eficácia das ações de RNC',
      metrica: 'Ações eficazes ÷ ações verificadas × 100.',
      valor: ind.pctEficaciaAcoes,
      sufixo: '%',
      icone: <SafetyCertificateOutlined />,
      rodape: `${base.acoesEficazes ?? 0} de ${base.acoesVerificadas ?? 0} verificadas`,
    },
    {
      titulo: 'Reincidência de RNCs no recebimento',
      metrica: 'RNCs reincidentes ÷ RNCs abertas no período × 100.',
      valor: ind.pctReincidencia,
      sufixo: '%',
      icone: <RetweetOutlined />,
      // Unico indicador em que numero alto e ruim.
      cor: ind.pctReincidencia ? '#cf1322' : undefined,
      rodape: `${base.rncsReincidentes ?? 0} de ${base.rncsTotal ?? 0} RNCs`,
    },
    {
      titulo: 'Conformidade de calibração',
      metrica:
        'Instrumentos calibrados dentro da validade ÷ instrumentos previstos × 100. É uma foto de hoje do inventário, não do período.',
      valor: ind.pctConformidadeCalibracao,
      sufixo: '%',
      icone: <ToolOutlined />,
      rodape: `${base.instrumentosEmDia ?? 0} de ${base.instrumentosPrevistos ?? 0} instrumentos`,
    },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Row justify="space-between" align="middle">
        <Typography.Title level={4} style={{ margin: 0 }}>
          Painel Resumo — Qualidade de Fornecedores (SQE)
        </Typography.Title>
        <RangePicker
          format="DD/MM/YYYY"
          placeholder={['Início', 'Fim']}
          onChange={(v) => setPeriodo(v as [Dayjs, Dayjs] | null)}
        />
      </Row>

      <Row gutter={[16, 16]} align="stretch">
        {indicadores.map((i) => (
          <Col xs={24} sm={12} lg={8} key={i.titulo}>
            <Card style={{ height: '100%' }}>
              <Statistic
                title={
                  <Tooltip title={i.metrica}>
                    {/* minHeight alinha os valores: os titulos tem uma e duas
                        linhas, e sem isso os numeros ficavam em alturas
                        diferentes na mesma fileira. */}
                    <span
                      style={{
                        display: 'block',
                        minHeight: 44,
                        lineHeight: '22px',
                      }}
                    >
                      {i.titulo}
                    </span>
                  </Tooltip>
                }
                value={i.valor ?? 0}
                suffix={i.sufixo}
                prefix={i.prefixo ?? i.icone}
                loading={isLoading}
                valueStyle={i.cor ? { color: i.cor } : undefined}
                // Numero em pt-BR em todos os cartoes: sem isto o percentual
                // sairia "50.0%" ao lado de um savings "526.306,40" na mesma
                // fileira.
                formatter={(v) =>
                  Number(v).toLocaleString('pt-BR', {
                    minimumFractionDigits: i.moeda ? 2 : 1,
                    maximumFractionDigits: i.moeda ? 2 : 1,
                  })
                }
              />
              <Base texto={i.rodape} />
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]} align="stretch">
        {[
          { t: 'Entregas', v: cont.entregas },
          { t: 'Inspeções', v: cont.inspecoes },
          {
            // Fora do plano de periodicidade: fornecedor eventual ou pedido
            // pontual da Qualidade. Os desvios contam nos demais indicadores.
            t: 'Qtde de inspeção extra',
            v: cont.inspecoesExtra,
            cor: '#d46b08',
          },
          {
            t: 'Recebimentos sem inspeção',
            v: cont.recebimentosSemInspecao,
            cor: '#8c8c8c',
          },
          { t: 'RNCs (total)', v: cont.rncsTotal },
          {
            t: 'RNCs em andamento',
            v: cont.rncsAbertas,
            cor: '#cf1322',
          },
          {
            t: 'RNCs finalizadas',
            v: cont.rncsEncerradas,
            cor: '#3f8600',
          },
        ].map((c) => (
          // Com 7 contadores, espremer todos numa fileira deixava ~100px por
          // cartao e quebrava os titulos em varias linhas. lg={6} acomoda 4 por
          // fileira, com largura suficiente para o titulo respirar.
          <Col xs={12} sm={8} lg={6} key={c.t}>
            <Card size="small" style={{ height: '100%' }}>
              <Statistic
                title={
                  <span
                    style={{
                      display: 'block',
                      minHeight: 40,
                      lineHeight: '20px',
                    }}
                  >
                    {c.t}
                  </span>
                }
                value={c.v ?? 0}
                loading={isLoading}
                valueStyle={c.cor ? { color: c.cor } : undefined}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Card
        title="Evolução e histórico dos fornecedores"
        extra={
          podeAdmin && (
            <Button
              icon={<ReconciliationOutlined />}
              loading={fecharTrimestre.isPending}
              onClick={() =>
                Modal.confirm({
                  title: 'Fechar trimestre fiscal',
                  content:
                    'Isto vai registrar o histórico do período, reclassificar os fornecedores pela conformidade apurada e zerar os contadores do trimestre. Deseja continuar?',
                  okText: 'Fechar trimestre',
                  cancelText: 'Cancelar',
                  onOk: () => fecharTrimestre.mutate(),
                })
              }
            >
              Fechar trimestre
            </Button>
          )
        }
      >
        <Tabela
          rowKey="id"
          size="small"
          loading={loadingEvo}
          dataSource={evolucao}
          pagination={false}
          scroll={{ x: 'max-content' }}
          columns={[
            { title: 'Código', dataIndex: 'codigo', width: 100 },
            { title: 'Fornecedor', dataIndex: 'nome' },
            {
              title: 'Classificação atual',
              dataIndex: 'classificacaoFornecimento',
              width: 150,
              align: 'center',
              render: (c: string) => <Tag color={corClasse[c]}>{c}</Tag>,
            },
            {
              title: 'Apurada no período',
              dataIndex: 'classificacaoAtual',
              width: 150,
              align: 'center',
              render: (c: string) => <Tag color={corClasse[c]}>{c}</Tag>,
            },
            {
              title: 'Conformidade',
              dataIndex: 'pctConformidade',
              width: 120,
              align: 'center',
              render: (v: number) => `${v.toFixed(1)}%`,
            },
            {
              title: 'Cargas recebidas',
              dataIndex: 'totalEntregas',
              width: 130,
              align: 'center',
            },
            {
              title: 'Lotes insp.',
              dataIndex: 'lotesInspecionados',
              width: 100,
              align: 'center',
            },
            {
              title: 'Reprovados',
              dataIndex: 'lotesReprovados',
              width: 100,
              align: 'center',
            },
            {
              title: 'Tendência',
              dataIndex: 'tendencia',
              width: 130,
              align: 'center',
              render: (t: string) => tendenciaTag(t),
            },
          ]}
        />
      </Card>
    </Space>
  );
}
