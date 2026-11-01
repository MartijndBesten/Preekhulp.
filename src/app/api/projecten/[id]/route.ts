import { ApiFout, leesJson, route, tekst } from "@/lib/api";
import { db, nu } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const VELDEN = ["titel", "bijbelgedeelten", "thema", "dienst", "datum", "onderzoeksvragen", "notities", "inzichten", "open_vragen", "conclusies"] as const;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(req, async () => {
    const { id } = await params;
    const d = db();
    const p = d.prepare("SELECT * FROM projecten WHERE id = ?").get(id);
    if (!p) throw new ApiFout("Niet gevonden", 404);
    return {
      project: p,
      onderzoeken: d.prepare("SELECT id, vraag, modus, status, kosten_usd, gemaakt FROM onderzoeken WHERE project = ? ORDER BY gemaakt DESC").all(id),
      bronnen: d.prepare("SELECT m.markering, m.notitie, b.id, b.titel, b.auteurs, b.jaar, b.url, b.brontype, b.toegang FROM bron_markeringen m JOIN bronnen b ON b.id = m.bron WHERE m.project = ? ORDER BY m.markering, b.titel").all(id),
      documenten: d.prepare("SELECT id, titel, soort, gemaakt FROM documenten WHERE project = ? ORDER BY gemaakt DESC").all(id),
    };
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(req, async () => {
    const { id } = await params;
    const b = await leesJson<Record<string, unknown>>(req);
    const d = db();
    for (const v of VELDEN) if (typeof b[v] === "string") d.prepare(`UPDATE projecten SET ${v} = ?, gewijzigd = ? WHERE id = ?`).run(tekst(b[v], 20000), nu(), id);
    return { ok: true };
  });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(req, async () => {
    const { id } = await params;
    db().prepare("DELETE FROM projecten WHERE id = ?").run(id);
    return { ok: true };
  });
}
