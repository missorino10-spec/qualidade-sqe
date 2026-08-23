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
  Tag,
  message,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api';
import { useAuth } from '../../auth';
import Tabela, { filtrosDe } from '../../components/Tabela';

// Cadastro das maquinas/linhas. O lancamento da producao diaria e o PPM ficam
// na tela "Produção diária / PPM".

export const AREAS = [
  { value: 'FABRICACAO', label: 'Fabricação' },
  { value: 'MONTAGEM', label: 'Montagem' },
];

export default function Maquinas() {
  const qc = useQueryClient();
  const { usuario } = useAuth();
  const admin = usuario?.papel === 'ADMIN';
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

  // Inativar e o caminho normal: a maquina some das telas de lancamento, mas
  // continua valendo nas inspecoes, CNQs e producoes ja registradas.
  const alternarAtiva = useMutation({
    mutationFn: async (m: any) =>
      api.patch(`/maquinas/${m.id}`, { ativa: !m.ativa }),
    onSuccess: (_r, m) => {
      message.success(m.ativa ? 'Máquina inativada.' : 'Máquina reativada.');
      qc.invalidateQueries({ queryKey: ['maquinas'] });
    },
    onError: () => message.error('Não foi possível alterar a situação.'),
  });

  // Excluir de verdade e so do ADMIN. Se a maquina ja estiver em uso, o
  // proprio backend devolve o motivo.
  const excluir = useMutation({
    mutationFn: async (m: any) => api.delete(`/maquinas/${m.id}`),
    onSuccess: () => {
      message.success('Máquina excluída.');
      qc.invalidateQueries({ queryKey: ['maquinas'] });
    },
    onError: (e: any) =>
      message.error(
        e?.response?.data?.message ?? 'Não foi possível excluir a máquina.',
      ),
  });

  function confirmarExclusao(m: any) {
    Modal.confirm({
      title: `Excluir a máquina ${m.codigo}?`,
      content:
        'A exclusão é definitiva. Se a máquina já tiver inspeção, CNQ ou produção apontada, o sistema recusa a exclusão — nesse caso use "Inativar".',
      okText: 'Excluir',
      okButtonProps: { danger: true },
      cancelText: 'Cancelar',
      onOk: () => excluir.mutateAsync(m),
    });
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
        <Tabela
          busca="Buscar máquina / linha (código, nome, área...)"
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
              filters: AREAS.map((a) => ({ text: a.label, value: a.value })),
              onFilter: (v: any, r: any) => r.area === v,
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
              filters: [
                { text: 'Ativa', value: true },
                { text: 'Inativa', value: false },
              ],
              onFilter: (v: any, r: any) => !!r.ativa === v,
              render: (a: boolean) =>
                a ? <Tag color="green">Ativa</Tag> : <Tag>Inativa</Tag>,
            },
            {
              title: 'Ações',
              width: admin ? 230 : 160,
              fixed: 'right' as const,
              render: (_: any, r: any) => (
                <Space size={4}>
                  <Button size="small" onClick={() => abrir(r)}>
                    Editar
                  </Button>
                  <Button
                    size="small"
                    onClick={() => alternarAtiva.mutate(r)}
                    loading={alternarAtiva.isPending}
                  >
                    {r.ativa ? 'Inativar' : 'Reativar'}
                  </Button>
                  {admin && (
                    <Button
                      size="small"
                      danger
                      onClick={() => confirmarExclusao(r)}
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
