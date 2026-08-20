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
  message,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useFornecedores, opcoesFornecedor } from '../hooks';
import { semanaAno } from '../semana';
import { FILTROS_DESVIO, situacaoDesvio } from '../components/DesvioQualidade';
import Tabela from '../components/Tabela';
import { TIPOS_DESVIO, rotuloTipoDesvio } from '../tipo-desvio';

export const corStatusRnc: Record<string, string> = {
  EM_ANDAMENTO: 'orange',
  FINALIZADA: 'green',
  CANCELADA: 'default',
};

export const labelStatusRnc: Record<string, string> = {
  EM_ANDAMENTO: 'Em andamento',
  FINALIZADA: 'Finalizada',
  CANCELADA: 'Cancelada',
};

const corEficacia: Record<string, string> = {
  PENDENTE: 'default',
  APROVADO: 'green',
  REPROVADO: 'red',
  NAO_APLICAVEL: 'default',
};

const labelEficacia: Record<string, string> = {
  PENDENTE: 'Pendente',
  APROVADO: 'Satisfatório',
  REPROVADO: 'Não satisfatório',
  NAO_APLICAVEL: 'N/A',
};

export default function RncLista() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const [filtroStatus, setFiltroStatus] = useState<string | undefined>();
  const { data: fornecedores } = useFornecedores();

  const hoje = dayjs();
  const { semana: semanaHoje, ano: anoHoje } = semanaAno(hoje.toDate());

  const { data, isLoading } = useQuery<any[]>({
    queryKey: ['rnc', filtroStatus],
    queryFn: async () =>
      (await api.get('/rnc', { params: { status: filtroStatus } })).data,
  });

  const filtrosDe = (
    valores: (string | undefined)[],
  ): { text: string; value: string }[] =>
    Array.from(new Set(valores.filter(Boolean) as string[]))
      .sort()
      .map((v) => ({ text: v, value: v }));

  const filtrosFornecedor = filtrosDe((data ?? []).map((r) => r.fornecedor?.nome));
  const filtrosItem = filtrosDe((data ?? []).map((r) => r.item?.descricao));
  // O tipo e sempre DIMENSIONAL ou VISUAL; registros antigos guardavam o texto
  // inteiro do desvio, entao a listagem normaliza antes de filtrar e exibir.
  const filtrosTipo = filtrosDe(
    (data ?? []).map((r) => rotuloTipoDesvio(r.tipoDesvio)),
  );

  const salvar = useMutation({
    mutationFn: async (v: any) => (await api.post('/rnc', v)).data,
    onSuccess: (rnc: any) => {
      message.success(`RNC ${rnc.numero} aberta.`);
      qc.invalidateQueries({ queryKey: ['rnc'] });
      setOpen(false);
      form.resetFields();
      navigate(`/rnc/${rnc.id}`);
    },
    onError: () => message.error('Não foi possível abrir a RNC.'),
  });

  return (
    <Card
      title="RNC — Registros de Não Conformidade"
      extra={
        <Space>
          <Select
            allowClear
            placeholder="Filtrar por status"
            style={{ width: 190 }}
            value={filtroStatus}
            onChange={setFiltroStatus}
            options={Object.entries(labelStatusRnc).map(([v, l]) => ({
              value: v,
              label: l,
            }))}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setOpen(true)}
          >
            Abrir RNC
          </Button>
        </Space>
      }
    >
      <Tabela
        busca="Buscar RNC (número, fornecedor, item, desvio...)"
        rowKey="id"
        loading={isLoading}
        dataSource={data}
        scroll={{ x: 'max-content' }}
        onRow={(r) => ({
          onClick: () => navigate(`/rnc/${r.id}`),
          style: { cursor: 'pointer' },
        })}
        columns={[
          { title: 'Número', dataIndex: 'numero', width: 100 },
          {
            title: 'Abertura',
            dataIndex: 'dataAbertura',
            width: 110,
            defaultSortOrder: 'descend',
            sorter: (a: any, b: any) =>
              dayjs(a.dataAbertura).valueOf() - dayjs(b.dataAbertura).valueOf(),
            render: (d: string) => dayjs(d).format('DD/MM/YYYY'),
          },
          { title: 'Semana', dataIndex: 'semana', width: 90, render: (v?: string) => v ?? '-' },
          { title: 'Ano', dataIndex: 'ano', width: 80 },
          {
            title: 'Fornecedor',
            filters: filtrosFornecedor,
            onFilter: (v: any, r: any) => r.fornecedor?.nome === v,
            render: (_: any, r: any) => r.fornecedor?.nome,
          },
          {
            title: 'Item',
            filters: filtrosItem,
            onFilter: (v: any, r: any) => r.item?.descricao === v,
            render: (_: any, r: any) => r.item?.descricao,
          },
          {
            title: 'Tipo de desvio',
            dataIndex: 'tipoDesvio',
            width: 160,
            filters: filtrosTipo,
            onFilter: (v: any, r: any) => rotuloTipoDesvio(r.tipoDesvio) === v,
            render: (v?: string) => rotuloTipoDesvio(v) || '-',
          },
          {
            title: 'Reincidência',
            dataIndex: 'reincidencia',
            width: 110,
            align: 'center',
            filters: [
              { text: 'Sim', value: true },
              { text: 'Não', value: false },
            ],
            onFilter: (v: any, r: any) => r.reincidencia === v,
            render: (v: boolean) =>
              v ? <Tag color="red">Sim</Tag> : <Tag>Não</Tag>,
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
            title: 'Valor (R$)',
            dataIndex: 'valorTotal',
            width: 120,
            align: 'right',
            sorter: (a: any, b: any) =>
              (a.valorTotal ?? 0) - (b.valorTotal ?? 0),
            render: (v?: number) =>
              v
                ? Number(v).toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                  })
                : '-',
          },
          {
            title: 'Status',
            dataIndex: 'status',
            width: 130,
            filters: Object.entries(labelStatusRnc).map(([value, text]) => ({
              text,
              value,
            })),
            onFilter: (v: any, r: any) => r.status === v,
            render: (s: string) => (
              <Tag color={corStatusRnc[s]}>{labelStatusRnc[s] ?? s}</Tag>
            ),
          },
          {
            title: 'Eficácia',
            dataIndex: 'verificacaoEficacia',
            width: 110,
            filters: Object.entries(labelEficacia).map(([value, text]) => ({
              text,
              value,
            })),
            onFilter: (v: any, r: any) => r.verificacaoEficacia === v,
            render: (e: string) => (
              <Tag color={corEficacia[e]}>{labelEficacia[e] ?? e}</Tag>
            ),
          },
          // Lead time INTERNO: da abertura ao envio do documento ao
          // fornecedor. So existe na tela; nao entra no PDF da RNC.
          {
            title: 'Envio ao fornecedor',
            dataIndex: 'enviadaFornecedor',
            width: 150,
            filters: [
              { text: 'Enviada', value: true },
              { text: 'Não enviada', value: false },
            ],
            onFilter: (v: any, r: any) => !!r.enviadaFornecedor === v,
            render: (_: any, r: any) =>
              r.enviadaFornecedor ? (
                <Tag color="green">
                  {r.leadTimeEnvioDias != null
                    ? `Enviada — ${r.leadTimeEnvioDias} dia(s)`
                    : 'Enviada'}
                </Tag>
              ) : (
                <Tag color="orange">Não enviada</Tag>
              ),
          },
        ]}
      />

      <Modal
        title="Abrir RNC (Registro de Não Conformidade)"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={salvar.isPending}
        okText="Abrir RNC"
        cancelText="Cancelar"
        width={680}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(v) => salvar.mutate(v)}
          style={{ marginTop: 12 }}
        >
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item label="Data de abertura">
                <Input value={hoje.format('DD/MM/YYYY')} disabled />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Semana">
                <Input value={semanaHoje} disabled />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Ano">
                <Input value={String(anoHoje)} disabled />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
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
            </Col>
            <Col span={12}>
              <Form.Item
                name="itemDescricao"
                label="Item (descrição)"
                rules={[{ required: true, message: 'Informe o item.' }]}
              >
                <Input placeholder="Ex.: Chapa de aço galvanizado 2mm" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="itemCodigo" label="Código do item">
            <Input placeholder="Opcional" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="notaFiscal" label="Nota Fiscal">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="po" label="PO">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="quantidadeLote" label="Qtd. do lote">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="tipoDesvio" label="Tipo de desvio">
            <Select
              allowClear
              placeholder="Dimensional ou Visual"
              options={TIPOS_DESVIO.map((t) => ({ value: t, label: t }))}
            />
          </Form.Item>
          <Form.Item
            name="descricaoDesvio"
            label="Descrição do desvio"
            rules={[{ required: true, message: 'Descreva o desvio.' }]}
          >
            <Input.TextArea rows={3} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="quantidadePecas" label="Qtd. de peças afetadas">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="valorUnitario" label="Valor unitário (R$)">
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={2}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="disposicao" label="Disposição">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
