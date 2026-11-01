// Lokale connectors: werken offline, op rechtmatig opgeslagen open data en eigen documenten.
import { ftsVraag } from "../../db";
import { commentaren, kruisverwijzingen, verzen, vertalingen, woorden, zoekBijbeltekst, zoekCommentaren, labelReeks } from "../../scripture/data";
import { grenzen } from "../../scripture/reference";
import type { BronRecord, Connector, Passage, Rechten } from "../types";

const PD: Rechten = { vindbaar: "ja", leesbaar: "ja", downloadbaar: "ja", herbruikbaar: "ja" };

export const lokaalBijbel: Connector = {
  kaart: {
    id: "lokaal-bijbel",
    naam: "Bijbelteksten (lokaal): Statenvertaling + Berean Standard Bible",
    website: "https://github.com/Isidore-Guild/statenvertaling",
    categorie: "Bijbel en grondtaal",
    zoekmogelijkheden: "Verwijzing (NL/EN boeknamen), woord- en zinszoeken (FTS5)",
    api: "Geen API nodig: dataset lokaal in SQLite",
    toegangsvoorwaarden: "Geen",
    licentie: "SV: CC0/publiek domein (editie 1888-transcriptie). BSB: publiek domein.",
    volledigeTekst: "Ja",
    actualiteit: "Vastgepinde versie (commit in datasets.ts)",
    kosten: "Gratis",
    uitvoerbaarheid: "Hoog",
    geschiktheidPilot: "Basis van elk onderzoek",
    status: "werkend",
    statusToelichting: "Geïmporteerd en getest. HSV/NBV21 zijn bewust niet opgenomen (auteursrecht; zie bronkaart Moderne NL-vertalingen).",
    getest: "01-11-2026: import 31.102 SV-verzen, 31.086 BSB-verzen; zoeken en ophalen getest.",
  },
  ondersteunt: { zoeken: true, metadata: true, inhoud: "volledig", verificatie: true, netwerk: false },
  nietBeschikbaar: (ctx) => ((ctx.db.prepare("SELECT COUNT(*) n FROM verzen").get() as { n: number }).n ? null : "Bijbeldata nog niet geïmporteerd (npm run data:importeren)"),
  async zoek(v, ctx) {
    const uit: { record: BronRecord; passages: Passage[] }[] = [];
    for (const vt of vertalingen(ctx.db)) {
      const passages: Passage[] = [];
      if (v.refs?.length) {
        for (const r of v.refs) for (const vs of verzen(ctx.db, r.start, r.eind, 60)) if (vs.teksten[vt.id]) passages.push({ soort: "bijbeltekst", locatie: vs.label, tekst: vs.teksten[vt.id] });
      } else {
        for (const h of zoekBijbeltekst(ctx.db, ftsVraag(v.tekst), vt.id, v.max ?? 15)) passages.push({ soort: "bijbeltekst", locatie: h.label, tekst: h.fragment });
      }
      if (passages.length)
        uit.push({
          record: { connector: "lokaal-bijbel", extern_id: vt.id, brontype: "bijbeltekst", titel: vt.naam, auteurs: [], taal: vt.taal, url: vt.bron_url, toegang: "volledige tekst", rechten: { ...PD, licentie: vt.licentie } },
          passages,
        });
    }
    return uit;
  },
  async verifieer(_r, fragment, ctx) {
    const hit = ctx.db.prepare("SELECT 1 FROM verzen WHERE instr(lower(tekst), lower(?)) > 0 LIMIT 1").get(fragment.trim());
    return !!hit;
  },
};

