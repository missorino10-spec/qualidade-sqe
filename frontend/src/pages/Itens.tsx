import { useState } from 'react';
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Table,
  message,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

interface Item {
  id: number;
  codigo: string;
  descricao: string;
  unidade?: string;
  fornecedorId?: number;
  fornecedor?: { id: number; nome: string };
}

export default function Itens() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState<Item | null>(null);
  const [form] = Form.useForm();

  const { data, isLoading } = useQuery<Item[]>({
    queryKey: ['itens'],
    queryFn: async () => (await api.get('/itens')).data,
  });
  const { data: fornecedores } = useQuery<any[]>({
    queryKey: ['fornecedores'],
    queryFn: async () => (await api.get('/fornecedores')).data,
  });

  const salvar = useMutation({
    mutationFn: async (values: any) => {
      if (editando) return api.patch(`/itens/${editando.id}`, values);
      return api.post('/itens', values);
    },
    onSuccess: () => {
      message.success('Item salvo.');
      qc.invalidateQueries({ queryKey: ['itens'] });
      fechar();
    },
    onError: () => message.error('Não foi possível salvar o item.'),
  });

  function abrir(i?: Item) {
    setEditando(i ?? null);
    form.setFieldsValue(
      i ?? { codigo: '', descricao: '', unidade: '', fornecedorId: undefined },
    );
    setOpen(true);
  }
  function fechar() {
    setOpen(false);
    setEditando(null);
    form.resetFields();
  }

  return (
    <Card
      title="Itens / Peças"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => abrir()}>
          Novo item
        </Button>
      }
    >
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={data}
        scroll={{ x: 'max-content' }}
        columns={[
          { title: 'Código', dataIndex: 'codigo', width: 130 },
          { title: 'Descrição', dataIndex: 'descricao' },
          { title: 'Unid.', dataIndex: 'unidade', width: 80 },
          {
            title: 'Fornecedor',
            render: (_: any, i: Item) => i.fornecedor?.nome ?? '-',
          },
          {
            title: 'Ações',
            width: 100,
            render: (_: any, i: Item) => (
              <Button size="small" onClick={() => abrir(i)}>
                Editar
              </Button>
            ),
          },
        ]}
      />
      <Modal
        title={editando ? 'Editar item' : 'Novo item'}
        open={open}
        onCancel={fechar}
        onOk={() => form.submit()}
        confirmLoading={salvar.isPending}
        okText="Salvar"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(v) => salvar.mutate(v)}
          style={{ marginTop: 12 }}
        >
          <Form.Item name="codigo" label="Código" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="descricao" label="Descrição" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="unidade" label="Unidade">
            <Input placeholder="PC, UN, KG..." />
          </Form.Item>
          <Form.Item name="fornecedorId" label="Fornecedor">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Selecione"
              options={fornecedores?.map((f) => ({ value: f.id, label: f.nome }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
