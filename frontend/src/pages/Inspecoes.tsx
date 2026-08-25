import { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Descriptions,
  Divider,
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
  FileTextOutlined,
  UploadOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { useFornecedores, opcoesFornecedor } from '../hooks';
import { semanaAno } from '../semana';
import {
  CamposFornecedor,
  valoresIniciaisFornecedor,
} from '../components/CamposFornecedor';
import { OPCOES_NORMA, TabelaCotasMaxMin } from '../components/TabelaCotas';
import {
  UploadFotosEvidencia,
  enviarFotosEvidencia,
} from '../components/FotosEvidencia';
import { EVID, ORIGENS_RECEBIMENTO } from '../inspecao';
import Tabela from '../components/Tabela';
import { CamposItem } from '../components/CamposItem';
import { TIPOS_DESVIO } from '../tipo-desvio';

type StatusItem = 'APROVADO' | 'REPROVADO' | 'NAO_APLICAVEL';

const corResultado: Record<string, string> = {
  APROVADO: 'green',
  // Passou no recebimento, mas com desvio apontado e sem RNC: nao e um
  // aprovado limpo, entao nao pode sair verde na listagem.
  APROVADO_COM_DESVIO: 'orange',
  REPROVADO: 'red',
  SEM_INSPECAO: 'default',
};

const labelResultado: Record<string, string> = {
  APROVADO: 'Aprovado',
  APROVADO_COM_DESVIO: 'Aprovado com desvio registrado',
  REPROVADO: 'Reprovado',
  SEM_INSPECAO: 'Sem inspeção recomendada',
};

const labelFormulario: Record<string, string> = {
  VISUAL: 'Visual',
  LOTE: 'Lote / Dimensional',
};

function ChecklistVisual({
  grupos,
  setGrupos,
}: {
  grupos: any[];
  setGrupos: (g: any[]) => void;
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
          {g.itens.map((item: any, ii: number) => (
            <Row
              key={ii}
              align="middle"
              justify="space-between"
              style={{ padding: '4px 0' }}
            >
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
          ))}
        </Card>
      ))}
    </div>
  );
}

