// Datas do formulario sao escolhidas como dias; o carimbo de envio inclui hora.
// Compara os dias vistos pela equipe no Brasil, sem a hora de salvamento ou
// variacoes de fuso/horario de verao mudarem a nota do fornecedor.
const formatoDia = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function diaUtc(data: Date): number {
  const partes = Object.fromEntries(
    formatoDia.formatToParts(data).map(({ type, value }) => [type, value]),
  );
  return Date.UTC(Number(partes.year), Number(partes.month) - 1, Number(partes.day));
}

export function diasRespostaRnc(
  envio: Date | null,
  retorno: Date | null,
): number | null {
  if (!envio || !retorno) return null;
  return Math.max(0, Math.round((diaUtc(retorno) - diaUtc(envio)) / 86400000));
}
