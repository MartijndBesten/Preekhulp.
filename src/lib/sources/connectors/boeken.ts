// Historische boeken en commentaren buiten de lokale datasets: catalogi en open collecties.
// Catalogusgegevens worden nooit samengevat alsof de inhoud gelezen is.
import { haalJson } from "../../http/veilig";
import { geheim } from "../../settings";
import { BOEK_PER_NR, ontleedVkey } from "../../scripture/books";
import { labelReeks } from "../../scripture/data";
import type { BronRecord, Connector, ConnectorContext, Passage } from "../types";

const opties = (ctx: ConnectorContext, dienst: string) => ({ db: ctx.db, onderzoek: ctx.onderzoek, dienst });
const catalogus = (r: BronRecord): Passage[] => [{ soort: "metadata", locatie: "catalogusgegevens", tekst: `${r.titel}${r.auteurs.length ? " — " + r.auteurs.join(", ") : ""}${r.jaar ? ` (${r.jaar})` : ""}${r.uitgever ? `, ${r.uitgever}` : ""}`, url: r.url }];

export const internetArchive: Connector = {
  kaart: {
    id: "internetarchive", naam: "Internet Archive", website: "https://archive.org/", categorie: "Historische commentaren en boeken",
    zoekmogelijkheden: "Metadata (titel, maker, datum, collectie); per item tekstbestanden", api: "advancedsearch.php (JSON)",
    toegangsvoorwaarden: "Open; rechten per item verschillen (veel publiek domein, ook uitleenboeken!)",
    licentie: "Per item (licenseurl/rights); 'uitleenbaar' ≠ herbruikbaar", volledigeTekst: "Soms (publiek-domeinitems met tekstlaag)",
    actualiteit: "Continu", kosten: "Gratis", uitvoerbaarheid: "Middel (kwaliteit OCR wisselend)",
    geschiktheidPilot: "Middel — vindplaats voor oude commentaren (Keil-Delitzsch, Gill, Lange e.d.)",
    status: "gedeeltelijk", statusToelichting: "Live getest 01-11-2026 (GitHub Actions, 2 runs, zoekvraag rond Genesis 31/Jakob/Betel): beide runs bereikbaar met treffers; alleen catalogusgegevens en wisselende kwaliteit (bv. presentatiebestanden). Tekst pas na rechtencontrole per item.", getest: "01-11-2026 live: 2× ok (metadata).",
  },
  ondersteunt: { zoeken: true, metadata: true, inhoud: "nee", verificatie: false, netwerk: true },
  nietBeschikbaar: () => null,
  async zoek(v, ctx) {
    type Doc = { identifier: string; title?: string; creator?: string | string[]; date?: string; year?: string; licenseurl?: string; rights?: string | string[]; mediatype?: string; language?: string | string[] };
    const p = new URLSearchParams({ q: `(${v.tekst}) AND mediatype:texts`, rows: String(v.max ?? 10), output: "json" });
    for (const f of ["identifier", "title", "creator", "date", "year", "licenseurl", "rights", "mediatype", "language"]) p.append("fl[]", f);
    const j = await haalJson<{ response?: { docs?: Doc[] } }>(`https://archive.org/advancedsearch.php?${p}`, opties(ctx, "internetarchive"));
    return (j.response?.docs ?? []).map((dd) => {
      const pd = /publicdomain|public domain/i.test(`${dd.licenseurl ?? ""} ${[dd.rights ?? ""].flat().join(" ")}`);
      const record: BronRecord = {
        connector: "internetarchive", extern_id: dd.identifier, brontype: "boek (catalogus)", titel: dd.title ?? dd.identifier,
        auteurs: [dd.creator ?? []].flat().filter(Boolean) as string[], jaar: dd.year ?? dd.date?.slice(0, 4) ?? null,
        url: `https://archive.org/details/${dd.identifier}`, taal: [dd.language ?? []].flat()[0] ?? null, toegang: "alleen metadata",
        rechten: { vindbaar: "ja", leesbaar: "onbekend", downloadbaar: "onbekend", herbruikbaar: pd ? "ja" : "onbekend", licentie: dd.licenseurl ?? null, toelichting: pd ? "Gemarkeerd als publiek domein (controleer editie/vertaling)" : "Rechten per item controleren; uitleenboeken zijn niet herbruikbaar" },
      };
      return { record, passages: catalogus(record) };
    });
  },
};

