#!/usr/bin/env python3
"""Traces the reservations on the Office of Indian Affairs' 1909 national map into shapes (pilot).

The Office of Indian Affairs printed a "Map showing Indian reservations within the limits of the United States" in at least 23 editions from 1879 to 1914 (research/analyses/2026-11-27-pre-1990-reservation-maps.md). This script works on the 1909 edition, compiled under Commissioner R. G. Valentine, from the National Archives' scan (Record Group 75, Central Map Files 11536 AA; catalog record 655555952), a work of the United States government. On that map a solid brown fill is an "Indian reservation" and a brown band drawn around plain paper is "Opened" land (legend, lower right of the sheet).

Steps, each writing into a work folder:

- `georeference`: finds the printed latitude and longitude lines where they cross, growing out from four crossings read by eye in Washington State, and keeps the crossings that agree with a polyconic projection. Writes gcps.json. The committed copy is research/historic-maps/oia-1909/gcps.json.
- `check-fit`: prints how far the fitted map lands from each crossing, and the error when each crossing is left out of the fit in turn.
- `extract`: picks out the brown fill, turns each patch into a shape (or a point when it is too small to draw), and calls a patch "Opened" when it is mostly a band around paper. Writes shapes-raw.geojson.
- `build`: applies the reading of each patch in this file (NAMES, DROP, SPLITS, ADDED) and writes the layer, research/historic-maps/oia-1909/oia-1909-reservations.geojson, and a review table, research/reviews/2026-11-27-oia-1909-reservations.csv. Every shape is marked Unverified.
- `pictures`: draws the layer over the scan and over the 1990 Census reservation shapes for side-by-side checking.

Where two reservations were printed touching, the patch is one piece of brown. `build` splits it along the line halfway between the matching areas in the Census Bureau's 2020 boundary file (cb_2020_us_aiannh_500k, which includes the Oklahoma Tribal Statistical Areas), and says so on each piece (internal_lines). Those inner lines are not traced from the 1909 map.

Not covered yet: the two inset panels (the Mission reservations of southern California and the Pueblo grants of New Mexico, and northeastern Oklahoma), which have their own scales; and reservations printed as specks too small to pick out by color (a few are added by hand in ADDED).

Needs numpy, opencv-python-headless, pillow, pyproj, pyshp, scipy, shapely, pyyaml.

Usage, from the repository root:
  python3 scripts/maps/oia_1909_reservations.py georeference --scan SCAN.jpg --work DIR
  python3 scripts/maps/oia_1909_reservations.py check-fit --work DIR
  python3 scripts/maps/oia_1909_reservations.py extract --scan SCAN.jpg --work DIR
  python3 scripts/maps/oia_1909_reservations.py build --work DIR --census-2020 DIR
  python3 scripts/maps/oia_1909_reservations.py pictures --scan SCAN.jpg --work DIR --census-1990 DIR
"""
from __future__ import annotations

import argparse
import csv
import json
import shutil
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "research" / "historic-maps" / "oia-1909"
REVIEW = ROOT / "research" / "reviews" / "2026-11-27-oia-1909-reservations.csv"
SCAN_URL = "https://catalog.archives.gov/id/655555952"
SOURCE = "Office of Indian Affairs, Map showing Indian reservations within the limits of the United States (1909), National Archives, Record Group 75, Central Map Files 11536 AA"

# Four graticule crossings read by eye on the scan (longitude, latitude) -> (x, y) pixels.
SEEDS = {(-129, 47): (1090, 880), (-127, 47): (1494, 1044), (-125, 47): (1900, 1210), (-129, 45): (829, 1533)}
# Pixel boxes (x0, y0, x1, y1) left out of extraction: the two inset panels, the legend, the title. Only the map inside the neatline is read.
SKIP = [(650, 6350, 2660, 9400), (2640, 7450, 3920, 9400), (9050, 8950, 10000, 9500), (13350, 6500, 15200, 8300)]
NEATLINE = (840, 690, 15130, 9230)
# A patch smaller than this (in scan pixels, about 0.25 square kilometers each) is drawn as a point: at this size the printed fill is mostly the agency or school symbol on top of it.
POINT_BELOW = 2500

# Reading of each extracted patch, by its number in shapes-raw.geojson.
# name: as printed on the 1909 map when name_source is "label"; otherwise the nearest 1990 Census reservation, offered as a suggestion.
# nations: suggested nation records (content/tribes), to be checked.
L, O = "label", "1990 overlap"
NAMES = {
    1: ("Makah", L, ["makah-indian-tribe-of-the-makah-indian-reservation"]),
    2: ("Lummi", L, ["lummi-tribe-of-the-lummi-reservation"]),
    6: ("Tulalip", L, ["tulalip-tribes-of-washington"]),
    9: ("Quinaielt", L, ["quinault-indian-nation"]),
    11: ("Skokomish", L, ["skokomish-indian-tribe"]),
    15: ("Blackfeet", L, ["blackfeet-tribe-of-the-blackfeet-indian-reservation-of-montana"]),
    17: ("Puyallup", L, ["puyallup-tribe-of-the-puyallup-reservation"]),
    19: ("Coeur d'Alene", L, ["coeur-dalene-tribe"]),
    20: ("Flathead", L, ["confederated-salish-and-kootenai-tribes-of-the-flathead-reservation"]),
    21: ("Fort Belknap", L, ["fort-belknap-indian-community-of-the-fort-belknap-reservation-of-montana"]),
    22: ("Yakima", L, ["confederated-tribes-and-bands-of-the-yakama-nation"]),
    23: ("Fort Peck", L, ["assiniboine-and-sioux-tribes-of-the-fort-peck-indian-reservation"]),
    25: ("Turtle Mountain", L, ["turtle-mountain-band-of-chippewa-indians-of-north-dakota"]),
    26: ("Grand Portage", L, ["grand-portage-band"]),
    28: ("Nez Perce", L, ["nez-perce-tribe"]),
    29: ("Grand Ronde", L, ["confederated-tribes-of-the-grand-ronde-community-of-oregon"]),
    30: ("Red Lake", L, ["red-lake-band-of-chippewa-indians"]),
    31: ("Siletz", O, ["confederated-tribes-of-siletz-indians-of-oregon"]),
    32: ("Fort Berthold", L, ["three-affiliated-tribes-of-the-fort-berthold-reservation"]),
    33: ("Bois Fort", L, ["bois-forte-band"]),
    34: ("Devils Lake", L, ["spirit-lake-tribe"]),
    35: ("Devils Lake", L, ["spirit-lake-tribe"]),
    36: ("Deer Creek", L, ["bois-forte-band"]),
    37: ("Vermillion Lake", L, ["bois-forte-band"]),
    38: ("Umatilla", L, ["confederated-tribes-of-the-umatilla-indian-reservation"]),
    39: ("Umatilla", O, ["confederated-tribes-of-the-umatilla-indian-reservation"]),
    40: ("Winnibigoshish", L, ["leech-lake-band"]),
    41: ("Winnibigoshish", L, ["leech-lake-band"]),
    42: ("Warm Springs", L, ["confederated-tribes-of-the-warm-springs-reservation-of-oregon"]),
    43: ("White Earth", L, ["white-earth-band"]),
    44: ("Leech Lake", L, ["leech-lake-band"]),
    45: ("Leech Lake", L, ["leech-lake-band"]),
    46: ("Bay Mills", L, ["bay-mills-indian-community"]),
    48: ("L'Anse", L, ["keweenaw-bay-indian-community"]),
    49: ("L'Anse", L, ["keweenaw-bay-indian-community"]),
    50: ("St. Regis", L, ["saint-regis-mohawk-tribe"]),
    51: ("Fond du Lac", L, ["fond-du-lac-band"]),
    52: ("La Pointe (Bad River)", L, ["bad-river-band-of-the-lake-superior-tribe-of-chippewa-indians-of-the-bad-river-reservation"]),
    55: ("Mille Lac", L, ["mille-lacs-band"]),
    56: ("Lac du Flambeau", L, ["lac-du-flambeau-band-of-lake-superior-chippewa-indians-of-the-lac-du-flambeau-reservation-of-wisconsin"]),
    57: ("Lac du Flambeau", L, ["lac-du-flambeau-band-of-lake-superior-chippewa-indians-of-the-lac-du-flambeau-reservation-of-wisconsin"]),
    58: ("Lemhi", L, []),
    59: ("Lac Court d'Oreilles", L, ["lac-courte-oreilles-band-of-lake-superior-chippewa-indians-of-wisconsin"]),
    60: ("Lake Traverse (Sisseton)", L, ["sisseton-wahpeton-oyate-of-the-lake-traverse-reservation"]),
    61: ("Lake Traverse (Sisseton)", L, ["sisseton-wahpeton-oyate-of-the-lake-traverse-reservation"]),
    62: ("Klamath", L, ["klamath-tribes"]),
    64: ("Oneida", L, ["oneida-nation"]),
    65: ("Oneida", L, ["oneida-nation"]),
    66: ("Onondaga", L, ["onondaga-nation"]),
    67: ("Hoopa Valley", L, ["hoopa-valley-tribe"]),
    68: ("Tonawanda", L, ["tonawanda-band-of-seneca"]),
    69: ("Wind River", L, ["eastern-shoshone-tribe-of-the-wind-river-reservation", "northern-arapaho-tribe-of-the-wind-river-reservation"]),
    70: ("Wind River", L, ["eastern-shoshone-tribe-of-the-wind-river-reservation", "northern-arapaho-tribe-of-the-wind-river-reservation"]),
    72: ("Fort Hall", L, ["shoshone-bannock-tribes-of-the-fort-hall-reservation"]),
    74: ("Cattaraugus", L, ["seneca-nation-of-indians"]),
    76: ("Oil Spring", L, ["seneca-nation-of-indians"]),
    77: ("Duck Valley", L, ["shoshone-paiute-tribes-of-the-duck-valley-reservation"]),
    78: ("Allegany", L, ["seneca-nation-of-indians"]),
    79: ("Duck Valley", L, ["shoshone-paiute-tribes-of-the-duck-valley-reservation"]),
    85: ("Ponca", L, ["ponca-tribe-of-nebraska"]),
    86: ("Round Valley", L, ["round-valley-indian-tribes-round-valley-reservation"]),
    87: ("Pyramid Lake", L, ["pyramid-lake-paiute-tribe-of-the-pyramid-lake-reservation"]),
    89: ("Uintah and Uncompahgre", L, ["ute-indian-tribe-of-the-uintah-and-ouray-reservation"]),
    90: ("Uintah", L, ["ute-indian-tribe-of-the-uintah-and-ouray-reservation"]),
    91: ("Walker River", L, ["walker-river-paiute-tribe-of-the-walker-river-reservation"]),
    95: ("Pottawatomie", L, ["prairie-band-potawatomi-nation"]),
    97: ("Chippewa and Munsee", L, []),
    101: ("Tule River", L, ["tule-river-indian-tribe-of-the-tule-river-reservation"]),
    103: ("Jicarilla Apache", L, ["jicarilla-apache-nation"]),
    104: ("Walapai", L, ["hualapai-indian-tribe-of-the-hualapai-indian-reservation"]),
    106: ("Taos", O, ["pueblo-of-taos"]),
    107: ("Oto", L, ["otoe-missouria-tribe-of-indians"]),
    110: ("Taos", O, ["pueblo-of-taos"]),
    111: ("Qualla", L, ["eastern-band-of-cherokee-indians"]),
    113: ("San Juan", O, ["ohkay-owingeh"]),
    114: ("Santa Clara", O, ["pueblo-of-santa-clara"]),
    119: ("Jemez", O, ["pueblo-of-jemez"]),
    120: ("Cochiti", O, ["pueblo-of-cochiti"]),
    121: ("Zia", O, ["pueblo-of-zia"]),
    122: ("Zuni", L, ["zuni-tribe-of-the-zuni-reservation"]),
    124: ("San Manuel", O, ["yuhaaviatam-of-san-manuel-nation"]),
    125: ("Laguna", L, ["pueblo-of-laguna"]),
    126: ("Laguna", L, ["pueblo-of-laguna"]),
    127: ("Colorado River", L, ["colorado-river-indian-tribes-of-the-colorado-river-indian-reservation"]),
    128: ("Isleta", L, ["pueblo-of-isleta"]),
    130: ("Torres-Martinez", O, ["torres-martinez-desert-cahuilla-indians"]),
    131: ("Los Coyotes", O, ["los-coyotes-band-of-cahuilla-and-cupeno-indians"]),
    132: ("Camp McDowell", L, ["fort-mcdowell-yavapai-nation"]),
    134: ("Gila Bend", L, ["tohono-oodham-nation-of-arizona"]),
    135: ("Yuma", L, ["quechan-tribe-of-the-fort-yuma-indian-reservation"]),
    136: ("Mescalero Apache", L, ["mescalero-apache-tribe-of-the-mescalero-reservation"]),
    137: ("Papago (San Xavier)", L, ["tohono-oodham-nation-of-arizona"]),
    148: ("Seminole", L, ["seminole-tribe-of-florida"]),
    # Plain paper closed in by a reservation (numbered after all the patches).
    152: ("Cheyenne River", L, ["cheyenne-river-sioux-tribe-of-the-cheyenne-river-reservation"]),
    153: ("Standing Rock", L, ["standing-rock-sioux-tribe-of-north-and-south-dakota"]),
    154: ("Fort Hall", L, ["shoshone-bannock-tribes-of-the-fort-hall-reservation"]),
    155: ("Rosebud", L, ["rosebud-sioux-tribe-of-the-rosebud-indian-reservation"]),
    157: ("Kickapoo", L, ["kickapoo-tribe-of-oklahoma"]),
    159: ("Iowa", L, ["iowa-tribe-of-oklahoma"]),
}

