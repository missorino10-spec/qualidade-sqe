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
  InputNumber,
  Popconfirm,
  Row,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  FilePdfOutlined,
  PlusOutlined,
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
  ESPINHAS_6M,
  EVID_8D,
  SITUACOES_ACAO,
  acoesPendentes,
  causasPotenciaisNormalizadas,
  planoAcaoNormalizado,
} from '../../oitod';
import { ORIGENS_8D, TURNOS_8D, corStatus8D, labelStatus8D } from './OitoD';
import Tabela from '../../components/Tabela';

// Analise de Problemas da Qualidade / 8D — Doc BDBR.QUA.FMR.007.01.
// A tela segue passo a passo a planilha "Analise de Problemas da Qualidade -
// Padrao": Passos 1 a 4 e o bloco de Conclusao / Fechamento. O Metodo 5G saiu
// daqui e virou documento proprio (tela /manufatura/5g/:id).

const CINCO_W_1H = [
  { chave: 'oQue', label: 'O quê?' },
  { chave: 'quando', label: 'Quando?' },
  { chave: 'onde', label: 'Onde?' },
  { chave: 'quem', label: 'Quem?' },
  { chave: 'qual', label: 'Qual?' },
  { chave: 'como', label: 'Como?' },
];

// ---------------------------------------------------------------------------
// Diagrama de espinha de peixe (6M + 1D)
// Mesmo desenho da planilha: espinha central apontando para o efeito, tres
// espinhas por cima e quatro por baixo, cada uma com a sua causa escrita.
// ---------------------------------------------------------------------------
const ANCORAS_CIMA = [260, 430, 600];
const ANCORAS_BAIXO = [200, 330, 460, 590];
const EIXO_Y = 170;
const TOPO_Y = 45;
const BASE_Y = 295;

// Quebra o texto da causa em linhas curtas para caber na cunha da espinha.
// Cada modo de falha digitado pelo usuario ocupa a sua propria linha: primeiro
// respeitamos as quebras de linha do campo e so depois quebramos por largura.
function quebrarTexto(texto: any, maxChars: number, maxLinhas: number) {
  const linhas: string[] = [];
  for (const bruta of String(texto ?? '').split(/\r?\n/)) {
    const palavras = bruta.trim().split(/\s+/).filter(Boolean);
    if (!palavras.length) continue;
    let atual = '';
    for (const p of palavras) {
      const teste = atual ? `${atual} ${p}` : p;
      if (teste.length <= maxChars) {
        atual = teste;
      } else {
        if (atual) linhas.push(atual);
        atual = p;
      }
    }
    if (atual) linhas.push(atual);
  }
  if (linhas.length <= maxLinhas) return linhas;
  const cortadas = linhas.slice(0, maxLinhas);
  cortadas[maxLinhas - 1] = `${cortadas[maxLinhas - 1]}…`;
  return cortadas;
}

