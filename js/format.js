// Utilidades de fecha/hora y formato en español. Sin dependencias.

const DOW = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export function formatDateLong(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${DOW[dt.getUTCDay()]}, ${d} de ${MONTHS[m - 1]}`;
}

export function formatDateShort(dateStr) {
  if (!dateStr) return '';
  const [, m, d] = dateStr.split('-').map(Number);
  return `${d}/${String(m).padStart(2, '0')}`;
}

/**
 * Convierte una fecha+hora "de pared" en una zona horaria dada a un Date UTC real.
 * Usa el truco estándar: formatea una estimación en esa zona y corrige el desfase.
 */
export function zonedTimeToUtc(dateStr, timeStr, timeZone) {
  if (!dateStr) return null;
  const time = timeStr || '00:00';
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm, 0));
  const offsetMinutes = getOffsetMinutes(guess, timeZone);
  return new Date(guess.getTime() - offsetMinutes * 60000);
}

function getOffsetMinutes(date, timeZone) {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    const parts = dtf.formatToParts(date).reduce((acc, p) => ((acc[p.type] = p.value), acc), {});
    const asUtc = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second)
    );
    return (asUtc - date.getTime()) / 60000;
  } catch {
    return 0;
  }
}

export function nowInZone(timeZone) {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    });
    const parts = dtf.formatToParts(new Date()).reduce((acc, p) => ((acc[p.type] = p.value), acc), {});
    return {
      date: `${parts.year}-${parts.month}-${parts.day}`,
      time: `${parts.hour}:${parts.minute}`,
    };
  } catch {
    return { date: '', time: '' };
  }
}

export function formatTimeInZone(date, timeZone) {
  try {
    return new Intl.DateTimeFormat('es-ES', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
  } catch {
    return '';
  }
}

export function relativeCountdown(targetDate) {
  const diffMs = targetDate.getTime() - Date.now();
  const past = diffMs < 0;
  const abs = Math.abs(diffMs);
  const totalMin = Math.floor(abs / 60000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const minutes = totalMin % 60;
  let label;
  if (days > 0) label = `${days} d ${hours} h`;
  else if (hours > 0) label = `${hours} h ${minutes} min`;
  else label = `${minutes} min`;
  return { past, label };
}

export function thbToEur(thb, rate) {
  if (!rate || !Number.isFinite(thb)) return null;
  return thb / rate;
}

export function eurToThb(eur, rate) {
  if (!rate || !Number.isFinite(eur)) return null;
  return eur * rate;
}
