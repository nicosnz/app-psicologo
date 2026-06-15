import supabase from '../services/supabase.js';
import { ESTADO_COLOR } from '../shared/config.js';
import { toUTC } from '../shared/fecha.js';
import { citasAdmin } from '../shared/estado.js';
import { renderSidebarAdmin } from '../psicologo/sidebar.js';
import { renderSidebarCliente } from './sidebar.js';


export async function responderContraoferta(citaCli, decision) {
  const adminEntry  = citasAdmin.find(c => c.citaCliente === citaCli);
  const nuevoEstado = decision;
  const nuevoInicio = decision === 'Confirmada' ? citaCli.inicioPropuesto : citaCli.inicio;
  const nuevoFin    = decision === 'Confirmada' ? citaCli.finPropuesto    : citaCli.fin;

  const updateData = { estado: nuevoEstado };
  if (decision === 'Confirmada') {
    updateData.inicio = toUTC(nuevoInicio);
    updateData.fin    = toUTC(nuevoFin);
  }

  const { error } = await supabase
    .from('citas')
    .update(updateData)
    .eq('id', citaCli.id);

  if (error) { console.error('Error respondiendo contraoferta:', error); return; }

  const color = ESTADO_COLOR[nuevoEstado];
  citaCli.estado = nuevoEstado;
  if (decision === 'Confirmada') {
    citaCli.inicio = nuevoInicio;
    citaCli.fin    = nuevoFin;
  }

  if (adminEntry) {
    adminEntry.color = color;
    if (decision === 'Confirmada') {
      adminEntry.inicio = nuevoInicio;
      adminEntry.fin    = nuevoFin;
    }
    if (adminEntry.fcEventAdmin) {
      const prefijo = decision === 'Confirmada' ? '✅' : '❌';
      adminEntry.fcEventAdmin.setProp('title', `${prefijo} ${citaCli.motivo}`);
      adminEntry.fcEventAdmin.setProp('backgroundColor', color);
      adminEntry.fcEventAdmin.setProp('borderColor', color);
      if (decision === 'Confirmada') {
        adminEntry.fcEventAdmin.setStart(nuevoInicio);
        adminEntry.fcEventAdmin.setEnd(nuevoFin);
      }
    }
    if (adminEntry.fcEventCliente) {
      adminEntry.fcEventCliente.setProp('backgroundColor', color);
      adminEntry.fcEventCliente.setProp('borderColor', color);
      if (decision === 'Confirmada') {
        adminEntry.fcEventCliente.setStart(nuevoInicio);
        adminEntry.fcEventCliente.setEnd(nuevoFin);
      }
    }
  }

  renderSidebarAdmin();
  renderSidebarCliente();
}