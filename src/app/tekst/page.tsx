"use client";
// Tekst & grondtaal: werkt volledig zonder AI. SV + BSB, woord-voor-woord grondtekst met lemma/morfologie/lexicon,
// concordantie per lemma, motieven, tekstverbanden, kruisverwijzingen, historische commentaren en doorverwijzingen.
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

/* eslint-disable @typescript-eslint/no-explicit-any */
type X = any;

function Inhoud() {
  const sp = useSearchParams();
  const router = useRouter();
  const ref = sp.get("ref") ?? "";
  const [invoer, setInvoer] = useState(ref || "Genesis 31:13");
  const [x, setX] = useState<X | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [woord, setWoord] = useState<X | null>(null);

  useEffect(() => {
    if (!ref) return;
    setFout(null);
    fetch(`/api/tekst?ref=${encodeURIComponent(ref)}`).then(async (r) => {
      const j = await r.json();
      if (!r.ok) setFout(j.fout);
      else setX(j);
    });
  }, [ref]);

  const perVers: Record<number, X[]> = {};
  for (const w of x?.woorden ?? []) (perVers[w.vkey] ??= []).push(w);

  return (
    <>
      <h1>Tekst &amp; grondtaal</h1>
      <form className="rij" onSubmit={(e) => { e.preventDefault(); router.push(`/tekst?ref=${encodeURIComponent(invoer)}`); }}>
        <input value={invoer} onChange={(e) => setInvoer(e.target.value)} style={{ maxWidth: 360 }} aria-label="Bijbelverwijzing" />
        <button>Toon</button>
        <span className="zacht-tekst">Bv. Gen 31:13 · Genesis 28:10-22 · Joh. 1:51 · 1 Kor 13</span>
      </form>
      {fout && <div className="melding fout">{fout}</div>}
      {x && (
        <>
          <h2>{x.ref.label}</h2>
          {x.motieven.waarschuwingen.map((w: string) => <div key={w} className="melding">{w}</div>)}
          <div className="kaart">
            {x.verzen.map((v: X) => (
              <div key={v.vkey} style={{ marginBottom: 14 }}>
                <b>{v.label}</b>
                <div>{v.teksten.SV} <span className="zacht-tekst">(SV)</span></div>
                <div className="zacht-tekst">{v.teksten.BSB} (BSB)</div>
                {perVers[v.vkey] && (
                  <div className="rij" style={{ direction: perVers[v.vkey][0].taal === "he" ? "rtl" : "ltr", marginTop: 6, gap: 6 }}>
                    {perVers[v.vkey].map((w: X) => (
                      <button key={w.pos} className="zacht" style={{ padding: "4px 8px", textAlign: "center" }} onClick={() => setWoord(w)} title={`${w.translit ?? ""} — ${w.glosse ?? ""}`}>
                        <div className={w.taal === "he" ? "hebr" : "grieks"} style={{ fontSize: w.taal === "he" ? 20 : 17 }}>{w.vorm}</div>
                        <div style={{ fontSize: 11, direction: "ltr" }}>{w.glosse}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          {woord && <WoordPaneel w={woord} sluit={() => setWoord(null)} />}

          <h2>Herhaalde woorden en motieven</h2>
          <div className="kaart">
            <table><thead><tr><th>Lemma</th><th>Glosse</th><th>Bijbel</th><th>Elders in dit boek</th></tr></thead><tbody>
              {x.motieven.motieven.map((m: X) => <tr key={m.lemma.strong}><td className={m.lemma.taal === "he" ? "hebr" : "grieks"} style={{ fontSize: 18 }}>{m.lemma.lemma}</td><td>{m.lemma.glosse} <span className="zacht-tekst">{m.lemma.strong}</span></td><td>{m.lemma.verzenTotaal} verzen <span className="zacht-tekst">({m.zeldzaamheid})</span></td><td>{Object.entries(m.perHoofdstuk).map(([h, ks]) => <span key={h} style={{ marginRight: 8 }}>{h}:{(ks as number[]).map((k) => k % 1000).join(",")}</span>)}</td></tr>)}
            </tbody></table>
            <p className="zacht-tekst">Berekend uit STEPBible-data. Een herhaald woord is een aanwijzing, geen bewijs van een bedoeld motief.</p>
          </div>

          <h2>Tekstverbanden (gedeelde zeldzame woorden)</h2>
          <div className="kaart">{x.motieven.interteksten.map((it: X) => <div key={it.label} className="bewering"><Link href={`/tekst?ref=${encodeURIComponent(it.label)}`}><b>{it.label}</b></Link> <span className="zacht-tekst">score {it.score}{it.zelfdeBoek ? " · zelfde boek" : ""}</span><div>Gedeeld: {it.gedeeld.map((g: X) => `${g.lemma} ‘${g.glosse}’`).join(", ")}</div>{it.nieuweWoorden.length > 0 && <div className="zacht-tekst">Nieuw daar: {it.nieuweWoorden.map((n: X) => n.glosse).join(", ")}</div>}</div>)}</div>

          <h2>Kruisverwijzingen</h2>
          <div className="kaart kolommen">
            {x.kruisverwijzingen.map((k: X, i: number) => <div key={i}><Link href={`/tekst?ref=${encodeURIComponent(k.label)}`}>{k.label}</Link> <span className="zacht-tekst">({k.stemmen})</span></div>)}
            {x.motieven.ntVerbanden.length > 0 && <><h3>NT (ook indirect)</h3>{x.motieven.ntVerbanden.map((n: X, i: number) => <div key={i}><Link href={`/tekst?ref=${encodeURIComponent(n.label)}`}>{n.label}</Link> <span className="zacht-tekst">({n.stemmen}{n.via !== "direct" ? `, via ${n.via}` : ""})</span></div>)}</>}
            {x.inkomend.length > 0 && <><h3>Verwijzen hiernaar</h3>{x.inkomend.map((k: X, i: number) => <div key={i}><Link href={`/tekst?ref=${encodeURIComponent(k.label)}`}>{k.label}</Link> <span className="zacht-tekst">({k.stemmen})</span></div>)}</>}
          </div>
          <p className="zacht-tekst">OpenBible.info (CC BY): stemmen van gebruikers; vindplaats, geen exegetisch oordeel.</p>

          <h2>Historische commentaren</h2>
          {Object.entries((x.commentaren as X[]).reduce((acc: Record<string, X[]>, c: X) => ((acc[`${c.auteur} — ${c.titel}`] ??= []).push(c), acc), {})).map(([t, cs]) => (
            <details key={t} className="kaart" open={(cs as X[]).length < 4}>
              <summary><b>{t}</b> ({(cs as X[]).length}) · <span className="zacht-tekst">{(cs as X[])[0].rechtenstatus}</span></summary>
              {(cs as X[]).map((c: X) => <div key={c.id} className="citaat"><b>{c.label}{c.sectie ? ` — ${c.sectie}` : ""}</b>{"\n"}{c.tekst}</div>)}
            </details>
          ))}

          <h2>Elders raadplegen</h2>
          <ul>{x.doorverwijzingen.map((l: X) => <li key={l.url}><a href={l.url} target="_blank" rel="noreferrer">{l.label}</a> <span className="zacht-tekst">— {l.toelichting}</span></li>)}</ul>
        </>
      )}
    </>
  );
}

function WoordPaneel({ w, sluit }: { w: X; sluit: () => void }) {
  return (
    <div className="kaart" style={{ position: "sticky", bottom: 10, borderColor: "var(--accent)" }}>
      <div className="rij" style={{ justifyContent: "space-between" }}>
        <div><span className={w.taal === "he" ? "hebr" : "grieks"}>{w.vorm}</span> · {w.translit} · lemma <span className={w.taal === "he" ? "hebr" : "grieks"} style={{ fontSize: 18 }}>{w.lemma}</span> · {w.strong}</div>
        <button className="zacht" onClick={sluit}>Sluiten</button>
      </div>
      <div><b>Glosse:</b> {w.glosse} {w.lex_glosse && <> · <b>lexicon:</b> {w.lex_glosse}</>}</div>
      <div className="zacht-tekst"><b>Morfologie ({w.morf}):</b> {w.morf_uitleg}</div>
      {w.lex_definitie && <div className="citaat">{w.lex_definitie}</div>}
      {w.bron_ref && <div className="melding">Hebreeuwse versnummering: {w.bron_ref}</div>}
      <p className="zacht-tekst">Lexicon: STEP TBESH/TBESG (verkorte BDB / Abbott-Smith). Betekenis hangt af van context; trek geen theologische conclusies uit alleen dit nummer of een etymologie.</p>
    </div>
  );
}

export default function TekstPagina() {
  return <Suspense fallback={<p>Laden…</p>}><Inhoud /></Suspense>;
}
