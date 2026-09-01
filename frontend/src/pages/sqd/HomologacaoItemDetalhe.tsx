import { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Form,
  Input,
  InputNumber,
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
  ChecklistVisual,
  Cota,
  GrupoVisual,
  CamposCabecalhoInspecao,
  PECAS_PADRAO,
  checklistInicial,
  cotaVazia,
  cotasComDesvio,
  normaDoRelatorio,
  resultadoVisual,
} from './FormularioInspecaoItem';
import { BlocoDesenhos, CotasPorDesenho } from '../../components/TabelaCotas';
import {
  CardDesvioQualidade,
  TIPO_DESVIO,
} from '../../components/DesvioQualidade';
import {
  FotosDesvio,
  FotosEvidenciaSalvas,
  UploadFotosEvidencia,
  enviarFotosDesvio,
  enviarFotosEvidencia,
} from '../../components/FotosEvidencia';
import {
  DesenhoExtra,
  EVID,
  checklistDoRelatorio,
  desenhosExtras,
  labelNorma,
  textoDesenho,
  textoRevisao,
} from '../../inspecao';
import {
  corResultadoItem,
  corStatusHomologacao,
  corStatusVisual,
  labelAcaoItem,
  labelEfetividade,
  labelMotivoItem,
  labelOrigemInspecao,
  labelResultadoItem,
  labelSolicitanteItem,
  labelStatusHomologacao,
  labelStatusPlanoAcao,
  labelStatusVisual,
  opcoes,
} from './comum';
import Tabela from '../../components/Tabela';
import { CamposItem } from '../../components/CamposItem';
import { moeda, formatarMoedaInput, lerMoedaInput } from '../../moeda';
import NomeAssinatura from '../../components/NomeAssinatura';
import { nomeCurto } from '../../formatos';

const TIPO_RELATORIO = 'HOMOLOGACAO_ITEM_RELATORIO';
const TIPO_PLANO = 'HOMOLOGACAO_ITEM_PLANO_ACAO';

// Mesmos prazos usados pelo backend (itens-utils): 3 dias uteis para as
// amostras chegarem e 3 dias uteis da solicitacao ate o envio do relatorio.
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

