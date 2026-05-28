import supabase from '../services/supabase.js';
import { ESTADO_COLOR, PACIENTE_ID_CLIENTE } from '../shared/config.js';
import { toUTC } from '../shared/fecha.js';
import { citasAdmin, citasCliente, pacienteCliente } from '../shared/estado.js';
import { renderSidebarAdmin } from '../psicologo/sidebar.js';
import { renderSidebarCliente } from './sidebar.js';

/**
 * Guarda una solicitud de cita del cliente en Supabase y la refleja
 * en ambos calendarios y sidebars.
 * @param {{ motivo, inicio, fin, notas }} datos
 * @param {Calendar} calAdmin
 * @param {Calendar} calCliente
 */
export async function agregarCitaCliente({ motivo, inicio, fin, notas }, calAdmin, calCliente) {
  const color = ESTADO_COLOR['Pendiente'];

  const { data, error } = await supabase
    .from('citas')
    .insert({
      paciente_id: PACIENTE_ID_CLIENTE,
      titulo:      motivo,
      inicio:      toUTC(inicio),
      fin:         toUTC(fin),
      color,
      estado:      'Pendiente',
      origen:      'cliente',
      cli_notas:   notas || null,
    })
    .select()
    .single();

  if (error) { console.error('Error guardando solicitud:', error); return; }

  const cita = { id: data.id, motivo, inicio, fin, notas, estado: 'Pendiente' };
  citasCliente.push(cita);

  const fcEventCliente = calCliente.addEvent({
    title: motivo,
    start: inicio, end: fin,
    backgroundColor: color, borderColor: color,
    extendedProps: { cita },
  });

  const adminEntry = {
    id: data.id, titulo: motivo,
    paciente: pacienteCliente,
    inicio, fin, color,
    todoElDia: false, esSolicitudCliente: true,
    citaCliente: cita, fcEventCliente,
  };
  citasAdmin.push(adminEntry);

  const fcEventAdmin = calAdmin.addEvent({
    title: `⏳ ${motivo}`,
    start: inicio, end: fin,
    backgroundColor: color, borderColor: color,
    extendedProps: { adminEntry },
  });
  adminEntry.fcEventAdmin = fcEventAdmin;

  renderSidebarCliente();
  renderSidebarAdmin();
}