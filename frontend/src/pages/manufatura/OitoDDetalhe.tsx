import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Divider,
  Form,
  Image,
  Input,
  Popconfirm,
  Row,
  Select,
  Space,
  Spin,
  Switch,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  FilePdfOutlined,
  PlusOutlined,
  SaveOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useNavigate, useParams } from 'react-router-dom';
import { api, abrirPdfEmNovaAba } from '../../api';
import { dataInput } from '../../formatos';
import { AuthImage } from '../../components/AuthImage';
import { ORIGENS_8D, TURNOS_8D, corStatus8D, labelStatus8D } from './OitoD';

// Formulario 8D / Registro de Melhoria — Doc BDBR.QUA.FMR.007.01, secoes 1 a 7.

const SEIS_M = [
  { chave: 'maquina', label: 'Máquina' },
  { chave: 'metodo', label: 'Método' },
  { chave: 'material', label: 'Material' },
  { chave: 'maoDeObra', label: 'Mão de obra' },
  { chave: 'medicao', label: 'Medição' },
  { chave: 'meioAmbiente', label: 'Meio ambiente' },
];

function acaoVazia(indice: number) {
  return {
    id: String(indice),
    acao: '',
    tipo: '',
    responsavel: '',
    prazo: '',
    status: '',
    evidencia: '',
  };
}

