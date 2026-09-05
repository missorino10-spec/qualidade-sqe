import { useMemo, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Tag,
  Typography,
  message,
} from 'antd';
import { PlusOutlined, UserAddOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useFornecedores, opcoesFornecedor } from '../hooks';
import { dataBR } from '../formatos';
import { semanaAno } from '../semana';
import Tabela from '../components/Tabela';
import { SelectItem } from '../components/CamposItem';
import {
  CamposFornecedor,
  valoresIniciaisFornecedor,
} from '../components/CamposFornecedor';
import { COR } from '../design/tokens';

// Registro de Entrada - a chegada da carga, ponto de partida do SQE.
//
// O inspetor escolhe o fornecedor e o sistema responde na hora se aquela
// entrega cai no ciclo de periodicidade. Fora do ciclo, o registro se encerra
// aqui: fica gravado que o fornecedor chegou naquele dia sem inspecao, e nada
// alem do fornecedor e exigido. Dentro do ciclo - ou quando a Qualidade decide
// fazer uma inspecao extra - a tela leva direto para a inspecao, que se prende
// a esta entrada.

const labelSituacao: Record<string, string> = {
  FORA_DO_CICLO: 'Fora do ciclo',
  INSPECAO_PENDENTE: 'Inspeção pendente',
  INSPECAO_REALIZADA: 'Inspeção realizada',
  INSPECAO_EXTRA: 'Inspeção extra',
};

const corSituacao: Record<string, string> = {
  FORA_DO_CICLO: 'default',
  INSPECAO_PENDENTE: 'orange',
  INSPECAO_REALIZADA: 'blue',
  INSPECAO_EXTRA: 'volcano',
};

