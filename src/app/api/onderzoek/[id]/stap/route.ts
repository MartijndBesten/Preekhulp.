import { ApiFout, leesJson, route, tekst } from "@/lib/api";
import { db } from "@/lib/db";
import { herhaalStap } from "@/lib/research/runner";
import type { StapId } from "@/lib/research/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(req, async () => {
    const { id } = await params;
    const b = await leesJson<{ stap?: string; extra?: string }>(req);
    if (!b.stap || !"ABCDEVFG".includes(b.stap) || b.stap.length !== 1) throw new ApiFout("Onbekende stap");
    void herhaalStap(db(), id, b.stap as StapId, tekst(b.extra, 1500) || undefined).catch(() => {});
    return { ok: true };
  });
}
