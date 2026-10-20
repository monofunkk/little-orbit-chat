import { z } from 'zod';
import type { Respuesta } from './semaforo';

export const origenes = ['RCA','Normativa','Pertinencia'] as const;
export type Origen = typeof origenes[number];
export const itemSchema = z.object({ id: z.string(), rcaId: z.string(), descripcion: z.string().trim().min(1), categoria: z.enum(['Ambiental','Operacional','Documental']), evidencia: z.enum(['Fotográfica','Documental','Declarativa']), referencia: z.string(), origen: z.enum(origenes).optional(), clave: z.string().optional(), fuente: z.string().optional() });
export type ChecklistItem = z.infer<typeof itemSchema>;
export type Rol = 'admin' | 'supervisor';
export const tiposInstalacion = ['piscicultura','centro','planta_proceso','empresa'] as const;
export type TipoInstalacion = typeof tiposInstalacion[number];
export const tipoLabel: Record<TipoInstalacion,string> = { piscicultura:'Piscicultura', centro:'Centro', planta_proceso:'Planta de proceso', empresa:'Empresa' };
export const tipoDescripcion: Record<TipoInstalacion,string> = { piscicultura:'Agua dulce en tierra: recirculación, flujo abierto, hatchery', centro:'Centro de cultivo en mar: engorda y acopio', planta_proceso:'Planta en tierra inscrita en el Registro de Plantas', empresa:'Obligaciones por razón social' };
export type EstadoAuditoria = 'Asignada' | 'En progreso' | 'En revisión' | 'Aprobada' | 'Rechazada';
export interface Instalacion { id:string; nombre:string; tipo:TipoInstalacion; ubicacion:string; rcas:number; pertinencias:number; ultimoPct:number|null }
export interface Rca { id:string; instalacionId:string; numero:string; nombre:string; fecha:string; estado:'Vigente'|'Modificada'|'Revocada'; archivoPath:string; items:ChecklistItem[]; validados:boolean }
export interface Pertinencia { id:string; rcaId:string; instalacionId:string; numero:string; nombre:string; fecha:string; archivoPath:string; items:ChecklistItem[]; validados:boolean }
export interface Auditoria { id:string; instalacionId:string; supervisorId:string; supervisor:string; rcaIds:string[]; estado:EstadoAuditoria; fechaLimite:string; items:ChecklistItem[]; respuestas:Respuesta[]; observaciones:Record<string,string>; general:string; comentarioAdmin:string; submittedAt:string|null; reviewedAt:string|null }
export interface Evidencia { id:string; auditoriaId:string; itemId:string; archivoPath:string; nombre:string; mime:string }
export interface Snapshot { rol:Rol; nombre:string; userId:string; instalaciones:Instalacion[]; rcas:Rca[]; pertinencias:Pertinencia[]; auditorias:Auditoria[]; evidencias:Evidencia[]; supervisores:{id:string; nombre:string}[] }
export const fmtFecha = (iso:string) => new Date(iso.slice(0,10)+'T12:00:00').toLocaleDateString('es-CL',{day:'numeric',month:'short',year:'numeric'});
export const estadoTone = { Asignada:'neutral','En progreso':'info','En revisión':'warning',Aprobada:'success',Rechazada:'danger' } as const;
export const editableAudit = (estado:EstadoAuditoria) => ['Asignada','En progreso','Rechazada'].includes(estado);
export function canSubmit(items:ChecklistItem[], respuestas:Respuesta[]) { return items.length>0 && items.length===respuestas.length && respuestas.every(r=>r==='cumple'||r==='no_cumple'||r==='no_aplica'); }
export function validateReview(estado:EstadoAuditoria, aprobar:boolean, comentario:string) { if(estado!=='En revisión') throw new Error('La auditoría no está en revisión.'); if(!aprobar && !comentario.trim()) throw new Error('Escribe un comentario para devolver la auditoría.'); }export const origenLabel: Record<Origen,string> = { RCA:'RCA', Normativa:'Normativa del tipo', Pertinencia:'Pertinencia' };
/** Checklist auditable de una instalación: su RCA validada más las pertinencias validadas. */
export function checklistInstalacion(rca:Rca|undefined, pertinencias:Pertinencia[]) { if(!rca||!rca.validados||rca.estado==='Revocada') return []; return [...rca.items, ...pertinencias.filter(p=>p.rcaId===rca.id&&p.validados).flatMap(p=>p.items)]; }
