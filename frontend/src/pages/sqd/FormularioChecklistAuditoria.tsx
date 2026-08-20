import { Card, Col, Input, Radio, Row, Space, Tag, Typography } from 'antd';
import {
  corClassificacaoBloco,
  corRespostaAuditoria,
  labelClassificacaoBloco,
  labelRespostaAuditoria,
  nota as fmtNota,
} from './comum';
import Tabela from '../../components/Tabela';

// Checklist de Auditoria de Fornecedores. Os 12 blocos, os pesos e as 46
// perguntas vem do backend (GET /sqd/auditorias/formulario), que le a mesma
// lista da planilha "Checklist Auditoria".
//
// A conta e a mesma do backend (auditorias-utils.ts) — aqui ela roda so para a
// tela mostrar a nota enquanto a Qualidade preenche. Quem manda e o servidor.
//   Sim = 1,0 · Parcial = 0,5 · Nao = 0,0 · N/A sai da conta
//   nota do bloco = media das respondidas x 100
//   nota final = soma(peso x nota do bloco) / soma dos pesos avaliados

export type BlocoAuditoria = {
  codigo: string;
  nome: string;
  peso: number;
  perguntas: { codigo: string; texto: string }[];
};

export type RespostaItem = { resposta: string; evidencia?: string | null };
export type RespostasAuditoria = Record<string, RespostaItem>;

const VALOR: Record<string, number> = { SIM: 1, PARCIAL: 0.5, NAO: 0 };

function arredondar(v: number) {
  return Math.round(v * 100) / 100;
}

export function classificarBloco(pontuacao: number) {
  if (pontuacao >= 90) return 'SATISFATORIO';
  if (pontuacao >= 70) return 'ATENCAO';
  return 'CRITICO';
}

export function classificarAuditoria(nota: number) {
  if (nota >= 90) return 'APROVADO';
  if (nota >= 80) return 'APROVADO_CONDICIONALMENTE';
  return 'REPROVADO';
}

// Preenche o checklist em branco (tudo "Não") ou recarrega as respostas de uma
// rodada ja lancada.
export function respostasIniciais(
  blocos: BlocoAuditoria[],
  existentes?: any[],
): RespostasAuditoria {
  const mapa: RespostasAuditoria = {};
  for (const b of blocos) {
    for (const p of b.perguntas) {
      const r = existentes?.find((x: any) => x?.codigo === p.codigo);
      mapa[p.codigo] = {
        resposta: r?.resposta ?? 'NAO',
        evidencia: r?.evidencia ?? '',
      };
    }
  }
  return mapa;
}

export function calcularAuditoria(
  blocos: BlocoAuditoria[],
  respostas: RespostasAuditoria,
) {
  const parciais = blocos.map((b) => {
    let soma = 0;
    let respondidas = 0;
    let naoAplicaveis = 0;
    for (const p of b.perguntas) {
      const r = respostas[p.codigo]?.resposta ?? 'NAO';
      if (r === 'NAO_APLICAVEL') {
        naoAplicaveis++;
        continue;
      }
      soma += VALOR[r] ?? 0;
      respondidas++;
    }
    const pontuacao =
      respondidas === 0 ? null : arredondar((soma / respondidas) * 100);
    return {
      codigo: b.codigo,
      nome: b.nome,
      peso: b.peso,
      pontuacao,
      respondidas,
      naoAplicaveis,
      classificacao: pontuacao === null ? null : classificarBloco(pontuacao),
    };
  });

  // Bloco inteiro em N/A sai da conta e os pesos se rebalanceiam sozinhos —
  // por isso "tudo Sim" da exatamente 100,0 mesmo com os pesos somando 110.
  const pesoAvaliado = parciais.reduce(
    (s, b) => s + (b.pontuacao === null ? 0 : b.peso),
    0,
  );
  const blocosCalc = parciais.map((b) => ({
    ...b,
    ponderada:
      b.pontuacao === null || pesoAvaliado === 0
        ? 0
        : arredondar((b.pontuacao * b.peso) / pesoAvaliado),
  }));
  const nota =
    pesoAvaliado === 0
      ? 0
      : arredondar(
          blocosCalc.reduce(
            (s, b) => s + (b.pontuacao === null ? 0 : b.pontuacao * b.peso),
            0,
          ) / pesoAvaliado,
        );

  return { blocos: blocosCalc, nota, resultado: classificarAuditoria(nota) };
}

const OPCOES = ['SIM', 'PARCIAL', 'NAO', 'NAO_APLICAVEL'];

