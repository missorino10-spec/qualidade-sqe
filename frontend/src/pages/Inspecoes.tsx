import { useMemo, useState } from 'react';
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
  Radio,
  Row,
  Select,
  Space,
  Steps,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  FileTextOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { useFornecedores, opcoesFornecedor } from '../hooks';
import { semanaAno } from '../semana';

type StatusItem = 'APROVADO' | 'REPROVADO' | 'NAO_APLICAVEL';

const corResultado: Record<string, string> = {
  APROVADO: 'green',
  REPROVADO: 'red',
  SEM_INSPECAO: 'default',
};

const labelResultado: Record<string, string> = {
  APROVADO: 'Aprovado',
  REPROVADO: 'Reprovado',
  SEM_INSPECAO: 'Sem Inspeção Recomendada',
};

const labelTipo: Record<string, string> = {
  VISUAL: 'Visual',
  LOTE: 'Lote / Dimensional',
  RECEBIMENTO: 'Recebimento',
};

function ChecklistVisual({
  grupos,
  setGrupos,
}: {
  grupos: any[];
  setGrupos: (g: any[]) => void;
}) {
  function marcar(gi: number, ii: number, status: StatusItem) {
    const copia = grupos.map((g) => ({ ...g, itens: g.itens.map((x: any) => ({ ...x })) }));
    copia[gi].itens[ii].status = status;
    setGrupos(copia);
  }
  function marcarGrupo(gi: number, status: StatusItem) {
    const copia = grupos.map((g) => ({ ...g, itens: g.itens.map((x: any) => ({ ...x })) }));
    copia[gi].itens.forEach((x: any) => (x.status = status));
    setGrupos(copia);
  }

  return (
    <div style={{ maxHeight: '55vh', overflowY: 'auto', paddingRight: 8 }}>
      {grupos.map((g, gi) => (
        <Card
          key={g.grupo}
          size="small"
          title={g.grupo}
          style={{ marginBottom: 12 }}
          extra={
            <Space size={4}>
              <Button size="small" onClick={() => marcarGrupo(gi, 'APROVADO')}>
                Todos Aprovados
              </Button>
              <Button
                size="small"
                onClick={() => marcarGrupo(gi, 'NAO_APLICAVEL')}
              >
                N/A
              </Button>
            </Space>
          }
        >
          {g.itens.map((item: any, ii: number) => (
            <Row
              key={ii}
              align="middle"
              justify="space-between"
              style={{ padding: '4px 0' }}
            >
              <Col flex="auto">
                <Typography.Text>{item.texto}</Typography.Text>
              </Col>
              <Col>
                <Radio.Group
                  size="small"
                  value={item.status}
                  onChange={(e) => marcar(gi, ii, e.target.value)}
                  optionType="button"
                  buttonStyle="solid"
                >
                  <Radio.Button value="APROVADO">Aprovado</Radio.Button>
                  <Radio.Button value="REPROVADO">Reprovado</Radio.Button>
                  <Radio.Button value="NAO_APLICAVEL">N/A</Radio.Button>
                </Radio.Group>
              </Col>
            </Row>
          ))}
        </Card>
      ))}
    </div>
  );
}

