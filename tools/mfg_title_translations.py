# -*- coding: utf-8 -*-
"""Aggregated Arabic title dictionaries for the manufacturing-industry page.

Loads every tools/mfg_title_translations_*.py batch and exposes:

  TITLE_AR   - {normalized phrase: Arabic} - phrase may be one or many tokens
  STOP_AR    - function words / job-ad noise the composer may skip
  compose(key) - fail-closed longest-match composer over TITLE_AR

The composer returns '' when any content token cannot be covered, so the
generator falls back to the original title instead of emitting a broken
translation. Nothing here invents a job title.
"""

import re
import sys
import os
import glob

sys.dont_write_bytecode = True
_HERE = os.path.dirname(os.path.abspath(__file__))
if sys.path[:1] != [_HERE]:
    sys.path.insert(0, _HERE)

# Every tools/mfg_title_translations_*.py batch is picked up automatically.
_BATCHES = sorted(
    p for p in glob.glob(os.path.join(_HERE, 'mfg_title_translations_*.py'))
)

TITLE_AR = {}
for _path in _BATCHES:
    _name = os.path.splitext(os.path.basename(_path))[0]
    _mod = __import__(_name)
    for _attr in sorted(dir(_mod)):
        if not _attr.startswith('TITLE_AR_'):
            continue
        _d = getattr(_mod, _attr)
        if not isinstance(_d, dict):
            continue
        for _k, _v in _d.items():
            _k = ' '.join(str(_k).split()).strip().lower()
            _v = ' '.join(str(_v).split()).strip()
            if _k and _v:
                TITLE_AR[_k] = _v


