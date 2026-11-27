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
]


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

    def emit(geom_ll, name, name_source, status, nation_list, patch, internal=""):
        missing = [n for n in nation_list if n not in nations]
        if missing:
            sys.exit(f"patch {patch}: no nation record {missing}")
        fid = f"oia-1909-{len(feats) + 1:03d}"
        props = {"id": fid, "name": name, "name_source": name_source, "status": status, "nations": nation_list, "patch": patch, "review": "Unverified", "source": SOURCE, "source_url": SCAN_URL}
        if internal:
            props["internal_lines"] = internal
        feats.append({"type": "Feature", "properties": props, "geometry": mapping(geom_ll)})
        rows.append({"id": fid, "patch": patch, "name": name, "name_source": name_source, "status": status, "geometry": geom_ll.geom_type, "nations": " ".join(nation_list), "internal_lines": internal, "review": "Unverified", "note": ""})

    raw_by_id = {f["properties"]["id"]: f for f in raw["features"]}
    dropped_enclosed = [n for n in DROP if n in raw_by_id and "enclosed_by" in raw_by_id[n]["properties"]]
    for f in raw["features"]:
        p = f["properties"]
        n = p["id"]
        if n in DROP:
            rows.append({"id": "", "patch": n, "name": "", "name_source": "", "status": "", "geometry": "", "nations": "", "internal_lines": "", "review": "", "note": "dropped: " + DROP[n]})
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
            parts = SPLITS[n]
            pieces = _split(gm, [census[c] for c, *_ in parts])
            for (code, name, src, nat), piece in zip(parts, pieces):
                if piece is None:
                    continue
                piece = to_ll(piece.simplify(200))
                emit(piece, name, src, status, nat, n, "Printed touching its neighbors; the line between them is placed halfway between the 2020 Census areas, not traced from the 1909 map")
            continue
        if n not in NAMES:
            sys.exit(f"patch {n} has no reading in NAMES, DROP or SPLITS")
        name, src, nat = NAMES[n]
        emit(g, name, src, status, nat, n)
    for name, status, x, y, nat in ADDED:
        lo, la = t.pixel_to_lonlat(np.array([x]), np.array([y]))
        emit(shape({"type": "Point", "coordinates": [round(lo[0], 5), round(la[0], 5)]}), name, "label", status, nat, "added by hand")
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


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name, fn in (("georeference", georeference), ("check-fit", check_fit), ("extract", extract), ("build", build), ("pictures", pictures)):
        p = sub.add_parser(name)
        p.set_defaults(fn=fn)
        p.add_argument("--work", required=True)
        if name in ("georeference", "extract", "pictures"):
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
