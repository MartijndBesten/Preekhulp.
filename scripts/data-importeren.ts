// Bouwt de lokale database op uit .data/brondata (zie data-ophalen.ts).
// Herhaalbaar: per dataset worden de bestaande rijen eerst verwijderd.
// Gebruik: npm run data:importeren [-- --kerkvaders]
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { parse as parseToml } from "smol-toml";
import { dataDir, openDb, transactie } from "../src/lib/db";
import { BOEK_PER_OSIS, BOEK_PER_STEP, BOEK_PER_USFM, BOEKEN, vindBoek, vkey, vkeyUitOsis } from "../src/lib/scripture/books";
import { DATASETS } from "../src/lib/sources/datasets";

const BRON = path.join(dataDir(), "brondata");
const d = openDb();
const ds = (id: string) => DATASETS.find((x) => x.id === id)!;
const bestaat = (p: string) => fs.existsSync(p);

function stripHtml(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

function log(s: string) {
  console.log(new Date().toISOString().slice(11, 19), s);
}

// ---------------------------------------------------------------- STEP grondtekst
function importeerStep() {
  const map = path.join(BRON, "step");
  if (!bestaat(map)) return log("STEP: brondata ontbreekt, overgeslagen");
  const insWoord = d.prepare(
    "INSERT OR REPLACE INTO woorden (vkey,pos,taal,vorm,translit,glosse,strong,strong_basis,lemma,morf,bron_ref,eigennaam) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
  );
  transactie(d, () => d.exec("DELETE FROM woorden; DELETE FROM lexicon; DELETE FROM morfologie; DELETE FROM lemma_freq;"));

  const ot = /^([1-3]?[A-Za-z]{2,3})\.(\d+)\.(\d+)(?:\((\d+)\.(\d+)\))?#(\d+)=([A-Za-z()]+)\t/;
  let n = 0;
  for (const f of ds("step").bestanden!.filter((b) => b.includes("TAHOT"))) {
    const regels = fs.readFileSync(path.join(map, f), "utf8").split("\n");
    transactie(d, () => {
      for (const r of regels) {
        const m = ot.exec(r);
        if (!m) continue;
        const type = m[7];
        if (/^K/.test(type)) continue; // ketiv-regels overslaan; qere/Leningrad volstaat voor zoeken
        const boek = BOEK_PER_STEP.get(m[1]);
        if (!boek) continue;
        const k = vkey(boek.nr, Number(m[2]), Number(m[3]));
        const v = r.split("\t");
        const strongDelen = (v[4] ?? "").split("/");
        let idx = strongDelen.findIndex((s) => s.includes("{"));
        if (idx < 0) idx = strongDelen.length - 1;
        const strong = (strongDelen[idx] ?? "").replace(/[{}]/g, "").replace(/[\\+].*$/, "").trim();
        const morfDelen = (v[5] ?? "").split("/");
        let morf = morfDelen[idx] ?? morfDelen[morfDelen.length - 1] ?? "";
        if (morf && idx > 0 && !morf.startsWith("H")) morf = "H" + morf;
        const lemmaM = /\{H\d+[A-Z]?=([^=]+)=/.exec(v[11] ?? "");
        const basis = /^H\d{4}/.exec(strong)?.[0] ?? null;
        insWoord.run(
          k,
          Number(m[6]),
          "he",
          (v[1] ?? "").replace(/[\/\\]/g, ""),
          (v[2] ?? "").replace(/\//g, ""),
          (v[3] ?? "").replace(/\//g, " ").replace(/\s+/g, " ").trim(),
          strong || null,
          basis,
          lemmaM?.[1] ?? null,
          morf || null,
          m[4] ? `${m[1]}.${m[4]}.${m[5]}` : null,
          /^HNp/.test(morf) ? 1 : 0,
        );
        n++;
      }
    });
    log(`STEP: ${f.slice(f.indexOf("/") + 1, f.indexOf(" -"))} verwerkt`);
  }

  const nt = /^([1-3]?[A-Za-z]{2,3})\.(\d+)\.(\d+)(?:\([^)]*\))?#(\d+)=([A-Za-z]+)\t/;
  for (const f of ds("step").bestanden!.filter((b) => b.includes("TAGNT"))) {
    const regels = fs.readFileSync(path.join(map, f), "utf8").split("\n");
    transactie(d, () => {
      for (const r of regels) {
        const m = nt.exec(r);
        if (!m) continue;
        const v = r.split("\t");
        if (!(v[5] ?? "").includes("NA28")) continue; // kritische tekst (NA28) als basis
        const boek = BOEK_PER_STEP.get(m[1]);
        if (!boek) continue;
        const k = vkey(boek.nr, Number(m[2]), Number(m[3]));
        const [strong, morf] = (v[3] ?? "").split("=");
        const [lemma, glosLex] = (v[4] ?? "").split("=");
        const vormM = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(v[1] ?? "");
        const basis = /^G\d{4}/.exec(strong ?? "")?.[0] ?? null;
        insWoord.run(
          k,
          Number(m[4]),
          "gr",
          vormM?.[1] ?? v[1] ?? "",
          vormM?.[2] ?? null,
          (v[2] || glosLex || "").trim(),
          strong || null,
          basis,
          lemma || null,
          morf || null,
          null,
          /^N-.*-(P|L|T)/.test(morf ?? "") || /-PRI$/.test(morf ?? "") ? 1 : 0,
        );
        n++;
      }
    });
    log(`STEP: ${f.slice(f.indexOf("/") + 1, f.indexOf(" -"))} verwerkt`);
  }

  const insLex = d.prepare("INSERT OR IGNORE INTO lexicon (strong,taal,lemma,translit,woordsoort,glosse,definitie) VALUES (?,?,?,?,?,?,?)");
  for (const f of ds("step").bestanden!.filter((b) => b.includes("Lexicons/"))) {
    const taal = f.includes("TBESH") ? "he" : "gr";
    transactie(d, () => {
      for (const r of fs.readFileSync(path.join(map, f), "utf8").split("\n")) {
        if (!/^[HG]\d{4}[A-Za-z]?\t/.test(r)) continue;
        const v = r.split("\t");
        const eStrong = (v[1] ?? "").replace(/\s*=.*$/, "").trim();
        const def = stripHtml(v[7] ?? "").slice(0, 4000);
        for (const key of [eStrong, v[0]]) if (key) insLex.run(key, taal, v[3] ?? null, v[4] ?? null, v[5] ?? null, v[6] ?? null, def);
      }
    });
  }
  const insMorf = d.prepare("INSERT OR IGNORE INTO morfologie (code, uitleg) VALUES (?,?)");
  for (const f of ds("step").bestanden!.filter((b) => b.includes("Morphology"))) {
    const p = path.join(map, f);
    if (!bestaat(p)) continue;
    transactie(d, () => {
      for (const r of fs.readFileSync(p, "utf8").split("\n")) {
        const v = r.split("\t");
        if (v.length >= 2 && /^[A-Z][A-Za-z0-9-]{1,20}$/.test(v[0]) && v[1].includes("=")) insMorf.run(v[0], v[1].trim());
      }
    });
  }
  d.exec(`INSERT INTO lemma_freq (strong_basis, totaal, verzen)
          SELECT strong_basis, COUNT(*), COUNT(DISTINCT vkey) FROM woorden WHERE strong_basis IS NOT NULL GROUP BY strong_basis`);
  zetMeta("step", ds("step").commit);
  log(`STEP: ${n} woorden, lexicon en morfologie geïmporteerd`);
}

// ---------------------------------------------------------------- Vertalingen
function vertaling(id: string, naam: string, taal: string, licentie: string, bron: string, attributie: string, commit: string) {
  d.prepare("DELETE FROM verzen_fts WHERE vertaling = ?").run(id);
  d.prepare("DELETE FROM vertalingen WHERE id = ?").run(id);
  d.prepare("INSERT INTO vertalingen (id,naam,taal,licentie,bron_url,attributie,bron_commit) VALUES (?,?,?,?,?,?,?)").run(
    id, naam, taal, licentie, bron, attributie, commit,
  );
}

function importeerStatenvertaling() {
  const p = path.join(BRON, "statenvertaling", "STV.xml");
  if (!bestaat(p)) return log("Statenvertaling: brondata ontbreekt, overgeslagen");
  const x = fs.readFileSync(p, "utf8");
  const meta = ds("statenvertaling");
  werk("kanttekeningen", "Kanttekeningen bij de Statenvertaling", "Synode van Dordrecht (vertalers/revisoren)", "1637", "nl", "gereformeerd",
    "historische kanttekeningen", meta.licentie, "publiek domein — herbruikbaar", `https://github.com/${meta.repo}`, meta.attributie, "Transcriptie naar de editie van 1888", meta.commit);
  transactie(d, () => {
    vertaling("SV", "Statenvertaling (1637; spelling editie 1888)", "nl", meta.licentie, `https://github.com/${meta.repo}`, meta.attributie, meta.commit);
    const insV = d.prepare("INSERT INTO verzen (vertaling,vkey,ref,tekst) VALUES ('SV',?,?,?)");
    const insF = d.prepare("INSERT INTO verzen_fts (vertaling,vkey,tekst) VALUES ('SV',?,?)");
    const insC = d.prepare("INSERT INTO commentaar (werk,vkey_start,vkey_eind,label,sectie,tekst) VALUES ('kanttekeningen',?,?,?,?,?)");
    let n = 0;
    for (const m of x.matchAll(/<verse osisID="([^"]+)"[^>]*>([\s\S]*?)<\/verse>/g)) {
      const ref = m[1].split(/\s+/)[0];
      const k = vkeyUitOsis(ref);
      if (!k) continue;
      const notes: { vang: string; tekst: string }[] = [];
      const zonderNotes = m[2].replace(/<note[^>]*>([\s\S]*?)<\/note>/g, (_, inh: string) => {
        const vang = /<catchWord>([\s\S]*?)<\/catchWord>/.exec(inh)?.[1] ?? "";
        notes.push({ vang: stripHtml(vang), tekst: stripHtml(inh.replace(/<catchWord>[\s\S]*?<\/catchWord>/, "")) });
        return "";
      });
      const tekst = stripHtml(zonderNotes).replace(/\s+([,.;:!?])/g, "$1");
      insV.run(k, ref, tekst);
      insF.run(k, tekst);
      for (const nt of notes) insC.run(k, k, ref, null, nt.vang ? `${nt.vang.replace(/[,;:]$/, "")} — ${nt.tekst}` : nt.tekst);
      n++;
    }
    log(`Statenvertaling: ${n} verzen + kanttekeningen`);
  });
}

function importeerBsb() {
  const p = path.join(BRON, "bsb-kruisverwijzingen", "data/raw/bsb.txt");
  if (!bestaat(p)) return log("BSB: brondata ontbreekt, overgeslagen");
  const meta = ds("bsb-kruisverwijzingen");
  transactie(d, () => {
    vertaling("BSB", "Berean Standard Bible", "en", "Publiek domein", "https://berean.bible/", "Berean Standard Bible (publiek domein, BereanBible.com)", meta.commit);
    const insV = d.prepare("INSERT INTO verzen (vertaling,vkey,ref,tekst) VALUES ('BSB',?,?,?)");
    const insF = d.prepare("INSERT INTO verzen_fts (vertaling,vkey,tekst) VALUES ('BSB',?,?)");
    let n = 0;
    for (const r of fs.readFileSync(p, "utf8").split("\n")) {
      const m = /^(.+?) (\d+):(\d+)\t(.+)$/.exec(r.trim());
      if (!m) continue;
      const boek = vindBoek(m[1]);
      if (!boek) continue;
      const k = vkey(boek.nr, Number(m[2]), Number(m[3]));
      const tekst = m[4].trim();
      insV.run(k, `${boek.osis}.${m[2]}.${m[3]}`, tekst);
      insF.run(k, tekst);
      n++;
    }
    log(`BSB: ${n} verzen`);
  });
}

// Minimale zip-lezer (één of meer 'deflate'-bestanden), voldoende voor het OpenBible-archief.
function leesZip(buf: Buffer): Map<string, Buffer> {
  const uit = new Map<string, Buffer>();
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error("Geen geldig zip-bestand");
  let p = buf.readUInt32LE(eocd + 16);
  const aantal = buf.readUInt16LE(eocd + 10);
  for (let i = 0; i < aantal; i++) {
    const methode = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28);
    const elen = buf.readUInt16LE(p + 30);
    const clen = buf.readUInt16LE(p + 32);
    const lokaal = buf.readUInt32LE(p + 42);
    const naam = buf.subarray(p + 46, p + 46 + nlen).toString("utf8");
    const lnlen = buf.readUInt16LE(lokaal + 26);
    const lelen = buf.readUInt16LE(lokaal + 28);
    const data = buf.subarray(lokaal + 30 + lnlen + lelen, lokaal + 30 + lnlen + lelen + csize);
    uit.set(naam, methode === 8 ? zlib.inflateRawSync(data) : Buffer.from(data));
    p += 46 + nlen + elen + clen;
  }
  return uit;
}

function importeerKruisverwijzingen() {
  const p = path.join(BRON, "bsb-kruisverwijzingen", "data/raw/openbible-cross-references.zip");
  if (!bestaat(p)) return log("Kruisverwijzingen: brondata ontbreekt, overgeslagen");
  const bestanden = leesZip(fs.readFileSync(p));
  const tekst = [...bestanden.entries()].find(([n]) => n.endsWith(".txt"))?.[1].toString("utf8") ?? "";
  transactie(d, () => {
    d.exec("DELETE FROM kruisverwijzingen");
    const ins = d.prepare("INSERT INTO kruisverwijzingen (van,naar_start,naar_eind,stemmen) VALUES (?,?,?,?)");
    let n = 0;
    for (const r of tekst.split("\n")) {
      const v = r.trim().split("\t");
      if (v.length < 3 || !/^-?\d+$/.test(v[2])) continue;
      const stemmen = Number(v[2]);
      if (stemmen < 1) continue;
      const van = vkeyUitOsis(v[0]);
      const [a, b] = v[1].split("-");
      const s = vkeyUitOsis(a);
      const e = b ? vkeyUitOsis(b) : s;
      if (!van || !s || !e) continue;
      ins.run(van, s, e, stemmen);
      n++;
    }
    log(`Kruisverwijzingen: ${n}`);
  });
  zetMeta("kruisverwijzingen", ds("bsb-kruisverwijzingen").commit);
}

// ---------------------------------------------------------------- Commentaren
function werk(id: string, titel: string, auteur: string, jaar: string, taal: string, traditie: string, brontype: string,
  licentie: string, rechtenstatus: string, url: string, attributie: string, editie: string, commit: string) {
  d.prepare("DELETE FROM commentaar WHERE werk = ?").run(id);
  d.prepare("DELETE FROM werken WHERE id = ?").run(id);
  d.prepare(
    "INSERT INTO werken (id,titel,auteur,jaar,taal,traditie,brontype,licentie,rechtenstatus,bron_url,attributie,editie,bron_commit) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
  ).run(id, titel, auteur, jaar, taal, traditie, brontype, licentie, rechtenstatus, url, attributie, editie, commit);
}

function importeerCalvijn() {
  const map = path.join(BRON, "calvijn", "c", "calvin");
  if (!bestaat(map)) return log("Calvijn: brondata ontbreekt, overgeslagen");
  const meta = ds("calvijn");
  werk("calvijn", "Commentaries (Engelse vertaling, Calvin Translation Society 1844–1856)", "Johannes Calvijn", "1540–1564", "en",
    "gereformeerd", "historisch commentaar", meta.licentie, "publiek domein — herbruikbaar", `https://github.com/${meta.repo}`, meta.attributie,
    "Via CrossWire-module CalvinCommentaries (bron: CCEL)", meta.commit);
  const ins = d.prepare("INSERT INTO commentaar (werk,vkey_start,vkey_eind,label,sectie,tekst,bron_url) VALUES ('calvijn',?,?,?,?,?,?)");
  let n = 0;
  transactie(d, () => {
    for (const usfm of fs.readdirSync(map)) {
      const boek = BOEK_PER_USFM.get(usfm);
      if (!boek || !fs.statSync(path.join(map, usfm)).isDirectory()) continue;
      for (const f of fs.readdirSync(path.join(map, usfm))) {
        const h = Number(f.replace(".json", ""));
        if (!h) continue;
        const j = JSON.parse(fs.readFileSync(path.join(map, usfm, f), "utf8"));
        for (const item of j?.chapter?.content ?? []) {
          if (item.type !== "verse" || !item.number) continue;
          const tekst = (item.content ?? []).map((c: { text?: string } | string) => (typeof c === "string" ? c : c.text ?? "")).join(" ").trim();
          if (!tekst) continue;
          const k = vkey(boek.nr, h, item.number);
          ins.run(k, k, `${boek.osis}.${h}.${item.number}`, null, tekst,
            `https://github.com/${meta.repo}/blob/${meta.commit}/c/calvin/${usfm}/${h}.json`);
          n++;
        }
      }
    }
  });
  log(`Calvijn: ${n} versopmerkingen`);
}

const SUPERSCRIPT: Record<string, string> = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9" };

function importeerMatthewHenry() {
  const map = path.join(BRON, "matthew-henry");
  if (!bestaat(map)) return log("Matthew Henry: brondata ontbreekt, overgeslagen");
  const meta = ds("matthew-henry");
  werk("matthew-henry", "Commentary on the Whole Bible (Complete)", "Matthew Henry", "1706–1714", "en", "puriteins/presbyteriaans",
    "historisch commentaar", meta.licentie, "publiek domein — herbruikbaar", `https://github.com/${meta.repo}`, meta.attributie, "Markdown-editie lyteword", meta.commit);
  const ins = d.prepare("INSERT INTO commentaar (werk,vkey_start,vkey_eind,label,sectie,tekst,bron_url) VALUES ('matthew-henry',?,?,?,?,?,?)");
  const slugNaarBoek = (slug: string) =>
    BOEKEN.find((b) => b.en.toLowerCase().replace(/ /g, "-") === slug) ?? (slug === "song-of-solomon" ? BOEK_PER_OSIS.get("Song") : undefined);
  let n = 0;
  transactie(d, () => {
    for (const vol of fs.readdirSync(map).filter((v) => v.startsWith("volume-"))) {
      for (const slug of fs.readdirSync(path.join(map, vol))) {
        const boekMap = path.join(map, vol, slug);
        if (!fs.statSync(boekMap).isDirectory()) continue;
        const boek = slugNaarBoek(slug);
        if (!boek) continue;
        for (const f of fs.readdirSync(boekMap)) {
          const h = Number(/(?:chapter|psalm)-(\d+)\.md$/.exec(f)?.[1]);
          if (!h) continue;
          const md = fs.readFileSync(path.join(boekMap, f), "utf8").replace(/^---[\s\S]*?---\s*/, "");
          let sectie = "";
          let verzen: number[] = [];
          let buffer: string[] = [];
          const opslaan = () => {
            const tekst = buffer.join("\n").trim();
            if (tekst && verzen.length) {
              const a = vkey(boek.nr, h, Math.min(...verzen));
              const b = vkey(boek.nr, h, Math.max(...verzen));
              ins.run(a, b, `${boek.osis}.${h}.${Math.min(...verzen)}-${Math.max(...verzen)}`, sectie, tekst,
                `https://github.com/${meta.repo}/blob/${meta.commit}/${vol}/${slug}/${f}`);
              n++;
            }
            buffer = [];
          };
          let inCitaat = false;
          for (const regel of md.split("\n")) {
            if (regel.startsWith("## ")) {
              opslaan();
              verzen = [];
              sectie = regel.slice(3).trim();
              inCitaat = false;
              continue;
            }
            if (regel.startsWith(">")) {
              if (!inCitaat) {
                opslaan();
                verzen = [];
              }
              inCitaat = true;
              const nr = /\*\*([⁰¹²³⁴⁵⁶⁷⁸⁹]+)\*\*/.exec(regel)?.[1];
              if (nr) verzen.push(Number([...nr].map((c) => SUPERSCRIPT[c]).join("")));
              continue;
            }
            if (regel.trim()) inCitaat = false;
            if (!regel.startsWith("# ")) buffer.push(regel.replace(/\\\./g, "."));
          }
          opslaan();
        }
      }
    }
  });
  log(`Matthew Henry: ${n} perikoopcommentaren`);
}

function importeerKerkvaders() {
  const map = path.join(BRON, "kerkvaders");
  if (!bestaat(map)) return log("Kerkvaders: brondata ontbreekt (optioneel), overgeslagen");
  const meta = ds("kerkvaders");
  const oud = d.prepare("SELECT id FROM werken WHERE id LIKE 'kv-%'").all() as { id: string }[];
  transactie(d, () => {
    for (const w of oud) {
      d.prepare("DELETE FROM commentaar WHERE werk = ?").run(w.id);
      d.prepare("DELETE FROM werken WHERE id = ?").run(w.id);
    }
  });
  let n = 0;
  let auteurs = 0;
  const bestandPatroon = /^(.+?) (\d+)_(\d+)(?:-(\d+)(?:_(\d+))?)?\.toml$/;
  for (const auteur of fs.readdirSync(map)) {
    const amap = path.join(map, auteur);
    if (auteur.startsWith(".") || !fs.statSync(amap).isDirectory()) continue;
    let jaar: number | null = null;
    const metaPad = path.join(amap, "metadata.toml");
    if (bestaat(metaPad)) {
      try {
        const mt = parseToml(fs.readFileSync(metaPad, "utf8")) as Record<string, unknown>;
        const y = mt.default_year ?? mt.year;
        jaar = typeof y === "number" ? y : Number(String(y ?? "").replace(/[^\d-]/g, "")) || null;
      } catch {
        jaar = null;
      }
    }
    if (jaar === null || jaar >= 1900) continue; // onbekend of te recent: niet importeren
    const id = "kv-" + auteur.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-z0-9]+/g, "-");
    const ins = d.prepare("INSERT INTO commentaar (werk,vkey_start,vkey_eind,label,sectie,tekst,bron_url) VALUES (?,?,?,?,?,?,?)");
    let telAuteur = 0;
    transactie(d, () => {
      werk(id, `Uitleg (citaten per tekst)`, auteur, String(jaar), "en", "vroegchristelijk/middeleeuws", "kerkvader/historische uitleg",
        meta.licentie, "rechten onzeker — alleen voor eigen studie, niet publiceren", `https://github.com/${meta.repo}`, meta.attributie,
        "Engelse vertaling; editie per citaat onbekend", meta.commit);
      for (const f of fs.readdirSync(amap)) {
        const m = bestandPatroon.exec(f);
        if (!m) continue;
        const boek = vindBoek(m[1]);
        if (!boek) continue;
        const h = Number(m[2]);
        const v = Number(m[3]);
        const eindH = m[5] ? Number(m[4]) : h;
        const eindV = m[5] ? Number(m[5]) : m[4] ? Number(m[4]) : v;
        let data: { commentary?: { quote?: string; source_title?: string; source_url?: string }[] };
        try {
          data = parseToml(fs.readFileSync(path.join(amap, f), "utf8")) as typeof data;
        } catch {
          continue;
        }
        for (const c of data.commentary ?? []) {
          const q = (c.quote ?? "").trim();
          if (!q) continue;
          ins.run(id, vkey(boek.nr, h, v), vkey(boek.nr, eindH, eindV), f.replace(".toml", ""), c.source_title ?? null, q, c.source_url || null);
          n++;
          telAuteur++;
        }
      }
    });
    if (telAuteur) auteurs++;
    else d.prepare("DELETE FROM werken WHERE id = ?").run(id);
  }
  log(`Kerkvaders: ${n} citaten van ${auteurs} auteurs (vóór 1900)`);
}

function zetMeta(k: string, v: string) {
  d.prepare("INSERT OR REPLACE INTO meta (sleutel, waarde) VALUES (?, ?)").run(`dataset:${k}`, v);
}

function herbouwFts() {
  d.exec("INSERT INTO commentaar_fts(commentaar_fts) VALUES('rebuild')");
  log("Zoekindex commentaren herbouwd");
}

const kerkvaders = process.argv.includes("--kerkvaders");
const alleenKerkvaders = kerkvaders && process.argv.includes("--alleen");
if (!alleenKerkvaders) {
  importeerStatenvertaling();
  importeerBsb();
  importeerKruisverwijzingen();
  importeerCalvijn();
  importeerMatthewHenry();
  importeerStep();
}
if (kerkvaders || bestaat(path.join(BRON, "kerkvaders"))) importeerKerkvaders();
herbouwFts();
d.prepare("INSERT OR REPLACE INTO meta (sleutel, waarde) VALUES ('geimporteerd', ?)").run(new Date().toISOString());
d.exec("PRAGMA optimize; VACUUM;");
log("Klaar.");
