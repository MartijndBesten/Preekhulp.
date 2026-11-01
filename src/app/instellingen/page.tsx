"use client";
// Instellingen: AI-aanbieder en model, sleutels (alleen schrijven; nooit tonen), budget, voorkeuren,
// bronnen aan/uit, live bronnencontrole en kostenoverzicht.
import { useEffect, useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */
type X = any;
const SLEUTELS: [string, string][] = [
  ["anthropic", "Anthropic API-sleutel"], ["openai", "OpenAI API-sleutel"], ["ollamaUrl", "Ollama-adres (lokaal)"], ["youtube", "YouTube Data API-sleutel"],
  ["core", "CORE API-sleutel"], ["openalex", "OpenAlex API-sleutel (optioneel)"], ["semanticScholar", "Semantic Scholar-sleutel (optioneel)"], ["googleBooks", "Google Books-sleutel (optioneel)"],
  ["contactEmail", "Contactadres voor Unpaywall/Crossref/OpenAlex (optioneel)"],
];

export default function Instellingen() {
  const [x, setX] = useState<X | null>(null);
  const [i, setI] = useState<X>({});
  const [sleutels, setSleutels] = useState<Record<string, string>>({});
  const [kosten, setKosten] = useState<X | null>(null);
  const [controle, setControle] = useState<X | null>(null);
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState<string | null>(null);

  const laad = async () => {
    const j = await (await fetch("/api/instellingen")).json();
    setX(j);
    setI(j.instellingen);
    setControle(j.laatsteControle);
    setKosten(await (await fetch("/api/kosten")).json());
  };
  useEffect(() => { laad(); }, []);
  if (!x) return <p>Laden…</p>;

  async function bewaar() {
    const geheimen = Object.fromEntries(Object.entries(sleutels).filter(([, v]) => v !== ""));
    const r = await fetch("/api/instellingen", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ instellingen: i, geheimen }) });
    setMelding(r.ok ? "Opgeslagen." : "Opslaan mislukt.");
    setSleutels({});
    laad();
  }
  async function wisSleutel(k: string) {
    await fetch("/api/instellingen", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ geheimen: { [k]: null } }) });
    laad();
  }
  async function controleer() {
    setBezig(true);
    const r = await fetch("/api/bronnen/controle", { method: "POST" });
    setControle(await r.json());
    setBezig(false);
  }
  const lijst = (k: string) => (i[k] ?? []).join(", ");

  return (
    <>
      <h1>Instellingen</h1>
      <div className="kaart">
        <h2 style={{ marginTop: 0 }}>Gegevens</h2>
        <p>Bijbelverzen: {x.data.verzen.toLocaleString("nl")} · grondtekstwoorden: {x.data.woorden.toLocaleString("nl")} · kruisverwijzingen: {x.data.kruisverwijzingen.toLocaleString("nl")} · commentaaritems: {x.data.commentaren.toLocaleString("nl")}</p>
        {!x.data.verzen && <div className="melding fout">Nog geen brondata. Voer eenmalig uit: <code>npm run data:ophalen</code> en <code>npm run data:importeren</code>.</div>}
      </div>

      <div className="kaart">
        <h2 style={{ marginTop: 0 }}>AI-verbinding</h2>
        <p className={x.ai.actief ? "" : "melding"}>{x.ai.actief ? `Actief: ${x.ai.model}` : x.ai.reden}</p>
        <p className="zacht-tekst">Preekhulp gebruikt nooit het Claude Code-abonnement. Voor AI is een eigen API-sleutel of een lokaal model (Ollama) nodig. Zonder AI werken tekst, grondtaal, bronnen, eigen documenten en dossiers gewoon.</p>
        <div className="raster">
          <div><label>Aanbieder</label><select value={i.aiAanbieder} onChange={(e) => setI({ ...i, aiAanbieder: e.target.value })}><option value="geen">Geen AI</option><option value="anthropic">Anthropic (Claude)</option><option value="openai">OpenAI</option><option value="ollama">Lokaal model (Ollama)</option></select></div>
          {i.aiAanbieder === "anthropic" && <div><label>Model</label><select value={i.anthropicModel} onChange={(e) => setI({ ...i, anthropicModel: e.target.value })}>{x.modellen.map((m: X) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></div>}
          {i.aiAanbieder === "openai" && <>
            <div><label>Model-id</label><input value={i.openaiModel} onChange={(e) => setI({ ...i, openaiModel: e.target.value })} /></div>
            <div><label>Prijs invoer (USD per 1M tokens)</label><input type="number" step="0.01" value={i.openaiPrijsInvoer ?? ""} onChange={(e) => setI({ ...i, openaiPrijsInvoer: Number(e.target.value) })} /></div>
            <div><label>Prijs uitvoer (USD per 1M tokens)</label><input type="number" step="0.01" value={i.openaiPrijsUitvoer ?? ""} onChange={(e) => setI({ ...i, openaiPrijsUitvoer: Number(e.target.value) })} /></div>
          </>}
          {i.aiAanbieder === "ollama" && <div><label>Ollama-model</label><input value={i.ollamaModel} onChange={(e) => setI({ ...i, ollamaModel: e.target.value })} placeholder="bv. qwen3:14b" /></div>}
          <div><label>Standaard denkinspanning</label><select value={i.inspanning} onChange={(e) => setI({ ...i, inspanning: e.target.value })}>{["low", "medium", "high", "xhigh", "max"].map((m) => <option key={m}>{m}</option>)}</select></div>
          <div><label>Budget per onderzoek (USD)</label><input type="number" step="0.1" min="0" value={i.budgetPerOnderzoekUsd} onChange={(e) => setI({ ...i, budgetPerOnderzoekUsd: Number(e.target.value) })} /></div>
          <div><label>Maandbudget (USD)</label><input type="number" step="1" min="0" value={i.maandbudgetUsd} onChange={(e) => setI({ ...i, maandbudgetUsd: Number(e.target.value) })} /></div>
          <div><label>Eigen documenten naar AI</label><select value={i.eigenDocumentenNaarAi} onChange={(e) => setI({ ...i, eigenDocumentenNaarAi: e.target.value })}><option value="nooit">Nooit (standaard)</option><option value="fragmenten">Alleen relevante fragmenten</option></select></div>
        </div>
      </div>

      <div className="kaart">
        <h2 style={{ marginTop: 0 }}>Sleutels</h2>
        <p className="zacht-tekst">Sleutels worden opgeslagen in <code>.data/geheimen.local.json</code> (buiten Git, alleen leesbaar voor jou) of via omgevingsvariabelen. Ze worden nooit naar de browser teruggestuurd.</p>
        <div className="raster">{SLEUTELS.map(([k, l]) => <div key={k}><label>{l} {x.geheimen[k]?.aanwezig ? <span className="label n-direct_aangetoond">aanwezig ({x.geheimen[k].via})</span> : <span className="label n-niet_geverifieerd">niet ingesteld</span>}</label><div className="rij"><input type={k === "contactEmail" || k === "ollamaUrl" ? "text" : "password"} autoComplete="off" value={sleutels[k] ?? ""} onChange={(e) => setSleutels({ ...sleutels, [k]: e.target.value })} placeholder={x.geheimen[k]?.aanwezig ? "•••• (nieuwe waarde om te vervangen)" : ""} style={{ flex: 1 }} />{x.geheimen[k]?.via === "bestand" && <button className="gevaar" type="button" onClick={() => wisSleutel(k)}>Wis</button>}</div></div>)}</div>
      </div>

      <div className="kaart">
        <h2 style={{ marginTop: 0 }}>Voorkeuren</h2>
        <div className="raster">
          <div><label>Favoriete auteurs (komma's)</label><input value={lijst("voorkeursauteurs")} onChange={(e) => setI({ ...i, voorkeursauteurs: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} /></div>
          <div><label>Tradities (komma's)</label><input value={lijst("tradities")} onChange={(e) => setI({ ...i, tradities: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} /></div>
        </div>
        <p className="zacht-tekst">Voorkeuren sturen zoeken en ordening, maar Preekhulp zoekt bewust ook daarbuiten om tunnelvisie te voorkomen.</p>
        <label className="rij" style={{ color: "var(--tekst)" }}><input type="checkbox" style={{ width: "auto" }} checked={!!i.kerkvadersGebruiken} onChange={(e) => setI({ ...i, kerkvadersGebruiken: e.target.checked })} /> Kerkvaders-database gebruiken (rechten van vertalingen onzeker; alleen voor eigen studie, niet publiceren)</label>
      </div>

      <div className="kaart">
        <h2 style={{ marginTop: 0 }}>Bronnen aan/uit en live controle</h2>
        <div className="raster">{x.bronkaarten.filter((k: X) => !["logos", "biblehub", "blueletterbible", "netbible", "apibible", "crosswire", "moderne-nl-vertalingen", "google-scholar", "ccel", "nl-tijdschriften"].includes(k.id)).map((k: X) => <label key={k.id} className="rij" style={{ margin: 0, color: "var(--tekst)" }}><input type="checkbox" style={{ width: "auto" }} checked={!(i.uitgeschakeldeConnectors ?? []).includes(k.id)} onChange={(e) => setI({ ...i, uitgeschakeldeConnectors: e.target.checked ? (i.uitgeschakeldeConnectors ?? []).filter((c: string) => c !== k.id) : [...(i.uitgeschakeldeConnectors ?? []), k.id] })} />{k.naam.split(" (")[0].split(" — ")[0]}</label>)}</div>
        <div className="rij" style={{ marginTop: 10 }}><button className="zacht" onClick={controleer} disabled={bezig}>{bezig ? "Controleren…" : "Test alle bronnen nu (live)"}</button>{controle && <span className="zacht-tekst">Laatste controle: {controle.moment?.slice(0, 16).replace("T", " ")}</span>}</div>
        {controle && <table style={{ marginTop: 8 }}><tbody>{controle.uitkomsten.map((u: X) => <tr key={u.id}><td>{u.naam}</td><td><span className={`label ${u.uitkomst === "werkt" || u.uitkomst === "lokaal" ? "n-direct_aangetoond" : u.uitkomst === "fout" ? "n-omstreden" : "n-niet_geverifieerd"}`}>{u.uitkomst}</span></td><td className="zacht-tekst">{u.resultaten} resultaten · {u.ms} ms {u.melding && `· ${u.melding}`}</td></tr>)}</tbody></table>}
      </div>

      <div className="rij" style={{ margin: "12px 0" }}><button onClick={bewaar}>Instellingen opslaan</button>{melding && <span className="zacht-tekst">{melding}</span>}</div>

      {kosten && (
        <div className="kaart">
          <h2 style={{ marginTop: 0 }}>Kosten en gebruik</h2>
          <p>AI-kosten deze maand: <b>${kosten.dezeMaandUsd.toFixed(3)}</b> van ${i.maandbudgetUsd} maandbudget.</p>
          <h3>AI per stap</h3>
          <table><thead><tr><th>Aanbieder/model</th><th>Stap</th><th>Status</th><th>Aanroepen</th><th>Tokens in/uit</th><th>Kosten</th></tr></thead><tbody>{kosten.aiPerStap.map((r: X, k: number) => <tr key={k}><td>{r.aanbieder} / {r.model}</td><td>{r.stap}</td><td>{r.status}</td><td>{r.n}</td><td>{r.invoer ?? 0} / {r.uitvoer ?? 0}</td><td>${(r.kosten ?? 0).toFixed(4)}</td></tr>)}</tbody></table>
          <h3>Externe diensten</h3>
          <table><thead><tr><th>Dienst</th><th>Host</th><th>Aanroepen</th><th>Uit cache (vermeden)</th><th>Fouten</th><th>Gem. ms</th></tr></thead><tbody>{kosten.externeDiensten.map((r: X, k: number) => <tr key={k}><td>{r.dienst}</td><td>{r.host}</td><td>{r.n}</td><td>{r.uit_cache}</td><td>{r.fouten}</td><td>{r.gem_ms}</td></tr>)}</tbody></table>
          <p className="zacht-tekst">Alle bronnen in deze versie zijn gratis; betaalde integraties (bijv. hogere API-limieten) worden nooit automatisch geactiveerd. Lokale zoekfuncties (tekst, grondtaal, commentaren) kosten niets.</p>
        </div>
      )}
    </>
  );
}
