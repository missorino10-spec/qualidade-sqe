import { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Tag,
  Typography,
  message,
} from 'antd';
import { EditOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import Tabela from '../components/Tabela';
import { numeroBR } from '../formatos';
import { corClasse } from '../fornecedor';

export default function Periodicidade() {
  const qc = useQueryClient();
  const [editando, setEditando] = useState<any | null>(null);
  const [form] = Form.useForm();

  const { data, isLoading } = useQuery<any[]>({
    queryKey: ['periodicidade'],
    queryFn: async () => (await api.get('/periodicidade')).data,
  });

  const salvar = useMutation({
    mutationFn: async (v: any) =>
      api.patch(`/periodicidade/${editando.classificacao}`, v),
    onSuccess: () => {
      message.success('Periodicidade atualizada.');
      qc.invalidateQueries({ queryKey: ['periodicidade'] });
      setEditando(null);
      form.resetFields();
    },
    onError: () => message.error('Não foi possível salvar as alterações.'),
  });

  function abrir(registro: any) {
    setEditando(registro);
    form.setFieldsValue(registro);
  }

  return (
    <Card
      title="Periodicidade de inspeção por classificação"
      extra={
        <Typography.Text type="secondary">
          Parâmetros que definem quando e como cada fornecedor é inspecionado.
        </Typography.Text>
      }
    >
      <Alert
        style={{ marginBottom: 16 }}
        type="info"
        showIcon
        message="Como funciona"
        description="A classificação (A, B, C ou D) define a frequência de inspeção, o percentual de amostra e o NQA aplicado no recebimento. Quem define a classe de cada fornecedor é o IDF, apurado todo mês na Avaliação de Fornecedores. Ajuste os valores abaixo conforme a política de qualidade da empresa."
      />
      <Tabela
        busca="Buscar classificação"
        rowKey="classificacao"
        loading={isLoading}
        dataSource={data}
        pagination={false}
        scroll={{ x: 'max-content' }}
        columns={[
          {
            title: 'Classificação',
            dataIndex: 'classificacao',
            width: 120,
            render: (c: string) => (
              <Tag color={corClasse[c]} style={{ fontWeight: 600 }}>
                {c}
              </Tag>
            ),
          },
          { title: 'Periodicidade', dataIndex: 'periodicidadeTexto' },
          {
            title: 'Frequência (1 a cada N)',
            dataIndex: 'frequenciaN',
            width: 170,
            align: 'center',
          },
          { title: 'Tipo', dataIndex: 'tipoInspecao', width: 120 },
          { title: 'Nível de inspeção', dataIndex: 'nivelInspecaoTexto' },
          {
            title: 'Nível',
            dataIndex: 'nivelRomano',
            width: 80,
            align: 'center',
          },
          {
            title: 'Amostra',
            dataIndex: 'percentualAmostra',
            width: 100,
            align: 'center',
            render: (v: number) => `${v}%`,
          },
          {
            title: 'NQA',
            dataIndex: 'nqa',
            width: 80,
            align: 'center',
            render: (v: number) => numeroBR(v, 1),
          },
          {
            title: 'Conformidade mín.',
            dataIndex: 'conformidadeMin',
            width: 140,
            align: 'center',
            render: (v: number) => `${v}%`,
          },
          {
            title: 'Ações',
            width: 90,
            render: (_: any, r: any) => (
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => abrir(r)}
              >
                Editar
              </Button>
            ),
          },
        ]}
      />

      <Modal
        title={`Editar classificação ${editando?.classificacao ?? ''}`}
        open={!!editando}
        onCancel={() => setEditando(null)}
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
          <Form.Item name="periodicidadeTexto" label="Periodicidade (descrição)">
            <Input />
          </Form.Item>
          <Form.Item
            name="frequenciaN"
            label="Frequência — inspeciona 1 a cada N entregas"
          >
            <InputNumber style={{ width: '100%' }} min={1} />
          </Form.Item>
          <Form.Item name="tipoInspecao" label="Tipo de inspeção">
            <Input />
          </Form.Item>
          <Form.Item name="nivelInspecaoTexto" label="Nível de inspeção">
            <Input />
          </Form.Item>
          <Form.Item name="nivelRomano" label="Nível (numeração romana)">
            <Input />
          </Form.Item>
          <Form.Item name="percentualAmostra" label="Percentual de amostra (%)">
            <InputNumber style={{ width: '100%' }} min={0} max={100} />
          </Form.Item>
          <Form.Item name="nqa" label="NQA">
            <InputNumber style={{ width: '100%' }} min={0} step={0.1} />
          </Form.Item>
          <Form.Item
            name="conformidadeMin"
            label="Conformidade mínima para manter a classificação (%)"
          >
            <InputNumber style={{ width: '100%' }} min={0} max={100} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
