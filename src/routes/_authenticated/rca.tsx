import {createFileRoute} from '@tanstack/react-router';
import {useRef,useState} from 'react';
import {FileText,Plus,Trash2,UploadCloud,RefreshCw,Paperclip,ListChecks,ScanSearch} from 'lucide-react';
import {Page,PageHeader} from '@/components/app-shell';
import {Button} from '@/components/arc/button/button';
import {Input} from '@/components/arc/input/input';
import {Badge} from '@/components/arc/badge/badge';
import {snapshotOptions,useSnapshot,useAction} from '@/lib/audit-query';
import {saveRca,savePertinencia,createChecklistNormativo,getFileUrl} from '@/lib/audit.functions';
import {extractRca,extractPertinencia} from '@/lib/orbit.functions';
import {readPdf} from '@/lib/documents';
import {indexarDocumento} from '@/lib/documentos.functions';
import {supabase} from '@/integrations/supabase/client';
import {type Rca,type Pertinencia,type ChecklistItem,type Origen,fmtFecha,tipoLabel,origenLabel,checklistInstalacion} from '@/lib/domain';
import {normativaPorTipo} from '@/lib/normativa';
import {toast} from 'sonner';
import {useQueryClient} from '@tanstack/react-query';

export const Route=createFileRoute('/_authenticated/rca')({loader:({context})=>context.queryClient.ensureQueryData(snapshotOptions),head:()=>({meta:[{title:'RCA y checklist — Invermar Audit'},{name:'description',content:'Carga la RCA y las pertinencias de cada instalación y valida su checklist.'},{property:'og:title',content:'RCA y checklist — Invermar Audit'},{property:'og:description',content:'Resoluciones, pertinencias y checklists de auditoría.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),component:RcaPage});

type Meta={numero:string;nombre:string;fecha:string;estado:Rca['estado']};
type Edicion={kind:'rca';doc:Rca}|{kind:'pertinencia';doc:Pertinencia};
const toneOrigen:Record<Origen,'info'|'neutral'|'warning'>={RCA:'info',Normativa:'neutral',Pertinencia:'warning'};
const esPdf=(f:File)=>f.type==='application/pdf'||f.name.toLowerCase().endsWith('.pdf');

function RcaPage(){
const data=useSnapshot();
 const client=useQueryClient();const snapshotRefresh=()=>client.invalidateQueries({queryKey:snapshotOptions.queryKey});
 const [instId,setInstId]=useState(data.instalaciones[0]?.id??'');
 const [edit,setEdit]=useState<Edicion|null>(null);
 const [busy,setBusy]=useState(false);const [status,setStatus]=useState('');
 const rcaRef=useRef<HTMLInputElement>(null);const pertRef=useRef<HTMLInputElement>(null);const reemplazoRef=useRef<HTMLInputElement>(null);
 const inst=data.instalaciones.find(i=>i.id===instId);
 const rca=data.rcas.find(r=>r.instalacionId===instId);
 const perts=data.pertinencias.filter(p=>p.rcaId===rca?.id);
 const guardarRca=useAction((input:Parameters<typeof saveRca>[0]['data'])=>saveRca({data:input}));
 const guardarPert=useAction((input:Parameters<typeof savePertinencia>[0]['data'])=>savePertinencia({data:input}));
 const soloNormativa=useAction((inst:string)=>createChecklistNormativo({data:{inst}}));
 const trabajar=async(msg:string,fn:()=>Promise<void>)=>{setBusy(true);setStatus(msg);try{await fn();}catch(e){toast.error(e instanceof Error?e.message:'No se pudo completar.');}finally{setBusy(false);setStatus('');}};
 const subirArchivo=async(file:File,carpeta:string)=>{const path=`${instId}/${carpeta}${crypto.randomUUID()}.pdf`;const up=await supabase.storage.from('rca-documents').upload(path,file,{contentType:'application/pdf'});if(up.error)throw up.error;return path;};

 const cargarRca=(file:File)=>trabajar('Leyendo la RCA…',async()=>{
  if(!inst)throw new Error('Crea una instalación antes de cargar la RCA.');if(!esPdf(file))throw new Error('Selecciona un archivo PDF.');if(rca)throw new Error('Esta instalación ya tiene su RCA. Adjunta los cambios como pertinencia.');
  const leido=await readPdf(file);const text=leido.text;const path=await subirArchivo(file,'');
  const r=await supabase.from('rcas').insert({instalacion_id:instId,nombre:file.name.replace(/\.pdf$/i,''),archivo_path:path}).select('*').single();
  if(r.error){await supabase.storage.from('rca-documents').remove([path]);throw new Error(r.error.code==='23505'?'Esta instalación ya tiene su RCA.':r.error.message);}
  const draft:Rca={id:r.data.id,instalacionId:instId,nombre:r.data.nombre,numero:'',fecha:r.data.fecha,estado:'Vigente',archivoPath:path,items:[],validados:false};
  await indexar('rca',draft.id,draft.nombre,leido.pages);
  setStatus(`Orbit está cruzando la RCA con la normativa de ${tipoLabel[inst.tipo].toLowerCase()}…`);
  try{const x=await extractRca({data:{id:draft.id,text}});setEdit({kind:'rca',doc:{...draft,items:x.items}});toast.success(`Checklist listo: ${x.deRca} compromisos de la RCA y ${x.normativos} obligaciones normativas.`);}
  catch(e){setEdit({kind:'rca',doc:draft});throw e;}
  finally{await snapshotRefresh();}
 });
 const reemplazarRca=(r:Rca,file:File)=>trabajar('Leyendo el nuevo PDF…',async()=>{
  if(!inst)return;if(!esPdf(file))throw new Error('Selecciona un archivo PDF.');
  const leido=await readPdf(file);const path=await subirArchivo(file,'');
  const nombre=file.name.replace(/\.pdf$/i,'');
  const u=await supabase.from('rcas').update({archivo_path:path,nombre,numero:'',items:[],validados:false}).eq('id',r.id).select('*').single();
  if(u.error){await supabase.storage.from('rca-documents').remove([path]);throw u.error;}
  if(r.archivoPath)await supabase.storage.from('rca-documents').remove([r.archivoPath]);
  const draft:Rca={...r,archivoPath:path,nombre,numero:'',items:[],validados:false};
  await indexar('rca',r.id,nombre,leido.pages);
  setStatus(`Orbit está cruzando la RCA con la normativa de ${tipoLabel[inst.tipo].toLowerCase()}…`);
  try{const x=await extractRca({data:{id:r.id,text:leido.text}});setEdit({kind:'rca',doc:{...draft,items:x.items}});toast.success(`PDF reemplazado. Checklist listo: ${x.deRca} compromisos de la RCA y ${x.normativos} obligaciones normativas.`);}
  catch(e){setEdit({kind:'rca',doc:draft});throw e;}
  finally{await snapshotRefresh();}
 });
 const eliminarRca=(r:Rca)=>trabajar('Eliminando la RCA…',async()=>{
  await supabase.from('documento_fragmentos').delete().in('documento_id',[r.id,...perts.map(p=>p.id)]);
  const archivos=[r.archivoPath,...perts.map(p=>p.archivoPath)].filter(Boolean);
  const d=await supabase.from('rcas').delete().eq('id',r.id);if(d.error)throw d.error;
  if(archivos.length)await supabase.storage.from('rca-documents').remove(archivos);
  setEdit(null);await snapshotRefresh();toast.success('RCA eliminada. Ya puedes subir la correcta.');
 });
 const confirmarReemplazo=()=>{if(!rca)return;const aviso=rca.validados?'\n\nEl checklist confirmado se reemplazará por uno nuevo que tendrás que validar.':'';if(window.confirm(`¿Reemplazar el PDF de la RCA?${aviso}\n\nLas pertinencias adjuntas se mantienen. Las auditorías ya asignadas no cambian.`))reemplazoRef.current?.click();};
 const confirmarEliminar=()=>{if(!rca)return;const extra=perts.length?` y sus ${perts.length} pertinencia${perts.length>1?'s':''}`:'';if(window.confirm(`¿Eliminar la RCA${extra} de ${inst?.nombre}?\n\nSe borran el PDF y el checklist. Las auditorías ya asignadas no cambian. No se puede deshacer.`))void eliminarRca(rca);};
 const reprocesarRca=(r:Rca)=>trabajar('Orbit está procesando la RCA…',async()=>{const leido=await descargarPaginas(r.archivoPath,r.nombre);await indexar('rca',r.id,r.numero||r.nombre,leido.pages);const x=await extractRca({data:{id:r.id,text:leido.text}});setEdit({kind:'rca',doc:{...r,items:x.items,validados:false}});await snapshotRefresh();});
 const cargarPert=(file:File)=>trabajar('Leyendo la pertinencia…',async()=>{
  if(!rca)throw new Error('Primero carga la RCA de la instalación.');if(!esPdf(file))throw new Error('Selecciona un archivo PDF.');
  const leido=await readPdf(file);const text=leido.text;const path=await subirArchivo(file,'pertinencias/');
  const p=await supabase.from('pertinencias').insert({rca_id:rca.id,instalacion_id:instId,nombre:file.name.replace(/\.pdf$/i,''),archivo_path:path}).select('*').single();
  if(p.error){await supabase.storage.from('rca-documents').remove([path]);throw p.error;}
  const draft:Pertinencia={id:p.data.id,rcaId:rca.id,instalacionId:instId,numero:'',nombre:p.data.nombre,fecha:p.data.fecha,archivoPath:path,items:[],validados:false};
  await indexar('pertinencia',draft.id,draft.nombre,leido.pages);
  setStatus('Orbit está buscando qué cambia la pertinencia…');
  try{const x=await extractPertinencia({data:{id:draft.id,text}});setEdit({kind:'pertinencia',doc:{...draft,items:x.items}});toast.success(x.items.length?`La pertinencia propone ${x.items.length} compromisos.`:'La pertinencia no agrega compromisos nuevos.');}
  catch(e){setEdit({kind:'pertinencia',doc:draft});throw e;}
  finally{await snapshotRefresh();}
 });
 const reprocesarPert=(p:Pertinencia)=>trabajar('Orbit está procesando la pertinencia…',async()=>{const leido=await descargarPaginas(p.archivoPath,p.nombre);await indexar('pertinencia',p.id,p.numero||p.nombre,leido.pages);const x=await extractPertinencia({data:{id:p.id,text:leido.text}});setEdit({kind:'pertinencia',doc:{...p,items:x.items,validados:false}});await snapshotRefresh();});
 const borrarPert=(p:Pertinencia)=>trabajar('Eliminando la pertinencia…',async()=>{await supabase.from('documento_fragmentos').delete().eq('documento_id',p.id);const r=await supabase.from('pertinencias').delete().eq('id',p.id);if(r.error)throw r.error;await supabase.storage.from('rca-documents').remove([p.archivoPath]);await snapshotRefresh();});
 const indexar=async(tipo:'rca'|'pertinencia',documentoId:string,nombre:string,pages:string[])=>{try{await indexarDocumento({data:{instalacionId:instId,tipo,documentoId,nombre,paginas:pages}});}catch(e){toast.error(e instanceof Error?e.message:'No se pudo indexar el documento.');}};
 const descargarPaginas=async(path:string,nombre:string)=>{const d=await supabase.storage.from('rca-documents').download(path);if(d.error)throw d.error;return readPdf(new File([d.data],nombre+'.pdf',{type:'application/pdf'}));};
 const reindexar=()=>trabajar('Indexando los documentos para el asistente…',async()=>{let n=0;if(rca?.archivoPath){const x=await descargarPaginas(rca.archivoPath,rca.nombre);await indexar('rca',rca.id,rca.numero||rca.nombre,x.pages);n++;}for(const p of perts){const x=await descargarPaginas(p.archivoPath,p.nombre);await indexar('pertinencia',p.id,p.numero||p.nombre,x.pages);n++;}toast.success(n?`${n} documento${n>1?'s':''} indexado${n>1?'s':''}: Orbit ya puede buscar en ellos.`:'No hay documentos para indexar.');});
 const verPdf=async(path:string)=>{try{const x=await getFileUrl({data:{bucket:'rca-documents',path}});if(x.url)window.open(x.url,'_blank','noopener,noreferrer');}catch(e){toast.error(e instanceof Error?e.message:'No se pudo abrir el PDF.');}};

 if(data.rol!=='admin')return <Page><p>Acceso restringido.</p></Page>;
 const total=checklistInstalacion(rca,perts).length;

 return <Page><PageHeader title="RCA y checklist" subtitle="Una RCA por instalación. Orbit la cruza con la normativa de su tipo y tú validas el resultado."/>
  {busy&&<p role="status" className="mb-6 flex items-center gap-2 text-muted-foreground"><RefreshCw className="size-4 animate-spin"/>{status}</p>}
  {edit?<Editor key={edit.doc.id} edicion={edit} busy={busy||guardarRca.isPending||guardarPert.isPending} onClose={()=>setEdit(null)} onSave={async(meta,items)=>{if(edit.kind==='rca')await guardarRca.mutateAsync({id:edit.doc.id,numero:meta.numero,nombre:meta.nombre,fecha:meta.fecha,estado:meta.estado,items,validados:true});else await guardarPert.mutateAsync({id:edit.doc.id,numero:meta.numero,nombre:meta.nombre,fecha:meta.fecha,items,validados:true});setEdit(null);toast.success('Checklist confirmado.');}}/>:<>
  {!data.instalaciones.length?<p className="py-8 text-center text-muted-foreground">Crea una instalación para comenzar.</p>:<>
   <div className="mb-6 flex flex-wrap gap-2">{data.instalaciones.map(i=>{const tiene=data.rcas.find(r=>r.instalacionId===i.id);return <button key={i.id} type="button" aria-pressed={i.id===instId} onClick={()=>setInstId(i.id)} className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${i.id===instId?'border-foreground bg-muted text-foreground':'border-border text-muted-foreground hover:text-foreground'}`}>{i.nombre}<span className="ml-2 text-xs opacity-70">{tiene?.validados?'✓':tiene?'•':''}</span></button>;})}</div>
   {inst&&<div className="rounded-2xl border border-border-subtle bg-surface p-5">
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2"><div><p className="text-xs text-muted-foreground">{tipoLabel[inst.tipo]}</p><p className="font-medium">{inst.nombre}</p></div>{rca&&<p className="text-sm text-muted-foreground">{rca.validados?`${total} ítems auditables`:'Checklist por validar'}</p>}</div>
    {!rca?<div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">Sube la RCA en PDF. Orbit extrae sus compromisos y los cruza con las {normativaPorTipo[inst.tipo].length} obligaciones normativas de {tipoLabel[inst.tipo].toLowerCase()}: las que la RCA no cubre se suman al checklist.</p>
      <Button variant="secondary" disabled={busy} className="w-full" onClick={()=>rcaRef.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f&&!busy)void cargarRca(f);}}><UploadCloud className="size-5"/>Subir PDF de la RCA</Button>
      <Button variant="ghost" size="sm" disabled={busy} loading={soloNormativa.isPending} onClick={async()=>{await soloNormativa.mutateAsync(inst.id);toast.success('Checklist normativo creado. Revísalo y confírmalo.');}}><ListChecks className="size-4"/>No tiene RCA: usar solo la normativa del tipo</Button>
    </div>:<>
     <Doc icon={<FileText className="size-4 shrink-0 text-muted-foreground"/>} titulo={rca.numero||rca.nombre} detalle={`${rca.archivoPath?'RCA':'Sin RCA'} · ${fmtFecha(rca.fecha)} · ${rca.estado}`} validado={rca.validados} n={rca.items.length} resumen={resumenOrigen(rca.items)}
      acciones={<><Button size="sm" variant="ghost" disabled={busy} onClick={()=>setEdit({kind:'rca',doc:rca})}>Editar</Button>{rca.archivoPath&&<><Button size="sm" variant="ghost" disabled={busy} title="Volver a procesar" aria-label="Volver a procesar la RCA" onClick={()=>void reprocesarRca(rca)}><RefreshCw className="size-4"/></Button><Button size="sm" variant="ghost" onClick={()=>void verPdf(rca.archivoPath)}>PDF</Button></>}<Button size="sm" variant="ghost" disabled={busy} title={rca.archivoPath?'Subir otro PDF en lugar del actual':'Subir el PDF de la RCA'} onClick={confirmarReemplazo}><UploadCloud className="size-4"/>{rca.archivoPath?'Reemplazar PDF':'Subir PDF'}</Button><Button size="sm" variant="ghost" disabled={busy} aria-label="Eliminar RCA" title="Eliminar RCA" onClick={confirmarEliminar}><Trash2 className="size-4"/></Button></>}/>
     <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-medium">Pertinencias</p><span className="flex flex-wrap gap-2"><Button size="sm" variant="ghost" disabled={busy} title="Vuelve a leer la RCA y las pertinencias para que Orbit pueda buscar en ellas" onClick={()=>void reindexar()}><ScanSearch className="size-4"/>Actualizar índice</Button><Button size="sm" variant="secondary" disabled={busy} onClick={()=>pertRef.current?.click()}><Paperclip className="size-4"/>Adjuntar pertinencia</Button></span></div>
     {!perts.length&&<p className="mt-2 text-sm text-muted-foreground">Sin pertinencias. Adjunta cada resolución de pertinencia: Orbit propone lo que agrega o cambia y se suma al checklist al confirmarla.</p>}
     <div className="mt-2 divide-y divide-border-subtle">{perts.map(p=><Doc key={p.id} icon={<Paperclip className="size-4 shrink-0 text-muted-foreground"/>} titulo={p.numero||p.nombre} detalle={fmtFecha(p.fecha)} validado={p.validados} n={p.items.length}
      acciones={<><Button size="sm" variant="ghost" disabled={busy} onClick={()=>setEdit({kind:'pertinencia',doc:p})}>Editar</Button><Button size="sm" variant="ghost" disabled={busy} title="Volver a procesar" aria-label="Volver a procesar la pertinencia" onClick={()=>void reprocesarPert(p)}><RefreshCw className="size-4"/></Button><Button size="sm" variant="ghost" onClick={()=>void verPdf(p.archivoPath)}>PDF</Button><Button size="sm" variant="ghost" disabled={busy} aria-label="Eliminar pertinencia" onClick={()=>{if(window.confirm('¿Eliminar esta pertinencia y sus ítems?'))void borrarPert(p);}}><Trash2 className="size-4"/></Button></>}/>)}</div>
    </>}
   </div>}
  </>}
  <input ref={rcaRef} type="file" accept="application/pdf" hidden onChange={e=>{const f=e.target.files?.[0];if(f)void cargarRca(f);e.target.value='';}}/>
  <input ref={reemplazoRef} type="file" accept="application/pdf" hidden onChange={e=>{const f=e.target.files?.[0];if(f&&rca)void reemplazarRca(rca,f);e.target.value='';}}/>
  <input ref={pertRef} type="file" accept="application/pdf" hidden onChange={e=>{const f=e.target.files?.[0];if(f)void cargarPert(f);e.target.value='';}}/>
  </>}
 </Page>;
}

function resumenOrigen(items:ChecklistItem[]){const rca=items.filter(x=>(x.origen??'RCA')==='RCA').length;const norm=items.filter(x=>x.origen==='Normativa').length;return [rca&&`${rca} de la RCA`,norm&&`${norm} normativos`].filter(Boolean).join(' · ');}

function Doc({icon,titulo,detalle,validado,n,resumen,acciones}:{icon:React.ReactNode;titulo:string;detalle:string;validado:boolean;n:number;resumen?:string;acciones:React.ReactNode}){
 return <div className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="flex min-w-0 items-center gap-3">{icon}<div className="min-w-0"><p className="break-words text-sm font-medium">{titulo}</p><p className="text-xs text-muted-foreground">{detalle}{resumen?` · ${resumen}`:''}</p></div></div><div className="flex flex-wrap items-center gap-2"><Badge size="sm" tone={validado?'success':'warning'}>{validado?`${n} ítems`:'Por validar'}</Badge>{acciones}</div></div>;
}

function Editor({edicion,busy,onClose,onSave}:{edicion:Edicion;busy:boolean;onClose:()=>void;onSave:(meta:Meta,items:ChecklistItem[])=>Promise<void>}){
 const doc=edicion.doc;const esRca=edicion.kind==='rca';
 const [meta,setMeta]=useState<Meta>({numero:doc.numero,nombre:doc.nombre,fecha:doc.fecha,estado:esRca?edicion.doc.estado:'Vigente'});
 const [items,setItems]=useState<ChecklistItem[]>(doc.items);
 const set=(id:string,patch:Partial<ChecklistItem>)=>setItems(items.map(x=>x.id===id?{...x,...patch}:x));
 const origenNuevo:Origen=esRca?'RCA':'Pertinencia';
 const valido=items.every(x=>x.descripcion.trim())&&meta.numero.trim()&&meta.nombre.trim()&&(esRca?items.length>0:true);
 return <>
  <p className="mb-4 text-sm font-medium">{esRca?'Checklist de la RCA':'Compromisos de la pertinencia'}</p>
  <div className="mb-6 grid gap-4 sm:grid-cols-2"><Input label={esRca?'Número RCA':'Número de la pertinencia'} value={meta.numero} onChange={e=>setMeta({...meta,numero:e.target.value})}/><Input label="Nombre" value={meta.nombre} onChange={e=>setMeta({...meta,nombre:e.target.value})}/><Input label="Fecha" type="date" value={meta.fecha} onChange={e=>setMeta({...meta,fecha:e.target.value})}/>{esRca&&<label className="text-sm">Estado<select className="mt-2 block w-full rounded-lg border border-border bg-muted p-3" value={meta.estado} onChange={e=>setMeta({...meta,estado:e.target.value as Rca['estado']})}>{['Vigente','Modificada','Revocada'].map(x=><option key={x}>{x}</option>)}</select></label>}</div>
  <div className="mb-4 flex flex-wrap justify-between gap-3"><p className="text-sm text-muted-foreground">{items.length} ítems{esRca&&resumenOrigen(items)?` · ${resumenOrigen(items)}`:''}</p><Button size="sm" variant="ghost" disabled={busy} onClick={onClose}>Cerrar</Button></div>
  {!items.length&&<p className="mb-4 text-sm text-muted-foreground">{esRca?'Sin ítems todavía. Agrega al menos uno o vuelve a procesar el documento.':'Esta pertinencia no agrega compromisos. Puedes confirmarla así o agregarlos a mano.'}</p>}
  <div className="flex flex-col gap-3">{items.map((it,index)=><div key={it.id} className="rounded-lg border border-border-subtle bg-surface p-4">
   <div className="mb-2 flex flex-wrap items-center gap-2"><Badge size="sm" tone={toneOrigen[it.origen??'RCA']}>{origenLabel[it.origen??'RCA']}</Badge>{it.clave&&<span className="text-xs text-muted-foreground">{it.origen==='RCA'?`Cubre ${it.clave}`:it.clave}</span>}{it.fuente&&<span className="text-xs text-muted-foreground">· {it.fuente}</span>}</div>
   <div className="flex items-start gap-3"><span className="text-xs text-muted-foreground">{index+1}</span><textarea aria-label={`Requisito ${index+1}`} value={it.descripcion} onChange={e=>set(it.id,{descripcion:e.target.value})} rows={3} className="min-w-0 flex-1 resize-y bg-transparent text-sm outline-none"/><Button size="sm" variant="ghost" aria-label="Eliminar ítem" onClick={()=>setItems(items.filter(x=>x.id!==it.id))}><Trash2 className="size-4"/></Button></div>
   <div className="mt-3 flex flex-wrap gap-3"><select aria-label={`Categoría ${index+1}`} className="rounded-lg bg-muted p-2 text-xs" value={it.categoria} onChange={e=>set(it.id,{categoria:e.target.value as ChecklistItem['categoria']})}>{['Ambiental','Operacional','Documental'].map(x=><option key={x}>{x}</option>)}</select><select aria-label={`Evidencia ${index+1}`} className="rounded-lg bg-muted p-2 text-xs" value={it.evidencia} onChange={e=>set(it.id,{evidencia:e.target.value as ChecklistItem['evidencia']})}>{['Fotográfica','Documental','Declarativa'].map(x=><option key={x}>{x}</option>)}</select><input aria-label={`Referencia ${index+1}`} className="min-w-0 flex-1 rounded-lg bg-muted p-2 text-xs" value={it.referencia} onChange={e=>set(it.id,{referencia:e.target.value})}/></div>
  </div>)}</div>
  <div className="mt-5 flex flex-wrap gap-3"><Button variant="secondary" disabled={busy} onClick={()=>setItems([...items,{id:crypto.randomUUID(),rcaId:esRca?doc.id:edicion.doc.rcaId,descripcion:'',categoria:'Operacional',evidencia:'Fotográfica',referencia:'',origen:origenNuevo}])}><Plus className="size-4"/>Agregar ítem</Button><Button disabled={busy||!valido} loading={busy} onClick={()=>void onSave(meta,items)}>Confirmar checklist</Button></div>
 </>;
}
