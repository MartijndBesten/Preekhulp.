"use client";
// Startscherm: één duidelijke vraag, optionele velden ingeklapt, keuze van onderzoeksdiepte met kostenraming vooraf.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Modus = "verkennen" | "verdiepen" | "kritisch";
const MODI: { id: Modus; naam: string; uitleg: string }[] = [
  { id: "verkennen", naam: "Verkennen", uitleg: "Snelle oriëntatie: tekst, grondtaal, verbanden, oudere uitleg, eerste lijnen." },
  { id: "verdiepen", naam: "Verdiepen", uitleg: "Grondig: gerichte zoekvragen, bronbeoordeling, vergelijking en tegenlezing." },
  { id: "kritisch", naam: "Kritisch onderzoeken", uitleg: "Maximaal: elk perspectief apart, aparte vergelijking, zware tegenlezing." },
];

interface Raming { budgetUsd?: number; totaalMaxUsd: number | null; aiActief: boolean; reden: string | null; model: string | null; toelichting: string; aanroepen: { stap: string; maxUsd: number | null }[] }
interface Onderzoek { id: string; vraag: string; modus: string; status: string; kosten_usd: number; gemaakt: string }

export default function Start() {
  const router = useRouter();
  const [vraag, setVraag] = useState("");
  const [modus, setModus] = useState<Modus>("verdiepen");
  const [opties, setOpties] = useState<Record<string, string>>({});
  const [zonderExtern, setZonderExtern] = useState(false);
  const [raming, setRaming] = useState<Raming | null>(null);
  const [lijst, setLijst] = useState<Onderzoek[]>([]);
  const [projecten, setProjecten] = useState<{ id: string; titel: string }[]>([]);
  const [project, setProject] = useState("");
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    fetch(`/api/raming?modus=${modus}`).then((r) => r.json()).then(setRaming).catch(() => setRaming(null));
  }, [modus]);
  useEffect(() => {
    // Vervolgvraag uit een dossier (?vraag=…) voorinvullen; de predikant start zelf.
    const v = new URLSearchParams(window.location.search).get("vraag");
    if (v) setVraag(v.slice(0, 2000));
  }, []);
  useEffect(() => {
    fetch("/api/onderzoek").then((r) => r.json()).then((x) => Array.isArray(x) && setLijst(x));
    fetch("/api/projecten").then((r) => r.json()).then((x) => Array.isArray(x) && setProjecten(x));
  }, []);

  const zet = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setOpties({ ...opties, [k]: e.target.value });

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setFout(null);
    setBezig(true);
    try {
      const r = await fetch("/api/onderzoek", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vraag, modus, project: project || null, opties: { ...opties, budgetUsd: opties.budgetUsd ? Number(opties.budgetUsd) : undefined, zonderExtern } }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.fout);
      router.push(`/onderzoek/${j.id}`);
    } catch (err) {
      setFout((err as Error).message);
      setBezig(false);
    }
  }

  return (
    <>
      <h1>Wat wil je onderzoeken?</h1>
      <form onSubmit={start} className="kaart">
        <textarea
          value={vraag}
          onChange={(e) => setVraag(e.target.value)}
          placeholder={"Bijvoorbeeld: Genesis 31:13. Ik bereid een doopdienst voor over ‘Terug naar de belofte’. Welke exegetische en theologische lijnen zijn relevant, hoe leggen verschillende auteurs dit uit, en wat zie ik mogelijk over het hoofd?"}
          aria-label="Onderzoeksvraag"
          required
        />
        <p className="zacht-tekst">Begin vanuit een Bijbelgedeelte, een thema, een voorlopige preekgedachte, een bron of YouTube-link (via <Link href="/videos">Preken &amp; video</Link>) of een eigen document (via <Link href="/bibliotheek">Eigen bibliotheek</Link>).</p>

        <div className="modi" role="radiogroup" aria-label="Onderzoeksdiepte">
          {MODI.map((m) => (
            <div key={m.id} className={`modus ${modus === m.id ? "actief" : ""}`} role="radio" aria-checked={modus === m.id} tabIndex={0} onClick={() => setModus(m.id)} onKeyDown={(e) => e.key === "Enter" && setModus(m.id)}>
              <b>{m.naam}</b>
              <span className="zacht-tekst">{m.uitleg}</span>
            </div>
          ))}
        </div>

        {raming && (
          <div className={`melding ${raming.aiActief ? "info" : ""}`}>
            {raming.aiActief ? (
              <>Verwachte AI-kosten ({raming.model}): <b>maximaal ${raming.totaalMaxUsd?.toFixed(2) ?? "onbekend"}</b> voor {raming.aanroepen.length} AI-stappen. {raming.toelichting}{raming.budgetUsd != null && raming.totaalMaxUsd != null && raming.totaalMaxUsd > (opties.budgetUsd ? Number(opties.budgetUsd) : raming.budgetUsd) && <b> Let op: de bovengrens ligt boven je budget; latere stappen kunnen worden overgeslagen. Verhoog het budget bij ‘Optioneel’ als je dat wilt.</b>}</>
            ) : (
              <>Geen AI actief: {raming.reden} <Link href="/instellingen">Instellingen</Link></>
            )}
          </div>
        )}

        <details style={{ marginTop: 12 }}>
          <summary>Optioneel: gedeelte, thema, dienst, traditie, doelgroep, preekgedachte, budget</summary>
          <div className="raster">
            <div><label>Bijbelgedeelte</label><input value={opties.bijbelgedeelte ?? ""} onChange={zet("bijbelgedeelte")} placeholder="Gen 31:1-16" /></div>
            <div><label>Thema</label><input value={opties.thema ?? ""} onChange={zet("thema")} placeholder="Terug naar de belofte" /></div>
            <div><label>Type dienst</label><select value={opties.dienst ?? ""} onChange={zet("dienst")}><option value="">—</option>{["reguliere eredienst", "doopdienst", "avondmaalsdienst", "belijdenisdienst", "rouwdienst", "huwelijksdienst", "feestdag"].map((x) => <option key={x}>{x}</option>)}</select></div>
            <div><label>Theologische traditie</label><input value={opties.traditie ?? ""} onChange={zet("traditie")} placeholder="PKN, gereformeerd" /></div>
            <div><label>Doelgroep</label><input value={opties.doelgroep ?? ""} onChange={zet("doelgroep")} placeholder="gemeente met jonge gezinnen" /></div>
            <div><label>Voorkeursauteurs</label><input value={opties.voorkeursauteurs ?? ""} onChange={zet("voorkeursauteurs")} placeholder="Calvijn, Bavinck" /></div>
            <div><label>AI-budget voor dit onderzoek (USD)</label><input type="number" step="0.1" min="0" value={opties.budgetUsd ?? ""} onChange={zet("budgetUsd")} placeholder="standaard uit Instellingen" /></div>
            <div><label>Project</label><select value={project} onChange={(e) => setProject(e.target.value)}><option value="">— geen —</option>{projecten.map((p) => <option key={p.id} value={p.id}>{p.titel}</option>)}</select></div>
          </div>
          <label>Voorlopige preekgedachte (wordt kritisch getoetst, niet bevestigd)</label>
          <textarea value={opties.preekgedachte ?? ""} onChange={zet("preekgedachte")} style={{ minHeight: 70 }} />
          <label className="rij" style={{ color: "var(--tekst)" }}><input type="checkbox" checked={zonderExtern} onChange={(e) => setZonderExtern(e.target.checked)} style={{ width: "auto" }} /> Alleen lokale bronnen (geen externe zoekdiensten)</label>
        </details>

        {fout && <div className="melding fout">{fout}</div>}
        <div className="rij" style={{ marginTop: 14 }}>
          <button type="submit" disabled={bezig || vraag.trim().length < 3}>{bezig ? "Bezig…" : "Start onderzoek"}</button>
          <span className="zacht-tekst">Preekhulp schrijft geen preek; je krijgt een controleerbaar onderzoeksdossier.</span>
        </div>
      </form>

      {lijst.length > 0 && (
        <>
          <h2>Eerdere onderzoeken</h2>
          <div className="kaart">
            <table>
              <thead><tr><th>Vraag</th><th>Modus</th><th>Status</th><th>Kosten</th><th>Datum</th></tr></thead>
              <tbody>
                {lijst.map((o) => (
                  <tr key={o.id}>
                    <td><Link href={`/onderzoek/${o.id}`}>{o.vraag.slice(0, 110)}{o.vraag.length > 110 ? "…" : ""}</Link></td>
                    <td>{o.modus}</td><td>{o.status}</td><td>${o.kosten_usd.toFixed(3)}</td><td>{o.gemaakt.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
