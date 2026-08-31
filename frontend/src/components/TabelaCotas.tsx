import { useEffect, useRef, useState } from 'react';
import { Button, Input, Radio, Select, Table, Tag, Tooltip } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import {
  CotaMaxMin,
  CotaPecas,
  NORMA_OUTROS,
  NormaTolerancia,
  OPCOES_NORMA,
  UnidadeCota,
  calcularCotaMaxMin,
  calcularCotaPecas,
  labelNorma,
  normaCurta,
  normaDigitada,
  normaSelecionada,
  normaTemTabela,
  toleranciaPadrao,
} from '../inspecao';
import { useInstrumentos, opcoesInstrumento } from '../hooks';
import Tabela from './Tabela';

// Tabela de cotas do RELATORIO DE INSPECAO DIMENSIONAL (BDBR.QUA.FMR.011.06).
// E a MESMA tabela nos tres modulos (SQE, Manufatura e SQD); so muda a coluna
// do que foi encontrado: max/min no lote e uma coluna por peca nas amostras.
//
// O calculo vem de src/inspecao.ts (espelho do backend): a tela mostra na hora
// e o backend refaz a conta no salvamento.

const OPCOES_UNIDADE = [
  { value: 'mm', label: 'mm' },
  { value: 'graus', label: 'graus' },
];

// A lista de normas vem do arquivo compartilhado (espelho do backend), para
// nao existir uma segunda lista aqui.
export { OPCOES_NORMA };

/**
 * Campo "Tolerâncias / Norma" do CABECALHO do relatorio, igual nos tres
 * modulos. Em "Outros" abre o campo de texto: o que o inspetor escreve E o
 * valor gravado, sem coluna separada no banco. Enquanto ele nao escreve nada
 * fica gravado o proprio "OUTROS", que no papel sai como
 * "Outros (norma informada)".
 *
 * Feito para entrar dentro de um <Form.Item>, que injeta value e onChange.
 */
export function SelectNorma({
  value,
  onChange,
}: {
  value?: NormaTolerancia;
  onChange?: (v: NormaTolerancia) => void;
}) {
  const escolhida = normaSelecionada(value);
  return (
    <>
      <Select
        style={{ width: '100%' }}
        value={escolhida}
        options={OPCOES_NORMA}
        onChange={(v) => onChange?.(v)}
      />
      {escolhida === NORMA_OUTROS && (
        <Input
          style={{ marginTop: 8 }}
          placeholder="Qual norma?"
          value={normaDigitada(value)}
          onChange={(e) => onChange?.(e.target.value || NORMA_OUTROS)}
        />
      )}
    </>
  );
}

export function cotaVaziaMaxMin(norma: NormaTolerancia = 'ISO2768'): CotaMaxMin {
  return {
    localizacao: '',
    especificado: '',
    unidade: 'mm',
    norma,
    tolerancia: '',
    upper: '',
    lower: '',
    encontradoMax: '',
    encontradoMin: '',
    instrumento: '',
    desvioMin: '',
    desvioMax: '',
    conformeAuto: null,
    conformeManual: null,
    conforme: null,
  };
}

export function cotaVaziaPecas(norma: NormaTolerancia = 'ISO2768'): CotaPecas {
  return {
    localizacao: '',
    especificado: '',
    unidade: 'mm',
    norma,
    tolerancia: '',
    upper: '',
    lower: '',
    pecas: [],
    instrumento: '',
    desvioMin: '',
    desvioMax: '',
    conformeAuto: null,
    conformeManual: null,
    conforme: null,
  };
}

/**
 * Lista fechada: o instrumento sai do cadastro de metrologia, nao da digitacao.
 * Antes disso o mesmo paquimetro aparecia como "PAQ001", "paquimetro",
 * "Paquimetro", "Paquimetro" e "paquimentro" - cinco instrumentos diferentes
 * para o sistema.
 *
 * Nao tem "cadastrar na hora" de proposito: instrumento carrega certificado,
 * data e periodo de calibracao. Um registro criado pela metade aqui furaria o
 * controle de calibracao. Quem tem Cadastros > Instrumentos cadastra la e ele
 * aparece na lista na hora.
 */
