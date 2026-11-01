"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

/* eslint-disable @typescript-eslint/no-explicit-any */
type X = any;

export default function Projecten() {
  const [lijst, setLijst] = useState<X[]>([]);
  const [nieuw, setNieuw] = useState({ titel: "", bijbelgedeelten: "", thema: "", dienst: "", datum: "" });
  const [fout, setFout] = useState<string | null>(null);
  const laad = () => fetch("/api/projecten").then((r) => r.json()).then((j) => Array.isArray(j) && setLijst(j));
  useEffect(() => { laad(); }, []);

  async function maak(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/projecten", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(nieuw) });
    const j = await r.json();
    if (!r.ok) return setFout(j.fout);
    setNieuw({ titel: "", bijbelgedeelten: "", thema: "", dienst: "", datum: "" });
    laad();
  }
  return (
    <>
      <h1>Onderzoeksprojecten</h1>
      <form className="kaart" onSubmit={maak}>
        <div className="raster">
          {(["titel", "bijbelgedeelten", "thema", "dienst", "datum"] as const).map((k) => <div key={k}><label>{k[0].toUpperCase() + k.slice(1)}</label><input type={k === "datum" ? "date" : "text"} value={nieuw[k]} onChange={(e) => setNieuw({ ...nieuw, [k]: e.target.value })} required={k === "titel"} /></div>)}
        </div>
        <div className="rij" style={{ marginTop: 10 }}><button>Project aanmaken</button></div>
        {fout && <div className="melding fout">{fout}</div>}
      </form>
      <div className="raster" style={{ marginTop: 16 }}>
        {lijst.map((p) => <Link key={p.id} href={`/projecten/${p.id}`} className="kaart" style={{ textDecoration: "none", color: "inherit" }}><b>{p.titel}</b><div className="zacht-tekst">{p.bijbelgedeelten} {p.thema && `· ${p.thema}`} {p.datum && `· ${p.datum}`}</div><div className="zacht-tekst">{p.onderzoeken} onderzoek(en)</div></Link>)}
      </div>
    </>
  );
}
