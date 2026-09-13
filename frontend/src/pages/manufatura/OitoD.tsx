import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  Modal,
  Row,
  Segmented,
  Select,
  Space,
  Tag,
  Upload,
  message,
} from 'antd';
import { PlusOutlined, UploadOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, queryDeFiltro } from '../../api';
import { useAuth } from '../../auth';
import { dataBR } from '../../formatos';
import FiltroPeriodo, { usarPeriodo } from '../../components/FiltroPeriodo';
import { ExportarLista } from '../../design/acoes';
import Tabela, { filtrosDe } from '../../components/Tabela';
import { DOC_8D } from '../../oitod';
import { DOC_5G } from '../../cincog';
import { TAG } from '../../design/tokens';

// Analise de Problemas da Qualidade — Doc BDBR.QUA.FMR.007.01.
// A tela reune os dois documentos do formulario: o 8D (analise completa) e o
// Metodo 5G (reestabelecimento das condicoes normais do processo). Cada um tem
// a sua numeracao propria — 8D0001/2026 e 5G0001/2026 — e o filtro no topo
// escolhe qual dos dois esta sendo listado.
// A abertura pode vir de uma inspecao reprovada ou de um lancamento de CNQ:
// nesses casos a tela e chamada com ?inspecaoId= ou ?cnqId= (e ?tipo=5G quando
// for o caso) e ja abre o modal. Aqui so entra o cabecalho: o restante do
// documento e preenchido no detalhe.

type TipoDoc = '8D' | '5G';

// Cada tipo tem a sua rota de API e a sua rota de tela.
const DOCS: Record<
  TipoDoc,
  { rota: string; titulo: string; novo: string; okText: string }
> = {
  '8D': {
    rota: '8d',
    titulo: 'Análise de Problemas da Qualidade (8D)',
    novo: 'Novo 8D',
    okText: 'Abrir 8D',
  },
  '5G': {
    rota: '5g',
    titulo: 'Método 5G — Reestabelecimento das condições normais do processo',
    novo: 'Novo 5G',
    okText: 'Abrir 5G',
  },
};

// Rotulo do anexo "documento que motivou a abertura", por tipo de documento.
const DOC_ANEXO: Record<TipoDoc, string> = { '8D': DOC_8D, '5G': DOC_5G };

// "RNC" e so o motivo da abertura: nao ha vinculo com a RNC do SQE. O numero
// dela, quando houver, vai no campo "Documento referenciado".
export const ORIGENS_8D = [
  { value: 'RELATORIO_RO', label: 'Relatório R.O' },
  { value: 'PRODUCAO', label: 'Produção' },
  { value: 'INSPECAO_EXTRA', label: 'Inspeção extra' },
  { value: 'SETUP', label: 'Setup' },
  { value: 'RNC', label: 'RNC' },
  { value: 'OUTROS', label: 'Outros' },
];

// Na lista e no detalhe, "Outros" sozinho nao diz nada: o que aparece e o texto
// digitado pelo usuario.
export function textoOrigem8D(reg: any): string {
  const rotulo = ORIGENS_8D.find((o) => o.value === reg?.origem)?.label;
  if (reg?.origem === 'OUTROS' && reg?.origemOutros) return reg.origemOutros;
  return rotulo ?? '-';
}

export const TURNOS_8D = [
  { value: 'COMERCIAL', label: 'Comercial' },
  { value: 'SEGUNDO_TURNO', label: '2º turno' },
];

export const corStatus8D: Record<string, string> = {
  AGUARDANDO: TAG.pendencia,
  EM_ANDAMENTO: TAG.andamento,
  CONCLUIDO: TAG.sucesso,
};

export const labelStatus8D: Record<string, string> = {
  AGUARDANDO: 'Aguardando',
  EM_ANDAMENTO: 'Em andamento',
  CONCLUIDO: 'Concluído',
};

