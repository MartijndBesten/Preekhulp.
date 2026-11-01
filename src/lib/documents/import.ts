// Eigen documenten: validatie, tekstextractie met pagina/sectie/tijdstip, ontdubbeling, opslag en verwijdering.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { dataDir, nieuweId, nu, transactie } from "../db";
import { videoIdUitUrl } from "../videos/youtube";

export const MAX_BYTES = 25 * 1024 * 1024;
export const TOEGESTAAN = ["pdf", "docx", "txt", "md", "srt", "vtt"] as const;
export type Soort = (typeof TOEGESTAAN)[number];

export interface Deel {
  locatie: string;
  pagina?: number | null;
  start_sec?: number | null;
  eind_sec?: number | null;
  tekst: string;
}

export class DocumentFout extends Error {}

export function bepaalSoort(bestandsnaam: string, buf: Buffer): Soort {
  const ext = path.extname(bestandsnaam).slice(1).toLowerCase();
  if (!(TOEGESTAAN as readonly string[]).includes(ext)) throw new DocumentFout(`Bestandstype .${ext || "?"} wordt niet ondersteund (wel: ${TOEGESTAAN.join(", ")}).`);
  if (ext === "pdf" && buf.subarray(0, 5).toString("latin1") !== "%PDF-") throw new DocumentFout("Dit bestand is geen geldige PDF.");
  if (ext === "docx" && !(buf[0] === 0x50 && buf[1] === 0x4b)) throw new DocumentFout("Dit bestand is geen geldig DOCX-bestand.");
  if (["txt", "md", "srt", "vtt"].includes(ext)) {
    if (buf.includes(0)) throw new DocumentFout("Tekstbestand bevat binaire gegevens.");
  }
  return ext as Soort;
}

function tijdNaarSec(t: string): number {
  const m = /(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})/.exec(t.trim());
  if (!m) return 0;
  return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4].padEnd(3, "0")) / 1000;
}

