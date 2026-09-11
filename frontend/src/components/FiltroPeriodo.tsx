// Filtro de periodo das telas de lista.
//
// Nasceu no CNQ e agora e o mesmo em toda tela que lista lancamento: os
// atalhos (semana / mes / ano / tudo), o par De-Ate e o que mais a tela quiser
// colocar ao lado. O recorte escolhido aqui vale para a lista, para os totais
// e para a exportacao — os tres tem que mostrar a mesma coisa.
import { useState, type ReactNode } from 'react';
import { Card, Col, Input, Row, Select, Typography } from 'antd';
import dayjs from 'dayjs';

export type Intervalo = { de?: string; ate?: string };

// A semana e de DOMINGO a SABADO, como no restante do sistema (src/semana.ts).
const PERIODOS = [
  { value: 'SEMANA', label: 'Semana atual' },
  { value: 'MES', label: 'Mês atual' },
  { value: 'ANO', label: 'Ano atual' },
  { value: 'TUDO', label: 'Todo o período' },
  { value: 'PERSONALIZADO', label: 'Personalizado' },
];

export function intervaloDoPeriodo(periodo: string): Intervalo {
  const hoje = dayjs();
  const fmt = (d: dayjs.Dayjs) => d.format('YYYY-MM-DD');
  if (periodo === 'SEMANA')
    return { de: fmt(hoje.startOf('week')), ate: fmt(hoje.endOf('week')) };
  if (periodo === 'MES')
    return { de: fmt(hoje.startOf('month')), ate: fmt(hoje.endOf('month')) };
  if (periodo === 'ANO')
    return { de: fmt(hoje.startOf('year')), ate: fmt(hoje.endOf('year')) };
  return {};
}

/**
 * Estado do filtro. Abre sem recorte de propósito: a tela nao pode esconder
 * lancamento de mes anterior de quem acabou de entrar nela.
 */
export function usarPeriodo(inicial = 'TUDO') {
  const [periodo, setPeriodo] = useState(inicial);
  const [intervalo, setIntervalo] = useState<Intervalo>(
    intervaloDoPeriodo(inicial),
  );

  function trocarPeriodo(v: string) {
    setPeriodo(v);
    // "Personalizado" mantem as datas que ja estavam para o usuario so ajustar.
    if (v !== 'PERSONALIZADO') setIntervalo(intervaloDoPeriodo(v));
  }

  // Mexer numa data manualmente passa o filtro para "Personalizado".
  function trocarData(campo: 'de' | 'ate', valor: string) {
    setPeriodo('PERSONALIZADO');
    setIntervalo((atual) => ({ ...atual, [campo]: valor }));
  }

  return {
    periodo,
    intervalo,
    de: intervalo.de || undefined,
    ate: intervalo.ate || undefined,
    trocarPeriodo,
    trocarData,
  };
}

export default function FiltroPeriodo({
  controle,
  children,
  larguraExtra = 11,
}: {
  controle: ReturnType<typeof usarPeriodo>;
  /** Filtros proprios da tela (fornecedor, maquina, status...). */
  children?: ReactNode;
  /** Colunas do grid (de 24) que os filtros extras ocupam em telas grandes. */
  larguraExtra?: number;
}) {
  return (
    <Card size="small">
      <Row gutter={[12, 12]} align="bottom">
        <Col xs={24} sm={12} lg={5}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Período
          </Typography.Text>
          <Select
            style={{ width: '100%' }}
            value={controle.periodo}
            onChange={controle.trocarPeriodo}
            options={PERIODOS}
          />
        </Col>
        <Col xs={12} sm={6} lg={4}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            De
          </Typography.Text>
          <Input
            type="date"
            value={controle.intervalo.de ?? ''}
            onChange={(e) => controle.trocarData('de', e.target.value)}
          />
        </Col>
        <Col xs={12} sm={6} lg={4}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Até
          </Typography.Text>
          <Input
            type="date"
            value={controle.intervalo.ate ?? ''}
            onChange={(e) => controle.trocarData('ate', e.target.value)}
          />
        </Col>
        {children ? (
          <Col xs={24} sm={24} lg={larguraExtra}>
            <Row gutter={[12, 12]} align="bottom">
              {children}
            </Row>
          </Col>
        ) : null}
      </Row>
    </Card>
  );
}
