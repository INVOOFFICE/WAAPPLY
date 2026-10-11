#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generate js/offers-administrative-support-data.js from eures_jobs_SECO.csv.

Local-only, no network. The CSV (employer emails) is gitignored and never
committed - this generated .js file is the versioned artifact the static page
reads over file://.

Record fields (mirrors the manufacturing-industry record shape exactly):
  t  original job title (verbatim from CSV, also used for fallback)
  a  Arabic job title (same mechanism as manufacturing; "" when none)
  e  employer_name   d  creation_date as YYYY-MM-DD
  c  country ISO-2   ca Arabic country name
  s  secteurs verbatim   sa Arabic secteurs
  u  source_url      m  email_direct

Detail: same Arabic-title mechanism as the manufacturing generator
(tools/generate-offers-manufacturing-industry-data.py): the admin phrase layer
(tools/admin_title_translations.py, which already merges the manufacturing
dictionaries) + SECI exact-title maps re-keyed with THIS file's norm_title +
the SECI pipeline's own tools/generate-offers-data.py translate_title() as a
final fallback. No new translation architecture; every candidate is
fail-closed (must contain Arabic - a title is never guessed).

Regenerate with:  python tools/generate-offers-administrative-support-data.py
Never edit js/offers-administrative-support-data.js by hand.
"""

import csv
import datetime
import importlib.util
import io
import json
import os
import re
import sys

sys.dont_write_bytecode = True

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CSV_PATH = os.path.join(ROOT, "eures_jobs_SECO.csv")
OUT_PATH = os.path.join(ROOT, "js", "offers-administrative-support-data.js")

COLUMNS = [
    "title",
    "employer_name",
    "creation_date",
    "source_url",
    "country",
    "secteurs",
    "email_direct",
]

SECTOR = "Activités de service administratif et de soutien"

# This dataset's sector label. The shared SECI dictionary has no entry for
# this sector, so it is supplied here - same dictionary-driven mechanism as
# COUNTRIES_AR_EXTRA in the manufacturing generator.
SECTORS_AR_EXTRA = {
    "Activités de service administratif et de soutien": "الأنشطة الإدارية وخدمات الدعم",
}

# Every country present in eures_jobs_SECO.csv (AT DE) is already carried by
# the shared COUNTRIES_AR table - verified against the CSV, no extras needed.
COUNTRIES_AR_EXTRA = {}

_AR = re.compile(r"[\u0600-\u06FF]")


# ---------------------------------------------------------------------------
# Normalization - must stay in sync with tools/mfg_title_translations.py keys
# ---------------------------------------------------------------------------

_EMOJI = re.compile(
    r"[\U0001F000-\U0001FAFF\u2600-\u27BF\u2190-\u21FF\u2B00-\u2BFF"
    r"\u2022\u25CF\u25A0\u25B2\u25BC\u25B6\u25C0\u00B7]+"
)


def norm_title(raw):
    """Lowercased, noise-free key used for Arabic title lookups."""
    s = str(raw or "")
    s = (
        s.replace("\u2013", "-")
        .replace("\u2014", "-")
        .replace("\u2019", "'")
        .replace("\u2018", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
    )
    s = _EMOJI.sub(" ", s)
    s = re.sub(r"\([^)]*\)", " ", s)
    s = re.sub(r"\[[^\]]*\]", " ", s)
    s = re.sub(r"(?<=\w)_in\b", " ", s, flags=re.I)
    s = re.sub(r"/in\b", " ", s, flags=re.I)
    s = re.sub(r"\*in\b", " ", s, flags=re.I)
    s = re.sub(r"\b(?:m/w/d|w/m/d|h/f|f/h|m/f|f/m|w/d|d/w)\b", " ", s, flags=re.I)
    s = re.sub(r'[;:!?."\u201c\u201d\u201e\']+', " ", s)
    # ESCO-style lists often repeat the same phrase verbatim
    segs, seen = [], set()
    for p in s.split(","):
        p = re.sub(r"\s+", " ", p).strip(" -/|&")
        if p and p.lower() not in seen:
            seen.add(p.lower())
            segs.append(p)
    s = " ".join(segs)
    s = re.sub(r"\s+", " ", s).strip(" -/_,;:()|&")
    s = re.sub(r"\s+", " ", s).strip().lower()
    return s


# ---------------------------------------------------------------------------
# Shared dictionaries from the SECI pipeline (countries / sectors / dates)
# ---------------------------------------------------------------------------


def _load_shared():
    path = os.path.join(HERE, "generate-offers-data.py")
    if sys.path[:1] != [HERE]:
        sys.path.insert(0, HERE)
    spec = importlib.util.spec_from_file_location("offers_data_shared", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _load_exact_titles():
    """Exact title entries from the SECI pipeline, re-keyed with THIS file's
    normalization so both datasets share one safe exact-match layer."""
    table = {}
    if sys.path[:1] != [HERE]:
        sys.path.insert(0, HERE)
    try:
        import title_translations_1 as t1
        import title_translations_2 as t2
        import title_translations_3 as t3
        import title_translations_4 as t4
        import title_translations_5 as t5
    except Exception:
        return table
    for mod in (t1, t2, t3, t4, t5):
        for name in dir(mod):
            if not name.startswith("TITLE_EXACT"):
                continue
            for k, v in getattr(mod, name).items():
                if not v or not _AR.search(v):
                    continue
                table.setdefault(norm_title(k), " ".join(v.split()))
    return table


def translate_secteurs(raw, shared):
    """Arabic secteurs, honoring THIS dataset's administrative-support label."""
    if not raw or not raw.strip():
        return ""
    parts = [p.strip() for p in raw.split(",")]
    out = []
    for p in parts:
        if p in SECTORS_AR_EXTRA:
            out.append(SECTORS_AR_EXTRA[p])
        else:
            out.append(shared.SECTORS_AR.get(p, p))
    return "، ".join(out)


