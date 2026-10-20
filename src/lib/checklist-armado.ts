import { z } from 'zod';
import { itemSchema, type ChecklistItem, type TipoInstalacion } from './domain';
import { normativaPorTipo, type ObligacionNormativa } from './normativa';

/** Lo que el modelo devuelve por cada compromiso encontrado en un segmento. */
export const extraidoSchema = itemSchema.omit({ id: true, rcaId: true, origen: true, clave: true, fuente: true }).extend({ modifica: z.array(z.number().int()).optional().default([]) });
export type Extraido = z.infer<typeof extraidoSchema>;

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Quita repetidos: los segmentos pueden traer el mismo compromiso dos veces. */
export function sinRepetidos<T extends { descripcion: string }>(items: T[]) {
  const vistos = new Set<string>();
  return items.filter((x) => { const k = normalizar(x.descripcion).slice(0, 160); if (!k || vistos.has(k)) return false; vistos.add(k); return true; });
}

const VACIAS = new Set(['para', 'como', 'cada', 'desde', 'hasta', 'sobre', 'entre', 'segun', 'mientras', 'tenga', 'tiene', 'debe', 'deben', 'esten', 'este', 'esta', 'estos', 'estas', 'antes', 'despues', 'menos', 'mayor', 'menor', 'todos', 'todas', 'toda', 'todo', 'otros', 'otras', 'vigente', 'vigentes', 'anual', 'mensual', 'cuando', 'donde', 'tambien', 'aplica', 'aplicados', 'registro', 'registros', 'inmediato', 'presente', 'informe', 'informar', 'informados', 'declaradas', 'declarado', 'pagada', 'pagado', 'revisado', 'revisada', 'hacer', 'mantener', 'personal', 'empresa', 'trabajadores', 'trabajador', 'instalacion', 'planta', 'centro']);

/** Palabras para buscar una obligación en el índice de la RCA: siglas (SIDREP, RETC) y palabras con contenido. */
export function terminosBusqueda(o: Pick<ObligacionNormativa, 'descripcion' | 'referencia'>): string {
  const siglas = [...`${o.descripcion} ${o.referencia}`.matchAll(/\b[A-ZÁÉÍÓÚÑ]{3,}\b/g)].map((m) => m[0]).filter((s) => !['DS', 'LGPA', 'RAMA', 'RESA', 'MINSAL', 'MINTRAB', 'MMA'].includes(s));
  const palabras = normalizar(o.descripcion).split(' ').filter((w) => w.length >= 5 && !VACIAS.has(w));
  return [...new Set([...siglas.map((s) => normalizar(s)), ...palabras])].slice(0, 10).join(' ');
}

export type EstadoVerificacion = 'cubierta' | 'no_aparece' | 'sin_verificar';
export interface Decision { clave: string; estado: EstadoVerificacion; pagina?: number | undefined; compromiso?: number | undefined }

/**
 * Checklist final de la RCA: los compromisos leídos de la RCA y, por cada obligación normativa del tipo,
 * o se une al compromiso de la RCA que la cubre, o se agrega con el motivo (dónde la trata la RCA, o que no aparece).
 */
export function armarChecklistRca(extraidos: Extraido[], decisiones: Decision[], tipo: TipoInstalacion, rcaId: string): ChecklistItem[] {
  const porClave = new Map(decisiones.map((d) => [d.clave, d]));
  const unidas = new Map<number, string[]>();
  for (const d of decisiones) if (d.estado === 'cubierta' && d.compromiso !== undefined && extraidos[d.compromiso]) unidas.set(d.compromiso, [...(unidas.get(d.compromiso) ?? []), d.clave]);
  const deRca: ChecklistItem[] = extraidos.map(({ modifica: _m, ...x }, i) => {
    const claves = unidas.get(i);
    return { ...x, id: crypto.randomUUID(), rcaId, origen: 'RCA', ...(claves ? { clave: claves.join(', '), fuente: `Cubre ${claves.join(', ')} de la normativa` } : {}) };
  });
  const normativos: ChecklistItem[] = normativaPorTipo[tipo].flatMap((o) => {
    const d = porClave.get(o.clave);
    if (d?.estado === 'cubierta' && d.compromiso !== undefined && extraidos[d.compromiso]) return [];
    const fuente = d?.estado === 'cubierta' ? `${o.organismo} · La RCA lo trata${d.pagina ? ` en p. ${d.pagina}` : ''}` : d?.estado === 'no_aparece' ? `${o.organismo} · No aparece en la RCA` : `${o.organismo} · No se pudo verificar contra la RCA`;
    return [{ id: crypto.randomUUID(), rcaId, descripcion: o.descripcion, categoria: o.categoria, evidencia: o.evidencia, referencia: `${o.clave} · ${o.referencia}`, origen: 'Normativa' as const, clave: o.clave, fuente }];
  });
  return [...deRca, ...normativos];
}

/** Compromisos de la RCA que están en alguna de las páginas indicadas (para que Orbit elija con cuál unir la obligación). */
export function compromisosEnPaginas(extraidos: Pick<Extraido, 'descripcion' | 'referencia'>[], paginas: number[]) {
  const set = new Set(paginas);
  return extraidos.map((x, i) => ({ i, x, pags: [...x.referencia.matchAll(/p(?:á|a)?g?(?:ina)?s?\.?\s*(\d{1,4})/gi)].map((m) => Number(m[1])) }))
    .filter(({ pags }) => pags.some((p) => set.has(p) || set.has(p - 1) || set.has(p + 1)))
    .slice(0, 8)
    .map(({ i, x }) => ({ i, descripcion: x.descripcion }));
}
