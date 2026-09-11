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
import { api } from '../api';
import Tabela from '../components/Tabela';
import { CabecalhoPagina } from '../design/painel';
import { BotaoEditar } from '../design/acoes';
import { COR, ESPACO, TEXTO } from '../design/tokens';
import { numeroBR } from '../formatos';
import { ACAO_CLASSE, corClasse, ROTULO_CLASSE } from '../fornecedor';
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

function TagClasse({ c }: { c?: string | null }) {
  if (!c) return <Typography.Text type="secondary">—</Typography.Text>;
  return (
    <Tag color={corClasse[c]} style={{ fontWeight: 600 }}>
      {c} — {ROTULO_CLASSE[c]}
    </Tag>
  );
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
      message.success(
        `Competência ${res.competencia} fechada. ${res.fechados} fornecedor(es) avaliado(s), ${res.reclassificados} com mudança de classe.`,
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

  return (
    <Space direction="vertical" size={ESPACO.lg} style={{ width: '100%' }}>
      <CabecalhoPagina
        titulo="Avaliação de fornecedores — IDF"
        descricao="IDF = Conformidade (50%) + Resposta à RNC (30%) + Plano de ação (20%). A classe apurada substitui a classificação do fornecedor e define a periodicidade de inspeção."
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
                      content:
                        'As notas voltam a ser recalculadas a partir dos dados atuais das inspeções e das RNCs. A classe já aplicada nos fornecedores só muda quando você fechar de novo. Deseja continuar?',
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
                      title: `Fechar a competência ${MESES[mes - 1]}/${ano}`,
                      content:
                        'Isto congela as notas do período, registra o histórico e aplica a classe apurada em cada fornecedor — o que muda a periodicidade de inspeção no recebimento. Deseja continuar?',
                      okText: 'Fechar competência',
                      cancelText: 'Cancelar',
                      onOk: () => fechar.mutate(),
                    })
                  }
                >
                  Fechar competência
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
            ? `Período de apuração: ${new Date(data.periodoInicio).toLocaleDateString('pt-BR')} a ${new Date(data.periodoFim).toLocaleDateString('pt-BR')}. A competência fecha no dia 26: RNC aberta até o dia 26 conta neste mês, do dia 27 em diante cai no mês seguinte. O tempo de resposta é contado do envio da RNC ao fornecedor até o retorno dele — RNC ainda não enviada fica de fora do C2 e do C3.`
            : undefined
        }
      />

      <Row gutter={[ESPACO.lg, ESPACO.lg]}>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic
              title="Fornecedores avaliados"
              value={avaliados.length}
              suffix={`/ ${linhas.length}`}
              valueStyle={{ color: TEXTO.forte }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic
              title="IDF médio da competência"
              value={
                avaliados.length
                  ? avaliados.reduce((s, l) => s + l.idf, 0) / avaliados.length
                  : 0
              }
              precision={2}
              valueStyle={{ color: TEXTO.forte }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic
              title="Em atenção (C)"
              value={avaliados.filter((l) => l.classificacao === 'C').length}
              valueStyle={{ color: COR.atencao }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic
              title="Críticos (D)"
              value={avaliados.filter((l) => l.classificacao === 'D').length}
              valueStyle={{ color: COR.critico }}
            />
          </Card>
        </Col>
      </Row>

      <Card title={`Apuração de ${MESES[mes - 1]} de ${ano}`}>
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
            { title: 'Fornecedor', dataIndex: 'nome' },
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
              title: 'IDF',
              dataIndex: 'idf',
              width: 90,
              align: 'center',
              render: (v: number | null) =>
                v === null ? (
                  <Tooltip title="Sem recebimento na competência — fica de fora da média do trimestre.">
                    <Typography.Text type="secondary">—</Typography.Text>
                  </Tooltip>
                ) : (
                  <strong style={{ fontSize: 15 }}>{numeroBR(v, 2)}</strong>
                ),
            },
            {
              title: 'Classificação',
              dataIndex: 'classificacao',
              width: 180,
              align: 'center',
              render: (c: string | null) => <TagClasse c={c} />,
            },
            {
              title: 'Ação',
              width: 260,
              render: (_: any, r: any) =>
                r.classificacao ? (
                  <Typography.Text style={{ fontSize: 12 }} type="secondary">
                    {ACAO_CLASSE[r.classificacao]}
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
      </Card>

      <Card
        title={`Consolidado de ${ano} — trimestres calendário e anual`}
        extra={
          resumo && (
            <Typography.Text type="secondary">
              {resumo.avaliados} avaliado(s) · média geral{' '}
              {numeroBR(resumo.mediaGeral ?? 0, 2)} · A {resumo.porClasse.A} ·
              B {resumo.porClasse.B} · C {resumo.porClasse.C} · D{' '}
              {resumo.porClasse.D}
            </Typography.Text>
          )
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
            ...MESES.map((m, i) => ({
              title: m.slice(0, 3),
              width: 70,
              align: 'center' as const,
              render: (_: any, r: any) =>
                r.meses[i] === null ? (
                  <Typography.Text type="secondary">—</Typography.Text>
                ) : (
                  numeroBR(r.meses[i], 2)
                ),
            })),
            ...[1, 2, 3, 4].map((t) => ({
              title: `${t}T`,
              width: 90,
              align: 'center' as const,
              render: (_: any, r: any) =>
                r.trimestres[t - 1] === null ? (
                  <Typography.Text type="secondary">—</Typography.Text>
                ) : (
                  <Tag color={corClasse[r.classesTrimestre[t - 1]]}>
                    {numeroBR(r.trimestres[t - 1], 2)}
                  </Tag>
                ),
            })),
            {
              title: 'Anual',
              dataIndex: 'anual',
              width: 110,
              align: 'center',
              render: (v: number | null) =>
                v === null ? (
                  <Typography.Text type="secondary">—</Typography.Text>
                ) : (
                  <strong>{numeroBR(v, 2)}</strong>
                ),
            },
            {
              title: 'Classificação anual',
              dataIndex: 'classificacaoAnual',
              width: 180,
              align: 'center',
              render: (c: string | null) => <TagClasse c={c} />,
            },
          ]}
        />
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
    </Space>
  );
}
