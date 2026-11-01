import { ApiFout, route } from "@/lib/api";
import { db } from "@/lib/db";
import { ontleedVerwijzing } from "@/lib/scripture/reference";
import { commentaren, inkomendeVerwijzingen, kruisverwijzingen, verzen, woorden } from "@/lib/scripture/data";
import { motiefanalyse } from "@/lib/scripture/motieven";
import { verwijzingenVoorRef } from "@/lib/sources/connectors/verwijzingen";
import { leesInstellingen } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return route(req, () => {
    const q = new URL(req.url).searchParams.get("ref") ?? "";
    const r = ontleedVerwijzing(q)[0];
    if (!r) throw new ApiFout("Geen geldige Bijbelverwijzing (bv. ‘Gen 31:13’ of ‘Johannes 1:51’).");
    const d = db();
    const i = leesInstellingen(d);
    return {
      ref: r,
      verzen: verzen(d, r.start, r.eind, 200),
      woorden: woorden(d, r.start, Math.min(r.eind, r.start + 60)),
      motieven: motiefanalyse(d, r.start, r.eind),
      kruisverwijzingen: kruisverwijzingen(d, r.start, r.eind, 3, 60),
      inkomend: inkomendeVerwijzingen(d, r.start, r.eind, 10, 30),
      commentaren: commentaren(d, r.start, r.eind, { zonderOnzeker: !i.kerkvadersGebruiken, max: 200 }),
      doorverwijzingen: verwijzingenVoorRef(r),
    };
  });
}
