import { ESTADO_COLOR } from '../shared/config.js';
import { citasCliente } from '../shared/estado.js';
import { responderContraoferta } from './contraoferta.js';

const listaProximas = document.getElementById('lista-proximas');
const badgeProximas = document.getElementById('badge-proximas');

export function renderSidebarCliente() {
  const activas = citasCliente.filter(c => c.estado !== 'Cancelada' && c.estado !== 'Rechazada');
  badgeProximas.textContent = activas.length;
  listaProximas.innerHTML   = '';

  if (!citasCliente.length) {
    listaProximas.innerHTML = '<li class="pendiente-vacio">Sin citas agendadas</li>';
    return;
  }

  const ord = [...citasCliente].sort((a, b) => new Date(a.inicio) - new Date(b.inicio));

  ord.forEach(ev => {
    const ini   = new Date(ev.inicio);
    const fecha = ini.toLocaleDateString('es', { day: '2-digit', month: 'short' });
    const hora  = ini.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    const color = ESTADO_COLOR[ev.estado] || '#22c55e';

    const li = document.createElement('li');
    li.className = 'pendiente-item';

    if (ev.estado === 'Reprogramada' && ev.inicioPropuesto) {
      const iniP = new Date(ev.inicioPropuesto);
      const finP = new Date(ev.finPropuesto);
      const fmtT = { hour: '2-digit', minute: '2-digit' };
      const fmtD = { day: '2-digit', month: 'short' };
      li.innerHTML = `
        <span class="pendiente-dot" style="background:${color}"></span>
        <div class="pendiente-info pendiente-info-full">
          <div class="pendiente-titulo">${ev.motivo}</div>
          <div class="pendiente-hora">${hora} · <span style="color:${color}">Reprogramada</span></div>
          <div class="contraoferta-box">
            <span class="contraoferta-label">Nueva propuesta</span>
            <span class="contraoferta-horario">
              ${iniP.toLocaleDateString('es', fmtD)} · ${iniP.toLocaleTimeString('es', fmtT)} – ${finP.toLocaleTimeString('es', fmtT)}
            </span>
            <div class="contraoferta-acciones">
              <button class="btn-co-rechazar">✕ Rechazar</button>
              <button class="btn-co-aceptar">✓ Aceptar</button>
            </div>
          </div>
        </div>`;

      li.querySelector('.btn-co-aceptar').addEventListener('click', () => responderContraoferta(ev, 'Confirmada'));
      li.querySelector('.btn-co-rechazar').addEventListener('click', () => responderContraoferta(ev, 'Rechazada'));
    } else {
      li.innerHTML = `
        <span class="pendiente-dot" style="background:${color}"></span>
        <div class="pendiente-info">
          <div class="pendiente-titulo" title="${ev.motivo}">${ev.motivo}</div>
          <div class="pendiente-hora">${hora}</div>
        </div>
        <div class="pendiente-right">
          <span class="pendiente-fecha">${fecha}</span>
          <span class="estado-badge" style="background:${color}20;color:${color};border-color:${color}40">${ev.estado}</span>
        </div>`;
    }

    listaProximas.appendChild(li);
  });
}