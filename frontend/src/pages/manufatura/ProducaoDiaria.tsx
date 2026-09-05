import { useState } from 'react';
import {
  Breadcrumb,
  Button,
  Card,
  Col,
  InputNumber,
  Row,
  Space,
  Statistic,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  LeftOutlined,
  RightOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { api } from '../../api';
import { dataInput, numeroBR, separadoresBR } from '../../formatos';
import Tabela from '../../components/Tabela';
import { COR, MARCA } from '../../design/tokens';
import { BotaoExcluir } from '../../design/acoes';

// Lancamento da producao (qtd produzida e qtd com defeito) e o PPM resultante,
// como na planilha. PPM = (pecas com defeito / pecas produzidas) * 1.000.000.
//
// A tela abre no MES CORRENTE com o resumo de todas as maquinas — sem precisar
// escolher maquina antes. Clicando numa maquina, entra no dia a dia daquele
// mes, onde a pessoa lanca a leitura do dia que quiser.

// Uma celula so conta como editada quando a chave existe no objeto. Isso
// separa "nao mexi" de "apaguei o numero": sem essa distincao, limpar o campo
// fazia o valor anterior voltar enquanto o usuario digitava.
function valorCelula(editado: any, salvo: any, campo: string) {
  if (editado && campo in editado) return editado[campo];
  return salvo?.[campo] ?? null;
}

export default function ProducaoDiaria() {
  const qc = useQueryClient();
  const [maquina, setMaquina] = useState<any>(null);
  const [mes, setMes] = useState(dayjs());
  const [linhas, setLinhas] = useState<Record<string, any>>({});
  const [salvando, setSalvando] = useState(false);

  const ano = mes.year();
  const numeroMes = mes.month() + 1;
  const maquinaId = maquina?.maquinaId;

  // Resumo do mes por maquina (visao de entrada).
  const { data: resumo, isLoading: carregandoResumo } = useQuery<any>({
    queryKey: ['producao-resumo', ano, numeroMes],
    queryFn: async () =>
      (
        await api.get('/maquinas/producao/resumo', {
          params: { ano, mes: numeroMes },
        })
      ).data,
  });

  // Dia a dia da maquina escolhida.
  const { data, isLoading } = useQuery<any>({
    queryKey: ['maquina-producao', maquinaId, ano, numeroMes],
    queryFn: async () =>
      (
        await api.get(`/maquinas/${maquinaId}/producao`, {
          params: { ano, mes: numeroMes },
        })
      ).data,
    enabled: !!maquinaId,
  });

  const salvos = new Map<string, any>(
    (data?.dias ?? []).map((d: any) => [dataInput(d.data), d]),
  );

  const diasDoMes = Array.from({ length: mes.daysInMonth() }, (_, i) => {
    const dia = mes.date(i + 1);
    const chave = dia.format('YYYY-MM-DD');
    const salvo = salvos.get(chave);
    const editado = linhas[chave];
    return {
      chave,
      dia,
      qtdProduzida: valorCelula(editado, salvo, 'qtdProduzida'),
      qtdDefeito: valorCelula(editado, salvo, 'qtdDefeito'),
      alterado: !!editado,
      producaoId: salvo?.id,
    };
  });

  // Apagar o apontamento devolve o dia para "em branco". Zerar os campos nao
  // serve: zero produzido conta como dia apontado no resumo do mes.
  async function excluirDia(r: any) {
    try {
      await api.delete(`/maquinas/${maquinaId}/producao/${r.producaoId}`);
      message.success(`Apontamento de ${r.dia.format('DD/MM')} excluído.`);
      setLinhas((atual) => {
        const { [r.chave]: _fora, ...resto } = atual;
        return resto;
      });
      qc.invalidateQueries({ queryKey: ['maquina-producao', maquinaId] });
      qc.invalidateQueries({ queryKey: ['producao-resumo'] });
      qc.invalidateQueries({ queryKey: ['maquinas'] });
    } catch (e: any) {
      message.error(
        e?.response?.data?.message ?? 'Não foi possível excluir o apontamento.',
      );
    }
  }

  function editar(chave: string, campo: string, valor: any) {
    setLinhas((atual) => ({
      ...atual,
      [chave]: { ...atual[chave], [campo]: valor },
    }));
  }

  function trocarMes(delta: number) {
    setMes(mes.add(delta, 'month'));
    setLinhas({});
  }

  async function salvar() {
    const pendentes = Object.entries(linhas);
    if (!pendentes.length) return;
    setSalvando(true);
    try {
      for (const [chave, valores] of pendentes) {
        const salvo = salvos.get(chave);
        await api.post(`/maquinas/${maquinaId}/producao`, {
          data: chave,
          qtdProduzida: valorCelula(valores, salvo, 'qtdProduzida') ?? 0,
          qtdDefeito: valorCelula(valores, salvo, 'qtdDefeito') ?? 0,
        });
      }
      message.success('Produção salva.');
      setLinhas({});
      qc.invalidateQueries({ queryKey: ['maquina-producao', maquinaId] });
      qc.invalidateQueries({ queryKey: ['producao-resumo'] });
      qc.invalidateQueries({ queryKey: ['maquinas'] });
    } catch (e: any) {
      message.error(
        e?.response?.data?.message ?? 'Não foi possível salvar a produção.',
      );
    } finally {
      setSalvando(false);
    }
  }

  const pendentes = Object.keys(linhas).length;

  const seletorMes = (
    <Space>
      <Button icon={<LeftOutlined />} onClick={() => trocarMes(-1)} />
      <Typography.Text
        strong
        style={{ minWidth: 76, display: 'inline-block', textAlign: 'center' }}
      >
        {mes.format('MM/YYYY')}
      </Typography.Text>
      <Button icon={<RightOutlined />} onClick={() => trocarMes(1)} />
    </Space>
  );

  const indicadores = (fonte: any, carregando: boolean) => (
    <Row gutter={[16, 16]}>
      <Col xs={24} sm={8}>
        <Card>
          <Statistic
            title="Produzidas no mês"
            value={fonte?.pecasProduzidas ?? 0}
            {...separadoresBR}
            loading={carregando}
          />
        </Card>
      </Col>
      <Col xs={24} sm={8}>
        <Card>
          <Statistic
            title="Peças com defeito"
            value={fonte?.pecasComDefeito ?? 0}
            {...separadoresBR}
            loading={carregando}
            valueStyle={{ color: COR.critico }}
          />
        </Card>
      </Col>
      <Col xs={24} sm={8}>
        <Card>
          <Statistic
            title="PPM do mês"
            value={fonte?.ppm ?? 0}
            {...separadoresBR}
            loading={carregando}
            valueStyle={{ color: MARCA.laranja }}
          />
        </Card>
      </Col>
    </Row>
  );

  // ------------------------------------------------------------ visao mensal
  if (!maquina) {
    return (
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card title="Produção diária e PPM" extra={seletorMes}>
          <Typography.Text type="secondary">
            Resumo de {mes.format('MM/YYYY')} por máquina. Clique na máquina para
            lançar a produção dia a dia.
          </Typography.Text>
        </Card>

        {indicadores(resumo, carregandoResumo)}

        <Card size="small" title={`Resumo por máquina — ${mes.format('MM/YYYY')}`}>
          <Tabela
            busca="Buscar máquina / linha"
            size="small"
            rowKey="maquinaId"
            loading={carregandoResumo}
            dataSource={resumo?.linhas ?? []}
            pagination={false}
            scroll={{ x: 780 }}
            onRow={(r: any) => ({
              onClick: () => {
                setMaquina(r);
                setLinhas({});
              },
              style: { cursor: 'pointer' },
            })}
            columns={[
              { title: 'Código', dataIndex: 'codigo', width: 110 },
              { title: 'Máquina / linha', dataIndex: 'nome' },
              {
                title: 'Área',
                dataIndex: 'area',
                width: 120,
                render: (a: string) =>
                  a === 'MONTAGEM' ? 'Montagem' : 'Fabricação',
              },
              {
                title: 'Produzidas',
                dataIndex: 'pecasProduzidas',
                width: 120,
                align: 'right',
                // Sempre com a seta: o render da tabela recebe (valor, linha,
                // indice) e a linha cairia no parametro de casas decimais.
                render: (v: number) => numeroBR(v),
              },
              {
                title: 'Com defeito',
                dataIndex: 'pecasComDefeito',
                width: 120,
                align: 'right',
                render: (v: number) => numeroBR(v),
              },
              {
                title: 'PPM',
                dataIndex: 'ppm',
                width: 110,
                align: 'right',
                render: (v: number) => <strong>{numeroBR(v)}</strong>,
              },
              {
                title: 'Dias apontados',
                dataIndex: 'diasApontados',
                width: 130,
                align: 'center',
                render: (v: number) => (
                  <Tag color={v ? 'green' : 'default'}>
                    {v} de {resumo?.diasNoMes ?? mes.daysInMonth()}
                  </Tag>
                ),
              },
            ]}
          />
        </Card>
      </Space>
    );
  }

  // ---------------------------------------------------------- visao dia a dia
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card
        title={
          <Breadcrumb
            items={[
              {
                title: (
                  <a onClick={() => setMaquina(null)}>Produção diária e PPM</a>
                ),
              },
              { title: `${maquina.codigo} — ${maquina.nome}` },
            ]}
          />
        }
        extra={
          <Space wrap>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => {
                setMaquina(null);
                setLinhas({});
              }}
            >
              Voltar ao resumo
            </Button>
            {seletorMes}
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={salvando}
              disabled={!pendentes}
              onClick={salvar}
            >
              Salvar {pendentes ? `(${pendentes})` : ''}
            </Button>
          </Space>
        }
      />

      {indicadores(data, isLoading)}

      <Card size="small" title={`Lançamento diário — ${mes.format('MM/YYYY')}`}>
        <Tabela
          size="small"
          rowKey="chave"
          loading={isLoading}
          dataSource={diasDoMes}
          pagination={false}
          scroll={{ x: 560, y: 460 }}
          columns={[
            {
              title: 'Dia',
              width: 130,
              render: (_: any, r: any) => r.dia.format('DD/MM ddd'),
            },
            {
              title: 'Qtd. produzida',
              width: 170,
              render: (_: any, r: any) => (
                <InputNumber
                  size="small"
                  min={0}
                  style={{ width: '100%' }}
                  value={r.qtdProduzida}
                  onChange={(v) => editar(r.chave, 'qtdProduzida', v)}
                />
              ),
            },
            {
              title: 'Qtd. com defeito',
              width: 170,
              render: (_: any, r: any) => (
                <InputNumber
                  size="small"
                  min={0}
                  style={{ width: '100%' }}
                  value={r.qtdDefeito}
                  onChange={(v) => editar(r.chave, 'qtdDefeito', v)}
                />
              ),
            },
            {
              title: 'PPM do dia',
              width: 120,
              align: 'right',
              render: (_: any, r: any) =>
                r.qtdProduzida
                  ? numeroBR(
                      Math.round(
                        ((r.qtdDefeito ?? 0) / r.qtdProduzida) * 1_000_000,
                      ),
                    )
                  : '-',
            },
            {
              title: '',
              render: (_: any, r: any) =>
                r.alterado ? <Tag color="gold">Não salvo</Tag> : null,
            },
            {
              title: '',
              width: 90,
              align: 'right',
              render: (_: any, r: any) =>
                r.producaoId ? (
                  <BotaoExcluir
                    emTabela
                    motivo="Excluir o apontamento do dia"
                    titulo={`Excluir o apontamento de ${r.dia.format('DD/MM')}?`}
                    descricao="O dia sai da conta do PPM do mês. A exclusão é definitiva."
                    onConfirm={() => excluirDia(r)}
                  />
                ) : null,
            },
          ]}
        />
      </Card>
    </Space>
  );
}
