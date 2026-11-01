// Preken/lezingen vergelijken — alleen op basis van aanwezige transcripten (eigen bibliotheek).
// Zonder transcript geen inhoudelijke vergelijking; tijdstippen komen uitsluitend uit het transcript.
import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { DATA_NIET_INSTRUCTIE, promptBronnen, vraagJson } from "../ai";
import { controleer, NIVEAUS, type Bewijs } from "../verification/claims";
import { tijdLink } from "./youtube";

const Ref = z.object({ label: z.string(), citaat: z.string().nullable() });
const Punt = z.object({ tekst: z.string(), niveau: z.enum(NIVEAUS), verwijzingen: z.array(Ref) });
const Schema = z.object({
  per_video: z.array(
    z.object({
      document: z.string(),
      centrale_uitleg: z.array(Punt),
      bijbelteksten: z.array(z.string()),
      christologische_verbanden: z.array(Punt),
      dogmatische_uitgangspunten: z.array(Punt),
      pastorale_toepassingen: z.array(Punt),
      opvallende_inzichten: z.array(Punt),
      mogelijke_exegetische_zwaktes: z.array(Punt),
    }),
  ),
  overeenkomsten: z.array(Punt),
  verschillen: z.array(Punt),
});

export async function vergelijkVideos(d: DatabaseSync, documentIds: string[], vraag: string) {
  const docs = documentIds
    .slice(0, 5)
    .map((id) => d.prepare("SELECT id, titel, auteur, video_id, transcript_soort FROM documenten WHERE id = ?").get(id) as { id: string; titel: string; auteur: string | null; video_id: string | null; transcript_soort: string | null } | undefined)
    .filter((x): x is NonNullable<typeof x> => !!x);
  if (docs.length < 2) throw new Error("Kies minstens twee preken met een aangeleverd transcript.");
  const bewijs = new Map<string, Bewijs & { url: string | null; locatie: string; doc: string }>();
  const fragmenten: { label: string; type: string; herkomst: string; tekst: string }[] = [];
  let n = 0;
  for (const doc of docs) {
    const delen = d.prepare("SELECT locatie, start_sec, tekst FROM document_delen WHERE document = ? ORDER BY volgorde").all(doc.id) as { locatie: string; start_sec: number | null; tekst: string }[];
    let tekens = 0;
    for (const dl of delen) {
      if (tekens > 30_000) break;
      tekens += dl.tekst.length;
      const label = `T${++n}`;
      const url = doc.video_id && dl.start_sec != null ? tijdLink(doc.video_id, dl.start_sec) : null;
      bewijs.set(label, { label, soort: "transcript", tekst: dl.tekst, brontype: "preek/lezing (video)", bronTitel: doc.titel, url, locatie: dl.locatie, doc: doc.id });
      fragmenten.push({ label, type: `transcript (${doc.transcript_soort ?? "onbekend"})`, herkomst: `${doc.titel} — ${dl.locatie}`, tekst: dl.tekst });
    }
  }
  const r = await vraagJson(
    d,
    {
      stap: "video-vergelijking",
      systeem: `Je vergelijkt preken/lezingen op basis van hun transcripten voor een predikant. Onderscheid wat een spreker letterlijk zegt van jouw afleiding. Elke bewering verwijst naar transcriptlabels (T…); citaten alleen letterlijk en kort. Neem ideeën over zonder lange passages te reproduceren. Geef per video het documentnummer zoals in de lijst. ${DATA_NIET_INSTRUCTIE}`,
      invoer: `Vraag van de predikant: ${vraag || "Vergelijk deze preken inhoudelijk."}\nVideo's: ${docs.map((x, i) => `${i + 1}. document=${x.id} — ${x.titel}${x.auteur ? ` (${x.auteur})` : ""}`).join("; ")}\n\n${promptBronnen(fragmenten)}`,
      schema: Schema,
      maxTokens: 10000,
    },
    {},
  );
  const verrijk = (p: z.infer<typeof Punt>) => {
    const k = controleer(p.niveau, p.verwijzingen, bewijs);
    return { ...p, niveau: k.niveau, controle: k.controle, verwijzingen: k.verwijzingen.map((v) => ({ ...v, url: bewijs.get(v.label)?.url ?? null, locatie: bewijs.get(v.label)?.locatie ?? null })) };
  };
  return {
    docs,
    per_video: r.data.per_video.map((v) => ({
      ...v,
      centrale_uitleg: v.centrale_uitleg.map(verrijk), christologische_verbanden: v.christologische_verbanden.map(verrijk), dogmatische_uitgangspunten: v.dogmatische_uitgangspunten.map(verrijk),
      pastorale_toepassingen: v.pastorale_toepassingen.map(verrijk), opvallende_inzichten: v.opvallende_inzichten.map(verrijk), mogelijke_exegetische_zwaktes: v.mogelijke_exegetische_zwaktes.map(verrijk),
    })),
    overeenkomsten: r.data.overeenkomsten.map(verrijk),
    verschillen: r.data.verschillen.map(verrijk),
    kostenUsd: r.kostenUsd,
  };
}
