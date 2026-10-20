/**
 * Corta un documento (markdown por página) en segmentos de tamaño acotado para que Orbit
 * los lea por separado. Prefiere cortar antes de un título (considerando, numeral, tabla)
 * para que cada compromiso llegue entero. Cada página va precedida por la marca [p.N].
 */
export interface Segmento { desde: number; hasta: number; texto: string }

interface Unidad { pagina: number; texto: string; titulo: boolean }

export function segmentar(paginas: string[], max = 9000): Segmento[] {
  const unidades: Unidad[] = paginas.flatMap((md, i) =>
    md.split(/\n{2,}/).map((t) => t.trim()).filter(Boolean).flatMap((t) => {
      // Un bloque más largo que el máximo se parte en trozos.
      const partes: string[] = [];
      for (let k = 0; k < t.length; k += max) partes.push(t.slice(k, k + max));
      return partes.map((p, n) => ({ pagina: i + 1, texto: p, titulo: n === 0 && p.startsWith('#') }));
    }),
  );
  const segmentos: Segmento[] = [];
  let actual: Unidad[] = [];
  const tam = (us: Unidad[]) => us.reduce((s, u) => s + u.texto.length + 2, 0);
  const emitir = (us: Unidad[]) => {
    if (!us.length) return;
    let pag = 0;
    const texto = us.map((u) => { const marca = u.pagina !== pag ? `[p.${u.pagina}] ` : ''; pag = u.pagina; return marca + u.texto; }).join('\n\n');
    segmentos.push({ desde: us[0]!.pagina, hasta: us[us.length - 1]!.pagina, texto });
  };
  for (const u of unidades) {
    if (actual.length && tam(actual) + u.texto.length > max) {
      // Cortar antes del último título si deja el segmento al menos a medio llenar.
      let corte = actual.length;
      for (let k = actual.length - 1; k > 0; k--) {
        if (actual[k]!.titulo) { if (tam(actual.slice(0, k)) >= max * 0.4) corte = k; break; }
      }
      emitir(actual.slice(0, corte));
      actual = actual.slice(corte);
    }
    actual.push(u);
  }
  emitir(actual);
  return segmentos;
}

export const rangoPaginas = (s: { desde: number; hasta: number }) => (s.desde === s.hasta ? `página ${s.desde}` : `páginas ${s.desde}–${s.hasta}`);
