import { describe, expect, it } from "vitest";
import { diverseVolgorde, relevantie, type Kenmerken } from "../src/lib/research/selectie";

const k: Kenmerken = { boekNamen: ["genesis"], hoofdstuk: 31, verwanteHoofdstukken: [28, 35], termen: ["jacob", "jakob", "bethel", "betel", "laban", "rachel", "vow", "pillar"] };
const b = (titel: string, samenvatting: string | null, toegang = "abstract", brontype = "academisch artikel (peer review niet vastgesteld)") => ({ titel, samenvatting, toegang, brontype });

describe("Bronselectie", () => {
  it("een artikel over Genesis 31 weegt zwaarder dan een algemeen artikel over spiritualiteit", () => {
    const specifiek = relevantie(b("Jacob's vow at Bethel: Genesis 31 and 28", "The pillar and the vow …"), k);
    const algemeen = relevantie(b("Spirituality and modern pastoral care", "A study of spiritual practices."), k);
    expect(specifiek.niveau).toBeGreaterThanOrEqual(2);
    expect(algemeen.niveau).toBe(0);
    expect(algemeen.redenen[0]).toMatch(/geen aantoonbaar verband/);
  });
  it("een passage met inhoud weegt zwaarder dan een catalogusvermelding met dezelfde titel", () => {
    const vol = relevantie(b("Commentary on Genesis 31 (Jacob)", null, "volledige tekst", "historisch commentaar"), k);
    const cat = relevantie(b("Commentary on Genesis 31 (Jacob)", null, "alleen metadata", "boek (catalogus)"), k);
    expect(vol.score).toBeGreaterThan(cat.score);
  });
  it("een verwant hoofdstuk (Gen 35) telt als verband, alleen het boek noemen niet", () => {
    expect(relevantie(b("Putting away foreign gods in Genesis 35", null), k).verbandMetGedeelte).toBe(true);
    expect(relevantie(b("Creation in Genesis 1", null), k).verbandMetGedeelte).toBe(false);
  });
  it("diverse volgorde wisselt vindplaatsen af", () => {
    const v = diverseVolgorde([{ score: 0.9, groep: "openalex" }, { score: 0.8, groep: "openalex" }, { score: 0.5, groep: "doaj" }]);
    expect(v.map((x) => x.groep)).toEqual(["openalex", "doaj", "openalex"]);
  });
});
