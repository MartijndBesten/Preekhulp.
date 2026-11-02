// Exporteert echte, vooraf berekende Preekhulp-uitkomsten (zonder AI, zonder externe bronnen) als compacte JSON
// voor de pagina denckh.nl/preekhulp/probeer/ (map public/preekhulp/voorbeelden/). Kost niets; raakt geen netwerk.
// Gebruik: npx tsx scripts/voorbeelden-export.ts <denckh>/public/preekhulp/voorbeelden
// Alleen vrij bruikbare data: SV/Kanttekeningen (CC0), BSB (PD), STEP (CC BY 4.0, attributie), OpenBible (CC BY),
// Calvijn en Matthew Henry (PD). Geen eigen documenten, geen AI-tekst.
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { openDb } from "../src/lib/db";
import { bewaarInstellingen, leesInstellingen } from "../src/lib/settings";
import { maakOnderzoek, verwijderOnderzoek, voerUit } from "../src/lib/research/runner";
import { laadDossier } from "../src/lib/reports/dossier";
import { signalen } from "../src/lib/research/overhoofd";
import { verzen, woorden } from "../src/lib/scripture/data";
import { BOEKEN } from "../src/lib/scripture/books";

const VOORBEELDEN = [
  { id: "genesis-31-13", titel: "Genesis 31:13", sub: "Doopdienst · thema ‘Terug naar de belofte’", vraag: "Ik bereid een doopdienst voor vanuit Genesis 31:13 met als thema ‘Terug naar de belofte’.", opties: { bijbelgedeelte: "Genesis 31:13", thema: "Terug naar de belofte", dienst: "doopdienst" }, gedachte: "God roept Jakob terug naar Betel, naar de belofte van toen. Zo roept God ons in de doop terug naar zijn verbond." },
  { id: "psalm-23-1-4", titel: "Psalm 23:1–4", sub: "Rouwdienst · thema ‘Niet alleen in het dal’", vraag: "Psalm 23:1-4 voor een rouwdienst, thema ‘Niet alleen in het dal’.", opties: { bijbelgedeelte: "Psalm 23:1-4", thema: "Niet alleen in het dal", dienst: "rouwdienst" }, gedachte: "De Heer is als een herder die met ons meegaat, ook door de schaduw van de dood. Jezus is de goede herder (Johannes 10)." },
  { id: "lucas-15-20", titel: "Lucas 15:20", sub: "Gewone eredienst · thema ‘Van verre gezien’", vraag: "Lucas 15:20 in een gewone eredienst, thema ‘Van verre gezien’.", opties: { bijbelgedeelte: "Lucas 15:20", thema: "Van verre gezien", dienst: "reguliere eredienst" }, gedachte: "De vader rent zijn zoon tegemoet nog voordat die zijn schuld heeft beleden: genade gaat voor berouw." },
];

const kort = (s: string | null | undefined, n: number) => (s && s.length > n ? s.slice(0, n).replace(/\s+\S*$/, "") + " …" : s ?? "");
const schoon = (w: string) => w.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}]/gu, "");

