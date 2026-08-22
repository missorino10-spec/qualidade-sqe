import { useState } from 'react';
import {
  Button,
  Card,
  Descriptions,
  Dropdown,
  Form,
  Modal,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useNavigate, useParams } from 'react-router-dom';
import { api, abrirPdfEmNovaAba } from '../../api';
import { dataBR } from '../../formatos';
import { CotasSomenteLeitura } from '../../components/TabelaCotas';
import {
  FotosEvidenciaSalvas,
  enviarFotosEvidencia,
} from '../../components/FotosEvidencia';
import { EVID, textoDesenho, textoRevisao } from '../../inspecao';
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

// Detalhe da inspecao da Manufatura: mostra TODAS as tentativas (1a inspecao e
// reinspecoes), cada uma com seu proprio numero, como sai no PDF do 011.06.

function labelOrigem(v: string, outros?: string) {
  if (v === 'OUTROS') return outros ? `Outros — ${outros}` : 'Outros';
  return ORIGENS_INSPECAO.find((o) => o.value === v)?.label ?? v ?? '-';
}

function Tentativa({ rel, total }: { rel: any; total: number }) {
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
          <Tag color={corResultadoManufatura[rel.resultado]}>
            {labelResultadoManufatura[rel.resultado] ?? rel.resultado}
          </Tag>
          {total > 1 && <Tag>{`${rel.tentativa} de ${total}`}</Tag>}
        </Space>
      }
    >
      <Descriptions size="small" bordered column={{ xs: 1, sm: 2, md: 2, lg: 3 }} style={{ marginBottom: 12 }}>
        <Descriptions.Item label="Data">
          {dataBR(rel.dataInspecao)}
        </Descriptions.Item>
        <Descriptions.Item label="Rev. do relatório">
          {rel.revisao ?? '-'}
        </Descriptions.Item>
        <Descriptions.Item label="Inspetor">
          {rel.inspetor?.nome ?? '-'}
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

      <CotasSomenteLeitura cotas={rel.cotas} />

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
        <Descriptions size="small" bordered column={{ xs: 1, sm: 2, md: 2, lg: 2 }} style={{ marginTop: 12 }}>
          <Descriptions.Item label="Qtd. afetada">
            {rel.qtdAfetada ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Descrição do desvio">
            {rel.descricaoDesvio ?? '-'}
          </Descriptions.Item>
        </Descriptions>
      )}

      <Descriptions size="small" bordered column={{ xs: 1, sm: 2, md: 2, lg: 2 }} style={{ marginTop: 12 }}>
        <Descriptions.Item label="Elaborado por">
          {rel.elaboradoPor ?? '-'}
        </Descriptions.Item>
        <Descriptions.Item label="Inspecionado por">
          {rel.inspecionadoPor ?? '-'}
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
  const [defeitos, setDefeitos] = useState<any[]>([]);
  const [fotosDimensional, setFotosDimensional] = useState<any[]>([]);
  const [salvando, setSalvando] = useState(false);

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
  const podeReinspecionar = ultimo?.resultado === 'REPROVADO';

  // A reinspecao repete o formulario inteiro, ja pre-carregado com o que foi
  // medido na tentativa anterior — so as medidas mudam.
  function abrirReinspecao() {
    form.resetFields();
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
    setDefeitos([]);
    setFotosDimensional([]);
    setOpen(true);
  }

  async function salvarReinspecao() {
    const v = await form.validateFields();
    setSalvando(true);
    try {
      const res = await api.post(`/manufatura/inspecoes/${id}/reinspecao`, {
        ...v,
        cotas,
        defeitos: defeitos.filter((d) => d.tipoDefeitoId),
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
      message.success(`Reinspeção ${res.data.numero} registrada.`);
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
        <Descriptions size="small" bordered column={{ xs: 1, sm: 2, md: 2, lg: 3 }}>
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
            {data.inspetor?.nome ?? '-'}
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
        <Tentativa key={rel.id} rel={rel} total={relatorios.length} />
      ))}

      <Modal
        open={open}
        title={`Reinspeção — ${data.numero} — Doc. BDBR.QUA.FMR.011.06`}
        width={1100}
        okText="Salvar reinspeção"
        cancelText="Cancelar"
        confirmLoading={salvando}
        onOk={salvarReinspecao}
        onCancel={() => setOpen(false)}
        destroyOnClose
      >
        <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
          Novo relatório completo, com número próprio, dentro da mesma inspeção.
          Os campos vieram da tentativa anterior; preencha as medidas novamente.
        </Typography.Paragraph>
        <Form form={form} layout="vertical">
          <CamposRelatorio
            form={form}
            maquinas={maquinas}
            tipos={tipos}
            cotas={cotas}
            setCotas={setCotas}
            defeitos={defeitos}
            setDefeitos={setDefeitos}
            tipo={data.tipo}
            fotosDimensional={fotosDimensional}
            setFotosDimensional={setFotosDimensional}
          />
        </Form>
      </Modal>
    </Space>
  );
}
