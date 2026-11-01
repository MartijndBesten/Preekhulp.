import { ApiFout, route } from "@/lib/api";
import { db } from "@/lib/db";
import { leesInstellingen } from "@/lib/settings";
import { youtube, youtubeZoeklink } from "@/lib/videos/youtube";
import { bewaarBron } from "@/lib/sources/opslag";

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
    return { beschikbaar: true, melding: "Relevantie op basis van metadata (titel/beschrijving); inhoud niet geverifieerd.", zoeklink: youtubeZoeklink(q), items: r.map((x) => ({ id: bewaarBron(d, x.record), ...x.record })) };
  });
}
