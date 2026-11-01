import { ApiFout, route } from "@/lib/api";
import { db } from "@/lib/db";
import { verwijderDocument } from "@/lib/documents/import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(req, async () => {
    const { id } = await params;
    const d = db();
    const doc = d.prepare("SELECT * FROM documenten WHERE id = ?").get(id);
    if (!doc) throw new ApiFout("Niet gevonden", 404);
    return { document: doc, delen: d.prepare("SELECT locatie, pagina, start_sec, eind_sec, tekst FROM document_delen WHERE document = ? ORDER BY volgorde").all(id) };
  });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(req, async () => {
    const { id } = await params;
    if (!verwijderDocument(db(), id)) throw new ApiFout("Niet gevonden", 404);
    return { ok: true };
  });
}
