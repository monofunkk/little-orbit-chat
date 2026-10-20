import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { cargarSnapshot } from './audit.functions';
import { checklistInstalacion, tipoLabel } from './domain';
import { listaNumerada, idsDesdeNumeros } from './seleccion';

/** Minichat de "Nueva auditoría": Orbit elige qué ítems del checklist auditar según lo que pide la persona. */
export const sugerirItemsAuditoria = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    inst: z.string().uuid(),
    pedido: z.string().trim().min(2).max(1000),
    historial: z.array(z.string().max(1000)).max(12).default([]),
    seleccion: z.array(z.string()).max(2000).default([]),
  }))
  .handler(async ({ data, context }) => {
    const snap = await cargarSnapshot(context.supabase, context.userId);
    if (snap.rol !== 'admin') throw new Error('Solo administradores.');
    const inst = snap.instalaciones.find((i) => i.id === data.inst);
    if (!inst) throw new Error('Instalación no encontrada.');
    const items = checklistInstalacion(snap.rcas.find((r) => r.instalacionId === inst.id), snap.pertinencias);
    if (!items.length) throw new Error('Esta instalación no tiene un checklist confirmado.');
    const hoy = new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', dateStyle: 'long' }).format(new Date());
    const previas = snap.auditorias.filter((a) => a.instalacionId === inst.id && a.estado === 'Aprobada');
    const incumplidos = new Set(previas.flatMap((a) => a.items.filter((_, n) => a.respuestas[n] === 'no_cumple').map((x) => x.descripcion)));
    const sistema = `Eres Orbit, el asistente de auditorías de Invermar Audit. Ayudas a elegir qué ítems del checklist de "${inst.nombre}" (${tipoLabel[inst.tipo]}) entran en una nueva auditoría. Hoy es ${hoy}.
Checklist (número. [x] si ya está seleccionado | descripción | origen | categoría | evidencia | referencia | nota):
${listaNumerada(items, new Set(data.seleccion))}
${incumplidos.size ? `\nÍtems que salieron "no cumple" en auditorías aprobadas anteriores:\n${[...incumplidos].slice(0, 30).map((d) => `- ${d.slice(0, 160)}`).join('\n')}\n` : ''}
Reglas:
- Devuelve la selección COMPLETA resultante (no solo los cambios), aplicando lo que pide la persona sobre la selección actual: si pide "agrega" o "saca", parte de los marcados con [x]; si pide algo nuevo, reemplaza.
- Elige solo números de la lista. No inventes ítems.
- No expliques nada: responde SOLO JSON {"seleccion":[números]}`;
    const { callOrbitJson } = await import('./orbit.server');
    const r = await callOrbitJson(
      [{ role: 'system', content: sistema }, { role: 'user', content: data.historial.length ? `Pedidos anteriores (ya aplicados en los [x]): ${data.historial.join(' / ')}\n\nNuevo pedido: ${data.pedido}` : data.pedido }],
      (d) => z.object({ seleccion: z.array(z.number()) }).parse(d),
      { timeoutMs: 60000, temperature: 0.1, presupuestoMs: 90000 },
    );
    return { itemIds: idsDesdeNumeros(items, r.data.seleccion.map(Math.round)) };
  });
