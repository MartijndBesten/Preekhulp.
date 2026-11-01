import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { raming } from "@/lib/research/runner";
import type { Modus } from "@/lib/research/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return route(req, () => {
    const m = new URL(req.url).searchParams.get("modus");
    const modus: Modus = m === "verkennen" || m === "kritisch" ? m : "verdiepen";
    return raming(db(), modus);
  });
}
