import { Tag, Tooltip, Typography } from 'antd';
import { corClasse, ROTULO_CLASSE } from '../fornecedor';
import { TEXTO } from '../design/tokens';
import { numeroBR } from '../formatos';

// Leitura do IDF — o PADRAO UNICO do sistema.
//
// O IDF aparece em cinco lugares (mes, trimestre anterior, trimestre atual,
// anual e cadastro do fornecedor) e antes cada um mostrava uma coisa: um so o
// numero, outro so a letra, outro a etiqueta inteira. Quem olhava precisava
// aprender tres leituras.
//
// Aqui e sempre a mesma: o NUMERO manda (e o que compara desempenho) e a LETRA
// ao lado traduz a faixa em que ele caiu. O nome da faixa fica no tooltip para
// nao encher a celula.
//
// Periodo ainda em curso sai em italico e mais claro: e numero de verdade, mas
// ainda vai mudar. Essa e a unica diferenca visual entre parcial e fechado.

export type TamanhoNota = 'sm' | 'md' | 'lg';

const FONTE: Record<TamanhoNota, number> = { sm: 12, md: 13, lg: 15 };

export function NotaIdf({
  valor,
  classe,
  tamanho = 'md',
  parcial,
  detalhe,
  vazio = 'Sem avaliação',
}: {
  valor?: number | null;
  classe?: string | null;
  tamanho?: TamanhoNota;
  /** Periodo ainda em curso: sai em italico e mais claro. */
  parcial?: boolean;
  /** Linha extra do tooltip: quais meses entraram na conta, por exemplo. */
  detalhe?: string;
  vazio?: string;
}) {
  if (valor === null || valor === undefined)
    return (
      <Tooltip title={detalhe}>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {vazio}
        </Typography.Text>
      </Tooltip>
    );

  const titulo = [
    classe ? `${classe} — ${ROTULO_CLASSE[classe]}` : null,
    parcial ? 'Período em curso — o número ainda pode mudar.' : null,
    detalhe,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Tooltip title={titulo}>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          whiteSpace: 'nowrap',
        }}
      >
        <span
          style={{
            fontWeight: 600,
            fontSize: FONTE[tamanho],
            fontStyle: parcial ? 'italic' : undefined,
            color: parcial ? TEXTO.suave : TEXTO.forte,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {numeroBR(valor, 2)}
        </span>
        {classe && (
          <Tag
            color={corClasse[classe]}
            bordered={!parcial}
            style={{
              marginInlineEnd: 0,
              fontWeight: 700,
              fontSize: 11,
              lineHeight: '17px',
              padding: '0 6px',
              opacity: parcial ? 0.75 : 1,
            }}
          >
            {classe}
          </Tag>
        )}
      </span>
    </Tooltip>
  );
}

// Versao compacta para as 12 celulas de mes do consolidado: a letra vira uma
// inicial colorida ao lado do numero, sem moldura. Com 12 colunas na tela, 12
// etiquetas seguidas viram uma parede de cor.
export function NotaIdfCompacta({
  valor,
  classe,
  parcial,
  detalhe,
}: {
  valor?: number | null;
  classe?: string | null;
  parcial?: boolean;
  detalhe?: string;
}) {
  if (valor === null || valor === undefined)
    return (
      <Tooltip title={detalhe}>
        <Typography.Text type="secondary">—</Typography.Text>
      </Tooltip>
    );
  return (
    <Tooltip
      title={[
        classe ? `${classe} — ${ROTULO_CLASSE[classe]}` : null,
        parcial ? 'Competência ainda em aberto' : 'Competência fechada',
        detalhe,
      ]
        .filter(Boolean)
        .join(' · ')}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'baseline',
          gap: 3,
          whiteSpace: 'nowrap',
          fontStyle: parcial ? 'italic' : undefined,
        }}
      >
        <span
          style={{
            fontVariantNumeric: 'tabular-nums',
            color: parcial ? TEXTO.suave : TEXTO.padrao,
          }}
        >
          {numeroBR(valor, 2)}
        </span>
        {classe && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: corClasse[classe],
              textTransform: 'uppercase',
            }}
          >
            {classe}
          </span>
        )}
      </span>
    </Tooltip>
  );
}

// Faixas do IDF em uma linha. Vai no rodape das tabelas para que ninguem
// precise decorar o que significa cada letra.
export function LegendaIdf() {
  return (
    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
      Faixas do IDF:{' '}
      {(['A', 'B', 'C', 'D'] as const).map((c, i) => (
        <span key={c}>
          {i > 0 && ' · '}
          <Tag
            color={corClasse[c]}
            style={{
              marginInlineEnd: 4,
              fontWeight: 700,
              fontSize: 11,
              lineHeight: '17px',
              padding: '0 6px',
            }}
          >
            {c}
          </Tag>
          {ROTULO_CLASSE[c]}{' '}
          {c === 'A'
            ? '(≥ 9,00)'
            : c === 'B'
              ? '(≥ 7,00)'
              : c === 'C'
                ? '(≥ 5,00)'
                : '(< 5,00)'}
        </span>
      ))}
    </Typography.Text>
  );
}
