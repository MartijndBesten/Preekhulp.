// Academische metadata-diensten. Deze leveren titels, auteurs, DOI's en soms abstracts —
// nooit automatisch de volledige tekst. Open-accesslinks worden apart gemarkeerd.
// LET OP: in de ontwikkelomgeving waren deze hosts geblokkeerd; de connectors zijn gebouwd volgens de
// bekende API-vormen maar pas 'werkend' na een geslaagde `npm run bronnen:controleren` op de eigen pc.
import { haalJson } from "../../http/veilig";
import { geheim } from "../../settings";
import type { BronRecord, Connector, ConnectorContext, Passage, Zoekvraag } from "../types";

const NIET_LIVE = "Gebouwd volgens de gedocumenteerde API, nog niet live getest (netwerk geblokkeerd in de ontwikkelomgeving).";

function abstractUitOpenAlex(inv?: Record<string, number[]> | null): string | null {
  if (!inv) return null;
  const woorden: string[] = [];
  for (const [w, posities] of Object.entries(inv)) for (const p of posities) woorden[p] = w;
  return woorden.join(" ").trim() || null;
}

function opties(ctx: ConnectorContext, dienst: string) {
  return { db: ctx.db, onderzoek: ctx.onderzoek, dienst };
}

function metadataPassage(r: BronRecord): Passage[] {
  return r.samenvatting
    ? [{ soort: "abstract", locatie: "abstract", tekst: r.samenvatting, url: r.url }]
    : [{ soort: "metadata", locatie: "catalogusgegevens", tekst: `${r.titel}${r.auteurs.length ? " — " + r.auteurs.join(", ") : ""}${r.jaar ? ` (${r.jaar})` : ""}`, url: r.url }];
}

// ---------------------------------------------------------------- OpenAlex
interface OaWork {
  id: string; doi?: string | null; display_name?: string; title?: string; publication_year?: number; publication_date?: string; language?: string; type?: string;
  authorships?: { author?: { display_name?: string } }[];
  primary_location?: { landing_page_url?: string | null; source?: { display_name?: string | null; host_organization_name?: string | null } | null } | null;
  open_access?: { is_oa?: boolean; oa_url?: string | null; oa_status?: string } | null;
  best_oa_location?: { pdf_url?: string | null; landing_page_url?: string | null; license?: string | null } | null;
  abstract_inverted_index?: Record<string, number[]> | null;
}

function oaNaarRecord(w: OaWork): BronRecord {
  const isOa = !!w.open_access?.is_oa;
  const lic = w.best_oa_location?.license ?? null;
  const r: BronRecord = {
    connector: "openalex",
    extern_id: w.id,
    brontype: w.type === "dissertation" ? "proefschrift" : w.type === "book" || w.type === "book-chapter" ? "wetenschappelijk boek/commentaar" : w.type === "article" ? "academisch artikel (peer review niet vastgesteld)" : "onbekend",
    titel: w.display_name ?? w.title ?? "(zonder titel)",
    auteurs: (w.authorships ?? []).map((a) => a.author?.display_name ?? "").filter(Boolean),
    jaar: w.publication_year ? String(w.publication_year) : null,
    datum: w.publication_date ?? null,
    uitgever: w.primary_location?.source?.display_name ?? w.primary_location?.source?.host_organization_name ?? null,
    url: w.doi ?? w.primary_location?.landing_page_url ?? w.id,
    doi: w.doi ?? null,
    taal: w.language ?? null,
    samenvatting: abstractUitOpenAlex(w.abstract_inverted_index),
    toegang: abstractUitOpenAlex(w.abstract_inverted_index) ? "abstract" : "alleen metadata",
    volledigeTekstUrl: isOa ? (w.best_oa_location?.pdf_url ?? w.open_access?.oa_url ?? null) : null,
    rechten: {
      vindbaar: "ja",
      leesbaar: isOa ? "ja" : "onbekend",
      downloadbaar: isOa ? "ja" : "onbekend",
      herbruikbaar: lic && /cc-by|cc0|public-domain/i.test(lic) ? "ja" : lic ? "beperkt" : "onbekend",
      licentie: lic,
      toelichting: isOa ? `Open access (${w.open_access?.oa_status ?? "?"})` : "Geen open-accessversie bekend",
    },
  };
  return r;
}

