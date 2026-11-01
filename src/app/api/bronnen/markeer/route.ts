import { ApiFout, leesJson, route, tekst } from "@/lib/api";
import { db, nu } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MARKERINGEN = ["relevant", "later lezen", "kritisch perspectief", "gebruikt", "niet relevant"];

export async function POST(req: Request) {
  return route(req, async () => {
    const b = await leesJson<{ project?: string; bron?: string; markering?: string; notitie?: string }>(req);
    if (!b.project || !b.bron) throw new ApiFout("Project en bron zijn verplicht.");
    const d = db();
    if (!b.markering) {
      d.prepare("DELETE FROM bron_markeringen WHERE project = ? AND bron = ?").run(b.project, b.bron);
      return { ok: true };
    }
    if (!MARKERINGEN.includes(b.markering)) throw new ApiFout("Onbekende markering");
    d.prepare("INSERT OR REPLACE INTO bron_markeringen (project, bron, markering, notitie, gewijzigd) VALUES (?,?,?,?,?)").run(b.project, b.bron, b.markering, tekst(b.notitie, 2000), nu());
    return { ok: true };
  });
}
