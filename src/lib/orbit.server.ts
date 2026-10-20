// Llamadas a Orbit (DeepSeek 4.1 Flash, API estilo OpenAI). Solo se usa desde funciones de servidor.
export type OrbitMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: OrbitToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };
export interface OrbitToolCall { id: string; type: 'function'; function: { name: string; arguments: string } }
export interface OrbitTool { type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> } }

const URL_ORBIT = 'https://orbit.dev.core.axmos.tech/api/chat/completions';
/** Modelos de Orbit en orden de preferencia: si DeepSeek falla (límite de uso, error, respuesta inválida), se reintenta con GLM 5.3. */
export const MODELOS = ['deepseek-v4.1-flash', 'glm-5.3'] as const;
export type ModeloOrbit = (typeof MODELOS)[number];
const nombreModelo: Record<ModeloOrbit, string> = { 'deepseek-v4.1-flash': 'DeepSeek 4.1 Flash', 'glm-5.3': 'GLM 5.3' };

interface Opciones { tools?: OrbitTool[]; temperature?: number; timeoutMs?: number; modelos?: readonly ModeloOrbit[]; /** Tiempo total máximo de la llamada con reintentos; al agotarse no se prueban más modelos. */ presupuestoMs?: number }

async function llamarModelo(modelo: ModeloOrbit, messages: OrbitMessage[], opts: Opciones) {
  const key = process.env['ORBIT_API_KEY'];
  if (!key) throw new Error('La conexión con Orbit aún no está configurada.');
  let response: Response;
  try {
    response = await fetch(URL_ORBIT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelo, stream: false, messages, temperature: opts.temperature ?? 0.1, ...(opts.tools?.length ? { tools: opts.tools, tool_choice: 'auto' } : {}) }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 180000),
    });
  } catch (e) {
    throw new Error(e instanceof Error && e.name === 'TimeoutError' ? `${nombreModelo[modelo]} tardó demasiado en responder.` : `No se pudo conectar con ${nombreModelo[modelo]}.`);
  }
  if (!response.ok) {
    const body = await response.text();
    if (response.status === 429 || /RateLimit|Too many requests/i.test(body)) throw new Error(`${nombreModelo[modelo]} alcanzó temporalmente su límite de uso.`);
    if (response.status === 401 || response.status === 403) throw new Error(`Orbit rechazó el acceso a ${nombreModelo[modelo]}. Revisa los permisos de la clave.`);
    throw new Error(`${nombreModelo[modelo]} no pudo responder (${response.status}).`);
  }
  const payload = (await response.json()) as { choices?: { message?: { content?: string | null; tool_calls?: OrbitToolCall[] } }[] };
  const message = payload.choices?.[0]?.message;
  if (!message) throw new Error(`${nombreModelo[modelo]} no entregó respuesta.`);
  return { content: message.content ?? '', toolCalls: message.tool_calls ?? [], modelo };
}

/** Prueba cada modelo en orden y devuelve la primera respuesta que pase `validar` (si se entrega). */
async function conRespaldo<T>(messages: OrbitMessage[], opts: Opciones, validar: (r: Awaited<ReturnType<typeof llamarModelo>>) => T) {
  const errores: string[] = [];
  const inicio = Date.now();
  const queda = () => (opts.presupuestoMs ?? Infinity) - (Date.now() - inicio);
  for (const modelo of opts.modelos ?? MODELOS) {
    // Un corte del gateway (502/503/504) suele ser pasajero: se reintenta una vez el mismo modelo.
    for (let intento = 0; intento < 2; intento++) {
      if (queda() < 15000) { errores.push('Se agotó el tiempo para esta parte.'); break; }
      try {
        const r = await llamarModelo(modelo, messages, { ...opts, timeoutMs: Math.min(opts.timeoutMs ?? 180000, queda()) });
        return { ...r, valor: validar(r) };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn(`[orbit] ${modelo} falló (intento ${intento + 1}): ${msg}`);
        if (intento === 0 && /\((502|503|504)\)/.test(msg)) { await new Promise((ok) => setTimeout(ok, 1500)); continue; }
        errores.push(msg);
        break;
      }
    }
  }
  throw new Error(errores.length > 1 ? `Orbit no pudo responder con ningún modelo. ${errores.join(' ')} Vuelve a intentarlo en unos minutos.` : `${errores[0] ?? 'Orbit no respondió.'} Vuelve a intentarlo.`);
}

export async function callOrbit(messages: OrbitMessage[], opts: Opciones = {}) {
  const r = await conRespaldo(messages, opts, () => undefined);
  return { content: r.content, toolCalls: r.toolCalls, modelo: r.modelo };
}

/** Para extracciones: si un modelo responde con JSON inválido o que no cumple el esquema, se prueba el siguiente. */
export async function callOrbitJson<T>(messages: OrbitMessage[], parse: (data: unknown) => T, opts: Opciones = {}) {
  const r = await conRespaldo(messages, opts, ({ content, modelo }) => {
    try { return parse(parseJson(content)); }
    catch { throw new Error(`${nombreModelo[modelo]} respondió con un formato inválido.`); }
  });
  return { data: r.valor, modelo: r.modelo };
}

/** Orden de modelos que parte por el que ya funcionó en esta conversación. */
export const preferir = (modelo: ModeloOrbit) => [modelo, ...MODELOS.filter((m) => m !== modelo)];

export function parseJson(content: string): unknown {
  try { return JSON.parse(content.replace(/^\s*```(?:json)?\s*/, '').replace(/\s*```\s*$/, '')); }
  catch { throw new Error('Orbit entregó una respuesta inválida. Vuelve a procesar el documento.'); }
}
