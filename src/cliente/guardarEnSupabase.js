import supabase from '../services/supabase.js';
import { PACIENTE_ID_CLIENTE } from '../shared/config.js';
import { toUTC } from '../shared/fecha.js';

export async function guardarEnSupabase({ motivo, inicio, fin, notas, color }) {
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

  if (error) { console.error('Error guardando solicitud:', error); return null; }
  return data;
}
