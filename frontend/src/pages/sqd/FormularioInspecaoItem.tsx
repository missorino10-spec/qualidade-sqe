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
  Typography,
} from 'antd';
import { OPCOES_NORMA, cotaVaziaPecas } from '../../components/TabelaCotas';
import {
  ORIGENS_RECEBIMENTO,
  CotaPecas,
  GrupoVisual,
  NormaTolerancia,
  StatusVisual,
  resultadoDimensional,
  resultadoVisual,
} from '../../inspecao';
import Tabela from '../../components/Tabela';
import AssinaturaDoLogin from '../../components/AssinaturaDoLogin';

// Relatorio de inspecao da HOMOLOGACAO DE ITENS: as duas abas que substituem a
// autoavaliacao do modulo de fornecedores.
//   AMOSTRAS - BDBR.QUA.FMR.011.06 rev. 06
//   VISUAL   - BDBR.QUA.FMR.06.07  rev. 07
// A tabela de cotas, o checklist e o motor de calculo sao os MESMOS dos outros
// modulos (src/inspecao.ts e src/components/TabelaCotas.tsx). Aqui ficam so as
// partes proprias desta tela: o cabecalho e o checklist marcado a mao.

export type { CotaPecas as Cota, GrupoVisual, StatusVisual };
export { resultadoVisual };

export const PECAS_PADRAO = 5;

export function cotaVazia(): CotaPecas {
  return cotaVaziaPecas();
}

// As amostras reprovam quando alguma cota ficou fora da tolerancia.
export function cotasComDesvio(cotas: CotaPecas[]): boolean {
  return resultadoDimensional(cotas) === 'REPROVADO';
}

// Registros antigos guardavam a norma como texto livre ("ISO 2768 - média").
// Na tela ela virou uma lista fechada, entao o que nao for codigo cai no padrao.
export function normaDoRelatorio(valor: unknown): NormaTolerancia {
  return OPCOES_NORMA.some((o) => o.value === valor)
    ? (valor as NormaTolerancia)
    : 'ISO2768';
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
          <Tabela
            style={{ marginTop: 8 }}
            rowKey={(_, i) => `${gi}-${i}`}
            size="small"
            pagination={false}
            scroll={{ x: 'max-content' }}
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
          {/* A inspecao de producao so existe na Manufatura. */}
          <Select options={ORIGENS_RECEBIMENTO} />
        </Form.Item>
      </Col>
      <Col xs={8} md={4}>
        <Form.Item name="desenho" label="Desenho">
          <Input />
        </Form.Item>
      </Col>
      <Col xs={4} md={2}>
        {/* Revisao DO DESENHO. */}
        <Form.Item name="desenhoRevisao" label="Revisão">
          <Input />
        </Form.Item>
      </Col>
      <Col xs={12} md={6}>
        {/* A norma escolhida aqui puxa as tolerancias da tabela em todas as
            cotas da aba AMOSTRAS. */}
        <Form.Item name="tolerancias" label="Tolerâncias / Norma">
          <Select options={OPCOES_NORMA} />
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
          <InputNumber style={{ width: '100%' }} min={1} max={10} />
        </Form.Item>
      </Col>
      <Col xs={12} md={6}>
        <Form.Item name="qtdTotal" label="Qtd. total do lote">
          <InputNumber style={{ width: '100%' }} min={0} />
        </Form.Item>
      </Col>
      <Col xs={24} md={12}>
        <AssinaturaDoLogin />
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
