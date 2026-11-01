import { ApiFout, leesJson, route, tekst } from "@/lib/api";
import { db } from "@/lib/db";
import { vergelijkVideos } from "@/lib/videos/vergelijk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return route(req, async () => {
    const b = await leesJson<{ documenten?: string[]; vraag?: string }>(req);
    if (!Array.isArray(b.documenten)) throw new ApiFout("Kies documenten.");
    try {
      return await vergelijkVideos(db(), b.documenten.map(String), tekst(b.vraag, 1000));
    } catch (e) {
      throw new ApiFout((e as Error).message);
    }
  });
}