export default function RegistrosEntrada() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [open, setOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [fornecedorFiltro, setFornecedorFiltro] = useState<number | undefined>();

  // Cadastro pontual do fornecedor que ainda nao esta na base.
  const [openFornecedor, setOpenFornecedor] = useState(false);
  const [formFornecedor] = Form.useForm();
  const [salvandoFornecedor, setSalvandoFornecedor] = useState(false);

  const fornecedorId = Form.useWatch('fornecedorId', form);
  const extra = Form.useWatch('extra', form);

  const hoje = dayjs();
  const { semana: semanaHoje, ano: anoHoje } = semanaAno(hoje.toDate());

  const { data: fornecedores } = useFornecedores();

  const { data, isLoading } = useQuery<any[]>({
    queryKey: ['registros-entrada', fornecedorFiltro],
    queryFn: async () =>
      (
        await api.get('/registros-entrada', {
          params: fornecedorFiltro
            ? { fornecedorId: fornecedorFiltro }
            : undefined,
        })
      ).data,
  });

  // A mesma conta do servidor, so para a tela mostrar a decisao antes de gravar.
  const { data: avaliacao } = useQuery<any>({
    queryKey: ['avaliar', fornecedorId],
    queryFn: async () =>
      (await api.get(`/inspecoes/avaliar?fornecedorId=${fornecedorId}`)).data,
    enabled: !!fornecedorId,
  });

  const noCiclo = avaliacao?.precisaInspecionar ?? false;
  const extraAtivo = !noCiclo && !!extra;
  const vaiInspecionar = noCiclo || extraAtivo;

  const lista = data ?? [];
  const totais = useMemo(() => {
    const conta = (s: string) => lista.filter((e) => e.situacao === s).length;
    return {
      entradas: lista.length,
      foraDoCiclo: conta('FORA_DO_CICLO'),
      inspecionadas: conta('INSPECAO_REALIZADA') + conta('INSPECAO_EXTRA'),
      pendentes: conta('INSPECAO_PENDENTE'),
    };
  }, [lista]);

  function novoRegistro() {
    form.resetFields();
    form.setFieldsValue({ extra: false });
    setOpen(true);
  }

  async function salvar(v: any) {
    setSalvando(true);
    try {
      const res = (
        await api.post('/registros-entrada', {
          fornecedorId: v.fornecedorId,
          itemId: v.itemId,
          notaFiscal: v.notaFiscal,
          po: v.po,
          qtdTotal: v.qtdTotal,
          extra: extraAtivo,
          dataEntrega: hoje.toISOString(),
        })
      ).data;

      setOpen(false);
      qc.invalidateQueries({ queryKey: ['registros-entrada'] });
      qc.invalidateQueries({ queryKey: ['avaliar'] });
      qc.invalidateQueries({ queryKey: ['fornecedores'] });
      qc.invalidateQueries({ queryKey: ['kpis'] });

      // Cai no ciclo (ou extra): a inspecao continua na tela de Inspeções,
      // presa a esta entrada.
      if (res.irParaInspecao) {
        message.success(
          res.extra
            ? 'Entrada registrada como inspeção extra. Prossiga com a inspeção.'
            : 'Entrada registrada e dentro do ciclo. Prossiga com a inspeção.',
        );
        navigate(`/inspecoes?entrada=${res.entrega.id}`);
        return;
      }
      message.success(
        'Entrada registrada. O fornecedor está fora do ciclo, então não há inspeção.',
      );
    } catch (e: any) {
      message.error(
        e?.response?.data?.message ?? 'Não foi possível registrar a entrada.',
      );
    } finally {
      setSalvando(false);
    }
  }

  // Nasce eventual: fica fora do plano de periodicidade, mas com o cadastro
  // completo, pronto para quando for classificado.
  async function salvarFornecedorPontual(v: any) {
    setSalvandoFornecedor(true);
    try {
      const novo = (
        await api.post('/fornecedores', {
          ...v,
          eventual: true,
          contatos: (v.contatos ?? []).filter((c: any) => c && c.nome),
        })
      ).data;
      await qc.invalidateQueries({ queryKey: ['fornecedores'] });
      setOpenFornecedor(false);
      formFornecedor.resetFields();
      form.setFieldsValue({ fornecedorId: novo.id });
      message.success(`Fornecedor ${novo.nome} cadastrado.`);
    } catch {
      message.error('Não foi possível cadastrar o fornecedor.');
    } finally {
      setSalvandoFornecedor(false);
    }
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Row justify="space-between" align="middle" gutter={[12, 12]}>
        <Col>
          <Typography.Title level={4} style={{ margin: 0 }}>
            Registro de Entrada
          </Typography.Title>
          <Typography.Text type="secondary">
            A chegada da carga. Fora do ciclo, encerra aqui; dentro do ciclo,
            segue para a inspeção.
          </Typography.Text>
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={novoRegistro}>
            Nova entrada
          </Button>
        </Col>
      </Row>

      <Card size="small">
        <Form layout="vertical" style={{ marginBottom: -16 }}>
          <Row gutter={12}>
            <Col xs={24} sm={12} lg={8}>
              <Form.Item label="Fornecedor">
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="Todos os fornecedores"
                  value={fornecedorFiltro}
                  onChange={setFornecedorFiltro}
                  options={opcoesFornecedor(fornecedores)}
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      <Row gutter={[16, 16]}>
        {[
          { titulo: 'Entradas', valor: totais.entradas },
          { titulo: 'Fora do ciclo', valor: totais.foraDoCiclo },
          { titulo: 'Inspecionadas', valor: totais.inspecionadas },
          {
            titulo: 'Inspeção pendente',
            valor: totais.pendentes,
            cor: totais.pendentes ? COR.critico : undefined,
          },
        ].map((c) => (
          <Col xs={12} lg={6} key={c.titulo}>
            <Card>
              <Statistic
                title={c.titulo}
                value={c.valor}
                valueStyle={c.cor ? { color: c.cor } : undefined}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Tabela
        rowKey="id"
        loading={isLoading}
        dataSource={lista}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: 'Nenhuma entrada registrada' }}
        columns={[
          {
            title: 'Data',
            dataIndex: 'dataEntrega',
            width: 110,
            render: (v: string) => dataBR(v),
          },
          { title: 'Semana', dataIndex: 'semana', width: 80 },
          {
            title: 'Fornecedor',
            dataIndex: ['fornecedor', 'nome'],
            render: (v: string, r: any) => (
              <Space size={4} wrap>
                <span>{v}</span>
                {r.fornecedor?.eventual ? (
                  <Tag>Eventual</Tag>
                ) : (
                  <Tag color="blue">
                    {r.fornecedor?.classificacaoFornecimento}
                  </Tag>
                )}
              </Space>
            ),
          },
          {
            title: 'Item',
            dataIndex: ['item', 'descricao'],
            render: (v: string, r: any) =>
              r.item ? `${r.item.codigo} — ${v}` : '-',
          },
          { title: 'Nota Fiscal', dataIndex: 'notaFiscal', width: 120 },
          { title: 'PO', dataIndex: 'po', width: 110 },
          {
            title: 'Situação',
            dataIndex: 'situacao',
            width: 150,
            render: (v: string) => (
              <Tag color={corSituacao[v]}>{labelSituacao[v] ?? v}</Tag>
            ),
          },
          {
            title: 'Inspeção',
            dataIndex: 'numeroInspecao',
            width: 150,
            render: (v: string, r: any) =>
              v ? (
                <Button
                  type="link"
                  size="small"
                  style={{ padding: 0 }}
                  onClick={() => navigate(`/inspecoes/${r.id}`)}
                >
                  {v}
                </Button>
              ) : r.situacao === 'INSPECAO_PENDENTE' ? (
                <Button
                  type="link"
                  size="small"
                  style={{ padding: 0 }}
                  onClick={() => navigate(`/inspecoes?entrada=${r.id}`)}
                >
                  Inspecionar
                </Button>
              ) : (
                '-'
              ),
          },
          {
            title: 'Registrado por',
            dataIndex: ['registradoPor', 'nome'],
            width: 160,
          },
        ]}
      />

      <Modal
        open={open}
        title="Nova entrada"
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={salvando}
        okText={vaiInspecionar ? 'Registrar e inspecionar' : 'Registrar entrada'}
        cancelText="Cancelar"
        width={720}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={salvar}>
          <Row gutter={12}>
            <Col span={16}>
              <Form.Item
                name="fornecedorId"
                label="Fornecedor"
                rules={[
                  { required: true, message: 'Escolha o fornecedor.' },
                ]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder="Escolha o fornecedor"
                  options={opcoesFornecedor(fornecedores)}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label=" ">
                <Button
                  icon={<UserAddOutlined />}
                  onClick={() => {
                    formFornecedor.setFieldsValue(valoresIniciaisFornecedor);
                    setOpenFornecedor(true);
                  }}
                  block
                >
                  Novo fornecedor
                </Button>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={8}>
              <Form.Item label="Data da entrada">
                <Input value={hoje.format('DD/MM/YYYY')} disabled />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Semana">
                <Input value={semanaHoje} disabled />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Ano">
                <Input value={String(anoHoje)} disabled />
              </Form.Item>
            </Col>
          </Row>

          {/* Decisao do ciclo: classificacao + periodicidade + contador */}
          {fornecedorId && avaliacao && (
            <Descriptions
              size="small"
              bordered
              column={{ xs: 1, sm: 2, md: 2, lg: 2, xl: 2, xxl: 2 }}
              style={{ marginBottom: 12 }}
            >
              <Descriptions.Item label="Classificação">
                {avaliacao.eventual ? (
                  <Tag>Eventual</Tag>
                ) : (
                  <Tag color="blue">
                    {avaliacao.fornecedor?.classificacaoFornecimento}
                  </Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Periodicidade">
                {avaliacao.eventual
                  ? 'Fora do plano de periodicidade'
                  : (avaliacao.periodicidade?.periodicidadeTexto ??
                    `1 a cada ${avaliacao.frequenciaN} entregas`)}
              </Descriptions.Item>
              <Descriptions.Item label="Entregas no ciclo">
                {avaliacao.eventual
                  ? '-'
                  : `${avaliacao.proximoContador} de ${avaliacao.frequenciaN}`}
              </Descriptions.Item>
              <Descriptions.Item label="Escopo">
                {avaliacao.fornecedor?.fazVisual && (
                  <Tag color="geekblue">Visual</Tag>
                )}
                {avaliacao.fornecedor?.fazLote && <Tag color="purple">Lote</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="Decisão" span={2}>
                {noCiclo ? (
                  <Tag color="orange">Esta entrega DEVE ser inspecionada</Tag>
                ) : extraAtivo ? (
                  <Tag color="volcano">
                    Inspeção EXTRA — fora do ciclo, por decisão da Qualidade
                  </Tag>
                ) : (
                  <Tag color="green">
                    Fora do ciclo — recebimento sem inspeção
                  </Tag>
                )}
              </Descriptions.Item>
            </Descriptions>
          )}

          {/* Fora da janela do ciclo a Qualidade pode inspecionar do mesmo
              jeito: os formularios sao escolhidos na tela de inspecao. */}
          {fornecedorId && !noCiclo && (
            <Card size="small" style={{ marginBottom: 12 }}>
              <Form.Item
                name="extra"
                label="Realizar inspeção extra"
                valuePropName="checked"
                extra="A inspeção extra conta nos indicadores e reinicia o ciclo de periodicidade do fornecedor."
                style={{ marginBottom: 0 }}
              >
                <Switch checkedChildren="Sim" unCheckedChildren="Não" />
              </Form.Item>
            </Card>
          )}

          {/* Tudo opcional: fora do ciclo basta o fornecedor para encerrar. */}
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="itemId" label="Item">
                <SelectItem allowClear placeholder="Opcional" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="qtdTotal" label="Qtd. recebida">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="notaFiscal" label="Nota Fiscal">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="po" label="PO">
                <Input />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        open={openFornecedor}
        title="Novo fornecedor"
        onCancel={() => setOpenFornecedor(false)}
        onOk={() => formFornecedor.submit()}
        confirmLoading={salvandoFornecedor}
        okText="Cadastrar"
        cancelText="Cancelar"
        width={900}
        destroyOnClose
      >
        <Form
          form={formFornecedor}
          layout="vertical"
          onFinish={salvarFornecedorPontual}
        >
          <CamposFornecedor />
        </Form>
      </Modal>
    </Space>
  );
}
