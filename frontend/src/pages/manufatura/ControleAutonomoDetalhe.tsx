import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  Radio,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Tag,
  Typography,
  message,
} from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { CabecalhoDetalhe } from '../../design/painel';
import { BotaoPdf } from '../../design/acoes';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useNavigate, useParams } from 'react-router-dom';
import { abrirPdfEmNovaAba, api } from '../../api';
import { dataInput, numeroBR } from '../../formatos';
import AssinaturaDoLogin from '../../components/AssinaturaDoLogin';
import { SelectItem } from '../../components/CamposItem';
import {
  UploadFotosEvidencia,
  FotosEvidenciaSalvas,
  enviarFotosEvidencia,
} from '../../components/FotosEvidencia';
import {
  classificarIcaq,
  corClassificacaoIcaq,
  FOTO_ICAQ,
  labelClassificacaoIcaq,
  notaIcaq,
  pontosDaLinha,
  TURNOS_ICAQ,
  VerificacaoIcaq,
} from '../../icaq';
import { COR } from '../../design/tokens';

// ICAQ — Auditoria do Controle Autonomo da Qualidade.
// A auditoria e lancada e fechada de uma vez: o cabecalho e as dez linhas do
// checklist vao juntos num unico salvamento. A nota e a classificacao aparecem
// enquanto o auditor marca as linhas, com a mesma conta que o servidor faz.
//
// As fotos de evidencia sao da auditoria inteira, num espaco unico no fim da
// tela, e so podem subir depois: elas se prendem ao id da auditoria, que so
// existe quando ela e gravada.

type Resposta = { resultado?: string; evidencia?: string; responsavel?: string };

