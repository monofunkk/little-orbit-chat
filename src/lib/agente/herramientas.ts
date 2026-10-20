import { z } from 'zod';
import { tiposInstalacion, tipoLabel, checklistInstalacion, type Snapshot, type Instalacion, type TipoInstalacion } from '../domain';
import { normativaPorTipo } from '../normativa';
import { porcentajeCumplimiento, semaforo, semaforoLabel } from '../semaforo';

/**
 * Servidor de herramientas interno de la plataforma (estilo MCP: nombre, descripción, inputSchema).
 * Lo usa el agente del chat. Las lecturas trabajan sobre lo que el usuario puede ver (RLS);
 * las escrituras no se ejecutan aquí: devuelven una acción que la persona confirma en el chat.
 */
export type AccionPropuesta =
  | { tipo: 'crear_instalacion'; resumen: string; datos: { nombre: string; tipo: TipoInstalacion; ubicacion: string } }
  | { tipo: 'asignar_auditoria'; resumen: string; datos: { inst: string; sup: string; fecha: string } };

export interface Herramienta<I extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  description: string;
  input: I;
  inputSchema: Record<string, unknown>;
  soloAdmin?: boolean;
  run: (args: z.infer<I>, ctx: { data: Snapshot; hoy: string }) => unknown;
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
function buscarInstalacion(data: Snapshot, ref: string): Instalacion {
  const exacta = data.instalaciones.find((i) => i.id === ref || norm(i.nombre) === norm(ref));
  if (exacta) return exacta;
  const parciales = data.instalaciones.filter((i) => norm(i.nombre).includes(norm(ref)));
  if (parciales.length === 1) return parciales[0]!;
  if (parciales.length > 1) throw new Error(`"${ref}" coincide con varias instalaciones: ${parciales.map((i) => i.nombre).join(', ')}. Pide que precise.`);
  throw new Error(`No encontré la instalación "${ref}". Instalaciones disponibles: ${data.instalaciones.map((i) => i.nombre).join(', ') || 'ninguna'}.`);
}
const estadoChecklist = (data: Snapshot, i: Instalacion) => {
  const rca = data.rcas.find((r) => r.instalacionId === i.id);
  if (!rca) return 'sin RCA ni checklist';
  if (!rca.validados) return 'checklist por validar';
  return `${checklistInstalacion(rca, data.pertinencias).length} ítems confirmados`;
};
const resumenAuditoria = (data: Snapshot, a: Snapshot['auditorias'][number]) => ({
  id: a.id,
  instalacion: data.instalaciones.find((i) => i.id === a.instalacionId)?.nombre ?? '—',
  supervisor: a.supervisor,
  estado: a.estado,
  fecha_limite: a.fechaLimite,
  avance: `${a.respuestas.filter(Boolean).length}/${a.items.length}`,
  cumplimiento_pct: porcentajeCumplimiento(a.respuestas),
});
const tool = <I extends z.ZodTypeAny>(h: Herramienta<I>) => h;
const obj = (properties: Record<string, unknown> = {}, required: string[] = []) => ({ type: 'object', properties, required, additionalProperties: false });

