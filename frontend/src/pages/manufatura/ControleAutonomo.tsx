import { useState } from 'react';
import {
  Button,
  Card,
  Col,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Tag,
  Typography,
  message,
} from 'antd';
import { FilePdfOutlined, PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { abrirPdfEmNovaAba, api, queryDeFiltro } from '../../api';
import FiltroPeriodo, { usarPeriodo } from '../../components/FiltroPeriodo';
import { useAuth } from '../../auth';
import { dataBR, numeroBR } from '../../formatos';
import Tabela, { filtrosDe } from '../../components/Tabela';
import { ExportarLista } from '../../design/acoes';
import {
  corClassificacaoIcaq,
  labelClassificacaoIcaq,
  rotuloTurnoIcaq,
  TURNOS_ICAQ,
} from '../../icaq';
import { COR } from '../../design/tokens';

// ICAQ — Auditoria do Controle Autonomo da Qualidade.
// A auditoria e lancada e fechada de uma vez: esta tela lista o que ja foi
// auditado e mede como esta o programa no periodo escolhido.

const pct = (parte: number, total: number) =>
  total ? Math.round((parte / total) * 1000) / 10 : 0;

export default function ControleAutonomo() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const admin = usuario?.papel === 'ADMIN';

  // O mesmo recorte vale para a lista, para os totais do topo e para a
  // exportacao: os tres tem que mostrar a mesma coisa.
  const periodo = usarPeriodo();
  const [maquinaId, setMaquinaId] = useState<number | undefined>();

  const filtro = { de: periodo.de, ate: periodo.ate, maquinaId };

  const { data, isLoading } = useQuery<any[]>({
    queryKey: ['icaq', filtro.de, filtro.ate, filtro.maquinaId],
    queryFn: async () =>
      (await api.get('/manufatura/controle-autonomo', { params: filtro })).data,
  });

  const { data: maquinas } = useQuery<any[]>({
    queryKey: ['maquinas'],
    queryFn: async () => (await api.get('/maquinas')).data,
  });

  const excluir = useMutation({
    mutationFn: async (id: number) =>
      api.delete(`/manufatura/controle-autonomo/${id}`),
    onSuccess: () => {
      message.success('Auditoria excluída.');
      qc.invalidateQueries({ queryKey: ['icaq'] });
    },
    onError: (e: any) =>
      message.error(
        e?.response?.data?.message ?? 'Não foi possível excluir a auditoria.',
      ),
  });

  const lista = data ?? [];
  const soma = lista.reduce((s, a) => s + (a.nota ?? 0), 0);
  const notaMedia = lista.length ? Math.round((soma / lista.length) * 10) / 10 : 0;
  const conformes = lista.filter((a) => a.classificacao === 'CONFORME').length;
  const foraDoPadrao = lista.length - conformes;

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* O filtro vale para a lista, para os totais do topo e para a exportacao. */}
      <FiltroPeriodo controle={periodo}>
        <Col xs={24} sm={24} lg={24}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Equipamento
          </Typography.Text>
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Todos"
            style={{ width: '100%' }}
            value={maquinaId}
            onChange={setMaquinaId}
            options={(maquinas ?? []).map((m) => ({
              value: m.id,
              label: `${m.codigo} — ${m.nome}`,
            }))}
          />
        </Col>
      </FiltroPeriodo>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Auditorias" value={lista.length} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Nota média"
              value={notaMedia}
              precision={1}
              suffix="%"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Dentro do padrão"
              value={pct(conformes, lista.length)}
              precision={1}
              suffix="%"
              valueStyle={{ color: COR.sucesso }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Fora do padrão"
              value={pct(foraDoPadrao, lista.length)}
              precision={1}
              suffix="%"
              valueStyle={{ color: COR.critico }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title="ICAQ — Controle Autônomo da Qualidade"
        extra={
          <Space wrap>
            <ExportarLista
              url={`/manufatura/controle-autonomo/relatorio${queryDeFiltro(filtro)}`}
              nome="icaq"
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/manufatura/controle-autonomo/nova')}
            >
              Nova auditoria
            </Button>
          </Space>
        }
      >
        <Tabela
          busca="Buscar (número, equipamento, operador...)"
          rowKey="id"
          size="small"
          loading={isLoading}
          dataSource={lista}
          scroll={{ x: 'max-content' }}
          onRow={(r: any) => ({
            onClick: () => navigate(`/manufatura/controle-autonomo/${r.id}`),
            style: { cursor: 'pointer' },
          })}
          columns={[
            { title: 'Número', dataIndex: 'numero', width: 130 },
            {
              title: 'Data',
              dataIndex: 'dataAuditoria',
              width: 110,
              render: (d: string) => dataBR(d),
            },
            {
              title: 'Turno',
              width: 110,
              filters: TURNOS_ICAQ.map((t) => ({ text: t.label, value: t.value })),
              onFilter: (v: any, r: any) => r.turno === v,
              render: (_: any, r: any) => rotuloTurnoIcaq(r.turno),
            },
            {
              title: 'Equipamento',
              width: 200,
              filters: filtrosDe(lista.map((r: any) => r.maquina?.nome)),
              onFilter: (v: any, r: any) => r.maquina?.nome === v,
              render: (_: any, r: any) => r.maquina?.nome ?? '-',
            },
            {
              title: 'Produto / código',
              render: (_: any, r: any) =>
                r.item ? `${r.item.codigo} — ${r.item.descricao}` : '-',
            },
            {
              title: 'Ordem / lote',
              dataIndex: 'ordemLote',
              width: 130,
              render: (v: string) => v || '-',
            },
            {
              title: 'Operador auditado',
              dataIndex: 'operador',
              width: 170,
              filters: filtrosDe(lista.map((r: any) => r.operador)),
              onFilter: (v: any, r: any) => r.operador === v,
            },
            {
              title: 'Nota',
              dataIndex: 'nota',
              width: 90,
              align: 'right',
              sorter: (a: any, b: any) => (a.nota ?? 0) - (b.nota ?? 0),
              render: (v: number) => <strong>{numeroBR(v, 2)}%</strong>,
            },
            {
              title: 'Classificação',
              dataIndex: 'classificacao',
              width: 140,
              filters: Object.entries(labelClassificacaoIcaq).map(([v, t]) => ({
                text: t,
                value: v,
              })),
              onFilter: (v: any, r: any) => r.classificacao === v,
              render: (c: string) => (
                <Tag color={corClassificacaoIcaq[c]}>
                  {labelClassificacaoIcaq[c] ?? c}
                </Tag>
              ),
            },
            {
              title: 'Ações',
              width: admin ? 150 : 80,
              // A linha inteira abre a auditoria: os botoes seguram o clique.
              render: (_: any, r: any) => (
                <Space size={4}>
                  <Button
                    size="small"
                    icon={<FilePdfOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      abrirPdfEmNovaAba(
                        `/manufatura/controle-autonomo/${r.id}/pdf`,
                      );
                    }}
                  />
                  {admin && (
                    <Button
                      size="small"
                      danger
                      onClick={(e) => {
                        e.stopPropagation();
                        Modal.confirm({
                          title: `Excluir a auditoria ${r.numero}?`,
                          content: 'A exclusão é definitiva.',
                          okText: 'Excluir',
                          okButtonProps: { danger: true },
                          cancelText: 'Cancelar',
                          onOk: () => excluir.mutateAsync(r.id),
                        });
                      }}
                    >
                      Excluir
                    </Button>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </Space>
  );
}
