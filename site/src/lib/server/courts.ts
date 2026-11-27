/**
 * A page for each court the site names (Trevor, Nov. 24, 2026: stub pages
 * "like wikipedia ... when we reference something that doesn't exist yet";
 * design /mnt/project-files/design/stub-pages/): the Tribal courts whose
 * opinions the site shows (tribal-court-opinions.ts) and the courts that
 * decided the cases the site has records of, other than the Supreme Court
 * of the United States, which has its own pages. Each page is made from what
 * the site already holds about the court, so it is a stub (src/lib/stubs.ts)
 * until someone writes about the court.
 *
 * A court named several ways is one court (src/lib/court-pages.ts).
 */
import { error } from "@sveltejs/kit";
import { courtKey, courtName, isSupremeCourt } from "../court-pages.ts";
import { displayName } from "../nation-labels.ts";
import type { Stub } from "../stubs.ts";
import { caseCourtName, citationLine } from "./record-citations.ts";
import { nationNamesAndKinds, sources, type SourceRecord } from "./content.ts";
import type { FactGroup } from "./justice-pages.ts";
import { SourceUses, type SourceEntry } from "./source-uses.ts";
import {
  opinionsSourceKey,
  tribalCourtOpinions,
  type TribalCourtOpinion,
} from "./tribal-court-opinions.ts";
import type { CitationMark } from "../citation-marks.ts";

/** How many of a court's newest opinions its page lists; the rest are on each nation's table of opinions. */
export const shownOpinionCount = 5;

/** Past this many cases, a court with a list of all its cases elsewhere lists only its newest, and links that list. */
export const shownCaseCount = 25;

/** The lists of every case of a court with thousands (the Statistics page's collections, collections.ts). */
const caseLists: Record<string, string> = {
  "interior-board-of-indian-appeals": "/stats/interior-board-of-indian-appeals",
};

const caseKinds: Record<string, string> = {
  "tribal-case": "Tribal court",
  "federal-case": "Federal court",
  "state-case": "State court",
  "territorial-case": "Territorial court",
};

const reporterNames: Record<string, string> = {
  "am-tribal-law": "American Tribal Law Reporter",
  "navajo-rptr": "Navajo Reporter",
};

export interface CourtCase {
  key: string;
  name: string;
  citation: string;
  /** YYYY-MM-DD, YYYY-MM or YYYY. */
  decided: string;
  link: string;
}

export interface Court {
  key: string;
  name: string;
  /** "Tribal court", "Federal court", "Federal appeals board", "State court", "Territorial court" or "Court". */
  kind: string;
  /** The nations whose courts these are, from the opinions. */
  nations: { id: string; name: string }[];
  /** Newest first. */
  opinions: TribalCourtOpinion[];
  /** Oldest first. */
  cases: CourtCase[];
  /** The case records behind the cases, for the nations they name. */
  records: SourceRecord[];
}

let courtCache: Court[] | undefined;

function dateOf(record: SourceRecord): string {
  const parts = record.citation.issued?.["date-parts"]?.[0] ?? [];
  return parts
    .map((part, index) =>
      index === 0 ? String(part) : String(part).padStart(2, "0"),
    )
    .join("-");
}

/** Every court with a page, the most named first. */
export function courts(): Court[] {
  if (courtCache) return courtCache;
  const found = new Map<string, Court>();
  const nationNames = nationNamesAndKinds();
  const courtOf = (raw: string, kind: string): Court => {
    const key = courtKey(raw);
    let court = found.get(key);
    if (!court) {
      court = {
        key,
        name: courtName(raw),
        kind,
        nations: [],
        opinions: [],
        cases: [],
        records: [],
      };
      found.set(key, court);
    }
    if (court.kind === "Court" && kind !== "Court") court.kind = kind;
    return court;
  };
  for (const opinion of tribalCourtOpinions()) {
    if (!opinion.court.trim()) continue;
    const court = courtOf(opinion.court, "Tribal court");
    court.opinions.push(opinion);
    for (const id of opinion.nations) {
      if (court.nations.some((nation) => nation.id === id)) continue;
      const listed = nationNames.get(id);
      if (listed) court.nations.push({ id, name: displayName(listed.name) });
    }
  }
  for (const record of sources().values()) {
    if (
      (record.citation as { type?: string }).type !== "legal_case" ||
      !record.citation.title
    )
      continue;
    const named = caseCourtName(record);
    if (!named || isSupremeCourt(named)) continue;
    // Interior's Board of Indian Appeals decides cases but is an agency's board, not a court (scripts/law/ibia_decisions.py).
    const court = courtOf(
      named,
      named === "Interior Board of Indian Appeals"
        ? "Federal appeals board"
        : (caseKinds[record.kind] ?? "Court"),
    );
    court.records.push(record);
    court.cases.push({
      key: record.key,
      name: record.citation.title,
      citation: citationLine(record),
      decided: dateOf(record),
      link: `/cases/${record.key}`,
    });
  }
  for (const court of found.values())
    court.cases.sort(
      (first, second) =>
        first.decided.localeCompare(second.decided) ||
        first.name.localeCompare(second.name),
    );
  courtCache = [...found.values()].sort(
    (first, second) =>
      second.opinions.length +
        second.cases.length -
        (first.opinions.length + first.cases.length) ||
      first.name.localeCompare(second.name),
  );
  return courtCache;
}

/** A place on the site that names the court, as "Mentioned on" lists it. */
export interface CourtMention {
  title: string;
  link: string;
  where: string;
}

