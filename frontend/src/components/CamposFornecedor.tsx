import {
  Button,
  Col,
  Divider,
  Form,
  Input,
  Row,
  Select,
  Switch,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';

// Campos do cadastro de fornecedor, sem o <Form> em volta. Compartilhado pela
// tela de Fornecedores e pelo cadastro pontual feito dentro de Nova Inspecao -
// assim o fornecedor cadastrado na correria de um recebimento extra nasce com
// todos os campos disponiveis, prontos para quando ele for classificado.

const labelEsforco: Record<string, string> = {
  BAIXO: 'Baixo',
  MEDIO: 'Médio',
  ALTO: 'Alto',
};

export const valoresIniciaisFornecedor = {
  esforcoQualidade: 'MEDIO',
  classificacaoFornecimento: 'C',
  fazVisual: true,
  fazLote: false,
  contatos: [],
};

export function CamposFornecedor({
  mostrarAtivo,
  mostrarEventual,
}: {
  mostrarAtivo?: boolean;
  mostrarEventual?: boolean;
}) {
  return (
    <>
      <Divider orientation="left" plain>
        Identificação
      </Divider>
      <Row gutter={12}>
        <Col span={6}>
          <Form.Item
            name="codigo"
            label="Código"
            rules={[{ required: true, message: 'Informe o código.' }]}
          >
            <Input />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            name="nome"
            label="Nome"
            rules={[{ required: true, message: 'Informe o nome.' }]}
          >
            <Input />
          </Form.Item>
        </Col>
        <Col span={6}>
          <Form.Item name="cnpj" label="CNPJ">
            <Input />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item name="endereco" label="Endereço">
        <Input />
      </Form.Item>

      <Divider orientation="left" plain>
        Escopo e classificação
      </Divider>
      <Row gutter={12}>
        <Col span={12}>
          <Form.Item name="tipoFornecimento" label="Tipo de fornecimento">
            <Input placeholder="Ex.: Estruturas metálicas" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="categoriaInspecao" label="Categoria de inspeção">
            <Input placeholder="Ex.: Metalurgia / Montagem" />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item name="planoInspecao" label="Plano de inspeção (resumo)">
        <Input />
      </Form.Item>
      <Form.Item name="controlesPrincipais" label="Controles principais">
        <Input.TextArea rows={2} />
      </Form.Item>
      <Form.Item name="escopoTexto" label="Escopo (texto livre)">
        <Input.TextArea rows={2} />
      </Form.Item>
      <Row gutter={12}>
        <Col span={8}>
          <Form.Item
            name="classificacaoFornecimento"
            label="Classificação de fornecimento"
          >
            <Select
              options={[
                { value: 'A', label: 'A — Excelente' },
                { value: 'B', label: 'B — Bom' },
                { value: 'C', label: 'C — Regular' },
                { value: 'D', label: 'D — Crítico' },
              ]}
            />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="esforcoQualidade" label="Esforço de qualidade">
            <Select
              options={Object.entries(labelEsforco).map(([v, l]) => ({
                value: v,
                label: l,
              }))}
            />
          </Form.Item>
        </Col>
        <Col span={4}>
          <Form.Item
            name="fazVisual"
            label="Inspeção visual"
            valuePropName="checked"
          >
            <Switch checkedChildren="Sim" unCheckedChildren="Não" />
          </Form.Item>
        </Col>
        <Col span={4}>
          <Form.Item
            name="fazLote"
            label="Inspeção de lote"
            valuePropName="checked"
          >
            <Switch checkedChildren="Sim" unCheckedChildren="Não" />
          </Form.Item>
        </Col>
      </Row>

      {mostrarEventual && (
        <Form.Item
          name="eventual"
          label="Fornecedor eventual (fora do plano de periodicidade)"
          valuePropName="checked"
          extra="Se marcado, o sistema nunca sugere inspeção por ciclo: toda inspeção dele é extra. Desmarque quando ele for classificado."
        >
          <Switch checkedChildren="Eventual" unCheckedChildren="No plano" />
        </Form.Item>
      )}

      <Divider orientation="left" plain>
        Contatos (até 2)
      </Divider>
      <Form.List name="contatos">
        {(fields, { add, remove }) => (
          <>
            {fields.map((field) => (
              <Row gutter={8} key={field.key} align="middle">
                <Col span={6}>
                  <Form.Item
                    {...field}
                    name={[field.name, 'nome']}
                    label="Nome"
                    rules={[{ required: true, message: 'Informe o nome.' }]}
                  >
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={7}>
                  <Form.Item
                    {...field}
                    name={[field.name, 'email']}
                    label="E-mail"
                  >
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={5}>
                  <Form.Item
                    {...field}
                    name={[field.name, 'telefone']}
                    label="Telefone"
                  >
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={5}>
                  <Form.Item
                    {...field}
                    name={[field.name, 'funcao']}
                    label="Função"
                  >
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={1}>
                  <Button type="link" danger onClick={() => remove(field.name)}>
                    Remover
                  </Button>
                </Col>
              </Row>
            ))}
            {fields.length < 2 && (
              <Button
                type="dashed"
                onClick={() => add()}
                block
                icon={<PlusOutlined />}
              >
                Adicionar contato
              </Button>
            )}
          </>
        )}
      </Form.List>

      {mostrarAtivo && (
        <Form.Item
          name="ativo"
          label="Fornecedor ativo"
          valuePropName="checked"
          style={{ marginTop: 16 }}
        >
          <Switch checkedChildren="Ativo" unCheckedChildren="Inativo" />
        </Form.Item>
      )}
    </>
  );
}
