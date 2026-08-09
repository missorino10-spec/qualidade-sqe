import { useState } from 'react';
import {
  Card,
  Col,
  DatePicker,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  FieldTimeOutlined,
  HourglassOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Dayjs } from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { dataBR, separadoresBR } from '../../formatos';
import {
  corResultado,
  corStatusHomologacao,
  labelResultado,
  labelStatusHomologacao,
  nota,
} from './comum';

const { RangePicker } = DatePicker;

// Painel do SQD. Os indicadores sao os mesmos da aba "KPI's" do
// BDBR.QUA.FMR.029.01 (% de aprovacao, lead time medio e % dentro do prazo),
// mais os dois relogios do fluxo: o tempo de resposta do fornecedor e o tempo
// total ate o fechamento da homologacao.
export default function PainelSqd() {
  const navigate = useNavigate();
  const [periodo, setPeriodo] = useState<[Dayjs, Dayjs] | null>(null);

  const de = periodo?.[0]?.format('YYYY-MM-DD');
  const ate = periodo?.[1]?.format('YYYY-MM-DD');

  const { data: kpis, isLoading } = useQuery<any>({
    queryKey: ['sqd-kpis', de, ate],
    queryFn: async () =>
      (await api.get('/sqd/painel/kpis', { params: { de, ate } })).data,
  });

  const { data: ultimas, isLoading: loadingUltimas } = useQuery<any[]>({
    queryKey: ['sqd-ultimas'],
    queryFn: async () => (await api.get('/sqd/painel/ultimas')).data,
  });

  const sla = kpis?.slaDias ?? 3;
  const slaResposta = kpis?.slaRespostaDias ?? 3;

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Row justify="space-between" align="middle">
        <Typography.Title level={4} style={{ margin: 0 }}>
          Painel Resumo — SQD (Desenvolvimento de Fornecedores)
        </Typography.Title>
        <RangePicker
          format="DD/MM/YYYY"
          placeholder={['Início', 'Fim']}
          onChange={(v) => setPeriodo(v as [Dayjs, Dayjs] | null)}
        />
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Aprovação de fornecedores"
              value={kpis?.pctAprovacao ?? 0}
              {...separadoresBR}
              suffix="%"
              precision={1}
              loading={isLoading}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Nota média das autoavaliações"
              value={kpis?.notaMedia ?? 0}
              {...separadoresBR}
              precision={1}
              loading={isLoading}
              prefix={<TrophyOutlined />}
              valueStyle={{ color: '#D37119' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Lead time médio (dias úteis)"
              value={kpis?.leadTimeMedio ?? 0}
              {...separadoresBR}
              precision={1}
              loading={isLoading}
              prefix={<FieldTimeOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={`Dentro do prazo (até ${sla} dias úteis)`}
              value={kpis?.pctNoPrazo ?? 0}
              {...separadoresBR}
              suffix="%"
              precision={1}
              loading={isLoading}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Os relogios do fluxo: quanto o fornecedor demora para devolver o
          formulario e quanto demora o ciclo inteiro ate o fechamento. */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="Resposta do fornecedor (dias úteis)"
              value={kpis?.tempoRespostaMedio ?? 0}
              {...separadoresBR}
              precision={1}
              loading={isLoading}
              prefix={<FieldTimeOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title={`Fornecedores no prazo (até ${slaResposta} dias úteis)`}
              value={kpis?.pctRespostaNoPrazo ?? 0}
              {...separadoresBR}
              suffix="%"
              precision={1}
              loading={isLoading}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="Tempo total do ciclo (dias úteis)"
              value={kpis?.tempoTotalMedio ?? 0}
              {...separadoresBR}
              precision={1}
              loading={isLoading}
              prefix={<HourglassOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} align="stretch">
        {[
          { t: 'Homologações registradas', v: kpis?.total },
          {
            t: 'Aguardando fornecedor',
            v: kpis?.aguardandoFornecedor,
            cor: '#0958d9',
          },
          { t: 'Autoavaliações lançadas', v: kpis?.avaliadas },
          { t: 'Aprovados', v: kpis?.aprovados, cor: '#3f8600' },
          {
            t: 'Aprovados condicionalmente',
            v: kpis?.condicionais,
            cor: '#d46b08',
          },
          { t: 'Reprovados', v: kpis?.reprovados, cor: '#cf1322' },
          { t: 'Em andamento', v: kpis?.emAndamento },
          { t: 'Finalizadas', v: kpis?.finalizadas, cor: '#3f8600' },
          { t: 'Canceladas', v: kpis?.canceladas },
          {
            t: 'Planos de ação em andamento',
            v: kpis?.planosEmAndamento,
            cor: '#d46b08',
          },
        ].map((c) => (
          <Col xs={12} sm={8} lg={6} key={c.t}>
            <Card size="small" style={{ height: '100%' }}>
              <Statistic
                title={
                  <span
                    style={{ display: 'block', minHeight: 40, lineHeight: '20px' }}
                  >
                    {c.t}
                  </span>
                }
                value={c.v ?? 0}
                {...separadoresBR}
                loading={isLoading}
                valueStyle={c.cor ? { color: c.cor } : undefined}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Card title="Últimas homologações de fornecedores">
        <Table
          rowKey="id"
          size="small"
          loading={loadingUltimas}
          dataSource={ultimas}
          pagination={false}
          scroll={{ x: 900 }}
          locale={{ emptyText: 'Nenhuma homologação registrada' }}
          onRow={(r) => ({
            onClick: () => navigate(`/sqd/homologacoes/${r.id}`),
            style: { cursor: 'pointer' },
          })}
          columns={[
            { title: 'Número', dataIndex: 'numero', width: 120 },
            {
              title: 'Solicitação',
              dataIndex: 'dataSolicitacao',
              width: 110,
              render: (d: string) => dataBR(d),
            },
            { title: 'Fornecedor', dataIndex: 'fornecedorNome' },
            {
              title: 'Nota',
              dataIndex: 'nota',
              width: 90,
              align: 'right',
              render: (v: number | null) => <strong>{nota(v)}</strong>,
            },
            {
              title: 'Resultado',
              dataIndex: 'resultado',
              width: 230,
              render: (r: string | null, h: any) =>
                r ? (
                  <Tag color={corResultado[r]}>{labelResultado[r]}</Tag>
                ) : h.statusHomologacao === 'CANCELADO' ? (
                  '-'
                ) : (
                  <Tag>Aguardando retorno do fornecedor</Tag>
                ),
            },
            {
              title: 'Status',
              dataIndex: 'statusHomologacao',
              width: 130,
              render: (s: string) => (
                <Tag color={corStatusHomologacao[s]}>
                  {labelStatusHomologacao[s]}
                </Tag>
              ),
            },
          ]}
        />
      </Card>
    </Space>
  );
}
