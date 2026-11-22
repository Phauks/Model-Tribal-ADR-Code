import assert from "node:assert/strict";
import { test } from "node:test";
import { caseNameFrom, casesByTopicMarkdown, taggedCases } from "../pipeline/case-topics.mjs";
import { escapeTypst, separateCalls } from "../pipeline/typst-text.mjs";

test("the index of cases by topic is built from the Topics parts of case boxes", () => {
  const essay = ":::: case worcester-v-georgia\n::: topics\nSovereignty; Civil jurisdiction\n:::\n::::\n\n:::: case cherokee-nation-v-georgia\n::: topics\nSovereignty\n:::\n::::\n";
  const records = {
    "worcester-v-georgia": { citation: { type: "legal_case", title: "Worcester v. Georgia", issued: { "date-parts": [[1832, 3, 3]] } } },
    "cherokee-nation-v-georgia": { citation: { type: "legal_case", title: "Cherokee Nation v. Georgia", issued: { "date-parts": [[1831, 3, 18]] } } },
  };
  assert.equal(
    casesByTopicMarkdown(taggedCases(essay), (key) => caseNameFrom(records[key])),
    "**Civil jurisdiction.** [*Worcester v. Georgia* (1832)](#case-worcester-v-georgia).\n\n" +
      "**Sovereignty.** [*Cherokee Nation v. Georgia* (1831)](#case-cherokee-nation-v-georgia); [*Worcester v. Georgia* (1832)](#case-worcester-v-georgia).",
  );
});

test("a semicolon after a function call stays on the page", () => {
  assert.equal(escapeTypst("a; b"), String.raw`a\; b`);
  assert.equal(separateCalls("#emph[x]; y"), String.raw`#emph[x]\; y`);
});
