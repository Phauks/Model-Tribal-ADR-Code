// The pictures essays show (":::: figure picture /files/<reference>/<name>",
// docs/editing.md), made ready for print by tools/prepare_pictures.py: found
// in a local folder or downloaded from the website, and turned into
// grayscale copies under output/pictures/.

import path from "node:path";
import { spawnSync } from "node:child_process";
import { PRINT_DIRECTORY } from "./configuration.mjs";

// A picture is at most this share of the text block's height (figure-picture in typst/book.typ).
export const PICTURE_HEIGHT_SHARE = 0.6;

export const PICTURE_CACHE = path.join(PRINT_DIRECTORY, "output", "pictures");

// The opening line of a picture figure, as markdown.mjs reads it.
const PICTURE_LINE = /^ {0,3}:{3,}\s*figure\s+picture\s+(\S+)\s*$/gm;

/** Every picture address the given records' bodies name, in order, once each. */
export function pictureAddresses(records) {
  const addresses = new Set();
  for (const record of records) {
    for (const match of (record.body || "").matchAll(PICTURE_LINE)) addresses.add(match[1]);
  }
  return [...addresses];
}

/**
 * Makes the print copy of each address. Returns a Map from address to
 * { file, width, height, sha256, from } or { problem }.
 * `site` is the website to download from (none: local folders only).
 */
export function preparePictures(addresses, { site, folders = [], cache = PICTURE_CACHE } = {}) {
  if (!addresses.length) return new Map();
  const args = ["-I", path.join(PRINT_DIRECTORY, "tools/prepare_pictures.py"), "--cache", cache];
  if (site) args.push("--site", site);
  for (const folder of folders) args.push("--folder", folder);
  const result = spawnSync("python3", args, { input: JSON.stringify(addresses), encoding: "utf8" });
  if (result.error) throw new Error(`Could not prepare the essays' pictures: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`Could not prepare the essays' pictures:\n${result.stderr}`);
  return new Map(Object.entries(JSON.parse(result.stdout)));
}

/** Where the book's pictures come from: book.yaml, or PRINT_PICTURES_SITE to try another website, or "none". */
export function pictureSite(book) {
  const chosen = process.env.PRINT_PICTURES_SITE ?? book.pictures?.site ?? null;
  return chosen && chosen !== "none" ? chosen : null;
}
