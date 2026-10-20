import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { cargarSnapshot } from './audit.functions';
import type { AccionPropuesta, AccesoDocumentos } from './agente/herramientas';
import { sanear } from './agente/texto';

const mensajesSchema = z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(8000) })).min(1).max(40);
const MAX_RONDAS = 6;

function hoyChile() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function sistema(nombre: string, rol: string, hoy: string) {
  return `Eres Orbit, el asistente interno de Invermar Audit, una plataforma de cumplimiento ambiental y sectorial por instalación (piscicultura, centro de cultivo en mar, planta de proceso y empresa). Hoy es ${hoy} (hora de Chile). Hablas con ${nombre}, rol ${rol}.
Reglas:
- Responde en español de Chile, breve, claro y con tono profesional sobrio, para alguien que no es experto en software.
- Nunca uses signos de exclamación (ni ¡ ni !) ni emojis. No saludes de forma efusiva.
- Formato: párrafos cortos; usa listas con guiones solo cuando enumeres varias cosas y **negrita** solo para resaltar un dato clave. Sin tablas ni títulos.
- Para cualquier dato de la plataforma usa las herramientas; nunca inventes instalaciones, requisitos, porcentajes ni fechas. Si una herramienta devuelve error, explícalo en palabras simples.
- Para preguntas sobre lo que dicen los documentos (RCA, pertinencias, evidencias), usa buscar_en_documentos y, si necesitas contexto, leer_pagina. Responde solo con lo que dicen los fragmentos y cita siempre el documento y la página, por ejemplo (RCA 202410001185, p. 52). Si no encuentras nada tras probar otros términos, dilo.
- Cuando cites un requisito, indica su origen (RCA, normativa o pertinencia) y su referencia.
- Las acciones que cambian datos (crear, editar o eliminar instalaciones y asignar auditorías) solo se proponen: la persona las confirma con un botón. Di que quedó lista para confirmar; no digas que ya se hizo.
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
    const db = context.supabase;
    const docs: AccesoDocumentos = {
      buscar: async (consulta, instalacionId) => {
        const r = await db.rpc('buscar_fragmentos', { consulta, limite: 8, ...(instalacionId ? { inst: instalacionId } : {}) });
        if (r.error) throw new Error('No se pudo buscar en los documentos.');
        return r.data ?? [];
      },
      pagina: async (documentoId, pagina) => {
        const r = await db.from('documento_fragmentos').select('documento_id,documento_tipo,instalacion_id,nombre,pagina,contenido').eq('documento_id', documentoId).eq('pagina', pagina).order('orden');
        if (r.error) throw new Error('No se pudo leer el documento.');
        return r.data ?? [];
      },
    };
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
      const contexto = await ejecutarHerramienta('resumen_cumplimiento', '{}', { data: snapshot, hoy, docs });
      const r = await callOrbit([{ role: 'system', content: `${mensajes[0]!.content as string}\nDatos actuales de la plataforma (JSON): ${JSON.stringify(contexto)}` }, ...data.mensajes], { temperature: 0.2, timeoutMs: 90000 });
      return { respuesta: sanear(r.content || 'No tengo una respuesta para eso.'), herramientas: ['resumen_cumplimiento'], acciones };
    }

    for (let ronda = 0; ronda < MAX_RONDAS && resp.toolCalls.length; ronda++) {
      mensajes.push({ role: 'assistant', content: resp.content || null, tool_calls: resp.toolCalls });
      for (const call of resp.toolCalls) {
        const salida = await ejecutarHerramienta(call.function.name, call.function.arguments, { data: snapshot, hoy, docs });
        usadas.push(call.function.name);
        if ('resultado' in salida && salida.resultado && typeof salida.resultado === 'object' && 'accion' in salida.resultado) acciones.push((salida.resultado as { accion: AccionPropuesta }).accion);
        mensajes.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(salida).slice(0, 24000) });
      }
      resp = await callOrbit(mensajes, { tools, temperature: 0.2, timeoutMs: 90000 });
    }
    return { respuesta: sanear(resp.content || (acciones.length ? 'Dejé la acción lista para que la confirmes.' : 'No tengo una respuesta para eso.')), herramientas: [...new Set(usadas)], acciones };
  });
