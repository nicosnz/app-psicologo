import { Calendar } from '@fullcalendar/core';
import LocalEs from '@fullcalendar/core/locales/es';
import dayGridPlugin    from '@fullcalendar/daygrid';
import timeGridPlugin   from '@fullcalendar/timegrid';
import listPlugin       from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';

import { DIAS_LABORALES, HORA_MIN, HORA_MAX, ESTADO_COLOR } from './src/shared/config.js';
import { hoy, parseFechaLocal, esDiaLaboral, fechaConHoraMin } from './src/shared/fecha.js';
import { validarRango, detectarConflicto } from './src/shared/validaciones.js';

import { abrirOverlay, cerrarModales } from './src/ui/modales.js';
import { bindInputRestricciones } from './src/ui/restricciones.js';

import { cargarPacientes, pacienteSeleccionado, limpiarPaciente } from './src/psicologo/pacientes.js';
import { cargarCitas, agregarEvento } from './src/psicologo/citas.js';
import { renderSidebarAdmin, bindSidebarAdminClick } from './src/psicologo/sidebar.js';
import { setEntryActual, aplicarDecision } from './src/psicologo/decision.js';

import { agregarCitaCliente } from './src/cliente/citas.js';
import { renderSidebarCliente } from './src/cliente/sidebar.js';

