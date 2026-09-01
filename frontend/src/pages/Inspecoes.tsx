import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Descriptions,
  Divider,
  Dropdown,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Row,
  Select,
  Space,
  Steps,
  Switch,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  UploadOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { useFornecedores, opcoesFornecedor } from '../hooks';
import { semanaAno } from '../semana';
import {
  CamposFornecedor,
  valoresIniciaisFornecedor,
} from '../components/CamposFornecedor';
import { BlocoDesenhos, SelectNorma } from '../components/TabelaCotas';
import {
  FotosDesvio,
  UploadFotoDesvio,
  UploadFotosEvidencia,
  chaveDesvio,
  enviarFotosDesvio,
  enviarFotosEvidencia,
} from '../components/FotosEvidencia';
import {
  DesenhoExtra,
  EVID,
  ORIGENS_RECEBIMENTO,
  desenhosExtras,
} from '../inspecao';
import Tabela from '../components/Tabela';
import { CamposItem } from '../components/CamposItem';
import { TIPOS_DESVIO } from '../tipo-desvio';

type StatusItem = 'APROVADO' | 'REPROVADO' | 'NAO_APLICAVEL';

// Desvio encerrado sem RNC nao tem status proprio: o recebimento passou, entao
// a linha sai como Aprovado. O desvio esta registrado dentro do relatorio.
const corResultado: Record<string, string> = {
  APROVADO: 'green',
  REPROVADO: 'red',
  // Rascunho nao e veredito: e trabalho pela metade esperando alguem terminar.
  RASCUNHO: 'orange',
};

const labelResultado: Record<string, string> = {
  APROVADO: 'Aprovado',
  REPROVADO: 'Reprovado',
  RASCUNHO: 'Rascunho',
};

const labelFormulario: Record<string, string> = {
  VISUAL: 'Visual',
  LOTE: 'Lote / Dimensional',
};