export const lokaalGrondtekst: Connector = {
  kaart: {
    id: "lokaal-grondtekst",
    naam: "Grondtekst (lokaal): STEPBible TAHOT/TAGNT + TBESH/TBESG",
    website: "https://github.com/STEPBible/STEPBible-Data",
    categorie: "Bijbel en grondtaal",
    zoekmogelijkheden: "Per vers: woord, lemma, morfologie, Strong; concordantie per lemma; motiefanalyse",
    api: "Geen API nodig: tab-gescheiden bestanden, lokaal in SQLite",
    toegangsvoorwaarden: "Naamsvermelding 'STEP Bible' (www.STEPBible.org)",
    licentie: "CC BY 4.0 (per bestand gecontroleerd in de README van de repository) — commercieel gebruik toegestaan met naamsvermelding",
    volledigeTekst: "Ja (Hebreeuwse Leningradensis; Griekse NA28-woorden gemarkeerd)",
    actualiteit: "Vastgepinde commit; STEP werkt de data periodiek bij",
    kosten: "Gratis",
    uitvoerbaarheid: "Hoog",
    geschiktheidPilot: "Hoog — kern van de grondtaalfuncties",
    status: "werkend",
    statusToelichting: "Geïmporteerd en getest. Betekenissen komen uit TBESH/TBESG (verkorte BDB/Abbott-Smith); geen eigen woordbetekenissen.",
    getest: "01-11-2026: 439.457 woorden geïmporteerd; Gen 31:13 woord-voor-woord gecontroleerd.",
  },
  ondersteunt: { zoeken: true, metadata: true, inhoud: "volledig", verificatie: true, netwerk: false },
  nietBeschikbaar: (ctx) => ((ctx.db.prepare("SELECT COUNT(*) n FROM woorden").get() as { n: number }).n ? null : "Grondtekstdata nog niet geïmporteerd"),
  async zoek(v, ctx) {
    if (!v.refs?.length) return [];
    const passages: Passage[] = [];
    for (const r of v.refs) {
      const ws = woorden(ctx.db, r.start, Math.min(r.eind, grenzen(r)[0] + 40));
      const perVers = new Map<number, typeof ws>();
      for (const w of ws) (perVers.get(w.vkey) ?? perVers.set(w.vkey, []).get(w.vkey)!).push(w);
      for (const [k, lijst] of perVers)
        passages.push({
          soort: "grondtekst",
          locatie: labelReeks(k, k),
          tekst: lijst.map((w) => `${w.vorm} [${w.translit ?? ""}; ${w.strong ?? "-"}; ${w.morf ?? "-"}] “${w.glosse ?? ""}”`).join(" · "),
        });
    }
    return passages.length
      ? [{ record: { connector: "lokaal-grondtekst", extern_id: "step", brontype: "grondtekst", titel: "STEPBible-Data: TAHOT/TAGNT (Tyndale House Cambridge)", auteurs: ["STEP Bible"], url: "https://www.stepbible.org/", toegang: "volledige tekst", rechten: { ...PD, licentie: "CC BY 4.0" } }, passages }]
      : [];
  },
};

export const lokaalKruisverwijzingen: Connector = {
  kaart: {
    id: "lokaal-kruisverwijzingen",
    naam: "Kruisverwijzingen (lokaal): OpenBible.info",
    website: "https://www.openbible.info/labs/cross-references/",
    categorie: "Bijbel en grondtaal",
    zoekmogelijkheden: "Per vers, uitgaand en inkomend, met stemmen (populariteit, geen exegetisch oordeel)",
    api: "Geen API: dataset (via trekhleb/bible-cross-references, vastgepind)",
    toegangsvoorwaarden: "Naamsvermelding",
    licentie: "CC BY 4.0",
    volledigeTekst: "n.v.t.",
    actualiteit: "Datasetversie 2026-09-21",
    kosten: "Gratis",
    uitvoerbaarheid: "Hoog",
    geschiktheidPilot: "Hoog als vindplaats; stemmen zijn geen bewijs",
    status: "werkend",
    statusToelichting: "341.282 verwijzingen met ≥1 stem geïmporteerd.",
    getest: "01-11-2026: Gen 28:12 → Joh 1:51 (36 stemmen) gecontroleerd.",
  },
  ondersteunt: { zoeken: true, metadata: true, inhoud: "volledig", verificatie: false, netwerk: false },
  nietBeschikbaar: () => null,
  async zoek(v, ctx) {
    if (!v.refs?.length) return [];
    const passages: Passage[] = [];
    for (const r of v.refs) for (const kv of kruisverwijzingen(ctx.db, r.start, r.eind, 3, 40)) passages.push({ soort: "kruisverwijzing", locatie: labelReeks(kv.van, kv.van), tekst: `→ ${kv.label} (${kv.stemmen} stemmen)` });
    return passages.length ? [{ record: { connector: "lokaal-kruisverwijzingen", extern_id: "openbible", brontype: "bijbeltekst", titel: "OpenBible.info Cross References", auteurs: ["OpenBible.info"], url: "https://www.openbible.info/labs/cross-references/", toegang: "volledige tekst", rechten: { ...PD, licentie: "CC BY 4.0" } }, passages }] : [];
  },
};

