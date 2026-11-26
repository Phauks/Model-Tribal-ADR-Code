// Pictures in essays: finding their addresses and making grayscale print copies.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { PRINT_DIRECTORY } from "../pipeline/configuration.mjs";
import { pictureAddresses, pictureSite, preparePictures } from "../pipeline/pictures.mjs";

const SPECIMEN_FILES = path.join(PRINT_DIRECTORY, "tests/fixtures/specimen/files");

test("picture addresses are read from figure lines, once each, and videos are left out", () => {
  const body = [
    ":::: figure picture /files/U-20261126-PR1NT5/council-house.jpg",
    "Caption.",
    "::::",
    ":::: figure video /files/U-20261126-PR1NT5/film.mp4",
    "::::",
    ":::: figure picture /files/U-20261126-PR1NT5/council-house.jpg",
    "::::",
  ].join("\n");
  assert.deepEqual(pictureAddresses([{ body }, { body: "No figures." }]), ["/files/U-20261126-PR1NT5/council-house.jpg"]);
});

test("the website pictures come from is set in book.yaml, and can be turned off", () => {
  const saved = process.env.PRINT_PICTURES_SITE;
  delete process.env.PRINT_PICTURES_SITE;
  try {
    assert.equal(pictureSite({ pictures: { site: "https://example.org" } }), "https://example.org");
    assert.equal(pictureSite({ pictures: { site: "none" } }), null);
    process.env.PRINT_PICTURES_SITE = "none";
    assert.equal(pictureSite({ pictures: { site: "https://example.org" } }), null);
  } finally {
    if (saved === undefined) delete process.env.PRINT_PICTURES_SITE;
    else process.env.PRINT_PICTURES_SITE = saved;
  }
});

test("print copies are grayscale, flattened on white, and record the original's SHA-256", () => {
  const cache = fs.mkdtempSync(path.join(PRINT_DIRECTORY, "output", "test-pictures-"));
  try {
    const photo = "/files/U-20261126-PR1NT5/council-house.jpg";
    const drawing = "/files/U-20261126-TA11PH/tall-drawing.png";
    const unknown = "/files/U-20261126-NNNNNN/missing.jpg";
    const pictures = preparePictures([photo, drawing, unknown, "/elsewhere/a.jpg"], { site: null, folders: [SPECIMEN_FILES], cache });
    const copy = pictures.get(photo);
    assert.equal(copy.from, "folder");
    assert.deepEqual([copy.width, copy.height], [1800, 1200]);
    assert.match(copy.file, /^output\/test-pictures-[^/]+\/U-20261126-PR1NT5\.jpg$/);
    const original = fs.readFileSync(path.join(SPECIMEN_FILES, "U-20261126-PR1NT5/council-house.jpg"));
    assert.equal(copy.sha256, createHash("sha256").update(original).digest("hex"));
    assert.match(pictures.get(drawing).file, /\.png$/);
    assert.match(pictures.get(unknown).problem, /not in the picture folders/);
    assert.match(pictures.get("/elsewhere/a.jpg").problem, /not a file sent from the website's editor/);
    // Pillow reads each copy back: one gray channel, and white where the drawing was transparent.
    const check = spawnSync(
      "python3",
      ["-I", "-c", "import sys; from PIL import Image\nfor f in sys.argv[1:]:\n  i = Image.open(f); print(i.mode, i.getpixel((0, 0)))", ...[photo, drawing].map((address) => path.join(PRINT_DIRECTORY, pictures.get(address).file))],
      { encoding: "utf8" },
    );
    assert.equal(check.status, 0, check.stderr);
    const [photoLine, drawingLine] = check.stdout.trim().split("\n");
    assert.match(photoLine, /^L \d+$/);
    assert.equal(drawingLine, "L 255");
  } finally {
    fs.rmSync(cache, { recursive: true, force: true });
  }
});
