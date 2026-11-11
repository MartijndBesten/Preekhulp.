// "Wat zie ik over het hoofd?" — GET of POST {gedachte}: gratis controles (geen netwerk, geen AI).
// POST {gedachte, ai: true, akkoordRamingUsd}: één AI-ronde, alleen na expliciete keuze, met raming vooraf en binnen het onderzoeksbudget.
import { ApiFout, leesJson, route, tekst } from "@/lib/api";
import { db } from "@/lib/db";
import { isLopend } from "@/lib/research/runner";
import { overHetHoofd, overHetHoofdMetAi } from "@/lib/research/overhoofd";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(req, async () => {
    const { id } = await params;
    const r = overHetHoofd(db(), id);
    if (!r) throw new ApiFout("Onderzoek niet gevonden", 404);
    return r;
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(req, async () => {
    const { id } = await params;
    const b = await leesJson<{ gedachte?: string; ai?: boolean; akkoordRamingUsd?: number }>(req);
    const gedachte = tekst(b.gedachte, 3000).trim() || null;
    const vooraf = overHetHoofd(db(), id, gedachte);
    if (!vooraf) throw new ApiFout("Onderzoek niet gevonden", 404);
    if (b.ai !== true) return vooraf; // gratis deel
    if (isLopend(id)) throw new ApiFout("Dit onderzoek loopt nog.");
    if (!vooraf.aiMogelijk.kan) throw new ApiFout(vooraf.aiMogelijk.reden ?? "AI niet beschikbaar");
    // De gebruiker heeft een raming gezien; is die intussen hoger geworden (bv. langere gedachte, ander model), dan opnieuw laten bevestigen.
    if (typeof b.akkoordRamingUsd !== "number" || (vooraf.aiMogelijk.ramingUsd ?? Infinity) > b.akkoordRamingUsd + 1e-9) throw new ApiFout("De kostenraming is gewijzigd; bevestig opnieuw.", 409);
    try {
      return await overHetHoofdMetAi(db(), id, gedachte);
    } catch (e) {
      throw new ApiFout((e as Error).message, 400);
    }
  });
}
