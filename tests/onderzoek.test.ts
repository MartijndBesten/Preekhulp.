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

  it("Wat zie ik over het hoofd?: concrete signalen uit het dossier, zonder AI en zonder netwerk", async () => {
    const { maakOnderzoek, voerUit } = await import("../src/lib/research/runner");
    const { overHetHoofd } = await import("../src/lib/research/overhoofd");
    const id = maakOnderzoek(d, "Ik bereid een doopdienst voor vanuit Genesis 31:13 met als thema ‘Terug naar de belofte’.", "verkennen", { zonderExtern: true }, null);
    await voerUit(d, id);
    const r = overHetHoofd(d, id)!;
    // Thema: 'belofte' en 'doop' staan niet in de tekst van Genesis 31 (SV/BSB) → interpretatieve stap benoemen
    expect(r.signalen.find((s) => s.soort === "thema")?.titel).toMatch(/doop/);
    // Verhaalelementen of tekstverbanden die het dossier niet benut
    expect(r.signalen.some((s) => s.soort === "tekst" || s.soort === "verband")).toBe(true);
    expect(r.signalen.some((s) => s.soort === "perspectief")).toBe(true);
    expect(r.ai).toBeNull();
    expect(r.aiMogelijk.kan).toBe(false);
    // Met voorlopige gedachte: niet-genoemde gedeelten en begrippen buiten de tekst
    const g = overHetHoofd(d, id, "God roept Jakob terug naar Betel (Genesis 28:10-22), naar de belofte; zo roept God ons in de doop terug naar het verbond, als sacrament van genade.")!;
    const nietGenoemd = g.signalen.find((s) => s.titel.startsWith("Je gedachte noemt"));
    expect(nietGenoemd).toBeTruthy();
    expect(nietGenoemd!.verzen!.some((v) => v.startsWith("Genesis 28"))).toBe(false);
    const begrippen = g.signalen.find((s) => s.titel.startsWith("Begrippen uit je gedachte"))!.toelichting;
    expect(begrippen).toMatch(/sacrament/);
    expect(begrippen).not.toMatch(/verbond/); // staat in Gen 31:44 (SV): geen vals signaal
    expect(begrippen).not.toMatch(/Genesis/); // boeknaam is geen begrip
    // Woorden in exact dezelfde verzen worden één signaal
    const sleutels = r.signalen.filter((s) => s.soort === "tekst").map((s) => (s.verzen ?? []).join(","));
    expect(new Set(sleutels).size).toBe(sleutels.length);
  }, 60_000);

  it("YouTube-link in de vraag: met transcript tijdlinks als bewijs, zonder transcript geen inhoudelijke uitspraken", async () => {
    const { maakOnderzoek, voerUit } = await import("../src/lib/research/runner");
    const { laadDossier, naarMarkdown } = await import("../src/lib/reports/dossier");
    const { importeerDocument } = await import("../src/lib/documents/import");
    const srt = "1\n00:02:05,000 --> 00:02:09,000\nIk ben de God van Betel, zegt de HEERE.\n";
    await importeerDocument(d, "preek.srt", Buffer.from(srt), { titel: "Testpreek Betel", videoUrl: "https://youtu.be/AAAAAAAAAAA", transcriptSoort: "automatisch" });
    const id = maakOnderzoek(d, "Genesis 31:13. Vergelijk https://youtu.be/AAAAAAAAAAA en https://www.youtube.com/watch?v=BBBBBBBBBBB", "verkennen", { zonderExtern: true }, null);
    await voerUit(d, id);
    const x = laadDossier(d, id)!;
    const [met, zonder] = x.c!.videos!;
    expect(met.transcript).toBe("Testpreek Betel");
    expect(met.melding).toMatch(/Automatisch gegenereerd/);
    const r = x.bewijs.find((b) => b.label === met.labels[0])!;
    expect(r.url).toBe("https://www.youtube.com/watch?v=AAAAAAAAAAA&t=125s");
    expect(r.locatie).toBe("2:05–2:09");
    expect(zonder.transcript).toBeNull();
    expect(zonder.labels).toEqual([]);
    expect(x.bewijs.some((b) => b.url?.includes("BBBBBBBBBBB"))).toBe(false);
    expect(naarMarkdown(x)).toContain("geen uitspraken over de inhoud, citaten of tijdstippen");
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
      if (taak.stap === "G-tegenlezing") return { punten: [], zoekvragen_tegenperspectief: [], steuncontrole: [{ bewering: "C9999", oordeel: "ondersteunt_niet", toelichting: "bestaat niet" }], eindoordeel: "ok" };
      const b = (tekst: string, niveau: string, verwijzingen: { label: string; citaat: string | null }[]) => ({ tekst, niveau, verwijzingen, interpretatieve_stap: null, tegenverwijzingen: [], onzekerheid: null });
      if (taak.stap === "W-over-het-hoofd") return { blinde_vlekken: [{ soort: "mogelijke_fout", titel: "Verzonnen invalshoek", waarom: "x", wat_te_onderzoeken: "y", niveau: "direct_aangetoond", verwijzingen: [{ label: "E7777", citaat: null }] }, { soort: "ontbrekende_context", titel: "Gilead-steenhoop", waarom: "verbond Laban", wat_te_onderzoeken: "z", niveau: "mogelijke_onderzoekslijn", verwijzingen: [] }] };
      if (taak.stap === "V-verdieping") return { onderwerpen: [{ onderwerp: "terafim", waarom_in_de_tekst: [b("Verdieping met verzonnen bron", "onderbouwde_interpretatie", [{ label: "E8888", citaat: null }])], wat_uitleggers_zeggen: [], samenhang_elders: [], alternatieve_verklaringen: [], wat_de_tekst_niet_zegt: ["motief van Rachel"] }] };
      return {
        context: [], grondtaal: [], historische_uitleg: [], hedendaagse_uitleg: [], bijbelse_theologie: [], dogmatiek: [], homiletiek: [], overeenstemming: [], verschillen: [], tekst_vs_later: [], nieuwe_lijnen: [], open_vragen: ["v"],
        verdieping_voorstellen: [{ onderwerp: "Rachel en de terafim", waarom: "onverwacht", bijbelgedeelten: ["Genesis 31:19"], zoektermen: ["teraphim Rachel"] }],
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
      // Verdiepingsronde: onderwerp uit de AI-analyse, met de verzen en uitleg bij Gen 31:19 als bewijs
      const v = x.stappen.find((s) => s.id === "V");
      expect(v?.status).toBe("klaar");
      expect(x.bewijs.some((r) => r.herkomst.startsWith("verdieping:") && r.locatie.includes("31:19"))).toBe(true);
      expect(x.beweringen.find((b) => b.tekst === "Verdieping met verzonnen bron")?.niveau).toBe("niet_geverifieerd");
      // Statusladder: wat naar de AI ging, is gemarkeerd
      expect(x.bewijs.some((r) => r.naar_ai === 1)).toBe(true);
      expect(x.bronnen.some((b) => b.ladder.niveau >= 5)).toBe(true);
      expect(x.bronnen.every((b) => b.toegang === "volledige tekst" || b.toegang === "transcript" || b.ladder.niveau <= 3)).toBe(true);
      // Claim-bronmatrix: alleen AI-beweringen; verzonnen verwijzing staat er zonder bewijs in
      // Over het hoofd met AI: raming vooraf, verzonnen verwijzing → niet geverifieerd
      const oh = await import("../src/lib/research/overhoofd");
      expect(oh.overHetHoofd(d, id)!.aiMogelijk.kan).toBe(true);
      const met = await oh.overHetHoofdMetAi(d, id);
      expect(met.ai!.vlekken[0].niveau).toBe("niet_geverifieerd");
      expect(met.ai!.vlekken[0].verwijzingen).toEqual([]);
      expect(oh.overHetHoofd(d, id)!.ai?.vlekken).toHaveLength(2);
      expect(x.matrix.length).toBe(x.beweringen.filter((b) => b.herkomst === "ai").length);
      expect(x.matrix.find((m) => m.tekst === "Verzonnen bron")?.bewijs).toEqual([]);
      const { naarMarkdown } = await import("../src/lib/reports/dossier");
      const md = naarMarkdown(x);
      expect(md).toContain("### Claim-bronmatrix");
      expect(md).toContain("Dat zegt níet dat de uitleg juist is");
      expect(md).toContain("### Verdiepingsronde");
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
