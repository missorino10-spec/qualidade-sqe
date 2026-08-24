import { useState } from 'react';
import {
  Button,
  Card,
  Form,
  Modal,
  Space,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../auth';
import { dataBR } from '../../formatos';
import { EVID } from '../../inspecao';
import { enviarFotosEvidencia } from '../../components/FotosEvidencia';
import {
  CamposRelatorio,
  corStatusInspecao,
  cotaVazia,
  labelStatusInspecao,
} from './FormularioDimensional';
import { CamposVisual } from './FormularioVisual';
import Tabela, { filtrosDe } from '../../components/Tabela';

// Duas telas separadas (Setup e Produção), cada uma com DOIS documentos:
//   - Inspecao dimensional: o BDBR.QUA.FMR.011.06, com cotas (SET/PROD).
//   - Inspecao visual: documento proprio, sem medicao (SETV/PRODV).
// Sao registros independentes: a visual acontece sozinha, sem dimensional.
export default function InspecoesManufatura({
  tipo,
}: {
  tipo: 'SETUP' | 'PRODUCAO';
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const admin = usuario?.papel === 'ADMIN';
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const [cotas, setCotas] = useState<any[]>([]);
  const [defeitos, setDefeitos] = useState<any[]>([]);
  const [fotosDimensional, setFotosDimensional] = useState<any[]>([]);
  const [salvando, setSalvando] = useState(false);

  // Formulario da inspecao visual, separado do dimensional.
  const [openVisual, setOpenVisual] = useState(false);
  const [formVisual] = Form.useForm();
  const [fotosVisual, setFotosVisual] = useState<any[]>([]);
  const [salvandoVisual, setSalvandoVisual] = useState(false);

  const maquinaId = Form.useWatch('maquinaId', form);

  const { data, isLoading } = useQuery<any[]>({
    queryKey: ['manufatura-inspecoes', tipo],
    queryFn: async () =>
      (await api.get('/manufatura/inspecoes', { params: { tipo } })).data,
  });

  const { data: visuais, isLoading: carregandoVisuais } = useQuery<any[]>({
    queryKey: ['manufatura-inspecoes-visuais', tipo],
    queryFn: async () =>
      (await api.get('/manufatura/inspecoes-visuais', { params: { tipo } }))
        .data,
  });

  const { data: maquinas } = useQuery<any[]>({
    queryKey: ['maquinas'],
    queryFn: async () => (await api.get('/maquinas')).data,
  });

  const { data: tipos } = useQuery<any[]>({
    queryKey: ['tipos-defeito'],
    queryFn: async () => (await api.get('/tipos-defeito')).data,
  });

  // So na producao: vinculo opcional com o setup que a liberou.
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
    setOpen(true);
  }

  function abrirVisual() {
    formVisual.resetFields();
    formVisual.setFieldsValue({
      dataInspecao: dayjs().format('YYYY-MM-DD'),
      revisao: '01',
      origem: tipo === 'SETUP' ? 'LIBERACAO_SETUP' : 'INSPECAO_PRODUCAO',
    });
    setFotosVisual([]);
    setOpenVisual(true);
  }

  async function salvarVisual() {
    const v = await formVisual.validateFields();
    setSalvandoVisual(true);
    try {
      const rota = tipo === 'SETUP' ? 'setup' : 'producao';
      const res = await api.post(`/manufatura/inspecoes-visuais/${rota}`, v);
      if (fotosVisual.length)
        await enviarFotosEvidencia(
          fotosVisual,
          EVID.manufaturaVisualInspecao,
          res.data.id,
        );
      message.success(`Inspeção visual ${res.data.numero} registrada.`);
      qc.invalidateQueries({ queryKey: ['manufatura-inspecoes-visuais'] });
      setOpenVisual(false);
      navigate(`/manufatura/inspecoes-visuais/${res.data.id}`);
    } catch (e: any) {
      message.error(
        e?.response?.data?.message ??
          'Não foi possível salvar a inspeção visual.',
      );
    } finally {
      setSalvandoVisual(false);
    }
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
      if (relatorioId && fotosDimensional.length)
        await enviarFotosEvidencia(
          fotosDimensional,
          EVID.manufaturaDimensional,
          relatorioId,
        );
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

  // Excluir de verdade e so do ADMIN. E o caminho para o lancamento errado; a
  // dimensional e a visual sao registros distintos, cada uma com a sua rota.
  const excluir = useMutation({
    mutationFn: async ({ rota, r }: { rota: string; r: any }) =>
      api.delete(`/manufatura/${rota}/${r.id}`),
    onSuccess: () => {
      message.success('Inspeção excluída.');
      qc.invalidateQueries({ queryKey: ['manufatura-inspecoes'] });
      qc.invalidateQueries({ queryKey: ['manufatura-inspecoes-visuais'] });
    },
    onError: (e: any) =>
      message.error(
        e?.response?.data?.message ?? 'Não foi possível excluir a inspeção.',
      ),
  });

  function confirmarExclusao(rota: string, r: any) {
    Modal.confirm({
      title: `Excluir a inspeção ${r.numero}?`,
      content:
        rota === 'inspecoes'
          ? 'As reinspeções também serão excluídas.'
          : 'A exclusão é definitiva.',
      okText: 'Excluir',
      okButtonProps: { danger: true },
      cancelText: 'Cancelar',
      onOk: () => excluir.mutateAsync({ rota, r }),
    });
  }

  // A linha inteira abre o detalhe, entao o botao precisa segurar o clique.
  function colunaAcoes(rota: string) {
    if (!admin) return [];
    return [
      {
        title: 'Ações',
        width: 100,
        render: (_: any, r: any) => (
          <Button
            size="small"
            danger
            onClick={(e) => {
              e.stopPropagation();
              confirmarExclusao(rota, r);
            }}
          >
            Excluir
          </Button>
        ),
      },
    ];
  }

  const titulo =
    tipo === 'SETUP' ? 'Inspeção de setup' : 'Inspeção de produção';

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card
        title={titulo}
        extra={
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={abrir}>
              Inspeção dimensional
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={abrirVisual}
            >
              Inspeção visual
            </Button>
          </Space>
        }
      >
        {/* Duas listas separadas porque sao dois documentos distintos, com
            numeracao propria. A dimensional tem cotas e resultado; a visual e
            um registro descritivo. */}
        <Tabs
          items={[
            {
              key: 'dimensional',
              label: 'Dimensional',
              children: (
                <Tabela
                  busca="Buscar inspeção (número, item, máquina, inspetor...)"
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
                      filters: filtrosDe(
                        (data ?? []).map((r: any) => r.maquina?.nome),
                      ),
                      onFilter: (v: any, r: any) => r.maquina?.nome === v,
                      render: (_: any, r: any) => r.maquina?.nome,
                    },
                    {
                      title: 'Item',
                      filters: filtrosDe(
                        (data ?? []).map((r: any) => r.itemCodigo),
                      ),
                      onFilter: (v: any, r: any) => r.itemCodigo === v,
                      render: (_: any, r: any) =>
                        [r.itemCodigo, r.itemDescricao]
                          .filter(Boolean)
                          .join(' — ') || '-',
                    },
                    {
                      title: 'Tentativas',
                      width: 100,
                      align: 'center',
                      render: (_: any, r: any) => r.relatorios?.length ?? 0,
                    },
                    {
                      title: 'Status',
                      dataIndex: 'status',
                      width: 190,
                      filters: Object.entries(labelStatusInspecao).map(
                        ([v, t]) => ({ text: t as string, value: v }),
                      ),
                      onFilter: (v: any, r: any) => r.status === v,
                      render: (s: string) => (
                        <Tag color={corStatusInspecao[s]}>
                          {labelStatusInspecao[s]}
                        </Tag>
                      ),
                    },
                    ...colunaAcoes('inspecoes'),
                  ]}
                />
              ),
            },
            {
              key: 'visual',
              label: 'Visual',
              children: (
                <Tabela
                  busca="Buscar inspeção visual (número, item, máquina, inspetor...)"
                  rowKey="id"
                  size="small"
                  loading={carregandoVisuais}
                  dataSource={visuais}
                  scroll={{ x: 900 }}
                  onRow={(r) => ({
                    onClick: () =>
                      navigate(`/manufatura/inspecoes-visuais/${r.id}`),
                    style: { cursor: 'pointer' },
                  })}
                  columns={[
                    { title: 'Número', dataIndex: 'numero', width: 130 },
                    {
                      title: 'Data',
                      dataIndex: 'dataInspecao',
                      width: 110,
                      render: (d: string) => dataBR(d),
                    },
                    {
                      title: 'Máquina',
                      width: 180,
                      filters: filtrosDe(
                        (visuais ?? []).map((r: any) => r.maquina?.nome),
                      ),
                      onFilter: (v: any, r: any) => r.maquina?.nome === v,
                      render: (_: any, r: any) => r.maquina?.nome,
                    },
                    {
                      title: 'Item',
                      filters: filtrosDe(
                        (visuais ?? []).map((r: any) => r.itemCodigo),
                      ),
                      onFilter: (v: any, r: any) => r.itemCodigo === v,
                      render: (_: any, r: any) =>
                        [r.itemCodigo, r.itemDescricao]
                          .filter(Boolean)
                          .join(' — ') || '-',
                    },
                    {
                      title: 'Inspetor',
                      width: 160,
                      render: (_: any, r: any) => r.inspetor?.nome ?? '-',
                    },
                    ...colunaAcoes('inspecoes-visuais'),
                  ]}
                />
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
            fotosDimensional={fotosDimensional}
            setFotosDimensional={setFotosDimensional}
          />
        </Form>
      </Modal>

      <Modal
        open={openVisual}
        title={`Nova inspeção visual — ${tipo === 'SETUP' ? 'setup' : 'produção'}`}
        width={900}
        okText="Salvar inspeção visual"
        cancelText="Cancelar"
        confirmLoading={salvandoVisual}
        onOk={salvarVisual}
        onCancel={() => setOpenVisual(false)}
        destroyOnClose
      >
        <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
          Relatório de Inspeção Visual — documento próprio, sem medição de
          cotas. Numeração {tipo === 'SETUP' ? 'SETV' : 'PRODV'}.
        </Typography.Paragraph>
        <Form form={formVisual} layout="vertical">
          <CamposVisual
            form={formVisual}
            maquinas={maquinas}
            fotos={fotosVisual}
            setFotos={setFotosVisual}
          />
        </Form>
      </Modal>
    </Space>
  );
}
