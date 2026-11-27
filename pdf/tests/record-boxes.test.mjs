import assert from "node:assert/strict";
import { test } from "node:test";
import { boxMarkdown, boxPartMarkdown, fillBoxes } from "../pipeline/record-boxes.mjs";

const records = new Map([
  [
    "worcester-v-georgia",
    {
      key: "worcester-v-georgia",
      case_box: {
        holding: "No.",
        quotes: [{ text: "The Cherokee nation, then, is a distinct community ...", pinpoint: "p. 561" }],
        topics: ["Sovereignty", "Civil jurisdiction"],
      },
    },
  ],
  ["indian-removal-act-1830", { key: "indian-removal-act-1830", law_box: { summary: "Authorized removal." } }],
]);

test("an empty case or law box is filled from the source's record", () => {
  const essay = ":::: case worcester-v-georgia\n::::\n\n:::: law indian-removal-act-1830\n::::\n";
  assert.equal(
    fillBoxes(essay, records),
    ":::: case worcester-v-georgia\n::: holding\nNo.\n:::\n\n::: quotes\n> The Cherokee nation, then, is a distinct community ...\n\n[@worcester-v-georgia, p. 561]\n:::\n\n::: topics\nSovereignty; Civil jurisdiction\n:::\n::::\n\n:::: law indian-removal-act-1830\n::: summary\nAuthorized removal.\n:::\n::::\n",
  );
});

test("a box written out in the essay, or without a record, is left as it is", () => {
  const essay = ":::: case worcester-v-georgia\n::: holding\nYes.\n:::\n::::\n\n:::: case no-record\n::::\n";
  assert.equal(fillBoxes(essay, records), essay);
});

test("a quotation from a separate opinion keeps its parenthetical", () => {
  assert.equal(
    boxMarkdown("case", "a-case", { quotes: [{ text: "Words.", pinpoint: "¶ 58", parenthetical: "Abrahamson, C.J., concurring" }] }),
    "::: quotes\n> Words.\n\n[@a-case, ¶ 58] (Abrahamson, C.J., concurring)\n:::",
  );
});

test("a record's reading follows its box as an Analysis block", () => {
  const withReading = new Map([
    [
      "indian-removal-act-1830",
      { key: "indian-removal-act-1830", law_box: { summary: "Authorized removal.", reading: { title: "Indian Removal Act (1830)", text: "A reading." } } },
    ],
  ]);
  assert.equal(
    fillBoxes("Before.\n\n:::: law indian-removal-act-1830\n::::\n\nAfter.\n", withReading),
    "Before.\n\n:::: law indian-removal-act-1830\n::: summary\nAuthorized removal.\n:::\n::::\n\n::: analysis Indian Removal Act (1830)\nA reading.\n:::\n\nAfter.\n",
  );
  assert.equal(boxMarkdown("law", "indian-removal-act-1830", withReading.get("indian-removal-act-1830").law_box), "::: summary\nAuthorized removal.\n:::");
});

test("Treatment ends with the later cases, by kind, without links in print", () => {
  const box = {
    treatment: "Quoted throughout modern decisions.",
    later_cases: {
      checked: "2026-11-20",
      source: "westlaw/example.pdf",
      list: [
        { treatment: "Distinguished", name: "United States v. Texas", citation: "143 U.S. 621 (1892)", link: "https://case.law/caselaw/?reporter=us&volume=143&case=0621-01" },
        { treatment: "Declined to extend", name: "Unnamed Mother v. United States", citation: "2025 WL 2390227 (D.N.M. Aug. 18, 2025)" },
      ],
    },
  };
  assert.equal(
    boxPartMarkdown("x", box, "treatment"),
    "::: treatment\nQuoted throughout modern decisions.\n\n**Declined to extend** (1)\n\n- *Unnamed Mother v. United States*, 2025 WL 2390227 (D.N.M. Aug. 18, 2025)\n\n**Distinguished** (1)\n\n- *United States v. Texas*, 143 U.S. 621 (1892)\n:::",
  );
});
