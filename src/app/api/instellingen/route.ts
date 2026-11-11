import { leesJson, route } from "@/lib/api";
import { db } from "@/lib/db";
import { aanbiederStatus } from "@/lib/ai";
import { verbindingStatus } from "@/lib/ai/verbinding";
import { ANTHROPIC_MODELLEN } from "@/lib/ai/prijzen";
import { bewaarGeheim, bewaarInstellingen, GEHEIM_NAMEN, geheimStatus, leesInstellingen, type GeheimNaam, type Instellingen } from "@/lib/settings";
import { alleBronkaarten } from "@/lib/sources/registry";
import { dataBeschikbaar } from "@/lib/scripture/data";
import { json } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return route(req, () => {
    const d = db();
    const i = leesInstellingen(d);
    const controle = d.prepare("SELECT waarde FROM meta WHERE sleutel = 'bronnencontrole'").get() as { waarde: string } | undefined;
    return { instellingen: i, geheimen: geheimStatus(), ai: aanbiederStatus(i), verbinding: verbindingStatus(d), modellen: ANTHROPIC_MODELLEN, bronkaarten: alleBronkaarten(), data: dataBeschikbaar(d), laatsteControle: json(controle?.waarde, null) };
  });
}

export async function POST(req: Request) {
  return route(req, async () => {
    const b = await leesJson<{ instellingen?: Partial<Instellingen>; geheimen?: Partial<Record<GeheimNaam, string | null>> }>(req);
    const d = db();
    if (b.instellingen) {
      const i = b.instellingen;
      const schoon: Partial<Instellingen> = {};
      if (i.aiAanbieder && ["geen", "anthropic", "openai", "ollama"].includes(i.aiAanbieder)) schoon.aiAanbieder = i.aiAanbieder;
      if (typeof i.anthropicModel === "string" && ANTHROPIC_MODELLEN.some((m) => m.id === i.anthropicModel)) schoon.anthropicModel = i.anthropicModel;
      for (const k of ["openaiModel", "ollamaModel"] as const) if (typeof i[k] === "string") schoon[k] = String(i[k]).slice(0, 100);
      for (const k of ["budgetPerOnderzoekUsd", "maandbudgetUsd", "openaiPrijsInvoer", "openaiPrijsUitvoer"] as const) if (typeof i[k] === "number" && i[k]! >= 0 && i[k]! < 10000) schoon[k] = i[k];
      if (i.inspanning && ["low", "medium", "high", "xhigh", "max"].includes(i.inspanning)) schoon.inspanning = i.inspanning;
      for (const k of ["voorkeursauteurs", "tradities", "uitgeschakeldeConnectors"] as const) if (Array.isArray(i[k])) schoon[k] = (i[k] as string[]).map(String).slice(0, 50);
      if (i.eigenDocumentenNaarAi === "nooit" || i.eigenDocumentenNaarAi === "fragmenten") schoon.eigenDocumentenNaarAi = i.eigenDocumentenNaarAi;
      if (typeof i.kerkvadersGebruiken === "boolean") schoon.kerkvadersGebruiken = i.kerkvadersGebruiken;
      bewaarInstellingen(d, schoon);
    }
    for (const [k, v] of Object.entries(b.geheimen ?? {})) if (k in GEHEIM_NAMEN) bewaarGeheim(k as GeheimNaam, v ? String(v).slice(0, 400) : null);
    return { ok: true, geheimen: geheimStatus() };
  });
}
