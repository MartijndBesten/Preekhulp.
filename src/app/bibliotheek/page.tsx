"use client";
// Eigen bibliotheek: uploaden (PDF, DOCX, TXT, MD, SRT, VTT), zoeken met pagina/sectie/tijdstip, verwijderen.
import { useCallback, useEffect, useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */
type X = any;

export default function Bibliotheek() {
  const [docs, setDocs] = useState<X[]>([]);
  const [treffers, setTreffers] = useState<X[]>([]);
  const [q, setQ] = useState("");
  const [melding, setMelding] = useState<{ tekst: string; fout?: boolean } | null>(null);
  const [bezig, setBezig] = useState(false);
  const [projecten, setProjecten] = useState<{ id: string; titel: string }[]>([]);
  const [open, setOpen] = useState<X | null>(null);

  const laad = useCallback(async (zoek?: string) => {
    const r = await fetch(`/api/documenten${zoek ? `?q=${encodeURIComponent(zoek)}` : ""}`);
    const j = await r.json();
    setDocs(j.documenten ?? []);
    setTreffers(j.treffers ?? []);
  }, []);
  useEffect(() => {
    laad();
    fetch("/api/projecten").then((r) => r.json()).then((p) => Array.isArray(p) && setProjecten(p));
  }, [laad]);

  async function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBezig(true);
    setMelding(null);
    const fd = new FormData(e.currentTarget);
    const r = await fetch("/api/documenten", { method: "POST", body: fd });
    const j = await r.json();
    setBezig(false);
    if (!r.ok) return setMelding({ tekst: j.fout, fout: true });
    setMelding({ tekst: j.duplicaat ? "Dit bestand staat al in de bibliotheek (zelfde inhoud)." : `Opgeslagen: ${j.delen} tekstdelen geïndexeerd.${j.waarschuwingen?.length ? `\nLet op: ${j.waarschuwingen.join(" ")}` : ""}` });
    (e.target as HTMLFormElement).reset();
    laad();
  }

  async function verwijder(id: string) {
    if (!confirm("Document, zoekindex en afgeleide gegevens definitief verwijderen?")) return;
    await fetch(`/api/documenten/${id}`, { method: "DELETE" });
    laad(q);
  }

  return (
    <>
      <h1>Eigen bibliotheek</h1>
      <div className="melding info">Je documenten blijven op deze computer en zijn standaard privé. Ze gaan alleen als fragment naar een AI-aanbieder als je dat in Instellingen expliciet toestaat. Upload alleen materiaal waarvoor je de rechten hebt.</div>
      <form className="kaart" onSubmit={upload}>
        <div className="raster">
          <div><label>Bestand (PDF, DOCX, TXT, MD, SRT, VTT — max. 25 MB)</label><input type="file" name="bestand" accept=".pdf,.docx,.txt,.md,.srt,.vtt" required /></div>
          <div><label>Titel</label><input name="titel" placeholder="bv. Preek Gen 31, 1 nov 2026" /></div>
          <div><label>Auteur / spreker</label><input name="auteur" /></div>
          <div><label>Jaar</label><input name="jaar" /></div>
          <div><label>Bronvermelding / rechten</label><input name="bronvermelding" placeholder="eigen werk / met toestemming van …" /></div>
          <div><label>Project</label><select name="project"><option value="">—</option>{projecten.map((p) => <option key={p.id} value={p.id}>{p.titel}</option>)}</select></div>
          <div><label>YouTube-link (bij transcript)</label><input name="videoUrl" placeholder="https://www.youtube.com/watch?v=…" /></div>
          <div><label>Soort transcript</label><select name="transcriptSoort"><option value="onbekend">onbekend</option><option value="automatisch">automatisch gegenereerd</option><option value="handmatig">handmatig/gecontroleerd</option></select></div>
        </div>
        <div className="rij" style={{ marginTop: 12 }}><button disabled={bezig}>{bezig ? "Bezig…" : "Toevoegen"}</button></div>
        {melding && <div className={`melding ${melding.fout ? "fout" : "info"}`}>{melding.tekst}</div>}
      </form>

      <h2>Zoeken</h2>
      <form className="rij" onSubmit={(e) => { e.preventDefault(); laad(q); }}><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Zoek in eigen documenten" style={{ maxWidth: 420 }} /><button>Zoek</button></form>
      {treffers.map((t, i) => <div key={i} className="citaat"><b>{t.titel}</b> — {t.locatie}{t.video_id && t.start_sec != null && <> · <a href={`https://www.youtube.com/watch?v=${t.video_id}&t=${Math.floor(t.start_sec)}s`} target="_blank" rel="noreferrer">open op dit tijdstip</a></>}{!t.video_id && <> · <a href={`/api/documenten/${t.document}/bestand${t.soort === "pdf" && t.pagina ? `#page=${t.pagina}` : ""}`} target="_blank" rel="noreferrer">{t.soort === "pdf" && t.pagina ? `open origineel op p. ${t.pagina}` : "open origineel"}</a></>}{"\n"}{t.fragment}</div>)}

      <h2>Documenten ({docs.length})</h2>
      <div className="kaart"><table><thead><tr><th>Titel</th><th>Soort</th><th>Delen</th><th>Toegevoegd</th><th /></tr></thead><tbody>
        {docs.map((d) => <tr key={d.id}><td><button className="ref" onClick={async () => setOpen(await (await fetch(`/api/documenten/${d.id}`)).json())}>{d.titel}</button>{d.video_id && <span className="zacht-tekst"> · video ({d.transcript_soort})</span>}{JSON.parse(d.waarschuwingen || "[]").some((w: string) => /tekstlaag|gescand/.test(w)) && <span className="zacht-tekst"> · deels niet doorzoekbaar</span>}</td><td>{d.soort}{d.paginas ? ` · ${d.paginas} p.` : ""}</td><td>{d.delen}</td><td>{d.gemaakt.slice(0, 10)}</td><td><button className="gevaar" onClick={() => verwijder(d.id)}>Verwijderen</button></td></tr>)}
      </tbody></table></div>
      {open && <div className="kaart"><div className="rij" style={{ justifyContent: "space-between" }}><b>{open.document.titel}</b><span className="rij"><a href={`/api/documenten/${open.document.id}/bestand`} target="_blank" rel="noreferrer">Origineel openen</a><button className="zacht" onClick={() => setOpen(null)}>Sluiten</button></span></div>{JSON.parse(open.document.waarschuwingen || "[]").map((w: string, i: number) => <div key={i} className="melding info">{w}</div>)}{open.delen.slice(0, 200).map((dl: X, i: number) => <div key={i} className="citaat"><b>{dl.locatie}</b>{"\n"}{dl.tekst.slice(0, 1200)}</div>)}</div>}
    </>
  );
}
