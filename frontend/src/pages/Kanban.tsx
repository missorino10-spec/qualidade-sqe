import { useMemo } from 'react';
import {
  Card,
  Col,
  Empty,
  Row,
  Space,
  Tag,
  Typography,
  Badge,
} from 'antd';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

// Domingo (0) a Sabado (6) da semana de uma data
function intervaloSemana(d: dayjs.Dayjs) {
  const inicio = d.startOf('week'); // dayjs pt-br: domingo
  const fim = inicio.add(6, 'day');
  return { inicio, fim };
}

function rotuloSemana(ref: string | undefined, exemplo?: string) {
  if (!ref) return { titulo: 'Sem semana', sub: '' };
  if (exemplo) {
    const { inicio, fim } = intervaloSemana(dayjs(exemplo));
    return {
      titulo: ref,
      sub: `${inicio.format('DD/MM')} — ${fim.format('DD/MM')}`,
    };
  }
  return { titulo: ref, sub: '' };
}

export default function Kanban() {
  const navigate = useNavigate();

  const { data: entregas, isLoading } = useQuery<any[]>({
    queryKey: ['entregas'],
    queryFn: async () => (await api.get('/entregas')).data,
  });

  const colunas = useMemo(() => {
    const mapa = new Map<string, any[]>();
    (entregas ?? []).forEach((e) => {
      const chave = e.semanaReferencia ?? 'Sem semana';
      if (!mapa.has(chave)) mapa.set(chave, []);
      mapa.get(chave)!.push(e);
    });
    return Array.from(mapa.entries())
      .map(([semana, itens]) => ({
        semana,
        exemplo: itens[0]?.dataEntrega,
        itens: itens.sort(
          (a, b) =>
            new Date(b.dataEntrega).getTime() - new Date(a.dataEntrega).getTime(),
        ),
      }))
      .sort((a, b) => b.semana.localeCompare(a.semana));
  }, [entregas]);

  function statusEntrega(e: any) {
    const insp = [...(e.inspecoesVisual ?? []), ...(e.inspecoesLote ?? [])];
    if (insp.length) {
      const reprovada = insp.some((i: any) => i.resultado === 'REPROVADO');
      return reprovada
        ? { cor: 'red', texto: 'Reprovada' }
        : { cor: 'green', texto: 'Aprovada' };
    }
    if (e.passivelInspecao) return { cor: 'orange', texto: 'Aguardando inspeção' };
    return { cor: 'default', texto: 'Sem inspeção' };
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Typography.Title level={4} style={{ margin: 0 }}>
        Kanban Semanal — Entregas e Inspeções
      </Typography.Title>
      <Typography.Text type="secondary">
        Entregas agrupadas por semana (domingo a sábado). Clique em um cartão para
        registrar ou consultar a inspeção.
      </Typography.Text>

      {isLoading ? (
        <Card loading />
      ) : colunas.length === 0 ? (
        <Empty description="Nenhuma entrega registrada" />
      ) : (
        <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
          <Row gutter={16} wrap={false} style={{ minWidth: 'min-content' }}>
            {colunas.map((col) => {
              const { titulo, sub } = rotuloSemana(col.semana, col.exemplo);
              const pendentes = col.itens.filter(
                (e: any) =>
                  e.passivelInspecao &&
                  !(e.inspecoesVisual?.length || e.inspecoesLote?.length),
              ).length;
              return (
                <Col key={col.semana} style={{ width: 300, flex: '0 0 300px' }}>
                  <Card
                    size="small"
                    title={
                      <Space direction="vertical" size={0}>
                        <span>{titulo}</span>
                        {sub && (
                          <Typography.Text
                            type="secondary"
                            style={{ fontSize: 12 }}
                          >
                            {sub}
                          </Typography.Text>
                        )}
                      </Space>
                    }
                    extra={
                      <Badge
                        count={pendentes}
                        style={{ backgroundColor: '#D37119' }}
                        title="Pendentes de inspeção"
                      />
                    }
                    style={{
                      background: '#FAF6F2',
                      borderTop: '3px solid #D37119',
                    }}
                    bodyStyle={{ maxHeight: '65vh', overflowY: 'auto' }}
                  >
                    <Space direction="vertical" style={{ width: '100%' }} size={8}>
                      {col.itens.map((e: any) => {
                        const st = statusEntrega(e);
                        return (
                          <Card
                            key={e.id}
                            size="small"
                            hoverable
                            onClick={() =>
                              navigate(
                                `/inspecoes?entregaId=${e.id}&fornecedorId=${e.fornecedorId}` +
                                  (e.itemId ? `&itemId=${e.itemId}` : ''),
                              )
                            }
                            bodyStyle={{ padding: 10 }}
                          >
                            <Typography.Text strong style={{ fontSize: 13 }}>
                              {e.fornecedor?.nome}
                            </Typography.Text>
                            <div
                              style={{ fontSize: 12, color: '#666', margin: '2px 0' }}
                            >
                              {e.item?.descricao ?? 'Item não informado'}
                            </div>
                            <div style={{ fontSize: 12, color: '#888' }}>
                              {dayjs(e.dataEntrega).format('DD/MM')} · NF{' '}
                              {e.notaFiscal ?? '-'}
                            </div>
                            <div style={{ marginTop: 6 }}>
                              <Tag color={st.cor} style={{ marginRight: 0 }}>
                                {st.texto}
                              </Tag>
                            </div>
                          </Card>
                        );
                      })}
                    </Space>
                  </Card>
                </Col>
              );
            })}
          </Row>
        </div>
      )}
    </Space>
  );
}
