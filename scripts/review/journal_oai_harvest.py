#!/usr/bin/env python3
"""Harvest the catalog of open-access Indian law journals for the journal sweep.

Reads each journal's public OAI-PMH feed (the catalog that bepress Digital
Commons repositories publish for harvesters) and writes one JSON list of
records: title, authors, date, keywords, abstract and landing page. It reads
catalog data only and downloads no articles. The repositories put their PDFs
behind a bot check, and this script does not try to get past it; a person
saves the PDFs from the pull list instead.

Used by the sweep of Nov. 23, 2026
(research/sessions/2026/2026-11-23-indian-law-journals.md). Each later pass
can rerun it and compare titles against content/sources/.

Usage:
  python3 scripts/review/journal_oai_harvest.py OUT.json \
      "https://digitalcommons.law.ou.edu|ailr" \
      "https://digitalrepository.unm.edu|tlj" \
      "https://digitalrepository.unm.edu|tlj_tribalprofiles" \
      "https://digitalrepository.unm.edu|law_certificate_indianlaw_santaclara" \
      "https://digitalcommons.law.seattleu.edu|ailj"
"""

import json
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

NS = {"oai": "http://www.openarchives.org/OAI/2.0/"}
USER_AGENT = "model-tribal-adr-code research (python-urllib)"


def fetch(url: str) -> bytes:
    for attempt in range(4):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            return urllib.request.urlopen(request, timeout=60).read()
        except OSError as error:
            print(f"retrying after {error}", file=sys.stderr)
            time.sleep(5 * (attempt + 1))
    sys.exit(f"could not fetch {url}")


def harvest(base: str, set_name: str) -> list[dict]:
    records = []
    url = f"{base}/do/oai/?verb=ListRecords&metadataPrefix=dcq&set=publication:{set_name}"
    while url:
        root = ET.fromstring(fetch(url))
        for record in root.iter(f"{{{NS['oai']}}}record"):
            metadata = record.find("oai:metadata", NS)
            if metadata is None:
                continue
            item = {"set": set_name, "oai": record.find("oai:header/oai:identifier", NS).text}
            for element in metadata.iter():
                tag = element.tag.split("}")[-1]
                if element.text and element.text.strip() and tag not in ("dc", "metadata"):
                    item.setdefault(tag, []).append(element.text.strip())
            records.append(item)
        token = root.find(".//oai:resumptionToken", NS)
        url = (f"{base}/do/oai/?verb=ListRecords&resumptionToken={urllib.parse.quote(token.text)}"
               if token is not None and token.text else None)
        print(f"{set_name}: {len(records)}", file=sys.stderr)
    return records


def main() -> None:
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    out = []
    for pair in sys.argv[2:]:
        base, set_name = pair.split("|")
        out.extend(harvest(base, set_name))
    with open(sys.argv[1], "w", encoding="utf-8") as handle:
        json.dump(out, handle, indent=0, ensure_ascii=False)


if __name__ == "__main__":
    main()
