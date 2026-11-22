# Brief: find each nation in the child welfare agent notice

The Federal Register notice "Indian Child Welfare Act; Designated Tribal Agents for Service of Notice", 91 Fed. Reg. 30,667 (May 26, 2026), prints its list of Tribes as page images. `scripts/review/second_gap_review.py gather` saved the images and their Tesseract OCR text (`icwa/pages/p-NNN.png` and `.txt`); OCR wraps long Tribe names over several lines, so search by distinctive words.

Input: `icwa/review-items.json`, the profiles whose listed name the OCR text did not settle, and federally recognized profiles with no child welfare fact. Each has a profile id, the nation's official name, and the name the dataset says the notice lists it as (`listed_as`), or null.

For each item, find the row for that nation: search the OCR text first, then open the page image to confirm what the first column says. Component bands or villages may be listed under the umbrella nation or separately; former names and "aka" forms are common.

Output: `icwa/icwa-verdicts.json`, one object per item: `profile`; `verdict` (`listed`, `listed-under-another-name`, `not-found`, `cannot-tell`); `page` (image file, or null); `name_in_notice` (first-column text exactly as printed, or null); `reason` (one or two sentences).

Do not guess: if the image is unclear, say `cannot-tell`. Do not copy agents' personal names, telephone numbers or email addresses; only the Tribe name column.
