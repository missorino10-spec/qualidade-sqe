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
  Tag,
  Typography,
  Upload,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  FilePdfOutlined,
  FormOutlined,
  UndoOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useNavigate, useParams } from 'react-router-dom';
import { api, abrirPdfEmNovaAba } from '../../api';
import { useAuth } from '../../auth';
import { dataBR, dataInput } from '../../formatos';
import {
  BlocoAuditoria,
  ChecklistAuditoria,
  RespostasAuditoria,
  respostasIniciais,
} from './FormularioChecklistAuditoria';
import {
  corClassificacaoBloco,
  corResultadoAuditoria,
  corSemaforoReavaliacao,
  corStatusAuditoria,
  labelClassificacaoBloco,
  labelRespostaAuditoria,
  labelResultadoAuditoria,
  labelStatusAuditoria,
  nota as fmtNota,
  opcoes,
  textoReavaliacao,
} from './comum';
import Tabela from '../../components/Tabela';

const TIPO_RELATORIO = 'AUDITORIA_RELATORIO';
const TIPO_PLANO = 'AUDITORIA_PLANO_ACAO';

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

// Registro de Auditoria de Fornecedores — Checklist de Auditoria.
// Um registro por auditoria, com N rodadas dentro: a 01 e a auditoria inicial e
// as seguintes sao as reavaliacoes. Reprovado reavalia em 90 dias corridos e
// aprovado condicionalmente em 180 — os dois ficam no loop ate a Qualidade
// encerrar a auditoria.
export default function AuditoriaDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { usuario } = useAuth();
  const podeEditar =
    usuario?.papel === 'ADMIN' || usuario?.papel === 'QUALIDADE';

  const [registroOpen, setRegistroOpen] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [formRegistro] = Form.useForm();
  const [formChecklist] = Form.useForm();
  const [respostas, setRespostas] = useState<RespostasAuditoria>({});
  // Rodada aberta no modal; null = uma rodada nova.
  const [rodadaEdicao, setRodadaEdicao] = useState<number | null>(null);

  const { data: a, isLoading } = useQuery<any>({
    queryKey: ['sqd-auditoria', id],
    queryFn: async () => (await api.get(`/sqd/auditorias/${id}`)).data,
  });

  function invalidar() {
    qc.invalidateQueries({ queryKey: ['sqd-auditoria', id] });
    qc.invalidateQueries({ queryKey: ['sqd-auditorias'] });
  }

  const salvarRegistro = useMutation({
    mutationFn: async (v: any) => api.patch(`/sqd/auditorias/${id}`, v),
    onSuccess: () => {
      message.success('Registro atualizado.');
      setRegistroOpen(false);
      invalidar();
    },
    onError: (e: any) =>
      message.error(
        e?.response?.data?.message ?? 'Não foi possível salvar o registro.',
      ),
  });

  const salvarChecklist = useMutation({
    mutationFn: async (v: any) =>
      api.post(`/sqd/auditorias/${id}/rodada`, {
        ...v,
        rodada: rodadaEdicao ?? undefined,
        respostas: Object.entries(respostas).map(([codigo, r]) => ({
          codigo,
          resposta: r.resposta,
          evidencia: r.evidencia,
        })),
      }),
    onSuccess: (res: any) => {
      message.success(
        `Checklist lançado — nota ${fmtNota(res.data.nota)}, fornecedor ${
          labelResultadoAuditoria[res.data.resultado] ?? res.data.resultado
        }.`,
      );
      setChecklistOpen(false);
      invalidar();
    },
    onError: (e: any) =>
      message.error(
        e?.response?.data?.message ?? 'Não foi possível salvar o checklist.',
      ),
  });

  const removerRodada = useMutation({
    mutationFn: async (rodada: number) =>
      api.delete(`/sqd/auditorias/${id}/rodada/${rodada}`),
    onSuccess: () => {
      message.success('Rodada excluída.');
      invalidar();
    },
    onError: () => message.error('Não foi possível excluir a rodada.'),
  });

  // A trava do ciclo mora aqui, fora do salvar: o registro pode ser editado a
  // qualquer momento; encerrar e que exige tudo no lugar.
  const finalizar = useMutation({
    mutationFn: async () => api.post(`/sqd/auditorias/${id}/finalizar`),
    onSuccess: () => {
      message.success('Auditoria encerrada.');
      invalidar();
    },
    onError: (e: any) =>
      message.error(
        e?.response?.data?.message ?? 'Não foi possível encerrar a auditoria.',
      ),
  });

  const reabrir = useMutation({
    mutationFn: async () => api.post(`/sqd/auditorias/${id}/reabrir`),
    onSuccess: () => {
      message.success('Auditoria reaberta.');
      invalidar();
    },
    onError: (e: any) =>
      message.error(
        e?.response?.data?.message ?? 'Não foi possível reabrir a auditoria.',
      ),
  });

  const remover = useMutation({
    mutationFn: async () => api.delete(`/sqd/auditorias/${id}`),
    onSuccess: () => {
      message.success('Auditoria excluída.');
      qc.invalidateQueries({ queryKey: ['sqd-auditorias'] });
      navigate('/sqd/auditorias');
    },
    onError: () => message.error('Não foi possível excluir a auditoria.'),
  });

  if (isLoading || !a) return null;

  const blocos: BlocoAuditoria[] = a.checklist ?? [];
  const rodadas: any[] = a.rodadas ?? [];
  const recente = rodadas.length ? rodadas[rodadas.length - 1] : null;

  const avaliada = !!a.resultado && a.resultado !== 'CANCELADO';
  const aguardando = !a.resultado && a.statusAuditoria === 'EM_ANDAMENTO';
  const pendencias: string[] = a.pendenciasFinalizacao ?? [];
  const finalizado = a.statusAuditoria === 'FINALIZADO';
  const cancelado = a.statusAuditoria === 'CANCELADO';
  const r = a.reavaliacao;

  function abrirRegistro() {
    formRegistro.setFieldsValue({
      fornecedorNome: a.fornecedorNome,
      cnpj: a.cnpj,
      codigoFornecedor: a.codigoFornecedor,
      motivo: a.motivo,
      local: a.local,
      auditores: a.auditores,
      participantes: a.participantes,
      dataAuditoria: dataInput(a.dataAuditoria),
      conclusao: a.conclusao,
      observacoes: a.observacoes,
      statusAuditoria: a.statusAuditoria,
    });
    setRegistroOpen(true);
  }

  // Sem rodada, abre uma nova: o cabecalho vem da anterior, mas o checklist
  // comeca em branco — a reavaliacao e uma passada nova, nao uma correcao.
  function abrirChecklist(rodada?: number) {
    const rd = rodada ? rodadas.find((x) => x.rodada === rodada) : null;
    const base = rd ?? recente;
    setRodadaEdicao(rd ? rd.rodada : null);
    formChecklist.setFieldsValue({
      dataAuditoria: rd
        ? dataInput(rd.dataAuditoria)
        : dayjs().format('YYYY-MM-DD'),
      auditores: base?.auditores ?? a.auditores,
      participantes: base?.participantes ?? a.participantes,
      local: base?.local ?? a.local,
      conclusao: rd?.conclusao,
      observacoes: rd?.observacoes,
    });
    setRespostas(respostasIniciais(blocos, rd?.respostas));
    setChecklistOpen(true);
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Row justify="space-between" align="middle">
        <Space wrap>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/sqd/auditorias')}
          >
            Voltar
          </Button>
          <Typography.Title level={4} style={{ margin: 0 }}>
            Auditoria {a.numero}
          </Typography.Title>
          <Tag>Rev. {a.revisao}</Tag>
          {a.resultado ? (
            <Tag color={corResultadoAuditoria[a.resultado]}>
              {labelResultadoAuditoria[a.resultado]}
              {avaliada ? ` · ${fmtNota(a.nota)}` : ''}
            </Tag>
          ) : (
            aguardando && <Tag>Aguardando checklist</Tag>
          )}
          {/* O fornecedor esta no loop de reavaliacao: a tag anda junto com o
              resultado, com o semaforo do prazo. */}
          {r && (
            <Tag color={corSemaforoReavaliacao[r.semaforo]}>
              REAVALIAÇÃO · {textoReavaliacao(r)}
            </Tag>
          )}
          <Tag color={corStatusAuditoria[a.statusAuditoria]}>
            {labelStatusAuditoria[a.statusAuditoria]}
          </Tag>
        </Space>
        <Space wrap>
          <Button
            icon={<FilePdfOutlined />}
            onClick={() => abrirPdfEmNovaAba(`/sqd/auditorias/${id}/pdf`)}
          >
            PDF do registro
          </Button>
          {rodadas.length > 0 && (
            <Button
              icon={<FilePdfOutlined />}
              onClick={() =>
                abrirPdfEmNovaAba(`/sqd/auditorias/${id}/checklist/pdf`)
              }
            >
              PDF do checklist
            </Button>
          )}
          {podeEditar && (
            <>
              <Button
                type={avaliada ? 'default' : 'primary'}
                icon={<FormOutlined />}
                disabled={cancelado}
                onClick={() => abrirChecklist()}
              >
                {rodadas.length ? 'Nova reavaliação' : 'Lançar checklist'}
              </Button>
              <Button icon={<EditOutlined />} onClick={abrirRegistro}>
                Editar registro
              </Button>
              {/* A auditoria nunca fecha sozinha: mesmo aprovada, e a Qualidade
                  que encerra o ciclo. */}
              {finalizado ? (
                <Button
                  icon={<UndoOutlined />}
                  loading={reabrir.isPending}
                  onClick={() =>
                    Modal.confirm({
                      title: `Reabrir a auditoria ${a.numero}?`,
                      content:
                        'A data de encerramento será apagada, o registro volta para "Em andamento" e o prazo de reavaliação volta a contar.',
                      okText: 'Reabrir',
                      cancelText: 'Cancelar',
                      onOk: () => reabrir.mutateAsync(),
                    })
                  }
                >
                  Reabrir auditoria
                </Button>
              ) : (
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  loading={finalizar.isPending}
                  disabled={cancelado}
                  onClick={() => finalizar.mutate()}
                >
                  Encerrar auditoria
                </Button>
              )}
              <Button
                icon={<DeleteOutlined />}
                danger
                loading={remover.isPending}
                onClick={() =>
                  Modal.confirm({
                    title: `Excluir a auditoria ${a.numero}?`,
                    content:
                      'As rodadas do checklist, o resultado e os anexos serão apagados.',
                    okText: 'Excluir',
                    okButtonProps: { danger: true },
                    cancelText: 'Cancelar',
                    onOk: () => remover.mutateAsync(),
                  })
                }
              >
                Excluir
              </Button>
            </>
          )}
        </Space>
      </Row>

      {aguardando && (
        <Alert
          type="info"
          showIcon
          message="Aguardando o checklist de auditoria"
          description={`A auditoria foi aberta com data de ${dataBR(
            a.dataAuditoria,
          )}. Use "Lançar checklist" para preencher os 12 blocos e apurar a nota do fornecedor.`}
        />
      )}

      {/* O relogio da reavaliacao no topo da tela, com a leitura completa. */}
      {r && (
        <Alert
          type={r.vencida ? 'error' : r.semaforo === 'AMARELO' ? 'warning' : 'info'}
          showIcon
          message={
            r.vencida
              ? `Reavaliação vencida há ${Math.abs(r.diasRestantes)} dia${
                  Math.abs(r.diasRestantes) === 1 ? '' : 's'
                }`
              : `Reavaliação prevista para ${dataBR(r.dataLimite)}`
          }
          description={`Resultado ${
            labelResultadoAuditoria[r.resultado] ?? r.resultado
          } — prazo de ${r.prazoDias} dias corridos contados da última rodada. ${textoReavaliacao(
            r,
          )}. A reavaliação entra como uma nova rodada, sob o mesmo número, e o ciclo só termina quando a Qualidade encerrar a auditoria.`}
        />
      )}

      {/* O ciclo so fecha quando tudo o que a Qualidade pede esta no lugar. */}
      {!finalizado && !cancelado && pendencias.length > 0 && (
        <Alert
          type="info"
          showIcon
          message="Falta para encerrar a auditoria"
          description={
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {pendencias.map((p) => (
                <li key={p}>{p[0].toUpperCase() + p.slice(1)}</li>
              ))}
            </ul>
          }
        />
      )}

      <Row gutter={16}>
        <Col xs={24} lg={15}>
          {!rodadas.length && (
            <Card title="Checklist de auditoria">
              <Typography.Paragraph type="secondary">
                {cancelado
                  ? 'Esta auditoria foi cancelada e não recebe checklist.'
                  : 'O checklist ainda não foi lançado. São 12 blocos e 46 perguntas: Sim = 1,0 · Parcial = 0,5 · Não = 0,0 · N/A sai da conta. A nota final define o resultado (90 ou mais aprovado · 80 a 89,99 condicional · abaixo de 80 reprovado).'}
              </Typography.Paragraph>
              {podeEditar && !cancelado && (
                <Button
                  type="primary"
                  icon={<FormOutlined />}
                  onClick={() => abrirChecklist()}
                >
                  Lançar checklist
                </Button>
              )}
            </Card>
          )}

          {rodadas.length > 0 && (
            <>
              <Card title={`Rodadas de auditoria (${rodadas.length})`}>
                <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
                  Cada passada de auditoria é uma rodada sob o mesmo número, com
                  a revisão igual ao número da rodada. O resultado do registro e o
                  prazo de reavaliação saem sempre da rodada mais recente.
                </Typography.Paragraph>
                <Tabela
                  rowKey="rodada"
                  size="small"
                  pagination={false}
                  scroll={{ x: 'max-content' }}
                  dataSource={rodadas}
                  columns={[
                    { title: 'Rev.', dataIndex: 'revisao', width: 70 },
                    {
                      title: 'Data',
                      dataIndex: 'dataAuditoria',
                      width: 110,
                      render: (d: string) => dataBR(d),
                    },
                    {
                      title: 'Nota',
                      dataIndex: 'nota',
                      width: 80,
                      align: 'right',
                      render: (n: number | null) => fmtNota(n),
                    },
                    {
                      title: 'Resultado',
                      dataIndex: 'resultado',
                      width: 210,
                      render: (v: string) => (
                        <Tag color={corResultadoAuditoria[v]}>
                          {labelResultadoAuditoria[v]}
                        </Tag>
                      ),
                    },
                    {
                      title: 'Auditores',
                      dataIndex: 'auditores',
                      render: (v: string) => v ?? '-',
                    },
                    {
                      title: '',
                      width: 160,
                      align: 'right',
                      render: (_: any, rd: any) => (
                        <Space>
                          <Button
                            size="small"
                            icon={<FilePdfOutlined />}
                            onClick={() =>
                              abrirPdfEmNovaAba(
                                `/sqd/auditorias/${id}/checklist/pdf?rodada=${rd.rodada}`,
                              )
                            }
                          />
                          {podeEditar && (
                            <>
                              <Button
                                size="small"
                                icon={<EditOutlined />}
                                onClick={() => abrirChecklist(rd.rodada)}
                              />
                              <Button
                                size="small"
                                danger
                                icon={<DeleteOutlined />}
                                onClick={() =>
                                  Modal.confirm({
                                    title: `Excluir a rodada ${rd.revisao}?`,
                                    content:
                                      'As respostas desta rodada serão apagadas, e o resultado volta a sair da rodada que sobrar.',
                                    okText: 'Excluir',
                                    okButtonProps: { danger: true },
                                    cancelText: 'Cancelar',
                                    onOk: () =>
                                      removerRodada.mutateAsync(rd.rodada),
                                  })
                                }
                              />
                            </>
                          )}
                        </Space>
                      ),
                    },
                  ]}
                />
              </Card>

              {recente && (
                <Card
                  title={`Checklist — Rev. ${recente.revisao}`}
                  style={{ marginTop: 16 }}
                  extra={
                    <Space>
                      <Tag>Nota {fmtNota(recente.nota)}</Tag>
                      <Tag color={corResultadoAuditoria[recente.resultado]}>
                        {labelResultadoAuditoria[recente.resultado]}
                      </Tag>
                    </Space>
                  }
                >
                  <Descriptions column={{ xs: 1, sm: 2, md: 2, lg: 2 }} bordered size="small">
                    <Descriptions.Item label="Data da auditoria">
                      {dataBR(recente.dataAuditoria)}
                    </Descriptions.Item>
                    <Descriptions.Item label="Local">
                      {recente.local ?? '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Auditores">
                      {recente.auditores ?? '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Participantes">
                      {recente.participantes ?? '-'}
                    </Descriptions.Item>
                  </Descriptions>

                  <Tabela
                    rowKey="codigo"
                    size="small"
                    pagination={false}
                    scroll={{ x: 'max-content' }}
                    style={{ marginTop: 16 }}
                    dataSource={(recente.blocos ?? []) as any[]}
                    columns={[
                      {
                        title: 'Bloco',
                        render: (_: any, b: any) => `${b.codigo} ${b.nome}`,
                      },
                      {
                        title: 'Peso',
                        dataIndex: 'peso',
                        width: 70,
                        align: 'right',
                        render: (p: number) => `${p}%`,
                      },
                      {
                        title: 'Nota',
                        dataIndex: 'pontuacao',
                        width: 90,
                        align: 'right',
                        render: (v: number | null) =>
                          v == null ? 'N/A' : `${fmtNota(v)}%`,
                      },
                      {
                        title: 'Ponderado',
                        dataIndex: 'ponderada',
                        width: 100,
                        align: 'right',
                        render: (v: number) => fmtNota(v),
                      },
                      {
                        title: 'Classificação',
                        dataIndex: 'classificacao',
                        width: 130,
                        render: (c: string | null) =>
                          c ? (
                            <Tag color={corClassificacaoBloco[c]}>
                              {labelClassificacaoBloco[c]}
                            </Tag>
                          ) : (
                            '-'
                          ),
                      },
                    ]}
                  />

                  <Tabela
                    rowKey="codigo"
                    size="small"
                    pagination={false}
                    scroll={{ x: 'max-content' }}
                    style={{ marginTop: 16 }}
                    dataSource={(recente.respostas ?? []) as any[]}
                    columns={[
                      { title: 'Nº', dataIndex: 'codigo', width: 70 },
                      {
                        title: 'Resposta',
                        dataIndex: 'resposta',
                        width: 110,
                        render: (v: string) => labelRespostaAuditoria[v] ?? v,
                      },
                      {
                        title: 'Evidência / observação',
                        dataIndex: 'evidencia',
                        render: (v: string) => v ?? '-',
                      },
                    ]}
                  />

                  {recente.conclusao && (
                    <Typography.Paragraph style={{ marginTop: 12 }}>
                      <Typography.Text strong>Conclusão: </Typography.Text>
                      {recente.conclusao}
                    </Typography.Paragraph>
                  )}
                  {recente.observacoes && (
                    <Typography.Paragraph>
                      <Typography.Text strong>Observações: </Typography.Text>
                      {recente.observacoes}
                    </Typography.Paragraph>
                  )}
                </Card>
              )}
            </>
          )}
        </Col>

        <Col xs={24} lg={9}>
          <Card title="Registro de Auditoria de Fornecedores">
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Fornecedor">
                {a.fornecedorNome}
              </Descriptions.Item>
              <Descriptions.Item label="CNPJ">{a.cnpj ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="Código do fornecedor">
                {a.codigoFornecedor ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Motivo da auditoria">
                {a.motivo ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Local">
                {a.local ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Auditores">
                {a.auditores ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Participantes">
                {a.participantes ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Semana">{a.semana}</Descriptions.Item>
              <Descriptions.Item label="Revisão / Nº de rodadas">
                {a.revisao} ({a.rodadasLancadas})
              </Descriptions.Item>
              <Descriptions.Item label="Data da auditoria">
                {dataBR(a.dataAuditoria)}
              </Descriptions.Item>
              <Descriptions.Item label="Data da última rodada">
                {dataBR(a.dataUltimaRodada)}
              </Descriptions.Item>
              <Descriptions.Item label="Nota">
                {fmtNota(a.nota)}
              </Descriptions.Item>
              <Descriptions.Item label="Resultado">
                {a.resultado ? (
                  <Tag color={corResultadoAuditoria[a.resultado]}>
                    {labelResultadoAuditoria[a.resultado]}
                  </Tag>
                ) : (
                  <Tag>Aguardando checklist</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Prazo de reavaliação">
                {a.prazoReavaliacaoDias
                  ? `${a.prazoReavaliacaoDias} dias corridos`
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Reavaliação">
                {r ? (
                  <Tag color={corSemaforoReavaliacao[r.semaforo]}>
                    {textoReavaliacao(r)}
                  </Tag>
                ) : (
                  '-'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Status da auditoria">
                <Tag color={corStatusAuditoria[a.statusAuditoria]}>
                  {labelStatusAuditoria[a.statusAuditoria]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Data de encerramento">
                {dataBR(a.dataFinalizacao)}
              </Descriptions.Item>
              <Descriptions.Item label="Conclusão da Qualidade">
                {a.conclusao ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Observações">
                {a.observacoes ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Registrado por">
                {a.criadoPor?.nome ?? '-'}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <CardAnexos
            titulo="Relatório final da Qualidade"
            descricao="Relatório de auditoria escrito pela Qualidade e enviado ao fornecedor. Obrigatório para encerrar a auditoria."
            entidadeTipo={TIPO_RELATORIO}
            entidadeId={id!}
            podeEditar={podeEditar}
          />
          <CardAnexos
            titulo="Plano de ação do fornecedor"
            descricao="Plano de ação devolvido pelo fornecedor e evidências de conclusão. Opcional: não trava o encerramento."
            entidadeTipo={TIPO_PLANO}
            entidadeId={id!}
            podeEditar={podeEditar}
          />
        </Col>
      </Row>

      <Modal
        open={registroOpen}
        title="Registro de Auditoria de Fornecedores"
        width={760}
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
            <Col span={14}>
              <Form.Item name="fornecedorNome" label="Fornecedor">
                <Input />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="dataAuditoria" label="Data da auditoria">
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
                <Input />
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
              <Form.Item
                name="statusAuditoria"
                label="Status da auditoria"
                extra='Para encerrar, use o botão "Encerrar auditoria" — ele confere se o ciclo está completo.'
              >
                <Select
                  options={opcoes(labelStatusAuditoria).map((o) => ({
                    ...o,
                    disabled: o.value === 'FINALIZADO',
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item
                name="conclusao"
                label="Conclusão / recomendação da Qualidade"
                extra="Obrigatória para encerrar a auditoria."
              >
                <Input.TextArea rows={3} />
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
        open={checklistOpen}
        title={`Checklist de auditoria ${a.numero} — Rev. ${String(
          rodadaEdicao ?? rodadas.length + 1,
        ).padStart(2, '0')}`}
        width={1180}
        okText={rodadaEdicao ? 'Salvar e recalcular' : 'Lançar e apurar a nota'}
        cancelText="Cancelar"
        confirmLoading={salvarChecklist.isPending}
        onOk={async () =>
          salvarChecklist.mutate(await formChecklist.validateFields())
        }
        onCancel={() => setChecklistOpen(false)}
        destroyOnClose
      >
        <Form form={formChecklist} layout="vertical">
          <Row gutter={12}>
            <Col span={6}>
              <Form.Item name="dataAuditoria" label="Data da rodada">
                <Input type="date" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="local" label="Local">
                <Input />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="auditores" label="Auditores">
                <Input />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="participantes" label="Participantes">
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <ChecklistAuditoria
            blocos={blocos}
            respostas={respostas}
            setRespostas={setRespostas}
          />

          <Form.Item
            name="conclusao"
            label="Conclusão da rodada"
            style={{ marginTop: 16 }}
          >
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="observacoes" label="Observações da rodada">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
