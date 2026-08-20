import { useState } from 'react';
import {
  Button,
  Card,
  Form,
  Modal,
  Space,
  Tag,
  message,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import {
  CamposFornecedor,
  valoresIniciaisFornecedor,
} from '../components/CamposFornecedor';
import Tabela, { filtrosDe } from '../components/Tabela';

const corClasse: Record<string, string> = {
  A: 'green',
  B: 'blue',
  C: 'orange',
  D: 'red',
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
    form.setFieldsValue(f ?? valoresIniciaisFornecedor);
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
          Novo fornecedor
        </Button>
      }
    >
      <Tabela
        busca="Buscar fornecedor (nome, CNPJ, classe...)"
        rowKey="id"
        loading={isLoading}
        dataSource={data}
        scroll={{ x: 'max-content' }}
        columns={[
          { title: 'Código', dataIndex: 'codigo', width: 110 },
          { title: 'Nome', dataIndex: 'nome' },
          {
            title: 'Tipo de fornecimento',
            dataIndex: 'tipoFornecimento',
            filters: filtrosDe((data ?? []).map((f) => f.tipoFornecimento)),
            onFilter: (v: any, r: any) => r.tipoFornecimento === v,
            render: (v?: string) => v ?? '-',
          },
          {
            title: 'Classificação',
            dataIndex: 'classificacaoFornecimento',
            width: 120,
            align: 'center',
            filters: [
              ...filtrosDe(
                (data ?? []).map((f) =>
                  f.eventual ? null : f.classificacaoFornecimento,
                ),
              ),
              { text: 'Eventual', value: 'EVENTUAL' },
            ],
            onFilter: (v: any, r: any) =>
              v === 'EVENTUAL'
                ? !!r.eventual
                : !r.eventual && r.classificacaoFornecimento === v,
            render: (c: string, r: any) =>
              r.eventual ? (
                <Tag>Eventual</Tag>
              ) : (
                <Tag color={corClasse[c]}>{c}</Tag>
              ),
          },
          {
            title: 'Escopo',
            width: 150,
            filters: [
              { text: 'Visual', value: 'VISUAL' },
              { text: 'Lote', value: 'LOTE' },
            ],
            onFilter: (v: any, r: any) =>
              v === 'VISUAL' ? !!r.fazVisual : !!r.fazLote,
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
            filters: [
              { text: 'Ativo', value: true },
              { text: 'Inativo', value: false },
            ],
            onFilter: (v: any, r: any) => !!r.ativo === v,
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
        title={editando ? 'Editar fornecedor' : 'Novo fornecedor'}
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
          <CamposFornecedor mostrarAtivo={!!editando} mostrarEventual />
        </Form>
      </Modal>
    </Card>
  );
}
