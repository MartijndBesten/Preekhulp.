// Veilige uitgaande HTTP: vaste lijst van API-hosts voor connectors, SSRF-bescherming voor door de
// gebruiker opgegeven URL's, time-outs, groottegrens, eenvoudige rate-limit per host, cache en logging
// (alleen host/status/duur — nooit inhoud of sleutels).
import dns from "node:dns/promises";
import net from "node:net";
import type { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { nu } from "../db";

export class NetwerkFout extends Error {
  constructor(
    message: string,
    public readonly soort: "geblokkeerd" | "time-out" | "http" | "te-groot" | "netwerk" | "ongeldig" | "quotum",
    public readonly status?: number,
  ) {
    super(message);
  }
}

function isPrivaatAdres(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
    );
  }
  const l = ip.toLowerCase();
  return l === "::1" || l === "::" || l.startsWith("fc") || l.startsWith("fd") || l.startsWith("fe80") || l.startsWith("::ffff:127.") || l.startsWith("::ffff:10.") || l.startsWith("::ffff:192.168.");
}

/** Controleert een door de gebruiker opgegeven URL (bv. import van een webpagina) op SSRF-risico's. */
export async function controleerPubliekeUrl(ruw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(ruw);
  } catch {
    throw new NetwerkFout("Ongeldige URL", "ongeldig");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new NetwerkFout("Alleen http(s)-adressen zijn toegestaan", "geblokkeerd");
  if (url.username || url.password) throw new NetwerkFout("URL's met inloggegevens zijn niet toegestaan", "geblokkeerd");
  if (url.port && !["80", "443"].includes(url.port)) throw new NetwerkFout("Alleen standaardpoorten zijn toegestaan", "geblokkeerd");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || !host.includes(".")) {
    throw new NetwerkFout("Interne adressen zijn niet toegestaan", "geblokkeerd");
  }
  const adressen = net.isIP(host) ? [host] : (await dns.lookup(host, { all: true }).catch(() => [])).map((a) => a.address);
  if (!adressen.length) throw new NetwerkFout("Host niet gevonden", "netwerk");
  if (adressen.some(isPrivaatAdres)) throw new NetwerkFout("Interne of privé-adressen zijn niet toegestaan", "geblokkeerd");
  return url;
}

const laatsteAanroep = new Map<string, number>();
const MIN_INTERVAL_MS: Record<string, number> = {
  "api.openalex.org": 120,
  "api.crossref.org": 200,
  "api.semanticscholar.org": 1100,
  "api.core.ac.uk": 1100,
  "archive.org": 300,
  "openlibrary.org": 300,
  "www.googleapis.com": 150,
  "doaj.org": 300,
  "gutendex.com": 300,
  "api.unpaywall.org": 120,
  "bible.helloao.org": 100,
};

async function wachtOpBeurt(host: string) {
  const min = MIN_INTERVAL_MS[host] ?? 250;
  const vorige = laatsteAanroep.get(host) ?? 0;
  const wacht = vorige + min - Date.now();
  laatsteAanroep.set(host, Math.max(Date.now(), vorige + min));
  if (wacht > 0) await new Promise((r) => setTimeout(r, wacht));
}

export interface HaalOpties {
  db?: DatabaseSync;
  onderzoek?: string | null;
  dienst: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxBytes?: number;
  cacheSeconden?: number; // 0 = niet cachen (bv. bij licentiebeperking)
  geheimeParams?: string[]; // queryparameters die niet in de cachesleutel/logs mogen
  publiekeUrlControle?: boolean;
  herhalingen?: number; // standaard 2; 0 in tests
}

export interface HaalResultaat {
  status: number;
  tekst: string;
  uitCache: boolean;
  verouderd?: boolean; // verlopen cache gebruikt omdat de bron (tijdelijk) niet antwoordde
}

/** Afkoelperiode per host na HTTP 429: volgende verzoeken worden direct overgeslagen i.p.v. het quotum verder te belasten. */
const afkoelenTot = new Map<string, number>();
export function hostAfkoelen(host: string): number {
  return Math.max(0, (afkoelenTot.get(host) ?? 0) - Date.now());
}
export function resetAfkoeling() {
  afkoelenTot.clear();
}

function retryAfterMs(h: string | null): number | null {
  if (!h) return null;
  const s = Number(h);
  if (Number.isFinite(s)) return Math.max(0, s * 1000);
  const t = Date.parse(h);
  return Number.isFinite(t) ? Math.max(0, t - Date.now()) : null;
}

