import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Camera, Check, Minus, X } from "lucide-react";
import { Page } from "@/components/app-shell";
import { Button } from "@/components/arc/button/button";
import { Badge } from "@/components/arc/badge/badge";
import { Progress } from "@/components/arc/progress/progress";
import { Textarea } from "@/components/arc/textarea/textarea";
import { SemaforoBadge } from "@/components/semaforo-badge";
import { auditorias, checklist, instalacionPorId, fmtFecha, estadoTone, type EstadoAuditoria } from "@/lib/mock-data";
import { porcentajeCumplimiento, type Respuesta } from "@/lib/semaforo";

export const Route = createFileRoute("/auditorias/$id")({
  loader: ({ params }) => {
    const a = auditorias.find((x) => x.id === params.id);
    if (!a) throw notFound();
    return { a };
  },
  head: ({ loaderData }) => {
    const t = loaderData ? `Auditoría ${instalacionPorId(loaderData.a.instalacionId).nombre} — Invermar Audit` : "Auditoría — Invermar Audit";
    return {
      meta: [
        { title: t },
        { name: "description", content: "Checklist de auditoría en terreno con evidencia fotográfica y semáforo de cumplimiento." },
        { property: "og:title", content: t },
        { property: "og:description", content: "Checklist de auditoría en terreno." },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: Ejecucion,
});

const opciones: { v: Exclude<Respuesta, null>; label: string; icon: typeof Check; on: string }[] = [
  { v: "cumple", label: "Cumple", icon: Check, on: "bg-success text-background border-success" },
  { v: "no_cumple", label: "No cumple", icon: X, on: "bg-danger text-background border-danger" },
  { v: "no_aplica", label: "No aplica", icon: Minus, on: "bg-muted text-foreground border-border-strong" },
];

function Ejecucion() {
  const { a } = Route.useLoaderData();
  const inst = instalacionPorId(a.instalacionId);
  const items = checklist;
  const [resp, setResp] = useState<Respuesta[]>(() => items.map((_, i) => a.respuestas[i] ?? null));
  const [obs, setObs] = useState<Record<number, string>>({});
  const [fotos, setFotos] = useState<Record<number, number>>({});
  const [estado, setEstado] = useState<EstadoAuditoria>(a.estado);
  const hechos = resp.filter(Boolean).length;
  const pct = porcentajeCumplimiento(resp);
  const completo = hechos === items.length;
  const editable = estado === "Asignada" || estado === "En progreso" || estado === "Rechazada";

  return (
    <Page>
      <Link to="/auditorias" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Auditorías
      </Link>

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{inst.tipo} · vence {fmtFecha(a.fechaLimite)}</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">{inst.nombre}</h1>
        </div>
        <Badge tone={estadoTone[estado]}>{estado}</Badge>
      </div>

      <div className="sticky top-0 z-10 -mx-5 mb-6 bg-background/85 px-5 py-4 backdrop-blur md:-mx-10 md:px-10">
        <Progress value={hechos} max={items.length} label={`${hechos} de ${items.length} ítems revisados`} showValue />
      </div>

      {a.comentarioAdmin && <p className="mb-6 rounded-2xl border border-danger/40 p-4 text-sm">{a.comentarioAdmin}</p>}

      <div className="flex flex-col gap-3">
        {items.map((it, i) => (
          <div key={it.id} className={`rounded-2xl border bg-surface p-5 transition-colors ${resp[i] ? "border-border-subtle" : "border-border"}`}>
            <div className="flex gap-3">
              <span className="mt-0.5 font-mono text-xs text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
              <div className="flex-1">
                <p className="text-[15px] leading-relaxed">{it.descripcion}</p>
                <p className="mt-1 text-xs text-muted-foreground">{it.referencia} · Evidencia {it.evidencia.toLowerCase()}</p>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {opciones.map(({ v, label, icon: Icon, on }) => (
                    <button
                      key={v}
                      disabled={!editable}
                      onClick={() => setResp(resp.map((r, j) => (j === i ? v : r)))}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors disabled:opacity-60 ${resp[i] === v ? on : "border-border text-secondary-foreground hover:bg-muted"}`}
                    >
                      <Icon className="size-3.5" /> {label}
                    </button>
                  ))}
                  <label className={`ml-auto inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground ${!editable && "pointer-events-none opacity-60"}`}>
                    <Camera className="size-4" /> {fotos[i] ? `${fotos[i]} foto${fotos[i] > 1 ? "s" : ""}` : "Foto"}
                    <input type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => setFotos({ ...fotos, [i]: (fotos[i] ?? 0) + (e.target.files?.length ?? 0) })} />
                  </label>
                </div>
                {resp[i] === "no_cumple" && (
                  <input
                    value={obs[i] ?? ""}
                    onChange={(e) => setObs({ ...obs, [i]: e.target.value })}
                    placeholder="¿Qué observaste? (opcional)"
                    className="mt-3 w-full rounded-xl bg-muted px-3.5 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
                  />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="composer mt-8 flex flex-col gap-5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-medium">Resultado</p>
          {hechos > 0 ? <SemaforoBadge pct={pct} /> : <span className="text-sm text-muted-foreground">Aún sin evaluar</span>}
        </div>
        {editable && <Textarea label="Observaciones generales" placeholder="Comentarios para el equipo de cumplimiento" rows={3} />}
        {editable ? (
          <div className="flex items-center gap-3">
            <Button disabled={!completo} onClick={() => setEstado("En revisión")}>Enviar a revisión</Button>
            {!completo && <span className="text-sm text-muted-foreground">Faltan {items.length - hechos} ítems</span>}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Esta auditoría ya fue enviada. Te avisaremos si hay cambios.</p>
        )}
      </div>
    </Page>
  );
}
