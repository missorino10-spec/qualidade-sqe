import { useState } from 'react';
import {
  Button,
  Card,
  Form,
  Modal,
  Space,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { useAuth } from '../auth';
import {
  CamposFornecedor,
  valoresIniciaisFornecedor,
} from '../components/CamposFornecedor';
import Tabela, { filtrosDe } from '../components/Tabela';
import { corClasse } from '../fornecedor';

export default function Fornecedores() {
  const qc = useQueryClient();
  const { usuario } = useAuth();
  const admin = usuario?.papel === 'ADMIN';
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
      message.success('Fornecedor salvo.');
      qc.invalidateQueries({ queryKey: ['fornecedores'] });
      fechar();
    },
    onError: () => message.error('Não foi possível salvar o fornecedor.'),
  });

  // Inativar e o caminho normal: o fornecedor some dos formularios novos, mas
  // continua valendo nas inspecoes, RNCs e homologacoes ja lancadas.
  const alternarAtivo = useMutation({
    mutationFn: async (f: any) =>
      api.patch(`/fornecedores/${f.id}`, { ativo: !f.ativo }),
    onSuccess: (_r, f) => {
      message.success(f.ativo ? 'Fornecedor inativado.' : 'Fornecedor reativado.');
      qc.invalidateQueries({ queryKey: ['fornecedores'] });
    },
    onError: () => message.error('Não foi possível alterar a situação.'),
  });

  // Excluir de verdade e so do ADMIN. Se o fornecedor ja estiver em uso, o
  // proprio backend devolve o motivo.
  const excluir = useMutation({
    mutationFn: async (f: any) => api.delete(`/fornecedores/${f.id}`),
    onSuccess: () => {
      message.success('Fornecedor excluído.');
      qc.invalidateQueries({ queryKey: ['fornecedores'] });
    },
    onError: (e: any) =>
      message.error(
        e?.response?.data?.message ?? 'Não foi possível excluir o fornecedor.',
      ),
  });

  function confirmarExclusao(f: any) {
    Modal.confirm({
      title: `Excluir o fornecedor ${f.nome}?`,
      content:
        'A exclusão é definitiva. Se o fornecedor já tiver inspeção, RNC ou homologação, o sistema recusa a exclusão — nesse caso use "Inativar".',
      okText: 'Excluir',
      okButtonProps: { danger: true },
      cancelText: 'Cancelar',
      onOk: () => excluir.mutateAsync(f),
    });
  }

  function abrir(f?: any) {
    setEditando(f ?? null);
    // A ultima apuracao do IDF vem junto do fornecedor so para a tela explicar
    // a origem da classe — nao e campo de cadastro e nao entra no formulario.
    const { ultimaApuracao, ...campos } = f ?? {};
    form.setFieldsValue(f ? campos : valoresIniciaisFornecedor);
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
            // A classe e a mesma do painel do SQE — e quem manda na
            // periodicidade de inspecao. Debaixo dela vai de onde ela veio:
            // sem a origem, um "C" na tela nao diz se foi apurado ou digitado.
            title: 'Classificação',
            dataIndex: 'classificacaoFornecimento',
            width: 150,
            align: 'center',
            filters: [
              ...filtrosDe(
                (data ?? []).map((f) =>
                  f.eventual ? null : f.classificacaoFornecimento,
                ),
              ),
              { text: 'Eventual', value: 'EVENTUAL' },
              { text: 'Sem avaliação', value: 'SEM_AVALIACAO' },
            ],
            onFilter: (v: any, r: any) =>
              v === 'EVENTUAL'
                ? !!r.eventual
                : v === 'SEM_AVALIACAO'
                  ? !r.eventual && !r.ultimaApuracao
                  : !r.eventual && r.classificacaoFornecimento === v,
            render: (c: string, r: any) => {
              if (r.eventual) return <Tag>Eventual</Tag>;
              const ap = r.ultimaApuracao;
              const origem = !ap
                ? 'Sem avaliação'
                : ap.classe === c
                  ? ap.periodo
                  : 'Definida manualmente';
              return (
                <Tooltip
                  title={
                    !ap
                      ? 'Nenhum trimestre do IDF fechado ainda. A classe atual é a do cadastro e será sobrescrita no primeiro fechamento.'
                      : ap.classe === c
                        ? `Apurada no fechamento do trimestre ${ap.periodo}, no painel de Avaliação de fornecedores.`
                        : `O trimestre ${ap.periodo} apurou ${ap.classe}. O valor atual foi alterado no cadastro e vale até o próximo fechamento de trimestre.`
                  }
                >
                  <Space direction="vertical" size={0}>
                    <Tag
                      color={corClasse[c]}
                      style={{ marginInlineEnd: 0, fontWeight: 700 }}
                    >
                      {c}
                    </Tag>
                    <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                      {origem}
                    </Typography.Text>
                  </Space>
                </Tooltip>
              );
            },
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
            width: admin ? 230 : 160,
            render: (_: any, f: any) => (
              <Space size={4}>
                <Button size="small" onClick={() => abrir(f)}>
                  Editar
                </Button>
                <Button
                  size="small"
                  onClick={() => alternarAtivo.mutate(f)}
                  loading={alternarAtivo.isPending}
                >
                  {f.ativo ? 'Inativar' : 'Reativar'}
                </Button>
                {admin && (
                  <Button size="small" danger onClick={() => confirmarExclusao(f)}>
                    Excluir
                  </Button>
                )}
              </Space>
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
          <CamposFornecedor
            mostrarAtivo={!!editando}
            mostrarEventual
            ultimaApuracao={editando?.ultimaApuracao}
          />
        </Form>
      </Modal>
    </Card>
  );
}