export default function OitoD() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const admin = usuario?.papel === 'ADMIN';
  const [params, setParams] = useSearchParams();
  const [tipo, setTipo] = useState<TipoDoc>('8D');
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const [salvando, setSalvando] = useState(false);
  // Arquivos escolhidos na abertura. Ficam retidos aqui porque o anexo precisa
  // do id do documento, que so existe depois que ele e numerado.
  const [arquivos, setArquivos] = useState<any[]>([]);
  // "Outros" so vale escrito: o rotulo sozinho nao diz de onde veio o problema.
  const origem = Form.useWatch('origem', form);

  const doc = DOCS[tipo];
  const inspecaoId = params.get('inspecaoId');
  const cnqId = params.get('cnqId');
  const tipoParam = params.get('tipo');

  // O recorte cai sobre a data de abertura e vale tanto para a lista quanto
  // para a exportacao — os dois mostram a mesma coisa.
  const periodo = usarPeriodo();
  const filtro = { de: periodo.de, ate: periodo.ate };

  const { data, isLoading } = useQuery<any[]>({
    queryKey: ['manufatura-doc', tipo, filtro.de, filtro.ate],
    queryFn: async () =>
      (await api.get(`/manufatura/${doc.rota}`, { params: filtro })).data,
  });

  function abrir(origemVinculo?: { inspecaoId?: number; cnqId?: number }) {
    form.resetFields();
    setArquivos([]);
    form.setFieldsValue({
      dataAbertura: dayjs().format('YYYY-MM-DD'),
      status: 'AGUARDANDO',
      turno: 'COMERCIAL',
      ...origemVinculo,
    });
    setOpen(true);
  }

  // Abertura vinda da inspecao ou do CNQ: ja chega com o vinculo preenchido e
  // com o tipo de documento escolhido la na origem.
  useEffect(() => {
    if (!inspecaoId && !cnqId) return;
    if (tipoParam === '5G' || tipoParam === '8D') setTipo(tipoParam);
    abrir({
      inspecaoId: inspecaoId ? Number(inspecaoId) : undefined,
      cnqId: cnqId ? Number(cnqId) : undefined,
    });
    setParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspecaoId, cnqId, tipoParam]);

  // Excluir de verdade e so do ADMIN. E o caminho para o documento aberto por
  // engano. O tipo e a rota vao junto no argumento: quem manda e o que estava
  // na tela quando o modal abriu, nao o filtro do momento em que confirma.
  const excluir = useMutation({
    mutationFn: async (alvo: { tipo: TipoDoc; r: any }) =>
      api.delete(`/manufatura/${DOCS[alvo.tipo].rota}/${alvo.r.id}`),
    onSuccess: (_res, alvo) => {
      message.success(`${alvo.tipo} excluído.`);
      qc.invalidateQueries({ queryKey: ['manufatura-doc'] });
    },
    onError: (e: any, alvo) =>
      message.error(
        e?.response?.data?.message ?? `Não foi possível excluir o ${alvo.tipo}.`,
      ),
  });

  function confirmarExclusao(alvoTipo: TipoDoc, r: any) {
    Modal.confirm({
      title: `Excluir o ${alvoTipo} ${r.numero}?`,
      content: 'A exclusão é definitiva.',
      okText: 'Excluir',
      okButtonProps: { danger: true },
      cancelText: 'Cancelar',
      onOk: () => excluir.mutateAsync({ tipo: alvoTipo, r }),
    });
  }

  // O documento ja foi aberto quando isto roda: uma falha aqui nao desfaz a
  // abertura, so avisa - o arquivo pode ser anexado de novo pelo detalhe.
  async function enviarDocumentos(id: number) {
    for (const arquivo of arquivos) {
      const fd = new FormData();
      fd.append('file', arquivo.originFileObj ?? arquivo);
      try {
        await api.post('/anexos', fd, {
          params: { entidadeTipo: DOC_ANEXO[tipo], entidadeId: id },
        });
      } catch {
        message.warning(`Não foi possível anexar "${arquivo.name}".`);
      }
    }
  }

  async function salvar() {
    const v = await form.validateFields();
    setSalvando(true);
    try {
      const res = await api.post(`/manufatura/${doc.rota}`, v);
      await enviarDocumentos(res.data.id);
      message.success(`${tipo} ${res.data.numero} aberto.`);
      qc.invalidateQueries({ queryKey: ['manufatura-doc'] });
      setOpen(false);
      navigate(`/manufatura/${doc.rota}/${res.data.id}`);
    } catch (e: any) {
      message.error(
        e?.response?.data?.message ?? `Não foi possível abrir o ${tipo}.`,
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <FiltroPeriodo controle={periodo} rotulo="Período (abertura)" />

      <Card
        title={doc.titulo}
        extra={
          <Space wrap>
            <Segmented
              value={tipo}
              onChange={(v) => setTipo(v as TipoDoc)}
              options={[
                { value: '8D', label: '8D' },
                { value: '5G', label: '5G' },
              ]}
            />
            {/* Exporta o documento que esta na tela: o 8D e o 5G tem listas
                separadas, entao a rota acompanha o filtro do topo. */}
            <ExportarLista
              url={`/manufatura/${doc.rota}/relatorio${queryDeFiltro(filtro)}`}
              nome={tipo === '8D' ? 'oito-d' : 'cinco-g'}
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => abrir()}
            >
              {doc.novo}
            </Button>
          </Space>
        }
      >
        <Tabela
          busca="Buscar (número, título, item, responsável...)"
          rowKey="id"
          size="small"
          loading={isLoading}
          dataSource={data}
          scroll={{ x: 1100 }}
          onRow={(r) => ({
            onClick: () => navigate(`/manufatura/${doc.rota}/${r.id}`),
            style: { cursor: 'pointer' },
          })}
          columns={[
            { title: 'Número', dataIndex: 'numero', width: 120 },
            {
              title: 'Abertura',
              dataIndex: 'dataAbertura',
              width: 110,
              render: (d: string) => dataBR(d),
            },
            {
              title: 'Produto / item',
              dataIndex: 'produtoItem',
              filters: filtrosDe((data ?? []).map((r: any) => r.produtoItem)),
              onFilter: (v: any, r: any) => r.produtoItem === v,
            },
            {
              title: 'Origem',
              width: 140,
              filters: ORIGENS_8D.map((o) => ({ text: o.label, value: o.value })),
              onFilter: (v: any, r: any) => r.origem === v,
              render: (_: any, r: any) => textoOrigem8D(r),
            },
            {
              title: 'Documento',
              dataIndex: 'documentoReferencia',
              width: 140,
              render: (v: string) => v || '-',
            },
            {
              title: 'Vínculo',
              width: 150,
              render: (_: any, r: any) =>
                r.inspecao?.numero ?? r.cnq?.numero ?? '-',
            },
            {
              title: 'Responsável',
              dataIndex: 'responsavel',
              width: 150,
              filters: filtrosDe((data ?? []).map((r: any) => r.responsavel)),
              onFilter: (v: any, r: any) => r.responsavel === v,
            },
            {
              title: 'Status',
              dataIndex: 'status',
              width: 130,
              filters: Object.entries(labelStatus8D).map(([v, t]) => ({
                text: t as string,
                value: v,
              })),
              onFilter: (v: any, r: any) => r.status === v,
              render: (s: string) => (
                <Tag color={corStatus8D[s]}>{labelStatus8D[s] ?? s}</Tag>
              ),
            },
            // A linha inteira abre o documento, entao o botao precisa segurar o
            // clique para nao navegar junto.
            ...(admin
              ? [
                  {
                    title: 'Ações',
                    width: 100,
                    render: (_: any, r: any) => (
                      <Button
                        size="small"
                        danger
                        onClick={(e) => {
                          e.stopPropagation();
                          confirmarExclusao(tipo, r);
                        }}
                      >
                        Excluir
                      </Button>
                    ),
                  },
                ]
              : []),
          ]}
        />
      </Card>

      <Modal
        open={open}
        title={`Novo ${tipo} — Doc. BDBR.QUA.FMR.007.01`}
        width={760}
        okText={doc.okText}
        cancelText="Cancelar"
        confirmLoading={salvando}
        onOk={salvar}
        onCancel={() => setOpen(false)}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item name="inspecaoId" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="cnqId" hidden>
            <Input />
          </Form.Item>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="dataAbertura" label="Data de abertura">
                <Input type="date" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="status" label="Status">
                <Select
                  options={Object.entries(labelStatus8D).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="origem"
                label="Origem"
                rules={[{ required: true, message: 'Informe a origem.' }]}
              >
                <Select options={ORIGENS_8D} />
              </Form.Item>
            </Col>
          </Row>
          {origem === 'OUTROS' && (
            <Form.Item
              name="origemOutros"
              label="Especifique a origem"
              rules={[{ required: true, message: 'Informe a origem.' }]}
            >
              <Input maxLength={120} />
            </Form.Item>
          )}
          <Row gutter={12}>
            <Col span={12}>
              {/* Numero do documento que motivou a abertura (RNC, relatorio,
                  e-mail...). Opcional: nem toda abertura tem documento. */}
              <Form.Item
                name="documentoReferencia"
                label="Documento referenciado"
              >
                <Input maxLength={120} placeholder="Nº do documento" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Anexar documento">
                <Upload
                  multiple
                  fileList={arquivos}
                  // O arquivo so sobe depois que o documento e numerado: aqui
                  // ele fica retido na lista.
                  beforeUpload={() => false}
                  onChange={({ fileList }) => setArquivos(fileList)}
                >
                  <Button icon={<UploadOutlined />}>Escolher arquivo</Button>
                </Upload>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={14}>
              <Form.Item name="produtoItem" label="Produto / item">
                <Input />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="codigoDesenho" label="Código / Desenho">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="responsavel" label="Coordenador">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="turno" label="Turno">
                <Select options={TURNOS_8D} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="departamento" label="Departamento">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="areaAplicacao" label="Área de aplicação">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="descricaoProblema" label="Problema">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