export default function OitoDDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form] = Form.useForm();
  const [porques, setPorques] = useState<string[]>(['', '', '', '', '']);
  const [planoAcao, setPlanoAcao] = useState<any[]>([]);
  const [salvando, setSalvando] = useState(false);

  const { data, isLoading } = useQuery<any>({
    queryKey: ['manufatura-8d', id],
    queryFn: async () => (await api.get(`/manufatura/8d/${id}`)).data,
    enabled: !!id,
  });

  const { data: anexos } = useQuery<any[]>({
    queryKey: ['anexos', 'OITO_D', id],
    queryFn: async () =>
      (
        await api.get('/anexos', {
          params: { entidadeTipo: 'OITO_D', entidadeId: id },
        })
      ).data,
    enabled: !!id,
  });

  useEffect(() => {
    if (!data) return;
    form.setFieldsValue({
      ...data,
      dataAbertura: dataInput(data.dataAbertura),
      causas6M: data.causas6M ?? {},
      padronizacao: data.padronizacao ?? {},
      verificacaoEficacia: {
        ...(data.verificacaoEficacia ?? {}),
        data: dataInput(data.verificacaoEficacia?.data),
      },
    });
    const p = Array.isArray(data.porques) ? data.porques : [];
    setPorques([0, 1, 2, 3, 4].map((i) => p[i] ?? ''));
    setPlanoAcao(Array.isArray(data.planoAcao) ? data.planoAcao : []);
  }, [data, form]);

  if (isLoading || !data)
    return (
      <Card>
        <Spin />
      </Card>
    );

  const fotos = (anexos ?? []).filter((a) => a.mimeType?.startsWith('image/'));

  async function salvar() {
    const v = await form.getFieldsValue();
    setSalvando(true);
    try {
      await api.patch(`/manufatura/8d/${id}`, {
        ...v,
        porques,
        planoAcao,
      });
      message.success('8D salvo.');
      qc.invalidateQueries({ queryKey: ['manufatura-8d'] });
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Não foi possível salvar o 8D.');
    } finally {
      setSalvando(false);
    }
  }

  async function aprovar() {
    try {
      await api.post(`/manufatura/8d/${id}/aprovar`);
      message.success('8D aprovado pela Qualidade.');
      qc.invalidateQueries({ queryKey: ['manufatura-8d'] });
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Não foi possível aprovar.');
    }
  }

  return (
    <Form form={form} layout="vertical">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Card
          title={
            <Space wrap>
              <Typography.Title level={4} style={{ margin: 0 }}>
                8D {data.numero}
              </Typography.Title>
              <Tag color={corStatus8D[data.status]}>
                {labelStatus8D[data.status] ?? data.status}
              </Tag>
              {data.inspecao && <Tag>{data.inspecao.numero}</Tag>}
              {data.cnq && <Tag>{data.cnq.numero}</Tag>}
            </Space>
          }
          extra={
            <Space wrap>
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate('/manufatura/8d')}
              >
                Voltar
              </Button>
              <Button
                icon={<SaveOutlined />}
                type="primary"
                loading={salvando}
                onClick={salvar}
              >
                Salvar
              </Button>
              <Popconfirm
                title="Aprovar este 8D pela Qualidade?"
                okText="Aprovar"
                cancelText="Cancelar"
                onConfirm={aprovar}
              >
                <Button icon={<CheckCircleOutlined />} disabled={!!data.aprovadoEm}>
                  {data.aprovadoEm ? 'Aprovado' : 'Aprovar'}
                </Button>
              </Popconfirm>
              <Button
                icon={<FilePdfOutlined />}
                onClick={() => abrirPdfEmNovaAba(`/manufatura/8d/${id}/pdf`)}
              >
                Exportar PDF
              </Button>
            </Space>
          }
        >
          <Divider orientation="left" plain>
            1. Dados do registro
          </Divider>
          <Row gutter={12}>
            <Col span={6}>
              <Form.Item name="dataAbertura" label="Data de abertura">
                <Input type="date" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="status" label="Status">
                <Select
                  options={Object.entries(labelStatus8D).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="origem" label="Origem">
                <Select options={ORIGENS_8D} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="turno" label="Turno">
                <Select options={TURNOS_8D} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={10}>
              <Form.Item name="produtoItem" label="Produto / Item">
                <Input />
              </Form.Item>
            </Col>
            <Col span={7}>
              <Form.Item name="codigoDesenho" label="Código / Desenho">
                <Input />
              </Form.Item>
            </Col>
            <Col span={7}>
              <Form.Item name="local" label="Local">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={9}>
              <Form.Item name="processoOperacao" label="Processo / Operação">
                <Input />
              </Form.Item>
            </Col>
            <Col span={9}>
              <Form.Item name="equipamento" label="Equipamento">
                <Input />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="qtdAfetada" label="Qtd. afetada">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="responsavel" label="Responsável">
                <Input />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item name="equipe" label="Equipe 8D">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="descricaoProblema" label="Descrição do problema (5W2H)">
            <Input.TextArea rows={4} />
          </Form.Item>
        </Card>

        <Card title="2. Análise de causa raiz">
          <Form.Item name="efeito" label="Efeito / problema">
            <Input />
          </Form.Item>
          <Divider orientation="left" plain>
            Diagrama 6M
          </Divider>
          <Row gutter={12}>
            {SEIS_M.map((m) => (
              <Col span={12} key={m.chave}>
                <Form.Item name={['causas6M', m.chave]} label={m.label}>
                  <Input.TextArea rows={2} />
                </Form.Item>
              </Col>
            ))}
          </Row>
          <Divider orientation="left" plain>
            5 Porquês
          </Divider>
          {porques.map((p, i) => (
            <Form.Item key={i} label={`Por quê ${i + 1}?`}>
              <Input
                value={p}
                onChange={(e) =>
                  setPorques(
                    porques.map((v, k) => (k === i ? e.target.value : v)),
                  )
                }
              />
            </Form.Item>
          ))}
        </Card>

        <Card title="3. Causa raiz confirmada">
          <Form.Item name="causaRaiz" noStyle>
            <Input.TextArea rows={3} />
          </Form.Item>
        </Card>

        <Card
          title="4. Plano de ação corretiva"
          extra={
            <Button
              size="small"
              icon={<PlusOutlined />}
              onClick={() =>
                setPlanoAcao([...planoAcao, acaoVazia(planoAcao.length + 1)])
              }
            >
              Adicionar ação
            </Button>
          }
        >
          <Table
            size="small"
            rowKey={(_, i) => String(i)}
            dataSource={planoAcao}
            pagination={false}
            scroll={{ x: 1000 }}
            locale={{ emptyText: 'Nenhuma ação registrada' }}
            columns={[
              'id',
              'acao',
              'tipo',
              'responsavel',
              'prazo',
              'status',
              'evidencia',
            ].map((campo) => ({
              title: {
                id: 'ID',
                acao: 'Ação',
                tipo: 'Tipo',
                responsavel: 'Responsável',
                prazo: 'Prazo',
                status: 'Status',
                evidencia: 'Evidência',
              }[campo],
              width: campo === 'acao' ? 240 : campo === 'id' ? 60 : 130,
              render: (_: any, r: any, i: number) => (
                <Input
                  size="small"
                  value={r[campo]}
                  onChange={(e) =>
                    setPlanoAcao(
                      planoAcao.map((a, k) =>
                        k === i ? { ...a, [campo]: e.target.value } : a,
                      ),
                    )
                  }
                />
              ),
            })).concat([
              {
                title: '',
                width: 40,
                render: (_: any, __: any, i: number) => (
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() =>
                      setPlanoAcao(planoAcao.filter((_, k) => k !== i))
                    }
                  />
                ),
              } as any,
            ])}
          />
        </Card>

        <Card title="5. Padronização">
          <Form.Item
            name={['padronizacao', 'documentos']}
            label="Documentos atualizados"
          >
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item
            name={['padronizacao', 'treinamentos']}
            label="Treinamentos realizados"
          >
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name={['padronizacao', 'observacoes']} label="Observações">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Card>

        <Card title="6. Evidências antes / depois">
          <Upload
            multiple
            accept="image/*"
            showUploadList={false}
            customRequest={async ({ file, onSuccess, onError }) => {
              const fd = new FormData();
              fd.append('file', file as Blob);
              try {
                await api.post('/anexos', fd, {
                  params: { entidadeTipo: 'OITO_D', entidadeId: id },
                });
                qc.invalidateQueries({ queryKey: ['anexos', 'OITO_D', id] });
                onSuccess?.({});
              } catch (e) {
                onError?.(e as any);
                message.error('Falha no envio da foto.');
              }
            }}
          >
            <Button icon={<UploadOutlined />}>Enviar foto</Button>
          </Upload>
          <div style={{ marginTop: 12 }}>
            {fotos.length ? (
              <Image.PreviewGroup>
                <Space wrap>
                  {fotos.map((a: any) => (
                    <AuthImage key={a.id} anexoId={a.id} />
                  ))}
                </Space>
              </Image.PreviewGroup>
            ) : (
              <Typography.Text type="secondary">
                Nenhuma foto anexada.
              </Typography.Text>
            )}
          </div>
        </Card>

        <Card title="7. Verificação da eficácia">
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name={['verificacaoEficacia', 'criterio']} label="Critério">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name={['verificacaoEficacia', 'metodo']} label="Método">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name={['verificacaoEficacia', 'amostra']} label="Amostra">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item
                name={['verificacaoEficacia', 'resultadoEsperado']}
                label="Resultado esperado"
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name={['verificacaoEficacia', 'resultadoObtido']}
                label="Resultado obtido"
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item name={['verificacaoEficacia', 'data']} label="Data">
                <Input type="date" />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item
                name={['verificacaoEficacia', 'eficaz']}
                label="Eficaz?"
                valuePropName="checked"
              >
                <Switch checkedChildren="Sim" unCheckedChildren="Não" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name={['verificacaoEficacia', 'responsavel']}
            label="Responsável pela verificação"
          >
            <Input />
          </Form.Item>
        </Card>

        <Card title="Aprovações">
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Qualidade">
                <Typography.Text>
                  {data.aprovadoPor
                    ? `${data.aprovadoPor.nome} — ${dayjs(data.aprovadoEm).format('DD/MM/YYYY')}`
                    : 'Pendente de aprovação'}
                </Typography.Text>
              </Form.Item>
            </Col>
            <Col span={12}>
              {/* Campo mantido para o PDF sair igual ao formulario em papel. */}
              <Form.Item name="aprovacaoProducao" label="Produção">
                <Input placeholder="Nome e data da aprovação da Produção" />
              </Form.Item>
            </Col>
          </Row>
        </Card>
      </Space>
    </Form>
  );
}
