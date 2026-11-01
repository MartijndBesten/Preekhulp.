// Haalt de vastgepinde open datasets op naar .data/brondata/<id>/ .
// Losse bestanden via raw.githubusercontent.com; mappen via git (sparse) of anders een tarball.
// Gebruik: npm run data:ophalen [-- --met-kerkvaders]
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import zlib from "node:zlib";
import { createHash } from "node:crypto";
import { DATASETS, type Dataset } from "../src/lib/sources/datasets";
import { dataDir } from "../src/lib/db";

const metKerkvaders = process.argv.includes("--met-kerkvaders") || process.argv.includes("--kerkvaders");
const doel = path.join(dataDir(), "brondata");
fs.mkdirSync(doel, { recursive: true });

async function haalBestand(ds: Dataset, rel: string) {
  const uit = path.join(doel, ds.id, rel);
  if (fs.existsSync(uit) && fs.statSync(uit).size > 0) return console.log(`  ✓ aanwezig: ${rel}`);
  fs.mkdirSync(path.dirname(uit), { recursive: true });
  const url = `https://raw.githubusercontent.com/${ds.repo}/${ds.commit}/${rel.split("/").map(encodeURIComponent).join("/")}`;
  for (let poging = 1; poging <= 4; poging++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(300_000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const buf = Buffer.from(await r.arrayBuffer());
      fs.writeFileSync(uit + ".tmp", buf);
      fs.renameSync(uit + ".tmp", uit);
      console.log(`  ↓ ${rel} (${(buf.length / 1e6).toFixed(1)} MB, sha256 ${createHash("sha256").update(buf).digest("hex").slice(0, 12)}…)`);
      return;
    } catch (e) {
      console.warn(`  ! poging ${poging} mislukt voor ${rel}: ${(e as Error).message}`);
      await new Promise((res) => setTimeout(res, 2000 * 2 ** (poging - 1)));
    }
  }
  throw new Error(`Kon ${rel} niet ophalen uit ${ds.repo}`);
}

function gitBeschikbaar(): boolean {
  return spawnSync("git", ["--version"], { stdio: "ignore" }).status === 0;
}

function haalMapViaGit(ds: Dataset): boolean {
  const map = path.join(doel, ds.id);
  if (fs.existsSync(path.join(map, ".klaar"))) {
    console.log(`  ✓ aanwezig: ${ds.id}`);
    return true;
  }
  fs.rmSync(map, { recursive: true, force: true });
  const git = (args: string[], cwd?: string) =>
    spawnSync("git", ["-c", "gc.auto=0", ...args], { cwd, stdio: ["ignore", "inherit", "inherit"] }).status === 0;
  if (!git(["clone", "--quiet", "--filter=blob:none", "--no-checkout", `https://github.com/${ds.repo}.git`, map])) return false;
  const patronen = ds.map!.includes(".") ? [] : ds.map!.map((m) => `/${m}/`);
  if (patronen.length && !git(["sparse-checkout", "set", "--no-cone", ...patronen], map)) return false;
  if (!git(["checkout", "--quiet", ds.commit], map)) return false;
  fs.writeFileSync(path.join(map, ".klaar"), ds.commit);
  return true;
}

/** Minimale tar.gz-uitpakker (alleen gewone bestanden), met padcontrole tegen 'zip slip'. */
async function haalMapViaTarball(ds: Dataset) {
  const map = path.join(doel, ds.id);
  const url = `https://codeload.github.com/${ds.repo}/tar.gz/${ds.commit}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(600_000) });
  if (!r.ok) throw new Error(`Tarball ${ds.repo}: HTTP ${r.status}`);
  const tar = zlib.gunzipSync(Buffer.from(await r.arrayBuffer()));
  let i = 0;
  let langeNaam: string | null = null;
  while (i + 512 <= tar.length) {
    const kop = tar.subarray(i, i + 512);
    if (kop.every((b) => b === 0)) break;
    const naam = langeNaam ?? (kop.subarray(345, 500).toString("utf8").replace(/\0.*$/s, "") + (kop[345] ? "/" : "") + kop.subarray(0, 100).toString("utf8").replace(/\0.*$/s, ""));
    langeNaam = null;
    const grootte = parseInt(kop.subarray(124, 136).toString("utf8").replace(/\0.*$/s, "").trim() || "0", 8);
    const type = String.fromCharCode(kop[156]);
    const inhoud = tar.subarray(i + 512, i + 512 + grootte);
    i += 512 + Math.ceil(grootte / 512) * 512;
    if (type === "L") {
      langeNaam = inhoud.toString("utf8").replace(/\0.*$/s, "");
      continue;
    }
    if (type !== "0" && type !== "\0") continue;
    const rel = naam.split("/").slice(1).join("/");
    if (!ds.map!.includes(".") && !ds.map!.some((m) => rel.startsWith(m + "/"))) continue;
    const uit = path.resolve(map, rel);
    if (!uit.startsWith(path.resolve(map) + path.sep)) continue;
    fs.mkdirSync(path.dirname(uit), { recursive: true });
    fs.writeFileSync(uit, inhoud);
  }
  fs.writeFileSync(path.join(map, ".klaar"), ds.commit);
}

async function main() {
  for (const ds of DATASETS) {
    if (ds.optioneel && !metKerkvaders) {
      console.log(`– ${ds.naam}: overgeslagen (optioneel; gebruik --met-kerkvaders)`);
      continue;
    }
    console.log(`• ${ds.naam} — ${ds.licentie}`);
    for (const b of ds.bestanden ?? []) await haalBestand(ds, b);
    if (ds.map) {
      const ok = gitBeschikbaar() && haalMapViaGit(ds);
      if (!ok) {
        console.log("  git niet beschikbaar of mislukt; probeer tarball…");
        await haalMapViaTarball(ds);
      }
    }
  }
  console.log(`\nKlaar. Brondata staat in ${doel}. Volgende stap: npm run data:importeren`);
}

main().catch((e) => {
  console.error("\nFOUT:", e.message);
  process.exit(1);
});