function SelectInstrumento({
  valor,
  onChange,
}: {
  valor?: string;
  onChange: (v: string) => void;
}) {
  const { data, isLoading } = useInstrumentos();
  const opcoes = opcoesInstrumento(data);

  // Relatorio antigo tem instrumento digitado a mao, fora do cadastro. Ele
  // continua aparecendo como esta - nada do que ja foi gravado se perde.
  const atual = String(valor ?? '').trim();
  const foraDoCadastro = !!atual && !opcoes.some((o) => o.value === atual);

  return (
    <Select
      size="small"
      style={{ width: '100%' }}
      showSearch
      allowClear
      loading={isLoading}
      placeholder="Escolha o instrumento"
      optionFilterProp="label"
      value={atual || undefined}
      options={
        foraDoCadastro
          ? [{ value: atual, label: `${atual} (fora do cadastro)` }, ...opcoes]
          : opcoes
      }
      onChange={(v) => onChange(v ?? '')}
    />
  );
}

// Numeros na tela seguem o padrao BR (virgula decimal).
function br(v: unknown): string {
  if (v === null || v === undefined || v === '') return '';
  return String(v).replace('.', ',');
}

function sufixo(unidade?: UnidadeCota) {
  return unidade === 'graus' ? '°' : '';
}

// Campo numerico que o motor de calculo devolve arredondado (tolerancia, upper
// e lower). Enquanto o inspetor digita o que vale e o texto dele: sem isso a
// virgula sumia no meio da digitacao, porque "0," ja e o numero 0 e voltava
// para a tela como "0".
function CampoNumero({
  valor,
  onChange,
}: {
  valor: unknown;
  onChange: (v: string) => void;
}) {
  const [digitando, setDigitando] = useState<string | null>(null);
  return (
    <Input
      size="small"
      value={digitando ?? br(valor)}
      onChange={(e) => {
        setDigitando(e.target.value);
        onChange(e.target.value);
      }}
      onBlur={() => setDigitando(null)}
    />
  );
}

// A tolerancia so vem pronta nas duas normas com tabela, e mesmo nelas some
// quando a medida esta fora do alcance. Em N/A e na norma informada pelo
// inspetor ("Outros") o sistema nao tem tabela: quem digita e ele.
function toleranciaEditavel(cota: CotaMaxMin | CotaPecas): boolean {
  const norma: NormaTolerancia = cota.norma ?? 'ISO2768';
  if (!normaTemTabela(norma)) return true;
  const especificado = Number(String(cota.especificado ?? '').replace(',', '.'));
  if (!Number.isFinite(especificado) || !especificado) return true;
  return toleranciaPadrao(especificado, cota.unidade ?? 'mm') === null;
}

// Em N/A os limites vem do desenho e podem ser assimetricos (ex: +0,5 / -0,1),
// coisa que uma tolerancia so nao representa: por isso ali quem digita upper e
// lower e o inspetor. Nas demais normas eles saem da conta.
function limitesEditaveis(cota: CotaMaxMin | CotaPecas): boolean {
  return (cota.norma ?? 'ISO2768') === 'NA';
}

// Trocar a norma refaz a tolerancia: onde ha tabela ela volta da tabela, nas
// outras ela e digitada e por isso o que ja estava escrito e preservado.
function trocarNorma<T extends CotaMaxMin | CotaPecas>(
  cota: T,
  norma: NormaTolerancia,
  calcular: (c: T) => T,
): T {
  return calcular({
    ...cota,
    norma,
    tolerancia: normaTemTabela(norma) ? '' : cota.tolerancia,
  });
}