export const herramientas = [
  tool({
    name: 'listar_instalaciones',
    description: 'Lista las instalaciones (piscicultura, centro, planta de proceso, empresa) con su estado de checklist y su último cumplimiento aprobado.',
    input: z.object({}).passthrough(),
    inputSchema: obj(),
    run: (_a, { data }) => data.instalaciones.map((i) => ({ id: i.id, nombre: i.nombre, tipo: tipoLabel[i.tipo], ubicacion: i.ubicacion || null, checklist: estadoChecklist(data, i), pertinencias: i.pertinencias, ultimo_cumplimiento_pct: i.ultimoPct, semaforo: i.ultimoPct === null ? 'sin auditar' : semaforoLabel[semaforo(i.ultimoPct)] })),
  }),
  tool({
    name: 'ver_instalacion',
    description: 'Detalle de una instalación: RCA, pertinencias, ítems del checklist (con su origen: RCA, normativa o pertinencia) y auditorías.',
    input: z.object({ instalacion: z.string().min(1) }),
    inputSchema: obj({ instalacion: { type: 'string', description: 'Nombre o id de la instalación' } }, ['instalacion']),
    run: ({ instalacion }, { data }) => {
      const i = buscarInstalacion(data, instalacion);
      const rca = data.rcas.find((r) => r.instalacionId === i.id);
      const perts = data.pertinencias.filter((p) => p.rcaId === rca?.id);
      return {
        nombre: i.nombre, tipo: tipoLabel[i.tipo], ubicacion: i.ubicacion || null,
        rca: rca ? { numero: rca.numero || rca.nombre, fecha: rca.fecha, estado: rca.estado, confirmada: rca.validados, sin_documento: !rca.archivoPath } : null,
        pertinencias: perts.map((p) => ({ numero: p.numero || p.nombre, fecha: p.fecha, confirmada: p.validados, items: p.items.length })),
        checklist: checklistInstalacion(rca, data.pertinencias).map((x, n) => ({ n: n + 1, origen: x.origen ?? 'RCA', requisito: x.descripcion, referencia: x.referencia, evidencia: x.evidencia })),
        auditorias: data.auditorias.filter((a) => a.instalacionId === i.id).map((a) => resumenAuditoria(data, a)),
      };
    },
  }),
  tool({
    name: 'buscar_requisitos',
    description: 'Busca requisitos que contengan un texto en los checklists confirmados (por ejemplo "RIL", "SIFA", "residuos peligrosos").',
    input: z.object({ texto: z.string().min(2), instalacion: z.string().optional() }),
    inputSchema: obj({ texto: { type: 'string' }, instalacion: { type: 'string', description: 'Opcional: limitar a una instalación' } }, ['texto']),
    run: ({ texto, instalacion }, { data }) => {
      const lista = instalacion ? [buscarInstalacion(data, instalacion)] : data.instalaciones;
      const t = norm(texto);
      return lista.flatMap((i) => checklistInstalacion(data.rcas.find((r) => r.instalacionId === i.id), data.pertinencias)
        .filter((x) => norm(`${x.descripcion} ${x.referencia} ${x.clave ?? ''}`).includes(t))
        .map((x) => ({ instalacion: i.nombre, origen: x.origen ?? 'RCA', requisito: x.descripcion, referencia: x.referencia }))).slice(0, 40);
    },
  }),
  tool({
    name: 'listar_auditorias',
    description: 'Lista auditorías, opcionalmente filtradas por estado (Asignada, En progreso, En revisión, Aprobada, Rechazada) o instalación. Marca las vencidas.',
    input: z.object({ estado: z.enum(['Asignada', 'En progreso', 'En revisión', 'Aprobada', 'Rechazada']).optional(), instalacion: z.string().optional() }),
    inputSchema: obj({ estado: { type: 'string', enum: ['Asignada', 'En progreso', 'En revisión', 'Aprobada', 'Rechazada'] }, instalacion: { type: 'string' } }),
    run: ({ estado, instalacion }, { data, hoy }) => {
      const inst = instalacion ? buscarInstalacion(data, instalacion) : undefined;
      return data.auditorias.filter((a) => (!estado || a.estado === estado) && (!inst || a.instalacionId === inst.id))
        .map((a) => ({ ...resumenAuditoria(data, a), vencida: a.fechaLimite < hoy && ['Asignada', 'En progreso', 'Rechazada'].includes(a.estado) }));
    },
  }),
  tool({
    name: 'ver_auditoria',
    description: 'Detalle de una auditoría: cada ítem con su respuesta, observación y evidencias, más los incumplimientos.',
    input: z.object({ id: z.string().min(4) }),
    inputSchema: obj({ id: { type: 'string', description: 'Id de la auditoría (o sus primeros caracteres)' } }, ['id']),
    run: ({ id }, { data }) => {
      const a = data.auditorias.find((x) => x.id === id || x.id.startsWith(id));
      if (!a) throw new Error('No encontré esa auditoría.');
      const items = a.items.map((it, n) => ({ n: n + 1, requisito: it.descripcion, origen: it.origen ?? 'RCA', respuesta: a.respuestas[n] ?? 'pendiente', observacion: a.observaciones[it.id] || null, evidencias: data.evidencias.filter((e) => e.auditoriaId === a.id && e.itemId === it.id).length }));
      return { ...resumenAuditoria(data, a), comentario_revision: a.comentarioAdmin || null, observacion_general: a.general || null, incumplimientos: items.filter((x) => x.respuesta === 'no_cumple'), items };
    },
  }),
  tool({
    name: 'resumen_cumplimiento',
    description: 'Panorama general: semáforo por instalación, auditorías por revisar, vencidas y checklists pendientes de validar.',
    input: z.object({}).passthrough(),
    inputSchema: obj(),
    run: (_a, { data, hoy }) => ({
      instalaciones: data.instalaciones.map((i) => ({ nombre: i.nombre, tipo: tipoLabel[i.tipo], cumplimiento_pct: i.ultimoPct, semaforo: i.ultimoPct === null ? 'sin auditar' : semaforoLabel[semaforo(i.ultimoPct)], checklist: estadoChecklist(data, i) })),
      por_revisar: data.auditorias.filter((a) => a.estado === 'En revisión').length,
      en_terreno: data.auditorias.filter((a) => ['Asignada', 'En progreso'].includes(a.estado)).length,
      vencidas: data.auditorias.filter((a) => a.fechaLimite < hoy && ['Asignada', 'En progreso', 'Rechazada'].includes(a.estado)).map((a) => resumenAuditoria(data, a)),
      checklists_por_validar: data.rcas.filter((r) => !r.validados).length + data.pertinencias.filter((p) => !p.validados).length,
    }),
  }),
  tool({
    name: 'normativa_por_tipo',
    description: 'Obligaciones normativas (fuera de la RCA) que aplican a un tipo de instalación, con su cita legal.',
    input: z.object({ tipo: z.enum(tiposInstalacion) }),
    inputSchema: obj({ tipo: { type: 'string', enum: [...tiposInstalacion] } }, ['tipo']),
    run: ({ tipo }) => normativaPorTipo[tipo].map((x) => ({ clave: x.clave, organismo: x.organismo, obligacion: x.descripcion, cita: x.referencia })),
  }),
  tool({
    name: 'listar_supervisores',
    description: 'Lista las personas del equipo a las que se puede asignar una auditoría.',
    soloAdmin: true,
    input: z.object({}).passthrough(),
    inputSchema: obj(),
    run: (_a, { data }) => data.supervisores.map((s) => ({ id: s.id, nombre: s.nombre })),
  }),
  tool({
    name: 'crear_instalacion',
    description: 'Propone crear una instalación. No la crea: la persona debe confirmarla en el chat.',
    soloAdmin: true,
    input: z.object({ nombre: z.string().trim().min(1), tipo: z.enum(tiposInstalacion), ubicacion: z.string().default('') }),
    inputSchema: obj({ nombre: { type: 'string' }, tipo: { type: 'string', enum: [...tiposInstalacion] }, ubicacion: { type: 'string', description: 'Comuna, región' } }, ['nombre', 'tipo']),
    run: ({ nombre, tipo, ubicacion }, { data }): { requiere_confirmacion: true; accion: AccionPropuesta } => {
      if (data.instalaciones.some((i) => norm(i.nombre) === norm(nombre))) throw new Error(`Ya existe una instalación llamada ${nombre}.`);
      return { requiere_confirmacion: true, accion: { tipo: 'crear_instalacion', resumen: `Crear ${tipoLabel[tipo].toLowerCase()} "${nombre}"${ubicacion ? ` en ${ubicacion}` : ''}`, datos: { nombre, tipo, ubicacion } } };
    },
  }),
  tool({
    name: 'asignar_auditoria',
    description: 'Propone asignar una auditoría de una instalación a un supervisor con fecha límite (AAAA-MM-DD). No la asigna: la persona debe confirmarla en el chat.',
    soloAdmin: true,
    input: z.object({ instalacion: z.string().min(1), supervisor: z.string().min(1), fecha_limite: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
    inputSchema: obj({ instalacion: { type: 'string' }, supervisor: { type: 'string', description: 'Nombre o id' }, fecha_limite: { type: 'string', description: 'AAAA-MM-DD' } }, ['instalacion', 'supervisor', 'fecha_limite']),
    run: ({ instalacion, supervisor, fecha_limite }, { data, hoy }): { requiere_confirmacion: true; accion: AccionPropuesta } => {
      const i = buscarInstalacion(data, instalacion);
      const checklist = checklistInstalacion(data.rcas.find((r) => r.instalacionId === i.id), data.pertinencias);
      if (!checklist.length) throw new Error(`${i.nombre} todavía no tiene su checklist confirmado; hay que validarlo en "RCA y checklist" antes de auditar.`);
      const sups = data.supervisores.filter((s) => s.id === supervisor || norm(s.nombre).includes(norm(supervisor)));
      if (sups.length !== 1) throw new Error(sups.length ? `"${supervisor}" coincide con varias personas: ${sups.map((s) => s.nombre).join(', ')}.` : `No encontré a "${supervisor}" en el equipo.`);
      if (fecha_limite < hoy) throw new Error('La fecha límite ya pasó.');
      const sup = sups[0]!;
      return { requiere_confirmacion: true, accion: { tipo: 'asignar_auditoria', resumen: `Asignar a ${sup.nombre} la auditoría de ${i.nombre} (${checklist.length} ítems), con fecha límite ${fecha_limite}`, datos: { inst: i.id, sup: sup.id, fecha: fecha_limite } } };
    },
  }),
] as const;

export const herramientasPara = (rol: Snapshot['rol']) => herramientas.filter((h) => rol === 'admin' || !('soloAdmin' in h && h.soloAdmin));

/** Ejecuta una herramienta por nombre validando su entrada. Errores vuelven como texto para que el agente los explique. */
export function ejecutarHerramienta(nombre: string, argsJson: string, ctx: { data: Snapshot; hoy: string }) {
  const h = herramientasPara(ctx.data.rol).find((x) => x.name === nombre);
  if (!h) return { error: `La herramienta ${nombre} no existe o no está disponible para tu rol.` };
  try {
    const raw: unknown = argsJson.trim() ? JSON.parse(argsJson) : {};
    const args = (h.input as z.ZodTypeAny).parse(raw);
    return { resultado: (h.run as (a: unknown, c: typeof ctx) => unknown)(args, ctx) };
  } catch (e) {
    return { error: e instanceof z.ZodError ? `Parámetros inválidos: ${e.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}` : e instanceof Error ? e.message : 'Error desconocido' };
  }
}
