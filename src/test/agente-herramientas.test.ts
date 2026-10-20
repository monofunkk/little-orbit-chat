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
const ctx = (rol: Snapshot['rol'] = 'admin') => ({ data: base(rol), hoy: '2026-10-20' });

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
  it('el supervisor no ve herramientas de escritura', () => {
    const nombres = herramientasPara('supervisor').map((h) => h.name);
    expect(nombres).not.toContain('crear_instalacion');
    expect(nombres).not.toContain('asignar_auditoria');
    expect(ejecutarHerramienta('crear_instalacion', '{"nombre":"X","tipo":"centro"}', ctx('supervisor'))).toHaveProperty('error');
  });
  it('encuentra una instalación por nombre parcial y muestra el origen de cada ítem', () => {
    const r = ejecutarHerramienta('ver_instalacion', '{"instalacion":"aucha"}', ctx()) as { resultado: { checklist: { origen: string }[] } };
    expect(r.resultado.checklist.map((x) => x.origen)).toEqual(['RCA', 'Normativa', 'Pertinencia']);
  });
  it('marca auditorías vencidas', () => {
    const r = ejecutarHerramienta('listar_auditorias', '{}', ctx()) as { resultado: { vencida: boolean }[] };
    expect(r.resultado[0]?.vencida).toBe(true);
  });
  it('las escrituras solo proponen una acción para confirmar', () => {
    const r = ejecutarHerramienta('asignar_auditoria', '{"instalacion":"Aucha","supervisor":"camila","fecha_limite":"2026-11-15"}', ctx()) as { resultado: { requiere_confirmacion: boolean; accion: { datos: unknown } } };
    expect(r.resultado.requiere_confirmacion).toBe(true);
    expect(r.resultado.accion.datos).toEqual({ inst: 'i1', sup: 'u2', fecha: '2026-11-15' });
  });
  it('no deja auditar una instalación sin checklist confirmado', () => {
    expect(ejecutarHerramienta('asignar_auditoria', '{"instalacion":"Invermar","supervisor":"camila","fecha_limite":"2026-11-15"}', ctx())).toHaveProperty('error');
  });
  it('rechaza parámetros inválidos con un mensaje legible', () => {
    const r = ejecutarHerramienta('crear_instalacion', '{"nombre":"Centro X","tipo":"bodega"}', ctx()) as { error: string };
    expect(r.error).toMatch(/Parámetros inválidos/);
  });
});