function secLabel(s: number): string {
  const x = Math.floor(s);
  const u = Math.floor(x / 3600);
  const m = Math.floor((x % 3600) / 60);
  const r = x % 60;
  return u ? `${u}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
}

/** SRT/VTT → blokken van ±45 seconden met begin- en eindtijd. */
export function parseOndertitels(tekst: string): Deel[] {
  const cues: { start: number; eind: number; tekst: string }[] = [];
  const blokken = tekst.replace(/\r/g, "").replace(/^WEBVTT[^\n]*\n/, "").split(/\n\s*\n/);
  for (const b of blokken) {
    const regels = b.split("\n").filter((r) => r.trim());
    const ti = regels.findIndex((r) => r.includes("-->"));
    if (ti < 0) continue;
    const [a, z] = regels[ti].split("-->");
    const t = regels.slice(ti + 1).join(" ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (t) cues.push({ start: tijdNaarSec(a), eind: tijdNaarSec(z.split(" ")[1] ?? z), tekst: t });
  }
  const delen: Deel[] = [];
  let huidig: { start: number; eind: number; teksten: string[] } | null = null;
  for (const c of cues) {
    if (!huidig || c.start - huidig.start > 45) {
      if (huidig) delen.push({ locatie: `${secLabel(huidig.start)}–${secLabel(huidig.eind)}`, start_sec: huidig.start, eind_sec: huidig.eind, tekst: ontdubbelRegels(huidig.teksten) });
      huidig = { start: c.start, eind: c.eind, teksten: [c.tekst] };
    } else {
      huidig.eind = c.eind;
      huidig.teksten.push(c.tekst);
    }
  }
  if (huidig) delen.push({ locatie: `${secLabel(huidig.start)}–${secLabel(huidig.eind)}`, start_sec: huidig.start, eind_sec: huidig.eind, tekst: ontdubbelRegels(huidig.teksten) });
  return delen;
}

/** Automatische YouTube-ondertitels herhalen vaak regels; dubbele opeenvolgende stukken weglaten. */
function ontdubbelRegels(regels: string[]): string {
  const uit: string[] = [];
  for (const r of regels) if (uit[uit.length - 1] !== r) uit.push(r);
  return uit.join(" ");
}

export function splitsTekst(tekst: string, soort: "txt" | "md"): Deel[] {
  const delen: Deel[] = [];
  let sectie = "begin";
  let buffer: string[] = [];
  let teller = 0;
  const leeg = () => {
    const t = buffer.join("\n").trim();
    if (t) delen.push({ locatie: `${sectie}${teller ? ` (deel ${teller + 1})` : ""}`, tekst: t });
    buffer = [];
  };
  for (const regel of tekst.replace(/\r/g, "").split("\n")) {
    if (soort === "md" && /^#{1,4}\s/.test(regel)) {
      leeg();
      teller = 0;
      sectie = regel.replace(/^#+\s*/, "").slice(0, 120);
      continue;
    }
    buffer.push(regel);
    if (buffer.join("\n").length > 1800 && regel.trim() === "") {
      leeg();
      teller++;
    }
  }
  leeg();
  return delen;
}

export async function extraheer(soort: Soort, buf: Buffer): Promise<{ delen: Deel[]; paginas: number | null }> {
  if (soort === "pdf") {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { totalPages, text } = await extractText(pdf, { mergePages: false });
    const paginas = (Array.isArray(text) ? text : [text]).map((t, i) => ({ locatie: `p. ${i + 1}`, pagina: i + 1, tekst: String(t).replace(/\s+\n/g, "\n").trim() }));
    return { delen: paginas.filter((p) => p.tekst), paginas: totalPages };
  }
  if (soort === "docx") {
    const mammoth = await import("mammoth");
    const r = await mammoth.extractRawText({ buffer: buf });
    return { delen: splitsTekst(r.value, "txt").map((d, i) => ({ ...d, locatie: `sectie ${i + 1}` })), paginas: null };
  }
  const tekst = buf.toString("utf8");
  if (soort === "srt" || soort === "vtt") return { delen: parseOndertitels(tekst), paginas: null };
  return { delen: splitsTekst(tekst, soort), paginas: null };
}

export interface NieuwDocument {
  titel?: string;
  auteur?: string;
  jaar?: string;
  bronvermelding?: string;
  project?: string | null;
  videoUrl?: string;
  transcriptSoort?: "automatisch" | "handmatig" | "onbekend";
}

export async function importeerDocument(d: DatabaseSync, bestandsnaam: string, buf: Buffer, meta: NieuwDocument): Promise<{ id: string; duplicaat: boolean; delen: number }> {
  if (buf.length === 0) throw new DocumentFout("Leeg bestand.");
  if (buf.length > MAX_BYTES) throw new DocumentFout(`Bestand is groter dan ${MAX_BYTES / 1024 / 1024} MB.`);
  const veiligeNaam = path.basename(bestandsnaam).replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 160);
  const soort = bepaalSoort(veiligeNaam, buf);
  const sha = createHash("sha256").update(buf).digest("hex");
  const bestaand = d.prepare("SELECT id FROM documenten WHERE sha256 = ?").get(sha) as { id: string } | undefined;
  if (bestaand) return { id: bestaand.id, duplicaat: true, delen: 0 };
  let ex: Awaited<ReturnType<typeof extraheer>>;
  try {
    ex = await extraheer(soort, buf);
  } catch (e) {
    throw new DocumentFout(`Tekst kon niet worden gelezen: ${(e as Error).message}`);
  }
  if (!ex.delen.length) throw new DocumentFout("Geen tekst gevonden (gescande PDF zonder tekstlaag?).");
  const videoId = meta.videoUrl ? videoIdUitUrl(meta.videoUrl) : null;
  if (meta.videoUrl && !videoId) throw new DocumentFout("De opgegeven video-URL is geen herkenbare YouTube-link.");
  const id = nieuweId("d");
  transactie(d, () => {
    d.prepare(
      "INSERT INTO documenten (id, project, titel, bestandsnaam, soort, sha256, grootte, paginas, auteur, jaar, bronvermelding, prive, video_id, transcript_soort, gemaakt) VALUES (?,?,?,?,?,?,?,?,?,?,?,1,?,?,?)",
    ).run(id, meta.project ?? null, (meta.titel || veiligeNaam).slice(0, 300), veiligeNaam, soort, sha, buf.length, ex.paginas, meta.auteur ?? null, meta.jaar ?? null, meta.bronvermelding ?? null, videoId, videoId ? meta.transcriptSoort ?? "onbekend" : null, nu());
    const ins = d.prepare("INSERT INTO document_delen (document, volgorde, locatie, pagina, start_sec, eind_sec, tekst) VALUES (?,?,?,?,?,?,?)");
    const fts = d.prepare("INSERT INTO document_delen_fts (rowid, tekst) VALUES (?, ?)");
    ex.delen.forEach((dl, i) => {
      const r = ins.run(id, i, dl.locatie, dl.pagina ?? null, dl.start_sec ?? null, dl.eind_sec ?? null, dl.tekst);
      fts.run(Number(r.lastInsertRowid), dl.tekst);
    });
  });
  const map = path.join(dataDir(), "uploads");
  fs.mkdirSync(map, { recursive: true });
  fs.writeFileSync(path.join(map, `${id}.${soort}`), buf, { mode: 0o600 });
  return { id, duplicaat: false, delen: ex.delen.length };
}

/** Verwijdert document, delen, zoekindex, samenvattingen en het opgeslagen bestand. */
export function verwijderDocument(d: DatabaseSync, id: string): boolean {
  const doc = d.prepare("SELECT soort FROM documenten WHERE id = ?").get(id) as { soort: string } | undefined;
  if (!doc) return false;
  transactie(d, () => {
    const delen = d.prepare("SELECT id, tekst FROM document_delen WHERE document = ?").all(id) as { id: number; tekst: string }[];
    const del = d.prepare("INSERT INTO document_delen_fts (document_delen_fts, rowid, tekst) VALUES ('delete', ?, ?)");
    for (const x of delen) del.run(x.id, x.tekst);
    // Afgeleide passages die uit dit document in onderzoeken zijn opgenomen, ook verwijderen.
    const bron = d.prepare("SELECT id FROM bronnen WHERE connector = 'eigen-documenten' AND json_extract(extra, '$.extern_id') = ?").all(id) as { id: string }[];
    for (const b of bron) d.prepare("DELETE FROM bronnen WHERE id = ?").run(b.id);
    d.prepare("DELETE FROM documenten WHERE id = ?").run(id);
  });
  try {
    fs.rmSync(path.join(dataDir(), "uploads", `${id}.${doc.soort}`), { force: true });
  } catch {
    /* bestand al weg */
  }
  return true;
}