export const lokaalCommentaren: Connector = {
  kaart: {
    id: "lokaal-commentaren",
    naam: "Historische commentaren (lokaal): Kanttekeningen SV, Calvijn, Matthew Henry (+ optioneel kerkvaders)",
    website: "https://github.com/thefrenchpressed/pillar-commentary-data",
    categorie: "Historische commentaren en boeken",
    zoekmogelijkheden: "Per vers/perikoop en vrij zoeken (FTS5)",
    api: "Geen API: open datasets lokaal",
    toegangsvoorwaarden: "Kanttekeningen/Calvijn/Henry: publiek domein. Kerkvaders-database: gemengde rechten (alleen eigen studie, standaard uit).",
    licentie: "Zie per werk (tabel 'werken')",
    volledigeTekst: "Ja (per vers of perikoop)",
    actualiteit: "Historisch; vastgepinde datasets",
    kosten: "Gratis",
    uitvoerbaarheid: "Hoog",
    geschiktheidPilot: "Hoog — oudere uitleg met exacte tekst, dus citaten zijn controleerbaar",
    status: "werkend",
    statusToelichting: "Calvijn in Engelse vertaling (1844–1856); Nederlandse Calvijn-vertalingen niet opgenomen (rechten per editie onbekend).",
    getest: "01-11-2026: Calvijn 13.106, Henry 4.259, Kanttekeningen 59.385 items; Gen 31:13 gecontroleerd.",
  },
  ondersteunt: { zoeken: true, metadata: true, inhoud: "volledig", verificatie: true, netwerk: false },
  nietBeschikbaar: (ctx) => ((ctx.db.prepare("SELECT COUNT(*) n FROM commentaar").get() as { n: number }).n ? null : "Commentaren nog niet geïmporteerd"),
  async zoek(v, ctx) {
    const perWerk = new Map<string, { record: BronRecord; passages: Passage[] }>();
    const voeg = (werk: { werk: string; titel: string; auteur: string; jaar: string | null; taal: string; traditie: string | null; brontype: string; licentie: string; rechtenstatus: string; bron_url: string | null }, p: Passage) => {
      if (!perWerk.has(werk.werk)) {
        const onzeker = werk.rechtenstatus.startsWith("rechten onzeker");
        perWerk.set(werk.werk, {
          record: {
            connector: "lokaal-commentaren", extern_id: werk.werk,
            brontype: (werk.brontype as BronRecord["brontype"]) ?? "historisch commentaar",
            titel: `${werk.auteur} — ${werk.titel}`, auteurs: [werk.auteur], jaar: werk.jaar, taal: werk.taal, traditie: werk.traditie,
            url: werk.bron_url, toegang: "volledige tekst",
            rechten: { vindbaar: "ja", leesbaar: "ja", downloadbaar: "ja", herbruikbaar: onzeker ? "onbekend" : "ja", licentie: werk.licentie, toelichting: werk.rechtenstatus },
          },
          passages: [],
        });
      }
      perWerk.get(werk.werk)!.passages.push(p);
    };
    if (v.refs?.length) {
      for (const r of v.refs)
        for (const c of commentaren(ctx.db, r.start, r.eind, { zonderOnzeker: !ctx.instellingen.kerkvadersGebruiken, max: v.max ?? 120 }))
          voeg(c, { soort: "commentaar", locatie: labelReeks(c.vkey_start, c.vkey_eind) + (c.sectie ? ` — ${c.sectie}` : ""), tekst: c.tekst, url: c.bron_url });
    } else {
      const hits = zoekCommentaren(ctx.db, ftsVraag(v.tekst), v.max ?? 30).filter((h) => ctx.instellingen.kerkvadersGebruiken || !h.rechtenstatus.startsWith("rechten onzeker"));
      for (const h of hits) {
        const w = ctx.db.prepare("SELECT id AS werk, titel, auteur, jaar, taal, traditie, brontype, licentie, rechtenstatus, bron_url FROM werken WHERE id = ?").get(h.werk) as Parameters<typeof voeg>[0];
        voeg(w, { soort: "commentaar", locatie: h.label, tekst: h.fragment });
      }
    }
    return [...perWerk.values()];
  },
  async verifieer(r, fragment, ctx) {
    const hit = ctx.db.prepare("SELECT 1 FROM commentaar WHERE werk = ? AND instr(lower(tekst), lower(?)) > 0 LIMIT 1").get(r.extern_id, fragment.trim());
    return !!hit;
  },
};

