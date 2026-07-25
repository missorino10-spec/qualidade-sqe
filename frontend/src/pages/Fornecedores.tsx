import { useState } from 'react';
import {
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

const corClasse: Record<string, string> = {
  A: 'green',
  B: 'blue',
  C: 'orange',
  D: 'red',
};

const labelEsforco: Record<string, string> = {
  BAIXO: 'Baixo',
  MEDIO: 'Médio',
  ALTO: 'Alto',
};

export default function Fornecedores() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState<any | null>(null);
  const [form] = Form.useForm();

  const { data, isLoading } = useQuery<any[]>({
    queryKey: ['fornecedores'],
    queryFn: async () => (await api.get('/fornecedores')).data,
  });

  const salvar = useMutation({
    mutationFn: async (values: any) => {
      const payload = {
        ...values,
        contatos: (values.contatos ?? []).filter((c: any) => c && c.nome),
      };
      if (editando)
        return api.patch(`/fornecedores/${editando.id}`, payload);
      return api.post('/fornecedores', payload);
    },
    onSuccess: () => {
      message.success('Fornecedor salvo com sucesso.');
      qc.invalidateQueries({ queryKey: ['fornecedores'] });
      fechar();
    },
    onError: () => message.error('Não foi possível salvar o fornecedor.'),
  });

  function abrir(f?: any) {
    setEditando(f ?? null);
    form.setFieldsValue(
      f ?? {
        esforcoQualidade: 'MEDIO',
        classificacaoFornecimento: 'C',
        fazVisual: true,
        fazLote: false,
        contatos: [],
      },
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
      title="Fornecedores"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => abrir()}>
          Novo Fornecedor
        </Button>
      }
    >
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={data}
        columns={[
          { title: 'Código', dataIndex: 'codigo', width: 110 },
          { title: 'Nome', dataIndex: 'nome' },
          {
            title: 'Tipo de fornecimento',
            dataIndex: 'tipoFornecimento',
            render: (v?: string) => v ?? '-',
          },
          {
            title: 'Classificação',
            dataIndex: 'classificacaoFornecimento',
            width: 120,
            align: 'center',
            render: (c: string) => <Tag color={corClasse[c]}>{c}</Tag>,
          },
          {
            title: 'Escopo',
            width: 150,
            render: (_: any, r: any) => (
              <Space size={4}>
                {r.fazVisual && <Tag color="geekblue">Visual</Tag>}
                {r.fazLote && <Tag color="purple">Lote</Tag>}
                {!r.fazVisual && !r.fazLote && '-'}
              </Space>
            ),
          },
          {
            title: 'Situação',
            dataIndex: 'ativo',
            width: 100,
            render: (a: boolean) =>
              a ? <Tag color="green">Ativo</Tag> : <Tag>Inativo</Tag>,
          },
          {
            title: 'Ações',
            width: 90,
            render: (_: any, f: any) => (
              <Button size="small" onClick={() => abrir(f)}>
                Editar
              </Button>
            ),
          },
        ]}
      />
      <Modal
        title={editando ? 'Editar Fornecedor' : 'Novo Fornecedor'}
        open={open}
        onCancel={fechar}
        onOk={() => form.submit()}
        confirmLoading={salvar.isPending}
        okText="Salvar"
        cancelText="Cancelar"
        width={760}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(v) => salvar.mutate(v)}
          style={{ marginTop: 12 }}
        >
          <Divider orientation="left" plain>
            Identificação
          </Divider>
          <Row gutter={12}>
            <Col span={6}>
              <Form.Item
                name="codigo"
                label="Código"
                rules={[{ required: true, message: 'Informe o código.' }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="nome"
                label="Nome"
                rules={[{ required: true, message: 'Informe o nome.' }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="cnpj" label="CNPJ">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="endereco" label="Endereço">
            <Input />
          </Form.Item>

          <Divider orientation="left" plain>
            Escopo e Classificação
          </Divider>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="tipoFornecimento" label="Tipo de fornecimento">
                <Input placeholder="Ex.: Estruturas metálicas" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="categoriaInspecao" label="Categoria de inspeção">
                <Input placeholder="Ex.: Metalurgia / Montagem" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="planoInspecao" label="Plano de inspeção (resumo)">
            <Input />
          </Form.Item>
          <Form.Item name="controlesPrincipais" label="Controles principais">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="escopoTexto" label="Escopo (texto livre)">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item
                name="classificacaoFornecimento"
                label="Classificação de fornecimento"
              >
                <Select
                  options={[
                    { value: 'A', label: 'A — Excelente' },
                    { value: 'B', label: 'B — Bom' },
                    { value: 'C', label: 'C — Regular' },
                    { value: 'D', label: 'D — Crítico' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="esforcoQualidade" label="Esforço de qualidade">
                <Select
                  options={Object.entries(labelEsforco).map(([v, l]) => ({
                    value: v,
                    label: l,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item
                name="fazVisual"
                label="Inspeção Visual"
                valuePropName="checked"
              >
                <Switch checkedChildren="Sim" unCheckedChildren="Não" />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item
                name="fazLote"
                label="Inspeção de Lote"
                valuePropName="checked"
              >
                <Switch checkedChildren="Sim" unCheckedChildren="Não" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" plain>
            Contatos (até 2)
          </Divider>
          <Form.List name="contatos">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field) => (
                  <Row gutter={8} key={field.key} align="middle">
                    <Col span={6}>
                      <Form.Item
                        {...field}
                        name={[field.name, 'nome']}
                        label="Nome"
                        rules={[{ required: true, message: 'Informe o nome.' }]}
                      >
                        <Input />
                      </Form.Item>
                    </Col>
                    <Col span={7}>
                      <Form.Item
                        {...field}
                        name={[field.name, 'email']}
                        label="E-mail"
                      >
                        <Input />
                      </Form.Item>
                    </Col>
                    <Col span={5}>
                      <Form.Item
                        {...field}
                        name={[field.name, 'telefone']}
                        label="Telefone"
                      >
                        <Input />
                      </Form.Item>
                    </Col>
                    <Col span={5}>
                      <Form.Item
                        {...field}
                        name={[field.name, 'funcao']}
                        label="Função"
                      >
                        <Input />
                      </Form.Item>
                    </Col>
                    <Col span={1}>
                      <Button type="link" danger onClick={() => remove(field.name)}>
                        Remover
                      </Button>
                    </Col>
                  </Row>
                ))}
                {fields.length < 2 && (
                  <Button
                    type="dashed"
                    onClick={() => add()}
                    block
                    icon={<PlusOutlined />}
                  >
                    Adicionar contato
                  </Button>
                )}
              </>
            )}
          </Form.List>

          {editando && (
            <Form.Item
              name="ativo"
              label="Fornecedor ativo"
              valuePropName="checked"
              style={{ marginTop: 16 }}
            >
              <Switch checkedChildren="Ativo" unCheckedChildren="Inativo" />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </Card>
  );
}
