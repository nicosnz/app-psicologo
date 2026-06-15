import supabase from '../services/supabase.js';
import { ESTADO_COLOR, HORA_MAX, HORA_MIN } from '../shared/config.js';
import { toUTC, formatLocalDatetime, esDiaLaboral } from '../shared/fecha.js';
import { citasAdmin } from '../shared/estado.js';
import { renderSidebarAdmin } from './sidebar.js';
import { renderSidebarCliente } from '../cliente/sidebar.js';

let entryActual   = null;
let fcEventActual = null;

export function setEntryActual(entry, fcEvent) {
  entryActual   = entry;
  fcEventActual = fcEvent;
}

export function calcularSiguienteHoraLibre(inicio, fin, citas, entryExcluir) {
  const duracion   = new Date(fin) - new Date(inicio);
  const mismaFecha = citas.filter(c => {
    if (c === entryExcluir) return false;
    if (c.esSolicitudCliente && (c.citaCliente?.estado === 'Rechazada' || c.citaCliente?.estado === 'Cancelada')) return false;
    return new Date(c.inicio).toDateString() === new Date(inicio).toDateString();
  });
  mismaFecha.sort((a, b) => new Date(a.inicio) - new Date(b.inicio));

  let candidato   = new Date(fin);
  const fechaBase = new Date(inicio);
  const limiteMax = new Date(fechaBase.getFullYear(), fechaBase.getMonth(), fechaBase.getDate(), HORA_MAX, 0);

  for (let i = 0; i < 20; i++) {
    const candidatoFin = new Date(candidato.getTime() + duracion);
    if (candidatoFin > limiteMax) return null;

    const choca = mismaFecha.some(c => {
      const cIni = new Date(c.inicio).getTime();
      const cFin = new Date(c.fin).getTime();
      return candidato.getTime() < cFin && candidatoFin.getTime() > cIni;
    });

    if (!choca) {
      return { inicio: formatLocalDatetime(candidato), fin: formatLocalDatetime(candidatoFin) };
    }

    const chocantesFin = mismaFecha
      .filter(c => new Date(c.inicio).getTime() < candidatoFin.getTime() && new Date(c.fin).getTime() > candidato.getTime())
      .map(c => new Date(c.fin).getTime());
    candidato = new Date(Math.max(...chocantesFin));
  }
  return null;
}

export function detectarConflictoParaConfirmar(entry, citas) {
  const fecha = new Date(entry.inicio);
  if (!esDiaLaboral(fecha)) return { fueraDeHorario: true };
  if (fecha.getHours() < HORA_MIN || fecha.getHours() >= HORA_MAX) return { fueraDeHorario: true };

  const otras  = citas.filter(c => {
    if (c === entry) return false;
    if (!c.esSolicitudCliente) return true;
    return c.citaCliente?.estado === 'Confirmada';
  });
  const newIni = new Date(entry.inicio).getTime();
  const newFin = new Date(entry.fin).getTime();
  return otras.find(c => {
    const cIni = new Date(c.inicio).getTime();
    const cFin = new Date(c.fin).getTime();
    return newIni < cFin && newFin > cIni;
  }) || null;
}

export async function aplicarDecision(nuevoEstado, { onCerrar }) {
  if (!entryActual) return;

  const msgEl = document.getElementById('detalle-conflicto');

  if (nuevoEstado === 'Confirmada') {
    const choque = detectarConflictoParaConfirmar(entryActual, citasAdmin);
    if (choque) {
      const cfIni = new Date(choque.inicio);
      const cfFin = new Date(choque.fin);
      const fmt   = { hour: '2-digit', minute: '2-digit' };
      msgEl.textContent = `No se puede confirmar: hay una cita de ${cfIni.toLocaleTimeString('es', fmt)} a ${cfFin.toLocaleTimeString('es', fmt)}. Intenta reprogramar.`;
      msgEl.classList.add('visible');
      return;
    }
  }

  if (nuevoEstado === 'Reprogramada') {
    const libre = calcularSiguienteHoraLibre(entryActual.inicio, entryActual.fin, citasAdmin, entryActual);
    if (!libre) {
      msgEl.textContent = 'No hay horas disponibles ese día para reprogramar.';
      msgEl.classList.add('visible');
      return;
    }

    const { error } = await supabase
      .from('citas')
      .update({
        estado:           'Reprogramada',
        inicio_propuesto: toUTC(libre.inicio),
        fin_propuesto:    toUTC(libre.fin),
      })
      .eq('id', entryActual.id);

    if (error) { console.error('Error reprogramando:', error); return; }

    const color = ESTADO_COLOR['Reprogramada'];
    if (entryActual.citaCliente) {
      entryActual.citaCliente.estado          = 'Reprogramada';
      entryActual.citaCliente.inicioPropuesto = libre.inicio;
      entryActual.citaCliente.finPropuesto    = libre.fin;
    }
    entryActual.color = color;

    if (fcEventActual) {
      fcEventActual.setProp('title', `🔄 ${entryActual.titulo}`);
      fcEventActual.setProp('backgroundColor', color);
      fcEventActual.setProp('borderColor', color);
    }
    if (entryActual.fcEventCliente) {
      entryActual.fcEventCliente.setProp('backgroundColor', color);
      entryActual.fcEventCliente.setProp('borderColor', color);
    }

    renderSidebarAdmin();
    renderSidebarCliente();
    onCerrar();
    return;
  }

  const { error } = await supabase
    .from('citas')
    .update({ estado: nuevoEstado })
    .eq('id', entryActual.id);

  if (error) { console.error('Error actualizando estado:', error); return; }

  msgEl.textContent = ''; msgEl.classList.remove('visible');

  const color = ESTADO_COLOR[nuevoEstado];
  if (entryActual.citaCliente) entryActual.citaCliente.estado = nuevoEstado;
  entryActual.color = color;

  if (fcEventActual) {
    const prefijo = nuevoEstado === 'Confirmada' ? '✅' : '❌';
    fcEventActual.setProp('title', `${prefijo} ${entryActual.titulo} · ${entryActual.paciente?.nombre || ''}`);
    fcEventActual.setProp('backgroundColor', color);
    fcEventActual.setProp('borderColor', color);
  }
  if (entryActual.fcEventCliente) {
    entryActual.fcEventCliente.setProp('backgroundColor', color);
    entryActual.fcEventCliente.setProp('borderColor', color);
  }

  renderSidebarAdmin();
  renderSidebarCliente();
  onCerrar();
}
