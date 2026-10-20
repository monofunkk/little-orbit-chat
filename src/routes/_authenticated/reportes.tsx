import { snapshotOptions, useSnapshot, useAction } from "@/lib/audit-query";
import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Page, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/arc/button/button";
import { SemaforoBadge } from "@/components/semaforo-badge";
import { fmtFecha } from "@/lib/domain";
import { downloadReport } from "@/lib/documents";
import { getFileUrl } from "@/lib/audit.functions";
import { useState } from "react";
import { porcentajeCumplimiento } from "@/lib/semaforo";

export const Route = createFileRoute("/_authenticated/reportes")({
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
  loader: ({ context }) => context.queryClient.ensureQueryData(snapshotOptions),
  component: Reportes,
});

function Reportes() {
  const {auditorias,instalaciones,evidencias,rol}=useSnapshot();
  const [busy,setBusy]=useState<string|null>(null);
  const instalacionPorId=(id:string)=>instalaciones.find(i=>i.id===id);
  if(rol!=="admin")return <Page><p>Acceso restringido.</p></Page>;
  const aprobadas = auditorias.filter((a) => a.estado === "Aprobada");
  return (
    <Page>
      <PageHeader title="Reportes" subtitle="Informe en PDF de cada auditoría aprobada." />
      <div className="flex flex-col gap-3">
        {aprobadas.map((a) => (
          <div key={a.id} className="composer flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <p className="font-medium">{instalacionPorId(a.instalacionId)?.nombre}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{a.supervisor} · {fmtFecha(a.fechaLimite)}</p>
            </div>
            <div className="flex items-center gap-3">
              <SemaforoBadge pct={porcentajeCumplimiento(a.respuestas)} />
              <Button variant="secondary" size="sm" loading={busy===a.id} disabled={busy!==null} onClick={async()=>{setBusy(a.id);try{await downloadReport(a,instalacionPorId(a.instalacionId),evidencias.filter(e=>e.auditoriaId===a.id),async(path)=>(await getFileUrl({data:{bucket:"audit-evidence",path}})).url);}catch(e){toast.error(e instanceof Error?e.message:"No se pudo descargar el informe.");}finally{setBusy(null)}}}>
                <Download className="size-4" /> PDF
              </Button>
            </div>
          </div>
        ))}
      </div>
      {!aprobadas.length&&<p className="py-12 text-center text-muted-foreground">No hay auditorías aprobadas para exportar.</p>}
    </Page>
  );
}
