import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Page, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/arc/button/button";
import { SemaforoBadge } from "@/components/semaforo-badge";
import { auditorias, instalacionPorId, fmtFecha } from "@/lib/mock-data";
import { porcentajeCumplimiento } from "@/lib/semaforo";

export const Route = createFileRoute("/reportes")({
  head: () => ({
    meta: [
      { title: "Reportes — Invermar Audit" },
      { name: "description", content: "Descarga en PDF los informes de auditorías aprobadas." },
      { property: "og:title", content: "Reportes — Invermar Audit" },
      { property: "og:description", content: "Informes PDF de auditorías aprobadas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Reportes,
});

function Reportes() {
  const aprobadas = auditorias.filter((a) => a.estado === "Aprobada");
  return (
    <Page>
      <PageHeader title="Reportes" subtitle="Informe en PDF de cada auditoría aprobada." />
      <div className="flex flex-col gap-3">
        {aprobadas.map((a) => (
          <div key={a.id} className="composer flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <p className="font-medium">{instalacionPorId(a.instalacionId).nombre}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{a.supervisor} · {fmtFecha(a.fechaLimite)}</p>
            </div>
            <div className="flex items-center gap-3">
              <SemaforoBadge pct={porcentajeCumplimiento(a.respuestas)} />
              <Button variant="secondary" size="sm" onClick={() => toast("La descarga de PDF se activará al conectar el servidor.")}>
                <Download className="size-4" /> PDF
              </Button>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-8 text-center text-sm text-muted-foreground">El historial consolidado por instalación llega en la fase 2.</p>
    </Page>
  );
}
