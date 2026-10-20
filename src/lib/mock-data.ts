import type { Respuesta } from "./semaforo";

export type TipoInstalacion = "Centro de cultivo" | "Planta de proceso" | "Bodega" | "Oficina";
export interface Instalacion {
  id: string;
  nombre: string;
  tipo: TipoInstalacion;
  ubicacion: string;
  rcas: number;
  ultimoPct: number | null;
}

export interface Rca {
  id: string;
  numero: string;
  nombre: string;
  instalacionId: string;
  fecha: string;
  estado: "Vigente" | "Modificada" | "Revocada";
  items: number;
  validados: boolean;
}

export type Categoria = "Ambiental" | "Operacional" | "Documental";
export type TipoEvidencia = "Fotográfica" | "Documental" | "Declarativa";
export interface ChecklistItem {
  id: string;
  rcaId: string;
  descripcion: string;
  categoria: Categoria;
  evidencia: TipoEvidencia;
  referencia: string;
}

export type EstadoAuditoria = "Asignada" | "En progreso" | "En revisión" | "Aprobada" | "Rechazada";
export interface Auditoria {
  id: string;
  instalacionId: string;
  supervisor: string;
  rcaIds: string[];
  estado: EstadoAuditoria;
  fechaLimite: string;
  respuestas: Respuesta[];
  comentarioAdmin?: string;
}

export const instalaciones: Instalacion[] = [
  { id: "i1", nombre: "Centro Chonchi", tipo: "Centro de cultivo", ubicacion: "Chiloé, Los Lagos", rcas: 2, ultimoPct: 92 },
  { id: "i2", nombre: "Planta Castro", tipo: "Planta de proceso", ubicacion: "Castro, Los Lagos", rcas: 1, ultimoPct: 71 },
  { id: "i3", nombre: "Centro Aysén Norte", tipo: "Centro de cultivo", ubicacion: "Puerto Aysén", rcas: 1, ultimoPct: 54 },
  { id: "i4", nombre: "Bodega Puerto Montt", tipo: "Bodega", ubicacion: "Puerto Montt", rcas: 0, ultimoPct: null },
];

export const rcas: Rca[] = [
  { id: "r1", numero: "RCA N° 245/2019", nombre: "Ampliación Centro Chonchi", instalacionId: "i1", fecha: "2019-06-12", estado: "Vigente", items: 6, validados: true },
  { id: "r2", numero: "RCA N° 112/2021", nombre: "Modificación sistema de fondeo", instalacionId: "i1", fecha: "2021-03-02", estado: "Modificada", items: 4, validados: true },
  { id: "r3", numero: "RCA N° 087/2018", nombre: "Planta de proceso Castro", instalacionId: "i2", fecha: "2018-09-20", estado: "Vigente", items: 5, validados: false },
  { id: "r4", numero: "RCA N° 301/2020", nombre: "Centro Aysén Norte", instalacionId: "i3", fecha: "2020-11-15", estado: "Vigente", items: 5, validados: true },
];

export const checklist: ChecklistItem[] = [
  { id: "c1", rcaId: "r1", descripcion: "Mantener registro mensual de mortalidad y su disposición final autorizada.", categoria: "Operacional", evidencia: "Documental", referencia: "Considerando 4.2" },
  { id: "c2", rcaId: "r1", descripcion: "Señalética de área de concesión visible y en buen estado.", categoria: "Ambiental", evidencia: "Fotográfica", referencia: "Considerando 5.1" },
  { id: "c3", rcaId: "r1", descripcion: "Contenedores de residuos sólidos rotulados y cerrados en pontón.", categoria: "Ambiental", evidencia: "Fotográfica", referencia: "Considerando 6.3" },
  { id: "c4", rcaId: "r1", descripcion: "Informe Ambiental (INFA) entregado dentro de plazo.", categoria: "Documental", evidencia: "Documental", referencia: "Resuelvo 3" },
  { id: "c5", rcaId: "r1", descripcion: "Producción anual no supera las toneladas autorizadas.", categoria: "Operacional", evidencia: "Declarativa", referencia: "Considerando 3.1" },
  { id: "c6", rcaId: "r1", descripcion: "Plan de contingencia ante escape de peces disponible en el centro.", categoria: "Documental", evidencia: "Documental", referencia: "Considerando 7.4" },
  { id: "c7", rcaId: "r2", descripcion: "Fondeo inspeccionado según frecuencia comprometida.", categoria: "Operacional", evidencia: "Documental", referencia: "Considerando 2.2" },
  { id: "c8", rcaId: "r2", descripcion: "Boyas y líneas de fondeo sin daños visibles.", categoria: "Ambiental", evidencia: "Fotográfica", referencia: "Considerando 2.5" },
  { id: "c9", rcaId: "r2", descripcion: "Certificado de buzo inspector vigente.", categoria: "Documental", evidencia: "Documental", referencia: "Resuelvo 2" },
  { id: "c10", rcaId: "r2", descripcion: "Sin presencia de plásticos sueltos en el entorno del módulo.", categoria: "Ambiental", evidencia: "Fotográfica", referencia: "Considerando 2.7" },
];

export const auditorias: Auditoria[] = [
  { id: "a1", instalacionId: "i1", supervisor: "Camila Soto", rcaIds: ["r1", "r2"], estado: "En progreso", fechaLimite: "2026-10-28", respuestas: ["cumple", "cumple", null, null, null, null, null, null, null, null] },
  { id: "a2", instalacionId: "i2", supervisor: "Diego Muñoz", rcaIds: ["r3"], estado: "En revisión", fechaLimite: "2026-10-22", respuestas: ["cumple", "no_cumple", "cumple", "cumple", "no_cumple", "cumple", "no_aplica"] },
  { id: "a3", instalacionId: "i3", supervisor: "Camila Soto", rcaIds: ["r4"], estado: "En revisión", fechaLimite: "2026-10-19", respuestas: ["no_cumple", "cumple", "no_cumple", "cumple", "no_cumple"] },
  { id: "a4", instalacionId: "i1", supervisor: "Camila Soto", rcaIds: ["r1"], estado: "Aprobada", fechaLimite: "2026-09-30", respuestas: ["cumple", "cumple", "cumple", "cumple", "cumple", "no_cumple", "cumple", "cumple", "cumple", "cumple", "cumple", "cumple"] },
  { id: "a5", instalacionId: "i2", supervisor: "Diego Muñoz", rcaIds: ["r3"], estado: "Asignada", fechaLimite: "2026-11-05", respuestas: [] },
];

export const supervisores = ["Camila Soto", "Diego Muñoz", "Francisca Pérez"];

export const instalacionPorId = (id: string) => instalaciones.find((i) => i.id === id)!;
export const fmtFecha = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });

export const estadoTone: Record<EstadoAuditoria, "neutral" | "info" | "warning" | "success" | "danger"> = {
  Asignada: "neutral",
  "En progreso": "info",
  "En revisión": "warning",
  Aprobada: "success",
  Rechazada: "danger",
};
