CREATE TABLE IF NOT EXISTS meta (name TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS documents (
  document_id INTEGER PRIMARY KEY, key TEXT NOT NULL, other_keys TEXT, sha256 TEXT NOT NULL, bytes INTEGER,
  format TEXT, media_type TEXT, topic TEXT, title TEXT, citation TEXT, court TEXT, decided TEXT, nations TEXT,
  records TEXT, record_kinds TEXT, link TEXT, captured TEXT, obtained TEXT, rights TEXT, redistribution TEXT,
  served INTEGER NOT NULL DEFAULT 0, page_count INTEGER, characters INTEGER, ocr_pages INTEGER NOT NULL DEFAULT 0,
  empty_pages INTEGER NOT NULL DEFAULT 0, text_status TEXT, text_digest TEXT, metadata_digest TEXT);
CREATE INDEX IF NOT EXISTS documents_by_key ON documents(key);
CREATE INDEX IF NOT EXISTS documents_by_topic ON documents(topic);
CREATE TABLE IF NOT EXISTS pages (
  passage_id INTEGER PRIMARY KEY, document_id INTEGER NOT NULL, sequence INTEGER NOT NULL, page INTEGER,
  label TEXT, part INTEGER NOT NULL DEFAULT 1, method TEXT, text TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS pages_by_document ON pages(document_id, sequence);
CREATE TABLE IF NOT EXISTS citing_records (record TEXT NOT NULL, document_id INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS citing_records_by_record ON citing_records(record);
CREATE INDEX IF NOT EXISTS citing_records_by_document ON citing_records(document_id);
CREATE TABLE IF NOT EXISTS document_nations (nation TEXT NOT NULL, document_id INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS document_nations_by_nation ON document_nations(nation);
CREATE INDEX IF NOT EXISTS document_nations_by_document ON document_nations(document_id);
CREATE VIRTUAL TABLE IF NOT EXISTS pages_search USING fts5(
  text, content='pages', content_rowid='passage_id', tokenize='porter unicode61 remove_diacritics 2');
CREATE VIRTUAL TABLE IF NOT EXISTS documents_search USING fts5(
  title, citation, nations, key, content='documents', content_rowid='document_id',
  tokenize='porter unicode61 remove_diacritics 2');
INSERT INTO documents_search(documents_search, rowid, title, citation, nations, key) SELECT 'delete', document_id, title, citation, nations, key FROM documents WHERE document_id = 1;
INSERT INTO pages_search(pages_search, rowid, text) SELECT 'delete', passage_id, text FROM pages WHERE document_id = 1;
DELETE FROM pages WHERE document_id = 1;
DELETE FROM document_nations WHERE document_id = 1;
DELETE FROM citing_records WHERE document_id = 1;
DELETE FROM documents WHERE document_id = 1;
INSERT INTO documents (document_id, key, other_keys, sha256, bytes, format, media_type, topic, title, citation, court, decided, nations, records, record_kinds, link, captured, obtained, rights, redistribution, served, page_count, characters, ocr_pages, empty_pages, text_status, text_digest, metadata_digest) VALUES (1, 'articles/sample-article.txt', NULL, '9c818fde8594af8d53947a1267cf34bf020acb3a139dbd687a2f4c8f71ccf9db', 135, 'plain', '', 'articles', 'sample-article.txt', NULL, NULL, NULL, '', '', NULL, NULL, NULL, NULL, NULL, NULL, 0, 2, 133, 0, 0, 'full', '681d60c8514fa63c19fd94898a21a9de', '5a6eb23d4d366ce14e2409a96d43f47b');
INSERT INTO documents_search(rowid, title, citation, nations, key) SELECT document_id, title, citation, nations, key FROM documents WHERE document_id = 1;
INSERT INTO pages (passage_id, document_id, sequence, page, label, part, method, text) VALUES (1, 1, 1, 1, NULL, 1, 'plain', 'Mediation and arbitration in tribal gaming compacts.'), (2, 1, 2, 2, NULL, 1, 'plain', 'The limited waiver of sovereign immunity covers arbitration under 25 U.S.C. 2710.');
INSERT INTO pages_search(rowid, text) SELECT passage_id, text FROM pages WHERE document_id = 1;
INSERT INTO documents_search(documents_search, rowid, title, citation, nations, key) SELECT 'delete', document_id, title, citation, nations, key FROM documents WHERE document_id = 2;
INSERT INTO pages_search(pages_search, rowid, text) SELECT 'delete', passage_id, text FROM pages WHERE document_id = 2;
DELETE FROM pages WHERE document_id = 2;
DELETE FROM document_nations WHERE document_id = 2;
DELETE FROM citing_records WHERE document_id = 2;
DELETE FROM documents WHERE document_id = 2;
INSERT INTO documents (document_id, key, other_keys, sha256, bytes, format, media_type, topic, title, citation, court, decided, nations, records, record_kinds, link, captured, obtained, rights, redistribution, served, page_count, characters, ocr_pages, empty_pages, text_status, text_digest, metadata_digest) VALUES (2, 'peacemaking/sample-code.html', NULL, 'ee7daf223d88d226ecd37522fc1f66809817cf50cede7349a957d1e55b0c0798', 362, 'html', 'text/html', 'peacemaking', 'Sample Peacemaking Code', NULL, NULL, NULL, '', '', NULL, NULL, NULL, NULL, NULL, NULL, 0, 1, 227, 0, 0, 'full', '7f55a83caf3d812fa7d56c688344e1f6', '49aaa720e7d7c0ed71c335f22cfd5aee');
INSERT INTO documents_search(rowid, title, citation, nations, key) SELECT document_id, title, citation, nations, key FROM documents WHERE document_id = 2;
INSERT INTO pages (passage_id, document_id, sequence, page, label, part, method, text) VALUES (3, 2, 1, NULL, NULL, 1, 'html', 'Title 7. Peacemaking
Section 1. The Peacemaker Court may refer a dispute to a peacemaker, who shall meet with the parties and the elders of their families.
Section 2. A peacemaking agreement is binding when the parties sign it.');
INSERT INTO pages_search(rowid, text) SELECT passage_id, text FROM pages WHERE document_id = 2;
INSERT OR REPLACE INTO meta VALUES ('build', '2026-11-23T05:16:43+00:00');
