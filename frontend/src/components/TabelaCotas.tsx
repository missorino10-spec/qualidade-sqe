import { useEffect, useRef, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Input,
  Radio,
  Row,
  Select,
  Table,
  Tag,
  Tooltip,
} from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import {
  CotaMaxMin,
  CotaPecas,
  DesenhoExtra,
  NORMA_OUTROS,
  NormaTolerancia,
  OPCOES_NORMA,
  TOLERANCIA_ANGULAR_M,
  UNIDADES_COTA,
  UnidadeCota,
  calcularCotaMaxMin,
  calcularCotaPecas,
  desenhoDaCota,
  gruposDeDesenho,
  labelNorma,
  normaCurta,
  normaDigitada,
  normaSelecionada,
  normaTemTabela,
  numeroCota,
  textoAngulo,
  textoCota,
  toleranciaPadrao,
  unidadeDaCota,
} from '../inspecao';
import { useInstrumentos, opcoesInstrumento } from '../hooks';
import Tabela from './Tabela';

// Tabela de cotas do RELATORIO DE INSPECAO DIMENSIONAL (BDBR.QUA.FMR.011.06).
// E a MESMA tabela nos tres modulos (SQE, Manufatura e SQD); so muda a coluna
// do que foi encontrado: max/min no lote e uma coluna por peca nas amostras.
//
// O calculo vem de src/inspecao.ts (espelho do backend): a tela mostra na hora
// e o backend refaz a conta no salvamento.

// Dica da tabela angular, mostrada no campo de tolerancia quando a cota esta
// em graus: a norma indexa pelo comprimento do MENOR LADO do angulo, que o
// formulario nao pede, entao o sistema nao tem como sugerir - mas o inspetor
// precisa da tabela a vista para digitar.
const DICA_ANGULAR = [
  'Tolerância angular ISO 2768 / DIN 7168, pelo comprimento do menor lado do ângulo:',
  ...TOLERANCIA_ANGULAR_M.map((f, i, todas) => {
    const de = i === 0 ? 'até' : `acima de ${todas[i - 1].ate} até`;
    const faixa = f.ate === Infinity ? 'acima de 400' : `${de} ${f.ate}`;
    return `${faixa} mm: ±${textoAngulo(f.tolerancia)}`;
  }),
].join('\n');

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

// Valor na unidade da cota: mm e raio com virgula decimal, angulo em graus e
// minutos ("0°30'").
function fmt(cota: any, campo: string): string {
  return textoCota(cota?.[campo], unidadeDaCota(cota?.unidade));
}

function rotuloUnidade(cota: any): string {
  const unidade = unidadeDaCota(cota?.unidade);
  return UNIDADES_COTA.find((u) => u.value === unidade)?.label ?? unidade;
}

/**
 * Campo numerico da cota. Enquanto o inspetor digita o que vale e o texto
 * dele: sem isso a virgula sumia no meio da digitacao, porque "0," ja e o
 * numero 0 e voltava para a tela como "0" - e em graus o mesmo aconteceria com
 * o "°" antes de vir o minuto. Ao sair do campo o valor volta formatado.
 */
