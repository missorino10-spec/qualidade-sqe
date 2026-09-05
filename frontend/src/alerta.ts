// ---------------------------------------------------------------------------
// ALERTA DA QUALIDADE - regras compartilhadas entre backend e frontend.
// Espelho de backend/src/comum/alerta.ts: mudou aqui, muda la.
// ---------------------------------------------------------------------------

import { TAG } from './design/tokens';

// As cores saem da escala unica do sistema (design/tokens): aberto e um alerta
// correndo, renovado passou com ressalva e encerrado e o fim de linha.
export const STATUS_ALERTA = [
  { value: 'ABERTO', label: 'Aberto', cor: TAG.andamento },
  { value: 'RENOVADO', label: 'Renovado', cor: TAG.ressalva },
  { value: 'ENCERRADO', label: 'Encerrado', cor: TAG.sucesso },
] as const;

export const labelStatusAlerta: Record<string, string> = Object.fromEntries(
  STATUS_ALERTA.map((s) => [s.value, s.label]),
);

export const corStatusAlerta: Record<string, string> = Object.fromEntries(
  STATUS_ALERTA.map((s) => [s.value, s.cor]),
);

// O alerta segue valendo enquanto nao for encerrado. RENOVADO e so um ABERTO
// com o prazo prorrogado.
export function alertaEmAberto(status?: string | null): boolean {
  return status === 'ABERTO' || status === 'RENOVADO';
}

// Data pura (sem hora) vem como meia-noite UTC: ler o trecho ISO evita que
// 18/08 vire 17/08 em qualquer servidor a oeste de Greenwich.
function iso(valor?: string | Date | null): string {
  if (!valor) return '';
  return (typeof valor === 'string' ? valor : valor.toISOString()).slice(0, 10);
}

// Hoje no fuso de quem esta olhando (nao em UTC), para o alerta nao virar
// vencido algumas horas antes da meia-noite local.
function hojeIso(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

// VENCIDO nao e status gravado: e a leitura do prazo enquanto o alerta ainda
// esta em aberto. Encerrar fora do prazo NAO deixa o registro vencido — foi
// decisao da Qualidade.
export function alertaVencido(alerta: {
  status?: string | null;
  prazo?: string | Date | null;
}): boolean {
  if (!alertaEmAberto(alerta.status)) return false;
  const prazo = iso(alerta.prazo);
  return !!prazo && prazo < hojeIso();
}

// Situacao mostrada na tela e no PDF: o vencido "cobre" o status gravado.
export function situacaoAlerta(alerta: {
  status?: string | null;
  prazo?: string | Date | null;
}): { texto: string; cor: string } {
  if (alertaVencido(alerta)) return { texto: 'Vencido', cor: TAG.critico };
  const status = alerta.status ?? 'ABERTO';
  return {
    texto: labelStatusAlerta[status] ?? status,
    cor: corStatusAlerta[status] ?? TAG.neutro,
  };
}

// Dias que faltam para o prazo (negativo = dias de atraso).
export function diasParaPrazo(prazo?: string | Date | null): number | null {
  const p = iso(prazo);
  if (!p) return null;
  const [a1, m1, d1] = p.split('-').map(Number);
  const [a2, m2, d2] = hojeIso().split('-').map(Number);
  const ms = Date.UTC(a1, m1 - 1, d1) - Date.UTC(a2, m2 - 1, d2);
  return Math.round(ms / 86400000);
}
