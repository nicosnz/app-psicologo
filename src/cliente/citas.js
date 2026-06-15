import supabase from '../services/supabase.js';
import { ESTADO_COLOR, PACIENTE_ID_CLIENTE } from '../shared/config.js';
import { toUTC, esDiaLaboral } from '../shared/fecha.js';
import { HORA_MIN, HORA_MAX } from '../shared/config.js';
import { citasAdmin, citasCliente, pacienteCliente } from '../shared/estado.js';
import { renderSidebarAdmin } from '../psicologo/sidebar.js';
import { renderSidebarCliente } from './sidebar.js';


export async function agregarCitaCliente({ motivo, inicio, fin, notas }, calAdmin, calCliente) {
  const fechaInicio = new Date(inicio);
  if (!esDiaLaboral(fechaInicio)) return null;
  if (fechaInicio.getHours() < HORA_MIN || fechaInicio.getHours() >= HORA_MAX) return null;

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