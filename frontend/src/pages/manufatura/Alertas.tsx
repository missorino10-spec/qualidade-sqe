import { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Tag,
  Timeline,
  Typography,
  message,
} from 'antd';
import {
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  FilePdfOutlined,
  PlusOutlined,
  ReloadOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { abrirPdfEmNovaAba, api } from '../../api';
import { dataBR, dataInput } from '../../formatos';
import { EVID } from '../../inspecao';
import AssinaturaDoLogin from '../../components/AssinaturaDoLogin';
import {
  alertaEmAberto,
  alertaVencido,
  diasParaPrazo,
  situacaoAlerta,
  STATUS_ALERTA,
} from '../../alerta';
import {
  FotosEvidenciaSalvas,
  UploadFotosEvidencia,
  enviarFotosEvidencia,
} from '../../components/FotosEvidencia';
import Tabela, { filtrosDe } from '../../components/Tabela';
import NomeAssinatura from '../../components/NomeAssinatura';

// ALERTA DA QUALIDADE — espelha o formulario .docx da empresa: titulo + data,
// "Descricao do problema", texto da acao obrigatoria e os dois paineis de foto
// (ERRADO / CERTO), com "Elaborado por".
//
// VENCIDO nao e status gravado: e o prazo estourado com o alerta ainda aberto.
// Encerrar fora do prazo NAO deixa o alerta marcado como vencido.

export default function Alertas() {
  const qc = useQueryClient();
  const [form] = Form.useForm();
  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState<any>(null);
  const [salvando, setSalvando] = useState(false);
  const [fotosErrado, setFotosErrado] = useState<any[]>([]);
  const [fotosCerto, setFotosCerto] = useState<any[]>([]);

  const [detalhe, setDetalhe] = useState<any>(null);
  const [renovando, setRenovando] = useState<any>(null);
  const [encerrando, setEncerrando] = useState<any>(null);
  const [formRenovacao] = Form.useForm();
  const [formEncerramento] = Form.useForm();

  const [status, setStatus] = useState<string | undefined>();
  const [maquinaId, setMaquinaId] = useState<number | undefined>();

  const { data, isLoading } = useQuery<any[]>({
    queryKey: ['manufatura-alertas', status, maquinaId],
    queryFn: async () =>
      (await api.get('/manufatura/alertas', { params: { status, maquinaId } }))
        .data,
  });

  const { data: maquinas } = useQuery<any[]>({
    queryKey: ['maquinas'],
    queryFn: async () => (await api.get('/maquinas')).data,
  });

  const lista = data ?? [];
  const emAberto = lista.filter((a) => alertaEmAberto(a.status));
  const vencidos = lista.filter((a) => alertaVencido(a));

  function abrir(registro?: any) {
    setEditando(registro ?? null);
    setFotosErrado([]);
    setFotosCerto([]);
    form.resetFields();
    form.setFieldsValue(
      registro
        ? {
            ...registro,
            data: dataInput(registro.data),
            prazo: dataInput(registro.prazo),
          }
        : {
            data: dayjs().format('YYYY-MM-DD'),
            prazo: dayjs().add(7, 'day').format('YYYY-MM-DD'),
          },
    );
    setOpen(true);
  }

  async function salvar() {
    const v = await form.validateFields();
    setSalvando(true);
    try {
      const alerta = editando
        ? (await api.patch(`/manufatura/alertas/${editando.id}`, v)).data
        : (await api.post('/manufatura/alertas', v)).data;
      // As fotos so podem subir depois que o alerta existe (precisam do id).
      if (fotosErrado.length)
        await enviarFotosEvidencia(fotosErrado, EVID.alertaErrado, alerta.id);
      if (fotosCerto.length)
        await enviarFotosEvidencia(fotosCerto, EVID.alertaCerto, alerta.id);
      message.success('Alerta da Qualidade salvo.');
      qc.invalidateQueries({ queryKey: ['manufatura-alertas'] });
      qc.invalidateQueries({ queryKey: ['fotos-evidencia'] });
      setOpen(false);
    } catch (e: any) {
      message.error(
        e?.response?.data?.message ?? 'Não foi possível salvar o alerta.',
      );
    } finally {
      setSalvando(false);
    }
  }

  async function renovar() {
    const v = await formRenovacao.validateFields();
    try {
      await api.post(`/manufatura/alertas/${renovando.id}/renovar`, v);
      message.success('Prazo renovado.');
      qc.invalidateQueries({ queryKey: ['manufatura-alertas'] });
      setRenovando(null);
    } catch (e: any) {
      message.error(
        e?.response?.data?.message ?? 'Não foi possível renovar o prazo.',
      );
    }
  }

  async function encerrar() {
    const v = await formEncerramento.validateFields();
    try {
      await api.post(`/manufatura/alertas/${encerrando.id}/encerrar`, v);
      message.success('Alerta encerrado.');
      qc.invalidateQueries({ queryKey: ['manufatura-alertas'] });
      setEncerrando(null);
    } catch (e: any) {
      message.error(
        e?.response?.data?.message ?? 'Não foi possível encerrar o alerta.',
      );
    }
  }

  async function reabrir(id: number) {
    try {
      await api.post(`/manufatura/alertas/${id}/reabrir`, {});
      message.success('Alerta reaberto.');
      qc.invalidateQueries({ queryKey: ['manufatura-alertas'] });
    } catch (e: any) {
      message.error(
        e?.response?.data?.message ?? 'Não foi possível reabrir o alerta.',
      );
    }
  }

  async function remover(id: number) {
    try {
      await api.delete(`/manufatura/alertas/${id}`);
      message.success('Alerta excluído.');
      qc.invalidateQueries({ queryKey: ['manufatura-alertas'] });
    } catch (e: any) {
      message.error(
        e?.response?.data?.message ?? 'Não foi possível excluir o alerta.',
      );
    }
  }

  // Prazo com a leitura de quantos dias faltam (ou de atraso).
  function colunaPrazo(a: any) {
    const dias = diasParaPrazo(a.prazo);
    if (!alertaEmAberto(a.status) || dias === null)
      return <span>{dataBR(a.prazo)}</span>;
    const atrasado = dias < 0;
    return (
      <Space direction="vertical" size={0}>
        <span>{dataBR(a.prazo)}</span>
        <Typography.Text
          type={atrasado ? 'danger' : dias <= 3 ? 'warning' : 'secondary'}
          style={{ fontSize: 12 }}
        >
          {atrasado
            ? `${Math.abs(dias)} dia(s) de atraso`
            : dias === 0
              ? 'Vence hoje'
              : `Faltam ${dias} dia(s)`}
        </Typography.Text>
      </Space>
    );
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card size="small">
        <Row gutter={[12, 12]} align="bottom">
          <Col xs={24} sm={12} lg={6}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Situação
            </Typography.Text>
            <Select
              allowClear
              placeholder="Todas"
              style={{ width: '100%' }}
              value={status}
              onChange={setStatus}
              options={STATUS_ALERTA.map((s) => ({
                value: s.value,
                label: s.label,
              }))}
            />
          </Col>
          <Col xs={24} sm={12} lg={10}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Máquina / linha
            </Typography.Text>
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Todas"
              style={{ width: '100%' }}
              value={maquinaId}
              onChange={setMaquinaId}
              options={(maquinas ?? []).map((m) => ({
                value: m.id,
                label: `${m.codigo} — ${m.nome}`,
              }))}
            />
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic title="Alertas em aberto" value={emAberto.length} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="Vencidos"
              value={vencidos.length}
              valueStyle={vencidos.length ? { color: '#cf1322' } : undefined}
            />
          </Card>
        </Col>
        <Col xs={24} sm={24} lg={8}>
          <Card>
            <Statistic title="Total no filtro" value={lista.length} />
          </Card>
        </Col>
      </Row>

      <Card
        title="Alertas da Qualidade"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => abrir()}>
            Novo alerta
          </Button>
        }
      >
        <Tabela
          busca="Buscar alerta (número, título, item, área...)"
          rowKey="id"
          size="small"
          loading={isLoading}
          dataSource={lista}
          scroll={{ x: 'max-content' }}
          columns={[
            { title: 'Número', dataIndex: 'numero', width: 120 },
            {
              title: 'Data',
              dataIndex: 'data',
              width: 110,
              render: (d: string) => dataBR(d),
            },
            {
              title: 'Descrição do problema',
              render: (_: any, r: any) => (
                <Typography.Link onClick={() => setDetalhe(r)}>
                  {r.titulo}
                </Typography.Link>
              ),
            },
            {
              title: 'Onde se aplica',
              width: 200,
              filters: filtrosDe((lista ?? []).map((r: any) => r.setor)),
              onFilter: (v: any, r: any) => r.setor === v,
              render: (_: any, r: any) =>
                [r.setor, r.maquina?.nome].filter(Boolean).join(' — ') || '-',
            },
            {
              title: 'Prazo para corrigir',
              width: 150,
              render: (_: any, r: any) => colunaPrazo(r),
            },
            {
              title: 'Situação',
              width: 120,
              filters: filtrosDe(
                (lista ?? []).map((r: any) => situacaoAlerta(r).texto),
              ),
              onFilter: (v: any, r: any) => situacaoAlerta(r).texto === v,
              render: (_: any, r: any) => {
                const s = situacaoAlerta(r);
                return <Tag color={s.cor}>{s.texto}</Tag>;
              },
            },
            {
              title: '',
              width: 190,
              render: (_: any, r: any) => (
                <Space size={0}>
                  <Button
                    type="text"
                    icon={<FilePdfOutlined />}
                    title="Abrir o alerta em PDF"
                    onClick={() =>
                      abrirPdfEmNovaAba(`/manufatura/alertas/${r.id}/pdf`)
                    }
                  />
                  {alertaEmAberto(r.status) ? (
                    <>
                      <Button
                        type="text"
                        icon={<ReloadOutlined />}
                        title="Renovar o prazo"
                        onClick={() => {
                          formRenovacao.resetFields();
                          setRenovando(r);
                        }}
                      />
                      <Button
                        type="text"
                        icon={<CheckCircleOutlined />}
                        title="Encerrar o alerta"
                        onClick={() => {
                          formEncerramento.resetFields();
                          formEncerramento.setFieldsValue({
                            data: dayjs().format('YYYY-MM-DD'),
                          });
                          setEncerrando(r);
                        }}
                      />
                      <Button
                        type="text"
                        icon={<EditOutlined />}
                        onClick={() => abrir(r)}
                      />
                    </>
                  ) : (
                    <Button
                      type="text"
                      icon={<ReloadOutlined />}
                      title="Reabrir o alerta"
                      onClick={() => reabrir(r.id)}
                    />
                  )}
                  <Popconfirm
                    title="Excluir este alerta?"
                    okText="Excluir"
                    cancelText="Cancelar"
                    onConfirm={() => remover(r.id)}
                  >
                    <Button type="text" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      {/* ------------------------------------------------ formulario do alerta */}
      <Modal
        open={open}
        title={
          editando
            ? `Alerta ${editando.numero}`
            : 'Novo Alerta da Qualidade'
        }
        width={860}
        okText="Salvar"
        cancelText="Cancelar"
        confirmLoading={salvando}
        onOk={salvar}
        onCancel={() => setOpen(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Row gutter={12}>
            <Col xs={24} sm={8}>
              <Form.Item
                name="data"
                label="Data do alerta"
                rules={[{ required: true, message: 'Informe a data.' }]}
              >
                <Input type="date" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item
                name="prazo"
                label="Prazo para corrigir"
                rules={[{ required: true, message: 'Informe o prazo.' }]}
              >
                <Input type="date" />
              </Form.Item>
            </Col>
          </Row>

          <AssinaturaDoLogin rotulo="Elaborado por" />

          <Form.Item
            name="titulo"
            label="Descrição do problema"
            rules={[{ required: true, message: 'Descreva o problema.' }]}
          >
            <Input placeholder="Ex.: REBARBA NAS PEÇAS" />
          </Form.Item>

          <Form.Item
            name="acao"
            label="Ação obrigatória"
            rules={[{ required: true, message: 'Descreva a ação.' }]}
          >
            <Input.TextArea
              rows={3}
              placeholder="Texto que vai no corpo do alerta, como no formulário."
            />
          </Form.Item>

          <Row gutter={12}>
            <Col xs={24} sm={10}>
              <Form.Item name="setor" label="Setor / área">
                <Input placeholder="Ex.: Puncionadeiras" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={14}>
              <Form.Item name="maquinaId" label="Máquina / linha (opcional)">
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="Vale para o setor todo"
                  options={(maquinas ?? []).map((m) => ({
                    value: m.id,
                    label: `${m.codigo} — ${m.nome}`,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* Os dois paineis de foto do formulario. */}
          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Card size="small" title={<Tag color="red">ERRADO</Tag>}>
                <Form.Item name="legendaErrado" label="Legenda (opcional)">
                  <Input />
                </Form.Item>
                {editando && (
                  <div style={{ marginBottom: 8 }}>
                    <FotosEvidenciaSalvas
                      entidadeTipo={EVID.alertaErrado}
                      entidadeId={editando.id}
                    />
                  </div>
                )}
                <UploadFotosEvidencia
                  fotos={fotosErrado}
                  setFotos={setFotosErrado}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12}>
              <Card size="small" title={<Tag color="green">CERTO</Tag>}>
                <Form.Item name="legendaCerto" label="Legenda (opcional)">
                  <Input />
                </Form.Item>
                {editando && (
                  <div style={{ marginBottom: 8 }}>
                    <FotosEvidenciaSalvas
                      entidadeTipo={EVID.alertaCerto}
                      entidadeId={editando.id}
                    />
                  </div>
                )}
                <UploadFotosEvidencia
                  fotos={fotosCerto}
                  setFotos={setFotosCerto}
                />
              </Card>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* ------------------------------------------------------- renovar prazo */}
      <Modal
        open={!!renovando}
        title={`Renovar o prazo — ${renovando?.numero ?? ''}`}
        okText="Renovar"
        cancelText="Cancelar"
        onOk={renovar}
        onCancel={() => setRenovando(null)}
        destroyOnClose
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message={`Prazo atual: ${dataBR(renovando?.prazo)}`}
          description="O prazo anterior fica guardado no histórico e o alerta passa para RENOVADO."
        />
        <Form form={formRenovacao} layout="vertical">
          <Form.Item
            name="prazo"
            label="Novo prazo"
            rules={[{ required: true, message: 'Informe o novo prazo.' }]}
          >
            <Input type="date" />
          </Form.Item>
          <Form.Item name="motivo" label="Motivo da renovação">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* ---------------------------------------------------------- encerrar */}
      <Modal
        open={!!encerrando}
        title={`Encerrar o alerta — ${encerrando?.numero ?? ''}`}
        okText="Encerrar"
        cancelText="Cancelar"
        onOk={encerrar}
        onCancel={() => setEncerrando(null)}
        destroyOnClose
      >
        <Form form={formEncerramento} layout="vertical">
          <Form.Item
            name="data"
            label="Data do encerramento"
            rules={[{ required: true, message: 'Informe a data.' }]}
          >
            <Input type="date" />
          </Form.Item>
          <Form.Item name="observacao" label="O que foi feito">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* ------------------------------------------------------------ detalhe */}
      <Modal
        open={!!detalhe}
        title={`${detalhe?.numero ?? ''} — ${detalhe?.titulo ?? ''}`}
        width={860}
        footer={
          <Space>
            <Button
              icon={<FilePdfOutlined />}
              onClick={() =>
                abrirPdfEmNovaAba(`/manufatura/alertas/${detalhe.id}/pdf`)
              }
            >
              Abrir PDF
            </Button>
            <Button onClick={() => setDetalhe(null)}>Fechar</Button>
          </Space>
        }
        onCancel={() => setDetalhe(null)}
        destroyOnClose
      >
        {detalhe && (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {alertaVencido(detalhe) && (
              <Alert
                type="error"
                showIcon
                icon={<WarningOutlined />}
                message="Alerta vencido"
                description="O prazo passou e o alerta continua em aberto. Renove o prazo ou encerre com o que foi feito."
              />
            )}
            <Descriptions size="small" column={{ xs: 1, sm: 2, md: 2, lg: 2, xl: 2, xxl: 2 }} bordered>
              <Descriptions.Item label="Data">
                {dataBR(detalhe.data)}
              </Descriptions.Item>
              <Descriptions.Item label="Prazo para corrigir">
                {dataBR(detalhe.prazo)}
              </Descriptions.Item>
              <Descriptions.Item label="Onde se aplica">
                {[detalhe.setor, detalhe.maquina?.nome]
                  .filter(Boolean)
                  .join(' — ') || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Situação">
                <Tag color={situacaoAlerta(detalhe).cor}>
                  {situacaoAlerta(detalhe).texto}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Elaborado por" span={2}>
                {detalhe.criadoPor?.nome ? (
                  <NomeAssinatura nome={detalhe.criadoPor.nome} />
                ) : (
                  detalhe.elaboradoPor || '-'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Ação obrigatória" span={2}>
                <span style={{ whiteSpace: 'pre-wrap' }}>{detalhe.acao}</span>
              </Descriptions.Item>
              {detalhe.dataEncerramento && (
                <Descriptions.Item label="Encerrado em" span={2}>
                  {dataBR(detalhe.dataEncerramento)}
                  {detalhe.encerradoPor ? ` por ${detalhe.encerradoPor.nome}` : ''}
                  {detalhe.observacaoEncerramento
                    ? ` — ${detalhe.observacaoEncerramento}`
                    : ''}
                </Descriptions.Item>
              )}
            </Descriptions>

            <Row gutter={12}>
              <Col xs={24} sm={12}>
                <Card size="small" title={<Tag color="red">ERRADO</Tag>}>
                  {detalhe.legendaErrado && (
                    <Typography.Paragraph>
                      {detalhe.legendaErrado}
                    </Typography.Paragraph>
                  )}
                  <FotosEvidenciaSalvas
                    entidadeTipo={EVID.alertaErrado}
                    entidadeId={detalhe.id}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12}>
                <Card size="small" title={<Tag color="green">CERTO</Tag>}>
                  {detalhe.legendaCerto && (
                    <Typography.Paragraph>
                      {detalhe.legendaCerto}
                    </Typography.Paragraph>
                  )}
                  <FotosEvidenciaSalvas
                    entidadeTipo={EVID.alertaCerto}
                    entidadeId={detalhe.id}
                  />
                </Card>
              </Col>
            </Row>

            {!!detalhe.renovacoes?.length && (
              <Card size="small" title="Histórico de renovações">
                <Timeline
                  items={detalhe.renovacoes.map((r: any) => ({
                    children: (
                      <>
                        <div>
                          {dataBR(r.prazoAnterior)} → <strong>{dataBR(r.prazoNovo)}</strong>
                        </div>
                        {r.motivo && (
                          <Typography.Text type="secondary">
                            {r.motivo}
                          </Typography.Text>
                        )}
                      </>
                    ),
                  }))}
                />
              </Card>
            )}
          </Space>
        )}
      </Modal>
    </Space>
  );
}