async function main() {
  const uit = process.argv[2];
  if (!uit) throw new Error("Geef een uitvoermap.");
  fs.mkdirSync(uit, { recursive: true });
  const d = openDb();
  const oud = leesInstellingen(d);
  const commit = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  const index: unknown[] = [];
  try {
    bewaarInstellingen(d, { aiAanbieder: "geen" });
    for (const v of VOORBEELDEN) {
      const id = maakOnderzoek(d, v.vraag, "verdiepen", { ...v.opties, zonderExtern: true }, null);
      await voerUit(d, id);
      const x = laadDossier(d, id)!;
      const a = x.a!;
      // Bewijsstukken die de berekende beweringen gebruiken, plus de oude uitleg bij de focusverzen
      const gebruikt = new Set(x.beweringen.flatMap((b) => b.verwijzingen.map((r) => r.label)));
      const bewijs = x.bewijs
        .filter((r) => gebruikt.has(r.label) || (r.soort === "commentaar" && /^commentaar:focus|^tekst:focus|commentaar/.test(r.herkomst) && r.herkomst.includes("focus")))
        .map((r) => ({ label: r.label, soort: r.soort, bron: r.bron_titel, locatie: r.locatie, tekst: kort(r.tekst, r.soort === "commentaar" ? 1400 : 900), url: r.url }));
      const commentaarFocus = x.bewijs.filter((r) => r.soort === "commentaar" && r.herkomst.includes("focus"));
      for (const r of commentaarFocus) if (!bewijs.some((b) => b.label === r.label)) bewijs.push({ label: r.label, soort: r.soort, bron: r.bron_titel, locatie: r.locatie, tekst: kort(r.tekst, 1400), url: r.url });
      const ws = woorden(d, a.focus!.start, a.focus!.eind);
      const ctx = a.context ?? a.focus!;
      const ctxVerzen = verzen(d, ctx.start, ctx.eind, 200);
      const tekstWoorden = [...new Set(ctxVerzen.flatMap((q) => `${q.teksten.SV ?? ""} ${q.teksten.BSB ?? ""}`.split(/[^\p{L}]+/u).filter(Boolean).map(schoon)))].sort();
      const data = {
        id: v.id, titel: v.titel, sub: v.sub, vraag: v.vraag, voorbeeldGedachte: v.gedachte,
        berekend: { datum: new Date().toISOString().slice(0, 10), preekhulpCommit: commit, modus: "verdiepen", ai: false, externeBronnen: false },
        focus: x.focusTekst.map((q) => ({ label: q.label, SV: q.teksten.SV ?? null, BSB: q.teksten.BSB ?? null })),
        context: ctxVerzen.length > 1 ? `${ctxVerzen[0].label} – ${ctxVerzen[ctxVerzen.length - 1].label}` : null,
        woorden: ws.filter((w) => w.vorm.trim()).map((w) => ({ vkey: w.vkey, taal: w.taal, vorm: w.vorm, translit: w.translit, lemma: w.lemma, strong: w.strong, glosse: w.glosse, lex: kort(w.lex_glosse, 120) || null, morf: kort((w.morf_uitleg ?? w.morf ?? "").replace(/Function=/, ""), 110) || null })),
        beweringen: x.beweringen.map((b) => ({ id: b.id, sectie: b.sectie, tekst: b.tekst, niveau: b.niveau, verwijzingen: b.verwijzingen.map((r) => r.label) })),
        bewijs,
        interteksten: (x.c?.motieven?.interteksten ?? []).slice(0, 8).map((it) => ({ label: it.label, gedeeld: it.gedeeld.slice(0, 4).map((g) => `${g.lemma} ‘${g.glosse.split(/[:;,]/)[0]}’`), zelfdeBoek: it.zelfdeBoek })),
        ntVerbanden: (x.c?.motieven?.ntVerbanden ?? []).slice(0, 5).map((n) => ({ label: n.label, stemmen: n.stemmen, via: n.via })),
        overHetHoofd: signalen(x, null, d),
        // Voor de vereenvoudigde gedachtecontrole in de browser
        controle: {
          tekstWoorden,
          kandidaten: [
            ...(x.c?.motieven?.interteksten ?? []).slice(0, 5).map((it) => ({ label: it.label, waarom: `deelt zeldzame woorden met de tekst (${it.gedeeld.slice(0, 3).map((g) => g.glosse.split(/[:;,]/)[0]).join(", ")})` })),
            ...(x.c?.motieven?.ntVerbanden ?? []).filter((n) => n.stemmen >= 10).slice(0, 2).map((n) => ({ label: n.label, waarom: `vaak genoemde kruisverwijzing (${n.stemmen} stemmen)` })),
          ],
        },
        bronnen: x.bronnen.map((b) => ({ titel: b.titel, brontype: b.brontype, licentie: b.rechten.licentie ?? null, ladder: b.ladder.tekst })),
      };
      fs.writeFileSync(path.join(uit, `${v.id}.json`), JSON.stringify(data));
      index.push({ id: v.id, titel: v.titel, sub: v.sub });
      console.log(`${v.id}: ${Math.round(JSON.stringify(data).length / 1024)} KB · ${data.beweringen.length} beweringen · ${data.bewijs.length} bewijsstukken · ${data.overHetHoofd.length} signalen`);
      verwijderOnderzoek(d, id);
    }
  } finally {
    bewaarInstellingen(d, { aiAanbieder: oud.aiAanbieder });
  }
  fs.writeFileSync(path.join(uit, "index.json"), JSON.stringify({ voorbeelden: index, boeknamen: [...new Set(BOEKEN.flatMap((b) => [b.nl, b.en, ...b.aliassen]).map((n) => n.toLowerCase()))] }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
