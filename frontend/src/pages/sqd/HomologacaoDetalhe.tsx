import { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Dropdown,
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
  CheckCircleOutlined,
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
import { dataBR, dataInput, separadoresBR } from '../../formatos';
import {
  Bloco,
  CamposAutoavaliacao,
  respostasIniciais,
} from './FormularioAutoavaliacao';
import {
  corResultado,
  corStatusHomologacao,
  labelAcao,
  labelEfetividade,
  labelResposta,
  labelResultado,
  labelSolicitante,
  labelStatusHomologacao,
  labelStatusPlanoAcao,
  nota,
  opcoes,
} from './comum';
import Tabela from '../../components/Tabela';
import NomeAssinatura from '../../components/NomeAssinatura';
import { CabecalhoDetalhe } from '../../design/painel';
import { BotaoEditar, BotaoExcluir, BotaoPdf } from '../../design/acoes';

const TIPO_RELATORIO = 'HOMOLOGACAO_RELATORIO';
const TIPO_PLANO = 'HOMOLOGACAO_PLANO_ACAO';

// Mesmos prazos usados pelo backend (sqd-utils): 3 dias uteis para o retorno do
// fornecedor e 3 dias uteis da solicitacao ate o envio do relatorio.
const SLA_RESPOSTA_DIAS = 3;
const SLA_RELATORIO_DIAS = 3;

// Relogio da tela: o numero em dias uteis com a etiqueta do prazo ao lado.
function Prazo({ dias, sla }: { dias: number | null; sla: number }) {
  if (dias == null) return <>-</>;
  return (
    <Space>
      <strong>{dias}</strong>
      <Tag color={dias <= sla ? 'green' : 'orange'}>
        {dias <= sla ? 'Dentro do SLA' : 'Fora do SLA'}
      </Tag>
    </Space>
  );
}

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
            } catch (e: any) {
              onError?.(e);
              message.error(
                e?.response?.data?.message ?? 'Falha no envio do documento.',
              );
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
    onError: (e: any) =>
      message.error(
        e?.response?.data?.message ?? 'Não foi possível salvar o registro.',
      ),
  });

  // A trava do ciclo mora aqui, fora do salvar: o registro pode ser editado a
  // qualquer momento; encerrar e que exige tudo no lugar.
  const finalizar = useMutation({
    mutationFn: async () => api.post(`/sqd/homologacoes/${id}/finalizar`),
    onSuccess: () => {
      message.success('Homologação finalizada.');
      invalidar();
    },
    onError: (e: any) =>
      message.error(
        e?.response?.data?.message ?? 'Não foi possível finalizar a homologação.',
      ),
  });

  const reabrir = useMutation({
    mutationFn: async () => api.post(`/sqd/homologacoes/${id}/reabrir`),
    onSuccess: () => {
      message.success('Homologação reaberta.');
      invalidar();
    },
    onError: (e: any) =>
      message.error(
        e?.response?.data?.message ?? 'Não foi possível reabrir a homologação.',
      ),
  });

  // A autoavaliacao tem rota propria: e ela que calcula a nota, o resultado e o
  // tempo de resposta do fornecedor.
  const salvarAvaliacao = useMutation({
    mutationFn: async (v: any) =>
      api.post(`/sqd/homologacoes/${id}/autoavaliacao`, { ...v, respostas }),
    onSuccess: (res: any) => {
      message.success(`Autoavaliação lançada — nota ${nota(res.data.nota)}.`);
      setAvaliacaoOpen(false);
      invalidar();
    },
    onError: (e: any) =>
      message.error(
        e?.response?.data?.message ??
          'Não foi possível salvar a autoavaliação.',
      ),
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

  // O resultado da autoavaliacao e um status; o do registro e outro. Enquanto o
  // fornecedor nao devolve o formulario nao existe nota nem resultado.
  const avaliado = !!h.resultado;
  const aguardando = !avaliado && h.statusHomologacao === 'EM_ANDAMENTO';
  const pendencias: string[] = h.pendenciasFinalizacao ?? [];
  const finalizado = h.statusHomologacao === 'FINALIZADO';

  function abrirRegistro() {
    formRegistro.setFieldsValue({
      codigoFornecedor: h.codigoFornecedor,
      solicitante: h.solicitante,
      segmento: h.segmento,
      escopoFornecedor: h.escopoFornecedor,
      processosTerceirizados: h.processosTerceirizados,
      dataSolicitacao: dataInput(h.dataSolicitacao),
      dataRetornoFornecedor: dataInput(h.dataRetornoFornecedor),
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
      // Por padrao, o lancamento e o retorno acontecem hoje.
      dataAvaliacao: dataInput(h.dataAvaliacao) || dayjs().format('YYYY-MM-DD'),
      dataRetornoFornecedor: dataInput(h.dataRetornoFornecedor) || dayjs().format('YYYY-MM-DD'),
    });
    setRespostas(h.respostas ?? respostasIniciais(perguntas));
    setAvaliacaoOpen(true);
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <CabecalhoDetalhe
        voltar={() => navigate('/sqd/homologacoes')}
        titulo={`Homologação ${h.numero}`}
        etiqueta={
          <>
            {avaliado ? (
              <Tag color={corResultado[h.resultado]}>
                {labelResultado[h.resultado]}
              </Tag>
            ) : (
              aguardando && <Tag>Aguardando retorno do fornecedor</Tag>
            )}
            <Tag color={corStatusHomologacao[h.statusHomologacao]}>
              {labelStatusHomologacao[h.statusHomologacao]}
            </Tag>
          </>
        }
        acoes={
          <>
            {/* Sao dois documentos diferentes; um menu so evita dois botoes de
                PDF disputando espaco no cabecalho. */}
            {avaliado ? (
              <Dropdown
                trigger={['click']}
                menu={{
                  items: [
                    {
                      key: 'registro',
                      label: 'Registro da homologação',
                      onClick: () =>
                        abrirPdfEmNovaAba(`/sqd/homologacoes/${id}/pdf`),
                    },
                    {
                      key: 'autoavaliacao',
                      label: 'Autoavaliação do fornecedor',
                      onClick: () =>
                        abrirPdfEmNovaAba(
                          `/sqd/homologacoes/${id}/autoavaliacao/pdf`,
                        ),
                    },
                  ],
                }}
              >
                <Button icon={<FilePdfOutlined />}>Exportar PDF</Button>
              </Dropdown>
            ) : (
              <BotaoPdf
                onClick={() => abrirPdfEmNovaAba(`/sqd/homologacoes/${id}/pdf`)}
              />
            )}
            {podeEditar && (
              <>
                <BotaoEditar onClick={abrirRegistro} texto="Editar registro" />
                {/* Preencher formulario em branco e outro gesto: continua com o
                    icone de formulario, nao com o lapis de correcao. */}
                <Button
                  type={avaliado ? 'default' : 'primary'}
                  icon={<FormOutlined />}
                  onClick={abrirAvaliacao}
                >
                  {avaliado
                    ? 'Editar autoavaliação'
                    : 'Lançar autoavaliação do fornecedor'}
                </Button>
                {/* A trava do ciclo: salvar o registro nunca e bloqueado, mas
                    encerrar so passa com tudo o que a planilha pede. */}
                {finalizado ? (
                  <Button
                    icon={<UndoOutlined />}
                    loading={reabrir.isPending}
                    onClick={() =>
                      Modal.confirm({
                        title: `Reabrir a homologação ${h.numero}?`,
                        content:
                          'A data de finalização e o tempo total do ciclo serão apagados, e o registro volta para "Em andamento".',
                        okText: 'Reabrir',
                        cancelText: 'Cancelar',
                        onOk: () => reabrir.mutateAsync(),
                      })
                    }
                  >
                    Reabrir homologação
                  </Button>
                ) : (
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    loading={finalizar.isPending}
                    disabled={h.statusHomologacao === 'CANCELADO'}
                    onClick={() => finalizar.mutate()}
                  >
                    Finalizar homologação
                  </Button>
                )}
                <BotaoExcluir
                  titulo={`Excluir a homologação ${h.numero}?`}
                  descricao="A autoavaliação, o resultado e os anexos serão apagados."
                  onConfirm={() => remover.mutateAsync()}
                />
              </>
            )}
          </>
        }
      />

      {aguardando && (
        <Alert
          type="info"
          showIcon
          message="Aguardando o retorno do fornecedor"
          description={`O formulário de autoavaliação foi enviado em ${dataBR(
            h.dataSolicitacao,
          )}. O fornecedor tem ${SLA_RESPOSTA_DIAS} dias úteis para devolver. Quando a resposta chegar, use "Lançar autoavaliação do fornecedor" para registrar as respostas e apurar o resultado.`}
        />
      )}

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
          description="O relatório precisa apontar as ações e os prazos para os pontos reprovados abaixo."
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

      {/* O ciclo so fecha quando tudo o que a planilha pede esta no lugar. */}
      {!aguardando &&
        h.statusHomologacao !== 'FINALIZADO' &&
        h.statusHomologacao !== 'CANCELADO' &&
        pendencias.length > 0 && (
          <Alert
            type="info"
            showIcon
            message="Falta para finalizar a homologação"
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
          {/* Sem resposta do fornecedor nao ha nota nem resultado: no lugar do
              cartao de resultado fica o atalho para lancar a autoavaliacao. */}
          {!avaliado && (
            <Card title="Autoavaliação do fornecedor">
              <Typography.Paragraph type="secondary">
                {h.statusHomologacao === 'CANCELADO'
                  ? 'Este registro foi cancelado e não recebe autoavaliação.'
                  : 'O fornecedor ainda não devolveu o formulário BDBR.QUA.FMR.024.03. Assim que a resposta chegar, lance as respostas aqui: o sistema calcula a pontuação de cada bloco, a nota ponderada e o tempo de resposta do fornecedor.'}
              </Typography.Paragraph>
              {podeEditar && h.statusHomologacao !== 'CANCELADO' && (
                <Button
                  type="primary"
                  icon={<FormOutlined />}
                  onClick={abrirAvaliacao}
                >
                  Lançar autoavaliação do fornecedor
                </Button>
              )}
            </Card>
          )}

          {avaliado && (
            <>
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
            <Tabela
              rowKey="letra"
              size="small"
              pagination={false}
              scroll={{ x: 'max-content' }}
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
            <Tabela
              rowKey="codigo"
              size="small"
              pagination={false}
              scroll={{ x: 'max-content' }}
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
            <Descriptions column={{ xs: 1, sm: 2, md: 2, lg: 2, xl: 2, xxl: 2 }} bordered size="small">
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
                  <Tabela
                    style={{ marginTop: 8 }}
                    rowKey="codigo"
                    size="small"
                    pagination={false}
                    scroll={{ x: 'max-content' }}
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
            </>
          )}
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
              <Descriptions.Item label="Data de retorno do fornecedor">
                {dataBR(h.dataRetornoFornecedor)}
              </Descriptions.Item>
              <Descriptions.Item
                label={`Resposta do fornecedor (dias úteis, SLA ${SLA_RESPOSTA_DIAS})`}
              >
                <Prazo
                  dias={h.tempoRespostaDiasUteis}
                  sla={SLA_RESPOSTA_DIAS}
                />
              </Descriptions.Item>
              <Descriptions.Item label="Data de envio do relatório">
                {dataBR(h.dataEnvioRelatorio)}
              </Descriptions.Item>
              <Descriptions.Item
                label={`Lead time (dias úteis, SLA ${SLA_RELATORIO_DIAS})`}
              >
                <Prazo dias={h.leadTimeDiasUteis} sla={SLA_RELATORIO_DIAS} />
              </Descriptions.Item>
              <Descriptions.Item label="Data de finalização">
                {dataBR(h.dataFinalizacao)}
              </Descriptions.Item>
              <Descriptions.Item label="Tempo total do ciclo (dias úteis)">
                {h.tempoTotalDiasUteis ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Resultado da autoavaliação">
                {avaliado ? (
                  <Tag color={corResultado[h.resultado]}>
                    {labelResultado[h.resultado]}
                  </Tag>
                ) : (
                  <Tag>Aguardando retorno do fornecedor</Tag>
                )}
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
              <Descriptions.Item label="Ação">
                {h.acao ? labelAcao[h.acao] ?? h.acao : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Observações">
                {h.observacoes ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Registrado por">
                <NomeAssinatura nome={h.criadoPor?.nome} />
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
        destroyOnHidden
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
            <Col span={8}>
              <Form.Item name="dataSolicitacao" label="Data da solicitação">
                <Input type="date" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="dataRetornoFornecedor"
                label="Data de retorno do fornecedor"
              >
                <Input type="date" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="dataEnvioRelatorio"
                label="Data de envio do relatório"
              >
                <Input type="date" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="statusHomologacao"
                label="Status da homologação"
                extra='Para encerrar, use o botão "Finalizar homologação" — ele confere se o ciclo está completo.'
              >
                <Select
                  options={opcoes(labelStatusHomologacao).map((o) => ({
                    ...o,
                    disabled: o.value === 'FINALIZADO',
                  }))}
                />
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
              <Form.Item
                name="acao"
                label="Ação"
                extra="Lista de validação da coluna “Ação” do FMR.029.01."
              >
                <Select options={opcoes(labelAcao)} />
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
        okText={avaliado ? 'Salvar e recalcular' : 'Lançar e apurar resultado'}
        cancelText="Cancelar"
        confirmLoading={salvarAvaliacao.isPending}
        onOk={async () =>
          salvarAvaliacao.mutate(await formAvaliacao.validateFields())
        }
        onCancel={() => setAvaliacaoOpen(false)}
        destroyOnHidden
      >
        <Form form={formAvaliacao} layout="vertical">
          <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
            Lance aqui as respostas enviadas pelo fornecedor. A data de retorno
            é a data em que o fornecedor devolveu o formulário — é ela que mede
            se o prazo de {SLA_RESPOSTA_DIAS} dias úteis foi cumprido.
          </Typography.Paragraph>
          <Row gutter={12}>
            <Col xs={24} md={6}>
              <Form.Item
                name="dataRetornoFornecedor"
                label="Data de retorno do fornecedor"
                rules={[
                  { required: true, message: 'Informe a data de retorno' },
                ]}
              >
                <Input type="date" />
              </Form.Item>
            </Col>
          </Row>
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
