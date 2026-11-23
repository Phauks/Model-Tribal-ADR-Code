#!/usr/bin/env node
// Builds the prepared editions that readers order on the website: for each
// size, the interior and a paperback and a hardcover cover. Each edition is a
// file set, which scripts/books/publish_file_sets.py uploads to the bucket
// under books/<file set>/ (docs/book-orders.md):
//
//   pdf/output/editions/current/<size>/paperback/interior.pdf, cover.pdf, details.json
//   pdf/output/editions/current/<size>/hardcover/interior.pdf, cover.pdf, details.json
//
//   node pipeline/build-editions.mjs                 every size in book-sizes.yaml
//   node pipeline/build-editions.mjs --trim us-trade --trim a4
//   --specimen    build from the specimen chapter, for testing
//
// When LULU_CLIENT_KEY, LULU_CLIENT_SECRET and LULU_ENVIRONMENT (sandbox or
// production) are set, each cover's size is checked against Lulu's
// cover-dimensions call, and the build fails if they differ.

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { build } from "./build.mjs";
import { BINDINGS, buildCover } from "./cover.mjs";
import { loadConfiguration, PRINT_DIRECTORY, trackVersion } from "./configuration.mjs";

const LULU_ADDRESSES = { sandbox: "https://api.sandbox.lulu.com", production: "https://api.lulu.com" };
// Lulu's codes for the two bindings, with standard black-and-white ink,
// 60# white paper and a matte cover (Lulu Print API, "pod_package_id").
const BINDING_CODES = { paperback: "PB", hardcover: "CW" };
const TOLERANCE_INCHES = 0.02;

/**
 * Lulu's trim code: width and height in hundredths of an inch, cut off rather
 * than rounded, such as 0600X0900, or 0425X0687 for the Pocket Book (Lulu
 * Print API examples).
 */
export function luluTrimCode(trim) {
  const hundredths = (inches) => String(Math.floor(inches * 100 + 1e-6)).padStart(4, "0");
  return `${hundredths(trim.width)}X${hundredths(trim.height)}`;
}

export function podPackageIdentifier(trim, binding) {
  return `${luluTrimCode(trim)}.BW.STD.${BINDING_CODES[binding]}.060UW444.MXX`;
}

function luluSettings() {
  const { LULU_CLIENT_KEY: key, LULU_CLIENT_SECRET: secret, LULU_ENVIRONMENT: environment } = process.env;
  if (!key || !secret) return null;
  if (!LULU_ADDRESSES[environment]) throw new Error("LULU_ENVIRONMENT must be sandbox or production");
  return { key, secret, base: LULU_ADDRESSES[environment] };
}

async function luluToken(settings) {
  const response = await fetch(`${settings.base}/auth/realms/glasstree/protocol/openid-connect/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${settings.key}:${settings.secret}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!response.ok) throw new Error(`Lulu sign-in failed (${response.status})`);
  return (await response.json()).access_token;
}

/** Lulu's cover size in inches for a product and page count. */
async function luluCoverSize(settings, token, podPackageId, pages) {
  const response = await fetch(`${settings.base}/cover-dimensions/`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ pod_package_id: podPackageId, interior_page_count: pages, unit: "inch" }),
  });
  if (!response.ok) throw new Error(`Lulu refused the cover-dimensions call for ${podPackageId} (${response.status})`);
  const body = await response.json();
  return { width: Number(body.width), height: Number(body.height) };
}

export async function buildEditions({ trims, specimen = false, lulu = luluSettings() } = {}) {
  const { book, sizes } = loadConfiguration();
  const chosen = trims?.length ? trims : Object.keys(sizes.trims);
  const token = lulu ? await luluToken(lulu) : null;
  const root = path.join(PRINT_DIRECTORY, "output", "editions");
  const editions = [];
  for (const trimKey of chosen) {
    const { directory: interiorDirectory, report } = build({ specimen, trim: trimKey, name: path.join("editions", "interiors", trimKey) });
    const pages = report.page_count;
    for (const binding of BINDINGS) {
      const fileSet = `current/${trimKey}/${binding}`;
      const directory = path.join(root, fileSet);
      fs.rmSync(directory, { recursive: true, force: true });
      fs.mkdirSync(directory, { recursive: true });
      fs.copyFileSync(path.join(interiorDirectory, "interior.pdf"), path.join(directory, "interior.pdf"));
      const { layout } = buildCover({ directory, sizes, book, trimKey, pageCount: pages, binding });
      let luluSize = null;
      if (lulu) {
        luluSize = await luluCoverSize(lulu, token, podPackageIdentifier(sizes.trims[trimKey], binding), pages);
        if (Math.abs(luluSize.width - layout.width) > TOLERANCE_INCHES || Math.abs(luluSize.height - layout.height) > TOLERANCE_INCHES) {
          throw new Error(
            `${fileSet}: the cover is ${layout.width} x ${layout.height} in, but Lulu expects ${luluSize.width} x ${luluSize.height} in. Check the cover rules in book-sizes.yaml.`,
          );
        }
      }
      const details = {
        title: [book.metadata.title, book.metadata.subtitle].filter(Boolean).join(": "),
        pages,
        size: trimKey,
        binding,
        print_version: trackVersion("pdf"),
        content_version: trackVersion("content"),
        cover_inches: { width: layout.width, height: layout.height, spine: layout.spine.width },
        cover_checked_with_lulu: Boolean(luluSize),
        built: new Date().toISOString(),
      };
      fs.writeFileSync(path.join(directory, "details.json"), JSON.stringify(details, null, 2) + "\n");
      editions.push({ fileSet, ...details });
    }
  }
  return editions;
}

async function main() {
  const { values } = parseArgs({
    options: { trim: { type: "string", multiple: true }, specimen: { type: "boolean", default: false } },
  });
  const editions = await buildEditions({ trims: values.trim, specimen: values.specimen });
  for (const edition of editions) {
    const cover = edition.cover_inches;
    console.log(
      `${edition.fileSet}: ${edition.pages} pages, cover ${cover.width} x ${cover.height} in, spine ${cover.spine} in` +
        (edition.cover_checked_with_lulu ? ", matches Lulu" : ""),
    );
  }
  if (!luluSettings()) console.log("Cover sizes were not checked with Lulu: set LULU_CLIENT_KEY, LULU_CLIENT_SECRET and LULU_ENVIRONMENT to check them.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