def translate_title(raw, phrase_fn, shared_titles, seci_translate):
    """Arabic title or ''. Never invents: empty means the card shows `t`.

    Layers, in order - all must contain Arabic or the result is rejected:
      1. admin phrase layer (merges the manufacturing dictionaries + admin
         trade/office batches),
      2. SECI exact-title maps re-keyed with norm_title (same as manufacturing),
      3. the SECI pipeline's own translate_title, accepted ONLY when the
         result is fully Arabic (mixed German/Arabic output is rejected so a
         card never shows a half-translated title - it falls back to `t`).
    """
    key = norm_title(raw)
    if not key:
        return ""
    pr = phrase_fn(key)
    if pr and _AR.search(pr):
        return " ".join(pr.split())
    ex = shared_titles.get(key)
    if (
        ex
        and _AR.search(ex)
        and not re.search(r"[A-Za-z]", ex)
    ):
        return " ".join(ex.split())
    seci = seci_translate(raw)
    if (
        seci
        and seci != raw.strip()
        and _AR.search(seci)
        and not re.search(r"[A-Za-z]", seci)
    ):
        return " ".join(seci.split())
    return ""


def format_date(ms):
    try:
        ts = int(ms) / 1000.0
    except Exception:
        return ""
    return datetime.datetime.fromtimestamp(ts, datetime.UTC).strftime("%Y-%m-%d")


# ---------------------------------------------------------------------------


