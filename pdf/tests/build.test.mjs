// End-to-end: build the specimen and check the PDF. Needs Typst and the
// Python packages in requirements.txt; skipped when Typst is missing.

import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "../pipeline/build.mjs";
import { typstVersion } from "../pipeline/compile.mjs";

const skip = typstVersion() ? false : "Typst is not installed";

test("the specimen builds and passes Lulu's checks at two sizes", { skip }, () => {
  for (const trim of ["us-trade", "digest"]) {
    const { report } = build({ specimen: true, trim, name: `test-${trim}` });
    assert.equal(report.checks.failures.length, 0);
    assert.equal(report.checks.all_fonts_embedded, true);
    assert.equal(report.checks.gray_only, true);
    assert.deepEqual(report.checks.page_size_points, [report.trim.width * 72 + 18, report.trim.height * 72 + 18]);
    assert.ok(report.checks.fonts.some((font) => font.includes("AtkinsonHyperlegibleNext")));
    assert.ok(report.checks.fonts.some((font) => font.includes("NotoSansCherokee")));
  }
});
