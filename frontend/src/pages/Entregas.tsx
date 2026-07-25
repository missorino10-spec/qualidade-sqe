import { useState } from 'react';
import {
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { PlusOutlined, WarningOutlined, AuditOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import {
  useFornecedores,
  useItens,
  opcoesFornecedor,
  opcoesItem,
} from '../hooks';

export default function Entregas() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const { data: fornecedores } = useFornecedores();
  const { data: itens } = useItens();

  const { data, isLoading } = useQuery<any[]>({
    queryKey: ['entregas'],
    queryFn: async () => (await api.get('/entregas')).data,
  });

  const salvar = useMutation({
    mutationFn: async (v: any) =>
      (
        await api.post('/entregas', {
          ...v,
          dataEntrega: v.dataEntrega ? v.dataEntrega.toISOString() : undefined,
        })
      ).data,
    onSuccess: (entrega: any) => {
      qc.invalidateQueries({ queryKey: ['entregas'] });
      setOpen(false);
      form.resetFields();
      if (entrega.passivelInspecao) {
        avisarInspecao(entrega);
      } else {
        message.success('Entrega registrada. Nesta entrega não há inspeção.');
      }
    },
    onError: () => message.error('Não foi possível registrar a entrega.'),
  });

  function avisarInspecao(entrega: any) {
    const forn = entrega.fornecedor ?? {};
    const escopos: string[] = [];
    if (forn.fazVisual) escopos.push('Visual');
    if (forn.fazLote) escopos.push('Lote (Dimensional)');
    Modal.confirm({
      icon: <WarningOutlined style={{ color: '#D37119' }} />,
      title: 'Entrega passível de inspeção',
      width: 480,
      content: (
        <div>
          <p style={{ marginBottom: 8 }}>
            Conforme a classificação <strong>{forn.classificacaoFornecimento}</strong>{' '}
            do fornecedor <strong>{forn.nome}</strong>, esta entrega deve ser
            inspecionada.
          </p>
          <p style={{ margin: 0 }}>
            Formulário(s) sugerido(s):{' '}
            <strong>{escopos.length ? escopos.join(' e ') : 'Visual'}</strong>.
          </p>
        </div>
      ),
      okText: 'Ir para Inspeções',
      cancelText: 'Depois',
      onOk: () =>
        navigate(
          `/inspecoes?entregaId=${entrega.id}&fornecedorId=${entrega.fornecedorId}` +
            (entrega.itemId ? `&itemId=${entrega.itemId}` : ''),
        ),
    });
  }

  return (
    <Card
      title="Entregas / Portaria"
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            form.setFieldsValue({ dataEntrega: dayjs() });
            setOpen(true);
          }}
        >
          Registrar Entrega
        </Button>
      }
    >
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={data}
        columns={[
          {
            title: 'Data',
            dataIndex: 'dataEntrega',
            width: 110,
            render: (d: string) => dayjs(d).format('DD/MM/YYYY'),
          },
          {
            title: 'Semana',
            dataIndex: 'semanaReferencia',
            width: 100,
            render: (v?: string) => v ?? '-',
          },
          { title: 'Fornecedor', render: (_: any, r: any) => r.fornecedor?.nome },
          { title: 'Item', render: (_: any, r: any) => r.item?.descricao ?? '-' },
          { title: 'Nota Fiscal', dataIndex: 'notaFiscal', width: 120 },
          { title: 'PO', dataIndex: 'po', width: 110, render: (v?: string) => v ?? '-' },
          { title: 'Qtd.', dataIndex: 'quantidade', width: 80 },
          {
            title: 'Inspeção',
            width: 150,
            render: (_: any, r: any) => {
              const temInsp =
                (r.inspecoesVisual?.length ?? 0) + (r.inspecoesLote?.length ?? 0) >
                0;
              if (temInsp) return <Tag color="green">Inspecionada</Tag>;
              if (r.passivelInspecao)
                return (
                  <Button
                    size="small"
                    icon={<AuditOutlined />}
                    onClick={() =>
                      navigate(
                        `/inspecoes?entregaId=${r.id}&fornecedorId=${r.fornecedorId}` +
                          (r.itemId ? `&itemId=${r.itemId}` : ''),
                      )
                    }
                  >
                    Inspecionar
                  </Button>
                );
              return <Typography.Text type="secondary">Sem inspeção</Typography.Text>;
            },
          },
        ]}
      />
      <Modal
        title="Registrar Entrega (Portaria)"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={salvar.isPending}
        okText="Salvar"
        cancelText="Cancelar"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(v) => salvar.mutate(v)}
          style={{ marginTop: 12 }}
        >
          <Form.Item
            name="fornecedorId"
            label="Fornecedor"
            rules={[{ required: true, message: 'Selecione o fornecedor.' }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              options={opcoesFornecedor(fornecedores)}
            />
          </Form.Item>
          <Form.Item name="itemId" label="Item">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              options={opcoesItem(itens)}
            />
          </Form.Item>
          <Form.Item name="dataEntrega" label="Data da entrega">
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Space style={{ display: 'flex' }} align="start">
            <Form.Item name="notaFiscal" label="Nota Fiscal" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
            <Form.Item name="po" label="PO" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
          </Space>
          <Form.Item name="quantidade" label="Quantidade">
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
