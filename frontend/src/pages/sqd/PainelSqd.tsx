import { useState } from 'react';
import {
  Card,
  Col,
  DatePicker,
  Divider,
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
  DollarOutlined,
  FieldTimeOutlined,
  HourglassOutlined,
  RetweetOutlined,
  TrophyOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Dayjs } from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { dataBR, separadoresBR } from '../../formatos';
import {
  corResultado,
  corResultadoAuditoria,
  corResultadoItem,
  corStatusAuditoria,
  corStatusHomologacao,
  labelResultado,
  labelResultadoAuditoria,
  labelResultadoItem,
  labelStatusAuditoria,
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

  // Aba "KPI's" do FMR.025.01: o mesmo painel, aplicado a homologacao de itens.
  const { data: kpisItens, isLoading: loadingItens } = useQuery<any>({
    queryKey: ['sqd-kpis-itens', de, ate],
    queryFn: async () =>
      (await api.get('/sqd/painel/itens/kpis', { params: { de, ate } })).data,
  });

  const { data: ultimasItens, isLoading: loadingUltimasItens } = useQuery<any[]>(
    {
      queryKey: ['sqd-ultimas-itens'],
      queryFn: async () => (await api.get('/sqd/painel/itens/ultimas')).data,
    },
  );

  // Auditoria de fornecedores: alem do resultado, o painel acompanha o loop de
  // reavaliacao (90 dias corridos para reprovado, 180 para condicional).
  const { data: kpisAud, isLoading: loadingAud } = useQuery<any>({
    queryKey: ['sqd-kpis-auditorias', de, ate],
    queryFn: async () =>
      (await api.get('/sqd/painel/auditorias/kpis', { params: { de, ate } }))
        .data,
  });

  const { data: ultimasAud, isLoading: loadingUltimasAud } = useQuery<any[]>({
    queryKey: ['sqd-ultimas-auditorias'],
    queryFn: async () => (await api.get('/sqd/painel/auditorias/ultimas')).data,
  });

  const sla = kpis?.slaDias ?? 3;
  const slaResposta = kpis?.slaRespostaDias ?? 3;
  const slaItem = kpisItens?.slaDias ?? 3;
  const slaRespostaItem = kpisItens?.slaRespostaDias ?? 3;

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

      <Divider orientation="left" plain>
        Homologação de Fornecedores — Doc. BDBR.QUA.FMR.029.01
      </Divider>

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

      <Divider orientation="left" plain>
        Homologação de Itens — Doc. BDBR.QUA.FMR.025.01
      </Divider>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Aprovação de itens"
              value={kpisItens?.pctAprovacao ?? 0}
              {...separadoresBR}
              suffix="%"
              precision={1}
              loading={loadingItens}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Aprovados na 1ª tentativa"
              value={kpisItens?.pctPrimeiraTentativa ?? 0}
              {...separadoresBR}
              suffix="%"
              precision={1}
              loading={loadingItens}
              prefix={<RetweetOutlined />}
              valueStyle={{ color: '#D37119' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Lead time médio (dias úteis)"
              value={kpisItens?.leadTimeMedio ?? 0}
              {...separadoresBR}
              precision={1}
              loading={loadingItens}
              prefix={<FieldTimeOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={`Dentro do prazo (até ${slaItem} dias úteis)`}
              value={kpisItens?.pctNoPrazo ?? 0}
              {...separadoresBR}
              suffix="%"
              precision={1}
              loading={loadingItens}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Resposta do fornecedor (dias úteis)"
              value={kpisItens?.tempoRespostaMedio ?? 0}
              {...separadoresBR}
              precision={1}
              loading={loadingItens}
              prefix={<FieldTimeOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={`Amostras no prazo (até ${slaRespostaItem} dias úteis)`}
              value={kpisItens?.pctRespostaNoPrazo ?? 0}
              {...separadoresBR}
              suffix="%"
              precision={1}
              loading={loadingItens}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Tempo total do ciclo (dias úteis)"
              value={kpisItens?.tempoTotalMedio ?? 0}
              {...separadoresBR}
              precision={1}
              loading={loadingItens}
              prefix={<HourglassOutlined />}
            />
          </Card>
        </Col>
        {/* Savings do FMR.025.01: so conta o que ja foi validado, ou seja, as
            homologacoes com o ciclo encerrado. */}
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Savings (homologações finalizadas)"
              value={kpisItens?.savings ?? 0}
              {...separadoresBR}
              precision={2}
              prefix={<DollarOutlined />}
              loading={loadingItens}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} align="stretch">
        {[
          { t: 'Itens registrados', v: kpisItens?.total },
          {
            t: 'Aguardando amostras',
            v: kpisItens?.aguardandoAmostras,
            cor: '#0958d9',
          },
          { t: 'Itens inspecionados', v: kpisItens?.analisados },
          { t: 'Aprovados', v: kpisItens?.aprovados, cor: '#3f8600' },
          { t: 'Reprovados', v: kpisItens?.reprovados, cor: '#cf1322' },
          { t: 'Em andamento', v: kpisItens?.emAndamento },
          { t: 'Finalizadas', v: kpisItens?.finalizadas, cor: '#3f8600' },
          { t: 'Canceladas', v: kpisItens?.canceladas },
          {
            t: 'Planos de ação em andamento',
            v: kpisItens?.planosEmAndamento,
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
                loading={loadingItens}
                valueStyle={c.cor ? { color: c.cor } : undefined}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Card title="Últimas homologações de itens">
        <Table
          rowKey="id"
          size="small"
          loading={loadingUltimasItens}
          dataSource={ultimasItens}
          pagination={false}
          scroll={{ x: 1000 }}
          locale={{ emptyText: 'Nenhuma homologação de item registrada' }}
          onRow={(r) => ({
            onClick: () => navigate(`/sqd/homologacoes-itens/${r.id}`),
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
              title: 'Item',
              dataIndex: 'itemCodigo',
              width: 220,
              render: (c: string, h: any) =>
                `${c ?? '-'}${h.itemDescricao ? ` — ${h.itemDescricao}` : ''}`,
            },
            {
              title: 'Tentativas',
              dataIndex: 'tentativas',
              width: 100,
              align: 'right',
            },
            {
              title: 'Resultado',
              dataIndex: 'resultado',
              width: 230,
              render: (r: string | null, h: any) =>
                r ? (
                  <Tag color={corResultadoItem[r]}>{labelResultadoItem[r]}</Tag>
                ) : h.statusHomologacao === 'CANCELADO' ? (
                  '-'
                ) : (
                  <Tag>Aguardando amostras do fornecedor</Tag>
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

      <Divider orientation="left" plain>
        Auditoria de Fornecedores — Checklist de Auditoria
      </Divider>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Aprovação em auditoria"
              value={kpisAud?.pctAprovacao ?? 0}
              {...separadoresBR}
              suffix="%"
              precision={1}
              loading={loadingAud}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Nota média das auditorias"
              value={kpisAud?.notaMedia ?? 0}
              {...separadoresBR}
              precision={1}
              loading={loadingAud}
              prefix={<TrophyOutlined />}
              valueStyle={{ color: '#D37119' }}
            />
          </Card>
        </Col>
        {/* O semaforo do prazo: vermelho ja venceu, amarelo esta nos ultimos
            15 dias. */}
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Reavaliações vencidas"
              value={kpisAud?.reavaliacoesVencidas ?? 0}
              {...separadoresBR}
              loading={loadingAud}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Reavaliações a vencer (15 dias)"
              value={kpisAud?.reavaliacoesAVencer ?? 0}
              {...separadoresBR}
              loading={loadingAud}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#d4b106' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} align="stretch">
        {[
          { t: 'Auditorias registradas', v: kpisAud?.total },
          {
            t: 'Aguardando checklist',
            v: kpisAud?.aguardandoChecklist,
            cor: '#0958d9',
          },
          { t: 'Auditorias avaliadas', v: kpisAud?.avaliadas },
          { t: 'Aprovados', v: kpisAud?.aprovados, cor: '#3f8600' },
          {
            t: 'Aprovados condicionalmente',
            v: kpisAud?.condicionais,
            cor: '#d46b08',
          },
          { t: 'Reprovados', v: kpisAud?.reprovados, cor: '#cf1322' },
          {
            t: 'No loop de reavaliação',
            v: kpisAud?.emReavaliacao,
            cor: '#d46b08',
          },
          { t: 'Reavaliadas (2ª rodada ou mais)', v: kpisAud?.reavaliadas },
          { t: 'Em andamento', v: kpisAud?.emAndamento },
          { t: 'Encerradas', v: kpisAud?.finalizadas, cor: '#3f8600' },
          { t: 'Canceladas', v: kpisAud?.canceladas },
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
                loading={loadingAud}
                valueStyle={c.cor ? { color: c.cor } : undefined}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Card title="Últimas auditorias de fornecedores">
        <Table
          rowKey="id"
          size="small"
          loading={loadingUltimasAud}
          dataSource={ultimasAud}
          pagination={false}
          scroll={{ x: 1100 }}
          locale={{ emptyText: 'Nenhuma auditoria registrada' }}
          onRow={(r) => ({
            onClick: () => navigate(`/sqd/auditorias/${r.id}`),
            style: { cursor: 'pointer' },
          })}
          columns={[
            { title: 'Número', dataIndex: 'numero', width: 120 },
            {
              title: 'Auditoria',
              dataIndex: 'dataAuditoria',
              width: 110,
              render: (d: string) => dataBR(d),
            },
            { title: 'Fornecedor', dataIndex: 'fornecedorNome' },
            {
              title: 'Rodadas',
              dataIndex: 'rodadasLancadas',
              width: 90,
              align: 'right',
            },
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
              width: 210,
              render: (r: string | null) =>
                r ? (
                  <Tag color={corResultadoAuditoria[r]}>
                    {labelResultadoAuditoria[r]}
                  </Tag>
                ) : (
                  <Tag>Aguardando checklist</Tag>
                ),
            },
            {
              title: 'Status',
              dataIndex: 'statusAuditoria',
              width: 130,
              render: (s: string) => (
                <Tag color={corStatusAuditoria[s]}>
                  {labelStatusAuditoria[s]}
                </Tag>
              ),
            },
          ]}
        />
      </Card>
    </Space>
  );
}
