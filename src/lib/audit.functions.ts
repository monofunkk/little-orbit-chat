import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { itemSchema, tiposInstalacion, checklistInstalacion, type Snapshot, type Auditoria, type Rca, type Pertinencia, type TipoInstalacion, type EstadoAuditoria, validateReview, canSubmit, editableAudit } from './domain';
import { itemsNormativos } from './normativa';
import { porcentajeCumplimiento, type Respuesta } from './semaforo';

const answers = z.array(z.enum(['cumple','no_cumple','no_aplica']).nullable());
const items = z.array(itemSchema);
function check(error:{message:string}|null) { if(error) throw new Error(error.message); }

/** Carga todo lo que el usuario puede ver (RLS). Lo usan la app y las herramientas del agente. */
export async function cargarSnapshot(db:SupabaseClient<Database>, userId:string):Promise<Snapshot> {
  const role=await db.rpc('has_role',{_user_id:userId,_role:'admin'}); check(role.error);
  const rol=role.data?'admin':'supervisor';
  const [p,i,r,a,e,s,pe]=await Promise.all([
    db.from('profiles').select('nombre').eq('id',userId).single(),
    db.from('instalaciones').select('*').order('created_at',{ascending:false}),
    db.from('rcas').select('*').order('created_at',{ascending:false}),
    db.from('auditorias').select('*').order('created_at',{ascending:false}),
    db.from('evidencias').select('*'),
    db.from('profiles').select('id,nombre'),
    db.from('pertinencias').select('*').order('created_at',{ascending:true}),
  ]);
  for(const x of [p,i,r,a,e,s,pe]) check(x.error);
  const profiles=s.data??[];
  const auditorias:Auditoria[]=(a.data??[]).map(x=>({id:x.id,instalacionId:x.instalacion_id,supervisorId:x.supervisor_id,supervisor:profiles.find(y=>y.id===x.supervisor_id)?.nombre||'Supervisor',rcaIds:x.rca_ids,estado:x.estado as EstadoAuditoria,fechaLimite:x.fecha_limite,items:items.parse(x.items),respuestas:answers.parse(x.respuestas),observaciones:z.record(z.string()).parse(x.observaciones),general:x.general,comentarioAdmin:x.comentario_admin,submittedAt:x.submitted_at,reviewedAt:x.reviewed_at}));
  const rcas:Rca[]=(r.data??[]).map(x=>({id:x.id,instalacionId:x.instalacion_id,numero:x.numero,nombre:x.nombre,fecha:x.fecha,estado:x.estado as 'Vigente'|'Modificada'|'Revocada',archivoPath:x.archivo_path,items:items.parse(x.items),validados:x.validados}));
  const pertinencias:Pertinencia[]=(pe.data??[]).map(x=>({id:x.id,rcaId:x.rca_id,instalacionId:x.instalacion_id,numero:x.numero,nombre:x.nombre,fecha:x.fecha,archivoPath:x.archivo_path,items:items.parse(x.items),validados:x.validados}));
  return {rol,nombre:p.data?.nombre||'Usuario',userId,supervisores:profiles.map(x=>({id:x.id,nombre:x.nombre||'Usuario'})),rcas,pertinencias,auditorias,evidencias:(e.data??[]).map(x=>({id:x.id,auditoriaId:x.auditoria_id,itemId:x.item_id,archivoPath:x.archivo_path,nombre:x.nombre,mime:x.mime})),instalaciones:(i.data??[]).map(x=>{const last=auditorias.find(y=>y.instalacionId===x.id&&y.estado==='Aprobada');return {id:x.id,nombre:x.nombre,tipo:x.tipo as TipoInstalacion,ubicacion:x.ubicacion,rcas:rcas.filter(y=>y.instalacionId===x.id).length,pertinencias:pertinencias.filter(y=>y.instalacionId===x.id).length,ultimoPct:last?porcentajeCumplimiento(last.respuestas):null}})} satisfies Snapshot;
}

export const getSnapshot = createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async({context})=>cargarSnapshot(context.supabase,context.userId));

export const saveInstallation=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(z.object({id:z.string().uuid().optional(),nombre:z.string().trim().min(1),ubicacion:z.string().trim(),tipo:z.enum(tiposInstalacion)})).handler(async({data,context})=>{
  const role=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});if(!role.data)throw new Error('Solo administradores.');
  const {id,...fields}=data;const result=id?await context.supabase.from('instalaciones').update(fields).eq('id',id):await context.supabase.from('instalaciones').insert(fields);check(result.error);return {ok:true};
});

export const saveRca=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(z.object({id:z.string().uuid(),numero:z.string().trim().min(1),nombre:z.string().trim().min(1),fecha:z.string(),estado:z.enum(['Vigente','Modificada','Revocada']),items:items.min(1),validados:z.boolean()})).handler(async({data,context})=>{
  const {id,...fields}=data;const result=await context.supabase.from('rcas').update(fields).eq('id',id).select('id').single();check(result.error);return {ok:true};
});

