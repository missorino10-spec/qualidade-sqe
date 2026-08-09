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
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  FormOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api, abrirPdfEmNovaAba } from '../../api';
import { useAuth } from '../../auth';
import { dataBR, dataInput, separadoresBR } from '../../formatos';
import { Bloco, CamposAutoavaliacao } from './FormularioAutoavaliacao';
import {
  corResultado,
  corStatusHomologacao,
  labelEfetividade,
  labelResposta,
  labelResultado,
  labelSolicitante,
  labelStatusHomologacao,
  labelStatusPlanoAcao,
  nota,
  opcoes,
} from './comum';

const TIPO_RELATORIO = 'HOMOLOGACAO_RELATORIO';
const TIPO_PLANO = 'HOMOLOGACAO_PLANO_ACAO';

// Cartao de anexos reaproveitado pelos dois tipos de documento do registro.
function CardAnexos({
  titulo,
  descricao,
  entidadeTipo,
  entidadeId,
  podeEditar,
}: {
  titulo: string;
  descricao: string;
  entidadeTipo: string;
  entidadeId: string;
  podeEditar: boolean;
}) {
  const qc = useQueryClient();
  const chave = ['anexos', entidadeTipo, entidadeId];

  const { data: anexos } = useQuery<any[]>({
    queryKey: chave,
    queryFn: async () =>
      (await api.get('/anexos', { params: { entidadeTipo, entidadeId } })).data,
  });

  return (
    <Card title={titulo} style={{ marginTop: 16 }}>
      <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
        {descricao}
      </Typography.Paragraph>
      {podeEditar && (
        <Upload
          multiple
          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
          showUploadList={false}
          customRequest={async ({ file, onSuccess, onError }) => {
            const fd = new FormData();
            fd.append('file', file as Blob);
            try {
              await api.post('/anexos', fd, {
                params: { entidadeTipo, entidadeId },
              });
              qc.invalidateQueries({ queryKey: chave });
              onSuccess?.({});
            } catch (e) {
              onError?.(e as any);
              message.error('Falha no envio do documento.');
            }
          }}
        >
          <Button icon={<UploadOutlined />}>Anexar documento</Button>
        </Upload>
      )}
      <div style={{ marginTop: 12 }}>
        {anexos?.length ? (
          <Space direction="vertical" size={4}>
            {anexos.map((a: any) => (
              <Button
                key={a.id}
                type="link"
                icon={<FileTextOutlined />}
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
  );
}

// Registro de Homologação de Fornecedores — Doc. BDBR.QUA.FMR.029.01.
// Traz a autoavaliação preenchida, o resultado calculado e o controle da
// homologação (mesma leitura da tela de RNC).
export default function HomologacaoDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { usuario } = useAuth();
  const podeEditar =
    usuario?.papel === 'ADMIN' || usuario?.papel === 'QUALIDADE';

  const [registroOpen, setRegistroOpen] = useState(false);
  const [avaliacaoOpen, setAvaliacaoOpen] = useState(false);
  const [formRegistro] = Form.useForm();
  const [formAvaliacao] = Form.useForm();
  const [respostas, setRespostas] = useState<Record<string, string>>({});

  const { data: h, isLoading } = useQuery<any>({
    queryKey: ['sqd-homologacao', id],
    queryFn: async () => (await api.get(`/sqd/homologacoes/${id}`)).data,
  });

  function invalidar() {
    qc.invalidateQueries({ queryKey: ['sqd-homologacao', id] });
    qc.invalidateQueries({ queryKey: ['sqd-homologacoes'] });
  }

  const salvarRegistro = useMutation({
    mutationFn: async (v: any) => api.patch(`/sqd/homologacoes/${id}`, v),
    onSuccess: () => {
      message.success('Registro atualizado.');
      setRegistroOpen(false);
      invalidar();
    },
    onError: () => message.error('Não foi possível salvar o registro.'),
  });

  const salvarAvaliacao = useMutation({
    mutationFn: async (v: any) =>
      api.patch(`/sqd/homologacoes/${id}`, { ...v, respostas }),
    onSuccess: (res: any) => {
      message.success(`Resultado recalculado — nota ${nota(res.data.nota)}.`);
      setAvaliacaoOpen(false);
      invalidar();
    },
    onError: () => message.error('Não foi possível salvar a autoavaliação.'),
  });

  const remover = useMutation({
    mutationFn: async () => api.delete(`/sqd/homologacoes/${id}`),
    onSuccess: () => {
      message.success('Homologação excluída.');
      qc.invalidateQueries({ queryKey: ['sqd-homologacoes'] });
      navigate('/sqd/homologacoes');
    },
    onError: () => message.error('Não foi possível excluir a homologação.'),
  });

  if (isLoading || !h) return null;

  const blocos: any[] = h.blocos ?? [];
  const perguntas: Bloco[] = h.perguntas ?? [];
  const reprovadas = blocos.flatMap((b: any) =>
    (b.reprovadas ?? []).map((r: any) => ({ ...r, bloco: `${b.letra}. ${b.nome}` })),
  );

  function abrirRegistro() {
    formRegistro.setFieldsValue({
      codigoFornecedor: h.codigoFornecedor,
      solicitante: h.solicitante,
      segmento: h.segmento,
      escopoFornecedor: h.escopoFornecedor,
      processosTerceirizados: h.processosTerceirizados,
      dataSolicitacao: dataInput(h.dataSolicitacao),
      dataEnvioRelatorio: dataInput(h.dataEnvioRelatorio),
      statusHomologacao: h.statusHomologacao,
      statusPlanoAcao: h.statusPlanoAcao,
      dataReavaliacao: dataInput(h.dataReavaliacao),
      efetividadePlanoAcao: h.efetividadePlanoAcao,
      acao: h.acao,
      observacoes: h.observacoes,
    });
    setRegistroOpen(true);
  }

  function abrirAvaliacao() {
    formAvaliacao.setFieldsValue({
      fornecedorNome: h.fornecedorNome,
      cnpj: h.cnpj,
      inscricaoEstadual: h.inscricaoEstadual,
      responsavelInfo: h.responsavelInfo,
      setor: h.setor,
      dataAvaliacao: dataInput(h.dataAvaliacao),
    });
    setRespostas({ ...(h.respostas ?? {}) });
    setAvaliacaoOpen(true);
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Row justify="space-between" align="middle">
        <Space wrap>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/sqd/homologacoes')}
          >
            Voltar
          </Button>
          <Typography.Title level={4} style={{ margin: 0 }}>
            Homologação {h.numero}
          </Typography.Title>
          <Tag color={corResultado[h.resultado]}>
            {labelResultado[h.resultado]}
          </Tag>
          <Tag color={corStatusHomologacao[h.statusHomologacao]}>
            {labelStatusHomologacao[h.statusHomologacao]}
          </Tag>
        </Space>
        {podeEditar && (
          <Space wrap>
            <Button icon={<FormOutlined />} onClick={abrirAvaliacao}>
              Editar autoavaliação
            </Button>
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={abrirRegistro}
            >
              Editar registro
            </Button>
            <Button
              icon={<DeleteOutlined />}
              danger
              loading={remover.isPending}
              onClick={() =>
                Modal.confirm({
                  title: `Excluir a homologação ${h.numero}?`,
                  content:
                    'A autoavaliação, o resultado e os anexos serão apagados.',
                  okText: 'Excluir',
                  okButtonProps: { danger: true },
                  cancelText: 'Cancelar',
                  onOk: () => remover.mutateAsync(),
                })
              }
            >
              Excluir
            </Button>
          </Space>
        )}
      </Row>

      {h.resultado === 'APROVADO' && h.nota < 100 && (
        <Alert
          type="success"
          showIcon
          message="Aprovado com sugestões de melhoria"
          description="A nota ficou acima de 90 mas abaixo de 100. Os pontos listados em 'Pontos reprovados' são as sugestões de melhoria a incluir no relatório."
        />
      )}
      {h.resultado === 'APROVADO_CONDICIONALMENTE' && (
        <Alert
          type="warning"
          showIcon
          message="Aprovado na condicional"
          description="O relatório precisa apontar as ações e os prazos para os pontos reprovados abaixo, e o plano de ação do fornecedor deve ser anexado."
        />
      )}
      {h.resultado === 'REPROVADO' && (
        <Alert
          type="error"
          showIcon
          message="Reprovado"
          description="O relatório precisa apresentar os riscos para a companhia e as oportunidades de melhoria dos pontos reprovados abaixo."
        />
      )}

      <Row gutter={16}>
        <Col xs={24} lg={15}>
          <Card title="Resultado da Autoavaliação">
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={8}>
                <Statistic
                  title="Nota ponderada"
                  value={h.nota}
                  precision={1}
                  suffix="%"
                  {...separadoresBR}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Blocos críticos (< 90)"
                  value={blocos.filter((b: any) => b.critico).length}
                  suffix={`/ ${blocos.length}`}
                  {...separadoresBR}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Perguntas reprovadas"
                  value={reprovadas.length}
                  {...separadoresBR}
                />
              </Col>
            </Row>
            <Table
              rowKey="letra"
              size="small"
              pagination={false}
              dataSource={blocos}
              summary={() => (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={3}>
                    <strong>Total</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={3} align="right">
                    <strong>{nota(h.nota)}</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={4}>
                    <Tag color={corResultado[h.resultado]}>
                      {labelResultado[h.resultado]}
                    </Tag>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              )}
              columns={[
                {
                  title: 'Bloco',
                  render: (_: any, b: any) => `${b.letra}. ${b.nome}`,
                },
                {
                  title: 'Peso (%)',
                  dataIndex: 'peso',
                  width: 90,
                  align: 'right',
                },
                {
                  title: 'Pontuação obtida',
                  dataIndex: 'pontuacao',
                  width: 140,
                  align: 'right',
                  render: (v: number) => nota(v),
                },
                {
                  title: 'Pontuação ponderada',
                  dataIndex: 'ponderada',
                  width: 160,
                  align: 'right',
                  render: (v: number) => nota(v),
                },
                {
                  title: 'Status',
                  dataIndex: 'critico',
                  width: 100,
                  render: (c: boolean) =>
                    c ? <Tag color="red">Crítico</Tag> : <Tag color="green">OK</Tag>,
                },
              ]}
            />
          </Card>

          <Card
            title={`Pontos reprovados (${reprovadas.length})`}
            style={{ marginTop: 16 }}
          >
            <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
              Evidência para o relatório: perguntas respondidas com "Não".
            </Typography.Paragraph>
            <Table
              rowKey="codigo"
              size="small"
              pagination={false}
              dataSource={reprovadas}
              locale={{ emptyText: 'Nenhuma pergunta reprovada.' }}
              columns={[
                { title: 'Bloco', dataIndex: 'bloco', width: 260 },
                { title: 'Nº', dataIndex: 'codigo', width: 60 },
                { title: 'Pergunta', dataIndex: 'texto' },
              ]}
            />
          </Card>

          <Card title="Autoavaliação preenchida" style={{ marginTop: 16 }}>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="Fornecedor" span={2}>
                {h.fornecedorNome}
              </Descriptions.Item>
              <Descriptions.Item label="CNPJ">
                {h.cnpj ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Inscrição Estadual">
                {h.inscricaoEstadual ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Responsável pelas Informações">
                {h.responsavelInfo ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Setor">
                {h.setor ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Data">
                {dataBR(h.dataAvaliacao)}
              </Descriptions.Item>
              <Descriptions.Item label="Semana">{h.semana}</Descriptions.Item>
            </Descriptions>

            {perguntas.map((b) => {
              const doBloco = blocos.find((x: any) => x.letra === b.letra);
              return (
                <div key={b.letra} style={{ marginTop: 16 }}>
                  <Typography.Text strong>
                    {b.letra}. {b.nome}
                  </Typography.Text>{' '}
                  <Tag color="blue">Peso {b.peso}%</Tag>
                  <Tag color={doBloco?.critico ? 'red' : 'green'}>
                    {nota(doBloco?.pontuacao)} pts
                  </Tag>
                  <Table
                    style={{ marginTop: 8 }}
                    rowKey="codigo"
                    size="small"
                    pagination={false}
                    dataSource={b.perguntas}
                    columns={[
                      { title: 'Nº', dataIndex: 'codigo', width: 60 },
                      { title: 'Pergunta', dataIndex: 'texto' },
                      {
                        title: 'Pontos',
                        dataIndex: 'pontos',
                        width: 80,
                        align: 'center',
                      },
                      {
                        title: 'Resposta',
                        width: 110,
                        align: 'center',
                        render: (_: any, p: any) => {
                          const r = h.respostas?.[p.codigo] ?? 'NAO';
                          const cor =
                            r === 'SIM' ? 'green' : r === 'NA' ? 'default' : 'red';
                          return <Tag color={cor}>{labelResposta[r]}</Tag>;
                        },
                      },
                    ]}
                  />
                </div>
              );
            })}
          </Card>
        </Col>

        <Col xs={24} lg={9}>
          <Card title="Registro de Homologação — Doc. BDBR.QUA.FMR.029.01">
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Código do fornecedor">
                {h.codigoFornecedor ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Solicitante">
                {h.solicitante ? labelSolicitante[h.solicitante] : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Segmento">
                {h.segmento ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Escopo do fornecedor">
                {h.escopoFornecedor ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Processos terceirizados">
                {h.processosTerceirizados ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Data da solicitação">
                {dataBR(h.dataSolicitacao)}
              </Descriptions.Item>
              <Descriptions.Item label="Data de envio do relatório">
                {dataBR(h.dataEnvioRelatorio)}
              </Descriptions.Item>
              <Descriptions.Item label="Lead time (dias úteis)">
                {h.leadTimeDiasUteis == null ? (
                  '-'
                ) : (
                  <Space>
                    <strong>{h.leadTimeDiasUteis}</strong>
                    <Tag color={h.leadTimeDiasUteis <= 3 ? 'green' : 'orange'}>
                      {h.leadTimeDiasUteis <= 3 ? 'Dentro do SLA' : 'Fora do SLA'}
                    </Tag>
                  </Space>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Resultado">
                <Tag color={corResultado[h.resultado]}>
                  {labelResultado[h.resultado]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Status da homologação">
                <Tag color={corStatusHomologacao[h.statusHomologacao]}>
                  {labelStatusHomologacao[h.statusHomologacao]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Status do plano de ação">
                {h.statusPlanoAcao ? labelStatusPlanoAcao[h.statusPlanoAcao] : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Data de reavaliação">
                {dataBR(h.dataReavaliacao)}
              </Descriptions.Item>
              <Descriptions.Item label="Efetividade do plano de ação">
                {h.efetividadePlanoAcao
                  ? labelEfetividade[h.efetividadePlanoAcao]
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Ação">{h.acao ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="Observações">
                {h.observacoes ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Registrado por">
                {h.criadoPor?.nome ?? '-'}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <CardAnexos
            titulo="Relatório final da Qualidade"
            descricao="Relatório de homologação escrito pela Qualidade e enviado ao fornecedor."
            entidadeTipo={TIPO_RELATORIO}
            entidadeId={id!}
            podeEditar={podeEditar}
          />
          <CardAnexos
            titulo="Plano de ação do fornecedor"
            descricao="Plano de ação devolvido pelo fornecedor e evidências de conclusão."
            entidadeTipo={TIPO_PLANO}
            entidadeId={id!}
            podeEditar={podeEditar}
          />
        </Col>
      </Row>

      <Modal
        open={registroOpen}
        title="Registro de Homologação — Doc. BDBR.QUA.FMR.029.01"
        width={720}
        okText="Salvar"
        cancelText="Cancelar"
        confirmLoading={salvarRegistro.isPending}
        onOk={async () =>
          salvarRegistro.mutate(await formRegistro.validateFields())
        }
        onCancel={() => setRegistroOpen(false)}
        destroyOnClose
      >
        <Form form={formRegistro} layout="vertical">
          <Row gutter={12}>
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
            <Col span={24}>
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
            <Col span={12}>
              <Form.Item name="dataSolicitacao" label="Data da solicitação">
                <Input type="date" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="dataEnvioRelatorio"
                label="Data de envio do relatório"
              >
                <Input type="date" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="statusHomologacao" label="Status da homologação">
                <Select options={opcoes(labelStatusHomologacao)} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="statusPlanoAcao" label="Status do plano de ação">
                <Select allowClear options={opcoes(labelStatusPlanoAcao)} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="dataReavaliacao" label="Data de reavaliação">
                <Input type="date" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="efetividadePlanoAcao"
                label="Efetividade do plano de ação"
              >
                <Select allowClear options={opcoes(labelEfetividade)} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="acao" label="Ação">
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

      <Modal
        open={avaliacaoOpen}
        title={`Autoavaliação ${h.numero} — Doc. BDBR.QUA.FMR.024.03`}
        width={1100}
        okText="Salvar e recalcular"
        cancelText="Cancelar"
        confirmLoading={salvarAvaliacao.isPending}
        onOk={async () =>
          salvarAvaliacao.mutate(await formAvaliacao.validateFields())
        }
        onCancel={() => setAvaliacaoOpen(false)}
        destroyOnClose
      >
        <Form form={formAvaliacao} layout="vertical">
          <CamposAutoavaliacao
            blocos={perguntas}
            respostas={respostas}
            setRespostas={setRespostas}
          />
        </Form>
      </Modal>
    </Space>
  );
}
