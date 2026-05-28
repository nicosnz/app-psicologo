import { HORA_MAX } from '../shared/config.js';
import { corregirDatetime } from '../shared/fecha.js';

/**
 * Enlaza restricciones de horario laboral a un par de inputs datetime-local.
 * Devuelve { mostrar, limpiar } para uso externo.
 */
export function bindInputRestricciones(inputI, inputF, errorEl) {
  function mostrar(msg) { errorEl.textContent = msg; errorEl.classList.add('visible'); }
  function limpiar()    { errorEl.textContent = ''; errorEl.classList.remove('visible'); }

  inputI.addEventListener('change', () => {
    limpiar();
    if (!inputI.value) return;
    const c = corregirDatetime(inputI.value);
    if (c !== inputI.value) { inputI.value = c; mostrar('Horario ajustado al rango laboral (08:00–20:00, lun–vie).'); }
    const fecha  = inputI.value.slice(0, 10);
    const maxStr = `${fecha}T${String(HORA_MAX).padStart(2, '0')}:00`;
    inputI.max = maxStr; inputF.max = maxStr; inputF.min = inputI.value;
    if (!inputF.value || inputF.value <= inputI.value) {
      const d = new Date(inputI.value);
      d.setHours(d.getHours() + 1);
      if (d.getHours() > HORA_MAX || (d.getHours() === HORA_MAX && d.getMinutes() > 0)) d.setHours(HORA_MAX, 0);
      inputF.value = `${fecha}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
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