import { describe, it, expect, vi, beforeEach } from 'vitest';
import { agregarCitaCliente } from '../../src/cliente/citas.js';
import supabase from '../../src/services/supabase.js';

vi.mock('../../src/services/supabase.js', () => ({
  default: {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
    })),
  },
}));

vi.mock('../../src/psicologo/sidebar.js', () => ({ renderSidebarAdmin: vi.fn() }));
vi.mock('../../src/cliente/sidebar.js',   () => ({ renderSidebarCliente: vi.fn() }));

describe('HU-02 agregar tests para Validacion de citas fuera de horario laboral', () => {
  let calAdmin, calCliente;

  beforeEach(() => {
    calAdmin   = { addEvent: vi.fn() };
    calCliente = { addEvent: vi.fn() };
    vi.clearAllMocks();
  });

  it('deberia bloquear una cita agendada el dia sabado', async () => {
    const resultado = await agregarCitaCliente(
      { motivo: 'Consulta 1', inicio: '2026-06-20T10:00', fin: '2026-06-20T11:00', notas: 'Cita 1 xd' },
      calAdmin, calCliente
    );

    expect(resultado).toBeNull();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('debería bloquear una cita agendada en domingo', async () => {
    const resultado = await agregarCitaCliente(
      { motivo: 'Consulta 2', inicio: '2026-06-21T10:00', fin: '2026-06-21T11:00', notas: 'Cita 2 xd' },
      calAdmin, calCliente
    );

    expect(resultado).toBeNull();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('debería bloquear una cita con inicio antes de las 09:00', async () => {
    const resultado = await agregarCitaCliente(
      { motivo: 'Consulta 3', inicio: '2026-06-15T08:00', fin: '2026-06-15T09:00', notas: 'Cita 3 xd' },
      calAdmin, calCliente
    );

    expect(resultado).toBeNull();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('debería bloquear una cita con inicio después de las 20:00', async () => {
    const resultado = await agregarCitaCliente(
      { motivo: 'Consulta 3', inicio: '2026-06-15T21:00', fin: '2026-06-15T22:00', notas: 'Cita 4 xd' },
      calAdmin, calCliente
    );

    expect(resultado).toBeNull();
    expect(supabase.from).not.toHaveBeenCalled();
  });
});

describe('HU-02 test para validacion de campos obligatorios al solicitar cita', () => {
  let calAdmin, calCliente;

  beforeEach(() => {
    calAdmin   = { addEvent: vi.fn() };
    calCliente = { addEvent: vi.fn() };
    vi.clearAllMocks();
  });

  it('HU-02 debería bloquear la solicitud si todos los campos obligatorios están vacíos', async () => {
    const resultado = await agregarCitaCliente(
      { motivo: '', inicio: '2026-06-15T10:00', fin: '2026-06-15T11:00', notas: '' },
      calAdmin, calCliente
    );

    expect(resultado).toBeNull();
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
