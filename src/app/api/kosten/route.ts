import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { bestedingDezeMaand } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return route(req, () => {
    const d = db();
    return {
      dezeMaandUsd: bestedingDezeMaand(d),
      perOnderzoek: d.prepare("SELECT o.id, o.vraag, o.modus, o.kosten_usd, o.budget_usd, o.gemaakt, (SELECT COUNT(*) FROM ai_gebruik g WHERE g.onderzoek = o.id) AS ai_aanroepen, (SELECT COALESCE(SUM(invoer_tokens),0) FROM ai_gebruik g WHERE g.onderzoek = o.id) AS invoer, (SELECT COALESCE(SUM(uitvoer_tokens),0) FROM ai_gebruik g WHERE g.onderzoek = o.id) AS uitvoer FROM onderzoeken o ORDER BY o.gemaakt DESC LIMIT 50").all(),
      aiPerStap: d.prepare("SELECT aanbieder, model, stap, COUNT(*) n, SUM(invoer_tokens) invoer, SUM(uitvoer_tokens) uitvoer, SUM(kosten_usd) kosten, status FROM ai_gebruik GROUP BY aanbieder, model, stap, status ORDER BY kosten DESC").all(),
      externeDiensten: d.prepare("SELECT dienst, host, COUNT(*) n, SUM(uit_cache) uit_cache, SUM(CASE WHEN fout IS NOT NULL OR status >= 400 THEN 1 ELSE 0 END) fouten, CAST(AVG(ms) AS INTEGER) gem_ms FROM externe_aanroepen GROUP BY dienst, host ORDER BY n DESC").all(),
    };
  });
}
