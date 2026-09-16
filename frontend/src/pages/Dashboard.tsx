import { useState } from 'react';
import {
  Button,
  Card,
  Col,
  DatePicker,
  Row,
  Space,
  Tag,
  Typography,
} from 'antd';
import {
  CabecalhoPagina,
  CartaoIndicador,
  FaixaContadores,
  type Indicador,
} from '../design/painel';
import {
  CheckCircleOutlined,
  DollarOutlined,
  ClockCircleOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  MinusOutlined,
  ReconciliationOutlined,
  FieldTimeOutlined,
  FileDoneOutlined,
  SafetyCertificateOutlined,
  RetweetOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Dayjs } from 'dayjs';
import { api } from '../api';
import { useAuth } from '../auth';
import Tabela, { filtrosDe } from '../components/Tabela';
import { dataBR, numeroBR } from '../formatos';
import { corClasse, ROTULO_CLASSE } from '../fornecedor';
import { COR, MARCA, TEXTO } from '../design/tokens';

const { RangePicker } = DatePicker;

function tendenciaTag(t: string) {
  if (t === 'UPGRADE')
    return (
      <Tag color="green" icon={<ArrowUpOutlined />}>
        Melhorou
      </Tag>
    );
  if (t === 'DOWNGRADE')
    return (
      <Tag color="red" icon={<ArrowDownOutlined />}>
        Piorou
      </Tag>
    );
  return <Tag icon={<MinusOutlined />}>Estável</Tag>;
}

