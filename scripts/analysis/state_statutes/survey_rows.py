"""The fifty-state survey table for the state statutes study (Nov. 26, 2026). Run: python3 -I survey_rows.py NATIONS_JSON OUT.csv

Columns: official source and its format, any bulk file or API, whether a cloud script reached it on Nov. 26, 2026, terms and copyright notes,
a difficulty rating (1 easiest to 5 hardest) and an estimated count of Indian law sections. "probed" in the basis column means a script fetched
the page on Nov. 26, 2026; "memory" means the fact is from prior knowledge and was not checked in this study.
"""
import csv, json, sys

# Estimated Indian law sections (core + incidental), as a range, from four anchor states (see the note, section 5):
# Oklahoma 381 (counted and read), Washington (keyword count), Oregon (keyword count, Nov. 26 study), Florida (keyword count).
BANDS = {'heavy': (400, 1000), 'high': (200, 450), 'medium': (100, 250), 'light': (40, 120)}
# Anchor states replace their band with the measured figure: Oklahoma counted and read (381 sections); Washington, Oregon and Florida from keyword
# counts converted with Oklahoma's rates (93% of strong-term hits relevant; at most 16% of weak-term-only hits).
MEASURED = {'OK': (381, 381), 'WA': (904, 1059), 'OR': (500, 600), 'FL': (70, 100)}
ROWS = [
 # state, band, official source, format, bulk/API, reached, terms/copyright, difficulty, basis
 ('AL', 'light', 'Alabama Legislature, ALISON (alison.legislature.state.al.us/code-of-alabama)', 'HTML, JavaScript app', 'None found', 'yes', 'Site copyright notice only', 3, 'probed'),
 ('AK', 'heavy', 'Alaska Legislature, akleg.gov/basis/statutes.asp', 'HTML by title and chapter', 'None found', 'yes', 'None found on the page', 2, 'probed'),
 ('AZ', 'heavy', 'Arizona Legislature, azleg.gov/arstitle/', 'HTML, one page per section', 'None found', 'yes', 'Site copyright notice ("All Rights Reserved") only', 2, 'probed'),
 ('AR', 'light', 'LexisNexis free public site for the Arkansas Code (linked from arkleg.state.ar.us)', 'JavaScript app', 'None; Public.Resource.Org holds a 2012 XML copy', 'shell only', 'Publisher-hosted under Lexis terms of use; Public.Resource.Org correspondence posted', 5, 'probed; memory for terms'),
 ('CA', 'heavy', 'California Legislative Information, leginfo.legislature.ca.gov', 'HTML per section; bulk database dump', 'Yes: pubinfo zip files at downloads.leginfo.legislature.ca.gov (2025 file 1.2 GB, daily updates)', 'site 403; bulk yes', 'None found on the download page', 2, 'probed'),
 ('CO', 'medium', 'Colorado General Assembly, leg.colorado.gov/laws/colorado-revised-statutes', 'PDF by title; Lexis free site too', 'None found', 'yes', 'Public.Resource.Org correspondence posted (2013); state claimed rights in the compilation (memory)', 3, 'probed; memory for terms'),
 ('CT', 'medium', 'Connecticut General Assembly, cga.ct.gov/current/pub/titles.htm', 'HTML by chapter (memory)', 'None known', 'no (TLS failure)', 'Not checked', 2, 'probed (failed); memory'),
 ('DE', 'light', 'Delaware Code Online, delcode.delaware.gov', 'HTML by chapter; PDF by title', 'Title PDFs', 'yes', 'None found on the page', 1, 'probed'),
 ('FL', 'medium', 'Online Sunshine, leg.state.fl.us/statutes', 'HTML, whole-chapter pages', 'Yes, but a Windows viewer package (FLLawDL2026.zip, 251 MB, NXT infobase format)', 'yes', 'Site copyright notice (The Florida Legislature)', 2, 'probed; counted'),
 ('GA', 'light', 'LexisNexis free public site for the Official Code of Georgia Annotated (linked from legis.ga.gov)', 'JavaScript app', 'None; Public.Resource.Org published the annotated code', 'shell only', 'Annotations held not copyrightable in Georgia v. Public.Resource.Org (2020); site under Lexis terms', 5, 'probed; case'),
 ('HI', 'light', 'Hawaii State Legislature, capitol.hawaii.gov/hrscurrent', 'HTML, one page per section (memory)', 'Folder listings (memory)', 'no (403)', 'Not checked', 3, 'probed (failed); memory'),
 ('ID', 'medium', 'Idaho Legislature, legislature.idaho.gov/statutesrules/idstat/', 'HTML by title, chapter and section', 'None found', 'yes', 'Public.Resource.Org correspondence posted (2013); state asserted copyright then (memory)', 2, 'probed; memory for terms'),
 ('IL', 'medium', 'Illinois General Assembly, ilga.gov/legislation/ilcs', 'HTML by Act (memory)', 'None known', 'no (connection reset)', 'Not checked', 3, 'probed (failed); memory'),
 ('IN', 'light', 'Indiana General Assembly, iga.in.gov', 'JavaScript app; PDF of the whole code by year (memory)', 'API with a key (memory)', 'shell only', 'Not checked', 3, 'probed; memory'),
 ('IA', 'light', 'Iowa Legislature, legis.iowa.gov/law/iowaCode', 'PDF and RTF by chapter and section', 'None for the Code (the downloads page holds a Word template)', 'yes', 'Site copyright notice only', 2, 'probed'),
 ('KS', 'medium', 'Kansas Office of Revisor of Statutes, ksrevisor.gov', 'HTML, one page per section', 'None found', 'yes', 'None found on the page', 2, 'probed'),
 ('KY', 'light', 'Kentucky Legislative Research Commission, apps.legislature.ky.gov/law/statutes', 'PDF, one file per section', 'None found', 'yes', 'Site copyright notice only', 3, 'probed'),
 ('LA', 'medium', 'Louisiana State Legislature, legis.la.gov', 'HTML, one page per section, addressed by an internal document number', 'None found', 'yes', 'None found on the page', 3, 'probed'),
 ('ME', 'medium', 'Maine Legislature, legislature.maine.gov/statutes', 'HTML and PDF by title, chapter and section', 'None found', 'yes', 'None found on the page', 2, 'probed'),
 ('MD', 'light', 'Maryland General Assembly, mgaleg.maryland.gov', 'HTML, one page per section', 'JSON lists for bills, not statutes', 'yes', 'None found on the page', 2, 'probed'),
 ('MA', 'light', 'Massachusetts Legislature, malegislature.gov/Laws/GeneralLaws', 'HTML by chapter and section', 'None found', 'yes', 'Site copyright notice only', 2, 'probed'),
 ('MI', 'high', 'Michigan Legislature, legislature.mi.gov', 'HTML by Act and section', 'RSS of updates to the compiled laws', 'yes', 'None found on the page', 3, 'probed'),
 ('MN', 'high', 'Minnesota Revisor of Statutes, revisor.mn.gov/statutes', 'HTML by chapter and section', 'None found', 'yes', 'Revisor registered copyright in headings, numbering and history notes, not statute text (Copyright Office Review Board, 2017)', 2, 'probed; document'),
 ('MS', 'light', 'LexisNexis free public site for the Mississippi Code', 'JavaScript app', 'None', 'shell only', 'Publisher-hosted under Lexis terms; state claimed copyright (Public.Resource.Org correspondence, 2013)', 5, 'probed; document'),
 ('MO', 'light', 'Missouri Revisor of Statutes, revisor.mo.gov', 'HTML, one page per section', 'None found', 'yes', 'Site copyright notice ("all rights reserved")', 2, 'probed'),
 ('MT', 'heavy', 'Montana Legislature, mca.legmt.gov', 'Static HTML by title, chapter, part and section', 'None found', 'yes', 'None found on the page', 1, 'probed'),
 ('NE', 'medium', 'Nebraska Legislature, nebraskalegislature.gov/laws', 'HTML by chapter and section; chapter pages list every section', 'None found', 'yes', 'Site copyright notice only', 2, 'probed'),
 ('NV', 'high', 'Nevada Legislature, leg.state.nv.us/nrs', 'HTML, whole-chapter pages', 'None found', 'yes', 'None found on the page', 1, 'probed'),
 ('NH', 'light', 'New Hampshire General Court, gc.nh.gov/rsa', 'HTML by chapter and section (memory)', 'None known', 'no (connection reset)', 'Not checked', 2, 'probed (failed); memory'),
 ('NJ', 'light', 'New Jersey Legislature, lis.njleg.state.nj.us', 'Folio gateway (dynamic HTML)', 'Not found in this study', 'yes', 'None found on the page', 4, 'probed'),
 ('NM', 'heavy', 'New Mexico Compilation Commission, NMOneSource (nmonesource.com)', 'HTML items with internal numbers', 'None found', 'yes', 'Official compilation published by the Commission; its terms not read in this study', 3, 'probed'),
 ('NY', 'high', 'New York State Senate, Open Legislation (legislation.nysenate.gov)', 'JSON API (laws, articles, sections)', 'Yes: REST API with a free key', 'yes (401 without key)', 'None found', 1, 'probed'),
 ('NC', 'medium', 'North Carolina General Assembly, ncleg.gov', 'HTML and PDF, whole-chapter files', 'Chapter files', 'yes', 'None found on the page', 1, 'probed'),
 ('ND', 'high', 'North Dakota Legislative Branch, ndlegis.gov (Century Code)', 'PDF, one file per chapter', 'Chapter PDFs', 'yes', 'None found on the page', 2, 'probed'),
 ('OH', 'light', 'Ohio Legislative Service Commission, codes.ohio.gov', 'HTML, one page per section', 'None found', 'yes', 'None found on the page', 2, 'probed'),
 ('OK', 'heavy', 'Oklahoma Legislative Service Bureau, oklegislature.gov (OSCN blocks scripts)', 'PDF, one file per title (89 files, 145 MB)', 'Title PDFs', 'yes (OSCN no)', 'None on the page; official publisher is the Secretary of State (75 O.S. § 31.2)', 1, 'probed; counted'),
 ('OR', 'heavy', 'Oregon State Legislature, oregonlegislature.gov/bills_laws/ors', 'HTML, whole-chapter pages', 'Chapter pages', 'yes', 'State claimed copyright in 2008 and withdrew it (memory); Public.Resource.Org folder posted', 1, 'probed; counted'),
 ('PA', 'light', 'Pennsylvania General Assembly, palegis.us/statutes', 'HTML by title (Consolidated Statutes only)', 'None found', 'yes', 'None found; much law is still unconsolidated (memory)', 4, 'probed; memory'),
 ('RI', 'light', 'Rhode Island General Assembly, webserver.rilegislature.gov/Statutes', 'Static HTML by title, chapter and section', 'None found', 'yes', 'None found on the page', 1, 'probed'),
 ('SC', 'light', 'South Carolina Legislature, scstatehouse.gov/code', 'HTML, whole-title and chapter pages', 'None found', 'yes', 'None found on the page', 1, 'probed'),
 ('SD', 'heavy', 'South Dakota Legislature, sdlegislature.gov/Statutes', 'JavaScript app over a JSON API', 'API (sdlegislature.gov/api/Statutes/...)', 'yes', 'None found on the page', 2, 'probed'),
 ('TN', 'light', 'LexisNexis free public site for the Tennessee Code', 'JavaScript app', 'None', 'shell only', 'Publisher-hosted under Lexis terms; Public.Resource.Org sued over access (2022)', 5, 'probed; document'),
 ('TX', 'medium', 'Texas Legislative Council, statutes.capitol.texas.gov', 'JavaScript app; downloads per code in HTML, PDF and Word', 'Downloads page (file links not resolved by script)', 'yes', 'None found on the page', 2, 'probed'),
 ('UT', 'medium', 'Utah Legislature, le.utah.gov/xcode', 'HTML by title, chapter and section', 'None found', 'yes', 'Site terms of use link', 2, 'probed'),
 ('VT', 'light', 'Vermont General Assembly, legislature.vermont.gov/statutes', 'HTML by title, chapter and section', 'None found', 'yes', 'Site copyright notice only', 2, 'probed'),
 ('VA', 'light', 'Virginia Division of Legislative Automated Systems, law.lis.virginia.gov', 'HTML; REST API in JSON and XML; CSV and PDF library', 'Yes: web services and downloads', 'yes', 'Publisher (Michie) annotations and revisor notes excluded from the site as copyrighted', 1, 'probed'),
 ('WA', 'heavy', 'Washington State Legislature, app.leg.wa.gov/rcw', 'HTML, whole-chapter pages; bulk file share', 'Yes: lawfilesext.leg.wa.gov/law/RCW (a file per section)', 'yes', 'Site copyright notice only', 1, 'probed; counted'),
 ('WV', 'light', 'West Virginia Legislature, code.wvlegislature.gov', 'HTML (memory)', 'None known', 'no (connection reset)', 'Not checked', 2, 'probed (failed); memory'),
 ('WI', 'high', 'Wisconsin Legislature, docs.legis.wisconsin.gov/statutes', 'HTML and PDF by chapter (memory)', 'None known', 'no (connection reset)', 'Not checked', 2, 'probed (failed); memory'),
 ('WY', 'medium', 'Wyoming Legislature, wyoleg.gov (statutes download page)', 'JavaScript app; title downloads (memory)', 'Download page (not resolved by script)', 'shell only', 'Not checked', 3, 'probed; memory'),
]


def main(nations_json, out):
    fed = json.load(open(nations_json))['federal']
    tot = [0, 0]
    with open(out, 'w', newline='') as f:
        w = csv.writer(f)
        w.writerow(['state', 'federally_recognized_nations', 'estimate_band', 'estimated_sections_low', 'estimated_sections_high', 'official_source', 'format', 'bulk_or_api', 'reached_from_cloud_2026_11_26', 'terms_and_copyright', 'difficulty_1_to_5', 'basis'])
        for st, band, src, fmt, bulk, reached, terms, diff, basis in ROWS:
            lo, hi = MEASURED.get(st, BANDS[band])
            band = 'measured' if st in MEASURED else band
            tot[0] += lo; tot[1] += hi
            w.writerow([st, fed.get(st, 0), band, lo, hi, src, fmt, bulk, reached, terms, diff, basis])
    print('states', len(ROWS), 'total', tot)


if __name__ == '__main__':
    main(*sys.argv[1:])
