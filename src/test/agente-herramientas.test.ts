import { describe, expect, it } from 'vitest';
import { ejecutarHerramienta, herramientasPara } from '@/lib/agente/herramientas';
import { normativaPorTipo, itemsNormativos } from '@/lib/normativa';
import { checklistInstalacion, tiposInstalacion, type Snapshot, type ChecklistItem } from '@/lib/domain';

const item = (id: string, rcaId: string, descripcion: string, origen: ChecklistItem['origen']): ChecklistItem => ({ id, rcaId, descripcion, categoria: 'Ambiental', evidencia: 'Documental', referencia: 'p.1', origen });
const base = (rol: Snapshot['rol']): Snapshot => ({
  rol, nombre: 'Dahir Pérez', userId: 'u1',
  instalaciones: [
    { id: 'i1', nombre: 'Piscicultura Aucha', tipo: 'piscicultura', ubicacion: 'Calbuco', rcas: 1, pertinencias: 1, ultimoPct: 80 },
    { id: 'i2', nombre: 'Invermar S.A.', tipo: 'empresa', ubicacion: '', rcas: 0, pertinencias: 0, ultimoPct: null },
  ],
  rcas: [{ id: 'r1', instalacionId: 'i1', numero: 'RCA 202410001185', nombre: 'Aucha', fecha: '2024-09-13', estado: 'Vigente', archivoPath: 'i1/x.pdf', validados: true, items: [item('a', 'r1', 'Autocontrol mensual del RIL', 'RCA'), item('b', 'r1', 'DJA del RETC en octubre', 'Normativa')] }],
  pertinencias: [
    { id: 'p1', rcaId: 'r1', instalacionId: 'i1', numero: 'Pert 1', nombre: 'Pert 1', fecha: '2025-01-01', archivoPath: 'i1/p.pdf', validados: true, items: [item('c', 'r1', 'Nuevo estanque de oxígeno', 'Pertinencia')] },
    { id: 'p2', rcaId: 'r1', instalacionId: 'i1', numero: 'Pert 2', nombre: 'Pert 2', fecha: '2025-02-01', archivoPath: 'i1/q.pdf', validados: false, items: [item('d', 'r1', 'Sin validar', 'Pertinencia')] },
  ],
  auditorias: [{ id: 'aud-123456', instalacionId: 'i1', supervisorId: 'u2', supervisor: 'Camila', rcaIds: ['r1'], estado: 'En progreso', fechaLimite: '2026-10-01', items: [item('a', 'r1', 'Autocontrol mensual del RIL', 'RCA')], respuestas: ['no_cumple'], observaciones: {}, general: '', comentarioAdmin: '', submittedAt: null, reviewedAt: null }],
  evidencias: [],
  supervisores: [{ id: 'u1', nombre: 'Dahir Pérez' }, { id: 'u2', nombre: 'Camila Soto' }],
});
const fragmentos = [{ documento_id: '00000000-0000-4000-8000-000000000001', documento_tipo: 'rca', instalacion_id: 'i1', nombre: 'RCA 202410001185', pagina: 52, contenido: 'La bodega de residuos peligrosos tendrá 36 m2.' }];
const docs = { buscar: async (q: string, inst?: string) => (q.includes('bodega') && (!inst || inst === 'i1') ? fragmentos : []), pagina: async (id: string, p: number) => fragmentos.filter((f) => f.documento_id === id && f.pagina === p) };
const ctx = (rol: Snapshot['rol'] = 'admin') => ({ data: base(rol), hoy: '2026-10-20', docs });

