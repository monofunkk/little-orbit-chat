import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, ImageIcon, X } from "lucide-react";
import { Page, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/arc/button/button";
import { SemaforoBadge, SemaforoDot } from "@/components/semaforo-badge";
import { auditorias, checklist, instalacionPorId, fmtFecha } from "@/lib/mock-data";
import { porcentajeCumplimiento } from "@/lib/semaforo";

export const Route = createFileRoute("/revision")({
  head: () => ({
    meta: [
      { title: "Revisión — Invermar Audit" },
      { name: "description", content: "Aprueba o devuelve auditorías enviadas por los supervisores." },
      { property: "og:title", content: "Revisión — Invermar Audit" },
      { property: "og:description", content: "Aprueba o devuelve auditorías." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Revision,
});

function Revision() {
  const [pendientes, setPendientes] = useState(
    auditorias.filter((a) => a.estado === "En revisión").sort((x, y) => porcentajeCumplimiento(x.respuestas) - porcentajeCumplimiento(y.respuestas)),
  );
  const [selId, setSelId] = useState(pendientes[0]?.id);
  const [comentario, setComentario] = useState("");
  const [hecho, setHecho] = useState<string | null>(null);
  const sel = pendientes.find((a) => a.id === selId);

  const resolver = (aprobada: boolean) => {
    if (!sel) return;
    setHecho(`${instalacionPorId(sel.instalacionId).nombre} ${aprobada ? "aprobada" : "devuelta al supervisor"}.`);
    const rest = pendientes.filter((a) => a.id !== sel.id);
    setPendientes(rest);
    setSelId(rest[0]?.id);
    setComentario("");
  };

  return (
    <Page>
      <PageHeader title="Revisión" subtitle="Las más críticas aparecen primero." />
      {hecho && <p className="mb-4 rounded-2xl bg-muted px-4 py-3 text-sm">{hecho}</p>}

      {!sel ? (
        <div className="composer p-14 text-center text-muted-foreground">No hay auditorías por revisar. Todo al día.</div>
      ) : (
        <div className="grid gap-6 md:grid-cols-[240px_1fr]">
          <div className="flex flex-col gap-1">
            {pendientes.map((a) => (
              <button
                key={a.id}
                onClick={() => setSelId(a.id)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${a.id === selId ? "bg-muted" : "hover:bg-muted/50"}`}
              >
                <SemaforoDot pct={porcentajeCumplimiento(a.respuestas)} />
                <span className="flex-1">
                  {instalacionPorId(a.instalacionId).nombre}
                  <span className="block text-xs text-muted-foreground">{a.supervisor}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="composer p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Enviada por {sel.supervisor} · {fmtFecha(sel.fechaLimite)}</p>
                <h2 className="mt-1 text-xl font-semibold">{instalacionPorId(sel.instalacionId).nombre}</h2>
              </div>
              <SemaforoBadge pct={porcentajeCumplimiento(sel.respuestas)} />
            </div>

            <p className="mb-2 mt-8 text-sm font-medium">No cumplidos</p>
            <div className="flex flex-col gap-2">
              {sel.respuestas.map((r, i) =>
                r === "no_cumple" ? (
                  <div key={i} className="flex items-start gap-3 rounded-xl border border-danger/30 p-3 text-sm">
                    <X className="mt-0.5 size-4 shrink-0 text-danger" />
                    <span className="flex-1">{checklist[i]?.descripcion}</span>
                    <ImageIcon className="size-4 text-muted-foreground" />
                  </div>
                ) : null,
              )}
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              {sel.respuestas.filter((r) => r === "cumple").length} cumplidos · {sel.respuestas.filter((r) => r === "no_aplica").length} no aplica
            </p>

            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Comentario para el supervisor (obligatorio si devuelves)"
              rows={3}
              className="mt-6 w-full resize-none rounded-2xl bg-muted p-4 text-sm outline-none placeholder:text-muted-foreground"
            />
            <div className="mt-4 flex gap-2">
              <Button onClick={() => resolver(true)}><Check className="size-4" /> Aprobar</Button>
              <Button variant="secondary" disabled={!comentario.trim()} onClick={() => resolver(false)}>Devolver con comentarios</Button>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
