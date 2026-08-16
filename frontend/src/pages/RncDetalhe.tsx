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
  AuditOutlined,
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
  APROVADO: 'Satisfatório',
  REPROVADO: 'Não Satisfatório',
  NAO_APLICAVEL: 'Não se aplica',
};
const corEficacia: Record<string, string> = {
  PENDENTE: 'default',
  APROVADO: 'green',
  REPROVADO: 'red',
  NAO_APLICAVEL: 'default',
};
// Usadas no modal de edicao e no da verificacao de eficacia - a eficacia pode
// ser registrada nos dois lugares, entao as opcoes precisam ser as mesmas.
const OPCOES_EFICACIA = [
  { value: 'PENDENTE', label: 'Pendente' },
  { value: 'APROVADO', label: 'Satisfatório' },
  { value: 'REPROVADO', label: 'Não Satisfatório' },
  { value: 'NAO_APLICAVEL', label: 'Não se aplica' },
];

const labelNivelPlano: Record<string, string> = {
  RUIM: 'Ruim',
  SATISFATORIO: 'Satisfatório',
  EXCELENTE: 'Excelente',
  NAO_APLICAVEL: 'Não se aplica',
};
const OPCOES_NIVEL_PLANO = Object.entries(labelNivelPlano).map(
  ([value, label]) => ({ value, label }),
);

const MAX_FOTOS = 5;

// Par eficacia + data da verificacao. Pendente nao tem data (o campo trava e
// e limpo); Satisfatorio / Nao Satisfatorio exigem a data; "Nao se aplica"
// deixa a data aberta e opcional.
function CamposEficacia({ form }: { form: any }) {
  const eficacia = Form.useWatch('verificacaoEficacia', form) ?? 'PENDENTE';
  const pendente = eficacia === 'PENDENTE';
  const exigeData = eficacia === 'APROVADO' || eficacia === 'REPROVADO';

  return (
    <Row gutter={12}>
      <Col span={12}>
        <Form.Item name="verificacaoEficacia" label="Verificação de eficácia">
          <Select
            options={OPCOES_EFICACIA}
            onChange={(v) => {
              if (v === 'PENDENTE') {
                form.setFieldValue('dataVerificacao', undefined);
              }
            }}
          />
        </Form.Item>
      </Col>
      <Col span={12}>
        <Form.Item
          name="dataVerificacao"
          label="Data da verificação"
          rules={
            exigeData
              ? [{ required: true, message: 'Informe a data da verificação.' }]
              : []
          }
          extra={
            pendente ? 'Sem data enquanto a eficácia estiver pendente.' : undefined
          }
        >
          <DatePicker
            format="DD/MM/YYYY"
            style={{ width: '100%' }}
            disabled={pendente}
          />
        </Form.Item>
      </Col>
    </Row>
  );
}