export const gutendex: Connector = {
  kaart: {
    id: "gutenberg", naam: "Project Gutenberg (via Gutendex)", website: "https://www.gutenberg.org/", categorie: "Historische commentaren en boeken",
    zoekmogelijkheden: "Titel/auteur", api: "Gutendex JSON-API (gutendex.com/books) — onofficieel, open source",
    toegangsvoorwaarden: "Gutenberg: geen massale automatische downloads van gutenberg.org; gebruik mirrors/offline-catalogus",
    licentie: "Publiek domein in de VS; per land controleren (NL: 70 jaar na overlijden)", volledigeTekst: "Ja (tekstbestanden)",
    actualiteit: "Continu", kosten: "Gratis", uitvoerbaarheid: "Hoog voor metadata", geschiktheidPilot: "Laag-middel — weinig Bijbelcommentaren",
    status: "gedeeltelijk", statusToelichting: "Live getest 01-11-2026 (GitHub Actions, 2 runs, zoekvraag rond Genesis 31/Jakob/Betel): Gutendex weigerde beide keren (HTTP 403) vanaf GitHub Actions; vanaf een thuisnetwerk nog niet getest.", getest: "01-11-2026 live: 2× HTTP 403.",
  },
  ondersteunt: { zoeken: true, metadata: true, inhoud: "nee", verificatie: false, netwerk: true },
  nietBeschikbaar: () => null,
  async zoek(v, ctx) {
    type G = { id: number; title: string; authors?: { name: string; death_year?: number | null }[]; languages?: string[]; copyright?: boolean | null };
    const j = await haalJson<{ results?: G[] }>(`https://gutendex.com/books?search=${encodeURIComponent(v.tekst)}`, opties(ctx, "gutenberg"));
    return (j.results ?? []).slice(0, v.max ?? 10).map((g) => {
      const overl = g.authors?.map((a) => a.death_year ?? null).filter((x): x is number => !!x);
      const nlPd = overl?.length ? Math.max(...overl) < new Date().getFullYear() - 70 : false;
      const record: BronRecord = {
        connector: "gutenberg", extern_id: String(g.id), brontype: "boek (catalogus)", titel: g.title, auteurs: (g.authors ?? []).map((a) => a.name),
        url: `https://www.gutenberg.org/ebooks/${g.id}`, taal: g.languages?.[0] ?? null, toegang: "alleen metadata",
        rechten: { vindbaar: "ja", leesbaar: "ja", downloadbaar: "ja", herbruikbaar: g.copyright === false && nlPd ? "ja" : "onbekend", toelichting: nlPd ? "Auteur(s) >70 jaar overleden" : "Rechtenstatus in NL controleren" },
      };
      return { record, passages: catalogus(record) };
    });
  },
};

