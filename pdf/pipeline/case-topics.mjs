// The index of cases by topic, built from the Topics part of each case box
// ("::: topics" with "Gaming; Sovereign immunity"), so it never needs to be
// kept by hand (Trevor, Nov. 22, 2026). A back matter page whose front
// matter says "generated: cases-by-topic" prints its own text and then this
// list. Mirrors site/src/lib/essays/case-topics.ts, which builds the same
// list for the website.

/** The topics a Topics part names, separated by semicolons. */
export function topicsIn(text) {
  return [...new Set(text.split(";").map((topic) => topic.replace(/\s+/g, " ").trim().replace(/\.$/, "")).filter(Boolean))];
}

/** The case boxes in an essay that have a Topics part, in the order they come. */
export function taggedCases(text) {
  const found = [];
  let box = null;
  let topicLines = null;
  for (const line of text.split("\n")) {
    const opening = /^(:{4,})\s*case\s+([a-z0-9]+(?:-[a-z0-9]+)*)\s*$/.exec(line);
    if (!box && opening) {
      box = { key: opening[2], fence: opening[1].length };
      continue;
    }
    if (!box) continue;
    if (topicLines) {
      if (/^:{3}\s*$/.test(line)) {
        const topics = topicsIn(topicLines.join(" "));
        if (topics.length) found.push({ key: box.key, topics });
        topicLines = null;
      } else topicLines.push(line);
      continue;
    }
    if (/^:{3}\s*topics\s*$/.test(line)) topicLines = [];
    else if (new RegExp(`^:{${box.fence}}\\s*$`).test(line)) box = null;
  }
  return found;
}

function compareDates(first, second) {
  for (let index = 0; index < 3; index += 1) {
    const difference = (first[index] ?? 0) - (second[index] ?? 0);
    if (difference) return difference;
  }
  return 0;
}

/**
 * The index as Markdown: one paragraph for each topic, in alphabetical
 * order, naming its cases from the oldest, each linked to its box
 * ("#case-<key>"). A case without a source record is left out.
 */
export function casesByTopicMarkdown(cases, name) {
  const byTopic = new Map();
  for (const { key, topics } of cases) {
    for (const topic of topics) {
      const id = topic.toLowerCase();
      if (!byTopic.has(id)) byTopic.set(id, { label: topic, keys: new Set() });
      byTopic.get(id).keys.add(key);
    }
  }
  const paragraphs = [];
  for (const { label, keys } of [...byTopic.values()].sort((first, second) => first.label.localeCompare(second.label, "en", { sensitivity: "base" }))) {
    const entries = [...keys]
      .map((key) => ({ key, name: name(key) }))
      .filter((entry) => entry.name !== undefined)
      .sort((first, second) => compareDates(first.name.date, second.name.date) || first.name.title.localeCompare(second.name.title))
      .map(({ key, name }) => `[*${name.title}*${name.date[0] ? ` (${name.date[0]})` : ""}](#case-${key})`);
    if (entries.length) paragraphs.push(`**${label}.** ${entries.join("; ")}.`);
  }
  return paragraphs.join("\n\n");
}

/** A case's name and decision date from its source record, or undefined. */
export function caseNameFrom(record) {
  const citation = record?.citation;
  if (!citation || citation.type !== "legal_case" || !citation.title) return undefined;
  return { title: citation.title, date: citation.issued?.["date-parts"]?.[0] ?? [] };
}
