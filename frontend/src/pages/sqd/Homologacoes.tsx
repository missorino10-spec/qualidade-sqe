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
  Tag,
  Typography,
  message,
} from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { api, queryDeFiltro } from '../../api';
import { useAuth } from '../../auth';
import FiltroPeriodo, { usarPeriodo } from '../../components/FiltroPeriodo';
import { ExportarLista } from '../../design/acoes';
import { dataBR } from '../../formatos';
import {
  corResultado,
  corStatusHomologacao,
  labelResultado,
  labelSolicitante,
  labelStatusHomologacao,
  nota,
  opcoes,
} from './comum';
import Tabela, { filtrosDe } from '../../components/Tabela';

// Submenu "Homologação de Fornecedores": historico dos registros de homologacao
// (BDBR.QUA.FMR.029.01). O registro nasce aqui, com a data da solicitacao — a
// mesma em que o formulario segue para o fornecedor — e fica aguardando o
// retorno. A autoavaliacao (FMR.024.03) e lancada depois, dentro do registro.
export default function Homologacoes() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const podeEditar =
    usuario?.papel === 'ADMIN' || usuario?.papel === 'QUALIDADE';

  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const [salvando, setSalvando] = useState(false);

  // O recorte e pela data da solicitacao e vale para a lista e para a
  // exportacao: o PDF e a planilha saem com exatamente o que esta na tela.
  const periodo = usarPeriodo();
  const filtro = { de: periodo.de, ate: periodo.ate };

  const { data, isLoading } = useQuery<any[]>({
    queryKey: ['sqd-homologacoes', filtro.de, filtro.ate],
    queryFn: async () =>
      (await api.get('/sqd/homologacoes', { params: filtro })).data,
  });

  function abrir() {
    form.resetFields();
    form.setFieldsValue({ dataSolicitacao: dayjs().format('YYYY-MM-DD') });
    setOpen(true);
  }

  async function salvar() {
    const v = await form.validateFields();
    setSalvando(true);
    try {
      const res = await api.post('/sqd/homologacoes', v);
      message.success(
        `Registro ${res.data.numero} aberto — aguardando o retorno do fornecedor.`,
      );
      qc.invalidateQueries({ queryKey: ['sqd-homologacoes'] });
      setOpen(false);
      navigate(`/sqd/homologacoes/${res.data.id}`);
    } catch (e: any) {
      message.error(
        e?.response?.data?.message ?? 'Não foi possível abrir o registro.',
      );
    } finally {
      setSalvando(false);
    }
  }

  function confirmarExclusao(r: any) {
    Modal.confirm({
      title: `Excluir a homologação ${r.numero}?`,
      content:
        'A autoavaliação, o resultado e os anexos deste registro serão apagados.',
      okText: 'Excluir',
      okButtonProps: { danger: true },
      cancelText: 'Cancelar',
      onOk: async () => {
        try {
          await api.delete(`/sqd/homologacoes/${r.id}`);
          message.success('Homologação excluída.');
          qc.invalidateQueries({ queryKey: ['sqd-homologacoes'] });
        } catch {
          message.error('Não foi possível excluir a homologação.');
        }
      },
    });
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <FiltroPeriodo controle={periodo} />

      <Card
        title="Homologação de Fornecedores"
        extra={
          <Space wrap>
            <ExportarLista
              url={`/sqd/homologacoes/relatorio${queryDeFiltro(filtro)}`}
              nome="homologacao-fornecedores"
            />
            {podeEditar && (
              <Button type="primary" icon={<PlusOutlined />} onClick={abrir}>
                Nova homologação
              </Button>
            )}
          </Space>
        }
      >
        <Tabela
          busca="Buscar homologação (número, fornecedor, status...)"
          rowKey="id"
          size="small"
          loading={isLoading}
          dataSource={data}
          scroll={{ x: 1100 }}
          onRow={(r) => ({
            onClick: () => navigate(`/sqd/homologacoes/${r.id}`),
            style: { cursor: 'pointer' },
          })}
          columns={[
            { title: 'Número', dataIndex: 'numero', width: 130 },
            {
              title: 'Solicitação',
              dataIndex: 'dataSolicitacao',
              width: 110,
              render: (d: string) => dataBR(d),
            },
            {
              title: 'Semana',
              dataIndex: 'semana',
              width: 90,
              filters: filtrosDe((data ?? []).map((r: any) => r.semana)),
              onFilter: (v: any, r: any) => r.semana === v,
            },
            {
              title: 'Fornecedor',
              dataIndex: 'fornecedorNome',
              filters: filtrosDe((data ?? []).map((r: any) => r.fornecedorNome)),
              onFilter: (v: any, r: any) => r.fornecedorNome === v,
            },
            {
              title: 'Solicitante',
              dataIndex: 'solicitante',
              width: 120,
              filters: Object.entries(labelSolicitante).map(([v, t]) => ({
                text: t as string,
                value: v,
              })),
              onFilter: (v: any, r: any) => r.solicitante === v,
              render: (s: string) => (s ? labelSolicitante[s] : '-'),
            },
            {
              title: 'Nota',
              dataIndex: 'nota',
              width: 90,
              align: 'right',
              render: (v: number | null) => <strong>{nota(v)}</strong>,
            },
            {
              title: 'Resultado',
              dataIndex: 'resultado',
              width: 230,
              filters: [
                ...Object.entries(labelResultado).map(([v, t]) => ({
                  text: t as string,
                  value: v,
                })),
                { text: 'Aguardando retorno', value: 'AGUARDANDO' },
              ],
              onFilter: (v: any, r: any) =>
                v === 'AGUARDANDO' ? !r.resultado : r.resultado === v,
              // Enquanto o fornecedor nao devolve o formulario nao existe nota
              // nem resultado: a linha mostra o que o registro esta esperando.
              render: (r: string | null, h: any) =>
                r ? (
                  <Tag color={corResultado[r]}>{labelResultado[r]}</Tag>
                ) : h.statusHomologacao === 'CANCELADO' ? (
                  '-'
                ) : (
                  <Tag>Aguardando retorno do fornecedor</Tag>
                ),
            },
            {
              title: 'Status',
              dataIndex: 'statusHomologacao',
              width: 130,
              filters: Object.entries(labelStatusHomologacao).map(([v, t]) => ({
                text: t as string,
                value: v,
              })),
              onFilter: (v: any, r: any) => r.statusHomologacao === v,
              render: (s: string) => (
                <Tag color={corStatusHomologacao[s]}>
                  {labelStatusHomologacao[s]}
                </Tag>
              ),
            },
            {
              title: '',
              width: 60,
              align: 'center',
              render: (_: any, r: any) =>
                podeEditar && (
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      confirmarExclusao(r);
                    }}
                  />
                ),
            },
          ]}
        />
      </Card>

      <Modal
        open={open}
        title="Nova homologação de fornecedor — Doc. BDBR.QUA.FMR.029.01"
        width={720}
        okText="Abrir registro"
        cancelText="Cancelar"
        confirmLoading={salvando}
        onOk={salvar}
        onCancel={() => setOpen(false)}
        destroyOnHidden
      >
        <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
          A data da solicitação é a mesma em que o formulário de autoavaliação
          segue para o fornecedor: ela numera o registro e é o marco zero dos
          prazos. O registro fica "Em andamento", aguardando o retorno; a
          autoavaliação é lançada depois, dentro do próprio registro.
        </Typography.Paragraph>
        <Form form={form} layout="vertical">
          <Row gutter={12}>
            <Col span={14}>
              <Form.Item
                name="fornecedorNome"
                label="Fornecedor"
                rules={[{ required: true, message: 'Informe o fornecedor.' }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item
                name="dataSolicitacao"
                label="Data da solicitação"
                rules={[
                  { required: true, message: 'Informe a data da solicitação.' },
                ]}
              >
                <Input type="date" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="cnpj" label="CNPJ">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="codigoFornecedor" label="Código do fornecedor">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="solicitante" label="Solicitante">
                <Select allowClear options={opcoes(labelSolicitante)} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="segmento" label="Segmento">
                <Input />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="escopoFornecedor" label="Escopo do fornecedor">
                <Input.TextArea rows={2} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item
                name="processosTerceirizados"
                label="Processos terceirizados"
              >
                <Input.TextArea rows={2} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="observacoes" label="Observações">
                <Input.TextArea rows={2} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </Space>
  );
}
