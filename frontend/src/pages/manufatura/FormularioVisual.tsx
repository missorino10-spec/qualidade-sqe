import { Col, Divider, Form, Input, InputNumber, Row, Select } from 'antd';
import { ORIGENS_INSPECAO } from '../../inspecao';
import { UploadFotosEvidencia } from '../../components/FotosEvidencia';

// INSPECAO VISUAL DA MANUFATURA - documento proprio, sem cotas.
// O cabecalho e o mesmo do relatorio dimensional (011.06); o que muda e o
// corpo: um campo aberto para o inspetor descrever o que observou e as fotos
// da evidencia daquele momento.

export function CamposVisual({
  form,
  maquinas,
  fotos,
  setFotos,
}: {
  form: any;
  maquinas?: any[];
  fotos: any[];
  setFotos: (f: any[]) => void;
}) {
  const origem = Form.useWatch('origem', form);

  return (
    <>
      <Row gutter={12}>
        <Col span={10}>
          <Form.Item
            name="maquinaId"
            label="Centro de trabalho (máquina)"
            rules={[{ required: true, message: 'Selecione a máquina.' }]}
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

      <Row gutter={12}>
        <Col span={7}>
          <Form.Item name="itemCodigo" label="Nº do item">
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
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="qtdTotal" label="Qtd. total">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={5}>
          <Form.Item name="desenho" label="Desenho">
            <Input />
          </Form.Item>
        </Col>
        <Col span={3}>
          {/* Revisao DO DESENHO - a revisao do relatorio e outro campo. */}
          <Form.Item name="desenhoRevisao" label="Revisão">
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
        Inspeção visual
      </Divider>
      <Form.Item
        name="observacoes"
        label="O que foi observado"
        rules={[{ required: true, message: 'Descreva o que foi observado.' }]}
      >
        <Input.TextArea
          rows={5}
          placeholder="Descreva a inspeção visual (acabamento, solda, pintura, rebarba...)"
        />
      </Form.Item>

      {/* Foto e opcional: ate 4, o mesmo limite dos demais formularios. */}
      <Divider orientation="left" plain>
        Evidência fotográfica (opcional)
      </Divider>
      <UploadFotosEvidencia fotos={fotos} setFotos={setFotos} />

      <Divider orientation="left" plain>
        Assinaturas
      </Divider>
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
