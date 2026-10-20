export type Respuesta = "cumple" | "no_cumple" | "no_aplica" | null;
export type Semaforo = "verde" | "amarillo" | "rojo";

/** % de cumplimiento excluyendo "no aplica" y pendientes. */
export function porcentajeCumplimiento(respuestas: Respuesta[]): number {
  const evaluables = respuestas.filter((r) => r === "cumple" || r === "no_cumple");
  if (evaluables.length === 0) return 0;
  const ok = evaluables.filter((r) => r === "cumple").length;
  return Math.round((ok / evaluables.length) * 100);
}

/** Verde 85–100, Amarillo 60–84, Rojo < 60. */
export function semaforo(pct: number): Semaforo {
  if (pct >= 85) return "verde";
  if (pct >= 60) return "amarillo";
  return "rojo";
}

export const semaforoLabel: Record<Semaforo, string> = {
  verde: "Satisfactorio",
  amarillo: "Requiere atención",
  rojo: "Crítico",
};

export const semaforoTone = { verde: "success", amarillo: "warning", rojo: "danger" } as const;
