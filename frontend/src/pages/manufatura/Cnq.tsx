import { useState } from 'react';
import {
  Button,
  Card,
  Col,
  Dropdown,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Typography,
  message,
} from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  FilePdfOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { abrirPdfEmNovaAba, api } from '../../api';
import { dataBR, dataInput, separadoresBR } from '../../formatos';
import { semanaAno } from '../../semana';
import Tabela, { filtrosDe } from '../../components/Tabela';
import { CamposItem } from '../../components/CamposItem';
import { moeda, formatarMoedaInput, lerMoedaInput } from '../../moeda';

// Custo da Nao Qualidade — espelha a aba "Defeitos e CNQ" da planilha.
// Total = quantidade x valor unitario, calculado no backend.

// Atalhos do filtro de periodo. A semana e de DOMINGO a SABADO, como no
// restante do sistema (src/semana.ts).
const PERIODOS: { value: string; label: string }[] = [
  { value: 'SEMANA', label: 'Semana atual' },
  { value: 'MES', label: 'Mês atual' },
  { value: 'ANO', label: 'Ano atual' },
  { value: 'TUDO', label: 'Todo o período' },
  { value: 'PERSONALIZADO', label: 'Personalizado' },
];

// A data do lancamento chega como meia-noite UTC: ler o trecho ISO evita que
// 28/07 vire a semana de 27/07 no fuso do navegador (ver src/formatos.ts).
function semanaDaData(valor?: string | Date | null): string {
  const iso = dataInput(valor);
  if (!iso) return '-';
  const [ano, mes, dia] = iso.split('-').map(Number);
  return semanaAno(new Date(ano, mes - 1, dia)).semana;
}

function intervaloDoPeriodo(periodo: string): { de?: string; ate?: string } {
  const hoje = dayjs();
  const fmt = (d: dayjs.Dayjs) => d.format('YYYY-MM-DD');
  if (periodo === 'SEMANA')
    return { de: fmt(hoje.startOf('week')), ate: fmt(hoje.endOf('week')) };
  if (periodo === 'MES')
    return { de: fmt(hoje.startOf('month')), ate: fmt(hoje.endOf('month')) };
  if (periodo === 'ANO')
    return { de: fmt(hoje.startOf('year')), ate: fmt(hoje.endOf('year')) };
  return {};
}

