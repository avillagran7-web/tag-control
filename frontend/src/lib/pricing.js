/**
 * Horarios de tarificación autopistas Santiago (lunes a viernes):
 *   Punta:      07:00–09:00 y 18:00–20:00
 *   Saturación: 07:30–08:30 y 18:30–19:30 (sub-rango dentro de punta)
 *   Fuera de punta: todo el resto
 * Fin de semana y feriados: tarifa fuera de punta todo el día
 */

const FERIADOS = [
  '01-01', '04-18', '04-19', '05-01', '05-21', '06-20',
  '06-29', '07-16', '08-15', '09-18', '09-19', '10-12',
  '10-31', '11-01', '12-08', '12-25',
];

function isFeriado(date) {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return FERIADOS.includes(`${mm}-${dd}`);
}

export function isWeekend(date = new Date()) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * Determina el nivel tarifario según día y hora.
 * Retorna 'fuera_punta', 'punta', o 'saturacion'.
 */
export function getTarifaTier(date = new Date()) {
  if (isWeekend(date) || isFeriado(date)) return 'fuera_punta';

  const h = date.getHours();
  const m = date.getMinutes();
  const mins = h * 60 + m;

  // Saturación: 07:30–08:30 y 18:30–19:30
  if ((mins >= 450 && mins < 510) || (mins >= 1110 && mins < 1170)) return 'saturacion';
  // Punta: 07:00–09:00 y 18:00–20:00
  if ((mins >= 420 && mins < 540) || (mins >= 1080 && mins < 1200)) return 'punta';

  return 'fuera_punta';
}

/**
 * Retorna la tarifa correcta del peaje según el día y hora.
 */
export function getTarifa(toll, date = new Date()) {
  const tier = getTarifaTier(date);

  if (tier === 'saturacion' && toll.tarifa_saturacion) return toll.tarifa_saturacion;
  if (tier === 'punta' && toll.tarifa_punta) return toll.tarifa_punta;

  // Fuera de punta o fallback
  return toll.tarifa_semana;
}

/**
 * Retorna la etiqueta del tipo de tarifa actual.
 */
export function getTarifaLabel(date = new Date()) {
  const tier = getTarifaTier(date);
  if (tier === 'saturacion') return 'Horario saturación';
  if (tier === 'punta') return 'Horario punta';
  if (isWeekend(date)) return 'Fin de semana';
  return 'Fuera de punta';
}
