/* ===========================================================================
   Design System — pecas de painel.

   Os tres paineis (SQE, Manufatura e SQD) mostravam a mesma coisa com codigo
   copiado: cartao de indicador, faixa de contadores e cabecalho de tela. Cada
   copia foi ganhando uma diferenca pequena - um usava separador brasileiro, o
   outro nao; um reservava altura para o titulo de duas linhas, o outro nao.
   Aqui existe uma versao so, e todo painel novo ja nasce igual aos demais.

   Isto e apresentacao: nenhum componente calcula indicador. O valor chega
   pronto do backend, exatamente como antes.
   =========================================================================== */

import { ReactNode } from 'react';
import { Button, Card, Col, Row, Space, Statistic, Tooltip, Typography } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { ESPACO, MARCA } from './tokens';
import { numeroBR } from '../formatos';

/** Indicador de destaque: o numero grande do painel. */
export type Indicador = {
  titulo: string;
  /** Como o numero e calculado. Vira tooltip no titulo. */
  metrica?: string;
  valor?: number | null;
  /** "%" ou "\u00a0dias" — ver a observacao sobre espaco em CartaoIndicador. */
  sufixo?: string;
  /** Icone a esquerda do numero. */
  icone?: ReactNode;
  /** Casas decimais. Percentual usa 1, contagem usa 0, dinheiro usa 2. */
  casas?: number;
  cor?: string;
  /** Segunda metrica do mesmo cartao, em R$ (o refugo em PPM e em valor). */
  secundario?: number | null;
  /** Os numeros crus por tras do percentual. */
  rodape?: string;
};

// Linha pequena embaixo do cartao com os numeros crus. 100% de uma inspecao so
// e muito diferente de 100% de cinquenta, e o percentual sozinho nao conta isso.
export function Base({ texto }: { texto: string }) {
  return (
    <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
      {texto}
    </Typography.Text>
  );
}

// Altura reservada para o titulo do cartao. Os titulos tem uma e duas linhas, e
// sem o piso os numeros ficavam em alturas diferentes na mesma fileira.
const ALTURA_TITULO_INDICADOR = 44;
const ALTURA_TITULO_CONTADOR = 40;

/**
 * Cartao de indicador: o titulo carrega a formula no tooltip e o rodape mostra
 * de onde saiu o percentual, sem obrigar ninguem a abrir relatorio.
 *
 * Sobre o sufixo: o HTML come o espaco comum antes da palavra e imprime
 * "5,5dias". Quem monta o indicador usa espaco inseparavel ("\u00a0dias").
 */
export function CartaoIndicador({
  i,
  carregando,
}: {
  i: Indicador;
  carregando?: boolean;
}) {
  return (
    <Card style={{ height: '100%' }}>
      <Statistic
        title={
          <Tooltip title={i.metrica}>
            <span
              style={{
                display: 'block',
                minHeight: ALTURA_TITULO_INDICADOR,
                lineHeight: '22px',
              }}
            >
              {i.titulo}
            </span>
          </Tooltip>
        }
        value={i.valor ?? 0}
        formatter={(v) => numeroBR(Number(v), i.casas ?? 1)}
        suffix={i.sufixo}
        prefix={i.icone}
        loading={carregando}
        valueStyle={i.cor ? { color: i.cor } : undefined}
      />
      {/* O refugo tem duas metricas no mesmo cartao: o PPM em cima e o custo
          aqui, como na planilha. */}
      {i.secundario != null && (
        <Typography.Text strong style={{ color: MARCA.laranja }}>
          R$ {numeroBR(i.secundario, 2)}
        </Typography.Text>
      )}
      {i.rodape && <Base texto={i.rodape} />}
    </Card>
  );
}

/** Contador: quantos registros existem em cada estado. */
export type Contador = {
  t: string;
  v?: number | null;
  cor?: string;
  sufixo?: string;
  casas?: number;
};

/**
 * Faixa de contadores. Quatro por fileira no desktop: espremer sete numa fileira
 * so deixava ~100px por cartao e quebrava o titulo em varias linhas.
 */
export function FaixaContadores({
  itens,
  carregando,
}: {
  itens: Contador[];
  carregando?: boolean;
}) {
  return (
    <Row gutter={[ESPACO.lg, ESPACO.lg]} align="stretch">
      {itens.map((c) => (
        <Col xs={12} sm={8} lg={6} key={c.t}>
          <Card size="small" style={{ height: '100%' }}>
            <Statistic
              title={
                <span
                  style={{
                    display: 'block',
                    minHeight: ALTURA_TITULO_CONTADOR,
                    lineHeight: '20px',
                  }}
                >
                  {c.t}
                </span>
              }
              value={c.v ?? 0}
              formatter={(v) => numeroBR(Number(v), c.casas ?? 0)}
              suffix={c.sufixo}
              loading={carregando}
              valueStyle={c.cor ? { color: c.cor } : undefined}
            />
          </Card>
        </Col>
      ))}
    </Row>
  );
}

/**
 * Cabecalho de tela: titulo a esquerda, acoes e filtros a direita. Em tela
 * estreita as acoes descem de linha em vez de espremerem o titulo.
 */
export function CabecalhoPagina({
  titulo,
  descricao,
  acoes,
}: {
  titulo: string;
  descricao?: string;
  acoes?: ReactNode;
}) {
  return (
    <Row
      justify="space-between"
      align="middle"
      gutter={[ESPACO.lg, ESPACO.sm]}
      wrap
    >
      <Col flex="auto" style={{ minWidth: 0 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {titulo}
        </Typography.Title>
        {descricao && (
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            {descricao}
          </Typography.Text>
        )}
      </Col>
      {acoes && <Col flex="none">{acoes}</Col>}
    </Row>
  );
}

/**
 * Cabecalho de tela de detalhe: Voltar, titulo, etiqueta de situacao e, do
 * outro lado, as acoes do registro.
 *
 * Cada tela de detalhe tinha montado o seu proprio Row e a maioria esqueceu o
 * gutter. Quando a fileira de acoes quebrava de linha - o que acontece assim
 * que a janela encolhe ou o registro ganha mais um botao - os botoes colavam
 * no titulo, sem nenhum respiro. Aqui a quebra ja vem com espaco.
 */
export function CabecalhoDetalhe({
  voltar,
  titulo,
  etiqueta,
  descricao,
  acoes,
}: {
  voltar: () => void;
  titulo: ReactNode;
  /** Tag de situacao, ao lado do titulo. */
  etiqueta?: ReactNode;
  descricao?: ReactNode;
  acoes?: ReactNode;
}) {
  return (
    <Row
      justify="space-between"
      align="middle"
      gutter={[ESPACO.lg, ESPACO.sm]}
      wrap
    >
      <Col flex="auto" style={{ minWidth: 0 }}>
        <Space align="center" size={ESPACO.md} wrap>
          <Button icon={<ArrowLeftOutlined />} onClick={voltar}>
            Voltar
          </Button>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {titulo}
          </Typography.Title>
          {etiqueta}
        </Space>
        {descricao && (
          <Typography.Text
            type="secondary"
            style={{ fontSize: 13, display: 'block', marginTop: ESPACO.xs }}
          >
            {descricao}
          </Typography.Text>
        )}
      </Col>
      {acoes && (
        <Col flex="none">
          <Space wrap size={ESPACO.sm}>
            {acoes}
          </Space>
        </Col>
      )}
    </Row>
  );
}