function CampoNumero({
  valor,
  unidade,
  onChange,
}: {
  valor: unknown;
  unidade?: UnidadeCota;
  onChange: (v: string) => void;
}) {
  const [digitando, setDigitando] = useState<string | null>(null);
  return (
    <Input
      size="small"
      placeholder={unidadeDaCota(unidade) === 'graus' ? "0°30'" : undefined}
      value={digitando ?? textoCota(valor, unidadeDaCota(unidade))}
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
  const unidade = unidadeDaCota(cota.unidade);
  const especificado = numeroCota(cota.especificado, unidade);
  if (!especificado) return true;
  return toleranciaPadrao(especificado, unidade) === null;
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
  const nova = { ...cota, norma };
  return calcular({
    ...nova,
    tolerancia: toleranciaEditavel(nova) ? cota.tolerancia : '',
  });
}

// Trocar a unidade muda a base do numero: o que estava em mm nao vale em graus
// nem em raio. A tolerancia da tabela e refeita; a digitada e apagada, porque
// carregar o numero antigo para outra unidade seria inventar medida.
function trocarUnidade<T extends CotaMaxMin | CotaPecas>(
  cota: T,
  unidade: UnidadeCota,
  calcular: (c: T) => T,
): T {
  if (unidadeDaCota(cota.unidade) === unidade) return cota;
  return calcular({ ...cota, unidade, tolerancia: '', upper: '', lower: '' });
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
          unidade={r.unidade}
          onChange={(v) => edit(i, campo, v)}
        />
      ) : (
        <Input size="small" disabled value={fmt(r, campo)} />
      ),
  });

  // Medida digitada pelo inspetor (encontrado e pecas): mesma formatacao dos
  // demais campos, para a coluna nao misturar "0.5" com "0°30'".
  const medida = (
    campo: string,
    titulo: string,
    onChange: (i: number, v: string) => void,
  ) => ({
    title: titulo,
    width: 100,
    render: (_: any, r: any, i: number) => (
      <CampoNumero
        valor={r[campo]}
        unidade={r.unidade}
        onChange={(v) => onChange(i, v)}
      />
    ),
  });

  return {
    localizacao: txt('LOCALIZAÇÃO', 'localizacao', 150),
    especificado: {
      title: 'ESPECIFICADO',
      width: 110,
      render: (_: any, r: any, i: number) => (
        <CampoNumero
          valor={r.especificado}
          unidade={r.unidade}
          onChange={(v) => edit(i, 'especificado', v)}
        />
      ),
    },
    medida,
    unidade: {
      title: 'UN.',
      width: 110,
      render: (_: any, r: any, i: number) => (
        <Select
          size="small"
          style={{ width: '100%' }}
          value={unidadeDaCota(r.unidade)}
          options={UNIDADES_COTA}
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
        const unidade = unidadeDaCota(r.unidade);
        return (
          <Tooltip
            title={
              !editavel
                ? 'Tolerância da norma (ISO 2768 / DIN 7168, classe m).'
                : limitesEditaveis(r)
                  ? 'Opcional: em N/A quem manda são o upper e o lower digitados.'
                  : unidade === 'graus'
                    ? DICA_ANGULAR
                    : unidade === 'raio'
                      ? 'Raio não tem tabela na norma: informe a tolerância.'
                      : 'O sistema não tem a tabela desta norma: informe a tolerância.'
            }
            overlayStyle={{ whiteSpace: 'pre-line', maxWidth: 420 }}
          >
            {editavel ? (
              <span>
                <CampoNumero
                  valor={r.tolerancia}
                  unidade={r.unidade}
                  onChange={(v) => edit(i, 'tolerancia', v)}
                />
              </span>
            ) : (
              <Input size="small" disabled value={`±${fmt(r, 'tolerancia')}`} />
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
        somenteLeitura('Mín.', 90, (r) => fmt(r, 'desvioMin')),
        somenteLeitura('Máx.', 90, (r) => fmt(r, 'desvioMax')),
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
          render: (_: any, r: any) =>
            textoCota(r.pecas?.[p], unidadeDaCota(r.unidade)) || '-',
        })),
      }
    : {
        title: 'ENCONTRADO',
        children: [
          {
            title: 'Máx.',
            width: 90,
            render: (_: any, r: any) => fmt(r, 'encontradoMax') || '-',
          },
          {
            title: 'Mín.',
            width: 90,
            render: (_: any, r: any) => fmt(r, 'encontradoMin') || '-',
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
          render: (_: any, r: any) => fmt(r, 'especificado') || '-',
        },
        // A unidade vira coluna: em graus o proprio valor ja traz "°" e "'",
        // entao repetir o simbolo no fim de cada numero so poluia a leitura.
        {
          title: 'UN.',
          width: 80,
          render: (_: any, r: any) => rotuloUnidade(r),
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
            fmt(r, 'tolerancia') ? `±${fmt(r, 'tolerancia')}` : '-',
        },
        {
          title: 'UPPER',
          width: 90,
          render: (_: any, r: any) => fmt(r, 'upper') || '-',
        },
        {
          title: 'LOWER',
          width: 90,
          render: (_: any, r: any) => fmt(r, 'lower') || '-',
        },
        encontrado as any,
        { title: 'INSTRUMENTO', dataIndex: 'instrumento', width: 150 },
        {
          title: 'DESVIO',
          children: [
            {
              title: 'Mín.',
              width: 90,
              render: (_: any, r: any) => fmt(r, 'desvioMin') || '-',
            },
            {
              title: 'Máx.',
              width: 90,
              render: (_: any, r: any) => fmt(r, 'desvioMax') || '-',
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

// Leitura de um relatorio de peca de conjunto: uma tabela por desenho, na
// ordem dos desenhos. Com um desenho so (todo relatorio antigo, e a maioria dos
// novos) cai direto na tabela de sempre, sem nenhum enfeite a mais.
export function CotasPorDesenho({
  cotas,
  desenhos,
  desenho,
  revisao,
  legado,
}: {
  cotas: any;
  desenhos?: any;
  desenho?: string | null;
  revisao?: string | null;
  legado?: string | null;
}) {
  const grupos = gruposDeDesenho(cotas, desenhos, { desenho, revisao, legado });
  if (grupos.length === 1) return <CotasSomenteLeitura cotas={cotas} />;

  return (
    <>
      {grupos.map((g) => (
        <Card
          key={g.indice}
          size="small"
          style={{ marginBottom: 12 }}
          title={`Desenho ${g.indice + 1} de ${grupos.length} — ${g.desenho} (Rev. ${g.revisao})`}
        >
          <CotasSomenteLeitura cotas={g.cotas} />
        </Card>
      ))}
    </>
  );
}

// Variante do LOTE: uma linha por cota, com o maior e o menor valor do lote.
export function TabelaCotasMaxMin({
  cotas,
  setCotas,
  norma = 'ISO2768',
  sincronizarNorma = true,
}: {
  cotas: CotaMaxMin[];
  setCotas: (c: CotaMaxMin[]) => void;
  norma?: NormaTolerancia;
  // Desligado quando quem manda e o BlocoDesenhos: com varias tabelas na tela
  // cada uma refaria so as suas cotas e uma sobrescreveria a outra, entao a
  // troca de norma passa a ser feita uma vez so, no array inteiro.
  sincronizarNorma?: boolean;
}) {
  // A norma do cabecalho e o padrao do relatorio: quando o inspetor a troca,
  // todas as cotas acompanham. Depois disso cada cota pode ser mudada na sua
  // propria coluna, e a troca individual nao e desfeita.
  const normaAnterior = useRef(norma);
  useEffect(() => {
    if (!sincronizarNorma) return;
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
    if (campo === 'unidade') {
      copia[idx] = trocarUnidade(copia[idx], valor, calcularCotaMaxMin);
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
              c.medida('encontradoMax', 'Máx.', (i, v) =>
                edit(i, 'encontradoMax', v),
              ),
              c.medida('encontradoMin', 'Mín.', (i, v) =>
                edit(i, 'encontradoMin', v),
              ),
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
  sincronizarNorma = true,
}: {
  cotas: CotaPecas[];
  setCotas: (c: CotaPecas[]) => void;
  qtdPecas: number;
  norma?: NormaTolerancia;
  // Ver TabelaCotasMaxMin.
  sincronizarNorma?: boolean;
}) {
  const pecas = Math.max(1, Math.min(10, qtdPecas || 1));

  function copiar(): CotaPecas[] {
    return cotas.map((c) => ({ ...c, pecas: [...(c.pecas ?? [])] }));
  }

  // Igual a variante do lote: o cabecalho e o padrao, a coluna manda na cota.
  const normaAnterior = useRef(norma);
  useEffect(() => {
    if (!sincronizarNorma) return;
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
    if (campo === 'unidade') {
      copia[idx] = trocarUnidade(copia[idx], valor, calcularCotaPecas);
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
    width: 100,
    render: (_: any, r: any, i: number) => (
      <CampoNumero
        valor={r.pecas?.[p]}
        unidade={r.unidade}
        onChange={(v) => editPeca(i, p, v)}
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

// ---------------------------------------------------------------------------
// CONJUNTOS: mais de um desenho na mesma inspecao
// Peca de conjunto e conferida por varios desenhos, e cada desenho tem a sua
// tabela de cotas, contada do comeco. O desenho 1 e o do cabecalho do
// formulario (campos Desenho / Revisao); do 2o em diante o numero e a revisao
// sao digitados aqui e ficam no campo "desenhos" do relatorio.
//
// As cotas continuam num array unico, cada uma marcada com "desenhoIdx" - e
// por isso que resultado, RNC e indicadores nao precisaram mudar. O array volta
// agrupado e na ordem dos desenhos, que e a ordem em que o PDF imprime.
//
// Com um desenho so a tela fica exatamente como sempre foi: a tabela e nada
// mais. Os cartoes por desenho so aparecem quando ha o segundo.
// ---------------------------------------------------------------------------
export function BlocoDesenhos({
  cotas,
  setCotas,
  desenhos,
  setDesenhos,
  norma = 'ISO2768',
  qtdPecas,
  desenhoCabecalho,
  revisaoCabecalho,
}: {
  cotas: any[];
  setCotas: (c: any[]) => void;
  // So os EXTRAS (do 2o desenho em diante).
  desenhos: DesenhoExtra[];
  setDesenhos: (d: DesenhoExtra[]) => void;
  norma?: NormaTolerancia;
  // Informado = variante AMOSTRAS (uma coluna por peca); ausente = Max/Min.
  qtdPecas?: number;
  // So para o inspetor se situar: o desenho 1 e editado no cabecalho.
  desenhoCabecalho?: string;
  revisaoCabecalho?: string;
}) {
  const calcular: any =
    qtdPecas === undefined ? calcularCotaMaxMin : calcularCotaPecas;
  const total = desenhos.length + 1;

  // Troca de norma no cabecalho: refaz as cotas de TODOS os desenhos de uma vez
  // (as tabelas estao com a sincronia propria desligada).
  const normaAnterior = useRef(norma);
  useEffect(() => {
    if (normaAnterior.current === norma) return;
    normaAnterior.current = norma;
    if (!cotas.length) return;
    setCotas(cotas.map((c) => trocarNorma({ ...c }, norma, calcular)));
  }, [norma]);

  function separar(): any[][] {
    const por: any[][] = Array.from({ length: total }, () => []);
    for (const c of cotas) {
      const i = desenhoDaCota(c);
      por[i < total ? i : 0].push(c);
    }
    return por;
  }

  // No desenho 1 o campo nem e gravado: relatorio de um desenho so continua
  // sendo salvo exatamente como antes de existir conjunto.
  function juntar(por: any[][]) {
    setCotas(
      por.flatMap((g, i) =>
        g.map((c) => ({ ...c, desenhoIdx: i || undefined })),
      ),
    );
  }

  function aplicar(idx: number, novas: any[]) {
    const por = separar();
    por[idx] = novas;
    juntar(por);
  }

  function removerDesenho(idx: number) {
    const por = separar();
    por.splice(idx, 1);
    setDesenhos(desenhos.filter((_, i) => i + 1 !== idx));
    juntar(por);
  }

  function editarDesenho(i: number, campo: 'desenho' | 'revisao', v: string) {
    setDesenhos(desenhos.map((d, k) => (k === i ? { ...d, [campo]: v } : d)));
  }

  const por = separar();

  const tabela = (idx: number) =>
    qtdPecas === undefined ? (
      <TabelaCotasMaxMin
        cotas={por[idx]}
        setCotas={(c) => aplicar(idx, c)}
        norma={norma}
        sincronizarNorma={false}
      />
    ) : (
      <TabelaCotasPecas
        cotas={por[idx]}
        setCotas={(c) => aplicar(idx, c)}
        qtdPecas={qtdPecas}
        norma={norma}
        sincronizarNorma={false}
      />
    );

  const botaoAdicionar = (
    <Button
      type="dashed"
      block
      icon={<PlusOutlined />}
      onClick={() => setDesenhos([...desenhos, { desenho: '', revisao: '' }])}
      style={{ marginTop: 8 }}
    >
      Adicionar outro desenho (peça de conjunto)
    </Button>
  );

  if (total === 1)
    return (
      <div>
        {tabela(0)}
        {botaoAdicionar}
      </div>
    );

  return (
    <div>
      {por.map((_, idx) => (
        <Card
          key={idx}
          size="small"
          style={{ marginBottom: 12 }}
          title={`Desenho ${idx + 1} de ${total}`}
          extra={
            idx > 0 ? (
              <Button
                type="text"
                danger
                size="small"
                icon={<DeleteOutlined />}
                onClick={() => removerDesenho(idx)}
              >
                Remover desenho
              </Button>
            ) : null
          }
        >
          {idx === 0 ? (
            <Tag color="blue">
              {desenhoCabecalho || '(sem número)'} — Rev.{' '}
              {revisaoCabecalho || '-'} · preenchido no cabeçalho
            </Tag>
          ) : (
            <Row gutter={12}>
              <Col span={10}>
                <div style={{ fontSize: 12, marginBottom: 4 }}>Desenho</div>
                <Input
                  value={desenhos[idx - 1]?.desenho ?? ''}
                  onChange={(e) =>
                    editarDesenho(idx - 1, 'desenho', e.target.value)
                  }
                />
              </Col>
              <Col span={6}>
                <div style={{ fontSize: 12, marginBottom: 4 }}>Revisão</div>
                <Input
                  value={desenhos[idx - 1]?.revisao ?? ''}
                  onChange={(e) =>
                    editarDesenho(idx - 1, 'revisao', e.target.value)
                  }
                />
              </Col>
            </Row>
          )}
          <div style={{ marginTop: 12 }}>{tabela(idx)}</div>
        </Card>
      ))}
      {botaoAdicionar}
    </div>
  );
}
