import { Badge } from "@/components/arc/badge/badge";
import { semaforo, semaforoLabel, semaforoTone } from "@/lib/semaforo";

export function SemaforoDot({ pct }: { pct: number }) {
  const s = semaforo(pct);
  const color = s === "verde" ? "bg-success" : s === "amarillo" ? "bg-warning" : "bg-danger";
  return <span className={`inline-block size-2 rounded-full ${color}`} aria-hidden />;
}

export function SemaforoBadge({ pct }: { pct: number }) {
  const s = semaforo(pct);
  return (
    <Badge tone={semaforoTone[s]} size="sm">
      {pct}% · {semaforoLabel[s]}
    </Badge>
  );
}
