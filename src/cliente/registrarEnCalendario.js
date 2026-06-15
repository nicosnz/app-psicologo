import { citasAdmin, citasCliente, pacienteCliente } from '../shared/estado.js';
import { renderSidebarAdmin } from '../psicologo/sidebar.js';
import { renderSidebarCliente } from './sidebar.js';

export function registrarEnCalendarios(data, { motivo, inicio, fin, notas, color }, calAdmin, calCliente) {
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
