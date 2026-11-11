// Evaluatie-opzet: reproduceerbare steekproef, tekstsignalen, en geen betaalde run zonder --akkoord.
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { bronclaimsInTekst, signaalTekst, steekproef } from "../scripts/evaluatie-lib";

describe("Genesis 31-evaluatie", () => {
  it("steekproef is reproduceerbaar per zaad en verschilt tussen zaden", () => {
    const l = Array.from({ length: 40 }, (_, i) => i);
    expect(steekproef(l, 5, "2026-11-01sonnet")).toEqual(steekproef(l, 5, "2026-11-01sonnet"));
    expect(steekproef(l, 5, "2026-11-01sonnet")).not.toEqual(steekproef(l, 5, "2026-11-01opus"));
    expect(new Set(steekproef(l, 5, "x")).size).toBe(5);
  });
  it("tekstsignalen herkennen verwijzingen en trefwoorden, en zeggen 'niet gevonden' als iets ontbreekt", () => {
    const t = "In Genesis 28:20 doet Jakob een gelofte. Volgens Wenham (1994) is Betel de plaats van de belofte.";
    expect(signaalTekst(t, { nr: 4, punt: "gelofte", refs: ["Genesis 28:20-22"], woorden: ["gelofte"], lemmas: [] }).signaal).toBe("genoemd");
    expect(signaalTekst(t, { nr: 9, punt: "Joh 1:51", refs: ["John 1:51"], woorden: ["Mensenzoon"], lemmas: [] }).signaal).toBe("niet gevonden");
    expect(bronclaimsInTekst(t)).toHaveLength(2);
  });
  it("een betaalde variant stopt zonder --akkoord, vóór enige aanroep", () => {
    let uit = "";
    try {
      execFileSync("npx", ["tsx", "scripts/evaluatie.ts", "--variant", "opus"], { encoding: "utf8", stdio: "pipe", env: { ...process.env, PREEKHULP_DATA_DIR: process.env.PREEKHULP_DATA_DIR ?? "" } });
    } catch (e) {
      uit = String((e as { stderr?: string }).stderr) + String((e as { stdout?: string }).stdout);
      expect((e as { status?: number }).status).toBe(2);
    }
    expect(uit).toMatch(/Gestopt: variant 'opus' maakt betaalde AI-aanroepen/);
  }, 60_000);
});