const slaap = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function haal(ruwUrl: string, o: HaalOpties): Promise<HaalResultaat> {
  const url = o.publiekeUrlControle ? await controleerPubliekeUrl(ruwUrl) : new URL(ruwUrl);
  const zonderGeheim = new URL(url.toString());
  for (const p of o.geheimeParams ?? []) zonderGeheim.searchParams.delete(p);
  const sleutel = createHash("sha256").update(o.dienst + " " + zonderGeheim.toString()).digest("hex");
  const cacheS = o.cacheSeconden ?? 24 * 3600;

  if (o.db && cacheS > 0) {
    const c = o.db.prepare("SELECT status, inhoud FROM http_cache WHERE sleutel = ? AND verloopt > ?").get(sleutel, nu()) as
      | { status: number; inhoud: string }
      | undefined;
    if (c) {
      logAanroep(o, url.host, c.status, 0, true);
      return { status: c.status, tekst: c.inhoud, uitCache: true };
    }
  }

  const verlopenCache = (): HaalResultaat | null => {
    if (!o.db || cacheS <= 0) return null;
    const c = o.db.prepare("SELECT status, inhoud FROM http_cache WHERE sleutel = ?").get(sleutel) as { status: number; inhoud: string } | undefined;
    return c ? { status: c.status, tekst: c.inhoud, uitCache: true, verouderd: true } : null;
  };

  const wacht = hostAfkoelen(url.host);
  if (wacht > 0) {
    logAanroep(o, url.host, 429, 0, false, "afkoelperiode");
    const oud = verlopenCache();
    if (oud) return oud;
    throw new NetwerkFout(`${url.host}: quotum bereikt (HTTP 429); nog ±${Math.ceil(wacht / 1000)} s afkoelen. Het onderzoek gaat verder met andere bronnen.`, "quotum", 429);
  }

  // Maximaal 2 herhalingen bij 429/5xx/netwerkfout, met Retry-After of exponentiële backoff (±1 s, ±3 s), samen hooguit ~20 s.
  const maxPogingen = o.herhalingen ?? 2;
  let r: Response | null = null;
  let t0 = Date.now();
  for (let poging = 0; ; poging++) {
    await wachtOpBeurt(url.host);
    t0 = Date.now();
    try {
      r = await fetch(url, {
        headers: { "User-Agent": "Preekhulp/0.2 (lokale onderzoeksassistent; Denckh)", Accept: "application/json, text/*;q=0.8", ...(o.headers ?? {}) },
        signal: AbortSignal.timeout(o.timeoutMs ?? 20_000),
        redirect: o.publiekeUrlControle ? "manual" : "follow",
      });
    } catch (e) {
      const fout = e as Error;
      const soort = fout.name === "TimeoutError" ? "time-out" : "netwerk";
      logAanroep(o, url.host, null, Date.now() - t0, false, soort);
      if (poging < maxPogingen) {
        await slaap(1000 * 3 ** poging);
        continue;
      }
      const oud = verlopenCache();
      if (oud) return oud;
      throw new NetwerkFout(soort === "time-out" ? `Time-out bij ${url.host}` : `Geen verbinding met ${url.host}`, soort);
    }
    if ((r.status === 429 || r.status >= 500) && poging < maxPogingen) {
      const ra = retryAfterMs(r.headers.get("retry-after"));
      logAanroep(o, url.host, r.status, Date.now() - t0, false, "herhaling");
      if (r.status === 429 && ra !== null && ra > 15_000) break; // te lang wachten: niet blokkeren, afkoelen
      await slaap(Math.min(ra ?? 1000 * 3 ** poging + Math.floor(Math.random() * 300), 15_000));
      continue;
    }
    break;
  }
  if (!r) throw new NetwerkFout(`Geen antwoord van ${url.host}`, "netwerk");
  if (r.status === 429) {
    const ra = retryAfterMs(r.headers.get("retry-after"));
    afkoelenTot.set(url.host, Date.now() + Math.min(ra ?? 60_000, 3_600_000));
    logAanroep(o, url.host, 429, Date.now() - t0, false, "quotum");
    const oud = verlopenCache();
    if (oud) return oud;
    throw new NetwerkFout(`${url.host}: quotum bereikt (HTTP 429). ${url.host === "api.openalex.org" ? "Een gratis OpenAlex-sleutel verhoogt het dagbudget (Instellingen). " : ""}Het onderzoek gaat verder met andere bronnen.`, "quotum", 429);
  }
  if (o.publiekeUrlControle && r.status >= 300 && r.status < 400) {
    const naar = r.headers.get("location");
    logAanroep(o, url.host, r.status, Date.now() - t0, false);
    if (!naar) throw new NetwerkFout("Doorverwijzing zonder doel", "http", r.status);
    return haal(new URL(naar, url).toString(), o); // nieuwe controle op het doel
  }
  const max = o.maxBytes ?? 8_000_000;
  const lengte = Number(r.headers.get("content-length") ?? 0);
  if (lengte > max) throw new NetwerkFout("Antwoord is te groot", "te-groot");
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > max) throw new NetwerkFout("Antwoord is te groot", "te-groot");
  const tekst = buf.toString("utf8");
  logAanroep(o, url.host, r.status, Date.now() - t0, false);
  if (!r.ok) throw new NetwerkFout(`${url.host} antwoordde met HTTP ${r.status}`, "http", r.status);
  if (o.db && cacheS > 0) {
    const verloopt = new Date(Date.now() + cacheS * 1000).toISOString();
    o.db.prepare("INSERT OR REPLACE INTO http_cache (sleutel, status, inhoud, opgehaald, verloopt) VALUES (?,?,?,?,?)").run(sleutel, r.status, tekst, nu(), verloopt);
  }
  return { status: r.status, tekst, uitCache: false };
}

export async function haalJson<T>(url: string, o: HaalOpties): Promise<T> {
  const r = await haal(url, o);
  try {
    return JSON.parse(r.tekst) as T;
  } catch {
    throw new NetwerkFout(`Onverwacht antwoord van ${new URL(url).host} (geen JSON)`, "ongeldig");
  }
}

function logAanroep(o: HaalOpties, host: string, status: number | null, ms: number, uitCache: boolean, fout?: string) {
  if (!o.db) return;
  try {
    o.db
      .prepare("INSERT INTO externe_aanroepen (onderzoek, dienst, host, status, ms, uit_cache, fout, gemaakt) VALUES (?,?,?,?,?,?,?,?)")
      .run(o.onderzoek ?? null, o.dienst, host, status, ms, uitCache ? 1 : 0, fout ?? null, nu());
  } catch {
    /* logging mag een zoekactie nooit laten mislukken */
  }
}
