"""One-off (Nov. 23, 2026): set the status of each gaming compact that Secretarial Procedures replaced, from the procedures' text and the last extension's Federal Register notice.

    python3 scripts/gaming/set_replaced_compact_status.py .

Compacts whose procedures make prior compacts "null and void" on their effective date, and whose term had not run out by then, are superseded on that date; the rest expired at the end of the term their last extension set. Already applied; rerunning gives the same records."""
import pathlib, sys, yaml

FR = {
    "2022-14054": "87 Fed. Reg. 39115 (June 30, 2022)",
    "2023-28198": "88 Fed. Reg. 88640 (Dec. 22, 2023)",
    "2023-28711": "88 Fed. Reg. 89723 (Dec. 28, 2023)",
    "2024-21562": "89 Fed. Reg. 77169 (Sept. 20, 2024)",
    "2025-02848": "90 Fed. Reg. 9973 (Feb. 20, 2025)",
}
READABLE = {"2023-12-31": "Dec. 31, 2023", "2024-12-31": "Dec. 31, 2024", "2025-12-31": "Dec. 31, 2025"}
# nation slug: (status, ended, basis)
EXPIRED = {
    "alturas-indian-rancheria": ("2024-12-31", "2024-21562", None),
    "augustine-band-of-cahuilla-indians": ("2025-12-31", "2025-02848", None),
    "berry-creek-rancheria-of-maidu-indians-of-california": ("2024-12-31", "2023-28711", "Sec. 15.2"),
    "pauma-band-of-luiseno-mission-indians-of-the-pauma-and-yuima-reservation": ("2024-12-31", "2023-28198", "Sec. 15.2"),
    "blue-lake-rancheria": ("2023-12-31", "2022-14054", "Sec. 17.2"),
    "chemehuevi-indian-tribe-of-the-chemehuevi-reservation": ("2023-12-31", "2022-14054", "Sec. 17.2"),
    "chicken-ranch-rancheria-of-me-wuk-indians-of-california": ("2023-12-31", "2022-14054", "Sec. 17.2"),
    "hopland-band-of-pomo-indians": ("2023-12-31", "2022-14054", "Sec. 17.2"),
    "robinson-rancheria": ("2023-12-31", "2022-14054", "Sec. 17.2"),
}
SUPERSEDED = {
    "bear-river-band-of-the-rohnerville-rancheria": "Sec. 16.2",
    "cachil-dehe-band-of-wintun-indians-of-the-colusa-indian-community-of-the-colusa-rancheria": "Sec. 16.2",
    "cahuilla-band-of-indians": "Sec. 16.2",
    "soboba-band-of-luiseno-indians": "Sec. 16.2",
    "bishop-paiute-tribe": "Sec. 16.2",
    "pit-river-tribe": "Sec. 16.2",
    "rincon-band-of-luiseno-indians": "Sec. 15.6",
    "northfork-rancheria-of-mono-indians-of-california": "Sec. 18.2",
}
LAW = "25 U.S.C. § 2710(d)(7)(B)(vii)"


def readable(date):
    import datetime
    d = datetime.date.fromisoformat(date)
    month = d.strftime("%b.") if d.month not in (5, 6, 7) else d.strftime("%B")
    month = {"Sep.": "Sept."}.get(month, month)
    return f"{month} {d.day}, {d.year}"


def dump(path, record):
    path.write_text(yaml.safe_dump(record, sort_keys=False, allow_unicode=True, width=110), encoding="utf-8")


root = pathlib.Path(sys.argv[1])
done = []
for path in sorted(root.glob("content/documents/*/*-gaming-compact.yaml")):
    record = yaml.safe_load(path.read_text(encoding="utf-8"))
    related = [r for r in record.get("related", []) if r["relation"] == "replaced-by"]
    if not related:
        continue
    nation = record["nations"][0]
    procedures_path = root / "content/documents" / related[0]["document"][0] / f"{related[0]['document']}.yaml"
    procedures = yaml.safe_load(procedures_path.read_text(encoding="utf-8"))
    issued = procedures["versions"][0]["dates"]["listed"]
    live = [v for v in record["versions"] if v["status"] not in ("disapproved", "withdrawn")]
    if nation in EXPIRED:
        ended, notice, clause = EXPIRED[nation]
        for version in live:
            version["status"] = "expired"
            version.setdefault("dates", {})["ended"] = ended
        last = live[-1]
        last["note"] = (f"The compact's term ran to {READABLE[ended]}, the date this extension set "
                        f"({FR[notice]}); no later extension was found on the Office of Indian Gaming list or in the "
                        "Federal Register.")
        if ended == "2023-12-31":
            last["note"] += (" The Secretarial Procedures say only that the term was extended to Dec. 31, 2023, so an "
                             "unlisted later extension is possible; if there was one, the procedures' "
                             f"{clause} ended the compact on {readable(issued)}.")
            for version in live:
                version["confidence"] = "medium"
        related[0]["note"] = (f"Secretarial Procedures prescribed under {LAW} on {readable(issued)} authorize the "
                              "nation's Class III gaming in place of the compact"
                              + (f" ({clause} of the procedures makes any prior compact null and void)." if clause
                                 else "."))
        if nation == "augustine-band-of-cahuilla-indians":
            related[0]["note"] = (f"Secretarial Procedures prescribed under {LAW} on {readable(issued)} authorize the "
                                  "nation's Class III gaming; they do not end the compact, which ran to the end of its "
                                  "extended term.")
    elif nation in SUPERSEDED:
        clause = SUPERSEDED[nation]
        for version in live:
            version["status"] = "superseded"
            version.setdefault("dates", {})["ended"] = issued
        related[0]["note"] = (f"Secretarial Procedures prescribed under {LAW} took effect on {readable(issued)}, and "
                              f"their {clause} made every prior Tribal-State compact null and void that day.")
    else:
        sys.exit(f"no rule for {nation}")
    dump(path, record)
    done.append((nation, live[0]["status"]))
for row in done:
    print(*row)
print(len(done))