/** An opinion as the court's page lists it. */
export type CourtOpinion = Pick<
  TribalCourtOpinion,
  | "key"
  | "name"
  | "citation"
  | "decided"
  | "path"
  | "original"
  | "namesReplaced"
  | "topics"
>;

export interface CourtPage {
  key: string;
  name: string;
  kind: string;
  nations: { id: string; name: string }[];
  /** Every opinion's key, so a page drawn again without the opinions a nation hid counts the rest (src/lib/restricted-pages.ts). */
  opinionKeys: string[];
  opinionYears?: { from: string; to: string };
  /** The newest few. */
  opinions: CourtOpinion[];
  /** Where all of them are listed: each nation's table of opinions. */
  opinionLists: { name: string; link: string }[];
  /** Oldest first; for a court with more than shownCaseCount, only its newest that many. */
  cases: CourtCase[];
  caseCount: number;
  caseYears?: { from: string; to: string };
  /** Where every case is listed, when the page lists only the newest. */
  caseList?: string;
  glance: FactGroup[];
  mentions: CourtMention[];
  sources: SourceEntry[];
  stub: Stub;
}

/** The years a list of dates spans, as "1997" or "1997–2017". */
function yearSpan(dates: string[]): { from: string; to: string } | undefined {
  const years = dates
    .map((date) => date.slice(0, 4))
    .filter(Boolean)
    .sort();
  return years.length > 0 ? { from: years[0], to: years.at(-1)! } : undefined;
}

export function courtPage(key: string): CourtPage {
  const court = courts().find((candidate) => candidate.key === key);
  if (!court) error(404, "This site has no page for that court.");
  const uses = new SourceUses();
  const glance: FactGroup[] = [];
  const opinionYears = yearSpan(
    court.opinions.map((opinion) => opinion.decided),
  );
  const caseYears = yearSpan(court.cases.map((entry) => entry.decided));

  uses.part("At a glance");
  const cite = (section: string, text: string): CitationMark[] => {
    const marks: CitationMark[] = [];
    if (court.opinions.length > 0)
      uses.cite(opinionsSourceKey, { section, text }, marks);
    return marks;
  };
  // The page's lead already says the court's kind, how many opinions and
  // cases name it and their years (routes/courts/[court]/+page.svelte), so
  // At a glance keeps only what it does not: the nation, with its source, and
  // the reporters (Trevor chose this on Nov. 26, 2026; src/lib/info-page.ts).
  if (court.nations.length > 0)
    glance.push({
      field: "nation",
      label: court.nations.length === 1 ? "Nation" : "Nations",
      items: court.nations.map((nation) => ({
        text: nation.name,
        link: `/nations/${nation.id}`,
        citations: cite("Nation", nation.name),
      })),
    });
  if (court.opinions.length > 0) {
    const reporters = [
      ...new Set(
        court.opinions
          .map((opinion) => reporterNames[opinion.key.split("/")[1]] ?? "")
          .filter(Boolean),
      ),
    ];
    if (reporters.length > 0)
      glance.push({
        field: "reporter",
        label: reporters.length === 1 ? "Reporter" : "Reporters",
        items: reporters.map((text) => ({
          text,
          citations: cite("Reporter", text),
        })),
      });
  }
  // The nation pages that name the court: in their court opinions, and in the cases each lists.
  const mentions: CourtMention[] = [];
  const opinionLists = court.nations.map((nation) => ({
    name: nation.name,
    link: `/nations/${nation.id}/opinions`,
  }));
  for (const nation of court.nations) {
    mentions.push({
      title: nation.name,
      link: `/nations/${nation.id}#opinions-heading`,
      where: "Nation page, Court opinions",
    });
    mentions.push({
      title: `${nation.name}: court opinions`,
      link: `/nations/${nation.id}/opinions`,
      where: "Nation page, all opinions",
    });
  }
  const caseList =
    court.cases.length > shownCaseCount ? caseLists[court.key] : undefined;
  const nationNames = nationNamesAndKinds();
  const caseNations = new Set(
    court.records.flatMap((record) => record.tribes ?? []),
  );
  for (const id of [...caseNations]
    .filter((nation) => nationNames.has(nation))
    .sort()) {
    mentions.push({
      title: displayName(nationNames.get(id)!.name),
      link: `/nations/${id}#cases-heading`,
      where: "Nation page, Cases involving the nation",
    });
  }

  return {
    key: court.key,
    name: court.name,
    kind: court.kind,
    nations: court.nations,
    opinionKeys: court.opinions.map((opinion) => opinion.key),
    opinionYears,
    opinions: court.opinions
      .slice(0, shownOpinionCount)
      .map(
        ({
          key,
          name,
          citation,
          decided,
          path,
          original,
          namesReplaced,
          topics,
        }) => ({
          key,
          name,
          citation,
          decided,
          path,
          original,
          namesReplaced,
          topics,
        }),
      ),
    opinionLists,
    cases: caseList ? court.cases.slice(-shownCaseCount) : court.cases,
    caseCount: court.cases.length,
    caseYears,
    caseList,
    glance,
    mentions,
    sources: uses.list,
    stub: { kind: "court", record: `courts/${court.key}` },
  };
}

/** A row of the list of courts. */
export interface CourtListing {
  key: string;
  name: string;
  kind: string;
  nations: string;
  opinions: number;
  cases: number;
}

export function courtListings(): CourtListing[] {
  return courts().map((court) => ({
    key: court.key,
    name: court.name,
    kind: court.kind,
    nations: court.nations.map((nation) => nation.name).join("; "),
    opinions: court.opinions.length,
    cases: court.cases.length,
  }));
}
