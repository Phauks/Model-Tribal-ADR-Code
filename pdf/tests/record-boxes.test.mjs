import assert from "node:assert/strict";
import { test } from "node:test";
import { boxMarkdown, fillBoxes } from "../pipeline/record-boxes.mjs";

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