export default function Inspecoes() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const isAdmin = usuario?.papel === 'ADMIN';
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const [grupos, setGrupos] = useState<any[]>([]);
  const [cotas, setCotas] = useState<any[]>([]);
  // Bloco EVIDENCIAS do formulario visual: ate 4 fotos, sempre opcional.
  const [fotosVisual, setFotosVisual] = useState<any[]>([]);
  const [passoIdx, setPassoIdx] = useState(0);
  // Uma inspecao = um recebimento. A entrega criada no primeiro formulario e
  // reaproveitada no seguinte, para Visual e Lote serem a MESMA inspecao,
  // com o mesmo numero e uma unica RNC.
  const [entregaAtual, setEntregaAtual] = useState<number | undefined>();
  const [numeroInspecao, setNumeroInspecao] = useState<string | undefined>();
  const [desvioAnterior, setDesvioAnterior] = useState(false);
  const [rncDaInspecao, setRncDaInspecao] = useState<any | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Cadastro pontual de fornecedor, sem sair da inspecao
  const [openFornecedor, setOpenFornecedor] = useState(false);
  const [formFornecedor] = Form.useForm();
  const [salvandoFornecedor, setSalvandoFornecedor] = useState(false);

  // Pergunta "Abrir RNC?" quando o formulario reprova. Guarda os valores do
  // formulario ate o inspetor decidir; nada e gravado antes disso.
  const [decisaoRnc, setDecisaoRnc] = useState<any | null>(null);
  const [formDesvio] = Form.useForm();

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

  // Avalia recebimento (classificacao + periodicidade + contador ciclico)
  const { data: avaliacao } = useQuery<any>({
    queryKey: ['avaliar', fornecedorId],
    queryFn: async () =>
      (await api.get(`/inspecoes/avaliar?fornecedorId=${fornecedorId}`)).data,
    enabled: !!fornecedorId,
  });

  const precisaInspecionar = avaliacao?.precisaInspecionar ?? true;
  // Inspecao extra: fora da janela do ciclo ou fornecedor eventual. Aqui a
  // Qualidade escolhe os formularios na mao, ignorando o cadastro.
  const extraAtivo = !precisaInspecionar && !!extra;

  const fornecedorSel = useMemo(
    () => (fornecedores ?? []).find((f: any) => f.id === fornecedorId),
    [fornecedores, fornecedorId],
  );

  // Sequencia de etapas (ordem fixa Visual -> Lote). Na inspecao regular vem
  // do cadastro do fornecedor; na extra, da escolha manual.
  const passos = useMemo<('VISUAL' | 'LOTE')[]>(() => {
    const seq: ('VISUAL' | 'LOTE')[] = [];
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
  }, [extraAtivo, formulariosExtra, precisaInspecionar, fornecedorSel]);

  const tipo = passos[passoIdx] ?? 'VISUAL';
  const encadeado = passos.length > 1;
  const preencheFormulario = passos.length > 0;
  const ultimoPasso = passoIdx >= passos.length - 1;

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
    setFotosVisual([]);
    form.setFieldsValue({ observacoes: undefined });
  }

  function novaInspecao() {
    form.resetFields();
    setPassoIdx(0);
    setEntregaAtual(undefined);
    setNumeroInspecao(undefined);
    setDesvioAnterior(false);
    setRncDaInspecao(null);
    limparEtapa();
    form.setFieldsValue({
      origem: 'PLANO_INSPECAO',
      extra: false,
      toleranciasNorm: 'ISO2768',
    });
    setOpen(true);
  }

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

  function invalidar() {
    qc.invalidateQueries({ queryKey: ['inspecoes'] });
    qc.invalidateQueries({ queryKey: ['entregas'] });
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

  // Desvio apontado nao abre RNC sozinho: a decisao e do inspetor, tomada
  // AQUI, antes de gravar. E por isso que a pergunta vem antes do POST - o
  // servidor so numera uma RNC depois do "sim", entao dizer "nao" nao queima
  // numero na sequencia.
  //
  // Nao se pergunta quando o recebimento ja tem RNC aberta (o Visual reprovou
  // e o Dimensional reprovou depois): ali o desvio novo complementa a RNC que
  // existe, como sempre foi.
  async function onFinish(v: any) {
    if (
      preencheFormulario &&
      resultadoAuto === 'REPROVADO' &&
      !rncDaInspecao
    ) {
      setDecisaoRnc(v);
      return;
    }
    return salvarFormulario(v);
  }

  async function salvarFormulario(
    v: any,
    decisao?: { abrirRnc: boolean; observacaoDesvio?: string },
  ) {
    setSalvando(true);
    try {
      // Fora do ciclo e sem inspecao extra: registra apenas o recebimento
      if (!preencheFormulario) {
        await api.post('/inspecoes/recebimento', {
          fornecedorId: v.fornecedorId,
          notaFiscal: v.notaFiscal,
          po: v.po,
          dataEntrega: hoje.toISOString(),
        });
        setOpen(false);
        invalidar();
        message.success(
          'Recebimento registrado sem inspeção (fora do ciclo de periodicidade).',
        );
        return;
      }

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
      };
      if (tipo === 'VISUAL') payload.checklist = grupos;
      else payload.cotas = cotas;

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

      const rnc = res.rnc ?? rncDaInspecao;
      if (res.rnc) setRncDaInspecao(res.rnc);
      if (res.inspecao?.entregaId) setEntregaAtual(res.inspecao.entregaId);
      if (res.numeroInspecao) setNumeroInspecao(res.numeroInspecao);
      if (resultadoAuto === 'REPROVADO') setDesvioAnterior(true);

      // Ha proxima etapa (Visual -> Lote da MESMA inspecao)?
      if (!ultimoPasso) {
        const proximo = passos[passoIdx + 1];
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
          'Não foi possível registrar o recebimento.',
      );
    } finally {
      setSalvando(false);
    }
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
            render: (fs: string[]) =>
              fs?.length ? (
                <Space size={4} wrap={false}>
                  {fs.map((f) => (
                    <Tag key={f} color={f === 'VISUAL' ? 'geekblue' : 'purple'}>
                      {labelFormulario[f] ?? f}
                    </Tag>
                  ))}
                </Space>
              ) : (
                <Tag>Recebimento</Tag>
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
            render: (e: boolean, r: any) =>
              !r.formularios?.length ? '-' : e ? (
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
            width: 240,
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
          ...(isAdmin
            ? [
                {
                  title: '',
                  width: 50,
                  render: (_: any, r: any) =>
                    !r.formularios?.length ? null : (
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => confirmarExclusao(r)}
                      />
                    ),
                },
              ]
            : []),
        ]}
      />

      <Modal
        title={
          numeroInspecao
            ? `Inspeção ${numeroInspecao}`
            : 'Nova inspeção de recebimento'
        }
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={salvando}
        okText={
          !preencheFormulario
            ? 'Registrar recebimento sem inspeção'
            : !ultimoPasso
              ? `Registrar ${labelFormulario[tipo]} e continuar`
              : 'Concluir inspeção'
        }
        cancelText="Cancelar"
        width={900}
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
                  disabled={passoIdx > 0}
                  options={opcoesFornecedor(fornecedores)}
                />
              </Form.Item>
            </Col>
            {/* Fornecedor que nao esta na base (ex: importacao): cadastro
                pontual aqui mesmo, sem abandonar a inspecao. */}
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
            <Col span={7}>
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

          {/* Decisao de recebimento: classificacao + periodicidade + contador */}
          {fornecedorId && avaliacao && (
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

          {/* Recebimento sem inspecao: apenas NF / PO (data/semana/ano acima) */}
          {fornecedorId && !preencheFormulario && (
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="notaFiscal" label="Nota Fiscal">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="po" label="PO">
                  <Input />
                </Form.Item>
              </Col>
            </Row>
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
                      : 'O desvio anterior foi encerrado sem RNC. Se este formulário reprovar, a decisão de abrir a RNC será feita de novo.'
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
                    <Select options={OPCOES_NORMA} />
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
                <ChecklistVisual grupos={grupos} setGrupos={setGrupos} />
              ) : (
                <TabelaCotasMaxMin
                  cotas={cotas}
                  setCotas={setCotas}
                  norma={normaSel}
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
                      : 'Resultado: REPROVADO — ao concluir você decide se abre a RNC ou encerra como aprovado, com o desvio registrado.'
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

      {/* Pergunta "Abrir RNC?" - a decisao do inspetor. Nada foi gravado
          ainda: e por isso que dizer "nao" nao queima numero de RNC. */}
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
          message={
            tipo === 'VISUAL'
              ? `${desviosApontados.length} item(ns) do checklist visual reprovado(s)`
              : `${desviosApontados.length} cota(s) fora da tolerância`
          }
          description={
            desviosApontados.length ? (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {desviosApontados.slice(0, 8).map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
                {desviosApontados.length > 8 && (
                  <li>+ {desviosApontados.length - 8} outro(s)</li>
                )}
              </ul>
            ) : null
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
