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
  Typography,
  message,
} from 'antd';
import {
  AlertOutlined,
  CheckCircleOutlined,
  DollarOutlined,
  ReconciliationOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dayjs } from 'dayjs';
import { api } from '../../api';
import { useAuth } from '../../auth';
import { separadoresBR } from '../../formatos';
import Tabela from '../../components/Tabela';

const { RangePicker } = DatePicker;

const moeda = (v: number) =>
  (v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

// Painel da Qualidade da Manufatura. Mesma leitura do painel do SQE, com os
// indicadores da fabrica: PPM, CNQ e o andamento dos ciclos de inspecao.
export default function PainelManufatura() {
  const qc = useQueryClient();
  const { usuario } = useAuth();
  const [periodo, setPeriodo] = useState<[Dayjs, Dayjs] | null>(null);

  const de = periodo?.[0]?.startOf('day').toISOString();
  const ate = periodo?.[1]?.endOf('day').toISOString();

  const { data: kpis, isLoading } = useQuery<any>({
    queryKey: ['manufatura-kpis', de, ate],
    queryFn: async () =>
      (await api.get('/manufatura/painel/kpis', { params: { de, ate } })).data,
  });

  const { data: evolucao, isLoading: loadingEvo } = useQuery<any[]>({
    queryKey: ['manufatura-evolucao'],
    queryFn: async () =>
      (await api.get('/manufatura/painel/evolucao-maquinas')).data,
  });

  const fecharTrimestre = useMutation({
    mutationFn: async () =>
      (await api.post('/manufatura/painel/fechar-trimestre')).data,
    onSuccess: (res: any) => {
      message.success(
        `Trimestre ${res.trimestre} fechado. ${res.maquinasProcessadas} máquina(s) registrada(s) no histórico.`,
      );
      qc.invalidateQueries({ queryKey: ['manufatura-evolucao'] });
      qc.invalidateQueries({ queryKey: ['maquinas'] });
    },
    onError: () => message.error('Não foi possível fechar o trimestre.'),
  });

  const ind = kpis?.indicadores ?? {};
  const cont = kpis?.contadores ?? {};
  const icaq = kpis?.icaq ?? {};

  const podeAdmin = usuario?.papel === 'ADMIN' || usuario?.papel === 'QUALIDADE';

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Row justify="space-between" align="middle">
        <Typography.Title level={4} style={{ margin: 0 }}>
          Painel Resumo — Qualidade da Manufatura
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
              title="PPM"
              value={ind.ppm ?? 0}
              {...separadoresBR}
              loading={isLoading}
              prefix={<AlertOutlined />}
              valueStyle={{ color: '#D37119' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Peças produzidas"
              value={ind.pecasProduzidas ?? 0}
              {...separadoresBR}
              loading={isLoading}
              prefix={<ToolOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Peças com defeito"
              value={ind.pecasComDefeito ?? 0}
              {...separadoresBR}
              loading={isLoading}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="CNQ do período (R$)"
              value={ind.cnqTotal ?? 0}
              loading={isLoading}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#D37119' }}
              formatter={(v) => moeda(Number(v))}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Aprovação nas inspeções"
              value={ind.pctAprovacao ?? 0}
              {...separadoresBR}
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
              title="Índice de defeito"
              value={ind.pctDefeito ?? 0}
              {...separadoresBR}
              suffix="%"
              precision={2}
              loading={isLoading}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} align="stretch">
        {[
          { t: 'Máquinas ativas', v: cont.maquinas },
          { t: 'Inspeções de setup', v: cont.inspecoesSetup },
          { t: 'Inspeções de produção', v: cont.inspecoesProducao },
          {
            t: 'Pendentes de reinspeção',
            v: cont.inspecoesPendentes,
            cor: '#cf1322',
          },
          { t: 'Reinspeções realizadas', v: cont.reinspecoes },
          { t: 'Lançamentos de CNQ', v: cont.lancamentosCnq },
          { t: '8D abertos', v: cont.oitoDsAbertos, cor: '#cf1322' },
          { t: '8D concluídos', v: cont.oitoDsConcluidos, cor: '#3f8600' },
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

      {/* ICAQ — como esta o programa de controle autonomo no periodo. Os dois
          rankings saem da PIOR nota para a melhor: quem precisa de atencao
          aparece primeiro. */}
      <Card title="ICAQ — Controle Autônomo da Qualidade">
        <Row gutter={[16, 16]}>
          {[
            { t: 'Auditorias no período', v: icaq.auditorias },
            {
              t: 'Nota média',
              v: icaq.notaMedia,
              sufixo: '%',
              casas: 1,
            },
            {
              t: 'Dentro do padrão',
              v: icaq.pctConforme,
              sufixo: '%',
              casas: 1,
              cor: '#3f8600',
            },
            {
              t: 'Fora do padrão',
              v: icaq.pctForaDoPadrao,
              sufixo: '%',
              casas: 1,
              cor: '#cf1322',
            },
            { t: 'Conformes', v: icaq.conformes, cor: '#3f8600' },
            { t: 'Em atenção', v: icaq.atencao, cor: '#D37119' },
            { t: 'Não conformes', v: icaq.naoConformes, cor: '#cf1322' },
          ].map((c) => (
            <Col xs={12} sm={8} lg={6} key={c.t}>
              <Card size="small" style={{ height: '100%' }}>
                <Statistic
                  title={c.t}
                  value={c.v ?? 0}
                  {...separadoresBR}
                  suffix={c.sufixo}
                  precision={c.casas}
                  loading={isLoading}
                  valueStyle={c.cor ? { color: c.cor } : undefined}
                />
              </Card>
            </Col>
          ))}
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          {[
            { titulo: 'Por operador auditado', coluna: 'Operador auditado', dados: icaq.porOperador },
            { titulo: 'Por equipamento', coluna: 'Equipamento', dados: icaq.porEquipamento },
          ].map((bloco) => (
            <Col xs={24} lg={12} key={bloco.titulo}>
              <Card size="small" title={bloco.titulo}>
                <Tabela
                  rowKey="nome"
                  size="small"
                  loading={isLoading}
                  dataSource={bloco.dados}
                  pagination={false}
                  scroll={{ x: 'max-content' }}
                  locale={{ emptyText: 'Nenhuma auditoria no período' }}
                  columns={[
                    { title: bloco.coluna, dataIndex: 'nome' },
                    {
                      title: 'Auditorias',
                      dataIndex: 'auditorias',
                      width: 100,
                      align: 'center',
                    },
                    {
                      title: 'Nota média',
                      dataIndex: 'notaMedia',
                      width: 110,
                      align: 'right',
                      render: (v: number) => <strong>{(v ?? 0).toFixed(1)}%</strong>,
                    },
                    {
                      title: 'Conforme',
                      dataIndex: 'pctConforme',
                      width: 110,
                      align: 'right',
                      render: (v: number) => `${(v ?? 0).toFixed(1)}%`,
                    },
                  ]}
                />
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      <Card title="Defeitos mais recorrentes">
        <Tabela
          rowKey="nome"
          size="small"
          loading={isLoading}
          dataSource={kpis?.topDefeitos}
          pagination={false}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: 'Nenhum defeito lançado no período' }}
          columns={[
            { title: 'Descrição do Defeito', dataIndex: 'nome' },
            {
              title: 'Quantidade',
              dataIndex: 'qtd',
              width: 140,
              align: 'right',
            },
            {
              title: 'CNQ (R$)',
              dataIndex: 'cnq',
              width: 160,
              align: 'right',
              render: moeda,
            },
          ]}
        />
      </Card>

      <Card title="PPM por máquina">
        <Tabela
          rowKey="id"
          size="small"
          loading={isLoading}
          dataSource={kpis?.ppmPorMaquina}
          pagination={false}
          scroll={{ x: 'max-content' }}
          columns={[
            { title: 'Máquina / Linha', dataIndex: 'nome' },
            {
              title: 'Área',
              dataIndex: 'area',
              width: 130,
              render: (a: string) =>
                a === 'MONTAGEM' ? 'Montagem' : 'Fabricação',
            },
            {
              title: 'Produzidas',
              dataIndex: 'produzidas',
              width: 120,
              align: 'right',
            },
            {
              title: 'Com defeito',
              dataIndex: 'defeitos',
              width: 120,
              align: 'right',
            },
            {
              title: 'CNQ (R$)',
              dataIndex: 'cnq',
              width: 140,
              align: 'right',
              render: moeda,
            },
            {
              title: 'PPM',
              dataIndex: 'ppm',
              width: 120,
              align: 'right',
              render: (v: number) => <strong>{(v ?? 0).toLocaleString('pt-BR')}</strong>,
            },
          ]}
        />
      </Card>

      <Card
        title="Evolução e histórico das máquinas"
        extra={
          podeAdmin && (
            <Button
              icon={<ReconciliationOutlined />}
              loading={fecharTrimestre.isPending}
              onClick={() =>
                Modal.confirm({
                  title: 'Fechar trimestre fiscal',
                  content:
                    'Isto vai registrar o histórico do período de cada máquina e zerar os contadores do trimestre. Deseja continuar?',
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
          scroll={{ x: 1100 }}
          columns={[
            { title: 'Código', dataIndex: 'codigo', width: 100 },
            { title: 'Máquina / Linha', dataIndex: 'nome' },
            {
              title: 'Setups',
              dataIndex: 'setupsRealizados',
              width: 90,
              align: 'center',
            },
            {
              title: 'Produções',
              dataIndex: 'producoesRealizadas',
              width: 100,
              align: 'center',
            },
            {
              title: 'Reprovadas',
              dataIndex: 'inspecoesReprovadas',
              width: 110,
              align: 'center',
            },
            {
              title: 'PPM',
              dataIndex: 'ppm',
              width: 100,
              align: 'right',
              render: (v: number) => (v ?? 0).toLocaleString('pt-BR'),
            },
            {
              title: 'CNQ (R$)',
              dataIndex: 'cnqTotal',
              width: 130,
              align: 'right',
              render: moeda,
            },
          ]}
        />
      </Card>
    </Space>
  );
}
