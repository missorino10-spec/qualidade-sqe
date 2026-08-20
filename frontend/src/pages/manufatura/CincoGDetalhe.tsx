import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Form,
  Image,
  Input,
  Popconfirm,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  FilePdfOutlined,
  SaveOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useNavigate, useParams } from 'react-router-dom';
import { api, abrirPdfEmNovaAba } from '../../api';
import { dataInput } from '../../formatos';
import { AuthImage } from '../../components/AuthImage';
import {
  CINCO_G,
  EVID_5G,
  NOTA_5G,
  checklist5G,
  checklist5GInicial,
  restauracoesPendentes,
} from '../../cincog';
import { SITUACOES_ACAO } from '../../oitod';
import { ORIGENS_8D, TURNOS_8D, corStatus8D, labelStatus8D } from './OitoD';

// Metodo 5G — Doc BDBR.QUA.FMR.007.01.
// Documento proprio (5G0001/2026): a maioria dos problemas nao vira 8D, e
// resolvida indo ao posto de trabalho e restaurando as condicoes normais do
// processo. A tela e o checklist das 9 avaliacoes da planilha, nada mais.

const SIM_NAO = [
  { value: 'SIM', label: 'Sim' },
  { value: 'NAO', label: 'Não' },
];

function QuadroFotos({
  entidadeTipo,
  entidadeId,
  rotulo,
}: {
  entidadeTipo: string;
  entidadeId?: string;
  rotulo: string;
}) {
  const qc = useQueryClient();
  const { data: anexos } = useQuery<any[]>({
    queryKey: ['anexos', entidadeTipo, entidadeId],
    enabled: !!entidadeId,
    queryFn: async () =>
      (await api.get('/anexos', { params: { entidadeTipo, entidadeId } })).data,
  });

  const fotos = (anexos ?? []).filter((a) => a.mimeType?.startsWith('image/'));

  return (
    <div style={{ marginBottom: 8 }}>
      <Space align="center" wrap style={{ marginBottom: 8 }}>
        <Typography.Text type="secondary">{rotulo}</Typography.Text>
        <Upload
          multiple
          accept="image/png,image/jpeg,image/heic,image/heif"
          showUploadList={false}
          customRequest={async ({ file, onSuccess, onError }) => {
            const fd = new FormData();
            fd.append('file', file as Blob);
            try {
              await api.post('/anexos', fd, {
                params: { entidadeTipo, entidadeId },
              });
              qc.invalidateQueries({
                queryKey: ['anexos', entidadeTipo, entidadeId],
              });
              onSuccess?.({});
            } catch (e) {
              onError?.(e as any);
              message.error('Não foi possível enviar a foto.');
            }
          }}
        >
          <Button size="small" icon={<UploadOutlined />}>
            Enviar foto
          </Button>
        </Upload>
      </Space>
      {fotos.length ? (
        <Image.PreviewGroup>
          <Space wrap>
            {fotos.map((a: any) => (
              <AuthImage key={a.id} anexoId={a.id} />
            ))}
          </Space>
        </Image.PreviewGroup>
      ) : (
        <Typography.Text type="secondary" italic>
          Nenhuma imagem anexada. Até 4 imagens entram no PDF.
        </Typography.Text>
      )}
    </div>
  );
}

