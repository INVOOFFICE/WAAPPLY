#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Translation coverage report for the free offers data.

Reads js/offers-data.js (generated from eures_jobs_SECI.csv) and reports how
much Arabic is present in titles / descriptions, plus a heuristic detection of
the foreign languages that remain visible to the user.

Run:  python tools/translation-report.py
"""

import collections
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(ROOT, "js", "offers-data.js")

AR = re.compile(r"[\u0600-\u06FF]")
LATIN = re.compile(r"[A-Za-zÀ-ÿ]+")

# Characteristic stopwords per language (heuristic scoring).
LANG_STOPWORDS = {
    "allemand": {"der", "die", "das", "und", "für", "mit", "ist", "nicht", "auf", "bei", "wir", "eine"},
    "anglais": {"the", "and", "for", "you", "your", "with", "this", "will", "are", "from", "have"},
    "français": {"le", "la", "les", "pour", "avec", "une", "des", "dans", "nous", "vous", "sur"},
    "néerlandais": {"een", "het", "de", "voor", "met", "van", "en", "zijn", "wordt", "worden"},
    "tchèque": {"pro", "v", "na", "jsou", "jako", "nebo", "pracovní", "a", "o"},
    "slovaque": {"pre", "a", "v", "na", "ako", "alebo", "sú", "o"},
    "slovène": {"in", "za", "na", "z", "ali", "v", "so", "za"},
    "finnois": {"ja", "on", "ei", "kun", "sekä", "työ", "ravintola"},
    "norvégien": {"og", "for", "på", "med", "til", "vi", "søker", "en", "det"},
    "suédois": {"och", "för", "på", "med", "till", "vi", "söker", "en", "det"},
    "danois": {"og", "for", "på", "med", "til", "vi", "søger", "en", "det"},
    "polonais": {"dla", "z", "do", "na", "o", "i", "w", "jest"},
    "portugais": {"para", "de", "do", "da", "com", "uma", "em", "o", "a"},
    "espagnol": {"para", "con", "de", "el", "la", "en", "y", "un"},
    "roumain": {"pentru", "cu", "la", "de", "in", "si", "un", "o"},
    "anglais-irlandais": {"ireland", "employment", "permit", "eures", "european"},
}


def latin_words(text):
    return LATIN.findall(text)


def detect_language(words):
    if not words:
        return ""
    low = [w.lower() for w in words]
    scores = {}
    for lang, stops in LANG_STOPWORDS.items():
        scores[lang] = sum(1 for w in low if w in stops)
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else ""


def main():
    raw = open(DATA_PATH, encoding="utf-8").read()
    payload = raw.split("window.OFFERS_DATA = [", 1)[1].rsplit("];", 1)[0].rstrip().rstrip(",")
    data = json.loads("[" + payload + "]")

    total = len(data)
    t_ar = sum(1 for o in data if AR.search(o["t"]))
    t_foreign = total - t_ar
    d_ar = sum(1 for o in data if AR.search(o["d"]))
    d_no_ar = total - d_ar

    # Repeated-template analysis (identical description text across offers)
    desc_counts = collections.Counter(o["d"] for o in data)
    templates = sum(1 for _, n in desc_counts.items() if n >= 2)
    unique_texts = sum(1 for _, n in desc_counts.items() if n == 1)
    covered_by_repeat = sum(n for _, n in desc_counts.items() if n >= 2)

    # Language detection on remaining foreign content
    title_langs = collections.Counter()
    desc_langs = collections.Counter()
    for o in data:
        if not AR.search(o["t"]):
            title_langs[detect_language(latin_words(o["t"])) or "inconnu"] += 1
        if not AR.search(o["d"]):
            desc_langs[detect_language(latin_words(o["d"])) or "inconnu"] += 1

    print("=" * 60)
    print("RAPPORT DE TRADUCTION — WAAPPLY offres gratuites")
    print("=" * 60)
    print("Données")
    print(f"  offres totales           : {total}")
    print(f"  offres avec titre arabe  : {t_ar}  ({100 * t_ar / total:.1f}%)")
    print(f"  titres encore étrangers  : {t_foreign}")

    print("\nDescriptions")
    print(f"  avec arabe               : {d_ar}  ({100 * d_ar / total:.1f}%)")
    print(f"  sans arabe               : {d_no_ar}")
    print(f"  textes distincts         : {len(desc_counts)}")
    print(f"  modèles répétitifs (>=2) : {templates} (couvrent {covered_by_repeat} offres)")
    print(f"  textes uniques           : {unique_texts}")
    print(f"  traduites                : {d_ar}")
    print(f"  restant à traduire       : {d_no_ar}")

    print("\nLangues restantes dans les TITRES")
    for lang, n in title_langs.most_common():
        print(f"  {lang:<20}: {n}")
    print("\nLangues restantes dans les DESCRIPTIONS (sans aucun arabe)")
    for lang, n in desc_langs.most_common():
        print(f"  {lang:<20}: {n}")

    if d_no_ar:
        print("\nDescriptions sans arabe (titres) :")
        for o in data:
            if not AR.search(o["d"]):
                print(f"  - [{o['c']}] {o['t'][:70]}")


if __name__ == "__main__":
    main()