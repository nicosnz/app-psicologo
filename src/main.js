import { Calendar } from '@fullcalendar/core';
import LocalEs from "@fullcalendar/core/locales/es"
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import supabase from './services/supabase.js';


document.addEventListener('DOMContentLoaded', async () => {

  /* ══════════════════════════════════════════════════════════
     CONFIGURACIÓN
  ══════════════════════════════════════════════════════════ */
  const DIAS_LABORALES = [1, 2, 3, 4, 5];
  const HORA_MIN = 9;
  const HORA_MAX = 21;

  const ESTADO_COLOR = {
    Pendiente:    '#f59e0b',
    Confirmada:   '#22c55e',
    Rechazada:    '#ef4444',
    Reprogramada: '#8b5cf6',
    Cancelada:    '#6b7280',
  };

  /* ── Estado compartido entre vistas ──────────────────────── */
  let citasAdmin   = [];
  let citasCliente = [];
  let pacientes    = [];

  let pacienteSeleccionado = null;
  const PACIENTE_ID_CLIENTE = '8a3e0661-d149-49f1-a22f-4701d42050c4';
  let pacienteCliente = { nombre: 'Paciente', apellido: '', telefono: '' };

  /* ══════════════════════════════════════════════════════════
     HELPERS FECHA / HORA
  ══════════════════════════════════════════════════════════ */
  function hoy() {
    const h = new Date();
    return new Date(h.getFullYear(), h.getMonth(), h.getDate());
  }

  function parseFechaLocal(str) {
    const [y, m, d] = str.slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function esDiaLaboral(date) {
    return DIAS_LABORALES.includes(date.getDay());
  }

  function proximoDiaLaboral(desde) {
    const d = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate());
    do { d.setDate(d.getDate() + 1); } while (!esDiaLaboral(d));
    return d;
  }

  function fechaConHoraMin(date) {
    const yyyy = date.getFullYear();
    const mm   = String(date.getMonth() + 1).padStart(2, '0');
    const dd   = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${String(HORA_MIN).padStart(2,'0')}:00`;
  }

  function corregirDatetime(datetimeStr) {
    if (!datetimeStr) return datetimeStr;
    let date = new Date(datetimeStr);
    if (!esDiaLaboral(date)) {
      const sig = proximoDiaLaboral(date);
      date = new Date(sig.getFullYear(), sig.getMonth(), sig.getDate(), date.getHours(), date.getMinutes());
    }
    if (date.getHours() < HORA_MIN) date.setHours(HORA_MIN, 0);
    else if (date.getHours() >= HORA_MAX) date.setHours(HORA_MAX, 0);
    const yyyy = date.getFullYear();
    const mm   = String(date.getMonth() + 1).padStart(2, '0');
    const dd   = String(date.getDate()).padStart(2, '0');
    const hh   = String(date.getHours()).padStart(2, '0');
    const min  = String(date.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  }

  function validarRango({ inicio, fin }) {
    const dateInicio = new Date(inicio);
    const dateFin    = new Date(fin);
    const soloInicio = new Date(dateInicio.getFullYear(), dateInicio.getMonth(), dateInicio.getDate());
    if (soloInicio < hoy())          return 'No se pueden agendar citas en fechas pasadas.';
    if (!esDiaLaboral(dateInicio))   return 'El día seleccionado no es un día laboral.';
    if (dateInicio.getHours() < HORA_MIN || dateInicio.getHours() >= HORA_MAX)
      return `El horario debe estar entre las ${HORA_MIN}:00 y las ${HORA_MAX}:00.`;
    if (dateFin.getHours() < HORA_MIN || dateFin.getHours() > HORA_MAX || (dateFin.getHours() === HORA_MAX && dateFin.getMinutes() > 0))
      return `El horario debe estar entre las ${HORA_MIN}:00 y las ${HORA_MAX}:00.`;
    if (dateFin <= dateInicio)       return 'La hora de fin debe ser posterior a la de inicio.';
    if (dateFin.toDateString() !== dateInicio.toDateString()) return 'La cita no puede extenderse a otro día.';
    if ((dateFin - dateInicio) > 60 * 60 * 1000) return 'La cita no puede durar más de una hora.';
    return null;
  }

  function detectarConflicto({ inicio, fin }) {
    const newIni = new Date(inicio).getTime();
    const newFin = new Date(fin).getTime();
    const activas = citasAdmin.filter(c => {
      // Citas del cliente: excluir rechazadas/canceladas
      if (c.esSolicitudCliente) {
        const estado = c.citaCliente?.estado;
        return estado !== 'Rechazada' && estado !== 'Cancelada';
      }
      // Citas del admin: siempre activas (ya están confirmadas)
      return true;
    });
    const conflicto = activas.find(c => {
      const cIni = new Date(c.inicio).getTime();
      const cFin = new Date(c.fin).getTime();
      return newIni < cFin && newFin > cIni;
    });
    if (!conflicto) return null;
    const cfIni = new Date(conflicto.inicio);
    const cfFin = new Date(conflicto.fin);
    const fmt = { hour: '2-digit', minute: '2-digit' };
    return `Ya tienes una cita agendada de ${cfIni.toLocaleTimeString('es', fmt)} a ${cfFin.toLocaleTimeString('es', fmt)}. Intenta con otro horario.`;
  }

  // Convierte string "YYYY-MM-DDTHH:mm" (hora local) a ISO UTC para Supabase
  function toUTC(localStr) {
    return new Date(localStr).toISOString();
  }

  // Convierte timestamp UTC de Supabase a "YYYY-MM-DDTHH:mm" en hora local
  function toLocal(utcStr) {
    const d = new Date(utcStr);
    const yyyy = d.getFullYear();
    const mm   = String(d.getMonth() + 1).padStart(2, '0');
    const dd   = String(d.getDate()).padStart(2, '0');
    const hh   = String(d.getHours()).padStart(2, '0');
    const min  = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  }

  function bindInputRestricciones(inputI, inputF, errorEl) {
    function mostrar(msg) { errorEl.textContent = msg; errorEl.classList.add('visible'); }
    function limpiar()    { errorEl.textContent = ''; errorEl.classList.remove('visible'); }

    inputI.addEventListener('change', () => {
      limpiar();
      if (!inputI.value) return;
      const c = corregirDatetime(inputI.value);
      if (c !== inputI.value) { inputI.value = c; mostrar('Horario ajustado al rango laboral (08:00–20:00, lun–vie).'); }
      const fecha = inputI.value.slice(0, 10);
      const maxStr = `${fecha}T${String(HORA_MAX).padStart(2,'0')}:00`;
      inputI.max = maxStr; inputF.max = maxStr; inputF.min = inputI.value;
      if (!inputF.value || inputF.value <= inputI.value) {
        const d = new Date(inputI.value);
        d.setHours(d.getHours() + 1);
        if (d.getHours() > HORA_MAX || (d.getHours() === HORA_MAX && d.getMinutes() > 0)) d.setHours(HORA_MAX, 0);
        inputF.value = `${fecha}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
      }
    });

    inputF.addEventListener('change', () => {
      limpiar();
      if (!inputF.value) return;
      const c = corregirDatetime(inputF.value);
      if (c !== inputF.value) { inputF.value = c; mostrar('Horario ajustado al rango laboral (08:00–20:00, lun–vie).'); }
    });

    return { mostrar, limpiar };
  }

  /* ══════════════════════════════════════════════════════════
     SUPABASE — CARGA INICIAL
  ══════════════════════════════════════════════════════════ */
  async function cargarDatos() {
    // Pacientes
    const { data: pacs, error: errPacs } = await supabase
      .from('pacientes')
      .select('*')
      .order('creado_en', { ascending: true });

    if (errPacs) console.error('Error cargando pacientes:', errPacs);
    else pacientes = pacs.map(p => ({ id: p.id, nombre: p.nombre, apellido: p.apellido, telefono: p.telefono }));

    // Guardar datos del paciente cliente para mostrarlo en el modal
    pacienteCliente = pacientes.find(p => p.id === PACIENTE_ID_CLIENTE) || { nombre: 'Paciente', apellido: '', telefono: '' };

    // Citas (con join a pacientes)
    const { data: citas, error: errCitas } = await supabase
      .from('citas')
      .select('*, pacientes(id, nombre, apellido, telefono)')
      .order('inicio', { ascending: true });

    if (errCitas) { console.error('Error cargando citas:', errCitas); return; }

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
        // origen === 'cliente'
        const citaCliente = {
          id: c.id, motivo: c.titulo,
          inicio: toLocal(c.inicio), fin: toLocal(c.fin), notas: c.cli_notas, estado: c.estado,
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

  /* ══════════════════════════════════════════════════════════
     SELECTOR DE PACIENTES
  ══════════════════════════════════════════════════════════ */
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

  function nombreCompleto(p) { return `${p.nombre} ${p.apellido}`.trim(); }

  function renderDropdown(filtro = '') {
    const q = filtro.trim().toLowerCase();
    const lista = q
      ? pacientes.filter(p => nombreCompleto(p).toLowerCase().includes(q))
      : pacientes;

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

  function seleccionarPaciente(p) {
    pacienteSeleccionado = p;
    pacienteSearch.value = '';
    pacienteDropdown.classList.remove('visible');
    pacienteNombreEl.textContent = nombreCompleto(p);
    pacienteTelEl.textContent    = p.telefono;
    pacienteSelected.classList.add('visible');
    pacienteSearch.style.display = 'none';
  }

  function limpiarPaciente() {
    pacienteSeleccionado = null;
    pacienteSelected.classList.remove('visible');
    pacienteSearch.style.display = '';
    pacienteSearch.value = '';
    cerrarDropdown();
  }

  function cerrarDropdown() { pacienteDropdown.classList.remove('visible'); }

  pacienteSearch.addEventListener('focus', () => renderDropdown(pacienteSearch.value));
  pacienteSearch.addEventListener('input', () => renderDropdown(pacienteSearch.value));
  pacienteSearch.addEventListener('blur',  () => setTimeout(cerrarDropdown, 150));
  pacienteClear.addEventListener('click', limpiarPaciente);

  function abrirFormNuevoPaciente() {
    cerrarDropdown();
    npNombre.value = ''; npApellido.value = ''; npTelefono.value = '';
    npError.textContent = ''; npError.classList.remove('visible');
    formNuevoPaciente.classList.add('visible');
    npNombre.focus();
  }

  function cerrarFormNuevoPaciente() { formNuevoPaciente.classList.remove('visible'); }

  btnNuevoPaciente.addEventListener('click', abrirFormNuevoPaciente);
  npCancelar.addEventListener('click', cerrarFormNuevoPaciente);

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

    // — Supabase: insertar paciente —
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
        startTime: `${String(HORA_MIN).padStart(2,'0')}:00`,
        endTime:   `${String(HORA_MAX).padStart(2,'0')}:00`,
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
     VISTA ADMIN
  ══════════════════════════════════════════════════════════ */
  const calAdmin = crearCalendario('calendar-admin', (fechaStr) => abrirModalAdmin(fechaStr));
  calAdmin.setOption('eventClick', (info) => {
    const entry = info.event.extendedProps.adminEntry;
    if (entry) abrirModalDetalleCita(entry, info.event);
  });
  calAdmin.render();

  const listaPendientes = document.getElementById('lista-pendientes');
  const badgePendientes = document.getElementById('badge-pendientes');

  function renderSidebarAdmin() {
    badgePendientes.textContent = citasAdmin.length;
    listaPendientes.innerHTML = '';
    if (!citasAdmin.length) {
      listaPendientes.innerHTML = '<li class="pendiente-vacio">Sin citas pendientes</li>';
      return;
    }
    const ord = [...citasAdmin].sort((a, b) => new Date(a.inicio) - new Date(b.inicio));
    ord.forEach(ev => {
      const ini   = new Date(ev.inicio);
      const fecha = ini.toLocaleDateString('es', { day: '2-digit', month: 'short' });
      const hora  = ev.todoElDia ? 'Todo el día' : ini.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
      const pacienteStr = ev.paciente && ev.paciente.nombre
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

      li.addEventListener('click', () => abrirModalDetalleCita(ev, ev.fcEventAdmin));
      listaPendientes.appendChild(li);
    });
  }

  async function agregarEvento({ titulo, paciente, inicio, fin, color, descripcion, todoElDia = false }) {
    if (!titulo || !inicio || !fin) return null;

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

    if (error) { console.error('Error guardando cita:', error); return null; }

    const entry = {
      id: data.id, titulo, paciente,
      inicio, fin, color: color || '#22c55e',
      todoElDia, esSolicitudCliente: false,
    };
    citasAdmin.push(entry);

    const label = paciente ? `${titulo} · ${nombreCompleto(paciente)}` : titulo;
    calAdmin.addEvent({
      title: label, start: inicio, end: fin, allDay: todoElDia,
      backgroundColor: color, borderColor: color,
      extendedProps: { adminEntry: entry },
    });

    renderSidebarAdmin();
    return entry;
  }

  // — Modal admin —
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
  const overlay      = document.getElementById('modal-overlay');

  const { mostrar: mostrarErrAdmin, limpiar: limpiarErrAdmin } =
    bindInputRestricciones(inputInicio, inputFin, errorAdmin);

  inputTodoDia.addEventListener('change', () => {
    filaHoras.style.display = inputTodoDia.checked ? 'none' : 'grid';
    limpiarErrAdmin();
  });

  function abrirModalAdmin(fechaStr = '') {
    formAdmin.reset(); limpiarErrAdmin(); inputColor.value = '#22c55e';
    limpiarPaciente();
    cerrarFormNuevoPaciente();
    const minVal = fechaConHoraMin(hoy());
    inputInicio.min = minVal; inputFin.min = minVal;
    if (fechaStr) {
      const f = fechaStr.slice(0, 10);
      inputInicio.value = `${f}T09:00`; inputFin.value = `${f}T10:00`;
      const maxStr = `${f}T${String(HORA_MAX).padStart(2,'0')}:00`;
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
      titulo: inputTitulo.value.trim(),
      paciente: pacienteSeleccionado,
      inicio: inputInicio.value, fin: inputFin.value,
      color: inputColor.value, descripcion: inputDesc.value.trim(), todoElDia: inputTodoDia.checked,
    });
    cerrarModales();
  });

  document.getElementById('modal-cerrar').addEventListener('click', cerrarModales);

  /* ══════════════════════════════════════════════════════════
     VISTA CLIENTE
  ══════════════════════════════════════════════════════════ */
  const calCliente = crearCalendario('calendar-cliente', (fechaStr) => abrirModalCliente(fechaStr));
  calCliente.render();

  const listaProximas = document.getElementById('lista-proximas');
  const badgeProximas = document.getElementById('badge-proximas');

  function renderSidebarCliente() {
    const activas = citasCliente.filter(c => c.estado !== 'Cancelada' && c.estado !== 'Rechazada');
    badgeProximas.textContent = activas.length;
    listaProximas.innerHTML = '';
    if (!citasCliente.length) { listaProximas.innerHTML = '<li class="pendiente-vacio">Sin citas agendadas</li>'; return; }
    const ord = [...citasCliente].sort((a, b) => new Date(a.inicio) - new Date(b.inicio));
    ord.forEach(ev => {
      const ini   = new Date(ev.inicio);
      const fecha  = ini.toLocaleDateString('es', { day: '2-digit', month: 'short' });
      const hora   = ini.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
      const color  = ESTADO_COLOR[ev.estado] || '#22c55e';

      const li = document.createElement('li');
      li.className = 'pendiente-item';

      if (ev.estado === 'Reprogramada' && ev.inicioPropuesto) {
        const iniP  = new Date(ev.inicioPropuesto);
        const finP  = new Date(ev.finPropuesto);
        const fmtT  = { hour: '2-digit', minute: '2-digit' };
        const fmtD  = { day: '2-digit', month: 'short' };
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

  async function responderContraoferta(citaCli, decision) {
    const adminEntry = citasAdmin.find(c => c.citaCliente === citaCli);
    const nuevoEstado = decision;
    const nuevoInicio = decision === 'Confirmada' ? citaCli.inicioPropuesto : citaCli.inicio;
    const nuevoFin    = decision === 'Confirmada' ? citaCli.finPropuesto    : citaCli.fin;

    const updateData = { estado: nuevoEstado };
    if (decision === 'Confirmada') {
      updateData.inicio = toUTC(nuevoInicio);
      updateData.fin    = toUTC(nuevoFin);
    }

    const { error } = await supabase
      .from('citas')
      .update(updateData)
      .eq('id', citaCli.id);

    if (error) { console.error('Error respondiendo contraoferta:', error); return; }

    const color = ESTADO_COLOR[nuevoEstado];
    citaCli.estado = nuevoEstado;
    if (decision === 'Confirmada') {
      citaCli.inicio = nuevoInicio;
      citaCli.fin    = nuevoFin;
    }

    // Actualizar eventos en calendarios
    if (adminEntry) {
      adminEntry.color = color;
      if (decision === 'Confirmada') {
        adminEntry.inicio = nuevoInicio;
        adminEntry.fin    = nuevoFin;
      }
      if (adminEntry.fcEventAdmin) {
        const prefijo = decision === 'Confirmada' ? '✅' : '❌';
        adminEntry.fcEventAdmin.setProp('title', `${prefijo} ${citaCli.motivo}`);
        adminEntry.fcEventAdmin.setProp('backgroundColor', color);
        adminEntry.fcEventAdmin.setProp('borderColor', color);
        if (decision === 'Confirmada') {
          adminEntry.fcEventAdmin.setStart(nuevoInicio);
          adminEntry.fcEventAdmin.setEnd(nuevoFin);
        }
      }
      if (adminEntry.fcEventCliente) {
        adminEntry.fcEventCliente.setProp('backgroundColor', color);
        adminEntry.fcEventCliente.setProp('borderColor', color);
        if (decision === 'Confirmada') {
          adminEntry.fcEventCliente.setStart(nuevoInicio);
          adminEntry.fcEventCliente.setEnd(nuevoFin);
        }
      }
    }

    renderSidebarAdmin();
    renderSidebarCliente();
  }

  async function agregarCitaCliente({ motivo, inicio, fin, notas }) {
    const color = ESTADO_COLOR['Pendiente'];

    const { data, error } = await supabase
      .from('citas')
      .insert({
        paciente_id: PACIENTE_ID_CLIENTE,
        titulo:      motivo,
        inicio: toUTC(inicio),
        fin:    toUTC(fin),
        color,
        estado:      'Pendiente',
        origen:      'cliente',
        cli_notas:   notas || null,
      })
      .select()
      .single();

    if (error) { console.error('Error guardando solicitud:', error); return; }

    const cita = { id: data.id, motivo, inicio, fin, notas, estado: 'Pendiente' };
    citasCliente.push(cita);

    const fcEventCliente = calCliente.addEvent({
      title: motivo,
      start: inicio, end: fin,
      backgroundColor: color, borderColor: color,
      extendedProps: { cita },
    });
    renderSidebarCliente();

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

    renderSidebarAdmin();
  }

  // — Modal cliente —
  const modalCliente = document.getElementById('modal-cliente');
  const formCliente  = document.getElementById('form-cliente');
  const errorCli     = document.getElementById('cli-error');
  const cliMotivo    = document.getElementById('cli-motivo');
  const cliInicio    = document.getElementById('cli-inicio');
  const cliFin       = document.getElementById('cli-fin');
  const cliNotas     = document.getElementById('cli-notas');

  const { mostrar: mostrarErrCli, limpiar: limpiarErrCli } =
    bindInputRestricciones(cliInicio, cliFin, errorCli);

  function abrirModalCliente(fechaStr = '') {
    formCliente.reset(); limpiarErrCli();
    const minVal = fechaConHoraMin(hoy());
    cliInicio.min = minVal; cliFin.min = minVal;
    if (fechaStr) {
      const f = fechaStr.slice(0, 10);
      cliInicio.value = `${f}T09:00`; cliFin.value = `${f}T10:00`;
      const maxStr = `${f}T${String(HORA_MAX).padStart(2,'0')}:00`;
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
      inicio: cliInicio.value, fin: cliFin.value, notas: cliNotas.value.trim(),
    });
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

  let entryActual   = null;
  let fcEventActual = null;

  function abrirModalDetalleCita(entry, fcEvent) {
    entryActual   = entry;
    fcEventActual = fcEvent;

    const ini      = new Date(entry.inicio);
    const finDate  = new Date(entry.fin);
    const fmt      = { hour: '2-digit', minute: '2-digit' };
    const fmtFecha = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };

    detalleTitulo.textContent   = entry.titulo;
    detallePaciente.textContent = entry.paciente
      ? `${entry.paciente.nombre}${entry.paciente.apellido ? ' ' + entry.paciente.apellido : ''}`.trim()
      : '—';
    detalleHorario.textContent = `${ini.toLocaleDateString('es', fmtFecha)} · ${ini.toLocaleTimeString('es', fmt)} – ${finDate.toLocaleTimeString('es', fmt)}`;

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

  function calcularSiguienteHoraLibre(inicio, fin) {
    const duracion = new Date(fin) - new Date(inicio); // duración en ms
    // Todas las citas activas ese mismo día (no rechazadas/canceladas), excluyendo la actual
    const mismaFecha = citasAdmin.filter(c => {
      if (c === entryActual) return false;
      if (c.esSolicitudCliente && (c.citaCliente?.estado === 'Rechazada' || c.citaCliente?.estado === 'Cancelada')) return false;
      return new Date(c.inicio).toDateString() === new Date(inicio).toDateString();
    });
    // Ordenar por inicio
    mismaFecha.sort((a, b) => new Date(a.inicio) - new Date(b.inicio));

    // Intentar desde la hora de fin de la última cita que choca, avanzando de slot en slot
    let candidato = new Date(fin);
    const fechaBase = new Date(inicio);
    const limiteMax = new Date(fechaBase.getFullYear(), fechaBase.getMonth(), fechaBase.getDate(), HORA_MAX, 0);

    for (let i = 0; i < 20; i++) {
      const candidatoFin = new Date(candidato.getTime() + duracion);
      if (candidatoFin > limiteMax) return null; // No hay hueco ese día
      const choca = mismaFecha.some(c => {
        const cIni = new Date(c.inicio).getTime();
        const cFin = new Date(c.fin).getTime();
        return candidato.getTime() < cFin && candidatoFin.getTime() > cIni;
      });
      if (!choca) {
        // Formato local YYYY-MM-DDTHH:mm
        const fmt = d => {
          const yyyy = d.getFullYear();
          const mm   = String(d.getMonth() + 1).padStart(2, '0');
          const dd   = String(d.getDate()).padStart(2, '0');
          const hh   = String(d.getHours()).padStart(2, '0');
          const min  = String(d.getMinutes()).padStart(2, '0');
          return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
        };
        return { inicio: fmt(candidato), fin: fmt(candidatoFin) };
      }
      // Avanzar al fin de la cita que choca
      const chocantesFin = mismaFecha
        .filter(c => new Date(c.inicio).getTime() < candidatoFin.getTime() && new Date(c.fin).getTime() > candidato.getTime())
        .map(c => new Date(c.fin).getTime());
      candidato = new Date(Math.max(...chocantesFin));
    }
    return null;
  }

  async function aplicarDecision(nuevoEstado) {
    if (!entryActual) return;

    if (nuevoEstado === 'Confirmada') {
      const otrasCitas = citasAdmin.filter(c => {
        if (c === entryActual) return false;
        // Cita del admin: siempre confirmada
        if (!c.esSolicitudCliente) return true;
        // Solicitud del cliente: solo si está confirmada
        return c.citaCliente?.estado === 'Confirmada';
      });
      const newIni = new Date(entryActual.inicio).getTime();
      const newFin = new Date(entryActual.fin).getTime();
      const choque = otrasCitas.find(c => {
        const cIni = new Date(c.inicio).getTime();
        const cFin = new Date(c.fin).getTime();
        return newIni < cFin && newFin > cIni;
      });
      if (choque) {
        const cfIni = new Date(choque.inicio);
        const cfFin = new Date(choque.fin);
        const fmt = { hour: '2-digit', minute: '2-digit' };
        const msgEl = document.getElementById('detalle-conflicto');
        msgEl.textContent = `No se puede confirmar: hay una cita de ${cfIni.toLocaleTimeString('es', fmt)} a ${cfFin.toLocaleTimeString('es', fmt)}. Intenta reprogramar.`;
        msgEl.classList.add('visible');
        return;
      }
    }

    // — Caso Reprogramada: calcular siguiente hora libre y guardar contraoferta —
    if (nuevoEstado === 'Reprogramada') {
      const libre = calcularSiguienteHoraLibre(entryActual.inicio, entryActual.fin);
      if (!libre) {
        const msgEl = document.getElementById('detalle-conflicto');
        msgEl.textContent = 'No hay horas disponibles ese día para reprogramar.';
        msgEl.classList.add('visible');
        return;
      }
      const { error } = await supabase
        .from('citas')
        .update({
          estado:             'Reprogramada',
          inicio_propuesto:   toUTC(libre.inicio),
          fin_propuesto:      toUTC(libre.fin),
        })
        .eq('id', entryActual.id);

      if (error) { console.error('Error reprogramando:', error); return; }

      const color = ESTADO_COLOR['Reprogramada'];
      if (entryActual.citaCliente) {
        entryActual.citaCliente.estado          = 'Reprogramada';
        entryActual.citaCliente.inicioPropuesto = libre.inicio;
        entryActual.citaCliente.finPropuesto    = libre.fin;
      }
      entryActual.color = color;

      if (fcEventActual) {
        fcEventActual.setProp('title', `🔄 ${entryActual.titulo}`);
        fcEventActual.setProp('backgroundColor', color);
        fcEventActual.setProp('borderColor', color);
      }
      if (entryActual.fcEventCliente) {
        entryActual.fcEventCliente.setProp('backgroundColor', color);
        entryActual.fcEventCliente.setProp('borderColor', color);
      }

      renderSidebarAdmin();
      renderSidebarCliente();
      cerrarModales();
      return;
    }

    // — Supabase: actualizar estado —
    const { error } = await supabase
      .from('citas')
      .update({ estado: nuevoEstado })
      .eq('id', entryActual.id);

    if (error) { console.error('Error actualizando estado:', error); return; }

    const msgEl = document.getElementById('detalle-conflicto');
    msgEl.textContent = ''; msgEl.classList.remove('visible');

    const color = ESTADO_COLOR[nuevoEstado];
    if (entryActual.citaCliente) entryActual.citaCliente.estado = nuevoEstado;
    entryActual.color = color;

    if (fcEventActual) {
      const prefijo = nuevoEstado === 'Confirmada' ? '✅' : '❌';
      fcEventActual.setProp('title', `${prefijo} ${entryActual.titulo} · ${entryActual.paciente?.nombre || ''}`);
      fcEventActual.setProp('backgroundColor', color);
      fcEventActual.setProp('borderColor', color);
    }
    if (entryActual.fcEventCliente) {
      entryActual.fcEventCliente.setProp('backgroundColor', color);
      entryActual.fcEventCliente.setProp('borderColor', color);
    }

    renderSidebarAdmin();
    renderSidebarCliente();
    cerrarModales();
  }

  btnConfirmar.addEventListener('click', () => aplicarDecision('Confirmada'));
  btnRechazar.addEventListener('click',  () => aplicarDecision('Rechazada'));
  document.getElementById('btn-reprogramar').addEventListener('click', () => aplicarDecision('Reprogramada'));
  document.getElementById('modal-detalle-cerrar').addEventListener('click', cerrarModales);

  /* ══════════════════════════════════════════════════════════
     OVERLAY / CERRAR MODALES
  ══════════════════════════════════════════════════════════ */
  function abrirOverlay(modal) {
    overlay.classList.add('visible');
    modal.classList.add('visible');
  }

  function cerrarModales() {
    overlay.classList.remove('visible');
    document.querySelectorAll('[role="dialog"]').forEach(m => m.classList.remove('visible'));
    limpiarPaciente();
    cerrarFormNuevoPaciente();
  }

  overlay.addEventListener('click', cerrarModales);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarModales(); });
  document.querySelectorAll('.modal-cerrar-btn').forEach(btn =>
    btn.addEventListener('click', cerrarModales)
  );

  /* ══════════════════════════════════════════════════════════
     SWITCH DE MODO
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
  await cargarDatos();

  window.agregarEvento      = agregarEvento;
  window.agregarCitaCliente = agregarCitaCliente;

});