import { ApiFout, route } from "@/lib/api";
import { db, ftsVraag } from "@/lib/db";
import { DocumentFout, importeerDocument, MAX_BYTES } from "@/lib/documents/import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return route(req, () => {
    const d = db();
    const q = new URL(req.url).searchParams.get("q");
    const lijst = d.prepare("SELECT id, project, titel, bestandsnaam, soort, grootte, paginas, auteur, jaar, video_id, transcript_soort, gemaakt, waarschuwingen, (SELECT COUNT(*) FROM document_delen WHERE document = documenten.id) AS delen FROM documenten ORDER BY gemaakt DESC").all();
    const treffers = q
      ? d.prepare(`SELECT dd.document, dd.locatie, dd.pagina, dd.start_sec, snippet(document_delen_fts, 0, '[', ']', '…', 24) fragment, doc.titel, doc.video_id, doc.soort
                   FROM document_delen_fts JOIN document_delen dd ON dd.id = document_delen_fts.rowid JOIN documenten doc ON doc.id = dd.document
                   WHERE document_delen_fts MATCH ? ORDER BY rank LIMIT 50`).all(ftsVraag(q, "of") || '""')
      : [];
    return { documenten: lijst, treffers };
  });
}

export async function POST(req: Request) {
  return route(req, async () => {
    const lengte = Number(req.headers.get("content-length") ?? 0);
    if (lengte > MAX_BYTES + 1_000_000) throw new ApiFout("Bestand te groot", 413);
    const f = await req.formData();
    const bestand = f.get("bestand");
    if (!(bestand instanceof File)) throw new ApiFout("Geen bestand ontvangen.");
    const s = (k: string) => (typeof f.get(k) === "string" ? String(f.get(k)).slice(0, 500) : undefined);
    try {
      return await importeerDocument(db(), bestand.name, Buffer.from(await bestand.arrayBuffer()), {
        titel: s("titel"), auteur: s("auteur"), jaar: s("jaar"), bronvermelding: s("bronvermelding"), project: s("project") || null,
        videoUrl: s("videoUrl") || undefined, transcriptSoort: (s("transcriptSoort") as "automatisch" | "handmatig" | "onbekend") || undefined,
      });
    } catch (e) {
      if (e instanceof DocumentFout) throw new ApiFout(e.message);
      throw e;
    }
  });
}
