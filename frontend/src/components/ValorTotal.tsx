// O valor total nasce calculado (quantidade x valor unitario) e continua se
// atualizando sozinho enquanto ninguem digitar nele. Assim que a pessoa digita,
// o valor dela manda e para de ser recalculado - existe desvio que nao e
// quantidade x unitario (frete, retrabalho, lote parcial, item sem custo na
// base). O link "recalcular" devolve para o automatico.
import { useState } from 'react';
import { Form, FormInstance, InputNumber, Space, Tag, Typography } from 'antd';
import { formatarMoedaInput, lerMoedaInput } from '../moeda';

const arredondar = (n: number) => Math.round(n * 100) / 100;

export function calcularTotal(qtd?: number | null, unitario?: number | null) {
  if (qtd == null || unitario == null) return null;
  return arredondar(qtd * unitario);
}

// Um total gravado que nao bate com a conta so pode ter sido digitado a mao.
// Nao precisa de coluna nova no banco para saber disso.
export function totalEhManual(
  registro: any,
  campos: { quantidade: string; unitario: string },
) {
  if (!registro || registro.valorTotal == null) return false;
  const calculado = calcularTotal(
    registro[campos.quantidade],
    registro[campos.unitario],
  );
  return calculado != null && arredondar(registro.valorTotal) !== calculado;
}

export type CamposValor = { quantidade: string; unitario: string };

export function useValorTotal(form: FormInstance, campos: CamposValor) {
  const [manual, setManual] = useState(false);

  // Só o antd chama isso, e só em mudanca feita pela pessoa: setFieldsValue
  // nao dispara onValuesChange. E o que separa digitar de preencher sozinho.
  function aoMudarValores(alterado: any) {
    if ('valorTotal' in alterado) {
      setManual(true);
      return;
    }
    if (manual) return;
    if (campos.quantidade in alterado || campos.unitario in alterado) {
      const v = form.getFieldsValue();
      form.setFieldValue(
        'valorTotal',
        calcularTotal(v[campos.quantidade], v[campos.unitario]),
      );
    }
  }

  // Ao abrir o formulario: registro novo comeca no automatico; registro salvo
  // mantem o modo em que foi gravado.
  function carregar(registro?: any) {
    setManual(totalEhManual(registro, campos));
  }

  function recalcular() {
    const v = form.getFieldsValue();
    form.setFieldValue(
      'valorTotal',
      calcularTotal(v[campos.quantidade], v[campos.unitario]),
    );
    setManual(false);
  }

  return { manual, aoMudarValores, carregar, recalcular };
}

export function CampoValorTotal({
  ctrl,
  label = 'Total',
}: {
  ctrl: ReturnType<typeof useValorTotal>;
  label?: string;
}) {
  return (
    <Form.Item
      name="valorTotal"
      label={
        <Space size={6}>
          {label}
          {ctrl.manual && (
            <Typography.Link
              style={{ fontSize: 12, fontWeight: 400 }}
              onClick={ctrl.recalcular}
            >
              recalcular
            </Typography.Link>
          )}
        </Space>
      }
      extra={ctrl.manual ? 'Valor informado manualmente.' : undefined}
    >
      <InputNumber
        min={0}
        step={0.01}
        precision={2}
        style={{ width: '100%', fontWeight: 600 }}
        formatter={formatarMoedaInput}
        parser={lerMoedaInput as any}
      />
    </Form.Item>
  );
}

// Marca discreta para quem le o registro depois nao achar que a conta esta
// errada.
export function TagTotalManual({
  registro,
  campos,
}: {
  registro: any;
  campos: CamposValor;
}) {
  if (!totalEhManual(registro, campos)) return null;
  return (
    <Tag color="blue" style={{ marginLeft: 6 }}>
      manual
    </Tag>
  );
}