function TabelaCotas({
  cotas,
  setCotas,
}: {
  cotas: any[];
  setCotas: (c: any[]) => void;
}) {
  function add() {
    setCotas([
      ...cotas,
      {
        localizacao: '',
        especificado: '',
        tolUpper: '',
        tolLower: '',
        medido: '',
        instrumento: '',
        conforme: true,
      },
    ]);
  }
  function edit(idx: number, campo: string, valor: any) {
    const copia = cotas.map((c) => ({ ...c }));
    copia[idx][campo] = valor;
    setCotas(copia);
  }
  function remove(idx: number) {
    setCotas(cotas.filter((_, i) => i !== idx));
  }

  return (
    <div>
      <Table
        size="small"
        rowKey={(_, i) => String(i)}
        dataSource={cotas}
        pagination={false}
        locale={{ emptyText: 'Nenhuma cota adicionada' }}
        columns={[
          {
            title: 'Localização / Cota',
            render: (_: any, r: any, i: number) => (
              <Input
                value={r.localizacao}
                onChange={(e) => edit(i, 'localizacao', e.target.value)}
              />
            ),
          },
          {
            title: 'Especificado',
            width: 110,
            render: (_: any, r: any, i: number) => (
              <Input
                value={r.especificado}
                onChange={(e) => edit(i, 'especificado', e.target.value)}
              />
            ),
          },
          {
            title: 'Tol. +',
            width: 80,
            render: (_: any, r: any, i: number) => (
              <Input
                value={r.tolUpper}
                onChange={(e) => edit(i, 'tolUpper', e.target.value)}
              />
            ),
          },
          {
            title: 'Tol. -',
            width: 80,
            render: (_: any, r: any, i: number) => (
              <Input
                value={r.tolLower}
                onChange={(e) => edit(i, 'tolLower', e.target.value)}
              />
            ),
          },
          {
            title: 'Medido',
            width: 100,
            render: (_: any, r: any, i: number) => (
              <Input
                value={r.medido}
                onChange={(e) => edit(i, 'medido', e.target.value)}
              />
            ),
          },
          {
            title: 'Instrumento',
            width: 130,
            render: (_: any, r: any, i: number) => (
              <Input
                value={r.instrumento}
                onChange={(e) => edit(i, 'instrumento', e.target.value)}
              />
            ),
          },
          {
            title: 'Conforme?',
            width: 120,
            render: (_: any, r: any, i: number) => (
              <Radio.Group
                size="small"
                value={r.conforme}
                onChange={(e) => edit(i, 'conforme', e.target.value)}
                optionType="button"
                buttonStyle="solid"
              >
                <Radio.Button value={true}>Sim</Radio.Button>
                <Radio.Button value={false}>Não</Radio.Button>
              </Radio.Group>
            ),
          },
          {
            title: '',
            width: 40,
            render: (_: any, __: any, i: number) => (
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => remove(i)}
              />
            ),
          },
        ]}
      />
      <Button
        type="dashed"
        block
        icon={<PlusOutlined />}
        onClick={add}
        style={{ marginTop: 8 }}
      >
        Adicionar cota
      </Button>
    </div>
  );
}