# Patches that are not reservations, with the reason.
DROP = {}
for n in (3, 18):
    DROP[n] = "speck outside the United States"
for n in (27, 47, 73, 84, 92, 93, 96, 98, 99, 123):
    DROP[n] = "speck of brown with no reservation printed there"
for n in (4, 7, 10, 12, 13, 14):
    DROP[n] = "brown dots by the word Columbia (possibly allotments on the former Columbia (Moses) reservation); not a reservation fill"
for n in (81, 82, 83, 108, 109, 112, 116, 117, 118):
    DROP[n] = "agency or school symbol, not a reservation fill"
for n, keep in ((5, 6), (16, 17), (24, 25), (94, 95), (100, 101)):
    DROP[n] = f"same small reservation as patch {keep}, drawn once as a point"
for n in range(138, 148):
    DROP[n] = "inside the Pueblo grants inset panel, which has its own scale (not placed yet)"
for n in (149, 150, 151):
    DROP[n] = "legend swatch"
# Enclosed paper that is not opened land: the reservation is drawn without the hole.
DROP[156] = "the water of Pyramid Lake, inside the reservation"
for n in (158, 160, 161):
    DROP[n] = "gap left by the large blue numeral 6 written over Oklahoma after printing"

# Patches printed as one piece of brown that hold more than one reservation: (Census 2020 area code, name, name_source, nations).
SPLITS = {
    8: [("0760", "Colville", L, ["confederated-tribes-of-the-colville-reservation"]), ("3940", "Spokane", L, ["spokane-tribe-of-the-spokane-reservation"])],
    53: [("3970", "Standing Rock", L, ["standing-rock-sioux-tribe-of-north-and-south-dakota"]), ("0605", "Cheyenne River", L, ["cheyenne-river-sioux-tribe-of-the-cheyenne-river-reservation"])],
    54: [("0845", "Crow", L, ["crow-tribe-of-montana"]), ("2490", "Northern Cheyenne", L, ["northern-cheyenne-tribe-of-the-northern-cheyenne-indian-reservation"])],
    63: [("2175", "Menominee", L, ["menominee-indian-tribe-of-wisconsin"]), ("4015", "Stockbridge", O, ["stockbridge-munsee-community"])],
    71: [("0855", "Crow Creek", L, ["crow-creek-sioux-tribe-of-the-crow-creek-reservation"]), ("2030", "Lower Brule", L, ["lower-brule-sioux-tribe-of-the-lower-brule-reservation"])],
    75: [("2810", "Pine Ridge", L, ["oglala-sioux-tribe"]), ("3235", "Rosebud", L, ["rosebud-sioux-tribe-of-the-rosebud-indian-reservation"])],
    80: [("4700", "Yankton", L, ["yankton-sioux-tribe-of-south-dakota"]), ("3565", "Santee", O, ["santee-sioux-nation"])],
    88: [("2550", "Omaha", L, ["omaha-tribe-of-nebraska"]), ("4625", "Winnebago", L, ["winnebago-tribe-of-nebraska"])],
    102: [("2430", "Navajo", L, ["navajo-nation"]), ("1505", "Moqui", L, ["hopi-tribe-of-arizona"])],
    105: [
        ("2595", "Osage", L, ["the-osage-nation"]),
        ("5550", "Cherokee", L, ["cherokee-nation", "united-keetoowah-band-of-cherokee-indians-in-oklahoma"]),
        ("5620", "Creek", L, ["the-muscogee-nation"]),
        ("5830", "Seminole", L, ["the-seminole-nation-of-oklahoma"]),
        ("5915", "Creek or Seminole", O, ["the-muscogee-nation", "the-seminole-nation-of-oklahoma"]),
        ("5580", "Chickasaw", L, ["the-chickasaw-nation"]),
        ("5590", "Choctaw", L, ["the-choctaw-nation-of-oklahoma"]),
        ("5820", "Sac and Fox", L, ["sac-and-fox-nation"]),
        ("5670", "Iowa", L, ["iowa-tribe-of-oklahoma"]),
        ("5700", "Kickapoo", L, ["kickapoo-tribe-of-oklahoma"]),
        ("5600", "Pottawatomie and Absentee Shawnee", L, ["citizen-potawatomi-nation", "absentee-shawnee-tribe-of-indians-of-oklahoma"]),
        ("5780", "Pawnee", L, ["pawnee-nation-of-oklahoma"]),
        ("5810", "Quapaw", O, ["quapaw-nation"]),
        ("5835", "Seneca", O, ["seneca-cayuga-nation"]),
        ("5640", "Eastern Shawnee", O, ["eastern-shawnee-tribe-of-oklahoma"]),
        ("5890", "Wyandotte", O, ["wyandotte-nation"]),
        ("5770", "Ottawa", O, ["ottawa-tribe-of-oklahoma"]),
        ("5795", "Peoria", O, ["peoria-tribe-of-indians-of-oklahoma"]),
        ("5730", "Miami", O, ["miami-tribe-of-oklahoma"]),
        ("5970", "Miami or Peoria", O, ["miami-tribe-of-oklahoma", "peoria-tribe-of-indians-of-oklahoma"]),
        ("5740", "Modoc", O, ["modoc-nation"]),
    ],
    115: [
        ("5560", "Cheyenne and Arapaho", L, ["cheyenne-and-arapaho-tribes"]),
        ("5720", "Kiowa and Comanche", L, ["kiowa-tribe", "comanche-nation", "apache-tribe-of-oklahoma", "fort-sill-chiricahua-warm-springs-apache-tribe"]),
        ("5540", "Wichita", L, ["wichita-and-affiliated-tribes", "caddo-nation-of-oklahoma", "delaware-nation"]),
        ("5955", "Kiowa, Comanche, Wichita (shared)", O, ["kiowa-tribe", "comanche-nation", "apache-tribe-of-oklahoma", "wichita-and-affiliated-tribes", "caddo-nation-of-oklahoma", "delaware-nation"]),
    ],
    129: [("1140", "White Mountain (Fort Apache)", L, ["white-mountain-apache-tribe-of-the-fort-apache-reservation"]), ("3355", "San Carlos", L, ["san-carlos-apache-tribe-of-the-san-carlos-reservation"])],
    133: [("1310", "Gila River", L, ["gila-river-indian-community-of-the-gila-river-indian-reservation"]), ("3340", "Salt River", L, ["salt-river-pima-maricopa-indian-community-of-the-salt-river-reservation"])],
}

