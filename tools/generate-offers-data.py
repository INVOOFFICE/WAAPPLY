#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""WAAPPLY — generate js/offers-data.js from eures_jobs_SECI.csv.

The CSV is the single source of offers. This script:
  * parses the CSV (UTF-8 BOM, quoted fields),
  * keeps all technical fields verbatim (id, position_offering_code,
    email_direct, source_url, employer_name, location_map),
  * translates display fields (title, description, secteurs, country label)
    into Arabic using the dictionaries below (data-driven, phrase+word level),
  * writes window.OFFERS_DATA to js/offers-data.js (classic script, file:// OK).

Run:        python tools/generate-offers-data.py                (full reprocess)
            python tools/generate-offers-data.py --incremental  (refresh-only)

The --incremental mode reuses every offer already present in js/offers-data.js
verbatim (no retranslation) and only refreshes `u` from the CSV `source_url`
column, matched by the exact same `id`. CSV rows not present in the output are
skipped. The default (full) mode reprocesses every CSV row for a genuinely new
dataset. Regenerate whenever the CSV changes — never edit js/offers-data.js.
"""

import csv
import html
import json
import os
import re
import sys

sys.dont_write_bytecode = True

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from title_translations_1 import TITLE_EXACT_1
from title_translations_2 import TITLE_EXACT_2
from title_translations_3 import TITLE_EXACT_3
from title_translations_4 import TITLE_EXACT_4
from title_translations_5 import TITLE_EXACT_5
from final_description_translations import DESC_BY_ID

TITLE_EXACT = {}
TITLE_EXACT.update(TITLE_EXACT_1)
TITLE_EXACT.update(TITLE_EXACT_2)
TITLE_EXACT.update(TITLE_EXACT_3)
TITLE_EXACT.update(TITLE_EXACT_4)
TITLE_EXACT.update(TITLE_EXACT_5)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_PATH = os.path.join(ROOT, "eures_jobs_SECI.csv")
OUT_PATH = os.path.join(ROOT, "js", "offers-data.js")

# ---------------------------------------------------------------------------
# Dictionaries (German / Czech / Slovenian / Finnish / Greek  ->  Arabic)
# ---------------------------------------------------------------------------

COUNTRIES_AR = {
    "AT": "النمسا", "DE": "ألمانيا", "CZ": "التشيك", "IE": "أيرلندا",
    "FI": "فنلندا", "NO": "النرويج", "BE": "بلجيكا", "SI": "سلوفينيا",
    "FR": "فرنسا", "PL": "بولندا", "SK": "سلوفاكيا", "CH": "سويسرا",
    "CY": "قبرص", "ES": "إسبانيا", "NL": "هولندا", "PT": "البرتغال",
    "RO": "رومانيا", "LU": "لوكسمبورغ",
}

SECTORS_AR = {
    "Hébergement et restauration": "الإقامة والمطاعم",
    "Activités immobilières": "الأنشطة العقارية",
    "Santé humaine et activités d'action sociale": "الصحة والعمل الاجتماعي",
    "Commerce de gros et de détail": "التجارة بالجملة والتجزئة",
    "Administration publique et défense; sécurité sociale obligatoire": "الإدارة العمومية والدفاع والضمان الاجتماعي",
    "Arts, sports et activités récréatives": "الفنون والرياضة والأنشطة الترفيهية",
    "Autres activités de services": "خدمات أخرى",
    "Industrie manufacturière": "الصناعة التحويلية",
    "Production et distribution d'électricité, de gaz, de vapeur et d'air conditionné": "إنتاج وتوزيع الكهرباء والغاز والبخار وتكييف الهواء",
    "Transports et entreposage": "النقل والتخزين",
    "Enseignement": "التعليم",
    "Construction": "البناء",
}


def translate_secteurs(raw):
    if not raw or not raw.strip():
        return ""
    parts = [p.strip() for p in raw.split(",")]
    out = []
    for p in parts:
        out.append(SECTORS_AR.get(p, p))
    return "، ".join(out)


# ---------------------------------------------------------------------------
# Title translation (ordered regex rules, most specific first)
# ---------------------------------------------------------------------------

TITLE_RULES = [
    # German compounds (specific first)
    (r"Küchengehilf\(en?\)innen|Küchengehilfe_in|Küchengehilf\(e\)in|Küchengehilf\(en\)", "مساعد/مساعدة مطبخ"),
    (r"Frühstücksservierer_in|Frühstücksservierer", "نادل/نادلة الفطور"),
    (r"Frühstückskellner_in|Frühstückskellner", "نادل/نادلة الفطور"),
    (r"Frühstückskoch_köchin|Frühstückskoch", "طباخ/طباخة الفطور"),
    (r"Frühstückskraft", "عامل/عاملة الفطور"),
    (r"Restaurantfachmann_Restaurantfachfrau|Restaurantfachmann/-frau|Restaurantfachmann_frau|Restaurantfachleute", "متخصص/متخصصة في المطاعم"),
    (r"Restaurantleiter_in|Restaurantleiter|Restaurantleitung", "مدير/مديرة مطعم"),
    (r"Servicemitarbeiter_in|Servicemitarbeiter", "موظف/موظفة خدمة"),
    (r"Serviceleitung", "إدارة الخدمة"),
    (r"Servicekraft", "عامل/عاملة خدمة"),
    (r"Servierer_in|Servierer|Servierkraft", "نادل/نادلة"),
    (r"Zimmermädchen_bursch|Zimmermädchen_Bursch|Zimmermädchen", "عامل/عاملة تنظيف الغرف"),
    (r"Zimmerbursch|Zimmerburschen|Stubenmädchen|Stubenbursch", "عامل/عاملة تنظيف الغرف"),
    (r"Zahlkellner_in|Zahlkellner|Zahlservierer", "نادل/نادلة تحصيل"),
    (r"Oberkellner", "رئيس النادلين"),
    (r"Barkellner|Barkeeper|Barmann|Barmann/-dame|Barmani", "بارمان"),
    (r"Kellner_in mit Inkasso|Kellner/in mit Inkasso|Kellner/in ohne Inkasso", "نادل/نادلة مع تحصيل"),
    (r"Kellner_innen|Kellner/innen|Kellner/in|Kellner_in|Kellner", "نادل/نادلة"),
    (r"Abwäscher_in|Abwäscher|Abwascher_in|Abwascher", "غاسل/غاسلة أطباق"),
    (r"Rezeptionist\(en\)innen|Rezeptionist_in|Rezeptionist", "موظف/موظفة استقبال"),
    (r"Rezeptionsmitarbeiter", "موظف/موظفة استقبال"),
    (r"Empfangsmitarbeiter", "موظف/موظفة استقبال"),
    (r"Reinigungskraft", "عامل/عاملة نظافة"),
    (r"Reinigungshelfer", "مساعد/مساعدة نظافة"),
    (r"Housekeeping Attendant|Housekeeping", "التدبير المنزلي"),
    (r"Hausdame|Housekeeper", "مشرفة الغرف"),
    (r"Pizzakoch_köchin|Pizzakoch / Pizzaköchin|Pizzakoch|Pizzabäcker_in|Pizzabäcker|Pizzař", "طباخ/طباخة بيتزا"),
    (r"Pizzazusteller", "موزع بيتزا"),
    (r"Jungkoch_köchin|Jungkoch", "طباخ/طباخة مبتدئ"),
    (r"Beikoch_köchin|Beikoch|Hilfskoch_köchin|Hilfskoch", "طاهٍ/طاهية مساعد"),
    (r"Alleinkoch", "طباخ/طباخة متكفّل وحده"),
    (r"Küchenchef_in|Küchenchef|Souschef_in|Souschef|Sous Chef|Souchef_in|Souchef", "رئيس/رئيسة الطهاة"),
    (r"Commis de Cuisine", "مساعد/مساعدة في المطبخ"),
    (r"Commis de rang", "مساعد/مساعدة خدمة الصالة"),
    (r"Chef de Partie|Chef de partie|Chef de Bar", "شيف قسم"),
    (r"Chef de rang", "شيف خدمة الصالة"),
    (r"Küchenleiter_in|Küchenleiter", "مدير/مديرة المطبخ"),
    (r"Küchenhilfskraft|Küchenhilfe|Küchenmädchen|Küchengehilfe", "مساعد/مساعدة مطبخ"),
    (r"Küchenkraft|Küchenhelfer", "عامل/عاملة مطبخ"),
    (r"Speisenträger_in|Speisenträger|Essenzusteller|Essenzusteller", "موزع/موزعة وجبات"),
    (r"Buffetkraft", "عامل/عاملة بوفيه"),
    (r"Thekenkraft", "عامل/عاملة منضدة"),
    (r"Schankbursch|Schankmädchen|Schankhilfe|Schankgehilf", "مساعد/مساعدة بار"),
    (r"Barkellner|Barkeeper|Barmann|Barmann/-dame|Barmani", "بارمان"),
    (r"Bar Manager", "مدير/مديرة بار"),
    (r"Barista", "عامل/عاملة قهوة (باريستا)"),
    (r"Imbissstandbetreuer", "مشرف/مشرفة كشك طعام"),
    (r"Gastgewerbliche Hilfskraft|Gastgewerbliche Hilfskräfte", "مساعد/مساعدة في قطاع الضيافة"),
    (r"Hilfskraft", "مساعد/مساعدة"),
    (r"Kinderbetreuer", "مشرف/مشرفة أطفال"),
    (r"Masseur_in|Masseurin|Masseur", "معالج/معالجة بالتدليك"),
    (r"Kosmetiker_in|Kosmetiker", "أخصائي/أخصائية تجميل"),
    (r"Buchhalter", "محاسب/محاسبة"),
    (r"Verkaufshelfer|Verkäufer", "بائع/بائعة"),
    (r"Kassenkraft|Kassierer", "موظف/موظفة صندوق"),
    (r"Koch_Köchin|Koch und Köchin|Koch oder Köchin|Koch/Köchin|Koch / Köchin|KÖCHIN:KOCH|Koch_Köchin|Köchin/Koch", "طباخ/طباخة"),
    (r"Köch\(e\)innen|Köche_Köchinnen|Köchinnen", "طباخون/طباخات"),
    (r"Koch\b|Köchin\b", "طباخ/طباخة"),
    (r"Mitarbeiter_in im Service|Mitarbeiter_in Service|Mitarbeiter/in im Service|Mitarbeiter Service|Mitarbeiter_in in der Reinigung|Mitarbeiter_in Reinigung|Mitarbeiter/in in der Reinigung|Mitarbeiter_in Housekeeping|Mitarbeiter Housekeeping|Mitarbeiter/in Housekeeping|Mitarbeiter_in Küche|Mitarbeiter Küche|Mitarbeiter_in Rezeption|Mitarbeiter Rezeption", "موظف/موظفة"),
    (r"Mitarbeiter_in|Mitarbeiter/in|Mitarbeiter:in|Mitarbeiter", "موظف/موظفة"),
    (r"Helfer/in - Küche|Helfer_in Küche|Helfer/in - Gastgewerbe|Helfer/in - Reinigung|Helfer/in - Hotel", "مساعد/مساعدة"),
    (r"Hausmeister_in|Hausmeister", "حارس/مشرف مبنى"),
    (r"Haustechniker_in|Haustechniker", "تقني/تقنية المباني"),
    (r"Hotel- und Gastgewerbeassistent", "مساعد/مساعدة في قطاع الفنادق والضيافة"),
    (r"Hotelfachmann/-frau|Hotelfachmann", "أخصائي/أخصائية فنادق"),
    (r"Fachmann/-frau - Restaurants und Veranstaltungsgastronomie", "متخصص/متخصصة في المطاعم وضيافة الفعاليات"),
    (r"Kaufmann/-frau - Tourismus und Freizeit", "متخصص/متخصصة في السياحة والترفيه"),
    (r"Fachangestellte/r - Bäderbetriebe", "موظف/موظفة مرافق الاستحمام"),
    (r"Night Auditor", "مدقق/مدققة ليلي"),
    (r"Restaurant Manager", "مدير/مديرة مطعم"),
    (r"Business Automation Executive", "مسؤول/مسؤولة أتمتة الأعمال"),
    (r"Payroll Specialist", "أخصائي/أخصائية رواتب"),
    (r"Social Media & Digital Marketing Executive", "مسؤول/مسؤولة التواصل الرقمي والتسويق"),
    (r"Direktionsassistent|Assistent/in der Geschäftsleitung|Assistent der Geschäftsleitung", "مساعد/مساعدة الإدارة"),
    (r"Büroassistent|Bürokraft", "موظف/موظفة مكتب"),
    (r"Anlagenmechaniker", "ميكانيكي/ميكانيكية تركيبات"),
    (r"Verwaltung", "الإدارة"),
    # Additional recurring / unique titles
    (r"Commis Chef", "مساعد شيف"),
    (r"Servierkassier|SERVIERKASSIER", "نادل/نادلة تحصيل"),
    (r"Chefs de rang", "شيف خدمة الصالة"),
    (r"Reinigungskräfte", "عمال النظافة"),
    (r"Reinigungspersonal", "عمال النظافة"),
    (r"Reinigungstechniker", "تقني/تقنية تنظيف"),
    (r"Pomoc kuchenna", "مساعد/مساعدة مطبخ"),
    (r"Hausbursch|Haushilfsarbeiterin", "عامل/عاملة خدمات"),
    (r"Equipier\(ère\) polyvalent\(e\) de restauration rapide", "عامل/عاملة متعدد المهام في الوجبات السريعة"),
    (r"Lieferant|Essenszusteller|Essenzusteller", "موزع/موزعة وجبات"),
    (r"Reservierungsassistent", "مساعد/مساعدة حجوزات"),
    (r"Guest Service Agent", "موظف/موظفة خدمة ضيوف"),
    (r"Etagenleiter|Etagengouvernante", "مشرف/مشرفة الطوابق"),
    (r"Bankettleiter", "مدير/مديرة الولائم"),
    (r"Schankkraft|Schank- und Buffetgehilf", "عامل/عاملة بار"),
    (r"Gastgeber:in|Gastgeber aus Leidenschaft", "مضيف/مضيفة"),
    (r"Allrounder im Gastgewerbe", "متعدد/متعددة المهارات في قطاع الضيافة"),
    (r"Allrounder", "متعدد/متعددة المهارات"),
    (r"Animateur", "منشط/منشطة"),
    (r"KFZ-Technik", "تقني/تقنية السيارات"),
    (r"Buffetkassier", "محصّل/محصّلة بوفيه"),
    (r"Cateringleiter", "مدير/مديرة تقديم الطعام"),
    (r"Foodrunner", "موزع/موزعة طعام"),
    (r"Aushilfe", "مساعدة مؤقتة"),
    (r"Restaurantservice", "خدمة المطعم"),
    (r"Servicepersonal", "فريق الخدمة"),
    (r"Elektriker", "كهربائي/كهربائية"),
    (r"Installateur", "تركيبات"),
    (r"Systemgastronomiefachmann|Systemgastronomiefachfrau", "متخصص/متخصصة المطاعم المنظمة"),
    (r"Event-Logistiker", "منسق/منسقة فعاليات"),
    (r"Abräumer", "عامل/عاملة ترتيب الطاولات"),
    (r"Servierhilfe", "مساعدة خدمة"),
    (r"Junior Sommelier|Sommelier", "سوميلييه"),
    (r"Einzelhandelskaufmann|Einzelhandelskauffrau", "بائع/بائعة تجزئة"),
    (r"Lagerarbeiter", "عامل/عاملة مستودع"),
    (r"LKW-Fahrer", "سائق/سائقة شاحنة"),
    (r"Verkaufskraft", "عامل/عاملة بيع"),
    (r"Nudel-Meister", "أخصائي/أخصائية معجنات"),
    (r"Pool- & Wellness-Steward|Pool- & Wellness-Stewardess", "عامل/عاملة المسبح والاسترخاء"),
    (r"Küchenassistent", "مساعد/مساعدة مطبخ"),
    (r"Finanz-Allrounder", "متعدد/متعددة المهارات المالية"),
    (r"Portier|Nachtportier", "بورتييه/بواب"),
    (r"Wäschereiarbeiter", "عامل/عاملة غسيل"),
    (r"Food-and-Beverage-Manager", "مدير/مديرة الطعام والشراب"),
    (r"Receptionist", "موظف/موظفة استقبال"),
    (r"Fitnesstrainer", "مدرب/مدربة لياقة"),
    (r"HGA-Assistent|Hotel- und Gastgewerbeassistent", "مساعد/مساعدة في قطاع الفنادق والضيافة"),
    (r"Rezeptionsleitung|Reservierungschef", "إدارة الاستقبال"),
    (r"Pool- & Wellness-Steward", "عامل/عاملة المسبح والاسترخاء"),
    (r"Abend-Profi im Service", "محترف/محترفة خدمة مسائية"),
    (r"Elektriker_in und Installateur_in", "كهربائي/كهربائية وتركيبات"),
    (r"Buffet- und Schankhilfe", "مساعدة بوفيه وبار"),
    (r"allrounderstelle", "وظيفة متعددة المهارات"),
    (r"vollmotivierte", "شغوف/شغوفة ومتحمس/متحمسة"),
    (r"Gastgeber aus Leidenschaft", "مضيف/مضيفة بشغف"),
    (r"nachtportier\(e\)in", "بواب/بوابة ليلي"),
    (r"fachmann/-frau", "متخصص/متخصصة"),
    (r"Restaurantfachmann.*Restaurantfachfrau|Restaurantfachmann_-frau|Restaurantfachmann/-Restaurantfachfrau", "متخصص/متخصصة في المطاعم"),
    (r"Servicekräfte", "عمال الخدمة"),
    (r"Service & Rezeption", "خدمة واستقبال"),
    (r"Hilfe im Café Küche", "مساعدة في مطبخ المقهى"),
    (r"Landwirtschaftlich\(er\)e Hilfsarbeiter", "عامل/عاملة زراعية مساعدة"),
    (r"Lieferfahrer", "سائق/سائقة توصيل"),
    (r"Autobuslenker", "سائق/سائقة حافلة"),
    (r"Hulpkok", "مساعد/مساعدة طباخ"),
    (r"Team Leader", "قائد/قائدة فريق"),
    (r"ASSISTANT OPERATIONS MANAGER", "مساعد/مساعدة مدير العمليات"),
    (r"Řidič rozvoz jídel", "سائق/سائقة توصيل وجبات"),
    (r"Řidiči osobních", "سائقو السيارات"),
    (r"Prodavači v prodejnách", "بائعو المتاجر"),
    (r"PRŮVODCE|Průvodci", "مرشد/مرشدة"),
    (r"Marketing & Communication Manager", "مسؤول/مسؤولة التسويق والتواصل"),
    (r"Cluster IT Specialist", "أخصائي/أخصائية أنظمة معلوماتية"),
    # Czech
    (r"Pomocný kuchař/pomocná kuchařka|Pomocný kuchař/ka|Pomocný kuchař|pomocný kuchař|Pomocník v kuchyni|Pomocník/Pomocnice v kuchyni|Pomocníci v kuchyni|Pomocná síla v kuchyni|Pomocná síla do kuchyně|Pomocná síla|POMOCNÁ SÍLA DO KUCHYNĚ|POMOCNÍK/POMOCNICE V KUCHYNI|Pomocní kuchaři", "مساعد/مساعدو طباخ"),
    (r"Číšníci a servírky|ČÍŠNÍK / SERVÍRKA|číšník/ servírka|Číšník/servírka|Číšník, servírka|Servírka - Číšník|servírka / číšník|Číšník", "نادل/نادلة"),
    (r"KUCHAŘ/KA|KUCHAŘ - KA|KUCHAŘ / KUCHAŘKA|Kuchař/kuchařka|Kuchař/ka|kuchař/ka|Kuchař - kuchařka|Kuchaři", "طباخون/طباخات"),
    (r"KUCHAŘ|Kuchař\b", "طباخ/طباخة"),
    (r"Recepční v hotelích|Noční recepční|RECEPČNÍ|Recepční\b", "موظف/موظفة استقبال"),
    (r"Pokojská", "عاملة تنظيف الغرف"),
    (r"Uklízeči a pomocníci|Uklízeč/ka|Uklízeči|Uklízeč", "عامل/عاملة نظافة"),
    (r"Pracovníci pro přípravu rychlého občerstvení|Pracovníci restauračního provozu|Obsluha v zařízeních rychlého občerstvení|OBSLUHA V ZAŘÍZENÍ RYCHLÉHO OBČERSTVENÍ|Obsluha v rychlém občerstvení|OBSLUHA BISTRA|Obsluha", "عامل/عاملة وجبات سريعة"),
    (r"Pracovníci pro přípravu rychlého občerstvení", "عاملو تحضير الوجبات السريعة"),
    (r"Ostatní pracovníci pro přípravu rychlého občerstvení", "عمال آخرون لتحضير الوجبات السريعة"),
    (r"Masér/ka|Masér", "معالج/معالجة بالتدليك"),
    (r"Prodavači potravinářského zboží", "بائعو المواد الغذائية"),
    (r"Administrativní pracovník|Všeobecní administrativní pracovníci", "موظف/موظفة إداري"),
    (r"Ostatní uklízeči a pomocníci", "عمال نظافة آخرون"),
    (r"kuchař/ka, Šéfkuchaři v hotelových restauracích", "طباخ/طباخة - رئيس طهاة في مطاعم الفنادق"),
    (r"Pizzař/ka", "طباخ/طباخة بيتزا"),
    # Slovenian
    (r"SLAŠČIČAR", "حلواني/حلوانية"),
    (r"NATAKAR", "نادل/نادلة"),
    (r"KUHAR", "طباخ/طباخة"),
    (r"POMOČ V KUHINJI", "مساعدة في المطبخ"),
    # Finnish
    (r"Tarjoilija", "نادل/نادلة"),
    (r"Ravintolatyöntekijä", "عامل/عاملة مطعم"),
    (r"Kokki", "طباخ/طباخة"),
    # Greek
    (r"ΒΟΗΘΟΣ ΚΟΥΖΙΝΑΣ", "مساعد/مساعدة مطبخ"),
]

TITLE_STRIP = [
    (r"\(m/w/d\)", ""), (r"\(w/m/d\)", ""), (r"\(m/w/x\)", ""), (r"\(w/m/x\)", ""),
    (r"\(m./w.\)", ""), (r"\(w./m./d.\)", ""), (r"\(m./w./d\.\)", ""), (r"\(m./w./d\)", ""),
    (r"\(m./w./x\.\)", ""), (r"\(m/ž\)", ""), (r"\(m./w.\)", ""),
    (r"m/w/d", ""), (r"m/w/x", ""), (r"w/m/d", ""),
    (r"\bM/Ž\b", ""), (r"\bm/w\b", ""), (r"\bH/F\b", ""),
    (r"\(m/w\)", ""),
]

# Exact-title lookup normalization (must match the keys authored in
# tools/title_translations_*.py).
_TITLE_EXACT_PATS = [
    (r"\(m/w/d\)", " "), (r"\(w/m/d\)", " "), (r"\(m/w/x\)", " "), (r"\(w/m/x\)", " "),
    (r"\(m./w.\)", " "), (r"\(w./m./d.\)", " "), (r"\(m./w./d\.\)", " "), (r"\(m./w./d\)", " "),
    (r"\(m./w./x\.\)", " "), (r"\(m/ž\)", " "), (r"\(m./w.\)", " "),
    (r"m/w/d", " "), (r"m/w/x", " "), (r"w/m/d", " "), (r"m/w", " "),
    (r"\bM/Ž\b", " "), (r"\bm/w\b", " "), (r"\bH/F\b", " "), (r"\(m/w\)", " "),
    (r"\(H/F\)", " "), (r"\(M/V\)", " "), (r"\(M/V/X\)", " "), (r"\(m/v/x\)", " "),
    (r"\(M/Ž\)", " "), (r"\(K/M\)", " "), (r"\(k/m\)", " "),
]


def _title_exact_key(t):
    t = t.strip()
    for p, r in _TITLE_EXACT_PATS:
        t = re.sub(p, " ", t, flags=re.I)
    t = re.sub(r"\s+", " ", t).strip(" -/_,;:()")
    return t.lower()


def translate_title(raw):
    t = raw.strip()
    if not t:
        return ""
    key = _title_exact_key(t)
    if key in TITLE_EXACT:
        return TITLE_EXACT[key]
    for pat, rep in TITLE_STRIP:
        t = re.sub(pat, " ", t, flags=re.I)
    t = re.sub(r"\s{2,}", " ", t).strip(" -/_,;:()")
    for pat, rep in TITLE_RULES:
        if re.search(pat, t, flags=re.I):
            t = re.sub(pat, rep, t, flags=re.I)
            break
    t = re.sub(r"\s{2,}", " ", t).strip(" -/_,;:()")
    # Gender variants that survived: _in / /in suffix (German female form)
    t = re.sub(r"(?<=\S)(_in|/in|/innen|_innen)\b", "", t)
    # Drop leftover foreign parenthetical remnants — but keep any group that
    # already contains Arabic (never destroy translated content).
    t = re.sub(r"\([^()]*\)?", lambda m: m.group(0) if re.search(r"[\u0600-\u06FF]", m.group(0)) else "", t)
    # Drop gender/classification suffixes glued with a slash (Zimmermädchen/-bursch…)
    t = re.sub(r"/-(?:bursch(?:en)?|köchin|köchinnen)\b", "", t, flags=re.I)
    t = re.sub(r"\s{2,}", " ", t).strip(" -/_,;:()")
    return t.strip() or raw.strip()


# ---------------------------------------------------------------------------
# Description translation: phrases (longest first) then word dictionary
# ---------------------------------------------------------------------------

DESC_PHRASES = [
    # Salary boilerplate (handled by regex below too)
    ("das mindestentgelt für die stelle als", "الحد الأدنى للأجر لهذه الوظيفة"),
    ("das mindestentgelt für die stellen als", "الحد الأدنى للأجر لهذه الوظائف"),
    ("mindestentgelt für die stelle als", "الحد الأدنى للأجر لوظيفة"),
    ("eur brutto pro monat auf basis vollzeitbeschäftigung", "يورو شهرياً إجمالاً على أساس دوام كامل"),
    ("eur brutto pro monat", "يورو شهرياً إجمالاً"),
    ("brutto pro monat auf basis vollzeitbeschäftigung", "إجمالاً شهرياً على أساس دوام كامل"),
    ("auf basis vollzeitbeschäftigung", "على أساس دوام كامل"),
    # Application / contact boilerplate
    ("wir freuen uns auf ihre aussagekräftigen bewerbungsunterlagen", "نتطلع إلى استلام ملف طلبكم الكامل"),
    ("wir freuen uns auf ihre aussagekräftige bewerbung", "نتطلع إلى استلام طلبكم الكامل"),
    ("wir freuen uns auf deine bewerbung", "نتطلع إلى استلام طلبك"),
    ("wir freuen uns auf ihre bewerbung", "نتطلع إلى استلام طلبكم"),
    ("wir freuen uns darauf, sie kennenzulernen", "يسعدنا أن نتعرف عليكم"),
    ("wir freuen uns darauf, dich kennenzulernen", "يسعدنا أن نتعرف عليك"),
    ("dann freuen wir uns auf deine bewerbung", "إذن نتطلع إلى استلام طلبك"),
    ("dann freuen wir uns auf ihre bewerbung", "إذن نتطلع إلى استلام طلبكم"),
    ("dann freuen wir uns darauf, dich kennenzulernen", "إذن يسعدنا أن نتعرف عليك"),
    ("dann freuen wir uns darauf, sie kennenzulernen", "إذن يسعدنا أن نتعرف عليكم"),
    ("wir freuen uns, dich kennenzulernen", "يسعدنا أن نتعرف عليك"),
    ("dann bist du bei uns genau richtig", "إذن أنت الشخص المناسب لدينا"),
    ("dann sind sie bei uns genau richtig", "إذن أنتم الأشخاص المناسبون لدينا"),
    ("haben wir ihr interesse geweckt", "هل أثار هذا اهتمامكم"),
    ("haben wir dein interesse geweckt", "هل أثار هذا اهتمامك"),
    ("wir haben ihr interesse geweckt", "لقد أثار هذا اهتمامكم"),
    ("dann bewerben sie sich jetzt", "إذن تقدم الآن"),
    ("bitte senden sie ihre bewerbungsunterlagen an", "يرجى إرسال ملف طلبكم إلى"),
    ("bitte senden sie ihre vollständigen bewerbungsunterlagen", "يرجى إرسال ملف طلبكم الكامل"),
    ("bitte senden sie ihre unterlagen per e-mail an", "يرجى إرسال مستنداتكم عبر البريد الإلكتروني إلى"),
    ("bitte senden sie ihre bewerbung per e-mail an", "يرجى إرسال طلبكم عبر البريد الإلكتروني إلى"),
    ("bitte senden sie ihre unterlagen an", "يرجى إرسال مستنداتكم إلى"),
    ("bitte senden sie ihre schriftlichen bewerbungsunterlagen per e-mail an", "يرجى إرسال ملف طلبكم المكتوب عبر البريد الإلكتروني إلى"),
    ("bitte bewerben sie sich nach telefonischer terminvereinbarung bei", "يرجى التقديم بعد الاتفاق على موعد عبر الهاتف لدى"),
    ("bewerbungen bitte per e-mail an", "التقديمات يرجى إرسالها عبر البريد الإلكتروني إلى"),
    ("dann bewerben sie sich gleich per mail unter", "إذن تقدم فوراً عبر البريد على"),
    ("bewirb dich jetzt", "تقدم الآن"),
    ("zur verstärkung unseres teams suchen wir ab sofort", "نبحث فوراً لتعزيز فريقنا عن"),
    ("zur verstärkung unseres teams suchen wir", "نبحث لتعزيز فريقنا عن"),
    ("wir suchen zur verstärkung unseres teams", "نبحث لتعزيز فريقنا"),
    ("wir suchen verstärkung für unser team", "نبحث عن تعزيز لفريقنا"),
    ("wir suchen menschen, die", "نبحث عن أشخاص"),
    ("wir suchen ab sofort einen", "نبحث فوراً عن"),
    ("wir suchen ab sofort", "نبحث فوراً"),
    ("wir suchen", "نبحث عن"),
    # Structure headers
    ("anforderungsprofil", "ملف المتطلبات"),
    ("anforderungen an den bewerber", "المتطلبات من المتقدم"),
    ("anforderungen", "المتطلبات"),
    ("aufgabenbereich", "مجال المهام"),
    ("aufgaben", "المهام"),
    ("kontaktdaten", "معلومات التواصل"),
    ("kontakt", "التواصل"),
    ("benefits, die wir bieten", "المزايا التي نقدمها"),
    ("wir bieten ihnen", "نقدم لكم"),
    ("wir bieten dir", "نقدم لك"),
    ("wir bieten", "نقدم"),
    ("dein aufgabenbereich", "مجال مهامك"),
    ("das bringst du mit", "ما تحمله من مؤهلات"),
    ("das sollten sie mitbringen", "ما يجب أن تحملوه من مؤهلات"),
    ("wir erwarten", "نتوقع"),
    ("erwartet", "متوقع"),
    # Job attributes
    ("vollzeitbeschäftigung", "عمل بدوام كامل"),
    ("vollzeitanstellung", "توظيف بدوام كامل"),
    ("teilzeitbeschäftigung", "عمل بدوام جزئي"),
    ("unbefristete beschäftigung", "عمل غير محدد المدة"),
    ("ganzjahresstelle", "وظيفة طوال السنة"),
    ("jahresstelle", "وظيفة سنوية"),
    ("saisonstelle", "وظيفة موسمية"),
    ("wintersaison", "موسم الشتاء"),
    ("sommer- & wintersaison", "موسم الصيف والشتاء"),
    ("ab sofort", "ابتداءً من الآن"),
    ("arbeitszeiten und freie tage nach absprache", "أوقات العمل وأيام الراحة حسب الاتفاق"),
    ("arbeitszeit", "وقت العمل"),
    ("arbeitszeiten", "أوقات العمل"),
    ("arbeitsbeginn", "بداية العمل"),
    ("eintrittstermin", "موعد الالتحاق"),
    ("dienstplan", "جدول العمل"),
    ("dienstzeiten", "أوقات الخدمة"),
    ("öffnungszeiten", "أوقات الافتتاح"),
    ("wochenenddienst", "العمل في نهاية الأسبوع"),
    ("wochenenden", "نهاية الأسبوع"),
    ("feiertagen", "أيام العطل"),
    ("feiertage", "أيام العطل"),
    ("ruhetag", "يوم الراحة"),
    ("tagewoche", "أيام عمل في الأسبوع"),
    ("wochenstunden", "ساعة أسبوعياً"),
    ("stunden pro woche", "ساعة في الأسبوع"),
    ("unterkunft und verpflegung", "الإقامة والطعام"),
    ("unterkunft", "الإقامة"),
    ("verpflegung", "الطعام"),
    ("kostenlose unterbringung", "إقامة مجانية"),
    ("arbeitskleidung", "ملابس العمل"),
    ("überstunden", "ساعات العمل الإضافية"),
    ("überstundenzuschläge", "بدلات ساعات العمل الإضافية"),
    ("berufserfahrung", "الخبرة المهنية"),
    ("erfahrung", "الخبرة"),
    ("abgeschlossene berufsausbildung", "تكوين مهني مكتمل"),
    ("berufsausbildung", "تكوين مهني"),
    ("ausbildung", "التكوين"),
    ("deutschkenntnisse in wort und schrift", "معرفة باللغة الألمانية كتابة وشفهياً"),
    ("deutschkenntnisse", "معرفة باللغة الألمانية"),
    ("englischkenntnisse", "معرفة باللغة الإنجليزية"),
    ("gute deutsch- und englischkenntnisse", "معرفة جيدة بالألمانية والإنجليزية"),
    ("grundkenntnisse", "معرفة أساسية"),
    ("kenntnisse", "معرفة"),
    ("teamfähigkeit", "روح الفريق"),
    ("teamgeist", "روح الفريق"),
    ("zuverlässigkeit", "الموثوقية"),
    ("zuverlässige", "موثوق"),
    ("belastbarkeit", "القدرة على تحمل الضغط"),
    ("körperliche belastbarkeit", "قدرة جسدية على التحمل"),
    ("flexibilität", "المرونة"),
    ("flexible arbeitszeiten", "أوقات عمل مرنة"),
    ("kommunikation", "التواصل"),
    ("verantwortung", "المسؤولية"),
    ("verantwortungsbewusstsein", "حس المسؤولية"),
    ("organisationstalent", "موهبة التنظيم"),
    ("selbstständige arbeitsweise", "أسلوب عمل مستقل"),
    ("strukturierte arbeitsweise", "أسلوب عمل منظم"),
    ("freundliches auftreten", "مظهر ودود"),
    ("gepflegtes erscheinungsbild", "مظهر أنيق"),
    ("hygienevorschriften", "قواعد النظافة"),
    ("hygienestandards", "معايير النظافة"),
    ("lebensmittelhygiene", "نظافة المواد الغذائية"),
    ("einhaltung der hygienevorschriften", "الالتزام بقواعد النظافة"),
    ("führerschein", "رخصة السياقة"),
    ("pkw-führerschein", "رخصة سياقة خاصة"),
    ("quereinsteiger", "الانتقال إلى المجال من قطاع آخر"),
    ("erfahrung von vorteil", "الخبرة تعتبر ميزة"),
    ("wünschenswert", "مستحب"),
    ("erforderlich", "مطلوب"),
    ("vorteil", "ميزة"),
    # Tasks
    ("speisen zubereiten und anrichten", "تحضير وتقديم الأطباق"),
    ("zubereitung der speisen", "تحضير الأطباق"),
    ("speisen zubereiten", "تحضير الأطباق"),
    ("anrichten der speisen", "تقديم الأطباق"),
    ("zubereiten und anrichten", "التحضير والتقديم"),
    ("speisen", "الأطباق"),
    ("getränke", "المشروبات"),
    ("gästebetreuung", "رعاية الضيوف"),
    ("gästekontakt", "التواصل مع الضيوف"),
    ("servicebereich", "مجال الخدمة"),
    ("speiseservice", "خدمة الطعام"),
    ("restaurantservice", "خدمة المطعم"),
    ("getränkeservice", "خدمة المشروبات"),
    ("kassieren", "التحصيل والفوترة"),
    ("abrechnung", "المحاسبة"),
    ("reservierungen", "الحجوزات"),
    ("bestellungen", "الطلبات"),
    ("geschirrreinigung", "غسل الأطباق"),
    ("küchenreinigung", "تنظيف المطبخ"),
    ("reinigungsarbeiten", "أعمال التنظيف"),
    ("zimmerreinigung", "تنظيف الغرف"),
    ("gästezimmerreinigung", "تنظيف غرف الضيوف"),
    ("warenannahme", "استلام البضائع"),
    ("lagerung", "التخزين"),
    ("kontrolle", "المراقبة"),
    ("durchführung", "التنفيذ"),
    ("koordination", "التنسيق"),
    ("planung", "التخطيط"),
    ("organisation", "التنظيم"),
    ("erstellung", "الإعداد"),
    ("bearbeitung", "المعالجة"),
    ("verwaltung", "الإدارة"),
    ("leitung", "القيادة"),
    ("einarbeitung", "التدريب على العمل"),
    ("einschulung", "التدريب"),
    ("einweisung", "التوجيه"),
    ("möglichkeit", "إمكانية"),
    ("möglichkeiten", "إمكانيات"),
    ("weiterbildungsmöglichkeiten", "فرص التكوين المستمر"),
    ("weiterbildungen", "تكوينات إضافية"),
    ("weiterbildung", "تكوين مستمر"),
    ("entwicklungsmöglichkeiten", "فرص التطور"),
    ("karriere", "المسار المهني"),
    ("aufstiegsmöglichkeiten", "فرص الترقي"),
    # Company / environment
    ("familiengeführtes hotel", "فندق تديره عائلة"),
    ("familienbetrieb", "مشروع عائلي"),
    ("familiengeführt", "تديره عائلة"),
    ("familäres arbeitsklima", "مناخ عمل عائلي"),
    ("familiäres arbeitsklima", "مناخ عمل عائلي"),
    ("angenehmes arbeitsklima", "مناخ عمل لطيف"),
    ("kollegiales arbeitsklima", "مناخ عمل قائم على الزمالة"),
    ("arbeitsklima", "مناخ العمل"),
    ("betriebsklima", "مناخ المؤسسة"),
    ("arbeitsumfeld", "بيئة العمل"),
    ("umfeld", "البيئة"),
    ("team", "الفريق"),
    ("mitarbeiter", "الموظفون"),
    ("mitarbeitern", "الموظفين"),
    ("gäste", "الضيوف"),
    ("gästen", "للضيوف"),
    ("menschen", "الأشخاص"),
    ("kollegen", "الزملاء"),
    ("unternehmen", "الشركة"),
    ("betrieb", "المؤسسة"),
    ("betriebe", "المؤسسات"),
    ("arbeitgeber", "صاحب العمل"),
    ("dienstgeber", "صاحب العمل"),
    ("arbeitsvertrag", "عقد العمل"),
    ("arbeitsplatz", "مكان العمل"),
    ("arbeitsort", "مكان العمل"),
    ("standort", "الموقع"),
    ("leistungsgerechte entlohnung", "أجر حسب الأداء"),
    ("leistungsbezogene vergütung", "تعويض مرتبط بالأداء"),
    ("überzahlung", "زيادة في الأجر"),
    ("bereitschaft zur überzahlung", "استعداد لزيادة الأجر"),
    ("kollektivvertrag", "الاتفاقية الجماعية"),
    ("entlohnung", "الأجر"),
    ("bezahlung", "الأجر"),
    ("gehalt", "الراتب"),
    ("vergütung", "التعويض"),
    ("lohn", "الأجر"),
    ("zukunft", "المستقبل"),
    ("wertschätzung", "التقدير"),
    ("wertschätzendes", "مُقَدِّر"),
    ("zusammenarbeit", "التعاون"),
    ("miteinander", "مع بعضنا البعض"),
    ("herzlichkeit", "الودّ"),
    ("herzliches", "ودود"),
    ("leidenschaft", "الشغف"),
    ("freude an der arbeit", "متعة في العمل"),
    ("motivation", "الحافز"),
    ("engagement", "الالتزام"),
    ("kreativität", "الإبداع"),
    ("ideen", "الأفكار"),
    ("qualität", "الجودة"),
    ("qualitätsstandards", "معايير الجودة"),
    ("hochwertige", "عالي الجودة"),
    ("moderne", "حديث"),
    ("modernes", "حديث"),
    ("modernen", "حديثة"),
    ("tradition", "التقليد"),
    ("regionale produkte", "منتجات محلية"),
    ("frische produkte", "منتجات طازجة"),
    ("produkte", "المنتجات"),
    ("zutaten", "المكونات"),
    ("gemüse", "الخضروات"),
    ("frisch", "طازج"),
    ("genuss", "المتعة"),
    # Days
    ("montag", "الاثنين"), ("dienstag", "الثلاثاء"), ("mittwoch", "الأربعاء"),
    ("donnerstag", "الخميس"), ("freitag", "الجمعة"), ("samstag", "السبت"),
    ("sonntag", "الأحد"),
    # English boilerplate (IE / ZAV)
    ("please review the eligibility and requirements for an employment permit if you are unsure of your eligibility to apply for this vacancy", "يرجى مراجعة شروط الأهلية ومتطلبات تصريح العمل إذا لم تكن متأكداً من أهليتك للتقديم على هذه الوظيفة"),
    ("in order to work in ireland a non-eea national, unless they are exempted, must hold a valid employment permit", "للعمل في أيرلندا، يجب على المواطن من خارج المنطقة الاقتصادية الأوروبية، ما لم يكن معفى، أن يحمل تصريح عمل ساري المفعول"),
    ("we are a department of the german federal employment agency", "نحن قسم من وكالة التشغيل الفيدرالية الألمانية"),
    ("the international and specialized services will help you find a job in germany", "الخدمات الدولية والمتخصصة ستساعدك في إيجاد عمل في ألمانيا"),
    ("for applicants who have their permanent residence abroad", "للمتقدمين الذين يقيمون بشكل دائم في الخارج"),
    ("we will be happy to inform you", "سيسعدنا إخباركم"),
    ("this is a full time permanent position", "هذه وظيفة دائمة بدوام كامل"),
    ("this is an exciting opportunity to work in a professional environment where creativity, attention to detail and teamwork are highly valued", "هذه فرصة مثيرة للعمل في بيئة مهنية تُقدَّر فيها الإبداع والدقة والعمل الجماعي"),
    ("eu citizens may be eligible for financial assistance", "قد يكون مواطنو الاتحاد الأوروبي مؤهلين للحصول على مساعدة مالية"),
    ("eu-bürger/bürgerinnen können eventuell eine finanzielle hilfe bekommen", "قد يحصل مواطنو الاتحاد الأوروبي على مساعدة مالية"),
    # German intro boilerplate
    ("wir sind ein familiengeführtes", "نحن مشروع عائلي"),
    ("wir sind ein team aus", "نحن فريق من"),
    ("wir sind teil der staatlichen arbeitsagentur", "نحن جزء من وكالة التشغيل الحكومية"),
    ("wir sind ein schnell expandierendes unternehmen", "نحن شركة سريعة التوسع"),
    ("wir sind ein dynamisches team", "نحن فريق ديناميكي"),
    ("wir sind gesetzlich dazu verpflichtet", "نحن ملزمون قانونياً"),
    ("mitarbeiter/innen", "الموظفون"),
    ("mitarbeiter_innen", "الموظفون"),
    ("bewerber/innen", "المتقدمون"),
    ("bewerber/bewerberinnen", "المتقدمون"),
    # German generic words
    ("vielseitig", "متنوع"),
    ("abwechslungsreich", "متنوع"),
    ("weitere informationen", "مزيد من المعلومات"),
    ("ergänzende informationen", "معلومات إضافية"),
    ("informationen", "المعلومات"),
    ("ein herzliches miteinander", "ودّ متبادل"),
    ("die möglichkeit", "إمكانية"),
    ("ihre möglichkeit", "فرصتكم"),
    ("ganz einfach", "بكل بساطة"),
    ("wir freuen uns", "يسعدنا"),
    ("freuen uns", "يسعدنا"),
    ("wir stellen ein", "نوظّف"),
    ("wir stellen", "نوظّف"),
    ("stellt ein", "توظّف"),
    ("auf der suche nach", "في البحث عن"),
    ("sucht", "تبحث عن"),
    ("gesucht", "مطلوب"),
    # Frequent sentence-level phrases (data-driven, top occurrences)
    ("wir freuen uns auf motivierte, engagierte und zuverlässige bewerber_innen", "نتطلع إلى استلام طلبات المتقدمين المتحمسين والملتزمين والموثوقين"),
    ("wir freuen uns auf motivierte, engagierte und zuverlässige bewerber", "نتطلع إلى استلام طلبات المتقدمين المتحمسين والملتزمين والموثوقين"),
    ("sie möchten gerne ein mitglied in unserem team werden", "هل ترغب في أن تصبح عضواً في فريقنا"),
    ("dann werden sie teil unseres teams", "إذن ستصبحون جزءاً من فريقنا"),
    ("wir freuen uns darauf, sie persönlich kennenzulernen", "يسعدنا أن نتعرف عليكم شخصياً"),
    ("wir freuen uns darauf, sie kennenzulernen", "يسعدنا أن نتعرف عليكم"),
    ("wir freuen uns darauf, dich kennenzulernen", "يسعدنا أن نتعرف عليك"),
    ("dann freuen wir uns darauf, sie kennenzulernen", "إذن يسعدنا أن نتعرف عليكم"),
    ("dann freuen wir uns darauf, dich kennenzulernen", "إذن يسعدنا أن نتعرف عليك"),
    ("klingt das gut", "إن بدا هذا جيداً"),
    ("wir freuen uns auf ihre bewerbung", "نتطلع إلى استلام طلبكم"),
    ("wir freuen uns auf deine bewerbung", "نتطلع إلى استلام طلبك"),
    ("wir freuen uns auf ihre aussagekräftige bewerbung", "نتطلع إلى استلام طلبكم الكامل"),
    ("wir freuen uns auf ihre aussagekräftigen bewerbungsunterlagen", "نتطلع إلى استلام ملف طلبكم الكامل"),
    ("dann freuen wir uns auf deine bewerbung", "إذن نتطلع إلى استلام طلبك"),
    ("dann freuen wir uns auf ihre bewerbung", "إذن نتطلع إلى استلام طلبكم"),
    ("dann bewerben sie sich jetzt", "إذن تقدم الآن"),
    ("bewerben sie sich jetzt", "تقدم الآن"),
    ("bewirb dich jetzt und werde teil unseres teams", "تقدم الآن وكن جزءاً من فريقنا"),
    ("bewirb dich jetzt", "تقدم الآن"),
    ("dann legst du richtig los", "إذن ابدأ فوراً"),
    ("dann legen sie los", "إذن ابدأوا"),
    ("wir suchen ab sofort", "نبحث فوراً عن"),
    ("wir suchen zur verstärkung unseres teams", "نبحث لتعزيز فريقنا"),
    ("wir suchen zur verstärkung unseres teams einen", "نبحث لتعزيز فريقنا عن"),
    ("zur verstärkung unseres teams suchen wir", "نبحث لتعزيز فريقنا عن"),
    ("zur verstärkung unseres teams suchen wir ab sofort", "نبحث فوراً لتعزيز فريقنا عن"),
    ("wir suchen verstärkung für unser team", "نبحث عن تعزيز لفريقنا"),
    ("wir suchen verstärkung für unser team und", "نبحث عن تعزيز لفريقنا"),
    ("wir suchen menschen, die", "نبحث عن أشخاص"),
    ("zur verstärkung unseres teams", "لتعزيز فريقنا"),
    ("zur verstärkung des teams", "لتعزيز الفريق"),
    ("sie werden teil unseres teams", "ستصبحون جزءاً من فريقنا"),
    ("werden sie teil unseres teams", "انضم إلى فريقنا"),
    ("wir sind ein familiengeführtes hotel", "نحن فندق تديره عائلة"),
    ("wir sind ein familiengeführtes 4 sterne hotel", "نحن فندق عائلي من 4 نجوم"),
    ("wir sind ein 4 sterne hotel", "نحن فندق من 4 نجوم"),
    ("wir sind ein team", "نحن فريق"),
    ("wir sind ein schnell expandierendes unternehmen", "نحن شركة سريعة التوسع"),
    ("wir sind ein erfolgreiches", "نحن مشروع ناجح"),
    ("unser hotel liegt", "يقع فندقنا"),
    ("das hotel liegt", "يقع الفندق"),
    ("das hotel befindet sich", "يقع الفندق"),
    ("in zentraler lage", "في موقع مركزي"),
    ("direkt im zentrum", "في قلب المركز"),
    ("mitten im zentrum", "في وسط المركز"),
    ("unser hotel", "فندقنا"),
    ("unser familienbetrieb", "مشروعنا العائلي"),
    ("wir verfügen über", "نمتلك"),
    ("wir bieten unseren mitarbeitern", "نقدم لموظفينا"),
    ("wir bieten ihnen", "نقدم لكم"),
    ("wir bieten dir", "نقدم لك"),
    ("wir bieten", "نقدم"),
    ("wir bieten eine dauerbeschäftigung", "نقدم عقد عمل دائم"),
    ("wir bieten ein", "نقدم"),
    ("wir bieten einen", "نقدم"),
    ("wir erwarten", "نتوقع"),
    ("was sie mitbringen", "ما تحملونه من مؤهلات"),
    ("was du mitbringst", "ما تحمله من مؤهلات"),
    ("das bringst du mit", "ما تحمله من مؤهلات"),
    ("das sollten sie mitbringen", "ما يجب أن تحملوه من مؤهلات"),
    ("ihre kompetenzen", "كفاءاتكم"),
    ("deine kompetenzen", "كفاءاتك"),
    ("wir legen wert auf", "نولي أهمية لـ"),
    ("wir wünschen uns", "نتمنى"),
    ("mitbringen", "إحضار"),
    ("von vorteil", "يعتبر ميزة"),
    ("ist von vorteil", "يعتبر ميزة"),
    ("wünschenswert", "مستحب"),
    ("erwünscht", "مرغوب فيه"),
    ("zwingend erforderlich", "إلزامي"),
    ("unbedingt erforderlich", "إلزامي"),
    ("grundkenntnisse", "معرفة أساسية"),
    ("deutschkenntnisse", "معرفة باللغة الألمانية"),
    ("englischkenntnisse", "معرفة باللغة الإنجليزية"),
    ("teamfähigkeit", "روح الفريق"),
    ("freundliches und gepflegtes auftreten", "مظهر ودود وأنيق"),
    ("gepflegtes erscheinungsbild", "مظهر أنيق"),
    ("selbstständige und strukturierte arbeitsweise", "أسلوب عمل مستقل ومنظم"),
    ("selbstständige arbeitsweise", "أسلوب عمل مستقل"),
    ("strukturierte arbeitsweise", "أسلوب عمل منظم"),
    ("körperliche belastbarkeit", "قدرة جسدية على التحمل"),
    ("hohe belastbarkeit", "قدرة عالية على التحمل"),
    ("einsatzbereitschaft", "الجاهزية للعمل"),
    ("verantwortungsbewusstsein", "حس المسؤولية"),
    ("zuverlässigkeit", "الموثوقية"),
    ("pünktlichkeit", "الدقة في المواعيد"),
    ("flexibilität", "المرونة"),
    ("belastbarkeit", "القدرة على التحمل"),
    ("kommunikationsfähigkeit", "مهارات التواصل"),
    ("kommunikation", "التواصل"),
    ("erfahrung in der gastronomie", "خبرة في قطاع المطاعم والفنادق"),
    ("erfahrung im service", "خبرة في الخدمة"),
    ("erfahrung in der küche", "خبرة في المطبخ"),
    ("mehrjährige berufserfahrung", "خبرة مهنية لعدة سنوات"),
    ("einschlägige berufserfahrung", "خبرة مهنية ذات صلة"),
    ("abgeschlossene berufsausbildung", "تكوين مهني مكتمل"),
    ("abgeschlossene ausbildung", "تكوين مكتمل"),
    ("abgeschlossene lehre", "تكوين مكتمل"),
    ("berufsausbildung", "التكوين المهني"),
    ("eine abgeschlossene berufsausbildung", "تكوين مهني مكتمل"),
    ("idealerweise", "من الأفضل"),
    ("von vorteil wäre", "سيكون ميزة"),
    ("bereitschaft zur überzahlung", "الاستعداد لزيادة الأجر"),
    ("bereitschaft zu überzahlung", "الاستعداد لزيادة الأجر"),
    ("überzahlung", "زيادة الأجر"),
    ("leistungsgerechte entlohnung", "أجر حسب الأداء"),
    ("leistungsbezogene vergütung", "تعويض مرتبط بالأداء"),
    ("übertarifliche bezahlung", "أجر يفوق الاتفاقية الجماعية"),
    ("übertarifliche entlohnung", "أجر يفوق الاتفاقية الجماعية"),
    ("die entlohnung richtet sich nach berufserfahrung", "يُحدد الأجر حسب الخبرة المهنية"),
    ("die entlohnung erfolgt", "يُحدد الأجر"),
    ("die entlohnung", "الأجر"),
    ("mindestentgelt", "الحد الأدنى للأجر"),
    ("kollektivvertrag", "الاتفاقية الجماعية"),
    ("auf basis vollzeitbeschäftigung", "على أساس دوام كامل"),
    ("vollzeitbeschäftigung", "عمل بدوام كامل"),
    ("teilzeitbeschäftigung", "عمل بدوام جزئي"),
    ("voll- oder teilzeit", "دوام كامل أو جزئي"),
    ("in voll- oder teilzeit", "بدوام كامل أو جزئي"),
    ("vollzeitstelle", "وظيفة بدوام كامل"),
    ("teilzeitstelle", "وظيفة بدوام جزئي"),
    ("ganzjährige beschäftigung", "عمل طوال السنة"),
    ("unbefristete beschäftigung", "عمل غير محدد المدة"),
    ("unbefristeter arbeitsvertrag", "عقد عمل غير محدد المدة"),
    ("ganzjahresstelle", "وظيفة طوال السنة"),
    ("saisonstelle", "وظيفة موسمية"),
    ("saisonbedingte", "موسمية"),
    ("saison- oder ganzjahresanstellung", "توظيف موسمي أو طوال السنة"),
    ("sommersaison", "موسم الصيف"),
    ("wintersaison", "موسم الشتاء"),
    ("sommer- und wintersaison", "موسم الصيف والشتاء"),
    ("winter- und sommersaison", "موسم الشتاء والصيف"),
    ("im sommer und winter", "في الصيف والشتاء"),
    ("5-tage-woche", "5 أيام عمل في الأسبوع"),
    ("6-tage-woche", "6 أيام عمل في الأسبوع"),
    ("tagewoche", "أيام عمل في الأسبوع"),
    ("arbeitszeit nach absprache", "وقت العمل حسب الاتفاق"),
    ("arbeitszeiten nach absprache", "أوقات العمل حسب الاتفاق"),
    ("arbeitszeit und freie tage nach absprache", "وقت العمل وأيام الراحة حسب الاتفاق"),
    ("arbeitstage nach absprache", "أيام العمل حسب الاتفاق"),
    ("flexible arbeitszeiten", "أوقات عمل مرنة"),
    ("geregelte arbeitszeiten", "أوقات عمل منتظمة"),
    ("geregelte arbeitszeiten und vorausschauende dienstplanung", "أوقات عمل منتظمة وجدولة مسبقة للعمل"),
    ("dienstplan", "جدول العمل"),
    ("dienstplanung", "جدولة العمل"),
    ("wochenenddienst", "العمل في نهاية الأسبوع"),
    ("bereitschaft zum wochenenddienst", "الاستعداد للعمل في نهاية الأسبوع"),
    ("wochenendarbeit", "عمل نهاية الأسبوع"),
    ("feiertagsarbeit", "العمل في أيام العطل"),
    ("überstunden werden abgegolten", "يتم تعويض ساعات العمل الإضافية"),
    ("überstunden werden ausbezahlt", "يتم دفع ساعات العمل الإضافية"),
    ("überstunden kommen auf ein zeitkonto", "تسجل ساعات العمل الإضافية في حساب الوقت"),
    ("überstunden", "ساعات العمل الإضافية"),
    ("trinkgeld", "الإكرامية"),
    ("verpflegung ist kostenlos", "الطعام مجاني"),
    ("unterkunft und verpflegung", "الإقامة والطعام"),
    ("unterkunft und verpflegung ist frei", "الإقامة والطعام مجانيان"),
    ("kostenlose unterkunft", "إقامة مجانية"),
    ("unterkunft wird gestellt", "يتم توفير الإقامة"),
    ("unterkunft", "الإقامة"),
    ("verpflegung", "الطعام"),
    ("kostenlose verpflegung", "طعام مجاني"),
    ("arbeitskleidung wird gestellt", "يتم توفير ملابس العمل"),
    ("arbeitskleidung wird gestellt und gewaschen", "يتم توفير ملابس العمل وغسلها"),
    ("arbeitskleidung", "ملابس العمل"),
    ("urlaub", "العطلة"),
    ("30 urlaubstage", "30 يوم عطلة"),
    ("urlaubstage", "أيام العطلة"),
    ("wlan", "واي فاي"),
    ("parkplatz", "موقف السيارات"),
    ("führerschein", "رخصة السياقة"),
    ("pkw-führerschein", "رخصة سياقة خاصة"),
    ("fahrzeug", "مركبة"),
    ("dienstfahrzeug", "مركبة عمل"),
    ("wir besprechen ihr tatsächliches gehalt gerne mit ihnen", "سنناقش راتبكم الفعلي بكل سرور معكم"),
    ("gehalt nach vereinbarung", "الراتب حسب الاتفاق"),
    ("lohn nach vereinbarung", "الأجر حسب الاتفاق"),
    ("gehalt", "الراتب"),
    ("vergütung", "التعويض"),
    ("bezahlung", "الأجر"),
    ("monatsgehalt", "الراتب الشهري"),
    ("jahresgehalt", "الراتب السنوي"),
    ("stundenlohn", "الأجر بالساعة"),
    ("aufwandsentschädigung", "تعويض عن المصاريف"),
    ("weihnachtsgeld", "منحة عيد الميلاد"),
    ("altersvorsorge", "ادخار التقاعد"),
    ("betriebliche altersvorsorge", "التقاعد المؤسسي"),
    ("vergünstigungen", "تخفيضات"),
    ("benefits", "المزايا"),
    ("attraktive benefits", "مزايا جذابة"),
    ("corporate benefits", "مزايا مؤسسية"),
    ("weiterbildungsmöglichkeiten", "فرص التكوين المستمر"),
    ("weiterbildungen", "تكوينات إضافية"),
    ("weiterbildung", "تكوين مستمر"),
    ("fortbildungen", "تكوينات إضافية"),
    ("aufstiegsmöglichkeiten", "فرص الترقي"),
    ("entwicklungsmöglichkeiten", "فرص التطور"),
    ("karrieremöglichkeiten", "فرص مهنية"),
    ("karrierechancen", "فرص مهنية"),
    ("einarbeitung", "التدريب على العمل"),
    ("eine gründliche einarbeitung", "تدريب شامل على العمل"),
    ("einschulung", "التدريب"),
    ("ein dynamisches team", "فريق ديناميكي"),
    ("ein eingespieltes team", "فريق منسجم"),
    ("ein junges team", "فريق شاب"),
    ("ein motiviertes team", "فريق متحمس"),
    ("ein herzliches team", "فريق ودود"),
    ("in einem eingespielten team", "في فريق منسجم"),
    ("unser team", "فريقنا"),
    ("unserem team", "فريقنا"),
    ("unseres teams", "فريقنا"),
    ("die kollegen", "الزملاء"),
    ("kollegiales umfeld", "بيئة قائمة على الزمالة"),
    ("kollegiales arbeitsklima", "مناخ عمل قائم على الزمالة"),
    ("familiäres arbeitsklima", "مناخ عمل عائلي"),
    ("angenehmes arbeitsklima", "مناخ عمل لطيف"),
    ("freundliches arbeitsklima", "مناخ عمل ودود"),
    ("wertschätzendes miteinander", "تعامل قائم على التقدير"),
    ("flache hierarchien", "تسلسل إداري قصير"),
    ("kurze entscheidungswege", "مسارات قرار قصيرة"),
    ("eigenverantwortung", "الاستقلالية في المسؤولية"),
    ("eigenverantwortliches arbeiten", "العمل باستقلالية"),
    ("mitarbeiter-events", "فعاليات للموظفين"),
    ("firmenfeiern", "حفلات الشركة"),
    ("vermögenswirksame leistungen", "منح ادخارية"),
    ("kostenlose getränke", "مشروبات مجانية"),
    ("kostenfreie getränke", "مشروبات مجانية"),
    ("kostenloses essen", "طعام مجاني"),
    ("essenszuschuss", "مساهمة في الوجبات"),
    ("personalzimmer", "غرفة للموظفين"),
    ("personalunterkunft", "إقامة للموظفين"),
    ("mitarbeiterzimmer", "غرفة للموظفين"),
    ("mitarbeiterrabatte", "تخفيضات للموظفين"),
    ("rabatte auf", "تخفيضات على"),
    ("vergünstigte", "مخفضة"),
    ("schichtarbeit", "العمل بنظام النوبات"),
    ("schichtdienst", "العمل بنظام النوبات"),
    ("nachtarbeit", "العمل الليلي"),
    ("nachtschicht", "النوبة الليلية"),
    ("frühschicht", "النوبة الصباحية"),
    ("spätschicht", "النوبة المسائية"),
    ("wochenendschicht", "نوبة نهاية الأسبوع"),
    ("samstag und sonntag", "السبت والأحد"),
    ("montag bis freitag", "من الاثنين إلى الجمعة"),
    ("montag bis samstag", "من الاثنين إلى السبت"),
    ("täglich von", "يومياً من"),
    ("vollzeit", "دوام كامل"),
    ("teilzeit", "دوام جزئي"),
    ("ab sofort", "ابتداءً من الآن"),
    ("ab sofort oder später", "ابتداءً من الآن أو لاحقاً"),
    ("zum frühestmöglichen zeitpunkt", "في أقرب وقت ممكن"),
    ("zum nächstmöglichen zeitpunkt", "في أقرب وقت ممكن"),
    ("ab dem", "ابتداءً من"),
    ("eintritt", "الالتحاق"),
    ("eintrittstermin", "موعد الالتحاق"),
    ("arbeitsbeginn", "بداية العمل"),
    ("ihr arbeitsplatz", "مكان عملكم"),
    ("dein arbeitsplatz", "مكان عملك"),
    ("unser arbeitsort", "موقع عملنا"),
    ("ort", "المكان"),
    ("das mindestalter", "الحد الأدنى للسن"),
    ("arbeitsvertrag", "عقد العمل"),
    ("auf schriftlicher basis", "على أساس كتابي"),
    ("befristet", "محدد المدة"),
    ("unbefristet", "غير محدد المدة"),
    ("probezeit", "فترة التجربة"),
    ("anstellung", "التوظيف"),
    ("beschäftigung", "العمل"),
    ("teilzeit in ausmaß von", "دوام جزئي بمعدل"),
    ("im ausmaß von", "بمعدل"),
    ("im ausmaß", "بمعدل"),
    ("stunden pro woche", "ساعة في الأسبوع"),
    ("wochenstunden", "ساعة أسبوعياً"),
    ("40-stunden-woche", "40 ساعة في الأسبوع"),
    ("38,5-stunden-woche", "38.5 ساعة في الأسبوع"),
    ("arbeitszeit von", "وقت عمل قدره"),
    ("auf 30 stunden basis", "على أساس 30 ساعة"),
    ("auf basis von", "على أساس"),
    ("wochenarbeitszeit", "وقت العمل الأسبوعي"),
    ("wochenarbeitszeit von", "وقت العمل الأسبوعي قدره"),
    # Task sections
    ("anforderungsprofil", "ملف المتطلبات"),
    ("anforderungen", "المتطلبات"),
    ("aufgabenbereich", "مجال المهام"),
    ("aufgabengebiet", "مجال المهام"),
    ("aufgaben", "المهام"),
    ("ihre aufgaben", "مهامكم"),
    ("deine aufgaben", "مهامك"),
    ("ihre tätigkeiten", "مهامكم"),
    ("deine tätigkeiten", "مهامك"),
    ("ihr aufgabengebiet", "مجال مهامكم"),
    ("kontakt", "التواصل"),
    ("kontaktdaten", "معلومات التواصل"),
    ("ihr ansprechpartner", "شخص التواصل معكم"),
    ("ansprechperson", "شخص التواصل"),
    ("ansprechpartner", "شخص التواصل"),
    ("telefonisch", "هاتفياً"),
    ("telefonisch unter", "هاتفياً على"),
    ("telefon", "الهاتف"),
    ("tel.nr", "هاتف"),
    ("tel.:", "هاتف:"),
    ("e-mail", "البريد الإلكتروني"),
    ("email", "البريد الإلكتروني"),
    ("per e-mail", "عبر البريد الإلكتروني"),
    ("schriftlich", "كتابياً"),
    ("bewerbung per e-mail", "التقديم عبر البريد الإلكتروني"),
    ("bewerbungen per e-mail", "التقديمات عبر البريد الإلكتروني"),
    ("bewerbungsunterlagen", "ملف التقديم"),
    ("ihre bewerbungsunterlagen", "ملف طلبكم"),
    ("deine bewerbungsunterlagen", "ملف طلبك"),
    ("vollständige bewerbungsunterlagen", "ملف تقديم كامل"),
    ("aussagekräftige bewerbungsunterlagen", "ملف تقديم معبّر"),
    ("lebenslauf", "السيرة الذاتية"),
    ("lebenslauf und foto", "السيرة الذاتية وصورة"),
    ("mit lebenslauf", "مع السيرة الذاتية"),
    ("unterlagen", "المستندات"),
    ("bewerbung", "الطلب"),
    ("bewerbungen", "الطلبات"),
    ("bewerber_innen", "المتقدمون"),
    ("bewerber/innen", "المتقدمون"),
    ("wir bitten um verständnis", "نرجو تفهمكم"),
    ("wir weisen darauf hin", "نلفت انتباهكم إلى"),
    ("bitte haben sie verständnis dafür", "يرجى تفهمكم لذلك"),
    ("wir freuen uns auf ihren anruf", "نتطلع إلى اتصالكم"),
    ("wir freuen uns auf ihren besuch", "نتطلع إلى زيارتكم"),
    ("sie erreichen uns unter", "يمكنكم التواصل معنا عبر"),
    ("erreichbar unter", "متاحون عبر"),
    ("wir sind erreichbar", "يمكنكم الوصول إلينا"),
    ("gerne stehen wir für fragen zur verfügung", "يسعدنا الرد على أسئلتكم"),
    ("für rückfragen", "للاستفسارات"),
    ("bei fragen", "في حال وجود أسئلة"),
    ("bei weiteren fragen", "في حال وجود أسئلة أخرى"),
    ("sollten sie weitere fragen haben", "إذا كانت لديكم أسئلة أخرى"),
    ("wir melden uns", "سنرد عليكم"),
    ("melden sie sich", "تواصلوا معنا"),
    ("melde dich", "تواصل معنا"),
    ("wir freuen uns über", "يسعدنا"),
    ("wir freuen uns auf", "نتطلع إلى"),
    ("wir freuen uns darauf", "يسعدنا"),
    ("schicken sie uns", "أرسلوا لنا"),
    ("senden sie ihre bewerbung", "أرسلوا طلبكم"),
    ("senden sie ihren lebenslauf", "أرسلوا سيرتكم الذاتية"),
    ("per mail an", "عبر البريد إلى"),
    ("schriftliche bewerbung", "طلب مكتوب"),
    ("wir erwarten ihre bewerbung", "نتطلع إلى طلبكم"),
    ("kennenzulernen", "أن نتعرف عليك"),
    ("wir freuen uns sehr", "يسعدنا كثيراً"),
    # English generic (IE)
    ("permanent full time", "بدوام كامل دائم"),
    ("full time", "دوام كامل"),
    ("part time", "دوام جزئي"),
    ("minimum 2 years previous experience", "خبرة سابقة لا تقل عن سنتين"),
    ("previous experience", "خبرة سابقة"),
    ("experience in", "خبرة في"),
    ("salary", "الراتب"),
    ("per hour", "في الساعة"),
    ("per year", "سنوياً"),
    ("per month", "شهرياً"),
    ("please apply", "يرجى التقديم"),
    ("to apply", "للتقديم"),
    ("please send your cv", "يرجى إرسال سيرتكم الذاتية"),
    ("send your cv", "أرسلوا سيرتكم الذاتية"),
    ("cv to", "السيرة الذاتية إلى"),
    ("for more information", "لمزيد من المعلومات"),
    ("contact us", "تواصلوا معنا"),
    ("job description", "وصف الوظيفة"),
    ("responsibilities", "المسؤوليات"),
    ("requirements", "المتطلبات"),
    ("benefits", "المزايا"),
    ("we are looking for", "نبحث عن"),
    ("looking for", "نبحث عن"),
    ("join our team", "انضم إلى فريقنا"),
    ("our team", "فريقنا"),
    ("great opportunity", "فرصة رائعة"),
    ("we offer", "نقدم"),
    ("you will", "سوف"),
    ("main duties", "المهام الرئيسية"),
    ("day to day", "يومياً"),
    ("working hours", "ساعات العمل"),
    ("annual leave", "العطلة السنوية"),
    ("holiday", "العطلة"),
    ("accommodation", "الإقامة"),
    ("meals", "الوجبات"),
    ("training", "التكوين"),
    ("candidate", "المرشح"),
    ("candidates", "المرشحون"),
    ("applicant", "المتقدم"),
    ("applicants", "المتقدمون"),
    ("employment permit", "تصريح العمل"),
    ("work permit", "تصريح العمل"),
    # Dutch (BE)
    ("want een verpleegkundige kan pas goed zorgen, als een ict-er zorgt voor een vlekkeloze digitale infrastructuur.", "لأن الممرض لا يستطيع تقديم رعاية جيدة إلا إذا تولى خبير تقني صيانة البنية الرقمية بشكل مثالي."),
    ("samen gaan we voor warme en innovatieve zorg.", "معاً نذهب نحو رعاية دافئة ومبتكرة."),
    ("een verpleegkundige of een technieker?", "هل أنت ممرض أم تقني؟"),
    ("een arts of een administratief medewerker?", "هل أنت طبيب أم موظف إداري؟"),
    ("bij zas hebben we elkaar allemaal nodig.", "في ZAS نحن جميعاً بحاجة إلى بعضنا البعض."),
    ("je kandidatuur zal bezorgd worden aan", "سيتم تسليم طلبك إلى"),
    ("kandidaturen worden strikt vertrouwelijk behandeld", "تُعامل الطلبات بسرية تامة"),
    ("respect, inlevingsvermogen en verantwoordelijkheid zijn belangrijke waarden in je werk", "الاحترام والتعاطف والمسؤولية قيم مهمة في عملك"),
    ("je bent een teamgerichte persoonlijkheid", "أنت شخصية جماعية"),
    ("je kan op een vlotte en correcte manier informatie verstrekken aan patiënten", "يمكنك تقديم المعلومات للمرضى بسلاسة وبدقة"),
    ("je hebt aandacht voor kwaliteit en continuïteit en bent resultaatgericht", "تهتم بالجودة والاستمرارية وتركز على النتائج"),
    ("je bent in het bezit van een in belgië gehomologeerde toelating voor beroepsuitoefening", "تمتلك ترخيصاً لمزاولة المهنة معترفاً به في بلجيكا"),
    ("je hebt een goede kennis van het nederlands", "لديك معرفة جيدة باللغة الهولندية"),
    ("je bewaakt mee de kwaliteit en de waarden waar de dienst, alsook zas voor staat", "تشارك في الحفاظ على الجودة والقيم التي تلتزم بها الخدمة وZAS"),
    ("je hebt een collegiale en complementaire attitude naar de collega's", "لديك موقف زمولي وتكميلي تجاه الزملاء"),
    ("voor deze functie zal een selectiegesprek georganiseerd worden", "سيتم تنظيم مقابلة اختيار لهذه الوظيفة"),
    ("actieve deelname in de supervisie en opleiding van assistenten wordt verwacht", "يُتوقع مشاركة نشطة في الإشراف على المساعدين وتدريبهم"),
    ("je neemt actief deel aan de wachtregeling", "تشارك بنشاط في نظام المناوبات"),
    ("samen zorgen we ervoor dat onze patiënten de beste zorg kunnen krijgen", "معاً نضمن حصول مرضانا على أفضل رعاية ممكنة"),
    # Finnish (FI)
    ("mitä työ pitää sisällään?", "ماذا يتضمن العمل؟"),
    ("työ alkaa heti tai sopimuksen mukaan.", "يبدأ العمل فوراً أو حسب الاتفاق."),
    ("työ alkaa heti sopivan henkilön löydyttyä.", "يبدأ العمل فوراً عند العثور على الشخص المناسب."),
    ("kiinnostuitko?", "هل أنت مهتم/ة؟"),
    ("palkkaus sopimuksen mukaan.", "الأجر حسب الاتفاق."),
    ("etsimme ammattitaitoista pizza kokkia, jolla on aikaisempaa kokemusta ravintolatoiminnasta ja joka kykenee itsenäisesti", "نبحث عن طباخ بيتزا محترف لديه خبرة سابقة في عمل المطاعم وقادر على العمل بشكل مستقل"),
    ("työsi voi sisältää tarvittaessa myös muita keittiötöitä.", "يمكن أن يتضمن عملك أيضاً مهام مطبخ أخرى عند الحاجة."),
    ("työn sujuminen edellyttää suomen, englannin tai turkin kielen taitoa.", "يتطلب إنجاز العمل إتقان اللغة الفنلندية أو الإنجليزية أو التركية."),
    ("sinulla on oltava hygienia tutkintotodistus ja oleskelulupa suomeen, ennen työn aloittamista.", "يجب أن يكون لديك شهادة النظافة الصحية وتصريح إقامة في فنلندا قبل بدء العمل."),
    ("tarjoamme kokopäiväistä työtä pidemmäksi aikaa.", "نقدم عملاً بدوام كامل لفترة أطول."),
    ("hakuaika päättyy 31.10.2026, mutta voimme palkata myös hakuaikana, sopivan henkilön löydyttyä.", "تنتهي فترة التقديم في 31.10.2026، لكن يمكننا التوظيف أيضاً خلالها عند العثور على الشخص المناسب."),
    ("paikat täytetään heti sopivien henkilöiden löydyttyä.", "تُملأ المناصب فوراً عند العثور على الأشخاص المناسبين."),
    ("käsittelemme hakemuksia jo hakuaikana ja paikka täytetään sopivan henkilön löydyttyä.", "نعالج الطلبات خلال فترة التقديم ويُملأ المنصب عند العثور على الشخص المناسب."),
    ("nuorgamin lomakeskus oy on pieni kodikas perheyritys suomen ja eu:n pohjoisimmassa kylässä", "Nuorgamin Lomakeskus Oy هي شركة عائلية صغيرة ودودة في أقصى قرية في فنلندا والاتحاد الأوروبي"),
    ("etsimme", "نبحث عن"),
    ("työ alkaa heti", "يبدأ العمل فوراً"),
    ("tarjoamme", "نقدم"),
    ("hygienia tutkintotodistus", "شهادة النظافة الصحية"),
    # Norwegian (NO)
    ("høres dette ut som noe for deg?", "هل يبدو هذا مناسباً لك؟"),
    ("interessert?", "مهتم/ة؟"),
    ("alle henvendelser og søknader ønskes skriftlig.", "نرغب في استلام جميع الاستفسارات والطلبات كتابياً."),
    ("vi kontakter kun aktuelle kandidater.", "سنتواصل فقط مع المرشحين المعنيين."),
    ("vi har 28 bordplasser og 8 plasser i baren med innsyn til kjøkkenet som kan reserveres.", "لدينا 28 مقعداً على الطاولات و8 مقاعد في البار مع إطلالة على المطبخ يمكن حجزها."),
    ("vår restaurant ligger midt i storgata og har derfor en stor pågang av gjester som kommer innom daglig.", "يقع مطعمنا في منتصف الشارع الرئيسي، ولذلك يشهد إقبالاً كبيراً من الزبائن يومياً."),
    ("derfor er dette en arbeidsplass hvor det kan være både rolig og hektisk til tider.", "لذلك هذا مكان عمل قد يكون هادئاً ومزدحماً في أوقات مختلفة."),
    ("vi gleder oss til å høre fra deg!", "نتطلع إلى استلام طلبك!"),
    ("konkurransedyktige betingelser.", "شروط تنافسية."),
    ("vi søker", "نبحث عن"),
    ("søker", "يبحث عن"),
    ("ønskes skriftlig", "نرغب في استلامها كتابياً"),
    # Dutch (BE)
    ("wat ga je doen?", "ماذا ستفعل؟"),
    ("we zijn op zoek naar", "نبحث عن"),
    ("kom ons team versterken", "انضم إلى فريقنا"),
    ("wat we bieden", "ما نقدمه"),
    ("wat verwachten we", "ما نتوقعه"),
    # Slovenian (SI)
    ("prijavite se", "قدم طلبك"),
    ("ponujamo", "نقدم"),
    ("iščemo", "نبحث عن"),
    ("zaposlitev", "التوظيف"),
    ("delovno mesto", "مكان العمل"),
    ("v domu starejših", "في دار المسنين"),
    ("delo v", "العمل في"),
    ("kandidati", "المرشحون"),
    ("za več informacij", "لمزيد من المعلومات"),
    ("kontaktirajte", "تواصلوا مع"),
    ("delovni čas", "ساعات العمل"),
    # German structural headers (frequent in no-arabic offers)
    ("erweiterte kenntnisse:", "معرفة متقدمة:"),
    ("erweiterte kenntnisse", "معرفة متقدمة"),
    ("ihre aufgaben:", "مهامكم:"),
    ("deine aufgaben:", "مهامك:"),
    ("weitere berufsbezeichnung:", "تسميات مهنية أخرى:"),
    ("zwingend erforderliche lizenzen:", "تراخيص إلزامية:"),
    ("expertenkenntnisse:", "معرفة خبيرة:"),
    ("das bringst du mit:", "ما تحمله من مؤهلات:"),
    ("ihre aufgaben sind:", "مهامكم هي:"),
    ("das erwartet dich:", "ما ينتظرك:"),
    ("das bieten wir dir:", "ما نقدمه لك:"),
    ("interessiert?", "مهتم/ة؟"),
    ("was wir bieten:", "ما نقدمه:"),
    ("noch fragen?", "هل لديكم أسئلة؟"),
    ("hotelempfang", "استقبال الفندق"),
    ("a-la-carte-küche", "مطبخ قائمة الطلب"),
    ("etagen-, zimmerdienst, reinigen", "خدمة الطوابق والغرف والتنظيف"),
    ("entdecke die leidenschaft für die 40 gastfreundlichen jugendherbergen in rheinland-pfalz und im saarland.", "اكتشف الشغف في 40 نزلاً للشباب في راينلاند بفالز وسارلاند."),
    ("wir suchen menschen, die lust daran haben, gäste zu begeistern.", "نبحث عن أشخاص يستمتعون بإسعاد الضيوف."),
    ("mehr als 50 mitarbeiter sorgen für eine konstant hohe servicequalität.", "أكثر من 50 موظفاً يضمنون جودة خدمة عالية وثابتة."),
    ("die küche wurde mehrfach prämiert.", "حصل المطبخ على عدة جوائز."),
    ("unterlagen können später nachgereicht werden.", "يمكن تقديم المستندات لاحقاً."),
    ("hier ist ihre chance!", "هذه فرصتكم!"),
    ("das hotel liegt idyllisch am waldrand.", "يقع الفندق بمناظر خلابة على حافة الغابة."),
    ("es ist umgeben von einer parkähnlichen gartenanlage mit einem kleinen see.", "إنه محاط بحديقة تشبه المتنزه مع بحيرة صغيرة."),
    ("wir nutzen gerne frische, regionale produkte.", "نستخدم بكل سرور منتجات طازجة ومحلية."),
    ("unsere fisch- und wildspezialitäten kommen aus der region.", "أطباق السمك والصيد الخاصة بنا تأتي من المنطقة."),
    ("familie köhler legt wert auf eine langfristige zusammenarbeit.", "تولي عائلة كولر أهمية كبيرة للتعاون طويل الأمد."),
    ("in den vergangenen jahren wurde großzügig umgebaut und erweitert.", "في السنوات الماضية تم تجديد وتوسيع المكان بسخاء."),
    ("vertrauen, ambition, verantwortung und ein respektvolles miteinander sind die basis unseres handelns.", "الثقة والطموح والمسؤولية والتعامل المحترم هي أساس عملنا."),
    ("sie fühlen sich angesprochen?", "هل تشعر أن هذا يخصك؟"),
    ("dann bist du bei uns richtig.", "إذن أنت في المكان الصحيح عندنا."),
    ("dann freuen wir uns über ihre aussagekräftige bewerbung.", "إذن نتطلع إلى استلام طلبكم الكامل."),
    ("wir haben insgesamt 63 zimmer verschiedener größen und ausstattungen, darunter einzelzimmer, doppelzimmer, grand-deluxe-zimmer, familien-suiten und eine suite", "لدينا إجمالاً 63 غرفة بمختلف الأحجام والتجهيزات، منها غرف مفردة ومزدوجة وغرف غراند ديلوكس وأجنحة عائلية وجناح"),
    # Czech structural phrases
    ("hledáme", "نبحث عن"),
    ("požadujeme:", "نطلب:"),
    ("nabízíme:", "نقدم:"),
    ("e-mailem na:", "عبر البريد الإلكتروني إلى:"),
    ("e-mailem:", "عبر البريد الإلكتروني:"),
    ("výhodou", "يعتبر ميزة"),
    ("pracovní poměr na dobu určitou", "علاقة عمل لمدة محددة"),
    ("pracovní poměr na dobu neurčitou", "علاقة عمل غير محددة المدة"),
    ("jednosměnný provoz", "نظام عمل بنوبة واحدة"),
    ("pomocné práce v kuchyni", "أعمال مساعدة في المطبخ"),
    ("příprava jídel", "تحضير الوجبات"),
    ("obsluha zákazníků", "خدمة الزبائن"),
    ("úklid kuchyně", "تنظيف المطبخ"),
    ("práce na víkend", "العمل في نهاية الأسبوع"),
    ("práce v turnuse", "العمل بنظام النوبات"),
    ("příspěvek na stravování", "مساهمة في الوجبات"),
    ("strava zdarma", "طعام مجاني"),
    ("dobrá fyzická kondice", "لياقة بدنية جيدة"),
    ("anglický jazyk výhodou", "اللغة الإنجليزية تعتبر ميزة"),
    ("německý jazyk výhodou", "اللغة الألمانية تعتبر ميزة"),
    ("znalost vietnamského jazyka", "معرفة باللغة الفيتنامية"),
    ("znalost čínského jazyka", "معرفة باللغة الصينية"),
    ("indické kuchyně", "المطبخ الهندي"),
    ("praxe v oboru", "خبرة في المجال"),
    ("výpis z rejstříku trestů", "السجل الجنائي"),
    # Czech — structural headers & frequent fragments (data-driven)
    ("náplň práce:", "مجال العمل:"),
    ("zaměstnanecké výhody:", "مزايا التوظيف:"),
    ("místo výkonu práce:", "مكان العمل:"),
    ("místo výkonu:", "مكان العمل:"),
    ("první kontakt:", "الاتصال الأول:"),
    ("prvotní informace:", "معلومات أولية:"),
    ("nástup možný ihned.", "الالتحاق ممكن فوراً."),
    ("upřesňující informace:", "معلومات توضيحية:"),
    ("zasláním životopisu (cv) na e-mail:", "بإرسال السيرة الذاتية (CV) إلى البريد الإلكتروني:"),
    ("způsob prvního kontaktu zájemce o volné pracovní místo se zaměstnavatelem:", "طريقة التواصل الأولى للمتقدم مع صاحب العمل:"),
    ("způsob prvního kontaktu:", "طريقة التواصل الأول:"),
    ("způsob kontaktu:", "طريقة التواصل:"),
    ("kontaktní osoba:", "شخص التواصل:"),
    ("pracovní doba:", "ساعات العمل:"),
    ("popis práce:", "وصف العمل:"),
    ("telefonicky:", "هاتفياً:"),
    ("první kontakt se zaměstnavatelem:", "الاتصال الأول مع صاحب العمل:"),
    ("kontakt zasláním životopisu na e-mail:", "التواصل بإرسال السيرة الذاتية إلى البريد الإلكتروني:"),
    ("zaměstnavatel požaduje:", "صاحب العمل يتطلب:"),
    ("co od vás očekáváme?", "ماذا نتوقع منكم؟"),
    ("praxe v oboru min.", "خبرة في المجال على الأقل"),
    ("kontakt pro zájemce:", "تواصل للمتقدمين:"),
    ("zájemci se mohou hlásit:", "يمكن للمتقدمين التواصل:"),
    ("své písemné nabídky se strukturovaným životopisem posílejte na e-mail:", "أرسلوا عروضكم المكتوبة مع سيرة ذاتية منظمة إلى البريد الإلكتروني:"),
    ("pracovněprávní vztah:", "نوع العلاقة التعاقدية:"),
    ("co bude náplní vaší práce:", "ما سيكون مجال عملكم:"),
    ("prvotní kontakt e-mailem:", "الاتصال الأول عبر البريد الإلكتروني:"),
    ("kontaktu se zaměstnavatelem:", "التواصل مع صاحب العمل:"),
    ("pracovní úvazek plný", "دوام عمل كامل"),
    ("počet hodin týdně", "عدد الساعات أسبوعياً"),
    ("krátký/dlouhý týden", "أسبوع قصير/طويل"),
    ("krátký-dlouhý týden", "أسبوع قصير-طويل"),
    ("krátký / dlouhý týden", "أسبوع قصير / طويل"),
    ("bez nočních směn", "بدون نوبات ليلية"),
    ("nástup dle dohody", "الالتحاق حسب الاتفاق"),
    ("vhodné pro osoby", "مناسب للأشخاص"),
    ("zdravotně znevýhodněné", "ذوي الاحتياجات الصحية"),
    ("stravné", "بدل الطعام"),
    ("slevy na pobyt", "تخفيضات على الإقامة"),
    ("požadovaný minimální stupeň vzdělání", "الحد الأدنى المطلوب من المؤهل التعليمي"),
    ("střední odborné s výučním listem", "تعليم ثانوي مهني مع شهادة تدريب"),
    ("střední odborné bez vyučení", "تعليم ثانوي مهني بدون تدريب"),
    ("nižší střední odborné", "تعليم ثانوي مهني أدنى"),
    ("smlouva na dobu určitou", "عقد لمدة محددة"),
    ("nástup ihned", "الالتحاق فوراً"),
    ("hledá do svého týmu", "تبحث في فريقها"),
    ("spolehlivost", "الاعتمادية"),
    ("samostatnost", "الاستقلالية"),
    ("flexibilita", "المرونة"),
    ("týmový hráč", "روح الفريق"),
    ("motivace týmu", "تحفيز الفريق"),
    ("řízení činnosti zaměstnanců", "إدارة نشاط الموظفين"),
    ("komunikace s hosty", "التواصل مع الضيوف"),
    ("obsluha večerního baru", "خدمة البار المسائي"),
    ("pro hotelové hosty", "لضيوف الفندق"),
    ("vzhledem k nočním směnám", "نظراً للنوبات الليلية"),
    ("týden práce/ týden volno", "أسبوع عمل/أسبوع راحة"),
    ("organizaci práce", "تنظيم العمل"),
    ("profesionalitu", "الاحترافية"),
    ("zasílat životopis na mail", "إرسال السيرة الذاتية إلى البريد"),
    ("zaslat životopis na", "إرسال السيرة الذاتية إلى"),
    ("pošlete životopis na", "أرسلوا السيرة الذاتية إلى"),
    ("souhlas s nabízením volného pracovního místa cizincům", "الموافقة على عرض الوظيفة للأجانب"),
    ("zaměstnanecká karta", "بطاقة العمل"),
    ("výdej pokrmů", "تقديم الوجبات"),
    ("prodej drobného občerstvení", "بيع الوجبات الخفيفة"),
    ("obsluha v jídelně", "الخدمة في قاعة الطعام"),
    ("recepční hotelu", "موظف استقبال الفندق"),
    ("ubytování mezi směnami", "إقامة بين النوبات"),
    ("noční provoz", "العمل الليلي"),
    ("komunikativnost", "مهارات التواصل"),
    ("příjemné vystupování", "مظهر لطيف"),
    ("práce na pc", "العمل على الحاسوب"),
    ("možnost podnikového stravování", "إمكانية وجبات المؤسسة"),
    ("pravidelné odměny", "مكافآت منتظمة"),
    ("směny krátký/dlouhý týden", "نوبات أسبوع قصير/طويل"),
    ("dní v práci", "أيام عمل"),
    ("dní volno", "أيام راحة"),
    ("nutnost plnoletosti", "شرط بلوغ سن الرشد"),
    ("smysl pro zodpovědnost", "حس المسؤولية"),
    ("slevy na pobyt v ostatních provozech", "تخفيضات على الإقامة في فروع أخرى"),
    ("pomoc v kuchyni", "مساعدة في المطبخ"),
    ("práce v turnuse", "العمل بنظام النوبات"),
    ("příprava surovin", "تحضير المواد الخام"),
    ("jednoduchých pokrmů", "أطباق بسيطة"),
    ("obsluha myčky nádobí", "خدمة غسالة الأطباق"),
    ("pomoc s přípravou", "مساعدة في التحضير"),
    ("kompletace a výdej jídel", "تجميع وتقديم الوجبات"),
    ("obsluha a koordinace chodu restaurace", "الخدمة والتنسيق في إدارة المطعم"),
    ("odpovědnost za objednávky zboží", "المسؤولية عن طلبات البضائع"),
    ("vázaná na procenta z tržby", "مرتبط بنسبة من الإيرادات"),
    ("směny", "النوبات"),
    ("pracovní doba od", "ساعات العمل من"),
    ("telefonicky na", "هاتفياً على"),
    ("osobně na adrese", "شخصياً على العنوان"),
    ("vzhledem k", "نظراً لـ"),
    # Slovak (SK)
    ("zbieranie, umývanie a odkladanie riadov, pomoc v kuchyni.", "جمع وغسل وترتيب الأطباق ومساعدة في المطبخ."),
    ("pracovný čas je rozdelený na dlhý a krátky týždeň.", "تنقسم ساعات العمل إلى أسبوع طويل وقصير."),
    ("v prípade záujmu pošlite životopis na", "في حال الاهتمام أرسلوا السيرة الذاتية إلى"),
    ("vykonávanie rôznych druhov masáží.", "تقديم أنواع مختلفة من التدليك."),
    ("výhody:", "المزايا:"),
    ("pracovný čas", "ساعات العمل"),
    # Greek (CY)
    ("ΒΟΗΘΟΣ ΚΟΥΖΙΝΑΣ", "مساعد/مساعدة مطبخ"),
    ("ΒΟΗΘΟΙ ΣΤΗΝ ΚΟΥΖΙΝΑ ΞΕΝΟΔΟΧΕΙΟΥ", "مساعدو المطبخ في الفندق"),
    ("ΥΠΟΔΟΧΗ ΚΑΙ ΕΞΥΠΗΡΕΤΗΣΗ ΠΕΛΑΤΩΝ ΜΕ ΕΠΑΓΓΕΛΜΑΤΙΣΜΟ ΚΑΙ ΕΥΓΕΝΕΙΑ", "استقبال وخدمة الزبائن باحترافية ولطف"),
    ("ΛΗΨΗ ΠΑΡΑΓΓΕΛΙΩΝ ΦΑΓΗΤΟΥ ΚΑΙ ΠΟΤΩΝ", "استلام طلبات الطعام والمشروبات"),
    ("ΠΡΟΕΤΟΙΜΑΣΙΑ ΚΑΙ ΤΑΚΤΟΠΟΙΗΣΗ ΤΡΑΠΕΖΙΩΝ", "تحضير وترتيب الطاولات"),
    ("ΔΙΑΤΗΡΗΣΗ ΤΗΣ ΚΑΘΑΡΙΟΤΗΤΑΣ", "الحفاظ على النظافة"),
    ("ΤΗΡΗΣΗ ΤΩΝ ΚΑΝΟΝΩΝ ΥΓΙΕΙΝΗΣ ΚΑΙ ΑΣΦΑΛΕΙΑΣ", "الالتزام بقواعد النظافة والسلامة"),
    ("ΠΡΟΕΤΟΙΜΑΣΙΑ ΚΑΙ ΚΑΘΑΡΙΟΤΗΤΑ ΚΟΥΖΙΝΑΣ", "تحضير وتنظيف المطبخ"),
    ("ΓΝΩΣΗ ΤΗΣ ΕΛΛΗΝΙΚΗΣ Η ΚΑΙ ΤΗΣ ΑΓΓΛΙΚΗΣ ΓΛΩΣΣΑΣ", "معرفة باللغة اليونانية أو الإنجليزية"),
    ("ΘΕΩΡΕΙΤΑΙ ΕΞΤΡΑ ΠΡΟΣΟΝ", "يعتبر مؤهلاً إضافياً"),
    ("ΚΟΥΖΙΝΑ", "المطبخ"),
    ("ΕΞΥΠΗΡΕΤΗΣΗ", "الخدمة"),
    ("ΚΑΘΑΡΙΟΤΗΤΑ", "النظافة"),
    # Portuguese (PT)
    ("pretendemos um candidato para ajudante de fabrico de pastelaria, com experiência.", "نبحث عن مرشح لمساعد في صناعة الحلويات مع خبرة."),
    ("vencimento de acordo com a experiência e subsidio noturno.", "الراتب حسب الخبرة مع بدل ليلي."),
    ("os interessados devem enviar o currículo para", "يرجى من المهتمين إرسال السيرة الذاتية إلى"),
    # Polish (PL)
    ("zakres obowiązków:", "مجال المهام:"),
    ("zbieranie zamówień od klientów, podawanie posiłków, dbanie o czystość sali", "جمع طلبات الزبائن وتقديم الوجبات والعناية بنظافة القاعة"),
    ("wymagania:", "المتطلبات:"),
    ("wykształcenie:", "المؤهل:"),
    ("średnie zawodowe", "تعليم مهني متوسط"),
    ("sposób aplikowania:", "طريقة التقديم:"),
    ("bezpośrednio do pracodawcy", "مباشرة إلى صاحب العمل"),
    ("wymagane dokumenty", "المستندات المطلوبة"),
    # French (FR)
    ("la restauration vous intéresse", "إذا كنت مهتماً بقطاع المطاعم"),
    ("vous souhaitez intégrer et travailler au sein d'un restaurant réputé et gastronomique", "ترغب في الانضمام والعمل في مطعم مرموق وفاخر"),
    ("vous assurez le service du midi principalement mais également du soir", "تتولى خدمة وجبة الغداء بشكل أساسي وأيضاً المساء"),
    ("en fonction des réservations", "حسب الحجوزات"),
    ("vous serez en charge de l'accueil de la clientèle et du service en salle", "ستتولى استقبال الزبائن والخدمة في القاعة"),
    ("possibilité de temps plein ou temps partiel", "إمكانية دوام كامل أو جزئي"),
    ("possibilité de logement", "إمكانية الإقامة"),
    ("nous recherchons", "نبحث عن"),
    ("un emploi en cdi ou en cdd", "عقد عمل دائم أو محدد المدة"),
    ("heures par semaine", "ساعة في الأسبوع"),
    ("c'est vous qui décidez", "القرار يعود لك"),
    ("salaire en fonction de l'expérience", "الراتب حسب الخبرة"),
    ("contrat à 39 heures par semaine, à durée indéterminée", "عقد 39 ساعة أسبوعياً غير محدد المدة"),
    ("hébergement et repas", "الإقامة والوجبات"),
    ("restaurant recherche", "مطعم يبحث عن"),
    ("recherche serveur", "يبحث عن نادل"),
    # Norwegian (NO) — remaining
    ("vi trenger serviceinnstilte servitører", "نحتاج نادلين موجهين نحو الخدمة"),
    ("erfaring fra servering", "خبرة في الخدمة"),
    ("god kunnskap om hygiene", "معرفة جيدة بالنظافة"),
    ("vi ønsker deg som er en fleksibel og løsnings orientert person", "نبحث عن شخص مرن وموجه نحو الحلول"),
    ("gode kommunikasjonsevner", "مهارات تواصل جيدة"),
    ("både skriftlig og muntlig", "كتابياً وشفهياً"),
    # Finnish (FI) — remaining
    ("haemme", "نبحث عن"),
    ("haetaan", "نبحث عن"),
    ("työtehtäviin kuuluu", "تشمل مهام العمل"),
    ("asiakaspalvelu", "خدمة العملاء"),
    ("kassan hoito", "إدارة الصندوق"),
    ("juomien tarjoilu ja valmistus", "تقديم وتحضير المشروبات"),
    ("työ on kaksivuorotyötä", "العمل بنظام نوبتين"),
    ("työsuhde on toistaiseksi voimassaoleva ja kokoaikainen", "عقد عمل دائم وغير محدد المدة وبدوام كامل"),
    ("edellytämme", "نشترط"),
    ("anniskelupassi", "رخصة تقديم المشروبات الكحولية"),
    ("kokopäiväistä työtä", "عمل بدوام كامل"),
    ("osa-aikainen", "بدوام جزئي"),
    ("ravintola", "مطعم"),
    ("kokki", "طباخ"),
    ("tarjoilija", "نادل"),
    ("myyjä", "بائع"),
    ("sijaitsee", "يقع"),
    ("lähellä", "بالقرب من"),
    ("ravintolaan", "إلى المطعم"),
    # Frequent uncovered sentences (data-driven, >=4 occurrences)
    ("our service is free of charge.", "خدمتنا مجانية بالكامل."),
    ("überstunden- sowie allfällige zuschläge", "ساعات العمل الإضافية والبدلات المحتملة"),
    ("zas, de drijvende kracht voor gezondheidszorg in beweging.", "ZAS، القوة الدافعة للرعاية الصحية في حركة."),
    ("die unten angeführte entlohnung bezieht sich auf die gesetzliche normalarbeitszeit von 40 stunden pro woche.", "الأجر المذكور أدناه يشير إلى وقت العمل القانوني العادي البالغ 40 ساعة أسبوعياً."),
    ("mindestentlohnung bezieht sich auf die gesetzliche normalarbeitszeit von 40 wochenstunden.", "الحد الأدنى للأجر يشير إلى وقت العمل القانوني العادي البالغ 40 ساعة أسبوعياً."),
    ("mindestentlohnung bezieht sich auf basis einer 40 stunden woche.", "الحد الأدنى للأجر يشير إلى أساس أسبوع عمل من 40 ساعة."),
    ("als weltweiter marktführer im bereich der systemgastronomie bieten wir dir arbeit in deiner nähe, individuelle förderung", "كشركة رائدة عالمياً في المطاعم المنظمة، نوفر لك عملاً بالقرب منك ودعماً فردياً"),
    ("wir weisen darauf hin, dass unvereinbarte persönliche vorsprachen nicht möglich sind", "نلفت انتباهكم إلى أن الزيارات الشخصية غير المتفق عليها غير ممكنة"),
    ("dann sind sie bei uns richtig!", "إذن أنتم في المكان الصحيح عندنا!"),
    ("du hast fragen oder sonstige anliegen?", "هل لديك أسئلة أو استفسارات أخرى؟"),
    ("carpe diem - nutze den tag!", "اغتنم اليوم - استغل الوقت!"),
    ("die genauen arbeitszeiten und freien tage erfolgen je nach vereinbarung und dienstplan.", "يتم تحديد ساعات العمل الدقيقة وأيام الراحة حسب الاتفاق وجدول العمل."),
    ("dann suchen wir genau dich!", "إذن نحن نبحث عنك أنت تحديداً!"),
    ("dann freuen wir uns, dich kennenzulernen!", "إذن يسعدنا أن نتعرف عليك!"),
    ("geschlechter, migrationshintergründe, alter und beeinträchtigungen sind für uns unmaßgeblich.", "الجنس والخلفية المهاجرة والعمر والإعاقات لا تؤثر في قرارنا."),
    ("eine leistungsbezogene vergütung ist für uns selbstverständlich.", "التعويض المرتبط بالأداء أمر بديهي بالنسبة لنا."),
    ("details entnehmen sie bitte dem inserat.", "يرجى الاطلاع على التفاصيل في الإعلان."),
    ("die entlohnung richtet sich nach berufserfahrung und wird beim vorstellgespräch vereinbart.", "يُحدد الأجر حسب الخبرة المهنية ويتم الاتفاق عليه في مقابلة التعارف."),
    ("dann bist du bei uns richtig!", "إذن أنت في المكان الصحيح عندنا!"),
    ("in der hauptsaison kann urlaub genommen werden.", "يمكن أخذ العطلة في الموسم الرئيسي."),
    ("karrieremöglichkeiten stehen ihnen in unserem hause jederzeit offen!", "فرص المسار المهني مفتوحة لكم دائماً في مؤسستنا!"),
    ("dann freuen wir uns auf dich!", "إذن نتطلع إلى طلبك!"),
    ("dann freuen wir uns, dich bald kennen zu lernen.", "إذن يسعدنا أن نتعرف عليك قريباً."),
    ("die zeiterfassung erfolgt ebenfalls komplett digital per app.", "يتم تسجيل الوقت أيضاً بشكل رقمي بالكامل عبر تطبيق."),
    ("wir verfügen über 100 zimmer mit 200 betten und 4 ferienapartments.", "لدينا 100 غرفة مع 200 سرير و4 شقق عطلات."),
    ("wir besprechen ihr tatsächliches gehalt gerne mit ihnen im rahmen eines persönlichen gesprächs, abhängig von berufserfahrung", "سنناقش راتبكم الفعلي بكل سرور في إطار مقابلة شخصية، حسب الخبرة المهنية"),
    ("eine überzahlung ist bei entsprechender qualifikation und erfahrung möglich.", "زيادة الأجر ممكنة مع المؤهل والخبرة المناسبين."),
    ("das mindestentgelt gilt für die gesetzliche normalarbeitszeit (brutto-grundgehalt).", "الحد الأدنى للأجر يسري على وقت العمل القانوني العادي (الراتب الأساسي الإجمالي)."),
    ("arbeitstag sind darin nicht enthalten und werden zusätzlich abgegolten.", "أيام العمل ليست متضمنة فيها ويتم تعويضها إضافياً."),
    ("wir begeistern unsere gäste nicht nur mit unserem sky spa", "نبهج ضيوفنا ليس فقط بمنتجع السبا العلوي لدينا"),
    ("das team des spa hotel erzherzog johann freut sich auf deine bewerbung!", "فريق فندق سبا Erzherzog Johann يتطلع إلى طلبك!"),
    # English (IE / kitchen duties)
    ("annual salary of €37,000 euro and 38 hours per week.", "راتب سنوي قدره 37,000 يورو و38 ساعة في الأسبوع."),
    ("checking the food dates if they are ok .", "التحقق من تواريخ صلاحية الأطعمة."),
    ("requires chef qualification in asian food and at least 2 years experiences in asian food.", "يتطلب مؤهل طباخ في الطعام الآسيوي وخبرة لا تقل عن سنتين في المطبخ الآسيوي."),
    ("job summary: you will play a key role in the day-to-day operations of our busy kitchen.", "ملخص الوظيفة: ستلعب دوراً رئيسياً في العمليات اليومية لمطبخنا المزدحم."),
    ("you will collaborate with the head chef to prepare menus, ensure adequate supplies at the cooking stations, and prepare common ingredients for the team", "ستتعاون مع رئيس الطهاة لإعداد قوائم الطعام، وضمان توفر الإمدادات في محطات الطبخ، وتحضير المكونات المشتركة للفريق"),
    ("follow the guidance of the head chef in the preparation and presentation of the meals", "اتبع توجيهات رئيس الطهاة في تحضير وتقديم الوجبات"),
    ("abide by and enforce health codes", "الالتزام بقواعد الصحة وتطبيقها"),
    ("do the food preparation before opening.", "تحضير الطعام قبل الافتتاح."),
    ("washing and cleaning up all the equipment.", "غسل وتنظيف جميع المعدات."),
    ("keeping the kitchen area tidy at all times.", "الحفاظ على نظافة منطقة المطبخ في جميع الأوقات."),
    ("preparing spices to match our dishes.", "تحضير التوابل لتناسب أطباقنا."),
    ("training new junior staff in our recipes.", "تدريب الموظفين الجدد على وصفاتنا."),
    ("general chef de partie duties.", "مهام شيف القسم العامة."),
    ("essential and other important responsibilities and duties may include, but are not limited to the following:", "المسؤوليات والواجبات الأساسية وغيرها من المهام المهمة قد تشمل، دون أن تقتصر على ما يلي:"),
    ("this is a full time permanent position", "هذه وظيفة دائمة بدوام كامل"),
    ("to apply to this position please email cv to", "للتقديم على هذا المنصب يرجى إرسال السيرة الذاتية بالبريد الإلكتروني إلى"),
    ("we are looking for a", "نبحث عن"),
    ("you will be responsible for", "ستكون مسؤولاً عن"),
    ("the ideal candidate will", "المرشح المثالي سوف"),
    ("this is an excellent opportunity", "هذه فرصة ممتازة"),
    ("successful candidates", "المرشحون الناجحون"),
    ("working as part of a team", "العمل ضمن فريق"),
    ("excellent communication skills", "مهارات تواصل ممتازة"),
    ("attention to detail", "الاهتمام بالتفاصيل"),
    ("high standards", "معايير عالية"),
    ("a valid work permit", "تصريح عمل ساري المفعول"),
    ("for further information", "لمزيد من المعلومات"),
    # Dutch (BE) extra
    ("je kan je kandidatuur met cv, motivatiebrief, diploma en eventuele referenties richten aan", "يمكنك إرسال طلبك مع السيرة الذاتية ورسالة التحفيز والدبلوم والمراجع المحتملة إلى"),
    ("je kan je kandidatuur met cv, diploma, referenties en vermelding van het vacaturenummer richten aan", "يمكنك إرسال طلبك مع السيرة الذاتية والدبلوم والمراجع مع ذكر رقم العرض إلى"),
    ("we nemen zo snel mogelijk contact met je op.", "سنتواصل معك في أقرب وقت ممكن."),
    ("we zijn op zoek naar", "نبحث عن"),
    ("voor meer informatie", "لمزيد من المعلومات"),
    ("ben jij", "هل أنت"),
    ("kan jij", "هل تستطيع"),
    ("heb jij", "هل لديك"),
]

DESC_WORDS = {
    # function words / connectors
    "für": "لـ", "über": "حول", "und": "و", "mit": "مع", "oder": "أو", "bei": "لدى",
    "in": "في", "an": "على", "auf": "على", "von": "من", "zu": "إلى", "aus": "من",
    "nach": "حسب", "vor": "قبل", "durch": "عبر", "ohne": "بدون", "bis": "حتى",
    "sowie": "وكذلك", "auch": "أيضاً", "bereits": "بالفعل", "immer": "دائماً",
    "noch": "لا يزال", "aber": "لكن", "nur": "فقط", "sehr": "جداً", "ganz": "تماماً",
    "alle": "الكل", "allen": "الجميع", "aller": "جميع", "alles": "كل شيء",
    "jeder": "كل", "jeden": "كل", "jede": "كل", "jede": "كل",
    "andere": "أخرى", "anderen": "أخرى", "weitere": "أخرى", "weiteren": "أخرى",
    "mehr": "المزيد", "viele": "كثير", "viel": "كثير", "vielen": "كثير من",
    "zwei": "اثنان", "beiden": "الاثنان",
    # pronouns / possessives (German word order makes these unsafe to map)
    "sich": "", "eines": "",
    # verbs
    "suchen": "نبحث عن", "sucht": "تبحث عن", "suche": "أبحث عن", "suchen wir": "نبحث عن",
    "bieten": "نقدم", "bietet": "يقدم", "bieten wir": "نقدم", "freuen": "يسعدنا",
    "beträgt": "يبلغ", "bezieht": "يشير", "können": "يمكن", "kann": "يمكن",
    "müssen": "يجب", "muss": "يجب", "sollen": "يجب", "sollten": "يجب",
    "wird": "يتم", "werden": "يتم", "werde": "سأصبح", "sind": "هي", "ist": "هو",
    "hat": "لديه", "haben": "لدينا", "gehören": "تنتمي", "steht": "يقف",
    "finden": "إيجاد", "wollen": "نريد", "möchten": "نود", "möchtest": "تود",
    "kannst": "تستطيع", "könnt": "تستطيعون", "kommen": "القدوم", "gehen": "الذهاب",
    "senden": "إرسال", "schicken": "إرسال", "erfolgt": "يتم", "erfolgen": "تتم",
    "legen": "وضع", "legen wir": "نضع", "geben": "إعطاء", "gibt": "يوجد",
    "stehen": "متاحة", "gilt": "يسري", "gelten": "تسري", "machen": "القيام",
    "übernehmen": "تولي", "übernehmen sie": "تولوا", "bringen": "إحضار",
    "mitbringen": "إحضار", "lernen": "التعلم", "arbeiten": "العمل", "arbeitest": "تعمل",
    "kochen": "الطبخ", "zubereiten": "تحضير", "servieren": "تقديم", "reinigen": "تنظيف",
    "waschen": "غسل", "spülen": "غسل الصحون", "kontrollieren": "مراقبة",
    "unterstützen": "دعم", "erwarten": "نتوقع", "begeistern": "إسعاد",
    "verwöhnen": "تدليل", "schaffen": "خلق", "setzen": "وضع", "führen": "قيادة",
    "wünschen": "نتمنى", "erstellen": "إعداد", "prüfen": "فحص",
    "antworten": "الرد", "melden": "الإبلاغ", "erhalten": "الحصول",
    "erreichen": "الوصول", "erreichbar": "متاح", "liegt": "يقع", "liegen": "تقع",
    "befindet": "يقع", "befinden": "تقع", "entfernt": "بعيد",
    "betragen": "يبلغ", "zahlen": "الدفع", "ausbezahlt": "مدفوع",
    "kassieren": "التحصيل", "vereinbaren": "الاتفاق", "sprechen": "التحدث",
    # nouns
    "hotel": "فندق", "hotels": "فنادق", "restaurant": "مطعم", "restaurants": "مطاعم",
    "küche": "مطبخ", "küchen": "مطابخ", "küchenteam": "فريق المطبخ", "küchenteams": "فرق المطبخ",
    "gastronomie": "المطاعم والفنادق", "gastgewerbe": "قطاع الضيافة",
    "hotellerie": "قطاع الفنادق", "gastgewerbe": "قطاع الضيافة",
    "service": "الخدمة", "servicekraft": "عامل خدمة", "servicemitarbeiter": "موظف خدمة",
    "kellner": "نادل", "kellnerin": "نادلة", "servierer": "نادل",
    "koch": "طباخ", "köchin": "طباخة", "köche": "طباخون", "küchenchef": "رئيس الطهاة",
    "abwascher": "غاسل أطباق", "spüler": "غاسل أطباق",
    "zimmermädchen": "عاملة تنظيف الغرف", "zimmerbursch": "عامل تنظيف الغرف",
    "rezeption": "الاستقبال", "rezeptionist": "موظف استقبال",
    "hausmeister": "حارس مبنى", "hausdame": "مشرفة الغرف",
    "reinigungskraft": "عامل نظافة", "reinigung": "التنظيف",
    "stell": "وظيفة", "stelle": "وظيفة", "stellen": "وظائف", "stelle als": "وظيفة",
    "arbeit": "عمل", "arbeitsplatz": "مكان العمل", "arbeitsort": "مكان العمل",
    "arbeitszeit": "وقت العمل", "arbeitszeiten": "أوقات العمل",
    "beruf": "مهنة", "berufserfahrung": "خبرة مهنية", "erfahrung": "خبرة",
    "ausbildung": "تكوين", "qualifikation": "مؤهل", "qualifikationen": "مؤهلات",
    "kompetenzen": "كفاءات", "kenntnisse": "معرفة", "grundkenntnisse": "معرفة أساسية",
    "team": "فريق", "teams": "فرق", "mitarbeiter": "موظفون", "mitarbeiterin": "موظفة",
    "personal": "الموظفون", "bewerber": "المتقدم", "bewerbung": "الطلب",
    "bewerbungen": "الطلبات", "lebenslauf": "السيرة الذاتية",
    "bewerbungsunterlagen": "ملف التقديم", "unterlagen": "المستندات",
    "gäste": "الضيوف", "gast": "ضيف", "gästen": "الضيوف",
    "tisch": "طاولة", "tische": "طاولات", "geschirr": "الأطباق",
    "speisen": "الأطباق", "speise": "طبق", "gerichte": "أطباق", "essen": "طعام",
    "getränke": "المشروبات", "getränk": "مشروب", "frühstück": "الفطور",
    "zimmer": "الغرف", "zimmern": "الغرف", "betten": "أسرّة",
    "pension": "نزل", "gasthof": "نزل", "gasthaus": "بيت ضيافة", "wirtshaus": "مطعم تقليدي",
    "hotelanlage": "مجمع فندقي", "resort": "منتجع", "spa": "سبا", "wellness": "الاسترخاء",
    "stadt": "مدينة", "region": "منطقة", "lage": "الموقع", "umgebung": "المحيط",
    "nähe": "قرب", "zentrum": "المركز", "straße": "شارع", "adresse": "العنوان",
    "telefon": "الهاتف", "telefonnummer": "رقم الهاتف", "nummer": "رقم",
    "email": "البريد الإلكتروني", "e-mail": "البريد الإلكتروني", "mail": "البريد",
    "kontakt": "التواصل", "ansprechpartner": "شخص التواصل", "ansprechperson": "شخص التواصل",
    "herrn": "السيد", "herr": "السيد", "frau": "السيدة",
    "woche": "أسبوع", "monat": "شهر", "jahr": "سنة", "jahre": "سنوات", "jahren": "سنوات",
    "tage": "أيام", "tag": "يوم", "tagen": "أيام", "stunden": "ساعات",
    "uhr": "ساعة", "tag": "يوم",
    "vollzeit": "دوام كامل", "teilzeit": "دوام جزئي",
    "urlaub": "عطلة", "gehalt": "راتب", "lohn": "أجر",
    "unterkunft": "الإقامة", "verpflegung": "الطعام", "kost": "الطعام",
    "arbeitgeber": "صاحب العمل", "dienstgeber": "صاحب العمل", "firma": "شركة",
    "unternehmen": "الشركة", "betrieb": "المؤسسة", "betriebe": "المؤسسات",
    "familie": "عائلة", "chef": "شيف", "manager": "مدير", "leitung": "الإدارة",
    "bereich": "المجال", "bereichen": "المجالات", "bereich": "المجال",
    "aufgaben": "المهام", "aufgabenbereich": "مجال المهام", "tätigkeit": "المهمة",
    "tätigkeiten": "المهام", "kontrolle": "المراقبة", "sicherheit": "السلامة",
    "hygiene": "النظافة", "sauberkeit": "النظافة", "ordnung": "الترتيب",
    "qualität": "الجودة", "servicequalität": "جودة الخدمة", "gastfreundschaft": "كرم الضيافة",
    "umgang": "التعامل", "kommunikation": "التواصل", "sprache": "اللغة",
    "deutsch": "الألمانية", "englisch": "الإنجليزية", "spanisch": "الإسبانية",
    "französisch": "الفرنسية", "chinesisch": "الصينية",
    "möglichkeit": "إمكانية", "möglichkeiten": "إمكانيات",
    "leistung": "أداء", "leistungen": "المزايا", "benefits": "مزايا",
    "bedingungen": "الشروط", "anforderungen": "المتطلبات",
    "vorteile": "المزايا", "vorteil": "ميزة", "plus": "بالإضافة",
    "details": "التفاصيل", "informationen": "المعلومات",
    "daten": "البيانات", "fragen": "الأسئلة",
    "kunden": "الزبائن", "gäste": "الضيوف",
    "menü": "قائمة الطعام", "menüs": "قوائم الطعام", "spezialitäten": "الأطباق الخاصة",
    "pizza": "بيتزا", "kaffee": "القهوة", "saft": "عصير",
    "produkte": "المنتجات", "produkt": "منتج", "zutaten": "المكونات",
    "gemüse": "الخضروات", "obst": "الفواكه", "fisch": "السمك", "fleisch": "اللحوم",
    "frische": "الطازجة", "saison": "الموسم", "sommer": "الصيف", "winter": "الشتاء",
    "wochenende": "نهاية الأسبوع", "feiertage": "أيام العطل",
    "arbeitskleidung": "ملابس العمل", "uniform": "الزي الموحد",
    "parkplatz": "موقف السيارات", "fahrzeug": "مركبة", "auto": "سيارة",
    "trinkgeld": "الإكرامية", "gehalt": "الراتب",
    "mensch": "شخص", "menschen": "الأشخاص", "persönlichkeit": "الشخصية",
    "motivation": "الحافز", "engagement": "الالتزام", "einsatzbereitschaft": "الجاهزية",
    "kreativität": "الإبداع", "leidenschaft": "الشغف", "freude": "المتعة",
    "spaß": "المرح", "verantwortung": "المسؤولية", "wertschätzung": "التقدير",
    "vertrauen": "الثقة", "respekt": "الاحترام", "höflichkeit": "الأدب",
    "freundlichkeit": "الود", "herzlichkeit": "الودّ",
    "zusammenarbeit": "التعاون", "teamarbeit": "العمل الجماعي",
    "teamgeist": "روح الفريق", "teamfähigkeit": "روح الفريق",
    "flexibilität": "المرونة", "belastbarkeit": "التحمل",
    "zuverlässigkeit": "الموثوقية", "pünktlichkeit": "الدقة في المواعيد",
    "selbstständigkeit": "الاستقلالية", "verlässlichkeit": "الاعتمادية",
    "umfeld": "البيئة", "atmosphäre": "الأجواء", "ambiente": "الأجواء",
    "blick": "منظر", "natur": "الطبيعة", "berge": "الجبال", "see": "بحيرة",
    "garten": "حديقة", "terrasse": "الشرفة", "halle": "القاعة",
    "standort": "الموقع", "arbeitsortes": "مكان العمل",
    "zukunft": "المستقبل", "entwicklung": "التطور", "weiterentwicklung": "التطوير",
    "erlebnis": "تجربة", "aufenthalt": "إقامة", "urlaub": "عطلة",
    "gästezimmer": "غرف الضيوف", "einzelzimmer": "غرفة مفردة", "suiten": "أجنحة",
    "lobby": "البهو", "rezeption": "الاستقبال", "empfang": "الاستقبال",
    "bar": "بار", "lounge": "الركن", "sauna": "الساونا", "pool": "المسبح",
    "fitness": "اللياقة البدنية", "ski": "التزلج", "schi": "التزلج",
    "sport": "الرياضة", "kurse": "الدورات", "veranstaltungen": "الفعاليات",
    "events": "الفعاليات", "hochzeiten": "حفلات الزفاف", "bankett": "الولائم",
    "catering": "تقديم الطعام", "lieferung": "التوصيل",
    "mittagessen": "وجبة الغداء", "abendessen": "وجبة العشاء",
    "abend": "المساء", "nacht": "الليل", "morgens": "صباحاً", "abends": "مساءً",
    "täglich": "يومياً", "wöchentlich": "أسبوعياً", "monatlich": "شهرياً",
    "vollzeit": "دوام كامل", "teilzeit": "دوام جزئي",
    "flexible": "مرنة", "flexibel": "مرن", "selbstständig": "بشكل مستقل",
    "selbstständige": "مستقل", "selbstständiges": "مستقل", "selbständig": "بشكل مستقل",
    "strukturierte": "منظم", "organisiert": "منظم", "aktiv": "نشط",
    "motiviert": "متحمس", "motivierte": "متحمس", "motivierten": "متحمسين",
    "engagiert": "ملتزم", "engagierte": "ملتزم", "engagierten": "ملتزمين",
    "zuverlässig": "موثوق", "freundlich": "ودود", "freundliche": "ودود",
    "freundliches": "ودود", "freundlichen": "ودودة", "herzlich": "بحرارة",
    "herzliche": "ودود", "herzliches": "ودود", "positiv": "إيجابي",
    "professionell": "احترافي", "professionelle": "احترافي",
    "kompetent": "كفؤ", "erfahren": "خبير", "erfahrene": "ذو خبرة",
    "gute": "جيد", "guter": "جيد", "gutes": "جيد", "guten": "جيدة", "gut": "جيد",
    "gern": "بكل سرور", "gerne": "بكل سرور", "sehr gerne": "بكل سرور",
    "leicht": "سهل", "einfach": "بسيط", "schnell": "سريع",
    "wichtig": "مهم", "notwendig": "ضروري", "zwingend": "إلزامياً",
    "sicher": "آمن", "sichere": "آمن", "sicheren": "آمن", "sicherer": "آمن",
    "neue": "جديد", "neues": "جديد", "neuen": "جديدة", "neuer": "جديد",
    "attraktive": "جذابة", "individuelle": "فردية", "individuell": "فردي",
    "moderne": "حديث", "modern": "حديث", "traditionell": "تقليدي",
    "regionale": "محلية", "regionalen": "محلية", "frische": "طازجة", "frisch": "طازج",
    "frischen": "طازجة", "hohe": "عالي", "hohen": "عالية", "hohes": "عالٍ",
    "regelmäßige": "منتظم", "regelmäßig": "بانتظام", "laufende": "مستمر",
    "weitere": "إضافية", "weitere": "إضافية",
    "mehrjährige": "لعدة سنوات", "langfristige": "طويلة المدى", "langfristig": "طويل المدى",
    "kurzfristig": "قصير المدى", "sofort": "فوراً",
    "kostenlos": "مجاناً", "kostenlose": "مجانية", "kostenfreie": "مجانية", "gratis": "مجاناً",
    "frei": "مجاني", "inklusive": "بما في ذلك", "inkl": "بما في ذلك",
    "inklusive": "بما في ذلك", "exklusive": "باستثناء",
    "mindestens": "على الأقل", "zusätzlich": "إضافي", "ausschließlich": "حصرياً",
    "gesetzliche": "قانونية", "gesetzlich": "قانونياً", "eigene": "خاص",
    "eigenes": "خاص", "eigener": "خاص", "eigenen": "خاصة",
    "möglich": "ممكن", "möglichen": "ممكنة",
    "erforderlichen": "المطلوبة", "geforderte": "المطلوبة",
    "öffentlichen": "العمومية", "öffentlich": "عمومي",
    "körperliche": "جسدية", "geistige": "ذهنية", "soziale": "اجتماعية",
    "vergleichbare": "مماثلة", "vergleichbaren": "مماثلة",
    "hochwertige": "عالية الجودة", "hochwertigen": "عالية الجودة",
    "aussagekräftige": "معبّر", "aussagekräftigen": "معبّر", "vollständigen": "كاملة",
    "vollständig": "كامل", "schriftliche": "مكتوب", "schriftlich": "كتابياً",
    "telefonisch": "هاتفياً", "persönlich": "شخصياً", "persönlichen": "شخصي",
    "persönliche": "شخصي", "direkt": "مباشرة", "gemeinsam": "معاً",
    "unbefristete": "غير محدودة المدة", "befristet": "محدود المدة",
    "jahresstelle": "وظيفة سنوية", "saisonstelle": "وظيفة موسمية",
    "ganzjahresstelle": "وظيفة طوال السنة",
    "unser": "فريقنا", "deine": "ملفك",
    "erste": "أول", "beste": "الأفضل", "besten": "الأفضل",
    "zahlreiche": "عديدة", "verschiedene": "مختلفة", "verschiedenen": "مختلفة",
    "mehrere": "عدة", "wenige": "قليلة",
    "klingt": "يبدو", "lässt": "يسمح", "lassen": "ترك",
    "neben": "بجانب", "innerhalb": "داخل", "außerhalb": "خارج",
    "während": "خلال", "zwischen": "بين", "unter": "تحت", "über": "فوق",
    "rund": "حوالي", "etwa": "حوالي", "ca": "حوالي", "circa": "حوالي",
    "insgesamt": "إجمالاً", "insbesondere": "خاصة", "besonders": "بشكل خاص",
    "jedoch": "لكن", "denn": "لأن", "dann": "إذن", "dafür": "لذلك",
    "dazu": "لهذا", "damit": "بذلك", "darauf": "على ذلك", "daran": "عليه",
    "dabei": "في ذلك", "durch": "عبر", "sondern": "بل", "doch": "لكن",
    "hier": "هنا", "dort": "هناك", "heute": "اليوم", "jetzt": "الآن",
    "bereits": "بالفعل", "schon": "بالفعل", "erst": "فقط", "noch": "لا يزال",
    "wird": "يتم", "wurde": "تم", "würde": "سوف", "kann": "يمكن",
    "dürfen": "يمكن", "darf": "يمكن", "macht": "يقوم", "machen": "يقومون",
    "läuft": "يسير", "geht": "يتعلق", "stellt": "يقدم", "stellt ein": "يوظّف",
    "hilft": "يساعد", "helfen": "مساعدة", "sorgt": "يعتني", "sorgen": "يعتنون",
    "trifft": "يلتقي", "spricht": "يتحدث", "fehlt": "ينقص",
    "bietet": "يقدم", "werden angeboten": "معروضة",
    "freie": "حرة", "freien": "حرة", "flexibel gestaltbar": "قابلة للتعديل بمرونة",
    "absprache": "اتفاق", "vereinbarung": "الاتفاق",
    "beschäftigung": "العمل", "anstellung": "التوظيف", "tätigkeit": "النشاط",
    "berufstätigkeit": "العمل المهني", "position": "المنصب",
    "volle": "كامل", "vollen": "كاملة", "voller": "مليء",
    "kleinen": "صغيرة", "kleines": "صغير", "kleine": "صغيرة", "großen": "كبيرة",
    "großes": "كبير", "große": "كبيرة", "idyllisch": "خلاب", "zentral": "مركزي",
    "ruhige": "هادئ", "ruhigen": "هادئة", "schöne": "جميل", "schönen": "جميلة",
    "bekannt": "معروف", "beliebt": "محبوب", "erfolgreich": "ناجح",
    "modern": "حديث", "zeitgemäß": "حديث", "klassisch": "كلاسيكي",
    "besteht": "يتكون", "gelegen": "يقع", "umgeben": "محاط",
    "entstanden": "نشأت", "geplant": "مخطط", "gesucht": "مطلوب",
    "einmalig": "فريد", "einzigartig": "فريد", "unvergesslich": "لا يُنسى",
    "lecker": "لذيذ", "leckere": "لذيذة", "gesund": "صحي",
    "echt": "حقيقي", "wirklich": "حقاً", "sehr": "جداً",
    "besonderer": "خاص", "besondere": "خاصة", "besonderes": "خاص",
    "toller": "رائع", "tolle": "رائع", "super": "ممتاز", "perfekt": "مثالي",
    "ideale": "مثالي", "ideal": "مثالي", "idealerweise": "من الأفضل",
    "spannend": "مشوق", "herausfordernd": "محفّز",
    "flexible": "مرنة", "flexiblen": "مرنة",
    # titles in descriptions
    "chef de partie": "شيف قسم", "chef de rang": "شيف خدمة الصالة",
    "souschef": "نائب الشيف", "commis": "مساعد", "kitchen": "المطبخ",
    "restaurantfachmann": "متخصص مطاعم", "restaurantfachfrau": "متخصصة مطاعم",
    "hotelfachmann": "أخصائي فنادق", "hotelfachfrau": "أخصائية فنادق",
    "hausdame": "مشرفة الغرف", "barkeeper": "بارمان", "barista": "باريستا",
    "pizzakoch": "طباخ بيتزا", "jungkoch": "طباخ مبتدئ", "beikoch": "طاهٍ مساعد",
    "frühstückskoch": "طباخ الفطور", "küchenchef": "رئيس الطهاة",
    "rezeptionist": "موظف استقبال", "empfang": "الاستقبال",
    "hausmeister": "حارس مبنى", "haustechniker": "تقني المباني",
    "masseur": "معالج بالتدليك", "masseurin": "معالجة بالتدليك",
    "kosmetikerin": "أخصائية تجميل", "kosmetiker": "أخصائي تجميل",
    "buchhalter": "محاسب", "verkäufer": "بائع", "kassierer": "موظف صندوق",
    "küchenhilfe": "مساعدة مطبخ", "küchengehilfe": "مساعد مطبخ",
    "servicekraft": "عامل خدمة", "kellner": "نادل", "kellnerin": "نادلة",
    "servierer": "نادل", "abwascher": "غاسل أطباق", "spülkraft": "غاسل أطباق",
    "zimmermädchen": "عاملة تنظيف الغرف", "zimmerbursch": "عامل تنظيف الغرف",
    "stubenmädchen": "عاملة تنظيف الغرف",
    "reinigungskraft": "عامل نظافة", "putzkraft": "عامل نظافة",
    "hilfskraft": "مساعدة", "helfer": "مساعد", "mitarbeiter": "موظف",
    "leitung": "الإدارة", "manager": "مدير", "management": "الإدارة",
    "betreuer": "مشرف", "betreuung": "الرعاية", "pflege": "الرعاية",
    "koch": "طباخ", "köchin": "طباخة", "köche": "طباخون",
}


_PHRASE_MAP = {p.lower(): d for p, d in DESC_PHRASES}
_PHRASE_RE = re.compile(
    "|".join(re.escape(p) for p in sorted(_PHRASE_MAP, key=len, reverse=True)),
    re.IGNORECASE,
)
_WORD_RE = re.compile(r"[A-Za-zÄÖÜäöüß]+")
_LATIN = "abcdefghijklmnopqrstuvwxyzäöüß"


def _phrase_sub(text):
    def repl(m):
        before = text[m.start() - 1].lower() if m.start() > 0 else ""
        after = text[m.end()].lower() if m.end() < len(text) else ""
        # A match glued to a latin letter is part of a longer word -> skip
        if (before and before in _LATIN) or (after and after in _LATIN):
            return m.group(0)
        return _PHRASE_MAP[m.group(0).lower()]

    return _PHRASE_RE.sub(repl, text)


def _latin_share(text):
    """Share of words that are still latin (1.0 = untranslated). Mixed tokens
    (latin+arabic glued together) count half, since they are only partly translated."""
    latin = 0.0
    arab = 0.0
    for t in text.split():
        has_l = bool(re.search(r"[A-Za-zÄÖÜäöüß]", t))
        has_a = bool(re.search(r"[\u0600-\u06FF]", t))
        if has_l and has_a:
            latin += 0.5
            arab += 0.5
        elif has_l:
            latin += 1.0
        elif has_a:
            arab += 1.0
    total = latin + arab
    return latin / total if total else 1.0


def _translate_sentence(sentence):
    """Translate one sentence via salary + phrase rules (no word-by-word
    replacement — it produces unreadable German/Arabic hybrids)."""
    text = re.sub(
        r"(?i)das mindestentgelt für die stelle als .{0,150}? beträgt ([0-9.,]+) eur brutto(?: pro monat)?(?: auf basis vollzeitbeschäftigung)?",
        r"الحد الأدنى للأجر لهذه الوظيفة يبلغ \1 يورو شهرياً إجمالاً على أساس دوام كامل",
        sentence,
    )
    text = re.sub(
        r"(?i)das mindestentgelt für die stellen als .{0,150}? beträgt ([0-9.,]+) eur brutto(?: pro monat)?(?: auf basis vollzeitbeschäftigung)?",
        r"الحد الأدنى للأجر لهذه الوظائف يبلغ \1 يورو شهرياً إجمالاً على أساس دوام كامل",
        text,
    )
    text = _phrase_sub(text)
    text = re.sub(r"\s{2,}", " ", text).strip()
    return text


_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
_URL_RE = re.compile(r"https?://\S+|www\.\S+")


def _protect(text):
    """Swap emails/URLs with placeholders so the translator can't corrupt them."""
    held = []

    def stash(m):
        held.append(m.group(0))
        return "\x01E%d\x01" % (len(held) - 1)

    text = _EMAIL_RE.sub(stash, text)
    text = _URL_RE.sub(stash, text)
    return text, held


def _restore(text, held):
    def pop(m):
        return held[int(m.group(1))]

    return re.sub(r"\x01E(\d+)\x01", pop, text)


def translate_description(raw):
    text = html.unescape(raw or "")
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"<br\s*/?>", ". ", text, flags=re.I)
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return ""

    text, held = _protect(text)

    parts = re.split(r"(?<=[.!?])\s+", text)
    out = []
    for p in parts:
        p = p.strip()
        if not p:
            continue
        if _latin_share(p) < 0.1:
            out.append(p)
            continue
        # Only high-confidence phrase/salary substitutions are applied (no
        # word-by-word mangling), so always keep the translated sentence: a
        # natural Arabic phrase embedded in an otherwise foreign sentence is
        # strictly more useful than reverting the whole sentence.
        out.append(_translate_sentence(p))
    text = " ".join(out)
    text = _restore(text, held)
    text = re.sub(r"\s{2,}", " ", text).strip()
    return text


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def parse_region(raw):
    m = re.search(r'"([A-Z]{2}\d+)"', raw or "")
    if m:
        return m.group(1)
    return ""


