import { describe, expect, it } from "vitest";
import { porcentajeCumplimiento, semaforo } from "@/lib/semaforo";

describe("semáforo", () => {
  it("85% es verde", () => expect(semaforo(85)).toBe("verde"));
  it("84% es amarillo", () => expect(semaforo(84)).toBe("amarillo"));
  it("60% es amarillo", () => expect(semaforo(60)).toBe("amarillo"));
  it("59% es rojo", () => expect(semaforo(59)).toBe("rojo"));
  it("excluye 'no aplica' del cálculo", () =>
    expect(porcentajeCumplimiento(["cumple", "no_aplica", "no_cumple", "no_aplica"])).toBe(50));
});
