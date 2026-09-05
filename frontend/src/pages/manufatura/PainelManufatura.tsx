import { useState } from 'react';
import {
  Button,
  Card,
  Col,
  DatePicker,
  Modal,
  Row,
  Space,
  message,
} from 'antd';
import {
  CabecalhoPagina,
  CartaoIndicador,
  FaixaContadores,
  type Indicador,
} from '../../design/painel';
import {
  AlertOutlined,
  CheckCircleOutlined,
  ReconciliationOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dayjs } from 'dayjs';
import { api } from '../../api';
import { useAuth } from '../../auth';
import { numeroBR } from '../../formatos';
import Tabela from '../../components/Tabela';
import { COR, MARCA } from '../../design/tokens';

const { RangePicker } = DatePicker;

// Coluna de dinheiro nas tabelas: o "R$" ja esta no titulo da coluna, entao
// aqui vai so o numero com duas casas.
const moeda = (v: number) => numeroBR(v, 2);

// Painel da Qualidade da Manufatura. Mesma leitura do painel do SQE, com os
// indicadores da fabrica: PPM, CNQ e o andamento dos ciclos de inspecao.
export default function PainelManufatura() {
  const qc = useQueryClient();
  const { usuario } = useAuth();
  const [periodo, setPeriodo] = useState<[Dayjs, Dayjs] | null>(null);

  const de = periodo?.[0]?.startOf('day').toISOString();
  const ate = periodo?.[1]?.endOf('day').toISOString();

  const { data: kpis, isLoading } = useQuery<any>({
    queryKey: ['manufatura-kpis', de, ate],
    queryFn: async () =>
      (await api.get('/manufatura/painel/kpis', { params: { de, ate } })).data,
  });

  const { data: evolucao, isLoading: loadingEvo } = useQuery<any[]>({
    queryKey: ['manufatura-evolucao'],
    queryFn: async () =>
      (await api.get('/manufatura/painel/evolucao-maquinas')).data,
  });

  const fecharTrimestre = useMutation({
    mutationFn: async () =>
      (await api.post('/manufatura/painel/fechar-trimestre')).data,
    onSuccess: (res: any) => {
      message.success(
        `Trimestre ${res.trimestre} fechado. ${res.maquinasProcessadas} máquina(s) registrada(s) no histórico.`,
      );
      qc.invalidateQueries({ queryKey: ['manufatura-evolucao'] });
      qc.invalidateQueries({ queryKey: ['maquinas'] });
    },
    onError: () => message.error('Não foi possível fechar o trimestre.'),
  });

  const ind = kpis?.indicadores ?? {};
  const base = kpis?.bases ?? {};
  const cont = kpis?.contadores ?? {};
  const icaq = kpis?.icaq ?? {};

  const podeAdmin = usuario?.papel === 'ADMIN' || usuario?.papel === 'QUALIDADE';

  // Os quatro indicadores do painel, na ordem e com os nomes definidos pela
  // Qualidade. Cada um traz a metrica no tooltip e os numeros crus embaixo.
  const indicadores: Indicador[] = [
    {
      titulo: 'Efetividade da liberação de setup',
      metrica:
        'Setups liberados sem ocorrência atribuível ao setup ÷ setups liberados × 100. Na prática: liberou na primeira tentativa. Precisou de reinspeção, perde o indicador.',
      valor: ind.pctSetupPrimeiraTentativa,
      sufixo: '%',
      casas: 1,
      icone: <ToolOutlined />,
      cor: COR.sucesso,
      rodape: `${base.setupsDePrimeira ?? 0} de ${base.setupsRealizados ?? 0} setups`,
    },
    {
      titulo: 'Refugo em PPM e valor',
      metrica:
        'PPM: peças refugadas ÷ peças produzidas × 1.000.000. R$: custo do refugo, somado dos lançamentos de CNQ do período.',
      valor: ind.ppm,
      casas: 0,
      icone: <AlertOutlined />,
      cor: MARCA.laranja,
      secundario: ind.custoRefugoReais ?? 0,
      rodape: `${numeroBR(base.pecasRefugadas ?? 0)} refugadas de ${numeroBR(base.pecasProduzidas ?? 0)} produzidas`,
    },
    {
      titulo: 'Efetividade das inspeções de produção',
      metrica:
        'Inspeções sem falha posterior atribuível ÷ inspeções realizadas × 100. Na prática: aprovou na primeira tentativa. Precisou de reinspeção, perde o indicador.',
      valor: ind.pctInspecaoPrimeiraTentativa,
      sufixo: '%',
      casas: 1,
      icone: <CheckCircleOutlined />,
      cor: COR.sucesso,
      rodape: `${base.inspecoesDePrimeira ?? 0} de ${base.inspecoesRealizadas ?? 0} inspeções`,
    },
    {
      titulo: 'Refugo sobre a produção',
      metrica:
        'Unidades refugadas ÷ unidades produzidas × 100. É o mesmo refugo do PPM, na escala percentual.',
      valor: ind.pctRefugoProducao,
      sufixo: '%',
      casas: 1,
      icone: <ReconciliationOutlined />,
      cor: COR.critico,
      rodape: `${numeroBR(base.pecasRefugadas ?? 0)} de ${numeroBR(base.pecasProduzidas ?? 0)} unidades`,
    },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <CabecalhoPagina
        titulo="Painel Resumo — Qualidade da Manufatura"
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
          <Col xs={24} sm={12} lg={6} key={i.titulo}>
            <CartaoIndicador i={i} carregando={isLoading} />
          </Col>
        ))}
      </Row>

      <FaixaContadores
        carregando={isLoading}
        itens={[
          { t: 'Máquinas ativas', v: cont.maquinas },
          { t: 'Inspeções de setup', v: cont.inspecoesSetup },
          { t: 'Inspeções de produção', v: cont.inspecoesProducao },
          {
            t: 'Pendentes de reinspeção',
            v: cont.inspecoesPendentes,
            cor: COR.critico,
          },
          { t: 'Reinspeções realizadas', v: cont.reinspecoes },
          { t: 'Lançamentos de CNQ', v: cont.lancamentosCnq },
          { t: '8D abertos', v: cont.oitoDsAbertos, cor: COR.critico },
          { t: '8D concluídos', v: cont.oitoDsConcluidos, cor: COR.sucesso },
        ]}
      />

      {/* ICAQ — como esta o programa de controle autonomo no periodo. Os dois
          rankings saem da PIOR nota para a melhor: quem precisa de atencao
          aparece primeiro. */}
      <Card title="ICAQ — Controle Autônomo da Qualidade">
        <FaixaContadores
          carregando={isLoading}
          itens={[
            { t: 'Auditorias no período', v: icaq.auditorias },
            {
              t: 'Nota média',
              v: icaq.notaMedia,
              sufixo: '%',
              casas: 1,
            },
            {
              t: 'Dentro do padrão',
              v: icaq.pctConforme,
              sufixo: '%',
              casas: 1,
              cor: COR.sucesso,
            },
            {
              t: 'Fora do padrão',
              v: icaq.pctForaDoPadrao,
              sufixo: '%',
              casas: 1,
              cor: COR.critico,
            },
            { t: 'Conformes', v: icaq.conformes, cor: COR.sucesso },
            { t: 'Em atenção', v: icaq.atencao, cor: MARCA.laranja },
            { t: 'Não conformes', v: icaq.naoConformes, cor: COR.critico },
          ]}
        />

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          {[
            { titulo: 'Por operador auditado', coluna: 'Operador auditado', dados: icaq.porOperador },
            { titulo: 'Por equipamento', coluna: 'Equipamento', dados: icaq.porEquipamento },
          ].map((bloco) => (
            <Col xs={24} lg={12} key={bloco.titulo}>
              <Card size="small" title={bloco.titulo}>
                <Tabela
                  rowKey="nome"
                  size="small"
                  loading={isLoading}
                  dataSource={bloco.dados}
                  pagination={false}
                  scroll={{ x: 'max-content' }}
                  locale={{ emptyText: 'Nenhuma auditoria no período' }}
                  columns={[
                    { title: bloco.coluna, dataIndex: 'nome' },
                    {
                      title: 'Auditorias',
                      dataIndex: 'auditorias',
                      width: 100,
                      align: 'center',
                    },
                    {
                      title: 'Nota média',
                      dataIndex: 'notaMedia',
                      width: 110,
                      align: 'right',
                      render: (v: number) => (
                        <strong>{numeroBR(v, 1)}%</strong>
                      ),
                    },
                    {
                      title: 'Conforme',
                      dataIndex: 'pctConforme',
                      width: 110,
                      align: 'right',
                      render: (v: number) => `${numeroBR(v, 1)}%`,
                    },
                  ]}
                />
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      <Card title="Defeitos mais recorrentes">
        <Tabela
          rowKey="nome"
          size="small"
          loading={isLoading}
          dataSource={kpis?.topDefeitos}
          pagination={false}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: 'Nenhum defeito lançado no período' }}
          columns={[
            { title: 'Descrição do defeito', dataIndex: 'nome' },
            {
              title: 'Quantidade',
              dataIndex: 'qtd',
              width: 140,
              align: 'right',
            },
            {
              title: 'CNQ (R$)',
              dataIndex: 'cnq',
              width: 160,
              align: 'right',
              render: moeda,
            },
          ]}
        />
      </Card>

      <Card title="PPM por máquina">
        <Tabela
          rowKey="id"
          size="small"
          loading={isLoading}
          dataSource={kpis?.ppmPorMaquina}
          pagination={false}
          scroll={{ x: 'max-content' }}
          columns={[
            { title: 'Máquina / Linha', dataIndex: 'nome' },
            {
              title: 'Área',
              dataIndex: 'area',
              width: 130,
              render: (a: string) =>
                a === 'MONTAGEM' ? 'Montagem' : 'Fabricação',
            },
            {
              title: 'Produzidas',
              dataIndex: 'produzidas',
              width: 120,
              align: 'right',
            },
            {
              title: 'Com defeito',
              dataIndex: 'defeitos',
              width: 120,
              align: 'right',
            },
            {
              title: 'CNQ (R$)',
              dataIndex: 'cnq',
              width: 140,
              align: 'right',
              render: moeda,
            },
            {
              title: 'PPM',
              dataIndex: 'ppm',
              width: 120,
              align: 'right',
              render: (v: number) => <strong>{numeroBR(v)}</strong>,
            },
          ]}
        />
      </Card>

      <Card
        title="Evolução e histórico das máquinas"
        extra={
          podeAdmin && (
            <Button
              icon={<ReconciliationOutlined />}
              loading={fecharTrimestre.isPending}
              onClick={() =>
                Modal.confirm({
                  title: 'Fechar trimestre fiscal',
                  content:
                    'Isto vai registrar o histórico do período de cada máquina e zerar os contadores do trimestre. Deseja continuar?',
                  okText: 'Fechar trimestre',
                  cancelText: 'Cancelar',
                  onOk: () => fecharTrimestre.mutate(),
                })
              }
            >
              Fechar trimestre
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
          scroll={{ x: 1100 }}
          columns={[
            { title: 'Código', dataIndex: 'codigo', width: 100 },
            { title: 'Máquina / Linha', dataIndex: 'nome' },
            {
              title: 'Setups',
              dataIndex: 'setupsRealizados',
              width: 90,
              align: 'center',
            },
            {
              title: 'Produções',
              dataIndex: 'producoesRealizadas',
              width: 100,
              align: 'center',
            },
            {
              title: 'Reprovadas',
              dataIndex: 'inspecoesReprovadas',
              width: 110,
              align: 'center',
            },
            {
              title: 'PPM',
              dataIndex: 'ppm',
              width: 100,
              align: 'right',
              render: (v: number) => numeroBR(v),
            },
            {
              title: 'CNQ (R$)',
              dataIndex: 'cnqTotal',
              width: 130,
              align: 'right',
              render: moeda,
            },
          ]}
        />
      </Card>
    </Space>
  );
}
