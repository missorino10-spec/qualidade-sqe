import { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Form,
  Image,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Switch,
  Tag,
  Timeline,
  Typography,
  Upload,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  FilePdfOutlined,
  UploadOutlined,
  EditOutlined,
  StopOutlined,
  DeleteOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useNavigate, useParams } from 'react-router-dom';
import { api, abrirPdfEmNovaAba } from '../api';
import { AuthImage } from '../components/AuthImage';
import { useAuth } from '../auth';
import { corStatusRnc, labelStatusRnc } from './RncLista';

const labelEficacia: Record<string, string> = {
  PENDENTE: 'Pendente',
  APROVADO: 'Aprovada',
  REPROVADO: 'Reprovada',
  NAO_APLICAVEL: 'Não se aplica',
};
const corEficacia: Record<string, string> = {
  PENDENTE: 'default',
  APROVADO: 'green',
  REPROVADO: 'red',
  NAO_APLICAVEL: 'default',
};

const MAX_FOTOS = 5;

function moeda(v?: number | null) {
  return v != null
    ? Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
    : '-';
}

export default function RncDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { usuario } = useAuth();
  const isAdmin = usuario?.papel === 'ADMIN';
  const [editOpen, setEditOpen] = useState(false);
  const [encerrarOpen, setEncerrarOpen] = useState(false);
  const [cancelarOpen, setCancelarOpen] = useState(false);
  const [formEdit] = Form.useForm();
  const [formEncerrar] = Form.useForm();
  const [formCancelar] = Form.useForm();

  const { data: rnc, isLoading } = useQuery<any>({
    queryKey: ['rnc', 'detalhe', id],
    queryFn: async () => (await api.get(`/rnc/${id}`)).data,
  });

  const { data: anexos } = useQuery<any[]>({
    queryKey: ['anexos', 'RNC', id],
    queryFn: async () =>
      (
        await api.get('/anexos', {
          params: { entidadeTipo: 'RNC', entidadeId: id },
        })
      ).data,
  });

  function invalidar() {
    qc.invalidateQueries({ queryKey: ['rnc'] });
    qc.invalidateQueries({ queryKey: ['rnc', 'detalhe', id] });
  }

  const atualizar = useMutation({
    mutationFn: async (v: any) =>
      api.patch(`/rnc/${id}`, {
        ...v,
        dataRetorno: v.dataRetorno ? v.dataRetorno.toISOString() : undefined,
      }),
    onSuccess: () => {
      message.success('RNC atualizada.');
      setEditOpen(false);
      invalidar();
    },
    onError: () => message.error('Não foi possível atualizar a RNC.'),
  });

  const encerrar = useMutation({
    mutationFn: async (v: any) =>
      api.patch(`/rnc/${id}`, {
        ...v,
        status: 'FINALIZADA',
        dataVerificacao: new Date().toISOString(),
      }),
    onSuccess: () => {
      message.success('RNC finalizada.');
      setEncerrarOpen(false);
      invalidar();
    },
    onError: () => message.error('Não foi possível finalizar a RNC.'),
  });

  const reabrir = useMutation({
    mutationFn: async () => api.patch(`/rnc/${id}/reabrir`),
    onSuccess: () => {
      message.success('RNC reaberta.');
      invalidar();
    },
    onError: () => message.error('Não foi possível reabrir a RNC.'),
  });

  const cancelar = useMutation({
    mutationFn: async (v: any) =>
      api.patch(`/rnc/${id}/cancelar`, { motivo: v.motivo }),
    onSuccess: () => {
      message.success('RNC cancelada.');
      setCancelarOpen(false);
      formCancelar.resetFields();
      invalidar();
    },
    onError: () => message.error('Não foi possível cancelar a RNC.'),
  });

  const remover = useMutation({
    mutationFn: async () => api.delete(`/rnc/${id}`),
    onSuccess: () => {
      message.success('RNC excluída.');
      qc.invalidateQueries({ queryKey: ['rnc'] });
      navigate('/rnc');
    },
    onError: () => message.error('Não foi possível excluir a RNC.'),
  });

  if (isLoading || !rnc) return <Card loading />;

  const finalizada = rnc.status === 'FINALIZADA';
  const cancelada = rnc.status === 'CANCELADA';
  const inspecaoVinculada = rnc.inspecaoVisual ?? rnc.inspecaoLote;
  const tipoInspVinc = rnc.inspecaoVisual ? 'visual' : 'lote';

  function confirmarExclusao() {
    Modal.confirm({
      title: `Excluir a RNC ${rnc.numero}?`,
      icon: <DeleteOutlined style={{ color: '#cf1322' }} />,
      content: inspecaoVinculada ? (
        <div>
          <p>Esta RNC foi gerada por uma inspeção {tipoInspVinc} (#
          {inspecaoVinculada.id}). A exclusão remove <strong>apenas a RNC</strong>
          {' '}— a inspeção permanece.</p>
          <p>
            Se quiser, você pode excluir a inspeção depois, na tela de
            Inspeções.
          </p>
        </div>
      ) : (
        'A remoção é permanente e não pode ser desfeita.'
      ),
      okText: 'Excluir RNC',
      okButtonProps: { danger: true },
      cancelText: 'Cancelar',
      onOk: () => remover.mutateAsync(),
    });
  }
  const fotos = (anexos ?? []).filter((a) =>
    (a.mimeType ?? '').startsWith('image/'),
  );

  function abrirEdicao() {
    formEdit.setFieldsValue({
      tipoDesvio: rnc.tipoDesvio,
      reincidencia: rnc.reincidencia,
      descricaoDesvio: rnc.descricaoDesvio,
      quantidadePecas: rnc.quantidadePecas,
      valorUnitario: rnc.valorUnitario,
      disposicao: rnc.disposicao,
      houveRetorno: rnc.houveRetorno,
      dataRetorno: rnc.dataRetorno ? dayjs(rnc.dataRetorno) : undefined,
      fornecedorAceitou: rnc.fornecedorAceitou,
      fornecedorEnviouPlano: rnc.fornecedorEnviouPlano,
      nivelPlano: rnc.nivelPlano,
      observacoes: rnc.observacoes,
    });
    setEditOpen(true);
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Row justify="space-between" align="middle">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/rnc')}>
            Voltar
          </Button>
          <Typography.Title level={4} style={{ margin: 0 }}>
            RNC {rnc.numero}
          </Typography.Title>
          <Tag color={corStatusRnc[rnc.status]}>
            {labelStatusRnc[rnc.status]}
          </Tag>
        </Space>
        <Space wrap>
          <Button
            icon={<FilePdfOutlined />}
            onClick={() => abrirPdfEmNovaAba(`/rnc/${id}/pdf`)}
          >
            Exportar PDF
          </Button>
          <Button icon={<EditOutlined />} onClick={abrirEdicao}>
            Editar
          </Button>
          {finalizada || cancelada ? (
            <Button
              icon={<ReloadOutlined />}
              onClick={() => reabrir.mutate()}
              loading={reabrir.isPending}
            >
              Reabrir
            </Button>
          ) : (
            <>
              <Button
                icon={<StopOutlined />}
                danger
                onClick={() => {
                  formCancelar.resetFields();
                  setCancelarOpen(true);
                }}
              >
                Cancelar RNC
              </Button>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => {
                  formEncerrar.setFieldsValue({
                    verificacaoEficacia: 'APROVADO',
                  });
                  setEncerrarOpen(true);
                }}
              >
                Finalizar
              </Button>
            </>
          )}
          {isAdmin && (
            <Button
              icon={<DeleteOutlined />}
              danger
              onClick={confirmarExclusao}
              loading={remover.isPending}
            >
              Excluir
            </Button>
          )}
        </Space>
      </Row>

      {cancelada && rnc.motivoCancelamento && (
        <Alert
          type="warning"
          showIcon
          message="RNC cancelada"
          description={`Motivo: ${rnc.motivoCancelamento}`}
        />
      )}

      {inspecaoVinculada && (
        <Alert
          type="info"
          showIcon
          message={`Esta RNC foi gerada por uma inspeção ${tipoInspVinc} (#${inspecaoVinculada.id}).`}
        />
      )}

      <Row gutter={16}>
        <Col xs={24} lg={15}>
          <Card title="Dados da RNC">
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="Abertura">
                {dayjs(rnc.dataAbertura).format('DD/MM/YYYY')}
              </Descriptions.Item>
              <Descriptions.Item label="Solicitante">
                {rnc.solicitante ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Fornecedor" span={2}>
                {rnc.fornecedor?.codigo} — {rnc.fornecedor?.nome}
              </Descriptions.Item>
              <Descriptions.Item label="Item" span={2}>
                {rnc.item?.codigo} — {rnc.item?.descricao}
              </Descriptions.Item>
              <Descriptions.Item label="Nota Fiscal">
                {rnc.notaFiscal ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="PO">{rnc.po ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="Qtd. do lote">
                {rnc.quantidadeLote ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Reincidência">
                {rnc.reincidencia ? (
                  <Tag color="red">Sim</Tag>
                ) : (
                  <Tag>Não</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Tipo de desvio" span={2}>
                {rnc.tipoDesvio ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Descrição do desvio" span={2}>
                {rnc.descricaoDesvio}
              </Descriptions.Item>
              <Descriptions.Item label="Qtd. de peças">
                {rnc.quantidadePecas ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Valor unitário (R$)">
                {moeda(rnc.valorUnitario)}
              </Descriptions.Item>
              <Descriptions.Item label="Valor total (R$)" span={2}>
                <strong>{moeda(rnc.valorTotal)}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="Disposição" span={2}>
                {rnc.disposicao ?? '-'}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title="Plano de Ação" style={{ marginTop: 16 }}>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="Houve retorno?">
                {rnc.houveRetorno == null
                  ? '-'
                  : rnc.houveRetorno
                    ? 'Sim'
                    : 'Não'}
              </Descriptions.Item>
              <Descriptions.Item label="Data de retorno">
                {rnc.dataRetorno
                  ? dayjs(rnc.dataRetorno).format('DD/MM/YYYY')
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Tempo de retorno">
                {rnc.tempoRetornoDias != null
                  ? `${rnc.tempoRetornoDias} dia(s)`
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Fornecedor aceitou">
                {rnc.fornecedorAceitou ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Enviou plano de ação">
                {rnc.fornecedorEnviouPlano == null
                  ? '-'
                  : rnc.fornecedorEnviouPlano
                    ? 'Sim'
                    : 'Não'}
              </Descriptions.Item>
              <Descriptions.Item label="Nível do plano">
                {rnc.nivelPlano ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Verificação de eficácia">
                <Tag color={corEficacia[rnc.verificacaoEficacia]}>
                  {labelEficacia[rnc.verificacaoEficacia]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Data da verificação">
                {rnc.dataVerificacao
                  ? dayjs(rnc.dataVerificacao).format('DD/MM/YYYY')
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Observações" span={2}>
                {rnc.observacoes ?? '-'}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card
            title={`Evidências / Fotos (até ${MAX_FOTOS})`}
            style={{ marginTop: 16 }}
          >
            <Upload
              multiple
              accept="image/*"
              showUploadList={false}
              disabled={fotos.length >= MAX_FOTOS}
              customRequest={async ({ file, onSuccess, onError }) => {
                if (fotos.length >= MAX_FOTOS) {
                  message.warning(`Limite de ${MAX_FOTOS} fotos atingido.`);
                  return;
                }
                const fd = new FormData();
                fd.append('file', file as Blob);
                try {
                  await api.post('/anexos', fd, {
                    params: { entidadeTipo: 'RNC', entidadeId: id },
                  });
                  qc.invalidateQueries({ queryKey: ['anexos', 'RNC', id] });
                  onSuccess?.({});
                } catch (e) {
                  onError?.(e as any);
                  message.error('Falha no envio da foto.');
                }
              }}
            >
              <Button
                icon={<UploadOutlined />}
                disabled={fotos.length >= MAX_FOTOS}
              >
                Enviar foto ({fotos.length}/{MAX_FOTOS})
              </Button>
            </Upload>
            <div style={{ marginTop: 12 }}>
              <Image.PreviewGroup>
                <Space wrap>
                  {fotos.map((a: any) => (
                    <AuthImage key={a.id} anexoId={a.id} />
                  ))}
                </Space>
              </Image.PreviewGroup>
              {fotos.length === 0 && (
                <Typography.Text type="secondary">
                  Nenhuma foto anexada.
                </Typography.Text>
              )}
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={9}>
          <Card title="Histórico de Status">
            <Timeline
              items={(rnc.historico ?? []).map((h: any) => ({
                color: corStatusRnc[h.statusNovo] ?? 'gray',
                children: (
                  <div>
                    <strong>
                      {labelStatusRnc[h.statusNovo] ?? h.statusNovo}
                    </strong>
                    <div style={{ fontSize: 12, color: '#888' }}>
                      {dayjs(h.createdAt).format('DD/MM/YYYY HH:mm')}
                      {h.usuario ? ` · ${h.usuario.nome}` : ''}
                    </div>
                    {h.comentario && (
                      <div style={{ fontSize: 13 }}>{h.comentario}</div>
                    )}
                  </div>
                ),
              }))}
            />
          </Card>
        </Col>
      </Row>

      <Modal
        title="Editar RNC"
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={() => formEdit.submit()}
        confirmLoading={atualizar.isPending}
        okText="Salvar"
        cancelText="Cancelar"
        width={680}
      >
        <Form
          form={formEdit}
          layout="vertical"
          onFinish={(v) => atualizar.mutate(v)}
          style={{ marginTop: 12 }}
        >
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="tipoDesvio" label="Tipo de desvio">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="reincidencia"
                label="Reincidência"
                valuePropName="checked"
              >
                <Switch checkedChildren="Sim" unCheckedChildren="Não" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="descricaoDesvio" label="Descrição do desvio">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="quantidadePecas" label="Qtd. de peças">
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
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item
                name="houveRetorno"
                label="Houve retorno?"
                valuePropName="checked"
              >
                <Switch checkedChildren="Sim" unCheckedChildren="Não" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="dataRetorno" label="Data de retorno">
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="fornecedorEnviouPlano"
                label="Enviou plano?"
                valuePropName="checked"
              >
                <Switch checkedChildren="Sim" unCheckedChildren="Não" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="fornecedorAceitou" label="Fornecedor aceitou">
                <Select
                  allowClear
                  options={[
                    { value: 'Sim', label: 'Sim' },
                    {
                      value: 'Não (Ver observações)',
                      label: 'Não (Ver observações)',
                    },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="nivelPlano" label="Nível do plano">
                <Select
                  allowClear
                  options={[
                    { value: 'SATISFATORIO', label: 'Satisfatório' },
                    { value: 'EXCELENTE', label: 'Excelente' },
                    { value: 'NAO_APLICAVEL', label: 'Não se aplica' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="observacoes" label="Observações">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Finalizar RNC"
        open={encerrarOpen}
        onCancel={() => setEncerrarOpen(false)}
        onOk={() => formEncerrar.submit()}
        confirmLoading={encerrar.isPending}
        okText="Finalizar RNC"
        cancelText="Cancelar"
      >
        <Form
          form={formEncerrar}
          layout="vertical"
          onFinish={(v) => encerrar.mutate(v)}
        >
          <Form.Item
            name="verificacaoEficacia"
            label="Verificação de eficácia"
            rules={[{ required: true, message: 'Informe a eficácia.' }]}
          >
            <Select
              options={[
                { value: 'APROVADO', label: 'Aprovada' },
                { value: 'REPROVADO', label: 'Reprovada' },
                { value: 'NAO_APLICAVEL', label: 'Não se aplica' },
              ]}
            />
          </Form.Item>
          <Form.Item name="evidencias" label="Evidências da verificação">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="comentario" label="Comentário (histórico)">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Cancelar RNC"
        open={cancelarOpen}
        onCancel={() => setCancelarOpen(false)}
        onOk={() => formCancelar.submit()}
        confirmLoading={cancelar.isPending}
        okText="Cancelar RNC"
        okButtonProps={{ danger: true }}
        cancelText="Voltar"
      >
        <Typography.Paragraph type="secondary">
          A RNC cancelada sai dos indicadores (KPIs), mas continua na lista com o
          status “Cancelada”. Você pode reabri-la depois.
        </Typography.Paragraph>
        <Form
          form={formCancelar}
          layout="vertical"
          onFinish={(v) => cancelar.mutate(v)}
        >
          <Form.Item
            name="motivo"
            label="Motivo do cancelamento"
            rules={[
              { required: true, message: 'Informe o motivo do cancelamento.' },
            ]}
          >
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
