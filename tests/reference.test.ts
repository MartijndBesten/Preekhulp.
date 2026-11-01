import { describe, expect, it } from "vitest";
import { ontleedVerwijzing, vindVerwijzingenInTekst } from "../src/lib/scripture/reference";
import { vindBoek } from "../src/lib/scripture/books";

const label = (s: string) => ontleedVerwijzing(s).map((r) => r.label);

describe("Bijbelverwijzingen", () => {
  it("herkent Nederlandse en Engelse boeknamen en afkortingen", () => {
    expect(vindBoek("Gen")?.osis).toBe("Gen");
    expect(vindBoek("Joh.")?.osis).toBe("John");
    expect(vindBoek("John")?.osis).toBe("John");
    expect(vindBoek("1 Kor")?.osis).toBe("1Cor");
    expect(vindBoek("I Sam")?.osis).toBe("1Sam");
    expect(vindBoek("Hand")?.osis).toBe("Acts");
    expect(vindBoek("Jo")).toBeNull(); // dubbelzinnig: Job, Joël, Jona, Jozua, Johannes
  });
  it("ontleedt verzen, reeksen, hoofdstukken en meerdere delen", () => {
    expect(label("Genesis 31:13")).toEqual(["Genesis 31:13"]);
    expect(label("Gen. 31:1-16")).toEqual(["Genesis 31:1–16"]);
    expect(label("Gen 31,13")).toEqual(["Genesis 31:13"]);
    expect(label("Gen 31")).toEqual(["Genesis 31"]);
    expect(label("Gen 31:55-32:2")).toEqual(["Genesis 31:55–32:2"]);
    expect(label("Gen 28:10-22; 35:1-15")).toEqual(["Genesis 28:10–22", "Genesis 35:1–15"]);
    expect(label("Gen 31:13, 19")).toEqual(["Genesis 31:13", "Genesis 31:19"]);
    expect(label("Joh 1:51")).toEqual(["Johannes 1:51"]);
  });
  it("weigert onmogelijke hoofdstukken", () => {
    expect(label("Genesis 51:1")).toEqual([]);
  });
  it("vindt verwijzingen in vrije tekst zonder gewone woorden als boek te zien", () => {
    const r = vindVerwijzingenInTekst("Ik preek over Genesis 31:13 en Joh. 1:51; in maart 2026 is dat 5 jaar geleden.");
    expect(r.map((x) => x.label)).toEqual(["Genesis 31:13", "Johannes 1:51"]);
  });
});
