import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  InputNumber,
  Radio,
  Row,
  Select,
  Table,
  Typography,
} from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';

// Relatorio de Inspecao Dimensional — Doc BDBR.QUA.FMR.011.06 (rev. 06).
// Os campos e a ordem seguem o formulario em papel, sem acrescimos.

export const ORIGENS_INSPECAO = [
  { value: 'PLANO_INSPECAO', label: 'Plano de Inspeção' },
  { value: 'HOMOLOGACAO', label: 'Homologação' },
  { value: 'DEVOLUCAO', label: 'Devolução' },
  { value: 'RETRABALHO', label: 'Retrabalho' },
  { value: 'RELATORIO_OCORRENCIA', label: 'Relatório de Ocorrência' },
  { value: 'LIBERACAO_SETUP', label: 'Liberação de Setup' },
  { value: 'OUTROS', label: 'Outros' },
];

export const corResultadoManufatura: Record<string, string> = {
  APROVADO: 'green',
  APROVADO_COM_OBSERVACAO: 'gold',
  REPROVADO: 'red',
};

export const labelResultadoManufatura: Record<string, string> = {
  APROVADO: 'Aprovado',
  APROVADO_COM_OBSERVACAO: 'Aprovado com observação',
  REPROVADO: 'Reprovado',
};

export const corStatusInspecao: Record<string, string> = {
  PENDENTE: 'orange',
  APROVADA: 'green',
  APROVADA_COM_OBSERVACAO: 'gold',
  REPROVADA: 'red',
};

export const labelStatusInspecao: Record<string, string> = {
  PENDENTE: 'Pendente de reinspeção',
  APROVADA: 'Aprovada',
  APROVADA_COM_OBSERVACAO: 'Aprovada com observação',
  REPROVADA: 'Reprovada',
};

export function cotaVazia() {
  return {
    localizacao: '',
    especificado: '',
    tolerancia: '',
    upper: '',
    lower: '',
    pecas: [] as string[],
    instrumento: '',
    desvioMin: '',
    desvioMax: '',
  };
}

// Tabela de cotas com UMA coluna "Encontrado" por peça inspecionada, como no
// formulario: a quantidade de colunas acompanha a Qtd. inspecionada.
export function TabelaCotasDimensional({
  cotas,
  setCotas,
  qtdPecas,
}: {
  cotas: any[];
  setCotas: (c: any[]) => void;
  qtdPecas: number;
}) {
  const pecas = Math.max(1, Math.min(10, qtdPecas || 1));

  function copiar() {
    return cotas.map((c) => ({ ...c, pecas: [...(c.pecas ?? [])] }));
  }
  function edit(idx: number, campo: string, valor: any) {
    const copia = copiar();
    copia[idx][campo] = valor;
    setCotas(copia);
  }
  function editPeca(idx: number, p: number, valor: any) {
    const copia = copiar();
    copia[idx].pecas[p] = valor;
    setCotas(copia);
  }

  const colunaTexto = (titulo: string, campo: string, width?: number) => ({
    title: titulo,
    width,
    render: (_: any, r: any, i: number) => (
      <Input
        size="small"
        value={r[campo]}
        onChange={(e) => edit(i, campo, e.target.value)}
      />
    ),
  });

  const colunasPecas = Array.from({ length: pecas }, (_, p) => ({
    title: `PEÇA ${String(p + 1).padStart(2, '0')}`,
    width: 90,
    render: (_: any, r: any, i: number) => (
      <Input
        size="small"
        value={r.pecas?.[p] ?? ''}
        onChange={(e) => editPeca(i, p, e.target.value)}
      />
    ),
  }));

  return (
    <div>
      <Table
        size="small"
        rowKey={(_, i) => String(i)}
        dataSource={cotas}
        pagination={false}
        scroll={{ x: 900 + pecas * 90 }}
        locale={{ emptyText: 'Nenhuma cota adicionada' }}
        columns={[
          colunaTexto('Localização', 'localizacao', 150),
          colunaTexto('Especificado', 'especificado', 110),
          colunaTexto('Tolerância', 'tolerancia', 100),
          colunaTexto('Upper', 'upper', 90),
          colunaTexto('Lower', 'lower', 90),
          {
            title: 'Encontrado',
            children: colunasPecas,
          } as any,
          colunaTexto('Instrumento Utilizado', 'instrumento', 150),
          {
            title: 'Desvio',
            children: [
              colunaTexto('Mín.', 'desvioMin', 90),
              colunaTexto('Máx.', 'desvioMax', 90),
            ],
          } as any,
          {
            title: '',
            width: 40,
            fixed: 'right' as const,
            render: (_: any, __: any, i: number) => (
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => setCotas(cotas.filter((_, k) => k !== i))}
              />
            ),
          },
        ]}
      />
      <Button
        type="dashed"
        block
        icon={<PlusOutlined />}
        onClick={() => setCotas([...copiar(), cotaVazia()])}
        style={{ marginTop: 8 }}
      >
        Adicionar cota
      </Button>
    </div>
  );
}

