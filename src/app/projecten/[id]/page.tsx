"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/* eslint-disable @typescript-eslint/no-explicit-any */
type X = any;
const VELDEN: [string, string, boolean][] = [
  ["titel", "Titel", false], ["bijbelgedeelten", "Bijbelgedeelten", false], ["thema", "Thema", false], ["dienst", "Type dienst", false], ["datum", "Datum", false],
  ["onderzoeksvragen", "Onderzoeksvragen", true], ["notities", "Eigen notities", true], ["inzichten", "Belangrijke inzichten", true], ["open_vragen", "Nog openstaande vragen", true], ["conclusies", "Voorlopige conclusies", true],
];

export default function Project({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [x, setX] = useState<X | null>(null);
  const [p, setP] = useState<Record<string, string>>({});
  const [opgeslagen, setOpgeslagen] = useState(false);
  useEffect(() => {
    fetch(`/api/projecten/${id}`).then((r) => r.json()).then((j) => { setX(j); setP(j.project ?? {}); });
  }, [id]);
  if (!x) return <p>Laden…</p>;
  if (x.fout) return <div className="melding fout">{x.fout}</div>;

  async function bewaar() {
    await fetch(`/api/projecten/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) });
    setOpgeslagen(true);
    setTimeout(() => setOpgeslagen(false), 2000);
  }
  async function verwijder() {
    if (!confirm("Project verwijderen? Onderzoeken en documenten blijven bestaan, maar worden losgekoppeld.")) return;
    await fetch(`/api/projecten/${id}`, { method: "DELETE" });
    router.push("/projecten");
  }
  const perMarkering: Record<string, X[]> = {};
  for (const b of x.bronnen) (perMarkering[b.markering] ??= []).push(b);

  return (
    <>
      <Link href="/projecten">← Projecten</Link>
      <h1>{p.titel}</h1>
      <div className="kaart">
        <div className="raster">{VELDEN.filter((v) => !v[2]).map(([k, l]) => <div key={k}><label>{l}</label><input value={p[k] ?? ""} onChange={(e) => setP({ ...p, [k]: e.target.value })} type={k === "datum" ? "date" : "text"} /></div>)}</div>
        {VELDEN.filter((v) => v[2]).map(([k, l]) => <div key={k}><label>{l}</label><textarea value={p[k] ?? ""} onChange={(e) => setP({ ...p, [k]: e.target.value })} style={{ minHeight: 80 }} /></div>)}
        <div className="rij" style={{ marginTop: 10 }}><button onClick={bewaar}>Opslaan</button>{opgeslagen && <span className="zacht-tekst">Opgeslagen</span>}<button className="gevaar" onClick={verwijder}>Project verwijderen</button></div>
      </div>
      <h2>Onderzoeken</h2>
      <div className="kaart">{x.onderzoeken.length ? x.onderzoeken.map((o: X) => <div key={o.id}><Link href={`/onderzoek/${o.id}`}>{o.vraag.slice(0, 120)}</Link> <span className="zacht-tekst">· {o.modus} · {o.status} · {o.gemaakt.slice(0, 10)}</span></div>) : <p className="zacht-tekst">Nog geen onderzoeken. Kies dit project bij het starten van een onderzoek (Optioneel → Project), of hergebruik een eerder onderzoek via de startpagina.</p>}</div>
      <h2>Gemarkeerde bronnen</h2>
      {Object.entries(perMarkering).map(([m, bs]) => <div key={m} className="kaart"><h3 style={{ marginTop: 0 }}>{m}</h3>{bs.map((b: X) => <div key={b.id}>{JSON.parse(b.auteurs || "[]").slice(0, 3).join(", ")}{b.jaar && ` (${b.jaar})`} {b.url ? <a href={b.url} target="_blank" rel="noreferrer">{b.titel}</a> : b.titel} <span className="zacht-tekst">· {b.brontype} · {b.toegang}</span></div>)}</div>)}
      {!x.bronnen.length && <p className="zacht-tekst">Markeer bronnen vanuit een onderzoeksdossier (onderdeel 13).</p>}
      <h2>Documenten</h2>
      <div className="kaart">{x.documenten.length ? x.documenten.map((d: X) => <div key={d.id}>{d.titel} <span className="zacht-tekst">· {d.soort}</span></div>) : <p className="zacht-tekst">Geen documenten gekoppeld.</p>}</div>
    </>
  );
}