export const openLibrary: Connector = {
  kaart: {
    id: "openlibrary", naam: "Open Library", website: "https://openlibrary.org/", categorie: "Historische commentaren en boeken",
    zoekmogelijkheden: "Titel/auteur/onderwerp", api: "search.json", toegangsvoorwaarden: "Open; uitlenen ≠ hergebruik", licentie: "Catalogusdata CC0",
    volledigeTekst: "Nee (alleen via Internet Archive bij publiek domein)", actualiteit: "Continu", kosten: "Gratis", uitvoerbaarheid: "Hoog",
    geschiktheidPilot: "Middel — bibliografische controle van boektitels", status: "gedeeltelijk", statusToelichting: "Live getest 01-11-2026 (GitHub Actions, 2 runs, zoekvraag rond Genesis 31/Jakob/Betel): beide runs bereikbaar met treffers; alleen bibliografische gegevens.", getest: "01-11-2026 live: 2× ok (metadata).",
  },
  ondersteunt: { zoeken: true, metadata: true, inhoud: "nee", verificatie: true, netwerk: true },
  nietBeschikbaar: () => null,
  async zoek(v, ctx) {
    type O = { key: string; title: string; author_name?: string[]; first_publish_year?: number; ebook_access?: string; language?: string[]; publisher?: string[] };
    const p = new URLSearchParams({ q: v.tekst, limit: String(v.max ?? 10), fields: "key,title,author_name,first_publish_year,ebook_access,language,publisher" });
    const j = await haalJson<{ docs?: O[] }>(`https://openlibrary.org/search.json?${p}`, opties(ctx, "openlibrary"));
    return (j.docs ?? []).map((o) => {
      const record: BronRecord = {
        connector: "openlibrary", extern_id: o.key, brontype: "boek (catalogus)", titel: o.title, auteurs: o.author_name ?? [],
        jaar: o.first_publish_year ? String(o.first_publish_year) : null, uitgever: o.publisher?.[0] ?? null, url: `https://openlibrary.org${o.key}`,
        taal: o.language?.[0] ?? null, toegang: "alleen metadata",
        rechten: { vindbaar: "ja", leesbaar: o.ebook_access === "public" ? "ja" : o.ebook_access === "borrowable" ? "beperkt" : "nee", downloadbaar: o.ebook_access === "public" ? "ja" : "nee", herbruikbaar: o.ebook_access === "public" ? "onbekend" : "nee", toelichting: `ebook_access: ${o.ebook_access ?? "onbekend"}` },
      };
      return { record, passages: catalogus(record) };
    });
  },
};

export const googleBooks: Connector = {
  kaart: {
    id: "googlebooks", naam: "Google Books", website: "https://books.google.com/", categorie: "Historische commentaren en boeken",
    zoekmogelijkheden: "Titel/auteur/trefwoord, ook binnen gedigitaliseerde boeken", api: "Books API v1 (volumes); sleutel optioneel",
    toegangsvoorwaarden: "Google API-voorwaarden; inhoud alleen bekijken via Google", licentie: "Inhoud niet herbruikbaar (behalve publiek domein-weergave)",
    volledigeTekst: "Nee (alleen beschrijving/fragmentweergave bij Google)", actualiteit: "Continu", kosten: "Gratis binnen quotum", uitvoerbaarheid: "Hoog",
    geschiktheidPilot: "Middel — vindplaats; nooit inhoud kopiëren", status: "gedeeltelijk", statusToelichting: "Live getest 01-11-2026 (GitHub Actions, 2 runs, zoekvraag rond Genesis 31/Jakob/Betel): beide runs HTTP 429 zonder sleutel. Alleen vindplaats; nooit inhoud kopiëren.", getest: "01-11-2026 live: 2× HTTP 429.",
  },
  ondersteunt: { zoeken: true, metadata: true, inhoud: "nee", verificatie: true, netwerk: true },
  nietBeschikbaar: () => null,
  async zoek(v, ctx) {
    type GB = { id: string; volumeInfo?: { title?: string; authors?: string[]; publishedDate?: string; publisher?: string; description?: string; infoLink?: string; language?: string }; accessInfo?: { publicDomain?: boolean; viewability?: string } };
    const p = new URLSearchParams({ q: v.tekst, maxResults: String(Math.min(v.max ?? 10, 20)) });
    const key = geheim("googleBooks");
    if (key) p.set("key", key);
    const j = await haalJson<{ items?: GB[] }>(`https://www.googleapis.com/books/v1/volumes?${p}`, { ...opties(ctx, "googlebooks"), geheimeParams: ["key"] });
    return (j.items ?? []).map((g) => {
      const vi = g.volumeInfo ?? {};
      const record: BronRecord = {
        connector: "googlebooks", extern_id: g.id, brontype: "boek (catalogus)", titel: vi.title ?? "(zonder titel)", auteurs: vi.authors ?? [],
        jaar: vi.publishedDate?.slice(0, 4) ?? null, uitgever: vi.publisher ?? null, url: vi.infoLink ?? `https://books.google.com/books?id=${g.id}`,
        taal: vi.language ?? null,
        samenvatting: vi.description ? `Uitgeversbeschrijving (geen inhoud van het boek): ${vi.description.replace(/<[^>]+>/g, "")}` : null,
        toegang: "alleen metadata",
        rechten: { vindbaar: "ja", leesbaar: g.accessInfo?.viewability === "ALL_PAGES" ? "ja" : g.accessInfo?.viewability === "PARTIAL" ? "beperkt" : "nee", downloadbaar: g.accessInfo?.publicDomain ? "ja" : "nee", herbruikbaar: g.accessInfo?.publicDomain ? "onbekend" : "nee" },
      };
      return { record, passages: catalogus(record) };
    });
  },
};

