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
  Tag,
  Typography,
  message,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { api, queryDeFiltro } from '../api';
import FiltroPeriodo, { usarPeriodo } from '../components/FiltroPeriodo';
import { ExportarLista } from '../design/acoes';
import { useFornecedores, opcoesFornecedor } from '../hooks';
import { semanaAno } from '../semana';
import { FILTROS_DESVIO, situacaoDesvio } from '../components/DesvioQualidade';
import Tabela from '../components/Tabela';
import { CamposItem, ItemDaBase } from '../components/CamposItem';
import { CampoValorTotal, useValorTotal } from '../components/ValorTotal';
import { moeda, formatarMoedaInput, lerMoedaInput } from '../moeda';
import { numeroBR } from '../formatos';
import { TAG } from '../design/tokens';

const CAMPOS_VALOR = {
  quantidade: 'quantidadePecas',
  unitario: 'valorUnitario',
};
import { TIPOS_DESVIO, rotuloTipoDesvio } from '../tipo-desvio';

export const corStatusRnc: Record<string, string> = {
  EM_ANDAMENTO: TAG.andamento,
  FINALIZADA: TAG.sucesso,
  CANCELADA: TAG.neutro,
};

export const labelStatusRnc: Record<string, string> = {
  EM_ANDAMENTO: 'Em andamento',
  FINALIZADA: 'Finalizada',
  CANCELADA: 'Cancelada',
};

const corEficacia: Record<string, string> = {
  PENDENTE: TAG.pendencia,
  APROVADO: TAG.sucesso,
  REPROVADO: TAG.critico,
  NAO_APLICAVEL: TAG.neutro,
};

const labelEficacia: Record<string, string> = {
  PENDENTE: 'Pendente',
  APROVADO: 'Satisfatório',
  REPROVADO: 'Não satisfatório',
  NAO_APLICAVEL: 'N/A',
};

