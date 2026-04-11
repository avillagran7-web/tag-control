/**
 * Retorna true si la fecha es sábado, domingo o feriado.
 * Por ahora solo considera sábado/domingo. Feriados se pueden agregar después.
 */
export function isWeekend(date = new Date()) {
  const day = date.getDay();
  return day === 0 || day === 6; // 0 = domingo, 6 = sábado
}

/**
 * Retorna la tarifa correcta del peaje según el día.
 */
export function getTarifa(toll, date = new Date()) {
  return isWeekend(date) ? toll.tarifa_finde : toll.tarifa_semana;
}

/**
 * Retorna la etiqueta del tipo de tarifa actual.
 */
export function getTarifaLabel(date = new Date()) {
  return isWeekend(date) ? 'Fin de semana' : 'Día de semana';
}