document.addEventListener('DOMContentLoaded', async () => {

  /* ══════════════════════════════════════════════════════════
     FACTORY: crear un Calendar con config base
  ══════════════════════════════════════════════════════════ */
  function crearCalendario(elId, onDateClick) {
    return new Calendar(document.getElementById(elId), {
      plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],
      initialView: 'dayGridMonth',
      locale: LocalEs,
      headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,listWeek' },
      businessHours: {
        daysOfWeek: DIAS_LABORALES,
        startTime:  `${String(HORA_MIN).padStart(2, '0')}:00`,
        endTime:    `${String(HORA_MAX).padStart(2, '00')}:00`,
      },
      dayCellClassNames(arg) {
        if (arg.date < hoy() || !esDiaLaboral(arg.date)) return ['dia-bloqueado'];
        return [];
      },
      dateClick(info) {
        const fecha = parseFechaLocal(info.dateStr);
        if (fecha < hoy() || !esDiaLaboral(fecha)) return;
        onDateClick(info.dateStr);
      },
    });
  }

  /* ══════════════════════════════════════════════════════════
     CALENDARIOS
  ══════════════════════════════════════════════════════════ */
  const calAdmin = crearCalendario('calendar-admin', (fechaStr) => abrirModalAdmin(fechaStr));
  calAdmin.setOption('eventClick', (info) => {
    const entry = info.event.extendedProps.adminEntry;
    if (entry) abrirModalDetalleCita(entry, info.event);
  });
  calAdmin.render();

  const calCliente = crearCalendario('calendar-cliente', (fechaStr) => abrirModalCliente(fechaStr));
  calCliente.render();

  /* ══════════════════════════════════════════════════════════
     MODAL ADMIN (nueva cita del psicólogo)
  ══════════════════════════════════════════════════════════ */
  const modalAdmin   = document.getElementById('modal-evento');
  const formAdmin    = document.getElementById('form-evento');
  const errorAdmin   = document.getElementById('form-error');
  const inputTitulo  = document.getElementById('evento-titulo');
  const inputInicio  = document.getElementById('evento-inicio');
  const inputFin     = document.getElementById('evento-fin');
  const inputColor   = document.getElementById('evento-color');
  const inputDesc    = document.getElementById('evento-descripcion');
  const inputTodoDia = document.getElementById('evento-todo-dia');
  const filaHoras    = document.getElementById('fila-horas');

  const { mostrar: mostrarErrAdmin, limpiar: limpiarErrAdmin } =
    bindInputRestricciones(inputInicio, inputFin, errorAdmin);

  inputTodoDia.addEventListener('change', () => {
    filaHoras.style.display = inputTodoDia.checked ? 'none' : 'grid';
    limpiarErrAdmin();
  });

  function abrirModalAdmin(fechaStr = '') {
    formAdmin.reset(); limpiarErrAdmin(); inputColor.value = '#22c55e';
    limpiarPaciente();
    const minVal = fechaConHoraMin(hoy());
    inputInicio.min = minVal; inputFin.min = minVal;
    if (fechaStr) {
      const f = fechaStr.slice(0, 10);
      inputInicio.value = `${f}T09:00`; inputFin.value = `${f}T10:00`;
      const maxStr = `${f}T${String(HORA_MAX).padStart(2, '0')}:00`;
      inputInicio.max = maxStr; inputFin.max = maxStr; inputFin.min = `${f}T09:00`;
    }
    filaHoras.style.display = 'grid';
    abrirOverlay(modalAdmin);
    inputTitulo.focus();
  }

  formAdmin.addEventListener('submit', async (e) => {
    e.preventDefault(); limpiarErrAdmin();
    if (!pacienteSeleccionado) {
      mostrarErrAdmin('Selecciona un paciente para la cita.');
      return;
    }
    const err = validarRango({ inicio: inputInicio.value, fin: inputFin.value });
    if (err) { mostrarErrAdmin(err); return; }
    const conflicto = detectarConflicto({ inicio: inputInicio.value, fin: inputFin.value });
    if (conflicto) { mostrarErrAdmin(conflicto); return; }

    await agregarEvento({
      titulo:      inputTitulo.value.trim(),
      paciente:    pacienteSeleccionado,
      inicio:      inputInicio.value,
      fin:         inputFin.value,
      color:       inputColor.value,
      descripcion: inputDesc.value.trim(),
      todoElDia:   inputTodoDia.checked,
    }, calAdmin);
    cerrarModales();
  });

  document.getElementById('modal-cerrar').addEventListener('click', cerrarModales);

  /* ══════════════════════════════════════════════════════════
     MODAL CLIENTE (nueva solicitud del cliente)
  ══════════════════════════════════════════════════════════ */
  const modalCliente = document.getElementById('modal-cliente');
  const formCliente  = document.getElementById('form-cliente');
  const errorCli     = document.getElementById('cli-error');
  const cliMotivo    = document.getElementById('cli-motivo');
  const cliInicio    = document.getElementById('cli-inicio');
  const cliFin       = document.getElementById('cli-fin');
  const cliNotas     = document.getElementById('cli-notas');
  const cliNombre    = document.getElementById('cli-nombre');

  const { mostrar: mostrarErrCli, limpiar: limpiarErrCli } =
    bindInputRestricciones(cliInicio, cliFin, errorCli);

  function abrirModalCliente(fechaStr = '') {
    formCliente.reset(); limpiarErrCli();
    const minVal = fechaConHoraMin(hoy());
    cliInicio.min = minVal; cliFin.min = minVal;
    if (fechaStr) {
      const f = fechaStr.slice(0, 10);
      cliInicio.value = `${f}T09:00`; cliFin.value = `${f}T10:00`;
      const maxStr = `${f}T${String(HORA_MAX).padStart(2, '0')}:00`;
      cliInicio.max = maxStr; cliFin.max = maxStr; cliFin.min = `${f}T09:00`;
    }
    abrirOverlay(modalCliente);
    cliNombre.focus();
  }

  formCliente.addEventListener('submit', async (e) => {
    e.preventDefault(); limpiarErrCli();
    const err = validarRango({ inicio: cliInicio.value, fin: cliFin.value });
    if (err) { mostrarErrCli(err); return; }
    await agregarCitaCliente({
      motivo: cliMotivo.value.trim(),
      inicio: cliInicio.value,
      fin:    cliFin.value,
      notas:  cliNotas.value.trim(),
    }, calAdmin, calCliente);
    cerrarModales();
  });

  document.getElementById('modal-cliente-cerrar').addEventListener('click', cerrarModales);

  /* ══════════════════════════════════════════════════════════
     MODAL DETALLE CITA (admin)
  ══════════════════════════════════════════════════════════ */
  const modalDetalle    = document.getElementById('modal-detalle');
  const detalleTitulo   = document.getElementById('detalle-titulo');
  const detallePaciente = document.getElementById('detalle-paciente');
  const detalleHorario  = document.getElementById('detalle-horario');
  const detalleNotas    = document.getElementById('detalle-notas');
  const detalleNotasRow = document.getElementById('detalle-notas-row');
  const detalleEstado   = document.getElementById('detalle-estado');
  const detalleAcciones = document.getElementById('detalle-acciones');
  const btnConfirmar    = document.getElementById('btn-confirmar');
  const btnRechazar     = document.getElementById('btn-rechazar');

  function abrirModalDetalleCita(entry, fcEvent) {
    setEntryActual(entry, fcEvent);

    const ini      = new Date(entry.inicio);
    const finDate  = new Date(entry.fin);
    const fmt      = { hour: '2-digit', minute: '2-digit' };
    const fmtFecha = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };

    detalleTitulo.textContent   = entry.titulo;
    detallePaciente.textContent = entry.paciente
      ? `${entry.paciente.nombre}${entry.paciente.apellido ? ' ' + entry.paciente.apellido : ''}`.trim()
      : '—';
    detalleHorario.textContent  =
      `${ini.toLocaleDateString('es', fmtFecha)} · ${ini.toLocaleTimeString('es', fmt)} – ${finDate.toLocaleTimeString('es', fmt)}`;

    const notas = entry.citaCliente?.notas || entry.descripcion || '';
    if (notas) { detalleNotas.textContent = notas; detalleNotasRow.style.display = ''; }
    else        { detalleNotasRow.style.display = 'none'; }

    const estado = entry.citaCliente?.estado || (entry.esSolicitudCliente ? 'Pendiente' : 'Confirmada');
    const color  = ESTADO_COLOR[estado] || '#22c55e';
    detalleEstado.textContent       = estado;
    detalleEstado.style.background  = `${color}20`;
    detalleEstado.style.color       = color;
    detalleEstado.style.borderColor = `${color}40`;
    detalleAcciones.style.display   = estado === 'Pendiente' ? 'flex' : 'none';

    const msgConflicto = document.getElementById('detalle-conflicto');
    msgConflicto.textContent = ''; msgConflicto.classList.remove('visible');

    abrirOverlay(modalDetalle);
  }

  btnConfirmar.addEventListener('click', () => aplicarDecision('Confirmada',   { onCerrar: cerrarModales }));
  btnRechazar.addEventListener('click',  () => aplicarDecision('Rechazada',    { onCerrar: cerrarModales }));
  document.getElementById('btn-reprogramar').addEventListener('click', () => aplicarDecision('Reprogramada', { onCerrar: cerrarModales }));
  document.getElementById('modal-detalle-cerrar').addEventListener('click', cerrarModales);

  /* Conectar click del sidebar admin con el modal detalle */
  bindSidebarAdminClick(abrirModalDetalleCita);

  /* ══════════════════════════════════════════════════════════
     SWITCH DE MODO (admin ↔ cliente)
  ══════════════════════════════════════════════════════════ */
  const vistaAdmin   = document.getElementById('vista-admin');
  const vistaCliente = document.getElementById('vista-cliente');
  const btnModo      = document.getElementById('btn-modo-cliente');
  let modoCliente    = false;

  btnModo.addEventListener('click', () => {
    modoCliente = !modoCliente;
    vistaAdmin.classList.toggle('oculto', modoCliente);
    vistaCliente.classList.toggle('oculto', !modoCliente);
    btnModo.innerHTML = modoCliente
      ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg> Modo admin`
      : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> Modo cliente`;

    if (modoCliente) { calCliente.updateSize(); renderSidebarCliente(); }
    else              { calAdmin.updateSize();   renderSidebarAdmin(); }
  });

  /* ══════════════════════════════════════════════════════════
     INIT
  ══════════════════════════════════════════════════════════ */
  await cargarPacientes();
  await cargarCitas(calAdmin, calCliente);

  window.agregarEvento      = (datos) => agregarEvento(datos, calAdmin);
  window.agregarCitaCliente = (datos) => agregarCitaCliente(datos, calAdmin, calCliente);
});