export default function RncLista() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const [filtroStatus, setFiltroStatus] = useState<string | undefined>();
  const [filtroFornecedor, setFiltroFornecedor] = useState<number | undefined>();
  const { data: fornecedores } = useFornecedores();

  // O formulario guarda codigo e descricao do item, nao o id. O id so aparece
  // quando o codigo e encontrado na base, e e ele que a consulta de
  // reincidencia precisa.
  const [itemRnc, setItemRnc] = useState<ItemDaBase | null>(null);

  // O recorte vale para a lista e para a exportacao: o PDF e a planilha saem
  // com exatamente o que esta na tela.
  const periodo = usarPeriodo();
  const filtro = {
    de: periodo.de,
    ate: periodo.ate,
    status: filtroStatus,
    fornecedorId: filtroFornecedor,
  };

  const hoje = dayjs();
  const { semana: semanaHoje, ano: anoHoje } = semanaAno(hoje.toDate());

  // O valor do desvio nasce de qtd x unitario, mas o inspetor pode digitar
  // outro valor quando o custo do desvio nao vem dessa conta.
  const ctrlTotal = useValorTotal(form, CAMPOS_VALOR);

  const { data, isLoading } = useQuery<any[]>({
    queryKey: [
      'rnc',
      filtro.de,
      filtro.ate,
      filtro.status,
      filtro.fornecedorId,
    ],
    queryFn: async () => (await api.get('/rnc', { params: filtro })).data,
  });

  const filtrosDe = (
    valores: (string | undefined)[],
  ): { text: string; value: string }[] =>
    Array.from(new Set(valores.filter(Boolean) as string[]))
      .sort()
      .map((v) => ({ text: v, value: v }));

  const filtrosFornecedor = filtrosDe((data ?? []).map((r) => r.fornecedor?.nome));
  const filtrosItem = filtrosDe((data ?? []).map((r) => r.item?.descricao));
  // O tipo e sempre DIMENSIONAL ou VISUAL; registros antigos guardavam o texto
  // inteiro do desvio, entao a listagem normaliza antes de filtrar e exibir.
  const filtrosTipo = filtrosDe(
    (data ?? []).map((r) => rotuloTipoDesvio(r.tipoDesvio)),
  );

  // Reincidencia ANTES de abrir a RNC: este fornecedor ja teve este mesmo
  // desvio neste item? Muda o que se pede a ele - a segunda vez nao se resolve
  // com retrabalho, pede analise de causa. Depois de aberta a RNC a tela do
  // registro refaz a mesma checagem; aqui e para quem ainda esta digitando.
  const fornecedorDaRnc = Form.useWatch('fornecedorId', form);
  const tipoDaRnc = Form.useWatch('tipoDesvio', form);
  const { data: reincidencia } = useQuery<any>({
    queryKey: ['rnc-reincidencia', fornecedorDaRnc, itemRnc?.id, tipoDaRnc],
    // Sem tipo de desvio nao ha o que comparar: e ele que diz o modo de falha
    // de uma RNC aberta a mao.
    enabled: open && !!fornecedorDaRnc && !!itemRnc && !!tipoDaRnc,
    queryFn: async () =>
      (
        await api.get('/rnc/reincidencia', {
          params: {
            fornecedorId: fornecedorDaRnc,
            itemId: itemRnc?.id,
            tipoDesvio: tipoDaRnc,
          },
        })
      ).data,
  });

  const salvar = useMutation({
    mutationFn: async (v: any) => (await api.post('/rnc', v)).data,
    onSuccess: (rnc: any) => {
      message.success(`RNC ${rnc.numero} aberta.`);
      qc.invalidateQueries({ queryKey: ['rnc'] });
      setOpen(false);
      setItemRnc(null);
      form.resetFields();
      navigate(`/rnc/${rnc.id}`);
    },
    onError: () => message.error('Não foi possível abrir a RNC.'),
  });

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <FiltroPeriodo controle={periodo}>
        <Col xs={24} sm={12} lg={11}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Status
          </Typography.Text>
          <Select
            allowClear
            placeholder="Todos"
            style={{ width: '100%' }}
            value={filtroStatus}
            onChange={setFiltroStatus}
            options={Object.entries(labelStatusRnc).map(([v, l]) => ({
              value: v,
              label: l,
            }))}
          />
        </Col>
        <Col xs={24} sm={12} lg={13}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Fornecedor
          </Typography.Text>
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Todos"
            style={{ width: '100%' }}
            value={filtroFornecedor}
            onChange={setFiltroFornecedor}
            options={opcoesFornecedor(fornecedores)}
          />
        </Col>
      </FiltroPeriodo>

      <Card
        title="RNC — Registros de Não Conformidade"
        extra={
          <Space wrap>
            <ExportarLista
              url={`/rnc/relatorio${queryDeFiltro(filtro)}`}
              nome="rnc"
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setOpen(true)}
            >
              Abrir RNC
            </Button>
          </Space>
        }
      >
        <Tabela
          busca="Buscar RNC (número, fornecedor, item, desvio...)"
          rowKey="id"
          loading={isLoading}
          dataSource={data}
          scroll={{ x: 'max-content' }}
          onRow={(r) => ({
            onClick: () => navigate(`/rnc/${r.id}`),
            style: { cursor: 'pointer' },
          })}
          columns={[
            { title: 'Número', dataIndex: 'numero', width: 100 },
            {
              title: 'Abertura',
              dataIndex: 'dataAbertura',
              width: 110,
              defaultSortOrder: 'descend',
              sorter: (a: any, b: any) =>
                dayjs(a.dataAbertura).valueOf() - dayjs(b.dataAbertura).valueOf(),
              render: (d: string) => dayjs(d).format('DD/MM/YYYY'),
            },
            { title: 'Semana', dataIndex: 'semana', width: 90, render: (v?: string) => v ?? '-' },
            { title: 'Ano', dataIndex: 'ano', width: 80 },
            {
              title: 'Fornecedor',
              filters: filtrosFornecedor,
              onFilter: (v: any, r: any) => r.fornecedor?.nome === v,
              render: (_: any, r: any) => r.fornecedor?.nome,
            },
            {
              title: 'Item',
              filters: filtrosItem,
              onFilter: (v: any, r: any) => r.item?.descricao === v,
              render: (_: any, r: any) => r.item?.descricao,
            },
            {
              title: 'Tipo de desvio',
              dataIndex: 'tipoDesvio',
              width: 160,
              filters: filtrosTipo,
              onFilter: (v: any, r: any) => rotuloTipoDesvio(r.tipoDesvio) === v,
              render: (v?: string) => rotuloTipoDesvio(v) || '-',
            },
            {
              title: 'Reincidência',
              dataIndex: 'reincidencia',
              width: 110,
              align: 'center',
              filters: [
                { text: 'Sim', value: true },
                { text: 'Não', value: false },
              ],
              onFilter: (v: any, r: any) => r.reincidencia === v,
              render: (v: boolean) =>
                v ? <Tag color="red">Sim</Tag> : <Tag>Não</Tag>,
            },
            {
              title: 'Desvio de qualidade',
              dataIndex: 'desvioQualidade',
              width: 150,
              align: 'center',
              filters: FILTROS_DESVIO,
              onFilter: (v: any, r: any) => situacaoDesvio(r).valor === v,
              render: (_: any, r: any) => {
                const s = situacaoDesvio(r);
                return <Tag color={s.cor}>{s.texto}</Tag>;
              },
            },
            {
              title: 'Valor (R$)',
              dataIndex: 'valorTotal',
              width: 120,
              align: 'right',
              sorter: (a: any, b: any) =>
                (a.valorTotal ?? 0) - (b.valorTotal ?? 0),
              render: (v?: number) => (v ? numeroBR(v, 2) : '-'),
            },
            {
              title: 'Status',
              dataIndex: 'status',
              width: 130,
              filters: Object.entries(labelStatusRnc).map(([value, text]) => ({
                text,
                value,
              })),
              onFilter: (v: any, r: any) => r.status === v,
              render: (s: string) => (
                <Tag color={corStatusRnc[s]}>{labelStatusRnc[s] ?? s}</Tag>
              ),
            },
            {
              title: 'Eficácia',
              dataIndex: 'verificacaoEficacia',
              width: 110,
              filters: Object.entries(labelEficacia).map(([value, text]) => ({
                text,
                value,
              })),
              onFilter: (v: any, r: any) => r.verificacaoEficacia === v,
              render: (e: string) => (
                <Tag color={corEficacia[e]}>{labelEficacia[e] ?? e}</Tag>
              ),
            },
            // Lead time INTERNO: da abertura ao envio do documento ao
            // fornecedor. So existe na tela; nao entra no PDF da RNC.
            {
              title: 'Envio ao fornecedor',
              dataIndex: 'enviadaFornecedor',
              width: 150,
              filters: [
                { text: 'Enviada', value: true },
                { text: 'Não enviada', value: false },
              ],
              onFilter: (v: any, r: any) => !!r.enviadaFornecedor === v,
              render: (_: any, r: any) =>
                r.enviadaFornecedor ? (
                  <Tag color="green">
                    {r.leadTimeEnvioDias != null
                      ? `Enviada — ${r.leadTimeEnvioDias} dia(s)`
                      : 'Enviada'}
                  </Tag>
                ) : (
                  <Tag color="orange">Não enviada</Tag>
                ),
            },
          ]}
        />
      </Card>

      <Modal
        title="Abrir RNC (Registro de Não Conformidade)"
        open={open}
        onCancel={() => {
          setOpen(false);
          setItemRnc(null);
        }}
        onOk={() => form.submit()}
        confirmLoading={salvar.isPending}
        okText="Abrir RNC"
        cancelText="Cancelar"
        width={680}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(v) => salvar.mutate(v)}
          onValuesChange={ctrlTotal.aoMudarValores}
          style={{ marginTop: 12 }}
        >
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item label="Data de abertura">
                <Input value={hoje.format('DD/MM/YYYY')} disabled />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Semana">
                <Input value={semanaHoje} disabled />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Ano">
                <Input value={String(anoHoje)} disabled />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="fornecedorId"
            label="Fornecedor"
            rules={[{ required: true, message: 'Selecione o fornecedor.' }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              options={opcoesFornecedor(fornecedores, { bloquearInativo: true })}
            />
          </Form.Item>
          {/* Codigo primeiro: achando na base, a descricao e o valor unitario
              entram sozinhos e o total do desvio sai de qtd x unitario. */}
          <CamposItem
            form={form}
            descricaoObrigatoria
            permitirCadastro
            aoResolver={(item) => {
              setItemRnc(item);
              if (item?.custoUnitario == null) return;
              form.setFieldValue('valorUnitario', item.custoUnitario);
              // setFieldValue nao passa pelo onValuesChange: refaz o total.
              if (!ctrlTotal.manual) ctrlTotal.recalcular();
            }}
          />
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="notaFiscal" label="Nota Fiscal">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="po" label="PO">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="quantidadeLote" label="Qtd. do lote">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="tipoDesvio" label="Tipo de desvio">
            <Select
              allowClear
              placeholder="Dimensional ou Visual"
              options={TIPOS_DESVIO.map((t) => ({ value: t, label: t }))}
            />
          </Form.Item>
          {/* Aparece so quando fornecedor, item e tipo ja estao preenchidos -
              antes disso nao ha o que comparar. */}
          {reincidencia?.reincidencia && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message="Reincidência: este fornecedor já teve este desvio neste item"
              description={
                <>
                  <ul style={{ margin: '4px 0 0 0', paddingLeft: 18 }}>
                    {reincidencia.anteriores.map((a: any) => (
                      <li key={a.id}>
                        <b>{a.numero}</b> (
                        {dayjs(a.dataAbertura).format('DD/MM/YYYY')}) —{' '}
                        {a.modos.join('; ')}
                      </li>
                    ))}
                  </ul>
                  <div style={{ marginTop: 6 }}>
                    Reincidência não se resolve com retrabalho: cobre análise de
                    causa e verificação de eficácia da ação anterior.
                  </div>
                </>
              }
            />
          )}
          <Form.Item
            name="descricaoDesvio"
            label="Descrição do desvio"
            rules={[{ required: true, message: 'Descreva o desvio.' }]}
          >
            <Input.TextArea rows={3} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="quantidadePecas" label="Qtd. de peças afetadas">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="valorUnitario" label="Valor unitário">
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={2}
                  formatter={formatarMoedaInput}
                  parser={lerMoedaInput as any}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <CampoValorTotal ctrl={ctrlTotal} label="Valor do desvio" />
            </Col>
          </Row>
          <Form.Item name="disposicao" label="Disposição">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
