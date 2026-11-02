import { ApiFout, route } from "@/lib/api";
import { db } from "@/lib/db";
import { leesInstellingen } from "@/lib/settings";
import { youtube, youtubeZoeklink } from "@/lib/videos/youtube";
import { bewaarBron } from "@/lib/sources/opslag";
import { kenmerken, relevantie } from "@/lib/research/selectie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return route(req, async () => {
    const u = new URL(req.url).searchParams;
    const q = (u.get("q") ?? "").slice(0, 200).trim();
    if (q.length < 2) throw new ApiFout("Geef een zoekterm.");
    const d = db();
    const ctx = { db: d, instellingen: leesInstellingen(d) };
    const reden = youtube.nietBeschikbaar(ctx);
    if (reden) return { beschikbaar: false, melding: reden, zoeklink: youtubeZoeklink(q), items: [] };
    const taal = u.get("taal") === "nl" ? "nl" : u.get("taal") === "en" ? "en" : undefined;
    const r = await youtube.zoek({ tekst: q, taal, max: 15 }, ctx);
    const k = kenmerken(null, q, null);
    const items = r
      .map((x, i) => {
        const rel = relevantie({ titel: x.record.titel, samenvatting: x.record.samenvatting, brontype: x.record.brontype, toegang: "alleen metadata" }, k);
        return { id: bewaarBron(d, x.record), ...x.record, relevantie: { score: rel.score, redenen: rel.redenen.filter((t) => t !== "alleen catalogusgegevens") }, volgorde: i };
      })
      .sort((a, b) => b.relevantie.score - a.relevantie.score || a.volgorde - b.volgorde);
    return { beschikbaar: true, melding: "Gerangschikt op overeenkomst van je zoekwoorden met titel en beschrijving (metadata). Over de inhoud van de video's zegt dat niets.", zoeklink: youtubeZoeklink(q), items };
  });
}
