// YouTube: ontdekken via de officiële Data API (metadata), plus URL-herkenning en tijdlinks.
// Transcripten van video's van anderen worden NIET via omwegen opgehaald. Alleen:
//  1. door de gebruiker aangeleverde SRT/VTT/TXT-transcripten (zie documents/),
//  2. ondertitels van eigen video's (gebruiker exporteert zelf via YouTube Studio),
//  3. eigen/toegestane audio getranscribeerd met een lokaal model (buiten deze versie; zie README).
// Zonder transcript: alleen metadata, uitdrukkelijk als 'niet inhoudelijk geverifieerd'.
import { haalJson } from "../http/veilig";
import { geheim } from "../settings";
import type { BronRecord, Connector, Passage } from "../sources/types";

export function videoIdUitUrl(invoer: string): string | null {
  const s = invoer.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s);
    const host = u.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") return /^[\w-]{11}/.exec(u.pathname.slice(1))?.[0] ?? null;
    if (host === "youtube.com" || host === "youtube-nocookie.com" || host === "music.youtube.com") {
      if (u.searchParams.get("v")) return /^[\w-]{11}/.exec(u.searchParams.get("v")!)?.[0] ?? null;
      const m = /^\/(?:embed|shorts|live|v)\/([\w-]{11})/.exec(u.pathname);
      return m?.[1] ?? null;
    }
  } catch {
    return null;
  }
  return null;
}

export function tijdLink(videoId: string, seconden: number): string {
  return `https://www.youtube.com/watch?v=${videoId}&t=${Math.max(0, Math.floor(seconden))}s`;
}

export function tijdLabel(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const u = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return u ? `${u}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
}

/** ISO-8601-duur (PT1H2M3S) → seconden. */
export function duurSeconden(iso?: string | null): number | null {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso ?? "");
  return m ? Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) : null;
}

export const youtube: Connector = {
  kaart: {
    id: "youtube", naam: "YouTube Data API v3 (ontdekken van preken en lezingen)", website: "https://developers.google.com/youtube/v3", categorie: "Video en preken",
    zoekmogelijkheden: "Zoeken op tekst (Bijbelgedeelte, thema, predikant), taalvoorkeur; titel, kanaal, beschrijving, datum, duur",
    api: "search.list (100 quota-eenheden per aanroep) + videos.list (1 eenheid); API-sleutel van Google Cloud",
    toegangsvoorwaarden: "YouTube API Services Terms; captions.download alleen met OAuth en (in de praktijk) voor eigen video's — niet voor willekeurige video's van derden",
    licentie: "Metadata via API; video-inhoud blijft van de maker", volledigeTekst: "Nee — transcript alleen via de gebruiker (eigen bestand/eigen kanaal)",
    actualiteit: "Actueel", kosten: "Gratis binnen dagquotum (standaard 10.000 eenheden ≈ 100 zoekopdrachten)", uitvoerbaarheid: "Hoog voor metadata",
    geschiktheidPilot: "Hoog voor ontdekken; inhoudelijke analyse alleen met aangeleverd transcript",
    status: "gedeeltelijk", statusToelichting: "Werkt na invoer van een eigen sleutel; niet live getest in de ontwikkelomgeving. Relevantie zonder transcript = alleen op metadata.",
    getest: "URL-herkenning, tijdlinks en transcriptimport getest (unit-tests); API-aanroep niet live getest.",
  },
  ondersteunt: { zoeken: true, metadata: true, inhoud: "nee", verificatie: false, netwerk: true },
  nietBeschikbaar: () => (geheim("youtube") ? null : "Geen YouTube-sleutel ingesteld (zie Instellingen). Zonder sleutel: zoeklink naar YouTube."),
  async zoek(v, ctx) {
    const key = geheim("youtube")!;
    const p = new URLSearchParams({ part: "snippet", q: v.tekst, type: "video", maxResults: String(Math.min(v.max ?? 10, 25)), key, safeSearch: "none" });
    if (v.taal) p.set("relevanceLanguage", v.taal);
    type Item = { id?: { videoId?: string }; snippet?: { title?: string; channelTitle?: string; description?: string; publishedAt?: string; channelId?: string } };
    const j = await haalJson<{ items?: Item[] }>(`https://www.googleapis.com/youtube/v3/search?${p}`, { db: ctx.db, onderzoek: ctx.onderzoek, dienst: "youtube", geheimeParams: ["key"], cacheSeconden: 7 * 24 * 3600 });
    const ids = (j.items ?? []).map((i) => i.id?.videoId).filter((x): x is string => !!x);
    const duur = new Map<string, number | null>();
    if (ids.length) {
      try {
        const dj = await haalJson<{ items?: { id: string; contentDetails?: { duration?: string } }[] }>(
          `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${ids.join(",")}&key=${encodeURIComponent(key)}`,
          { db: ctx.db, onderzoek: ctx.onderzoek, dienst: "youtube", geheimeParams: ["key"], cacheSeconden: 7 * 24 * 3600 },
        );
        for (const it of dj.items ?? []) duur.set(it.id, duurSeconden(it.contentDetails?.duration));
      } catch {
        /* duur is optioneel */
      }
    }
    return (j.items ?? [])
      .filter((i) => i.id?.videoId)
      .map((i) => {
        const id = i.id!.videoId!;
        const s = i.snippet ?? {};
        const record: BronRecord = {
          connector: "youtube", extern_id: id, brontype: "preek/lezing (video)", titel: decodeHtml(s.title ?? id), auteurs: s.channelTitle ? [decodeHtml(s.channelTitle)] : [],
          datum: s.publishedAt ?? null, jaar: s.publishedAt?.slice(0, 4) ?? null, uitgever: s.channelTitle ?? null, url: `https://www.youtube.com/watch?v=${id}`,
          samenvatting: s.description ? `Videobeschrijving door de uploader (inhoud niet geverifieerd): ${decodeHtml(s.description)}` : null,
          toegang: "alleen metadata",
          rechten: { vindbaar: "ja", leesbaar: "ja", downloadbaar: "nee", herbruikbaar: "nee", toelichting: "Bekijken op YouTube; geen transcript beschikbaar via API voor video's van derden" },
          extra: { duurSec: duur.get(id) ?? null, kanaalId: s.channelId ?? null, relevantieBasis: "metadata" },
        };
        const passages: Passage[] = [{ soort: "metadata", locatie: "titel/beschrijving", tekst: `${record.titel} — ${s.description ?? ""}`.slice(0, 1500), url: record.url }];
        return { record, passages };
      });
  },
};

function decodeHtml(s: string): string {
  return s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

export function youtubeZoeklink(q: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}
