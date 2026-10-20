import type {Auditoria,Evidencia,Instalacion} from './domain';
import {porcentajeCumplimiento} from './semaforo';

/** Texto de cada página del PDF (índice 0 = página 1). */
export async function readPdfPages(file:File){
 const pdfjs=await import('pdfjs-dist');
 const worker=await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
 pdfjs.GlobalWorkerOptions.workerSrc=worker.default;
 const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())});
 const pdf=await task.promise;
 try{const pages:string[]=[];for(let n=1;n<=pdf.numPages;n++){const page=await pdf.getPage(n);const content=await page.getTextContent();pages.push(content.items.map(i=>'str' in i?i.str:'').join(' ').replace(/\s+/g,' ').trim());}return pages;}finally{await task.destroy();}
}

export async function readPdf(file:File){
 const pages=await readPdfPages(file);
 if(pages.join('').trim().length<20)throw new Error('Este PDF no contiene texto legible. Carga una copia con texto seleccionable.');
 return {pages,text:pages.map((p,n)=>`Página ${n+1}\n${p}`).join('\n\n')};
}

export async function downloadReport(a:Auditoria,inst:Instalacion|undefined,evidencias:Evidencia[],fileUrl:(path:string)=>Promise<string|undefined>){
 const {PDFDocument,StandardFonts}=await import('pdf-lib');const doc=await PDFDocument.create();const regular=await doc.embedFont(StandardFonts.Helvetica);const bold=await doc.embedFont(StandardFonts.HelveticaBold);let page=doc.addPage([595,842]);let y=795;
 const clean=(s:string)=>s.replace(/[^\x20-\x7E\xA0-\xFF\n]/g,'-');
 const line=(text:string,size=11,strong=false)=>{const font=strong?bold:regular;const words=clean(text).split(/\s+/);let current='';const write=()=>{if(y<55){page=doc.addPage([595,842]);y=795;}page.drawText(current,{x:45,y,size,font});y-=size+6;};for(const word of words){const next=current?current+' '+word:word;if(font.widthOfTextAtSize(next,size)>500&&current){write();current=word;}else current=next;}if(current)write();};
 line('INVERMAR AUDIT',20,true);line('Informe de auditoría ambiental',15,true);y-=12;line(inst?.nombre??'Instalación');line(`${inst?.tipo??''} - ${inst?.ubicacion??''}`);line(`Auditoría: ${a.id}`);line(`Supervisor: ${a.supervisor}`);line(`Fecha límite: ${a.fechaLimite}`);line(`Estado: ${a.estado}`);line(`Cumplimiento: ${porcentajeCumplimiento(a.respuestas)}% (no aplica excluido)`);if(a.reviewedAt)line(`Revisión: ${a.reviewedAt.slice(0,10)}`);y-=15;
 for(const [index,item] of a.items.entries()){line(`${index+1}. ${item.descripcion}`,11,true);line(`${item.referencia} - ${item.categoria}`);line(`Resultado: ${a.respuestas[index]?.replaceAll('_',' ')??'Pendiente'}`);if(a.observaciones[item.id])line(`Observación: ${a.observaciones[item.id]}`);for(const e of evidencias.filter(x=>x.itemId===item.id)){line(`Evidencia: ${e.nombre}`);if(e.mime==='image/jpeg'||e.mime==='image/png'){try{const url=await fileUrl(e.archivoPath);if(url){const bytes=await fetch(url).then(r=>r.arrayBuffer());const img=e.mime==='image/png'?await doc.embedPng(bytes):await doc.embedJpg(bytes);const scale=Math.min(300/img.width,180/img.height);const height=img.height*scale;if(y-height<55){page=doc.addPage([595,842]);y=795;}page.drawImage(img,{x:45,y:y-height,width:img.width*scale,height});y-=height+12;}}catch{line('Imagen no disponible en la exportación.');}}}y-=12;}
 if(a.general){line('Observaciones generales',12,true);line(a.general);}if(a.comentarioAdmin){line('Comentario de revisión',12,true);line(a.comentarioAdmin);}
 const bytes=await doc.save();const url=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:'application/pdf'}));const link=document.createElement('a');link.href=url;link.download=`Auditoria-${inst?.nombre??a.id}.pdf`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}