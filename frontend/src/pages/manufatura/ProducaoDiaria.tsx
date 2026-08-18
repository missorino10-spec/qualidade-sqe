import { useState } from 'react';
import {
  Button,
  Card,
  Col,
  Empty,
  InputNumber,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { LeftOutlined, RightOutlined, SaveOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { api } from '../../api';
import { dataInput, separadoresBR } from '../../formatos';

// Lancamento da producao do dia (qtd produzida e qtd com defeito) e o PPM
// resultante, como na planilha: uma linha por dia do mes.
// PPM = (pecas com defeito / pecas produzidas) * 1.000.000.

// Uma celula so conta como editada quando a chave existe no objeto. Isso
// separa "nao mexi" de "apaguei o numero": sem essa distincao, limpar o campo
// fazia o valor anterior voltar enquanto o usuario digitava.
function valorCelula(editado: any, salvo: any, campo: string) {
  if (editado && campo in editado) return editado[campo];
  return salvo?.[campo] ?? null;
}

export default function ProducaoDiaria() {
  const qc = useQueryClient();
  const [maquinaId, setMaquinaId] = useState<number | undefined>();
  const [mes, setMes] = useState(dayjs());
  const [linhas, setLinhas] = useState<Record<string, any>>({});
  const [salvando, setSalvando] = useState(false);

  const ano = mes.year();
  const numeroMes = mes.month() + 1;

  const { data: maquinas } = useQuery<any[]>({
    queryKey: ['maquinas'],
    queryFn: async () => (await api.get('/maquinas')).data,
  });

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

  const dataSource = Array.from({ length: mes.daysInMonth() }, (_, i) => {
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
    };
  });

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
      message.success('Produção do mês salva.');
      setLinhas({});
      qc.invalidateQueries({ queryKey: ['maquina-producao', maquinaId] });
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

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card title="Produção diária e PPM">
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} md={10}>
            <Select
              style={{ width: '100%' }}
              showSearch
              optionFilterProp="label"
              placeholder="Selecione a máquina / linha"
              value={maquinaId}
              onChange={(v) => {
                setMaquinaId(v);
                setLinhas({});
              }}
              options={(maquinas ?? []).map((m) => ({
                value: m.id,
                label: `${m.codigo} — ${m.nome}`,
              }))}
            />
          </Col>
          <Col xs={24} md={8}>
            <Space>
              <Button icon={<LeftOutlined />} onClick={() => trocarMes(-1)} />
              <Typography.Text strong style={{ minWidth: 76, display: 'inline-block', textAlign: 'center' }}>
                {mes.format('MM/YYYY')}
              </Typography.Text>
              <Button icon={<RightOutlined />} onClick={() => trocarMes(1)} />
            </Space>
          </Col>
          <Col xs={24} md={6} style={{ textAlign: 'right' }}>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={salvando}
              disabled={!pendentes}
              onClick={salvar}
            >
              Salvar {pendentes ? `(${pendentes})` : ''}
            </Button>
          </Col>
        </Row>
      </Card>

      {!maquinaId ? (
        <Card>
          <Empty description="Selecione uma máquina para lançar a produção do dia." />
        </Card>
      ) : (
        <>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic
                  title="Produzidas no mês"
                  value={data?.pecasProduzidas ?? 0}
                  {...separadoresBR}
                  loading={isLoading}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic
                  title="Peças com defeito"
                  value={data?.pecasComDefeito ?? 0}
                  {...separadoresBR}
                  loading={isLoading}
                  valueStyle={{ color: '#cf1322' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic
                  title="PPM do mês"
                  value={data?.ppm ?? 0}
                  {...separadoresBR}
                  loading={isLoading}
                  valueStyle={{ color: '#D37119' }}
                />
              </Card>
            </Col>
          </Row>

          <Card size="small" title={`Lançamento diário — ${mes.format('MM/YYYY')}`}>
            <Table
              size="small"
              rowKey="chave"
              loading={isLoading}
              dataSource={dataSource}
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
                      ? Math.round(
                          ((r.qtdDefeito ?? 0) / r.qtdProduzida) * 1_000_000,
                        ).toLocaleString('pt-BR')
                      : '-',
                },
                {
                  title: '',
                  render: (_: any, r: any) =>
                    r.alterado ? <Tag color="gold">não salvo</Tag> : null,
                },
              ]}
            />
          </Card>
        </>
      )}
    </Space>
  );
}
