// Voorkom het samenvoegen van verschillende theologische werken op basis van titel+jaar alleen.
import { describe, expect, it } from "vitest";
import { nieuweDb } from "../src/lib/db";
import { bewaarBron } from "../src/lib/sources/opslag";
import type { BronRecord } from "../src/lib/sources/types";

const basis = (connector: string, extern_id: string, auteurs: string[]): BronRecord => ({
  connector, extern_id, auteurs, titel: "Genesis: An Introduction", jaar: "2020",
  brontype: "wetenschappelijk boek/commentaar", toegang: "alleen metadata",
  rechten: { vindbaar: "ja", leesbaar: "onbekend", downloadbaar: "onbekend", herbruikbaar: "onbekend" },
});

describe("Bronkwaliteit: conservatief ontdubbelen", () => {
  it("voegt verschillende auteurs met dezelfde titel en jaar niet samen", () => {
    const db = nieuweDb();
    const een = bewaarBron(db, basis("openlibrary", "werk-1", ["A. Onderzoeker"]));
    const twee = bewaarBron(db, basis("googlebooks", "werk-2", ["B. Commentator"]));
    expect(een).not.toBe(twee);
    expect((db.prepare("SELECT COUNT(*) AS n FROM bronnen").get() as {n:number}).n).toBe(2);
    db.close();
  });

  it("voegt dezelfde auteur, titel en jaar over verschillende catalogi wel samen", () => {
    const db = nieuweDb();
    const een = bewaarBron(db, basis("openlibrary", "werk-3", ["A. Onderzoeker"]));
    const twee = bewaarBron(db, basis("googlebooks", "werk-4", ["A. Onderzoeker"]));
    expect(een).toBe(twee);
    db.close();
  });

  it("raadt niet dat auteurloze gelijknamige titels hetzelfde boek zijn", () => {
    const db = nieuweDb();
    const een = bewaarBron(db, basis("openlibrary", "werk-5", []));
    const twee = bewaarBron(db, basis("googlebooks", "werk-6", []));
    expect(een).not.toBe(twee);
    db.close();
  });
});
