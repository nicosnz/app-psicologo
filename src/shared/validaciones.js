import { HORA_MIN, HORA_MAX } from './config.js';
import { hoy, esDiaLaboral } from './fecha.js';
import { citasAdmin } from './estado.js';

export function validarRango({ inicio, fin }) {
  const dateInicio = new Date(inicio);
  const dateFin    = new Date(fin);
  const soloInicio = new Date(dateInicio.getFullYear(), dateInicio.getMonth(), dateInicio.getDate());

  if (soloInicio < hoy())
    return 'No se pueden agendar citas en fechas pasadas.';
  if (!esDiaLaboral(dateInicio))
    return 'El día seleccionado no es un día laboral.';
  if (dateInicio.getHours() < HORA_MIN || dateInicio.getHours() >= HORA_MAX)
    return `El horario debe estar entre las ${HORA_MIN}:00 y las ${HORA_MAX}:00.`;
  if (dateFin.getHours() < HORA_MIN || dateFin.getHours() > HORA_MAX || (dateFin.getHours() === HORA_MAX && dateFin.getMinutes() > 0))
    return `El horario debe estar entre las ${HORA_MIN}:00 y las ${HORA_MAX}:00.`;
  if (dateFin <= dateInicio)
    return 'La hora de fin debe ser posterior a la de inicio.';
  if (dateFin.toDateString() !== dateInicio.toDateString())
    return 'La cita no puede extenderse a otro día.';
  if ((dateFin - dateInicio) > 60 * 60 * 1000)
    return 'La cita no puede durar más de una hora.';
  return null;
}

export function detectarConflicto({ inicio, fin }) {
  const newIni = new Date(inicio).getTime();
  const newFin = new Date(fin).getTime();

  const activas = citasAdmin.filter(c => {
    if (c.esSolicitudCliente) {
      const estado = c.citaCliente?.estado;
      return estado !== 'Rechazada' && estado !== 'Cancelada';
    }
    return true;
  });

  const conflicto = activas.find(c => {
    const cIni = new Date(c.inicio).getTime();
    const cFin = new Date(c.fin).getTime();
    return newIni < cFin && newFin > cIni;
  });

  if (!conflicto) return null;

  const cfIni = new Date(conflicto.inicio);
  const cfFin = new Date(conflicto.fin);
  const fmt   = { hour: '2-digit', minute: '2-digit' };
  return `Ya tienes una cita agendada de ${cfIni.toLocaleTimeString('es', fmt)} a ${cfFin.toLocaleTimeString('es', fmt)}. Intenta con otro horario.`;
}