import { DIAS_LABORALES, HORA_MIN, HORA_MAX } from './config.js';

export function hoy() {
  const h = new Date();
  return new Date(h.getFullYear(), h.getMonth(), h.getDate());
}

export function parseFechaLocal(str) {
  const [y, m, d] = str.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function esDiaLaboral(date) {
  return DIAS_LABORALES.includes(date.getDay());
}

export function proximoDiaLaboral(desde) {
  const d = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate());
  do { d.setDate(d.getDate() + 1); } while (!esDiaLaboral(d));
  return d;
}

export function fechaConHoraMin(date) {
  const yyyy = date.getFullYear();
  const mm   = String(date.getMonth() + 1).padStart(2, '0');
  const dd   = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${String(HORA_MIN).padStart(2, '0')}:00`;
}

export function formatLocalDatetime(date) {
  const yyyy = date.getFullYear();
  const mm   = String(date.getMonth() + 1).padStart(2, '0');
  const dd   = String(date.getDate()).padStart(2, '0');
  const hh   = String(date.getHours()).padStart(2, '0');
  const min  = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

export function corregirDatetime(datetimeStr) {
  if (!datetimeStr) return datetimeStr;
  let date = new Date(datetimeStr);
  if (!esDiaLaboral(date)) {
    const sig = proximoDiaLaboral(date);
    date = new Date(sig.getFullYear(), sig.getMonth(), sig.getDate(), date.getHours(), date.getMinutes());
  }
  if (date.getHours() < HORA_MIN) date.setHours(HORA_MIN, 0);
  else if (date.getHours() >= HORA_MAX) date.setHours(HORA_MAX, 0);
  return formatLocalDatetime(date);
}

// Convierte string "YYYY-MM-DDTHH:mm" (hora local) a ISO UTC para Supabase
export function toUTC(localStr) {
  return new Date(localStr).toISOString();
}

// Convierte timestamp UTC de Supabase a "YYYY-MM-DDTHH:mm" en hora local
export function toLocal(utcStr) {
  return formatLocalDatetime(new Date(utcStr));
}