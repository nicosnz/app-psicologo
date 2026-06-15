import { ESTADO_COLOR } from '../shared/config.js';
import { validarRango } from '../shared/validaciones.js';
import { guardarEnSupabase } from './guardarEnSupabase.js';
import { registrarEnCalendarios } from './registrarEnCalendario.js';

export async function agregarCitaCliente({ motivo, inicio, fin, notas }, calAdmin, calCliente) {
  if (!motivo || !inicio || !fin) return null;
  if (validarRango({ inicio, fin })) return null;

  const color = ESTADO_COLOR['Pendiente'];
  const data  = await guardarEnSupabase({ motivo, inicio, fin, notas, color });
  if (!data) return null;

  registrarEnCalendarios(data, { motivo, inicio, fin, notas, color }, calAdmin, calCliente);
}