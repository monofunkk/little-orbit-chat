import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowUp, Check, RotateCcw, Sparkles, Wrench, X } from "lucide-react";
import { Button } from "@/components/arc/button/button";
import { useAction } from "@/lib/audit-query";
import { chatAgente } from "@/lib/agente.functions";
import { saveInstallation, assignAudit } from "@/lib/audit.functions";
import type { AccionPropuesta } from "@/lib/agente/herramientas";

type Turno =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; herramientas?: string[]; acciones?: { accion: AccionPropuesta; estado: "pendiente" | "hecha" | "descartada" }[]; error?: boolean };

const nombreHerramienta: Record<string, string> = {
  listar_instalaciones: "instalaciones",
  ver_instalacion: "detalle de instalación",
  buscar_requisitos: "búsqueda de requisitos",
  listar_auditorias: "auditorías",
  ver_auditoria: "detalle de auditoría",
  resumen_cumplimiento: "resumen de cumplimiento",
  normativa_por_tipo: "normativa por tipo",
  listar_supervisores: "equipo",
  crear_instalacion: "crear instalación",
  asignar_auditoria: "asignar auditoría",
};

export function ChatOrbit({ sugerencias, placeholder, vacio }: { sugerencias: string[]; placeholder: string; vacio?: ReactNode }) {
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [q, setQ] = useState("");
  const [pensando, setPensando] = useState(false);
  const fin = useRef<HTMLDivElement>(null);
  const crear = useAction((data: Parameters<typeof saveInstallation>[0]["data"]) => saveInstallation({ data }));
  const asignar = useAction((data: Parameters<typeof assignAudit>[0]["data"]) => assignAudit({ data }));

  useEffect(() => { fin.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [turnos, pensando]);

  const enviar = async (texto: string) => {
    const t = texto.trim();
    if (!t || pensando) return;
    const historial: Turno[] = [...turnos, { role: "user", content: t }];
    setTurnos(historial);
    setQ("");
    setPensando(true);
    try {
      const mensajes = historial.filter((x) => !(x.role === "assistant" && x.error)).slice(-20).map((x) => ({ role: x.role, content: x.content }));
      const r = await chatAgente({ data: { mensajes } });
      setTurnos((prev) => [...prev, { role: "assistant", content: r.respuesta, herramientas: r.herramientas, acciones: r.acciones.map((accion) => ({ accion, estado: "pendiente" as const })) }]);
    } catch (e) {
      setTurnos((prev) => [...prev, { role: "assistant", content: e instanceof Error ? e.message : "No pude responder. Intenta de nuevo.", error: true }]);
    } finally {
      setPensando(false);
    }
  };

  const resolver = async (turno: number, idx: number, confirmar: boolean) => {
    const t = turnos[turno];
    if (!t || t.role !== "assistant" || !t.acciones?.[idx]) return;
    const { accion } = t.acciones[idx];
    if (confirmar) {
      try {
        if (accion.tipo === "crear_instalacion") await crear.mutateAsync(accion.datos);
        else await asignar.mutateAsync(accion.datos);
      } catch { return; }
    }
    setTurnos((prev) => prev.map((x, n) => (n === turno && x.role === "assistant" ? { ...x, acciones: (x.acciones ?? []).map((a, k) => (k === idx ? { ...a, estado: confirmar ? ("hecha" as const) : ("descartada" as const) } : a)) } : x)));
  };

  return (
    <div className="flex w-full flex-col gap-4">
      {turnos.length > 0 && (
        <div className="flex flex-col gap-4" aria-live="polite">
          {turnos.map((t, n) =>
            t.role === "user" ? (
              <div key={n} className="ml-auto max-w-[85%] rounded-2xl bg-muted px-4 py-2.5 text-[15px]">{t.content}</div>
            ) : (
              <div key={n} className="flex max-w-full flex-col gap-2">
                <div className={`whitespace-pre-line text-[15px] leading-relaxed ${t.error ? "text-danger" : ""}`}>{t.content}</div>
                {!!t.herramientas?.length && (
                  <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <Wrench className="size-3" /> Consultó: {t.herramientas.map((h) => nombreHerramienta[h] ?? h).join(", ")}
                  </p>
                )}
                {t.acciones?.map((a, k) => (
                  <div key={k} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm">
                    <span>{a.accion.resumen}</span>
                    {a.estado === "pendiente" ? (
                      <span className="flex gap-2">
                        <Button size="sm" loading={crear.isPending || asignar.isPending} onClick={() => void resolver(n, k, true)}><Check className="size-4" /> Confirmar</Button>
                        <Button size="sm" variant="ghost" onClick={() => void resolver(n, k, false)}><X className="size-4" /> Descartar</Button>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">{a.estado === "hecha" ? "Hecho" : "Descartado"}</span>
                    )}
                  </div>
                ))}
              </div>
            ),
          )}
          {pensando && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Sparkles className="size-4 animate-pulse" /> Orbit está consultando la plataforma…</p>}
          <div ref={fin} />
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); void enviar(q); }} className="composer flex items-center gap-2 p-2 pl-5">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label="Mensaje para Orbit" className="h-12 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground" />
        {turnos.length > 0 && (
          <Button type="button" variant="ghost" size="sm" aria-label="Nueva conversación" title="Nueva conversación" disabled={pensando} onClick={() => setTurnos([])}><RotateCcw className="size-4" /></Button>
        )}
        <Button type="submit" aria-label="Enviar" disabled={!q.trim()} loading={pensando} className="grid size-10 place-items-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95">
          <ArrowUp className="size-4" />
        </Button>
      </form>

      {turnos.length === 0 && (
        <>
          <div className="flex flex-wrap justify-center gap-2">
            {sugerencias.map((s) => (
              <button key={s} type="button" onClick={() => void enviar(s)} className="inline-flex items-center gap-2 rounded-full border border-border px-3.5 py-2 text-sm text-secondary-foreground transition-colors hover:bg-muted hover:text-foreground">{s}</button>
            ))}
          </div>
          {vacio}
        </>
      )}
    </div>
  );
}