function ChecklistVisual({
  grupos,
  setGrupos,
  fotosDesvio,
  setFotosDesvio,
}: {
  grupos: any[];
  setGrupos: (g: any[]) => void;
  fotosDesvio: FotosDesvio;
  setFotosDesvio: (f: FotosDesvio) => void;
}) {
  function marcar(gi: number, ii: number, status: StatusItem) {
    const copia = grupos.map((g) => ({ ...g, itens: g.itens.map((x: any) => ({ ...x })) }));
    copia[gi].itens[ii].status = status;
    setGrupos(copia);
  }
  function marcarGrupo(gi: number, status: StatusItem) {
    const copia = grupos.map((g) => ({ ...g, itens: g.itens.map((x: any) => ({ ...x })) }));
    copia[gi].itens.forEach((x: any) => (x.status = status));
    setGrupos(copia);
  }

  return (
    <div style={{ maxHeight: '55vh', overflowY: 'auto', paddingRight: 8 }}>
      {grupos.map((g, gi) => (
        <Card
          key={g.grupo}
          size="small"
          title={g.grupo}
          style={{ marginBottom: 12 }}
          extra={
            <Space size={4}>
              <Button size="small" onClick={() => marcarGrupo(gi, 'APROVADO')}>
                Todos aprovados
              </Button>
              <Button
                size="small"
                onClick={() => marcarGrupo(gi, 'NAO_APLICAVEL')}
              >
                N/A
              </Button>
            </Space>
          }
        >
          {g.itens.map((item: any, ii: number) => {
            const chave = chaveDesvio(gi, ii);
            return (
              <div key={ii} style={{ padding: '4px 0' }}>
                <Row align="middle" justify="space-between">
                  <Col flex="auto">
                    <Typography.Text>{item.texto}</Typography.Text>
                  </Col>
                  <Col>
                    <Radio.Group
                      size="small"
                      value={item.status}
                      onChange={(e) => marcar(gi, ii, e.target.value)}
                      optionType="button"
                      buttonStyle="solid"
                    >
                      <Radio.Button value="APROVADO">Aprovado</Radio.Button>
                      <Radio.Button value="REPROVADO">Reprovado</Radio.Button>
                      <Radio.Button value="NAO_APLICAVEL">N/A</Radio.Button>
                    </Radio.Group>
                  </Col>
                </Row>
                {/* A foto abre na propria linha do desvio: no relatorio ela
                    sai com este texto como legenda, entao quem le sabe de
                    qual item a imagem esta falando. */}
                {item.status === 'REPROVADO' && (
                  <div style={{ marginTop: 4 }}>
                    <UploadFotoDesvio
                      fotos={fotosDesvio[chave] ?? []}
                      setFotos={(f) =>
                        setFotosDesvio({ ...fotosDesvio, [chave]: f })
                      }
                    />
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      ))}
    </div>
  );
}

export default function Inspecoes() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { usuario } = useAuth();
  const isAdmin = usuario?.papel === 'ADMIN';
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const [grupos, setGrupos] = useState<any[]>([]);
  const [cotas, setCotas] = useState<any[]>([]);
  // Peca de conjunto: desenhos do 2o em diante. O 1o e o do cabecalho.
  const [desenhos, setDesenhos] = useState<DesenhoExtra[]>([]);
  // Bloco EVIDENCIAS do formulario visual: ate 4 fotos, sempre opcional.
  const [fotosVisual, setFotosVisual] = useState<any[]>([]);
  // Foto presa a um item reprovado do checklist, por linha do checklist.
  const [fotosDesvio, setFotosDesvio] = useState<FotosDesvio>({});
  const [passoIdx, setPassoIdx] = useState(0);
  // Uma inspecao = um recebimento. A entrega criada no primeiro formulario e
  // reaproveitada no seguinte, para Visual e Lote serem a MESMA inspecao,
  // com o mesmo numero e uma unica RNC.
  const [entregaAtual, setEntregaAtual] = useState<number | undefined>();
  const [numeroInspecao, setNumeroInspecao] = useState<string | undefined>();
  const [desvioAnterior, setDesvioAnterior] = useState(false);
  const [rncDaInspecao, setRncDaInspecao] = useState<any | null>(null);
  const [salvando, setSalvando] = useState(false);
  // Toda inspecao nasce de um registro de entrada. Quando a tela e aberta com
  // "?entrada=<id>" a chegada ja foi registrada la: o fornecedor, a decisao do
  // ciclo e os dados da carga vem prontos e nao se decide nada de novo aqui.
  const [entradaVinculada, setEntradaVinculada] = useState<any | null>(null);
  // Correcao de uma inspecao ja realizada. Nao e reinspecao: e o mesmo
  // relatorio, com o mesmo numero, sendo consertado. Guarda qual formulario
  // esta sendo corrigido, porque Visual e Dimensional se corrigem separados.
  const [edicao, setEdicao] = useState<{
    tipo: 'VISUAL' | 'LOTE';
    id: number;
    numero?: string;
    // Formulario reaberto que ainda e rascunho. Muda o que a tela oferece:
    // em vez de "Salvar correcao" o botao e "Lançar inspeção", e aparece o
    // "Descartar" - que so vale enquanto nada foi lancado.
    rascunho?: boolean;
  } | null>(null);

  // Qual botao foi clicado. Fica em ref porque o onFinish do Form roda no
  // mesmo ciclo do submit e leria um useState ainda desatualizado.
  const modoSalvar = useRef<'RASCUNHO' | 'LANCAR'>('LANCAR');

  // Cadastro pontual de fornecedor, sem sair da inspecao
  const [openFornecedor, setOpenFornecedor] = useState(false);
  const [formFornecedor] = Form.useForm();
  const [salvandoFornecedor, setSalvandoFornecedor] = useState(false);

  // Pergunta "Abrir RNC?" no FIM do ciclo. Guarda os valores do ultimo
  // formulario ate o inspetor decidir; nada e gravado antes disso.
  const [decisaoRnc, setDecisaoRnc] = useState<any | null>(null);
  const [formDesvio] = Form.useForm();
  // Desvios dos formularios ja gravados nesta inspecao, esperando a decisao.
  // A pergunta e uma so por recebimento, entao ela precisa mostrar o que
  // reprovou no Visual E no Dimensional, junto.
  const [desviosPendentes, setDesviosPendentes] = useState<
    { formulario: string; itens: string[] }[]
  >([]);

  // Preenchimento obrigatorio da RNC ao concluir a inspecao
  const [rncObrigatoria, setRncObrigatoria] = useState<any | null>(null);
  const [formRnc] = Form.useForm();
  const [fotosRnc, setFotosRnc] = useState<any[]>([]);
  const [salvandoRnc, setSalvandoRnc] = useState(false);
  // Analise de reincidencia da RNC recem-aberta (mesmo fornecedor, mesmo item
  // e mesmo modo de falha). O sistema sugere; a palavra final e do usuario.
  const [reincidencia, setReincidencia] = useState<any | null>(null);
  const qtdPecasRnc = Form.useWatch('quantidadePecas', formRnc);
  const valorUnitRnc = Form.useWatch('valorUnitario', formRnc);

  const fornecedorId = Form.useWatch('fornecedorId', form);
  const normaSel = Form.useWatch('toleranciasNorm', form) ?? 'ISO2768';
  const extra = Form.useWatch('extra', form);
  const origemSel = Form.useWatch('origem', form);
  const desenhoSel = Form.useWatch('desenho', form);
  const revisaoSel = Form.useWatch('revisao', form);
  const formulariosExtra: string[] | undefined = Form.useWatch(
    'formulariosExtra',
    form,
  );

  const hoje = dayjs();
  const { semana: semanaHoje, ano: anoHoje } = semanaAno(hoje.toDate());

  const { data: fornecedores } = useFornecedores();

  const { data: template } = useQuery<any[]>({
    queryKey: ['template-visual'],
    queryFn: async () => (await api.get('/inspecoes/template-visual')).data,
  });

  const { data, isLoading } = useQuery<any[]>({
    queryKey: ['inspecoes'],
    queryFn: async () => (await api.get('/inspecoes')).data,
  });

  // Avalia recebimento (classificacao + periodicidade + contador ciclico).
  // Vindo do Registro de Entrada nao se avalia de novo: o ciclo ja avancou na
  // chegada e reavaliar agora mostraria o contador seguinte, nao o desta carga.
  const { data: avaliacao } = useQuery<any>({
    queryKey: ['avaliar', fornecedorId],
    queryFn: async () =>
      (await api.get(`/inspecoes/avaliar?fornecedorId=${fornecedorId}`)).data,
    enabled: !!fornecedorId && !entradaVinculada && !edicao,
  });

  const daEntrada = !!entradaVinculada;
  // Na correcao o ciclo nao se discute: a inspecao ja aconteceu. Sem esta
  // ressalva, uma avaliacao antiga em cache reabriria o bloco da inspecao
  // extra por cima do relatorio que esta sendo consertado.
  const precisaInspecionar = edicao
    ? true
    : daEntrada
      ? !entradaVinculada.inspecaoExtra
      : (avaliacao?.precisaInspecionar ?? true);
  // Inspecao extra: fora da janela do ciclo ou fornecedor eventual. Aqui a
  // Qualidade escolhe os formularios na mao, ignorando o cadastro.
  // Vindo do Registro de Entrada quem manda e a decisao ja tomada la: o campo
  // "extra" nao e renderizado nesta tela, e o useWatch so enxerga campo em
  // tela, entao ele voltaria vazio e a inspeção abriria sem formulario nenhum.
  const extraAtivo = daEntrada
    ? !!entradaVinculada.inspecaoExtra
    : !precisaInspecionar && !!extra;

  const fornecedorSel = useMemo(
    () => (fornecedores ?? []).find((f: any) => f.id === fornecedorId),
    [fornecedores, fornecedorId],
  );

  // Sequencia de etapas (ordem fixa Visual -> Lote). Na inspecao regular vem
  // do cadastro do fornecedor; na extra, da escolha manual.
  const passos = useMemo<('VISUAL' | 'LOTE')[]>(() => {
    const seq: ('VISUAL' | 'LOTE')[] = [];
    // Correcao: um formulario de cada vez, o que foi escolhido na listagem.
    // Nao ha encadeamento, porque a inspecao ja aconteceu inteira.
    if (edicao) return [edicao.tipo];
    if (extraAtivo) {
      if (formulariosExtra?.includes('VISUAL')) seq.push('VISUAL');
      if (formulariosExtra?.includes('LOTE')) seq.push('LOTE');
      return seq;
    }
    if (!precisaInspecionar) return [];
    const fazVisual = !fornecedorSel || fornecedorSel.fazVisual;
    if (fazVisual) seq.push('VISUAL');
    if (fornecedorSel?.fazLote) seq.push('LOTE');
    return seq.length ? seq : ['VISUAL'];
  }, [edicao, extraAtivo, formulariosExtra, precisaInspecionar, fornecedorSel]);

  const tipo = passos[passoIdx] ?? 'VISUAL';
  const encadeado = passos.length > 1;
  const preencheFormulario = passos.length > 0;
  const ultimoPasso = passoIdx >= passos.length - 1;

  // Legenda da foto do desvio: o texto do item do checklist. So vale enquanto
  // o item continuar REPROVADO - o inspetor pode ter marcado, anexado a foto e
  // voltado atras, e nesse caso a foto nao sobe.
  function legendaDoDesvio(chave: string): string | null {
    const [gi, ii] = chave.split('-').map(Number);
    const item = grupos[gi]?.itens?.[ii];
    return item?.status === 'REPROVADO' ? item.texto : null;
  }

  // Limpa SO o preenchimento do formulario (checklist, cotas, fotos e
  // observacoes). O cabecalho fica: Visual e Lote sao a mesma peca, o mesmo
  // item e a mesma nota, entao o inspetor nao redigita nada.
  function limparEtapa() {
    setGrupos(
      template
        ? template.map((g) => ({
            ...g,
            itens: g.itens.map((x: any) => ({ ...x })),
          }))
        : [],
    );
    setCotas([]);
    setDesenhos([]);
    setFotosVisual([]);
    setFotosDesvio({});
    form.setFieldsValue({ observacoes: undefined });
  }

  function novaInspecao(entrada?: any) {
    form.resetFields();
    setPassoIdx(0);
    setEdicao(null);
    setEntregaAtual(entrada?.id);
    setEntradaVinculada(entrada ?? null);
    setNumeroInspecao(undefined);
    setDesvioAnterior(false);
    setRncDaInspecao(null);
    setDesviosPendentes([]);
    limparEtapa();
    form.setFieldsValue({
      origem: 'PLANO_INSPECAO',
      extra: !!entrada?.inspecaoExtra,
      // Na extra os formularios sao escolha da Qualidade; o cadastro do
      // fornecedor entra so como sugestao, e o inspetor ajusta se quiser.
      formulariosExtra: entrada?.inspecaoExtra
        ? [
            ...(entrada.fornecedor?.fazVisual === false ? [] : ['VISUAL']),
            ...(entrada.fornecedor?.fazLote ? ['LOTE'] : []),
          ]
        : undefined,
      toleranciasNorm: 'ISO2768',
      // Tudo que a chegada ja trouxe: o inspetor nao redigita nada.
      fornecedorId: entrada?.fornecedor?.id,
      itemCodigo: entrada?.item?.codigo,
      itemDescricao: entrada?.item?.descricao,
      notaFiscal: entrada?.notaFiscal ?? undefined,
      po: entrada?.po ?? undefined,
      qtdTotal: entrada?.quantidade ?? undefined,
    });
    setOpen(true);
  }

  // Correcao de uma inspecao ja realizada: o mesmo relatorio, com o mesmo
  // numero, reaberto para consertar o que foi digitado errado - inclusive o
  // resultado. Nao confundir com reinspecao, que e uma medicao nova.
  async function abrirEdicao(linha: any, tipoForm: 'VISUAL' | 'LOTE') {
    try {
      const insp = (await api.get(`/inspecoes/${linha.id}`)).data;
      const f = tipoForm === 'VISUAL' ? insp.visual : insp.lote;
      if (!f) {
        message.error('Formulário não encontrado nesta inspeção.');
        return;
      }
      form.resetFields();
      setPassoIdx(0);
      setEntradaVinculada(null);
      setEntregaAtual(insp.id);
      setNumeroInspecao(insp.numeroInspecao);
      setDesvioAnterior(false);
      setDesviosPendentes([]);
      setFotosVisual([]);
      setFotosDesvio({});
      // RNC cancelada nao conta: se a inspecao voltar a reprovar, o desvio
      // precisa de uma RNC nova, e a pergunta tem que ser feita de novo.
      setRncDaInspecao(
        (insp.rncs ?? []).find((r: any) => r.status !== 'CANCELADA') ?? null,
      );
      setEdicao({
        tipo: tipoForm,
        id: f.id,
        numero: insp.numeroInspecao,
        rascunho: !!f.rascunho,
      });
      setGrupos(tipoForm === 'VISUAL' ? (f.checklist ?? []) : []);
      setCotas(tipoForm === 'LOTE' ? (f.cotas ?? []) : []);
      setDesenhos(tipoForm === 'LOTE' ? desenhosExtras(f.desenhos) : []);
      form.setFieldsValue({
        fornecedorId: f.fornecedorId ?? insp.fornecedor?.id,
        itemCodigo: f.item?.codigo ?? insp.item?.codigo,
        itemDescricao: f.item?.descricao ?? insp.item?.descricao,
        notaFiscal: f.notaFiscal ?? undefined,
        po: f.po ?? undefined,
        qtdInspecionada: f.qtdInspecionada ?? undefined,
        qtdTotal: f.qtdTotal ?? undefined,
        desenho: f.desenho ?? undefined,
        revisao: f.revisao ?? undefined,
        toleranciasNorm: f.toleranciasNorm ?? 'ISO2768',
        origem: f.origem ?? 'PLANO_INSPECAO',
        origemOutros: f.origemOutros ?? undefined,
        observacoes: f.observacoes ?? undefined,
      });
      setOpen(true);
    } catch {
      message.error('Não foi possível abrir a inspeção para correção.');
    }
  }

  // Chegada vinda do Registro de Entrada: a inspecao abre sozinha, ja presa
  // aquela entrega. O parametro sai da URL assim que a tela abre, para um F5
  // (ou o voltar do navegador) nao reabrir a mesma inspecao.
  const entradaParam = params.get('entrada');
  const { data: entradaAberta } = useQuery<any>({
    queryKey: ['registro-entrada', entradaParam],
    queryFn: async () =>
      (await api.get(`/registros-entrada/${entradaParam}`)).data,
    enabled: !!entradaParam,
  });

  useEffect(() => {
    if (!entradaParam || !entradaAberta) return;
    if (entradaAberta.numeroInspecao) {
      message.info(
        `O registro de entrada já gerou a inspeção ${entradaAberta.numeroInspecao}.`,
      );
    } else {
      novaInspecao(entradaAberta);
    }
    setParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entradaParam, entradaAberta]);

  // Resultado automatico a partir do preenchimento
  const resultadoAuto = useMemo(() => {
    if (tipo === 'VISUAL') {
      const reprovou = grupos.some((g) =>
        g.itens.some((i: any) => i.status === 'REPROVADO'),
      );
      return reprovou ? 'REPROVADO' : 'APROVADO';
    }
    const reprovou = cotas.some((c) => c.conforme === false);
    return reprovou ? 'REPROVADO' : 'APROVADO';
  }, [tipo, grupos, cotas]);

  // O que exatamente reprovou, para o inspetor decidir sobre a RNC olhando o
  // desvio e nao um aviso generico.
  const desviosApontados = useMemo<string[]>(() => {
    if (tipo === 'VISUAL')
      return grupos.flatMap((g) =>
        (g.itens ?? [])
          .filter((i: any) => i.status === 'REPROVADO')
          .map((i: any) => i.texto),
      );
    return cotas
      .filter((c) => c.conforme === false)
      .map(
        (c) =>
          `${c.localizacao || 'Cota'}: especificado ${c.especificado ?? '-'}, encontrado ${c.encontradoMin ?? '-'} / ${c.encontradoMax ?? '-'}`,
      );
  }, [tipo, grupos, cotas]);

  // Tudo que reprovou na INSPECAO, nao so no formulario da tela: a decisao e
  // uma so para o recebimento, entao ela e tomada olhando os dois formularios.
  const blocosDesvio = useMemo(() => {
    const blocos = [...desviosPendentes];
    if (resultadoAuto === 'REPROVADO')
      blocos.push({
        formulario: labelFormulario[tipo],
        itens: desviosApontados,
      });
    return blocos;
  }, [desviosPendentes, resultadoAuto, desviosApontados, tipo]);

  const totalDesvios = blocosDesvio.reduce((s, b) => s + b.itens.length, 0);

  // Desvio ja GRAVADO esperando a decisao da RNC. Sair agora deixaria a
  // inspecao reprovada sem ninguem ter decidido, e a decisao so acontece no
  // fim do ciclo - entao o ciclo tem que terminar.
  const desvioPendente = desviosPendentes.length > 0;

  function fecharInspecao() {
    if (desvioPendente) {
      Modal.warning({
        title: 'Inspeção com desvio pendente',
        content: `A inspeção ${numeroInspecao ?? ''} já tem desvio registrado e a decisão sobre a RNC é tomada ao final. Conclua a inspeção de ${labelFormulario[tipo]} para decidir.`,
        okText: 'Continuar a inspeção',
      });
      return;
    }
    setOpen(false);
    setEntradaVinculada(null);
    setEdicao(null);
  }

  function invalidar() {
    qc.invalidateQueries({ queryKey: ['inspecoes'] });
    qc.invalidateQueries({ queryKey: ['entregas'] });
    qc.invalidateQueries({ queryKey: ['registros-entrada'] });
    qc.invalidateQueries({ queryKey: ['registro-entrada'] });
    qc.invalidateQueries({ queryKey: ['avaliar'] });
    qc.invalidateQueries({ queryKey: ['fornecedores'] });
    qc.invalidateQueries({ queryKey: ['rnc'] });
    qc.invalidateQueries({ queryKey: ['kpis'] });
  }

  // Cadastro pontual do fornecedor que nao esta na base (ex: importacao).
  // Nasce como eventual: fica fora do plano de periodicidade, mas com o
  // cadastro completo, pronto para quando for classificado.
  async function salvarFornecedorPontual(v: any) {
    setSalvandoFornecedor(true);
    try {
      const payload = {
        ...v,
        eventual: true,
        contatos: (v.contatos ?? []).filter((c: any) => c && c.nome),
      };
      const novo = (await api.post('/fornecedores', payload)).data;
      await qc.invalidateQueries({ queryKey: ['fornecedores'] });
      setOpenFornecedor(false);
      formFornecedor.resetFields();
      // Ja seleciona o fornecedor novo e liga a inspecao extra.
      form.setFieldsValue({
        fornecedorId: novo.id,
        extra: true,
        formulariosExtra: [
          ...(novo.fazVisual ? ['VISUAL'] : []),
          ...(novo.fazLote ? ['LOTE'] : []),
        ],
      });
      message.success(
        `Fornecedor ${novo.nome} cadastrado. Escolha os formulários da inspeção extra.`,
      );
    } catch {
      message.error('Não foi possível cadastrar o fornecedor.');
    } finally {
      setSalvandoFornecedor(false);
    }
  }

  function abrirRncObrigatoria(rnc: any) {
    setRncObrigatoria(rnc);
    setFotosRnc([]);
    setReincidencia(null);
    // A analise roda com a RNC ja gravada: quando o Visual e o Dimensional do
    // mesmo recebimento reprovam, os dois modos de falha ja estao vinculados.
    api
      .get(`/rnc/${rnc.id}/reincidencia`)
      .then(({ data }) => {
        setReincidencia(data);
        if (data.reincidencia) formRnc.setFieldsValue({ reincidencia: true });
      })
      .catch(() => setReincidencia(null));
    formRnc.setFieldsValue({
      tipoDesvio: rnc.tipoDesvio,
      descricaoDesvio: rnc.descricaoDesvio,
      reincidencia: rnc.reincidencia ?? false,
      quantidadePecas: rnc.quantidadePecas ?? undefined,
      valorUnitario: rnc.valorUnitario ?? undefined,
      disposicao: rnc.disposicao ?? undefined,
    });
  }

  async function salvarRncObrigatoria(v: any) {
    if (!rncObrigatoria) return;
    setSalvandoRnc(true);
    try {
      await api.patch(`/rnc/${rncObrigatoria.id}`, {
        tipoDesvio: v.tipoDesvio,
        descricaoDesvio: v.descricaoDesvio,
        reincidencia: v.reincidencia,
        quantidadePecas: v.quantidadePecas,
        valorUnitario: v.valorUnitario,
        disposicao: v.disposicao,
        comentario: 'Desvios preenchidos no encerramento da inspeção',
      });
      for (const f of fotosRnc) {
        const arquivo = f.originFileObj ?? f;
        const fd = new FormData();
        fd.append('file', arquivo as Blob);
        try {
          await api.post('/anexos', fd, {
            params: { entidadeTipo: 'RNC', entidadeId: rncObrigatoria.id },
          });
        } catch {
          message.warning('Uma evidência não pôde ser enviada.');
        }
      }
      const rnc = rncObrigatoria;
      setRncObrigatoria(null);
      formRnc.resetFields();
      setFotosRnc([]);
      setReincidencia(null);
      invalidar();
      Modal.confirm({
        title: `Inspeção concluída — RNC ${rnc.numero} registrada`,
        content:
          'O restante da RNC (causa raiz, plano do fornecedor e eficácia) pode ser preenchido depois. Deseja abri-la agora?',
        okText: 'Abrir RNC',
        cancelText: 'Depois',
        onOk: () => navigate(`/rnc/${rnc.id}`),
      });
    } catch {
      message.error('Não foi possível salvar a RNC.');
    } finally {
      setSalvandoRnc(false);
    }
  }

  // Desvio apontado nao abre RNC sozinho: a decisao e do inspetor e vem UMA
  // VEZ, no fim do ciclo. Numa inspecao Visual + Dimensional o desvio do
  // primeiro formulario fica gravado esperando, para a pergunta ser feita com
  // o recebimento inteiro na mesa - e nao duas vezes, uma por formulario.
  //
  // A pergunta continua ANTES do POST final: o servidor so numera a RNC depois
  // do "sim", entao dizer "nao" nao queima numero na sequencia.
  //
  // Nao se pergunta quando o recebimento ja tem RNC aberta: ali o desvio novo
  // complementa a RNC que existe, como sempre foi.
  async function onFinish(v: any) {
    // Rascunho nao decide nada: guarda o que esta na tela e pronto. A pergunta
    // da RNC e feita quando a inspecao for lancada, com o desvio ja definitivo.
    const rascunho = modoSalvar.current === 'RASCUNHO';
    if (
      !rascunho &&
      preencheFormulario &&
      ultimoPasso &&
      blocosDesvio.length > 0 &&
      !rncDaInspecao
    ) {
      setDecisaoRnc(v);
      return;
    }
    return salvarFormulario(v, undefined, rascunho);
  }

  async function salvarFormulario(
    v: any,
    decisao?: { abrirRnc: boolean; observacaoDesvio?: string },
    rascunho = false,
  ) {
    setSalvando(true);
    try {
      const rota = tipo === 'VISUAL' ? '/inspecoes/visual' : '/inspecoes/lote';
      const payload: any = {
        fornecedorId: v.fornecedorId,
        itemDescricao: v.itemDescricao,
        itemCodigo: v.itemCodigo,
        notaFiscal: v.notaFiscal,
        po: v.po,
        qtdInspecionada: v.qtdInspecionada,
        qtdTotal: v.qtdTotal,
        desenho: v.desenho,
        revisao: v.revisao,
        toleranciasNorm: v.toleranciasNorm,
        origem: v.origem,
        // So faz sentido guardar o texto livre quando a origem e "Outros".
        origemOutros: v.origem === 'OUTROS' ? v.origemOutros : undefined,
        observacoes: v.observacoes,
        dataInspecao: hoje.toISOString(),
        resultado: resultadoAuto,
        extra: extraAtivo,
        // Reaproveita a carga do formulario anterior: 1 recebimento = 1 inspecao
        entregaId: entregaAtual,
        // Resposta do inspetor a pergunta "Abrir RNC?". Ausente = fluxo antigo.
        abrirRnc: decisao?.abrirRnc,
        observacaoDesvio: decisao?.observacaoDesvio,
        // Ainda vem outro formulario: o desvio grava e espera o fim do ciclo.
        decidirNoFim: !ultimoPasso,
        // Sem a marca, o PATCH de um rascunho e o LANCAMENTO dele.
        rascunho: rascunho || undefined,
      };
      if (tipo === 'VISUAL') payload.checklist = grupos;
      else {
        payload.cotas = cotas;
        payload.desenhos = desenhos;
      }

      // Correcao: o relatorio ja existe, entao e PATCH no formulario. O
      // fornecedor e a entrega nao vao no corpo - eles vem do Registro de
      // Entrada e mexer neles mudaria o ciclo de periodicidade, que nao e o
      // que um conserto de digitacao faz.
      if (edicao) {
        const res = (
          await api.patch(
            `/inspecoes/${edicao.tipo === 'VISUAL' ? 'visual' : 'lote'}/${edicao.id}`,
            payload,
          )
        ).data;
        if (fotosVisual.length && res.inspecao?.id)
          await enviarFotosEvidencia(
            fotosVisual,
            tipo === 'VISUAL' ? EVID.sqeVisual : EVID.sqeDimensional,
            res.inspecao.id,
          );
        if (tipo === 'VISUAL' && res.inspecao?.id)
          await enviarFotosDesvio(
            fotosDesvio,
            legendaDoDesvio,
            EVID.sqeVisualDesvio,
            res.inspecao.id,
          );
        setOpen(false);
        setEdicao(null);
        invalidar();
        if (rascunho)
          message.success(
            `Rascunho da inspeção ${edicao.numero ?? ''} salvo. Ele não conta nos indicadores até ser lançado.`,
          );
        else if (edicao.rascunho && res.rnc) abrirRncObrigatoria(res.rnc);
        else if (edicao.rascunho)
          message.success(
            `Inspeção ${edicao.numero ?? ''} lançada.`,
          );
        else if (res.rncsCanceladas?.length)
          message.success(
            `Inspeção ${edicao.numero ?? ''} corrigida e aprovada. A RNC ${res.rncsCanceladas.join(', ')} foi cancelada.`,
          );
        else if (res.rnc) abrirRncObrigatoria(res.rnc);
        else
          message.success(`Inspeção ${edicao.numero ?? ''} corrigida.`);
        return;
      }

      const res = (await api.post(rota, payload)).data;

      // As fotos do bloco EVIDENCIAS so podem subir depois: elas precisam do
      // id do formulario recem-criado.
      if (fotosVisual.length && res.inspecao?.id) {
        await enviarFotosEvidencia(
          fotosVisual,
          tipo === 'VISUAL' ? EVID.sqeVisual : EVID.sqeDimensional,
          res.inspecao.id,
        );
      }
      if (tipo === 'VISUAL' && res.inspecao?.id) {
        await enviarFotosDesvio(
          fotosDesvio,
          legendaDoDesvio,
          EVID.sqeVisualDesvio,
          res.inspecao.id,
        );
      }

      // Rascunho encerra aqui: a tela fecha e o formulario fica esperando na
      // listagem, marcado como RASCUNHO, para qualquer um do modulo terminar.
      // O proximo formulario do ciclo (Visual -> Dimensional) e retomado no
      // lancamento, nao agora - nada foi decidido ainda.
      if (rascunho) {
        setOpen(false);
        setEntradaVinculada(null);
        invalidar();
        message.success(
          `Rascunho da inspeção ${res.numeroInspecao ?? ''} salvo. Ele não conta nos indicadores até ser lançado.`,
        );
        return;
      }

      const rnc = res.rnc ?? rncDaInspecao;
      if (res.rnc) setRncDaInspecao(res.rnc);
      if (res.inspecao?.entregaId) setEntregaAtual(res.inspecao.entregaId);
      if (res.numeroInspecao) setNumeroInspecao(res.numeroInspecao);
      if (resultadoAuto === 'REPROVADO') setDesvioAnterior(true);

      // Ha proxima etapa (Visual -> Lote da MESMA inspecao)?
      if (!ultimoPasso) {
        const proximo = passos[passoIdx + 1];
        // O desvio deste formulario vai junto para a pergunta do fim: o
        // inspetor decide vendo o que reprovou nos dois.
        if (resultadoAuto === 'REPROVADO')
          setDesviosPendentes((atual) => [
            ...atual,
            { formulario: labelFormulario[tipo], itens: desviosApontados },
          ]);
        setPassoIdx(passoIdx + 1);
        limparEtapa();
        message.success(
          `${labelFormulario[tipo]} registrado na inspeção ${
            res.numeroInspecao ?? ''
          }. Prossiga com a inspeção de ${labelFormulario[proximo]}.`,
        );
        return;
      }

      setOpen(false);
      setEntradaVinculada(null);
      invalidar();
      if (rnc) {
        // Escolheu abrir a RNC: dai em diante ela e obrigatoria, a inspecao so
        // se encerra com os desvios preenchidos.
        abrirRncObrigatoria(rnc);
      } else if (decisao?.abrirRnc === false) {
        message.success(
          `Inspeção ${res.numeroInspecao ?? ''} encerrada como aprovada. O desvio ficou registrado no relatório, sem RNC.`,
        );
      } else {
        message.success(
          `Inspeção ${res.numeroInspecao ?? ''} registrada. Recebimento aprovado.`,
        );
      }
    } catch (e: any) {
      message.error(
        e?.response?.data?.message ??
          (rascunho
            ? 'Não foi possível salvar o rascunho.'
            : edicao
              ? 'Não foi possível salvar a correção.'
              : 'Não foi possível registrar o recebimento.'),
      );
    } finally {
      setSalvando(false);
    }
  }

  // Descartar rascunho: joga fora o formulario pela metade. So aparece
  // enquanto nada foi lancado - inspecao lancada continua so podendo ser
  // excluida pelo ADMIN.
  function descartarRascunho(
    formularios: { tipo: 'VISUAL' | 'LOTE'; id: number }[],
    numero?: string,
    aoTerminar?: () => void,
  ) {
    Modal.confirm({
      title: `Descartar o rascunho ${numero ?? ''}?`,
      icon: <DeleteOutlined style={{ color: '#cf1322' }} />,
      content:
        'O que foi preenchido será perdido. Como o rascunho nunca foi lançado, nada muda nos indicadores nem no ciclo do fornecedor.',
      okText: 'Descartar',
      okButtonProps: { danger: true },
      cancelText: 'Cancelar',
      onOk: async () => {
        try {
          for (const f of formularios)
            await api.delete(
              `/inspecoes/${f.tipo === 'VISUAL' ? 'visual' : 'lote'}/${f.id}/rascunho`,
            );
          message.success('Rascunho descartado.');
          invalidar();
          aoTerminar?.();
        } catch (e: any) {
          message.error(
            e?.response?.data?.message ??
              'Não foi possível descartar o rascunho.',
          );
        }
      },
    });
  }

  // Exclui a inspecao inteira (os formularios do recebimento).
  async function excluirInspecao(r: any, cascade = false) {
    const params = cascade ? { cascade: 'true' } : {};
    try {
      if (r.loteId) await api.delete(`/inspecoes/lote/${r.loteId}`, { params });
      if (r.visualId)
        await api.delete(`/inspecoes/visual/${r.visualId}`, { params });
      message.success('Inspeção excluída.');
      invalidar();
    } catch (e: any) {
      const body = e?.response?.data;
      if (e?.response?.status === 409 && body?.rncs?.length) {
        Modal.confirm({
          title: 'Existe RNC vinculada a esta inspeção',
          content: (
            <div>
              <p>
                Esta inspeção gerou a(s) RNC(s) abaixo. Para excluir a inspeção é
                preciso excluir também a(s) RNC(s) vinculada(s):
              </p>
              {body.rncs.map((x: any) => (
                <div key={x.id}>
                  <a onClick={() => navigate(`/rnc/${x.id}`)}>RNC {x.numero}</a>
                </div>
              ))}
            </div>
          ),
          okText: 'Excluir inspeção + RNC(s)',
          okButtonProps: { danger: true },
          cancelText: 'Cancelar',
          onOk: () => excluirInspecao(r, true),
        });
      } else {
        message.error('Não foi possível excluir a inspeção.');
      }
    }
  }

  function confirmarExclusao(r: any) {
    Modal.confirm({
      title: `Excluir a inspeção ${r.numeroInspecao ?? ''}?`,
      icon: <DeleteOutlined style={{ color: '#cf1322' }} />,
      content:
        'Todos os formulários desta inspeção serão removidos. A remoção é permanente e não pode ser desfeita.',
      okText: 'Excluir',
      okButtonProps: { danger: true },
      cancelText: 'Cancelar',
      onOk: () => excluirInspecao(r, false),
    });
  }

  const filtrosDe = (
    valores: (string | undefined)[],
  ): { text: string; value: string }[] =>
    Array.from(new Set(valores.filter(Boolean) as string[]))
      .sort()
      .map((v) => ({ text: v, value: v }));

  const filtrosFornecedor = filtrosDe(
    (data ?? []).map((r) => r.fornecedor?.nome),
  );
  const filtrosItem = filtrosDe((data ?? []).map((r) => r.item?.descricao));

  return (
    <Card
      title="Inspeções de recebimento"
      extra={
        // Abre o formulario padrao em branco. O caminho contrario continua
        // valendo: o registro de entrada leva direto para a inspecao, porque
        // ali a carga ja chegou. Mas a inspecao pode ser aberta a qualquer
        // hora, sem passar pelo registro.
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => novaInspecao()}
        >
          Nova inspeção
        </Button>
      }
    >
      <Tabela
        busca="Buscar inspeção (número, fornecedor, item, NF...)"
        rowKey="id"
        loading={isLoading}
        dataSource={data}
        // Sem scroll.x o Ant Design comprime as colunas sem largura fixa para
        // caber no card: o texto quebra em varias linhas e a tabela estoura.
        // Com a largura total declarada, o excedente vira rolagem horizontal.
        scroll={{ x: 1465 }}
        columns={[
          {
            title: 'Inspeção',
            dataIndex: 'numeroInspecao',
            width: 140,
            render: (n: string | null, r: any) =>
              n ? (
                <Button
                  type="link"
                  style={{ padding: 0 }}
                  onClick={() => navigate(`/inspecoes/${r.id}`)}
                >
                  {n}
                </Button>
              ) : (
                <Typography.Text type="secondary">-</Typography.Text>
              ),
          },
          {
            title: 'Data',
            dataIndex: 'dataInspecao',
            width: 110,
            defaultSortOrder: 'descend',
            sorter: (a: any, b: any) =>
              dayjs(a.dataInspecao).valueOf() - dayjs(b.dataInspecao).valueOf(),
            render: (d?: string) => (d ? dayjs(d).format('DD/MM/YYYY') : '-'),
          },
          {
            title: 'Semana',
            dataIndex: 'semana',
            width: 90,
            render: (v?: string) => v ?? '-',
          },
          { title: 'Ano', dataIndex: 'ano', width: 75, render: (v?: number) => v ?? '-' },
          {
            title: 'Formulário',
            dataIndex: 'formularios',
            // Larga o suficiente para "Visual" + "Lote / Dimensional" na mesma
            // linha: quebrando, a altura das linhas ficava irregular.
            width: 235,
            filters: Object.entries(labelFormulario).map(([value, text]) => ({
              text,
              value,
            })),
            onFilter: (v: any, r: any) => (r.formularios ?? []).includes(v),
            render: (fs: string[]) => (
              <Space size={4} wrap={false}>
                {(fs ?? []).map((f) => (
                  <Tag key={f} color={f === 'VISUAL' ? 'geekblue' : 'purple'}>
                    {labelFormulario[f] ?? f}
                  </Tag>
                ))}
              </Space>
            ),
          },
          {
            title: 'Tipo',
            dataIndex: 'inspecaoExtra',
            width: 90,
            filters: [
              { text: 'Extra', value: true },
              { text: 'Ciclo', value: false },
            ],
            onFilter: (v: any, r: any) => !!r.inspecaoExtra === v,
            render: (e: boolean) =>
              e ? (
                <Tag color="orange">Extra</Tag>
              ) : (
                <Tag color="default">Ciclo</Tag>
              ),
          },
          {
            title: 'Fornecedor',
            width: 170,
            ellipsis: true,
            filters: filtrosFornecedor,
            onFilter: (v: any, r: any) => r.fornecedor?.nome === v,
            render: (_: any, r: any) => r.fornecedor?.nome,
          },
          {
            title: 'Item',
            width: 200,
            ellipsis: true,
            filters: filtrosItem,
            onFilter: (v: any, r: any) => r.item?.descricao === v,
            render: (_: any, r: any) => r.item?.descricao ?? '-',
          },
          {
            title: 'Resultado',
            dataIndex: 'resultado',
            width: 190,
            filters: Object.entries(labelResultado).map(([value, text]) => ({
              text,
              value,
            })),
            onFilter: (v: any, r: any) => r.resultado === v,
            render: (r: string) => (
              <Tag color={corResultado[r]}>{labelResultado[r] ?? r}</Tag>
            ),
          },
          {
            title: 'RNC',
            width: 130,
            render: (_: any, r: any) =>
              r.rncs?.length ? (
                <Button
                  size="small"
                  type="link"
                  icon={<FileTextOutlined />}
                  onClick={() => navigate(`/rnc/${r.rncs[0].id}`)}
                >
                  {r.rncs[0].numero}
                </Button>
              ) : (
                '-'
              ),
          },
          {
            title: '',
            // 96 mesmo sem ser ADMIN: o "descartar rascunho" aparece para todos.
            width: 96,
            render: (_: any, r: any) => (
              <Space size={0}>
                {/* Correcao do que foi digitado errado. A inspecao com os dois
                    formularios corrige um de cada vez: cada um e um relatorio.
                    Formulario ainda em rascunho e "continuar", nao "corrigir". */}
                {r.formularios?.length > 1 ? (
                  <Dropdown
                    trigger={['click']}
                    menu={{
                      items: r.formularios.map((f: string) => ({
                        key: f,
                        label: r.rascunhos?.includes(f)
                          ? `Continuar rascunho ${labelFormulario[f].toLowerCase()}`
                          : `Corrigir ${labelFormulario[f].toLowerCase()}`,
                      })),
                      onClick: ({ key }) =>
                        abrirEdicao(r, key as 'VISUAL' | 'LOTE'),
                    }}
                  >
                    <Button type="text" icon={<EditOutlined />} />
                  </Dropdown>
                ) : (
                  <Button
                    type="text"
                    icon={<EditOutlined />}
                    title={
                      r.rascunhos?.length
                        ? 'Continuar este rascunho'
                        : 'Corrigir esta inspeção'
                    }
                    onClick={() =>
                      abrirEdicao(r, r.formularios?.[0] ?? 'VISUAL')
                    }
                  />
                )}
                {/* Descartar rascunho nao e exclusao: o rascunho nunca somou
                    nada, entao qualquer um do modulo pode jogar fora. Se ainda
                    houver formulario lancado no recebimento, so o ADMIN pode
                    apagar - e o botao abaixo continua sendo o dele. */}
                {r.rascunhos?.length > 0 && r.rascunho ? (
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    title="Descartar rascunho"
                    onClick={() =>
                      descartarRascunho(
                        r.rascunhos.map((t: string) => ({
                          tipo: t as 'VISUAL' | 'LOTE',
                          id: t === 'VISUAL' ? r.visualId : r.loteId,
                        })),
                        r.numeroInspecao,
                      )
                    }
                  />
                ) : (
                  isAdmin && (
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => confirmarExclusao(r)}
                    />
                  )
                )}
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={
          edicao?.rascunho
            ? `Rascunho ${numeroInspecao ?? ''} — ${labelFormulario[edicao.tipo]}`
            : edicao
              ? `Corrigir inspeção ${numeroInspecao ?? ''} — ${labelFormulario[edicao.tipo]}`
              : numeroInspecao
                ? `Inspeção ${numeroInspecao}`
                : 'Nova inspeção de recebimento'
        }
        open={open}
        onCancel={fecharInspecao}
        maskClosable={!desvioPendente}
        keyboard={!desvioPendente}
        confirmLoading={salvando}
        width={900}
        // Rodape na mao por causa do "Salvar rascunho": o mesmo formulario sai
        // pela metade ou completo, e quem decide e o botao clicado.
        footer={[
          edicao?.rascunho ? (
            <Button
              key="descartar"
              danger
              onClick={() =>
                descartarRascunho(
                  [{ tipo: edicao.tipo, id: edicao.id }],
                  edicao.numero,
                  () => {
                    setOpen(false);
                    setEdicao(null);
                  },
                )
              }
            >
              Descartar rascunho
            </Button>
          ) : null,
          <Button key="cancelar" onClick={fecharInspecao}>
            Cancelar
          </Button>,
          // Correcao de inspecao JA LANCADA nao volta a rascunho: o documento
          // ja vale, e desfazer isso mexeria nos indicadores para tras.
          !edicao || edicao.rascunho ? (
            <Button
              key="rascunho"
              loading={salvando}
              onClick={() => {
                modoSalvar.current = 'RASCUNHO';
                form.submit();
              }}
            >
              Salvar rascunho
            </Button>
          ) : null,
          <Button
            key="ok"
            type="primary"
            loading={salvando}
            onClick={() => {
              modoSalvar.current = 'LANCAR';
              form.submit();
            }}
          >
            {edicao?.rascunho
              ? 'Lançar inspeção'
              : edicao
                ? 'Salvar correção'
                : !ultimoPasso
                  ? `Registrar ${labelFormulario[tipo]} e continuar`
                  : 'Concluir inspeção'}
          </Button>,
        ]}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          style={{ marginTop: 8 }}
        >
          <Row gutter={12}>
            <Col span={11}>
              <Form.Item
                name="fornecedorId"
                label="Fornecedor"
                rules={[{ required: true, message: 'Selecione o fornecedor.' }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  disabled={passoIdx > 0 || daEntrada || !!edicao}
                  options={opcoesFornecedor(fornecedores)}
                />
              </Form.Item>
            </Col>
            {/* Fornecedor que nao esta na base (ex: importacao): cadastro
                pontual aqui mesmo, sem abandonar a inspecao. Vindo do Registro
                de Entrada o fornecedor ja veio de la, entao nao cabe trocar. */}
            {!daEntrada && !edicao && (
              <Col span={6}>
                <Form.Item label=" " colon={false}>
                  <Button
                    block
                    icon={<UserAddOutlined />}
                    disabled={passoIdx > 0}
                    onClick={() => {
                      formFornecedor.resetFields();
                      formFornecedor.setFieldsValue(valoresIniciaisFornecedor);
                      setOpenFornecedor(true);
                    }}
                  >
                    Novo fornecedor
                  </Button>
                </Form.Item>
              </Col>
            )}
            <Col span={daEntrada || edicao ? 13 : 7}>
              <Form.Item label="Nº da inspeção">
                <Input value={numeroInspecao ?? 'Gerado ao salvar'} disabled />
              </Form.Item>
            </Col>
          </Row>

          {/* Data / Semana / Ano (automaticos a partir da data de abertura) */}
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item label="Data">
                <Input value={hoje.format('DD/MM/YYYY')} disabled />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Semana">
                <Input value={semanaHoje} disabled />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Ano">
                <Input value={String(anoHoje)} disabled />
              </Form.Item>
            </Col>
          </Row>

          {/* Chegada ja registrada: a decisao do ciclo foi tomada la e esta
              inspecao fica presa aquela entrega. */}
          {daEntrada && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
              message={`Inspeção do registro de entrada de ${dayjs(
                entradaVinculada.dataEntrega,
              ).format('DD/MM/YYYY')} — ${entradaVinculada.fornecedor?.nome}`}
              description={
                entradaVinculada.inspecaoExtra
                  ? 'Inspeção EXTRA — fora do ciclo, por decisão da Qualidade.'
                  : 'Esta entrega caiu no ciclo de periodicidade e deve ser inspecionada.'
              }
            />
          )}

          {/* Correcao: deixa claro que o relatorio e o mesmo, para ninguem
              confundir com reinspecao. */}
          {edicao && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 12 }}
              message={`Corrigindo a ${labelFormulario[edicao.tipo].toLowerCase()} da inspeção ${numeroInspecao ?? ''}`}
              description={
                rncDaInspecao
                  ? `Este é o mesmo relatório, não uma reinspeção. Se a correção aprovar a inspeção, a RNC ${rncDaInspecao.numero} será cancelada.`
                  : 'Este é o mesmo relatório, não uma reinspeção: o número e a data da inspeção não mudam.'
              }
            />
          )}

          {/* Decisao de recebimento: classificacao + periodicidade + contador.
              Vindo do Registro de Entrada some: o contador que ele mostraria e
              o da PROXIMA carga, nao o desta. */}
          {fornecedorId && avaliacao && !daEntrada && !edicao && (
            <Descriptions
              size="small"
              bordered
              column={{ xs: 1, sm: 2, md: 2, lg: 2, xl: 2, xxl: 2 }}
              style={{ marginBottom: 12 }}
            >
              <Descriptions.Item label="Classificação">
                {avaliacao.eventual ? (
                  <Tag>Eventual</Tag>
                ) : (
                  <Tag color="blue">
                    {avaliacao.fornecedor?.classificacaoFornecimento}
                  </Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Periodicidade">
                {avaliacao.eventual
                  ? 'Fora do plano de periodicidade'
                  : (avaliacao.periodicidade?.periodicidadeTexto ??
                    `1 a cada ${avaliacao.frequenciaN} entregas`)}
              </Descriptions.Item>
              <Descriptions.Item label="Entregas no ciclo">
                {avaliacao.eventual
                  ? '-'
                  : `${avaliacao.proximoContador} de ${avaliacao.frequenciaN}`}
              </Descriptions.Item>
              <Descriptions.Item label="Escopo">
                {avaliacao.fornecedor?.fazVisual && (
                  <Tag color="geekblue">Visual</Tag>
                )}
                {avaliacao.fornecedor?.fazLote && (
                  <Tag color="purple">Lote</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Decisão" span={2}>
                {precisaInspecionar ? (
                  <Tag color="orange">Esta entrega DEVE ser inspecionada</Tag>
                ) : extraAtivo ? (
                  <Tag color="volcano">
                    Inspeção EXTRA — fora do ciclo, por decisão da Qualidade
                  </Tag>
                ) : (
                  <Tag color="green">
                    Fora do ciclo — recebimento sem inspeção
                  </Tag>
                )}
              </Descriptions.Item>
            </Descriptions>
          )}

          {/* Fora da janela do ciclo: a Qualidade pode inspecionar do mesmo
              jeito, escolhendo os formularios independente do cadastro. */}
          {fornecedorId && !precisaInspecionar && (
            <Card size="small" style={{ marginBottom: 12 }}>
              {/* Vindo do Registro de Entrada a extra ja foi decidida la: aqui
                  restam so os formularios. */}
              {!daEntrada && (
                <Form.Item
                  name="extra"
                  label="Realizar inspeção extra"
                  valuePropName="checked"
                  extra="A inspeção extra conta nos indicadores e reinicia o ciclo de periodicidade do fornecedor."
                  style={{ marginBottom: extraAtivo ? 12 : 0 }}
                >
                  <Switch
                    checkedChildren="Sim"
                    unCheckedChildren="Não"
                    disabled={passoIdx > 0}
                  />
                </Form.Item>
              )}
              {extraAtivo && (
                <Form.Item
                  name="formulariosExtra"
                  label="Formulários desta inspeção"
                  rules={[
                    {
                      required: true,
                      message: 'Escolha ao menos um formulário.',
                    },
                  ]}
                >
                  <Checkbox.Group
                    disabled={passoIdx > 0}
                    options={[
                      { value: 'VISUAL', label: 'Inspeção visual' },
                      { value: 'LOTE', label: 'Inspeção de lote / dimensional' },
                    ]}
                  />
                </Form.Item>
              )}
            </Card>
          )}

          {preencheFormulario && (
            <>
              {encadeado && (
                <Steps
                  size="small"
                  current={passoIdx}
                  style={{ marginBottom: 16 }}
                  items={passos.map((p) => ({
                    title:
                      p === 'VISUAL' ? 'Inspeção visual' : 'Inspeção de lote',
                  }))}
                />
              )}

              {desvioAnterior && (
                <Alert
                  type="warning"
                  showIcon
                  style={{ marginBottom: 12 }}
                  message="Esta inspeção já tem desvio registrado."
                  description={
                    rncDaInspecao
                      ? `A RNC ${rncDaInspecao.numero} já foi aberta: um novo desvio entra nela, sem abrir outra.`
                      : 'O desvio do formulário anterior está aguardando. Ao concluir esta inspeção você decide de uma vez, para os dois formulários, se abre a RNC.'
                  }
                />
              )}

              {/* Codigo primeiro: e por ele que o inspetor comeca, e achando
                  na base a descricao entra sozinha. */}
              <CamposItem form={form} descricaoObrigatoria permitirCadastro />

              <Row gutter={12}>
                <Col span={6}>
                  <Form.Item name="notaFiscal" label="Nota Fiscal">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="po" label="PO">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="qtdInspecionada" label="Qtd. inspecionada">
                    <InputNumber style={{ width: '100%' }} min={0} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="qtdTotal" label="Qtd. total do lote">
                    <InputNumber style={{ width: '100%' }} min={0} />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={12}>
                <Col span={8}>
                  <Form.Item name="desenho" label="Desenho">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={4}>
                  <Form.Item name="revisao" label="Revisão">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  {/* A norma escolhida aqui puxa as tolerancias da tabela em
                      todas as cotas do dimensional. */}
                  <Form.Item name="toleranciasNorm" label="Tolerâncias / Norma">
                    <SelectNorma />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="origem" label="Origem da inspeção">
                    <Select options={ORIGENS_RECEBIMENTO} />
                  </Form.Item>
                </Col>
              </Row>

              {/* Campo livre do "Outros:", igual ao da Manufatura. */}
              {origemSel === 'OUTROS' && (
                <Row gutter={12}>
                  <Col span={12}>
                    <Form.Item name="origemOutros" label="Especifique a origem">
                      <Input />
                    </Form.Item>
                  </Col>
                </Row>
              )}

              <Divider orientation="left" plain>
                {tipo === 'VISUAL'
                  ? 'Checklist visual (Doc. BDBR.QUA.FMR.06.07)'
                  : 'Dimensional (Doc. BDBR.QUA.FMR.011.06)'}
              </Divider>

              {tipo === 'VISUAL' ? (
                <ChecklistVisual
                  grupos={grupos}
                  setGrupos={setGrupos}
                  fotosDesvio={fotosDesvio}
                  setFotosDesvio={setFotosDesvio}
                />
              ) : (
                <BlocoDesenhos
                  cotas={cotas}
                  setCotas={setCotas}
                  desenhos={desenhos}
                  setDesenhos={setDesenhos}
                  norma={normaSel}
                  desenhoCabecalho={desenhoSel}
                  revisaoCabecalho={revisaoSel}
                />
              )}

              {/* Bloco EVIDENCIAS. No SQE o visual e o dimensional sao
                  formularios separados, entao cada um tem o seu bloco -
                  sempre opcional e sempre disponivel, inclusive quando o
                  resultado reprova. */}
              <Divider orientation="left" plain>
                {tipo === 'VISUAL'
                  ? 'Evidências do visual (opcional)'
                  : 'Evidências do dimensional (opcional)'}
              </Divider>
              <UploadFotosEvidencia
                fotos={fotosVisual}
                setFotos={setFotosVisual}
              />

              <Form.Item
                name="observacoes"
                label="Observações"
                style={{ marginTop: 12 }}
              >
                <Input.TextArea rows={2} />
              </Form.Item>

              <Alert
                type={resultadoAuto === 'REPROVADO' ? 'error' : 'success'}
                showIcon
                message={
                  resultadoAuto === 'APROVADO'
                    ? `Resultado: APROVADO — ${labelFormulario[tipo]} sem desvios.`
                    : rncDaInspecao
                      ? `Resultado: REPROVADO — o desvio entra na RNC ${rncDaInspecao.numero}, já aberta nesta inspeção.`
                      : ultimoPasso
                        ? 'Resultado: REPROVADO — ao concluir você decide se abre a RNC ou encerra como aprovado, com o desvio registrado.'
                        : `Resultado: REPROVADO — o desvio fica registrado e a decisão sobre a RNC vem ao final, depois da inspeção de ${labelFormulario[passos[passoIdx + 1]]}.`
                }
              />
            </>
          )}
        </Form>
      </Modal>

      {/* Cadastro pontual do fornecedor, sem sair da inspecao */}
      <Modal
        title="Novo fornecedor (cadastro pontual)"
        open={openFornecedor}
        onCancel={() => setOpenFornecedor(false)}
        onOk={() => formFornecedor.submit()}
        confirmLoading={salvandoFornecedor}
        okText="Cadastrar e usar nesta inspeção"
        cancelText="Cancelar"
        width={760}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="Fornecedor eventual"
          description="Ele nasce fora do plano de periodicidade: toda inspeção dele é EXTRA. O cadastro fica completo, então basta desmarcar 'eventual' em Fornecedores quando ele for classificado."
        />
        <Form
          form={formFornecedor}
          layout="vertical"
          onFinish={salvarFornecedorPontual}
        >
          <CamposFornecedor />
        </Form>
      </Modal>

      {/* Pergunta "Abrir RNC?" - a decisao do inspetor, UMA por inspecao, no
          fim do ciclo. Nada do ultimo formulario foi gravado ainda: e por isso
          que dizer "nao" nao queima numero de RNC. */}
      <Modal
        title="Desvio apontado — abrir RNC?"
        open={!!decisaoRnc}
        onCancel={() => setDecisaoRnc(null)}
        footer={null}
        width={640}
        destroyOnClose
      >
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message={`${totalDesvios} desvio(s) apontado(s) nesta inspeção`}
          description={
            <>
              {blocosDesvio.map((b) => (
                <div key={b.formulario} style={{ marginTop: 4 }}>
                  <b>{b.formulario}</b>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {b.itens.slice(0, 8).map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                    {b.itens.length > 8 && (
                      <li>+ {b.itens.length - 8} outro(s)</li>
                    )}
                  </ul>
                </div>
              ))}
              <div style={{ marginTop: 8 }}>
                A resposta vale para a inspeção inteira.
              </div>
            </>
          }
        />
        <Form
          form={formDesvio}
          layout="vertical"
          onFinish={(v) => {
            const dados = decisaoRnc;
            setDecisaoRnc(null);
            formDesvio.resetFields();
            salvarFormulario(dados, {
              abrirRnc: false,
              observacaoDesvio: v.observacaoDesvio,
            });
          }}
        >
          <Form.Item
            name="observacaoDesvio"
            label="Por que a inspeção foi encerrada como aprovada?"
            extra="Sai impresso no relatório. Os itens e cotas reprovados continuam marcados no documento — o que muda é o veredito do recebimento."
            rules={[
              {
                required: true,
                message: 'Explique por que o desvio não gerou RNC.',
              },
            ]}
          >
            <Input.TextArea
              rows={3}
              placeholder="Ex.: desvio aceito por engenharia, peça segue para uso conforme concessão."
            />
          </Form.Item>
          <Space>
            <Button
              type="primary"
              danger
              loading={salvando}
              onClick={() => {
                const dados = decisaoRnc;
                setDecisaoRnc(null);
                formDesvio.resetFields();
                salvarFormulario(dados, { abrirRnc: true });
              }}
            >
              Sim, abrir RNC
            </Button>
            <Button htmlType="submit" loading={salvando}>
              Não abrir — encerrar como aprovado
            </Button>
          </Space>
        </Form>
      </Modal>

      {/* RNC obrigatoria para encerrar a inspecao. Sem cancelar: se a tela
          cair, a RNC ja esta aberta e continua no menu RNC pelo numero. */}
      <Modal
        title={
          rncObrigatoria
            ? `RNC ${rncObrigatoria.numero} — desvios da inspeção`
            : 'RNC'
        }
        open={!!rncObrigatoria}
        onOk={() => formRnc.submit()}
        confirmLoading={salvandoRnc}
        okText="Registrar RNC e encerrar inspeção"
        closable={false}
        maskClosable={false}
        keyboard={false}
        cancelButtonProps={{ style: { display: 'none' } }}
        width={800}
      >
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          message="Preenchimento obrigatório para encerrar a inspeção"
          description="Causa raiz, plano do fornecedor e verificação de eficácia são preenchidos depois, na tela da RNC."
        />
        {/* O sistema so sugere: se a Qualidade discordar, basta trocar o
            "Reincidência" para "Não". */}
        {reincidencia?.reincidencia && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 12 }}
            message="Reincidência detectada"
            description={
              <>
                Este fornecedor já teve o mesmo modo de falha neste item:
                <ul style={{ margin: '6px 0 0 0', paddingLeft: 18 }}>
                  {reincidencia.anteriores.map((a: any) => (
                    <li key={a.id}>
                      <b>{a.numero}</b> ({dayjs(a.dataAbertura).format('DD/MM/YYYY')})
                      — {a.modos.join('; ')}
                    </li>
                  ))}
                </ul>
              </>
            }
          />
        )}
        <Form form={formRnc} layout="vertical" onFinish={salvarRncObrigatoria}>
          <Row gutter={12}>
            <Col span={16}>
              <Form.Item
                name="tipoDesvio"
                label="Tipo de desvio"
                rules={[{ required: true, message: 'Informe o tipo de desvio.' }]}
              >
                <Select
                  placeholder="Dimensional ou Visual"
                  options={TIPOS_DESVIO.map((t) => ({ value: t, label: t }))}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="reincidencia" label="Reincidência">
                <Radio.Group optionType="button" buttonStyle="solid">
                  <Radio.Button value={true}>Sim</Radio.Button>
                  <Radio.Button value={false}>Não</Radio.Button>
                </Radio.Group>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="descricaoDesvio"
            label="Descrição do desvio"
            rules={[{ required: true, message: 'Descreva o desvio.' }]}
          >
            <Input.TextArea rows={3} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="quantidadePecas" label="Quantidade de peças">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="valorUnitario" label="Valor unitário (R$)">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Valor total (R$)">
                <Input
                  disabled
                  value={
                    qtdPecasRnc && valorUnitRnc
                      ? (qtdPecasRnc * valorUnitRnc).toFixed(2)
                      : '-'
                  }
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="disposicao"
            label="Disposição"
            rules={[{ required: true, message: 'Informe a disposição.' }]}
          >
            <Input.TextArea
              rows={2}
              placeholder="Ex.: Devolver ao fornecedor / Retrabalho / Uso sob concessão"
            />
          </Form.Item>
          <Form.Item label="Evidências / Fotos">
            <Upload
              multiple
              accept="image/*"
              listType="picture"
              fileList={fotosRnc}
              beforeUpload={() => false}
              onChange={({ fileList }) => setFotosRnc(fileList)}
            >
              <Button icon={<UploadOutlined />}>Adicionar fotos</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
