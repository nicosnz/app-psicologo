import supabase from '../services/supabase.js';
import { ESTADO_COLOR, HORA_MAX } from '../shared/config.js';
import { toUTC, formatLocalDatetime } from '../shared/fecha.js';
import { citasAdmin } from '../shared/estado.js';
import { renderSidebarAdmin } from './sidebar.js';
import { renderSidebarCliente } from '../cliente/sidebar.js';

/* ── Estado local del modal detalle ────────────────────── */
let entryActual   = null;
let fcEventActual = null;

export function setEntryActual(entry, fcEvent) {
  entryActual   = entry;
  fcEventActual = fcEvent;
}

/* ── Calcular siguiente hora libre ese día ─────────────── */
function calcularSiguienteHoraLibre(inicio, fin) {
  const duracion  = new Date(fin) - new Date(inicio);
  const mismaFecha = citasAdmin.filter(c => {
    if (c === entryActual) return false;
    if (c.esSolicitudCliente && (c.citaCliente?.estado === 'Rechazada' || c.citaCliente?.estado === 'Cancelada')) return false;
    return new Date(c.inicio).toDateString() === new Date(inicio).toDateString();
  });
  mismaFecha.sort((a, b) => new Date(a.inicio) - new Date(b.inicio));

  let candidato = new Date(fin);
  const fechaBase  = new Date(inicio);
  const limiteMax  = new Date(fechaBase.getFullYear(), fechaBase.getMonth(), fechaBase.getDate(), HORA_MAX, 0);

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

/* ── Aplicar decisión del psicólogo ────────────────────── */
export async function aplicarDecision(nuevoEstado, { onCerrar }) {
  if (!entryActual) return;

  const msgEl = document.getElementById('detalle-conflicto');

  // — Validar conflicto antes de confirmar —
  if (nuevoEstado === 'Confirmada') {
    const otrasCitas = citasAdmin.filter(c => {
      if (c === entryActual) return false;
      if (!c.esSolicitudCliente) return true;
      return c.citaCliente?.estado === 'Confirmada';
    });
    const newIni = new Date(entryActual.inicio).getTime();
    const newFin = new Date(entryActual.fin).getTime();
    const choque = otrasCitas.find(c => {
      const cIni = new Date(c.inicio).getTime();
      const cFin = new Date(c.fin).getTime();
      return newIni < cFin && newFin > cIni;
    });
    if (choque) {
      const cfIni = new Date(choque.inicio);
      const cfFin = new Date(choque.fin);
      const fmt   = { hour: '2-digit', minute: '2-digit' };
      msgEl.textContent = `No se puede confirmar: hay una cita de ${cfIni.toLocaleTimeString('es', fmt)} a ${cfFin.toLocaleTimeString('es', fmt)}. Intenta reprogramar.`;
      msgEl.classList.add('visible');
      return;
    }
  }

  // — Reprogramar: calcular siguiente hora libre y guardar contraoferta —
  if (nuevoEstado === 'Reprogramada') {
    const libre = calcularSiguienteHoraLibre(entryActual.inicio, entryActual.fin);
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

  // — Confirmar / Rechazar —
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