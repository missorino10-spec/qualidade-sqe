import { useState } from 'react';
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  message,
} from 'antd';
import { EditOutlined, PlusOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api';

// Cadastro das maquinas/linhas. O lancamento da producao diaria e o PPM ficam
// na tela "Produção diária / PPM".

export const AREAS = [
  { value: 'FABRICACAO', label: 'Fabricação' },
  { value: 'MONTAGEM', label: 'Montagem' },
];

export default function Maquinas() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState<any>(null);
  const [form] = Form.useForm();
  const [salvando, setSalvando] = useState(false);

  const { data, isLoading } = useQuery<any[]>({
    queryKey: ['maquinas', 'todas'],
    queryFn: async () =>
      (await api.get('/maquinas', { params: { todas: 'true' } })).data,
  });

  function abrir(maquina?: any) {
    setEditando(maquina ?? null);
    form.resetFields();
    form.setFieldsValue(maquina ?? { area: 'FABRICACAO', ativa: true });
    setOpen(true);
  }

  async function salvar() {
    const v = await form.validateFields();
    setSalvando(true);
    try {
      if (editando) await api.patch(`/maquinas/${editando.id}`, v);
      else await api.post('/maquinas', v);
      message.success('Máquina salva.');
      qc.invalidateQueries({ queryKey: ['maquinas'] });
      setOpen(false);
    } catch (e: any) {
      message.error(
        e?.response?.data?.message ?? 'Não foi possível salvar a máquina.',
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card
        title="Cadastro de máquinas e linhas"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => abrir()}>
            Nova máquina
          </Button>
        }
      >
        <Table
          rowKey="id"
          size="small"
          loading={isLoading}
          dataSource={data}
          scroll={{ x: 800 }}
          columns={[
            { title: 'Código', dataIndex: 'codigo', width: 110 },
            { title: 'Máquina / linha', dataIndex: 'nome', width: 220 },
            {
              title: 'Área',
              dataIndex: 'area',
              width: 130,
              render: (a: string) =>
                AREAS.find((x) => x.value === a)?.label ?? a,
            },
            {
              title: 'Descrição',
              dataIndex: 'descricao',
              render: (d: string) => d || '-',
            },
            {
              title: 'Status',
              dataIndex: 'ativa',
              width: 100,
              align: 'center',
              render: (a: boolean) =>
                a ? <Tag color="green">Ativa</Tag> : <Tag>Inativa</Tag>,
            },
            {
              title: '',
              width: 60,
              fixed: 'right',
              align: 'center',
              render: (_: any, r: any) => (
                <Button
                  type="text"
                  icon={<EditOutlined />}
                  onClick={() => abrir(r)}
                />
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={open}
        title={editando ? `Máquina ${editando.codigo}` : 'Nova máquina'}
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
              <Form.Item
                name="codigo"
                label="Código"
                rules={[{ required: true, message: 'Informe o código.' }]}
              >
                <Input placeholder="MAQ16" />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item
                name="nome"
                label="Máquina / linha"
                rules={[{ required: true, message: 'Informe o nome.' }]}
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="area" label="Área">
            <Select options={AREAS} />
          </Form.Item>
          <Form.Item name="descricao" label="Descrição">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="ativa" label="Ativa" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
