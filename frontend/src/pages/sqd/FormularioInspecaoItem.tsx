import {
  Button,
  Col,
  Divider,
  Form,
  Input,
  InputNumber,
  Radio,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { labelOrigemInspecao, opcoes } from './comum';

// Relatorio de inspecao da HOMOLOGACAO DE ITENS: as duas abas que substituem a
// autoavaliacao do modulo de fornecedores.
//   AMOSTRAS - BDBR.QUA.FMR.011.06 rev. 06
//   VISUAL   - BDBR.QUA.FMR.06.07  rev. 07
// A tolerancia e o desvio sao recalculados na digitacao, com as mesmas formulas
// que o backend refaz ao salvar (itens-utils.ts).

export type StatusVisual = 'APROVADO' | 'REPROVADO' | 'NAO_APLICAVEL';

export type GrupoVisual = {
  grupo: string;
  itens: { texto: string; status: StatusVisual }[];
};

export type Cota = {
  localizacao?: string;
  especificado?: string | number | null;
  tolerancia?: string | number | null;
  upper?: string | number | null;
  lower?: string | number | null;
  pecas: (string | number | null)[];
  instrumento?: string;
  desvioMin?: string | number | null;
  desvioMax?: string | number | null;
};

export const PECAS_PADRAO = 5;

export function cotaVazia(qtdPecas = PECAS_PADRAO): Cota {
  return {
    localizacao: '',
    especificado: '',
    tolerancia: '',
    upper: '',
    lower: '',
    pecas: Array.from({ length: qtdPecas }, () => ''),
    instrumento: '',
    desvioMin: '',
    desvioMax: '',
  };
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function arredondar2(n: number) {
  return Math.round(n * 100) / 100;
}

// ISO 2768 - media, a mesma escada da coluna K da planilha. Acima de 1000 mm a
// celula fica vazia e a tolerancia e informada a mao.
export function toleranciaPadrao(especificado: number): number | null {
  if (!Number.isFinite(especificado)) return null;
  const v = Math.abs(especificado);
  if (v < 6) return 0.1;
  if (v < 30) return 0.2;
  if (v < 120) return 0.3;
  if (v < 400) return 0.5;
  if (v < 1000) return 0.8;
  return null;
}

// Refaz tolerancia, upper/lower e desvios da cota. `manual` diz se a tolerancia
// foi digitada pelo inspetor — nesse caso ela nao e sobrescrita.
export function calcularCota(cota: Cota, toleranciaManual = false): Cota {
  const especificado = num(cota.especificado);
  if (especificado === null) {
    return { ...cota, upper: '', lower: '', desvioMin: '', desvioMax: '' };
  }

  const tolerancia = toleranciaManual
    ? num(cota.tolerancia)
    : (num(cota.tolerancia) ?? toleranciaPadrao(especificado));
  if (tolerancia === null) {
    return { ...cota, upper: '', lower: '', desvioMin: '', desvioMax: '' };
  }

  const upper = arredondar2(especificado + tolerancia);
  const lower = arredondar2(especificado - tolerancia);

  const medidas = (cota.pecas ?? [])
    .map(num)
    .filter((n): n is number => n !== null);

  let desvioMin: number | string = '';
  let desvioMax: number | string = '';
  if (medidas.length) {
    const min = Math.min(...medidas);
    const max = Math.max(...medidas);
    desvioMin = arredondar2(min < lower ? lower - min : 0);
    desvioMax = arredondar2(max > upper ? max - upper : 0);
  }

  return { ...cota, tolerancia, upper, lower, desvioMin, desvioMax };
}

// Uma peca esta fora quando cai fora da faixa upper/lower da cota.
export function pecaForaDaFaixa(cota: Cota, valor: unknown): boolean {
  const v = num(valor);
  const upper = num(cota.upper);
  const lower = num(cota.lower);
  if (v === null || upper === null || lower === null) return false;
  return v > upper || v < lower;
}

export function cotasComDesvio(cotas: Cota[]): boolean {
  return cotas.some(
    (c) => (num(c.desvioMin) ?? 0) > 0 || (num(c.desvioMax) ?? 0) > 0,
  );
}

export function resultadoVisual(checklist: GrupoVisual[]) {
  const reprovou = checklist.some((g) =>
    g.itens.some((i) => i.status === 'REPROVADO'),
  );
  return reprovou ? 'REPROVADO' : 'APROVADO';
}

// Checklist em branco a partir do catalogo que o backend devolve em
// GET /sqd/homologacoes-itens/formulario.
export function checklistInicial(
  catalogo: { grupo: string; itens: string[] }[],
): GrupoVisual[] {
  return catalogo.map((g) => ({
    grupo: g.grupo,
    itens: g.itens.map((texto) => ({
      texto,
      status: 'NAO_APLICAVEL' as StatusVisual,
    })),
  }));
}

// ---------------------------------------------------------------------------
// AMOSTRAS
// ---------------------------------------------------------------------------
export function TabelaCotas({
  cotas,
  setCotas,
}: {
  cotas: Cota[];
  setCotas: (c: Cota[]) => void;
}) {
  // O numero de colunas de peca acompanha a maior cota lancada.
  const qtdPecas = Math.max(
    PECAS_PADRAO,
    ...cotas.map((c) => c.pecas?.length ?? 0),
  );

  function alterar(i: number, campo: keyof Cota, valor: any) {
    const proximas = cotas.map((c, idx) =>
      idx === i ? { ...c, [campo]: valor } : c,
    );
    // Se o inspetor apagou a tolerancia, ela volta a ser automatica.
    const manual = campo === 'tolerancia' && valor !== '' && valor != null;
    proximas[i] = calcularCota(proximas[i], manual);
    setCotas(proximas);
  }

  function alterarPeca(i: number, p: number, valor: any) {
    const proximas = cotas.map((c, idx) => {
      if (idx !== i) return c;
      const pecas = [...(c.pecas ?? [])];
      while (pecas.length < qtdPecas) pecas.push('');
      pecas[p] = valor;
      return { ...c, pecas };
    });
    proximas[i] = calcularCota(proximas[i], true);
    setCotas(proximas);
  }

  const colunasPecas = Array.from({ length: qtdPecas }, (_, p) => ({
    title: `P${p + 1}`,
    width: 80,
    render: (_: any, __: Cota, i: number) => {
      const fora = pecaForaDaFaixa(cotas[i], cotas[i].pecas?.[p]);
      return (
        <Input
          size="small"
          status={fora ? 'error' : undefined}
          style={fora ? { color: '#cf1322', fontWeight: 600 } : undefined}
          value={(cotas[i].pecas?.[p] ?? '') as string}
          onChange={(e) => alterarPeca(i, p, e.target.value)}
        />
      );
    },
  }));

  return (
    <>
      <Table
        rowKey={(_, i) => String(i)}
        size="small"
        pagination={false}
        dataSource={cotas}
        scroll={{ x: 1200 }}
        locale={{ emptyText: 'Nenhuma cota lançada.' }}
        columns={[
          {
            title: 'Localização',
            width: 150,
            fixed: 'left',
            render: (_: any, __: Cota, i: number) => (
              <Input
                size="small"
                value={cotas[i].localizacao}
                onChange={(e) => alterar(i, 'localizacao', e.target.value)}
              />
            ),
          },
          {
            title: 'Especificado',
            width: 110,
            render: (_: any, __: Cota, i: number) => (
              <Input
                size="small"
                value={(cotas[i].especificado ?? '') as string}
                onChange={(e) => alterar(i, 'especificado', e.target.value)}
              />
            ),
          },
          {
            title: 'Tolerância',
            width: 110,
            render: (_: any, __: Cota, i: number) => (
              <Input
                size="small"
                placeholder="auto"
                value={(cotas[i].tolerancia ?? '') as string}
                onChange={(e) => alterar(i, 'tolerancia', e.target.value)}
              />
            ),
          },
          {
            title: 'Máx.',
            width: 90,
            align: 'right',
            render: (_: any, __: Cota, i: number) => cotas[i].upper ?? '-',
          },
          {
            title: 'Mín.',
            width: 90,
            align: 'right',
            render: (_: any, __: Cota, i: number) => cotas[i].lower ?? '-',
          },
          ...colunasPecas,
          {
            title: 'Instrumento',
            width: 140,
            render: (_: any, __: Cota, i: number) => (
              <Input
                size="small"
                value={cotas[i].instrumento}
                onChange={(e) => alterar(i, 'instrumento', e.target.value)}
              />
            ),
          },
          {
            title: 'Desvio mín.',
            width: 100,
            align: 'right',
            render: (_: any, __: Cota, i: number) => {
              const v = num(cotas[i].desvioMin);
              return v ? <Tag color="red">{v}</Tag> : (cotas[i].desvioMin ?? '-');
            },
          },
          {
            title: 'Desvio máx.',
            width: 100,
            align: 'right',
            render: (_: any, __: Cota, i: number) => {
              const v = num(cotas[i].desvioMax);
              return v ? <Tag color="red">{v}</Tag> : (cotas[i].desvioMax ?? '-');
            },
          },
          {
            title: '',
            width: 50,
            align: 'center',
            fixed: 'right',
            render: (_: any, __: Cota, i: number) => (
              <Button
                type="text"
                danger
                size="small"
                icon={<DeleteOutlined />}
                onClick={() => setCotas(cotas.filter((_, idx) => idx !== i))}
              />
            ),
          },
        ]}
      />
      <Space style={{ marginTop: 8 }}>
        <Button
          icon={<PlusOutlined />}
          size="small"
          onClick={() => setCotas([...cotas, cotaVazia(qtdPecas)])}
        >
          Adicionar cota
        </Button>
        <Button
          size="small"
          onClick={() =>
            setCotas(
              cotas.map((c) => ({
                ...c,
                pecas: [...(c.pecas ?? []), ''],
              })),
            )
          }
        >
          Adicionar peça
        </Button>
      </Space>
      <Typography.Paragraph
        type="secondary"
        style={{ fontSize: 12, marginTop: 8 }}
      >
        A tolerância é calculada pela medida especificada (ISO 2768 — média),
        como na coluna K da planilha. Digite um valor para sobrescrever; apague
        para voltar ao automático. Acima de 1000 mm ela precisa ser informada.
      </Typography.Paragraph>
    </>
  );
}

// ---------------------------------------------------------------------------
// VISUAL
// ---------------------------------------------------------------------------
export function ChecklistVisual({
  checklist,
  setChecklist,
}: {
  checklist: GrupoVisual[];
  setChecklist: (c: GrupoVisual[]) => void;
}) {
  function marcar(g: number, i: number, status: StatusVisual) {
    setChecklist(
      checklist.map((grupo, gi) =>
        gi !== g
          ? grupo
          : {
              ...grupo,
              itens: grupo.itens.map((item, ii) =>
                ii !== i ? item : { ...item, status },
              ),
            },
      ),
    );
  }

  function marcarGrupo(g: number, status: StatusVisual) {
    setChecklist(
      checklist.map((grupo, gi) =>
        gi !== g
          ? grupo
          : { ...grupo, itens: grupo.itens.map((i) => ({ ...i, status })) },
      ),
    );
  }

  return (
    <>
      {checklist.map((grupo, gi) => (
        <div key={grupo.grupo} style={{ marginTop: 16 }}>
          <Space wrap>
            <Typography.Text strong>{grupo.grupo}</Typography.Text>
            <Button size="small" onClick={() => marcarGrupo(gi, 'APROVADO')}>
              Tudo aprovado
            </Button>
            <Button
              size="small"
              onClick={() => marcarGrupo(gi, 'NAO_APLICAVEL')}
            >
              Tudo N/A
            </Button>
          </Space>
          <Table
            style={{ marginTop: 8 }}
            rowKey={(_, i) => `${gi}-${i}`}
            size="small"
            pagination={false}
            dataSource={grupo.itens}
            columns={[
              { title: 'Item', dataIndex: 'texto' },
              {
                title: 'Status',
                width: 260,
                align: 'right',
                render: (_: any, item: any, ii: number) => (
                  <Radio.Group
                    size="small"
                    optionType="button"
                    value={item.status}
                    onChange={(e) => marcar(gi, ii, e.target.value)}
                    options={[
                      { value: 'APROVADO', label: 'Aprovado' },
                      { value: 'REPROVADO', label: 'Reprovado' },
                      { value: 'NAO_APLICAVEL', label: 'N/A' },
                    ]}
                  />
                ),
              },
            ]}
          />
        </div>
      ))}
      <Typography.Paragraph
        type="secondary"
        style={{ fontSize: 12, marginTop: 8 }}
      >
        Como no papel, tudo começa em "N/A" e o inspetor marca só o que o item
        exige. Basta um item reprovado para a aba VISUAL reprovar.
      </Typography.Paragraph>
    </>
  );
}

// ---------------------------------------------------------------------------
// Cabecalho do relatorio (campos do Form)
// ---------------------------------------------------------------------------
export function CamposCabecalhoInspecao() {
  return (
    <Row gutter={12}>
      <Col xs={12} md={6}>
        <Form.Item
          name="dataInspecao"
          label="Data da inspeção"
          rules={[{ required: true, message: 'Informe a data da inspeção.' }]}
        >
          <Input type="date" />
        </Form.Item>
      </Col>
      <Col xs={12} md={6}>
        <Form.Item name="origem" label="Origem">
          <Select options={opcoes(labelOrigemInspecao)} />
        </Form.Item>
      </Col>
      <Col xs={12} md={6}>
        <Form.Item name="desenhoRev" label="Desenho / Rev.">
          <Input />
        </Form.Item>
      </Col>
      <Col xs={12} md={6}>
        <Form.Item name="tolerancias" label="Tolerâncias (norma)">
          <Input placeholder="ISO 2768 - média" />
        </Form.Item>
      </Col>
      <Col xs={12} md={6}>
        <Form.Item name="nf" label="NF">
          <Input />
        </Form.Item>
      </Col>
      <Col xs={12} md={6}>
        <Form.Item name="po" label="PO">
          <Input />
        </Form.Item>
      </Col>
      <Col xs={12} md={6}>
        <Form.Item name="qtdInspecionada" label="Qtd. inspecionada">
          <InputNumber style={{ width: '100%' }} min={0} />
        </Form.Item>
      </Col>
      <Col xs={12} md={6}>
        <Form.Item name="qtdTotal" label="Qtd. total do lote">
          <InputNumber style={{ width: '100%' }} min={0} />
        </Form.Item>
      </Col>
      <Col xs={12} md={6}>
        <Form.Item name="elaboradoPor" label="Elaborado por">
          <Input />
        </Form.Item>
      </Col>
      <Col xs={12} md={6}>
        <Form.Item name="inspecionadoPor" label="Inspecionado por">
          <Input />
        </Form.Item>
      </Col>
      <Col xs={24} md={12}>
        <Form.Item
          name="dataRetornoFornecedor"
          label="Data de retorno do fornecedor"
          tooltip="Data em que as amostras chegaram. É ela que mede o prazo de resposta do fornecedor."
        >
          <Input type="date" />
        </Form.Item>
      </Col>
      <Divider />
    </Row>
  );
}