// Registro de Homologação de Itens — Doc. BDBR.QUA.FMR.025.01.
// Mesma leitura da homologação de fornecedores; no lugar da autoavaliação
// entram os relatórios de inspeção (abas AMOSTRAS e VISUAL), um por tentativa.
export default function HomologacaoItemDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { usuario } = useAuth();
  const podeEditar =
    usuario?.papel === 'ADMIN' || usuario?.papel === 'QUALIDADE';

  const [registroOpen, setRegistroOpen] = useState(false);
  const [inspecaoOpen, setInspecaoOpen] = useState(false);
  const [formRegistro] = Form.useForm();
  const [formInspecao] = Form.useForm();
  const [cotas, setCotas] = useState<Cota[]>([]);
  // Peca de conjunto: desenhos do 2o em diante. O 1o e o do cabecalho.
  const [desenhos, setDesenhos] = useState<DesenhoExtra[]>([]);
  const [checklist, setChecklist] = useState<GrupoVisual[]>([]);
  const [fotosDimensional, setFotosDimensional] = useState<any[]>([]);
  const [fotosVisual, setFotosVisual] = useState<any[]>([]);
  // Foto presa a um item REPROVADO do checklist: a chave e a posicao do item e
  // a legenda no PDF e o proprio texto dele.
  const [fotosDesvio, setFotosDesvio] = useState<FotosDesvio>({});
  // Tentativa que está aberta no modal; null = uma rodada nova.
  const [tentativaEdicao, setTentativaEdicao] = useState<number | null>(null);

  // A norma vale para o relatorio inteiro e o numero de colunas de peca segue a
  // quantidade inspecionada — os dois vem do cabecalho.
  const norma = normaDoRelatorio(Form.useWatch('tolerancias', formInspecao));
  const qtdPecas =
    Number(Form.useWatch('qtdInspecionada', formInspecao)) || PECAS_PADRAO;
  const desenhoSel = Form.useWatch('desenho', formInspecao);
  const revisaoSel = Form.useWatch('desenhoRevisao', formInspecao);

  const { data: h, isLoading } = useQuery<any>({
    queryKey: ['sqd-homologacao-item', id],
    queryFn: async () => (await api.get(`/sqd/homologacoes-itens/${id}`)).data,
  });

  function invalidar() {
    qc.invalidateQueries({ queryKey: ['sqd-homologacao-item', id] });
    qc.invalidateQueries({ queryKey: ['sqd-homologacoes-itens'] });
  }

  const salvarRegistro = useMutation({
    mutationFn: async (v: any) => api.patch(`/sqd/homologacoes-itens/${id}`, v),
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
    mutationFn: async () => api.post(`/sqd/homologacoes-itens/${id}/finalizar`),
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
    mutationFn: async () => api.post(`/sqd/homologacoes-itens/${id}/reabrir`),
    onSuccess: () => {
      message.success('Homologação reaberta.');
      invalidar();
    },
    onError: (e: any) =>
      message.error(
        e?.response?.data?.message ?? 'Não foi possível reabrir a homologação.',
      ),
  });

  // A legenda da foto e o texto do item que reprovou. Se o inspetor marcou,
  // anexou a foto e depois voltou atras, o item deixa de estar REPROVADO e a
  // foto nao sobe.
  function legendaDoDesvio(chave: string): string | null {
    const [gi, ii] = chave.split('-').map(Number);
    const item = checklist[gi]?.itens?.[ii];
    return item?.status === 'REPROVADO' ? item.texto : null;
  }

  // O relatorio de inspecao tem rota propria: e ele que apura o resultado do
  // item e o tempo de resposta do fornecedor.
  const salvarInspecao = useMutation({
    mutationFn: async (v: any) => {
      const corpo = {
        ...v,
        cotas,
        desenhos,
        checklistVisual: checklist,
        resultadoAmostras: cotasComDesvio(cotas) ? 'REPROVADO' : 'APROVADO',
        resultadoVisual: resultadoVisual(checklist),
      };
      // Corrigir um relatorio ja lancado tem rota propria (PATCH), aberta a
      // quem enxerga o modulo. Lancar uma tentativa nova continua sendo POST,
      // restrito a Qualidade.
      const res = tentativaEdicao
        ? await api.patch(
            `/sqd/homologacoes-itens/${id}/relatorio/${tentativaEdicao}`,
            corpo,
          )
        : await api.post(`/sqd/homologacoes-itens/${id}/relatorio`, corpo);
      // As fotos dos blocos EVIDENCIAS so podem subir depois: elas precisam do
      // id do relatorio da tentativa que acabou de ser gravada.
      if (
        fotosDimensional.length ||
        fotosVisual.length ||
        Object.keys(fotosDesvio).length
      ) {
        const lista: any[] = res.data?.relatorios ?? [];
        const alvo = tentativaEdicao
          ? lista.find((r) => r.tentativa === tentativaEdicao)
          : lista[lista.length - 1];
        if (alvo?.id) {
          if (fotosDimensional.length)
            await enviarFotosEvidencia(
              fotosDimensional,
              EVID.homologacaoItemDimensional,
              alvo.id,
            );
          if (fotosVisual.length)
            await enviarFotosEvidencia(
              fotosVisual,
              EVID.homologacaoItemVisual,
              alvo.id,
            );
          await enviarFotosDesvio(
            fotosDesvio,
            legendaDoDesvio,
            EVID.homologacaoItemVisualDesvio,
            alvo.id,
          );
        }
      }
      return res;
    },
    onSuccess: (res: any, v: any) => {
      message.success(
        v?.rascunho
          ? 'Rascunho do relatório salvo. Ele não apura resultado nem conta nos indicadores até ser lançado.'
          : `Relatório de inspeção lançado — item ${
              labelResultadoItem[res.data.resultado] ?? res.data.resultado
            }.`,
      );
      setInspecaoOpen(false);
      invalidar();
    },
    onError: (e: any) =>
      message.error(
        e?.response?.data?.message ??
          'Não foi possível salvar o relatório de inspeção.',
      ),
  });

  const removerRelatorio = useMutation({
    mutationFn: async (tentativa: number) =>
      api.delete(`/sqd/homologacoes-itens/${id}/relatorio/${tentativa}`),
    onSuccess: () => {
      message.success('Relatório de inspeção excluído.');
      invalidar();
    },
    onError: () =>
      message.error('Não foi possível excluir o relatório de inspeção.'),
  });

  // Descartar rascunho e diferente de excluir: o rascunho nunca apurou
  // resultado, entao nao ha o que recalcular no registro. Por isso vale para
  // qualquer um do modulo, e nao so para quem pode excluir tentativa lancada.
  const descartarRascunho = useMutation({
    mutationFn: async (tentativa: number) =>
      api.delete(
        `/sqd/homologacoes-itens/${id}/relatorio/${tentativa}/rascunho`,
      ),
    onSuccess: () => {
      message.success('Rascunho descartado.');
      invalidar();
    },
    onError: (e: any) =>
      message.error(
        e?.response?.data?.message ?? 'Não foi possível descartar o rascunho.',
      ),
  });

  const remover = useMutation({
    mutationFn: async () => api.delete(`/sqd/homologacoes-itens/${id}`),
    onSuccess: () => {
      message.success('Homologação excluída.');
      qc.invalidateQueries({ queryKey: ['sqd-homologacoes-itens'] });
      navigate('/sqd/homologacoes-itens');
    },
    onError: () => message.error('Não foi possível excluir a homologação.'),
  });

  if (isLoading || !h) return null;

  const relatorios: any[] = h.relatorios ?? [];
  const catalogo: { grupo: string; itens: string[] }[] = h.checklistVisual ?? [];
  const recente = relatorios.length ? relatorios[relatorios.length - 1] : null;
  const temRascunho = relatorios.some((r) => r.rascunho);
  // Tentativa reaberta que ainda e rascunho: em vez de "salvar e recalcular",
  // o botao lanca o relatorio, e aparece o "Descartar".
  const editandoRascunho = !!(
    tentativaEdicao &&
    relatorios.find((r) => r.tentativa === tentativaEdicao)?.rascunho
  );

  // Sem relatorio de inspecao nao existe resultado: o registro esta esperando
  // as amostras do fornecedor.
  const inspecionado = !!h.resultado;
  const aguardando = !inspecionado && h.statusHomologacao === 'EM_ANDAMENTO';
  const pendencias: string[] = h.pendenciasFinalizacao ?? [];
  const finalizado = h.statusHomologacao === 'FINALIZADO';
  const cancelado = h.statusHomologacao === 'CANCELADO';

  function abrirRegistro() {
    formRegistro.setFieldsValue({
      fornecedorNome: h.fornecedorNome,
      codigoFornecedor: h.codigoFornecedor,
      itemCodigo: h.itemCodigo,
      itemDescricao: h.itemDescricao,
      solicitante: h.solicitante,
      motivo: h.motivo,
      custoEvitado: h.custoEvitado,
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

  // Sem tentativa, abre uma rodada nova, herdando o cabecalho da anterior.
  function abrirInspecao(tentativa?: number) {
    const r = tentativa
      ? relatorios.find((x) => x.tentativa === tentativa)
      : null;
    const base = r ?? recente;
    setTentativaEdicao(r ? r.tentativa : null);
    formInspecao.setFieldsValue({
      dataInspecao: r ? dataInput(r.dataInspecao) : dayjs().format('YYYY-MM-DD'),
      dataRetornoFornecedor:
        dataInput(h.dataRetornoFornecedor) || dayjs().format('YYYY-MM-DD'),
      origem: base?.origem ?? 'HOMOLOGACAO',
      desenho: base?.desenho ?? base?.desenhoRev,
      desenhoRevisao: base?.desenhoRevisao,
      tolerancias: normaDoRelatorio(base?.tolerancias),
      nf: r?.nf,
      po: base?.po,
      qtdInspecionada: r?.qtdInspecionada,
      qtdTotal: base?.qtdTotal,
      observacoesAmostras: r?.observacoesAmostras,
      evidenciasVisual: r?.evidenciasVisual,
      observacoesVisual: r?.observacoesVisual,
    });
    // Numa rodada nova as cotas do relatorio anterior voltam sem as medidas:
    // o que se repete e o desenho, nao a peca.
    setCotas(
      r
        ? ((r.cotas ?? []) as Cota[])
        : ((base?.cotas ?? [cotaVazia()]) as Cota[]).map((c) => ({
            ...c,
            pecas: (c.pecas ?? []).map(() => ''),
            desvioMin: '',
            desvioMax: '',
            conformeAuto: null,
            conformeManual: null,
            conforme: null,
          })),
    );
    // Os desenhos vem do mesmo lugar que as cotas: a rodada nova mede a mesma
    // peca, entao herda os mesmos desenhos do conjunto.
    setDesenhos(desenhosExtras(base?.desenhos));
    setChecklist(
      r?.checklistVisual?.length
        ? (r.checklistVisual as GrupoVisual[])
        : checklistInicial(catalogo),
    );
    setFotosDimensional([]);
    setFotosVisual([]);
    setFotosDesvio({});
    setInspecaoOpen(true);
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Row justify="space-between" align="middle">
        <Space wrap>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/sqd/homologacoes-itens')}
          >
            Voltar
          </Button>
          <Typography.Title level={4} style={{ margin: 0 }}>
            Homologação {h.numero}
          </Typography.Title>
          <Tag>Rev. {h.revisao}</Tag>
          {inspecionado ? (
            <Tag color={corResultadoItem[h.resultado]}>
              {labelResultadoItem[h.resultado]}
            </Tag>
          ) : (
            aguardando && <Tag>Aguardando amostras do fornecedor</Tag>
          )}
          <Tag color={corStatusHomologacao[h.statusHomologacao]}>
            {labelStatusHomologacao[h.statusHomologacao]}
          </Tag>
        </Space>
        <Space wrap>
          <Button
            icon={<FilePdfOutlined />}
            onClick={() => abrirPdfEmNovaAba(`/sqd/homologacoes-itens/${id}/pdf`)}
          >
            PDF do registro
          </Button>
          {relatorios.length > 0 && (
            <Button
              icon={<FilePdfOutlined />}
              onClick={() =>
                abrirPdfEmNovaAba(
                  `/sqd/homologacoes-itens/${id}/relatorio/pdf`,
                )
              }
            >
              PDF do relatório de inspeção
            </Button>
          )}
          {podeEditar && (
            <>
              {/* Rascunho aberto segura a tentativa nova: seriam duas rodadas
                  em aberto na mesma homologacao, nenhuma com resultado. */}
              <Button
                type={inspecionado ? 'default' : 'primary'}
                icon={<FormOutlined />}
                disabled={cancelado || temRascunho}
                title={
                  temRascunho
                    ? 'Existe um rascunho em aberto. Lance ou descarte esse rascunho antes de abrir uma tentativa nova.'
                    : undefined
                }
                onClick={() => abrirInspecao()}
              >
                {relatorios.length
                  ? 'Nova tentativa de inspeção'
                  : 'Lançar relatório de inspeção'}
              </Button>
              <Button icon={<EditOutlined />} onClick={abrirRegistro}>
                Editar registro
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
                  disabled={cancelado}
                  onClick={() => finalizar.mutate()}
                >
                  Finalizar homologação
                </Button>
              )}
              <Button
                icon={<DeleteOutlined />}
                danger
                loading={remover.isPending}
                onClick={() =>
                  Modal.confirm({
                    title: `Excluir a homologação ${h.numero}?`,
                    content:
                      'Os relatórios de inspeção, o resultado e os anexos serão apagados.',
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
          message="Aguardando as amostras do fornecedor"
          description={`As amostras foram solicitadas em ${dataBR(
            h.dataSolicitacao,
          )}. O fornecedor tem ${SLA_RESPOSTA_DIAS} dias úteis para enviar. Quando as peças chegarem, use "Lançar relatório de inspeção" para registrar as abas AMOSTRAS e VISUAL e apurar o resultado.`}
        />
      )}

      {h.resultado === 'REPROVADO' && (
        <Alert
          type="error"
          showIcon
          message="Item reprovado"
          description="O relatório precisa apontar os desvios encontrados e o plano de ação do fornecedor deve ser anexado. As novas amostras entram como uma nova tentativa, sob o mesmo número."
        />
      )}
      {h.resultado === 'APROVADO' && h.tentativas > 1 && (
        <Alert
          type="success"
          showIcon
          message={`Item aprovado na ${h.tentativas}ª tentativa`}
          description="O item foi aprovado depois de uma ou mais rodadas de amostras. As tentativas anteriores ficam no histórico abaixo."
        />
      )}

      {/* O ciclo so fecha quando tudo o que a planilha pede esta no lugar. */}
      {!aguardando &&
        !finalizado &&
        !cancelado &&
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
          {/* Sem amostras nao ha inspecao nem resultado: no lugar do cartao de
              resultado fica o atalho para lancar o relatorio. */}
          {!relatorios.length && (
            <Card title="Relatório de inspeção do item">
              <Typography.Paragraph type="secondary">
                {cancelado
                  ? 'Este registro foi cancelado e não recebe relatório de inspeção.'
                  : 'As amostras ainda não foram inspecionadas. Assim que as peças chegarem, lance aqui as abas AMOSTRAS (BDBR.QUA.FMR.011.06) e VISUAL (BDBR.QUA.FMR.06.07): o item só é aprovado quando as duas passam.'}
              </Typography.Paragraph>
              {podeEditar && !cancelado && (
                <Button
                  type="primary"
                  icon={<FormOutlined />}
                  onClick={() => abrirInspecao()}
                >
                  Lançar relatório de inspeção
                </Button>
              )}
            </Card>
          )}

          {relatorios.length > 0 && (
            <>
              <Card title={`Tentativas de homologação (${relatorios.length})`}>
                <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
                  Cada rodada de amostras é um relatório sob o mesmo número, com
                  a revisão igual ao número da tentativa. O resultado do registro
                  sai sempre da tentativa mais recente.
                </Typography.Paragraph>
                <Tabela
                  rowKey="tentativa"
                  size="small"
                  pagination={false}
                  scroll={{ x: 'max-content' }}
                  dataSource={relatorios}
                  columns={[
                    {
                      title: 'Rev.',
                      width: 130,
                      render: (_: any, r: any) => (
                        <Space size={4}>
                          <span>{r.revisao}</span>
                          {r.rascunho && <Tag color="orange">Rascunho</Tag>}
                        </Space>
                      ),
                    },
                    {
                      title: 'Data',
                      dataIndex: 'dataInspecao',
                      width: 110,
                      render: (d: string) => dataBR(d),
                    },
                    // Rascunho nao apura nada: o resultado gravado e so o que
                    // estava na tela quando o inspetor parou, e mostra-lo como
                    // veredito faria parecer que a tentativa ja foi decidida.
                    {
                      title: 'Amostras',
                      dataIndex: 'resultadoAmostras',
                      width: 110,
                      render: (v: string, r: any) =>
                        r.rascunho ? (
                          '-'
                        ) : (
                          <Tag color={corStatusVisual[v]}>
                            {labelStatusVisual[v]}
                          </Tag>
                        ),
                    },
                    {
                      title: 'Visual',
                      dataIndex: 'resultadoVisual',
                      width: 110,
                      render: (v: string, r: any) =>
                        r.rascunho ? (
                          '-'
                        ) : (
                          <Tag color={corStatusVisual[v]}>
                            {labelStatusVisual[v]}
                          </Tag>
                        ),
                    },
                    {
                      title: 'Inspecionado por',
                      render: (_: any, r: any) =>
                        nomeCurto(r.criadoPor?.nome) || r.inspecionadoPor || '-',
                    },
                    {
                      title: '',
                      width: 160,
                      align: 'right',
                      render: (_: any, r: any) => (
                        <Space>
                          <Button
                            size="small"
                            icon={<FilePdfOutlined />}
                            onClick={() =>
                              abrirPdfEmNovaAba(
                                `/sqd/homologacoes-itens/${id}/relatorio/pdf?tentativa=${r.tentativa}`,
                              )
                            }
                          />
                          {/* Corrigir o que foi digitado errado nao depende da
                              Qualidade: quem enxerga o modulo conserta. */}
                          <Button
                            size="small"
                            title={
                              r.rascunho
                                ? 'Continuar este rascunho'
                                : 'Corrigir esta tentativa'
                            }
                            icon={<EditOutlined />}
                            onClick={() => abrirInspecao(r.tentativa)}
                          />
                          {/* Descartar rascunho nao desfaz nada: a tentativa
                              nunca apurou resultado. Por isso vale para todo
                              mundo do modulo, sem depender do podeEditar. */}
                          {r.rascunho ? (
                            <Button
                              size="small"
                              danger
                              title="Descartar rascunho"
                              icon={<DeleteOutlined />}
                              onClick={() =>
                                Modal.confirm({
                                  title: `Descartar o rascunho da ${r.revisao}?`,
                                  content:
                                    'O que foi preenchido será perdido. Como o rascunho nunca foi lançado, o resultado do item não muda.',
                                  okText: 'Descartar',
                                  okButtonProps: { danger: true },
                                  cancelText: 'Cancelar',
                                  onOk: () =>
                                    descartarRascunho.mutateAsync(r.tentativa),
                                })
                              }
                            />
                          ) : (
                            podeEditar && (
                              <Button
                                size="small"
                                danger
                                icon={<DeleteOutlined />}
                                onClick={() =>
                                  Modal.confirm({
                                    title: `Excluir a tentativa ${r.revisao}?`,
                                    content:
                                      'As cotas e o checklist visual desta tentativa serão apagados, e o resultado volta a sair do relatório que sobrar.',
                                    okText: 'Excluir',
                                    okButtonProps: { danger: true },
                                    cancelText: 'Cancelar',
                                    onOk: () =>
                                      removerRelatorio.mutateAsync(r.tentativa),
                                  })
                                }
                              />
                            )
                          )}
                        </Space>
                      ),
                    },
                  ]}
                />
              </Card>

              {recente && (
                <Card
                  title={`Relatório de inspeção — Rev. ${recente.revisao}`}
                  style={{ marginTop: 16 }}
                  extra={
                    <Space>
                      <Tag color={corStatusVisual[recente.resultadoAmostras]}>
                        Amostras: {labelStatusVisual[recente.resultadoAmostras]}
                      </Tag>
                      <Tag color={corStatusVisual[recente.resultadoVisual]}>
                        Visual: {labelStatusVisual[recente.resultadoVisual]}
                      </Tag>
                    </Space>
                  }
                >
                  <Descriptions column={{ xs: 1, sm: 2, md: 2, lg: 2, xl: 2, xxl: 2 }} bordered size="small">
                    <Descriptions.Item label="Data da inspeção">
                      {dataBR(recente.dataInspecao)}
                    </Descriptions.Item>
                    <Descriptions.Item label="Origem">
                      {labelOrigemInspecao[recente.origem] ?? recente.origem}
                    </Descriptions.Item>
                    <Descriptions.Item label="Desenho">
                      {textoDesenho(recente.desenho, recente.desenhoRev)}
                    </Descriptions.Item>
                    <Descriptions.Item label="Revisão do desenho">
                      {textoRevisao(recente.desenhoRevisao)}
                    </Descriptions.Item>
                    <Descriptions.Item label="Tolerâncias">
                      {labelNorma(recente.tolerancias) || '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="NF">
                      {recente.nf ?? '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="PO">
                      {recente.po ?? '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Qtd. inspecionada">
                      {recente.qtdInspecionada ?? '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Qtd. total do lote">
                      {recente.qtdTotal ?? '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Elaborado por">
                      {recente.criadoPor?.nome ? (
                        <NomeAssinatura nome={recente.criadoPor.nome} />
                      ) : (
                        (recente.elaboradoPor ?? '-')
                      )}
                    </Descriptions.Item>
                    <Descriptions.Item label="Inspecionado por">
                      {recente.criadoPor?.nome ? (
                        <NomeAssinatura nome={recente.criadoPor.nome} />
                      ) : (
                        (recente.inspecionadoPor ?? '-')
                      )}
                    </Descriptions.Item>
                  </Descriptions>

                  <Divider orientation="left" plain>
                    AMOSTRAS — Doc. BDBR.QUA.FMR.011.06
                  </Divider>
                  <CotasPorDesenho
                    cotas={recente.cotas}
                    desenhos={recente.desenhos}
                    desenho={recente.desenho}
                    revisao={recente.desenhoRevisao}
                    legado={recente.desenhoRev}
                  />
                  <Divider orientation="left" plain>
                    Evidências do dimensional
                  </Divider>
                  <FotosEvidenciaSalvas
                    entidadeTipo={EVID.homologacaoItemDimensional}
                    entidadeId={recente.id}
                  />
                  {recente.observacoesAmostras && (
                    <Typography.Paragraph style={{ marginTop: 12 }}>
                      <Typography.Text strong>Observações: </Typography.Text>
                      {recente.observacoesAmostras}
                    </Typography.Paragraph>
                  )}

                  <Divider orientation="left" plain>
                    VISUAL — Doc. BDBR.QUA.FMR.06.07
                  </Divider>
                  {/* So o que foi avaliado: os itens em "N/A" ficam de fora. */}
                  {checklistDoRelatorio(recente.checklistVisual).map(
                    (g) => (
                      <div key={g.grupo} style={{ marginTop: 12 }}>
                        <Typography.Text strong>{g.grupo}</Typography.Text>
                        <Tabela
                          style={{ marginTop: 8 }}
                          rowKey="texto"
                          size="small"
                          pagination={false}
                          scroll={{ x: 'max-content' }}
                          dataSource={g.itens}
                          columns={[
                            { title: 'Item', dataIndex: 'texto' },
                            {
                              title: 'Status',
                              dataIndex: 'status',
                              width: 110,
                              align: 'center',
                              render: (s: string) => (
                                <Tag color={corStatusVisual[s]}>
                                  {labelStatusVisual[s]}
                                </Tag>
                              ),
                            },
                          ]}
                        />
                      </div>
                    ),
                  )}
                  <Divider orientation="left" plain>
                    Evidências do visual
                  </Divider>
                  <FotosEvidenciaSalvas
                    entidadeTipo={EVID.homologacaoItemVisual}
                    entidadeId={recente.id}
                  />
                  {recente.evidenciasVisual && (
                    <Typography.Paragraph style={{ marginTop: 12 }}>
                      <Typography.Text strong>Evidências: </Typography.Text>
                      {recente.evidenciasVisual}
                    </Typography.Paragraph>
                  )}
                  {recente.observacoesVisual && (
                    <Typography.Paragraph>
                      <Typography.Text strong>Observações: </Typography.Text>
                      {recente.observacoesVisual}
                    </Typography.Paragraph>
                  )}
                </Card>
              )}
            </>
          )}
        </Col>

        <Col xs={24} lg={9}>
          <Card title="Registro de Homologação de Itens — Doc. BDBR.QUA.FMR.025.01">
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Fornecedor">
                {h.fornecedorNome}
              </Descriptions.Item>
              <Descriptions.Item label="Código do fornecedor">
                {h.codigoFornecedor ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Código do item">
                {h.itemCodigo ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Descrição do item">
                {h.itemDescricao ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Solicitante">
                {h.solicitante ? labelSolicitanteItem[h.solicitante] : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Motivo da homologação">
                {h.motivo ? labelMotivoItem[h.motivo] : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Custo evitado">
                {moeda(h.custoEvitado)}
              </Descriptions.Item>
              <Descriptions.Item label="Semana">{h.semana}</Descriptions.Item>
              <Descriptions.Item label="Revisão / Nº de tentativas">
                {h.revisao} ({h.tentativas})
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
              <Descriptions.Item label="Resultado da homologação">
                {inspecionado ? (
                  <Tag color={corResultadoItem[h.resultado]}>
                    {labelResultadoItem[h.resultado]}
                  </Tag>
                ) : (
                  <Tag>Aguardando amostras do fornecedor</Tag>
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
                {h.acao ? labelAcaoItem[h.acao] ?? h.acao : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Observações">
                {h.observacoes ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Registrado por">
                <NomeAssinatura nome={h.criadoPor?.nome} />
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <CardDesvioQualidade
            registro={h}
            entidadeTipo={TIPO_DESVIO.homologacaoItem}
            base={`/sqd/homologacoes-itens/${id}`}
            podeEditar={podeEditar}
            onMudou={invalidar}
          />

          <CardAnexos
            titulo="Relatório final da Qualidade"
            descricao="Relatório de homologação do item escrito pela Qualidade e enviado ao fornecedor."
            entidadeTipo={TIPO_RELATORIO}
            entidadeId={id!}
            podeEditar={podeEditar}
          />
          <CardAnexos
            titulo="Plano de ação do fornecedor"
            descricao="Plano de ação devolvido pelo fornecedor e evidências de conclusão. Obrigatório quando o item é reprovado."
            entidadeTipo={TIPO_PLANO}
            entidadeId={id!}
            podeEditar={podeEditar}
          />
        </Col>
      </Row>

      <Modal
        open={registroOpen}
        title="Registro de Homologação de Itens — Doc. BDBR.QUA.FMR.025.01"
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
              <Form.Item name="codigoFornecedor" label="Código do fornecedor">
                <Input />
              </Form.Item>
            </Col>
            <Col span={24}>
              <CamposItem
                form={formRegistro}
                rotuloDescricao="Descrição do item"
              />
            </Col>
            <Col span={8}>
              <Form.Item name="solicitante" label="Solicitante">
                <Select allowClear options={opcoes(labelSolicitanteItem)} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="motivo" label="Motivo da homologação">
                <Select allowClear options={opcoes(labelMotivoItem)} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="custoEvitado"
                label="Custo evitado"
                tooltip="Savings do FMR.025.01: só entra no painel quando a homologação é finalizada."
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={2}
                  formatter={formatarMoedaInput}
                  parser={lerMoedaInput as any}
                />
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
                extra="Lista de validação da coluna “Ação” do FMR.025.01."
              >
                <Select options={opcoes(labelAcaoItem)} />
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
        open={inspecaoOpen}
        title={`Relatório de inspeção ${h.numero} — Rev. ${String(
          tentativaEdicao ?? relatorios.length + 1,
        ).padStart(2, '0')}`}
        width={1180}
        confirmLoading={salvarInspecao.isPending}
        onCancel={() => setInspecaoOpen(false)}
        destroyOnClose
        /* Rodape na mao por causa do "Salvar rascunho". O rascunho nao valida
           nada: e para isso que ele serve. Relatorio ja lancado nao volta a
           rascunho - o resultado do item ja saiu dele. */
        footer={[
          editandoRascunho ? (
            <Button
              key="descartar"
              danger
              loading={descartarRascunho.isPending}
              onClick={() =>
                Modal.confirm({
                  title: `Descartar o rascunho da Rev. ${String(
                    tentativaEdicao,
                  ).padStart(2, '0')}?`,
                  content:
                    'O que foi preenchido será perdido. Como o rascunho nunca foi lançado, o resultado do item não muda.',
                  okText: 'Descartar',
                  okButtonProps: { danger: true },
                  cancelText: 'Cancelar',
                  onOk: async () => {
                    await descartarRascunho.mutateAsync(tentativaEdicao!);
                    setInspecaoOpen(false);
                  },
                })
              }
            >
              Descartar rascunho
            </Button>
          ) : null,
          <Button key="cancelar" onClick={() => setInspecaoOpen(false)}>
            Cancelar
          </Button>,
          !tentativaEdicao || editandoRascunho ? (
            <Button
              key="rascunho"
              loading={salvarInspecao.isPending}
              onClick={() =>
                salvarInspecao.mutate({
                  ...formInspecao.getFieldsValue(true),
                  rascunho: true,
                })
              }
            >
              Salvar rascunho
            </Button>
          ) : null,
          <Button
            key="ok"
            type="primary"
            loading={salvarInspecao.isPending}
            onClick={async () =>
              salvarInspecao.mutate(await formInspecao.validateFields())
            }
          >
            {editandoRascunho
              ? 'Lançar e apurar resultado'
              : tentativaEdicao
                ? 'Salvar e recalcular'
                : 'Lançar e apurar resultado'}
          </Button>,
        ]}
      >
        <Form form={formInspecao} layout="vertical">
          <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
            O item só é aprovado quando as duas abas passam. A revisão do
            relatório é o número da tentativa e acompanha o número do registro —
            ele não tem numeração própria.
          </Typography.Paragraph>
          <CamposCabecalhoInspecao />

          <Divider orientation="left" plain>
            AMOSTRAS — Doc. BDBR.QUA.FMR.011.06 (Rev. 06)
          </Divider>
          <BlocoDesenhos
            cotas={cotas}
            setCotas={setCotas}
            desenhos={desenhos}
            setDesenhos={setDesenhos}
            qtdPecas={qtdPecas}
            norma={norma}
            desenhoCabecalho={desenhoSel}
            revisaoCabecalho={revisaoSel}
          />
          <Divider orientation="left" plain>
            Evidências do dimensional (opcional)
          </Divider>
          <UploadFotosEvidencia
            fotos={fotosDimensional}
            setFotos={setFotosDimensional}
          />
          <Form.Item
            name="observacoesAmostras"
            label="Observações das amostras"
            style={{ marginTop: 12 }}
          >
            <Input.TextArea rows={2} />
          </Form.Item>
          <Tag
            color={cotasComDesvio(cotas) ? 'red' : 'green'}
            style={{ marginBottom: 8 }}
          >
            Resultado das amostras:{' '}
            {cotasComDesvio(cotas) ? 'Reprovado' : 'Aprovado'}
          </Tag>

          <Divider orientation="left" plain>
            VISUAL — Doc. BDBR.QUA.FMR.06.07 (Rev. 07)
          </Divider>
          <ChecklistVisual
            checklist={checklist}
            setChecklist={setChecklist}
            fotosDesvio={fotosDesvio}
            setFotosDesvio={setFotosDesvio}
          />
          <Divider orientation="left" plain>
            Evidências do visual (opcional)
          </Divider>
          <UploadFotosEvidencia fotos={fotosVisual} setFotos={setFotosVisual} />
          <Form.Item
            name="evidenciasVisual"
            label="Descrição das evidências"
            style={{ marginTop: 12 }}
          >
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="observacoesVisual" label="Observações do visual">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Tag color={resultadoVisual(checklist) === 'REPROVADO' ? 'red' : 'green'}>
            Resultado do visual:{' '}
            {resultadoVisual(checklist) === 'REPROVADO'
              ? 'Reprovado'
              : 'Aprovado'}
          </Tag>
        </Form>
      </Modal>
    </Space>
  );
}
