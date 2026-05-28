import { PACIENTE_ID_CLIENTE } from './config.js';

// Listas mutables compartidas entre módulos de psicólogo y cliente
export const citasAdmin   = [];
export const citasCliente = [];
export const pacientes    = [];

// Datos del paciente que opera como "cliente fijo"
export let pacienteCliente = { nombre: 'Paciente', apellido: '', telefono: '' };

export function setPacienteCliente(p) {
  pacienteCliente = p;
}