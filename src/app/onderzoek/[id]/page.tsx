"use client";
// Onderzoeksdossier: voortgang per stap, 13 onderdelen, bewijsniveaus, klikbare bewijsstukken,
// verdiepen per onderdeel, bronnen markeren, export (Markdown) en afdrukken (PDF via de browser).
import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

const NIVEAU: Record<string, string> = {
  direct_aangetoond: "Direct aangetoond", onderbouwde_interpretatie: "Onderbouwde interpretatie", mogelijke_onderzoekslijn: "Mogelijke onderzoekslijn", omstreden: "Omstreden", niet_geverifieerd: "Niet geverifieerd",
};
const SECTIES = [
  ["vraag", "1. Onderzoeksvraag en afbakening"], ["context", "2. Bijbeltekst en context"], ["grondtaal", "3. Grondtaal en vertaling"], ["exegese", "4. Exegetische inzichten"],
  ["historisch", "5. Historische commentaren"], ["hedendaags", "6. Hedendaagse uitleg"], ["perspectieven", "7. Theologische perspectieven"], ["preken", "8. Preken en lezingen"],
  ["lijnen", "9. Nieuwe onderzoekslijnen"], ["kritisch", "10. Kritische aandachtspunten"], ["homiletiek", "11. Homiletische verbindingen"], ["vervolg", "12. Vervolgvragen"], ["bronnen", "13. Bronnen"],
] as const;
const VLEK: Record<string, string> = { ontbrekende_context: "Ontbrekende context", niet_genoemd_gedeelte: "Niet genoemd gedeelte", alternatieve_interpretatie: "Alternatieve uitleg", mogelijke_fout: "Mogelijke fout", wetenschappelijk_tegenargument: "Wetenschappelijk tegenargument", homiletische_mogelijkheid: "Homiletische mogelijkheid" };
const MATRIX_WAARSCHUWING = "Automatische controle vergelijkt tekst: bestaat het bewijsstuk, staat het citaat er letterlijk in, is het een primaire bron. Dat zegt níet dat de uitleg juist is. De steuncontrole is een AI-oordeel en kan een bewering alleen afwaarderen. Lees bij twijfel de bron zelf.";
const MARKERINGEN = ["relevant", "later lezen", "kritisch perspectief", "gebruikt", "niet relevant"];

/* eslint-disable @typescript-eslint/no-explicit-any */
type X = any;

