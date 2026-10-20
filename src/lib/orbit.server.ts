// Llamadas a Orbit (DeepSeek 4.1 Flash, API estilo OpenAI). Solo se usa desde funciones de servidor.
export type OrbitMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: OrbitToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };
export interface OrbitToolCall { id: string; type: 'function'; function: { name: string; arguments: string } }
export interface OrbitTool { type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> } }

const URL_ORBIT = 'https://orbit.dev.core.axmos.tech/api/chat/completions';
const MODELO = 'deepseek-v4.1-flash';

export async function callOrbit(messages: OrbitMessage[], opts: { tools?: OrbitTool[]; temperature?: number; timeoutMs?: number } = {}) {
  const key = process.env['ORBIT_API_KEY'];
  if (!key) throw new Error('La conexión con Orbit aún no está configurada.');
  const response = await fetch(URL_ORBIT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODELO, stream: false, messages, temperature: opts.temperature ?? 0.1, ...(opts.tools?.length ? { tools: opts.tools, tool_choice: 'auto' } : {}) }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 180000),
  });
  if (!response.ok) {
    const body = await response.text();
    if (response.status === 429 || /RateLimit|Too many requests/i.test(body)) throw new Error('Orbit alcanzó temporalmente su límite de uso. Espera un momento y vuelve a intentarlo.');
    if (response.status === 401 || response.status === 403) throw new Error('Orbit rechazó el acceso. Revisa que la clave tenga permiso para DeepSeek 4.1 Flash.');
    throw new Error(`Orbit no pudo responder (${response.status}). Vuelve a intentarlo.`);
  }
  const payload = (await response.json()) as { choices?: { message?: { content?: string | null; tool_calls?: OrbitToolCall[] } }[] };
  const message = payload.choices?.[0]?.message;
  if (!message) throw new Error('Orbit no entregó respuesta.');
  return { content: message.content ?? '', toolCalls: message.tool_calls ?? [] };
}

export function parseJson(content: string): unknown {
  try { return JSON.parse(content.replace(/^\s*```(?:json)?\s*/, '').replace(/\s*```\s*$/, '')); }
  catch { throw new Error('Orbit entregó una respuesta inválida. Vuelve a procesar el documento.'); }
}
