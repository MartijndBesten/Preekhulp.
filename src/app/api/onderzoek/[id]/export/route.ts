import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { laadDossier, naarMarkdown } from "@/lib/reports/dossier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(req, async () => {
    const { id } = await params;
    const x = laadDossier(db(), id);
    if (!x) return new Response("Niet gevonden", { status: 404 });
    return new Response(naarMarkdown(x), {
      headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": `attachment; filename="onderzoeksdossier-${id}.md"` },
    });
  });
}