async function zoekOpenAlex(v: Zoekvraag, ctx: ConnectorContext, extraFilter?: string) {
  const p = new URLSearchParams({ search: v.tekst, "per-page": String(v.max ?? 10) });
  const filters = ["type:article|book|book-chapter|dissertation|review"];
  if (extraFilter) filters.push(extraFilter);
  p.set("filter", filters.join(","));
  const mail = geheim("contactEmail");
  if (mail) p.set("mailto", mail);
  const key = geheim("openalex");
  if (key) p.set("api_key", key);
  const j = await haalJson<{ results?: OaWork[] }>(`https://api.openalex.org/works?${p}`, { ...opties(ctx, "openalex"), geheimeParams: ["api_key", "mailto"] });
  return (j.results ?? []).map((w) => {
    const record = oaNaarRecord(w);
    return { record, passages: metadataPassage(record) };
  });
}

const kaartBasis = { kosten: "Gratis (sleutel/limieten volgens aanbieder)", actualiteit: "Dagelijks bijgewerkt", uitvoerbaarheid: "Hoog (JSON-API)" };

export const openAlex: Connector = {
  kaart: {
    id: "openalex", naam: "OpenAlex", website: "https://openalex.org/", categorie: "Academisch",
    zoekmogelijkheden: "Trefwoord, auteur, instelling, jaar, open access, type", api: "REST JSON (api.openalex.org/works)",
    toegangsvoorwaarden: "Zonder sleutel beperkt gratis zoeken; gratis OpenAlex-API-sleutel aanbevolen voor structureel gebruik en paging. Dagbudget en tarieven actueel controleren via help.openalex.org.",
    licentie: "Metadata CC0", volledigeTekst: "Nee — alleen links naar open-accessversies",
    ...kaartBasis, geschiktheidPilot: "Hoog als vindplaats academische literatuur",
    status: "gedeeltelijk", statusToelichting: NIET_LIVE, getest: "Unit-test met vaste voorbeeldrespons (vorm), geen live-aanroep.",
  },
  ondersteunt: { zoeken: true, metadata: true, inhoud: "abstract", verificatie: false, netwerk: true },
  nietBeschikbaar: () => null,
  zoek: (v, ctx) => zoekOpenAlex(v, ctx),
};

/** PThU via OpenAlex: eerst de instelling opzoeken (geen vaste id's verzinnen), dan werken van PThU-auteurs. */
export const pthu: Connector = {
  kaart: {
    id: "pthu", naam: "Protestantse Theologische Universiteit (via OpenAlex + doorverwijzing)", website: "https://www.pthu.nl/", categorie: "Academisch",
    zoekmogelijkheden: "Publicaties met PThU-affiliatie (OpenAlex); doorverwijzing naar PThU-site voor het research portal en de theologische repository",
    api: "Geen eigen gedocumenteerde API gevonden/gecontroleerd; OAI-PMH of portal-API nog te onderzoeken",
    toegangsvoorwaarden: "Vrij lezen ≠ vrij hergebruik; per publicatie licentie controleren",
    licentie: "Per publicatie", volledigeTekst: "Alleen via open-accesslinks van OpenAlex",
    kosten: "Gratis", actualiteit: "Afhankelijk van OpenAlex-indexering", uitvoerbaarheid: "Middel",
    geschiktheidPilot: "Middel — waardevol voor PKN-context; directe harvesting eerst juridisch/technisch checken",
    status: "gedeeltelijk", statusToelichting: NIET_LIVE + " De PThU-website was in de ontwikkelomgeving niet bereikbaar; repository-interface niet geverifieerd.",
    getest: "Niet live getest.",
  },
  ondersteunt: { zoeken: true, metadata: true, inhoud: "abstract", verificatie: false, netwerk: true },
  nietBeschikbaar: () => null,
  async zoek(v, ctx) {
    const p = new URLSearchParams({ search: "Protestant Theological University", "per-page": "5" });
    const inst = await haalJson<{ results?: { id: string; display_name: string; country_code?: string }[] }>(`https://api.openalex.org/institutions?${p}`, {
      ...opties(ctx, "openalex"), cacheSeconden: 30 * 24 * 3600,
    });
    const nl = (inst.results ?? []).find((i) => i.country_code === "NL" && /protestant/i.test(i.display_name));
    if (!nl) return [];
    const id = nl.id.replace("https://openalex.org/", "");
    const res = await zoekOpenAlex(v, ctx, `authorships.institutions.id:${id}`);
    return res.map((x) => ({ ...x, record: { ...x.record, connector: "pthu", traditie: "protestants (PThU-affiliatie)" } }));
  },
};

