"use client";
// Preken & video: ontdekken via YouTube Data API (metadata), analyseren alleen met rechtmatig transcript,
// vergelijken van preken met transcript (AI), met tijdlinks uit het transcript.
import { useEffect, useState } from "react";
import Link from "next/link";

/* eslint-disable @typescript-eslint/no-explicit-any */
type X = any;
const NIVEAU: Record<string, string> = { direct_aangetoond: "Direct aangetoond", onderbouwde_interpretatie: "Onderbouwde interpretatie", mogelijke_onderzoekslijn: "Mogelijke onderzoekslijn", omstreden: "Omstreden", niet_geverifieerd: "Niet geverifieerd" };

export default function Videos() {
  const [q, setQ] = useState("");
  const [taal, setTaal] = useState("");
  const [res, setRes] = useState<X | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [transcripten, setTranscripten] = useState<X[]>([]);
  const [gekozen, setGekozen] = useState<string[]>([]);
  const [vraag, setVraag] = useState("");
  const [vergelijking, setVergelijking] = useState<X | null>(null);
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    fetch("/api/documenten").then((r) => r.json()).then((j) => setTranscripten((j.documenten ?? []).filter((d: X) => d.video_id || d.soort === "srt" || d.soort === "vtt")));
  }, []);

  async function zoek(e: React.FormEvent) {
    e.preventDefault();
    setFout(null);
    const r = await fetch(`/api/videos/zoek?q=${encodeURIComponent(q)}${taal ? `&taal=${taal}` : ""}`);
    const j = await r.json();
    if (!r.ok) return setFout(j.fout);
    setRes(j);
  }
  async function vergelijk() {
    setBezig(true);
    setFout(null);
    const r = await fetch("/api/videos/vergelijk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documenten: gekozen, vraag }) });
    const j = await r.json();
    setBezig(false);
    if (!r.ok) return setFout(j.fout);
    setVergelijking(j);
  }
  const Punten = ({ titel, p }: { titel: string; p: X[] }) => p.length ? <><h4 style={{ margin: "10px 0 4px" }}>{titel}</h4>{p.map((x: X, i: number) => <div key={i} className="bewering"><span className={`label n-${x.niveau}`}>{NIVEAU[x.niveau]}</span> {x.tekst}<div className="meta">{x.verwijzingen.map((v: X) => <span key={v.label} style={{ marginRight: 8 }}>{v.url ? <a href={v.url} target="_blank" rel="noreferrer">{v.label} ({v.locatie})</a> : `${v.label} (${v.locatie})`}{v.citaat ? ` “${v.citaat}”` : ""}</span>)}</div></div>)}</> : null;

  return (
    <>
      <h1>Preken &amp; video</h1>
      <div className="melding info">Preekhulp ontdekt video's via de officiële YouTube Data API (titel, kanaal, beschrijving, datum, duur). Ondertitels van video's van anderen worden niet automatisch opgehaald. Inhoudelijke analyse kan alleen met een transcript dat je rechtmatig hebt (eigen kanaal, toestemming, of zelf getranscribeerd) — voeg dat toe via <Link href="/bibliotheek">Eigen bibliotheek</Link> met de YouTube-link erbij; dan krijg je tijdlinks.</div>

      <form className="kaart rij" onSubmit={zoek}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="bv. Genesis 31 Bethel sermon · Jakob Betel preek" style={{ flex: 1 }} />
        <select value={taal} onChange={(e) => setTaal(e.target.value)} style={{ width: "auto" }}><option value="">Alle talen</option><option value="nl">Nederlands</option><option value="en">Engels</option></select>
        <button disabled={q.length < 2}>Zoek video's</button>
      </form>
      {fout && <div className="melding fout">{fout}</div>}
      {res && (
        <div className="kaart">
          {!res.beschikbaar && <div className="melding">{res.melding} <a href={res.zoeklink} target="_blank" rel="noreferrer">Zoek direct op YouTube</a></div>}
          {res.beschikbaar && <p className="zacht-tekst">{res.melding}</p>}
          {res.items.map((v: X) => (
            <div key={v.extern_id} className="bewering">
              <a href={v.url} target="_blank" rel="noreferrer"><b>{v.titel}</b></a> — {v.auteurs.join(", ")} · {v.datum?.slice(0, 10)}{v.extra?.duurSec ? ` · ${Math.round(v.extra.duurSec / 60)} min` : ""}
              <div className="meta">{v.samenvatting?.slice(0, 300)}</div>
              <span className="label n-niet_geverifieerd">alleen metadata — inhoud niet geverifieerd, geen tijdstippen</span>
            </div>
          ))}
        </div>
      )}

      <h2>Preken met transcript vergelijken</h2>
      <div className="kaart">
        {transcripten.length < 2 && <p className="zacht-tekst">Voeg minstens twee transcripten (SRT/VTT/TXT met YouTube-link) toe in de eigen bibliotheek.</p>}
        {transcripten.map((d) => <label key={d.id} className="rij" style={{ margin: 0, color: "var(--tekst)" }}><input type="checkbox" style={{ width: "auto" }} checked={gekozen.includes(d.id)} onChange={(e) => setGekozen(e.target.checked ? [...gekozen, d.id] : gekozen.filter((g) => g !== d.id))} />{d.titel} <span className="zacht-tekst">({d.transcript_soort ?? d.soort})</span></label>)}
        <label>Waar wil je op letten?</label>
        <input value={vraag} onChange={(e) => setVraag(e.target.value)} placeholder="bv. hoe wordt Betel uitgelegd, en welke christologische lijnen worden getrokken?" />
        <div className="rij" style={{ marginTop: 10 }}><button disabled={gekozen.length < 2 || bezig} onClick={vergelijk}>{bezig ? "Vergelijken…" : "Vergelijk (AI)"}</button><span className="zacht-tekst">Vereist een AI-aanbieder; kosten worden vastgelegd.</span></div>
      </div>
      {vergelijking && (
        <div className="kaart">
          {vergelijking.per_video.map((v: X) => {
            const doc = vergelijking.docs.find((d: X) => d.id === v.document);
            return <div key={v.document} className="kaart"><h3 style={{ marginTop: 0 }}>{doc?.titel ?? v.document}</h3><p className="zacht-tekst">Bijbelteksten: {v.bijbelteksten.join(", ")}</p>
              <Punten titel="Centrale uitleg" p={v.centrale_uitleg} /><Punten titel="Christologische verbanden" p={v.christologische_verbanden} /><Punten titel="Dogmatische uitgangspunten" p={v.dogmatische_uitgangspunten} /><Punten titel="Pastorale toepassingen" p={v.pastorale_toepassingen} /><Punten titel="Opvallende inzichten" p={v.opvallende_inzichten} /><Punten titel="Mogelijke exegetische zwaktes" p={v.mogelijke_exegetische_zwaktes} /></div>;
          })}
          <Punten titel="Overeenkomsten" p={vergelijking.overeenkomsten} /><Punten titel="Verschillen" p={vergelijking.verschillen} />
          <p className="zacht-tekst">Kosten: ${vergelijking.kostenUsd.toFixed(3)}</p>
        </div>
      )}
    </>
  );
}
