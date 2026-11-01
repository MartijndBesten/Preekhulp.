import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { controleerBronnen } from "@/lib/sources/controle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return route(req, () => controleerBronnen(db()));
}
