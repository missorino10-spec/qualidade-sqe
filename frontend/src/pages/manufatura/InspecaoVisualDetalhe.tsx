import { useState } from 'react';
import {
  Button,
  Card,
  Descriptions,
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
} from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useNavigate, useParams } from 'react-router-dom';
import { api, abrirPdfEmNovaAba } from '../../api';
import { dataBR } from '../../formatos';
import {
  FotosEvidenciaSalvas,
  enviarFotosEvidencia,
} from '../../components/FotosEvidencia';
import { EVID, textoDesenho, textoRevisao } from '../../inspecao';
import { ORIGENS_INSPECAO } from './FormularioDimensional';
import { CamposVisual } from './FormularioVisual';
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
  const [form] = Form.useForm();
  const [open, setOpen] = useState(false);
  const [fotos, setFotos] = useState<any[]>([]);
  const [salvando, setSalvando] = useState(false);

  const { data, isLoading } = useQuery<any>({
    queryKey: ['manufatura-inspecao-visual', id],
    queryFn: async () =>
      (await api.get(`/manufatura/inspecoes-visuais/${id}`)).data,
    enabled: !!id,
  });

  const { data: maquinas } = useQuery<any[]>({
    queryKey: ['maquinas'],
    queryFn: async () => (await api.get('/maquinas')).data,
  });

  if (isLoading || !data)
    return (
      <Card>
        <Spin />
      </Card>
    );

  // Correcao do que foi digitado errado: o mesmo documento, com o mesmo
  // numero. Nao existe reinspecao no visual - este e o unico caminho.
  function abrirCorrecao() {
    form.resetFields();
    form.setFieldsValue({
      maquinaId: data.maquinaId,
      dataInspecao: dayjs(data.dataInspecao).format('YYYY-MM-DD'),
      revisao: data.revisao ?? '01',
      origem: data.origem,
      origemOutros: data.origemOutros ?? undefined,
      itemCodigo: data.itemCodigo ?? undefined,
      itemDescricao: data.itemDescricao ?? undefined,
      desenho: data.desenho ?? undefined,
      desenhoRevisao: data.desenhoRevisao ?? undefined,
      po: data.po ?? undefined,
      qtdInspecionada: data.qtdInspecionada ?? undefined,
      qtdTotal: data.qtdTotal ?? undefined,
      observacoes: data.observacoes ?? undefined,
    });
    setFotos([]);
    setOpen(true);
  }

  // Rascunho so precisa da maquina; sem a marca "rascunho" o PATCH LANCA o
  // documento, e dai em diante ele so pode ser corrigido.
  async function salvarCorrecao(rascunho = false) {
    const v = rascunho
      ? (await form.validateFields(['maquinaId']), form.getFieldsValue(true))
      : await form.validateFields();
    setSalvando(true);
    try {
      await api.patch(`/manufatura/inspecoes-visuais/${id}`, {
        ...v,
        rascunho: rascunho || undefined,
      });
      if (fotos.length)
        await enviarFotosEvidencia(
          fotos,
          EVID.manufaturaVisualInspecao,
          Number(id),
        );
      message.success(
        rascunho
          ? `Rascunho da inspeção visual ${data.numero} salvo. Ele não conta nos indicadores até ser lançado.`
          : data.rascunho
            ? `Inspeção visual ${data.numero} lançada.`
            : `Inspeção visual ${data.numero} corrigida.`,
      );
      qc.invalidateQueries({ queryKey: ['manufatura-inspecao-visual', id] });
      qc.invalidateQueries({ queryKey: ['manufatura-inspecoes-visuais'] });
      setOpen(false);
    } catch (e: any) {
      message.error(
        e?.response?.data?.message ?? 'Não foi possível salvar a correção.',
      );
    } finally {
      setSalvando(false);
    }
  }

  // Descartar rascunho: joga fora o que ficou pela metade. Nao ha nada a
  // desfazer, porque o visual em rascunho nunca valeu como documento.
  function descartarRascunho() {
    Modal.confirm({
      title: `Descartar o rascunho ${data.numero}?`,
      icon: <DeleteOutlined style={{ color: '#cf1322' }} />,
      content:
        'O que foi preenchido será perdido. Como o rascunho nunca foi lançado, nada muda em lugar nenhum.',
      okText: 'Descartar',
      okButtonProps: { danger: true },
      cancelText: 'Cancelar',
      onOk: async () => {
        try {
          await api.delete(`/manufatura/inspecoes-visuais/${id}/rascunho`);
          message.success('Rascunho descartado.');
          qc.invalidateQueries({ queryKey: ['manufatura-inspecoes-visuais'] });
          navigate(
            data.tipo === 'SETUP'
              ? '/manufatura/inspecoes/setup'
              : '/manufatura/inspecoes/producao',
          );
        } catch (e: any) {
          message.error(
            e?.response?.data?.message ??
              'Não foi possível descartar o rascunho.',
          );
        }
      },
    });
  }

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
            {data.rascunho && <Tag color="orange">Rascunho</Tag>}
          </Space>
        }
        extra={
          <Space>
            <Button icon={<EditOutlined />} onClick={abrirCorrecao}>
              {data.rascunho ? 'Continuar rascunho' : 'Corrigir'}
            </Button>
            {/* Descartar rascunho e de qualquer um do modulo; excluir
                documento ja lancado continua no botao ao lado. */}
            {data.rascunho && (
              <Button danger icon={<DeleteOutlined />} onClick={descartarRascunho}>
                Descartar rascunho
              </Button>
            )}
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

      <Modal
        open={open}
        title={
          data.rascunho
            ? `Rascunho da inspeção visual ${data.numero}`
            : `Corrigir inspeção visual ${data.numero}`
        }
        width={1000}
        confirmLoading={salvando}
        onCancel={() => setOpen(false)}
        destroyOnClose
        /* Documento ja lancado nao volta a rascunho: o "Salvar rascunho" so
           existe enquanto ele ainda nao valeu. */
        footer={[
          <Button key="cancelar" onClick={() => setOpen(false)}>
            Cancelar
          </Button>,
          data.rascunho ? (
            <Button
              key="rascunho"
              loading={salvando}
              onClick={() => salvarCorrecao(true)}
            >
              Salvar rascunho
            </Button>
          ) : null,
          <Button
            key="ok"
            type="primary"
            loading={salvando}
            onClick={() => salvarCorrecao()}
          >
            {data.rascunho ? 'Lançar inspeção visual' : 'Salvar correção'}
          </Button>,
        ]}
      >
        <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
          {data.rascunho
            ? 'Rascunho: enquanto não for lançado, este documento fica marcado como incompleto. As fotos já enviadas continuam salvas.'
            : 'Este é o mesmo documento: o número não muda. As fotos já enviadas continuam salvas; o que for anexado aqui é acrescentado a elas.'}
        </Typography.Paragraph>
        <Form form={form} layout="vertical">
          <CamposVisual
            form={form}
            maquinas={maquinas}
            fotos={fotos}
            setFotos={setFotos}
            maquinaFixa
          />
        </Form>
      </Modal>
    </Space>
  );
}
