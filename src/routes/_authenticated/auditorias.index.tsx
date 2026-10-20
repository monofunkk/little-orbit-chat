import { snapshotOptions, useSnapshot, useAction } from "@/lib/audit-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronRight, Plus, X } from "lucide-react";
import { Page, PageHeader, useRol } from "@/components/app-shell";
import { Button } from "@/components/arc/button/button";
import { Badge } from "@/components/arc/badge/badge";
import { Input } from "@/components/arc/input/input";
import { SemaforoDot } from "@/components/semaforo-badge";
import { fmtFecha, estadoTone, checklistInstalacion } from "@/lib/domain";
import { assignAudit } from "@/lib/audit.functions";
import { porcentajeCumplimiento } from "@/lib/semaforo";

export const Route = createFileRoute("/_authenticated/auditorias/")({
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
  loader: ({ context }) => context.queryClient.ensureQueryData(snapshotOptions),
  component: Auditorias,
});


function Auditorias() {
  const { rol, userId, auditorias:lista, instalaciones, rcas, pertinencias, supervisores } = useSnapshot();
  const asignar=useAction((data:Parameters<typeof assignAudit>[0]["data"])=>assignAudit({data}));
  const instalacionPorId=(id:string)=>instalaciones.find(i=>i.id===id);
  const [crear, setCrear] = useState(false);
  const [f, setF] = useState({ inst: instalaciones[0]?.id ?? "", sup: supervisores[0]?.id ?? "", fecha: "" });
  const visibles = rol === "admin" ? lista : lista.filter((a) => a.supervisorId === userId);
  const rcaInst = rcas.find((r) => r.instalacionId === f.inst);
  const checklist = checklistInstalacion(rcaInst, pertinencias);
  const pertInst = pertinencias.filter((p) => p.rcaId === rcaInst?.id && p.validados).length;

  return (
    <Page>
      <PageHeader
        title={rol === "admin" ? "Auditorías" : "Mis auditorías"}
        subtitle={rol === "admin" ? "Elige la instalación, el supervisor y la fecha: el checklist sale de su RCA, la normativa y sus pertinencias." : "Abre una auditoría para completar el checklist."}
        action={rol === "admin" && <Button onClick={() => setCrear(true)}><Plus className="size-4" /> Nueva auditoría</Button>}
      />

      {crear && (
        <form
          onSubmit={async(e) => {
            e.preventDefault();
            if (!checklist.length || !f.fecha) return;
            await asignar.mutateAsync(f);
            setCrear(false);
          }}
          className="composer mb-8 flex flex-col gap-6 p-6"
        >
          <div className="flex items-center justify-between">
            <p className="font-medium">Nueva auditoría</p>
            <Button variant="ghost" size="sm" type="button" onClick={() => setCrear(false)} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground"><X className="size-4" /></Button>
          </div>
          <Step n={1} label="Instalación">
            {instalaciones.map((i) => (
              <Chip key={i.id} on={f.inst === i.id} onClick={() => setF({ ...f, inst: i.id })}>{i.nombre}</Chip>
            ))}
          </Step>
          <Step n={2} label="Checklist">
            {checklist.length ? (
              <span className="text-sm text-secondary-foreground">
                {checklist.length} ítems: RCA {rcaInst?.numero || rcaInst?.nombre}
                {pertInst ? ` + ${pertInst} pertinencia${pertInst > 1 ? "s" : ""}` : ""}, con la normativa del tipo
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">
                {rcaInst ? (rcaInst.estado === "Revocada" ? "La RCA de esta instalación está revocada." : "Confirma el checklist en RCA y checklist antes de auditar.") : "Esta instalación aún no tiene RCA ni checklist."}{" "}
                <Link to="/rca" className="underline">Ir a RCA y checklist</Link>
              </span>
            )}
          </Step>
          <Step n={3} label="Supervisor">
            {supervisores.map((s) => <Chip key={s.id} on={f.sup === s.id} onClick={() => setF({ ...f, sup: s.id })}>{s.nombre}</Chip>)}
          </Step>
          <Step n={4} label="Fecha límite">
            <div className="w-56"><Input label="Fecha" type="date" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} /></div>
          </Step>
          <div><Button type="submit" loading={asignar.isPending} disabled={!checklist.length || !f.fecha || !f.sup}>Asignar auditoría</Button></div>
        </form>
      )}

      {!visibles.length && <p className="py-12 text-center text-muted-foreground">No hay auditorías asignadas.</p>}
      <div className="divide-y divide-border-subtle rounded-2xl border border-border-subtle">
        {visibles.map((a) => {
          const pct = porcentajeCumplimiento(a.respuestas);
          const evaluada = a.respuestas.some((r) => r === "cumple" || r === "no_cumple");
          return (
            <Link key={a.id} to="/auditorias/$id" params={{ id: a.id }} className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-muted/40">
              <div className="flex items-center gap-3">
                {evaluada ? <SemaforoDot pct={pct} /> : <span className="size-2 rounded-full bg-border-strong" />}
                <div>
                  <p className="text-sm font-medium">{instalacionPorId(a.instalacionId)?.nombre}</p>
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
    <button type="button" aria-pressed={on} onClick={onClick} className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${on ? "border-foreground bg-muted text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}>
      {children}
    </button>
  );
}