/** HelloAO Free Use Bible API: publiek-domeincommentaren per hoofdstuk (o.a. Keil-Delitzsch, Gill, Clarke, JFB). */
export const HELLOAO_COMMENTAREN: Record<string, { naam: string; jaar: string; traditie: string }> = {
  "keil-delitzsch": { naam: "Keil & Delitzsch, Commentary on the Old Testament", jaar: "1857–1878", traditie: "luthers, confessioneel" },
  "john-gill": { naam: "John Gill, Exposition of the Bible", jaar: "1746–1763", traditie: "particulier baptist (calvinistisch)" },
  "adam-clarke": { naam: "Adam Clarke, Commentary", jaar: "1810–1826", traditie: "methodistisch (wesleyaans)" },
  "jamieson-fausset-brown": { naam: "Jamieson, Fausset & Brown, Commentary", jaar: "1871", traditie: "protestants (Schots/Engels)" },
};

/**
 * Vraag de werkelijk beschikbare commentaar-id's op (live proef 01-11-2026: met vaste id's gaf alleen John Gill treffers).
 * Koppel op naam aan de bekende publiek-domeinwerken; onbekende werken worden niet gebruikt.
 */
const PATRONEN: [RegExp, { naam: string; jaar: string; traditie: string }][] = [
  [/keil|delitzsch/i, HELLOAO_COMMENTAREN["keil-delitzsch"]],
  [/gill/i, HELLOAO_COMMENTAREN["john-gill"]],
  [/clarke/i, HELLOAO_COMMENTAREN["adam-clarke"]],
  [/jamieson|fausset/i, HELLOAO_COMMENTAREN["jamieson-fausset-brown"]],
];
export async function helloAoIds(ctx: ConnectorContext): Promise<Record<string, { naam: string; jaar: string; traditie: string }>> {
  try {
    const j = await haalJson<{ commentaries?: { id: string; name?: string; englishName?: string }[] }>("https://bible.helloao.org/api/available_commentaries.json", { ...opties(ctx, "helloao"), cacheSeconden: 7 * 24 * 3600 });
    const uit: Record<string, { naam: string; jaar: string; traditie: string }> = {};
    for (const c of j.commentaries ?? []) {
      const naam = `${c.id} ${c.name ?? ""} ${c.englishName ?? ""}`;
      const hit = PATRONEN.find(([re]) => re.test(naam));
      if (hit) uit[c.id] = hit[1];
    }
    return Object.keys(uit).length ? uit : HELLOAO_COMMENTAREN;
  } catch {
    return HELLOAO_COMMENTAREN;
  }
}

