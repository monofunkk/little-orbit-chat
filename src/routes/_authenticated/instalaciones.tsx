import { snapshotOptions, useSnapshot, useAction } from "@/lib/audit-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MapPin, Plus, X } from "lucide-react";
import { Page, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/arc/button/button";
import { Input } from "@/components/arc/input/input";
import { SemaforoBadge } from "@/components/semaforo-badge";
import { type TipoInstalacion } from "@/lib/domain";
import { saveInstallation } from "@/lib/audit.functions";

export const Route = createFileRoute("/_authenticated/instalaciones")({
  head: () => ({
    meta: [
      { title: "Instalaciones — Invermar Audit" },
      { name: "description", content: "Centros de cultivo, plantas, bodegas y oficinas auditadas de forma independiente." },
      { property: "og:title", content: "Instalaciones — Invermar Audit" },
      { property: "og:description", content: "Unidades operativas auditadas por separado." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(snapshotOptions),
  component: Instalaciones,
});

const tipos = ["Centro de cultivo", "Planta de proceso", "Bodega", "Oficina"] as const satisfies readonly TipoInstalacion[];

function Instalaciones() {
  const { instalaciones:lista,rol } = useSnapshot();
  const guardar=useAction((data:Parameters<typeof saveInstallation>[0]["data"])=>saveInstallation({data}));
  if(rol!=="admin") return <Page><p>Acceso restringido.</p></Page>;
  const [nueva, setNueva] = useState(false);
  const [form, setForm] = useState<{ nombre: string; ubicacion: string; tipo: TipoInstalacion }>({ nombre: "", ubicacion: "", tipo: tipos[0] });

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
            setForm({ nombre: "", ubicacion: "", tipo: tipos[0] });
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
          <div className="md:col-span-2">
            <p className="mb-2 text-sm text-secondary-foreground">Tipo</p>
            <div className="flex flex-wrap gap-2">
              {tipos.map((t) => (
                <Button variant="ghost" size="sm"
                  type="button"
                  key={t}
                  onClick={() => setForm({ ...form, tipo: t })}
                  className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${form.tipo === t ? "border-border-strong bg-muted text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}
                >
                  {t}
                </Button>
              ))}
            </div>
          </div>
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
                <p className="text-xs text-muted-foreground">{i.tipo}</p>
                <p className="mt-1 font-medium">{i.nombre}</p>
              </div>
              {i.ultimoPct !== null ? <SemaforoBadge pct={i.ultimoPct} /> : <span className="text-xs text-muted-foreground">Sin auditar</span>}
            </div>
            <div className="mt-6 flex items-center justify-between text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <MapPin className="size-3.5" /> {i.ubicacion || "—"}
              </span>
              <span>{i.rcas} RCA</span>
            </div>
          </div>
        ))}
      </div>
    </Page>
  );
}
