import { useState } from 'react';
import {
  Button,
  Card,
  Descriptions,
  Dropdown,
  Form,
  Modal,
  Popconfirm,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  EditOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useNavigate, useParams } from 'react-router-dom';
import { api, abrirPdfEmNovaAba } from '../../api';
import { dataBR } from '../../formatos';
import { CotasPorDesenho } from '../../components/TabelaCotas';
import {
  FotosEvidenciaSalvas,
  enviarFotosEvidencia,
} from '../../components/FotosEvidencia';
import {
  DesenhoExtra,
  EVID,
  desenhosExtras,
  textoDesenho,
  textoRevisao,
} from '../../inspecao';
import {
  CamposRelatorio,
  ORIGENS_INSPECAO,
  corResultadoManufatura,
  corStatusInspecao,
  cotaVazia,
  labelResultadoManufatura,
  labelStatusInspecao,
} from './FormularioDimensional';
import Tabela from '../../components/Tabela';
import NomeAssinatura from '../../components/NomeAssinatura';

// Detalhe da inspecao da Manufatura: mostra TODAS as tentativas (1a inspecao e
// reinspecoes), cada uma com seu proprio numero, como sai no PDF do 011.06.

function labelOrigem(v: string, outros?: string) {
  if (v === 'OUTROS') return outros ? `Outros — ${outros}` : 'Outros';
  return ORIGENS_INSPECAO.find((o) => o.value === v)?.label ?? v ?? '-';
}