// Colunas iguais nas duas variantes, montadas com o recalculo ja embutido.
function colunasComuns<T extends CotaMaxMin | CotaPecas>(
  cotas: T[],
  edit: (i: number, campo: string, valor: any) => void,
) {
  const txt = (titulo: string, campo: string, width: number) => ({
    title: titulo,
    width,
    render: (_: any, r: any, i: number) => (
      <Input
        size="small"
        value={r[campo] ?? ''}
        onChange={(e) => edit(i, campo, e.target.value)}
      />
    ),
  });

  const somenteLeitura = (
    titulo: string,
    width: number,
    valor: (r: any) => string,
  ) => ({
    title: titulo,
    width,
    render: (_: any, r: any) => (
      <Input size="small" disabled value={valor(r)} />
    ),
  });

  // UPPER e LOWER: calculados nas normas com tolerancia, digitados em N/A.
  const limite = (titulo: string, campo: 'upper' | 'lower') => ({
    title: titulo,
    width: 90,
    render: (_: any, r: any, i: number) =>
      limitesEditaveis(r) ? (
        <CampoNumero
          valor={r[campo]}
          onChange={(v) => edit(i, campo, v)}
        />
      ) : (
        <Input size="small" disabled value={br(r[campo])} />
      ),
  });

  return {
    localizacao: txt('LOCALIZAÇÃO', 'localizacao', 150),
    especificado: txt('ESPECIFICADO', 'especificado', 110),
    unidade: {
      title: 'UN.',
      width: 90,
      render: (_: any, r: any, i: number) => (
        <Select
          size="small"
          style={{ width: '100%' }}
          value={r.unidade ?? 'mm'}
          options={OPCOES_UNIDADE}
          onChange={(v) => edit(i, 'unidade', v)}
        />
      ),
    },
    // Cada cota tem a sua norma: a mesma peca pode ter uma cota pela ISO 2768
    // e outra com tolerancia de desenho (N/A). O campo do cabecalho continua
    // valendo como padrao do relatorio.
    //
    // Em "Outros" o proprio nome digitado e o valor gravado no campo: nao ha
    // coluna separada, e por isso os relatorios antigos, que guardavam a norma
    // como texto livre, continuam aparecendo certos aqui.
    norma: {
      title: 'NORMA',
      width: 150,
      render: (_: any, r: any, i: number) => {
        const escolhida = normaSelecionada(r.norma);
        return (
          <>
            <Tooltip title={labelNorma(r.norma ?? 'ISO2768')}>
              <Select
                size="small"
                style={{ width: '100%' }}
                value={escolhida}
                options={OPCOES_NORMA.map((o) => ({
                  value: o.value,
                  label: normaCurta(o.value),
                }))}
                onChange={(v) => edit(i, 'norma', v)}
              />
            </Tooltip>
            {escolhida === NORMA_OUTROS && (
              <Input
                size="small"
                style={{ marginTop: 4 }}
                placeholder="Qual norma?"
                value={normaDigitada(r.norma)}
                onChange={(e) =>
                  edit(i, 'norma', e.target.value || NORMA_OUTROS)
                }
              />
            )}
          </>
        );
      },
    },
    tolerancia: {
      title: 'TOLERÂNCIA',
      width: 110,
      render: (_: any, r: any, i: number) => {
        const editavel = toleranciaEditavel(r);
        return (
          <Tooltip
            title={
              !editavel
                ? 'Tolerância da norma (ISO 2768 / DIN 7168, classe m).'
                : limitesEditaveis(r)
                  ? 'Opcional: em N/A quem manda são o upper e o lower digitados.'
                  : 'O sistema não tem a tabela desta norma: informe a tolerância.'
            }
          >
            {editavel ? (
              <span>
                <CampoNumero
                  valor={r.tolerancia}
                  onChange={(v) => edit(i, 'tolerancia', v)}
                />
              </span>
            ) : (
              <Input
                size="small"
                disabled
                value={`±${br(r.tolerancia)}${sufixo(r.unidade)}`}
              />
            )}
          </Tooltip>
        );
      },
    },
    upper: limite('UPPER', 'upper'),
    lower: limite('LOWER', 'lower'),
    instrumento: {
      title: 'INSTRUMENTO UTILIZADO',
      width: 200,
      render: (_: any, r: any, i: number) => (
        <SelectInstrumento
          valor={r.instrumento}
          onChange={(v) => edit(i, 'instrumento', v)}
        />
      ),
    },
    desvio: {
      title: 'DESVIO',
      children: [
        somenteLeitura('Mín.', 90, (r) => br(r.desvioMin)),
        somenteLeitura('Máx.', 90, (r) => br(r.desvioMax)),
      ],
    } as any,
    conforme: {
      title: 'CONFORME?',
      width: 120,
      render: (_: any, r: any, i: number) => (
        <Tooltip
          title={
            r.conformeAuto === false
              ? 'Medida fora da tolerância: a reprova é automática.'
              : 'Dentro da tolerância. O inspetor pode reprovar mesmo assim.'
          }
        >
          <Radio.Group
            size="small"
            disabled={r.conformeAuto === false}
            value={r.conforme}
            onChange={(e) => edit(i, 'conformeManual', e.target.value)}
            optionType="button"
            buttonStyle="solid"
          >
            <Radio.Button value={true}>Sim</Radio.Button>
            <Radio.Button value={false}>Não</Radio.Button>
          </Radio.Group>
        </Tooltip>
      ),
    },
    remover: {
      title: '',
      width: 40,
      fixed: 'right' as const,
      render: (_: any, __: any, i: number) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => edit(i, '__remover', true)}
        />
      ),
    },
    _cotas: cotas,
  };
}

