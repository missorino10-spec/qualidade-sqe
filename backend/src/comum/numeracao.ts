// Numeracao dos documentos da casa: prefixo + sequencial + ano.
// Ex.: SET0001/2026, RNC0001/2026, CNQ0001/2026.
//
// ---------------------------------------------------------------------------
// A heranca de 2026
// ---------------------------------------------------------------------------
// O sistema entrou no meio de 2026, e a Qualidade ja vinha numerando esses
// documentos a mao. Para o numero do sistema nao colidir com o do papel que ja
// esta arquivado, seis series comecam num numero herdado em vez do 1:
//
//   SET / PROD / SETV / PRODV -> 300     (Manufatura: setup e producao)
//   RNC                       -> 200     (SQE: nao conformidade)
//   INSP                      -> 500     (SQE: relatorio de inspecao)
//
// Nesse ano essas series saem SEM os zeros a esquerda, que e como estao
// escritas no papel: SET300/2026, e nao SET0300/2026.
//
// A letra continua na frente de proposito. Sem ela, SET e PROD virariam a
// mesma string "300/2026" - e os dois dividem a mesma tabela, com o numero
// marcado como unico no banco: o segundo lancamento do dia daria erro na tela
// do inspetor e o formulario preenchido se perderia.
//
// Tudo isso vale SO para 2026. Virando o ano, as seis series voltam ao padrao
// da casa (0001 com quatro digitos), igual as demais.
// ---------------------------------------------------------------------------

const ANO_HERANCA = 2026;

const PRIMEIRO_NUMERO: Record<string, number> = {
  SET: 300,
  PROD: 300,
  SETV: 300,
  PRODV: 300,
  RNC: 200,
  INSP: 500,
};

function temHeranca(prefixo: string, ano: number): boolean {
  return ano === ANO_HERANCA && PRIMEIRO_NUMERO[prefixo] != null;
}

// Primeiro numero que a serie pode receber no ano.
export function sequencialInicial(prefixo: string, ano: number): number {
  return temHeranca(prefixo, ano) ? PRIMEIRO_NUMERO[prefixo] : 1;
}

// Proximo numero da serie, a partir do ultimo ja gravado.
//
// Documento antigo NAO e renumerado: o que ja saiu como SET0005/2026 continua
// assim. O salto vale daqui para a frente - dai o maximo entre o proximo
// natural da contagem e o inicio herdado.
export function proximoSequencial(
  prefixo: string,
  ultimo: number | null | undefined,
  ano: number,
): number {
  return Math.max((ultimo ?? 0) + 1, sequencialInicial(prefixo, ano));
}

export function montarNumero(
  prefixo: string,
  sequencial: number,
  ano: number,
): string {
  const corpo = temHeranca(prefixo, ano)
    ? String(sequencial)
    : String(sequencial).padStart(4, '0');
  return `${prefixo}${corpo}/${ano}`;
}
