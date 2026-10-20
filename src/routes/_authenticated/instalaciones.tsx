import { snapshotOptions, useSnapshot, useAction } from "@/lib/audit-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, MapPin, Plus, X } from "lucide-react";
import { Page, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/arc/button/button";
import { Input } from "@/components/arc/input/input";
import { SemaforoBadge } from "@/components/semaforo-badge";
import { tiposInstalacion, tipoLabel, tipoDescripcion, type TipoInstalacion } from "@/lib/domain";
import { saveInstallation } from "@/lib/audit.functions";

export const Route = createFileRoute("/_authenticated/instalaciones")({
  head: () => ({
    meta: [
      { title: "Instalaciones — Invermar Audit" },
      { name: "description", content: "Pisciculturas, centros, plantas de proceso y empresa, auditadas de forma independiente." },
      { property: "og:title", content: "Instalaciones — Invermar Audit" },
      { property: "og:description", content: "Unidades operativas auditadas por separado." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(snapshotOptions),
  component: Instalaciones,
});


function Instalaciones() {
  const { instalaciones:lista,rol,rcas } = useSnapshot();
  const guardar=useAction((data:Parameters<typeof saveInstallation>[0]["data"])=>saveInstallation({data}));
  const [nueva, setNueva] = useState(false);
  const [form, setForm] = useState<{ nombre: string; ubicacion: string; tipo: TipoInstalacion }>({ nombre: "", ubicacion: "", tipo: "piscicultura" });
  if(rol!=="admin") return <Page><p>Acceso restringido.</p></Page>;

  return (
    <Page>
      <PageHeader
        title="Instalaciones"
        subtitle="Cada instalación se audita por separado."
        action={
          <Button onClick={() => setNueva(true)}>
            <Plus className="size-4" /> Nueva instalación
          </Button>
        }
      />

      {nueva && (
        <form
          onSubmit={async(e) => {
            e.preventDefault();
            if (!form.nombre) return;
            await guardar.mutateAsync(form);
            setForm({ nombre: "", ubicacion: "", tipo: "piscicultura" });
            setNueva(false);
          }}
          className="composer mb-6 grid gap-4 p-5 md:grid-cols-2"
        >
          <div className="flex items-center justify-between md:col-span-2">
            <p className="font-medium">Nueva instalación</p>
            <Button variant="ghost" size="sm" type="button" onClick={() => setNueva(false)} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </Button>
          </div>
          <Input label="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Centro Quellón" />
          <Input label="Ubicación" value={form.ubicacion} onChange={(e) => setForm({ ...form, ubicacion: e.target.value })} placeholder="Comuna, región" />
          <fieldset className="md:col-span-2">
            <legend className="mb-2 text-sm text-secondary-foreground">Tipo</legend>
            <div role="radiogroup" aria-label="Tipo de instalación" className="grid gap-2 sm:grid-cols-2">
              {tiposInstalacion.map((t) => {
                const on = form.tipo === t;
                return (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={on}
                    key={t}
                    onClick={() => setForm({ ...form, tipo: t })}
                    className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-colors ${on ? "border-foreground bg-muted" : "border-border hover:border-border-strong"}`}
                  >
                    <span className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border ${on ? "border-foreground bg-foreground text-background" : "border-border-strong"}`}>{on && <Check className="size-3" />}</span>
                    <span>
                      <span className="block text-sm font-medium">{tipoLabel[t]}</span>
                      <span className="block text-xs text-muted-foreground">{tipoDescripcion[t]}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
          <div className="md:col-span-2">
            <Button type="submit" loading={guardar.isPending}>Guardar</Button>
          </div>
        </form>
      )}

      {!lista.length && <p className="py-12 text-center text-muted-foreground">Aún no hay instalaciones.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {lista.map((i) => (
          <div key={i.id} className="rounded-2xl border border-border-subtle bg-surface p-5 transition-colors hover:border-border">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">{tipoLabel[i.tipo] ?? i.tipo}</p>
                <p className="mt-1 font-medium">{i.nombre}</p>
              </div>
              {i.ultimoPct !== null ? <SemaforoBadge pct={i.ultimoPct} /> : <span className="text-xs text-muted-foreground">Sin auditar</span>}
            </div>
            <div className="mt-6 flex items-center justify-between text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <MapPin className="size-3.5" /> {i.ubicacion || "—"}
              </span>
              <span>{rcas.find((r) => r.instalacionId === i.id)?.validados ? "Checklist confirmado" : i.rcas ? "RCA por validar" : "Sin RCA"}{i.pertinencias ? ` · ${i.pertinencias} pertinencia${i.pertinencias > 1 ? "s" : ""}` : ""}</span>
            </div>
          </div>
        ))}
      </div>
    </Page>
  );
}
