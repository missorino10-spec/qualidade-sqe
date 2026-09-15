import { useState } from 'react';
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Space,
  Statistic,
  Switch,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import { FilePdfOutlined, PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { api, abrirPdfEmNovaAba, queryDeFiltro } from '../api';
import { useAuth } from '../auth';
import Tabela, { filtrosDe } from '../components/Tabela';
import FiltroPeriodo, { usarPeriodo } from '../components/FiltroPeriodo';
import ImportarPlanilha from '../components/ImportarPlanilha';
import { ExportarLista } from '../design/acoes';
import { COR } from '../design/tokens';

/**
 * Inventário de Instrumentos e Equipamentos — BDBR.QUA.FMR.004.01.
 *
 * Cópia das nove colunas da planilha, na mesma ordem. O que o sistema
 * acrescenta é o controle de vencimento: a lista mostra quantos dias faltam
 * para cada calibração e destaca o que já venceu, que na planilha só dava para
 * ver conferindo data por data.
 */

interface Instrumento {
  id: number;
  codigo?: string | null;
  equipamento: string;
  fabricante?: string | null;
  numeroSerie?: string | null;
  dataCalibracao?: string | null;
  periodoAnos?: number | null;
  proximaCalibracao?: string | null;
  numeroCertificado?: string | null;
  localizacao?: string | null;
  observacoes?: string | null;
  ativo: boolean;
}

// Datas puras: o backend grava meia-noite UTC. Passar a string inteira pelo
// dayjs faria 13/09 virar 12/09 aqui no Brasil, entao so o "AAAA-MM-DD" e
// aproveitado - dayjs le esse formato como data local.
function paraInput(v?: string | null) {
  return v ? String(v).slice(0, 10) : undefined;
}

function dataBR(v?: string | null) {
  const d = paraInput(v);
  return d ? dayjs(d).format('DD/MM/YYYY') : '-';
}

// Dias que faltam para a próxima calibração. Negativo = vencida.
function diasParaVencer(proxima?: string | null): number | null {
  const d = paraInput(proxima);
  if (!d) return null;
  return dayjs(d).startOf('day').diff(dayjs().startOf('day'), 'day');
}

function TagVencimento({ proxima }: { proxima?: string | null }) {
  const dias = diasParaVencer(proxima);
  if (dias == null) return <Tag color="default">Sem data</Tag>;
  if (dias < 0)
    return <Tag color="red">Vencida há {Math.abs(dias)} dia(s)</Tag>;
  if (dias <= 30) return <Tag color="orange">Vence em {dias} dia(s)</Tag>;
  return <Tag color="green">{dias} dia(s)</Tag>;
}

export default function Instrumentos() {
  const qc = useQueryClient();
  const { usuario } = useAuth();
  const admin = usuario?.papel === 'ADMIN';
  const podeEditar = admin || usuario?.papel === 'QUALIDADE';

  const [incluirInativos, setIncluirInativos] = useState(false);
  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState<Instrumento | null>(null);
  const [form] = Form.useForm();

  // Instrumento nao tem data de lançamento: ele nao acontece num dia. O que
  // tem prazo é a calibração, entao o período recorta pela PRÓXIMA
  // CALIBRAÇÃO — é a pergunta que se faz nesta tela ("o que vence até...").
  const periodo = usarPeriodo();
  const filtro = {
    de: periodo.de,
    ate: periodo.ate,
    incluirInativos,
  };

  const { data, isFetching } = useQuery<Instrumento[]>({
    queryKey: ['instrumentos', filtro.de, filtro.ate, filtro.incluirInativos],
    queryFn: async () => (await api.get('/instrumentos', { params: filtro })).data,
  });

  function invalidar() {
    qc.invalidateQueries({ queryKey: ['instrumentos'] });
  }

  const salvar = useMutation({
    mutationFn: async (v: any) => {
      const corpo = {
        ...v,
        dataCalibracao: v.dataCalibracao || null,
        proximaCalibracao: v.proximaCalibracao || null,
      };
      return editando
        ? api.patch(`/instrumentos/${editando.id}`, corpo)
        : api.post('/instrumentos', corpo);
    },
    onSuccess: () => {
      message.success('Instrumento salvo.');
      invalidar();
      fechar();
    },
    onError: (e: any) =>
      message.error(
        e?.response?.data?.message ?? 'Não foi possível salvar o instrumento.',
      ),
  });

  // Inativar e o caminho normal: o instrumento sai do inventario e do controle
  // de vencimento, mas o registro continua para consulta.
  const alternarAtivo = useMutation({
    mutationFn: async (i: Instrumento) =>
      api.patch(`/instrumentos/${i.id}`, { ativo: !i.ativo }),
    onSuccess: (_r, i) => {
      message.success(i.ativo ? 'Instrumento inativado.' : 'Instrumento reativado.');
      invalidar();
    },
    onError: () => message.error('Não foi possível alterar a situação.'),
  });

  const excluir = useMutation({
    mutationFn: async (i: Instrumento) => api.delete(`/instrumentos/${i.id}`),
    onSuccess: () => {
      message.success('Instrumento excluído.');
      invalidar();
    },
    onError: (e: any) =>
      message.error(
        e?.response?.data?.message ?? 'Não foi possível excluir o instrumento.',
      ),
  });

  function abrir(i?: Instrumento) {
    setEditando(i ?? null);
    form.setFieldsValue(
      i
        ? {
            ...i,
            dataCalibracao: paraInput(i.dataCalibracao),
            proximaCalibracao: paraInput(i.proximaCalibracao),
          }
        : {
            codigo: '',
            equipamento: '',
            fabricante: '',
            numeroSerie: '',
            dataCalibracao: undefined,
            // Padrao da casa: o certificado dos instrumentos vale 2 anos. E so
            // sugestao - quem tem instrumento com outro prazo troca o numero.
            periodoAnos: 2,
            proximaCalibracao: undefined,
            numeroCertificado: '',
            localizacao: '',
            observacoes: '',
          },
    );
    setOpen(true);
  }
  function fechar() {
    setOpen(false);
    setEditando(null);
    form.resetFields();
  }

  function confirmarExclusao(i: Instrumento) {
    Modal.confirm({
      title: `Excluir ${i.codigo ? `${i.codigo} — ` : ''}${i.equipamento}?`,
      content:
        'A exclusão é definitiva e apaga o histórico de calibração do instrumento. Para tirar do inventário sem perder o registro, use "Inativar".',
      okText: 'Excluir',
      okButtonProps: { danger: true },
      cancelText: 'Cancelar',
      onOk: () => excluir.mutateAsync(i),
    });
  }

  // Sugere a próxima calibração quando o usuário informa data e período. É só
  // sugestão: a data do certificado manda e pode ser digitada por cima.
  function sugerirProxima() {
    const data = form.getFieldValue('dataCalibracao');
    const anos = form.getFieldValue('periodoAnos');
    if (!data || !anos) return;
    form.setFieldValue(
      'proximaCalibracao',
      dayjs(data).add(anos, 'year').format('YYYY-MM-DD'),
    );
  }

  const lista = data ?? [];
  const vencidos = lista.filter((i) => {
    const d = diasParaVencer(i.proximaCalibracao);
    return d != null && d < 0;
  }).length;
  const aVencer = lista.filter((i) => {
    const d = diasParaVencer(i.proximaCalibracao);
    return d != null && d >= 0 && d <= 30;
  }).length;

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
    {/* O instrumento nao tem data de lancamento: a pergunta da tela e "o que
        vence ate quando", entao o recorte cai sobre a proxima calibracao. */}
    <FiltroPeriodo
      controle={periodo}
      rotulo="Período (próxima calibração)"
      larguraExtra={11}
    >
      <Col xs={24} sm={12}>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          Mostrar inativos
        </Typography.Text>
        <div>
          <Switch checked={incluirInativos} onChange={setIncluirInativos} />
        </div>
      </Col>
    </FiltroPeriodo>

    <Card
      title="Inventário de Instrumentos e Equipamentos — BDBR.QUA.FMR.004.01"
      extra={
        <Space wrap>
          <ExportarLista
            url={`/instrumentos/relatorio${queryDeFiltro(filtro)}`}
            nome="instrumentos"
          />
          {/* Documento do 004.01, no layout da planilha impressa: sai sempre
              com o inventário inteiro, independente do recorte da tela. */}
          <Button
            icon={<FilePdfOutlined />}
            onClick={() =>
              abrirPdfEmNovaAba(
                `/instrumentos/pdf?incluirInativos=${incluirInativos}`,
              )
            }
          >
            PDF do inventário
          </Button>
          <ImportarPlanilha
            cadastro="instrumentos"
            aoConcluir={() =>
              qc.invalidateQueries({ queryKey: ['instrumentos'] })
            }
          />
          {podeEditar && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => abrir()}
            >
              Novo instrumento
            </Button>
          )}
        </Space>
      }
    >
      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col xs={8}>
          <Card size="small">
            <Statistic title="Instrumentos" value={lista.length} />
          </Card>
        </Col>
        <Col xs={8}>
          <Card size="small">
            <Statistic
              title="Calibração vencida"
              value={vencidos}
              valueStyle={{ color: vencidos ? COR.critico : undefined }}
            />
          </Card>
        </Col>
        <Col xs={8}>
          <Card size="small">
            <Statistic
              title="Vence em até 30 dias"
              value={aVencer}
              valueStyle={{ color: aVencer ? COR.atencao : undefined }}
            />
          </Card>
        </Col>
      </Row>

      {/* A busca e a da propria Tabela, que varre a linha inteira. */}
      <Tabela
        busca="Buscar por código, equipamento, série, certificado..."
        rowKey="id"
        loading={isFetching}
        dataSource={lista}
        scroll={{ x: 'max-content' }}
        columns={[
          {
            title: 'Código',
            dataIndex: 'codigo',
            width: 100,
            render: (v: string | null) => v ?? '-',
          },
          { title: 'Equipamento', dataIndex: 'equipamento', width: 260 },
          {
            title: 'Fabricante',
            dataIndex: 'fabricante',
            width: 110,
            filters: filtrosDe(lista.map((i) => i.fabricante)),
            onFilter: (v: any, i: any) => i.fabricante === v,
          },
          { title: 'Nº série', dataIndex: 'numeroSerie', width: 110 },
          {
            title: 'Data de calibração',
            dataIndex: 'dataCalibracao',
            width: 130,
            render: dataBR,
          },
          {
            title: 'Próxima calibração',
            dataIndex: 'proximaCalibracao',
            width: 130,
            render: dataBR,
          },
          {
            title: 'Situação',
            width: 160,
            render: (_: any, i: Instrumento) =>
              i.ativo ? (
                <TagVencimento proxima={i.proximaCalibracao} />
              ) : (
                <Tag color="default">Inativo</Tag>
              ),
          },
          { title: 'Nº certificado', dataIndex: 'numeroCertificado', width: 110 },
          {
            title: 'Período (anos)',
            dataIndex: 'periodoAnos',
            width: 90,
            align: 'center' as const,
            render: (v: number | null) => v ?? '-',
          },
          {
            title: 'Localização',
            dataIndex: 'localizacao',
            width: 140,
            filters: filtrosDe(lista.map((i) => i.localizacao)),
            onFilter: (v: any, i: any) => i.localizacao === v,
          },
          ...(podeEditar
            ? [
                {
                  title: 'Ações',
                  width: admin ? 220 : 150,
                  render: (_: any, i: Instrumento) => (
                    <Space size={4}>
                      <Button size="small" onClick={() => abrir(i)}>
                        Editar
                      </Button>
                      <Button
                        size="small"
                        onClick={() => alternarAtivo.mutate(i)}
                      >
                        {i.ativo ? 'Inativar' : 'Reativar'}
                      </Button>
                      {admin && (
                        <Button
                          size="small"
                          danger
                          onClick={() => confirmarExclusao(i)}
                        >
                          Excluir
                        </Button>
                      )}
                    </Space>
                  ),
                },
              ]
            : []),
        ]}
      />

      <Modal
        title={editando ? 'Editar instrumento' : 'Novo instrumento'}
        open={open}
        onCancel={fechar}
        onOk={() => form.submit()}
        confirmLoading={salvar.isPending}
        okText="Salvar"
        cancelText="Cancelar"
        width={760}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(v) => salvar.mutate(v)}
          style={{ marginTop: 12 }}
        >
          <Row gutter={12}>
            <Col span={6}>
              <Form.Item
                name="codigo"
                label="Código"
                tooltip="Opcional: na planilha várias linhas vêm sem código ou repetem o código do instrumento principal (barra padrão)."
              >
                <Input placeholder="MICR 001" />
              </Form.Item>
            </Col>
            <Col span={18}>
              <Form.Item
                name="equipamento"
                label="Equipamento"
                rules={[{ required: true, message: 'Informe o equipamento.' }]}
              >
                <Input placeholder="Micrômetro Digital 0-25 mm" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="fabricante" label="Fabricante">
                <Input placeholder="Mitutoyo" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="numeroSerie" label="Nº de série">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="numeroCertificado" label="Nº do certificado">
                <Input placeholder="60264/24" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="dataCalibracao" label="Data de calibração">
                <Input type="date" onChange={sugerirProxima} />
              </Form.Item>
            </Col>
            <Col span={7}>
              <Form.Item name="periodoAnos" label="Período (anos)">
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  onChange={sugerirProxima}
                />
              </Form.Item>
            </Col>
            <Col span={9}>
              <Form.Item
                name="proximaCalibracao"
                label={
                  <Tooltip title="Sugerida a partir da data e do período, mas quem manda é a data do certificado — pode ser digitada por cima.">
                    <span>Próxima calibração</span>
                  </Tooltip>
                }
              >
                <Input type="date" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={10}>
              <Form.Item name="localizacao" label="Localização">
                <Input placeholder="Metrologia" />
              </Form.Item>
            </Col>
            <Col span={14}>
              <Form.Item name="observacoes" label="Observações">
                <Input />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </Card>
    </Space>
  );
}