// ---------------------------------------------------------------- Crossref
export const crossref: Connector = {
  kaart: {
    id: "crossref", naam: "Crossref", website: "https://www.crossref.org/", categorie: "Academisch",
    zoekmogelijkheden: "Bibliografisch zoeken; DOI-verificatie", api: "REST JSON (api.crossref.org/works)",
    toegangsvoorwaarden: "Open; contactadres aanbevolen", licentie: "Metadata grotendeels vrij (CC0-feiten)", volledigeTekst: "Nee",
    ...kaartBasis, geschiktheidPilot: "Hoog voor bibliografische verificatie (bestaat deze DOI/titel echt?)",
    status: "gedeeltelijk", statusToelichting: NIET_LIVE, getest: "Unit-test met vaste voorbeeldrespons, geen live-aanroep.",
  },
  ondersteunt: { zoeken: true, metadata: true, inhoud: "abstract", verificatie: true, netwerk: true },
  nietBeschikbaar: () => null,
  async zoek(v, ctx) {
    const p = new URLSearchParams({ "query.bibliographic": v.tekst, rows: String(v.max ?? 10), select: "DOI,title,author,issued,container-title,publisher,abstract,URL,type,language,license" });
    const mail = geheim("contactEmail");
    if (mail) p.set("mailto", mail);
    const j = await haalJson<{ message?: { items?: CrItem[] } }>(`https://api.crossref.org/works?${p}`, { ...opties(ctx, "crossref"), geheimeParams: ["mailto"] });
    return (j.message?.items ?? []).map((it) => {
      const record = crNaarRecord(it);
      return { record, passages: metadataPassage(record) };
    });
  },
};

interface CrItem {
  DOI: string; title?: string[]; author?: { given?: string; family?: string; name?: string }[]; issued?: { "date-parts"?: number[][] };
  "container-title"?: string[]; publisher?: string; abstract?: string; URL?: string; type?: string; language?: string; license?: { URL?: string }[];
}

export function crNaarRecord(it: CrItem): BronRecord {
  const jaar = it.issued?.["date-parts"]?.[0]?.[0];
  const lic = it.license?.[0]?.URL ?? null;
  const abs = it.abstract ? it.abstract.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : null;
  return {
    connector: "crossref", extern_id: it.DOI,
    brontype: it.type === "journal-article" ? "academisch artikel (peer review niet vastgesteld)" : it.type?.startsWith("book") || it.type === "monograph" ? "wetenschappelijk boek/commentaar" : it.type === "dissertation" ? "proefschrift" : "onbekend",
    titel: it.title?.[0] ?? "(zonder titel)",
    auteurs: (it.author ?? []).map((a) => a.name ?? [a.given, a.family].filter(Boolean).join(" ")).filter(Boolean),
    jaar: jaar ? String(jaar) : null, uitgever: it["container-title"]?.[0] ?? it.publisher ?? null,
    url: `https://doi.org/${it.DOI}`, doi: it.DOI, taal: it.language ?? null, samenvatting: abs,
    toegang: abs ? "abstract" : "alleen metadata",
    rechten: { vindbaar: "ja", leesbaar: "onbekend", downloadbaar: "onbekend", herbruikbaar: lic && /creativecommons/.test(lic) ? "ja" : "onbekend", licentie: lic },
  };
}

