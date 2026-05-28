export const overlay = document.getElementById('modal-overlay');

export function abrirOverlay(modal) {
  overlay.classList.add('visible');
  modal.classList.add('visible');
}

export function cerrarModales() {
  overlay.classList.remove('visible');
  document.querySelectorAll('[role="dialog"]').forEach(m => m.classList.remove('visible'));
  // Estas funciones se inyectan desde los módulos que las definen (evita dependencia circular)
  cerrarModales._hooks.forEach(fn => fn());
}

cerrarModales._hooks = [];

/** Registra un callback que se ejecuta cada vez que se cierran los modales */
export function onCerrarModales(fn) {
  cerrarModales._hooks.push(fn);
}

// Listeners globales de cierre
overlay.addEventListener('click', cerrarModales);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarModales(); });
document.querySelectorAll('.modal-cerrar-btn').forEach(btn =>
  btn.addEventListener('click', cerrarModales)
);