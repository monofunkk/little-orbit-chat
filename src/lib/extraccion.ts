import { pdfAMarkdown } from './pdf-markdown';
import { segmentar, rangoPaginas } from './segmentos';
import { sinRepetidos, type Extraido, type Decision } from './checklist-armado';
import { normativaPorTipo } from './normativa';
import { extraerSegmento, verificarObligacion, guardarExtraccion } from './orbit.functions';
import { indexarDocumento } from './documentos.functions';
import type { ChecklistItem, TipoInstalacion } from './domain';

export interface Progreso { pct: number; etapa: string }
export interface ResultadoExtraccion { items: ChecklistItem[]; deRca: number; normativos: number; fallidas: string[]; noIndexado: boolean; verificacion: Record<Decision['estado'], number> }

/** Ejecuta tareas con un máximo de `n` en paralelo. */
async function enParalelo<T>(tareas: (() => Promise<T>)[], n: number) {
  const out: PromiseSettledResult<T>[] = new Array(tareas.length);
  let siguiente = 0;
  await Promise.all(Array.from({ length: Math.min(n, tareas.length) }, async () => {
    while (siguiente < tareas.length) {
      const i = siguiente++;
      try { out[i] = { status: 'fulfilled', value: await tareas[i]!() }; } catch (e) { out[i] = { status: 'rejected', reason: e }; }
    }
  }));
  return out;
}

const mensaje = (e: unknown) => (e instanceof Error ? e.message : 'Error desconocido');

/** PDF a markdown por página. Ocupa de 0 a 10 % del avance. */
export async function leerPdf(file: File, onProgreso: (p: Progreso) => void) {
  onProgreso({ pct: 1, etapa: 'Leyendo el PDF' });
  const pages = await pdfAMarkdown(file, (n, total) => onProgreso({ pct: Math.round((n / total) * 10), etapa: `Leyendo el PDF · página ${n} de ${total}` }));
  if (pages.join('').replace(/[#|\-\s]/g, '').length < 20) throw new Error('Este PDF no contiene texto legible. Carga una copia con texto seleccionable.');
  return pages;
}

/**
 * Del texto ya leído al checklist: indexa el documento, lo lee por secciones con Orbit (de a 3, sin 504),
 * en la RCA verifica cada obligación normativa contra el índice, y guarda. Avance de 10 a 100 %.
 */
export async function procesarDocumento(opts: { tipo: 'rca' | 'pertinencia'; id: string; instalacionId: string; tipoInstalacion: TipoInstalacion; nombre: string; pages: string[]; onProgreso: (p: Progreso) => void }): Promise<ResultadoExtraccion> {
  const { tipo, id, pages, onProgreso } = opts;
  const esRca = tipo === 'rca';

  onProgreso({ pct: 11, etapa: 'Indexando el documento para el asistente' });
  let noIndexado = false;
  try { await indexarDocumento({ data: { instalacionId: opts.instalacionId, tipo, documentoId: id, nombre: opts.nombre, paginas: pages } }); } catch { noIndexado = true; }

  const segmentos = segmentar(pages);
  const finLectura = esRca ? 80 : 96;
  let leidos = 0;
  onProgreso({ pct: 15, etapa: `Orbit está leyendo ${segmentos.length} secciones` });
  const resultados = await enParalelo(segmentos.map((s) => async () => {
    let ultimo: unknown;
    for (let intento = 0; intento < 2; intento++) {
      try {
        const r = await extraerSegmento({ data: { tipo, id, texto: s.texto } });
        leidos++;
        onProgreso({ pct: 15 + Math.round(((finLectura - 15) * leidos) / segmentos.length), etapa: `Orbit leyó ${rangoPaginas(s)} · ${leidos} de ${segmentos.length} secciones` });
        return r.items;
      } catch (e) { ultimo = e; }
    }
    leidos++;
    onProgreso({ pct: 15 + Math.round(((finLectura - 15) * leidos) / segmentos.length), etapa: `No se pudo leer ${rangoPaginas(s)} · ${leidos} de ${segmentos.length} secciones` });
    throw ultimo;
  }), 3);
  const fallidas = segmentos.filter((_, i) => resultados[i]!.status === 'rejected').map(rangoPaginas);
  if (segmentos.length && fallidas.length === segmentos.length) {
    const r = resultados[0];
    throw new Error(r && r.status === 'rejected' ? mensaje(r.reason) : 'Orbit no pudo leer el documento.');
  }
  const extraidos: Extraido[] = sinRepetidos(resultados.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])));

  const verificacion: ResultadoExtraccion['verificacion'] = { cubierta: 0, no_aparece: 0, sin_verificar: 0 };
  let decisiones: Decision[] = [];
  if (esRca) {
    const obligaciones = normativaPorTipo[opts.tipoInstalacion];
    const compromisos = extraidos.map((x) => ({ descripcion: x.descripcion.slice(0, 600), referencia: x.referencia.slice(0, 200) }));
    let hechas = 0;
    onProgreso({ pct: 81, etapa: `Verificando ${obligaciones.length} obligaciones normativas contra la RCA` });
    const r = await enParalelo(obligaciones.map((o) => async () => {
      const d = await verificarObligacion({ data: { rcaId: id, clave: o.clave, compromisos } }).catch((): Decision => ({ clave: o.clave, estado: 'sin_verificar' }));
      hechas++;
      onProgreso({ pct: 81 + Math.round((16 * hechas) / obligaciones.length), etapa: `Verificando normativa · ${o.clave} (${hechas} de ${obligaciones.length})` });
      return d;
    }), 4);
    decisiones = r.flatMap((x) => (x.status === 'fulfilled' ? [x.value] : []));
    for (const d of decisiones) verificacion[d.estado]++;
  }

  onProgreso({ pct: 98, etapa: 'Armando el checklist' });
  const guardado = await guardarExtraccion({ data: { tipo, id, items: extraidos, decisiones } });
  onProgreso({ pct: 100, etapa: 'Checklist listo para validar' });
  return { ...guardado, fallidas, noIndexado, verificacion };
}