function Tentativa({
  rel,
  total,
  onCorrigir,
  onDescartar,
}: {
  rel: any;
  total: number;
  onCorrigir: (rel: any) => void;
  onDescartar: (rel: any) => void;
}) {
  const defeitos = Array.isArray(rel.defeitos) ? rel.defeitos : [];
  const titulo =
    rel.tentativa <= 1
      ? '1ª inspeção'
      : `Reinspeção ${rel.tentativa - 1}`;

  return (
    <Card
      title={
        <Space wrap>
          <span>{titulo}</span>
          <Typography.Text type="secondary" style={{ fontWeight: 400 }}>
            {rel.numero} — Doc. BDBR.QUA.FMR.011.06
          </Typography.Text>
          {/* Rascunho ainda nao tem veredito: o resultado gravado e so o valor
              padrao do banco, e mostra-lo aqui seria mentir. */}
          {rel.rascunho ? (
            <Tag color="orange">Rascunho</Tag>
          ) : (
            <Tag color={corResultadoManufatura[rel.resultado]}>
              {labelResultadoManufatura[rel.resultado] ?? rel.resultado}
            </Tag>
          )}
          {total > 1 && <Tag>{`${rel.tentativa} de ${total}`}</Tag>}
        </Space>
      }
      // Correcao do que foi digitado errado neste relatorio. Nao e reinspecao:
      // e o mesmo documento, com o mesmo numero. Enquanto e rascunho, o mesmo
      // botao continua o preenchimento - e da para jogar fora o que ficou pela
      // metade, coisa que um relatorio ja lancado nao permite.
      extra={
        <Space>
          {rel.rascunho && (
            <Button danger icon={<DeleteOutlined />} onClick={() => onDescartar(rel)}>
              Descartar rascunho
            </Button>
          )}
          <Button icon={<EditOutlined />} onClick={() => onCorrigir(rel)}>
            {rel.rascunho ? 'Continuar rascunho' : 'Corrigir'}
          </Button>
        </Space>
      }
    >
      <Descriptions size="small" bordered column={{ xs: 1, sm: 2, md: 2, lg: 3, xl: 3, xxl: 3 }} style={{ marginBottom: 12 }}>
        <Descriptions.Item label="Data">
          {dataBR(rel.dataInspecao)}
        </Descriptions.Item>
        <Descriptions.Item label="Rev. do relatório">
          {rel.revisao ?? '-'}
        </Descriptions.Item>
        <Descriptions.Item label="Inspetor">
          <NomeAssinatura nome={rel.inspetor?.nome} />
        </Descriptions.Item>
        <Descriptions.Item label="Nº do item">
          {rel.itemCodigo ?? '-'}
        </Descriptions.Item>
        <Descriptions.Item label="Descrição" span={2}>
          {rel.itemDescricao ?? '-'}
        </Descriptions.Item>
        <Descriptions.Item label="PO">{rel.po ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="Desenho">
          {textoDesenho(rel.desenho, rel.desenhoRev)}
        </Descriptions.Item>
        <Descriptions.Item label="Revisão">
          {textoRevisao(rel.desenhoRevisao)}
        </Descriptions.Item>
        <Descriptions.Item label="Origem">
          {labelOrigem(rel.origem, rel.origemOutros)}
        </Descriptions.Item>
        <Descriptions.Item label="Qtd. inspecionada">
          {rel.qtdInspecionada ?? '-'}
        </Descriptions.Item>
        <Descriptions.Item label="Qtd. total" span={2}>
          {rel.qtdTotal ?? '-'}
        </Descriptions.Item>
      </Descriptions>

      <CotasPorDesenho
        cotas={rel.cotas}
        desenhos={rel.desenhos}
        desenho={rel.desenho}
        revisao={rel.desenhoRevisao}
        legado={rel.desenhoRev}
      />

      <Card size="small" title="Evidências do dimensional" style={{ marginTop: 12 }}>
        <FotosEvidenciaSalvas
          entidadeTipo={EVID.manufaturaDimensional}
          entidadeId={rel.id}
        />
      </Card>
      {/* A inspecao visual virou documento proprio (SETV/PRODV) e saiu do
          formulario dimensional. Este bloco continua aqui so para os
          relatorios ANTIGOS, que gravaram o visual dentro do dimensional -
          sem ele, esse texto e essas fotos sumiriam da tela. */}
      {rel.inspecaoVisual && (
        <Card
          size="small"
          title="Inspeção visual (registro antigo)"
          style={{ marginTop: 12 }}
        >
          <Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>
            {rel.inspecaoVisual}
          </Typography.Paragraph>
          <FotosEvidenciaSalvas
            entidadeTipo={EVID.manufaturaVisual}
            entidadeId={rel.id}
          />
        </Card>
      )}

      {defeitos.length > 0 && (
        <Tabela
          style={{ marginTop: 12 }}
          size="small"
          rowKey={(_, i) => String(i)}
          dataSource={defeitos}
          pagination={false}
          scroll={{ x: 'max-content' }}
          columns={[
            { title: 'Descrição do defeito', dataIndex: 'nome' },
            { title: 'Quantidade', dataIndex: 'qtd', width: 130 },
          ]}
        />
      )}

      {rel.observacoesFinais && (
        <Card size="small" title="Observações finais" style={{ marginTop: 12 }}>
          <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
            {rel.observacoesFinais}
          </Typography.Paragraph>
        </Card>
      )}

      {rel.observacaoResultado && (
        <Card size="small" title="Observação do resultado" style={{ marginTop: 12 }}>
          <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
            {rel.observacaoResultado}
          </Typography.Paragraph>
        </Card>
      )}

      {rel.resultado === 'REPROVADO' && (
        <Descriptions size="small" bordered column={{ xs: 1, sm: 2, md: 2, lg: 2, xl: 2, xxl: 2 }} style={{ marginTop: 12 }}>
          <Descriptions.Item label="Qtd. afetada">
            {rel.qtdAfetada ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Descrição do desvio">
            {rel.descricaoDesvio ?? '-'}
          </Descriptions.Item>
        </Descriptions>
      )}

      <Descriptions size="small" bordered column={{ xs: 1, sm: 2, md: 2, lg: 2, xl: 2, xxl: 2 }} style={{ marginTop: 12 }}>
        <Descriptions.Item label="Elaborado por">
          {rel.inspetor?.nome ? (
            <NomeAssinatura nome={rel.inspetor.nome} />
          ) : (
            (rel.elaboradoPor ?? '-')
          )}
        </Descriptions.Item>
        <Descriptions.Item label="Inspecionado por">
          {rel.inspetor?.nome ? (
            <NomeAssinatura nome={rel.inspetor.nome} />
          ) : (
            (rel.inspecionadoPor ?? '-')
          )}
        </Descriptions.Item>
      </Descriptions>
    </Card>
  );
}

export default function InspecaoManufaturaDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const [cotas, setCotas] = useState<any[]>([]);
  // Peca de conjunto: desenhos do 2o em diante. O 1o e o do cabecalho.
  const [desenhos, setDesenhos] = useState<DesenhoExtra[]>([]);
  const [defeitos, setDefeitos] = useState<any[]>([]);
  const [fotosDimensional, setFotosDimensional] = useState<any[]>([]);
  const [salvando, setSalvando] = useState(false);
  // Relatorio que esta sendo corrigido. Null = o modal esta em reinspecao.
  const [edicao, setEdicao] = useState<any>(null);

  const { data, isLoading } = useQuery<any>({
    queryKey: ['manufatura-inspecao', id],
    queryFn: async () => (await api.get(`/manufatura/inspecoes/${id}`)).data,
    enabled: !!id,
  });

  const { data: maquinas } = useQuery<any[]>({
    queryKey: ['maquinas'],
    queryFn: async () => (await api.get('/maquinas')).data,
  });

  const { data: tipos } = useQuery<any[]>({
    queryKey: ['tipos-defeito'],
    queryFn: async () => (await api.get('/tipos-defeito')).data,
  });

  if (isLoading || !data)
    return (
      <Card>
        <Spin />
      </Card>
    );

  const relatorios: any[] = data.relatorios ?? [];
  const ultimo = relatorios[relatorios.length - 1];
  // Rascunho aberto segura a reinspecao: seriam duas tentativas em aberto na
  // mesma inspecao, sem veredito em nenhuma. O backend tambem barra.
  const temRascunho = relatorios.some((r) => r.rascunho);
  const podeReinspecionar =
    !temRascunho && ultimo?.resultado === 'REPROVADO';

  // A reinspecao repete o formulario inteiro, ja pre-carregado com o que foi
  // medido na tentativa anterior — so as medidas mudam.
  function abrirReinspecao() {
    form.resetFields();
    setEdicao(null);
    form.setFieldsValue({
      maquinaId: data.maquinaId,
      setupId: data.setupId ?? undefined,
      dataInspecao: dayjs().format('YYYY-MM-DD'),
      revisao: ultimo?.revisao ?? '01',
      origem: ultimo?.origem,
      origemOutros: ultimo?.origemOutros ?? undefined,
      itemCodigo: ultimo?.itemCodigo ?? undefined,
      itemDescricao: ultimo?.itemDescricao ?? undefined,
      desenho: ultimo?.desenho ?? ultimo?.desenhoRev ?? undefined,
      desenhoRevisao: ultimo?.desenhoRevisao ?? undefined,
      toleranciasNorm: ultimo?.toleranciasNorm ?? 'ISO2768',
      po: ultimo?.po ?? undefined,
      qtdInspecionada: ultimo?.qtdInspecionada ?? 3,
      qtdTotal: ultimo?.qtdTotal ?? undefined,
      resultado: 'APROVADO',
    });
    // Repete as cotas da tentativa anterior, mas sem as medidas: o que muda na
    // reinspecao e justamente o que foi encontrado.
    const anteriores = Array.isArray(ultimo?.cotas) ? ultimo.cotas : [];
    setCotas(
      anteriores.length
        ? anteriores.map((c: any) => ({
            ...c,
            encontradoMax: '',
            encontradoMin: '',
            desvioMin: '',
            desvioMax: '',
            conformeAuto: null,
            conformeManual: null,
            conforme: null,
          }))
        : [cotaVazia()],
    );
    // A reinspecao mede a mesma peca, entao herda os mesmos desenhos.
    setDesenhos(desenhosExtras(ultimo?.desenhos));
    setDefeitos([]);
    setFotosDimensional([]);
    setOpen(true);
  }

  // Correcao: o mesmo relatorio reaberto com tudo o que foi lancado, inclusive
  // as medidas. O numero e a tentativa nao mudam - so o conteudo.
  function abrirCorrecao(rel: any) {
    form.resetFields();
    setEdicao(rel);
    form.setFieldsValue({
      maquinaId: data.maquinaId,
      setupId: data.setupId ?? undefined,
      dataInspecao: dayjs(rel.dataInspecao).format('YYYY-MM-DD'),
      revisao: rel.revisao ?? '01',
      origem: rel.origem,
      origemOutros: rel.origemOutros ?? undefined,
      itemCodigo: rel.itemCodigo ?? undefined,
      itemDescricao: rel.itemDescricao ?? undefined,
      desenho: rel.desenho ?? rel.desenhoRev ?? undefined,
      desenhoRevisao: rel.desenhoRevisao ?? undefined,
      toleranciasNorm: rel.toleranciasNorm ?? 'ISO2768',
      po: rel.po ?? undefined,
      qtdInspecionada: rel.qtdInspecionada ?? undefined,
      qtdTotal: rel.qtdTotal ?? undefined,
      observacoesFinais: rel.observacoesFinais ?? undefined,
      resultado: rel.resultado,
      observacaoResultado: rel.observacaoResultado ?? undefined,
      qtdAfetada: rel.qtdAfetada ?? undefined,
      descricaoDesvio: rel.descricaoDesvio ?? undefined,
    });
    setCotas(Array.isArray(rel.cotas) && rel.cotas.length ? rel.cotas : [cotaVazia()]);
    setDesenhos(desenhosExtras(rel.desenhos));
    setDefeitos(Array.isArray(rel.defeitos) ? rel.defeitos : []);
    setFotosDimensional([]);
    setOpen(true);
  }

  // Rascunho so precisa da maquina; e sem a marca "rascunho" o PATCH LANCA o
  // relatorio, que so entao conta na maquina e nos indicadores.
  async function salvarCorrecao(rascunho = false) {
    const v = rascunho
      ? (await form.validateFields(['maquinaId']), form.getFieldsValue(true))
      : await form.validateFields();
    setSalvando(true);
    try {
      const res = await api.patch(
        `/manufatura/inspecoes/${id}/relatorio/${edicao.id}`,
        {
          ...v,
          cotas,
          desenhos,
          defeitos: defeitos.filter((d) => d.tipoDefeitoId),
          rascunho: rascunho || undefined,
        },
      );
      if (fotosDimensional.length)
        await enviarFotosEvidencia(
          fotosDimensional,
          EVID.manufaturaDimensional,
          edicao.id,
        );
      message.success(
        rascunho
          ? `Rascunho do relatório ${edicao.numero} salvo. Ele não conta nos indicadores até ser lançado.`
          : edicao.rascunho
            ? `Relatório ${res.data.numero ?? edicao.numero} lançado.`
            : `Relatório ${res.data.numero ?? edicao.numero} corrigido.`,
      );
      qc.invalidateQueries({ queryKey: ['manufatura-inspecao', id] });
      qc.invalidateQueries({ queryKey: ['manufatura-inspecoes'] });
      qc.invalidateQueries({ queryKey: ['maquinas'] });
      setOpen(false);
      setEdicao(null);
    } catch (e: any) {
      message.error(
        e?.response?.data?.message ?? 'Não foi possível salvar a correção.',
      );
    } finally {
      setSalvando(false);
    }
  }

  async function salvarReinspecao(rascunho = false) {
    const v = rascunho
      ? (await form.validateFields(['maquinaId']), form.getFieldsValue(true))
      : await form.validateFields();
    setSalvando(true);
    try {
      const res = await api.post(`/manufatura/inspecoes/${id}/reinspecao`, {
        ...v,
        cotas,
        desenhos,
        defeitos: defeitos.filter((d) => d.tipoDefeitoId),
        rascunho: rascunho || undefined,
      });
      // A evidencia e da tentativa, entao vai no relatorio recem-criado.
      const novos = res.data.relatorios ?? [];
      const relatorioId = novos[novos.length - 1]?.id;
      if (relatorioId && fotosDimensional.length)
        await enviarFotosEvidencia(
          fotosDimensional,
          EVID.manufaturaDimensional,
          relatorioId,
        );
      message.success(
        rascunho
          ? `Rascunho da reinspeção ${res.data.numero} salvo. Ele não conta nos indicadores até ser lançado.`
          : `Reinspeção ${res.data.numero} registrada.`,
      );
      qc.invalidateQueries({ queryKey: ['manufatura-inspecao', id] });
      qc.invalidateQueries({ queryKey: ['manufatura-inspecoes'] });
      qc.invalidateQueries({ queryKey: ['maquinas'] });
      setOpen(false);
    } catch (e: any) {
      message.error(
        e?.response?.data?.message ?? 'Não foi possível salvar a reinspeção.',
      );
    } finally {
      setSalvando(false);
    }
  }

  const rotaLista =
    data.tipo === 'SETUP'
      ? '/manufatura/inspecoes/setup'
      : '/manufatura/inspecoes/producao';

  // Descartar rascunho nao e exclusao: o rascunho nunca contou na maquina nem
  // nos indicadores, entao nao ha nada a desfazer. Se era o unico relatorio, a
  // inspecao inteira vai junto e a tela volta para a lista.
  function descartarRascunho(rel: any) {
    Modal.confirm({
      title: `Descartar o rascunho ${rel.numero}?`,
      icon: <DeleteOutlined style={{ color: '#cf1322' }} />,
      content:
        'O que foi preenchido será perdido. Como o rascunho nunca foi lançado, nada muda nos indicadores nem nos contadores da máquina.',
      okText: 'Descartar',
      okButtonProps: { danger: true },
      cancelText: 'Cancelar',
      onOk: async () => {
        try {
          const res = await api.delete(
            `/manufatura/inspecoes/${id}/relatorio/${rel.id}/rascunho`,
          );
          message.success('Rascunho descartado.');
          qc.invalidateQueries({ queryKey: ['manufatura-inspecoes'] });
          if (res.data?.inspecaoRemovida) navigate(rotaLista);
          else qc.invalidateQueries({ queryKey: ['manufatura-inspecao', id] });
        } catch (e: any) {
          message.error(
            e?.response?.data?.message ??
              'Não foi possível descartar o rascunho.',
          );
        }
      },
    });
  }

  // Excluir apaga a inspecao inteira, com as reinspecoes. E o caminho para o
  // lancamento errado; a inspecao valida fica no historico.
  async function remover() {
    try {
      await api.delete(`/manufatura/inspecoes/${id}`);
      message.success('Inspeção excluída.');
      qc.invalidateQueries({ queryKey: ['manufatura-inspecoes'] });
      navigate(rotaLista);
    } catch (e: any) {
      message.error(
        e?.response?.data?.message ?? 'Não foi possível excluir a inspeção.',
      );
    }
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card
        title={
          <Space wrap>
            <Typography.Title level={4} style={{ margin: 0 }}>
              {data.tipo === 'SETUP' ? 'Inspeção de setup' : 'Inspeção de produção'}{' '}
              {data.numero}
            </Typography.Title>
            <Tag color={corStatusInspecao[data.status]}>
              {labelStatusInspecao[data.status] ?? data.status}
            </Tag>
          </Space>
        }
        extra={
          <Space wrap>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(rotaLista)}>
              Voltar
            </Button>
            {podeReinspecionar && (
              <Button
                type="primary"
                danger
                icon={<ReloadOutlined />}
                onClick={abrirReinspecao}
              >
                Nova reinspeção
              </Button>
            )}
            {/* Nem toda reprovacao vira 8D: a maioria e resolvida com o 5G. */}
            <Dropdown
              trigger={['click']}
              menu={{
                items: [
                  { key: '8D', label: 'Abrir 8D a partir desta inspeção' },
                  { key: '5G', label: 'Abrir 5G a partir desta inspeção' },
                ],
                onClick: ({ key }) =>
                  navigate(`/manufatura/8d?inspecaoId=${data.id}&tipo=${key}`),
              }}
            >
              <Button icon={<FileTextOutlined />}>Abrir 8D / 5G</Button>
            </Dropdown>
            <Popconfirm
              title="Excluir esta inspeção?"
              description="As reinspeções também serão excluídas."
              okText="Excluir"
              cancelText="Cancelar"
              onConfirm={remover}
            >
              <Button danger icon={<DeleteOutlined />}>
                Excluir
              </Button>
            </Popconfirm>
            <Button
              type="primary"
              icon={<FilePdfOutlined />}
              onClick={() => abrirPdfEmNovaAba(`/manufatura/inspecoes/${id}/pdf`)}
            >
              Exportar PDF
            </Button>
          </Space>
        }
      >
        <Descriptions size="small" bordered column={{ xs: 1, sm: 2, md: 2, lg: 3, xl: 3, xxl: 3 }}>
          <Descriptions.Item label="Máquina" span={2}>
            {data.maquina
              ? `${data.maquina.codigo} — ${data.maquina.nome}`
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Data">
            {dataBR(data.dataInspecao)}
          </Descriptions.Item>
          <Descriptions.Item label="Item" span={2}>
            {[data.itemCodigo, data.itemDescricao].filter(Boolean).join(' — ') ||
              '-'}
          </Descriptions.Item>
          <Descriptions.Item label="PO">{data.po ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="Semana">
            {data.semana ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Inspetor">
            <NomeAssinatura nome={data.inspetor?.nome} />
          </Descriptions.Item>
          <Descriptions.Item label="Tentativas">
            {relatorios.length}
          </Descriptions.Item>
          <Descriptions.Item label="Setup vinculado">
            {data.setup ? (
              <Button
                size="small"
                type="link"
                onClick={() => navigate(`/manufatura/inspecoes/${data.setup.id}`)}
              >
                {data.setup.numero}
              </Button>
            ) : (
              '-'
            )}
          </Descriptions.Item>
          <Descriptions.Item label="8D / 5G" span={2}>
            {data.oitoDs?.length || data.cincoGs?.length ? (
              <Space wrap>
                {(data.oitoDs ?? []).map((o: any) => (
                  <Button
                    key={`8d-${o.id}`}
                    size="small"
                    type="link"
                    onClick={() => navigate(`/manufatura/8d/${o.id}`)}
                  >
                    {o.numero}
                  </Button>
                ))}
                {(data.cincoGs ?? []).map((g: any) => (
                  <Button
                    key={`5g-${g.id}`}
                    size="small"
                    type="link"
                    onClick={() => navigate(`/manufatura/5g/${g.id}`)}
                  >
                    {g.numero}
                  </Button>
                ))}
              </Space>
            ) : (
              '-'
            )}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {relatorios.map((rel) => (
        <Tentativa
          key={rel.id}
          rel={rel}
          total={relatorios.length}
          onCorrigir={abrirCorrecao}
          onDescartar={descartarRascunho}
        />
      ))}

      <Modal
        open={open}
        title={
          edicao?.rascunho
            ? `Rascunho ${edicao.numero} — Doc. BDBR.QUA.FMR.011.06`
            : edicao
              ? `Corrigir ${edicao.numero} — Doc. BDBR.QUA.FMR.011.06`
              : `Reinspeção — ${data.numero} — Doc. BDBR.QUA.FMR.011.06`
        }
        width={1100}
        confirmLoading={salvando}
        onCancel={() => {
          setOpen(false);
          setEdicao(null);
        }}
        destroyOnClose
        /* Rodape na mao por causa do "Salvar rascunho". Relatorio JA LANCADO
           nao volta a rascunho: o documento ja vale, e desfazer isso mexeria
           nos indicadores para tras. */
        footer={[
          <Button
            key="cancelar"
            onClick={() => {
              setOpen(false);
              setEdicao(null);
            }}
          >
            Cancelar
          </Button>,
          !edicao || edicao.rascunho ? (
            <Button
              key="rascunho"
              loading={salvando}
              onClick={() =>
                edicao ? salvarCorrecao(true) : salvarReinspecao(true)
              }
            >
              Salvar rascunho
            </Button>
          ) : null,
          <Button
            key="ok"
            type="primary"
            loading={salvando}
            onClick={() => (edicao ? salvarCorrecao() : salvarReinspecao())}
          >
            {edicao?.rascunho
              ? 'Lançar relatório'
              : edicao
                ? 'Salvar correção'
                : 'Salvar reinspeção'}
          </Button>,
        ]}
      >
        <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
          {edicao?.rascunho
            ? 'Rascunho: enquanto não for lançado, este relatório não conta nos contadores da máquina nem nos indicadores.'
            : edicao
              ? 'Este é o mesmo relatório, não uma reinspeção: o número e a tentativa não mudam. Tudo pode ser corrigido, inclusive o resultado.'
              : 'Novo relatório completo, com número próprio, dentro da mesma inspeção. Os campos vieram da tentativa anterior; preencha as medidas novamente.'}
        </Typography.Paragraph>
        <Form form={form} layout="vertical">
          <CamposRelatorio
            form={form}
            maquinas={maquinas}
            tipos={tipos}
            cotas={cotas}
            setCotas={setCotas}
            desenhos={desenhos}
            setDesenhos={setDesenhos}
            defeitos={defeitos}
            setDefeitos={setDefeitos}
            tipo={data.tipo}
            fotosDimensional={fotosDimensional}
            setFotosDimensional={setFotosDimensional}
            maquinaFixa
          />
        </Form>
      </Modal>
    </Space>
  );
}