# Function words and pure job-ad noise: skipped by the composer (they carry
# no job meaning). Everything else MUST be covered by TITLE_AR or the
# composition fails and the original title is shown.
STOP_AR = {
    # German
    'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem',
    'einer', 'eines', 'eigene', 'eigenen', 'und', 'oder', 'bzw', 'sowie',
    'als', 'an', 'am', 'im', 'in', 'ins', 'auf', 'aus', 'bei', 'mit', 'nach',
    'von', 'vom', 'zu', 'zum', 'zur', 'für', 'fuer', 'über', 'ueber', 'unter',
    'vor', 'seit', 'durch', 'um', 'pro', 'ab', 'bis', 'ohne', 'weitere',
    'wir', 'sie', 'du', 'ihr', 'uns', 'euch', 'sich', 'meine', 'meinen',
    'meiner', 'mein', 'unser', 'unsere', 'unseren', 'unserem', 'unserer',
    'unseres', 'deine', 'dein', 'dieser', 'diese', 'dieses', 'gesucht',
    'suchen', 'sucht', 'willkommen', 'bitte', 'gern', 'auch', 'noch',
    'jetzt', 'sofort', 'viel', 'mehr', 'gute', 'guter', 'gutes', 'neue',
    'neuen', 'neuer', 'starke', 'stark', 'hohe', 'hohen', 'erfahrene',
    'erfahren', 'motivierte', 'flexible', 'attraktive', 'spannende',
    'interessante', 'möglich', 'mogliche', 'teilzeit', 'vollzeit', 'woche',
    'wochen', 'stunden', 'std', 'jahre', 'jahr', 'arbeit', 'standort',
    'bereich', 'abteilung', 'team', 'teams', 'firma', 'unternehmen',
    'bachelor', 'master', 'diplom', 'abschluss', 'berufserfahrung',
    'davon', 'dazu', 'dabei', 'dort', 'hier', 'sehr', 'vorhanden',
    'wünschenswert', 'wunsch', 'gern', 'gerne', 'bitte', 'kennen',
    'lernen', 'werden', 'sein', 'ist', 'sind', 'hat', 'haben', 'kann',
    'soll', 'muss', 'werden', 'wird', 'mehrjährige', 'mehrjährige',
    'gute', 'sehr', 'möglichst', 'mindestens', 'wenigstens', 'min',
    'max', 'ca', 'zzgl', 'inkl', 'bzw', 'usw', 'id', 'nr', 'nummer',
    'sucht:', 'gesucht:', 'wir:', 'sie:', 'anforderungen:', 'profil:',
    'konto', 'job', 'jobs', 'stellen', 'stelle', 'stellenangebot',
    'angebot', 'karriere', 'zeitlich', 'befristet', 'unbefristet',
    'festanstellung', 'sofort möglich', 'möglichst', 'gute',
    # English
    'the', 'a', 'an', 'and', 'or', 'of', 'for', 'to', 'in', 'on', 'at',
    'by', 'with', 'from', 'into', 'our', 'we', 'you', 'your', 'are', 'is',
    'be', 'this', 'that', 'these', 'those', 'as', 'per', 'day', 'week',
    'full', 'part', 'time', 'based', 'new', 'join', 'looking', 'wanted',
    'required', 'experience', 'role', 'position', 'job', 'vacancy',
    'required:', 'about', 'who', 'what', 'where', 'when', 'how', 'will',
    'work', 'working', 'works', 'do', 'does', 'did', 'have', 'has', 'had',
    'can', 'could', 'should', 'would', 'must', 'may', 'might', 'need',
    'needs', 'needed', 'welcome', 'today', 'now', 'here', 'there', 'also',
    'more', 'most', 'other', 'others', 'all', 'any', 'some', 'each',
    'their', 'them', 'they', 'he', 'she', 'his', 'her', 'its', 'it',
    'not', 'no', 'yes', 'if', 'then', 'than', 'so', 'but', 'while',
    'across', 'within', 'without', 'under', 'over', 'about', 'up', 'out',
    'off', 'well', 'very', 'just', 'only', 'even', 'get', 'got', 'make',
    'makes', 'made', 'take', 'taken', 'give', 'given', 'come', 'go',
    'going', 'one', 'two', 'three', 'first', 'second', 'next', 'available',
    'immediately', 'permanent', 'temporary', 'contract', 'salary', 'paid',
    'benefits', 'opportunity', 'opportunities', 'career', 'training',
    'qualification', 'qualifications', 'skills', 'knowledge', 'abilities',
    'language', 'languages', 'company', 'companies', 'industry', 'and/or',
    'etc', 'eg', 'ie', 'am', 'pm', 'monday', 'friday', 'weekend',
    'remote', 'hybrid', 'onsite', 'site', 'location', 'locations',
    'department', 'team', 'plus', 'well', 'many', 'much', 'several',
    'key', 'looking for', 'we are', 'you will', 'you will be',
    # Czech / Slovak / Polish
    'v', 've', 'na', 'z', 'do', 'pro', 'a', 'i', 'se', 'k', 'ke', 'po',
    'od', 'u', 'za', 'při', 'pri', 'nebo', 'c', 'ci', 'de', 'la', 'le',
    'les', 'du', 'des', 'un', 'une', 'et', 'en', 'au', 'aux', 'jestliže',
    'ani', 'neb', 'takzvané', 'takzvany', 'hlavní', 'hlavni', 'dalsi',
    'další', 'jinde', 'neuvedená', 'neuvedene', 'neuvedení', 'neuvedenych',
    'příbuzné', 'prbuzne', 'příbuzných', 'prbuznich', 'související',
    'také', 'taky', 'pak', 'ale', 'proto', 'protože', 'aby', 'když',
    'což', 'které', 'která', 'který', 'kterou', 'kterých', 'kterému',
    'tento', 'tato', 'toto', 'tyto', 'svůj', 'svá', 'své', 'sebe',
    'oraz', 'jest', 'się', 'dla', 'przy', 'bez', 'nad', 'pod', 'lub',
    'nie', 'co', 'w', 'z', 'u', 'the', 'aby', 'pro', 'do', 'na',
    # French
    'au', 'aux', 'du', 'des', 'le', 'la', 'les', 'un', 'une', 'et', 'ou',
    'de', 'en', 'pour', 'par', 'sur', 'dans', 'chez', 'avec', 'sans',
    'ce', 'cette', 'ces', 'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'son',
    'sa', 'ses', 'notre', 'nos', 'votre', 'vos', 'leur', 'leurs', 'plus',
    'moins', 'très', 'tout', 'tous', 'toute', 'toutes', 'autre', 'autres',
    # Dutch
    'het', 'een', 'van', 'voor', 'met', 'op', 'te', 'bij', 'uit', 'aan',
    'om', 'als', 'of', 'maar', 'ook', 'onze', 'wij', 'je', 'jouw', 'geen',
    # Norwegian / Swedish / Danish / Finnish
    'og', 'av', 'til', 'på', 'som', 'er', 'en', 'et', 'den', 'det', 'vi',
    'våre', 'sek', 'med', 'for', 'ikke', 'vil', 'skal', 'ha', 'kan',
    'tai', 'sekä', 'on', 'olla', 'me', 'ja', 'ei', 'jos', 'mutta', 'myös',
    'sekä', 'olla', 'ovat', 'olen', 'meidän', 'teidän', 'heidän',
    # gender markers / ad noise
    'm/w/d', 'w/m/d', 'm/f', 'f/m', 'h/f', 'f/h', 'w/d', 'd/w', 'm/w',
    'm/ž', 'm/z', 'm/f/ž', 'm/ž/ce', 'h/f/d', 'k/m', 'a/b',
    # ad noise found in eures_jobs_SECC.csv titles
    'b', 'e', 'r', 'd', 'st', '5h', 'ozp', 'vz', 'teil', 'dich', 'dich.',
    'komm', 'willst', 'erfahrung', 'erfahrungen', 'duldungen', 'tage',
    'dringend', 'mithilfe', 'voll-/teilzeit', 'vollzeit/teilzeit', 'voll-',
    'teil-', 'm/w/divers', 'm/i/w/d', 'schnellste', 'neueste', 'wichtigsten',
    # batch 6 pass: remaining ad noise, codes and bare letters
    'c', 'f', 'g', 'h', 'j', 'l', 'm', 'n', 'o', 'p', 'q', 's', 't', 'u',
    'v', 'w', 'x', 'y', 'z',
    'cc', 'sr', 'qa', 'ds', 'xi', 'sgb', 'rv', 'uc', 'ai', 'cmc', 'emr',
    'psaga', 'hse', 'ifs', 'qmb', 'qm', 'iso', 'kv', 'tz', '38h', 'ekg',
    'lap', 'dpp', 'gmbh', 'kg', 'mbh', 'ag', 'ohg', 'www', 'com',
    'qa_12607', 'a-9433', 'a-9400', 'un-0024', 'l3050',
    'kein', 'keine', 'keinen', 'nicht', 'einfach', 'etwas', 'schaffen',
    'dann', 'werde', 'herzlich', 'mind', 'mag', 'wann', 'warum', 'wer',
    'was', 'wie', 'wo', 'ganz', 'monat', 'monate', 'wieder', 'immer',
    'kommst', 'suche', 'nein', 'kommst', 'bewirb', 'zukuft', 'starten',
    'tätigkeiten', 'interesse', 'arbeitsstelle', 'inhouse', 'wo',
    '/-in', '/in', '-in', ':in',
}