# Small reservations printed as specks too small to pick out by color, placed by hand at the speck next to the printed name: (name, status, scan x, scan y, nations).
ADDED = [
    ("Swinomish", "Reservation", 2615, 943, ["swinomish-indian-tribal-community"]),
    ("Port Madison", "Reservation", 2537, 1137, ["suquamish-indian-tribe-of-the-port-madison-reservation"]),
    ("Tonkawa", "Opened", 7882, 5620, ["tonkawa-tribe-of-indians-of-oklahoma"]),
    # Added Nov. 27, 2026, from the scan. Where a school or agency symbol covers the speck, the point is the symbol's.
    ("Quileute", "Reservation", 2112, 940, ["quileute-tribe-of-the-quileute-reservation"]),
    ("Hoh River", "Reservation", 2130, 1030, ["hoh-indian-tribe"]),
    ("Shoal Water", "Reservation", 2098, 1378, ["shoalwater-bay-indian-tribe-of-the-shoalwater-bay-indian-reservation"]),
    ("Chehalis", "Reservation", 2255, 1372, ["confederated-tribes-of-the-chehalis-reservation"]),
    ("Squaxin", "Reservation", 2355, 1295, ["squaxin-island-tribe-of-the-squaxin-island-reservation"]),
    ("Nisqually", "Reservation", 2408, 1360, ["nisqually-indian-tribe"]),
    ("Kickapoo", "Reservation", 8304, 4646, ["kickapoo-tribe-of-indians-of-the-kickapoo-reservation-in-kansas"]),
    ("Sac and Fox and Iowa", "Reservation", 8412, 4588, ["sac-and-fox-nation-of-missouri-in-kansas-and-nebraska", "iowa-tribe-of-kansas-and-nebraska"]),
    ("Moapa River", "Reservation", 3418, 5224, ["moapa-band-of-paiute-indians-of-the-moapa-river-indian-reservation"]),
    ("Havasupai", "Reservation", 3880, 5500, ["havasupai-tribe-of-the-havasupai-reservation"]),
    ("Tuscarora", "Reservation", 12180, 3042, ["tuscarora-nation"]),
]
# Looked for and not added: Kaibab, Shivwits and Camp Verde are printed only as school names in lower-case italic, beside a school symbol, not in the capitals the map uses for reservations; Ozette's name is printed but no speck shows beside it.

# ---------------------------------------------------------------- the inset panels
#
# The three inset panels in the lower left of the sheet are drawn at larger scales on the Public Land Survey's township grid, numbered in their margins: "Mission Ind. Res. in California" (San Bernardino Meridian), "Indian Pueblo Grants in New Mexico" (New Mexico Principal Meridian) and "Northeastern Oklahoma" (Indian Meridian). Each is placed from its own grid: `insets` finds the printed township lines, fits them, and pairs the center of each printed township with the center of the same township in the Bureau of Land Management's survey layer (fetched by `fetch-townships`). The pairs are kept in research/historic-maps/oia-1909/inset-gcps.json.
#
# box: the panel's map area in scan pixels (x0, y0, x1, y1). skip: boxes inside it that are not map (another panel, the title). grid: the township lines as first read by eye, E = (x - xe) / dx ranges east of the meridian (negative west) and N = (yn - y) / dy townships north of the base line (negative south); `insets` refines these from the lines themselves.
INSETS = {
    "mission": {"title": "Mission Ind. Res. in California", "box": (845, 6442, 2624, 9385), "skip": [], "state": "CA", "meridian": "27", "grid": (1242, 148.7, 6582, 149.2), "townships": "townships-ca-27.geojson"},
    "pueblo": {"title": "Indian Pueblo Grants in New Mexico", "box": (2652, 7486, 4758, 9384), "skip": [(2640, 7440, 3900, 8425), (2640, 8380, 3480, 8890)], "state": "NM", "meridian": "23", "grid": (3478, 99.87, 10084, 99.76), "townships": "townships-nm-23.geojson"},
    "oklahoma": {"title": "Northeastern Oklahoma", "box": (2652, 7545, 3890, 8228), "skip": [], "state": "OK", "meridian": "17", "grid": (222.8, 148.6, 11777, 148.0), "townships": "townships-ok-17.geojson"},
}
# An inset patch smaller than this (in panel pixels, under about half a square kilometer) is drawn as a point.
INSET_POINT_BELOW = 150
# In the Northeastern Oklahoma panel every reservation is drawn as a brown band around plain paper, the legend's sign for "Opened"; each enclosed piece of paper is one area. The Modoc tract is fenced off from the Shawnee tract by a black line only, so it is cut out by its printed lines: (piece, new piece, box in scan pixels).
INSET_CUTS = [("oklahoma-5", "oklahoma-5-modoc", (3798, 7545, 3890, 7781))]

# Reading of each inset patch, by its number in insets-raw.geojson; names as printed in the panel.
INSET_NAMES = {
    "mission-1": ("San Manuel", L, ["yuhaaviatam-of-san-manuel-nation"]),
    "mission-2": ("29 Palms", L, ["twenty-nine-palms-band-of-mission-indians-of-california"]),
    "mission-3": ("Mission Creek", L, ["mission-creek-reservation"]),
    "mission-4": ("Morongo", L, ["morongo-band-of-mission-indians"]),
    "mission-6": ("Agua Caliente", L, ["agua-caliente-band-of-cahuilla-indians-of-the-agua-caliente-indian-reservation"]),
    "mission-7": ("San Jacinto (Soboba)", L, ["soboba-band-of-luiseno-indians"]),
    "mission-8": ("Cabezon", L, ["cabazon-band-of-cahuilla-indians"]),
    "mission-9": ("Augustin", L, ["augustine-band-of-cahuilla-indians"]),
    "mission-10": ("Ramona", L, ["ramona-band-of-cahuilla"]),
    "mission-11": ("Torros (Martinez)", L, ["torres-martinez-desert-cahuilla-indians"]),
    "mission-12": ("Cahuilla", L, ["cahuilla-band-of-indians"]),
    "mission-13": ("Santa Rosa", L, ["santa-rosa-band-of-cahuilla-indians"]),
    "mission-14": ("Temecula (Pechanga)", L, ["pechanga-band-of-indians"]),
    "mission-15": ("Pala", L, ["pala-band-of-mission-indians"]),
    "mission-16": ("Los Coyotes", L, ["los-coyotes-band-of-cahuilla-and-cupeno-indians"]),
    "mission-17": ("Potrero (La Jolla)", L, ["la-jolla-band-of-luiseno-indians"]),
    "mission-18": ("Rincon", L, ["rincon-band-of-luiseno-indians"]),
    "mission-19": ("San Pasqual", L, ["san-pasqual-band-of-diegueno-mission-indians-of-california"]),
    "mission-20": ("Santa Ysabel", L, ["iipay-nation-of-santa-ysabel"]),
    "mission-21": ("Mesa Grande", L, ["mesa-grande-band-of-diegueno-mission-indians-of-the-mesa-grande-reservation"]),
    "mission-22": ("Inaja", L, ["inaja-band-of-diegueno-mission-indians-of-the-inaja-and-cosmit-reservation"]),
    "mission-23": ("Capitan Grande", L, ["capitan-grande-band-of-diegueno-mission-indians-of-california"]),
    "mission-24": ("Laguna", L, []),
    "mission-25": ("Cuyapipa", L, ["ewiiaapaayp-band-of-kumeyaay-indians"]),
    "mission-27": ("Sycuan", L, ["sycuan-band-of-the-kumeyaay-nation"]),
    "mission-29": ("Manzanita", L, ["manzanita-band-of-diegueno-mission-indians-of-the-manzanita-reservation"]),
    "mission-30": ("La Posta", L, ["la-posta-band-of-diegueno-mission-indians-of-the-la-posta-indian-reservation"]),
    "mission-31": ("Campo", L, ["campo-band-of-diegueno-mission-indians-of-the-campo-indian-reservation"]),
    "pueblo-1": ("Taos", L, ["pueblo-of-taos"]),
    "pueblo-2": ("Picuris", L, ["pueblo-of-picuris"]),
    "pueblo-3": ("San Juan", L, ["ohkay-owingeh"]),
    "pueblo-4": ("Santa Clara", L, ["pueblo-of-santa-clara"]),
    "pueblo-6": ("San Ildefonso", L, ["pueblo-of-san-ildefonso"]),
    "pueblo-9": ("Jemez", L, ["pueblo-of-jemez"]),
    "pueblo-11": ("Pecos", L, ["pueblo-of-jemez"]),
    "pueblo-12": ("Sia", L, ["pueblo-of-zia"]),
    "pueblo-13": ("Santa Ana", L, ["pueblo-of-santa-ana"]),
    "pueblo-15": ("Sandia", L, ["pueblo-of-sandia"]),
    "pueblo-18": ("Acomo", L, ["pueblo-of-acoma"]),
    "pueblo-19": ("Laguna", L, ["pueblo-of-laguna"]),
    "pueblo-22": ("Isleta", L, ["pueblo-of-isleta"]),
    "oklahoma-2": ("Quapaws", L, ["quapaw-nation"]),
    "oklahoma-4": ("Peorias", L, ["peoria-tribe-of-indians-of-oklahoma", "miami-tribe-of-oklahoma"]),
    "oklahoma-5": ("Shawnees", L, ["eastern-shawnee-tribe-of-oklahoma"]),
    "oklahoma-5-modoc": ("Modoc", L, ["modoc-nation"]),
    "oklahoma-6": ("Ottawas", L, ["ottawa-tribe-of-oklahoma"]),
    "oklahoma-7": ("Wyandottes", L, ["wyandotte-nation"]),
    "oklahoma-9": ("Senecas", L, ["seneca-cayuga-nation"]),
}
INSET_NOTES = {
    "pueblo-11": "Pecos Pueblo's people joined Jemez Pueblo in 1838, and Congress merged the two pueblos in 1936 (Act of June 19, 1936, ch. 593, 49 Stat. 1528); the nation is a suggestion to check",
    "mission-24": "printed as Laguna; no nation is suggested yet",
    "oklahoma-4": "the panel prints one tract for the Peorias, with the town of Miami; the Miami lived on the Peoria tract",
}
INSET_DROP = {
    "mission-5": "school symbol (St. Boniface), not a reservation fill",
    "mission-26": "piece of the Sycuan patch cut off by a township line, drawn once with it",
    "mission-28": "school symbol (St. Anthony's), not a reservation fill",
    "mission-32": "speck of brown with no reservation printed there",
    "pueblo-7": "school symbols at Santa Fe, not a reservation fill",
    "pueblo-10": "smear of brown ink along a township line by Cochiti",
    "pueblo-14": "school symbol at Bernalillo, not a reservation fill",
    "pueblo-16": "school symbol by Laguna, not a reservation fill",
    "pueblo-17": "school symbol at Albuquerque, not a reservation fill",
    "pueblo-20": "school symbol at Seama, not a reservation fill",
    "pueblo-21": "school symbol at El Rito, not a reservation fill",
}
# Inset patches printed as one piece of brown that hold more than one grant, split like SPLITS.
INSET_SPLITS = {
    "pueblo-5": [("2990", "Pojoaque", L, ["pueblo-of-pojoaque"]), ("2400", "Nambe", L, ["pueblo-of-nambe"]), ("4170", "Tesucue", L, ["pueblo-of-tesuque"])],
    "pueblo-8": [("0680", "Cochiti", L, ["pueblo-of-cochiti"]), ("3585", "Santo Domingo", L, ["santo-domingo-pueblo"]), ("3400", "San Felipe", L, ["pueblo-of-san-felipe"])],
}
# Specks in the panels too small to pick out by color, placed by hand: (name, status, panel, scan x, scan y, nations).
INSET_ADDED = [
    ("Cosmit", "Reservation", "mission", 1682, 8479, ["inaja-band-of-diegueno-mission-indians-of-the-inaja-and-cosmit-reservation"]),
]
# Main-map patches that a panel draws again at its larger scale: the panel's drawing is used.
for n in (124, 130, 131):
    DROP[n] = "drawn again, larger, in the Mission reservations panel; the panel's shape is used"
