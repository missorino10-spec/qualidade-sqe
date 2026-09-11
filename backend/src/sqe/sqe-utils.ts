// Utilitarios do modulo SQE: semana (domingo->sabado), trimestre fiscal (out->set)
// e bandas de conformidade.
//
// O checklist visual e o motor de calculo das cotas sao comuns aos tres modulos
// e ficam em src/comum/inspecao.ts.

export type Classificacao = 'A' | 'B' | 'C' | 'D';

// Semana no formato "YYYY-Www", contando semanas de DOMINGO a SABADO.
// Ex: 05/07/2026 (dom) ate 11/07/2026 (sab) = 2026-W28.
export function semanaReferencia(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
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
export function numeroDocumento(
  prefixo: 'INSP' | 'RNC',
  sequencial: number,
  ano: number,
): string {
  return `${prefixo}${String(sequencial).padStart(4, '0')}/${ano}`;
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
  const inicio = new Date(inicioAno, inicioMes, 1);
  const fim = new Date(inicioAno, inicioMes + 3, 0, 23, 59, 59); // ultimo dia do trimestre
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

