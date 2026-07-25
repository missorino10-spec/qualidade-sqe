import { useState } from 'react';
import {
  Button,
  Card,
  DatePicker,
  Form,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  message,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { api } from '../api';
import {
  useFornecedores,
  useItens,
  opcoesFornecedor,
  opcoesItem,
} from '../hooks';

function semanaAtual() {
  const d = dayjs();
  const week = String(Math.ceil((d.date() + d.startOf('month').day()) / 7));
  return `${d.year()}-W${d.format('WW') || week}`;
}

export default function Planejamento() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const { data: fornecedores } = useFornecedores();
  const { data: itens } = useItens();

  const { data, isLoading } = useQuery<any[]>({
    queryKey: ['planejamento'],
    queryFn: async () => (await api.get('/planejamento-semanal')).data,
  });

  const salvar = useMutation({
    mutationFn: async (v: any) =>
      api.post('/planejamento-semanal', {
        ...v,
        dataPrevista: v.dataPrevista ? v.dataPrevista.toISOString() : undefined,
      }),
    onSuccess: () => {
      message.success('Planejamento criado');
      qc.invalidateQueries({ queryKey: ['planejamento'] });
      setOpen(false);
      form.resetFields();
    },
    onError: () => message.error('Erro ao salvar'),
  });

  const marcarEntregue = useMutation({
    mutationFn: async (id: number) =>
      api.patch(`/planejamento-semanal/${id}/entregue`),
    onSuccess: () => {
      message.success('Marcado como entregue');
      qc.invalidateQueries({ queryKey: ['planejamento'] });
    },
  });

  return (
    <Card
      title="Planejamento Semanal de Inspeções"
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            form.setFieldsValue({ semanaReferencia: semanaAtual() });
            setOpen(true);
          }}
        >
          Novo Planejamento
        </Button>
      }
    >
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={data}
        columns={[
          { title: 'Semana', dataIndex: 'semanaReferencia', width: 110 },
          { title: 'Fornecedor', render: (_: any, r: any) => r.fornecedor?.nome },
          {
            title: 'Item',
            render: (_: any, r: any) => r.item?.descricao ?? '(todos)',
          },
          {
            title: 'Data prevista',
            dataIndex: 'dataPrevista',
            render: (d?: string) => (d ? dayjs(d).format('DD/MM/YYYY') : '-'),
          },
          {
            title: 'Status',
            dataIndex: 'status',
            width: 120,
            render: (s: string) =>
              s === 'ENTREGUE' ? (
                <Tag color="green">Entregue</Tag>
              ) : (
                <Tag color="orange">Pendente</Tag>
              ),
          },
          {
            title: 'Ações',
            width: 150,
            render: (_: any, r: any) =>
              r.status !== 'ENTREGUE' && (
                <Button
                  size="small"
                  onClick={() => marcarEntregue.mutate(r.id)}
                  loading={marcarEntregue.isPending}
                >
                  Marcar entregue
                </Button>
              ),
          },
        ]}
      />
      <Modal
        title="Novo Planejamento Semanal"
        open={open}
        onCancel={() => setOpen(false)}
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
          <Form.Item
            name="semanaReferencia"
            label="Semana de referência"
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { value: semanaAtual(), label: `Semana atual (${semanaAtual()})` },
              ]}
              placeholder="Ex: 2026-W28"
              showSearch
            />
          </Form.Item>
          <Form.Item
            name="fornecedorId"
            label="Fornecedor"
            rules={[{ required: true }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              options={opcoesFornecedor(fornecedores)}
            />
          </Form.Item>
          <Form.Item name="itemId" label="Item (opcional)">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              options={opcoesItem(itens)}
            />
          </Form.Item>
          <Form.Item name="dataPrevista" label="Data prevista">
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
