import { ApiFout, leesJson, route, tekst } from "@/lib/api";
import { db } from "@/lib/db";
import { maakOnderzoek, voerUit } from "@/lib/research/runner";
import type { Modus, OnderzoeksOpties } from "@/lib/research/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return route(req, () =>
    db().prepare("SELECT id, vraag, modus, status, kosten_usd, gemaakt, project FROM onderzoeken ORDER BY gemaakt DESC LIMIT 100").all(),
  );
}

export async function POST(req: Request) {
  return route(req, async () => {
    const b = await leesJson<Record<string, unknown>>(req);
    const vraag = tekst(b.vraag, 8000).trim();
    if (vraag.length < 3) throw new ApiFout("Beschrijf wat je wilt onderzoeken.");
    const modus: Modus = b.modus === "verkennen" || b.modus === "kritisch" ? b.modus : "verdiepen";
    const o = (b.opties ?? {}) as Record<string, unknown>;
    const opties: OnderzoeksOpties = {
      bijbelgedeelte: tekst(o.bijbelgedeelte, 300) || undefined,
      thema: tekst(o.thema, 300) || undefined,
      dienst: tekst(o.dienst, 100) || undefined,
      traditie: tekst(o.traditie, 100) || undefined,
      doelgroep: tekst(o.doelgroep, 200) || undefined,
      preekgedachte: tekst(o.preekgedachte, 2000) || undefined,
      voorkeursauteurs: tekst(o.voorkeursauteurs, 500) || undefined,
      budgetUsd: typeof o.budgetUsd === "number" && o.budgetUsd >= 0 ? o.budgetUsd : undefined,
      zonderExtern: o.zonderExtern === true,
    };
    const project = typeof b.project === "string" && b.project ? b.project : null;
    const d = db();
    const id = maakOnderzoek(d, vraag, modus, opties, project);
    void voerUit(d, id); // achtergrond; de interface volgt de voortgang
    return { id };
  });
}
