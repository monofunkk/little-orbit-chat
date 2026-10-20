import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronRight, Plus, X } from "lucide-react";
import { Page, PageHeader, useRol } from "@/components/app-shell";
import { Button } from "@/components/arc/button/button";
import { Badge } from "@/components/arc/badge/badge";
import { Input } from "@/components/arc/input/input";
import { SemaforoDot } from "@/components/semaforo-badge";
import { auditorias as seed, instalaciones, instalacionPorId, rcas, supervisores, fmtFecha, estadoTone, type Auditoria } from "@/lib/mock-data";
import { porcentajeCumplimiento } from "@/lib/semaforo";

export const Route = createFileRoute("/auditorias/")({
  head: () => ({
    meta: [
      { title: "Auditorías — Invermar Audit" },
      { name: "description", content: "Crea, asigna y sigue auditorías por instalación." },
      { property: "og:title", content: "Auditorías — Invermar Audit" },
      { property: "og:description", content: "Crea, asigna y sigue auditorías por instalación." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Auditorias,
});


function Auditorias() {
  const { rol } = useRol();
  const [lista, setLista] = useState<Auditoria[]>(seed);
  const [crear, setCrear] = useState(false);
  const [f, setF] = useState({ inst: instalaciones[0].id, rcaIds: [] as string[], sup: supervisores[0], fecha: "" });
  const visibles = rol === "admin" ? lista : lista.filter((a) => a.supervisor === "Camila Soto");
  const rcasInst = rcas.filter((r) => r.instalacionId === f.inst && r.estado !== "Revocada");

  return (
    <Page>
      <PageHeader
        title={rol === "admin" ? "Auditorías" : "Mis auditorías"}
        subtitle={rol === "admin" ? "Asigna una auditoría en cuatro pasos." : "Abre una auditoría para completar el checklist."}
        action={rol === "admin" && <Button onClick={() => setCrear(true)}><Plus className="size-4" /> Nueva auditoría</Button>}
      />

      {crear && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!f.rcaIds.length || !f.fecha) return;
            setLista([{ id: crypto.randomUUID(), instalacionId: f.inst, supervisor: f.sup, rcaIds: f.rcaIds, estado: "Asignada", fechaLimite: f.fecha, respuestas: [] }, ...lista]);
            setCrear(false);
          }}
          className="composer mb-8 flex flex-col gap-6 p-6"
        >
          <div className="flex items-center justify-between">
            <p className="font-medium">Nueva auditoría</p>
            <button type="button" onClick={() => setCrear(false)} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
          </div>
          <Step n={1} label="Instalación">
            {instalaciones.map((i) => (
              <Chip key={i.id} on={f.inst === i.id} onClick={() => setF({ ...f, inst: i.id, rcaIds: [] })}>{i.nombre}</Chip>
            ))}
          </Step>
          <Step n={2} label="RCA a auditar">
            {rcasInst.length ? rcasInst.map((r) => (
              <Chip key={r.id} on={f.rcaIds.includes(r.id)} onClick={() => setF({ ...f, rcaIds: f.rcaIds.includes(r.id) ? f.rcaIds.filter((x) => x !== r.id) : [...f.rcaIds, r.id] })}>
                {r.numero}
              </Chip>
            )) : <span className="text-sm text-muted-foreground">Esta instalación no tiene RCA vigentes.</span>}
          </Step>
          <Step n={3} label="Supervisor">
            {supervisores.map((s) => <Chip key={s} on={f.sup === s} onClick={() => setF({ ...f, sup: s })}>{s}</Chip>)}
          </Step>
          <Step n={4} label="Fecha límite">
            <div className="w-56"><Input label="Fecha" type="date" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} /></div>
          </Step>
          <div><Button type="submit" disabled={!f.rcaIds.length || !f.fecha}>Asignar auditoría</Button></div>
        </form>
      )}

      <div className="divide-y divide-border-subtle rounded-2xl border border-border-subtle">
        {visibles.map((a) => {
          const pct = porcentajeCumplimiento(a.respuestas);
          const evaluada = a.respuestas.some((r) => r === "cumple" || r === "no_cumple");
          return (
            <Link key={a.id} to="/auditorias/$id" params={{ id: a.id }} className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-muted/40">
              <div className="flex items-center gap-3">
                {evaluada ? <SemaforoDot pct={pct} /> : <span className="size-2 rounded-full bg-border-strong" />}
                <div>
                  <p className="text-sm font-medium">{instalacionPorId(a.instalacionId).nombre}</p>
                  <p className="text-xs text-muted-foreground">{a.supervisor} · vence {fmtFecha(a.fechaLimite)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge size="sm" tone={estadoTone[a.estado]}>{a.estado}</Badge>
                <ChevronRight className="size-4 text-muted-foreground" />
              </div>
            </Link>
          );
        })}
      </div>
    </Page>
  );
}

function Step({ n, label, children }: { n: number; label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-2 text-sm text-secondary-foreground">
        <span className="grid size-5 place-items-center rounded-full bg-muted text-[11px]">{n}</span>{label}
      </p>
      <div className="flex flex-wrap gap-2 pl-7">{children}</div>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${on ? "border-border-strong bg-muted text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}>
      {children}
    </button>
  );
}
