import { useState } from 'react';
import {
  Card,
  Col,
  DatePicker,
  Divider,
  Row,
  Space,
  Statistic,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import {
  Base,
  CabecalhoPagina,
  CartaoIndicador,
  FaixaContadores,
  type Indicador,
} from '../../design/painel';
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  FieldTimeOutlined,
  RetweetOutlined,
  TagsOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Dayjs } from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { dataBR, numeroBR } from '../../formatos';
import {
  corResultado,
  corResultadoAuditoria,
  corResultadoItem,
  corStatusAuditoria,
  corStatusHomologacao,
  labelResultado,
  labelResultadoAuditoria,
  labelResultadoItem,
  labelStatusAuditoria,
  labelStatusHomologacao,
  nota,
} from './comum';
import Tabela from '../../components/Tabela';
import { COR, MARCA } from '../../design/tokens';

const { RangePicker } = DatePicker;

// Painel do SQD. Os indicadores sao os seis que o usuario definiu: aprovacao de
// itens e de fornecedores, aprovacao condicional, mediana do tempo de
// homologacao, aprovacao de itens de primeira e a distribuicao A/B/C/D da base.
export default function PainelSqd() {
  const navigate = useNavigate();
  const [periodo, setPeriodo] = useState<[Dayjs, Dayjs] | null>(null);

  const de = periodo?.[0]?.format('YYYY-MM-DD');
  const ate = periodo?.[1]?.format('YYYY-MM-DD');

  const { data: kpis, isLoading } = useQuery<any>({
    queryKey: ['sqd-kpis', de, ate],
    queryFn: async () =>
      (await api.get('/sqd/painel/kpis', { params: { de, ate } })).data,
  });

  const { data: ultimas, isLoading: loadingUltimas } = useQuery<any[]>({
    queryKey: ['sqd-ultimas'],
    queryFn: async () => (await api.get('/sqd/painel/ultimas')).data,
  });

  // Aba "KPI's" do FMR.025.01: o mesmo painel, aplicado a homologacao de itens.
  const { data: kpisItens, isLoading: loadingItens } = useQuery<any>({
    queryKey: ['sqd-kpis-itens', de, ate],
    queryFn: async () =>
      (await api.get('/sqd/painel/itens/kpis', { params: { de, ate } })).data,
  });

  const { data: ultimasItens, isLoading: loadingUltimasItens } = useQuery<any[]>(
    {
      queryKey: ['sqd-ultimas-itens'],
      queryFn: async () => (await api.get('/sqd/painel/itens/ultimas')).data,
    },
  );

  // Auditoria de fornecedores: alem do resultado, o painel acompanha o loop de
  // reavaliacao (90 dias corridos para reprovado, 180 para condicional).
  const { data: kpisAud, isLoading: loadingAud } = useQuery<any>({
    queryKey: ['sqd-kpis-auditorias', de, ate],
    queryFn: async () =>
      (await api.get('/sqd/painel/auditorias/kpis', { params: { de, ate } }))
        .data,
  });

  const { data: ultimasAud, isLoading: loadingUltimasAud } = useQuery<any[]>({
    queryKey: ['sqd-ultimas-auditorias'],
    queryFn: async () => (await api.get('/sqd/painel/auditorias/ultimas')).data,
  });

  // Os indicadores de fornecedores, na ordem que o usuario definiu.
  const indFornecedores: Indicador[] = [
    {
      titulo: 'Aprovação de fornecedores homologados',
      metrica:
        'Fornecedores aprovados (incluindo os condicionais) / fornecedores avaliados x 100',
      valor: kpis?.pctAprovacao ?? 0,
      sufixo: '%',
      casas: 1,
      icone: <CheckCircleOutlined />,
      cor: COR.sucesso,
      rodape: `${numeroBR((kpis?.aprovados ?? 0) + (kpis?.condicionais ?? 0))} de ${numeroBR(kpis?.avaliadas ?? 0)} avaliados`,
    },
    {
      titulo: 'Aprovação Condicional de fornecedores',
      metrica:
        'Fornecedores aprovados condicionalmente / fornecedores avaliados x 100',
      valor: kpis?.pctAprovacaoCondicional ?? 0,
      sufixo: '%',
      casas: 1,
      icone: <ExclamationCircleOutlined />,
      cor: COR.atencao,
      rodape: `${numeroBR(kpis?.condicionais ?? 0)} de ${numeroBR(kpis?.avaliadas ?? 0)} avaliados`,
    },
    {
      titulo: 'Tempo de homologação de fornecedores',
      metrica:
        'Mediana de dias úteis entre a abertura e a conclusão da homologação',
      valor: kpis?.medianaCicloDiasUteis ?? 0,
      // Espaco inseparavel: o HTML come o espaco comum e imprime "5,5dias".
      sufixo: '\u00a0dias úteis',
      casas: 1,
      icone: <FieldTimeOutlined />,
      rodape: `mediana de ${numeroBR(kpis?.ciclosMedidos ?? 0)} homologações concluídas`,
    },
  ];

  const indItens: Indicador[] = [
    {
      titulo: 'Aprovação de itens homologados',
      metrica: 'Itens aprovados / itens com veredito x 100',
      valor: kpisItens?.pctAprovacao ?? 0,
      sufixo: '%',
      casas: 1,
      icone: <CheckCircleOutlined />,
      cor: COR.sucesso,
      rodape: `${numeroBR(kpisItens?.aprovados ?? 0)} de ${numeroBR(kpisItens?.analisados ?? 0)} com veredito`,
    },
    {
      titulo: 'Aprovação de itens na primeira submissão',
      metrica:
        'Itens aprovados com uma única submissão / itens com veredito x 100',
      valor: kpisItens?.pctPrimeiraSubmissao ?? 0,
      sufixo: '%',
      casas: 1,
      icone: <RetweetOutlined />,
      cor: MARCA.laranja,
      rodape: `${numeroBR(kpisItens?.aprovadosPrimeiraSubmissao ?? 0)} de ${numeroBR(kpisItens?.analisados ?? 0)} com veredito`,
    },
  ];

  const classes: any[] = kpis?.distribuicaoClasses ?? [];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <CabecalhoPagina
        titulo="Painel Resumo — SQD (Desenvolvimento de Fornecedores)"
        acoes={
          <RangePicker
            format="DD/MM/YYYY"
            placeholder={['Início', 'Fim']}
            onChange={(v) => setPeriodo(v as [Dayjs, Dayjs] | null)}
          />
        }
      />

      <Divider orientation="left" plain>
        Homologação de Fornecedores — Doc. BDBR.QUA.FMR.029.01
      </Divider>

      <Row gutter={[16, 16]} align="stretch">
        {indFornecedores.map((i) => (
          <Col xs={24} sm={12} lg={6} key={i.titulo}>
            <CartaoIndicador i={i} carregando={isLoading} />
          </Col>
        ))}
        {/* A distribuicao A/B/C/D e um retrato da base ativa de hoje: o filtro
            de periodo la em cima nao mexe nela. */}
        <Col xs={24} sm={24} lg={6}>
          <Card>
            <Statistic
              title={
                <Tooltip title="Fornecedores ativos por classe de fornecimento (A, B, C e D) — quantidade e % da base">
                  <span
                    style={{
                      display: 'block',
                      minHeight: 44,
                      lineHeight: '22px',
                    }}
                  >
                    Distribuição da classificação de fornecedores
                  </span>
                </Tooltip>
              }
              value={kpis?.fornecedoresAtivos ?? 0}
              formatter={(v) => numeroBR(Number(v))}
              loading={isLoading}
              prefix={<TagsOutlined />}
            />
            <Base texto="fornecedores ativos na base" />
            <Row gutter={8} style={{ marginTop: 8 }}>
              {classes.map((c) => (
                <Col span={6} key={c.classe} style={{ textAlign: 'center' }}>
                  <Typography.Text strong style={{ display: 'block' }}>
                    {c.classe}
                  </Typography.Text>
                  <Typography.Text style={{ display: 'block' }}>
                    {numeroBR(c.qtd)}
                  </Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {numeroBR(c.pct, 1)}%
                  </Typography.Text>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>

      <FaixaContadores
        carregando={isLoading}
        itens={[
          { t: 'Homologações registradas', v: kpis?.total },
          {
            t: 'Aguardando fornecedor',
            v: kpis?.aguardandoFornecedor,
            cor: COR.informativo,
          },
          { t: 'Autoavaliações lançadas', v: kpis?.avaliadas },
          { t: 'Aprovados', v: kpis?.aprovados, cor: COR.sucesso },
          {
            t: 'Aprovados condicionalmente',
            v: kpis?.condicionais,
            cor: COR.atencao,
          },
          { t: 'Reprovados', v: kpis?.reprovados, cor: COR.critico },
          { t: 'Em andamento', v: kpis?.emAndamento },
          { t: 'Finalizadas', v: kpis?.finalizadas, cor: COR.sucesso },
          { t: 'Canceladas', v: kpis?.canceladas },
          {
            t: 'Planos de ação em andamento',
            v: kpis?.planosEmAndamento,
            cor: COR.atencao,
          },
        ]}
      />

      <Card title="Últimas homologações de fornecedores">
        <Tabela
          rowKey="id"
          size="small"
          loading={loadingUltimas}
          dataSource={ultimas}
          pagination={false}
          scroll={{ x: 900 }}
          locale={{ emptyText: 'Nenhuma homologação registrada' }}
          onRow={(r) => ({
            onClick: () => navigate(`/sqd/homologacoes/${r.id}`),
            style: { cursor: 'pointer' },
          })}
          columns={[
            { title: 'Número', dataIndex: 'numero', width: 120 },
            {
              title: 'Solicitação',
              dataIndex: 'dataSolicitacao',
              width: 110,
              render: (d: string) => dataBR(d),
            },
            { title: 'Fornecedor', dataIndex: 'fornecedorNome' },
            {
              title: 'Nota',
              dataIndex: 'nota',
              width: 90,
              align: 'right',
              render: (v: number | null) => <strong>{nota(v)}</strong>,
            },
            {
              title: 'Resultado',
              dataIndex: 'resultado',
              width: 230,
              render: (r: string | null, h: any) =>
                r ? (
                  <Tag color={corResultado[r]}>{labelResultado[r]}</Tag>
                ) : h.statusHomologacao === 'CANCELADO' ? (
                  '-'
                ) : (
                  <Tag>Aguardando retorno do fornecedor</Tag>
                ),
            },
            {
              title: 'Status',
              dataIndex: 'statusHomologacao',
              width: 130,
              render: (s: string) => (
                <Tag color={corStatusHomologacao[s]}>
                  {labelStatusHomologacao[s]}
                </Tag>
              ),
            },
          ]}
        />
      </Card>

      <Divider orientation="left" plain>
        Homologação de Itens — Doc. BDBR.QUA.FMR.025.01
      </Divider>

      <Row gutter={[16, 16]} align="stretch">
        {indItens.map((i) => (
          <Col xs={24} sm={12} lg={6} key={i.titulo}>
            <CartaoIndicador i={i} carregando={loadingItens} />
          </Col>
        ))}
      </Row>

      <FaixaContadores
        carregando={loadingItens}
        itens={[
          { t: 'Itens registrados', v: kpisItens?.total },
          {
            t: 'Aguardando amostras',
            v: kpisItens?.aguardandoAmostras,
            cor: COR.informativo,
          },
          { t: 'Itens inspecionados', v: kpisItens?.analisados },
          { t: 'Aprovados', v: kpisItens?.aprovados, cor: COR.sucesso },
          { t: 'Reprovados', v: kpisItens?.reprovados, cor: COR.critico },
          { t: 'Em andamento', v: kpisItens?.emAndamento },
          { t: 'Finalizadas', v: kpisItens?.finalizadas, cor: COR.sucesso },
          { t: 'Canceladas', v: kpisItens?.canceladas },
          {
            t: 'Planos de ação em andamento',
            v: kpisItens?.planosEmAndamento,
            cor: COR.atencao,
          },
        ]}
      />

      <Card title="Últimas homologações de itens">
        <Tabela
          rowKey="id"
          size="small"
          loading={loadingUltimasItens}
          dataSource={ultimasItens}
          pagination={false}
          scroll={{ x: 1000 }}
          locale={{ emptyText: 'Nenhuma homologação de item registrada' }}
          onRow={(r) => ({
            onClick: () => navigate(`/sqd/homologacoes-itens/${r.id}`),
            style: { cursor: 'pointer' },
          })}
          columns={[
            { title: 'Número', dataIndex: 'numero', width: 120 },
            {
              title: 'Solicitação',
              dataIndex: 'dataSolicitacao',
              width: 110,
              render: (d: string) => dataBR(d),
            },
            { title: 'Fornecedor', dataIndex: 'fornecedorNome' },
            {
              title: 'Item',
              dataIndex: 'itemCodigo',
              width: 220,
              render: (c: string, h: any) =>
                `${c ?? '-'}${h.itemDescricao ? ` — ${h.itemDescricao}` : ''}`,
            },
            {
              title: 'Tentativas',
              dataIndex: 'tentativas',
              width: 100,
              align: 'right',
            },
            {
              title: 'Resultado',
              dataIndex: 'resultado',
              width: 230,
              render: (r: string | null, h: any) =>
                r ? (
                  <Tag color={corResultadoItem[r]}>{labelResultadoItem[r]}</Tag>
                ) : h.statusHomologacao === 'CANCELADO' ? (
                  '-'
                ) : (
                  <Tag>Aguardando amostras do fornecedor</Tag>
                ),
            },
            {
              title: 'Status',
              dataIndex: 'statusHomologacao',
              width: 130,
              render: (s: string) => (
                <Tag color={corStatusHomologacao[s]}>
                  {labelStatusHomologacao[s]}
                </Tag>
              ),
            },
          ]}
        />
      </Card>

      <Divider orientation="left" plain>
        Auditoria de Fornecedores — Checklist de Auditoria
      </Divider>

      {/* A auditoria nao tem cartao de indicador nesta fase, mas o semaforo do
          prazo de reavaliacao e alarme operacional e nao pode sumir: desceu
          para os contadores, em vermelho (venceu) e amarelo (ultimos 15 dias). */}
      <FaixaContadores
        carregando={loadingAud}
        itens={[
          { t: 'Auditorias registradas', v: kpisAud?.total },
          {
            t: 'Aguardando checklist',
            v: kpisAud?.aguardandoChecklist,
            cor: COR.informativo,
          },
          { t: 'Auditorias avaliadas', v: kpisAud?.avaliadas },
          { t: 'Aprovados', v: kpisAud?.aprovados, cor: COR.sucesso },
          {
            t: 'Aprovados condicionalmente',
            v: kpisAud?.condicionais,
            cor: COR.atencao,
          },
          { t: 'Reprovados', v: kpisAud?.reprovados, cor: COR.critico },
          {
            t: 'Reavaliações vencidas',
            v: kpisAud?.reavaliacoesVencidas,
            cor: COR.critico,
          },
          {
            t: 'Reavaliações a vencer (15 dias)',
            v: kpisAud?.reavaliacoesAVencer,
            cor: COR.alerta,
          },
          {
            t: 'No loop de reavaliação',
            v: kpisAud?.emReavaliacao,
            cor: COR.atencao,
          },
          { t: 'Reavaliadas (2ª rodada ou mais)', v: kpisAud?.reavaliadas },
          { t: 'Em andamento', v: kpisAud?.emAndamento },
          { t: 'Encerradas', v: kpisAud?.finalizadas, cor: COR.sucesso },
          { t: 'Canceladas', v: kpisAud?.canceladas },
        ]}
      />

      <Card title="Últimas auditorias de fornecedores">
        <Tabela
          rowKey="id"
          size="small"
          loading={loadingUltimasAud}
          dataSource={ultimasAud}
          pagination={false}
          scroll={{ x: 1100 }}
          locale={{ emptyText: 'Nenhuma auditoria registrada' }}
          onRow={(r) => ({
            onClick: () => navigate(`/sqd/auditorias/${r.id}`),
            style: { cursor: 'pointer' },
          })}
          columns={[
            { title: 'Número', dataIndex: 'numero', width: 120 },
            {
              title: 'Auditoria',
              dataIndex: 'dataAuditoria',
              width: 110,
              render: (d: string) => dataBR(d),
            },
            { title: 'Fornecedor', dataIndex: 'fornecedorNome' },
            {
              title: 'Rodadas',
              dataIndex: 'rodadasLancadas',
              width: 90,
              align: 'right',
            },
            {
              title: 'Nota',
              dataIndex: 'nota',
              width: 90,
              align: 'right',
              render: (v: number | null) => <strong>{nota(v)}</strong>,
            },
            {
              title: 'Resultado',
              dataIndex: 'resultado',
              width: 210,
              render: (r: string | null) =>
                r ? (
                  <Tag color={corResultadoAuditoria[r]}>
                    {labelResultadoAuditoria[r]}
                  </Tag>
                ) : (
                  <Tag>Aguardando checklist</Tag>
                ),
            },
            {
              title: 'Status',
              dataIndex: 'statusAuditoria',
              width: 130,
              render: (s: string) => (
                <Tag color={corStatusAuditoria[s]}>
                  {labelStatusAuditoria[s]}
                </Tag>
              ),
            },
          ]}
        />
      </Card>
    </Space>
  );
}
