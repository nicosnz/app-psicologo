import supabase from '../services/supabase.js';
import { pacientes, pacienteCliente, setPacienteCliente } from '../shared/estado.js';
import { PACIENTE_ID_CLIENTE } from '../shared/config.js';
import { cerrarModales, onCerrarModales } from '../ui/modales.js';

/* ── Estado local del selector ──────────────────────────── */
export let pacienteSeleccionado = null;

/* ── Elementos DOM ──────────────────────────────────────── */
const pacienteSearch    = document.getElementById('paciente-search');
const pacienteDropdown  = document.getElementById('paciente-dropdown');
const pacienteSelected  = document.getElementById('paciente-selected');
const pacienteNombreEl  = document.getElementById('paciente-nombre-sel');
const pacienteTelEl     = document.getElementById('paciente-tel-sel');
const pacienteClear     = document.getElementById('paciente-clear');
const btnNuevoPaciente  = document.getElementById('btn-nuevo-paciente');
const formNuevoPaciente = document.getElementById('form-nuevo-paciente');
const npNombre          = document.getElementById('np-nombre');
const npApellido        = document.getElementById('np-apellido');
const npTelefono        = document.getElementById('np-telefono');
const npGuardar         = document.getElementById('np-guardar');
const npCancelar        = document.getElementById('np-cancelar');
const npError           = document.getElementById('np-error');

/* ── Helpers ────────────────────────────────────────────── */
export function nombreCompleto(p) {
  return `${p.nombre} ${p.apellido}`.trim();
}

/* ── Carga desde Supabase ───────────────────────────────── */
export async function cargarPacientes() {
  const { data: pacs, error } = await supabase
    .from('pacientes')
    .select('*')
    .order('creado_en', { ascending: true });

  if (error) { console.error('Error cargando pacientes:', error); return; }

  pacientes.length = 0;
  pacs.forEach(p => pacientes.push({ id: p.id, nombre: p.nombre, apellido: p.apellido, telefono: p.telefono }));
  setPacienteCliente(
    pacientes.find(p => p.id === PACIENTE_ID_CLIENTE) || { nombre: 'Paciente', apellido: '', telefono: '' }
  );
}

/* ── Dropdown ───────────────────────────────────────────── */
function renderDropdown(filtro = '') {
  const q     = filtro.trim().toLowerCase();
  const lista = q ? pacientes.filter(p => nombreCompleto(p).toLowerCase().includes(q)) : pacientes;

  pacienteDropdown.innerHTML = '';

  if (!lista.length) {
    pacienteDropdown.innerHTML = `<li class="pd-empty">Sin resultados para "${filtro}"</li>`;
  } else {
    lista.forEach(p => {
      const li = document.createElement('li');
      li.className = 'pd-item';
      li.innerHTML = `
        <span class="pd-avatar">${p.nombre[0]}${p.apellido[0]}</span>
        <span class="pd-info">
          <span class="pd-nombre">${nombreCompleto(p)}</span>
          <span class="pd-tel">${p.telefono}</span>
        </span>`;
      li.addEventListener('mousedown', (e) => { e.preventDefault(); seleccionarPaciente(p); });
      pacienteDropdown.appendChild(li);
    });
  }

  const liNuevo = document.createElement('li');
  liNuevo.className = 'pd-nuevo';
  liNuevo.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Agregar nuevo paciente`;
  liNuevo.addEventListener('mousedown', (e) => { e.preventDefault(); abrirFormNuevoPaciente(); });
  pacienteDropdown.appendChild(liNuevo);
  pacienteDropdown.classList.add('visible');
}

function cerrarDropdown() { pacienteDropdown.classList.remove('visible'); }

export function seleccionarPaciente(p) {
  pacienteSeleccionado = p;
  pacienteSearch.value = '';
  cerrarDropdown();
  pacienteNombreEl.textContent = nombreCompleto(p);
  pacienteTelEl.textContent    = p.telefono;
  pacienteSelected.classList.add('visible');
  pacienteSearch.style.display = 'none';
}

export function limpiarPaciente() {
  pacienteSeleccionado = null;
  pacienteSelected.classList.remove('visible');
  pacienteSearch.style.display = '';
  pacienteSearch.value = '';
  cerrarDropdown();
}

/* ── Formulario nuevo paciente ──────────────────────────── */
function abrirFormNuevoPaciente() {
  cerrarDropdown();
  npNombre.value = ''; npApellido.value = ''; npTelefono.value = '';
  npError.textContent = ''; npError.classList.remove('visible');
  formNuevoPaciente.classList.add('visible');
  npNombre.focus();
}

export function cerrarFormNuevoPaciente() {
  formNuevoPaciente.classList.remove('visible');
}

npGuardar.addEventListener('click', async () => {
  npError.classList.remove('visible');
  const nombre   = npNombre.value.trim();
  const apellido = npApellido.value.trim();
  const telefono = npTelefono.value.trim();

  if (!nombre || !apellido || !telefono) {
    npError.textContent = 'Completa todos los campos del paciente.';
    npError.classList.add('visible');
    return;
  }

  const { data, error } = await supabase
    .from('pacientes')
    .insert({ nombre, apellido, telefono })
    .select()
    .single();

  if (error) {
    npError.textContent = 'Error al guardar el paciente. Intenta de nuevo.';
    npError.classList.add('visible');
    console.error(error);
    return;
  }

  const nuevo = { id: data.id, nombre: data.nombre, apellido: data.apellido, telefono: data.telefono };
  pacientes.push(nuevo);
  cerrarFormNuevoPaciente();
  seleccionarPaciente(nuevo);
});

/* ── Eventos DOM ────────────────────────────────────────── */
pacienteSearch.addEventListener('focus', () => renderDropdown(pacienteSearch.value));
pacienteSearch.addEventListener('input', () => renderDropdown(pacienteSearch.value));
pacienteSearch.addEventListener('blur',  () => setTimeout(cerrarDropdown, 150));
pacienteClear.addEventListener('click', limpiarPaciente);
btnNuevoPaciente.addEventListener('click', abrirFormNuevoPaciente);
npCancelar.addEventListener('click', cerrarFormNuevoPaciente);

// Al cerrar cualquier modal, limpiar selector y form
onCerrarModales(() => {
  limpiarPaciente();
  cerrarFormNuevoPaciente();
});