export default function OnderzoekPagina({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [x, setX] = useState<X | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [project, setProject] = useState<string>("");
  const [projecten, setProjecten] = useState<{ id: string; titel: string }[]>([]);
  const [markeringen, setMarkeringen] = useState<Record<string, string>>({});
  const [verdiep, setVerdiep] = useState<{ stap: string; extra: string } | null>(null);
  const [hoofd, setHoofd] = useState<X | null>(null);
  const [hoofdBezig, setHoofdBezig] = useState(false);
  const [gedachte, setGedachte] = useState("");
  const [filter, setFilter] = useState<{ type: string; toegang: string; alleenGeverifieerd: boolean }>({ type: "", toegang: "", alleenGeverifieerd: false });

  const laad = useCallback(async () => {
    const r = await fetch(`/api/onderzoek/${id}`);
    const j = await r.json();
    if (!r.ok) return setFout(j.fout);
    setX(j);
  }, [id]);

  useEffect(() => {
    laad();
    fetch("/api/projecten").then((r) => r.json()).then((p) => Array.isArray(p) && setProjecten(p));
  }, [laad]);
  useEffect(() => {
    if (!x) return;
    if (x.project && !project) setProject(x.project);
    const bezig = x.lopend || String(x.status).startsWith("bezig") || x.status === "wachtrij";
    if (!bezig) return;
    const t = setTimeout(laad, 1500);
    return () => clearTimeout(t);
  }, [x, laad, project]);
  useEffect(() => {
    if (!project) return setMarkeringen({});
    fetch(`/api/projecten/${project}`).then((r) => r.json()).then((p) => setMarkeringen(Object.fromEntries((p.bronnen ?? []).map((b: X) => [b.id, b.markering]))));
  }, [project]);

  const bewijs = useMemo(() => new Map<string, X>((x?.bewijs ?? []).map((b: X) => [b.label, b])), [x]);
  if (fout) return <div className="melding fout">{fout}</div>;
  if (!x) return <p>Laden…</p>;

  const bw = (sectie: string) => x.beweringen.filter((b: X) => b.sectie === sectie);
  const bezig = x.lopend || String(x.status).startsWith("bezig") || x.status === "wachtrij";

  async function herhaal(stap: string, extra: string) {
    await fetch(`/api/onderzoek/${id}/stap`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stap, extra }) });
    setVerdiep(null);
    setTimeout(laad, 500);
  }
  async function overHetHoofd(metAi = false) {
    setHoofdBezig(true);
    const r = await fetch(`/api/onderzoek/${id}/overhoofd`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(metAi ? { gedachte, ai: true, akkoordRamingUsd: hoofd?.aiMogelijk?.ramingUsd } : { gedachte }) });
    const j = await r.json();
    setHoofdBezig(false);
    if (!r.ok) return setHoofd({ ...(hoofd ?? { signalen: [] }), fout: j.fout });
    setHoofd(j);
    if (metAi) laad();
  }
  async function markeer(bron: string, markering: string) {
    if (!project) return;
    await fetch("/api/bronnen/markeer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project, bron, markering }) });
    setMarkeringen({ ...markeringen, [bron]: markering });
  }

  const Refs = ({ v }: { v: X[] }) => (
    <>{v.map((r: X) => <button key={r.label} className="ref" onClick={() => setOpen(open === r.label ? null : r.label)} title={bewijs.get(r.label)?.bron_titel}>{r.label}</button>)}</>
  );
  const Bewering = ({ b }: { b: X }) => (
    <div className="bewering">
      <div><span className={`label n-${b.niveau}`}>{NIVEAU[b.niveau]}</span> {b.tekst}</div>
      <div className="meta">
        {b.herkomst === "data" ? "berekend uit tekstdata" : `AI-analyse${b.perspectief ? ` · ${b.perspectief}` : ""}`} · {b.id} · bewijs: {b.verwijzingen.length ? <Refs v={b.verwijzingen} /> : "geen"}
        {b.controle?.aangepast && <> · <i>niveau verlaagd ({b.controle.aangepast.reden})</i></>}
        {b.controle?.onbekend?.length > 0 && <> · <i>niet-bestaande verwijzingen verwijderd: {b.controle.onbekend.join(", ")}</i></>}
        {b.controle?.citatenNietGevonden?.length > 0 && <> · <i>citaat niet teruggevonden, weggelaten</i></>}
        {b.controle?.alleenAbstractOfMetadata && <> · <i>alleen abstract/catalogus</i></>}
        {b.controle?.steuncontrole && b.controle.steuncontrole.oordeel !== "ondersteunt" && <> · <i>tegenlezer: {b.controle.steuncontrole.oordeel.replace(/_/g, " ")}</i></>}
      </div>
      {b.verwijzingen.filter((r: X) => r.citaat).map((r: X) => <div className="citaat" key={r.label}>“{r.citaat}” — {r.label}</div>)}
      {b.verwijzingen.some((r: X) => r.label === open) && <BewijsPaneel r={bewijs.get(open!)} />}
    </div>
  );
  const Verdiep = ({ stap, tekst }: { stap: string; tekst: string }) =>
    bezig ? null : verdiep?.stap === stap ? (
      <div className="kaart geen-print" style={{ marginTop: 8 }}>
        <label>Verdiepingsvraag voor dit onderdeel (alleen deze stap en wat ervan afhangt wordt opnieuw uitgevoerd)</label>
        <textarea value={verdiep.extra} onChange={(e) => setVerdiep({ stap, extra: e.target.value })} style={{ minHeight: 60 }} />
        <div className="rij" style={{ marginTop: 8 }}><button onClick={() => herhaal(stap, verdiep.extra)}>Opnieuw onderzoeken</button><button className="zacht" onClick={() => setVerdiep(null)}>Annuleren</button></div>
      </div>
    ) : (
      <button className="zacht geen-print" style={{ fontSize: 13, padding: "4px 10px" }} onClick={() => setVerdiep({ stap, extra: "" })}>{tekst}</button>
    );

  const bronnen = x.bronnen.filter((b: X) => (!filter.type || b.brontype === filter.type) && (!filter.toegang || b.toegang === filter.toegang) && (!filter.alleenGeverifieerd || b.labels.length > 0 && ["volledige tekst", "transcript"].includes(b.toegang)));
  const comm = x.bewijs.filter((r: X) => r.soort === "commentaar");
  const perWerk: Record<string, X[]> = {};
  for (const r of comm) (perWerk[r.bron_titel] ??= []).push(r);

  return (
    <>
      <div className="rij geen-print" style={{ justifyContent: "space-between" }}>
        <Link href="/">← Nieuw onderzoek</Link>
        <div className="rij">
          <a className="knop zacht" href={`/api/onderzoek/${id}/export`}>Exporteer Markdown</a>
          <button className="zacht" onClick={() => window.print()}>Afdrukken / PDF</button>
        </div>
      </div>
      <h1>Onderzoeksdossier</h1>
      <div className="citaat" style={{ fontSize: 17 }}>{x.vraag}</div>
      <p className="zacht-tekst">Modus <b>{x.modus}</b> · {x.gemaakt.slice(0, 16).replace("T", " ")} UTC · AI-kosten ${x.kostenUsd.toFixed(3)} van ${x.budgetUsd.toFixed(2)} budget</p>
      <div className="stappen">{x.stappen.map((s: X) => <span key={s.id} className={`stap ${s.status}`} title={s.fout ?? ""}>{s.id} · {s.naam}{s.status === "klaar_zonder_ai" ? " (zonder AI)" : s.status === "bezig" ? " …" : ""}</span>)}</div>
      {bezig && <div className="melding info">Onderzoek loopt ({x.status}). Deze pagina ververst vanzelf.</div>}
      {x.fout && <div className="melding fout">{x.fout}</div>}
      {x.stappen.some((s: X) => s.status === "klaar_zonder_ai") && <div className="melding">Interpretatiestappen zijn zonder AI uitgevoerd: {x.stappen.find((s: X) => s.status === "klaar_zonder_ai")?.fout?.replace(/\.$/, "")}. Wat je ziet zijn tekstdata, berekende verbanden en bronnen. <Link href="/instellingen">AI instellen</Link></div>}
      <div className="geen-print rij" style={{ margin: "8px 0" }}>
        <label style={{ margin: 0 }}>Project voor bronmarkeringen:</label>
        <select value={project} onChange={(e) => setProject(e.target.value)} style={{ width: "auto" }}><option value="">— kies project —</option>{projecten.map((p) => <option key={p.id} value={p.id}>{p.titel}</option>)}</select>
      </div>

      {!bezig && <div className="kaart geen-print" id="overhoofd">
        <h2 style={{ marginTop: 0 }}>Wat zie ik over het hoofd?</h2>
        <label>Je voorlopige gedachte of preeklijn (optioneel)</label>
        <textarea value={gedachte} onChange={(e) => setGedachte(e.target.value)} placeholder="bv. God roept Jakob terug naar Betel, naar de belofte van toen; zo roept God ons in de doop terug naar zijn belofte." style={{ minHeight: 70 }} />
        <div className="rij" style={{ marginTop: 8 }}><button onClick={() => overHetHoofd()} disabled={hoofdBezig}>{hoofdBezig ? "Controleren…" : hoofd ? "Opnieuw controleren" : "Controleer (gratis)"}</button></div>
        {!hoofd && <p className="zacht-tekst">Legt je gedachte en je dossier naast de tekst: verhaalelementen en gedeelten die je niet noemt, begrippen die niet in de tekst staan, ontbrekende perspectieven, omstreden punten en zwak bewijs. Daarna kun je de AI laten zoeken naar ontbrekende context, alternatieve uitleg, mogelijke fouten, wetenschappelijke tegenargumenten en homiletische mogelijkheden.</p>}
        {hoofd && <>
          {hoofd.fout && <div className="melding fout">{hoofd.fout}</div>}
          {hoofd.signalen.length === 0 && <p>Geen automatische signalen gevonden. Dat betekent niet dat er niets ontbreekt.</p>}
          {hoofd.signalen.map((g: X, i: number) => <div key={i} className="bewering"><span className={`label ${g.ernst === "hoog" ? "n-omstreden" : "n-niet_geverifieerd"}`}>{g.soort} · {g.ernst}</span> <b>{g.titel}</b><div>{g.toelichting}</div><div className="meta">→ {g.actie}{g.verzen?.length ? <> · {g.verzen.map((v: string) => <Link key={v} href={`/tekst?ref=${encodeURIComponent(v)}`} style={{ marginRight: 6 }}>{v}</Link>)}</> : null}</div></div>)}
          <p className="zacht-tekst">Automatische signalen: tekstvergelijking en tellingen, geen oordeel over juistheid.</p>
          {hoofd.ai ? <>
            <h3>AI-meelezer ({hoofd.ai.moment.slice(0, 16).replace("T", " ")}, ${hoofd.ai.kostenUsd.toFixed(3)})</h3>
            {hoofd.ai.gedachte && <p className="zacht-tekst">Bij gedachte: “{hoofd.ai.gedachte.slice(0, 200)}{hoofd.ai.gedachte.length > 200 ? "…" : ""}”</p>}
            {hoofd.ai.vlekken.map((v: X, i: number) => <div key={i} className="bewering"><span className="label n-mogelijke_onderzoekslijn">{VLEK[v.soort] ?? v.soort}</span> <span className={`label n-${v.niveau}`}>{NIVEAU[v.niveau]}</span> <b>{v.titel}</b><div>{v.waarom}</div><div className="meta">Te onderzoeken: {v.wat_te_onderzoeken}{v.verwijzingen.length ? <> · <Refs v={v.verwijzingen} /></> : " · geen bewijs aangehaald"}{v.aangepast && <> · <i>niveau verlaagd ({v.aangepast})</i></>}</div>{v.verwijzingen.some((r: X) => r.label === open) && <BewijsPaneel r={bewijs.get(open!)} />}</div>)}
          </> : hoofd.aiMogelijk?.kan ? <div className="rij"><button className="zacht" onClick={() => confirm(`Eén AI-ronde uitvoeren${gedachte.trim() ? " (met je gedachte)" : ""}? Geraamde kosten in het slechtste geval: $${(hoofd.aiMogelijk.ramingUsd ?? 0).toFixed(3)} (binnen het onderzoeksbudget).`) && overHetHoofd(true)} disabled={hoofdBezig}>{hoofdBezig ? "AI leest mee…" : "Laat ook de AI meelezen"}</button><span className="zacht-tekst">max. ${(hoofd.aiMogelijk.ramingUsd ?? 0).toFixed(3)}</span></div> : <p className="zacht-tekst">AI-meelezer niet beschikbaar: {hoofd.aiMogelijk?.reden}</p>}
        </>}
      </div>}

      <div className="inhoud">
        <nav>{SECTIES.map(([sid, t]) => <a key={sid} href={`#${sid}`}>{t}</a>)}</nav>
        <div>
          <section id="vraag" className="kaart">
            <h2>1. Onderzoeksvraag en afbakening</h2>
            {x.a && <>
              <p>Gedeelten: {x.a.refs.map((r: X) => <Link key={r.label} href={`/tekst?ref=${encodeURIComponent(r.label)}`} style={{ marginRight: 8 }}>{r.label}</Link>)}{!x.a.refs.length && "geen herkend"}{x.a.thema && <> · thema: <b>{x.a.thema}</b></>}{x.a.dienst && <> · {x.a.dienst}</>}</p>
              {x.a.ai && <>
                <p><b>Kernvraag:</b> {x.a.ai.kernvraag}</p>
                <div className="kolommen"><p><b>Wel:</b> {x.a.ai.afbakening_wel.join("; ")}</p><p><b>Niet:</b> {x.a.ai.afbakening_niet.join("; ")}</p></div>
                <h3>Aannames om te toetsen</h3>
                <ul>{x.a.ai.aannames.map((a: X, i: number) => <li key={i}>{a.aanname} <span className="zacht-tekst">({a.expliciet ? "expliciet" : "impliciet"} — {a.waarom_toetsen})</span></li>)}</ul>
                <p className="zacht-tekst"><b>Exegese:</b> {x.a.ai.onderscheid.exegese} <b>Dogmatiek:</b> {x.a.ai.onderscheid.dogmatiek} <b>Homiletiek:</b> {x.a.ai.onderscheid.homiletiek}</p>
              </>}
              {x.a.aiFout && <div className="melding">{x.a.aiFout}</div>}
              <h3>Onderzoeksplan</h3><ol>{x.a.plan.map((p: string, i: number) => <li key={i}>{p}</li>)}</ol>
              {x.b && <details><summary>Zoekvragen ({x.b.zoekvragen.length})</summary><ul>{x.b.zoekvragen.map((q: X, i: number) => <li key={i}>[{q.taal}/{q.doel}] {q.tekst} <span className="zacht-tekst">— {q.waarom} ({q.herkomst})</span></li>)}</ul></details>}
            </>}
            <Verdiep stap="A" tekst="Vraaganalyse verdiepen" />
          </section>

          <section id="context" className="kaart">
            <h2>2. Bijbeltekst en context</h2>
            {x.focusTekst.map((v: X) => <div key={v.label} style={{ marginBottom: 10 }}><b>{v.label}</b><div>SV: {v.teksten.SV}</div><div className="zacht-tekst">BSB: {v.teksten.BSB}</div></div>)}
            {x.c?.motieven?.waarschuwingen?.map((w: string) => <div key={w} className="melding">{w}</div>)}
            {bw("context").map((b: X) => <Bewering key={b.id} b={b} />)}
          </section>

          <section id="grondtaal" className="kaart">
            <h2>3. Grondtaal en vertaling</h2>
            {x.sleutelwoorden.length > 0 && <div style={{ overflowX: "auto" }}><table><thead><tr><th>Vorm</th><th>Translit.</th><th>Lemma</th><th>Strong</th><th>Glosse</th><th>Morfologie</th></tr></thead><tbody>
              {x.sleutelwoorden.map((w: X, i: number) => <tr key={i}><td className="hebr">{w.vorm}</td><td>{w.translit}</td><td className="hebr" style={{ fontSize: 18 }}>{w.lemma}</td><td>{w.strong}</td><td>{w.glosse}</td><td className="zacht-tekst">{String(w.morf ?? "").replace(/Function=/, "").slice(0, 110)}</td></tr>)}
            </tbody></table></div>}
            <p className="zacht-tekst">Bron: STEPBible TAHOT/TAGNT (CC BY 4.0). Geen conclusies op alleen een Strong-nummer.</p>
            {bw("grondtaal").map((b: X) => <Bewering key={b.id} b={b} />)}
          </section>

          <section id="exegese" className="kaart"><h2>4. Belangrijkste exegetische inzichten</h2>{bw("exegese").length ? bw("exegese").map((b: X) => <Bewering key={b.id} b={b} />) : <p className="zacht-tekst">Geen AI-analyse uitgevoerd.</p>}<Verdiep stap="E" tekst="Exegese/vergelijking verdiepen" /></section>

          <section id="historisch" className="kaart">
            <h2>5. Historische commentaren</h2>
            {Object.entries(perWerk).map(([titel, rs]) => <details key={titel} open={rs.length < 4}><summary><b>{titel}</b> ({rs.length})</summary>{rs.map((r) => <div key={r.label} className="citaat"><b>[{r.label}] {r.locatie}</b>{"\n"}{r.tekst.slice(0, 1500)}{r.tekst.length > 1500 ? " …" : ""}{r.url && <> <a href={r.url} target="_blank" rel="noreferrer">bron</a></>}</div>)}</details>)}
            {bw("historisch").map((b: X) => <Bewering key={b.id} b={b} />)}
          </section>

          <section id="hedendaags" className="kaart">
            <h2>6. Hedendaagse wetenschappelijke uitleg</h2>
            {bw("hedendaags").map((b: X) => <Bewering key={b.id} b={b} />)}
            {x.bronnen.filter((b: X) => ["openalex", "crossref", "doaj", "semanticscholar", "core", "pthu"].includes(b.connector)).length === 0 && <p className="zacht-tekst">Geen academische bronnen gevonden of bereikbaar (zie bronstatus onder 13).</p>}
          </section>

          <section id="perspectieven" className="kaart">
            <h2>7. Verschillende theologische perspectieven</h2>
            {bw("perspectieven").map((b: X) => <Bewering key={b.id} b={b} />)}
            {x.e?.analyse?.verschillen?.map((v: X, i: number) => <div key={i} className="kaart"><b>Verschilpunt: {v.punt}</b><ul>{v.posities.map((p: X, j: number) => <li key={j}><b>{p.wie}:</b> {p.standpunt} <Refs v={p.verwijzingen} /></li>)}</ul><p className="zacht-tekst">{v.beoordeling}</p></div>)}
            {bw("vergelijking").map((b: X) => <Bewering key={b.id} b={b} />)}
          </section>

          <section id="preken" className="kaart">
            <h2>8. Preken en lezingen</h2>
            {x.c?.videos?.map((v: X) => <div key={v.videoId} className={v.transcript ? "melding info" : "melding"}><a href={v.url} target="_blank" rel="noreferrer">Video uit je vraag ({v.videoId})</a>: {v.transcript ? <><b>{v.transcript}</b> — {v.labels.length} transcriptdelen in het bewijsregister. </> : null}{v.melding}</div>)}
            {x.bronnen.filter((b: X) => b.brontype === "preek/lezing (video)").map((b: X) => <div key={b.id} className="bewering"><a href={b.url} target="_blank" rel="noreferrer">{b.titel}</a> — {b.auteurs.join(", ")} ({b.jaar ?? "?"}) <span className="label n-niet_geverifieerd">{b.toegang === "transcript" ? "transcript" : "alleen metadata — inhoud niet geverifieerd"}</span></div>)}
            {x.bewijs.filter((r: X) => r.soort === "transcript").map((r: X) => <div key={r.label} className="citaat">[{r.label}] {r.locatie}{r.url && <> — <a href={r.url} target="_blank" rel="noreferrer">open op dit tijdstip</a></>}{"\n"}{r.tekst.slice(0, 400)}</div>)}
            <p className="zacht-tekst">Zonder YouTube-sleutel of aangeleverd transcript worden geen video-inhouden geanalyseerd. {x.b?.doorverwijzingen.filter((l: X) => l.bron === "YouTube").map((l: X) => <a key={l.url} href={l.url} target="_blank" rel="noreferrer" style={{ marginRight: 8 }}>{l.label}</a>)}</p>
          </section>

          <section id="lijnen" className="kaart">
            <h2>9. Nieuwe of onverwachte onderzoekslijnen</h2>
            {bw("lijnen").map((b: X) => <Bewering key={b.id} b={b} />)}
            <Verdiep stap="F" tekst="Lijnen opnieuw formuleren" />
            {x.v?.onderwerpen?.length > 0 && <>
              <h3>Verdiepingsronde</h3>
              <p className="zacht-tekst">Een tweede, gerichte zoekronde op onderwerpen die tijdens het onderzoek opvielen: de verzen zelf, kruisverwijzingen (ook naar latere hoofdstukken), historische uitleg en — binnen het zoekbudget — academische treffers.</p>
              {x.v.onderwerpen.map((o: X) => <div key={o.titel} className="bewering"><b>{o.titel}</b> <span className="zacht-tekst">({o.herkomst === "ai" ? "voorgesteld door de analyse" : "datagedreven"})</span><div className="meta">{o.waarom} · bewijs: {o.labels.length ? <Refs v={o.labels.slice(0, 14).map((l: string) => ({ label: l }))} /> : "geen"}</div>{o.labels.includes(open) && <BewijsPaneel r={bewijs.get(open!)} />}</div>)}
              {x.v.ai?.onderwerpen?.filter((o: X) => o.wat_de_tekst_niet_zegt.length).map((o: X) => <div key={o.onderwerp} className="melding info"><b>Wat de tekst níet zegt ({o.onderwerp}):</b> {o.wat_de_tekst_niet_zegt.join("; ")}</div>)}
              {x.v.aiFout && <p className="zacht-tekst">{x.v.aiFout}</p>}
              {bw("verdieping").map((b: X) => <Bewering key={b.id} b={b} />)}
            </>}
          </section>

          <section id="kritisch" className="kaart">
            <h2>10. Kritische aandachtspunten</h2>
            <ul>{x.g?.regels?.map((r: string, i: number) => <li key={i}>{r}</li>)}</ul>
            {x.g?.ai?.punten?.map((p: X, i: number) => <div key={i} className="bewering"><span className="label n-omstreden">{p.soort.replace(/_/g, " ")}</span>{p.bewering && <> · {p.bewering}</>} {p.toelichting}<div className="meta">Advies: {p.advies} <Refs v={p.verwijzingen} /></div>{p.verwijzingen.some((r: X) => r.label === open) && <BewijsPaneel r={bewijs.get(open!)} />}</div>)}
            {x.g?.ai?.eindoordeel && <p><b>Eindoordeel tegenlezing:</b> {x.g.ai.eindoordeel}</p>}
            {x.g?.aiFout && <div className="melding">{x.g.aiFout}</div>}
            <Verdiep stap="G" tekst="Tegenlezing opnieuw" />
            {x.matrix?.length > 0 && <details style={{ marginTop: 12 }}>
              <summary><b>Claim-bronmatrix</b> ({x.matrix.length} AI-beweringen)</summary>
              <div className="melding">{MATRIX_WAARSCHUWING}</div>
              <div style={{ overflowX: "auto" }}><table><thead><tr><th>Claim</th><th>Niveau</th><th>Bewijs</th><th>Interpretatieve stap</th><th>Tegenargumenten</th><th>Onzekerheid</th><th>Steuncontrole</th></tr></thead><tbody>
                {x.matrix.map((r: X) => <tr key={r.claim}>
                  <td><b>{r.claim}</b> {r.tekst}</td>
                  <td><span className={`label n-${r.niveau}`}>{NIVEAU[r.niveau]}</span>{r.aanpassing && <div className="zacht-tekst">{r.aanpassing}</div>}</td>
                  <td>{r.bewijs.length ? r.bewijs.map((b: X) => <div key={b.label}><button className="ref" onClick={() => setOpen(open === b.label ? null : b.label)}>{b.label}</button> {b.bron.split(" — ")[0]}, {b.locatie}{b.citaatGeverifieerd && <span className="zacht-tekst"> · citaat teruggevonden</span>}</div>) : <span className="zacht-tekst">geen</span>}</td>
                  <td className="zacht-tekst">{r.interpretatieveStap ?? "–"}</td>
                  <td>{r.tegenverwijzingen.length ? r.tegenverwijzingen.map((t: X) => <div key={t.label}><button className="ref" onClick={() => setOpen(open === t.label ? null : t.label)}>{t.label}</button> {t.locatie}</div>) : <span className="zacht-tekst">niet gevonden</span>}</td>
                  <td className="zacht-tekst">{r.onzekerheid ?? "–"}</td>
                  <td className="zacht-tekst">{r.steuncontrole ? `${r.steuncontrole.oordeel.replace(/_/g, " ")}: ${r.steuncontrole.toelichting}` : "–"}</td>
                </tr>)}
              </tbody></table></div>
            </details>}
          </section>

          <section id="homiletiek" className="kaart"><h2>11. Mogelijke homiletische verbindingen</h2><p className="zacht-tekst">Aanknopingspunten, geen preek. Toets elke toepassing aan de tekst.</p>{bw("homiletiek").length ? bw("homiletiek").map((b: X) => <Bewering key={b.id} b={b} />) : <p className="zacht-tekst">Geen AI-analyse uitgevoerd.</p>}</section>

          <section id="vervolg" className="kaart"><h2>12. Openstaande vervolgvragen</h2><ul>{[...(x.e?.analyse?.open_vragen ?? []), ...Object.values(x.e?.perspectieven ?? {}).flatMap((p: X) => p.open_vragen), ...(x.g?.ai?.zoekvragen_tegenperspectief ?? []).map((q: string) => `Zoek tegenperspectief: ${q}`)].map((q: string, i: number) => <li key={i}>{q}</li>)}</ul></section>

          <section id="bronnen" className="kaart">
            <h2>13. Bronnen</h2>
            <div className="rij geen-print">
              <select value={filter.type} onChange={(e) => setFilter({ ...filter, type: e.target.value })} style={{ width: "auto" }}><option value="">Alle brontypen</option>{[...new Set(x.bronnen.map((b: X) => b.brontype))].map((t) => <option key={String(t)}>{String(t)}</option>)}</select>
              <select value={filter.toegang} onChange={(e) => setFilter({ ...filter, toegang: e.target.value })} style={{ width: "auto" }}><option value="">Alle toegang</option>{["volledige tekst", "abstract", "alleen metadata", "transcript"].map((t) => <option key={t}>{t}</option>)}</select>
              <label className="rij" style={{ margin: 0 }}><input type="checkbox" style={{ width: "auto" }} checked={filter.alleenGeverifieerd} onChange={(e) => setFilter({ ...filter, alleenGeverifieerd: e.target.checked })} /> alleen met gelezen inhoud</label>
            </div>
            <table><thead><tr><th>Bron</th><th>Type / toegang / rechten</th><th>Passages</th>{project && <th className="geen-print">Markering</th>}</tr></thead><tbody>
              {bronnen.map((b: X) => <tr key={b.id}>
                <td>{b.auteurs.slice(0, 3).join(", ")}{b.jaar && ` (${b.jaar})`}. {b.url ? <a href={b.url} target="_blank" rel="noreferrer"><i>{b.titel}</i></a> : <i>{b.titel}</i>}{b.doi && <span className="zacht-tekst"> DOI {b.doi}</span>}{b.beoordeling?.relevantie != null && <div className="zacht-tekst">relevantie {b.beoordeling.relevantie}/3 — {b.beoordeling.waarom}</div>}</td>
                <td className="zacht-tekst">{b.brontype}<br />{b.toegang}<br />herbruikbaar: {b.rechten.herbruikbaar ?? "onbekend"}{b.rechten.toelichting ? ` — ${b.rechten.toelichting}` : ""}<br />geraadpleegd {b.geraadpleegd.slice(0, 10)}<br /><span className={`label ${b.ladder.niveau >= 5 ? "n-direct_aangetoond" : b.ladder.niveau === 4 ? "n-onderbouwde_interpretatie" : "n-niet_geverifieerd"}`} title="1 bereikbaar · 2 zoekopdracht · 3 relevant · 4 volledige inhoud · 5 geanalyseerd · 6 citaat geverifieerd">ladder {b.ladder.tekst}</span></td>
                <td>{b.labels.slice(0, 8).map((l: string) => <button key={l} className="ref" onClick={() => setOpen(open === l ? null : l)}>{l}</button>)}{b.labels.length > 8 && "…"}</td>
                {project && <td className="geen-print"><select value={markeringen[b.id] ?? ""} onChange={(e) => markeer(b.id, e.target.value)}><option value="">—</option>{MARKERINGEN.map((m) => <option key={m}>{m}</option>)}</select></td>}
              </tr>)}
            </tbody></table>
            {open && !x.beweringen.some((b: X) => b.verwijzingen.some((r: X) => r.label === open)) && <BewijsPaneel r={bewijs.get(open)} />}
            <h3>Bronstatus</h3>
            <ul>{x.c?.connectors?.map((k: X) => <li key={k.id}><b>{k.naam}</b>: {k.status}{k.resultaten ? ` (${k.resultaten})` : ""}{k.melding && <span className="zacht-tekst"> — {k.melding}</span>}</li>)}</ul>
            <h3>Doorverwijzingen (niet automatisch geraadpleegd)</h3>
            <ul>{x.b?.doorverwijzingen?.map((l: X) => <li key={l.url}><a href={l.url} target="_blank" rel="noreferrer">{l.label}</a> <span className="zacht-tekst">— {l.toelichting}</span></li>)}</ul>
            <Verdiep stap="C" tekst="Bronnen opnieuw zoeken" />
          </section>
        </div>
      </div>
    </>
  );
}

function BewijsPaneel({ r }: { r: X }) {
  if (!r) return <div className="melding">Dit bewijsstuk bestaat niet.</div>;
  return (
    <div className="kaart" style={{ marginTop: 8, background: "var(--accent-zacht)" }}>
      <div className="zacht-tekst"><b>{r.label}</b> · {r.soort} · {r.bron_titel} · {r.locatie} · toegang: {r.toegang}{r.url && <> · <a href={r.url} target="_blank" rel="noreferrer">open bron</a></>}</div>
      <div className="citaat" style={{ maxHeight: 320, overflow: "auto" }}>{r.tekst}</div>
    </div>
  );
}