export default function CincoGDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form] = Form.useForm();
  const [avaliacoes, setAvaliacoes] = useState<any[]>(checklist5GInicial());
  const [salvando, setSalvando] = useState(false);

  const { data, isLoading } = useQuery<any>({
    queryKey: ['manufatura-5g', id],
    queryFn: async () => (await api.get(`/manufatura/5g/${id}`)).data,
    enabled: !!id,
  });

  useEffect(() => {
    if (!data) return;
    form.setFieldsValue({
      ...data,
      dataAbertura: dataInput(data.dataAbertura),
      dataTermino: dataInput(data.dataTermino),
    });
    setAvaliacoes(checklist5G(data.avaliacoes));
  }, [data, form]);

  if (isLoading || !data)
    return (
      <Card>
        <Spin />
      </Card>
    );

  const pendentes = restauracoesPendentes(avaliacoes);
  const podeFechar = pendentes.length === 0;

  // As 9 linhas sao fixas: o usuario preenche colunas, nunca cria nem apaga.
  const mudar = (i: number, campo: string, valor: any) =>
    setAvaliacoes(
      avaliacoes.map((l, k) => (k === i ? { ...l, [campo]: valor } : l)),
    );

  const fixo = (campo: string, title: string, width: number) => ({
    title,
    width,
    render: (_: any, r: any) => (
      <Typography.Text style={{ fontSize: 12 }}>{r?.[campo] ?? ''}</Typography.Text>
    ),
  });
  const area = (campo: string, title: string, width: number) => ({
    title,
    width,
    render: (_: any, __: any, i: number) => (
      <Input.TextArea
        size="small"
        autoSize={{ minRows: 1, maxRows: 5 }}
        value={avaliacoes[i]?.[campo] ?? ''}
        onChange={(e) => mudar(i, campo, e.target.value)}
      />
    ),
  });
  const texto = (campo: string, title: string, width: number) => ({
    title,
    width,
    render: (_: any, __: any, i: number) => (
      <Input
        size="small"
        value={avaliacoes[i]?.[campo] ?? ''}
        onChange={(e) => mudar(i, campo, e.target.value)}
      />
    ),
  });
  const dataCol = (campo: string, title: string, width: number) => ({
    title,
    width,
    render: (_: any, __: any, i: number) => (
      <Input
        size="small"
        type="date"
        value={avaliacoes[i]?.[campo] ?? ''}
        onChange={(e) => mudar(i, campo, e.target.value)}
      />
    ),
  });
  const opcoes = (
    campo: string,
    title: string,
    width: number,
    options: { value: string; label: string }[],
  ) => ({
    title,
    width,
    render: (_: any, __: any, i: number) => (
      <Select
        size="small"
        style={{ width: '100%' }}
        allowClear
        options={options}
        value={avaliacoes[i]?.[campo] || undefined}
        onChange={(v) => mudar(i, campo, v ?? '')}
      />
    ),
  });

  async function salvar() {
    const v = form.getFieldsValue();
    if (v.status === 'CONCLUIDO' && !podeFechar) {
      message.error(
        `Ainda há ${pendentes.length} restauração(ões) em aberto. Conclua ou cancele cada uma antes de fechar o 5G.`,
      );
      return;
    }
    setSalvando(true);
    try {
      await api.patch(`/manufatura/5g/${id}`, { ...v, avaliacoes });
      message.success('5G salvo.');
      qc.invalidateQueries({ queryKey: ['manufatura-5g'] });
      qc.invalidateQueries({ queryKey: ['manufatura-doc'] });
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Não foi possível salvar o 5G.');
    } finally {
      setSalvando(false);
    }
  }

  async function aprovar() {
    try {
      await api.post(`/manufatura/5g/${id}/aprovar`);
      message.success('5G aprovado pela Qualidade.');
      qc.invalidateQueries({ queryKey: ['manufatura-5g'] });
      qc.invalidateQueries({ queryKey: ['manufatura-doc'] });
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Não foi possível aprovar.');
    }
  }

  return (
    <Form form={form} layout="vertical">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Card
          title={
            <Space wrap>
              <Typography.Title level={4} style={{ margin: 0 }}>
                Método 5G {data.numero}
              </Typography.Title>
              <Tag color={corStatus8D[data.status]}>
                {labelStatus8D[data.status] ?? data.status}
              </Tag>
              {data.inspecao && <Tag>{data.inspecao.numero}</Tag>}
              {data.cnq && <Tag>{data.cnq.numero}</Tag>}
            </Space>
          }
          extra={
            <Space wrap>
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate('/manufatura/8d')}
              >
                Voltar
              </Button>
              <Button
                icon={<SaveOutlined />}
                type="primary"
                loading={salvando}
                onClick={salvar}
              >
                Salvar
              </Button>
              <Popconfirm
                title="Aprovar este 5G pela Qualidade?"
                okText="Aprovar"
                cancelText="Cancelar"
                onConfirm={aprovar}
              >
                <Button
                  icon={<CheckCircleOutlined />}
                  disabled={!!data.aprovadoEm || !podeFechar}
                >
                  {data.aprovadoEm ? 'Aprovado' : 'Aprovar'}
                </Button>
              </Popconfirm>
              <Button
                icon={<FilePdfOutlined />}
                onClick={() => abrirPdfEmNovaAba(`/manufatura/5g/${id}/pdf`)}
              >
                Exportar PDF
              </Button>
            </Space>
          }
        >
          {!podeFechar && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message={`${pendentes.length} restauração(ões) em aberto`}
              description="Enquanto houver restauração sem baixa, o 5G não pode ser concluído nem aprovado."
            />
          )}

          <Divider orientation="left" plain>
            Identificação
          </Divider>
          <Row gutter={12}>
            <Col xs={12} md={6}>
              <Form.Item name="dataAbertura" label="Data de início">
                <Input type="date" />
              </Form.Item>
            </Col>
            <Col xs={12} md={6}>
              <Form.Item name="status" label="Status">
                <Select
                  options={Object.entries(labelStatus8D).map(([value, label]) => ({
                    value,
                    label,
                    disabled: value === 'CONCLUIDO' && !podeFechar,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col xs={12} md={6}>
              <Form.Item name="origem" label="Origem">
                <Select options={ORIGENS_8D} />
              </Form.Item>
            </Col>
            <Col xs={12} md={6}>
              <Form.Item name="turno" label="Turno">
                <Select options={TURNOS_8D} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item name="departamento" label="Departamento">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="areaAplicacao" label="Área de aplicação">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col xs={24} md={10}>
              <Form.Item name="produtoItem" label="Produto / item">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={12} md={7}>
              <Form.Item name="codigoDesenho" label="Código / desenho">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={12} md={7}>
              <Form.Item name="local" label="Local">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item name="processoOperacao" label="Processo / operação">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="equipamento" label="Equipamento">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col xs={24} md={8}>
              <Form.Item name="responsavel" label="Coordenador">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={16}>
              <Form.Item name="equipe" label="Grupo de trabalho">
                <Input placeholder="Nomes dos integrantes, separados por vírgula" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card title="Problema investigado">
          <Form.Item name="descricaoProblema" label="Problema">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Card>

        <Card title="Método 5G — Avaliação das condições do processo">
          <Space wrap size={4} style={{ marginBottom: 12 }}>
            {CINCO_G.map((g) => (
              <Tag key={g.sigla} color="orange">
                <b>{g.sigla}</b> ({g.tema}): {g.acao}
              </Tag>
            ))}
          </Space>
          <Table
            size="small"
            rowKey={(_, i) => String(i)}
            dataSource={avaliacoes}
            pagination={false}
            scroll={{ x: 1650 }}
            columns={[
              {
                title: 'Nº',
                width: 40,
                render: (_: any, __: any, i: number) => i + 1,
              },
              fixo('avaliacao', 'Avaliação', 175),
              fixo('analise4M', 'Análise 4M', 85),
              fixo('objetivo', 'Objetivo', 175),
              area('especificado', 'Especificado', 150),
              area('verificado', 'Verificado', 150),
              opcoes('necessitaRestauracao', 'Necessita restauração?', 110, SIM_NAO),
              area('comoRestaurar', 'Como fazer a restauração?', 190),
              texto('responsavel', 'Responsável', 130),
              dataCol('prazo', 'Prazo', 130),
              opcoes('status', 'Status', 130, SITUACOES_ACAO),
              opcoes('eficaz', 'Solução foi eficaz?', 110, SIM_NAO),
            ]}
          />
          <Typography.Text
            type="secondary"
            italic
            style={{ display: 'block', marginTop: 8 }}
          >
            * {NOTA_5G}
          </Typography.Text>
          <div style={{ marginTop: 12 }}>
            <QuadroFotos
              entidadeTipo={EVID_5G.evidencias}
              entidadeId={id}
              rotulo="Evidências do processo investigado"
            />
          </div>
        </Card>

        <Card title="Conclusão / Fechamento">
          <Row gutter={12}>
            <Col xs={24} md={6}>
              <Form.Item name="dataTermino" label="Data de término">
                <Input type="date" />
              </Form.Item>
            </Col>
            <Col xs={24} md={18}>
              <Form.Item
                name="verificacaoGerente"
                label="Verificação (gerente da área)"
              >
                <Input placeholder="Nome e data" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="conclusao" label="Conclusão">
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item label="Aprovação da Qualidade">
            <Typography.Text>
              {data.aprovadoPor
                ? `${data.aprovadoPor.nome} — ${dayjs(data.aprovadoEm).format('DD/MM/YYYY')}`
                : 'Pendente de aprovação'}
            </Typography.Text>
          </Form.Item>
        </Card>
      </Space>
    </Form>
  );
}
