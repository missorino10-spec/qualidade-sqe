import {
  Button,
  Card,
  Descriptions,
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
  FilePdfOutlined,
} from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api, abrirPdfEmNovaAba } from '../../api';
import { dataBR } from '../../formatos';
import { FotosEvidenciaSalvas } from '../../components/FotosEvidencia';
import { EVID, textoDesenho, textoRevisao } from '../../inspecao';
import { ORIGENS_INSPECAO } from './FormularioDimensional';
import NomeAssinatura from '../../components/NomeAssinatura';

// Detalhe da INSPECAO VISUAL da Manufatura: documento proprio, sem cotas e sem
// reinspecao - o que o inspetor observou naquele momento, com as fotos.

function labelOrigem(v: string, outros?: string) {
  if (v === 'OUTROS') return outros ? `Outros — ${outros}` : 'Outros';
  return ORIGENS_INSPECAO.find((o) => o.value === v)?.label ?? v ?? '-';
}

export default function InspecaoVisualDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<any>({
    queryKey: ['manufatura-inspecao-visual', id],
    queryFn: async () =>
      (await api.get(`/manufatura/inspecoes-visuais/${id}`)).data,
    enabled: !!id,
  });

  if (isLoading || !data)
    return (
      <Card>
        <Spin />
      </Card>
    );

  async function remover() {
    try {
      await api.delete(`/manufatura/inspecoes-visuais/${id}`);
      message.success('Inspeção visual excluída.');
      qc.invalidateQueries({ queryKey: ['manufatura-inspecoes-visuais'] });
      navigate(
        data.tipo === 'SETUP'
          ? '/manufatura/inspecoes/setup'
          : '/manufatura/inspecoes/producao',
      );
    } catch (e: any) {
      message.error(
        e?.response?.data?.message ?? 'Não foi possível excluir a inspeção.',
      );
    }
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card
        title={
          <Space wrap>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() =>
                navigate(
                  data.tipo === 'SETUP'
                    ? '/manufatura/inspecoes/setup'
                    : '/manufatura/inspecoes/producao',
                )
              }
            />
            <span>Inspeção visual {data.numero}</span>
            <Tag color="orange">
              {data.tipo === 'SETUP' ? 'Setup' : 'Produção'}
            </Tag>
          </Space>
        }
        extra={
          <Space>
            <Popconfirm
              title="Excluir esta inspeção visual?"
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
              onClick={() =>
                abrirPdfEmNovaAba(`/manufatura/inspecoes-visuais/${id}/pdf`)
              }
            >
              Exportar PDF
            </Button>
          </Space>
        }
      >
        <Descriptions
          size="small"
          bordered
          column={{ xs: 1, sm: 2, md: 2, lg: 3, xl: 3, xxl: 3 }}
        >
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
          <Descriptions.Item label="Desenho">
            {textoDesenho(data.desenho)}
          </Descriptions.Item>
          <Descriptions.Item label="Revisão">
            {textoRevisao(data.desenhoRevisao)}
          </Descriptions.Item>
          <Descriptions.Item label="Rev. do relatório">
            {data.revisao ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Qtd. inspecionada">
            {data.qtdInspecionada ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Qtd. total">
            {data.qtdTotal ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Semana">
            {data.semana ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Origem" span={2}>
            {labelOrigem(data.origem, data.origemOutros)}
          </Descriptions.Item>
          <Descriptions.Item label="Inspetor">
            <NomeAssinatura nome={data.inspetor?.nome} />
          </Descriptions.Item>
          <Descriptions.Item label="Elaborado por">
            {data.inspetor?.nome ? (
              <NomeAssinatura nome={data.inspetor.nome} />
            ) : (
              (data.elaboradoPor ?? '-')
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Inspecionado por" span={2}>
            {data.inspetor?.nome ? (
              <NomeAssinatura nome={data.inspetor.nome} />
            ) : (
              (data.inspecionadoPor ?? '-')
            )}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="O que foi observado">
        <Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>
          {data.observacoes || '-'}
        </Typography.Paragraph>
      </Card>

      <Card title="Evidência fotográfica">
        <FotosEvidenciaSalvas
          entidadeTipo={EVID.manufaturaVisualInspecao}
          entidadeId={data.id}
        />
      </Card>
    </Space>
  );
}
