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
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../auth';
import { dataBR } from '../../formatos';
import {
  Bloco,
  CamposAutoavaliacao,
  respostasIniciais,
} from './FormularioAutoavaliacao';
import {
  corResultado,
  corStatusHomologacao,
  labelResultado,
  labelStatusHomologacao,
  nota,
} from './comum';

// Submenu "Homologação de Fornecedores": historico de todas as autoavaliacoes
// (BDBR.QUA.FMR.024.03). Cada linha abre o registro de homologacao
// (BDBR.QUA.FMR.029.01), como a inspecao de recebimento abre a RNC.
export default function Homologacoes() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const podeEditar =
    usuario?.papel === 'ADMIN' || usuario?.papel === 'QUALIDADE';

  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  const { data, isLoading } = useQuery<any[]>({
    queryKey: ['sqd-homologacoes'],
    queryFn: async () => (await api.get('/sqd/homologacoes')).data,
  });

  const { data: blocos } = useQuery<Bloco[]>({
    queryKey: ['sqd-formulario'],
    queryFn: async () => (await api.get('/sqd/homologacoes/formulario')).data,
  });

  function abrir() {
    form.resetFields();
    form.setFieldsValue({ dataAvaliacao: dayjs().format('YYYY-MM-DD') });
    setRespostas(respostasIniciais(blocos ?? []));
    setOpen(true);
  }

  async function salvar() {
    const v = await form.validateFields();
    setSalvando(true);
    try {
      const res = await api.post('/sqd/homologacoes', { ...v, respostas });
      message.success(
        `Homologação ${res.data.numero} registrada — nota ${nota(res.data.nota)}.`,
      );
      qc.invalidateQueries({ queryKey: ['sqd-homologacoes'] });
      setOpen(false);
      navigate(`/sqd/homologacoes/${res.data.id}`);
    } catch (e: any) {
      message.error(
        e?.response?.data?.message ?? 'Não foi possível salvar a homologação.',
      );
    } finally {
      setSalvando(false);
    }
  }

  function confirmarExclusao(r: any) {
    Modal.confirm({
      title: `Excluir a homologação ${r.numero}?`,
      content:
        'A autoavaliação, o resultado e os anexos deste registro serão apagados.',
      okText: 'Excluir',
      okButtonProps: { danger: true },
      cancelText: 'Cancelar',
      onOk: async () => {
        try {
          await api.delete(`/sqd/homologacoes/${r.id}`);
          message.success('Homologação excluída.');
          qc.invalidateQueries({ queryKey: ['sqd-homologacoes'] });
        } catch {
          message.error('Não foi possível excluir a homologação.');
        }
      },
    });
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card
        title="Homologação de Fornecedores"
        extra={
          podeEditar && (
            <Button type="primary" icon={<PlusOutlined />} onClick={abrir}>
              Nova homologação
            </Button>
          )
        }
      >
        <Table
          rowKey="id"
          size="small"
          loading={isLoading}
          dataSource={data}
          scroll={{ x: 1100 }}
          onRow={(r) => ({
            onClick: () => navigate(`/sqd/homologacoes/${r.id}`),
            style: { cursor: 'pointer' },
          })}
          columns={[
            { title: 'Número', dataIndex: 'numero', width: 120 },
            {
              title: 'Data',
              dataIndex: 'dataAvaliacao',
              width: 110,
              render: (d: string) => dataBR(d),
            },
            { title: 'Semana', dataIndex: 'semana', width: 90 },
            { title: 'Fornecedor', dataIndex: 'fornecedorNome' },
            {
              title: 'Solicitante',
              dataIndex: 'solicitante',
              width: 120,
              render: (s: string) =>
                s ? (s === 'NC' ? 'N/C' : s[0] + s.slice(1).toLowerCase()) : '-',
            },
            {
              title: 'Nota',
              dataIndex: 'nota',
              width: 90,
              align: 'right',
              render: (v: number) => <strong>{nota(v)}</strong>,
            },
            {
              title: 'Resultado',
              dataIndex: 'resultado',
              width: 210,
              render: (r: string) => (
                <Tag color={corResultado[r]}>{labelResultado[r]}</Tag>
              ),
            },
            {
              title: 'Status',
              dataIndex: 'statusHomologacao',
              width: 130,
              render: (s: string) => (
                <Tag color={corStatusHomologacao[s]}>
                  {labelStatusHomologacao[s]}
                </Tag>
              ),
            },
            {
              title: '',
              width: 60,
              align: 'center',
              render: (_: any, r: any) =>
                podeEditar && (
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      confirmarExclusao(r);
                    }}
                  />
                ),
            },
          ]}
        />
      </Card>

      <Modal
        open={open}
        title="Nova Homologação — Autoavaliação de Fornecedores (Doc. BDBR.QUA.FMR.024.03)"
        width={1100}
        okText="Salvar e calcular resultado"
        cancelText="Cancelar"
        confirmLoading={salvando}
        onOk={salvar}
        onCancel={() => setOpen(false)}
        destroyOnClose
      >
        <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
          Lance aqui as respostas enviadas pelo fornecedor. O sistema calcula a
          pontuação de cada bloco e a nota ponderada final.
        </Typography.Paragraph>
        <Form form={form} layout="vertical">
          <CamposAutoavaliacao
            blocos={blocos ?? []}
            respostas={respostas}
            setRespostas={setRespostas}
          />
        </Form>
      </Modal>
    </Space>
  );
}
