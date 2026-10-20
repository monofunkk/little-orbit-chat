import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { cargarSnapshot } from './audit.functions';
import type { AccionPropuesta } from './agente/herramientas';

const mensajesSchema = z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(8000) })).min(1).max(40);
const MAX_RONDAS = 6;

function hoyChile() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function sistema(nombre: string, rol: string, hoy: string) {
  return `Eres Orbit, el asistente interno de Invermar Audit, una plataforma de cumplimiento ambiental y sectorial por instalación (piscicultura, centro de cultivo en mar, planta de proceso y empresa). Hoy es ${hoy} (hora de Chile). Hablas con ${nombre}, rol ${rol}.
Reglas:
- Responde en español de Chile, breve y claro, para alguien que no es experto en software.
- Para cualquier dato de la plataforma usa las herramientas; nunca inventes instalaciones, requisitos, porcentajes ni fechas. Si una herramienta devuelve error, explícalo en palabras simples.
- Cuando cites un requisito, indica su origen (RCA, normativa o pertinencia) y su referencia.
- Las acciones que cambian datos (crear instalación, asignar auditoría) solo se proponen: la persona las confirma con un botón. Di que quedó lista para confirmar; no digas que ya se hizo.
- El color del semáforo lo calculan reglas fijas (verde 85% o más, amarillo 60 a 84%, rojo menos de 60%); no lo decidas tú.
- Si falta un dato para usar una herramienta (por ejemplo la fecha límite), pregúntalo.`;
}

export interface RespuestaAgente { respuesta: string; herramientas: string[]; acciones: AccionPropuesta[] }

export const chatAgente = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ mensajes: mensajesSchema }))
  .handler(async ({ data, context }): Promise<RespuestaAgente> => {
    const [{ callOrbit }, { herramientasPara, ejecutarHerramienta }] = await Promise.all([import('./orbit.server'), import('./agente/herramientas')]);
    type Msg = Parameters<typeof callOrbit>[0][number];
    const snapshot = await cargarSnapshot(context.supabase, context.userId);
    const hoy = hoyChile();
    const tools = herramientasPara(snapshot.rol).map((h) => ({ type: 'function' as const, function: { name: h.name, description: h.description, parameters: h.inputSchema } }));
    const mensajes: Msg[] = [{ role: 'system', content: sistema(snapshot.nombre, snapshot.rol === 'admin' ? 'administrador' : 'supervisor', hoy) }, ...data.mensajes];
    const usadas: string[] = [];
    const acciones: AccionPropuesta[] = [];

    let resp: Awaited<ReturnType<typeof callOrbit>>;
    try {
      resp = await callOrbit(mensajes, { tools, temperature: 0.2, timeoutMs: 90000 });
    } catch (e) {
      // Si el modelo no acepta herramientas, responde con un resumen de la plataforma como contexto.
      if (!(e instanceof Error) || !/\(400\)/.test(e.message)) throw e;
      const contexto = ejecutarHerramienta('resumen_cumplimiento', '{}', { data: snapshot, hoy });
      const r = await callOrbit([{ role: 'system', content: `${mensajes[0]!.content as string}\nDatos actuales de la plataforma (JSON): ${JSON.stringify(contexto)}` }, ...data.mensajes], { temperature: 0.2, timeoutMs: 90000 });
      return { respuesta: r.content || 'No tengo una respuesta para eso.', herramientas: ['resumen_cumplimiento'], acciones };
    }

    for (let ronda = 0; ronda < MAX_RONDAS && resp.toolCalls.length; ronda++) {
      mensajes.push({ role: 'assistant', content: resp.content || null, tool_calls: resp.toolCalls });
      for (const call of resp.toolCalls) {
        const salida = ejecutarHerramienta(call.function.name, call.function.arguments, { data: snapshot, hoy });
        usadas.push(call.function.name);
        if ('resultado' in salida && salida.resultado && typeof salida.resultado === 'object' && 'accion' in salida.resultado) acciones.push((salida.resultado as { accion: AccionPropuesta }).accion);
        mensajes.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(salida).slice(0, 24000) });
      }
      resp = await callOrbit(mensajes, { tools, temperature: 0.2, timeoutMs: 90000 });
    }
    return { respuesta: resp.content || (acciones.length ? 'Dejé la acción lista para que la confirmes.' : 'No tengo una respuesta para eso.'), herramientas: [...new Set(usadas)], acciones };
  });
