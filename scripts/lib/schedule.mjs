// Helpers puros para programar sincronizaciones y reservar presupuesto.
export function isoWeekKey(fecha) {
  const d = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const inicio = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const n = Math.ceil((((d - inicio) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(n).padStart(2, '0')}`;
}

export function rankingWindowStart(fecha) {
  const offsetDesdeLunes = (fecha.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(
    fecha.getUTCFullYear(), fecha.getUTCMonth(),
    fecha.getUTCDate() - offsetDesdeLunes, 8, 0, 0
  ));
}

export function isRankingWindowOpen(fecha) {
  return fecha.getTime() >= rankingWindowStart(fecha).getTime();
}

export function forecastRuns(hoursUntilReset, intervalMinutes) {
  if (!(hoursUntilReset > 0) || !(intervalMinutes > 0)) return 0;
  return Math.ceil(hoursUntilReset * 60 / intervalMinutes);
}

export function forecastCalendarCalls(hoursUntilReset, intervalHours, tourCount) {
  if (!(hoursUntilReset > 0) || !(intervalHours > 0) || !(tourCount > 0)) return 0;
  // Redondeo conservador: incluye una actualización si puede vencer antes del reinicio.
  return Math.ceil(hoursUntilReset / intervalHours) * tourCount;
}
