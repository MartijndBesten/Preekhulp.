import { ApiFout, leesJson, route, tekst } from "@/lib/api";
import { db, nieuweId, nu } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return route(req, () => db().prepare("SELECT p.*, (SELECT COUNT(*) FROM onderzoeken o WHERE o.project = p.id) AS onderzoeken FROM projecten p ORDER BY gewijzigd DESC").all());
}

export async function POST(req: Request) {
  return route(req, async () => {
    const b = await leesJson<Record<string, unknown>>(req);
    const titel = tekst(b.titel, 300).trim();
    if (!titel) throw new ApiFout("Titel is verplicht.");
    const id = nieuweId("p");
    db().prepare("INSERT INTO projecten (id, titel, bijbelgedeelten, thema, dienst, datum, gemaakt, gewijzigd) VALUES (?,?,?,?,?,?,?,?)").run(
      id, titel, tekst(b.bijbelgedeelten, 500), tekst(b.thema, 300), tekst(b.dienst, 100), tekst(b.datum, 20), nu(), nu(),
    );
    return { id };
  });
}
