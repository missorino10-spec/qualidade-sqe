import { useState } from 'react';
import {
  Button,
  Card,
  Form,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { dataBR } from '../../formatos';
import { EVID } from '../../inspecao';
import { enviarFotosEvidencia } from '../../components/FotosEvidencia';
import {
  CamposRelatorio,
  corStatusInspecao,
  cotaVazia,
  labelStatusInspecao,
} from './FormularioDimensional';

// Duas telas separadas (Setup e Produção) usando o MESMO formulario, que e o
// que o documento BDBR.QUA.FMR.011.06 determina.
export default function InspecoesManufatura({
  tipo,
}: {
  tipo: 'SETUP' | 'PRODUCAO';
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const [cotas, setCotas] = useState<any[]>([]);
  const [defeitos, setDefeitos] = useState<any[]>([]);
  const [fotosDimensional, setFotosDimensional] = useState<any[]>([]);
  const [fotosVisual, setFotosVisual] = useState<any[]>([]);
  const [salvando, setSalvando] = useState(false);

  const maquinaId = Form.useWatch('maquinaId', form);

  const { data, isLoading } = useQuery<any[]>({
    queryKey: ['manufatura-inspecoes', tipo],
    queryFn: async () =>
      (await api.get('/manufatura/inspecoes', { params: { tipo } })).data,
  });

  const { data: maquinas } = useQuery<any[]>({
    queryKey: ['maquinas'],
    queryFn: async () => (await api.get('/maquinas')).data,
  });

  const { data: tipos } = useQuery<any[]>({
    queryKey: ['tipos-defeito'],
    queryFn: async () => (await api.get('/tipos-defeito')).data,
  });

  // So na producao: contador de setups e vinculo com o setup que a liberou.
  const { data: avaliacao } = useQuery<any>({
    queryKey: ['manufatura-avaliar', maquinaId],
    queryFn: async () =>
      (await api.get('/manufatura/inspecoes/avaliar', { params: { maquinaId } }))
        .data,
    enabled: tipo === 'PRODUCAO' && !!maquinaId,
  });

  const { data: setups } = useQuery<any[]>({
    queryKey: ['manufatura-setups', maquinaId],
    queryFn: async () =>
      (await api.get('/manufatura/inspecoes/setups', { params: { maquinaId } }))
        .data,
    enabled: tipo === 'PRODUCAO' && !!maquinaId,
  });

  function abrir() {
    form.resetFields();
    form.setFieldsValue({
      dataInspecao: dayjs().format('YYYY-MM-DD'),
      revisao: '01',
      qtdInspecionada: 3,
      origem: tipo === 'SETUP' ? 'LIBERACAO_SETUP' : 'PLANO_INSPECAO',
      resultado: 'APROVADO',
      toleranciasNorm: 'ISO2768',
    });
    setCotas([cotaVazia()]);
    setDefeitos([]);
    setFotosDimensional([]);
    setFotosVisual([]);
    setOpen(true);
  }

  async function salvar() {
    const v = await form.validateFields();
    setSalvando(true);
    try {
      const rota = tipo === 'SETUP' ? 'setup' : 'producao';
      const res = await api.post(`/manufatura/inspecoes/${rota}`, {
        ...v,
        cotas,
        defeitos: defeitos.filter((d) => d.tipoDefeitoId),
      });
      // As fotos ficam presas ao RELATORIO (a tentativa), nao a inspecao:
      // cada reinspecao tem a sua propria evidencia.
      const relatorios = res.data.relatorios ?? [];
      const relatorioId = relatorios[relatorios.length - 1]?.id;
      if (relatorioId) {
        if (fotosDimensional.length)
          await enviarFotosEvidencia(
            fotosDimensional,
            EVID.manufaturaDimensional,
            relatorioId,
          );
        if (fotosVisual.length)
          await enviarFotosEvidencia(
            fotosVisual,
            EVID.manufaturaVisual,
            relatorioId,
          );
      }
      message.success(`Inspeção ${res.data.numero} registrada.`);
      qc.invalidateQueries({ queryKey: ['manufatura-inspecoes'] });
      qc.invalidateQueries({ queryKey: ['maquinas'] });
      setOpen(false);
      navigate(`/manufatura/inspecoes/${res.data.id}`);
    } catch (e: any) {
      message.error(
        e?.response?.data?.message ?? 'Não foi possível salvar a inspeção.',
      );
    } finally {
      setSalvando(false);
    }
  }

  const titulo =
    tipo === 'SETUP' ? 'Inspeção de Setup' : 'Inspeção de Produção';

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card
        title={titulo}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={abrir}>
            Nova inspeção
          </Button>
        }
      >
        <Table
          rowKey="id"
          size="small"
          loading={isLoading}
          dataSource={data}
          scroll={{ x: 1000 }}
          onRow={(r) => ({
            onClick: () => navigate(`/manufatura/inspecoes/${r.id}`),
            style: { cursor: 'pointer' },
          })}
          columns={[
            { title: 'Número', dataIndex: 'numero', width: 120 },
            {
              title: 'Data',
              dataIndex: 'dataInspecao',
              width: 110,
              render: (d: string) => dataBR(d),
            },
            {
              title: 'Máquina',
              width: 180,
              render: (_: any, r: any) => r.maquina?.nome,
            },
            {
              title: 'Item',
              render: (_: any, r: any) =>
                [r.itemCodigo, r.itemDescricao].filter(Boolean).join(' — ') ||
                '-',
            },
            {
              title: 'Tentativas',
              width: 100,
              align: 'center',
              render: (_: any, r: any) => r.relatorios?.length ?? 0,
            },
            {
              title: 'Tipo',
              width: 90,
              align: 'center',
              render: (_: any, r: any) =>
                r.extra ? <Tag color="orange">Extra</Tag> : <Tag>Ciclo</Tag>,
            },
            {
              title: 'Status',
              dataIndex: 'status',
              width: 190,
              render: (s: string) => (
                <Tag color={corStatusInspecao[s]}>{labelStatusInspecao[s]}</Tag>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={open}
        title={`Nova ${titulo} — Doc. BDBR.QUA.FMR.011.06`}
        width={1100}
        okText="Salvar inspeção"
        cancelText="Cancelar"
        confirmLoading={salvando}
        onOk={salvar}
        onCancel={() => setOpen(false)}
        destroyOnClose
      >
        <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
          Relatório de Inspeção Dimensional — o mesmo formulário usado para
          setup e para produção.
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
            tipo={tipo}
            setups={setups}
            avaliacao={avaliacao}
            fotosDimensional={fotosDimensional}
            setFotosDimensional={setFotosDimensional}
            fotosVisual={fotosVisual}
            setFotosVisual={setFotosVisual}
          />
        </Form>
      </Modal>
    </Space>
  );
}
