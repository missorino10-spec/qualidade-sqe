import { useState } from 'react';
import {
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { EditOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { api } from '../../api';
import { dataInput, separadoresBR } from '../../formatos';

// Cadastro das maquinas/linhas + a grade de producao diaria (Qtd. produzida e
// Qtd. com defeito), que na planilha fica junto da propria maquina.

const corClassificacao: Record<string, string> = {
  A: 'green',
  B: 'blue',
  C: 'orange',
  D: 'red',
};

const AREAS = [
  { value: 'FABRICACAO', label: 'Fabricação' },
  { value: 'MONTAGEM', label: 'Montagem' },
];

function GradeProducao({ maquinaId }: { maquinaId: number }) {
  const qc = useQueryClient();
  const [mes, setMes] = useState(dayjs());
  const [linhas, setLinhas] = useState<Record<string, any>>({});
  const [salvando, setSalvando] = useState(false);

  const ano = mes.year();
  const numeroMes = mes.month() + 1;

  const { data, isLoading } = useQuery<any>({
    queryKey: ['maquina-producao', maquinaId, ano, numeroMes],
    queryFn: async () =>
      (
        await api.get(`/maquinas/${maquinaId}/producao`, {
          params: { ano, mes: numeroMes },
        })
      ).data,
  });

  // Uma linha por dia do mes, como na planilha. O que ja foi lancado vem do
  // banco; o que o usuario digita agora fica em "linhas" ate salvar.
  const diasNoMes = mes.daysInMonth();
  const salvos = new Map<string, any>(
    (data?.dias ?? []).map((d: any) => [dataInput(d.data), d]),
  );

  const dataSource = Array.from({ length: diasNoMes }, (_, i) => {
    const dia = mes.date(i + 1);
    const chave = dia.format('YYYY-MM-DD');
    const salvo = salvos.get(chave);
    const editado = linhas[chave];
    return {
      chave,
      dia,
      qtdProduzida: editado?.qtdProduzida ?? salvo?.qtdProduzida ?? null,
      qtdDefeito: editado?.qtdDefeito ?? salvo?.qtdDefeito ?? null,
      alterado: !!editado,
    };
  });

  function editar(chave: string, campo: string, valor: any) {
    setLinhas((atual) => ({
      ...atual,
      [chave]: { ...atual[chave], [campo]: valor },
    }));
  }

  async function salvar() {
    const pendentes = Object.entries(linhas);
    if (!pendentes.length) return;
    setSalvando(true);
    try {
      for (const [chave, valores] of pendentes) {
        const salvo = salvos.get(chave);
        await api.post(`/maquinas/${maquinaId}/producao`, {
          data: chave,
          qtdProduzida: valores.qtdProduzida ?? salvo?.qtdProduzida ?? 0,
          qtdDefeito: valores.qtdDefeito ?? salvo?.qtdDefeito ?? 0,
        });
      }
      message.success('Produção do mês salva.');
      setLinhas({});
      qc.invalidateQueries({ queryKey: ['maquina-producao', maquinaId] });
      qc.invalidateQueries({ queryKey: ['maquinas'] });
      qc.invalidateQueries({ queryKey: ['maquina', maquinaId] });
    } catch (e: any) {
      message.error(
        e?.response?.data?.message ?? 'Não foi possível salvar a produção.',
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Card
      size="small"
      title="Produção diária"
      extra={
        <Space>
          <Button size="small" onClick={() => setMes(mes.subtract(1, 'month'))}>
            {'<'}
          </Button>
          <Typography.Text strong>{mes.format('MM/YYYY')}</Typography.Text>
          <Button size="small" onClick={() => setMes(mes.add(1, 'month'))}>
            {'>'}
          </Button>
          <Button
            type="primary"
            size="small"
            icon={<SaveOutlined />}
            loading={salvando}
            disabled={!Object.keys(linhas).length}
            onClick={salvar}
          >
            Salvar
          </Button>
        </Space>
      }
    >
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={8}>
          <Statistic
            title="Produzidas no mês"
            value={data?.pecasProduzidas ?? 0}
            {...separadoresBR}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="Com defeito"
            value={data?.pecasComDefeito ?? 0}
            {...separadoresBR}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="PPM do mês"
            value={data?.ppm ?? 0}
            {...separadoresBR}
          />
        </Col>
      </Row>
      <Table
        size="small"
        rowKey="chave"
        loading={isLoading}
        dataSource={dataSource}
        pagination={false}
        scroll={{ y: 340 }}
        columns={[
          {
            title: 'Dia',
            width: 130,
            render: (_: any, r: any) => r.dia.format('DD/MM ddd'),
          },
          {
            title: 'Qtd. produzida',
            width: 160,
            render: (_: any, r: any) => (
              <InputNumber
                size="small"
                min={0}
                style={{ width: '100%' }}
                value={r.qtdProduzida}
                onChange={(v) => editar(r.chave, 'qtdProduzida', v)}
              />
            ),
          },
          {
            title: 'Qtd. com defeito',
            width: 160,
            render: (_: any, r: any) => (
              <InputNumber
                size="small"
                min={0}
                style={{ width: '100%' }}
                value={r.qtdDefeito}
                onChange={(v) => editar(r.chave, 'qtdDefeito', v)}
              />
            ),
          },
          {
            title: '',
            render: (_: any, r: any) =>
              r.alterado ? <Tag color="gold">não salvo</Tag> : null,
          },
        ]}
      />
    </Card>
  );
}

export default function Maquinas() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState<any>(null);
  const [form] = Form.useForm();
  const [salvando, setSalvando] = useState(false);
  const [detalhe, setDetalhe] = useState<any>(null);

  const { data, isLoading } = useQuery<any[]>({
    queryKey: ['maquinas', 'todas'],
    queryFn: async () =>
      (await api.get('/maquinas', { params: { todas: 'true' } })).data,
  });

  function abrir(maquina?: any) {
    setEditando(maquina ?? null);
    form.resetFields();
    form.setFieldsValue(
      maquina ?? {
        area: 'FABRICACAO',
        classificacao: 'C',
        frequenciaProducaoN: 1,
        ativa: true,
      },
    );
    setOpen(true);
  }

  async function salvar() {
    const v = await form.validateFields();
    setSalvando(true);
    try {
      if (editando) await api.patch(`/maquinas/${editando.id}`, v);
      else await api.post('/maquinas', v);
      message.success('Máquina salva.');
      qc.invalidateQueries({ queryKey: ['maquinas'] });
      setOpen(false);
    } catch (e: any) {
      message.error(
        e?.response?.data?.message ?? 'Não foi possível salvar a máquina.',
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card
        title="Máquinas e linhas"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => abrir()}>
            Nova máquina
          </Button>
        }
      >
        <Table
          rowKey="id"
          size="small"
          loading={isLoading}
          dataSource={data}
          scroll={{ x: 1100 }}
          onRow={(r) => ({
            onClick: () => setDetalhe(r),
            style: { cursor: 'pointer' },
          })}
          columns={[
            { title: 'Código', dataIndex: 'codigo', width: 100 },
            { title: 'Máquina / Linha', dataIndex: 'nome' },
            {
              title: 'Área',
              dataIndex: 'area',
              width: 120,
              render: (a: string) =>
                AREAS.find((x) => x.value === a)?.label ?? a,
            },
            {
              title: 'Classificação',
              dataIndex: 'classificacao',
              width: 120,
              align: 'center',
              render: (c: string) => <Tag color={corClassificacao[c]}>{c}</Tag>,
            },
            {
              title: '1 produção a cada',
              dataIndex: 'frequenciaProducaoN',
              width: 150,
              align: 'center',
              render: (n: number) => `${n} setup${n > 1 ? 's' : ''}`,
            },
            {
              title: 'Setups no ciclo',
              width: 130,
              align: 'center',
              render: (_: any, r: any) =>
                `${r.contadorSetups} / ${r.frequenciaProducaoN}`,
            },
            {
              title: 'PPM',
              dataIndex: 'ppm',
              width: 100,
              align: 'right',
              render: (v: number) => v?.toLocaleString('pt-BR') ?? 0,
            },
            {
              title: 'Status',
              dataIndex: 'ativa',
              width: 90,
              align: 'center',
              render: (a: boolean) =>
                a ? <Tag color="green">Ativa</Tag> : <Tag>Inativa</Tag>,
            },
            {
              title: '',
              width: 50,
              fixed: 'right',
              render: (_: any, r: any) => (
                <Button
                  type="text"
                  icon={<EditOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    abrir(r);
                  }}
                />
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={open}
        title={editando ? `Máquina ${editando.codigo}` : 'Nova máquina'}
        okText="Salvar"
        cancelText="Cancelar"
        confirmLoading={salvando}
        onOk={salvar}
        onCancel={() => setOpen(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item
                name="codigo"
                label="Código"
                rules={[{ required: true, message: 'Informe o código' }]}
              >
                <Input placeholder="MAQ16" />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item
                name="nome"
                label="Máquina / Linha"
                rules={[{ required: true, message: 'Informe o nome' }]}
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="area" label="Área">
                <Select options={AREAS} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="classificacao"
                label="Classificação"
                tooltip="Definida manualmente pela Qualidade."
              >
                <Select
                  options={['A', 'B', 'C', 'D'].map((c) => ({
                    value: c,
                    label: c,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="frequenciaProducaoN"
                label="1 inspeção de produção a cada"
                tooltip="Nº de setups que fecham o ciclo e disparam a inspeção de produção."
              >
                <InputNumber min={1} style={{ width: '100%' }} addonAfter="setups" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="descricao" label="Descrição">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="ativa" label="Ativa" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        open={!!detalhe}
        width={760}
        title={detalhe ? `${detalhe.codigo} — ${detalhe.nome}` : ''}
        onClose={() => setDetalhe(null)}
        destroyOnClose
      >
        {detalhe && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Descriptions size="small" bordered column={2}>
              <Descriptions.Item label="Área">
                {AREAS.find((a) => a.value === detalhe.area)?.label ?? detalhe.area}
              </Descriptions.Item>
              <Descriptions.Item label="Classificação">
                <Tag color={corClassificacao[detalhe.classificacao]}>
                  {detalhe.classificacao}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Setups realizados">
                {detalhe.setupsRealizados}
              </Descriptions.Item>
              <Descriptions.Item label="Produções realizadas">
                {detalhe.producoesRealizadas}
              </Descriptions.Item>
              <Descriptions.Item label="Setups no ciclo atual">
                {`${detalhe.contadorSetups} / ${detalhe.frequenciaProducaoN}`}
              </Descriptions.Item>
              <Descriptions.Item label="Inspeções reprovadas">
                {detalhe.inspecoesReprovadas}
              </Descriptions.Item>
            </Descriptions>
            <GradeProducao maquinaId={detalhe.id} />
          </Space>
        )}
      </Drawer>
    </Space>
  );
}
