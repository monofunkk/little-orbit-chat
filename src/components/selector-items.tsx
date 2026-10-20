import { useMemo, useState } from "react";
import { ArrowUp, RotateCcw, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/arc/button/button";
import { Badge } from "@/components/arc/badge/badge";
import { sugerirItemsAuditoria } from "@/lib/seleccion.functions";
import { origenes, origenLabel, type ChecklistItem, type Origen } from "@/lib/domain";
import { toast } from "sonner";

const toneOrigen: Record<Origen, "info" | "neutral" | "warning"> = { RCA: "info", Normativa: "neutral", Pertinencia: "warning" };
const sugerencias = ["Los 10 más críticos para una fiscalización", "Lo que salió no cumple antes", "Solo lo mensual y semanal"];
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Elegir qué ítems del checklist entran en la auditoría: a mano (casillas, filtros, búsqueda) o pidiéndoselo a Orbit, que solo marca. */
export function SelectorItems({ inst, items, seleccion, onChange }: { inst: string; items: ChecklistItem[]; seleccion: ReadonlySet<string>; onChange: (s: Set<string>) => void }) {
  const [q, setQ] = useState("");
  const [origen, setOrigen] = useState<Origen | "todos">("todos");
  const [categoria, setCategoria] = useState<ChecklistItem["categoria"] | "todas">("todas");
  const [soloMarcados, setSoloMarcados] = useState(false);
  const [pedido, setPedido] = useState("");
  const [pedidos, setPedidos] = useState<{ texto: string; marcados: number }[]>([]);
  const [pensando, setPensando] = useState(false);

  const visibles = useMemo(() => items.filter((x) =>
    (origen === "todos" || (x.origen ?? "RCA") === origen) &&
    (categoria === "todas" || x.categoria === categoria) &&
    (!soloMarcados || seleccion.has(x.id)) &&
    (!q.trim() || norm(`${x.descripcion} ${x.referencia} ${x.clave ?? ""}`).includes(norm(q.trim())))), [items, origen, categoria, soloMarcados, seleccion, q]);

  const alternar = (id: string) => { const s = new Set(seleccion); if (s.has(id)) s.delete(id); else s.add(id); onChange(s); };
  const marcarVisibles = (on: boolean) => { const s = new Set(seleccion); for (const x of visibles) { if (on) s.add(x.id); else s.delete(x.id); } onChange(s); };
  const filtrado = visibles.length !== items.length;

  const pedir = async (texto: string) => {
    const t = texto.trim();
    if (!t || pensando) return;
    setPensando(true);
    try {
      const r = await sugerirItemsAuditoria({ data: { inst, pedido: t, historial: pedidos.map((p) => p.texto).slice(-10), seleccion: [...seleccion] } });
      onChange(new Set(r.itemIds));
      setPedidos((p) => [...p, { texto: t, marcados: r.itemIds.length }]);
      setPedido("");
      setSoloMarcados(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Orbit no pudo responder.");
    } finally {
      setPensando(false);
    }
  };

  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      <div className="rounded-xl border border-border-subtle bg-surface p-3">
        <p className="mb-2 flex items-center gap-2 text-xs text-muted-foreground"><Sparkles className="size-3.5 shrink-0" /> Pídele a Orbit que marque los ítems</p>
        {pedidos.length > 0 && (
          <ol className="mb-2 flex flex-col gap-1.5" aria-label="Pedidos a Orbit">
            {pedidos.map((p, n) => (
              <li key={n} className="flex items-start justify-between gap-3 text-sm">
                <span className="min-w-0 break-words rounded-lg bg-muted px-3 py-1.5">{p.texto}</span>
                <span className="shrink-0 pt-1.5 text-xs tabular-nums text-muted-foreground">{p.marcados} ítem{p.marcados === 1 ? "" : "s"}</span>
              </li>
            ))}
          </ol>
        )}
        <div className="flex items-center gap-2">
          <input
            value={pedido}
            onChange={(e) => setPedido(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void pedir(pedido); } }}
            disabled={pensando}
            enterKeyHint="send"
            aria-label="Pedido para Orbit"
            placeholder={pedidos.length ? "Ajusta: agrega lo de ruido…" : "Ej: residuos peligrosos y Sernapesca"}
            className="h-11 min-w-0 flex-1 rounded-lg bg-muted px-3 text-base outline-none placeholder:text-muted-foreground sm:text-sm"
          />
          {pedidos.length > 0 && <Button type="button" size="sm" variant="ghost" aria-label="Empezar de nuevo" title="Empezar de nuevo" disabled={pensando} onClick={() => setPedidos([])}><RotateCcw className="size-4" /></Button>}
          <Button type="button" aria-label="Pedir a Orbit" disabled={!pedido.trim()} loading={pensando} onClick={() => void pedir(pedido)}><ArrowUp className="size-4" /></Button>
        </div>
        {pensando && <p role="status" className="mt-2 text-xs text-muted-foreground">Orbit está marcando los ítems…</p>}
        {!pedidos.length && !pensando && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {sugerencias.map((s) => <button key={s} type="button" onClick={() => void pedir(s)} className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">{s}</button>)}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <label className="col-span-2 flex items-center gap-2 rounded-lg bg-muted px-3 sm:min-w-48 sm:flex-1">
          <Search className="size-3.5 shrink-0 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en el checklist" aria-label="Buscar ítems" className="h-10 min-w-0 flex-1 bg-transparent text-base outline-none sm:text-sm" />
        </label>
        <select aria-label="Filtrar por origen" value={origen} onChange={(e) => setOrigen(e.target.value as Origen | "todos")} className="h-10 min-w-0 rounded-lg bg-muted px-2 text-sm"><option value="todos">Todo origen</option>{origenes.map((o) => <option key={o} value={o}>{origenLabel[o]}</option>)}</select>
        <select aria-label="Filtrar por categoría" value={categoria} onChange={(e) => setCategoria(e.target.value as ChecklistItem["categoria"] | "todas")} className="h-10 min-w-0 rounded-lg bg-muted px-2 text-sm"><option value="todas">Toda categoría</option>{(["Ambiental", "Operacional", "Documental"] as const).map((c) => <option key={c}>{c}</option>)}</select>
        <label className="col-span-2 flex items-center gap-2 py-1 text-sm text-muted-foreground sm:col-span-1"><input type="checkbox" className="size-4" checked={soloMarcados} onChange={(e) => setSoloMarcados(e.target.checked)} />Solo marcados</label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-secondary-foreground"><strong className="font-semibold text-foreground tabular-nums">{seleccion.size}</strong> de {items.length} seleccionados{filtrado ? ` · ${visibles.length} visibles` : ""}</span>
        <span className="flex gap-1">
          <Button type="button" size="sm" variant="ghost" onClick={() => marcarVisibles(true)}>{filtrado ? "Marcar visibles" : "Todos"}</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => marcarVisibles(false)}>{filtrado ? "Desmarcar visibles" : "Ninguno"}</Button>
        </span>
      </div>

      <ul className="max-h-[60vh] divide-y divide-border-subtle overflow-y-auto overscroll-contain rounded-xl border border-border-subtle sm:max-h-96">
        {!visibles.length && <li className="p-4 text-center text-sm text-muted-foreground">Ningún ítem coincide con los filtros.</li>}
        {visibles.map((x) => (
          <li key={x.id}>
            <label className={`flex cursor-pointer items-start gap-3 p-3 text-sm transition-colors hover:bg-muted/40 ${seleccion.has(x.id) ? "" : "opacity-60"}`}>
              <input type="checkbox" className="mt-0.5 size-5 shrink-0 sm:size-4" checked={seleccion.has(x.id)} onChange={() => alternar(x.id)} />
              <span className="min-w-0 flex-1">
                <span className="block break-words">{x.descripcion}</span>
                <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"><Badge size="sm" tone={toneOrigen[x.origen ?? "RCA"]}>{origenLabel[x.origen ?? "RCA"]}</Badge><span className="break-words">{x.categoria} · {x.referencia}</span></span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
