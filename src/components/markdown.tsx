import { Fragment, type ReactNode } from "react";

/**
 * Markdown mínimo y seguro para las respuestas del agente: títulos, listas, negritas, cursivas,
 * código y enlaces http(s). Construye elementos React (nunca HTML crudo), así que el texto del
 * modelo no puede inyectar marcado.
 */
type Bloque =
  | { t: "h"; nivel: number; texto: string }
  | { t: "ul"; items: string[] }
  | { t: "ol"; items: string[] }
  | { t: "code"; texto: string }
  | { t: "p"; texto: string };

export function parseBloques(md: string): Bloque[] {
  const lineas = md.replace(/\r\n?/g, "\n").split("\n");
  const out: Bloque[] = [];
  let parrafo: string[] = [];
  const cerrar = () => { if (parrafo.length) { out.push({ t: "p", texto: parrafo.join("\n") }); parrafo = []; } };
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i]!;
    if (/^\s*```/.test(l)) {
      cerrar();
      const cuerpo: string[] = [];
      for (i++; i < lineas.length && !/^\s*```/.test(lineas[i]!); i++) cuerpo.push(lineas[i]!);
      out.push({ t: "code", texto: cuerpo.join("\n") });
      continue;
    }
    const h = /^\s{0,3}(#{1,4})\s+(.*)$/.exec(l);
    if (h) { cerrar(); out.push({ t: "h", nivel: h[1]!.length, texto: h[2]!.replace(/\s*#+\s*$/, "") }); continue; }
    const ul = /^\s*[-*•]\s+(.*)$/.exec(l);
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(l);
    if (ul || ol) {
      cerrar();
      const tipo = ul ? "ul" : "ol";
      const ultimo = out[out.length - 1];
      const texto = (ul ?? ol)![1]!;
      if (ultimo && ultimo.t === tipo) ultimo.items.push(texto);
      else out.push({ t: tipo, items: [texto] });
      continue;
    }
    if (/^\s*$/.test(l)) { cerrar(); continue; }
    if (/^\s*(---|\*\*\*)\s*$/.test(l)) { cerrar(); continue; }
    // Línea que continúa el último ítem de una lista (sangrada).
    const ultimo = out[out.length - 1];
    if (!parrafo.length && ultimo && (ultimo.t === "ul" || ultimo.t === "ol") && /^\s{2,}\S/.test(l)) { ultimo.items[ultimo.items.length - 1] += " " + l.trim(); continue; }
    parrafo.push(l);
  }
  cerrar();
  return out;
}

const INLINE = /(\*\*[^*\n]+\*\*|__[^_\n]+__|`[^`\n]+`|\[[^\]\n]+\]\(https?:\/\/[^)\s]+\)|\*[^*\n]+\*|_[^_\n]+_)/g;

export function inline(texto: string): ReactNode[] {
  const partes = texto.split(INLINE);
  return partes.map((p, k) => {
    if (!p) return null;
    if ((p.startsWith("**") && p.endsWith("**")) || (p.startsWith("__") && p.endsWith("__"))) return <strong key={k} className="font-semibold">{p.slice(2, -2)}</strong>;
    if (p.startsWith("`") && p.endsWith("`")) return <code key={k} className="rounded bg-muted px-1 py-0.5 text-[0.9em]">{p.slice(1, -1)}</code>;
    const link = /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/.exec(p);
    if (link) return <a key={k} href={link[2]} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{link[1]}</a>;
    if (p.length > 2 && ((p.startsWith("*") && p.endsWith("*")) || (p.startsWith("_") && p.endsWith("_")))) return <em key={k}>{p.slice(1, -1)}</em>;
    return <Fragment key={k}>{p.split("\n").map((linea, n) => <Fragment key={n}>{n > 0 && <br />}{linea}</Fragment>)}</Fragment>;
  });
}

export function Markdown({ texto, className = "" }: { texto: string; className?: string }) {
  return (
    <div className={`flex flex-col gap-3 text-[15px] leading-relaxed ${className}`}>
      {parseBloques(texto).map((b, k) => {
        if (b.t === "h") return <p key={k} className={b.nivel <= 2 ? "text-base font-semibold" : "font-medium"}>{inline(b.texto)}</p>;
        if (b.t === "ul") return <ul key={k} className="flex list-disc flex-col gap-1 pl-5 marker:text-muted-foreground">{b.items.map((x, n) => <li key={n}>{inline(x)}</li>)}</ul>;
        if (b.t === "ol") return <ol key={k} className="flex list-decimal flex-col gap-1 pl-5 marker:text-muted-foreground">{b.items.map((x, n) => <li key={n}>{inline(x)}</li>)}</ol>;
        if (b.t === "code") return <pre key={k} className="overflow-x-auto rounded-lg bg-muted p-3 text-sm"><code>{b.texto}</code></pre>;
        return <p key={k}>{inline(b.texto)}</p>;
      })}
    </div>
  );
}