describe('checklist de la instalación', () => {
  it('junta RCA + pertinencias confirmadas, sin las pendientes', () => {
    const d = base('admin');
    expect(checklistInstalacion(d.rcas[0], d.pertinencias).map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });
  it('no audita una RCA sin confirmar o revocada', () => {
    const d = base('admin');
    expect(checklistInstalacion({ ...d.rcas[0]!, validados: false }, d.pertinencias)).toEqual([]);
    expect(checklistInstalacion({ ...d.rcas[0]!, estado: 'Revocada' }, d.pertinencias)).toEqual([]);
  });
  it('cada tipo tiene normativa y omite las obligaciones que la RCA ya cubre', () => {
    for (const t of tiposInstalacion) expect(normativaPorTipo[t].length).toBeGreaterThan(5);
    const claves = normativaPorTipo.piscicultura.map((x) => x.clave);
    expect(new Set(claves).size).toBe(claves.length);
    const sinDos = itemsNormativos('piscicultura', 'r1', new Set([claves[0]!, claves[1]!]));
    expect(sinDos).toHaveLength(claves.length - 2);
    expect(sinDos.every((x) => x.origen === 'Normativa' && x.rcaId === 'r1')).toBe(true);
  });
});

describe('herramientas del agente', () => {
  it('el supervisor no ve herramientas de escritura', async () => {
    const nombres = herramientasPara('supervisor').map((h) => h.name);
    expect(nombres).not.toContain('crear_instalacion');
    expect(nombres).not.toContain('asignar_auditoria');
    expect(await ejecutarHerramienta('crear_instalacion', '{"nombre":"X","tipo":"centro"}', ctx('supervisor'))).toHaveProperty('error');
  });
  it('encuentra una instalación por nombre parcial y muestra el origen de cada ítem', async () => {
    const r = (await ejecutarHerramienta('ver_instalacion', '{"instalacion":"aucha"}', ctx())) as { resultado: { checklist: { origen: string }[] } };
    expect(r.resultado.checklist.map((x) => x.origen)).toEqual(['RCA', 'Normativa', 'Pertinencia']);
  });
  it('marca auditorías vencidas', async () => {
    const r = (await ejecutarHerramienta('listar_auditorias', '{}', ctx())) as { resultado: { vencida: boolean }[] };
    expect(r.resultado[0]?.vencida).toBe(true);
  });
  it('las escrituras solo proponen una acción para confirmar', async () => {
    const r = (await ejecutarHerramienta('asignar_auditoria', '{"instalacion":"Aucha","supervisor":"camila","fecha_limite":"2026-11-15"}', ctx())) as { resultado: { requiere_confirmacion: boolean; accion: { datos: unknown } } };
    expect(r.resultado.requiere_confirmacion).toBe(true);
    expect(r.resultado.accion.datos).toEqual({ inst: 'i1', sup: 'u2', fecha: '2026-11-15' });
  });
  it('no deja auditar una instalación sin checklist confirmado', async () => {
    expect(await ejecutarHerramienta('asignar_auditoria', '{"instalacion":"Invermar","supervisor":"camila","fecha_limite":"2026-11-15"}', ctx())).toHaveProperty('error');
  });
  it('rechaza parámetros inválidos con un mensaje legible', async () => {
    const r = (await ejecutarHerramienta('crear_instalacion', '{"nombre":"Centro X","tipo":"bodega"}', ctx())) as { error: string };
    expect(r.error).toMatch(/Parámetros inválidos/);
  });
  it('busca en documentos y cita documento y página', async () => {
    const r = (await ejecutarHerramienta('buscar_en_documentos', '{"consulta":"bodega residuos","instalacion":"aucha"}', ctx())) as { resultado: { resultados: { documento: string; pagina: number; instalacion: string }[] } };
    expect(r.resultado.resultados[0]).toMatchObject({ documento: 'RCA 202410001185', pagina: 52, instalacion: 'Piscicultura Aucha' });
    const p = (await ejecutarHerramienta('leer_pagina', '{"documento_id":"00000000-0000-4000-8000-000000000001","pagina":52}', ctx())) as { resultado: { texto: string } };
    expect(p.resultado.texto).toMatch(/36 m2/);
  });
  it('editar y eliminar instalaciones solo se proponen, y el supervisor no puede', async () => {
    const e = (await ejecutarHerramienta('editar_instalacion', '{"instalacion":"aucha","tipo":"centro"}', ctx())) as { resultado: { accion: { tipo: string; datos: { tipo: string; nombre: string } } } };
    expect(e.resultado.accion).toMatchObject({ tipo: 'editar_instalacion', datos: { tipo: 'centro', nombre: 'Piscicultura Aucha' } });
    expect(await ejecutarHerramienta('editar_instalacion', '{"instalacion":"aucha"}', ctx())).toHaveProperty('error');
    expect(await ejecutarHerramienta('eliminar_instalacion', '{"instalacion":"aucha"}', ctx('supervisor'))).toHaveProperty('error');
  });
});

describe('fragmentos para la búsqueda', () => {
  it('conserva la página, corta en oraciones y omite páginas vacías', async () => {
    const { fragmentar } = await import('@/lib/fragmentos');
    const larga = Array.from({ length: 60 }, (_, n) => `Compromiso ${n} del titular sobre el RIL.`).join(' ');
    const f = fragmentar(['', larga, 'corta'], 400, 80);
    expect(f.every((x) => x.pagina === 2)).toBe(true);
    expect(f.length).toBeGreaterThan(3);
    expect(f.every((x) => x.contenido.length <= 400)).toBe(true);
    expect(f.slice(0, -1).every((x) => x.contenido.endsWith('.'))).toBe(true);
  });
});

describe('texto del agente', () => {
  it('quita signos de exclamación y emojis sin romper el markdown', async () => {
    const { sanear } = await import('@/lib/agente/texto');
    const t = sanear('¡Hola, Dahir! 👋 Soy Orbit.\n\n- Ver el **panorama**.\n\n¿Con qué te ayudo hoy?');
    expect(t).toBe('Hola, Dahir. Soy Orbit.\n\n- Ver el **panorama**.\n\n¿Con qué te ayudo hoy?');
    expect(sanear('Listo!!! Quedó asignada.')).toBe('Listo. Quedó asignada.');
  });
});

describe('markdown del chat', () => {
  it('convierte listas y negritas en bloques, no en texto con asteriscos', async () => {
    const { parseBloques } = await import('@/components/markdown');
    const b = parseBloques('Puedo ayudarte con cosas como:\n\n- Ver el **panorama de cumplimiento** por instalación.\n- Buscar **requisitos** (RIL, SIFA).\n\n¿Con qué te ayudo hoy?');
    expect(b.map((x) => x.t)).toEqual(['p', 'ul', 'p']);
    expect(b[1]).toEqual({ t: 'ul', items: ['Ver el **panorama de cumplimiento** por instalación.', 'Buscar **requisitos** (RIL, SIFA).'] });
  });
});
