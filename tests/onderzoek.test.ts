// Integratietest van de workflow op echte (gekopieerde) tekstdata, met een nep-AI-aanbieder die
// bewust een niet-bestaande verwijzing en een verzonnen citaat aanlevert: die moeten worden afgevangen.
import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { heeftData, maakTestDataMap, vulTestDb } from "./helpers";

const t = heeftData ? describe : describe.skip;

t("Onderzoeksworkflow (Genesis 31:13)", () => {
  let d: import("node:sqlite").DatabaseSync;
  beforeAll(async () => {
    const map = maakTestDataMap();
    d = await vulTestDb(map);
  }, 120_000);

  it("zonder AI: tekst, grondtaal, motieven, commentaren en dossier; geen verzonnen inhoud", async () => {
    const { maakOnderzoek, voerUit } = await import("../src/lib/research/runner");
    const { laadDossier, naarMarkdown } = await import("../src/lib/reports/dossier");
    const id = maakOnderzoek(d, "Genesis 31:13. PKN-doopdienst, thema ‘Terug naar de belofte’.", "verkennen", { zonderExtern: true }, null);
    await voerUit(d, id);
    const x = laadDossier(d, id)!;
    expect(x.status).toBe("klaar");
    expect(x.stappen.find((s) => s.id === "E")?.status).toBe("klaar_zonder_ai");
    const md = naarMarkdown(x);
    expect(md).toContain("Genesis 28:18–22"); // berekend tekstverband
    expect(md).toContain("Kanttekeningen");
    expect(md).toContain("H5088"); // gelofte
    expect(x.beweringen.every((b) => b.herkomst === "data")).toBe(true);
    expect(x.beweringen.filter((b) => b.niveau === "direct_aangetoond").every((b) => b.verwijzingen.length > 0)).toBe(true);
  }, 60_000);

  it("met (nep-)AI: niet-bestaande verwijzingen en niet-teruggevonden citaten worden gecorrigeerd", async () => {
    const ai = await import("../src/lib/ai");
    const { bewaarInstellingen } = await import("../src/lib/settings");
    bewaarInstellingen(d, { aiAanbieder: "anthropic" });
    ai.zetNepAanbieder((taak) => {
      const leeg = { kernvraag: "k", afbakening_wel: [], afbakening_niet: [], aannames: [], onderscheid: { exegese: "", dogmatiek: "", homiletiek: "" }, te_verifieren: [], plan: ["p"], extra_bijbelgedeelten: ["Genesis 35:1-15"] };
      if (taak.stap === "A-vraag") return leeg;
      if (taak.stap === "B-zoekvragen") return { zoekvragen: [] };
      if (taak.stap === "D-beoordeling") return { beoordelingen: [] };
      if (taak.stap === "G-tegenlezing") return { punten: [], zoekvragen_tegenperspectief: [], eindoordeel: "ok" };
      const b = (tekst: string, niveau: string, verwijzingen: { label: string; citaat: string | null }[]) => ({ tekst, niveau, verwijzingen });
      return {
        context: [], grondtaal: [], historische_uitleg: [], hedendaagse_uitleg: [], bijbelse_theologie: [], dogmatiek: [], homiletiek: [], overeenstemming: [], verschillen: [], tekst_vs_later: [], nieuwe_lijnen: [], open_vragen: ["v"],
        exegese: [
          b("Verzonnen bron", "direct_aangetoond", [{ label: "E9999", citaat: null }]),
          b("Verzonnen citaat", "direct_aangetoond", [{ label: "E1", citaat: "dit staat nergens in de tekst" }]),
        ],
      };
    });
    try {
      const { maakOnderzoek, voerUit } = await import("../src/lib/research/runner");
      const { laadDossier } = await import("../src/lib/reports/dossier");
      const id = maakOnderzoek(d, "Genesis 31:13 Terug naar de belofte", "verdiepen", { zonderExtern: true }, null);
      await voerUit(d, id);
      const x = laadDossier(d, id)!;
      expect(x.status).toBe("klaar");
      const verzonnen = x.beweringen.find((b) => b.tekst === "Verzonnen bron")!;
      expect(verzonnen.niveau).toBe("niet_geverifieerd");
      expect(verzonnen.controle.onbekend).toEqual(["E9999"]);
      const citaat = x.beweringen.find((b) => b.tekst === "Verzonnen citaat")!;
      expect(citaat.niveau).not.toBe("direct_aangetoond");
      expect(citaat.verwijzingen[0].citaat).toBeNull();
      expect(x.a?.refs.some((r) => r.label === "Genesis 35:1–15")).toBe(true);
    } finally {
      ai.zetNepAanbieder(null);
      bewaarInstellingen(d, { aiAanbieder: "geen" });
    }
  }, 60_000);

  it("budget: een AI-stap boven het resterende budget wordt vóór elke netwerkaanroep geweigerd", async () => {
    const ai = await import("../src/lib/ai");
    const { bewaarInstellingen } = await import("../src/lib/settings");
    const { z } = await import("zod");
    bewaarInstellingen(d, { aiAanbieder: "anthropic", anthropicModel: "claude-opus-5-5" });
    process.env.PREEKHULP_ANTHROPIC_KEY = "sk-test-niet-echt";
    const fetchVoor = globalThis.fetch;
    let netwerk = false;
    globalThis.fetch = (async () => { netwerk = true; throw new Error("geen netwerk in test"); }) as typeof fetch;
    try {
      await expect(ai.vraagJson(d, { stap: "x", systeem: "s", invoer: "i".repeat(10000), schema: z.object({ a: z.string() }), maxTokens: 16000 }, { resterendBudgetUsd: 0.01 })).rejects.toMatchObject({ code: "budget" });
      expect(netwerk).toBe(false);
    } finally {
      globalThis.fetch = fetchVoor;
      delete process.env.PREEKHULP_ANTHROPIC_KEY;
      bewaarInstellingen(d, { aiAanbieder: "geen" });
    }
  });
});

describe("Evaluatie is afgeschermd", () => {
  it("de onderzoekscode leest de referentiepreek nooit", () => {
    const bestanden: string[] = [];
    const loop = (p: string) => { for (const f of fs.readdirSync(p)) { const q = path.join(p, f); fs.statSync(q).isDirectory() ? loop(q) : bestanden.push(q); } };
    loop(path.join(process.cwd(), "src"));
    for (const f of bestanden) expect(fs.readFileSync(f, "utf8")).not.toMatch(/evaluatie\/referentie|genesis31-preek/);
  });
});
