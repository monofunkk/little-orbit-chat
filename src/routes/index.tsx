import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowUp, Building2, ClipboardCheck, FileUp, Inbox, Sparkles } from "lucide-react";
import { useRol } from "@/components/app-shell";
import { auditorias, instalacionPorId, fmtFecha } from "@/lib/mock-data";
import { porcentajeCumplimiento } from "@/lib/semaforo";
import { SemaforoDot } from "@/components/semaforo-badge";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Inicio — Invermar Audit" },
      { name: "description", content: "Tu panel de auditorías ambientales: qué revisar hoy y cómo va cada instalación." },
      { property: "og:title", content: "Inicio — Invermar Audit" },
      { property: "og:description", content: "Qué revisar hoy y cómo va cada instalación." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const sugerenciasAdmin = [
  { label: "Subir una RCA", to: "/rca", icon: FileUp },
  { label: "Asignar auditoría", to: "/auditorias", icon: ClipboardCheck },
  { label: "Revisar pendientes", to: "/revision", icon: Inbox },
  { label: "Ver instalaciones", to: "/instalaciones", icon: Building2 },
] as const;

function Index() {
  const { rol } = useRol();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const hora = new Date().getHours();
  const saludo = hora < 12 ? "Buenos días" : hora < 20 ? "Buenas tardes" : "Buenas noches";
  const mias = auditorias.filter((a) => a.supervisor === "Camila Soto" && ["Asignada", "En progreso", "Rechazada"].includes(a.estado));
  const enRevision = auditorias.filter((a) => a.estado === "En revisión");

  const go = () => {
    const t = q.toLowerCase();
    if (t.includes("rca") || t.includes("subir")) navigate({ to: "/rca" });
    else if (t.includes("revis")) navigate({ to: "/revision" });
    else if (t.includes("instal")) navigate({ to: "/instalaciones" });
    else if (t.includes("report")) navigate({ to: "/reportes" });
    else navigate({ to: "/auditorias" });
  };

  return (
    <div className="glow-top relative flex min-h-[calc(100vh-4rem)] flex-col items-center px-5 md:min-h-screen">
      <div className="flex w-full max-w-2xl flex-1 flex-col justify-center py-16">
        <div className="mb-10 text-center">
          <span className="mb-5 inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-secondary-foreground">
            <Sparkles className="size-3" /> Checklists generados con IA desde tus RCA
          </span>
          <h1 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">
            {saludo}, <span className="ink-gradient">{rol === "admin" ? "Andrea" : "Camila"}</span>
          </h1>
          <p className="mt-3 text-muted-foreground">
            {rol === "admin" ? "¿Qué quieres hacer hoy?" : `Tienes ${mias.length} auditorías por completar.`}
          </p>
        </div>

        {rol === "admin" ? (
          <>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                go();
              }}
              className="composer flex items-center gap-2 p-2 pl-5"
            >
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Ej: revisar auditorías pendientes, subir RCA…"
                className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
              />
              <button type="submit" aria-label="Ir" className="grid size-10 place-items-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95">
                <ArrowUp className="size-4" />
              </button>
            </form>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {sugerenciasAdmin.map(({ label, to, icon: Icon }) => (
                <Link key={to} to={to} className="inline-flex items-center gap-2 rounded-full border border-border px-3.5 py-2 text-sm text-secondary-foreground transition-colors hover:bg-muted hover:text-foreground">
                  <Icon className="size-3.5" /> {label}
                </Link>
              ))}
            </div>

            <div className="mt-14 grid grid-cols-3 gap-3 text-center">
              <Stat n={enRevision.length} label="Por revisar" />
              <Stat n={auditorias.filter((a) => ["Asignada", "En progreso"].includes(a.estado)).length} label="En terreno" />
              <Stat n={auditorias.filter((a) => a.estado === "Aprobada").length} label="Aprobadas" />
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-2">
            {mias.map((a) => {
              const inst = instalacionPorId(a.instalacionId);
              const hechos = a.respuestas.filter(Boolean).length;
              return (
                <Link
                  key={a.id}
                  to="/auditorias/$id"
                  params={{ id: a.id }}
                  className="composer flex items-center justify-between gap-4 p-5 transition-transform hover:-translate-y-0.5"
                >
                  <div>
                    <p className="font-medium">{inst.nombre}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Vence {fmtFecha(a.fechaLimite)} · {hechos} ítems revisados
                    </p>
                  </div>
                  <span className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground">
                    {hechos ? "Continuar" : "Comenzar"}
                  </span>
                </Link>
              );
            })}
            {enRevision.filter((a) => a.supervisor === "Camila Soto").map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-2xl px-5 py-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-2">
                  <SemaforoDot pct={porcentajeCumplimiento(a.respuestas)} />
                  {instalacionPorId(a.instalacionId).nombre}
                </span>
                <span>Enviada a revisión</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="rounded-2xl border border-border-subtle py-4">
      <p className="font-display text-2xl font-semibold">{n}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
