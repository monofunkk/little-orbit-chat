import type { ChecklistItem } from './domain';

/** Lista numerada y compacta del checklist para que Orbit elija ítems por número. */
export function listaNumerada(items: ChecklistItem[], seleccion: ReadonlySet<string>) {
  return items.map((x, i) => `${i + 1}. [${seleccion.has(x.id) ? 'x' : ' '}] ${x.descripcion.replace(/\s+/g, ' ').slice(0, 220)} | ${x.origen ?? 'RCA'} | ${x.categoria} | evidencia ${x.evidencia.toLowerCase()} | ${x.referencia.slice(0, 80)}${x.fuente ? ` | ${x.fuente.slice(0, 60)}` : ''}`).join('\n');
}

/** Convierte los números que eligió Orbit en ids, sin repetir y respetando el orden del checklist. */
export function idsDesdeNumeros(items: ChecklistItem[], numeros: number[]) {
  const set = new Set(numeros.filter((n) => Number.isInteger(n) && n >= 1 && n <= items.length));
  return items.filter((_, i) => set.has(i + 1)).map((x) => x.id);
}

/** Ítems elegidos en el orden del checklist; ignora ids que no pertenecen a él. */
export function filtrarSeleccion(items: ChecklistItem[], ids: readonly string[] | undefined) {
  if (!ids) return items;
  const set = new Set(ids);
  return items.filter((x) => set.has(x.id));
}