for n in (106, 110, 113, 114, 119, 120, 121, 125, 126, 128):
    DROP[n] = "drawn again, larger, in the Pueblo grants panel; the panel's shape is used"
# Pieces of the Oklahoma patch (105) that the Northeastern Oklahoma panel draws: left out of the split, and the panel's shapes are cut out of the patch.
INSET_REPLACES_SPLIT = {105: {"5810", "5835", "5640", "5890", "5770", "5795", "5730", "5970", "5740"}}


# ---------------------------------------------------------------- georeferencing

def _poly(lon0):
    from pyproj import Transformer
    crs = f"+proj=poly +lat_0=40 +lon_0={lon0} +ellps=clrk66 +units=m"
    return Transformer.from_crs("EPSG:4326", crs, always_xy=True), Transformer.from_crs(crs, "EPSG:4326", always_xy=True)


def _terms(u, v):
    return np.c_[np.ones_like(u), u, v, u * u, u * v, v * v, u ** 3, u * u * v, u * v * v, v ** 3]


class MapTransform:
    """Scan pixel <-> longitude/latitude: polyconic projection plus a cubic correction, fitted to the graticule crossings."""

    def __init__(self, gcps_path, exclude=()):
        d = json.loads(Path(gcps_path).read_text())
        pts = [p for p in d["points"] if (p["lon"], p["lat"]) not in exclude]
        self.fwd, self.inv = _poly(d["lon0"])
        ll = np.array([[p["lon"], p["lat"]] for p in pts])
        px = np.array([[p["x"], p["y"]] for p in pts])
        X, Y = self.fwd.transform(ll[:, 0], ll[:, 1])
        XY = np.c_[X, Y]
        self.pts, self.px = pts, px
        self.pm, self.ps = px.mean(0), px.std(0)
        self.Xm, self.Xs = XY.mean(0), XY.std(0)
        self.ci = self._fit(px, XY, self.pm, self.ps, self.Xm, self.Xs)
        self.cf = self._fit(XY, px, self.Xm, self.Xs, self.pm, self.ps)

    @staticmethod
    def _fit(a, b, am, as_, bm, bs):
        u = (a - am) / as_
        T = _terms(u[:, 0], u[:, 1])
        bb = (b - bm) / bs
        return [np.linalg.lstsq(T, bb[:, k], rcond=None)[0] for k in range(2)]

    def pixel_to_lonlat(self, x, y):
        u = (np.c_[x, y] - self.pm) / self.ps
        T = _terms(u[:, 0], u[:, 1])
        return self.inv.transform((T @ self.ci[0]) * self.Xs[0] + self.Xm[0], (T @ self.ci[1]) * self.Xs[1] + self.Xm[1])

    def lonlat_to_pixel(self, lon, lat):
        X, Y = self.fwd.transform(lon, lat)
        u = (np.c_[X, Y] - self.Xm) / self.Xs
        T = _terms(u[:, 0], u[:, 1])
        return (T @ self.cf[0]) * self.ps[0] + self.pm[0], (T @ self.cf[1]) * self.ps[1] + self.pm[1]


def _load_scan(path):
    from PIL import Image
    Image.MAX_IMAGE_PIXELS = None
    return np.array(Image.open(path).convert("RGB"))


def georeference(args):
    import cv2
    im = _load_scan(args.scan)
    hsv = cv2.cvtColor(im, cv2.COLOR_RGB2HSV)
    gray = cv2.cvtColor(im, cv2.COLOR_RGB2GRAY)
    line = ((gray < 125) & (hsv[..., 1] < 110)).astype(np.uint8)  # dark, unsaturated ink
    H, W = line.shape

    def fit(pts, lon0):
        t, _ = _poly(lon0)
        ll = np.array(list(pts.keys()), float)
        px = np.array(list(pts.values()), float)
        x, y = t.transform(ll[:, 0], ll[:, 1])
        A = np.c_[x, y, np.ones_like(x)]
        cx = np.linalg.lstsq(A, px[:, 0], rcond=None)[0]
        cy = np.linalg.lstsq(A, px[:, 1], rcond=None)[0]
        return (t, cx, cy), np.hypot(*(np.c_[A @ cx, A @ cy] - px).T)

    def predict(model, lon, lat):
        t, cx, cy = model
        x, y = t.transform(lon, lat)
        A = np.array([x, y, 1.0])
        return A @ cx, A @ cy

    def refine(model, lon, lat, win=60):
        # Find the meridian and the parallel near the predicted crossing by projecting dark pixels across each line's direction.
        px, py = predict(model, lon, lat)
        if not (win < px < W - win and win < py < H - win):
            return None
        a = np.array(predict(model, lon, lat + 0.2)) - np.array(predict(model, lon, lat - 0.2))
        b = np.array(predict(model, lon + 0.2, lat)) - np.array(predict(model, lon - 0.2, lat))
        a, b = a / np.linalg.norm(a), b / np.linalg.norm(b)
        x0, y0 = int(px) - win, int(py) - win
        ys, xs = np.nonzero(line[y0:y0 + 2 * win + 1, x0:x0 + 2 * win + 1])
        if len(xs) < 50:
            return None
        d = np.c_[xs + x0 - px, ys + y0 - py]
        na, nb = np.array([-a[1], a[0]]), np.array([-b[1], b[0]])

        def peak(o):
            h, e = np.histogram(o, bins=np.arange(-win, win + 2, 2))
            k = np.argmax(h)
            return e[k] + 1, h[k]

        pa, ca = peak(d @ na)
        pb, cb = peak(d @ nb)
        if ca < 80 or cb < 80:
            return None
        sol = np.linalg.solve(np.array([na, nb]), [pa, pb])
        return px + sol[0], py + sol[1]

    pts, lon0 = dict(SEEDS), -97
    model, _ = fit(pts, lon0)
    for it in range(40):
        added = 0
        accepted = set(pts)
        for lo in range(-129, -64, 2):
            for la in range(25, 50, 2):
                if (lo, la) in accepted or not any(abs(lo - a) <= 4 and abs(la - b) <= 4 for a, b in accepted):
                    continue
                r = refine(model, lo, la)
                if r is None or np.hypot(r[0] - predict(model, lo, la)[0], r[1] - predict(model, lo, la)[1]) > 45:
                    continue
                pts[(lo, la)] = r
                added += 1
        best = None
        for l0 in ([lon0] if len(pts) < 30 else range(-105, -88)):
            m, res = fit(pts, l0)
            rms = np.sqrt(np.mean(res ** 2))
            if best is None or rms < best[0]:
                best = (rms, l0, m, res)
        _, lon0, model, res = best
        bad = [k for k, r in zip(list(pts), res) if r > max(12, 4 * np.median(res)) and k not in SEEDS]
        for k in bad:
            del pts[k]
        model, res = fit(pts, lon0)
        print(f"round {it}: {len(pts)} crossings, central meridian {lon0}, rms {np.sqrt(np.mean(res ** 2)):.1f} px")
        if added == 0 and not bad:
            break
    out = Path(args.work) / "gcps.json"
    out.write_text(json.dumps({"lon0": lon0, "points": [{"lon": k[0], "lat": k[1], "x": float(v[0]), "y": float(v[1])} for k, v in pts.items()]}, indent=1) + "\n")
    print(f"wrote {out}")


def _gcps(work):
    p = Path(work) / "gcps.json"
    return p if p.exists() else DATA / "gcps.json"


def check_fit(args):
    from pyproj import Geod
    g = Geod(ellps="WGS84")
    t = MapTransform(_gcps(args.work))
    lon, lat = t.pixel_to_lonlat(t.px[:, 0], t.px[:, 1])
    ll = np.array([[p["lon"], p["lat"]] for p in t.pts])
    dist = g.inv(lon, lat, ll[:, 0], ll[:, 1])[2] / 1000
    print(f"fit: {len(dist)} crossings, rms {np.sqrt(np.mean(dist ** 2)):.2f} km, max {dist.max():.2f} km")
    errs = []
    for p in t.pts:
        tt = MapTransform(_gcps(args.work), exclude={(p["lon"], p["lat"])})
        lo, la = tt.pixel_to_lonlat(np.array([p["x"]]), np.array([p["y"]]))
        errs.append(g.inv(lo[0], la[0], p["lon"], p["lat"])[2] / 1000)
    errs = np.array(errs)
    print(f"leave one out: rms {np.sqrt(np.mean(errs ** 2)):.2f} km, 95th percentile {np.percentile(errs, 95):.2f} km, max {errs.max():.2f} km")


# ---------------------------------------------------------------- extraction