export const assignAudit=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(z.object({inst:z.string().uuid(),sup:z.string().uuid(),fecha:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)})).handler(async({data,context})=>{
  const role=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});if(!role.data)throw new Error('Solo administradores.');
  const r=await context.supabase.from('rcas').select('*').eq('instalacion_id',data.inst).maybeSingle();check(r.error);
  if(!r.data||!r.data.validados||r.data.estado==='Revocada')throw new Error('La instalación necesita su checklist confirmado (RCA vigente) antes de auditar.');
  const pe=await context.supabase.from('pertinencias').select('*').eq('rca_id',r.data.id);check(pe.error);
  const rca={id:r.data.id,validados:r.data.validados,estado:r.data.estado,items:items.parse(r.data.items)} as Rca;
  const selected=checklistInstalacion(rca,(pe.data??[]).map(x=>({rcaId:x.rca_id,validados:x.validados,items:items.parse(x.items)}) as Pertinencia));if(!selected.length)throw new Error('El checklist está vacío.');
  const a=await context.supabase.from('auditorias').insert({instalacion_id:data.inst,supervisor_id:data.sup,rca_ids:[r.data.id],fecha_limite:data.fecha,items:selected,respuestas:selected.map(()=>null)}).select('id').single();check(a.error);return {id:a.data?.id};
});

/** Para instalaciones sin RCA (por ejemplo Empresa): checklist solo con la normativa de su tipo, para validar. */
export const createChecklistNormativo=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(z.object({inst:z.string().uuid()})).handler(async({data,context})=>{
  const role=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});if(!role.data)throw new Error('Solo administradores.');
  const i=await context.supabase.from('instalaciones').select('nombre,tipo').eq('id',data.inst).single();check(i.error);if(!i.data)throw new Error('Instalación no encontrada.');
  const tipo=z.enum(tiposInstalacion).parse(i.data.tipo) as TipoInstalacion;
  const r=await context.supabase.from('rcas').insert({instalacion_id:data.inst,nombre:`Checklist normativo — ${i.data.nombre}`,numero:'Sin RCA',archivo_path:''}).select('id').single();
  if(r.error)throw new Error(r.error.code==='23505'?'Esta instalación ya tiene su RCA.':r.error.message);
  const list=itemsNormativos(tipo,r.data.id);const u=await context.supabase.from('rcas').update({items:list}).eq('id',r.data.id);check(u.error);return {id:r.data.id};
});

export const savePertinencia=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(z.object({id:z.string().uuid(),numero:z.string().trim().min(1),nombre:z.string().trim().min(1),fecha:z.string(),items:items,validados:z.boolean()})).handler(async({data,context})=>{
  const {id,...fields}=data;const result=await context.supabase.from('pertinencias').update(fields).eq('id',id).select('id').single();check(result.error);return {ok:true};
});

export const saveAudit=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(z.object({id:z.string().uuid(),respuestas:answers,observaciones:z.record(z.string()),general:z.string(),enviar:z.boolean()})).handler(async({data,context})=>{
  const a=await context.supabase.from('auditorias').select('*').eq('id',data.id).single();check(a.error);if(!a.data||!editableAudit(a.data.estado as EstadoAuditoria))throw new Error('Esta auditoría no se puede editar.');
  const checklist=items.parse(a.data.items);if(data.respuestas.length!==checklist.length)throw new Error('Respuestas incompletas.');
  if(data.enviar&&!canSubmit(checklist,data.respuestas))throw new Error('Completa todos los ítems.');
  const r=await context.supabase.from('auditorias').update({respuestas:data.respuestas,observaciones:data.observaciones,general:data.general,estado:data.enviar?'En revisión':'En progreso'}).eq('id',data.id).eq('estado',a.data.estado).select('id').single();check(r.error);return {ok:true};
});

export const reviewAudit=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(z.object({id:z.string().uuid(),aprobar:z.boolean(),comentario:z.string()})).handler(async({data,context})=>{
  const role=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});if(!role.data)throw new Error('Solo administradores.');
  const a=await context.supabase.from('auditorias').select('estado').eq('id',data.id).single();check(a.error);if(!a.data)throw new Error('Auditoría no encontrada.');validateReview(a.data.estado as EstadoAuditoria,data.aprobar,data.comentario);
  const r=await context.supabase.from('auditorias').update({estado:data.aprobar?'Aprobada':'Rechazada',comentario_admin:data.comentario.trim(),reviewed_at:new Date().toISOString()}).eq('id',data.id).eq('estado','En revisión').select('id').single();check(r.error);return {ok:true};
});

export const setUserRole=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(z.object({id:z.string().uuid(),role:z.enum(['admin','supervisor'])})).handler(async({data,context})=>{
  const role=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});if(!role.data)throw new Error('Solo administradores.');if(data.id===context.userId)throw new Error('No puedes cambiar tu propio acceso.');
  const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
  const r=await supabaseAdmin.from('user_roles').update({role:data.role}).eq('user_id',data.id);check(r.error);return {ok:true};
});

export const getFileUrl=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(z.object({bucket:z.enum(['rca-documents','audit-evidence']),path:z.string().min(1)})).handler(async({data,context})=>{
  const r=await context.supabase.storage.from(data.bucket).createSignedUrl(data.path,300);check(r.error);return {url:r.data?.signedUrl};
});