export default function Inspecoes() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const isAdmin = usuario?.papel === 'ADMIN';
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const [grupos, setGrupos] = useState<any[]>([]);
  const [cotas, setCotas] = useState<any[]>([]);
  const [fotosReprova, setFotosReprova] = useState<any[]>([]);
  const [passoIdx, setPassoIdx] = useState(0);
  const [rncsGeradas, setRncsGeradas] = useState<any[]>([]);
  // Entrega (carga) criada no passo Visual, reaproveitada no Lote encadeado:
  // uma unica carga por recebimento, mesmo fazendo Visual + Lote.
  const [entregaEncadeada, setEntregaEncadeada] = useState<number | undefined>();
  const [salvando, setSalvando] = useState(false);
  const fornecedorId = Form.useWatch('fornecedorId', form);

  const hoje = dayjs();
  const { semana: semanaHoje, ano: anoHoje } = semanaAno(hoje.toDate());

  const { data: fornecedores } = useFornecedores();

  const { data: template } = useQuery<any[]>({
    queryKey: ['template-visual'],
    queryFn: async () => (await api.get('/inspecoes/template-visual')).data,
  });

  const { data, isLoading } = useQuery<any[]>({
    queryKey: ['inspecoes'],
    queryFn: async () => (await api.get('/inspecoes')).data,
  });

  // Avalia recebimento (classificacao + periodicidade + contador ciclico)
  const { data: avaliacao } = useQuery<any>({
    queryKey: ['avaliar', fornecedorId],
    queryFn: async () =>
      (await api.get(`/inspecoes/avaliar?fornecedorId=${fornecedorId}`)).data,
    enabled: !!fornecedorId,
  });

  const precisaInspecionar = avaliacao?.precisaInspecionar ?? true;

  const fornecedorSel = useMemo(
    () => (fornecedores ?? []).find((f: any) => f.id === fornecedorId),
    [fornecedores, fornecedorId],
  );

  // Sequencia de etapas conforme escopo do fornecedor (ordem fixa Visual -> Lote)
  const passos = useMemo<('VISUAL' | 'LOTE')[]>(() => {
    if (!precisaInspecionar) return [];
    const fazVisual = !fornecedorSel || fornecedorSel.fazVisual;
    const fazLote = fornecedorSel?.fazLote;
    const seq: ('VISUAL' | 'LOTE')[] = [];
    if (fazVisual) seq.push('VISUAL');
    if (fazLote) seq.push('LOTE');
    return seq.length ? seq : ['VISUAL'];
  }, [precisaInspecionar, fornecedorSel]);

  const tipo = passos[passoIdx] ?? 'VISUAL';
  const encadeado = passos.length > 1;

  function limparEtapa() {
    setGrupos(
      template
        ? template.map((g) => ({
            ...g,
            itens: g.itens.map((x: any) => ({ ...x })),
          }))
        : [],
    );
    setCotas([]);
    setFotosReprova([]);
    form.setFieldsValue({
      itemDescricao: undefined,
      itemCodigo: undefined,
      notaFiscal: undefined,
      po: undefined,
      qtdInspecionada: undefined,
      qtdTotal: undefined,
      desenhoRev: undefined,
      toleranciasNorm: undefined,
      relatorioNumero: undefined,
      observacoes: undefined,
      disposicao: undefined,
    });
  }

  function novaInspecao() {
    form.resetFields();
    setPassoIdx(0);
    setRncsGeradas([]);
    setEntregaEncadeada(undefined);
    limparEtapa();
    form.setFieldsValue({ origem: 'PLANO_INSPECAO' });
    setOpen(true);
  }

  // Resultado automatico a partir do preenchimento
  const resultadoAuto = useMemo(() => {
    if (tipo === 'VISUAL') {
      const reprovou = grupos.some((g) =>
        g.itens.some((i: any) => i.status === 'REPROVADO'),
      );
      return reprovou ? 'REPROVADO' : 'APROVADO';
    }
    const reprovou = cotas.some((c) => c.conforme === false);
    return reprovou ? 'REPROVADO' : 'APROVADO';
  }, [tipo, grupos, cotas]);

  async function enviarFotos(rncId: number) {
    for (const f of fotosReprova) {
      const arquivo = f.originFileObj ?? f;
      const fd = new FormData();
      fd.append('file', arquivo as Blob);
      try {
        await api.post('/anexos', fd, {
          params: { entidadeTipo: 'RNC', entidadeId: rncId },
        });
      } catch {
        message.warning('Uma foto não pôde ser enviada.');
      }
    }
  }

  function invalidar() {
    qc.invalidateQueries({ queryKey: ['inspecoes'] });
    qc.invalidateQueries({ queryKey: ['entregas'] });
    qc.invalidateQueries({ queryKey: ['avaliar'] });
    qc.invalidateQueries({ queryKey: ['fornecedores'] });
  }

  function finalizarFluxo(rncs: any[]) {
    setOpen(false);
    invalidar();
    if (rncs.length) {
      Modal.confirm({
        title:
          rncs.length > 1
            ? 'Inspeções reprovadas — RNCs geradas'
            : 'Inspeção reprovada — RNC gerada',
        content: (
          <div>
            {rncs.map((r) => (
              <div key={r.id}>RNC {r.numero}</div>
            ))}
            <p style={{ marginTop: 8 }}>Deseja abrir a primeira agora?</p>
          </div>
        ),
        okText: 'Abrir RNC',
        cancelText: 'Depois',
        onOk: () => navigate(`/rnc/${rncs[0].id}`),
      });
    } else {
      message.success('Inspeção registrada. Recebimento aprovado.');
    }
  }

  async function onFinish(v: any) {
    setSalvando(true);
    try {
      // Fora do ciclo de periodicidade: registra apenas o recebimento
      if (!precisaInspecionar) {
        await api.post('/inspecoes/recebimento', {
          fornecedorId: v.fornecedorId,
          notaFiscal: v.notaFiscal,
          po: v.po,
          dataEntrega: hoje.toISOString(),
        });
        setOpen(false);
        invalidar();
        message.success(
          'Recebimento registrado sem inspeção (fora do ciclo de periodicidade).',
        );
        return;
      }

      const reprovado = resultadoAuto === 'REPROVADO';
      const rota = tipo === 'VISUAL' ? '/inspecoes/visual' : '/inspecoes/lote';
      const payload: any = {
        fornecedorId: v.fornecedorId,
        itemDescricao: v.itemDescricao,
        itemCodigo: v.itemCodigo,
        notaFiscal: v.notaFiscal,
        po: v.po,
        qtdInspecionada: v.qtdInspecionada,
        qtdTotal: v.qtdTotal,
        desenhoRev: v.desenhoRev,
        toleranciasNorm: v.toleranciasNorm,
        relatorioNumero: v.relatorioNumero,
        observacoes: v.observacoes,
        disposicao: reprovado ? v.disposicao : undefined,
        dataInspecao: hoje.toISOString(),
        resultado: resultadoAuto,
      };
      if (tipo === 'VISUAL') payload.checklist = grupos;
      else {
        payload.cotas = cotas;
        payload.encadeadoAposVisual = passoIdx > 0;
        // Reaproveita a carga criada no Visual: 1 recebimento apenas.
        if (passoIdx > 0 && entregaEncadeada) payload.entregaId = entregaEncadeada;
      }

      const res = (await api.post(rota, payload)).data;

      let rncs = rncsGeradas;
      if (res.rnc) {
        await enviarFotos(res.rnc.id);
        rncs = [...rncs, res.rnc];
        setRncsGeradas(rncs);
      }

      // Ha proxima etapa (encadeamento Visual -> Lote)?
      if (passoIdx < passos.length - 1) {
        const proximo = passos[passoIdx + 1];
        // Guarda a entrega do Visual para o Lote usar a MESMA carga.
        if (res.inspecao?.entregaId) setEntregaEncadeada(res.inspecao.entregaId);
        setPassoIdx(passoIdx + 1);
        limparEtapa();
        message.success(
          `${tipo === 'VISUAL' ? 'Visual' : 'Lote'} registrado. Prossiga com a inspeção de ${
            proximo === 'LOTE' ? 'Lote' : 'Visual'
          }.`,
        );
        return;
      }

      finalizarFluxo(rncs);
    } catch {
      message.error('Não foi possível registrar o recebimento.');
    } finally {
      setSalvando(false);
    }
  }

  async function excluirInspecao(r: any, cascade = false) {
    const rota = r.tipoFormulario === 'VISUAL' ? 'visual' : 'lote';
    try {
      await api.delete(`/inspecoes/${rota}/${r.id}`, {
        params: cascade ? { cascade: 'true' } : {},
      });
      message.success('Inspeção excluída.');
      invalidar();
    } catch (e: any) {
      const body = e?.response?.data;
      if (e?.response?.status === 409 && body?.rncs?.length) {
        Modal.confirm({
          title: 'Existe RNC vinculada a esta inspeção',
          content: (
            <div>
              <p>
                Esta inspeção gerou a(s) RNC(s) abaixo. Para excluir a inspeção é
                preciso excluir também a(s) RNC(s) vinculada(s):
              </p>
              {body.rncs.map((x: any) => (
                <div key={x.id}>
                  <a onClick={() => navigate(`/rnc/${x.id}`)}>RNC {x.numero}</a>
                </div>
              ))}
            </div>
          ),
          okText: 'Excluir inspeção + RNC(s)',
          okButtonProps: { danger: true },
          cancelText: 'Cancelar',
          onOk: () => excluirInspecao(r, true),
        });
      } else {
        message.error('Não foi possível excluir a inspeção.');
      }
    }
  }

  function confirmarExclusao(r: any) {
    Modal.confirm({
      title: `Excluir esta inspeção ${labelTipo[r.tipoFormulario]}?`,
      icon: <DeleteOutlined style={{ color: '#cf1322' }} />,
      content: 'A remoção é permanente e não pode ser desfeita.',
      okText: 'Excluir',
      okButtonProps: { danger: true },
      cancelText: 'Cancelar',
      onOk: () => excluirInspecao(r, false),
    });
  }

  const filtrosDe = (
    valores: (string | undefined)[],
  ): { text: string; value: string }[] =>
    Array.from(new Set(valores.filter(Boolean) as string[]))
      .sort()
      .map((v) => ({ text: v, value: v }));

  const filtrosFornecedor = filtrosDe(
    (data ?? []).map((r) => r.fornecedor?.nome),
  );
  const filtrosItem = filtrosDe((data ?? []).map((r) => r.item?.descricao));

  return (
    <Card
      title="Inspeções de Recebimento"
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => novaInspecao()}
        >
          Nova Inspeção
        </Button>
      }
    >
      <Table
        rowKey={(r) => `${r.tipoFormulario}-${r.id}`}
        loading={isLoading}
        dataSource={data}
        columns={[
          {
            title: 'Data',
            dataIndex: 'dataInspecao',
            width: 110,
            defaultSortOrder: 'descend',
            sorter: (a: any, b: any) =>
              dayjs(a.dataInspecao).valueOf() - dayjs(b.dataInspecao).valueOf(),
            render: (d?: string) => (d ? dayjs(d).format('DD/MM/YYYY') : '-'),
          },
          {
            title: 'Semana',
            dataIndex: 'semana',
            width: 90,
            render: (v?: string) => v ?? '-',
          },
          { title: 'Ano', dataIndex: 'ano', width: 80, render: (v?: number) => v ?? '-' },
          {
            title: 'Formulário',
            dataIndex: 'tipoFormulario',
            width: 150,
            filters: Object.entries(labelTipo).map(([value, text]) => ({
              text,
              value,
            })),
            onFilter: (v: any, r: any) => r.tipoFormulario === v,
            render: (t: string) => <Tag>{labelTipo[t] ?? t}</Tag>,
          },
          {
            title: 'Fornecedor',
            filters: filtrosFornecedor,
            onFilter: (v: any, r: any) => r.fornecedor?.nome === v,
            render: (_: any, r: any) => r.fornecedor?.nome,
          },
          {
            title: 'Item',
            filters: filtrosItem,
            onFilter: (v: any, r: any) => r.item?.descricao === v,
            render: (_: any, r: any) => r.item?.descricao ?? '-',
          },
          {
            title: 'Resultado',
            dataIndex: 'resultado',
            width: 200,
            filters: Object.entries(labelResultado).map(([value, text]) => ({
              text,
              value,
            })),
            onFilter: (v: any, r: any) => r.resultado === v,
            render: (r: string) => (
              <Tag color={corResultado[r]}>{labelResultado[r] ?? r}</Tag>
            ),
          },
          {
            title: 'RNC',
            width: 130,
            render: (_: any, r: any) =>
              r.rncs?.length ? (
                <Button
                  size="small"
                  type="link"
                  icon={<FileTextOutlined />}
                  onClick={() => navigate(`/rnc/${r.rncs[0].id}`)}
                >
                  {r.rncs[0].numero}
                </Button>
              ) : (
                '-'
              ),
          },
          ...(isAdmin
            ? [
                {
                  title: '',
                  width: 50,
                  render: (_: any, r: any) =>
                    r.tipoFormulario === 'RECEBIMENTO' ? null : (
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => confirmarExclusao(r)}
                      />
                    ),
                },
              ]
            : []),
        ]}
      />

      <Modal
        title="Nova Inspeção de Recebimento"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={salvando}
        okText={
          fornecedorId && !precisaInspecionar
            ? 'Registrar recebimento sem inspeção'
            : passoIdx < passos.length - 1
              ? `Registrar ${tipo === 'VISUAL' ? 'Visual' : 'Lote'} e continuar`
              : 'Registrar Inspeção'
        }
        cancelText="Cancelar"
        width={900}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          style={{ marginTop: 8 }}
        >
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="fornecedorId"
                label="Fornecedor"
                rules={[{ required: true, message: 'Selecione o fornecedor.' }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  disabled={passoIdx > 0}
                  options={opcoesFornecedor(fornecedores)}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* Data / Semana / Ano (automaticos a partir da data de abertura) */}
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item label="Data">
                <Input value={hoje.format('DD/MM/YYYY')} disabled />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Semana">
                <Input value={semanaHoje} disabled />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Ano">
                <Input value={String(anoHoje)} disabled />
              </Form.Item>
            </Col>
          </Row>

          {/* Decisao de recebimento: classificacao + periodicidade + contador */}
          {fornecedorId && avaliacao && (
            <Descriptions
              size="small"
              bordered
              column={2}
              style={{ marginBottom: 12 }}
            >
              <Descriptions.Item label="Classificação">
                <Tag color="blue">
                  {avaliacao.fornecedor?.classificacaoFornecimento}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Periodicidade">
                {avaliacao.periodicidade?.periodicidadeTexto ??
                  `1 a cada ${avaliacao.frequenciaN} entregas`}
              </Descriptions.Item>
              <Descriptions.Item label="Entregas no ciclo">
                {avaliacao.proximoContador} de {avaliacao.frequenciaN}
              </Descriptions.Item>
              <Descriptions.Item label="Escopo">
                {avaliacao.fornecedor?.fazVisual && (
                  <Tag color="geekblue">Visual</Tag>
                )}
                {avaliacao.fornecedor?.fazLote && (
                  <Tag color="purple">Lote</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Decisão" span={2}>
                {precisaInspecionar ? (
                  <Tag color="orange">Esta entrega DEVE ser inspecionada</Tag>
                ) : (
                  <Tag color="green">
                    Fora do ciclo — recebimento sem inspeção
                  </Tag>
                )}
              </Descriptions.Item>
            </Descriptions>
          )}

          {/* Recebimento sem inspecao: apenas NF / PO (data/semana/ano acima) */}
          {precisaInspecionar === false && fornecedorId && (
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="notaFiscal" label="Nota Fiscal">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="po" label="PO">
                  <Input />
                </Form.Item>
              </Col>
            </Row>
          )}

          {precisaInspecionar && (
            <>
              {encadeado && (
                <Steps
                  size="small"
                  current={passoIdx}
                  style={{ marginBottom: 16 }}
                  items={passos.map((p) => ({
                    title: p === 'VISUAL' ? 'Inspeção Visual' : 'Inspeção de Lote',
                  }))}
                />
              )}

              <Row gutter={12}>
                <Col span={16}>
                  <Form.Item
                    name="itemDescricao"
                    label="Item (descrição)"
                    rules={[{ required: true, message: 'Informe o item.' }]}
                  >
                    <Input placeholder="Ex.: Chapa de aço galvanizado 2mm" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="itemCodigo" label="Código do item">
                    <Input placeholder="opcional" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={12}>
                <Col span={6}>
                  <Form.Item name="notaFiscal" label="Nota Fiscal">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="po" label="PO">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="qtdInspecionada" label="Qtd. inspecionada">
                    <InputNumber style={{ width: '100%' }} min={0} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="qtdTotal" label="Qtd. total do lote">
                    <InputNumber style={{ width: '100%' }} min={0} />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={12}>
                <Col span={8}>
                  <Form.Item name="desenhoRev" label="Desenho / Revisão">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="toleranciasNorm" label="Tolerâncias / Norma">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="relatorioNumero" label="Nº do relatório">
                    <Input />
                  </Form.Item>
                </Col>
              </Row>

              <Divider orientation="left" plain>
                {tipo === 'VISUAL'
                  ? 'Checklist Visual (Doc. BDBR.QUA.FMR.06.07)'
                  : 'Dimensional (Doc. BDBR.QUA.FMR.011.06)'}
              </Divider>

              {tipo === 'VISUAL' ? (
                <ChecklistVisual grupos={grupos} setGrupos={setGrupos} />
              ) : (
                <TabelaCotas cotas={cotas} setCotas={setCotas} />
              )}

              <Form.Item
                name="observacoes"
                label="Observações"
                style={{ marginTop: 12 }}
              >
                <Input.TextArea rows={2} />
              </Form.Item>

              <Alert
                type={resultadoAuto === 'REPROVADO' ? 'error' : 'success'}
                showIcon
                message={
                  resultadoAuto === 'REPROVADO'
                    ? 'Resultado: REPROVADO — será aberta uma RNC automaticamente.'
                    : 'Resultado: APROVADO — recebimento liberado.'
                }
              />

              {/* Reprovado: capturar disposicao + fotos, que nascem vinculadas a RNC */}
              {resultadoAuto === 'REPROVADO' && (
                <div style={{ marginTop: 12 }}>
                  <Form.Item
                    name="disposicao"
                    label="Disposição"
                    rules={[
                      { required: true, message: 'Informe a disposição.' },
                    ]}
                  >
                    <Input.TextArea
                      rows={2}
                      placeholder="Ex.: Devolver ao fornecedor / Retrabalho / Uso sob concessão"
                    />
                  </Form.Item>
                  <Form.Item label="Fotos da não conformidade">
                    <Upload
                      multiple
                      accept="image/*"
                      listType="picture"
                      fileList={fotosReprova}
                      beforeUpload={() => false}
                      onChange={({ fileList }) => setFotosReprova(fileList)}
                    >
                      <Button icon={<UploadOutlined />}>Adicionar fotos</Button>
                    </Upload>
                  </Form.Item>
                </div>
              )}
            </>
          )}
        </Form>
      </Modal>
    </Card>
  );
}
