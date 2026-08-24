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
  message,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../auth';
import { dataBR } from '../../formatos';
import Tabela, { filtrosDe } from '../../components/Tabela';

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

export const ORIGENS_8D = [
  { value: 'RELATORIO_RO', label: 'Relatório R.O' },
  { value: 'PRODUCAO', label: 'Produção' },
  { value: 'INSPECAO_EXTRA', label: 'Inspeção extra' },
  { value: 'SETUP', label: 'Setup' },
];

export const TURNOS_8D = [
  { value: 'COMERCIAL', label: 'Comercial' },
  { value: 'SEGUNDO_TURNO', label: '2º turno' },
];

export const corStatus8D: Record<string, string> = {
  AGUARDANDO: 'orange',
  EM_ANDAMENTO: 'blue',
  CONCLUIDO: 'green',
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

  const doc = DOCS[tipo];
  const inspecaoId = params.get('inspecaoId');
  const cnqId = params.get('cnqId');
  const tipoParam = params.get('tipo');

  const { data, isLoading } = useQuery<any[]>({
    queryKey: ['manufatura-doc', tipo],
    queryFn: async () => (await api.get(`/manufatura/${doc.rota}`)).data,
  });

  function abrir(origemVinculo?: { inspecaoId?: number; cnqId?: number }) {
    form.resetFields();
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

  async function salvar() {
    const v = await form.validateFields();
    setSalvando(true);
    try {
      const res = await api.post(`/manufatura/${doc.rota}`, v);
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
            <Button type="primary" icon={<PlusOutlined />} onClick={() => abrir()}>
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
              title: 'Produto / Item',
              dataIndex: 'produtoItem',
              filters: filtrosDe((data ?? []).map((r: any) => r.produtoItem)),
              onFilter: (v: any, r: any) => r.produtoItem === v,
            },
            {
              title: 'Origem',
              width: 140,
              filters: ORIGENS_8D.map((o) => ({ text: o.label, value: o.value })),
              onFilter: (v: any, r: any) => r.origem === v,
              render: (_: any, r: any) =>
                ORIGENS_8D.find((o) => o.value === r.origem)?.label ?? '-',
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
        destroyOnClose
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
          <Row gutter={12}>
            <Col span={14}>
              <Form.Item name="produtoItem" label="Produto / Item">
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