export const eigenDocumenten: Connector = {
  kaart: {
    id: "eigen-documenten",
    naam: "Eigen bibliotheek (lokaal): preken, notities, transcripten, toegestane fragmenten",
    website: "lokaal",
    categorie: "Eigen bibliotheek",
    zoekmogelijkheden: "Vrij zoeken (FTS5) met pagina/sectie/tijdstip",
    api: "n.v.t.",
    toegangsvoorwaarden: "Gebruiker is verantwoordelijk voor de rechten op geüploade bestanden",
    licentie: "Privé",
    volledigeTekst: "Ja",
    actualiteit: "Direct",
    kosten: "Gratis",
    uitvoerbaarheid: "Hoog",
    geschiktheidPilot: "Hoog",
    status: "werkend",
    statusToelichting: "Standaard privé: inhoud gaat niet naar een AI-aanbieder, tenzij dat in Instellingen is toegestaan.",
    getest: "01-11-2026: echte testbestanden (PDF tekst/meerdere pagina's/voetnoten/twee kolommen/scan; DOCX koppen/tabel/voetnoten), zoeken, origineel openen, verwijderen — tests/documenten-echt.test.ts.",
  },
  ondersteunt: { zoeken: true, metadata: true, inhoud: "volledig", verificatie: true, netwerk: false },
  nietBeschikbaar: () => null,
  async zoek(v, ctx) {
    const q = ftsVraag(v.tekst, "of");
    if (!q) return [];
    const hits = ctx.db
      .prepare(
        `SELECT dd.document, dd.locatie, dd.pagina, dd.start_sec, dd.eind_sec, snippet(document_delen_fts, 0, '[', ']', '…', 30) fragment,
                d.titel, d.auteur, d.jaar, d.soort, d.video_id
         FROM document_delen_fts JOIN document_delen dd ON dd.id = document_delen_fts.rowid JOIN documenten d ON d.id = dd.document
         WHERE document_delen_fts MATCH ? ORDER BY rank LIMIT ?`,
      )
      .all(q, v.max ?? 20) as { document: string; locatie: string; pagina: number | null; start_sec: number | null; eind_sec: number | null; fragment: string; titel: string; auteur: string | null; jaar: string | null; soort: string; video_id: string | null }[];
    const per = new Map<string, { record: BronRecord; passages: Passage[] }>();
    for (const h of hits) {
      if (!per.has(h.document))
        per.set(h.document, {
          record: { connector: "eigen-documenten", extern_id: h.document, brontype: h.video_id ? "preek/lezing (video)" : "eigen document", titel: h.titel, auteurs: h.auteur ? [h.auteur] : [], jaar: h.jaar, url: h.video_id ? `https://www.youtube.com/watch?v=${h.video_id}` : null, toegang: h.video_id ? "transcript" : "volledige tekst", rechten: { vindbaar: "nee", leesbaar: "ja", downloadbaar: "nee", herbruikbaar: "onbekend", toelichting: "Eigen/privé document" } },
          passages: [],
        });
      per.get(h.document)!.passages.push({
        soort: h.video_id ? "transcript" : "document", locatie: h.locatie, tekst: h.fragment,
        url: h.video_id && h.start_sec != null ? `https://www.youtube.com/watch?v=${h.video_id}&t=${Math.floor(h.start_sec)}s` : `/api/documenten/${h.document}/bestand${h.soort === "pdf" && h.pagina ? `#page=${h.pagina}` : ""}`,
        start_sec: h.start_sec, eind_sec: h.eind_sec,
      });
    }
    return [...per.values()];
  },
};
