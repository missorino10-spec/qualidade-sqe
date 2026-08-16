import { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Space,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd';
import {
  CheckCircleOutlined,
  FilePdfOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, abrirPdfEmNovaAba } from '../api';
import { dataBR } from '../formatos';

// DESVIO DE QUALIDADE (concessao)
//
// Libera o material fora do especificado dentro de um limite acordado: uma
// QUANTIDADE de pecas, um PRAZO, ou os dois - quem escolhe e o usuario, e ao
// menos um dos dois e obrigatorio.
//
// O documento que autoriza e obrigatorio para abrir: por isso ele sobe antes,
// e o botao "Abrir desvio" so libera depois do anexo.
//
// O mesmo bloco atende a RNC (SQE) e o Registro de Homologacao de Item (SQD);
// o que muda e o entidadeTipo do anexo e a rota da API.

export const TIPO_DESVIO = {
  rnc: 'RNC_DESVIO',
  homologacaoItem: 'HOMOLOGACAO_ITEM_DESVIO',
} as const;

// Os tres estados da coluna nas listagens.
export function situacaoDesvio(r: any): {
  texto: string;
  cor?: string;
  valor: 'NAO' | 'ABERTO' | 'ENCERRADO';
} {
  if (!r?.desvioQualidade) return { texto: 'Não', valor: 'NAO' };
  if (r.desvioEncerradoEm)
    return { texto: 'Sim — encerrado', cor: 'green', valor: 'ENCERRADO' };
  return { texto: 'Sim — aberto', cor: 'orange', valor: 'ABERTO' };
}

export const FILTROS_DESVIO = [
  { text: 'Não', value: 'NAO' },
  { text: 'Sim — aberto', value: 'ABERTO' },
  { text: 'Sim — encerrado', value: 'ENCERRADO' },
];

// Limite acordado em texto, do jeito que o usuario informou.
function textoLimite(r: any): string {
  const partes = [
    r.desvioQuantidade != null ? `${r.desvioQuantidade} peça(s)` : null,
    r.desvioPrazoFim ? `até ${dataBR(r.desvioPrazoFim)}` : null,
  ].filter(Boolean);
  return partes.join(' e ') || '-';
}

export function CardDesvioQualidade({
  registro,
  entidadeTipo,
  base,
  podeEditar,
  onMudou,
}: {
  registro: any;
  entidadeTipo: string;
  // Prefixo da rota do registro (ex: "/rnc/12").
  base: string;
  podeEditar: boolean;
  onMudou: () => void;
}) {
  const qc = useQueryClient();
  const id = registro.id;
  const [abrirOpen, setAbrirOpen] = useState(false);
  const [encerrarOpen, setEncerrarOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [formAbrir] = Form.useForm();
  const [formEncerrar] = Form.useForm();

  const { data: documentos } = useQuery<any[]>({
    queryKey: ['anexos', entidadeTipo, id],
    queryFn: async () =>
      (await api.get('/anexos', { params: { entidadeTipo, entidadeId: id } }))
        .data,
  });
  const anexos = documentos ?? [];
  const situacao = situacaoDesvio(registro);
  const aberto = situacao.valor === 'ABERTO';

  async function abrir(v: any) {
    setSalvando(true);
    try {
      await api.post(`${base}/desvio`, {
        aberturaEm: v.aberturaEm.format('YYYY-MM-DD'),
        quantidade: v.quantidade ?? undefined,
        prazoFim: v.prazoFim ? v.prazoFim.format('YYYY-MM-DD') : undefined,
        descricao: v.descricao,
      });
      setAbrirOpen(false);
      formAbrir.resetFields();
      onMudou();
      message.success('Desvio de qualidade aberto.');
    } catch (e: any) {
      message.error(
        e?.response?.data?.message ?? 'Não foi possível abrir o desvio.',
      );
    } finally {
      setSalvando(false);
    }
  }

  async function encerrar(v: any) {
    setSalvando(true);
    try {
      await api.post(`${base}/desvio/encerrar`, {
        encerradoEm: v.encerradoEm.format('YYYY-MM-DD'),
        observacoes: v.observacoes,
      });
      setEncerrarOpen(false);
      formEncerrar.resetFields();
      onMudou();
      message.success('Desvio de qualidade encerrado.');
    } catch (e: any) {
      message.error(
        e?.response?.data?.message ?? 'Não foi possível encerrar o desvio.',
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Card
      title="Desvio de Qualidade"
      style={{ marginTop: 16 }}
      extra={
        <Tag color={situacao.cor}>{situacao.texto}</Tag>
      }
    >
      {registro.desvioQualidade ? (
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="Aberto em">
            {dataBR(registro.desvioAberturaEm)}
          </Descriptions.Item>
          <Descriptions.Item label="Limite acordado">
            {textoLimite(registro)}
          </Descriptions.Item>
          <Descriptions.Item label="Descrição" span={2}>
            {registro.desvioDescricao ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Encerrado em">
            {dataBR(registro.desvioEncerradoEm)}
          </Descriptions.Item>
          <Descriptions.Item label="Observações do encerramento">
            {registro.desvioEncerramentoObs ?? '-'}
          </Descriptions.Item>
        </Descriptions>
      ) : (
        <Alert
          type="info"
          showIcon
          message="Nenhum desvio de qualidade aberto"
          description="O desvio libera o material fora do especificado dentro de um limite acordado: uma quantidade de peças, um prazo, ou os dois. Anexe o documento que autoriza para poder abri-lo."
        />
      )}

      <div style={{ marginTop: 12 }}>
        <Typography.Text strong>Documento que autoriza</Typography.Text>
        <div style={{ marginTop: 8 }}>
          {podeEditar && (
            <Upload
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
              showUploadList={false}
              customRequest={async ({ file, onSuccess, onError }) => {
                const fd = new FormData();
                fd.append('file', file as Blob);
                try {
                  await api.post('/anexos', fd, {
                    params: { entidadeTipo, entidadeId: id },
                  });
                  qc.invalidateQueries({
                    queryKey: ['anexos', entidadeTipo, id],
                  });
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
          <div style={{ marginTop: 8 }}>
            {anexos.length ? (
              <Space direction="vertical" size={4}>
                {anexos.map((a: any) => (
                  <Button
                    key={a.id}
                    type="link"
                    icon={<FilePdfOutlined />}
                    style={{ padding: 0 }}
                    onClick={() =>
                      abrirPdfEmNovaAba(`/anexos/${a.id}/download`)
                    }
                  >
                    {a.nomeArquivo}
                  </Button>
                ))}
              </Space>
            ) : (
              <Typography.Text type="secondary">
                Nenhum documento anexado — obrigatório para abrir o desvio.
              </Typography.Text>
            )}
          </div>
        </div>
      </div>

      {podeEditar && (
        <Space style={{ marginTop: 12 }} wrap>
          <Button
            type="primary"
            disabled={aberto || !anexos.length}
            onClick={() => setAbrirOpen(true)}
          >
            {registro.desvioQualidade ? 'Abrir novo desvio' : 'Abrir desvio'}
          </Button>
          <Button
            icon={<CheckCircleOutlined />}
            disabled={!aberto}
            onClick={() => setEncerrarOpen(true)}
          >
            Encerrar desvio
          </Button>
        </Space>
      )}

      <Modal
        title="Abrir desvio de qualidade"
        open={abrirOpen}
        onOk={() => formAbrir.submit()}
        onCancel={() => setAbrirOpen(false)}
        confirmLoading={salvando}
        okText="Abrir desvio"
        cancelText="Cancelar"
      >
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="Informe a quantidade, o prazo, ou os dois"
          description="É o limite acordado que faz o desvio ter fim. Ao menos um dos dois é obrigatório."
        />
        <Form form={formAbrir} layout="vertical" onFinish={abrir}>
          <Form.Item
            name="aberturaEm"
            label="Data de abertura"
            rules={[{ required: true, message: 'Informe a data de abertura.' }]}
          >
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="quantidade" label="Quantidade de peças">
                <InputNumber style={{ width: '100%' }} min={1} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="prazoFim" label="Válido até">
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="descricao" label="Descrição do desvio">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Encerrar desvio de qualidade"
        open={encerrarOpen}
        onOk={() => formEncerrar.submit()}
        onCancel={() => setEncerrarOpen(false)}
        confirmLoading={salvando}
        okText="Encerrar desvio"
        cancelText="Cancelar"
      >
        <Form form={formEncerrar} layout="vertical" onFinish={encerrar}>
          <Form.Item
            name="encerradoEm"
            label="Data de encerramento"
            rules={[
              { required: true, message: 'Informe a data de encerramento.' },
            ]}
          >
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="observacoes" label="Observações">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
