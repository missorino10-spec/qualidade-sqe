import { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
  message,
} from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { useAuth } from '../auth';
import Tabela from '../components/Tabela';
import { moeda, formatarMoedaInput, lerMoedaInput } from '../moeda';
import { opcoesUnidadeItem } from '../unidades';

/**
 * Base de codigos e custo (planilha "Base de Codigos e Custo.xlsx").
 *
 * Sao ~14.400 codigos: a tela NUNCA baixa a lista inteira. Ela pede ao servidor
 * as primeiras linhas que casam com o que foi digitado, do mesmo jeito que o
 * campo de item dos formularios.
 */

const TETO = 200;

interface Item {
  id: number;
  codigo: string;
  descricao: string;
  unidade?: string | null;
  custoUnitario?: number | null;
  ativo: boolean;
  fornecedorId?: number | null;
  fornecedor?: { id: number; nome: string } | null;
}

export default function Itens() {
  const qc = useQueryClient();
  const { usuario } = useAuth();
  const admin = usuario?.papel === 'ADMIN';

  const [busca, setBusca] = useState('');
  const [incluirInativos, setIncluirInativos] = useState(false);
  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState<Item | null>(null);
  const [form] = Form.useForm();

  const { data, isFetching } = useQuery<Item[]>({
    queryKey: ['itens', 'cadastro', busca, incluirInativos],
    queryFn: async () =>
      (
        await api.get('/itens', {
          params: { busca, limite: TETO, incluirInativos },
        })
      ).data,
  });
  const { data: fornecedores } = useQuery<any[]>({
    queryKey: ['fornecedores'],
    queryFn: async () => (await api.get('/fornecedores')).data,
  });

  function invalidar() {
    qc.invalidateQueries({ queryKey: ['itens'] });
  }

  const salvar = useMutation({
    mutationFn: async (values: any) =>
      editando
        ? api.patch(`/itens/${editando.id}`, values)
        : api.post('/itens', values),
    onSuccess: () => {
      message.success('Item salvo.');
      invalidar();
      fechar();
    },
    onError: (e: any) =>
      message.error(
        e?.response?.data?.message ?? 'Não foi possível salvar o item.',
      ),
  });

  // Inativar e o caminho normal: o item some das buscas dos formularios, mas
  // continua valendo nas RNCs e inspecoes antigas que apontam para ele.
  const alternarAtivo = useMutation({
    mutationFn: async (i: Item) =>
      api.patch(`/itens/${i.id}`, { ativo: !i.ativo }),
    onSuccess: (_r, i) => {
      message.success(i.ativo ? 'Item inativado.' : 'Item reativado.');
      invalidar();
    },
    onError: () => message.error('Não foi possível alterar a situação.'),
  });

  // Excluir de verdade e so do ADMIN. Se o item ja estiver em uso, o banco
  // recusa e o proprio backend devolve o motivo.
  const excluir = useMutation({
    mutationFn: async (i: Item) => api.delete(`/itens/${i.id}`),
    onSuccess: () => {
      message.success('Item excluído.');
      invalidar();
    },
    onError: (e: any) =>
      message.error(
        e?.response?.data?.message ?? 'Não foi possível excluir o item.',
      ),
  });

  function abrir(i?: Item) {
    setEditando(i ?? null);
    form.setFieldsValue(
      i ?? {
        codigo: '',
        descricao: '',
        unidade: undefined,
        custoUnitario: undefined,
        fornecedorId: undefined,
      },
    );
    setOpen(true);
  }
  function fechar() {
    setOpen(false);
    setEditando(null);
    form.resetFields();
  }

  function confirmarExclusao(i: Item) {
    Modal.confirm({
      title: `Excluir o item ${i.codigo}?`,
      content:
        'A exclusão é definitiva. Se o item já for usado em alguma inspeção, RNC ou planejamento, o sistema recusa a exclusão — nesse caso use "Inativar".',
      okText: 'Excluir',
      okButtonProps: { danger: true },
      cancelText: 'Cancelar',
      onOk: () => excluir.mutateAsync(i),
    });
  }

  const lista = data ?? [];

  return (
    <Card
      title="Itens — base de códigos e custo"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => abrir()}>
          Novo item
        </Button>
      }
    >
      <Space style={{ marginBottom: 12, width: '100%' }} wrap>
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder="Buscar por código ou descrição"
          style={{ width: 380 }}
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <Space size={6}>
          <Switch
            checked={incluirInativos}
            onChange={setIncluirInativos}
            size="small"
          />
          <Typography.Text type="secondary">Mostrar inativos</Typography.Text>
        </Space>
      </Space>

      {lista.length >= TETO && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message={`Mostrando as ${TETO} primeiras linhas. Refine a busca para encontrar o item.`}
        />
      )}

      <Tabela
        rowKey="id"
        loading={isFetching}
        dataSource={lista}
        scroll={{ x: 'max-content' }}
        columns={[
          { title: 'Código', dataIndex: 'codigo', width: 140 },
          { title: 'Descrição', dataIndex: 'descricao' },
          { title: 'Unid.', dataIndex: 'unidade', width: 80 },
          {
            title: 'Custo unitário',
            dataIndex: 'custoUnitario',
            width: 140,
            align: 'right' as const,
            render: (v: number | null) => moeda(v),
          },
          {
            title: 'Fornecedor',
            width: 200,
            render: (_: any, i: Item) => i.fornecedor?.nome ?? '-',
          },
          {
            title: 'Situação',
            width: 100,
            render: (_: any, i: Item) =>
              i.ativo ? (
                <Tag color="green">Ativo</Tag>
              ) : (
                <Tag color="default">Inativo</Tag>
              ),
          },
          {
            title: 'Ações',
            width: admin ? 230 : 160,
            render: (_: any, i: Item) => (
              <Space size={4}>
                <Button size="small" onClick={() => abrir(i)}>
                  Editar
                </Button>
                <Button
                  size="small"
                  onClick={() => alternarAtivo.mutate(i)}
                  loading={alternarAtivo.isPending}
                >
                  {i.ativo ? 'Inativar' : 'Reativar'}
                </Button>
                {admin && (
                  <Button size="small" danger onClick={() => confirmarExclusao(i)}>
                    Excluir
                  </Button>
                )}
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={editando ? `Editar item ${editando.codigo}` : 'Novo item'}
        open={open}
        onCancel={fechar}
        onOk={() => form.submit()}
        confirmLoading={salvar.isPending}
        okText="Salvar"
        cancelText="Cancelar"
        width={620}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(v) => salvar.mutate(v)}
          style={{ marginTop: 12 }}
        >
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item
                name="codigo"
                label="Código"
                rules={[{ required: true, message: 'Informe o código.' }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item
                name="descricao"
                label="Descrição"
                rules={[{ required: true, message: 'Informe a descrição.' }]}
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              {/* Lista fechada: com o campo aberto a mesma unidade entrava de
                  varios jeitos ("PC", "PÇ", "Peça"). */}
              <Form.Item
                name="unidade"
                label="Unidade"
                rules={[{ required: true, message: 'Escolha a unidade.' }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder="Selecione"
                  options={opcoesUnidadeItem(editando?.unidade)}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="custoUnitario"
                label="Custo unitário"
                tooltip="É este valor que preenche o valor unitário da RNC e do CNQ quando o código é digitado."
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={2}
                  formatter={formatarMoedaInput}
                  parser={lerMoedaInput as any}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="fornecedorId" label="Fornecedor">
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="Selecione"
                  options={fornecedores?.map((f) => ({
                    value: f.id,
                    label: f.nome,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </Card>
  );
}
