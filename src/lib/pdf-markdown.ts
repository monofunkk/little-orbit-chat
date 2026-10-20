/**
 * PDF a markdown liviano, en el navegador (los documentos no salen de la plataforma).
 * Usa la posición de cada trozo de texto que entrega pdf.js para rearmar líneas reales,
 * detectar títulos (considerandos, numerales, tablas), reconstruir tablas por columnas
 * y quitar encabezados y pies de página que se repiten.
 */
export interface Trozo { str: string; x: number; y: number; w: number; h: number }

interface Linea { y: number; h: number; celdas: string[]; texto: string }

const TITULO = /^(considerando|resuelvo|vistos?|tabla|cuadro|cap[ií]tulo|anexo|t[ií]tulo|art[ií]culo|plan de|compromisos?)\b/i;
const NUMERAL = /^(\d{1,2}(\.\d{1,3}){0,3}\.?|[IVXL]{1,5}\.)\s+[A-ZÁÉÍÓÚÑ]/;
const ITEM = /^(\(?[a-z]\)|\d{1,2}\)|[ivx]{1,4}\))\s+\S/;

function mediana(xs: number[]) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
}

/** Agrupa trozos en líneas (misma altura) y separa columnas cuando hay un hueco grande entre trozos. */
export function armarLineas(trozos: Trozo[]): Linea[] {
  const validos = trozos.filter((t) => t.str.trim() || t.str === ' ');
  const altura = mediana(validos.filter((t) => t.str.trim()).map((t) => t.h)) || 10;
  const ordenados = [...validos].sort((a, b) => b.y - a.y || a.x - b.x);
  const grupos: Trozo[][] = [];
  for (const t of ordenados) {
    const g = grupos[grupos.length - 1];
    if (g && Math.abs(g[0]!.y - t.y) <= altura * 0.45) g.push(t);
    else grupos.push([t]);
  }
  return grupos.map((g) => {
    const enX = g.sort((a, b) => a.x - b.x);
    const celdas: string[] = [];
    let actual = '';
    let fin = -Infinity;
    for (const t of enX) {
      const hueco = t.x - fin;
      if (actual && hueco > altura * 2.2) { celdas.push(actual.trim()); actual = ''; }
      else if (actual && hueco > altura * 0.15 && !actual.endsWith(' ') && !t.str.startsWith(' ')) actual += ' ';
      actual += t.str;
      fin = Math.max(fin, t.x + t.w);
    }
    if (actual.trim()) celdas.push(actual.trim());
    const h = Math.max(...g.map((t) => t.h));
    return { y: g[0]!.y, h, celdas, texto: celdas.join(' ').replace(/\s+/g, ' ').trim() };
  }).filter((l) => l.texto);
}

const esTitulo = (l: Linea, base: number) => {
  const t = l.texto;
  if (t.length > 140 || /[,;:]$/.test(t) || !/^[A-ZÁÉÍÓÚÑ0-9]/.test(t)) return false;
  if (TITULO.test(t)) return true;
  if (NUMERAL.test(t) && t.length < 90 && !/\.$/.test(t)) return true;
  return l.h > base * 1.18 && t.length < 100;
};

/** Convierte las líneas de una página en markdown: títulos ##, tablas | a | b |, párrafos. */
export function lineasAMarkdown(lineas: Linea[]): string {
  const base = mediana(lineas.map((l) => l.h)) || 10;
  const out: string[] = [];
  let parrafo: string[] = [];
  const cerrar = () => { if (parrafo.length) { out.push(parrafo.join(' ').replace(/(\w)- (\w)/g, '$1$2')); parrafo = []; } };
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i]!;
    // Tabla: dos o más líneas seguidas con 3 o más columnas.
    if (l.celdas.length >= 3) {
      const filas: string[][] = [];
      let j = i;
      while (j < lineas.length && lineas[j]!.celdas.length >= 3) { filas.push(lineas[j]!.celdas); j++; }
      if (filas.length >= 2) {
        cerrar();
        const ancho = Math.max(...filas.map((f) => f.length));
        const fila = (f: string[]) => `| ${[...f, ...Array(ancho - f.length).fill('')].map((c) => c.replace(/\|/g, '/')).join(' | ')} |`;
        out.push([fila(filas[0]!), `|${' --- |'.repeat(ancho)}`, ...filas.slice(1).map(fila)].join('\n'));
        i = j - 1;
        continue;
      }
    }
    if (esTitulo(l, base)) { cerrar(); out.push(`## ${l.texto}`); continue; }
    const prev = lineas[i - 1];
    if (prev && prev.y - l.y > Math.max(prev.h, l.h) * 1.9) cerrar();
    if (/^[•\-–·▪]\s*/.test(l.texto)) { cerrar(); parrafo.push(`- ${l.texto.replace(/^[•\-–·▪]\s*/, '')}`); continue; }
    if (ITEM.test(l.texto)) { cerrar(); parrafo.push(`- ${l.texto}`); continue; }
    parrafo.push(l.texto);
  }
  cerrar();
  return out.join('\n\n');
}

const firma = (s: string) => s.toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ').trim();

/** Quita líneas que se repiten en el margen superior o inferior de la mayoría de las páginas (encabezados, pies, numeración). */
export function quitarRepetidos(paginas: Linea[][]): Linea[][] {
  if (paginas.length < 3) return paginas;
  const ys = paginas.flat().map((l) => l.y);
  if (!ys.length) return paginas;
  const arriba = Math.max(...ys), abajo = Math.min(...ys), banda = (arriba - abajo) * 0.1;
  const enMargen = (l: Linea) => l.y >= arriba - banda || l.y <= abajo + banda;
  const cuenta = new Map<string, number>();
  for (const p of paginas) for (const f of new Set(p.filter(enMargen).map((l) => firma(l.texto)))) cuenta.set(f, (cuenta.get(f) ?? 0) + 1);
  const repetidas = new Set([...cuenta].filter(([f, n]) => f.length > 0 && n >= Math.max(3, paginas.length * 0.5)).map(([f]) => f));
  return paginas.map((p) => p.filter((l) => !(enMargen(l) && repetidas.has(firma(l.texto)))));
}

export function trozosAMarkdown(paginas: Trozo[][]): string[] {
  return quitarRepetidos(paginas.map(armarLineas)).map(lineasAMarkdown);
}

/** Lee un PDF y devuelve el markdown de cada página. `onPagina` informa el avance. */
export async function pdfAMarkdown(file: File, onPagina?: (hecha: number, total: number) => void): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const pdf = await task.promise;
  try {
    const paginas: Trozo[][] = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      paginas.push(content.items.flatMap((i) => {
        if (!('str' in i)) return [];
        const t = i.transform as number[];
        return [{ str: i.str, x: t[4] ?? 0, y: t[5] ?? 0, w: i.width, h: i.height || Math.hypot(t[2] ?? 0, t[3] ?? 0) || 10 }];
      }));
      onPagina?.(n, pdf.numPages);
    }
    return trozosAMarkdown(paginas);
  } finally {
    await task.destroy();
  }
}
