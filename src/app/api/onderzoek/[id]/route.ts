import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { laadDossier } from "@/lib/reports/dossier";
import { isLopend, verwijderOnderzoek } from "@/lib/research/runner";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(req, async () => {
    const { id } = await params;
    const x = laadDossier(db(), id);
    if (!x) return NextResponse.json({ fout: "Onderzoek niet gevonden" }, { status: 404 });
    return { ...x, lopend: isLopend(id) };
  });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(req, async () => {
    const { id } = await params;
    verwijderOnderzoek(db(), id);
    return { ok: true };
  });
}
