import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { fragmentar } from './fragmentos';

/** Guarda el texto de un documento (RCA, pertinencia o evidencia) en fragmentos buscables por el agente. Reemplaza la versión anterior. */
export const indexarDocumento = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    instalacionId: z.string().uuid(),
    tipo: z.enum(['rca', 'pertinencia', 'evidencia']),
    documentoId: z.string().uuid(),
    nombre: z.string().trim().min(1).max(300),
    paginas: z.array(z.string().max(40000)).max(1500),
  }))
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    const borrado = await db.from('documento_fragmentos').delete().eq('documento_id', data.documentoId);
    if (borrado.error) throw new Error('No se pudo actualizar el índice del documento.');
    const filas = fragmentar(data.paginas).map((f) => ({ instalacion_id: data.instalacionId, documento_tipo: data.tipo, documento_id: data.documentoId, nombre: data.nombre, pagina: f.pagina, orden: f.orden, contenido: f.contenido }));
    for (let i = 0; i < filas.length; i += 400) {
      const r = await db.from('documento_fragmentos').insert(filas.slice(i, i + 400));
      if (r.error) throw new Error('No se pudo indexar el documento para el asistente.');
    }
    return { fragmentos: filas.length };
  });
