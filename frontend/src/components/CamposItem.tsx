import { useEffect, useRef, useState } from 'react';
import { AutoComplete, Col, Form, Input, Row, Select, Typography } from 'antd';
import type { FormInstance } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { moeda } from '../moeda';

/**
 * Par CODIGO + DESCRICAO do item, com consulta na base de codigos e custo.
 *
 * O codigo vem SEMPRE primeiro, porque e por ele que o inspetor comeca: ao
 * digitar, o campo busca na base e, achando, preenche sozinho a descricao e
 * avisa a tela o custo unitario (para o valor do desvio ser calculado).
 *
 * Codigo que nao esta na base nao trava nada: a descricao continua livre para
 * digitar e o valor unitario e informado na mao. E o caso das pecas novas e
 * das que ainda nao entraram na planilha.
 */

export interface ItemDaBase {
  id: number;
  codigo: string;
  descricao: string;
  unidade?: string | null;
  custoUnitario?: number | null;
}

interface Props {
  form: FormInstance;
  /** Nome do campo do codigo no formulario. Padrao: itemCodigo. */
  nomeCodigo?: string;
  /** Nome do campo da descricao no formulario. Padrao: itemDescricao. */
  nomeDescricao?: string;
  rotuloCodigo?: string;
  rotuloDescricao?: string;
  descricaoObrigatoria?: boolean;
  codigoObrigatorio?: boolean;
  /** Largura das duas colunas, para encaixar no grid de cada formulario. */
  spanCodigo?: number;
  spanDescricao?: number;
  /**
   * Chamado quando o codigo digitado e resolvido na base (ou nao). A tela usa
   * para preencher o valor unitario e recalcular o total.
   */
  aoResolver?: (item: ItemDaBase | null) => void;
}

export function CamposItem({
  form,
  nomeCodigo = 'itemCodigo',
  nomeDescricao = 'itemDescricao',
  rotuloCodigo = 'Código do item',
  rotuloDescricao = 'Descrição',
  descricaoObrigatoria = false,
  codigoObrigatorio = false,
  spanCodigo = 8,
  spanDescricao = 16,
  aoResolver,
}: Props) {
  const [opcoes, setOpcoes] = useState<ItemDaBase[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [situacao, setSituacao] = useState<'vazio' | 'achou' | 'fora'>('vazio');
  const [achado, setAchado] = useState<ItemDaBase | null>(null);
  const codigoAtual = Form.useWatch(nomeCodigo, form);

  // Guarda o ultimo codigo resolvido para nao repetir a consulta a cada
  // re-render nem sobrescrever o que o usuario acabou de digitar na descricao.
  const ultimoResolvido = useRef<string | null>(null);

  function aplicar(item: ItemDaBase | null, codigo: string) {
    ultimoResolvido.current = codigo;
    setAchado(item);
    setSituacao(item ? 'achou' : 'fora');
    if (item) form.setFieldValue(nomeDescricao, item.descricao);
    aoResolver?.(item);
  }

  // Busca as sugestoes enquanto digita. O atraso evita uma chamada por tecla
  // em uma base de ~14.400 codigos.
  useEffect(() => {
    const termo = (codigoAtual ?? '').trim();
    if (!termo) {
      setOpcoes([]);
      setSituacao('vazio');
      setAchado(null);
      ultimoResolvido.current = null;
      return;
    }
    if (termo === ultimoResolvido.current) return;

    let cancelado = false;
    setBuscando(true);
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get('/itens', {
          params: { busca: termo, limite: 20 },
        });
        if (cancelado) return;
        setOpcoes(data);
        // Casou exatamente com um codigo: preenche sem esperar o clique.
        const exato = (data as ItemDaBase[]).find(
          (i) => i.codigo.toLowerCase() === termo.toLowerCase(),
        );
        if (exato) aplicar(exato, exato.codigo);
        else {
          setAchado(null);
          setSituacao('fora');
          ultimoResolvido.current = null;
          aoResolver?.(null);
        }
      } catch {
        if (!cancelado) setOpcoes([]);
      } finally {
        if (!cancelado) setBuscando(false);
      }
    }, 350);

    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigoAtual]);

  return (
    <>
      <Row gutter={12}>
        <Col xs={24} sm={spanCodigo}>
          <Form.Item
            name={nomeCodigo}
            label={rotuloCodigo}
            rules={
              codigoObrigatorio
                ? [{ required: true, message: 'Informe o código do item.' }]
                : undefined
            }
          >
            <AutoComplete
              allowClear
              placeholder="Digite o código"
              options={opcoes.map((i) => ({
                value: i.codigo,
                label: (
                  <span>
                    <strong>{i.codigo}</strong> — {i.descricao}
                    {i.custoUnitario != null && (
                      <Typography.Text type="secondary">
                        {' '}
                        ({moeda(i.custoUnitario)})
                      </Typography.Text>
                    )}
                  </span>
                ),
                item: i,
              }))}
              onSelect={(valor: string, opcao: any) =>
                aplicar(opcao.item as ItemDaBase, valor)
              }
              filterOption={false}
            />
          </Form.Item>
        </Col>
        <Col xs={24} sm={spanDescricao}>
          <Form.Item
            name={nomeDescricao}
            label={rotuloDescricao}
            rules={
              descricaoObrigatoria
                ? [{ required: true, message: 'Informe a descrição do item.' }]
                : undefined
            }
          >
            <Input placeholder="Preenchida pela base ou digitada aqui" />
          </Form.Item>
        </Col>
      </Row>

      {/* Recado curto abaixo do par, para o inspetor saber se o codigo veio da
          base (e o custo entrou sozinho) ou se ele precisa digitar o valor. */}
      {!buscando && situacao === 'achou' && achado && (
        <Typography.Text type="success" style={{ fontSize: 12 }}>
          Item da base
          {achado.custoUnitario != null
            ? ` — custo unitário ${moeda(achado.custoUnitario)}`
            : ' — sem custo cadastrado, informe o valor unitário'}
        </Typography.Text>
      )}
      {!buscando && situacao === 'fora' && (
        <Typography.Text type="warning" style={{ fontSize: 12 }}>
          Código fora da base — digite a descrição e o valor unitário.
        </Typography.Text>
      )}
    </>
  );
}

/**
 * Select de item para as telas que guardam o ID do cadastro (Planejamento e
 * Entregas). A busca e feita no servidor porque a base tem ~14.400 codigos:
 * baixar tudo para filtrar no navegador travava a tela.
 */
export function SelectItem(props: {
  value?: number;
  onChange?: (v?: number) => void;
  allowClear?: boolean;
  placeholder?: string;
}) {
  const [termo, setTermo] = useState('');
  const { data, isFetching } = useQuery<ItemDaBase[]>({
    queryKey: ['itens', 'busca', termo],
    queryFn: async () =>
      (await api.get('/itens', { params: { busca: termo, limite: 30 } })).data,
  });

  return (
    <Select
      {...props}
      showSearch
      filterOption={false}
      onSearch={setTermo}
      loading={isFetching}
      placeholder={props.placeholder ?? 'Digite o código ou a descrição'}
      notFoundContent={isFetching ? 'Buscando...' : 'Nenhum item encontrado'}
      options={(data ?? []).map((i) => ({
        value: i.id,
        label: `${i.codigo} — ${i.descricao}`,
      }))}
    />
  );
}
