"use client";
// Bronnen zoeken (lokaal + gekozen externe connectors) en het bronnenregister met bronkaarten.
import { useEffect, useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */
type X = any;

export default function Bronnen() {
  const [q, setQ] = useState("");
  const [kaarten, setKaarten] = useState<X[]>([]);
  const [gekozen, setGekozen] = useState<string[]>(["lokaal-bijbel", "lokaal-commentaren", "eigen-documenten"]);
  const [res, setRes] = useState<X | null>(null);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [filter, setFilter] = useState({ type: "", toegang: "", taal: "" });

  useEffect(() => {
    fetch("/api/instellingen").then((r) => r.json()).then((j) => setKaarten(j.bronkaarten ?? []));
  }, []);

  async function zoek(e: React.FormEvent) {
    e.preventDefault();
    setBezig(true);
    setFout(null);
    const r = await fetch(`/api/bronnen/zoek?q=${encodeURIComponent(q)}&bronnen=${gekozen.join(",")}${filter.taal ? `&taal=${filter.taal}` : ""}`);
    const j = await r.json();
    setBezig(false);
    if (!r.ok) return setFout(j.fout);
    setRes(j);
  }

  const zoekbaar = kaarten.filter((k) => !["logos", "biblehub", "blueletterbible", "netbible", "apibible", "crosswire", "moderne-nl-vertalingen", "google-scholar", "ccel", "nl-tijdschriften"].includes(k.id));

  return (
    <>
      <h1>Bronnen</h1>
      <form className="kaart" onSubmit={zoek}>
        <div className="rij"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Zoekterm of Bijbelverwijzing (bv. ‘Bethel vow’, ‘Genesis 35:2’, ‘huisgoden Rachel’)" style={{ flex: 1 }} /><button disabled={bezig || q.length < 2}>{bezig ? "Zoeken…" : "Zoek"}</button></div>
        <details style={{ marginTop: 10 }} open>
          <summary>Bronnen kiezen</summary>
          <div className="raster" style={{ marginTop: 8 }}>
            {zoekbaar.map((k) => (
              <label key={k.id} className="rij" style={{ margin: 0, color: "var(--tekst)" }}>
                <input type="checkbox" style={{ width: "auto" }} checked={gekozen.includes(k.id)} onChange={(e) => setGekozen(e.target.checked ? [...gekozen, k.id] : gekozen.filter((g) => g !== k.id))} />
                {k.naam.split(" (")[0].split(" — ")[0]} <span className="zacht-tekst">({k.status})</span>
              </label>
            ))}
          </div>
        </details>
        <div className="rij" style={{ marginTop: 8 }}>
          <select value={filter.type} onChange={(e) => setFilter({ ...filter, type: e.target.value })} style={{ width: "auto" }}><option value="">Alle brontypen</option>{["bijbeltekst", "grondtekst", "historisch commentaar", "historische kanttekeningen", "peer-reviewed artikel", "wetenschappelijk boek/commentaar", "proefschrift", "boek (catalogus)", "preek/lezing (video)", "eigen document"].map((t) => <option key={t}>{t}</option>)}</select>
          <select value={filter.toegang} onChange={(e) => setFilter({ ...filter, toegang: e.target.value })} style={{ width: "auto" }}><option value="">Alle toegang</option>{["volledige tekst", "abstract", "alleen metadata", "transcript"].map((t) => <option key={t}>{t}</option>)}</select>
          <select value={filter.taal} onChange={(e) => setFilter({ ...filter, taal: e.target.value })} style={{ width: "auto" }}><option value="">Alle talen</option><option value="nl">Nederlands</option><option value="en">Engels</option></select>
        </div>
      </form>
      {fout && <div className="melding fout">{fout}</div>}
      {res && (
        <>
          {res.resultaten.map((g: X) => (
            <div key={g.connector} className="kaart">
              <h3 style={{ marginTop: 0 }}>{g.naam} <span className="zacht-tekst">— {g.status}{g.melding ? `: ${g.melding}` : ""}</span></h3>
              {g.items.filter((it: X) => (!filter.type || it.brontype === filter.type) && (!filter.toegang || it.toegang === filter.toegang)).map((it: X) => (
                <div key={it.id} className="bewering">
                  <div>{it.auteurs?.slice(0, 3).join(", ")}{it.jaar && ` (${it.jaar})`} {it.url ? <a href={it.url} target="_blank" rel="noreferrer"><i>{it.titel}</i></a> : <i>{it.titel}</i>}</div>
                  <div className="meta">{it.brontype} · toegang: <b>{it.toegang}</b> · herbruikbaar: {it.rechten?.herbruikbaar}{it.rechten?.toelichting ? ` (${it.rechten.toelichting})` : ""}{it.doi ? ` · DOI ${it.doi}` : ""}</div>
                  {it.passages.slice(0, 3).map((p: X, i: number) => <div key={i} className="citaat"><b>{p.locatie}</b> {p.soort === "metadata" ? "(catalogusgegevens)" : p.soort === "abstract" ? "(abstract)" : ""}{"\n"}{p.tekst.slice(0, 700)}</div>)}
                </div>
              ))}
            </div>
          ))}
          <h3>Ook doorzoeken (zoeklinks)</h3>
          <ul>{res.doorverwijzingen.map((l: X) => <li key={l.url}><a href={l.url} target="_blank" rel="noreferrer">{l.label}</a> <span className="zacht-tekst">— {l.toelichting}</span></li>)}</ul>
        </>
      )}

      <h2>Bronnenregister</h2>
      <p className="zacht-tekst">Per bron: wat kan, onder welke voorwaarden, en wat daadwerkelijk getest is. ‘Vrij leesbaar’ is niet hetzelfde als ‘vrij herbruikbaar’.</p>
      {kaarten.map((k) => (
        <details key={k.id} className="kaart">
          <summary><b>{k.naam}</b> · {k.categorie} · <span className={`label ${k.status === "werkend" ? "n-direct_aangetoond" : k.status === "gedeeltelijk" ? "n-omstreden" : "n-niet_geverifieerd"}`}>{k.status}</span></summary>
          <table><tbody>
            {[["Website", k.website], ["Zoekmogelijkheden", k.zoekmogelijkheden], ["API / dataset", k.api], ["Toegangsvoorwaarden", k.toegangsvoorwaarden], ["Licentie", k.licentie], ["Volledige tekst", k.volledigeTekst], ["Actualiteit", k.actualiteit], ["Kosten", k.kosten], ["Technische uitvoerbaarheid", k.uitvoerbaarheid], ["Geschiktheid pilot", k.geschiktheidPilot], ["Status", `${k.status} — ${k.statusToelichting}`], ["Getest", k.getest]].map(([a, b]) => <tr key={a}><th style={{ width: 220 }}>{a}</th><td>{String(b).startsWith("http") ? <a href={b} target="_blank" rel="noreferrer">{b}</a> : b}</td></tr>)}
          </tbody></table>
        </details>
      ))}
    </>
  );
}