/** Bibliografische verificatie: bestaat de DOI werkelijk bij Crossref? */
export async function verifieerDoi(doi: string, ctx: ConnectorContext): Promise<BronRecord | null> {
  try {
    const j = await haalJson<{ message?: CrItem }>(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, opties(ctx, "crossref"));
    return j.message ? crNaarRecord(j.message) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- DOAJ
export const doaj: Connector = {
  kaart: {
    id: "doaj", naam: "DOAJ — Directory of Open Access Journals", website: "https://doaj.org/", categorie: "Academisch",
    zoekmogelijkheden: "Artikelen in open-accesstijdschriften", api: "REST JSON (doaj.org/api/search/articles/…)",
    toegangsvoorwaarden: "Open", licentie: "Metadata CC0; artikelen per tijdschrift-licentie (vaak CC BY)", volledigeTekst: "Via link naar tijdschrift",
    ...kaartBasis, geschiktheidPilot: "Hoog — o.a. open-access theologie/homiletiek (bv. Int. Journal of Homiletics, Handelingen indien geïndexeerd)",
    status: "gedeeltelijk", statusToelichting: NIET_LIVE, getest: "Niet live getest.",
  },
  ondersteunt: { zoeken: true, metadata: true, inhoud: "abstract", verificatie: false, netwerk: true },
  nietBeschikbaar: () => null,
  async zoek(v, ctx) {
    type DoajArt = { id: string; bibjson?: { title?: string; author?: { name?: string }[]; year?: string; abstract?: string; journal?: { title?: string; publisher?: string; language?: string[] }; link?: { type?: string; url?: string }[]; identifier?: { type?: string; id?: string }[] } };
    const j = await haalJson<{ results?: DoajArt[] }>(`https://doaj.org/api/search/articles/${encodeURIComponent(v.tekst)}?pageSize=${v.max ?? 10}`, opties(ctx, "doaj"));
    return (j.results ?? []).map((a) => {
      const b = a.bibjson ?? {};
      const doi = b.identifier?.find((i) => i.type?.toLowerCase() === "doi")?.id ?? null;
      const ft = b.link?.find((l) => l.type === "fulltext")?.url ?? null;
      const record: BronRecord = {
        connector: "doaj", extern_id: a.id, brontype: "peer-reviewed artikel", titel: b.title ?? "(zonder titel)",
        auteurs: (b.author ?? []).map((x) => x.name ?? "").filter(Boolean), jaar: b.year ?? null, uitgever: b.journal?.title ?? null,
        url: ft ?? (doi ? `https://doi.org/${doi}` : null), doi, taal: b.journal?.language?.[0] ?? null, samenvatting: b.abstract ?? null,
        toegang: b.abstract ? "abstract" : "alleen metadata", volledigeTekstUrl: ft,
        rechten: { vindbaar: "ja", leesbaar: "ja", downloadbaar: "onbekend", herbruikbaar: "onbekend", toelichting: "Open-accesstijdschrift; licentie per tijdschrift controleren" },
      };
      return { record, passages: metadataPassage(record) };
    });
  },
};

// ---------------------------------------------------------------- Semantic Scholar
export const semanticScholar: Connector = {
  kaart: {
    id: "semanticscholar", naam: "Semantic Scholar", website: "https://www.semanticscholar.org/", categorie: "Academisch",
    zoekmogelijkheden: "Trefwoord; citaties", api: "Graph API (api.semanticscholar.org/graph/v1/paper/search)",
    toegangsvoorwaarden: "Zonder sleutel strenge gedeelde limiet; gratis sleutel aan te vragen", licentie: "API-licentievoorwaarden S2", volledigeTekst: "Nee (soms open-access-PDF-link)",
    ...kaartBasis, geschiktheidPilot: "Middel — theologie minder goed gedekt dan exacte wetenschappen",
    status: "gedeeltelijk", statusToelichting: NIET_LIVE, getest: "Niet live getest.",
  },
  ondersteunt: { zoeken: true, metadata: true, inhoud: "abstract", verificatie: false, netwerk: true },
  nietBeschikbaar: () => null,
  async zoek(v, ctx) {
    type S2 = { paperId: string; title?: string; authors?: { name?: string }[]; year?: number; abstract?: string | null; url?: string; venue?: string; externalIds?: { DOI?: string }; openAccessPdf?: { url?: string } | null; isOpenAccess?: boolean };
    const p = new URLSearchParams({ query: v.tekst, limit: String(v.max ?? 10), fields: "title,authors,year,abstract,url,venue,externalIds,openAccessPdf,isOpenAccess" });
    const key = geheim("semanticScholar");
    const j = await haalJson<{ data?: S2[] }>(`https://api.semanticscholar.org/graph/v1/paper/search?${p}`, { ...opties(ctx, "semanticscholar"), headers: key ? { "x-api-key": key } : {} });
    return (j.data ?? []).map((s) => {
      const record: BronRecord = {
        connector: "semanticscholar", extern_id: s.paperId, brontype: "academisch artikel (peer review niet vastgesteld)", titel: s.title ?? "(zonder titel)",
        auteurs: (s.authors ?? []).map((a) => a.name ?? "").filter(Boolean), jaar: s.year ? String(s.year) : null, uitgever: s.venue || null,
        url: s.url ?? null, doi: s.externalIds?.DOI ?? null, samenvatting: s.abstract ?? null, toegang: s.abstract ? "abstract" : "alleen metadata",
        volledigeTekstUrl: s.openAccessPdf?.url ?? null,
        rechten: { vindbaar: "ja", leesbaar: s.isOpenAccess ? "ja" : "onbekend", downloadbaar: s.isOpenAccess ? "ja" : "onbekend", herbruikbaar: "onbekend" },
      };
      return { record, passages: metadataPassage(record) };
    });
  },
};

// ---------------------------------------------------------------- CORE
export const core: Connector = {
  kaart: {
    id: "core", naam: "CORE (open-access repositories)", website: "https://core.ac.uk/", categorie: "Academisch",
    zoekmogelijkheden: "Trefwoord; volledige tekst van open-accesspublicaties uit repositories", api: "REST v3 (api.core.ac.uk/v3/search/works), Bearer-sleutel",
    toegangsvoorwaarden: "Gratis API-sleutel na registratie; gebruiksvoorwaarden CORE", licentie: "Per publicatie", volledigeTekst: "Soms (fullText-veld)",
    ...kaartBasis, geschiktheidPilot: "Middel-hoog voor repository-materiaal (o.a. Nederlandse universiteiten)",
    status: "gedeeltelijk", statusToelichting: "Vereist eigen gratis sleutel. " + NIET_LIVE, getest: "Niet live getest.",
  },
  ondersteunt: { zoeken: true, metadata: true, inhoud: "fragmenten", verificatie: false, netwerk: true },
  nietBeschikbaar: () => (geheim("core") ? null : "Geen CORE-sleutel ingesteld (gratis aan te vragen bij core.ac.uk)"),
  async zoek(v, ctx) {
    type C = { id: number | string; title?: string; authors?: { name?: string }[]; yearPublished?: number; abstract?: string | null; doi?: string | null; downloadUrl?: string | null; publisher?: string | null; links?: { type?: string; url?: string }[]; language?: { code?: string } | null };
    const p = new URLSearchParams({ q: v.tekst, limit: String(v.max ?? 10) });
    const j = await haalJson<{ results?: C[] }>(`https://api.core.ac.uk/v3/search/works?${p}`, { ...opties(ctx, "core"), headers: { Authorization: `Bearer ${geheim("core")}` } });
    return (j.results ?? []).map((c) => {
      const display = c.links?.find((l) => l.type === "display")?.url ?? null;
      const record: BronRecord = {
        connector: "core", extern_id: String(c.id), brontype: "academisch artikel (peer review niet vastgesteld)", titel: c.title ?? "(zonder titel)",
        auteurs: (c.authors ?? []).map((a) => a.name ?? "").filter(Boolean), jaar: c.yearPublished ? String(c.yearPublished) : null,
        uitgever: c.publisher ?? null, url: display ?? c.downloadUrl ?? null, doi: c.doi ?? null, taal: c.language?.code ?? null,
        samenvatting: c.abstract ?? null, toegang: c.abstract ? "abstract" : "alleen metadata", volledigeTekstUrl: c.downloadUrl ?? null,
        rechten: { vindbaar: "ja", leesbaar: c.downloadUrl ? "ja" : "onbekend", downloadbaar: c.downloadUrl ? "ja" : "onbekend", herbruikbaar: "onbekend", toelichting: "Repository-exemplaar; licentie per item controleren" },
      };
      return { record, passages: metadataPassage(record) };
    });
  },
};

// ---------------------------------------------------------------- Unpaywall (verrijking per DOI)
export async function unpaywall(doi: string, ctx: ConnectorContext): Promise<{ isOa: boolean; url: string | null; licentie: string | null } | null> {
  const mail = geheim("contactEmail");
  if (!mail) return null; // Unpaywall vereist een e-mailparameter; zonder contactadres niet aanroepen
  try {
    const j = await haalJson<{ is_oa?: boolean; best_oa_location?: { url?: string; license?: string } | null }>(
      `https://api.unpaywall.org/v2/${encodeURIComponent(doi)}?email=${encodeURIComponent(mail)}`,
      { ...opties(ctx, "unpaywall"), geheimeParams: ["email"] },
    );
    return { isOa: !!j.is_oa, url: j.best_oa_location?.url ?? null, licentie: j.best_oa_location?.license ?? null };
  } catch {
    return null;
  }
}
