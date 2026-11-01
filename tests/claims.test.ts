import { describe, expect, it } from "vitest";
import { citaatInTekst, controleer, type Bewijs } from "../src/lib/verification/claims";

const bewijs = new Map<string, Bewijs>([
  ["E1", { label: "E1", soort: "bijbeltekst", tekst: "Ik ben die God van Beth-el, alwaar gij het opgerichte teken gezalfd hebt, waar gij Mij een gelofte beloofd hebt;", brontype: "bijbeltekst", bronTitel: "SV" }],
  ["E2", { label: "E2", soort: "commentaar", tekst: "He does not call himself the God of Bethel, because he is confined within the limits of a given place, but for the purpose of renewing to his servant the remembrance of his own promise", brontype: "historisch commentaar", bronTitel: "Calvijn" }],
  ["E3", { label: "E3", soort: "abstract", tekst: "This article studies the Bethel narratives.", brontype: "peer-reviewed artikel", bronTitel: "Artikel" }],
  ["E4", { label: "E4", soort: "data", tekst: "Het lemma נֶדֶר komt in Genesis alleen voor in 28:20 en 31:13.", brontype: "grondtekst", bronTitel: "analyse" }],
]);

describe("Claimcontrole", () => {
  it("niet-bestaande verwijzingen → niet geverifieerd", () => {
    const k = controleer("onderbouwde_interpretatie", [{ label: "E99", citaat: null }], bewijs);
    expect(k.niveau).toBe("niet_geverifieerd");
    expect(k.controle.onbekend).toEqual(["E99"]);
  });
  it("'direct aangetoond' vereist een letterlijk teruggevonden citaat uit een primaire bron", () => {
    expect(controleer("direct_aangetoond", [{ label: "E1", citaat: "waar gij Mij een gelofte beloofd hebt" }], bewijs).niveau).toBe("direct_aangetoond");
    const zonder = controleer("direct_aangetoond", [{ label: "E1", citaat: "waar gij Mij trouw beloofd hebt" }], bewijs);
    expect(zonder.niveau).not.toBe("direct_aangetoond");
    expect(zonder.controle.citatenNietGevonden.length).toBe(1);
    expect(zonder.verwijzingen[0].citaat).toBeNull();
    expect(controleer("direct_aangetoond", [{ label: "E2", citaat: "renewing to his servant the remembrance" }], bewijs).niveau).not.toBe("direct_aangetoond");
  });
  it("berekende tekstdata telt als primair", () => {
    expect(controleer("direct_aangetoond", [{ label: "E4", citaat: null }], bewijs).niveau).toBe("direct_aangetoond");
  });
  it("alleen abstract → hooguit mogelijke onderzoekslijn en gemarkeerd", () => {
    const k = controleer("onderbouwde_interpretatie", [{ label: "E3", citaat: null }], bewijs);
    expect(k.niveau).toBe("mogelijke_onderzoekslijn");
    expect(k.controle.alleenAbstractOfMetadata).toBe(true);
  });
  it("verhoogt nooit een niveau", () => {
    expect(controleer("mogelijke_onderzoekslijn", [{ label: "E1", citaat: "gelofte beloofd" }], bewijs).niveau).toBe("mogelijke_onderzoekslijn");
  });
  it("citaatvergelijking negeert hoofdletters, typografische aanhalingstekens en Hebreeuwse punctuatie, staat '…' toe", () => {
    expect(citaatInTekst("Ik ben die God … gelofte beloofd", bewijs.get("E1")!.tekst)).toBe(true);
    expect(citaatInTekst("שם נדר", "נָדַ֥רְתָּ לִּ֛י שָׁ֖ם נֶ֑דֶר עַתָּ֗ה")).toBe(true);
    expect(citaatInTekst("abc", "abc")).toBe(false); // te kort om iets te bewijzen
  });
});
