import {
  Col,
  Divider,
  Form,
  Input,
  Radio,
  Row,
  Table,
  Tag,
  Typography,
} from 'antd';

export type Pergunta = { codigo: string; texto: string; pontos: number };
export type Bloco = {
  letra: string;
  nome: string;
  peso: number;
  perguntas: Pergunta[];
};

// Formulario BDBR.QUA.FMR.024.03 - AUTOAVALIACAO DE FORNECEDORES.
// Pagina 01: identificacao + as 47 perguntas em 10 blocos.
// As respostas ficam num estado a parte (mapa codigo -> SIM/NAO/NA), porque o
// Form do antd nao lida bem com 47 campos gerados dinamicamente.
export function CamposAutoavaliacao({
  blocos,
  respostas,
  setRespostas,
}: {
  blocos: Bloco[];
  respostas: Record<string, string>;
  setRespostas: (r: Record<string, string>) => void;
}) {
  function responder(codigo: string, valor: string) {
    setRespostas({ ...respostas, [codigo]: valor });
  }

  return (
    <>
      <Typography.Text strong>Identificação</Typography.Text>
      <Row gutter={12} style={{ marginTop: 8 }}>
        <Col xs={24} md={12}>
          <Form.Item
            name="fornecedorNome"
            label="Fornecedor"
            rules={[{ required: true, message: 'Informe o fornecedor' }]}
          >
            <Input />
          </Form.Item>
        </Col>
        <Col xs={24} md={6}>
          <Form.Item name="cnpj" label="CNPJ">
            <Input />
          </Form.Item>
        </Col>
        <Col xs={24} md={6}>
          <Form.Item name="inscricaoEstadual" label="Inscrição Estadual">
            <Input />
          </Form.Item>
        </Col>
        <Col xs={24} md={10}>
          <Form.Item
            name="responsavelInfo"
            label="Responsável pelas Informações"
          >
            <Input />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="setor" label="Setor">
            <Input />
          </Form.Item>
        </Col>
        <Col xs={24} md={6}>
          <Form.Item
            name="dataAvaliacao"
            label="Data"
            rules={[{ required: true, message: 'Informe a data' }]}
          >
            <Input type="date" />
          </Form.Item>
        </Col>
      </Row>

      {blocos.map((b) => (
        <div key={b.letra}>
          <Divider orientation="left" style={{ margin: '12px 0' }}>
            <Typography.Text strong>
              {b.letra}. {b.nome}
            </Typography.Text>{' '}
            <Tag color="blue">Peso {b.peso}%</Tag>
          </Divider>
          <Table
            rowKey="codigo"
            size="small"
            pagination={false}
            scroll={{ x: 'max-content' }}
            dataSource={b.perguntas}
            columns={[
              { title: 'Nº', dataIndex: 'codigo', width: 60 },
              { title: 'Pergunta', dataIndex: 'texto' },
              {
                title: 'Pontos',
                dataIndex: 'pontos',
                width: 80,
                align: 'center',
              },
              {
                title: 'Resposta',
                width: 210,
                render: (_: any, p: Pergunta) => (
                  <Radio.Group
                    size="small"
                    optionType="button"
                    buttonStyle="solid"
                    value={respostas[p.codigo] ?? 'NAO'}
                    onChange={(e) => responder(p.codigo, e.target.value)}
                    options={[
                      { value: 'SIM', label: 'Sim' },
                      { value: 'NAO', label: 'Não' },
                      { value: 'NA', label: 'N/A' },
                    ]}
                  />
                ),
              },
            ]}
          />
        </div>
      ))}
    </>
  );
}

// Respostas iniciais: tudo "Não", igual ao formulario em branco da planilha.
export function respostasIniciais(blocos: Bloco[]): Record<string, string> {
  const r: Record<string, string> = {};
  for (const b of blocos) for (const p of b.perguntas) r[p.codigo] = 'NAO';
  return r;
}
