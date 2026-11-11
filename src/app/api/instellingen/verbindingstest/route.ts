// Gratis verbindingstest (alleen modelinformatie opvragen, geen tekstgeneratie). Sleutel blijft op de server.
import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { testVerbinding } from "@/lib/ai/verbinding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return route(req, () => testVerbinding(db()));
}