// Leitura do relatorio ja salvo. Mostra as colunas por peca quando o registro
// tem "pecas" (aba AMOSTRAS) e Max/Min quando nao tem (aba LOTE).
export function CotasSomenteLeitura({ cotas }: { cotas: any }) {
  const linhas: any[] = Array.isArray(cotas) ? cotas : [];
  const pecas = Math.max(
    0,
    ...linhas.map((c) => (Array.isArray(c.pecas) ? c.pecas.length : 0)),
  );

  const encontrado = pecas
    ? {
        title: 'ENCONTRADO',
        children: Array.from({ length: pecas }, (_, p) => ({
          title: `PEÇA ${String(p + 1).padStart(2, '0')}`,
          width: 90,
          render: (_: any, r: any) => br(r.pecas?.[p]) || '-',
        })),
      }
    : {
        title: 'ENCONTRADO',
        children: [
          {
            title: 'Máx.',
            width: 90,
            render: (_: any, r: any) => br(r.encontradoMax) || '-',
          },
          {
            title: 'Mín.',
            width: 90,
            render: (_: any, r: any) => br(r.encontradoMin) || '-',
          },
        ],
      };

  return (
    <Tabela
      size="small"
      rowKey={(_, i) => String(i)}
      dataSource={linhas}
      pagination={false}
      scroll={{ x: 1200 + pecas * 90 }}
      locale={{ emptyText: 'Nenhuma cota registrada' }}
      columns={[
        { title: 'LOCALIZAÇÃO', dataIndex: 'localizacao', width: 150 },
        {
          title: 'ESPECIFICADO',
          width: 120,
          render: (_: any, r: any) =>
            `${br(r.especificado)}${sufixo(r.unidade)}`,
        },
        {
          title: 'NORMA',
          width: 100,
          render: (_: any, r: any) => normaCurta(r.norma) || '-',
        },
        {
          title: 'TOLERÂNCIA',
          width: 110,
          render: (_: any, r: any) =>
            r.tolerancia === '' || r.tolerancia === undefined
              ? '-'
              : `±${br(r.tolerancia)}${sufixo(r.unidade)}`,
        },
        { title: 'UPPER', width: 90, render: (_: any, r: any) => br(r.upper) || '-' },
        { title: 'LOWER', width: 90, render: (_: any, r: any) => br(r.lower) || '-' },
        encontrado as any,
        { title: 'INSTRUMENTO', dataIndex: 'instrumento', width: 150 },
        {
          title: 'DESVIO',
          children: [
            {
              title: 'Mín.',
              width: 90,
              render: (_: any, r: any) => br(r.desvioMin) || '-',
            },
            {
              title: 'Máx.',
              width: 90,
              render: (_: any, r: any) => br(r.desvioMax) || '-',
            },
          ],
        } as any,
        {
          title: 'CONFORME?',
          width: 110,
          render: (_: any, r: any) =>
            r.conforme === false ? (
              <Tag color="red">Não</Tag>
            ) : r.conforme === true ? (
              <Tag color="green">Sim</Tag>
            ) : (
              '-'
            ),
        },
      ]}
    />
  );
}

