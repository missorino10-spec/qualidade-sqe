import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  FilePdfOutlined,
  PlusOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { abrirPdfEmNovaAba, api } from '../../api';
import { dataBR, dataInput } from '../../formatos';
import DocumentoReferenciado from '../../components/DocumentoReferenciado';
import {
  UploadFotosEvidencia,
  FotosEvidenciaSalvas,
  enviarFotosEvidencia,
} from '../../components/FotosEvidencia';
import {
  COR_STATUS_ACAO_RO,
  DOC_RO,
  FOTO_RO,
  LISTAS_VAZIAS,
  ListasRo,
  rotuloDe,
  TarefaRo,
} from '../../ro';

// R.O — Gestao de Reclamacoes da Qualidade.
// Os quatro blocos da planilha, na mesma ordem. O flag de concluido de cada
// bloco e automatico: quem decide e o servidor, quando todos os campos daquele
// bloco estao preenchidos. A tela so mostra o flag e o que ainda falta.
//
// Os dois anexos (documento da Sala de Controle e fotos) ficam num bloco unico
// no fim, sao opcionais e nao entram na conta de nenhum flag.

const CHAVE = () => Math.random().toString(36).slice(2);

function linhaNova(tipo: TarefaRo['tipo']): TarefaRo {
  return { chave: CHAVE(), tipo, status: 'NAO_INICIADA' };
}

// Cabecalho do bloco: titulo + o flag de concluido, que e o motivo da tela.
function TituloBloco({
  titulo,
  bloco,
  faltando,
}: {
  titulo: string;
  bloco?: any;
  faltando?: string[];
}) {
  return (
    <Space wrap>
      <span>{titulo}</span>
      {bloco ? (
        <Tag color="green">
          Concluído em{' '}
          {new Date(bloco.concluidoEm).toLocaleString('pt-BR', {
            dateStyle: 'short',
            timeStyle: 'short',
          })}
        </Tag>
      ) : (
        <Tag>
          Em aberto
          {faltando?.length ? ` — faltam ${faltando.length} campo(s)` : ''}
        </Tag>
      )}
    </Space>
  );
}

