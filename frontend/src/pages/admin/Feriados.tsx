import { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Tag,
  message,
} from 'antd';
import { CalendarOutlined, PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { api } from '../../api';
import Tabela from '../../components/Tabela';
import { BotaoExcluir } from '../../design/acoes';

/**
 * Calendário de feriados — o relógio de dias úteis do sistema inteiro.
 *
 * Toda linha aqui é um dia em que a fábrica NÃO trabalha. É essa lista que o
 * prazo da R.O, os prazos do SQD e os indicadores de prazo do painel do SQE
 * usam para não vencer um prazo com a fábrica fechada.
 *
 * O botão "Gerar calendário" traz os feriados de lei (nacionais, estaduais de
 * SP e municipais de Araraquara, mais Carnaval e Corpus Christi, que a fábrica
 * para). O que é da casa — recesso de fim de ano, parada de manutenção, ponte —
 * a Qualidade acrescenta à mão.
 */

interface Feriado {
  id: number;
  data: string;
  descricao: string;
  tipo: string;
}

const TIPOS: Record<string, { rotulo: string; cor: string }> = {
  NACIONAL: { rotulo: 'Nacional', cor: 'blue' },
  ESTADUAL: { rotulo: 'Estadual', cor: 'geekblue' },
  MUNICIPAL: { rotulo: 'Municipal', cor: 'cyan' },
  FACULTATIVO: { rotulo: 'Ponto facultativo', cor: 'purple' },
  PARADA: { rotulo: 'Parada da fábrica', cor: 'orange' },
};

// Data pura: o backend grava meia-noite UTC. Cortar o "AAAA-MM-DD" antes do
// dayjs evita que 01/01 vire 31/12 no fuso do Brasil.
function soData(v: string) {
  return String(v).slice(0, 10);
}

function dataBR(v: string) {
  return dayjs(soData(v)).format('DD/MM/YYYY');
}

const DIAS_SEMANA = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
];

export default function Feriados() {
  const qc = useQueryClient();
  const [ano, setAno] = useState(dayjs().year());
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const { data, isFetching } = useQuery<Feriado[]>({
    queryKey: ['feriados', ano],
    queryFn: async () => (await api.get('/feriados', { params: { ano } })).data,
  });

  function invalidar() {
    qc.invalidateQueries({ queryKey: ['feriados'] });
  }

  const criar = useMutation({
    mutationFn: async (v: any) => api.post('/feriados', v),
    onSuccess: () => {
      message.success('Feriado incluído.');
      invalidar();
      setOpen(false);
      form.resetFields();
    },
    onError: (e: any) =>
      message.error(
        e?.response?.data?.message ?? 'Não foi possível incluir o feriado.',
      ),
  });

  const gerar = useMutation({
    mutationFn: async () => (await api.post(`/feriados/gerar/${ano}`)).data,
    onSuccess: (r: any) => {
      invalidar();
      message.success(
        r.criados
          ? `${r.criados} feriado(s) incluído(s) em ${ano}.`
          : `Nada a incluir: o calendário de ${ano} já está completo.`,
      );
    },
    onError: () => message.error('Não foi possível gerar o calendário.'),
  });

  const excluir = useMutation({
    mutationFn: async (f: Feriado) => api.delete(`/feriados/${f.id}`),
    onSuccess: () => {
      message.success('Feriado excluído.');
      invalidar();
    },
    onError: () => message.error('Não foi possível excluir o feriado.'),
  });

  const lista = data ?? [];
  // Feriado que cai no fim de semana não tira dia útil de ninguém: fica na
  // lista para o registro ficar completo, mas não muda prazo nenhum.
  const emDiaUtil = lista.filter((f) => {
    const d = dayjs(soData(f.data)).day();
    return d !== 0 && d !== 6;
  }).length;

  return (
    <Card
      title="Calendário de feriados"
      extra={
        <Space>
          <InputNumber
            value={ano}
            onChange={(v) => v && setAno(Number(v))}
            min={2000}
            max={2100}
            style={{ width: 100 }}
          />
          <Button
            icon={<CalendarOutlined />}
            loading={gerar.isPending}
            onClick={() => gerar.mutate()}
          >
            Gerar calendário de {ano}
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              form.resetFields();
              form.setFieldsValue({ tipo: 'PARADA' });
              setOpen(true);
            }}
          >
            Novo dia
          </Button>
        </Space>
      }
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Tudo o que está nesta lista é dia não trabalhado."
        description="Os prazos em dias úteis do sistema — conclusão da R.O, homologações do SQD e os indicadores de prazo do painel do SQE — pulam estes dias. Gerar o ano traz só os feriados de lei; recesso, ponte e parada de manutenção você inclui aqui."
      />

      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col xs={12}>
          <Card size="small">
            <Statistic title={`Dias cadastrados em ${ano}`} value={lista.length} />
          </Card>
        </Col>
        <Col xs={12}>
          <Card size="small">
            <Statistic
              title="Que caem em dia de semana"
              value={emDiaUtil}
              suffix="dias úteis a menos"
            />
          </Card>
        </Col>
      </Row>

      <Tabela
        busca="Buscar por descrição..."
        rowKey="id"
        loading={isFetching}
        dataSource={lista}
        columns={[
          {
            title: 'Data',
            dataIndex: 'data',
            width: 120,
            render: dataBR,
          },
          {
            title: 'Dia da semana',
            dataIndex: 'data',
            width: 130,
            render: (v: string) => DIAS_SEMANA[dayjs(soData(v)).day()],
          },
          { title: 'Descrição', dataIndex: 'descricao' },
          {
            title: 'Tipo',
            dataIndex: 'tipo',
            width: 160,
            filters: Object.entries(TIPOS).map(([k, t]) => ({
              text: t.rotulo,
              value: k,
            })),
            onFilter: (v: any, f: any) => f.tipo === v,
            render: (v: string) => (
              <Tag color={TIPOS[v]?.cor ?? 'default'}>
                {TIPOS[v]?.rotulo ?? v}
              </Tag>
            ),
          },
          {
            title: 'Ações',
            width: 100,
            render: (_: any, f: Feriado) => (
              <BotaoExcluir
                emTabela
                motivo="Excluir este dia do calendário"
                titulo={`Excluir ${dataBR(f.data)} — ${f.descricao}?`}
                descricao="O dia volta a contar como dia útil nos prazos calculados daqui para a frente. Registros já gravados não mudam."
                onConfirm={() => excluir.mutateAsync(f)}
              />
            ),
          },
        ]}
      />

      <Modal
        title="Novo dia não trabalhado"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={criar.isPending}
        okText="Salvar"
        cancelText="Cancelar"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(v) => criar.mutate(v)}
          style={{ marginTop: 12 }}
        >
          <Form.Item
            name="data"
            label="Data"
            rules={[{ required: true, message: 'Informe a data.' }]}
          >
            <Input type="date" />
          </Form.Item>
          <Form.Item
            name="descricao"
            label="Descrição"
            rules={[{ required: true, message: 'Informe a descrição.' }]}
          >
            <Input placeholder="Recesso de fim de ano" />
          </Form.Item>
          <Form.Item name="tipo" label="Tipo">
            <Select
              options={Object.entries(TIPOS).map(([k, t]) => ({
                value: k,
                label: t.rotulo,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
