import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { callOrbit, callOrbitJson, preferir } from '@/lib/orbit.server';

const respuesta = (content: string) => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
const modeloDe = (init?: RequestInit) => (JSON.parse(String(init?.body)) as { model: string }).model;

describe('respaldo de modelos en Orbit', () => {
  beforeEach(() => { process.env['ORBIT_API_KEY'] = 'sk-prueba'; vi.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => { vi.restoreAllMocks(); delete process.env['ORBIT_API_KEY']; });

  it('si DeepSeek llega a su límite, responde GLM 5.3', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => (modeloDe(init) === 'deepseek-v4.1-flash' ? new Response('Too many requests', { status: 429 }) : respuesta('hola desde glm')));
    const r = await callOrbit([{ role: 'user', content: 'hola' }]);
    expect(r).toMatchObject({ content: 'hola desde glm', modelo: 'glm-5.3' });
    expect(fetchMock.mock.calls.map(([, init]) => modeloDe(init))).toEqual(['deepseek-v4.1-flash', 'glm-5.3']);
  });

  it('si DeepSeek entrega JSON inválido al leer un PDF, se usa GLM 5.3', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => respuesta(modeloDe(init) === 'deepseek-v4.1-flash' ? 'Lo siento, no puedo' : '```json\n{"items":[1,2]}\n```'));
    const r = await callOrbitJson([{ role: 'user', content: 'pdf' }], (d) => (d as { items: number[] }).items);
    expect(r).toEqual({ data: [1, 2], modelo: 'glm-5.3' });
  });

  it('si ambos fallan, explica qué pasó con cada modelo', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('error', { status: 500 }));
    await expect(callOrbit([{ role: 'user', content: 'hola' }])).rejects.toThrow(/DeepSeek 4\.1 Flash no pudo responder \(500\).*GLM 5\.3 no pudo responder \(500\)/);
  });

  it('mantiene primero el modelo que ya funcionó', () => {
    expect(preferir('glm-5.3')).toEqual(['glm-5.3', 'deepseek-v4.1-flash']);
  });
});