def extract(args):
    import cv2
    im = _load_scan(args.scan)
    H, W = im.shape[:2]
    hsv = cv2.cvtColor(im, cv2.COLOR_RGB2HSV)
    h, s, v = (hsv[..., k].astype(int) for k in range(3))
    brown = ((h >= 6) & (h <= 22) & (s >= 110) & (v >= 120) & (v <= 240)).astype(np.uint8)
    red = (((h <= 5) | (h >= 170)) & (s >= 120) & (v >= 120)).astype(np.uint8)
    dark = (v < 120).astype(np.uint8)
    # Keep red symbols and black lettering printed on or against the brown, so they do not punch holes in it.
    mask = brown | (red & cv2.dilate(brown, np.ones((25, 25), np.uint8))) | (dark & cv2.dilate(brown, np.ones((7, 7), np.uint8)))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
    keep = np.zeros_like(mask)
    x0, y0, x1, y1 = NEATLINE
    keep[y0:y1, x0:x1] = 1
    for x0, y0, x1, y1 in SKIP:
        keep[y0:y1, x0:x1] = 0
    mask &= keep
    t = MapTransform(_gcps(args.work))

    def to_ll(c):
        c = c.reshape(-1, 2).astype(float)
        lo, la = t.pixel_to_lonlat(c[:, 0], c[:, 1])
        return [[round(a, 5), round(b, 5)] for a, b in zip(lo, la)]

    feats = []
    core = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (31, 31))

    def closed_ring(cnt, off):
        ap = cv2.approxPolyDP(cnt, 1.5, True)
        if len(ap) < 3:
            return None
        ring = to_ll(ap + off)
        return ring + [ring[0]]

    def add(cnt, kind, area, off, holes=(), extra=None):
        if cv2.contourArea(cnt) < 60:
            return
        ring = closed_ring(cnt, off)
        if ring is None:
            return
        rings = [ring] + [r for r in (closed_ring(hc, off) for hc in holes) if r]
        M = cv2.moments(cnt)
        props = {"id": len(feats) + 1, "kind": kind, "pixel_area": int(area), "pixel_x": round(M["m10"] / M["m00"] + off[0]), "pixel_y": round(M["m01"] / M["m00"] + off[1])}
        props.update(extra or {})
        feats.append({"type": "Feature", "properties": props, "geometry": {"type": "Polygon", "coordinates": rings}})

    # Plain paper closed in on all sides by a reservation's brown is land taken out of it: the legend's "Opened" (brown around plain paper).
    # These are numbered after all the patches, so the patch numbers above stay the same.
    enclosed = []

    n, lab, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
    for i in range(1, n):
        x, y, w, hh, area = stats[i]
        if area < 60:
            continue
        comp = (lab[y:y + hh, x:x + w] == i).astype(np.uint8)
        nb = int((brown[y:y + hh, x:x + w] & comp).sum())
        nr = int((red[y:y + hh, x:x + w] & comp).sum())
        if nb < 0.3 * (nb + nr) or nb < 40:
            continue  # a school or agency symbol standing on its own
        if area < 1500:
            ys, xs = np.nonzero(brown[y:y + hh, x:x + w] & comp)
            cx, cy = xs.mean() + x, ys.mean() + y
            lo, la = t.pixel_to_lonlat(np.array([cx]), np.array([cy]))
            feats.append({"type": "Feature", "properties": {"id": len(feats) + 1, "kind": "reservation", "pixel_area": int(area), "pixel_x": round(cx), "pixel_y": round(cy)}, "geometry": {"type": "Point", "coordinates": [round(lo[0], 5), round(la[0], 5)]}})
            continue
        pad = cv2.copyMakeBorder(comp, 40, 40, 40, 40, cv2.BORDER_CONSTANT, 0)
        filled = pad.copy()
        cnts, hier = cv2.findContours(pad, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
        for k, cn in enumerate(cnts):
            if hier[0][k][3] >= 0 and cv2.contourArea(cn) < 4000:
                cv2.drawContours(filled, [cn], -1, 1, -1)  # fill small holes left by lettering
        thick = 2 * area / max(1, cv2.arcLength(max(cnts, key=cv2.contourArea), True))
        outer = cv2.findContours(filled, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)[0]
        region = np.zeros_like(filled)
        cv2.drawContours(region, outer, -1, 1, -1)
        cream = (region.sum() - filled.sum()) / max(1, region.sum())
        if thick < 14 and area > 3000 and cream < 0.3:
            # A thin band that does not close on itself: close it with a wider brush.
            sealed = cv2.morphologyEx(pad, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (41, 41)))
            outer = cv2.findContours(sealed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)[0]
            region = np.zeros_like(pad)
            cv2.drawContours(region, outer, -1, 1, -1)
        ys, xs = np.nonzero(region)
        ys, xs = ys + y - 40, xs + x - 40
        ok = (ys >= 0) & (ys < H) & (xs >= 0) & (xs < W)
        bfrac = brown[ys[ok], xs[ok]].mean() if ok.any() else 1
        kind = "opened" if (bfrac < 0.45 and region.sum() > 1500) else "reservation"
        off = np.array([x - 40, y - 40])
        for cn in outer:
            a = cv2.contourArea(cn)
            if a < 60:
                continue
            if kind == "reservation" or a < 1500:
                holes = []
                if kind == "reservation":
                    hc, hh2 = cv2.findContours(filled, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
                    holes = [c for k2, c in enumerate(hc) if hh2[0][k2][3] >= 0 and cv2.contourArea(c) >= 4000 and cv2.pointPolygonTest(cn, tuple(int(v) for v in c[0][0]), False) > 0]
                add(cn, "reservation", a, off, holes)
                enclosed.extend((c, off, len(feats)) for c in holes)
                continue
            add(cn, "opened", a, off)
            # Solid brown left inside an opened area is reservation land that was not opened.
            sub = np.zeros_like(pad)
            cv2.drawContours(sub, [cn], -1, 1, -1)
            solid = cv2.morphologyEx(pad & sub, cv2.MORPH_OPEN, core)
            for sc in cv2.findContours(solid, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)[0]:
                if cv2.contourArea(sc) >= 800:
                    add(sc, "reservation", cv2.contourArea(sc), off)
    for c, off, parent in enclosed:
        add(c, "opened", cv2.contourArea(c), off, extra={"enclosed_by": parent})
    out = Path(args.work) / "shapes-raw.geojson"
    out.write_text(json.dumps({"type": "FeatureCollection", "features": feats}))
    print(f"wrote {out}: {len(feats)} patches")
    _extract_insets(im, args.work)


# ---------------------------------------------------------------- the inset panels

TOWNSHIPS_URL = "https://gis.blm.gov/arcgis/rest/services/Cadastral/BLM_Natl_PLSS_CadNSDI/MapServer/1/query"
INSET_GCPS = DATA / "inset-gcps.json"


def fetch_townships(args):
    """Downloads the Bureau of Land Management's township polygons (PLSS CadNSDI, layer "PLSS Township") for the three panels' meridians."""
    import urllib.parse
    import urllib.request
    for inset in INSETS.values():
        out = Path(args.work) / inset["townships"]
        features, offset = [], 0
        while True:
            query = {"where": f"STATEABBR='{inset['state']}' AND PRINMERCD='{inset['meridian']}'", "outFields": "PLSSID,TWNSHPNO,TWNSHPDIR,RANGENO,RANGEDIR,TWNSHPFRAC,RANGEFRAC", "outSR": 4326, "f": "geojson", "resultOffset": offset, "resultRecordCount": 1000}
            with urllib.request.urlopen(TOWNSHIPS_URL + "?" + urllib.parse.urlencode(query), timeout=180) as response:
                page = json.load(response)
            features += page["features"]
            if len(page["features"]) < 1000:
                break
            offset += 1000
        out.write_text(json.dumps({"type": "FeatureCollection", "features": features}))
        print(f"wrote {out}: {len(features)} townships")


def _ink(im, box):
    """Dark, unsaturated ink (the printed lines) inside a box, as 0/1."""
    import cv2
    x0, y0, x1, y1 = box
    crop = np.ascontiguousarray(im[y0:y1, x0:x1])
    gray = cv2.cvtColor(crop, cv2.COLOR_RGB2GRAY)
    sat = cv2.cvtColor(crop, cv2.COLOR_RGB2HSV)[..., 1]
    return ((gray < 150) & (sat < 120)).astype(np.float32)


def _fit_grid(im, inset):
    """Finds the printed township lines of a panel and fits E and N (see INSETS) as affine functions of the scan pixel. Returns the coefficients and the root mean square miss in pixels."""
    x0, y0, x1, y1 = inset["box"]
    xe, dx, yn, dy = inset["grid"]
    ink = _ink(im, inset["box"])
    skip = inset["skip"]

    def skipped(x, y):
        return any(a <= x < c and b <= y < d for a, b, c, d in skip)

    ce = np.array([-xe / dx, 1 / dx, 0.0])  # E = ce . [1, x, y]
    cn = np.array([yn / dy, 0.0, -1 / dy])  # N = cn . [1, x, y]
    for _ in range(3):
        cols, rows = [], []
        for ys in range(y0 + 40, y1 - 40, 100):
            strip = ink[max(0, ys - y0 - 50):ys - y0 + 50]
            profile = strip.mean(0)
            emin, emax = sorted((ce @ [1, x0, ys], ce @ [1, x1, ys]))
            for e in range(int(np.ceil(emin)), int(np.floor(emax)) + 1):
                # The x where E = e on this strip.
                xp = (e - ce[0] - ce[2] * ys) / ce[1]
                lo, hi = int(xp - 14) - x0, int(xp + 14) - x0
                if lo < 0 or hi > profile.size or skipped(xp, ys):
                    continue
                k = lo + int(np.argmax(profile[lo:hi]))
                if profile[k] > 0.5:
                    cols.append((k + x0, ys, e))
        for xs in range(x0 + 40, x1 - 40, 100):
            strip = ink[:, max(0, xs - x0 - 50):xs - x0 + 50]
            profile = strip.mean(1)
            nmin, nmax = sorted((cn @ [1, xs, y0], cn @ [1, xs, y1]))
            for n in range(int(np.ceil(nmin)), int(np.floor(nmax)) + 1):
                yp = (n - cn[0] - cn[1] * xs) / cn[2]
                lo, hi = int(yp - 14) - y0, int(yp + 14) - y0
                if lo < 0 or hi > profile.size or skipped(xs, yp):
                    continue
                k = lo + int(np.argmax(profile[lo:hi]))
                if profile[k] > 0.5:
                    rows.append((xs, k + y0, n))
        C, R = np.array(cols, float), np.array(rows, float)
        ce = np.linalg.lstsq(np.c_[np.ones(len(C)), C[:, :2]], C[:, 2], rcond=None)[0]
        cn = np.linalg.lstsq(np.c_[np.ones(len(R)), R[:, :2]], R[:, 2], rcond=None)[0]
    miss = np.r_[(np.c_[np.ones(len(C)), C[:, :2]] @ ce - C[:, 2]) * dx, (np.c_[np.ones(len(R)), R[:, :2]] @ cn - R[:, 2]) * dy]
    return ce, cn, float(np.sqrt(np.mean(miss ** 2))), len(C), len(R)


def place_insets(args):
    """Places the three panels from their printed township grids. Writes research/historic-maps/oia-1909/inset-gcps.json."""
    from pyproj import Geod
    from shapely.geometry import shape
    geod = Geod(ellps="WGS84")
    im = _load_scan(args.scan)
    out = {}
    for name, inset in INSETS.items():
        ce, cn, rms, ncol, nrow = _fit_grid(im, inset)
        x0, y0, x1, y1 = inset["box"]
        corners = np.array([[1, x, y] for x in (x0, x1) for y in (y0, y1)], float)
        emin, emax = (corners @ ce).min(), (corners @ ce).max()
        nmin, nmax = (corners @ cn).min(), (corners @ cn).max()
        A = np.array([ce[1:], cn[1:]])
        points = []
        for f in json.loads((Path(args.work) / inset["townships"]).read_text())["features"]:
            p = f["properties"]
            if p["TWNSHPFRAC"] != "0" or p["RANGEFRAC"] != "0" or not f["geometry"]:
                continue
            g = shape(f["geometry"])
            square_miles = abs(geod.geometry_area_perimeter(g)[0]) / 2.589988e6
            if not 33 <= square_miles <= 39:
                continue  # a fractional or odd-sized township: its center is not the printed square's
            e = (int(p["RANGENO"]) - 0.5) * (1 if p["RANGEDIR"] == "E" else -1)
            n = (int(p["TWNSHPNO"]) - 0.5) * (1 if p["TWNSHPDIR"] == "N" else -1)
            if not (emin <= e <= emax and nmin <= n <= nmax):
                continue
            x, y = np.linalg.solve(A, [e - ce[0], n - cn[0]])
            if any(a <= x < c and b <= y < d for a, b, c, d in inset["skip"]):
                continue
            c = g.centroid
            points.append({"township": p["PLSSID"], "e": e, "n": n, "x": round(float(x), 1), "y": round(float(y), 1), "lon": round(c.x, 6), "lat": round(c.y, 6)})
        # Drop townships whose surveyed center does not fit the printed grid (resurveys, odd closings), then report the fit.
        for _ in range(5):
            t = InsetTransform({"points": points})
            lon, lat = t.pixel_to_lonlat(np.array([p["x"] for p in points]), np.array([p["y"] for p in points]))
            miss = np.asarray(geod.inv(lon, lat, np.array([p["lon"] for p in points]), np.array([p["lat"] for p in points]))[2]) / 1000
            bad = miss > max(1.5, 3 * np.median(miss))
            if not bad.any():
                break
            points = [p for p, b in zip(points, bad) if not b]
        loo = []
        for k in range(len(points)):
            t = InsetTransform({"points": points[:k] + points[k + 1:]})
            lo, la = t.pixel_to_lonlat(np.array([points[k]["x"]]), np.array([points[k]["y"]]))
            loo.append(geod.inv(lo[0], la[0], points[k]["lon"], points[k]["lat"])[2] / 1000)
        loo = np.array(loo)
        out[name] = {"title": inset["title"], "grid": {"E": [round(v, 8) for v in ce], "N": [round(v, 8) for v in cn], "rms_pixels": round(rms, 2), "lines_found": [ncol, nrow]}, "leave_one_out_km": {"rms": round(float(np.sqrt(np.mean(loo ** 2))), 3), "p95": round(float(np.percentile(loo, 95)), 3), "max": round(float(loo.max()), 3)}, "points": points}
        print(f"{name}: grid miss {rms:.1f} px over {ncol} + {nrow} line crossings; {len(points)} townships; leave one out rms {np.sqrt(np.mean(loo ** 2)):.2f} km, max {loo.max():.2f} km")
    INSET_GCPS.write_text(json.dumps({"source": TOWNSHIPS_URL, "insets": out}, indent=1) + "\n")
    print(f"wrote {INSET_GCPS}")


class InsetTransform:
    """Panel pixel -> longitude/latitude: a quadratic fitted to the township centers of one panel."""

    def __init__(self, panel):
        pts = panel["points"]
        px = np.array([[p["x"], p["y"]] for p in pts], float)
        ll = np.array([[p["lon"], p["lat"]] for p in pts], float)
        self.pm, self.ps = px.mean(0), px.std(0)
        u = (px - self.pm) / self.ps
        T = self._terms(u)
        self.c = [np.linalg.lstsq(T, ll[:, k], rcond=None)[0] for k in range(2)]
        self.lm, self.ls = ll.mean(0), ll.std(0)
        T = self._terms((ll - self.lm) / self.ls)
        self.ci = [np.linalg.lstsq(T, px[:, k], rcond=None)[0] for k in range(2)]

    @staticmethod
    def _terms(u):
        a, b = u[:, 0], u[:, 1]
        return np.c_[np.ones_like(a), a, b, a * a, a * b, b * b]

    def pixel_to_lonlat(self, x, y):
        T = self._terms((np.c_[x, y] - self.pm) / self.ps)
        return T @ self.c[0], T @ self.c[1]

    def lonlat_to_pixel(self, lon, lat):
        T = self._terms((np.c_[lon, lat] - self.lm) / self.ls)
        return T @ self.ci[0], T @ self.ci[1]


def _inset_transforms():
    d = json.loads(INSET_GCPS.read_text())["insets"]
    return {name: InsetTransform(panel) for name, panel in d.items()}


def _extract_insets(im, work):
    """Picks out the reservations in the three panels. Writes insets-raw.geojson, in longitude and latitude."""
    import cv2
    from shapely.geometry import Polygon, mapping
    transforms = _inset_transforms()
    feats = []

    def to_ll(name, c, off):
        c = c.reshape(-1, 2).astype(float) + off
        lo, la = transforms[name].pixel_to_lonlat(c[:, 0], c[:, 1])
        return [[round(a, 6), round(b, 6)] for a, b in zip(lo, la)]

    for name, inset in INSETS.items():
        x0, y0, x1, y1 = inset["box"]
        crop = np.ascontiguousarray(im[y0:y1, x0:x1])
        hsv = cv2.cvtColor(crop, cv2.COLOR_RGB2HSV)
        h, s, v = (hsv[..., k].astype(int) for k in range(3))
        off = np.array([x0, y0])
        k = 0
        if name == "oklahoma":
            # Brown bands around plain paper: each piece of paper closed in by the bands, not touching the panel's edge, is one area, widened by half a band to the band's middle.
            brown = ((h >= 6) & (h <= 24) & (s >= 90) & (v >= 110) & (v <= 245)).astype(np.uint8)
            band = cv2.dilate(cv2.morphologyEx(brown, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8)), np.ones((3, 3), np.uint8))
            n, lab, stats, _ = cv2.connectedComponentsWithStats((1 - band).astype(np.uint8), 4)
            H, W = band.shape
            for i in range(1, n):
                x, y, w, hh, area = stats[i]
                if area < 300 or x <= 2 or y <= 2 or x + w >= W - 2 or y + hh >= H - 2:
                    continue
                region = cv2.dilate((lab == i).astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11)))
                cnt = max(cv2.findContours(region, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)[0], key=cv2.contourArea)
                ring = to_ll(name, cv2.approxPolyDP(cnt, 1.5, True), off)
                M = cv2.moments(cnt)
                feats.append({"type": "Feature", "properties": {"id": f"{name}-{i}", "inset": name, "kind": "opened", "pixel_area": int(area), "pixel_x": round(M["m10"] / M["m00"] + x0), "pixel_y": round(M["m01"] / M["m00"] + y0)}, "geometry": {"type": "Polygon", "coordinates": [ring + [ring[0]]]}})
            continue
        brown = ((h >= 6) & (h <= 22) & (s >= 100) & (v >= 120) & (v <= 245)).astype(np.uint8)
        for a, b, c, d in inset["skip"]:
            brown[max(0, b - y0):max(0, d - y0), max(0, a - x0):max(0, c - x0)] = 0
        red = (((h <= 5) | (h >= 170)) & (s >= 120) & (v >= 120)).astype(np.uint8)
        dark = (v < 120).astype(np.uint8)
        # Keep red symbols and black lettering on the brown, so they do not punch holes in it.
        mask = brown | (red & cv2.dilate(brown, np.ones((15, 15), np.uint8))) | (dark & cv2.dilate(brown, np.ones((5, 5), np.uint8)))
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
        n, lab, stats, cen = cv2.connectedComponentsWithStats(mask, 8)
        for i in range(1, n):
            if stats[i, 4] < 40:
                continue
            comp = (lab == i).astype(np.uint8)
            if int((brown & comp).sum()) < 25:
                continue  # a school or agency symbol standing on its own
            k += 1
            area = int(stats[i, 4])
            props = {"id": f"{name}-{k}", "inset": name, "kind": "reservation", "pixel_area": area, "pixel_x": round(cen[i][0] + x0), "pixel_y": round(cen[i][1] + y0)}
            if area < INSET_POINT_BELOW:
                lo, la = transforms[name].pixel_to_lonlat(np.array([cen[i][0] + x0]), np.array([cen[i][1] + y0]))
                feats.append({"type": "Feature", "properties": props, "geometry": {"type": "Point", "coordinates": [round(lo[0], 6), round(la[0], 6)]}})
                continue
            filled = comp.copy()
            cnts, hier = cv2.findContours(comp, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
            for j, cn in enumerate(cnts):
                if hier[0][j][3] >= 0 and cv2.contourArea(cn) < 400:
                    cv2.drawContours(filled, [cn], -1, 1, -1)  # fill small holes left by lettering
            polys = []
            cnts, hier = cv2.findContours(filled, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
            for j, cn in enumerate(cnts):
                if hier[0][j][3] >= 0 or cv2.contourArea(cn) < 20:
                    continue
                holes = [to_ll(name, cv2.approxPolyDP(cnts[q], 1.5, True), off) for q in range(len(cnts)) if hier[0][q][3] == j and len(cnts[q]) >= 3]
                outer = to_ll(name, cv2.approxPolyDP(cn, 1.5, True), off)
                if len(outer) >= 3:
                    polys.append(Polygon(outer, [hh for hh in holes if len(hh) >= 3]))
            from shapely.ops import unary_union
            geom = unary_union([p if p.is_valid else p.buffer(0) for p in polys])
            feats.append({"type": "Feature", "properties": props, "geometry": mapping(geom)})
    # Cut the pieces fenced off by black lines only.
    from shapely.geometry import shape
    for source, target, (a, b, c, d) in INSET_CUTS:
        f = next(f for f in feats if f["properties"]["id"] == source)
        t = transforms[f["properties"]["inset"]]
        corners = np.array([[a, b], [c, b], [c, d], [a, d]], float)
        lo, la = t.pixel_to_lonlat(corners[:, 0], corners[:, 1])
        cutter = Polygon(list(zip(lo, la)))
        g = shape(f["geometry"])
        feats.append({"type": "Feature", "properties": {**f["properties"], "id": target, "cut_from": source}, "geometry": mapping(g.intersection(cutter))})
        f["geometry"] = mapping(g.difference(cutter))
    out = Path(work) / "insets-raw.geojson"
    out.write_text(json.dumps({"type": "FeatureCollection", "features": feats}))
    print(f"wrote {out}: {len(feats)} patches in the panels")


# ---------------------------------------------------------------- build

def _albers():
    """Two functions that move a shapely geometry between longitude/latitude and meters (Albers equal area, EPSG:5070), made valid."""
    import shapely
    from pyproj import Transformer

    def mover(src, dst):
        tr = Transformer.from_crs(src, dst, always_xy=True)

        def move(g):
            out = shapely.transform(g, lambda c: np.c_[tr.transform(c[:, 0], c[:, 1])])
            return out if out.is_valid else shapely.make_valid(out)
        return move
    return mover("EPSG:4326", "EPSG:5070"), mover("EPSG:5070", "EPSG:4326")


def _census_2020(folder):
    import shapefile
    from shapely.geometry import shape
    to_m, _ = _albers()
    r = shapefile.Reader(str(next(Path(folder).glob("*.shp"))))
    out = {}
    for sr in r.shapeRecords():
        g = shape(sr.shape.__geo_interface__)
        out[sr.record["AIANNHCE"]] = to_m(g)
    return out


def _split(geom, refs, cell=500.0):
    """Cuts geom into one piece per reference area, each cell going to the nearest reference (the line halfway between them)."""
    import cv2
    from scipy import ndimage
    from shapely.affinity import affine_transform
    from shapely.geometry import Polygon
    from shapely.ops import unary_union
    minx, miny, maxx, maxy = geom.buffer(5 * cell).bounds
    w, h = int((maxx - minx) / cell) + 1, int((maxy - miny) / cell) + 1
    # Grid coordinates: column = (x - minx) / cell, row = (maxy - y) / cell.
    to_grid = [1 / cell, 0, 0, -1 / cell, -minx / cell, maxy / cell]
    to_map = [cell, 0, 0, -cell, minx, maxy]
    labels = np.zeros((h, w), np.int32)
    for k, ref in enumerate(refs, start=1):
        for p in getattr(ref, "geoms", [ref]):
            ring = np.array(affine_transform(p, to_grid).exterior.coords, np.int32)
            cv2.fillPoly(labels, [ring], k)
    if not labels.any():
        return [None] * len(refs)
    _, (iy, ix) = ndimage.distance_transform_edt(labels == 0, return_indices=True)
    nearest = labels[iy, ix]
    pieces = []
    for k in range(1, len(refs) + 1):
        m = (nearest == k).astype(np.uint8)
        cnts, hier = cv2.findContours(m, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
        polys = []
        for i, c in enumerate(cnts):
            if hier[0][i][3] < 0 and len(c) >= 3:
                holes = [cc.reshape(-1, 2) + 0.5 for j, cc in enumerate(cnts) if hier[0][j][3] == i and len(cc) >= 3]
                polys.append(Polygon(c.reshape(-1, 2) + 0.5, holes))
        zone = affine_transform(unary_union([p.buffer(0) for p in polys]), to_map) if polys else None
        piece = geom.intersection(zone.buffer(0)) if zone is not None else None
        pieces.append(piece if piece is not None and piece.area > 1e6 else None)
    return pieces


def _status(kind):
    return "Opened" if kind == "opened" else "Reservation"


def build(args):
    from shapely.geometry import mapping, shape
    raw = json.loads((Path(args.work) / "shapes-raw.geojson").read_text())
    to_m, to_ll = _albers()
    t = MapTransform(_gcps(args.work))
    census = _census_2020(args.census_2020)
    nations = {p.stem for p in (ROOT / "content" / "tribes").glob("*/*.yaml")}
    feats, rows = [], []

    def emit(geom_ll, name, name_source, status, nation_list, patch, internal="", neighbors=(), panel="", note=""):
        missing = [n for n in nation_list if n not in nations]
        if missing:
            sys.exit(f"patch {patch}: no nation record {missing}")
        fid = f"oia-1909-{len(feats) + 1:03d}"
        props = {"id": fid, "name": name, "name_source": name_source, "status": status, "nations": nation_list, "patch": patch, "review": "Unverified", "source": SOURCE, "source_url": SCAN_URL}
        if panel:
            props["panel"] = panel
        if internal:
            props["internal_lines"] = internal
            props["neighbors"] = [n for n in neighbors if n != name]
        if note:
            props["note"] = note
        feats.append({"type": "Feature", "properties": props, "geometry": mapping(geom_ll)})
        rows.append({"id": fid, "patch": patch, "name": name, "name_source": name_source, "status": status, "geometry": geom_ll.geom_type, "nations": " ".join(nation_list), "internal_lines": internal, "review": "Unverified", "note": note})

    def drop_row(patch, reason):
        rows.append({"id": "", "patch": patch, "name": "", "name_source": "", "status": "", "geometry": "", "nations": "", "internal_lines": "", "review": "", "note": "dropped: " + reason})

    # The panels first: the main map's Oklahoma patch needs the Northeastern Oklahoma panel's shapes cut out of it.
    from shapely.ops import unary_union
    insets_raw = json.loads((Path(args.work) / "insets-raw.geojson").read_text())
    transforms = _inset_transforms()
    inset_feats = []
    for f in insets_raw["features"]:
        p = f["properties"]
        n, panel = p["id"], INSETS[p["inset"]]["title"]
        if n in INSET_DROP:
            drop_row(n, INSET_DROP[n])
            continue
        g = shape(f["geometry"])
        g = g if g.is_valid else g.buffer(0)
        status = _status(p["kind"])
        if n in INSET_SPLITS:
            parts = INSET_SPLITS[n]
            pieces = _split(to_m(g), [census[c] for c, *_ in parts], cell=100.0)
            names = [name for _, name, *_ in parts]
            for (code, name, src, nat), piece in zip(parts, pieces):
                if piece is not None:
                    inset_feats.append((to_ll(piece.simplify(30)), name, src, status, nat, n, "Printed touching its neighbors; the line between them is placed halfway between the 2020 Census areas, not traced from the 1909 map", names, panel, ""))
            continue
        if n not in INSET_NAMES:
            sys.exit(f"panel patch {n} has no reading in INSET_NAMES, INSET_DROP or INSET_SPLITS")
        name, src, nat = INSET_NAMES[n]
        inset_feats.append((g, name, src, status, nat, n, "", (), panel, INSET_NOTES.get(n, "")))
    for name, status, inset, x, y, nat in INSET_ADDED:
        lo, la = transforms[inset].pixel_to_lonlat(np.array([x]), np.array([y]))
        inset_feats.append((shape({"type": "Point", "coordinates": [round(lo[0], 6), round(la[0], 6)]}), name, "label", status, nat, "added by hand", "", (), INSETS[inset]["title"], ""))
    oklahoma_panel = unary_union([to_m(f[0]) for f in inset_feats if f[8] == INSETS["oklahoma"]["title"]])

    raw_by_id = {f["properties"]["id"]: f for f in raw["features"]}
    dropped_enclosed = [n for n in DROP if n in raw_by_id and "enclosed_by" in raw_by_id[n]["properties"]]
    for f in raw["features"]:
        p = f["properties"]
        n = p["id"]
        if n in DROP:
            drop_row(n, DROP[n])
            continue
        g = shape(f["geometry"])
        if g.geom_type == "Polygon" and p["pixel_area"] < POINT_BELOW:
            lo, la = t.pixel_to_lonlat(np.array([p["pixel_x"]]), np.array([p["pixel_y"]]))
            g = shape({"type": "Point", "coordinates": [round(lo[0], 5), round(la[0], 5)]})
        if g.geom_type == "Polygon" and len(f["geometry"]["coordinates"]) > 1:
            # Keep only the holes that are kept as Opened areas.
            from shapely.geometry import Polygon
            kept = [r for r in f["geometry"]["coordinates"][1:] if not any(shape(raw_by_id[d]["geometry"]).contains(Polygon(r).representative_point()) for d in dropped_enclosed)]
            g = Polygon(f["geometry"]["coordinates"][0], kept)
        if g.geom_type == "Polygon":
            g = g if g.is_valid else g.buffer(0)
        status = _status(p["kind"])
        if n in SPLITS:
            gm = to_m(g)
            replaced = INSET_REPLACES_SPLIT.get(n, set())
            parts = [part for part in SPLITS[n] if part[0] not in replaced]
            for code, name, *_ in SPLITS[n]:
                if code in replaced:
                    drop_row(n, f"{name}: drawn in the Northeastern Oklahoma panel; the panel's shape is used")
            if replaced:
                gm = gm.difference(oklahoma_panel)
            pieces = _split(gm, [census[c] for c, *_ in parts])
            names = [name for _, name, *_ in parts]
            for (code, name, src, nat), piece in zip(parts, pieces):
                if piece is None:
                    continue
                piece = to_ll(piece.simplify(200))
                emit(piece, name, src, status, nat, n, "Printed touching its neighbors; the line between them is placed halfway between the 2020 Census areas, not traced from the 1909 map", names)
            continue
        if n not in NAMES:
            sys.exit(f"patch {n} has no reading in NAMES, DROP or SPLITS")
        name, src, nat = NAMES[n]
        emit(g, name, src, status, nat, n)
    for name, status, x, y, nat in ADDED:
        lo, la = t.pixel_to_lonlat(np.array([x]), np.array([y]))
        emit(shape({"type": "Point", "coordinates": [round(lo[0], 5), round(la[0], 5)]}), name, "label", status, nat, "added by hand")
    for args_ in inset_feats:
        emit(*args_)
    # Opened areas first, so reservations draw on top.
    feats.sort(key=lambda f: (f["properties"]["status"] != "Opened", f["geometry"]["type"] == "Point"))
    DATA.mkdir(parents=True, exist_ok=True)
    out = DATA / "oia-1909-reservations.geojson"
    out.write_text(json.dumps({"type": "FeatureCollection", "name": "Office of Indian Affairs, 1909", "features": feats}, separators=(",", ":")) + "\n")
    shutil.copy(_gcps(args.work), DATA / "gcps.json") if _gcps(args.work) != DATA / "gcps.json" else None
    with REVIEW.open("w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    kinds = {}
    for f in feats:
        k = (f["properties"]["status"], f["geometry"]["type"])
        kinds[k] = kinds.get(k, 0) + 1
    print(f"wrote {out}: {len(feats)} features {kinds}; {sum(1 for r in rows if r['note'].startswith('dropped'))} patches dropped")
    print(f"wrote {REVIEW}")


# ---------------------------------------------------------------- pictures

def pictures(args):
    from PIL import Image, ImageDraw
    import shapefile
    Image.MAX_IMAGE_PIXELS = None
    t = MapTransform(_gcps(args.work))
    layer = json.loads((DATA / "oia-1909-reservations.geojson").read_text())
    r = shapefile.Reader(str(next(Path(args.census_1990).glob("*.shp"))))
    scan = Image.open(args.scan).convert("RGB")
    f = args.factor
    boxes = {"whole": (840, 690, 15130, 9230), "northern-plains": (5400, 1300, 8600, 3800), "oklahoma": (6600, 5200, 8900, 6900), "southwest": (3000, 4300, 6100, 7000)}
    for label, (x0, y0, x1, y1) in boxes.items():
        k = f * (4 if label == "whole" else 1)
        base = scan.crop((x0, y0, x1, y1)).resize(((x1 - x0) // k, (y1 - y0) // k))
        paper = Image.new("RGB", base.size, (250, 248, 242))

        def draw_layer(img, width):
            d = ImageDraw.Draw(img)
            for ft in layer["features"]:
                g = ft["geometry"]
                color = (0, 140, 70) if ft["properties"]["status"] == "Opened" else (20, 60, 200)
                if g["type"] == "Point":
                    X, Y = t.lonlat_to_pixel(np.array([g["coordinates"][0]]), np.array([g["coordinates"][1]]))
                    cx, cy = (X[0] - x0) / k, (Y[0] - y0) / k
                    d.ellipse([cx - 4, cy - 4, cx + 4, cy + 4], outline=color, width=width)
                    continue
                polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
                for poly in polys:
                    ring = np.array(poly[0])
                    X, Y = t.lonlat_to_pixel(ring[:, 0], ring[:, 1])
                    d.line([((a - x0) / k, (b - y0) / k) for a, b in zip(X, Y)], fill=color, width=width)

        def draw_1990(img):
            d = ImageDraw.Draw(img)
            for shp in r.shapes():
                pts = np.array(shp.points)
                if not len(pts):
                    continue
                parts = list(shp.parts) + [len(pts)]
                for a, b in zip(parts[:-1], parts[1:]):
                    X, Y = t.lonlat_to_pixel(pts[a:b, 0], pts[a:b, 1])
                    xy = [((u - x0) / k, (v - y0) / k) for u, v in zip(X, Y)]
                    if len(xy) > 2:
                        d.polygon(xy, fill=(235, 150, 90), outline=(170, 80, 30))

        over_scan = base.copy()
        draw_layer(over_scan, 2)
        over_1990 = paper.copy()
        draw_1990(over_1990)
        draw_layer(over_1990, 2)
        both = Image.new("RGB", (base.width * 2 + 12, base.height), (255, 255, 255))
        both.paste(over_scan, (0, 0))
        both.paste(over_1990, (base.width + 12, 0))
        out = Path(args.out) / f"1909-{label}.jpg"
        both.save(out, quality=85)
        print(f"wrote {out}")


# ---------------------------------------------------------------- the original map, warped

SCAN_TILES_MAX_ZOOM = 9
INSET_TILES_MAX_ZOOM = 11


def warp(args):
    """Warps the scan onto web map tiles (Web Mercator, 256 pixels, WebP with transparency) for the "Show the original map" switch: the main map to zoom 9, about its own scale, and each panel over its own ground to zoom 11. The panels' boxes, and everything outside the main map's border, are left out of the main map's tiles. Writes DIR/scan-tiles/z/x/y.webp."""
    import cv2
    from PIL import Image
    im = _load_scan(args.scan)
    H, W = im.shape[:2]
    main = MapTransform(_gcps(args.work))
    insets = _inset_transforms()
    # Smaller copies of the scan, so a far-out tile samples a copy near its own scale.
    pyramid = [im]
    while pyramid[-1].shape[1] > 1000:
        pyramid.append(cv2.pyrDown(pyramid[-1]))
    root = Path(args.work) / "scan-tiles"

    def lonlat_grid(z, x, y):
        n = 2 ** z
        px = (np.arange(256) + 0.5) / 256
        xs = (x + px) / n * 360 - 180
        ys = y + px
        lat = np.degrees(np.arctan(np.sinh(np.pi * (1 - 2 * ys / n))))
        return np.meshgrid(xs, lat)

    def tile_range(z, west, south, east, north):
        n = 2 ** z
        tx = lambda lon: int((lon + 180) / 360 * n)
        ty = lambda lat: int((1 - np.log(np.tan(np.radians(lat)) + 1 / np.cos(np.radians(lat))) / np.pi) / 2 * n)
        return range(tx(west), tx(east) + 1), range(ty(north), ty(south) + 1)

    def sample(fx, fy, z, keep):
        # Scan pixels per tile pixel decides the copy to sample.
        step = max(1.0, float(np.nanmedian(np.abs(np.diff(fx, axis=1)))))
        level = min(len(pyramid) - 1, int(np.floor(np.log2(step))))
        img = pyramid[level]
        f = 2 ** level
        rgb = cv2.remap(img, (fx / f - 0.5 + 0.5 / f).astype(np.float32), (fy / f - 0.5 + 0.5 / f).astype(np.float32), cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
        alpha = (keep * 255).astype(np.uint8)
        return np.dstack([rgb, alpha])

    def inside(fx, fy, box, skip):
        x0, y0, x1, y1 = box
        k = (fx >= x0) & (fx < x1) & (fy >= y0) & (fy < y1)
        for a, b, c, d in skip:
            k &= ~((fx >= a) & (fx < c) & (fy >= b) & (fy < d))
        return k

    # The panels sit on the main map's paper; their boxes, widened to take in their frame lines, are cut out of the main map so a panel's drawing never shows over the main map's ground (the Pueblo panel reaches past SKIP[1], to x 4790).
    panels = [b for b in SKIP[:2]] + [(x0 - 40, y0 - 40, x1 + 40, y1 + 40) for x0, y0, x1, y1 in (inset["box"] for inset in INSETS.values())]
    written = 0
    # The main map's ground: the corners of its border, widened a little.
    corners = np.array([[NEATLINE[0], NEATLINE[1]], [NEATLINE[2], NEATLINE[1]], [NEATLINE[0], NEATLINE[3]], [NEATLINE[2], NEATLINE[3]], [(NEATLINE[0] + NEATLINE[2]) / 2, NEATLINE[3]], [(NEATLINE[0] + NEATLINE[2]) / 2, NEATLINE[1]]], float)
    lo, la = main.pixel_to_lonlat(corners[:, 0], corners[:, 1])
    main_bounds = (lo.min() - 1, la.min() - 1, lo.max() + 1, la.max() + 1)
    inset_bounds = {}
    for name, inset in INSETS.items():
        x0, y0, x1, y1 = inset["box"]
        c = np.array([[x0, y0], [x1, y0], [x0, y1], [x1, y1]], float)
        lo, la = insets[name].pixel_to_lonlat(c[:, 0], c[:, 1])
        inset_bounds[name] = (lo.min(), la.min(), lo.max(), la.max())
    for z in range(0, INSET_TILES_MAX_ZOOM + 1):
        xs, ys = tile_range(z, *main_bounds)
        for tx in xs:
            for ty in ys:
                lon, lat = lonlat_grid(z, tx, ty)
                out = np.zeros((256, 256, 4), np.uint8)
                if z <= SCAN_TILES_MAX_ZOOM:
                    fx, fy = main.lonlat_to_pixel(lon.ravel(), lat.ravel())
                    fx, fy = fx.reshape(256, 256), fy.reshape(256, 256)
                    keep = inside(fx, fy, NEATLINE, panels)
                    if keep.any():
                        out = sample(fx, fy, z, keep)
                tile_w, tile_s, tile_e, tile_n = lon.min(), lat.min(), lon.max(), lat.max()
                for name, inset in INSETS.items():
                    w, s_, e, n = inset_bounds[name]
                    if tile_e < w or tile_w > e or tile_n < s_ or tile_s > n:
                        continue
                    fx, fy = insets[name].lonlat_to_pixel(lon.ravel(), lat.ravel())
                    fx, fy = fx.reshape(256, 256), fy.reshape(256, 256)
                    keep = inside(fx, fy, inset["box"], inset["skip"])
                    if keep.any():
                        layer = sample(fx, fy, z, keep)
                        out = np.where(keep[..., None], layer, out)
                if not out[..., 3].any():
                    continue
                path = root / str(z) / str(tx) / f"{ty}.webp"
                path.parent.mkdir(parents=True, exist_ok=True)
                Image.fromarray(out, "RGBA").save(path, "WEBP", quality=78, method=4)
                written += 1
        print(f"zoom {z}: {written} tiles so far")
    print(f"wrote {written} tiles under {root}")


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name, fn in (("georeference", georeference), ("check-fit", check_fit), ("fetch-townships", fetch_townships), ("insets", place_insets), ("extract", extract), ("build", build), ("pictures", pictures), ("warp", warp)):
        p = sub.add_parser(name)
        p.set_defaults(fn=fn)
        p.add_argument("--work", required=True)
        if name in ("georeference", "insets", "extract", "pictures", "warp"):
            p.add_argument("--scan", required=True)
        if name == "build":
            p.add_argument("--census-2020", required=True, help="folder holding cb_2020_us_aiannh_500k.shp")
        if name == "pictures":
            p.add_argument("--census-1990", required=True, help="folder holding ir99_d90.shp")
            p.add_argument("--out", required=True)
            p.add_argument("--factor", type=int, default=2)
    args = ap.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
