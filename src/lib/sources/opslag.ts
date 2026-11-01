// Opslaan en ontdubbelen van gevonden bronnen en passages.
import type { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { json, nu } from "../db";
import type { BronRecord, Passage } from "./types";

export function normaliseerDoi(doi?: string | null): string | null {
  if (!doi) return null;
  const m = /10\.\d{4,9}\/\S+/i.exec(doi.trim());
  return m ? m[0].replace(/[.,;)\]]+$/, "").toLowerCase() : null;
}

export function normaliseerTitel(t: string): string {
  return t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function canonUrl(u?: string | null): string | null {
  if (!u) return null;
  try {
    const x = new URL(u);
    x.hash = "";
    for (const p of [...x.searchParams.keys()]) if (/^utm_|^fbclid$|^gclid$/.test(p)) x.searchParams.delete(p);
    x.hostname = x.hostname.replace(/^www\./, "");
    return x.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

/** Stabiele bron-id: DOI wint, anders connector + extern id (URL's worden apart voor ontdubbeling gebruikt). */
export function bronId(r: Pick<BronRecord, "doi" | "url" | "connector" | "extern_id">): string {
  const sleutel = normaliseerDoi(r.doi) ?? `${r.connector}:${r.extern_id}`;
  return "b" + createHash("sha256").update(sleutel).digest("hex").slice(0, 16);
}

/** Zoekt een bestaande bron met dezelfde DOI of (titel + jaar), zodat dubbele publicaties één bron worden. */
export function vindDubbel(d: DatabaseSync, r: BronRecord): string | null {
  const doi = normaliseerDoi(r.doi);
  if (doi) {
    const x = d.prepare("SELECT id FROM bronnen WHERE doi = ?").get(doi) as { id: string } | undefined;
    if (x) return x.id;
  }
  const url = canonUrl(r.url);
  if (url && r.connector !== "lokaal-bijbel" && r.connector !== "analyse" && r.connector !== "lokaal-commentaren" && r.connector !== "lokaal-grondtekst") {
    const kandidaten = d.prepare("SELECT id, url FROM bronnen WHERE url IS NOT NULL AND connector NOT IN ('lokaal-bijbel','analyse','lokaal-commentaren','lokaal-grondtekst')").all() as { id: string; url: string }[];
    const hit = kandidaten.find((k) => canonUrl(k.url) === url);
    if (hit) return hit.id;
  }
  if (r.titel && r.jaar) {
    // Een gelijknamig werk uit hetzelfde jaar kan van een andere auteur zijn.
    // Zonder auteursgegevens (of DOI/identieke URL hierboven) NIET automatisch samenvoegen.
    const auteur = normaliseerTitel(r.auteurs[0] ?? "");
    if (auteur) {
      const kandidaten = d.prepare("SELECT id, titel, auteurs FROM bronnen WHERE jaar = ?").all(String(r.jaar)) as { id: string; titel: string; auteurs: string }[];
      const t = normaliseerTitel(r.titel);
      const hit = kandidaten.find((k) => normaliseerTitel(k.titel) === t && normaliseerTitel(json<string[]>(k.auteurs, [])[0] ?? "") === auteur);
      if (hit) return hit.id;
    }
  }
  return null;
}

export function bewaarBron(d: DatabaseSync, r: BronRecord): string {
  const eigenId = bronId(r);
  const bestaand = (d.prepare("SELECT id FROM bronnen WHERE id = ?").get(eigenId) as { id: string } | undefined)?.id ?? vindDubbel(d, r);
  const id = bestaand ?? eigenId;
  const doi = normaliseerDoi(r.doi);
  if (bestaand) {
    // Aanvullen, niet overschrijven: bewaar extra vindplaatsen in 'extra.vindplaatsen'.
    const oud = d.prepare("SELECT extra, samenvatting, url, toegang, volledige_tekst FROM bronnen WHERE id = ?").get(id) as {
      extra: string; samenvatting: string | null; url: string | null; toegang: string; volledige_tekst: number;
    };
    const extra = json<Record<string, unknown>>(oud.extra, {});
    const vind = new Set<string>((extra.vindplaatsen as string[]) ?? []);
    vind.add(`${r.connector}:${r.extern_id}`);
    extra.vindplaatsen = [...vind];
    d.prepare("UPDATE bronnen SET extra = ?, samenvatting = COALESCE(samenvatting, ?), url = COALESCE(url, ?), volledige_tekst = MAX(volledige_tekst, ?) WHERE id = ?").run(
      JSON.stringify(extra), r.samenvatting ?? null, r.url ?? null, r.toegang === "volledige tekst" ? 1 : 0, id,
    );
    return id;
  }
  d.prepare(
    `INSERT INTO bronnen (id, connector, brontype, titel, auteurs, jaar, datum, uitgever, url, doi, taal, samenvatting, bijbelgedeelten,
       volledige_tekst, toegang, rechten, traditie, geraadpleegd, bibliografisch, inhoudelijk, extra)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    id, r.connector, r.brontype, r.titel.slice(0, 500), JSON.stringify(r.auteurs.slice(0, 30)), r.jaar ?? null, r.datum ?? null,
    r.uitgever ?? null, r.url ?? null, doi, r.taal ?? null, r.samenvatting?.slice(0, 6000) ?? null,
    JSON.stringify(r.bijbelgedeelten ?? []), r.toegang === "volledige tekst" ? 1 : 0, r.toegang, JSON.stringify(r.rechten),
    r.traditie ?? null, nu(), doi ? "doi_aanwezig" : "niet_gecontroleerd", "niet_gecontroleerd",
    JSON.stringify({ ...(r.extra ?? {}), extern_id: r.extern_id, volledigeTekstUrl: r.volledigeTekstUrl ?? null, vindplaatsen: [`${r.connector}:${r.extern_id}`] }),
  );
  return id;
}

export function bewaarPassage(d: DatabaseSync, bron: string, p: Passage): string {
  const id = "p" + createHash("sha256").update(`${bron}|${p.soort}|${p.locatie}|${p.tekst}`).digest("hex").slice(0, 16);
  d.prepare("INSERT OR IGNORE INTO passages (id, bron, soort, locatie, tekst, url, start_sec, eind_sec) VALUES (?,?,?,?,?,?,?,?)").run(
    id, bron, p.soort, p.locatie, p.tekst.slice(0, 12000), p.url ?? null, p.start_sec ?? null, p.eind_sec ?? null,
  );
  return id;
}

export interface BronRij {
  id: string;
  connector: string;
  brontype: string;
  titel: string;
  auteurs: string;
  jaar: string | null;
  uitgever: string | null;
  url: string | null;
  doi: string | null;
  taal: string | null;
  samenvatting: string | null;
  toegang: string;
  rechten: string;
  traditie: string | null;
  geraadpleegd: string;
  bibliografisch: string;
  inhoudelijk: string;
  extra: string;
  volledige_tekst: number;
}