function EspinhaDePeixe({
  efeito,
  causas,
}: {
  efeito?: string;
  causas: Record<string, any>;
}) {
  const cima = ESPINHAS_6M.filter((e) => e.lado === 'cima');
  const baixo = ESPINHAS_6M.filter((e) => e.lado === 'baixo');

  return (
    <svg
      viewBox="0 0 900 330"
      style={{ width: '100%', height: 'auto', background: '#FFFFFF' }}
    >
      {/* Espinha central */}
      <line x1={30} y1={EIXO_Y} x2={700} y2={EIXO_Y} stroke="#000" strokeWidth={3} />
      <polygon points="700,160 718,170 700,180" fill="#000" />

      {/* Caixa do efeito */}
      <rect x={720} y={132} width={172} height={76} rx={4} fill="#E8792B" />
      <text
        x={806}
        y={150}
        textAnchor="middle"
        fontSize={11}
        fontWeight="bold"
        fill="#FFFFFF"
      >
        EFEITO
      </text>
      {quebrarTexto(efeito, 24, 3).map((l, i) => (
        <text
          key={i}
          x={806}
          y={168 + i * 13}
          textAnchor="middle"
          fontSize={9.5}
          fill="#FFFFFF"
        >
          {l}
        </text>
      ))}

      {/* Espinhas de cima */}
      {cima.map((e, idx) => {
        const ancora = ANCORAS_CIMA[idx];
        const pontaX = ancora - 70;
        return (
          <g key={e.chave}>
            <line
              x1={ancora}
              y1={EIXO_Y}
              x2={pontaX}
              y2={TOPO_Y}
              stroke="#555"
              strokeWidth={1.6}
            />
            <rect
              x={pontaX - 54}
              y={TOPO_Y - 19}
              width={108}
              height={19}
              rx={3}
              fill="#E8792B"
            />
            <text
              x={pontaX}
              y={TOPO_Y - 5.5}
              textAnchor="middle"
              fontSize={10}
              fontWeight="bold"
              fill="#FFFFFF"
            >
              {e.label}
            </text>
            {quebrarTexto(causas?.[e.chave], 26, 6).map((l, i) => (
              <text
                key={i}
                x={pontaX + 14 + i * 6}
                y={TOPO_Y + 17 + i * 12}
                fontSize={8.5}
                fill="#333333"
              >
                {l}
              </text>
            ))}
          </g>
        );
      })}

      {/* Espinhas de baixo */}
      {baixo.map((e, idx) => {
        const ancora = ANCORAS_BAIXO[idx];
        const pontaX = ancora - 70;
        return (
          <g key={e.chave}>
            <line
              x1={ancora}
              y1={EIXO_Y}
              x2={pontaX}
              y2={BASE_Y}
              stroke="#555"
              strokeWidth={1.6}
            />
            <rect x={pontaX - 54} y={BASE_Y} width={108} height={19} rx={3} fill="#E8792B" />
            <text
              x={pontaX}
              y={BASE_Y + 13.5}
              textAnchor="middle"
              fontSize={10}
              fontWeight="bold"
              fill="#FFFFFF"
            >
              {e.label}
            </text>
            {quebrarTexto(causas?.[e.chave], 22, 6).map((l, i) => (
              <text
                key={i}
                x={pontaX + 58 - i * 6}
                y={200 + i * 12}
                fontSize={8.5}
                fill="#333333"
              >
                {l}
              </text>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Quadro de fotos do passo. Cada passo da planilha tem o seu proprio quadro de
// imagem (situacao atual, Pareto, resultados).
// ---------------------------------------------------------------------------
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
      (
        await api.get('/anexos', {
          params: { entidadeTipo, entidadeId },
        })
      ).data,
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
              message.error('Falha no envio da foto.');
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
          Nenhuma imagem anexada. (Até 4 entram no PDF.)
        </Typography.Text>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Colunas editaveis das tabelas dos passos 2 e 3.
// ---------------------------------------------------------------------------
function criarEditor(linhas: any[], setLinhas: (v: any[]) => void) {
  const mudar = (i: number, campo: string, valor: any) =>
    setLinhas(linhas.map((l, k) => (k === i ? { ...l, [campo]: valor } : l)));

  return {
    texto: (campo: string, title: string, width: number) => ({
      title,
      width,
      render: (_: any, __: any, i: number) => (
        <Input
          size="small"
          value={linhas[i]?.[campo] ?? ''}
          onChange={(e) => mudar(i, campo, e.target.value)}
        />
      ),
    }),
    area: (campo: string, title: string, width: number) => ({
      title,
      width,
      render: (_: any, __: any, i: number) => (
        <Input.TextArea
          size="small"
          autoSize={{ minRows: 1, maxRows: 5 }}
          value={linhas[i]?.[campo] ?? ''}
          onChange={(e) => mudar(i, campo, e.target.value)}
        />
      ),
    }),
    data: (campo: string, title: string, width: number) => ({
      title,
      width,
      render: (_: any, __: any, i: number) => (
        <Input
          size="small"
          type="date"
          value={linhas[i]?.[campo] ?? ''}
          onChange={(e) => mudar(i, campo, e.target.value)}
        />
      ),
    }),
    numero: (campo: string, title: string, width: number) => ({
      title,
      width,
      render: (_: any, __: any, i: number) => (
        <InputNumber
          size="small"
          style={{ width: '100%' }}
          min={0}
          precision={2}
          decimalSeparator=","
          value={linhas[i]?.[campo] ?? null}
          onChange={(v) => mudar(i, campo, v)}
        />
      ),
    }),
    opcoes: (
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
          value={linhas[i]?.[campo] || undefined}
          onChange={(v) => mudar(i, campo, v ?? '')}
        />
      ),
    }),
    fixo: (campo: string, title: string, width: number) => ({
      title,
      width,
      render: (_: any, r: any) => (
        <Typography.Text style={{ fontSize: 12 }}>{r?.[campo] ?? ''}</Typography.Text>
      ),
    }),
    remover: () => ({
      title: '',
      width: 44,
      render: (_: any, __: any, i: number) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => setLinhas(linhas.filter((_l, k) => k !== i))}
        />
      ),
    }),
  };
}

export default function OitoDDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form] = Form.useForm();
  const [causasPotenciais, setCausasPotenciais] = useState<any[]>([]);
  const [planoAcao, setPlanoAcao] = useState<any[]>([]);
  const [salvando, setSalvando] = useState(false);

  const efeito = Form.useWatch('efeito', form);
  const causas6M = Form.useWatch('causas6M', form);

  const { data, isLoading } = useQuery<any>({
    queryKey: ['manufatura-8d', id],
    queryFn: async () => (await api.get(`/manufatura/8d/${id}`)).data,
    enabled: !!id,
  });

  useEffect(() => {
    if (!data) return;
    form.setFieldsValue({
      ...data,
      dataAbertura: dataInput(data.dataAbertura),
      dataTermino: dataInput(data.dataTermino),
      descricao5W1H: data.descricao5W1H ?? {},
      causas6M: data.causas6M ?? {},
      padronizacao: data.padronizacao ?? {},
      verificacaoEficacia: {
        ...(data.verificacaoEficacia ?? {}),
        data: dataInput(data.verificacaoEficacia?.data),
      },
    });
    // Os 8D abertos antes desta tela abrem com o que ja foi preenchido: o
    // plano antigo e os 5 porques soltos sao traduzidos para o formato da
    // planilha na leitura, sem apagar nada.
    setCausasPotenciais(
      causasPotenciaisNormalizadas(
        data.causasPotenciais,
        data.porques,
        data.causaRaiz,
      ),
    );
    setPlanoAcao(planoAcaoNormalizado(data.planoAcao));
  }, [data, form]);

  if (isLoading || !data)
    return (
      <Card>
        <Spin />
      </Card>
    );

  const pendentes = acoesPendentes(planoAcao);
  const podeFechar = pendentes.length === 0;

  async function salvar() {
    const v = form.getFieldsValue();
    if (v.status === 'CONCLUIDO' && !podeFechar) {
      message.error(
        `Ainda há ${pendentes.length} ação(ões) em aberto. Conclua ou cancele cada uma antes de fechar o 8D.`,
      );
      return;
    }
    setSalvando(true);
    try {
      await api.patch(`/manufatura/8d/${id}`, {
        ...v,
        causasPotenciais,
        planoAcao,
      });
      message.success('8D salvo.');
      qc.invalidateQueries({ queryKey: ['manufatura-8d'] });
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Não foi possível salvar o 8D.');
    } finally {
      setSalvando(false);
    }
  }

  async function aprovar() {
    try {
      await api.post(`/manufatura/8d/${id}/aprovar`);
      message.success('8D aprovado pela Qualidade.');
      qc.invalidateQueries({ queryKey: ['manufatura-8d'] });
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Não foi possível aprovar.');
    }
  }

  // Excluir apaga o 8D inteiro. E o caminho para o documento aberto por
  // engano; o 8D valido fica no historico mesmo depois de aprovado.
  async function remover() {
    try {
      await api.delete(`/manufatura/8d/${id}`);
      message.success('8D excluído.');
      qc.invalidateQueries({ queryKey: ['manufatura-8d'] });
      navigate('/manufatura/8d');
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? 'Não foi possível excluir o 8D.');
    }
  }

  const edCausas = criarEditor(causasPotenciais, setCausasPotenciais);
  const edPlano = criarEditor(planoAcao, setPlanoAcao);

  return (
    <Form form={form} layout="vertical">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Card
          title={
            <Space wrap>
              <Typography.Title level={4} style={{ margin: 0 }}>
                Análise de Problemas {data.numero}
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
                title="Aprovar este 8D pela Qualidade?"
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
                onClick={() => abrirPdfEmNovaAba(`/manufatura/8d/${id}/pdf`)}
              >
                Exportar PDF
              </Button>
              <Popconfirm
                title="Excluir este 8D?"
                description="A exclusão é definitiva."
                okText="Excluir"
                cancelText="Cancelar"
                onConfirm={remover}
              >
                <Button danger icon={<DeleteOutlined />}>
                  Excluir
                </Button>
              </Popconfirm>
            </Space>
          }
        >
          {!podeFechar && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message={`${pendentes.length} ação(ões) em aberto`}
              description="Enquanto houver ação pendente no plano de ação, o 8D não pode ser concluído nem aprovado."
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
              <Form.Item name="produtoItem" label="Produto / Item">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={12} md={7}>
              <Form.Item name="codigoDesenho" label="Código / Desenho">
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
            <Col xs={24} md={9}>
              <Form.Item name="processoOperacao" label="Processo / Operação">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={12} md={9}>
              <Form.Item name="equipamento" label="Equipamento">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={12} md={6}>
              <Form.Item name="qtdAfetada" label="Qtd. afetada">
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

        <Card title="Passo 1 — Problema">
          <Form.Item name="descricaoProblema" label="Problema">
            <Input.TextArea rows={3} />
          </Form.Item>

          <Divider orientation="left" plain>
            1.1 — Objetivos
          </Divider>
          <Form.Item
            name="objetivos"
            label="Objetivo (SMART, medido contra a perda causal)"
          >
            <Input.TextArea rows={2} />
          </Form.Item>
          <Row gutter={12}>
            <Col xs={24} md={16}>
              <Form.Item name="perdaAtacada" label="Perda atacada">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="perdaValorAno" label="Valor da perda (R$/ano)">
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={2}
                  decimalSeparator=","
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" plain>
            1.2 — Descrição do problema (5W 1H)
          </Divider>
          <Row gutter={12}>
            {CINCO_W_1H.map((c) => (
              <Col xs={24} md={8} key={c.chave}>
                <Form.Item name={['descricao5W1H', c.chave]} label={c.label}>
                  <Input.TextArea autoSize={{ minRows: 2, maxRows: 5 }} />
                </Form.Item>
              </Col>
            ))}
          </Row>

          <Divider orientation="left" plain>
            1.3 — Situação atual
          </Divider>
          <Form.Item
            name="situacaoAtual"
            label="Mapa de processo/produto, fluxo, desenho do fenômeno"
          >
            <Input.TextArea rows={3} />
          </Form.Item>
          <QuadroFotos
            entidadeTipo={EVID_8D.situacaoAtual}
            entidadeId={id}
            rotulo="Imagens da situação atual"
          />

          <Divider orientation="left" plain>
            1.4 — Estratificação (Pareto)
          </Divider>
          <Form.Item name="estratificacao" label="Estratificação">
            <Input.TextArea rows={3} />
          </Form.Item>
          <QuadroFotos
            entidadeTipo={EVID_8D.estratificacao}
            entidadeId={id}
            rotulo="Gráfico de Pareto"
          />
        </Card>

        <Card title="Passo 2 — Análise de causa raiz (6M + 1D)">
          <Form.Item name="efeito" label="Efeito (problema no fim da espinha)">
            <Input />
          </Form.Item>
          <div
            style={{
              border: '1px solid #f0f0f0',
              borderRadius: 8,
              padding: 8,
              marginBottom: 16,
            }}
          >
            <EspinhaDePeixe efeito={efeito} causas={causas6M ?? {}} />
          </div>
          <Row gutter={12}>
            {ESPINHAS_6M.map((e) => (
              <Col xs={24} md={12} lg={8} key={e.chave}>
                <Form.Item name={['causas6M', e.chave]} label={e.label}>
                  <Input.TextArea autoSize={{ minRows: 2, maxRows: 6 }} />
                </Form.Item>
              </Col>
            ))}
          </Row>

          <Divider orientation="left" plain>
            Causas potenciais × 5 Porquês
          </Divider>
          <Button
            size="small"
            icon={<PlusOutlined />}
            style={{ marginBottom: 12 }}
            onClick={() =>
              setCausasPotenciais([
                ...causasPotenciais,
                {
                  causa: '',
                  porque1: '',
                  porque2: '',
                  porque3: '',
                  porque4: '',
                  porque5: '',
                },
              ])
            }
          >
            Adicionar causa potencial
          </Button>
          <Tabela
            size="small"
            rowKey={(_, i) => String(i)}
            dataSource={causasPotenciais}
            pagination={false}
            scroll={{ x: 1200 }}
            locale={{ emptyText: 'Nenhuma causa potencial registrada' }}
            columns={[
              edCausas.area('causa', 'Causa potencial', 220),
              edCausas.area('porque1', 'Porquê 1', 165),
              edCausas.area('porque2', 'Porquê 2', 165),
              edCausas.area('porque3', 'Porquê 3', 165),
              edCausas.area('porque4', 'Porquê 4', 165),
              edCausas.area('porque5', 'Porquê 5', 165),
              edCausas.remover(),
            ]}
          />

          <Form.Item
            name="causaRaiz"
            label="Causa raiz confirmada"
            style={{ marginTop: 16 }}
          >
            <Input.TextArea rows={3} />
          </Form.Item>
        </Card>

        <Card
          title="Passo 3 — Plano de ação"
          extra={
            <Button
              size="small"
              icon={<PlusOutlined />}
              onClick={() =>
                setPlanoAcao([
                  ...planoAcao,
                  {
                    oQue: '',
                    porQue: '',
                    como: '',
                    quem: '',
                    quando: '',
                    custo: null,
                    situacao: 'PENDENTE',
                  },
                ])
              }
            >
              Adicionar ação
            </Button>
          }
        >
          <Tabela
            size="small"
            rowKey={(_, i) => String(i)}
            dataSource={planoAcao}
            pagination={false}
            scroll={{ x: 1250 }}
            locale={{ emptyText: 'Nenhuma ação registrada' }}
            columns={[
              edPlano.area('oQue', 'O quê? (ação corretiva)', 230),
              edPlano.area('porQue', 'Por quê? (causa)', 190),
              edPlano.area('como', 'Como? (como fazer)', 210),
              edPlano.texto('quem', 'Quem?', 130),
              edPlano.data('quando', 'Quando?', 135),
              edPlano.numero('custo', 'Quanto custa? (R$)', 120),
              edPlano.opcoes('situacao', 'Situação', 130, SITUACOES_ACAO),
              edPlano.remover(),
            ]}
          />

          <Divider orientation="left" plain>
            Padronização
          </Divider>
          <Row gutter={12}>
            <Col xs={24} md={8}>
              <Form.Item
                name={['padronizacao', 'documentos']}
                label="Documentos atualizados"
              >
                <Input.TextArea rows={2} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name={['padronizacao', 'treinamentos']}
                label="Treinamentos realizados"
              >
                <Input.TextArea rows={2} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name={['padronizacao', 'observacoes']} label="Observações">
                <Input.TextArea rows={2} />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card title="Passo 4 — Verificação dos resultados">
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="Monitorar o resultado por pelo menos 3 meses após a implantação das ações."
          />
          <Form.Item name="verificacaoResultados" label="Resultados observados">
            <Input.TextArea rows={4} />
          </Form.Item>
          <QuadroFotos
            entidadeTipo={EVID_8D.resultados}
            entidadeId={id}
            rotulo="Registro dos resultados (antes / depois)"
          />

          <Divider orientation="left" plain>
            Verificação da eficácia
          </Divider>
          <Row gutter={12}>
            <Col xs={24} md={8}>
              <Form.Item name={['verificacaoEficacia', 'criterio']} label="Critério">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name={['verificacaoEficacia', 'metodo']} label="Método">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name={['verificacaoEficacia', 'amostra']} label="Amostra">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col xs={24} md={8}>
              <Form.Item
                name={['verificacaoEficacia', 'resultadoEsperado']}
                label="Resultado esperado"
              >
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name={['verificacaoEficacia', 'resultadoObtido']}
                label="Resultado obtido"
              >
                <Input />
              </Form.Item>
            </Col>
            <Col xs={12} md={4}>
              <Form.Item name={['verificacaoEficacia', 'data']} label="Data">
                <Input type="date" />
              </Form.Item>
            </Col>
            <Col xs={12} md={4}>
              <Form.Item
                name={['verificacaoEficacia', 'eficaz']}
                label="Eficaz?"
                valuePropName="checked"
              >
                <Switch checkedChildren="Sim" unCheckedChildren="Não" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name={['verificacaoEficacia', 'responsavel']}
            label="Responsável pela verificação"
          >
            <Input />
          </Form.Item>
        </Card>

        <Card title="Conclusão / Fechamento">
          <Row gutter={12}>
            <Col xs={24} md={6}>
              <Form.Item name="dataTermino" label="Data de término">
                <Input type="date" />
              </Form.Item>
            </Col>
            <Col xs={24} md={18}>
              <Form.Item name="custosInvestimentos" label="Custos e investimentos">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item
                name="beneficiosGanhos"
                label="Benefícios e ganhos financeiros"
              >
                <Input.TextArea rows={3} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="resultadosIndices" label="Resultados (índices)">
                <Input.TextArea rows={3} />
              </Form.Item>
            </Col>
          </Row>
          <QuadroFotos
            entidadeTipo={EVID_8D.geral}
            entidadeId={id}
            rotulo="Outras evidências anexadas ao 8D"
          />
          <Row gutter={12} style={{ marginTop: 12 }}>
            <Col xs={24} md={8}>
              <Form.Item label="Aprovação da Qualidade">
                <Typography.Text>
                  {data.aprovadoPor
                    ? `${data.aprovadoPor.nome} — ${dayjs(data.aprovadoEm).format('DD/MM/YYYY')}`
                    : 'Pendente de aprovação'}
                </Typography.Text>
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              {/* Campo mantido para o PDF sair igual ao formulario em papel. */}
              <Form.Item name="aprovacaoProducao" label="Aprovação da Produção">
                <Input placeholder="Nome e data" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="verificacaoGerente"
                label="Verificação (gerente da área)"
              >
                <Input placeholder="Nome e data" />
              </Form.Item>
            </Col>
          </Row>
        </Card>
      </Space>
    </Form>
  );
}
