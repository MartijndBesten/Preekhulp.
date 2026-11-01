import { ApiFout, route } from "@/lib/api";
import { db } from "@/lib/db";
import { ontleedVerwijzing } from "@/lib/scripture/reference";
import { CONNECTORS } from "@/lib/sources/registry";
import { bewaarBron, bewaarPassage } from "@/lib/sources/opslag";
import { verwijzingenVoorZoekterm } from "@/lib/sources/connectors/verwijzingen";
import { leesInstellingen } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return route(req, async () => {
    const u = new URL(req.url).searchParams;
    const q = (u.get("q") ?? "").slice(0, 300).trim();
    if (q.length < 2) throw new ApiFout("Geef een zoekterm.");
    const gekozen = (u.get("bronnen") ?? "").split(",").filter(Boolean);
    const d = db();
    const ctx = { db: d, instellingen: leesInstellingen(d) };
    const refs = ontleedVerwijzing(q);
    const lijst = CONNECTORS.filter((c) => (gekozen.length ? gekozen.includes(c.kaart.id) : !c.ondersteunt.netwerk));
    const resultaten = await Promise.all(
      lijst.map(async (c) => {
        const reden = c.nietBeschikbaar(ctx);
        if (reden) return { connector: c.kaart.id, naam: c.kaart.naam, status: "overgeslagen", melding: reden, items: [] };
        try {
          const r = await c.zoek({ tekst: q, refs, max: 10, taal: (u.get("taal") as "nl" | "en") || undefined }, ctx);
          const items = r.map((x) => {
            const id = bewaarBron(d, x.record);
            for (const p of x.passages.slice(0, 8)) bewaarPassage(d, id, p);
            return { id, ...x.record, passages: x.passages.slice(0, 8) };
          });
          return { connector: c.kaart.id, naam: c.kaart.naam, status: "ok", melding: null, items };
        } catch (e) {
          return { connector: c.kaart.id, naam: c.kaart.naam, status: "fout", melding: (e as Error).message, items: [] };
        }
      }),
    );
    return { resultaten, doorverwijzingen: verwijzingenVoorZoekterm(q) };
  });
}
