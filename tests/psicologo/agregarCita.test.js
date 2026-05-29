import { describe, it, expect, vi, beforeEach } from 'vitest';
import { agregarCita } from '../../src/psicologo/agregarCita';
import supabase from '../../src/services/supabase.js';

const singleMock = vi.fn();

vi.mock('../../src/services/supabase.js', () => ({
  default: {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: singleMock,
        })),
      })),
    })),
  },
}));

describe('agregarCita', () => {
  let calAdmin;

  beforeEach(() => {
    calAdmin = {
      addEvent: vi.fn(),
    };

    vi.clearAllMocks();

    singleMock.mockResolvedValue({
      data: {
        id: 1,
      },
      error: null,
    });
  });

  it('debería bloquear horarios fuera del rango permitido', async () => {
    const resultado = await agregarCita(
      'Consulta psicológica',
      null,
      '2026-05-28T22:00:00',
      '2026-05-28T23:00:00',
      '#22c55e',
      'Descripción',
      false,
      calAdmin
    );

    expect(resultado).toBeNull();

    expect(supabase.from).not.toHaveBeenCalled();

  });

  it('debería permitir citas exactamente a las 20:00', async () => {
    const resultado = await agregarCita(
      'Consulta psicológica',
      null,
      '2026-05-28T20:00:00',
      '2026-05-28T21:00:00',
      '#22c55e',
      'Descripción',
      false,
      calAdmin
    );

    expect(resultado).not.toBeNull();

    expect(supabase.from).toHaveBeenCalled();

   
  });
});