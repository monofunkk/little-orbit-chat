import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Check, FileText, Plus, Sparkles, Trash2, UploadCloud } from "lucide-react";
import { Page, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/arc/button/button";
import { Badge } from "@/components/arc/badge/badge";
import { checklist, instalaciones, instalacionPorId, rcas, fmtFecha, type ChecklistItem } from "@/lib/mock-data";

export const Route = createFileRoute("/rca")({
  head: () => ({
    meta: [
      { title: "RCA y checklist — Invermar Audit" },
      { name: "description", content: "Sube una RCA en PDF y valida el checklist de requisitos que la IA extrae." },
      { property: "og:title", content: "RCA y checklist — Invermar Audit" },
      { property: "og:description", content: "De PDF a checklist auditable en minutos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RcaPage,
});

type Paso = "subir" | "leyendo" | "validar";

function RcaPage() {
  const [paso, setPaso] = useState<Paso>("subir");
  const [archivo, setArchivo] = useState<string | null>(null);
  const [instId, setInstId] = useState(instalaciones[0].id);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [confirmado, setConfirmado] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const procesar = (nombre: string) => {
    setArchivo(nombre);
    setPaso("leyendo");
    setConfirmado(false);
    setTimeout(() => {
      setItems(checklist.slice(0, 6).map((c) => ({ ...c, id: crypto.randomUUID() })));
      setPaso("validar");
    }, 2200);
  };

  return (
    <Page>
      <PageHeader title="RCA y checklist" subtitle="Sube la resolución y la IA propone qué revisar. Tú validas." />

      <ol className="mb-8 flex items-center gap-3 text-sm">
        {(["Subir PDF", "Lectura IA", "Validar ítems"] as const).map((l, i) => {
          const idx = paso === "subir" ? 0 : paso === "leyendo" ? 1 : 2;
          return (
            <li key={l} className={`flex items-center gap-2 ${i <= idx ? "text-foreground" : "text-muted-foreground"}`}>
              <span className={`grid size-6 place-items-center rounded-full text-xs ${i < idx || confirmado ? "bg-primary text-primary-foreground" : i === idx ? "bg-muted" : "border border-border"}`}>
                {i < idx || (confirmado && i === 2) ? <Check className="size-3" /> : i + 1}
              </span>
              {l}
              {i < 2 && <span className="mx-1 h-px w-6 bg-border" />}
            </li>
          );
        })}
      </ol>

      {paso === "subir" && (
        <div className="composer p-6">
          <p className="mb-2 text-sm text-secondary-foreground">Instalación</p>
          <div className="mb-5 flex flex-wrap gap-2">
            {instalaciones.map((i) => (
              <button
                key={i.id}
                onClick={() => setInstId(i.id)}
                className={`rounded-full border px-3.5 py-1.5 text-sm ${instId === i.id ? "border-border-strong bg-muted" : "border-border text-muted-foreground hover:text-foreground"}`}
              >
                {i.nombre}
              </button>
            ))}
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) procesar(f.name);
            }}
            className="flex w-full flex-col items-center gap-3 rounded-2xl border border-dashed border-border-strong px-6 py-14 text-center transition-colors hover:bg-muted/50"
          >
            <UploadCloud className="size-7 text-muted-foreground" />
            <span className="font-medium">Arrastra el PDF de la RCA aquí</span>
            <span className="text-sm text-muted-foreground">o haz clic para elegirlo</span>
          </button>
          <input ref={fileRef} type="file" accept="application/pdf" hidden onChange={(e) => e.target.files?.[0] && procesar(e.target.files[0].name)} />
          <button onClick={() => procesar("RCA_ejemplo_245-2019.pdf")} className="mt-3 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            Probar con una RCA de ejemplo
          </button>
        </div>
      )}

      {paso === "leyendo" && (
        <div className="composer flex flex-col items-center gap-4 p-14 text-center">
          <Sparkles className="size-6 animate-pulse" />
          <p className="font-medium">Leyendo {archivo}…</p>
          <p className="max-w-sm text-sm text-muted-foreground">Identificando compromisos, medidas y plazos para convertirlos en ítems auditables.</p>
        </div>
      )}

      {paso === "validar" && (
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {items.length} ítems propuestos para <span className="text-foreground">{instalacionPorId(instId).nombre}</span>. Edita el texto si hace falta.
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setPaso("subir")}>Subir otra</Button>
              <Button onClick={() => setConfirmado(true)} disabled={confirmado}>
                {confirmado ? "Checklist confirmado" : "Confirmar checklist"}
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {items.map((it, i) => (
              <div key={it.id} className="group rounded-2xl border border-border-subtle bg-surface p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 font-mono text-xs text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                  <textarea
                    value={it.descripcion}
                    onChange={(e) => setItems(items.map((x) => (x.id === it.id ? { ...x, descripcion: e.target.value } : x)))}
                    rows={2}
                    className="flex-1 resize-none bg-transparent text-[15px] outline-none"
                  />
                  <button onClick={() => setItems(items.filter((x) => x.id !== it.id))} aria-label="Eliminar ítem" className="text-muted-foreground opacity-0 transition-opacity hover:text-danger group-hover:opacity-100">
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 pl-7">
                  <Badge size="sm">{it.categoria}</Badge>
                  <Badge size="sm" tone="info">{it.evidencia}</Badge>
                  <Badge size="sm">{it.referencia}</Badge>
                </div>
              </div>
            ))}
            <button
              onClick={() => setItems([...items, { id: crypto.randomUUID(), rcaId: "new", descripcion: "", categoria: "Operacional", evidencia: "Fotográfica", referencia: "Manual" }])}
              className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-3 text-sm text-muted-foreground hover:text-foreground"
            >
              <Plus className="size-4" /> Agregar ítem manual
            </button>
          </div>
        </div>
      )}

      <h2 className="mb-3 mt-14 text-sm font-medium text-muted-foreground">RCA cargadas</h2>
      <div className="divide-y divide-border-subtle rounded-2xl border border-border-subtle">
        {rcas.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div className="flex items-center gap-3">
              <FileText className="size-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{r.numero} · {r.nombre}</p>
                <p className="text-xs text-muted-foreground">{instalacionPorId(r.instalacionId).nombre} · {fmtFecha(r.fecha)}</p>
              </div>
            </div>
            <div className="flex gap-1.5">
              <Badge size="sm" tone={r.estado === "Vigente" ? "success" : r.estado === "Modificada" ? "warning" : "danger"}>{r.estado}</Badge>
              <Badge size="sm" tone={r.validados ? "neutral" : "warning"}>{r.validados ? `${r.items} ítems` : "Por validar"}</Badge>
            </div>
          </div>
        ))}
      </div>
    </Page>
  );
}
