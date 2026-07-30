import { useEffect, useState } from 'react';
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
  Table,
  Tag,
  message,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../api';
import { dataBR } from '../../formatos';

// Formulario 8D / Registro de Melhoria — Doc BDBR.QUA.FMR.007.01.
// A abertura pode vir de uma inspecao reprovada ou de um lancamento de CNQ:
// nesses casos a tela e chamada com ?inspecaoId= ou ?cnqId= e ja abre o modal.

export const ORIGENS_8D = [
  { value: 'RELATORIO_RO', label: 'Relatório R.O' },
  { value: 'PRODUCAO', label: 'Produção' },
  { value: 'INSPECAO_EXTRA', label: 'Inspeção Extra' },
  { value: 'SETUP', label: 'Setup' },
];

export const TURNOS_8D = [
  { value: 'COMERCIAL', label: 'Comercial' },
  { value: 'SEGUNDO_TURNO', label: '2º turno' },
];

export const corStatus8D: Record<string, string> = {
  AGUARDANDO: 'orange',
  EM_ANDAMENTO: 'blue',
  CONCLUIDO: 'green',
};

export const labelStatus8D: Record<string, string> = {
  AGUARDANDO: 'Aguardando',
  EM_ANDAMENTO: 'Em andamento',
  CONCLUIDO: 'Concluído',
};

export default function OitoD() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const [salvando, setSalvando] = useState(false);

  const inspecaoId = params.get('inspecaoId');
  const cnqId = params.get('cnqId');

  const { data, isLoading } = useQuery<any[]>({
    queryKey: ['manufatura-8d'],
    queryFn: async () => (await api.get('/manufatura/8d')).data,
  });

  function abrir(origemVinculo?: { inspecaoId?: number; cnqId?: number }) {
    form.resetFields();
    form.setFieldsValue({
      dataAbertura: dayjs().format('YYYY-MM-DD'),
      status: 'AGUARDANDO',
      turno: 'COMERCIAL',
      ...origemVinculo,
    });
    setOpen(true);
  }

  // Abertura vinda da inspecao ou do CNQ: ja chega com o vinculo preenchido.
  useEffect(() => {
    if (!inspecaoId && !cnqId) return;
    abrir({
      inspecaoId: inspecaoId ? Number(inspecaoId) : undefined,
      cnqId: cnqId ? Number(cnqId) : undefined,
    });
    setParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspecaoId, cnqId]);

  async function salvar() {
    const v = await form.validateFields();
    setSalvando(true);
    try {
      const res = await api.post('/manufatura/8d', v);
      message.success(`8D ${res.data.numero} aberto.`);
      qc.invalidateQueries({ queryKey: ['manufatura-8d'] });
      setOpen(false);
      navigate(`/manufatura/8d/${res.data.id}`);
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Não foi possível abrir o 8D.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card
        title="8D / Registro de Melhoria"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => abrir()}>
            Novo 8D
          </Button>
        }
      >
        <Table
          rowKey="id"
          size="small"
          loading={isLoading}
          dataSource={data}
          scroll={{ x: 1100 }}
          onRow={(r) => ({
            onClick: () => navigate(`/manufatura/8d/${r.id}`),
            style: { cursor: 'pointer' },
          })}
          columns={[
            { title: 'Número', dataIndex: 'numero', width: 120 },
            {
              title: 'Abertura',
              dataIndex: 'dataAbertura',
              width: 110,
              render: (d: string) => dataBR(d),
            },
            { title: 'Produto / Item', dataIndex: 'produtoItem' },
            {
              title: 'Origem',
              width: 140,
              render: (_: any, r: any) =>
                ORIGENS_8D.find((o) => o.value === r.origem)?.label ?? '-',
            },
            {
              title: 'Vínculo',
              width: 150,
              render: (_: any, r: any) =>
                r.inspecao?.numero ?? r.cnq?.numero ?? '-',
            },
            { title: 'Responsável', dataIndex: 'responsavel', width: 150 },
            {
              title: 'Status',
              dataIndex: 'status',
              width: 130,
              render: (s: string) => (
                <Tag color={corStatus8D[s]}>{labelStatus8D[s] ?? s}</Tag>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={open}
        title="Novo 8D — Doc. BDBR.QUA.FMR.007.01"
        width={760}
        okText="Abrir 8D"
        cancelText="Cancelar"
        confirmLoading={salvando}
        onOk={salvar}
        onCancel={() => setOpen(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="inspecaoId" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="cnqId" hidden>
            <Input />
          </Form.Item>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="dataAbertura" label="Data de abertura">
                <Input type="date" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="status" label="Status">
                <Select
                  options={Object.entries(labelStatus8D).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="origem"
                label="Origem"
                rules={[{ required: true, message: 'Informe a origem' }]}
              >
                <Select options={ORIGENS_8D} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={14}>
              <Form.Item name="produtoItem" label="Produto / Item">
                <Input />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="codigoDesenho" label="Código / Desenho">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="responsavel" label="Responsável">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="turno" label="Turno">
                <Select options={TURNOS_8D} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="descricaoProblema" label="Descrição do problema">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
