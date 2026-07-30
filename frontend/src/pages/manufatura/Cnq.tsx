import { useState } from 'react';
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Typography,
  message,
} from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { dataBR, dataInput, separadoresBR } from '../../formatos';

// Custo da Nao Qualidade — espelha a aba "Defeitos e CNQ" da planilha.
// Total = quantidade x valor unitario, calculado no backend.

const moeda = (v: number) =>
  (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function Cnq() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState<any>(null);
  const [form] = Form.useForm();
  const [salvando, setSalvando] = useState(false);

  const quantidade = Form.useWatch('quantidade', form);
  const valorUnitario = Form.useWatch('valorUnitario', form);

  const { data, isLoading } = useQuery<any[]>({
    queryKey: ['manufatura-cnq'],
    queryFn: async () => (await api.get('/manufatura/cnq')).data,
  });

  const { data: maquinas } = useQuery<any[]>({
    queryKey: ['maquinas'],
    queryFn: async () => (await api.get('/maquinas')).data,
  });

  const { data: tipos } = useQuery<any[]>({
    queryKey: ['tipos-defeito'],
    queryFn: async () => (await api.get('/tipos-defeito')).data,
  });

  const total = (data ?? []).reduce((s, c) => s + (c.valorTotal ?? 0), 0);
  const pecas = (data ?? []).reduce((s, c) => s + (c.quantidade ?? 0), 0);

  function abrir(registro?: any) {
    setEditando(registro ?? null);
    form.resetFields();
    form.setFieldsValue(
      registro
        ? {
            ...registro,
            data: dataInput(registro.data),
          }
        : {
            data: dayjs().format('YYYY-MM-DD'),
            quantidade: 1,
          },
    );
    setOpen(true);
  }

  async function salvar() {
    const v = await form.validateFields();
    setSalvando(true);
    try {
      if (editando) await api.patch(`/manufatura/cnq/${editando.id}`, v);
      else await api.post('/manufatura/cnq', v);
      message.success('Lançamento de CNQ salvo.');
      qc.invalidateQueries({ queryKey: ['manufatura-cnq'] });
      setOpen(false);
    } catch (e: any) {
      message.error(
        e?.response?.data?.message ?? 'Não foi possível salvar o lançamento.',
      );
    } finally {
      setSalvando(false);
    }
  }

  async function remover(id: number) {
    try {
      await api.delete(`/manufatura/cnq/${id}`);
      message.success('Lançamento excluído.');
      qc.invalidateQueries({ queryKey: ['manufatura-cnq'] });
    } catch (e: any) {
      message.error(
        e?.response?.data?.message ?? 'Não foi possível excluir o lançamento.',
      );
    }
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Row gutter={16}>
        <Col span={8}>
          <Card>
            <Statistic title="CNQ total" value={moeda(total)} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="Peças lançadas" value={pecas} {...separadoresBR} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="Lançamentos" value={data?.length ?? 0} />
          </Card>
        </Col>
      </Row>

      <Card
        title="Custo da Não Qualidade (CNQ)"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => abrir()}>
            Novo lançamento
          </Button>
        }
      >
        <Table
          rowKey="id"
          size="small"
          loading={isLoading}
          dataSource={data}
          scroll={{ x: 1200 }}
          columns={[
            { title: 'Número', dataIndex: 'numero', width: 120 },
            {
              title: 'Data',
              dataIndex: 'data',
              width: 110,
              render: (d: string) => dataBR(d),
            },
            {
              title: 'Máquina',
              width: 170,
              render: (_: any, r: any) => r.maquina?.nome ?? '-',
            },
            {
              title: 'Item',
              render: (_: any, r: any) =>
                [r.itemCodigo, r.itemDescricao].filter(Boolean).join(' — ') || '-',
            },
            {
              title: 'Descrição do Defeito',
              width: 200,
              render: (_: any, r: any) => r.tipoDefeito?.nome ?? '-',
            },
            {
              title: 'Qtd.',
              dataIndex: 'quantidade',
              width: 80,
              align: 'right',
            },
            {
              title: 'Valor unit.',
              dataIndex: 'valorUnitario',
              width: 120,
              align: 'right',
              render: moeda,
            },
            {
              title: 'Total',
              dataIndex: 'valorTotal',
              width: 130,
              align: 'right',
              render: (v: number) => <strong>{moeda(v)}</strong>,
            },
            { title: 'Ação', dataIndex: 'acao', width: 200 },
            {
              title: '',
              width: 110,
              fixed: 'right',
              render: (_: any, r: any) => (
                <Space size={0}>
                  <Button
                    type="text"
                    icon={<FileTextOutlined />}
                    title="Abrir 8D a partir deste CNQ"
                    onClick={() => navigate(`/manufatura/8d?cnqId=${r.id}`)}
                  />
                  <Button
                    type="text"
                    icon={<EditOutlined />}
                    onClick={() => abrir(r)}
                  />
                  <Popconfirm
                    title="Excluir este lançamento?"
                    okText="Excluir"
                    cancelText="Cancelar"
                    onConfirm={() => remover(r.id)}
                  >
                    <Button type="text" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={open}
        title={editando ? `CNQ ${editando.numero}` : 'Novo lançamento de CNQ'}
        width={760}
        okText="Salvar"
        cancelText="Cancelar"
        confirmLoading={salvando}
        onOk={salvar}
        onCancel={() => setOpen(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="data" label="Data">
                <Input type="date" />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item
                name="maquinaId"
                label="Máquina / Linha"
                rules={[{ required: true, message: 'Selecione a máquina' }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={(maquinas ?? []).map((m) => ({
                    value: m.id,
                    label: `${m.codigo} — ${m.nome}`,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="itemCodigo" label="Nº Item">
                <Input />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item name="itemDescricao" label="Descrição do item">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="tipoDefeitoId"
            label="Descrição do Defeito"
            rules={[{ required: true, message: 'Selecione o defeito' }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              options={(tipos ?? []).map((t) => ({
                value: t.id,
                label: t.nome,
              }))}
            />
          </Form.Item>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="quantidade" label="Quantidade">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="valorUnitario" label="Valor unitário (R$)">
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Total">
                <Typography.Text strong style={{ fontSize: 18 }}>
                  {moeda((quantidade ?? 0) * (valorUnitario ?? 0))}
                </Typography.Text>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="acao" label="Ação">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="observacoes" label="Observações">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
