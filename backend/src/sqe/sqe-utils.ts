// Utilitarios do modulo SQE: semana (domingo->sabado), trimestre fiscal (out->set)
// e bandas de conformidade.
//
// O checklist visual e o motor de calculo das cotas sao comuns aos tres modulos
// e ficam em src/comum/inspecao.ts.

import { montarNumero } from '../comum/numeracao';
import { hojeComoDataPura } from './avaliacao/idf';

export type Classificacao = 'A' | 'B' | 'C' | 'D';

// Reexportado daqui porque quem precisa da semana de HOJE e quem mais cai na
// armadilha: "agora" nao e data pura e nao pode entrar direto na conta abaixo.
export { hojeComoDataPura };

// Semana no formato "YYYY-Www", contando semanas de DOMINGO a SABADO.
// Ex: 05/07/2026 (dom) ate 11/07/2026 (sab) = 2026-W28.
//
// Le em UTC, pela mesma regra do resto do sistema: quem chega aqui e uma DATA
// PURA (o dia do lancamento), e data pura vale meia-noite UTC. Com o getter
// local, num servidor em UTC-3 a meia-noite UTC de domingo e sabado a noite:
// a entrega de domingo caia na semana anterior.
//
// Para perguntar a semana de HOJE use hojeComoDataPura(), nunca "new Date()":
// depois das 21h em UTC-3 o "agora" ja esta no dia seguinte em UTC.
export function semanaReferencia(d: Date): string {
  const date = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const year = date.getUTCFullYear();
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const dayOfYear = Math.floor((date.getTime() - jan1.getTime()) / 86400000);
  const week = Math.floor((dayOfYear + jan1.getUTCDay()) / 7) + 1;
  return `${year}-W${String(week).padStart(2, '0')}`;
}

// Semana no formato "W##" (2 digitos) e ano, contando semanas de DOMINGO a SABADO.
// Ex: 05/07/2026 => { semana: "W28", ano: 2026 }.
export function semanaAno(d: Date): { semana: string; ano: number } {
  const ref = semanaReferencia(d); // "2026-W28"
  const [ano, semana] = ref.split('-');
  return { semana, ano: Number(ano) };
}

// Numeracao dos documentos: prefixo + sequencial de 4 digitos + ano completo.
// Ex: INSP0001/2026 (inspecao) e RNC0001/2026 (nao conformidade). O prefixo
// deixa claro de que documento se trata; o sequencial reinicia a cada ano.
//
// As duas series tem a heranca de 2026 (RNC comeca no 200, INSP no 500, e sem
// os zeros a esquerda naquele ano); a regra mora em comum/numeracao.ts.
export function numeroDocumento(
  prefixo: 'INSP' | 'RNC',
  sequencial: number,
  ano: number,
): string {
  return montarNumero(prefixo, sequencial, ano);
}

// Trimestre fiscal da empresa: ano fiscal comeca em outubro.
// Out-Dez=Q1, Jan-Mar=Q2, Abr-Jun=Q3, Jul-Set=Q4.
export function trimestreFiscal(d: Date): {
  label: string;
  inicio: Date;
  fim: Date;
} {
  const mes = d.getMonth(); // 0-11
  const ano = d.getFullYear();
  let fy: number; // ano fiscal (ano do fim, set)
  let q: number;
  let inicioMes: number;
  let inicioAno: number;
  if (mes >= 9) {
    // Out(9), Nov(10), Dez(11) => Q1, ano fiscal = ano+1
    fy = ano + 1;
    q = 1;
    inicioMes = 9;
    inicioAno = ano;
  } else if (mes <= 2) {
    fy = ano;
    q = 2;
    inicioMes = 0;
    inicioAno = ano;
  } else if (mes <= 5) {
    fy = ano;
    q = 3;
    inicioMes = 3;
    inicioAno = ano;
  } else {
    fy = ano;
    q = 4;
    inicioMes = 6;
    inicioAno = ano;
  }
  // Qual trimestre e o de agora sai do relogio LOCAL (acima), mas as bordas vao
  // em UTC: elas sao comparadas com datas gravadas, e data pura vale meia-noite
  // UTC. Com o construtor local, num servidor em UTC-3 o trimestre comecaria as
  // 03:00Z do dia 1 e terminaria as 02:59Z do dia 1 do mes seguinte - perdendo
  // o que foi lancado no primeiro dia e pegando o primeiro dia do trimestre
  // seguinte.
  const inicio = new Date(Date.UTC(inicioAno, inicioMes, 1));
  const fim = new Date(
    Date.UTC(inicioAno, inicioMes + 3, 0, 23, 59, 59, 999), // ultimo dia do trimestre
  );
  const label = `FY${String(fy).slice(-2)}-Q${q}`;
  return { label, inicio, fim };
}

// % de conformidade = (inspecionados - reprovados) / inspecionados * 100
export function pctConformidade(
  inspecionados: number,
  reprovados: number,
): number {
  if (!inspecionados) return 0;
  return Math.round(((inspecionados - reprovados) / inspecionados) * 1000) / 10;
}

// A classe do fornecedor NAO sai mais da conformidade sozinha: ela vem do IDF,
// que pesa conformidade, tempo de resposta da RNC e nivel do plano de acao.
// Ver src/sqe/avaliacao/idf.ts.