// Bloco visual opcional do fim do relatorio: defeitos encontrados e quantidade.
export function BlocoDefeitos({
  defeitos,
  setDefeitos,
  tipos,
}: {
  defeitos: any[];
  setDefeitos: (d: any[]) => void;
  tipos?: any[];
}) {
  function edit(idx: number, campo: string, valor: any) {
    const copia = defeitos.map((d) => ({ ...d }));
    copia[idx][campo] = valor;
    if (campo === 'tipoDefeitoId')
      copia[idx].nome = (tipos ?? []).find((t) => t.id === valor)?.nome;
    setDefeitos(copia);
  }

  return (
    <div>
      <Table
        size="small"
        rowKey={(_, i) => String(i)}
        dataSource={defeitos}
        pagination={false}
        locale={{ emptyText: 'Nenhum defeito registrado' }}
        columns={[
          {
            title: 'Descrição do Defeito',
            render: (_: any, r: any, i: number) => (
              <Select
                size="small"
                style={{ width: '100%' }}
                value={r.tipoDefeitoId}
                onChange={(v) => edit(i, 'tipoDefeitoId', v)}
                options={(tipos ?? []).map((t) => ({
                  value: t.id,
                  label: t.nome,
                }))}
                showSearch
                optionFilterProp="label"
                placeholder="Selecione"
              />
            ),
          },
          {
            title: 'Quantidade',
            width: 130,
            render: (_: any, r: any, i: number) => (
              <InputNumber
                size="small"
                min={0}
                style={{ width: '100%' }}
                value={r.qtd}
                onChange={(v) => edit(i, 'qtd', v)}
              />
            ),
          },
          {
            title: '',
            width: 40,
            render: (_: any, __: any, i: number) => (
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => setDefeitos(defeitos.filter((_, k) => k !== i))}
              />
            ),
          },
        ]}
      />
      <Button
        type="dashed"
        block
        icon={<PlusOutlined />}
        onClick={() => setDefeitos([...defeitos, { tipoDefeitoId: undefined, qtd: 1 }])}
        style={{ marginTop: 8 }}
      >
        Adicionar defeito
      </Button>
    </div>
  );
}

