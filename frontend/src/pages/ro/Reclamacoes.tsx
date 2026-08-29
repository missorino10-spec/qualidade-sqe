import { useState } from 'react';
import {
  Button,
  Card,
  Col,
  Input,
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
import { FilePdfOutlined, PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { abrirPdfEmNovaAba, api } from '../../api';
import { useAuth } from '../../auth';
import { dataBR, separadoresBR } from '../../formatos';
import Tabela, { filtrosDe } from '../../components/Tabela';
import {
  BLOCOS_RO,
  COR_PRIORIDADE_RO,
  COR_STATUS_RO,
  LISTAS_VAZIAS,
  ListasRo,
  rotuloDe,
} from '../../ro';

// R.O — Gestao de Reclamacoes da Qualidade.
// A lista mostra o andamento de cada reclamacao recebida da Sala de Controle e,
// em cada linha, quais dos quatro blocos da planilha ja fecharam.

const PERIODOS = [
  { value: 'SEMANA', label: 'Semana atual' },
  { value: 'MES', label: 'Mês atual' },
  { value: 'ANO', label: 'Ano atual' },
  { value: 'TUDO', label: 'Todo o período' },
  { value: 'PERSONALIZADO', label: 'Personalizado' },
];

function intervaloDoPeriodo(periodo: string): { de?: string; ate?: string } {
  const hoje = dayjs();
  const fmt = (d: dayjs.Dayjs) => d.format('YYYY-MM-DD');
  if (periodo === 'SEMANA')
    return { de: fmt(hoje.startOf('week')), ate: fmt(hoje.endOf('week')) };
  if (periodo === 'MES')
    return { de: fmt(hoje.startOf('month')), ate: fmt(hoje.endOf('month')) };
  if (periodo === 'ANO')
    return { de: fmt(hoje.startOf('year')), ate: fmt(hoje.endOf('year')) };
  return {};
}

// Os quatro flags da linha: verde quando o bloco fechou, cinza quando nao.
function Flags({ blocos }: { blocos: any[] }) {
  const feitos = (blocos ?? []).map((b: any) => b.numero);
  return (
    <Space size={2}>
      {BLOCOS_RO.map((b) => (
        <Tooltip
          key={b.numero}
          title={`${b.titulo} — ${feitos.includes(b.numero) ? 'concluído' : 'em aberto'}`}
        >
          <Tag
            color={feitos.includes(b.numero) ? 'green' : 'default'}
            style={{ margin: 0, minWidth: 22, textAlign: 'center' }}
          >
            {b.numero}
          </Tag>
        </Tooltip>
      ))}
    </Space>
  );
}

export default function Reclamacoes() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const admin = usuario?.papel === 'ADMIN';

  const [periodo, setPeriodo] = useState('TUDO');
  const [intervalo, setIntervalo] = useState(intervaloDoPeriodo('TUDO'));
  const [status, setStatus] = useState<string | undefined>();

  const filtro = {
    de: intervalo.de || undefined,
    ate: intervalo.ate || undefined,
    status,
  };

  const { data: listas } = useQuery<ListasRo>({
    queryKey: ['ro-listas'],
    queryFn: async () => (await api.get('/ro/reclamacoes/listas')).data,
  });
  const L = listas ?? LISTAS_VAZIAS;

  const { data, isLoading } = useQuery<any[]>({
    queryKey: ['ro', filtro.de, filtro.ate, filtro.status],
    queryFn: async () => (await api.get('/ro/reclamacoes', { params: filtro })).data,
  });

  function trocarPeriodo(v: string) {
    setPeriodo(v);
    // "Personalizado" mantem as datas que ja estavam para o usuario so ajustar.
    if (v !== 'PERSONALIZADO') setIntervalo(intervaloDoPeriodo(v));
  }

  function trocarData(campo: 'de' | 'ate', valor: string) {
    setPeriodo('PERSONALIZADO');
    setIntervalo((atual) => ({ ...atual, [campo]: valor }));
  }

  const excluir = useMutation({
    mutationFn: async (id: number) => api.delete(`/ro/reclamacoes/${id}`),
    onSuccess: () => {
      message.success('R.O excluído.');
      qc.invalidateQueries({ queryKey: ['ro'] });
    },
    onError: (e: any) =>
      message.error(
        e?.response?.data?.message ?? 'Não foi possível excluir o R.O.',
      ),
  });

  const lista = data ?? [];
  const encerradas = lista.filter((r) => r.status === 'ENCERRADA').length;
  const emAberto = lista.length - encerradas;
  const hoje = dayjs().startOf('day');
  const atrasadas = lista.filter(
    (r) =>
      r.status !== 'ENCERRADA' &&
      r.prazoConclusao &&
      dayjs(String(r.prazoConclusao).slice(0, 10)).isBefore(hoje),
  ).length;
  const custo = lista.reduce((s, r) => s + (r.custoTotal ?? 0), 0);

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* O filtro vale para a lista e para os totais do topo. */}
      <Card size="small">
        <Row gutter={[12, 12]} align="bottom">
          <Col xs={24} sm={12} lg={6}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Período (recebimento na Qualidade)
            </Typography.Text>
            <Select
              style={{ width: '100%' }}
              value={periodo}
              onChange={trocarPeriodo}
              options={PERIODOS}
            />
          </Col>
          <Col xs={12} sm={6} lg={5}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              De
            </Typography.Text>
            <Input
              type="date"
              value={intervalo.de ?? ''}
              onChange={(e) => trocarData('de', e.target.value)}
            />
          </Col>
          <Col xs={12} sm={6} lg={5}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Até
            </Typography.Text>
            <Input
              type="date"
              value={intervalo.ate ?? ''}
              onChange={(e) => trocarData('ate', e.target.value)}
            />
          </Col>
          <Col xs={24} sm={24} lg={8}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Status da reclamação
            </Typography.Text>
            <Select
              allowClear
              placeholder="Todos"
              style={{ width: '100%' }}
              value={status}
              onChange={setStatus}
              options={L.status}
            />
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="R.O no período" value={lista.length} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Em aberto" value={emAberto} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Fora do prazo"
              value={atrasadas}
              valueStyle={atrasadas ? { color: '#cf1322' } : undefined}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Custo total (peças)"
              value={custo}
              precision={2}
              prefix="R$"
              {...separadoresBR}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title="R.O — Gestão de Reclamações da Qualidade"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/ro/novo')}
          >
            Novo R.O
          </Button>
        }
      >
        <Tabela
          busca="Buscar (número, cliente, produto...)"
          rowKey="id"
          size="small"
          loading={isLoading}
          dataSource={lista}
          scroll={{ x: 'max-content' }}
          onRow={(r: any) => ({
            onClick: () => navigate(`/ro/${r.id}`),
            style: { cursor: 'pointer' },
          })}
          columns={[
            { title: 'Número', dataIndex: 'numero', width: 125 },
            {
              title: 'Recebido em',
              dataIndex: 'recebidoEm',
              width: 110,
              render: (d: string) => dataBR(d),
            },
            {
              title: 'Cliente / representante',
              dataIndex: 'cliente',
              width: 190,
              filters: filtrosDe(lista.map((r: any) => r.cliente)),
              onFilter: (v: any, r: any) => r.cliente === v,
              render: (v: string) => v || '-',
            },
            {
              title: 'Produto',
              render: (_: any, r: any) =>
                [r.produtoCodigo, r.produtoDescricao].filter(Boolean).join(' — ') ||
                '-',
            },
            {
              title: 'Classificação',
              dataIndex: 'classificacao',
              width: 160,
              filters: L.classificacao.map((o) => ({
                text: o.label,
                value: o.value,
              })),
              onFilter: (v: any, r: any) => r.classificacao === v,
              render: (v: string) => rotuloDe(L.classificacao, v),
            },
            {
              title: 'Prioridade',
              dataIndex: 'prioridade',
              width: 110,
              filters: L.prioridade.map((o) => ({
                text: o.label,
                value: o.value,
              })),
              onFilter: (v: any, r: any) => r.prioridade === v,
              render: (v: string) =>
                v ? (
                  <Tag color={COR_PRIORIDADE_RO[v]}>
                    {rotuloDe(L.prioridade, v)}
                  </Tag>
                ) : (
                  '-'
                ),
            },
            {
              title: 'Responsável',
              width: 160,
              render: (_: any, r: any) => r.responsavel?.nome ?? '-',
            },
            {
              title: 'Prazo',
              dataIndex: 'prazoConclusao',
              width: 110,
              sorter: (a: any, b: any) =>
                String(a.prazoConclusao ?? '').localeCompare(
                  String(b.prazoConclusao ?? ''),
                ),
              render: (d: string, r: any) => {
                if (!d) return '-';
                const vencido =
                  r.status !== 'ENCERRADA' &&
                  dayjs(String(d).slice(0, 10)).isBefore(dayjs().startOf('day'));
                return (
                  <span style={vencido ? { color: '#cf1322' } : undefined}>
                    {dataBR(d)}
                  </span>
                );
              },
            },
            {
              title: 'Custo (peças)',
              dataIndex: 'custoTotal',
              width: 120,
              align: 'right',
              sorter: (a: any, b: any) =>
                (a.custoTotal ?? 0) - (b.custoTotal ?? 0),
              render: (v: number) =>
                v == null
                  ? '-'
                  : v.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    }),
            },
            {
              title: 'Blocos concluídos',
              width: 130,
              render: (_: any, r: any) => <Flags blocos={r.blocos} />,
            },
            {
              title: 'Status',
              dataIndex: 'status',
              width: 150,
              filters: L.status.map((o) => ({ text: o.label, value: o.value })),
              onFilter: (v: any, r: any) => r.status === v,
              render: (v: string) => (
                <Tag color={COR_STATUS_RO[v]}>{rotuloDe(L.status, v)}</Tag>
              ),
            },
            {
              title: 'Ações',
              width: admin ? 150 : 80,
              // A linha inteira abre o R.O: os botoes seguram o clique.
              render: (_: any, r: any) => (
                <Space size={4}>
                  <Button
                    size="small"
                    icon={<FilePdfOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      abrirPdfEmNovaAba(`/ro/reclamacoes/${r.id}/pdf`);
                    }}
                  />
                  {admin && (
                    <Button
                      size="small"
                      danger
                      onClick={(e) => {
                        e.stopPropagation();
                        Modal.confirm({
                          title: `Excluir o R.O ${r.numero}?`,
                          content: 'A exclusão é definitiva.',
                          okText: 'Excluir',
                          okButtonProps: { danger: true },
                          cancelText: 'Cancelar',
                          onOk: () => excluir.mutateAsync(r.id),
                        });
                      }}
                    >
                      Excluir
                    </Button>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </Space>
  );
}