export const helloAo: Connector = {
  kaart: {
    id: "helloao", naam: "HelloAO Free Use Bible API — publiek-domeincommentaren", website: "https://bible.helloao.org/", categorie: "Historische commentaren en boeken",
    zoekmogelijkheden: "Per hoofdstuk: Keil-Delitzsch, John Gill, Adam Clarke, Jamieson-Fausset-Brown", api: "Statische JSON (bible.helloao.org/api/c/{id}/{BOEK}/{hoofdstuk}.json)",
    toegangsvoorwaarden: "Vrij te gebruiken volgens aanbieder ('free use'); teksten zelf publiek domein", licentie: "Publiek domein (teksten)",
    volledigeTekst: "Ja (per vers)", actualiteit: "Statisch", kosten: "Gratis", uitvoerbaarheid: "Hoog",
    geschiktheidPilot: "Hoog — voegt Keil-Delitzsch toe (belangrijk exegetisch OT-commentaar)",
    status: "werkend", statusToelichting: "Live getest 01-11-2026 (GitHub Actions, 2 runs, zoekvraag rond Genesis 31/Jakob/Betel): vier commentaren gekoppeld (Keil-Delitzsch, Gill, Clarke, Jamieson-Fausset-Brown). Gill per vers; de andere drie per perikoop — dan toont Preekhulp de sectie die vóór het gevraagde vers begint, met de vermelding dat dat gecontroleerd moet worden.", getest: "01-11-2026 live: 4/4 commentaren leveren tekst bij Gen 31:13 (3 via perikoopsectie).",
  },
  ondersteunt: { zoeken: true, metadata: true, inhoud: "volledig", verificatie: true, netwerk: true },
  nietBeschikbaar: () => null,
  async zoek(v, ctx) {
    if (!v.refs?.length) return [];
    const uit: { record: BronRecord; passages: Passage[] }[] = [];
    const fouten: string[] = [];
    for (const [id, meta] of Object.entries(await helloAoIds(ctx))) {
      const passages: Passage[] = [];
      for (const r of v.refs.slice(0, 3)) {
        const a = ontleedVkey(r.start);
        const b = ontleedVkey(r.eind);
        if (a.boek.testament !== "OT" && id === "keil-delitzsch") continue;
        for (let h = a.hoofdstuk; h <= b.hoofdstuk && h - a.hoofdstuk < 3; h++) {
          const usfm = BOEK_PER_NR.get(a.boek.nr)!.usfm;
          const url = `https://bible.helloao.org/api/c/${id}/${usfm}/${h}.json`;
          let j: { chapter?: { content?: { type: string; number?: number; content?: (string | { text?: string })[] }[] } };
          try {
            j = await haalJson(url, { ...opties(ctx, "helloao"), cacheSeconden: 30 * 24 * 3600 });
          } catch (e) {
            fouten.push((e as Error).message);
            continue;
          }
          const items = (j.chapter?.content ?? []).filter((it) => it.type === "verse" && it.number);
          const tekstVan = (it: (typeof items)[number]) => (it.content ?? []).map((c) => (typeof c === "string" ? c : c.text ?? "")).join(" ").trim();
          const van = h === a.hoofdstuk ? r.start : -Infinity;
          const tot = h === b.hoofdstuk ? r.eind : Infinity;
          let exact = 0;
          for (const it of items) {
            const k = a.boek.nr * 1_000_000 + h * 1000 + it.number!;
            if (k < van || k > tot) continue;
            const tekst = tekstVan(it);
            if (tekst) {
              passages.push({ soort: "commentaar", locatie: labelReeks(k, k), tekst, url });
              exact++;
            }
          }
          // Veel commentaren (bv. Keil-Delitzsch) bespreken een perikoop onder het eerste vers. Geen exacte treffer?
          // Neem dan de dichtstbijzijnde vóórgaande sectie, met een eerlijke vindplaats ("sectie vanaf …").
          if (!exact && h === a.hoofdstuk) {
            const vers = r.start % 1000;
            const sectie = items.filter((it) => it.number! < vers).sort((x, y) => y.number! - x.number!)[0];
            if (sectie && tekstVan(sectie)) {
              const k = a.boek.nr * 1_000_000 + h * 1000 + sectie.number!;
              passages.push({ soort: "commentaar", locatie: `${labelReeks(k, k)} e.v. (sectie; bespreekt mogelijk ook ${labelReeks(r.start, r.start)} — controleer)`, tekst: tekstVan(sectie), url });
            }
          }
        }
      }
      if (passages.length)
        uit.push({
          record: { connector: "helloao", extern_id: id, brontype: "historisch commentaar", titel: meta.naam, auteurs: [meta.naam.split(",")[0]], jaar: meta.jaar, traditie: meta.traditie, url: `https://bible.helloao.org/`, taal: "en", toegang: "volledige tekst", rechten: { vindbaar: "ja", leesbaar: "ja", downloadbaar: "ja", herbruikbaar: "ja", licentie: "Publiek domein" } },
          passages,
        });
    }
    if (!uit.length && fouten.length) throw new Error(fouten[0]);
    return uit;
  },
};
