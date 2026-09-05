import { useState } from 'react';
import {
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
  Tag,
  Typography,
  message,
} from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../auth';
import { dataBR } from '../../formatos';
import {
  FILTROS_DESVIO,
  situacaoDesvio,
} from '../../components/DesvioQualidade';
import {
  corResultadoItem,
  corStatusHomologacao,
  labelMotivoItem,
  labelResultadoItem,
  labelSolicitanteItem,
  labelStatusHomologacao,
  opcoes,
} from './comum';
import Tabela, { filtrosDe } from '../../components/Tabela';
import { CamposItem } from '../../components/CamposItem';
import { formatarMoedaInput, lerMoedaInput } from '../../moeda';

// Submenu "Homologação de Itens": historico dos registros de homologacao de
// item (BDBR.QUA.FMR.025.01). O registro nasce aqui, com a data da solicitacao
// — a mesma em que as amostras sao pedidas ao fornecedor — e fica aguardando o
// retorno. O relatorio de inspecao (abas Amostras e Visual) e lancado depois,
// dentro do proprio registro.
export default function HomologacoesItens() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const podeEditar =
    usuario?.papel === 'ADMIN' || usuario?.papel === 'QUALIDADE';

  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const [salvando, setSalvando] = useState(false);

  const { data, isLoading } = useQuery<any[]>({
    queryKey: ['sqd-homologacoes-itens'],
    queryFn: async () => (await api.get('/sqd/homologacoes-itens')).data,
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
      const res = await api.post('/sqd/homologacoes-itens', v);
      message.success(
        `Registro ${res.data.numero} aberto — aguardando as amostras do fornecedor.`,
      );
      qc.invalidateQueries({ queryKey: ['sqd-homologacoes-itens'] });
      setOpen(false);
      navigate(`/sqd/homologacoes-itens/${res.data.id}`);
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
        'Os relatórios de inspeção, o resultado e os anexos deste registro serão apagados.',
      okText: 'Excluir',
      okButtonProps: { danger: true },
      cancelText: 'Cancelar',
      onOk: async () => {
        try {
          await api.delete(`/sqd/homologacoes-itens/${r.id}`);
          message.success('Homologação excluída.');
          qc.invalidateQueries({ queryKey: ['sqd-homologacoes-itens'] });
        } catch {
          message.error('Não foi possível excluir a homologação.');
        }
      },
    });
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card
        title="Homologação de Itens"
        extra={
          podeEditar && (
            <Button type="primary" icon={<PlusOutlined />} onClick={abrir}>
              Nova homologação de item
            </Button>
          )
        }
      >
        <Tabela
          busca="Buscar item homologado (número, item, fornecedor...)"
          rowKey="id"
          size="small"
          loading={isLoading}
          dataSource={data}
          scroll={{ x: 1400 }}
          onRow={(r) => ({
            onClick: () => navigate(`/sqd/homologacoes-itens/${r.id}`),
            style: { cursor: 'pointer' },
          })}
          columns={[
            { title: 'Número', dataIndex: 'numero', width: 130 },
            {
              title: 'Rev.',
              dataIndex: 'revisao',
              width: 70,
              align: 'center',
            },
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
              width: 200,
              filters: filtrosDe((data ?? []).map((r: any) => r.fornecedorNome)),
              onFilter: (v: any, r: any) => r.fornecedorNome === v,
            },
            {
              title: 'Item',
              dataIndex: 'itemCodigo',
              width: 240,
              filters: filtrosDe((data ?? []).map((r: any) => r.itemCodigo)),
              onFilter: (v: any, r: any) => r.itemCodigo === v,
              render: (c: string, h: any) => (
                <span>
                  <strong>{c || '-'}</strong>
                  {h.itemDescricao ? ` — ${h.itemDescricao}` : ''}
                </span>
              ),
            },
            {
              title: 'Motivo',
              dataIndex: 'motivo',
              width: 150,
              filters: Object.entries(labelMotivoItem).map(([v, t]) => ({
                text: t as string,
                value: v,
              })),
              onFilter: (v: any, r: any) => r.motivo === v,
              render: (m: string) => (m ? labelMotivoItem[m] : '-'),
            },
            {
              title: 'Solicitante',
              dataIndex: 'solicitante',
              width: 120,
              filters: Object.entries(labelSolicitanteItem).map(([v, t]) => ({
                text: t as string,
                value: v,
              })),
              onFilter: (v: any, r: any) => r.solicitante === v,
              render: (s: string) => (s ? labelSolicitanteItem[s] : '-'),
            },
            {
              title: 'Tentativas',
              dataIndex: 'tentativas',
              width: 100,
              align: 'center',
            },
            {
              title: 'Resultado',
              dataIndex: 'resultado',
              width: 230,
              filters: [
                ...Object.entries(labelResultadoItem).map(([v, t]) => ({
                  text: t as string,
                  value: v,
                })),
                { text: 'Aguardando amostras', value: 'AGUARDANDO' },
              ],
              onFilter: (v: any, r: any) =>
                v === 'AGUARDANDO' ? !r.resultado : r.resultado === v,
              // Enquanto as amostras nao chegam nao existe relatorio nem
              // resultado: a linha mostra o que o registro esta esperando.
              render: (r: string | null, h: any) =>
                r ? (
                  <Tag color={corResultadoItem[r]}>{labelResultadoItem[r]}</Tag>
                ) : h.statusHomologacao === 'CANCELADO' ? (
                  '-'
                ) : (
                  <Tag>Aguardando amostras do fornecedor</Tag>
                ),
            },
            {
              title: 'Desvio de qualidade',
              dataIndex: 'desvioQualidade',
              width: 150,
              align: 'center',
              filters: FILTROS_DESVIO,
              onFilter: (v: any, r: any) => situacaoDesvio(r).valor === v,
              render: (_: any, r: any) => {
                const s = situacaoDesvio(r);
                return <Tag color={s.cor}>{s.texto}</Tag>;
              },
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
        title="Nova homologação de item — Doc. BDBR.QUA.FMR.025.01"
        width={760}
        okText="Abrir registro"
        cancelText="Cancelar"
        confirmLoading={salvando}
        onOk={salvar}
        onCancel={() => setOpen(false)}
        destroyOnClose
      >
        <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
          A data da solicitação é a mesma em que as amostras são pedidas ao
          fornecedor: ela numera o registro e é o marco zero dos prazos. O
          registro fica "Em andamento", aguardando as amostras; o relatório de
          inspeção (Amostras e Visual) é lançado depois, dentro do próprio
          registro.
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
            <Col span={10}>
              <Form.Item name="codigoFornecedor" label="Código do fornecedor">
                <Input />
              </Form.Item>
            </Col>
            <Col span={24}>
              {/* Codigo primeiro: achando na base, a descricao vem sozinha.
                  Item novo (o caso comum aqui) continua livre para digitar. */}
              <CamposItem
                form={form}
                codigoObrigatorio
                rotuloDescricao="Descrição do item"
              />
            </Col>
            <Col span={8}>
              <Form.Item name="solicitante" label="Solicitante">
                <Select allowClear options={opcoes(labelSolicitanteItem)} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="motivo" label="Motivo da homologação">
                <Select allowClear options={opcoes(labelMotivoItem)} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="custoEvitado"
                label="Custo evitado"
                tooltip="Savings do FMR.025.01: só entra no painel quando a homologação é finalizada."
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