# Never let a stop token shadow a real single-word translation.
for _t in tuple(TITLE_AR):
    if ' ' not in _t:
        STOP_AR.discard(_t)

_NUMERIC = re.compile(r'^[\d\W]+$')


def _noise(token):
    """Tokens the composer may skip without translating."""
    if token in STOP_AR:
        return True
    if _NUMERIC.match(token):
        return True
    return False


_MAXPHRASE = 14


def compose(key):
    """Fail-closed longest-match composition over TITLE_AR.

    Returns '' unless every content token of `key` is covered by a TITLE_AR
    phrase (function words and bare numbers may be skipped).
    """
    toks = key.split()
    n = len(toks)
    if not n:
        return ''
    INF = 10 ** 9
    best = [INF] * (n + 1)
    prev = [-1] * (n + 1)
    piece = [None] * (n + 1)
    best[0] = 0
    for i in range(n):
        if best[i] == INF:
            continue
        if _noise(toks[i]) and best[i] < best[i + 1]:
            best[i + 1] = best[i]
            prev[i + 1] = i
            piece[i + 1] = None
        hi = min(n, i + _MAXPHRASE)
        for j in range(hi, i, -1):
            phrase = ' '.join(toks[i:j])
            if phrase in TITLE_AR and best[i] + 1 < best[j]:
                best[j] = best[i] + 1
                prev[j] = i
                piece[j] = TITLE_AR[phrase]
        if best[i + 1] == INF and i + 1 <= n:
            pass
    if best[n] == INF:
        return ''
    out = []
    i = n
    while i > 0:
        p = piece[i]
        if p:
            out.append(p)
        i = prev[i]
    out.reverse()
    return ' '.join(out)


def translate_phrase(key):
    """Exact match first, then composer."""
    if not key:
        return ''
    hit = TITLE_AR.get(key)
    if hit:
        return hit
    return compose(key)