def main():
    if not os.path.exists(CSV_PATH):
        print("ERROR: %s not found" % CSV_PATH, file=sys.stderr)
        sys.exit(1)

    sys.path.insert(0, HERE)
    import admin_title_translations as admin

    shared = _load_shared()
    shared_titles = _load_exact_titles()
    countries_ar = dict(getattr(shared, "COUNTRIES_AR", {}))
    countries_ar.update(COUNTRIES_AR_EXTRA)
    translate_phrase = admin.translate_phrase

    with io.open(CSV_PATH, "r", encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        if reader.fieldnames is None or [c.strip() for c in reader.fieldnames] != COLUMNS:
            print(
                "ERROR: bad header, expected exactly: %s" % ", ".join(COLUMNS),
                file=sys.stderr,
            )
            sys.exit(1)
        rows = [dict(r) for r in reader]

    records = []
    seen = set()
    dupes = 0
    skipped = 0
    not_sector = 0
    arabic_covered = 0
    country_covered = 0
    sector_covered = 0

    for i, r in enumerate(rows):
        title = (r.get("title") or "").strip()
        secteurs = (r.get("secteurs") or "").strip()

        if not title:
            skipped += 1
            print("WARN: row %d has no title, skipped" % (i + 2))
            continue
        if SECTOR not in secteurs:
            not_sector += 1
            continue

        source = (r.get("source_url") or "").strip()
        if source and source in seen:
            dupes += 1
            continue
        if source:
            seen.add(source)

        iso = (r.get("country") or "").strip().upper()
        email = (r.get("email_direct") or "").strip()

        arabic = translate_title(title, translate_phrase, shared_titles, shared.translate_title)
        country_ar = countries_ar.get(iso, "")
        sector_ar = translate_secteurs(secteurs, shared)
        if sector_ar == secteurs:
            sector_ar = ""  # untranslated - keep verbatim in `s`

        rec = {
            "t": title,
            "a": arabic,
            "e": (r.get("employer_name") or "").strip(),
            "d": format_date(r.get("creation_date") or ""),
            "c": iso,
            "ca": country_ar,
            "s": secteurs,
            "sa": sector_ar,
            "u": source,
            "m": email,
        }
        records.append(rec)
        if arabic:
            arabic_covered += 1
        if country_ar:
            country_covered += 1
        if sector_ar:
            sector_covered += 1

    missing_countries = sorted({r["c"] for r in records} - set(countries_ar))
    if missing_countries:
        print("WARN: countries without Arabic, add to COUNTRIES_AR_EXTRA: %s"
              % ", ".join(missing_countries), file=sys.stderr)

    payload = json.dumps(records, ensure_ascii=False, separators=(",", ":"))

    out = (
        "/* Generated by tools/generate-offers-administrative-support-data.py"
        " from eures_jobs_SECO.csv (local-only, gitignored) - DO NOT EDIT BY HAND.\n"
        "   Re-run `python tools/generate-offers-administrative-support-data.py` after updating the CSV.\n"
        "   Record fields: t=title a=Arabic title e=employer d=date c=country ISO ca=Arabic country\n"
        "   s=secteurs verbatim sa=Arabic secteurs u=source url m=email. */\n"
        "window.OFFERS_ADMIN_DATA = %s;\n" % payload
    )

    with io.open(OUT_PATH, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(out)

    total = len(records)
    pct = lambda n: "%.1f%%" % (100.0 * n / total) if total else "0%"

    # Title coverage report (unique titles).
    uniq = sorted({r["t"] for r in records})
    uniq_ok = sorted({r["t"] for r in records if r["a"]})
    missing = [t for t in uniq if t not in set(uniq_ok)]

    print("Rows loaded .......: %d" % len(rows))
    print("Skipped (no title).: %d" % skipped)
    print("Skipped (not sect).: %d" % not_sector)
    print("Duplicates dropped : %d" % dupes)
    print("Records emitted ...: %d" % total)
    print("Arabic titles .....: %d (%s)" % (arabic_covered, pct(arabic_covered)))
    print("Arabic countries ..: %d (%s)" % (country_covered, pct(country_covered)))
    print("Arabic sectors ....: %d (%s)" % (sector_covered, pct(sector_covered)))
    print("Unique titles .....: %d" % len(uniq))
    print("Unique translated .: %d" % len(uniq_ok))
    upct = "%.1f%%" % (100.0 * len(uniq_ok) / len(uniq)) if uniq else "0%"
    print("Unique coverage ...: %s" % upct)
    if missing:
        print("--- titles without Arabic (%d) ---" % len(missing))
        for t in missing:
            print(t)
    print("Written %s" % OUT_PATH)


if __name__ == "__main__":
    main()
