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
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  CheckCircleOutlined,
  DollarOutlined,
  ClockCircleOutlined,
  FileSearchOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  MinusOutlined,
  ReconciliationOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs, { Dayjs } from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import {
  corStatusRnc,
  labelStatusRnc,
} from './RncLista';
import { useAuth } from '../auth';

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
  return (
    <Tag icon={<MinusOutlined />}>Estável</Tag>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
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

  const { data: rncs, isLoading: loadingRnc } = useQuery<any[]>({
    queryKey: ['rnc', 'dashboard'],
    queryFn: async () => (await api.get('/rnc')).data,
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

  const emAndamento = (rncs ?? []).filter((r) => r.status === 'EM_ANDAMENTO');

  const podeAdmin =
    usuario?.papel === 'ADMIN' || usuario?.papel === 'QUALIDADE';

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

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Fornecedores inspecionados"
              value={ind.pctFornecedoresInspecionados ?? 0}
              suffix="%"
              precision={1}
              loading={isLoading}
              prefix={<FileSearchOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Itens inspecionados"
              value={ind.pctItensInspecionados ?? 0}
              suffix="%"
              precision={1}
              loading={isLoading}
              prefix={<FileSearchOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Aprovação no recebimento"
              value={ind.pctAprovacaoRecebimento ?? 0}
              suffix="%"
              precision={1}
              loading={isLoading}
              valueStyle={{ color: '#3f8600' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Custos evitados (R$)"
              value={ind.custosEvitadosReais ?? 0}
              precision={2}
              loading={isLoading}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#D37119' }}
              formatter={(v) =>
                Number(v).toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                })
              }
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Resposta às RNCs"
              value={ind.pctRespostaRnc ?? 0}
              suffix="%"
              precision={1}
              loading={isLoading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Eficácia das respostas"
              value={ind.pctEficaciaResposta ?? 0}
              suffix="%"
              precision={1}
              loading={isLoading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Eficácia no encerramento"
              value={ind.pctEficaciaEncerramento ?? 0}
              suffix="%"
              precision={1}
              loading={isLoading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Tempo médio de resposta"
              value={ind.tempoMedioRespostaRncDias ?? 0}
              suffix="dias"
              precision={1}
              loading={isLoading}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} align="stretch">
        {[
          { t: 'Entregas', v: cont.entregas },
          { t: 'Inspeções', v: cont.inspecoes },
          {
            // Fora do plano de periodicidade: fornecedor eventual ou pedido
            // pontual da Qualidade. Os desvios contam nos demais indicadores.
            t: 'Qtde de Inspeção Extra',
            v: cont.inspecoesExtra,
            cor: '#d46b08',
          },
          {
            t: 'Recebimentos s/ inspeção',
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
        title="Evolução e Histórico dos Fornecedores"
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
        <Table
          rowKey="id"
          size="small"
          loading={loadingEvo}
          dataSource={evolucao}
          pagination={false}
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

      <Card title="RNCs em andamento">
        <Table
          rowKey="id"
          size="small"
          loading={loadingRnc}
          dataSource={emAndamento}
          locale={{ emptyText: 'Nenhuma RNC em andamento' }}
          onRow={(r) => ({
            onClick: () => navigate(`/rnc/${r.id}`),
            style: { cursor: 'pointer' },
          })}
          columns={[
            { title: 'Número', dataIndex: 'numero', width: 110 },
            {
              title: 'Abertura',
              dataIndex: 'dataAbertura',
              width: 110,
              render: (d: string) => dayjs(d).format('DD/MM/YYYY'),
            },
            {
              title: 'Fornecedor',
              render: (_: any, r: any) => r.fornecedor?.nome,
            },
            { title: 'Item', render: (_: any, r: any) => r.item?.descricao },
            {
              title: 'Tipo de desvio',
              dataIndex: 'tipoDesvio',
              width: 160,
              render: (v?: string) => v ?? '-',
            },
            {
              title: 'Status',
              dataIndex: 'status',
              width: 130,
              render: (s: string) => (
                <Tag color={corStatusRnc[s]}>{labelStatusRnc[s]}</Tag>
              ),
            },
          ]}
        />
      </Card>
    </Space>
  );
}
