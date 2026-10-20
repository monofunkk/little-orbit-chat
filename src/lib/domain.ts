import { z } from 'zod';
import type { Respuesta } from './semaforo';

export const itemSchema = z.object({ id: z.string(), rcaId: z.string(), descripcion: z.string().trim().min(1), categoria: z.enum(['Ambiental','Operacional','Documental']), evidencia: z.enum(['Fotográfica','Documental','Declarativa']), referencia: z.string() });
export type ChecklistItem = z.infer<typeof itemSchema>;
export type Rol = 'admin' | 'supervisor';
export type TipoInstalacion = 'Centro de cultivo' | 'Planta de proceso' | 'Bodega' | 'Oficina';
export type EstadoAuditoria = 'Asignada' | 'En progreso' | 'En revisión' | 'Aprobada' | 'Rechazada';
export interface Instalacion { id:string; nombre:string; tipo:TipoInstalacion; ubicacion:string; rcas:number; ultimoPct:number|null }
export interface Rca { id:string; instalacionId:string; numero:string; nombre:string; fecha:string; estado:'Vigente'|'Modificada'|'Revocada'; archivoPath:string; items:ChecklistItem[]; validados:boolean }
export interface Auditoria { id:string; instalacionId:string; supervisorId:string; supervisor:string; rcaIds:string[]; estado:EstadoAuditoria; fechaLimite:string; items:ChecklistItem[]; respuestas:Respuesta[]; observaciones:Record<string,string>; general:string; comentarioAdmin:string; submittedAt:string|null; reviewedAt:string|null }
export interface Evidencia { id:string; auditoriaId:string; itemId:string; archivoPath:string; nombre:string; mime:string }
export interface Snapshot { rol:Rol; nombre:string; userId:string; instalaciones:Instalacion[]; rcas:Rca[]; auditorias:Auditoria[]; evidencias:Evidencia[]; supervisores:{id:string; nombre:string}[] }
export const fmtFecha = (iso:string) => new Date(iso.slice(0,10)+'T12:00:00').toLocaleDateString('es-CL',{day:'numeric',month:'short',year:'numeric'});
export const estadoTone = { Asignada:'neutral','En progreso':'info','En revisión':'warning',Aprobada:'success',Rechazada:'danger' } as const;
export const editableAudit = (estado:EstadoAuditoria) => ['Asignada','En progreso','Rechazada'].includes(estado);
export function canSubmit(items:ChecklistItem[], respuestas:Respuesta[]) { return items.length>0 && items.length===respuestas.length && respuestas.every(r=>r==='cumple'||r==='no_cumple'||r==='no_aplica'); }
export function validateReview(estado:EstadoAuditoria, aprobar:boolean, comentario:string) { if(estado!=='En revisión') throw new Error('La auditoría no está en revisión.'); if(!aprobar && !comentario.trim()) throw new Error('Escribe un comentario para devolver la auditoría.'); }