// Um cartao por bloco, com o cabecalho mostrando o peso e a nota do bloco em
// tempo real.
export function ChecklistAuditoria({
  blocos,
  respostas,
  setRespostas,
}: {
  blocos: BlocoAuditoria[];
  respostas: RespostasAuditoria;
  setRespostas: (r: RespostasAuditoria) => void;
}) {
  const calculo = calcularAuditoria(blocos, respostas);

  function alterar(codigo: string, campo: keyof RespostaItem, valor: any) {
    setRespostas({
      ...respostas,
      [codigo]: { ...respostas[codigo], [campo]: valor },
    });
  }

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Typography.Paragraph type="secondary" style={{ fontSize: 12, margin: 0 }}>
        Sim = 1,0 · Parcial = 0,5 · Não = 0,0 · N/A sai da conta. A nota do bloco
        é a média das perguntas respondidas; a nota final pondera os blocos pelo
        peso e reequilibra os pesos quando um bloco inteiro fica em N/A. Regra da
        Qualidade: 90 ou mais aprovado · 80 a 89,99 aprovado condicionalmente ·
        abaixo de 80 reprovado.
      </Typography.Paragraph>

      {blocos.map((b) => {
        const c = calculo.blocos.find((x) => x.codigo === b.codigo)!;
        return (
          <Card
            key={b.codigo}
            size="small"
            title={`${b.codigo} ${b.nome}`}
            extra={
              <Space>
                <Tag>peso {b.peso}%</Tag>
                <Tag
                  color={
                    c.classificacao ? corClassificacaoBloco[c.classificacao] : 'default'
                  }
                >
                  {c.pontuacao === null
                    ? 'Bloco em N/A'
                    : `${fmtNota(c.pontuacao)}% · ${
                        labelClassificacaoBloco[c.classificacao!]
                      }`}
                </Tag>
              </Space>
            }
          >
            <Tabela
              rowKey="codigo"
              size="small"
              pagination={false}
              scroll={{ x: 'max-content' }}
              dataSource={b.perguntas}
              columns={[
                { title: 'Nº', dataIndex: 'codigo', width: 70 },
                { title: 'Pergunta', dataIndex: 'texto' },
                {
                  title: 'Resposta',
                  width: 300,
                  render: (_: any, p: any) => (
                    <Radio.Group
                      size="small"
                      optionType="button"
                      buttonStyle="solid"
                      value={respostas[p.codigo]?.resposta ?? 'NAO'}
                      onChange={(e) =>
                        alterar(p.codigo, 'resposta', e.target.value)
                      }
                      options={OPCOES.map((o) => ({
                        value: o,
                        label: labelRespostaAuditoria[o],
                      }))}
                    />
                  ),
                },
                {
                  title: 'Evidência / observação',
                  width: 280,
                  render: (_: any, p: any) => (
                    <Input
                      size="small"
                      value={respostas[p.codigo]?.evidencia ?? ''}
                      onChange={(e) =>
                        alterar(p.codigo, 'evidencia', e.target.value)
                      }
                    />
                  ),
                },
              ]}
            />
          </Card>
        );
      })}

      <ResumoAuditoria calculo={calculo} />
    </Space>
  );
}

// Espelho da aba "Resumo" da planilha: nota por bloco, pontos ponderados e o
// resultado que o registro vai receber.
export function ResumoAuditoria({ calculo }: { calculo: any }) {
  return (
    <Card size="small" title="Resumo por bloco">
      <Tabela
        rowKey="codigo"
        size="small"
        pagination={false}
        scroll={{ x: 'max-content' }}
        dataSource={calculo.blocos}
        columns={[
          {
            title: 'Bloco',
            render: (_: any, b: any) => `${b.codigo} ${b.nome}`,
          },
          { title: 'Peso', dataIndex: 'peso', width: 80, align: 'right',
            render: (p: number) => `${p}%` },
          {
            title: 'Nota do bloco',
            dataIndex: 'pontuacao',
            width: 120,
            align: 'right',
            render: (v: number | null) => (v === null ? 'N/A' : `${fmtNota(v)}%`),
          },
          {
            title: 'Pontos ponderados',
            dataIndex: 'ponderada',
            width: 150,
            align: 'right',
            render: (v: number) => fmtNota(v),
          },
          {
            title: 'Classificação',
            dataIndex: 'classificacao',
            width: 140,
            render: (c: string | null) =>
              c ? (
                <Tag color={corClassificacaoBloco[c]}>
                  {labelClassificacaoBloco[c]}
                </Tag>
              ) : (
                '-'
              ),
          },
        ]}
      />
      <Row gutter={16} style={{ marginTop: 12 }}>
        <Col>
          <Typography.Text strong style={{ fontSize: 16 }}>
            Nota final: {fmtNota(calculo.nota)}
          </Typography.Text>
        </Col>
        <Col>
          <Tag
            color={corRespostaAuditoria[
              calculo.resultado === 'APROVADO' ? 'SIM' : 'NAO'
            ]}
          >
            {calculo.resultado === 'APROVADO'
              ? 'Aprovado'
              : calculo.resultado === 'APROVADO_CONDICIONALMENTE'
                ? 'Aprovado Condicionalmente · reavaliação em 180 dias'
                : 'Reprovado · reavaliação em 90 dias'}
          </Tag>
        </Col>
      </Row>
    </Card>
  );
}
