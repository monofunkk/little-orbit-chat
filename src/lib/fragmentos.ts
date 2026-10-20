/** Divide el texto de cada página en fragmentos de ~1.200 caracteres con solape, cortando en fin de oración cuando se puede. */
export interface Fragmento { pagina: number; orden: number; contenido: string }

export function fragmentar(paginas: string[], max = 1200, solape = 200): Fragmento[] {
  const out: Fragmento[] = [];
  paginas.forEach((texto, idx) => {
    const t = texto.replace(/\s+/g, ' ').trim();
    if (t.length < 20) return;
    let inicio = 0;
    let orden = 0;
    while (inicio < t.length) {
      let fin = Math.min(inicio + max, t.length);
      if (fin < t.length) {
        const corte = Math.max(t.lastIndexOf('. ', fin), t.lastIndexOf('; ', fin));
        if (corte > inicio + max * 0.5) fin = corte + 1;
      }
      out.push({ pagina: idx + 1, orden: orden++, contenido: t.slice(inicio, fin).trim() });
      if (fin >= t.length) break;
      inicio = Math.max(fin - solape, inicio + 1);
      const espacio = t.indexOf(' ', inicio);
      if (espacio > 0 && espacio < fin) inicio = espacio + 1;
    }
  });
  return out;
}
