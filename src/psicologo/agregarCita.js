import supabase from '../services/supabase.js';
import { toUTC, toLocal } from '../shared/fecha.js';
// import { citasAdmin, citasCliente, pacienteCliente } from '../shared/estado.js';
// import { nombreCompleto } from './pacientes.js';

export async function agregarCita(
   titulo, paciente, inicio, fin, color, descripcion, todoElDia = false ,
  calAdmin
) {
  if (!titulo || !inicio || !fin) return null;

  const horaInicio = new Date(inicio).getHours();
  const horaFin = new Date(fin).getHours();

  if (horaInicio < 9 || horaFin > 21) {
    return null;
  }

  const { data, error } = await supabase
    .from('citas')
    .insert({
      paciente_id: paciente?.id || null,
      titulo,
      descripcion: descripcion || null,
      inicio: toUTC(inicio),
      fin: toUTC(fin),
      todo_el_dia: todoElDia,
      color: color || '#22c55e',
      estado: 'Confirmada',
      origen: 'admin',
    })
    .select()
    .single();

  if (error) {
    console.error('Error guardando cita:', error);
    return null;
  }

  const entry = {
    id: data.id,
    titulo,
    paciente,
    inicio,
    fin,
    color: color || '#22c55e',
    todoElDia,
    esSolicitudCliente: false,
  };

//   citasAdmin.push(entry);

//   const label = paciente
//     ? `${titulo} · ${nombreCompleto(paciente)}`
//     : titulo;

//   calAdmin.addEvent({
//     title: label,
//     start: inicio,
//     end: fin,
//     allDay: todoElDia,
//     backgroundColor: color,
//     borderColor: color,
//     extendedProps: { adminEntry: entry },
//   });


  return entry;
}