export default function ReclamacaoDetalhe() {
  const { id } = useParams();
  const novo = id === 'novo';
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form] = Form.useForm();
  const [salvando, setSalvando] = useState(false);
  const [tarefas, setTarefas] = useState<TarefaRo[]>([]);
  // Fotos escolhidas antes de gravar: o anexo precisa do id do R.O, que so
  // existe depois do POST.
  const [fotos, setFotos] = useState<any[]>([]);

  const { data: listas } = useQuery<ListasRo>({
    queryKey: ['ro-listas'],
    queryFn: async () => (await api.get('/ro/reclamacoes/listas')).data,
  });
  const L = listas ?? LISTAS_VAZIAS;

  const { data: responsaveis } = useQuery<{ id: number; nome: string }[]>({
    queryKey: ['ro-responsaveis'],
    queryFn: async () => (await api.get('/ro/reclamacoes/responsaveis')).data,
  });

  const { data: reg, isLoading } = useQuery<any>({
    queryKey: ['ro', 'detalhe', id],
    enabled: !novo,
    queryFn: async () => (await api.get(`/ro/reclamacoes/${id}`)).data,
  });

  useEffect(() => {
    if (novo) {
      form.setFieldsValue({ status: 'RECEBIDA_SAC' });
      return;
    }
    if (!reg) return;
    form.setFieldsValue({
      cliente: reg.cliente ?? '',
      produtoCodigo: reg.produtoCodigo ?? '',
      produtoDescricao: reg.produtoDescricao ?? '',
      quantidadeAfetada: reg.quantidadeAfetada ?? undefined,
      valorUnitario: reg.valorUnitario ?? undefined,
      tipoInformado: reg.tipoInformado ?? '',
      resultadoAnaliseSac: reg.resultadoAnaliseSac ?? '',
      origemIndicada: reg.origemIndicada ?? '',

      dadosCompletos: reg.dadosCompletos ?? undefined,
      aceita: reg.aceita ?? undefined,
      classificacao: reg.classificacao ?? undefined,
      procedencia: reg.procedencia ?? undefined,
      prioridade: reg.prioridade ?? undefined,
      areaResponsavel: reg.areaResponsavel ?? undefined,
      responsavelId: reg.responsavelId ?? undefined,
      pendenciasSac: reg.pendenciasSac ?? '',

      necessidadeContencao: reg.necessidadeContencao ?? undefined,
      metodoAnalise: reg.metodoAnalise ?? undefined,
      causaImediata: reg.causaImediata ?? '',
      causaSistemica: reg.causaSistemica ?? '',
      verificacaoEficacia: reg.verificacaoEficacia ?? undefined,
      evidencias: reg.evidencias ?? '',

      resumoConclusao: reg.resumoConclusao ?? '',
      dataRetornoSac: dataInput(reg.dataRetornoSac),
      motivoEncerramento: reg.motivoEncerramento ?? undefined,
      status: reg.status ?? 'RECEBIDA_SAC',
    });
    setTarefas(
      (reg.tarefas ?? []).map((t: any) => ({
        chave: CHAVE(),
        tipo: t.tipo,
        descricao: t.descricao ?? '',
        responsavel: t.responsavel ?? '',
        prazo: dataInput(t.prazo) ?? '',
        status: t.status ?? 'NAO_INICIADA',
      })),
    );
  }, [novo, reg, form]);

  // Custo Total R.O (Peças) = quantidade afetada x valor unitario. O servidor
  // grava o mesmo numero; aqui e so para o usuario ver enquanto digita.
  const quantidade = Form.useWatch('quantidadeAfetada', form);
  const valorUnitario = Form.useWatch('valorUnitario', form);
  const necessidadeContencao = Form.useWatch('necessidadeContencao', form);
  const custoTotal = useMemo(() => {
    if (quantidade == null || valorUnitario == null) return null;
    return Number(quantidade) * Number(valorUnitario);
  }, [quantidade, valorUnitario]);

  const faltando: Record<number, string[]> = reg?.camposFaltando ?? {};
  const blocoFeito = (n: number) =>
    (reg?.blocos ?? []).find((b: any) => b.numero === n);

  function alterarTarefa(chave: string, campo: keyof TarefaRo, valor: any) {
    setTarefas((atual) =>
      atual.map((t) => (t.chave === chave ? { ...t, [campo]: valor } : t)),
    );
  }

  function tabelaTarefas(tipo: TarefaRo['tipo'], vazio: string) {
    const linhas = tarefas.filter((t) => t.tipo === tipo);
    return (
      <>
        <Table
          size="small"
          rowKey="chave"
          pagination={false}
          dataSource={linhas}
          locale={{ emptyText: vazio }}
          columns={[
            {
              title: 'Tarefa',
              render: (_: any, t: TarefaRo) => (
                <Input.TextArea
                  autoSize={{ minRows: 1, maxRows: 4 }}
                  value={t.descricao ?? ''}
                  onChange={(e) =>
                    alterarTarefa(t.chave, 'descricao', e.target.value)
                  }
                />
              ),
            },
            {
              title: 'Responsável',
              width: 180,
              render: (_: any, t: TarefaRo) => (
                <Input
                  maxLength={120}
                  value={t.responsavel ?? ''}
                  onChange={(e) =>
                    alterarTarefa(t.chave, 'responsavel', e.target.value)
                  }
                />
              ),
            },
            {
              title: 'Prazo',
              width: 150,
              render: (_: any, t: TarefaRo) => (
                <Input
                  type="date"
                  value={t.prazo ?? ''}
                  onChange={(e) =>
                    alterarTarefa(t.chave, 'prazo', e.target.value)
                  }
                />
              ),
            },
            {
              title: 'Status',
              width: 160,
              render: (_: any, t: TarefaRo) => (
                <Select
                  style={{ width: '100%' }}
                  value={t.status}
                  onChange={(v) => alterarTarefa(t.chave, 'status', v)}
                  options={L.statusAcao}
                />
              ),
            },
            {
              title: '',
              width: 44,
              render: (_: any, t: TarefaRo) => (
                <Button
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() =>
                    setTarefas((atual) =>
                      atual.filter((x) => x.chave !== t.chave),
                    )
                  }
                />
              ),
            },
          ]}
        />
        <Button
          size="small"
          icon={<PlusOutlined />}
          style={{ marginTop: 8 }}
          onClick={() => setTarefas((atual) => [...atual, linhaNova(tipo)])}
        >
          Adicionar linha
        </Button>
      </>
    );
  }

  async function salvar() {
    const v = await form.getFieldsValue();
    const corpo = {
      ...v,
      // Campo em branco nao vai: o DTO recusa string vazia num campo de lista.
      tarefas: tarefas
        .filter((t) => String(t.descricao ?? '').trim() !== '')
        .map((t) => ({
          tipo: t.tipo,
          descricao: t.descricao,
          responsavel: t.responsavel || undefined,
          prazo: t.prazo || undefined,
          status: t.status || 'NAO_INICIADA',
        })),
    };
    for (const k of Object.keys(corpo)) {
      if (corpo[k] === '' || corpo[k] === null) delete corpo[k];
    }

    setSalvando(true);
    try {
      const res = novo
        ? await api.post('/ro/reclamacoes', corpo)
        : await api.patch(`/ro/reclamacoes/${id}`, corpo);
      // Uma foto que falha nao desfaz o R.O: ela pode ser anexada de novo pela
      // propria tela, ja com o registro gravado.
      if (fotos.length) {
        await enviarFotosEvidencia(fotos, FOTO_RO, res.data.id);
        setFotos([]);
      }
      message.success(`R.O ${res.data.numero} salvo.`);
      qc.invalidateQueries({ queryKey: ['ro'] });
      if (novo) navigate(`/ro/${res.data.id}`);
    } catch (e: any) {
      message.error(
        e?.response?.data?.message ?? 'Não foi possível salvar o R.O.',
      );
    } finally {
      setSalvando(false);
    }
  }

  if (!novo && isLoading) return <Spin />;

  const botaoSalvar = (grande?: boolean) => (
    <Button
      type="primary"
      size={grande ? 'large' : 'middle'}
      icon={<SaveOutlined />}
      loading={salvando}
      onClick={salvar}
    >
      {novo ? 'Abrir R.O' : 'Salvar'}
    </Button>
  );

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Row justify="space-between" align="middle" gutter={[12, 12]}>
        <Col>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/ro')}>
              Voltar
            </Button>
            <Typography.Title level={4} style={{ margin: 0 }}>
              {novo ? 'Novo R.O' : `R.O ${reg?.numero ?? ''}`}
            </Typography.Title>
          </Space>
        </Col>
        <Col>
          <Space>
            {!novo && (
              <Button
                icon={<FilePdfOutlined />}
                onClick={() => abrirPdfEmNovaAba(`/ro/reclamacoes/${id}/pdf`)}
              >
                PDF
              </Button>
            )}
            {botaoSalvar()}
          </Space>
        </Col>
      </Row>

      <Alert
        type="info"
        showIcon
        message="Este formulário não substitui o formulário do SAC."
        description="É o controle interno da Qualidade, iniciado a partir do R.O recebido da Sala de Controle. O flag de concluído de cada bloco é marcado automaticamente quando todos os campos daquele bloco estão preenchidos."
      />

      <Form form={form} layout="vertical">
        {/* ------------------------------------------ 1. Dados recebidos */}
        <Card
          title={
            <TituloBloco
              titulo="1. Dados recebidos"
              bloco={blocoFeito(1)}
              faltando={faltando[1]}
            />
          }
          style={{ marginBottom: 16 }}
        >
          <Row gutter={12}>
            <Col xs={24} sm={8} lg={6}>
              <Form.Item label="Nº Formulário R.O.">
                <Input value={reg?.numero ?? 'Gerado ao salvar'} disabled />
              </Form.Item>
            </Col>
            <Col xs={24} sm={16} lg={12}>
              <Form.Item name="cliente" label="Cliente / representante">
                <Input maxLength={180} />
              </Form.Item>
            </Col>
            <Col xs={24} lg={6}>
              <Form.Item label="Data/hora recebimento Qualidade">
                <Input
                  disabled
                  value={
                    reg?.recebidoEm
                      ? new Date(reg.recebidoEm).toLocaleString('pt-BR', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })
                      : 'Automático ao salvar'
                  }
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col xs={24} sm={8} lg={6}>
              <Form.Item name="produtoCodigo" label="Código do produto">
                <Input maxLength={60} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={16} lg={10}>
              <Form.Item name="produtoDescricao" label="Descrição do item">
                <Input maxLength={200} />
              </Form.Item>
            </Col>
            <Col xs={12} sm={12} lg={4}>
              <Form.Item name="quantidadeAfetada" label="Quantidade afetada">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={12} sm={12} lg={4}>
              <Form.Item name="valorUnitario" label="Valor unitário (R$)">
                <InputNumber min={0} precision={2} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col xs={24} lg={8}>
              <Form.Item
                name="tipoInformado"
                label="Tipo informado pela Sala de Controle"
              >
                <Input maxLength={180} />
              </Form.Item>
            </Col>
            <Col xs={24} lg={8}>
              <Form.Item
                name="resultadoAnaliseSac"
                label="Resultado da análise da Sala de Controle"
              >
                <Input maxLength={180} />
              </Form.Item>
            </Col>
            <Col xs={24} lg={8}>
              <Form.Item
                name="origemIndicada"
                label="Origem indicada pela Sala de Controle"
              >
                <Input maxLength={180} />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* ---------------------------------------------- 2. Triagem */}
        <Card
          title={
            <TituloBloco
              titulo="2. Triagem e direcionamento da Qualidade"
              bloco={blocoFeito(2)}
              faltando={faltando[2]}
            />
          }
          style={{ marginBottom: 16 }}
        >
          <Row gutter={12}>
            <Col xs={24} sm={12} lg={8}>
              <Form.Item
                name="dadosCompletos"
                label="Dados da Sala de Controle completos?"
              >
                <Select allowClear options={L.dadosCompletos} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} lg={8}>
              <Form.Item name="aceita" label="Reclamação aceita para tratativa?">
                <Select allowClear options={L.aceita} />
              </Form.Item>
            </Col>
            <Col xs={24} lg={8}>
              <Form.Item name="classificacao" label="Classificação Qualidade">
                <Select allowClear options={L.classificacao} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col xs={24} sm={12} lg={8}>
              <Form.Item name="procedencia" label="Procedência para tratamento">
                <Select allowClear options={L.procedencia} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} lg={8}>
              <Form.Item name="prioridade" label="Prioridade">
                <Select allowClear options={L.prioridade} />
              </Form.Item>
            </Col>
            <Col xs={24} lg={8}>
              <Form.Item
                name="areaResponsavel"
                label="Área responsável Qualidade"
              >
                <Select allowClear options={L.areaResponsavel} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col xs={24} sm={12} lg={8}>
              <Form.Item name="responsavelId" label="Responsável interno">
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="Escolha o responsável"
                  options={(responsaveis ?? []).map((u) => ({
                    value: u.id,
                    label: u.nome,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} lg={8}>
              <Form.Item label="Prazo de conclusão (5 dias úteis)">
                <Input
                  disabled
                  value={
                    reg?.prazoConclusao
                      ? dataBR(reg.prazoConclusao)
                      : 'Calculado pelo sistema'
                  }
                />
              </Form.Item>
            </Col>
            <Col xs={24} lg={8}>
              <Form.Item label="Custo Total R.O (Peças)">
                <Input
                  disabled
                  value={
                    custoTotal == null
                      ? 'Quantidade × valor unitário'
                      : custoTotal.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })
                  }
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="pendenciasSac"
            label="Pendências para a Sala de Controle (se aplicável)"
          >
            <Input.TextArea rows={2} />
          </Form.Item>
        </Card>

        {/* ------------------------------------- 3. Tratativa interna */}
        <Card
          title={
            <TituloBloco
              titulo="3. Tratativa interna"
              bloco={blocoFeito(3)}
              faltando={faltando[3]}
            />
          }
          style={{ marginBottom: 16 }}
        >
          <Row gutter={12}>
            <Col xs={24} sm={12} lg={8}>
              <Form.Item
                name="necessidadeContencao"
                label="Necessidade de contenção"
              >
                <Select allowClear options={L.necessidadeContencao} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} lg={8}>
              <Form.Item name="metodoAnalise" label="Método de análise de causa">
                <Select allowClear options={L.metodoAnalise} />
              </Form.Item>
            </Col>
            <Col xs={24} lg={8}>
              <Form.Item
                name="verificacaoEficacia"
                label="Verificação de eficácia"
              >
                <Select allowClear options={L.verificacaoEficacia} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col xs={24} lg={12}>
              <Form.Item name="causaImediata" label="Causa imediata">
                <Input.TextArea rows={3} />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item name="causaSistemica" label="Causa sistêmica">
                <Input.TextArea rows={3} />
              </Form.Item>
            </Col>
          </Row>

          <Typography.Text strong>Plano de contenção</Typography.Text>
          <div style={{ marginTop: 8, marginBottom: 20 }}>
            {tabelaTarefas(
              'CONTENCAO',
              necessidadeContencao === 'SIM'
                ? 'Contenção necessária: adicione ao menos uma tarefa.'
                : 'Sem tarefas de contenção.',
            )}
          </div>

          <Space wrap style={{ marginBottom: 8 }}>
            <Typography.Text strong>Ações corretivas</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Status das ações (calculado pelas linhas):
            </Typography.Text>
            {reg?.statusAcoes ? (
              <Tag color={COR_STATUS_ACAO_RO[reg.statusAcoes]}>
                {rotuloDe(L.statusAcao, reg.statusAcoes)}
              </Tag>
            ) : (
              <Tag>sem ações</Tag>
            )}
          </Space>
          <div style={{ marginBottom: 20 }}>
            {tabelaTarefas('ACAO_CORRETIVA', 'Nenhuma ação corretiva lançada.')}
          </div>

          <Form.Item name="evidencias" label="Evidências (texto)">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Card>

        {/* --------------------------- 4. Retorno ao SAC e encerramento */}
        <Card
          title={
            <TituloBloco
              titulo="4. Retorno ao SAC e encerramento"
              bloco={blocoFeito(4)}
              faltando={faltando[4]}
            />
          }
          style={{ marginBottom: 16 }}
        >
          <Form.Item
            name="resumoConclusao"
            label="Resumo da conclusão para a Sala de Controle"
          >
            <Input.TextArea rows={4} />
          </Form.Item>
          <Row gutter={12}>
            <Col xs={24} sm={12} lg={8}>
              <Form.Item
                name="dataRetornoSac"
                label="Data do retorno para a Sala de Controle"
              >
                <Input type="date" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} lg={8}>
              <Form.Item name="motivoEncerramento" label="Motivo de encerramento">
                <Select allowClear options={L.motivoEncerramento} />
              </Form.Item>
            </Col>
            <Col xs={24} lg={8}>
              <Form.Item name="status" label="Status da reclamação">
                <Select options={L.status} />
              </Form.Item>
            </Col>
          </Row>
        </Card>
      </Form>

      {/* Um bloco unico de anexos, com os dois campos dentro. Nenhum dos dois
          trava o encerramento: este bloco nao tem flag de concluido. */}
      <Card title="Anexos (opcionais)">
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Typography.Text strong>
              Documento / formulário recebido da Sala de Controle
            </Typography.Text>
            <div style={{ marginTop: 8 }}>
              {novo ? (
                <Typography.Text type="secondary" italic>
                  Disponível depois de abrir o R.O.
                </Typography.Text>
              ) : (
                <DocumentoReferenciado entidadeTipo={DOC_RO} entidadeId={id} />
              )}
            </div>
          </Col>
          <Col xs={24} lg={12}>
            <Typography.Text strong>Fotos / evidências</Typography.Text>
            <div style={{ marginTop: 8 }}>
              {!novo && (
                <div style={{ marginBottom: 12 }}>
                  <FotosEvidenciaSalvas
                    entidadeTipo={FOTO_RO}
                    entidadeId={Number(id)}
                  />
                </div>
              )}
              <UploadFotosEvidencia fotos={fotos} setFotos={setFotos} />
            </div>
          </Col>
        </Row>
      </Card>

      {/* O mesmo botao do topo, repetido aqui: o formulario e longo e a pessoa
          fecha sem ter que rolar a tela de volta. */}
      <Row justify="end">{botaoSalvar(true)}</Row>
    </Space>
  );
}
