// Gemeenschappelijke beveiliging voor API-routes van de lokale pilot:
// alleen verzoeken met een lokale Host (tegen DNS-rebinding) en, bij wijzigingen, een Origin van dezelfde host (CSRF).
import { NextResponse } from "next/server";

const LOKAAL = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

export class ApiFout extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export function controleerVerzoek(req: Request) {
  const host = req.headers.get("host") ?? "";
  if (!LOKAAL.test(host) && process.env.PREEKHULP_EXTERN_TOEGESTAAN !== "ja") {
    throw new ApiFout("Deze pilot is alleen lokaal bereikbaar (zie README: authenticatie vóór externe toegang).", 403);
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    const origin = req.headers.get("origin");
    if (origin) {
      try {
        if (new URL(origin).host !== host) throw new Error();
      } catch {
        throw new ApiFout("Verzoek van een andere herkomst geweigerd.", 403);
      }
    }
  }
}

export function fout(e: unknown) {
  if (e instanceof ApiFout) return NextResponse.json({ fout: e.message }, { status: e.status });
  const bericht = e instanceof Error ? e.message : "Onbekende fout";
  // Veilige foutafhandeling: geen stacktraces of interne paden naar de browser.
  return NextResponse.json({ fout: bericht.replace(/\/[^\s]+\//g, "…/").slice(0, 400) }, { status: 500 });
}

export async function route<T>(req: Request, fn: () => Promise<T> | T) {
  try {
    controleerVerzoek(req);
    const r = await fn();
    return r instanceof Response ? r : NextResponse.json(r);
  } catch (e) {
    return fout(e);
  }
}

export async function leesJson<T>(req: Request, maxBytes = 200_000): Promise<T> {
  const t = await req.text();
  if (t.length > maxBytes) throw new ApiFout("Verzoek te groot", 413);
  try {
    return JSON.parse(t) as T;
  } catch {
    throw new ApiFout("Ongeldige JSON");
  }
}

export function tekst(v: unknown, max = 2000): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}
