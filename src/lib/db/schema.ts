// Migraties: alleen toevoegen, nooit bestaande wijzigen.
// vkey = boeknummer * 1_000_000 + hoofdstuk * 1_000 + vers (Engelse/KJV-versnummering als ruggengraat).
export const MIGRATIES: string[] = [
  `
  CREATE TABLE meta (sleutel TEXT PRIMARY KEY, waarde TEXT NOT NULL);
  CREATE TABLE instellingen (sleutel TEXT PRIMARY KEY, waarde TEXT NOT NULL);

  -- Bijbelteksten --------------------------------------------------------
  CREATE TABLE vertalingen (
    id TEXT PRIMARY KEY, naam TEXT NOT NULL, taal TEXT NOT NULL,
    licentie TEXT NOT NULL, bron_url TEXT NOT NULL, attributie TEXT NOT NULL,
    bron_commit TEXT, versnummering TEXT NOT NULL DEFAULT 'KJV'
  );
  CREATE TABLE verzen (
    vertaling TEXT NOT NULL REFERENCES vertalingen(id) ON DELETE CASCADE,
    vkey INTEGER NOT NULL, ref TEXT NOT NULL, tekst TEXT NOT NULL,
    PRIMARY KEY (vertaling, vkey)
  ) WITHOUT ROWID;
  CREATE VIRTUAL TABLE verzen_fts USING fts5(vertaling UNINDEXED, vkey UNINDEXED, tekst, tokenize='unicode61 remove_diacritics 2');

  -- Grondtekst (STEP TAHOT/TAGNT) -----------------------------------------
  CREATE TABLE woorden (
    vkey INTEGER NOT NULL, pos INTEGER NOT NULL, taal TEXT NOT NULL,
    vorm TEXT NOT NULL, translit TEXT, glosse TEXT,
    strong TEXT, strong_basis TEXT, lemma TEXT, morf TEXT, bron_ref TEXT, eigennaam INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (vkey, pos)
  ) WITHOUT ROWID;
  CREATE INDEX woorden_strong ON woorden(strong_basis, vkey);
  CREATE TABLE lexicon (
    strong TEXT PRIMARY KEY, taal TEXT NOT NULL, lemma TEXT, translit TEXT,
    woordsoort TEXT, glosse TEXT, definitie TEXT
  ) WITHOUT ROWID;
  CREATE TABLE morfologie (code TEXT PRIMARY KEY, uitleg TEXT NOT NULL) WITHOUT ROWID;
  CREATE TABLE lemma_freq (strong_basis TEXT PRIMARY KEY, totaal INTEGER NOT NULL, verzen INTEGER NOT NULL) WITHOUT ROWID;

  -- Kruisverwijzingen (OpenBible.info) ------------------------------------
  CREATE TABLE kruisverwijzingen (
    van INTEGER NOT NULL, naar_start INTEGER NOT NULL, naar_eind INTEGER NOT NULL, stemmen INTEGER NOT NULL
  );
  CREATE INDEX kv_van ON kruisverwijzingen(van);
  CREATE INDEX kv_naar ON kruisverwijzingen(naar_start);

  -- Lokale (rechtmatig opgeslagen) commentaren ----------------------------
  CREATE TABLE werken (
    id TEXT PRIMARY KEY, titel TEXT NOT NULL, auteur TEXT NOT NULL, jaar TEXT,
    taal TEXT NOT NULL, traditie TEXT, brontype TEXT NOT NULL,
    licentie TEXT NOT NULL, rechtenstatus TEXT NOT NULL, bron_url TEXT NOT NULL,
    attributie TEXT NOT NULL, editie TEXT, bron_commit TEXT
  );
  CREATE TABLE commentaar (
    id INTEGER PRIMARY KEY, werk TEXT NOT NULL REFERENCES werken(id) ON DELETE CASCADE,
    vkey_start INTEGER NOT NULL, vkey_eind INTEGER NOT NULL, label TEXT NOT NULL,
    sectie TEXT, tekst TEXT NOT NULL, bron_url TEXT
  );
  CREATE INDEX commentaar_vkey ON commentaar(vkey_start, vkey_eind);
  CREATE VIRTUAL TABLE commentaar_fts USING fts5(tekst, content='commentaar', content_rowid='id', tokenize='unicode61 remove_diacritics 2');

  -- Projecten ------------------------------------------------------------
  CREATE TABLE projecten (
    id TEXT PRIMARY KEY, titel TEXT NOT NULL, bijbelgedeelten TEXT NOT NULL DEFAULT '',
    thema TEXT NOT NULL DEFAULT '', dienst TEXT NOT NULL DEFAULT '', datum TEXT NOT NULL DEFAULT '',
    onderzoeksvragen TEXT NOT NULL DEFAULT '', notities TEXT NOT NULL DEFAULT '',
    inzichten TEXT NOT NULL DEFAULT '', open_vragen TEXT NOT NULL DEFAULT '',
    conclusies TEXT NOT NULL DEFAULT '', gemaakt TEXT NOT NULL, gewijzigd TEXT NOT NULL
  );

  -- Eigen documenten -----------------------------------------------------
  CREATE TABLE documenten (
    id TEXT PRIMARY KEY, project TEXT REFERENCES projecten(id) ON DELETE SET NULL,
    titel TEXT NOT NULL, bestandsnaam TEXT NOT NULL, soort TEXT NOT NULL,
    sha256 TEXT NOT NULL UNIQUE, grootte INTEGER NOT NULL, paginas INTEGER,
    auteur TEXT, jaar TEXT, bronvermelding TEXT, prive INTEGER NOT NULL DEFAULT 1,
    video_id TEXT, transcript_soort TEXT, gemaakt TEXT NOT NULL
  );
  CREATE TABLE document_delen (
    id INTEGER PRIMARY KEY, document TEXT NOT NULL REFERENCES documenten(id) ON DELETE CASCADE,
    volgorde INTEGER NOT NULL, locatie TEXT NOT NULL, pagina INTEGER, start_sec REAL, eind_sec REAL, tekst TEXT NOT NULL
  );
  CREATE INDEX document_delen_doc ON document_delen(document, volgorde);
  CREATE VIRTUAL TABLE document_delen_fts USING fts5(tekst, content='document_delen', content_rowid='id', tokenize='unicode61 remove_diacritics 2');
  CREATE TABLE document_samenvattingen (
    document TEXT PRIMARY KEY REFERENCES documenten(id) ON DELETE CASCADE,
    tekst TEXT NOT NULL, door TEXT NOT NULL, gemaakt TEXT NOT NULL
  );

  -- Bronnen die tijdens onderzoek zijn gevonden ---------------------------
  CREATE TABLE bronnen (
    id TEXT PRIMARY KEY, connector TEXT NOT NULL, brontype TEXT NOT NULL,
    titel TEXT NOT NULL, auteurs TEXT NOT NULL DEFAULT '[]', jaar TEXT, datum TEXT,
    uitgever TEXT, url TEXT, doi TEXT, taal TEXT, samenvatting TEXT,
    bijbelgedeelten TEXT NOT NULL DEFAULT '[]', volledige_tekst INTEGER NOT NULL DEFAULT 0,
    toegang TEXT NOT NULL DEFAULT 'onbekend', rechten TEXT NOT NULL DEFAULT '{}',
    traditie TEXT, geraadpleegd TEXT NOT NULL,
    bibliografisch TEXT NOT NULL DEFAULT 'niet_gecontroleerd',
    inhoudelijk TEXT NOT NULL DEFAULT 'niet_gecontroleerd',
    extra TEXT NOT NULL DEFAULT '{}'
  );
  CREATE INDEX bronnen_doi ON bronnen(doi);
  CREATE TABLE passages (
    id TEXT PRIMARY KEY, bron TEXT NOT NULL REFERENCES bronnen(id) ON DELETE CASCADE,
    soort TEXT NOT NULL, locatie TEXT NOT NULL, tekst TEXT NOT NULL,
    url TEXT, start_sec REAL, eind_sec REAL
  );
  CREATE INDEX passages_bron ON passages(bron);
  CREATE TABLE bron_markeringen (
    project TEXT NOT NULL REFERENCES projecten(id) ON DELETE CASCADE,
    bron TEXT NOT NULL REFERENCES bronnen(id) ON DELETE CASCADE,
    markering TEXT NOT NULL, notitie TEXT NOT NULL DEFAULT '', gewijzigd TEXT NOT NULL,
    PRIMARY KEY (project, bron)
  );

  -- Onderzoek ------------------------------------------------------------
  CREATE TABLE onderzoeken (
    id TEXT PRIMARY KEY, project TEXT REFERENCES projecten(id) ON DELETE SET NULL,
    vraag TEXT NOT NULL, opties TEXT NOT NULL, modus TEXT NOT NULL,
    status TEXT NOT NULL, budget_usd REAL NOT NULL, kosten_usd REAL NOT NULL DEFAULT 0,
    raming TEXT NOT NULL DEFAULT '{}', fout TEXT, gemaakt TEXT NOT NULL, gewijzigd TEXT NOT NULL
  );
  CREATE TABLE onderzoek_stappen (
    onderzoek TEXT NOT NULL REFERENCES onderzoeken(id) ON DELETE CASCADE,
    stap TEXT NOT NULL, status TEXT NOT NULL, uitvoer TEXT NOT NULL DEFAULT '{}',
    fout TEXT, gestart TEXT, klaar TEXT, versie INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (onderzoek, stap)
  );
  CREATE TABLE onderzoek_bewijs (
    onderzoek TEXT NOT NULL REFERENCES onderzoeken(id) ON DELETE CASCADE,
    label TEXT NOT NULL, passage TEXT NOT NULL REFERENCES passages(id) ON DELETE CASCADE,
    herkomst TEXT NOT NULL, relevantie REAL,
    PRIMARY KEY (onderzoek, label)
  );
  CREATE TABLE onderzoek_bronnen (
    onderzoek TEXT NOT NULL REFERENCES onderzoeken(id) ON DELETE CASCADE,
    bron TEXT NOT NULL REFERENCES bronnen(id) ON DELETE CASCADE,
    zoekvraag TEXT NOT NULL, rang INTEGER NOT NULL, beoordeling TEXT NOT NULL DEFAULT '{}',
    PRIMARY KEY (onderzoek, bron)
  );
  CREATE TABLE beweringen (
    id TEXT PRIMARY KEY, onderzoek TEXT NOT NULL REFERENCES onderzoeken(id) ON DELETE CASCADE,
    sectie TEXT NOT NULL, tekst TEXT NOT NULL, niveau TEXT NOT NULL, voorgesteld_niveau TEXT,
    verwijzingen TEXT NOT NULL DEFAULT '[]', controle TEXT NOT NULL DEFAULT '{}',
    herkomst TEXT NOT NULL, perspectief TEXT, volgorde INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX beweringen_onderzoek ON beweringen(onderzoek, sectie, volgorde);

  -- Kosten en externe aanroepen (nooit inhoud of sleutels) ----------------
  CREATE TABLE ai_gebruik (
    id INTEGER PRIMARY KEY, onderzoek TEXT, aanbieder TEXT NOT NULL, model TEXT NOT NULL,
    stap TEXT NOT NULL, invoer_tokens INTEGER, uitvoer_tokens INTEGER, cache_tokens INTEGER,
    kosten_usd REAL, raming_max_usd REAL, verzoek_id TEXT, status TEXT NOT NULL, gemaakt TEXT NOT NULL
  );
  CREATE TABLE externe_aanroepen (
    id INTEGER PRIMARY KEY, onderzoek TEXT, dienst TEXT NOT NULL, host TEXT NOT NULL,
    status INTEGER, ms INTEGER, uit_cache INTEGER NOT NULL DEFAULT 0, fout TEXT, gemaakt TEXT NOT NULL
  );
  CREATE TABLE http_cache (
    sleutel TEXT PRIMARY KEY, status INTEGER NOT NULL, inhoud TEXT NOT NULL,
    opgehaald TEXT NOT NULL, verloopt TEXT NOT NULL
  );
  `,
  // 2: bewering-id's (C1, C2 …) zijn uniek binnen één onderzoek, niet globaal.
  `
  DROP TABLE beweringen;
  CREATE TABLE beweringen (
    id TEXT NOT NULL, onderzoek TEXT NOT NULL REFERENCES onderzoeken(id) ON DELETE CASCADE,
    sectie TEXT NOT NULL, tekst TEXT NOT NULL, niveau TEXT NOT NULL, voorgesteld_niveau TEXT,
    verwijzingen TEXT NOT NULL DEFAULT '[]', controle TEXT NOT NULL DEFAULT '{}',
    herkomst TEXT NOT NULL, perspectief TEXT, volgorde INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (onderzoek, id)
  );
  CREATE INDEX beweringen_onderzoek ON beweringen(onderzoek, sectie, volgorde);
  `,
];
