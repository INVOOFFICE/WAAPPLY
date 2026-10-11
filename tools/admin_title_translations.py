# -*- coding: utf-8 -*-
"""Aggregated Arabic title dictionaries for the administrative-support page.

Starts from the manufacturing dictionaries (tools/mfg_title_translations.py:
TITLE_AR phrases + STOP_AR function words) and layers the admin-specific
batches tools/admin_title_translations_*.py on top, exposing:

  TITLE_AR   - {normalized phrase: Arabic} - phrase may be one or many tokens
  STOP_AR    - function words / job-ad noise the composer may skip
  compose(key) - fail-closed longest-match composer over TITLE_AR

Batch files may declare TITLE_AR_<n> dicts (merged into TITLE_AR) and
STOP_ADD_<n> iterables (merged into STOP_AR). The composer returns '' when any
content token cannot be covered, so the generator falls back to the original
title instead of emitting a broken translation. Nothing here invents a job
title.
"""

import re
import sys
import os
import glob

sys.dont_write_bytecode = True
_HERE = os.path.dirname(os.path.abspath(__file__))
if sys.path[:1] != [_HERE]:
    sys.path.insert(0, _HERE)

import mfg_title_translations as _mfg

TITLE_AR = dict(_mfg.TITLE_AR)
STOP_AR = set(_mfg.STOP_AR)

# Every tools/admin_title_translations_*.py batch is picked up automatically.
_BATCHES = sorted(
    p for p in glob.glob(os.path.join(_HERE, 'admin_title_translations_*.py'))
)

for _path in _BATCHES:
    _name = os.path.splitext(os.path.basename(_path))[0]
    _mod = __import__(_name)
    for _attr in sorted(dir(_mod)):
        if _attr.startswith('TITLE_AR_'):
            _d = getattr(_mod, _attr)
            if not isinstance(_d, dict):
                continue
            for _k, _v in _d.items():
                _k = ' '.join(str(_k).split()).strip().lower()
                _v = ' '.join(str(_v).split()).strip()
                if _k and _v:
                    TITLE_AR[_k] = _v
        elif _attr.startswith('STOP_ADD_'):
            _d = getattr(_mod, _attr)
            if isinstance(_d, (set, frozenset, list, tuple)):
                for _t in _d:
                    _t = ' '.join(str(_t).split()).strip().lower()
                    if _t:
                        STOP_AR.add(_t)

# Never let a stop token shadow a real single-word translation.
for _t in tuple(TITLE_AR):
    if ' ' not in _t:
        STOP_AR.discard(_t)

_NUMERIC = re.compile(r'^[\d\W]+$')
_MAXPHRASE = 14


def _noise(token):
    """Tokens the composer may skip without translating."""
    if token in STOP_AR:
        return True
    if _NUMERIC.match(token):
        return True
    return False


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
