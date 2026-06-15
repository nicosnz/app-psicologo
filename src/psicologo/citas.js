import supabase from '../services/supabase.js';
import { ESTADO_COLOR } from '../shared/config.js';
import { toUTC, toLocal } from '../shared/fecha.js';
import { citasAdmin, citasCliente, pacienteCliente } from '../shared/estado.js';
import { nombreCompleto } from './pacientes.js';
import { renderSidebarAdmin } from './sidebar.js';
import { renderSidebarCliente } from '../cliente/sidebar.js';
import { agregarCita } from './agregarCita.js';


export async function cargarCitas(calAdmin, calCliente) {
  const { data: citas, error } = await supabase
    .from('citas')
    .select('*, pacientes(id, nombre, apellido, telefono)')
    .order('inicio', { ascending: true });

  if (error) { console.error('Error cargando citas:', error); return; }

  citas.forEach(c => {
    const paciente = c.pacientes || null;
    const color    = ESTADO_COLOR[c.estado] || c.color || '#22c55e';

    if (c.origen === 'admin') {
      const entry = {
        id: c.id, titulo: c.titulo, paciente,
        inicio: toLocal(c.inicio), fin: toLocal(c.fin),
        color, todoElDia: c.todo_el_dia, esSolicitudCliente: false,
      };
      citasAdmin.push(entry);

      const label = paciente ? `${c.titulo} · ${paciente.nombre} ${paciente.apellido}` : c.titulo;
      calAdmin.addEvent({
        title: label, start: c.inicio, end: c.fin, allDay: c.todo_el_dia,
        backgroundColor: color, borderColor: color,
        extendedProps: { adminEntry: entry },
      });

    } else {
      const citaCliente = {
        id: c.id, motivo: c.titulo,
        inicio: toLocal(c.inicio), fin: toLocal(c.fin),
        notas: c.cli_notas, estado: c.estado,
        inicioPropuesto: c.inicio_propuesto ? toLocal(c.inicio_propuesto) : null,
        finPropuesto:    c.fin_propuesto    ? toLocal(c.fin_propuesto)    : null,
      };
      citasCliente.push(citaCliente);

      const fcEventCliente = calCliente.addEvent({
        title: c.titulo,
        start: c.inicio, end: c.fin,
        backgroundColor: color, borderColor: color,
        extendedProps: { cita: citaCliente },
      });

      const prefijo = c.estado === 'Confirmada' ? '✅' : c.estado === 'Rechazada' ? '❌' : '⏳';
      const adminEntry = {
        id: c.id, titulo: c.titulo,
        paciente: paciente || pacienteCliente,
        inicio: toLocal(c.inicio), fin: toLocal(c.fin), color,
        todoElDia: false, esSolicitudCliente: true,
        citaCliente, fcEventCliente,
      };
      citasAdmin.push(adminEntry);

      const fcEventAdmin = calAdmin.addEvent({
        title: `${prefijo} ${c.titulo}`,
        start: c.inicio, end: c.fin,
        backgroundColor: color, borderColor: color,
        extendedProps: { adminEntry },
      });
      adminEntry.fcEventAdmin = fcEventAdmin;
    }
  });

  renderSidebarAdmin();
  renderSidebarCliente();
}


export async function agregarEvento(
  { titulo, paciente, inicio, fin, color, descripcion, todoElDia = false },
  calAdmin
) {
  
  const cita = await agregarCita(titulo, paciente, inicio, fin, color, descripcion, todoElDia = false ,calAdmin)
  if(cita !== null){
    renderSidebarAdmin();

   return cita;
  }
  return null
  
}