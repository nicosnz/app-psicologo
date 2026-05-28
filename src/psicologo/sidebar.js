import { citasAdmin } from '../shared/estado.js';

const listaPendientes = document.getElementById('lista-pendientes');
const badgePendientes = document.getElementById('badge-pendientes');

export function renderSidebarAdmin() {
  badgePendientes.textContent = citasAdmin.length;
  listaPendientes.innerHTML   = '';

  if (!citasAdmin.length) {
    listaPendientes.innerHTML = '<li class="pendiente-vacio">Sin citas pendientes</li>';
    return;
  }

  const ord = [...citasAdmin].sort((a, b) => new Date(a.inicio) - new Date(b.inicio));

  ord.forEach(ev => {
    const ini         = new Date(ev.inicio);
    const fecha       = ini.toLocaleDateString('es', { day: '2-digit', month: 'short' });
    const hora        = ev.todoElDia ? 'Todo el día' : ini.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    const pacienteStr = ev.paciente?.nombre
      ? `${ev.paciente.nombre}${ev.paciente.apellido ? ' ' + ev.paciente.apellido : ''}`
      : '';

    const li = document.createElement('li');
    li.className = 'pendiente-item pendiente-clickable';
    li.innerHTML = `
      <span class="pendiente-dot" style="background:${ev.color}"></span>
      <div class="pendiente-info">
        <div class="pendiente-titulo" title="${ev.titulo}">${ev.titulo}</div>
        ${pacienteStr ? `<div class="pendiente-paciente">${pacienteStr}</div>` : ''}
        <div class="pendiente-hora">${hora}</div>
      </div>
      <div class="pendiente-right">
        <span class="pendiente-fecha">${fecha}</span>
        ${ev.esSolicitudCliente ? `<span class="tag-solicitud">${ev.citaCliente?.estado || 'Pendiente'}</span>` : ''}
      </div>`;

    // El listener de click se inyecta desde main.js para evitar dependencia circular con modal detalle
    li.dataset.entryId = ev.id;
    listaPendientes.appendChild(li);
  });
}

/**
 * Permite que main.js registre el handler de click para abrir el modal de detalle.
 * Se llama una sola vez durante la inicialización.
 */
export function bindSidebarAdminClick(onItemClick) {
  listaPendientes.addEventListener('click', (e) => {
    const li = e.target.closest('.pendiente-clickable');
    if (!li) return;
    const entry = citasAdmin.find(c => c.id === li.dataset.entryId);
    if (entry) onItemClick(entry, entry.fcEventAdmin);
  });
}