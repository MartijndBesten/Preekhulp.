// Open het originele (privé) bestand, bv. /api/documenten/<id>/bestand#page=3 voor een PDF-pagina.
// Alleen lokaal (zie controleerVerzoek); nooit als download van een willekeurig pad: id wordt in de database opgezocht.
import fs from "node:fs";
import path from "node:path";
import { ApiFout, route } from "@/lib/api";
import { db, dataDir } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPE: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain; charset=utf-8",
  md: "text/plain; charset=utf-8",
  srt: "text/plain; charset=utf-8",
  vtt: "text/plain; charset=utf-8",
};

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(req, async () => {
    const { id } = await params;
    const doc = db().prepare("SELECT soort, bestandsnaam FROM documenten WHERE id = ?").get(id) as { soort: string; bestandsnaam: string } | undefined;
    if (!doc || !TYPE[doc.soort]) throw new ApiFout("Niet gevonden", 404);
    const p = path.join(dataDir(), "uploads", `${id}.${doc.soort}`);
    if (!fs.existsSync(p)) throw new ApiFout("Het originele bestand is niet meer aanwezig.", 404);
    const inline = doc.soort !== "docx";
    return new Response(new Uint8Array(fs.readFileSync(p)), {
      headers: {
        "Content-Type": TYPE[doc.soort],
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(doc.bestandsnaam)}`,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox",
        "Cache-Control": "no-store",
      },
    });
  });
}