// Variante do LOTE: uma linha por cota, com o maior e o menor valor do lote.
export function TabelaCotasMaxMin({
  cotas,
  setCotas,
  norma = 'ISO2768',
}: {
  cotas: CotaMaxMin[];
  setCotas: (c: CotaMaxMin[]) => void;
  norma?: NormaTolerancia;
}) {
  // A norma do cabecalho e o padrao do relatorio: quando o inspetor a troca,
  // todas as cotas acompanham. Depois disso cada cota pode ser mudada na sua
  // propria coluna, e a troca individual nao e desfeita.
  const normaAnterior = useRef(norma);
  useEffect(() => {
    if (normaAnterior.current === norma) return;
    normaAnterior.current = norma;
    if (!cotas.length) return;
    setCotas(cotas.map((c) => trocarNorma(c, norma, calcularCotaMaxMin)));
  }, [norma]);

  function edit(idx: number, campo: string, valor: any) {
    if (campo === '__remover') {
      setCotas(cotas.filter((_, i) => i !== idx));
      return;
    }
    const copia = cotas.map((c) => ({ ...c }));
    if (campo === 'norma') {
      copia[idx] = trocarNorma(copia[idx], valor, calcularCotaMaxMin);
      setCotas(copia);
      return;
    }
    (copia[idx] as any)[campo] = valor;
    copia[idx] = calcularCotaMaxMin(copia[idx]);
    setCotas(copia);
  }

  const c = colunasComuns(cotas, edit);

  return (
    <div>
      <Tabela
        size="small"
        rowKey={(_, i) => String(i)}
        dataSource={cotas}
        pagination={false}
        scroll={{ x: 1520 }}
        locale={{ emptyText: 'Nenhuma cota adicionada' }}
        columns={[
          c.localizacao,
          c.especificado,
          c.unidade,
          c.norma,
          c.tolerancia,
          c.upper,
          c.lower,
          {
            title: 'ENCONTRADO',
            children: [
              {
                title: 'Máx.',
                width: 100,
                render: (_: any, r: any, i: number) => (
                  <Input
                    size="small"
                    value={r.encontradoMax ?? ''}
                    onChange={(e) => edit(i, 'encontradoMax', e.target.value)}
                  />
                ),
              },
              {
                title: 'Mín.',
                width: 100,
                render: (_: any, r: any, i: number) => (
                  <Input
                    size="small"
                    value={r.encontradoMin ?? ''}
                    onChange={(e) => edit(i, 'encontradoMin', e.target.value)}
                  />
                ),
              },
            ],
          } as any,
          c.instrumento,
          c.desvio,
          c.conforme,
          c.remover,
        ]}
      />
      <Button
        type="dashed"
        block
        icon={<PlusOutlined />}
        onClick={() => setCotas([...cotas, cotaVaziaMaxMin(norma)])}
        style={{ marginTop: 8 }}
      >
        Adicionar cota
      </Button>
    </div>
  );
}

// Variante AMOSTRAS: uma coluna "Encontrado" por peca inspecionada.
export function TabelaCotasPecas({
  cotas,
  setCotas,
  qtdPecas,
  norma = 'ISO2768',
}: {
  cotas: CotaPecas[];
  setCotas: (c: CotaPecas[]) => void;
  qtdPecas: number;
  norma?: NormaTolerancia;
}) {
  const pecas = Math.max(1, Math.min(10, qtdPecas || 1));

  function copiar(): CotaPecas[] {
    return cotas.map((c) => ({ ...c, pecas: [...(c.pecas ?? [])] }));
  }

  // Igual a variante do lote: o cabecalho e o padrao, a coluna manda na cota.
  const normaAnterior = useRef(norma);
  useEffect(() => {
    if (normaAnterior.current === norma) return;
    normaAnterior.current = norma;
    if (!cotas.length) return;
    setCotas(copiar().map((c) => trocarNorma(c, norma, calcularCotaPecas)));
  }, [norma]);

  function edit(idx: number, campo: string, valor: any) {
    if (campo === '__remover') {
      setCotas(cotas.filter((_, i) => i !== idx));
      return;
    }
    const copia = copiar();
    if (campo === 'norma') {
      copia[idx] = trocarNorma(copia[idx], valor, calcularCotaPecas);
      setCotas(copia);
      return;
    }
    (copia[idx] as any)[campo] = valor;
    copia[idx] = calcularCotaPecas(copia[idx]);
    setCotas(copia);
  }
  function editPeca(idx: number, p: number, valor: any) {
    const copia = copiar();
    copia[idx].pecas![p] = valor;
    copia[idx] = calcularCotaPecas(copia[idx]);
    setCotas(copia);
  }

  const c = colunasComuns(cotas, edit);

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
      <Tabela
        size="small"
        rowKey={(_, i) => String(i)}
        dataSource={cotas}
        pagination={false}
        scroll={{ x: 1420 + pecas * 90 }}
        locale={{ emptyText: 'Nenhuma cota adicionada' }}
        columns={[
          c.localizacao,
          c.especificado,
          c.unidade,
          c.norma,
          c.tolerancia,
          c.upper,
          c.lower,
          { title: 'ENCONTRADO', children: colunasPecas } as any,
          c.instrumento,
          c.desvio,
          c.conforme,
          c.remover,
        ]}
      />
      <Button
        type="dashed"
        block
        icon={<PlusOutlined />}
        onClick={() => setCotas([...copiar(), cotaVaziaPecas(norma)])}
        style={{ marginTop: 8 }}
      >
        Adicionar cota
      </Button>
    </div>
  );
}
