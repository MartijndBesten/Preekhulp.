// "Wat zie ik over het hoofd?" — GET: gratis controles (geen netwerk, geen AI). POST {ai: true}: één AI-ronde,
// alleen na expliciete keuze, met raming vooraf en binnen het onderzoeksbudget.
import { ApiFout, leesJson, route } from "@/lib/api";
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
    const b = await leesJson<{ ai?: boolean; akkoordRamingUsd?: number }>(req);
    if (b.ai !== true) throw new ApiFout("Alleen de AI-ronde gaat via POST; kies die expliciet.");
    if (isLopend(id)) throw new ApiFout("Dit onderzoek loopt nog.");
    const vooraf = overHetHoofd(db(), id);
    if (!vooraf) throw new ApiFout("Onderzoek niet gevonden", 404);
    if (!vooraf.aiMogelijk.kan) throw new ApiFout(vooraf.aiMogelijk.reden ?? "AI niet beschikbaar");
    // De gebruiker heeft een raming gezien; is die intussen hoger geworden (bv. ander model), dan opnieuw laten bevestigen.
    if (typeof b.akkoordRamingUsd !== "number" || (vooraf.aiMogelijk.ramingUsd ?? Infinity) > b.akkoordRamingUsd + 1e-9) throw new ApiFout("De kostenraming is gewijzigd; bevestig opnieuw.", 409);
    try {
      return await overHetHoofdMetAi(db(), id);
    } catch (e) {
      throw new ApiFout((e as Error).message, 400);
    }
  });
}
