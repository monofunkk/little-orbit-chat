import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { listaNumerada, idsDesdeNumeros, filtrarSeleccion } from '@/lib/seleccion';
import type { ChecklistItem } from '@/lib/domain';

vi.mock('@/lib/seleccion.functions', () => ({ sugerirItemsAuditoria: vi.fn(async () => ({ itemIds: ['b'] })) }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const item = (id: string, descripcion: string, origen: ChecklistItem['origen'], categoria: ChecklistItem['categoria'] = 'Ambiental'): ChecklistItem => ({ id, rcaId: 'r', descripcion, categoria, evidencia: 'Documental', referencia: `p. ${id}`, origen });
const items = [item('a', 'Autocontrol mensual del RIL', 'RCA'), item('b', 'Declarar en SIDREP cada retiro de residuos peligrosos', 'Normativa', 'Documental'), item('c', 'Nuevo estanque de oxígeno', 'Pertinencia', 'Operacional')];

describe('selección de ítems', () => {
  it('numera el checklist y marca lo ya elegido', () => {
    const l = listaNumerada(items, new Set(['b'])).split('\n');
    expect(l[0]).toMatch(/^1\. \[ \] Autocontrol/);
    expect(l[1]).toMatch(/^2\. \[x\] Declarar en SIDREP/);
  });
  it('convierte números de Orbit en ids e ignora números fuera de rango', () => {
    expect(idsDesdeNumeros(items, [3, 1, 1, 99, 0])).toEqual(['a', 'c']);
  });
  it('filtra la selección en el orden del checklist', () => {
    expect(filtrarSeleccion(items, ['c', 'a']).map((x) => x.id)).toEqual(['a', 'c']);
    expect(filtrarSeleccion(items, undefined)).toHaveLength(3);
  });
});

describe('selector en Nueva auditoría', () => {
  async function montar() {
    const { SelectorItems } = await import('@/components/selector-items');
    function Prueba() { const [s, setS] = useState(new Set(items.map((x) => x.id))); return <SelectorItems inst="00000000-0000-4000-8000-000000000000" items={items} seleccion={s} onChange={setS} />; }
    return render(<Prueba />);
  }

  it('marca y desmarca a mano, y filtra por búsqueda', async () => {
    await montar();
    expect(screen.getByText(/de 3 seleccionados/).textContent).toMatch(/^3 de 3/);
    fireEvent.click(screen.getByRole('checkbox', { name: /SIDREP/ }));
    expect(screen.getByText(/de 3 seleccionados/).textContent).toMatch(/^2 de 3/);
    fireEvent.change(screen.getByLabelText('Buscar ítems'), { target: { value: 'oxigeno' } });
    expect(screen.queryByText(/Autocontrol mensual/)).toBeNull();
    expect(screen.getByText(/Nuevo estanque de oxígeno/)).toBeTruthy();
  });

  it('Orbit solo marca ítems: muestra el pedido y cuántos quedaron, sin explicación', async () => {
    await montar();
    fireEvent.change(screen.getByLabelText('Pedido para Orbit'), { target: { value: 'solo residuos peligrosos' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pedir a Orbit' }));
    await waitFor(() => expect(screen.getByText(/de 3 seleccionados/).textContent).toMatch(/^1 de 3/));
    expect(screen.getByText('solo residuos peligrosos')).toBeTruthy();
    expect(screen.getByText('1 ítem')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: /SIDREP/ })).toHaveProperty('checked', true);
    expect(screen.getByRole('checkbox', { name: /Solo marcados/ })).toHaveProperty('checked', true);
  });
});
