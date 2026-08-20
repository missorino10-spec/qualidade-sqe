import { Input, Table, Typography } from 'antd';
import type { TableProps } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useEffect, useMemo, useRef, useState } from 'react';

// Tabela do sistema. E o Table do Ant Design com a barra de rolagem lateral no
// TOPO em vez do rodape: nas listagens longas o usuario tinha que rolar a
// pagina inteira ate o fim da tabela so para achar a barra e ver as colunas da
// direita.
//
// A barra nativa continua sendo a que rola de verdade (fica escondida pelo
// CSS); aqui em cima desenhamos uma barra espelhada e sincronizamos as duas.
// Foi por isso que nao usamos o truque de girar a tabela com rotateX(180deg):
// o transform vira containing block e quebra as colunas fixas (fixed: 'left' /
// 'right'), que varias telas usam para a coluna de acoes.
// Texto de uma linha inteira, sem acento e em minusculas, para a busca casar
// "peca" com "peça" e ignorar a caixa. Percorre o objeto todo (inclusive os
// relacionamentos aninhados, como fornecedor.nome) porque a listagem costuma
// mostrar campos que nao sao do primeiro nivel.
function textoDaLinha(valor: unknown, profundidade = 0): string {
  if (valor === null || valor === undefined) return '';
  if (Array.isArray(valor))
    return profundidade > 3
      ? ''
      : valor.map((v) => textoDaLinha(v, profundidade + 1)).join(' ');
  if (typeof valor === 'object')
    return profundidade > 3
      ? ''
      : Object.values(valor as Record<string, unknown>)
          .map((v) => textoDaLinha(v, profundidade + 1))
          .join(' ');
  return String(valor);
}

function normalizar(t: string) {
  return t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

// Monta a lista de opcoes de um filtro de coluna a partir dos valores que
// realmente aparecem nos dados. Usado pelas listagens para nao ter que manter
// uma lista fixa que envelhece.
export function filtrosDe(
  valores: (string | null | undefined)[],
): { text: string; value: string }[] {
  return Array.from(new Set(valores.filter(Boolean) as string[]))
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
    .map((v) => ({ text: v, value: v }));
}

type Props<T> = TableProps<T> & {
  // Liga o campo de busca acima da tabela. Recebe o texto do placeholder.
  busca?: string;
};

export default function Tabela<T extends object>({ busca, ...props }: Props<T>) {
  const caixa = useRef<HTMLDivElement>(null);
  const trilho = useRef<HTMLDivElement>(null);
  // Largura do conteudo quando ha transbordo. Zero = tabela cabe na tela e a
  // barra de cima nem aparece.
  const [larguraConteudo, setLarguraConteudo] = useState(0);
  const [termo, setTermo] = useState('');

  const linhas = useMemo(() => {
    const origem = (props.dataSource ?? []) as T[];
    const t = normalizar(termo.trim());
    if (!busca || !t) return props.dataSource;
    // Cada palavra digitada tem que aparecer na linha: "peca 114" acha a peca
    // 114 sem depender da ordem em que os campos estao na tabela.
    const palavras = t.split(/\s+/);
    return origem.filter((linha) => {
      const texto = normalizar(textoDaLinha(linha));
      return palavras.every((p) => texto.includes(p));
    });
  }, [props.dataSource, termo, busca]);

  useEffect(() => {
    const barra = trilho.current;
    // Sem scroll.y a area rolavel e .ant-table-content; com scroll.y o Ant
    // separa cabecalho e corpo, e quem rola e .ant-table-body.
    const area = caixa.current?.querySelector<HTMLElement>(
      '.ant-table-body, .ant-table-content',
    );
    if (!barra || !area) return;

    const medir = () =>
      setLarguraConteudo(
        area.scrollWidth > area.clientWidth + 1 ? area.scrollWidth : 0,
      );
    medir();

    // A largura muda quando a janela redimensiona, quando as linhas carregam e
    // quando uma coluna expande; o observer cobre os tres casos.
    const observador = new ResizeObserver(medir);
    observador.observe(area);
    if (area.firstElementChild) observador.observe(area.firstElementChild);

    // Sem a trava, mover uma barra dispara o scroll da outra, que volta a
    // mover a primeira e a rolagem fica travada no meio do caminho.
    let ecoando = false;
    const daBarraParaTabela = () => {
      if (ecoando) return;
      ecoando = true;
      area.scrollLeft = barra.scrollLeft;
      ecoando = false;
    };
    const daTabelaParaBarra = () => {
      if (ecoando) return;
      ecoando = true;
      barra.scrollLeft = area.scrollLeft;
      ecoando = false;
    };
    barra.addEventListener('scroll', daBarraParaTabela);
    area.addEventListener('scroll', daTabelaParaBarra);

    return () => {
      observador.disconnect();
      barra.removeEventListener('scroll', daBarraParaTabela);
      area.removeEventListener('scroll', daTabelaParaBarra);
    };
  }, [linhas, props.columns, props.loading]);

  const total = ((props.dataSource ?? []) as T[]).length;
  const visiveis = ((linhas ?? []) as T[]).length;

  return (
    <div ref={caixa} className="tabela-rolagem-topo">
      {busca && (
        <div className="tabela-busca">
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder={busca}
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
          />
          {termo.trim() && (
            <Typography.Text type="secondary">
              {visiveis} de {total}
            </Typography.Text>
          )}
        </div>
      )}
      <div
        ref={trilho}
        className="tabela-rolagem-topo-trilho"
        style={{ display: larguraConteudo ? 'block' : 'none' }}
        aria-hidden
      >
        <div style={{ width: larguraConteudo, height: 1 }} />
      </div>
      <Table {...props} dataSource={linhas} />
    </div>
  );
}