def format_date(ms):
    try:
        ts = int(ms) / 1000.0
    except Exception:
        return ""
    import datetime
    return datetime.datetime.fromtimestamp(ts, datetime.UTC).strftime("%Y-%m-%d")


def load_existing_offers():
    """Load the current js/offers-data.js into a dict keyed by id (`i`), so an
    incremental regen only refreshes `u` from source_url instead of rerunning
    the expensive translation pipeline. Returns {} when the file is missing or
    unreadable."""
    if not os.path.exists(OUT_PATH):
        return {}
    with open(OUT_PATH, encoding="utf-8") as f:
        text = f.read()
    marker = "window.OFFERS_DATA ="
    idx = text.find(marker)
    if idx == -1:
        return {}
    payload = text[idx + len(marker):].strip()
    if payload.endswith(";"):
        payload = payload[:-1].rstrip()
    try:
        records = json.loads(payload)
    except Exception:
        return {}
    return {
        rec.get("i"): rec
        for rec in records
        if isinstance(rec, dict) and rec.get("i")
    }


def main():
    incremental = "--incremental" in sys.argv[1:]
    if not os.path.exists(CSV_PATH):
        raise SystemExit("CSV not found: " + CSV_PATH)
    with open(CSV_PATH, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    print("CSV offers:", len(rows))

    cached = load_existing_offers()
    offers = []
    reused = 0
    skipped = 0
    for r in rows:
        offer_id = (r.get("id") or "").strip()
        source = (r.get("source_url") or "").strip()

        if incremental:
            # Keep the existing dataset untouched: reuse every cached offer
            # verbatim (no retranslation) and only refresh `u` with the
            # source_url of the exact same id. Rows not present in the cache
            # are skipped — adding them requires a full regeneration.
            rec = cached.get(offer_id)
            if rec is None:
                skipped += 1
                continue
            rec = dict(rec)
            rec["u"] = source
            offers.append(rec)
            reused += 1
            continue

        title_orig = (r.get("title") or "").strip()
        title_ar = translate_title(title_orig)
        # Full hand-translations (long unique texts) win over the phrase pipeline.
        desc_ar = DESC_BY_ID.get(offer_id) or translate_description(r.get("description"))
        country = (r.get("country") or "").strip()
        offers.append({
            "i": offer_id,
            "t": title_ar or title_orig,
            "o": title_orig,
            "d": desc_ar,
            "e": (r.get("employer_name") or "").strip(),
            "r": (r.get("position_offering_code") or "").strip(),
            "rg": parse_region(r.get("location_map")),
            "dt": format_date(r.get("creation_date")),
            "c": country,
            "ca": COUNTRIES_AR.get(country, country),
            "s": translate_secteurs(r.get("secteurs")),
            "m": (r.get("email_direct") or "").strip(),
            "u": source,
        })

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    lines = ["/* Generated by tools/generate-offers-data.py from eures_jobs_SECI.csv — do not edit by hand. */",
             "/* Each record: i=id(CSV) t=title(ar) o=title(orig) d=description(ar) e=employer r=ref rg=region dt=date",
             "   c=country(iso) ca=country(ar) s=secteurs(ar) m=email u=source_url */",
             "window.OFFERS_DATA = ["]
    body = []
    for o in offers:
        body.append(json.dumps(o, ensure_ascii=False))
    lines.append(",".join(body))
    lines.append("];")
    with open(OUT_PATH, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines))
    if incremental:
        print("Incremental: reused", reused, "offers, skipped", skipped, "new CSV rows")
    else:
        print("Full: offers", len(offers))
    print("Wrote", OUT_PATH, "offers:", len(offers))


if __name__ == "__main__":
    main()