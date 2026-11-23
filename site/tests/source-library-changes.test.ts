import { describe, expect, it } from "vitest";
import { changeStatements } from "#lib/server/source-library.ts";

describe("changeStatements", () => {
  it("keeps a statement that runs over several lines whole", () => {
    const sql =
      "CREATE TABLE IF NOT EXISTS meta (name TEXT PRIMARY KEY, value TEXT);\nCREATE TABLE IF NOT EXISTS pages (\n  passage_id INTEGER PRIMARY KEY,\n  text TEXT NOT NULL);\n";
    expect(changeStatements(sql)).toEqual([
      "CREATE TABLE IF NOT EXISTS meta (name TEXT PRIMARY KEY, value TEXT);",
      "CREATE TABLE IF NOT EXISTS pages (\n  passage_id INTEGER PRIMARY KEY,\n  text TEXT NOT NULL);",
    ]);
  });

  it("does not split at a semicolon or line break inside quoted text", () => {
    const sql =
      "INSERT INTO pages VALUES (1, 'Section 1; the court''s rule;\nnext line'), (2, 'x');\nINSERT OR REPLACE INTO meta VALUES ('build', '2026-11-23T09:51:04+00:00');\n";
    expect(changeStatements(sql)).toEqual([
      "INSERT INTO pages VALUES (1, 'Section 1; the court''s rule;\nnext line'), (2, 'x');",
      "INSERT OR REPLACE INTO meta VALUES ('build', '2026-11-23T09:51:04+00:00');",
    ]);
  });

  it("returns nothing for an empty part", () => {
    expect(changeStatements("\n  \n")).toEqual([]);
  });
});
