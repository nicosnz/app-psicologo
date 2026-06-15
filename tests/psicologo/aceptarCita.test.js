import { describe, it, expect } from 'vitest';
import { detectarConflictoParaConfirmar } from '../../src/psicologo/decision.js';

describe('HU-03 validar horario laboral al confirmar cita', () => {

  it('no debería confirmar una cita en domingo', () => {
    const entry = { inicio: '2026-06-21T10:00', fin: '2026-06-21T11:00', esSolicitudCliente: false };

    const resultado = detectarConflictoParaConfirmar(entry, [entry]);

    expect(resultado).not.toBeNull();
  });

  it('no debería confirmar una cita en sábado', () => {
    const entry = { inicio: '2026-06-20T10:00', fin: '2026-06-20T11:00', esSolicitudCliente: false };

    const resultado = detectarConflictoParaConfirmar(entry, [entry]);

    expect(resultado).not.toBeNull();
  });

  it('no debería confirmar una cita con inicio antes de las 09:00', () => {
    const entry = { inicio: '2026-06-15T08:00', fin: '2026-06-15T09:00', esSolicitudCliente: false };

    const resultado = detectarConflictoParaConfirmar(entry, [entry]);

    expect(resultado).not.toBeNull();
  });

  it('no debería confirmar una cita con inicio después de las 21:00', () => {
    const entry = { inicio: '2026-06-15T22:00', fin: '2026-06-15T23:00', esSolicitudCliente: false };

    const resultado = detectarConflictoParaConfirmar(entry, [entry]);

    expect(resultado).not.toBeNull();
  });

  it('debería permitir confirmar una cita válida en horario laboral', () => {
    const entry = { inicio: '2026-06-15T10:00', fin: '2026-06-15T11:00', esSolicitudCliente: false };

    const resultado = detectarConflictoParaConfirmar(entry, [entry]);

    expect(resultado).toBeNull();
  });
});