export default function ControleAutonomoDetalhe() {
  const { id } = useParams();
  const novo = id === 'nova';
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form] = Form.useForm();
  const [salvando, setSalvando] = useState(false);
  const [respostas, setRespostas] = useState<Record<number, Resposta>>({});
  // Fotos escolhidas antes de gravar. Ficam retidas aqui porque o anexo precisa
  // do id da auditoria, que so existe depois do POST.
  const [fotos, setFotos] = useState<any[]>([]);

  const { data: modelo } = useQuery<VerificacaoIcaq[]>({
    queryKey: ['icaq-modelo'],
    queryFn: async () =>
      (await api.get('/manufatura/controle-autonomo/modelo')).data,
  });

  const { data: maquinas } = useQuery<any[]>({
    queryKey: ['maquinas'],
    queryFn: async () => (await api.get('/maquinas')).data,
  });

  const { data: reg, isLoading } = useQuery<any>({
    queryKey: ['icaq', 'detalhe', id],
    enabled: !novo,
    queryFn: async () =>
      (await api.get(`/manufatura/controle-autonomo/${id}`)).data,
  });

  // Abre com o cabecalho do dia e o checklist em branco, ou com o que ja foi
  // gravado quando a auditoria e aberta para conferencia/correcao.
  useEffect(() => {
    if (novo) {
      form.setFieldsValue({
        dataAuditoria: dayjs().format('YYYY-MM-DD'),
        turno: 'COMERCIAL',
      });
      return;
    }
    if (!reg) return;
    form.setFieldsValue({
      dataAuditoria: dataInput(reg.dataAuditoria),
      turno: reg.turno,
      maquinaId: reg.maquinaId,
      itemId: reg.itemId ?? undefined,
      ordemLote: reg.ordemLote ?? '',
      operador: reg.operador ?? '',
      observacoesIniciais: reg.observacoesIniciais ?? '',
    });
    const carregadas: Record<number, Resposta> = {};
    for (const i of reg.itens ?? []) {
      carregadas[i.numero] = {
        resultado: i.resultado,
        evidencia: i.evidencia ?? '',
        responsavel: i.responsavel ?? '',
      };
    }
    setRespostas(carregadas);
  }, [novo, reg, form]);

  const linhas = modelo ?? [];
  const nota = useMemo(() => notaIcaq(linhas, respostas), [linhas, respostas]);
  const classificacao = classificarIcaq(nota);
  const marcadas = linhas.filter((v) => respostas[v.numero]?.resultado).length;
  const completo = linhas.length > 0 && marcadas === linhas.length;

  function responder(numero: number, campo: keyof Resposta, valor: string) {
    setRespostas((atual) => ({
      ...atual,
      [numero]: { ...atual[numero], [campo]: valor },
    }));
  }

  async function enviarFotosPendentes(registro: any) {
    if (!fotos.length) return;
    await enviarFotosEvidencia(fotos, FOTO_ICAQ, registro.id);
    setFotos([]);
  }

  async function salvar() {
    const v = await form.validateFields();
    if (!completo) {
      message.warning('Marque Conforme ou Não conforme em todas as linhas.');
      return;
    }
    const corpo = {
      ...v,
      itens: linhas.map((l) => ({ numero: l.numero, ...respostas[l.numero] })),
    };
    setSalvando(true);
    try {
      const res = novo
        ? await api.post('/manufatura/controle-autonomo', corpo)
        : await api.patch(`/manufatura/controle-autonomo/${id}`, corpo);
      // Uma foto que falha nao desfaz a auditoria: ela pode ser anexada de novo
      // pela propria tela, ja com o registro gravado.
      await enviarFotosPendentes(res.data);
      message.success(`Auditoria ${res.data.numero} salva.`);
      qc.invalidateQueries({ queryKey: ['icaq'] });
      if (novo) navigate(`/manufatura/controle-autonomo/${res.data.id}`);
    } catch (e: any) {
      message.error(
        e?.response?.data?.message ?? 'Não foi possível salvar a auditoria.',
      );
    } finally {
      setSalvando(false);
    }
  }

  if (!novo && isLoading) return <Spin />;

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <CabecalhoDetalhe
        voltar={() => navigate('/manufatura/controle-autonomo')}
        titulo={novo ? 'Nova auditoria ICAQ' : `ICAQ ${reg?.numero ?? ''}`}
        acoes={
          <>
            {!novo && (
              <BotaoPdf
                onClick={() =>
                  abrirPdfEmNovaAba(`/manufatura/controle-autonomo/${id}/pdf`)
                }
              />
            )}
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={salvando}
              onClick={salvar}
            >
              {novo ? 'Lançar auditoria' : 'Salvar'}
            </Button>
          </>
        }
      />

      <Card title="Identificação">
        <AssinaturaDoLogin rotulo="Auditor da Qualidade" />
        <Form form={form} layout="vertical">
          <Row gutter={12}>
            <Col xs={24} sm={8} lg={5}>
              <Form.Item
                name="dataAuditoria"
                label="Data da auditoria"
                rules={[{ required: true, message: 'Informe a data.' }]}
              >
                <Input type="date" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8} lg={5}>
              <Form.Item name="turno" label="Turno">
                <Select options={TURNOS_ICAQ} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8} lg={14}>
              <Form.Item
                name="maquinaId"
                label="Equipamento"
                rules={[{ required: true, message: 'Informe o equipamento.' }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder="Escolha o equipamento"
                  options={(maquinas ?? []).map((m) => ({
                    value: m.id,
                    label: `${m.codigo} — ${m.nome}`,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col xs={24} lg={10}>
              <Form.Item name="itemId" label="Produto / código">
                <SelectItem
                  allowClear
                  atual={
                    reg?.item
                      ? {
                          value: reg.item.id,
                          label: `${reg.item.codigo} — ${reg.item.descricao}`,
                        }
                      : undefined
                  }
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Form.Item name="ordemLote" label="Ordem / lote">
                <Input maxLength={60} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} lg={8}>
              <Form.Item
                name="operador"
                label="Operador auditado"
                rules={[{ required: true, message: 'Informe o operador.' }]}
              >
                <Input maxLength={120} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="observacoesIniciais" label="Observações iniciais">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Nota final"
              value={nota}
              precision={2}
              suffix="%"
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Typography.Text type="secondary">Classificação</Typography.Text>
            <div style={{ marginTop: 8 }}>
              <Tag
                color={corClassificacaoIcaq[classificacao]}
                style={{ fontSize: 16, padding: '4px 12px' }}
              >
                {labelClassificacaoIcaq[classificacao]}
              </Tag>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Linhas respondidas"
              value={marcadas}
              suffix={`/ ${linhas.length}`}
              valueStyle={completo ? { color: COR.sucesso } : undefined}
            />
          </Card>
        </Col>
      </Row>

      <Card title="Checklist ponderado">
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Cada dimensão recebe sua nota proporcional ao peso: Execução 50% | Confiabilidade 25% | Preenchimento 15% | Reação 10%."
          description="90% a 100%: Conforme | 80% a 89,99%: Atenção | Abaixo de 80%: Não conforme. O peso da dimensão é dividido igualmente entre as verificações dela."
        />
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {linhas.map((l) => {
            const r = respostas[l.numero] ?? {};
            const pontos = pontosDaLinha(linhas, l.dimensao, r.resultado);
            return (
              <Card
                key={l.numero}
                size="small"
                title={
                  <Space wrap>
                    <strong>{l.numero}.</strong>
                    <span>{l.verificacao}</span>
                    <Tag>{l.dimensao}</Tag>
                    <Tag color="blue">
                      Peso {numeroBR(l.peso * 100)}% · vale{' '}
                      {numeroBR(
                        pontosDaLinha(linhas, l.dimensao, 'CONFORME') * 100,
                        2,
                      )}{' '}
                      pts
                    </Tag>
                  </Space>
                }
                extra={
                  <Tag color={r.resultado === 'CONFORME' ? 'green' : undefined}>
                    {numeroBR(pontos * 100, 2)} pts
                  </Tag>
                }
              >
                <Row gutter={[12, 12]}>
                  <Col xs={24} lg={6}>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      Resultado
                    </Typography.Text>
                    <div>
                      <Radio.Group
                        value={r.resultado}
                        onChange={(e) =>
                          responder(l.numero, 'resultado', e.target.value)
                        }
                        optionType="button"
                        buttonStyle="solid"
                        options={[
                          { value: 'CONFORME', label: 'Conforme' },
                          { value: 'NAO_CONFORME', label: 'Não conforme' },
                        ]}
                      />
                    </div>
                  </Col>
                  <Col xs={24} lg={11}>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      Evidência / comentário
                    </Typography.Text>
                    <Input.TextArea
                      rows={2}
                      value={r.evidencia ?? ''}
                      onChange={(e) =>
                        responder(l.numero, 'evidencia', e.target.value)
                      }
                    />
                  </Col>
                  <Col xs={24} lg={7}>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      Responsável pela tratativa
                    </Typography.Text>
                    <Input
                      maxLength={120}
                      value={r.responsavel ?? ''}
                      onChange={(e) =>
                        responder(l.numero, 'responsavel', e.target.value)
                      }
                    />
                  </Col>
                </Row>
              </Card>
            );
          })}
        </Space>
      </Card>

      {/* Um espaco unico para as fotos da auditoria inteira, sempre opcional:
          o auditor fotografa o que precisar ao fechar a visita, sem ter que
          decidir a qual das dez linhas cada foto pertence. */}
      <Card title="Fotos de evidência (opcional)">
        {!novo && (
          <div style={{ marginBottom: 12 }}>
            <FotosEvidenciaSalvas entidadeTipo={FOTO_ICAQ} entidadeId={Number(id)} />
          </div>
        )}
        <UploadFotosEvidencia fotos={fotos} setFotos={setFotos} />
      </Card>

      {/* O mesmo botao do topo, repetido aqui: a auditoria termina na ultima
          pergunta e a inspetora fecha sem ter que rolar a tela de volta. */}
      <Row justify="end">
        <Button
          type="primary"
          size="large"
          icon={<SaveOutlined />}
          loading={salvando}
          onClick={salvar}
        >
          {novo ? 'Lançar auditoria' : 'Salvar'}
        </Button>
      </Row>
    </Space>
  );
}
