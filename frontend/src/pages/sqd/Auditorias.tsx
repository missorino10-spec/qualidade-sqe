import { useState } from 'react';
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  Modal,
  Row,
  Space,
  Table,
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
  corResultadoAuditoria,
  corSemaforoReavaliacao,
  corStatusAuditoria,
  labelResultadoAuditoria,
  labelStatusAuditoria,
  nota,
  textoReavaliacao,
} from './comum';

// Submenu "Auditoria de Fornecedores": historico das auditorias com o resultado
// pela regua da Qualidade (>= 90 aprovado, 80 a 89,99 condicional, < 80
// reprovado) e o prazo de reavaliacao ao lado. Reprovado reavalia em 90 dias
// corridos e condicional em 180 — os dois ficam no loop ate a Qualidade
// encerrar a auditoria.
export default function Auditorias() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const podeEditar =
    usuario?.papel === 'ADMIN' || usuario?.papel === 'QUALIDADE';

  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const [salvando, setSalvando] = useState(false);

  const { data, isLoading } = useQuery<any[]>({
    queryKey: ['sqd-auditorias'],
    queryFn: async () => (await api.get('/sqd/auditorias')).data,
  });

  function abrir() {
    form.resetFields();
    form.setFieldsValue({ dataAuditoria: dayjs().format('YYYY-MM-DD') });
    setOpen(true);
  }

  async function salvar() {
    const v = await form.validateFields();
    setSalvando(true);
    try {
      const res = await api.post('/sqd/auditorias', v);
      message.success(
        `Auditoria ${res.data.numero} aberta — lance o checklist da rodada 01.`,
      );
      qc.invalidateQueries({ queryKey: ['sqd-auditorias'] });
      setOpen(false);
      navigate(`/sqd/auditorias/${res.data.id}`);
    } catch (e: any) {
      message.error(
        e?.response?.data?.message ?? 'Não foi possível abrir a auditoria.',
      );
    } finally {
      setSalvando(false);
    }
  }

  function confirmarExclusao(r: any) {
    Modal.confirm({
      title: `Excluir a auditoria ${r.numero}?`,
      content:
        'As rodadas do checklist, o resultado e os anexos deste registro serão apagados.',
      okText: 'Excluir',
      okButtonProps: { danger: true },
      cancelText: 'Cancelar',
      onOk: async () => {
        try {
          await api.delete(`/sqd/auditorias/${r.id}`);
          message.success('Auditoria excluída.');
          qc.invalidateQueries({ queryKey: ['sqd-auditorias'] });
        } catch {
          message.error('Não foi possível excluir a auditoria.');
        }
      },
    });
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card
        title="Auditoria de Fornecedores"
        extra={
          podeEditar && (
            <Button type="primary" icon={<PlusOutlined />} onClick={abrir}>
              Nova auditoria
            </Button>
          )
        }
      >
        <Table
          rowKey="id"
          size="small"
          loading={isLoading}
          dataSource={data}
          scroll={{ x: 1600 }}
          onRow={(r) => ({
            onClick: () => navigate(`/sqd/auditorias/${r.id}`),
            style: { cursor: 'pointer' },
          })}
          columns={[
            { title: 'Número', dataIndex: 'numero', width: 130 },
            { title: 'Rev.', dataIndex: 'revisao', width: 70, align: 'center' },
            {
              title: 'Auditoria',
              dataIndex: 'dataAuditoria',
              width: 110,
              render: (d: string) => dataBR(d),
            },
            { title: 'Semana', dataIndex: 'semana', width: 90 },
            { title: 'Fornecedor', dataIndex: 'fornecedorNome', width: 220 },
            { title: 'Motivo', dataIndex: 'motivo', width: 180 },
            {
              title: 'Nota',
              dataIndex: 'nota',
              width: 80,
              align: 'right',
              render: (n: number | null) => nota(n),
            },
            {
              title: 'Resultado',
              dataIndex: 'resultado',
              width: 210,
              // Enquanto o checklist nao e lancado nao existe nota nem
              // resultado: a linha mostra o que o registro esta esperando.
              render: (r: string | null) =>
                r ? (
                  <Tag color={corResultadoAuditoria[r]}>
                    {labelResultadoAuditoria[r]}
                  </Tag>
                ) : (
                  <Tag>Aguardando checklist</Tag>
                ),
            },
            {
              // Semaforo do prazo: verde no prazo, amarelo nos ultimos 15 dias
              // e vermelho quando a reavaliacao ja venceu.
              title: 'Reavaliação',
              dataIndex: 'reavaliacao',
              width: 280,
              render: (r: any) =>
                r ? (
                  <Tag color={corSemaforoReavaliacao[r.semaforo]}>
                    {textoReavaliacao(r)}
                  </Tag>
                ) : (
                  '-'
                ),
            },
            {
              title: 'Status',
              dataIndex: 'statusAuditoria',
              width: 130,
              render: (s: string) => (
                <Tag color={corStatusAuditoria[s]}>
                  {labelStatusAuditoria[s]}
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
        title="Nova auditoria de fornecedor — Checklist de Auditoria"
        width={760}
        okText="Abrir auditoria"
        cancelText="Cancelar"
        confirmLoading={salvando}
        onOk={salvar}
        onCancel={() => setOpen(false)}
        destroyOnClose
      >
        <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
          A data da auditoria numera o registro e é o marco zero do prazo de
          reavaliação. Um registro por auditoria, com N rodadas dentro: a rodada
          01 é a auditoria inicial e as seguintes são as reavaliações. O ciclo só
          termina quando a Qualidade encerra a auditoria.
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
                name="dataAuditoria"
                label="Data da auditoria"
                rules={[
                  { required: true, message: 'Informe a data da auditoria.' },
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
              <Form.Item name="motivo" label="Motivo da auditoria">
                <Input placeholder="Ex.: Auditoria inicial de qualificação" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="local" label="Local">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="auditores" label="Auditores">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="participantes" label="Participantes">
                <Input />
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