// O historico guarda dois tipos de evento: mudanca de status da RNC e
// verificacao da eficacia (gravada com o prefixo EFICACIA_).
function eventoHistorico(statusNovo: string) {
  if (statusNovo?.startsWith('EFICACIA_')) {
    const v = statusNovo.replace('EFICACIA_', '');
    return {
      cor: corEficacia[v] ?? 'gray',
      titulo: `Eficácia: ${labelEficacia[v] ?? v}`,
    };
  }
  return {
    cor: corStatusRnc[statusNovo] ?? 'gray',
    titulo: labelStatusRnc[statusNovo] ?? statusNovo,
  };
}

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
  const [eficaciaOpen, setEficaciaOpen] = useState(false);
  const [cancelarOpen, setCancelarOpen] = useState(false);
  const [formEdit] = Form.useForm();
  const [formEncerrar] = Form.useForm();
  const [formEficacia] = Form.useForm();
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
        // null (e nao undefined) para o backend entender que a data foi
        // apagada de proposito.
        dataVerificacao: v.dataVerificacao
          ? v.dataVerificacao.toISOString()
          : null,
      }),
    onSuccess: () => {
      message.success('RNC atualizada.');
      setEditOpen(false);
      invalidar();
    },
    onError: (e: any) =>
      message.error(
        e?.response?.data?.message ?? 'Não foi possível atualizar a RNC.',
      ),
  });

  // Encerrar a RNC e verificar a eficacia sao atos independentes, cada um com
  // sua data. As duas sao informadas pelo usuario - datas retroativas sao
  // comuns porque o registro no sistema costuma vir depois do fato.
  const encerrar = useMutation({
    mutationFn: async (v: any) =>
      api.patch(`/rnc/${id}`, {
        ...v,
        status: 'FINALIZADA',
        dataEncerramento: v.dataEncerramento.toISOString(),
      }),
    onSuccess: () => {
      message.success('RNC encerrada.');
      setEncerrarOpen(false);
      invalidar();
    },
    onError: (e: any) =>
      message.error(
        e?.response?.data?.message ?? 'Não foi possível encerrar a RNC.',
      ),
  });

  const verificarEficacia = useMutation({
    mutationFn: async (v: any) =>
      api.patch(`/rnc/${id}`, {
        ...v,
        // null (e nao undefined) para o backend entender que a data foi
        // apagada de proposito.
        dataVerificacao: v.dataVerificacao
          ? v.dataVerificacao.toISOString()
          : null,
      }),
    onSuccess: () => {
      message.success('Verificação de eficácia registrada.');
      setEficaciaOpen(false);
      invalidar();
    },
    onError: (e: any) =>
      message.error(
        e?.response?.data?.message ??
          'Não foi possível registrar a verificação de eficácia.',
      ),
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
  const documentos = (anexos ?? []).filter(
    (a) => !(a.mimeType ?? '').startsWith('image/'),
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
      verificacaoEficacia: rnc.verificacaoEficacia,
      dataVerificacao: rnc.dataVerificacao
        ? dayjs(rnc.dataVerificacao)
        : undefined,
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
          {/* A verificacao de eficacia tem botao proprio: ela costuma vir
              depois do encerramento, no lote seguinte. */}
          {!cancelada && (
            <Button
              icon={<AuditOutlined />}
              onClick={() => {
                formEficacia.setFieldsValue({
                  verificacaoEficacia: rnc.verificacaoEficacia ?? 'PENDENTE',
                  dataVerificacao: rnc.dataVerificacao
                    ? dayjs(rnc.dataVerificacao)
                    : undefined,
                  evidencias: rnc.evidencias ?? undefined,
                  comentario: undefined,
                });
                setEficaciaOpen(true);
              }}
            >
              Verificar eficácia
            </Button>
          )}
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
                    dataEncerramento: dayjs(),
                    verificacaoEficacia:
                      rnc.verificacaoEficacia ?? 'PENDENTE',
                    dataVerificacao: rnc.dataVerificacao
                      ? dayjs(rnc.dataVerificacao)
                      : undefined,
                  });
                  setEncerrarOpen(true);
                }}
              >
                Encerrar RNC
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
                {rnc.nivelPlano ? labelNivelPlano[rnc.nivelPlano] : '-'}
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
              <Descriptions.Item label="Data de encerramento">
                {rnc.dataEncerramento
                  ? dayjs(rnc.dataEncerramento).format('DD/MM/YYYY')
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

          {/* Bloco separado das fotos: o Registro Fotografico do formulario
              impresso so aceita imagens, entao um PDF misturado nas
              evidencias nao apareceria no documento gerado. */}
          <Card
            title="Plano de ação do fornecedor (PDF / documento)"
            style={{ marginTop: 16 }}
          >
            <Upload
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx"
              showUploadList={false}
              customRequest={async ({ file, onSuccess, onError }) => {
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
                  message.error('Falha no envio do documento.');
                }
              }}
            >
              <Button icon={<UploadOutlined />}>Anexar documento</Button>
            </Upload>
            <div style={{ marginTop: 12 }}>
              {documentos.length ? (
                <Space direction="vertical" size={4}>
                  {documentos.map((a: any) => (
                    <Button
                      key={a.id}
                      type="link"
                      icon={<FilePdfOutlined />}
                      style={{ padding: 0 }}
                      onClick={() => abrirPdfEmNovaAba(`/anexos/${a.id}/download`)}
                    >
                      {a.nomeArquivo}
                    </Button>
                  ))}
                </Space>
              ) : (
                <Typography.Text type="secondary">
                  Nenhum documento anexado.
                </Typography.Text>
              )}
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={9}>
          <Card title="Histórico de Status">
            <Timeline
              items={(rnc.historico ?? []).map((h: any) => ({
                color: eventoHistorico(h.statusNovo).cor,
                children: (
                  <div>
                    <strong>{eventoHistorico(h.statusNovo).titulo}</strong>
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
                <Select allowClear options={OPCOES_NIVEL_PLANO} />
              </Form.Item>
            </Col>
          </Row>
          <CamposEficacia form={formEdit} />
          <Form.Item name="observacoes" label="Observações">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Encerrar RNC"
        open={encerrarOpen}
        onCancel={() => setEncerrarOpen(false)}
        onOk={() => formEncerrar.submit()}
        confirmLoading={encerrar.isPending}
        okText="Encerrar RNC"
        cancelText="Cancelar"
      >
        <Form
          form={formEncerrar}
          layout="vertical"
          onFinish={(v) => encerrar.mutate(v)}
        >
          <Form.Item
            name="dataEncerramento"
            label="Data de encerramento"
            rules={[
              { required: true, message: 'Informe a data de encerramento.' },
            ]}
            extra="Pode ser retroativa: vale a data em que a RNC foi de fato encerrada."
          >
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
          {/* A RNC pode ser encerrada com a eficacia ainda pendente: a
              verificacao tem botao proprio e costuma vir depois. */}
          <Form.Item name="comentario" label="Comentário (histórico)">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Verificação de eficácia"
        open={eficaciaOpen}
        onCancel={() => setEficaciaOpen(false)}
        onOk={() => formEficacia.submit()}
        confirmLoading={verificarEficacia.isPending}
        okText="Registrar verificação"
        cancelText="Cancelar"
      >
        <Form
          form={formEficacia}
          layout="vertical"
          onFinish={(v) => verificarEficacia.mutate(v)}
        >
          <CamposEficacia form={formEficacia} />
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