export default function Cnq() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState<any>(null);
  const [form] = Form.useForm();
  const [salvando, setSalvando] = useState(false);

  const quantidade = Form.useWatch('quantidade', form);
  const valorUnitario = Form.useWatch('valorUnitario', form);

  // Filtro da tela: o mesmo recorte vale para a lista, para os totais e para
  // o PDF. Abre sem recorte para nao esconder lancamentos de meses anteriores.
  const [periodo, setPeriodo] = useState('TUDO');
  const [intervalo, setIntervalo] = useState(intervaloDoPeriodo('TUDO'));
  const [maquinaId, setMaquinaId] = useState<number | undefined>();

  const filtro = {
    de: intervalo.de || undefined,
    ate: intervalo.ate || undefined,
    maquinaId,
  };

  const { data, isLoading } = useQuery<any[]>({
    queryKey: ['manufatura-cnq', filtro.de, filtro.ate, filtro.maquinaId],
    queryFn: async () =>
      (await api.get('/manufatura/cnq', { params: filtro })).data,
  });

  function trocarPeriodo(v: string) {
    setPeriodo(v);
    // "Personalizado" mantem as datas que ja estavam para o usuario so ajustar.
    if (v !== 'PERSONALIZADO') setIntervalo(intervaloDoPeriodo(v));
  }

  // Mexer numa data manualmente passa o filtro para "Personalizado".
  function trocarData(campo: 'de' | 'ate', valor: string) {
    setPeriodo('PERSONALIZADO');
    setIntervalo((atual) => ({ ...atual, [campo]: valor }));
  }

  const { data: maquinas } = useQuery<any[]>({
    queryKey: ['maquinas'],
    queryFn: async () => (await api.get('/maquinas')).data,
  });

  const { data: tipos } = useQuery<any[]>({
    queryKey: ['tipos-defeito'],
    queryFn: async () => (await api.get('/tipos-defeito')).data,
  });

  const total = (data ?? []).reduce((s, c) => s + (c.valorTotal ?? 0), 0);
  const pecas = (data ?? []).reduce((s, c) => s + (c.quantidade ?? 0), 0);

  function abrir(registro?: any) {
    setEditando(registro ?? null);
    form.resetFields();
    form.setFieldsValue(
      registro
        ? {
            ...registro,
            data: dataInput(registro.data),
          }
        : {
            data: dayjs().format('YYYY-MM-DD'),
            quantidade: 1,
          },
    );
    setOpen(true);
  }

  async function salvar() {
    const v = await form.validateFields();
    setSalvando(true);
    try {
      if (editando) await api.patch(`/manufatura/cnq/${editando.id}`, v);
      else await api.post('/manufatura/cnq', v);
      message.success('Lançamento de CNQ salvo.');
      qc.invalidateQueries({ queryKey: ['manufatura-cnq'] });
      setOpen(false);
    } catch (e: any) {
      message.error(
        e?.response?.data?.message ?? 'Não foi possível salvar o lançamento.',
      );
    } finally {
      setSalvando(false);
    }
  }

  async function remover(id: number) {
    try {
      await api.delete(`/manufatura/cnq/${id}`);
      message.success('Lançamento excluído.');
      qc.invalidateQueries({ queryKey: ['manufatura-cnq'] });
    } catch (e: any) {
      message.error(
        e?.response?.data?.message ?? 'Não foi possível excluir o lançamento.',
      );
    }
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* O filtro vale para a lista, para os totais e para o PDF. */}
      <Card size="small">
        <Row gutter={[12, 12]} align="bottom">
          <Col xs={24} sm={12} lg={5}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Período
            </Typography.Text>
            <Select
              style={{ width: '100%' }}
              value={periodo}
              onChange={trocarPeriodo}
              options={PERIODOS}
            />
          </Col>
          <Col xs={12} sm={6} lg={4}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              De
            </Typography.Text>
            <Input
              type="date"
              value={intervalo.de ?? ''}
              onChange={(e) => trocarData('de', e.target.value)}
            />
          </Col>
          <Col xs={12} sm={6} lg={4}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Até
            </Typography.Text>
            <Input
              type="date"
              value={intervalo.ate ?? ''}
              onChange={(e) => trocarData('ate', e.target.value)}
            />
          </Col>
          <Col xs={24} sm={12} lg={7}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Máquina / linha
            </Typography.Text>
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Todas"
              style={{ width: '100%' }}
              value={maquinaId}
              onChange={setMaquinaId}
              options={(maquinas ?? []).map((m) => ({
                value: m.id,
                label: `${m.codigo} — ${m.nome}`,
              }))}
            />
          </Col>
          <Col xs={24} lg={4}>
            <Button
              block
              icon={<FilePdfOutlined />}
              onClick={() =>
                abrirPdfEmNovaAba(
                  `/manufatura/cnq/pdf?${new URLSearchParams(
                    Object.entries(filtro)
                      .filter(([, v]) => v !== undefined && v !== '')
                      .map(([k, v]) => [k, String(v)]),
                  ).toString()}`,
                )
              }
            >
              Exportar PDF
            </Button>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic title="CNQ total" value={moeda(total)} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic title="Peças lançadas" value={pecas} {...separadoresBR} />
          </Card>
        </Col>
        <Col xs={24} sm={24} lg={8}>
          <Card>
            <Statistic title="Lançamentos" value={data?.length ?? 0} />
          </Card>
        </Col>
      </Row>

      <Card
        title="Custo da Não Qualidade (CNQ)"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => abrir()}>
            Novo lançamento
          </Button>
        }
      >
        <Tabela
          busca="Buscar lançamento (item, máquina, categoria...)"
          rowKey="id"
          size="small"
          loading={isLoading}
          dataSource={data}
          scroll={{ x: 'max-content' }}
          columns={[
            { title: 'Número', dataIndex: 'numero', width: 120 },
            {
              title: 'Data',
              dataIndex: 'data',
              width: 110,
              render: (d: string) => dataBR(d),
            },
            {
              title: 'Semana',
              width: 90,
              filters: filtrosDe((data ?? []).map((r: any) => semanaDaData(r.data))),
              onFilter: (v: any, r: any) => semanaDaData(r.data) === v,
              render: (_: any, r: any) => semanaDaData(r.data),
            },
            {
              title: 'Máquina',
              width: 170,
              filters: filtrosDe((data ?? []).map((r: any) => r.maquina?.nome)),
              onFilter: (v: any, r: any) => r.maquina?.nome === v,
              render: (_: any, r: any) => r.maquina?.nome ?? '-',
            },
            {
              title: 'Item',
              filters: filtrosDe((data ?? []).map((r: any) => r.itemCodigo)),
              onFilter: (v: any, r: any) => r.itemCodigo === v,
              render: (_: any, r: any) =>
                [r.itemCodigo, r.itemDescricao].filter(Boolean).join(' — ') || '-',
            },
            {
              title: 'Descrição do defeito',
              width: 200,
              filters: filtrosDe(
                (data ?? []).map((r: any) => r.tipoDefeito?.nome),
              ),
              onFilter: (v: any, r: any) => r.tipoDefeito?.nome === v,
              render: (_: any, r: any) => r.tipoDefeito?.nome ?? '-',
            },
            {
              title: 'Qtd.',
              dataIndex: 'quantidade',
              width: 80,
              align: 'right',
            },
            {
              title: 'Valor unit.',
              dataIndex: 'valorUnitario',
              width: 120,
              align: 'right',
              render: moeda,
            },
            {
              title: 'Total',
              dataIndex: 'valorTotal',
              width: 130,
              align: 'right',
              render: (v: number) => <strong>{moeda(v)}</strong>,
            },
            { title: 'Ação', dataIndex: 'acao', width: 200 },
            {
              title: '',
              width: 140,
              render: (_: any, r: any) => (
                <Space size={0}>
                  {/* Nem todo CNQ vira 8D: a maioria e resolvida com o 5G, no
                      posto de trabalho. Quem lanca escolhe o documento. */}
                  <Dropdown
                    trigger={['click']}
                    menu={{
                      items: [
                        { key: '8D', label: 'Abrir 8D a partir deste CNQ' },
                        { key: '5G', label: 'Abrir 5G a partir deste CNQ' },
                      ],
                      onClick: ({ key }) =>
                        navigate(`/manufatura/8d?cnqId=${r.id}&tipo=${key}`),
                    }}
                  >
                    <Button
                      type="text"
                      icon={<FileTextOutlined />}
                      title="Abrir 8D ou 5G a partir deste CNQ"
                    />
                  </Dropdown>
                  <Button
                    type="text"
                    icon={<EditOutlined />}
                    onClick={() => abrir(r)}
                  />
                  <Popconfirm
                    title="Excluir este lançamento?"
                    okText="Excluir"
                    cancelText="Cancelar"
                    onConfirm={() => remover(r.id)}
                  >
                    <Button type="text" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={open}
        title={editando ? `CNQ ${editando.numero}` : 'Novo lançamento de CNQ'}
        width={760}
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
              <Form.Item name="data" label="Data">
                <Input type="date" />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item
                name="maquinaId"
                label="Máquina / linha"
                rules={[{ required: true, message: 'Selecione a máquina.' }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={(maquinas ?? []).map((m) => ({
                    value: m.id,
                    label: `${m.codigo} — ${m.nome}`,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>
          {/* Achando o codigo na base, a descricao e o custo unitario entram
              sozinhos e o CNQ da linha sai de quantidade x unitario. */}
          <CamposItem
            form={form}
            rotuloCodigo="Nº do item"
            rotuloDescricao="Descrição do item"
            aoResolver={(item) => {
              if (item?.custoUnitario != null)
                form.setFieldValue('valorUnitario', item.custoUnitario);
            }}
          />
          <Form.Item
            name="tipoDefeitoId"
            label="Descrição do defeito"
            rules={[{ required: true, message: 'Selecione o defeito.' }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              options={(tipos ?? []).map((t) => ({
                value: t.id,
                label: t.nome,
              }))}
            />
          </Form.Item>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="quantidade" label="Quantidade">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="valorUnitario" label="Valor unitário">
                <InputNumber
                  min={0}
                  step={0.01}
                  precision={2}
                  style={{ width: '100%' }}
                  formatter={formatarMoedaInput}
                  parser={lerMoedaInput as any}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Total">
                <Typography.Text strong style={{ fontSize: 18 }}>
                  {moeda((quantidade ?? 0) * (valorUnitario ?? 0))}
                </Typography.Text>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="acao" label="Ação">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="observacoes" label="Observações">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
