// Espelha a logica do backend (sqe-utils.ts): semanas de DOMINGO a SABADO,
// formato "W##" com dois digitos. Usado apenas para exibir semana/ano nos
// formularios de forma coerente com o que o backend grava.
export function semanaAno(d: Date): { semana: string; ano: number } {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const year = date.getUTCFullYear();
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const dayOfYear = Math.floor((date.getTime() - jan1.getTime()) / 86400000);
  const week = Math.floor((dayOfYear + jan1.getUTCDay()) / 7) + 1;
  return { semana: `W${String(week).padStart(2, '0')}`, ano: year };
}
