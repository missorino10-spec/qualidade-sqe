import {
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Row,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from 'antd';
import {
  ArrowLeftOutlined,
  FileTextOutlined,
  FilePdfOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useNavigate, useParams } from 'react-router-dom';
import { api, abrirPdfEmNovaAba } from '../api';
import { CotasSomenteLeitura } from '../components/TabelaCotas';
import { FotosEvidenciaSalvas } from '../components/FotosEvidencia';

// Detalhe da inspecao: mostra os formularios COMO FORAM PREENCHIDOS, item a
// item, aprovada ou reprovada. E o mesmo conteudo exportado no PDF.

const corStatusItem: Record<string, string> = {
  APROVADO: 'green',
  REPROVADO: 'red',
  NAO_APLICAVEL: 'default',
};

const labelStatusItem: Record<string, string> = {
  APROVADO: 'Aprovado',
  REPROVADO: 'Reprovado',
  NAO_APLICAVEL: 'N/A',
};

function ChecklistPreenchido({ checklist }: { checklist: any }) {
  const grupos = Array.isArray(checklist) ? checklist : [];
  if (!grupos.length)
    return <Empty description="Checklist sem itens registrados" />;
  return (
    <>
      {grupos.map((g: any) => (
        <Card key={g.grupo} size="small" title={g.grupo} style={{ marginBottom: 12 }}>
          {(g.itens ?? []).map((item: any, i: number) => (
            <Row
              key={i}
              align="middle"
              justify="space-between"
              style={{ padding: '3px 0' }}
            >
              <Col flex="auto">
                <Typography.Text>{item.texto}</Typography.Text>
              </Col>
              <Col>
                <Tag color={corStatusItem[item.status]}>
                  {labelStatusItem[item.status] ?? item.status}
                </Tag>
              </Col>
            </Row>
          ))}
        </Card>
      ))}
    </>
  );
}

function Formulario({
  titulo,
  doc,
  dados,
  children,
}: {
  titulo: string;
  doc: string;
  dados: any;
  children: React.ReactNode;
}) {
  return (
    <Card
      title={
        <Space>
          {titulo}
          <Typography.Text type="secondary" style={{ fontWeight: 400 }}>
            {doc}
          </Typography.Text>
          <Tag color={dados.resultado === 'REPROVADO' ? 'red' : 'green'}>
            {dados.resultado === 'REPROVADO' ? 'Reprovado' : 'Aprovado'}
          </Tag>
        </Space>
      }
      style={{ marginBottom: 16 }}
    >
      <Descriptions size="small" bordered column={3} style={{ marginBottom: 12 }}>
        <Descriptions.Item label="Data">
          {dados.dataInspecao
            ? dayjs(dados.dataInspecao).format('DD/MM/YYYY')
            : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="Inspetor">
          {dados.inspetor?.nome ?? '-'}
        </Descriptions.Item>
        <Descriptions.Item label="Qtd. inspecionada">
          {dados.qtdInspecionada ?? '-'}
        </Descriptions.Item>
        <Descriptions.Item label="Desenho / Revisão">
          {dados.desenhoRev ?? '-'}
        </Descriptions.Item>
        <Descriptions.Item label="Tolerâncias / Norma" span={2}>
          {dados.toleranciasNorm ?? '-'}
        </Descriptions.Item>
      </Descriptions>
      {children}
      {dados.observacoes && (
        <Card size="small" title="Observações" style={{ marginTop: 12 }}>
          <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
            {dados.observacoes}
          </Typography.Paragraph>
        </Card>
      )}
    </Card>
  );
}

export default function InspecaoDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery<any>({
    queryKey: ['inspecao', id],
    queryFn: async () => (await api.get(`/inspecoes/${id}`)).data,
    enabled: !!id,
  });

  if (isLoading || !data)
    return (
      <Card>
        <Spin />
      </Card>
    );

  const semFormularios = !data.visual && !data.lote;

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card
        title={
          <Space>
            <Typography.Title level={4} style={{ margin: 0 }}>
              Inspeção {data.numeroInspecao ?? '(sem número)'}
            </Typography.Title>
            <Tag color={data.resultado === 'REPROVADO' ? 'red' : 'green'}>
              {data.resultado === 'REPROVADO' ? 'Reprovado' : 'Aprovado'}
            </Tag>
            {data.inspecaoExtra && <Tag color="orange">Extra</Tag>}
          </Space>
        }
        extra={
          <Space>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/inspecoes')}
            >
              Voltar
            </Button>
            <Button
              type="primary"
              icon={<FilePdfOutlined />}
              disabled={semFormularios}
              onClick={() => abrirPdfEmNovaAba(`/inspecoes/${id}/pdf`)}
            >
              Exportar PDF
            </Button>
          </Space>
        }
      >
        <Descriptions size="small" bordered column={3}>
          <Descriptions.Item label="Data">
            {data.dataInspecao
              ? dayjs(data.dataInspecao).format('DD/MM/YYYY')
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Semana">
            {data.semana ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Ano">{data.ano ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="Fornecedor" span={2}>
            {data.fornecedor
              ? `${data.fornecedor.codigo} — ${data.fornecedor.nome}`
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Inspetor">
            {data.inspetor?.nome ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Item" span={2}>
            {data.item
              ? `${data.item.codigo} — ${data.item.descricao}`
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Qtd. total do lote">
            {data.qtdTotal ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Nota Fiscal">
            {data.notaFiscal ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label="PO">{data.po ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="RNC">
            {data.rncs?.length ? (
              <Space>
                {data.rncs.map((r: any) => (
                  <Button
                    key={r.id}
                    size="small"
                    type="link"
                    icon={<FileTextOutlined />}
                    onClick={() => navigate(`/rnc/${r.id}`)}
                  >
                    {r.numero}
                  </Button>
                ))}
              </Space>
            ) : (
              '-'
            )}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {semFormularios && (
        <Card>
          <Empty description="Recebimento registrado sem inspeção." />
        </Card>
      )}

      {data.visual && (
        <Formulario
          titulo="Inspeção Visual"
          doc="Doc. BDBR.QUA.FMR.06.07"
          dados={data.visual}
        >
          <ChecklistPreenchido checklist={data.visual.checklist} />
          <Card size="small" title="Evidências / Evidence" style={{ marginTop: 12 }}>
            <FotosEvidenciaSalvas
              entidadeTipo="INSPECAO_VISUAL"
              entidadeId={data.visual.id}
            />
          </Card>
        </Formulario>
      )}

      {data.lote && (
        <Formulario
          titulo="Inspeção de Lote / Dimensional"
          doc="Doc. BDBR.QUA.FMR.011.06"
          dados={data.lote}
        >
          <CotasSomenteLeitura cotas={data.lote.cotas} />
        </Formulario>
      )}
    </Space>
  );
}