// A ordem das classes e alfabetica e A e a melhor: quem sai de D para A
// melhorou. Nao existe classe fora de A..D.
function movimentoDaClasse(de?: string | null, para?: string | null) {
  if (!de || !para || de === para) return 'ESTAVEL';
  return para < de ? 'UPGRADE' : 'DOWNGRADE';
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [periodo, setPeriodo] = useState<[Dayjs, Dayjs] | null>(null);

  const de = periodo?.[0]?.startOf('day').toISOString();
  const ate = periodo?.[1]?.endOf('day').toISOString();

  const { data: kpis, isLoading } = useQuery<any>({
    queryKey: ['kpis-sqe', de, ate],
    queryFn: async () =>
      (await api.get('/dashboard/kpis-sqe', { params: { de, ate } })).data,
  });

  const { data: evolucao, isLoading: loadingEvo } = useQuery<any[]>({
    queryKey: ['evolucao-fornecedores'],
    queryFn: async () =>
      (await api.get('/dashboard/evolucao-fornecedores')).data,
  });

  // O que o fechamento do trimestre escreveu no cadastro. E o unico registro de
  // que a classe de um fornecedor mudou - e com ela a periodicidade de inspecao
  // no recebimento.
  const { data: reclassificacoes, isLoading: loadingReclass } = useQuery<any[]>(
    {
      queryKey: ['historico-classificacao'],
      queryFn: async () =>
        (await api.get('/dashboard/historico-classificacao')).data,
    },
  );

  const ind = kpis?.indicadores ?? {};
  const cont = kpis?.contadores ?? {};
  const base = kpis?.bases ?? {};
  const prazos = kpis?.prazos ?? {};

  const podeAdmin =
    usuario?.papel === 'ADMIN' || usuario?.papel === 'QUALIDADE';

  const reclass = reclassificacoes ?? [];
  const mudaram = reclass.filter(
    (r) => r.classificacaoInicial !== r.classificacaoApurada,
  ).length;
  const ultimoTrimestre = reclass[0]?.trimestreFiscal;

  // Os indicadores do painel, na ordem e com os nomes definidos pela
  // Qualidade. Cada um traz a metrica no tooltip e os numeros crus embaixo.
  const indicadores: Indicador[] = [
    {
      titulo: 'Aprovação de lotes no recebimento',
      metrica: 'Lotes aprovados ÷ lotes inspecionados × 100.',
      valor: ind.pctAprovacaoLotes,
      sufixo: '%',
      icone: <CheckCircleOutlined />,
      cor: COR.sucesso,
      rodape: `${base.lotesAprovados ?? 0} de ${base.lotesInspecionados ?? 0} lotes inspecionados`,
    },
    {
      titulo: 'Tempo médio de resposta a RNC',
      metrica:
        'Mediana dos dias entre a emissão da RNC e a resposta do fornecedor.',
      valor: ind.medianaRespostaRncDias,
      // Espaco inseparavel: o HTML come o espaco comum e imprime "3,0dias".
      sufixo: '\u00a0dias',
      icone: <ClockCircleOutlined />,
      rodape: `${base.rncsComResposta ?? 0} RNC(s) com resposta`,
    },
    {
      titulo: 'Savings por bloqueio de lotes com RNC',
      metrica:
        'Somatório do valor evitado pelos bloqueios validados. Cada RNC é um bloqueio.',
      valor: ind.savingsBloqueioReais,
      icone: <DollarOutlined />,
      casas: 2,
      cor: MARCA.laranja,
      rodape: `${base.rncsTotal ?? 0} bloqueio(s) no período`,
    },
    {
      titulo: 'Planos de ação de RNC no prazo',
      metrica: `RNCs com plano recebido no prazo ÷ RNCs que exigem ação × 100. Prazo: ${prazos.planoRncDiasUteis ?? 5} dias úteis de quando o fornecedor recebe a notificação.`,
      valor: ind.pctPlanosNoPrazo,
      sufixo: '%',
      icone: <FileDoneOutlined />,
      rodape: `${base.planosNoPrazo ?? 0} de ${base.rncsTotal ?? 0} RNCs`,
    },
    {
      titulo: 'Encerramento de RNCs no prazo',
      metrica: `RNCs encerradas no prazo ÷ RNCs encerradas no período × 100. Prazo: ${prazos.encerramentoRncDiasUteis ?? 7} dias úteis após a abertura.`,
      valor: ind.pctEncerramentoNoPrazo,
      sufixo: '%',
      icone: <FieldTimeOutlined />,
      rodape: `${base.encerramentosNoPrazo ?? 0} de ${base.rncsEncerradasPeriodo ?? 0} encerradas`,
    },
    {
      titulo: 'Eficácia das ações de RNC',
      metrica: 'Ações eficazes ÷ ações verificadas × 100.',
      valor: ind.pctEficaciaAcoes,
      sufixo: '%',
      icone: <SafetyCertificateOutlined />,
      rodape: `${base.acoesEficazes ?? 0} de ${base.acoesVerificadas ?? 0} verificadas`,
    },
    {
      titulo: 'Reincidência de RNCs no recebimento',
      metrica: 'RNCs reincidentes ÷ RNCs abertas no período × 100.',
      valor: ind.pctReincidencia,
      sufixo: '%',
      icone: <RetweetOutlined />,
      // Unico indicador em que numero alto e ruim.
      cor: ind.pctReincidencia ? COR.critico : undefined,
      rodape: `${base.rncsReincidentes ?? 0} de ${base.rncsTotal ?? 0} RNCs`,
    },
    {
      titulo: 'Conformidade de calibração',
      metrica:
        'Instrumentos calibrados dentro da validade ÷ instrumentos previstos × 100. É uma foto de hoje do inventário, não do período.',
      valor: ind.pctConformidadeCalibracao,
      sufixo: '%',
      icone: <ToolOutlined />,
      rodape: `${base.instrumentosEmDia ?? 0} de ${base.instrumentosPrevistos ?? 0} instrumentos`,
    },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <CabecalhoPagina
        titulo="Painel Resumo — Qualidade de Fornecedores (SQE)"
        acoes={
          <RangePicker
            format="DD/MM/YYYY"
            placeholder={['Início', 'Fim']}
            onChange={(v) => setPeriodo(v as [Dayjs, Dayjs] | null)}
          />
        }
      />

      <Row gutter={[16, 16]} align="stretch">
        {indicadores.map((i) => (
          <Col xs={24} sm={12} lg={8} key={i.titulo}>
            <CartaoIndicador i={i} carregando={isLoading} />
          </Col>
        ))}
      </Row>

      <FaixaContadores
        carregando={isLoading}
        itens={[
          { t: 'Entregas', v: cont.entregas },
          { t: 'Inspeções', v: cont.inspecoes },
          {
            // Fora do plano de periodicidade: fornecedor eventual ou pedido
            // pontual da Qualidade. Os desvios contam nos demais indicadores.
            t: 'Inspeções extras',
            v: cont.inspecoesExtra,
            cor: COR.atencao,
          },
          {
            t: 'Recebimentos sem inspeção',
            v: cont.recebimentosSemInspecao,
            cor: TEXTO.suave,
          },
          { t: 'RNCs (total)', v: cont.rncsTotal },
          {
            t: 'RNCs em andamento',
            v: cont.rncsAbertas,
            cor: COR.critico,
          },
          {
            t: 'RNCs finalizadas',
            v: cont.rncsEncerradas,
            cor: COR.sucesso,
          },
        ]}
      />

      <Card
        title="Evolução e histórico dos fornecedores"
        extra={
          podeAdmin && (
            <Button
              icon={<ReconciliationOutlined />}
              onClick={() => navigate('/avaliacao-fornecedores')}
            >
              Avaliação de fornecedores
            </Button>
          )
        }
      >
        <Tabela
          rowKey="id"
          size="small"
          loading={loadingEvo}
          dataSource={evolucao}
          pagination={false}
          scroll={{ x: 'max-content' }}
          columns={[
            { title: 'Código', dataIndex: 'codigo', width: 100 },
            { title: 'Fornecedor', dataIndex: 'nome' },
            {
              title: 'Classificação atual',
              dataIndex: 'classificacaoFornecimento',
              width: 150,
              align: 'center',
              render: (c: string) => <Tag color={corClasse[c]}>{c}</Tag>,
            },
            {
              title: 'Apurada no período',
              dataIndex: 'classificacaoAtual',
              width: 150,
              align: 'center',
              render: (c: string) => <Tag color={corClasse[c]}>{c}</Tag>,
            },
            {
              title: 'IDF',
              dataIndex: 'idf',
              width: 90,
              align: 'center',
              render: (v: number | null) =>
                v === null ? '—' : numeroBR(v, 2),
            },
            {
              title: 'Conformidade',
              dataIndex: 'pctConformidade',
              width: 120,
              align: 'center',
              render: (v: number) => `${numeroBR(v, 1)}%`,
            },
            {
              title: 'Cargas recebidas',
              dataIndex: 'totalEntregas',
              width: 130,
              align: 'center',
            },
            {
              title: 'Lotes insp.',
              dataIndex: 'lotesInspecionados',
              width: 100,
              align: 'center',
            },
            {
              title: 'Reprovados',
              dataIndex: 'lotesReprovados',
              width: 100,
              align: 'center',
            },
            {
              title: 'Tendência',
              dataIndex: 'tendencia',
              width: 130,
              align: 'center',
              render: (t: string) => tendenciaTag(t),
            },
          ]}
        />
      </Card>

      {/* O fechamento do trimestre e o momento em que a classe do fornecedor e
          reescrita no cadastro - e com ela muda a periodicidade de inspecao no
          recebimento. Ate aqui isso acontecia sem deixar rastro em tela
          nenhuma: so a mensagem do fechamento dizia "N com mudanca de classe",
          e ela some assim que o usuario sai da pagina. */}
      <Card
        title="Reclassificações no fechamento do trimestre"
        extra={
          <Typography.Text type="secondary">
            {loadingReclass
              ? 'Carregando…'
              : reclass.length
                ? `${mudaram} de ${reclass.length} apuração(ões) mudaram a classe do fornecedor`
                : 'Nenhum trimestre fechado ainda'}
          </Typography.Text>
        }
      >
        <Tabela
          busca="Buscar fornecedor"
          rowKey="id"
          size="small"
          loading={loadingReclass}
          dataSource={reclass}
          pagination={false}
          scroll={{ x: 'max-content', y: 400 }}
          columns={[
            {
              title: 'Trimestre',
              dataIndex: 'trimestreFiscal',
              width: 110,
              filters: filtrosDe(reclass.map((r) => r.trimestreFiscal)),
              onFilter: (v: any, r: any) => r.trimestreFiscal === v,
            },
            {
              title: 'Código',
              width: 100,
              render: (_: any, r: any) => r.fornecedor?.codigo,
            },
            {
              title: 'Fornecedor',
              render: (_: any, r: any) => r.fornecedor?.nome,
            },
            {
              // De onde saiu e para onde foi. Sem os dois lados nao da para
              // saber se o fechamento mexeu em alguma coisa.
              title: 'Classe',
              width: 150,
              align: 'center',
              render: (_: any, r: any) => (
                <Space size={4}>
                  <Tag
                    color={corClasse[r.classificacaoInicial]}
                    title={ROTULO_CLASSE[r.classificacaoInicial]}
                  >
                    {r.classificacaoInicial ?? '—'}
                  </Tag>
                  <span style={{ color: TEXTO.suave }}>→</span>
                  <Tag
                    color={corClasse[r.classificacaoApurada]}
                    title={ROTULO_CLASSE[r.classificacaoApurada]}
                  >
                    {r.classificacaoApurada ?? '—'}
                  </Tag>
                </Space>
              ),
            },
            {
              title: 'Movimento',
              width: 130,
              align: 'center',
              filters: [
                { text: 'Melhorou', value: 'UPGRADE' },
                { text: 'Piorou', value: 'DOWNGRADE' },
                { text: 'Manteve', value: 'ESTAVEL' },
              ],
              onFilter: (v: any, r: any) =>
                movimentoDaClasse(
                  r.classificacaoInicial,
                  r.classificacaoApurada,
                ) === v,
              render: (_: any, r: any) => {
                const m = movimentoDaClasse(
                  r.classificacaoInicial,
                  r.classificacaoApurada,
                );
                return m === 'ESTAVEL' ? (
                  <Tag icon={<MinusOutlined />}>Manteve</Tag>
                ) : (
                  tendenciaTag(m)
                );
              },
            },
            {
              title: 'Lotes insp.',
              dataIndex: 'lotesInspecionados',
              width: 100,
              align: 'center',
            },
            {
              title: 'Reprovados',
              dataIndex: 'lotesReprovados',
              width: 100,
              align: 'center',
            },
            {
              title: 'Conformidade',
              dataIndex: 'pctConformidade',
              width: 120,
              align: 'center',
              render: (v: number, r: any) =>
                r.lotesInspecionados ? `${numeroBR(v, 1)}%` : '—',
            },
            {
              title: 'Aplicada em',
              dataIndex: 'createdAt',
              width: 110,
              render: (v: string) => dataBR(v),
            },
          ]}
        />
        <div style={{ marginTop: 12 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Quem reclassifica é o fechamento do <b>trimestre</b>, não o do mês.
            Fornecedor sem nenhum lote inspecionado no trimestre não é
            reclassificado: ele não aparece aqui e mantém a classe que já tinha.
            {ultimoTrimestre
              ? ` Último trimestre apurado: ${ultimoTrimestre}.`
              : ''}
          </Typography.Text>
        </div>
      </Card>
    </Space>
  );
}
