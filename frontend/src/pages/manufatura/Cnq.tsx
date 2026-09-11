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
  Row,
  Select,
  Space,
  Statistic,
  Tooltip,
  Typography,
  message,
} from 'antd';
import { FileTextOutlined, PlusOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { api, queryDeFiltro } from '../../api';
import FiltroPeriodo, { usarPeriodo } from '../../components/FiltroPeriodo';
import { dataBR, dataInput, separadoresBR } from '../../formatos';
import { semanaAno } from '../../semana';
import Tabela, { filtrosDe } from '../../components/Tabela';
import { CamposItem } from '../../components/CamposItem';
import {
  CampoValorTotal,
  TagTotalManual,
  useValorTotal,
} from '../../components/ValorTotal';
import { moeda, formatarMoedaInput, lerMoedaInput } from '../../moeda';
import { BotaoEditar, BotaoExcluir, ExportarLista } from '../../design/acoes';

// Custo da Nao Qualidade — espelha a aba "Defeitos e CNQ" da planilha.
// Total = quantidade x valor unitario, mas pode ser digitado a mao quando o
// custo do desvio nao vem dessa conta.
const CAMPOS_VALOR = { quantidade: 'quantidade', unitario: 'valorUnitario' };

// A data do lancamento chega como meia-noite UTC: ler o trecho ISO evita que
// 28/07 vire a semana de 27/07 no fuso do navegador (ver src/formatos.ts).
function semanaDaData(valor?: string | Date | null): string {
  const iso = dataInput(valor);
  if (!iso) return '-';
  const [ano, mes, dia] = iso.split('-').map(Number);
  return semanaAno(new Date(ano, mes - 1, dia)).semana;
}

export default function Cnq() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState<any>(null);
  const [form] = Form.useForm();
  const [salvando, setSalvando] = useState(false);

  const ctrlTotal = useValorTotal(form, CAMPOS_VALOR);

  // Filtro da tela: o mesmo recorte vale para a lista, para os totais e para
  // a exportacao — os tres tem que mostrar a mesma coisa.
  const periodo = usarPeriodo();
  const [maquinaId, setMaquinaId] = useState<number | undefined>();

  const filtro = {
    de: periodo.de,
    ate: periodo.ate,
    maquinaId,
  };

  const { data, isLoading } = useQuery<any[]>({
    queryKey: ['manufatura-cnq', filtro.de, filtro.ate, filtro.maquinaId],
    queryFn: async () =>
      (await api.get('/manufatura/cnq', { params: filtro })).data,
  });

  const { data: maquinas } = useQuery<any[]>({
    queryKey: ['maquinas'],
    queryFn: async () => (await api.get('/maquinas')).data,
  });

  const { data: tipos } = useQuery<any[]>({
    queryKey: ['tipos-defeito'],
    queryFn: async () => (await api.get('/tipos-defeito')).data,
  });

  // "Outros" pede o defeito por escrito. Quem manda e a flag do cadastro, e nao
  // o nome do tipo: renomear a linha no cadastro nao pode apagar o campo.
  const tipoDefeitoId = Form.useWatch('tipoDefeitoId', form);
  const defeitoPedeDetalhe = !!(tipos ?? []).find(
    (t) => t.id === tipoDefeitoId,
  )?.exigeDetalhe;

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
    ctrlTotal.carregar(registro);
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
      <FiltroPeriodo controle={periodo}>
        <Col xs={24} sm={24} lg={24}>
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
      </FiltroPeriodo>

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
        /* O que sai no PDF e na planilha e exatamente o que o filtro acima
           esta mostrando. */
        extra={
          <Space wrap>
            <ExportarLista
              url={`/manufatura/cnq/relatorio${queryDeFiltro(filtro)}`}
              nome="cnq"
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => abrir()}
            >
              Novo lançamento
            </Button>
          </Space>
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
              // O filtro continua pelo tipo da lista: em "Outros" o texto
              // digitado acompanha o nome, mas nao vira uma opcao de filtro.
              render: (_: any, r: any) =>
                [r.tipoDefeito?.nome, r.defeitoOutros]
                  .filter(Boolean)
                  .join(' — ') || '-',
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
              render: (v: number, r: any) => (
                <>
                  <strong>{moeda(v)}</strong>
                  <TagTotalManual registro={r} campos={CAMPOS_VALOR} />
                </>
              ),
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
                    <Tooltip title="Abrir 8D ou 5G a partir deste CNQ">
                      <Button type="text" icon={<FileTextOutlined />} />
                    </Tooltip>
                  </Dropdown>
                  <BotaoEditar
                    emTabela
                    motivo="Corrigir este lançamento"
                    onClick={() => abrir(r)}
                  />
                  <BotaoExcluir
                    emTabela
                    motivo="Excluir este lançamento"
                    titulo={`Excluir o lançamento ${r.numero}?`}
                    descricao="O valor sai do CNQ do período. A exclusão é definitiva."
                    onConfirm={() => remover(r.id)}
                  />
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
        <Form
          form={form}
          layout="vertical"
          onValuesChange={ctrlTotal.aoMudarValores}
        >
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
            permitirCadastro
            aoResolver={(item) => {
              if (item?.custoUnitario == null) return;
              form.setFieldValue('valorUnitario', item.custoUnitario);
              // setFieldValue nao passa pelo onValuesChange, entao o total
              // precisa ser refeito na mao aqui.
              if (!ctrlTotal.manual) ctrlTotal.recalcular();
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
          {/* "Outros" nao diz nada sozinho: o defeito tem de ser escrito. O
              campo aparece pela flag do cadastro, nao pelo nome do tipo. */}
          {defeitoPedeDetalhe && (
            <Form.Item
              name="defeitoOutros"
              label="Qual defeito?"
              rules={[{ required: true, message: 'Descreva o defeito.' }]}
            >
              <Input maxLength={120} placeholder="Descreva o defeito" />
            </Form.Item>
          )}
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
              <CampoValorTotal ctrl={ctrlTotal} />
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
