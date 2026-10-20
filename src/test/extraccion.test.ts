import { describe, expect, it } from 'vitest';
import { armarLineas, lineasAMarkdown, trozosAMarkdown, type Trozo } from '@/lib/pdf-markdown';
import { segmentar, rangoPaginas } from '@/lib/segmentos';
import { armarChecklistRca, terminosBusqueda, compromisosEnPaginas, sinRepetidos, type Extraido } from '@/lib/checklist-armado';
import { normativaPorTipo } from '@/lib/normativa';

/** Una línea de texto en la altura y, con celdas en x dadas (como las entrega pdf.js). */
const linea = (y: number, celdas: [number, string][], h = 10): Trozo[] => celdas.map(([x, str]) => ({ str, x, y, w: str.length * 5, h }));

describe('PDF a markdown', () => {
  it('reconstruye títulos, párrafos y una tabla de límites', () => {
    const trozos = [
      ...linea(800, [[50, '7.2 Normas de emisión']]),
      ...linea(780, [[50, 'El titular realizará el autocontrol mensual del RIL conforme a la siguiente']]),
      ...linea(768, [[50, 'tabla, durante toda la vida útil del proyecto.']]),
      ...linea(740, [[50, 'Parámetro'], [200, 'Unidad'], [320, 'Límite']]),
      ...linea(728, [[50, 'Sólidos suspendidos'], [200, 'mg/L'], [320, '300']]),
      ...linea(716, [[50, 'pH'], [200, 'unidad'], [320, '5,5 - 9,0']]),
    ];
    const md = lineasAMarkdown(armarLineas(trozos));
    expect(md).toContain('## 7.2 Normas de emisión');
    expect(md).toContain('El titular realizará el autocontrol mensual del RIL conforme a la siguiente tabla, durante toda la vida útil del proyecto.');
    expect(md).toContain('| Parámetro | Unidad | Límite |');
    expect(md).toContain('| Sólidos suspendidos | mg/L | 300 |');
  });

  it('no confunde un compromiso numerado largo con un título', () => {
    const md = lineasAMarkdown(armarLineas(linea(800, [[50, '1. El titular deberá informar a la SMA dentro de 24 horas cualquier contingencia.']])));
    expect(md.startsWith('##')).toBe(false);
  });

  it('quita encabezados y pies repetidos en todas las páginas', () => {
    const pagina = (n: number) => [...linea(820, [[50, 'RCA N° 202410001185 - Piscicultura Aucha']]), ...linea(700, [[50, `Contenido propio de la página ${n}.`]]), ...linea(40, [[300, `Página ${n} de 4`]])];
    const md = trozosAMarkdown([1, 2, 3, 4].map(pagina));
    expect(md.every((p) => !p.includes('Piscicultura Aucha') && !p.includes('de 4'))).toBe(true);
    expect(md[2]).toContain('Contenido propio de la página 3.');
  });
});

describe('segmentos', () => {
  it('marca cada página, respeta el tamaño y corta antes de un título', () => {
    const relleno = (n: number) => `Texto del compromiso ${n}. `.repeat(40);
    const paginas = [`## Considerando 8\n\n${relleno(1)}`, `${relleno(2)}\n\n## Considerando 9\n\n${relleno(3)}`, relleno(4)];
    const segs = segmentar(paginas, 2500);
    expect(segs.length).toBeGreaterThan(1);
    expect(segs.every((s) => s.texto.length <= 2500 + 20)).toBe(true);
    expect(segs[0]!.texto.startsWith('[p.1] ## Considerando 8')).toBe(true);
    expect(segs.some((s) => s.texto.includes('## Considerando 9') && /\[p\.2\] ## Considerando 9/.test(s.texto.split('\n\n')[0]!))).toBe(true);
    expect(segs.flatMap((s) => [...s.texto.matchAll(/\[p\.(\d+)\]/g)].map((m) => Number(m[1])))).toEqual(expect.arrayContaining([1, 2, 3]));
    expect(rangoPaginas({ desde: 3, hasta: 3 })).toBe('página 3');
  });

  it('una RCA de 141 páginas queda en secciones pequeñas', () => {
    const paginas = Array.from({ length: 141 }, (_, i) => `## Considerando ${i}\n\n${'El titular deberá cumplir. '.repeat(110)}`);
    const segs = segmentar(paginas);
    expect(segs.length).toBeGreaterThan(20);
    expect(Math.max(...segs.map((s) => s.texto.length))).toBeLessThanOrEqual(9100);
  });
});

describe('verificación normativa y checklist', () => {
  const sidrep = normativaPorTipo.piscicultura.find((o) => o.clave === 'SAL-03')!;
  const extraidos: Extraido[] = [
    { descripcion: 'Declarar en SIDREP cada retiro de residuos peligrosos.', categoria: 'Ambiental', evidencia: 'Documental', referencia: 'p. 52, Considerando 6.3', modifica: [] },
    { descripcion: 'Autocontrol mensual del RIL según DS 90.', categoria: 'Ambiental', evidencia: 'Documental', referencia: 'p. 39', modifica: [] },
  ];

  it('busca por siglas y palabras con contenido', () => {
    const t = terminosBusqueda(sidrep);
    expect(t).toContain('sidrep');
    expect(t).toContain('peligrosos');
    expect(t).not.toMatch(/\bcada\b/);
  });

  it('elige compromisos en las páginas encontradas', () => {
    expect(compromisosEnPaginas(extraidos, [52]).map((c) => c.i)).toEqual([0]);
  });

  it('une la obligación cubierta al compromiso de la RCA y agrega las demás con su motivo', () => {
    const items = armarChecklistRca(extraidos, [
      { clave: 'SAL-03', estado: 'cubierta', pagina: 52, compromiso: 0 },
      { clave: 'MMA-01', estado: 'no_aparece' },
      { clave: 'DGA-01', estado: 'cubierta', pagina: 12 },
      { clave: 'SNP-01', estado: 'sin_verificar' },
    ], 'piscicultura', 'rca-1');
    const total = normativaPorTipo.piscicultura.length;
    expect(items).toHaveLength(2 + total - 1);
    expect(items[0]).toMatchObject({ origen: 'RCA', clave: 'SAL-03', fuente: 'Cubre SAL-03 de la normativa' });
    expect(items.some((x) => x.clave === 'SAL-03' && x.origen === 'Normativa')).toBe(false);
    expect(items.find((x) => x.clave === 'MMA-01')?.fuente).toMatch(/No aparece en la RCA/);
    expect(items.find((x) => x.clave === 'DGA-01')?.fuente).toMatch(/La RCA lo trata en p\. 12/);
    expect(items.find((x) => x.clave === 'SNP-01')?.fuente).toMatch(/No se pudo verificar/);
  });

  it('quita compromisos repetidos entre secciones', () => {
    expect(sinRepetidos([...extraidos, { ...extraidos[0]!, descripcion: 'Declarar en SIDREP  cada retiro de residuos peligrosos' }])).toHaveLength(2);
  });
});