// Campos do formulario, exatamente na ordem do 011.06.
export function CamposRelatorio({
  form,
  maquinas,
  tipos,
  cotas,
  setCotas,
  defeitos,
  setDefeitos,
  tipo,
  setups,
  avaliacao,
}: {
  form: any;
  maquinas?: any[];
  tipos?: any[];
  cotas: any[];
  setCotas: (c: any[]) => void;
  defeitos: any[];
  setDefeitos: (d: any[]) => void;
  tipo: 'SETUP' | 'PRODUCAO';
  setups?: any[];
  avaliacao?: any;
}) {
  const qtdInspecionada = Form.useWatch('qtdInspecionada', form);
  const origem = Form.useWatch('origem', form);
  const resultado = Form.useWatch('resultado', form);

  return (
    <>
      <Row gutter={12}>
        <Col span={10}>
          <Form.Item
            name="maquinaId"
            label="Centro de Trabalho (máquina)"
            rules={[{ required: true, message: 'Selecione a máquina' }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Selecione a máquina"
              options={(maquinas ?? []).map((m) => ({
                value: m.id,
                label: `${m.codigo} — ${m.nome}`,
              }))}
            />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="dataInspecao" label="Data">
            <Input type="date" />
          </Form.Item>
        </Col>
        <Col span={6}>
          {/* Revisao do proprio relatorio, digitada pelo inspetor. */}
          <Form.Item name="revisao" label="Rev.">
            <Input placeholder="01" />
          </Form.Item>
        </Col>
      </Row>

      {tipo === 'PRODUCAO' && (
        <>
          {avaliacao && (
            <Alert
              style={{ marginBottom: 12 }}
              type={avaliacao.precisaInspecionar ? 'info' : 'warning'}
              showIcon
              message={
                avaliacao.precisaInspecionar
                  ? `Ciclo fechado: ${avaliacao.contadorAtual} de ${avaliacao.frequenciaN} setups. Inspeção de produção prevista.`
                  : `Ciclo em andamento: ${avaliacao.contadorAtual} de ${avaliacao.frequenciaN} setups. Esta inspeção será registrada como EXTRA.`
              }
            />
          )}
          <Form.Item
            name="setupId"
            label="Setup que liberou esta produção (opcional)"
          >
            <Select
              allowClear
              placeholder="Vincular a um setup"
              options={(setups ?? []).map((s) => ({
                value: s.id,
                label: `${s.numero} — ${s.itemCodigo ?? s.itemDescricao ?? 'sem item'}`,
              }))}
            />
          </Form.Item>
        </>
      )}

      <Row gutter={12}>
        <Col span={7}>
          <Form.Item name="itemCodigo" label="Nº Item">
            <Input />
          </Form.Item>
        </Col>
        <Col span={11}>
          <Form.Item name="itemDescricao" label="Descrição">
            <Input />
          </Form.Item>
        </Col>
        <Col span={6}>
          <Form.Item name="po" label="PO">
            <Input />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={12}>
        <Col span={8}>
          <Form.Item name="qtdInspecionada" label="Qtd. inspecionada">
            <InputNumber min={1} max={10} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="qtdTotal" label="Qtd. total">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="desenhoRev" label="Desenho / Rev.">
            <Input />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item name="origem" label="Origem da inspeção">
        <Select options={ORIGENS_INSPECAO} />
      </Form.Item>
      {origem === 'OUTROS' && (
        <Form.Item name="origemOutros" label="Especifique a origem">
          <Input />
        </Form.Item>
      )}

      <Divider orientation="left" plain>
        Cotas
      </Divider>
      <TabelaCotasDimensional
        cotas={cotas}
        setCotas={setCotas}
        qtdPecas={qtdInspecionada ?? 1}
      />

      <Divider orientation="left" plain>
        Defeitos encontrados (opcional)
      </Divider>
      <BlocoDefeitos
        defeitos={defeitos}
        setDefeitos={setDefeitos}
        tipos={tipos}
      />

      <Divider orientation="left" plain>
        Resultado
      </Divider>
      <Form.Item name="observacoesFinais" label="Observações Finais">
        <Input.TextArea rows={2} />
      </Form.Item>

      <Form.Item
        name="resultado"
        label="Resultado"
        rules={[{ required: true, message: 'Informe o resultado' }]}
      >
        <Radio.Group optionType="button" buttonStyle="solid">
          <Radio.Button value="APROVADO">Aprovado</Radio.Button>
          <Radio.Button value="APROVADO_COM_OBSERVACAO">
            Aprovado com observação
          </Radio.Button>
          <Radio.Button value="REPROVADO">Reprovado</Radio.Button>
        </Radio.Group>
      </Form.Item>

      {resultado === 'APROVADO_COM_OBSERVACAO' && (
        <Form.Item
          name="observacaoResultado"
          label="Observação (obrigatória)"
          rules={[{ required: true, message: 'Descreva a ressalva' }]}
        >
          <Input.TextArea rows={2} />
        </Form.Item>
      )}

      {resultado === 'REPROVADO' && (
        <Row gutter={12}>
          <Col span={8}>
            <Form.Item name="qtdAfetada" label="Qtd. afetada">
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={16}>
            <Form.Item name="descricaoDesvio" label="Descrição do desvio">
              <Input />
            </Form.Item>
          </Col>
        </Row>
      )}

      <Row gutter={12}>
        <Col span={12}>
          <Form.Item name="elaboradoPor" label="Elaborado por">
            <Input />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="inspecionadoPor" label="Inspecionado por">
            <Input />
          </Form.Item>
        </Col>
      </Row>
    </>
  );
}

export function CartaoFormulario({ children }: { children: any }) {
  return (
    <Card size="small" style={{ marginBottom: 12 }}>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        Doc. BDBR.QUA.FMR.011.06
      </Typography.Text>
      {children}
    </Card>
  );
}
