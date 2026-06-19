import supabase from '../services/supabase.js';
import { ESTADO_COLOR } from '../shared/config.js';
import { toUTC } from '../shared/fecha.js';
import { citasAdmin } from '../shared/estado.js';
import { renderSidebarAdmin } from '../psicologo/sidebar.js';
import { renderSidebarCliente } from './sidebar.js';

function actualizarEstadoLocal(citaCli, adminEntry, nuevoEstado, nuevoInicio, nuevoFin) {
  const esConfirmada = nuevoEstado === 'Confirmada';
  const color        = ESTADO_COLOR[nuevoEstado];

  citaCli.estado = nuevoEstado;
  if (esConfirmada) { citaCli.inicio = nuevoInicio; citaCli.fin = nuevoFin; }

  if (!adminEntry) return color;
  adminEntry.color = color;
  if (esConfirmada) { adminEntry.inicio = nuevoInicio; adminEntry.fin = nuevoFin; }

  return color;
}

function actualizarEventosCalendario(adminEntry, citaCli, color, nuevoInicio, nuevoFin) {
  if (!adminEntry) return;
  const esConfirmada = color === ESTADO_COLOR['Confirmada'];
  const prefijo      = esConfirmada ? '✅' : '❌';

  if (adminEntry.fcEventAdmin) {
    adminEntry.fcEventAdmin.setProp('title', `${prefijo} ${citaCli.motivo}`);
    adminEntry.fcEventAdmin.setProp('backgroundColor', color);
    adminEntry.fcEventAdmin.setProp('borderColor', color);
    if (esConfirmada) { adminEntry.fcEventAdmin.setStart(nuevoInicio); adminEntry.fcEventAdmin.setEnd(nuevoFin); }
  }

  if (adminEntry.fcEventCliente) {
    adminEntry.fcEventCliente.setProp('backgroundColor', color);
    adminEntry.fcEventCliente.setProp('borderColor', color);
    if (esConfirmada) { adminEntry.fcEventCliente.setStart(nuevoInicio); adminEntry.fcEventCliente.setEnd(nuevoFin); }
  }
}

export async function responderContraoferta(citaCli, decision) {
  const esConfirmada = decision === 'Confirmada';
  const adminEntry   = citasAdmin.find(c => c.citaCliente === citaCli);
  const nuevoInicio  = esConfirmada ? citaCli.inicioPropuesto : citaCli.inicio;
  const nuevoFin     = esConfirmada ? citaCli.finPropuesto    : citaCli.fin;

  const updateData = { estado: decision };
  if (esConfirmada) { updateData.inicio = toUTC(nuevoInicio); updateData.fin = toUTC(nuevoFin); }

  const { error } = await supabase.from('citas').update(updateData).eq('id', citaCli.id);
  if (error) { console.error('Error respondiendo contraoferta:', error); return; }

  const color = actualizarEstadoLocal(citaCli, adminEntry, decision, nuevoInicio, nuevoFin);
  actualizarEventosCalendario(adminEntry, citaCli, color, nuevoInicio, nuevoFin);

  renderSidebarAdmin();
  renderSidebarCliente();
}
