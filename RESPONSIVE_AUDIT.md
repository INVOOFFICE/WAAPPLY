# Responsive Audit — WAAPPLY

Audit date: 2026-10-11
Scope: horizontal-overflow / layout robustness down to **320 px**, the **light
band below the dark footer on mobile**, plus mobile navigation and contact-modal
usability on the offer and content pages.
Method: real Chromium via Playwright, measuring
`document.documentElement.scrollWidth` vs `clientWidth` (overflow), the
`body` `padding-bottom`, and the gap between the footer's bottom edge and the
`body`'s bottom edge (the footer band) — every page at the widths
`320, 360, 375, 390, 430, 600, 768, 980, 1280`. Screenshots are artifacts only
(this environment cannot view images); every conclusion below is backed by
numeric geometry.

## Result summary

- **`offers.html`** was the only page with a real horizontal-overflow bug
  (banners ~462 px wide inside a 320 px viewport). **Fixed**, verified 320→1920 px.
- The mobile **hamburger tap target** was enlarged from 26×22 px to **44×44 px**.
- **A ~78 px light strip appeared below the dark footer on every non-blog page at
  ≤980 px.** Root cause found (dead `body{padding-bottom:78px}` reserved for a
  sticky CTA that is *never rendered*). **Fixed**, band = 0 everywhere.
- A directly related leftover (the PWA floating-card `bottom` offset that
  referenced the same 78 px) was corrected too.

## Defects found and fixed

### 1. `offers.html` — `.italia-banner` blew the layout to 462 px at phone widths (major)

**Symptom:** at a 320 px viewport the document scrolled horizontally
(`scrollWidth` 482 vs `clientWidth` 320). Each resource banner
(`.italia-banner`) measured ~462 px wide, so the whole page was wider than the
screen.

**Root cause:** the four resource cards live in `.opps-grid`, whose track was
`grid-template-columns:1fr`. `1fr` expands to `minmax(auto,1fr)`, so the track's
minimum width is its **min-content** width. The banner CTA is a `.btn`, and the
global button rule (`css/components.css`) is `white-space:nowrap`. The long
Arabic CTA labels («تصفّح عروض العمل في إيطاليا» …) therefore produced a
min-content width of ~462 px, which forced the grid track — and the page — wider
than 320 px. The image side (`.italia-media`, `aspect-ratio:2/1`) inherited that
oversized track.

**Fix (min-content constrained to 0 + CTA allowed to wrap):**

- `css/offers.css` — `.opps-grid{ ... grid-template-columns:minmax(0,1fr); ... }`
- `css/sections.css`:
  - `.italia-media{ ... min-width:0; }`
  - `.italia-body{max-width:460px; min-width:0;}`
  - `.italia-title{ ... overflow-wrap:anywhere; }`
  - `.italia-sub{ ... overflow-wrap:anywhere; }`
  - `.italia-cta{margin-top:var(--space-6); white-space:normal; text-align:center; max-width:100%;}`
- `css/responsive.css` (≤980 block):
  - `.italia-banner{grid-template-columns:minmax(0,1fr); gap:40px; padding:var(--space-6);}`
  - `.italia-body{max-width:640px; margin:0 auto; min-width:0;}`

`minmax(0,1fr)` removes the implicit `auto` (min-content) floor, `min-width:0`
lets the flex/grid children shrink, and `white-space:normal` lets the CTA wrap
to two lines instead of forcing the banner wider than the screen. The same
one-column collapse at ≤980 px keeps the mobile stack correct.

**Verification:** `offers.html` `scrollWidth == clientWidth` with **0 overflowing
elements** at every tested width: `320, 360, 375, 390, 430, 480, 542, 599, 600,
601, 767, 768, 769, 979, 980, 981, 1024, 1280, 1440, 1600, 1920`. At 320 px the
banner is 280 px, the media keeps its 2:1 ratio, the body column is 230 px and
the CTA is 230×75 (wraps to two lines) — nothing clipped. Boundary widths on
both sides of 600 / 768 / 980 are clean.

### 2. Mobile hamburger tap target too small (accessibility)

**Symptom:** the header hamburger was 26×22 px — below the 44×44 px minimum
recommended for touch targets.

**Fix (`css/layout.css`):**

```css
.hamburger{display:none; flex-direction:column; align-items:center; justify-content:center; gap:var(--space-1); width:44px; height:44px; background:none; padding:0;}
.hamburger span{display:block; width:26px; flex-shrink:0; height:2px; background:var(--navy); border-radius:2px; transition:.3s;}
```

The three bars stay the original 26×2 px; the button grows to 44×44 px and
centers them (`flex-direction:column` + `align-items:center`/`justify-content:center`).
The existing `.hamburger.open span:nth-child(1)/(3){transform:translateY(±7px)…}`
"X" animation is unaffected.

**Verification:** hamburger measures 44×44 px; the bars stay stacked and centered
(measured `left:29, top:27/33/39` at 320 px); clicking it opens the drawer
correctly on `index.html` and `offers-italia.html` (panel `left:58 / right:320`,
`body.nav-open`, no overflow); Escape closes it.

### 3. Light band below the dark footer at ≤980 px (major)

**Symptom:** on mobile, after the dark footer there was an empty strip of the
light page background (`--bg` `rgb(248,249,252)`), ~78 px tall, on every
non-blog page.

**Root cause:** `body{padding-bottom:78px}` was declared in the `@media(max-width:980px)`
block of `css/responsive.css` to reserve room for the fixed bottom
`.sticky-mobile-cta` bar. But that bar is **never rendered**: it is `display:none`
in the base rule (`css/components.css` line 62) *and* again inside the same
≤980 px block, and no rule anywhere sets it visible. The reserved padding was
therefore pure dead space — the fixed bar being `position:fixed` does not push
the footer up, so the 78 px showed up as a band of body background below the
footer. Measured at 375 px before the fix: body `padding-bottom:78px`, body bg
`rgb(248,249,252)`, footer bg `rgb(5,7,16)`, footer bottom y = 734, body bottom
y = 812 → exactly a 78 px light strip. Blog pages were unaffected because
`assets/blog.css` sets `body{padding-bottom:0}` at ≤980 px.

**Fix (`css/responsive.css`, ≤980 px block):** removed the orphan
`body{padding-bottom:78px;}`, replacing it with an explanatory comment; the
`.sticky-mobile-cta{display:none;}` rule is kept. No other rule was added.

**Verification:** `index.html` at 375 px — body `padding-bottom` = `0px`, footer
bottom == body bottom (812), band = 0 px; no horizontal overflow. Swept all
pages × 9 widths: band = 0 everywhere (see table).

### 4. (related) PWA floating-card offset referenced the removed 78 px

**Symptom:** force-rendering the PWA install card (`#pwaInstall` — hidden by
default, only revealed by `beforeinstallprompt`) showed it floating **90 px**
above the bottom of the viewport, leaving a visible gap below it.

**Root cause:** the ≤980 px override in `css/responsive.css` positioned the card
with `bottom:calc(78px + var(--space-3) + env(safe-area-inset-bottom,0px))` —
the 78 px being the very sticky-CTA offset removed in fix #3.

**Fix (`css/responsive.css`, ≤980 px block):**

```css
/* Near the bottom edge (space-3 breathing room + safe area). The sticky mobile CTA is
   hidden at this breakpoint and body has no bottom offset, so there is no 78px bar to clear. */
.pwa-install, .pwa-update{
  bottom:calc(var(--space-3) + env(safe-area-inset-bottom, 0px));
  width:min(440px, calc(100% - var(--space-5)));
}
```

**Verification:** forced-shown card now measures `bottom:12px`
(`--space-3`), i.e. 12 px above the viewport bottom, width 355 px. The card
stays hidden in normal conditions, so this does not alter the default render.

## Pages verified clean (band = 0, no horizontal overflow)

Every page below was swept at **320, 360, 375, 390, 430, 600, 768, 980, 1280**
and reported `scrollWidth == clientWidth`, `body padding-bottom = 0px` (except
`waapply-payment.html`, see Observations), footer band = 0 and 0 overflowing
elements.

| Page | band | overflow |
|---|---|---|
| `index.html` | 0 @ all 9 | 0 @ all 9 |
| `offers.html` | 0 @ all 9 | 0 @ all 9 (plus boundaries 480/542/599/601/767/769/979/981/1024/1440/1600/1920) |
| `offers-italia.html` | 0 @ all 9 | 0 @ all 9 |
| `offers-manufacturing-industry.html` | 0 @ all 9 | 0 @ all 9 |
| `offers-hospitality-restauration.html` | 0 @ all 9 | 0 @ all 9 |
| `offers-administrative-support.html` | 0 @ all 9 | 0 @ all 9 |
| `terms.html` | 0 @ all 9 | 0 @ all 9 |
| `privacy.html` | 0 @ all 9 | 0 @ all 9 |
| `blog/index.html` | 0 @ all 9 | 0 @ all 9 |
| `blog/al-mihan-al-matlouba-fi-europe-eures.html` | 0 @ all 9 | 0 @ all 9 |
| `blog/comment-ecrire-lettre-de-motivation-europe.html` | 0 @ all 9 | 0 @ all 9 |
| `blog/motabaat-talab-alamal-baad-alirsal.html` | 0 @ all 9 | 0 @ all 9 |
| `waapply-payment.html` | 74 @ ≤600 (intentional, see Observations) | 0 @ all 9 |
| `blog/_template.html` | 0 @ all 9 | 28 @ 320 (false positive, see Observations) |

Direct `file://` cross-checks (not iframes) after the change: `index.html` @375
band 0; `offers.html` @375 band 0 (footer bottom 812 == body bottom 812).

## Interactions verified

- **Mobile nav open/closed** (`index.html` @ 320/375/600): closed → body
  `overflow-y:auto`, band 0, overflow 0; hamburger click → `#mobileNav.open`,
  body `overflow-y:hidden` (scroll lock works), band 0, overflow 0; click again →
  back to `auto`, band 0. No layout regressions in the open drawer state.
- **Contact modal** (`offers.html` @ 320 px): `window.openContactModal('info')` /
  `window.closeContactModal()` work; the panel renders as a bottom sheet that fits
  (w 320, `max-height:92vh` = 680.8 px, rendered height 613 px). Empty submit
  triggers validation: `.cm-invalid` on `#cm-name` / `#cm-phone` with messages
  «عافاك دخل الاسم ديالك.» and «عافاك دخل رقم واتساب صحيح.». No request is sent.
- **No console errors** on `offers.html`.
- `offers.html` has 4 resource CTAs pointing to `offers-italia.html`,
  `offers-manufacturing-industry.html`, `offers-hospitality-restauration.html`,
  `offers-administrative-support.html`.
- `offers-italia.html`: email reveal (`.offer-email-btn` → `.offer-email-panel`)
  fits inside the card; pager works.

## Observations — not changed (documented deliberately)

1. **`waapply-payment.html` keeps its own `body{padding-bottom:74px}`.** This page
   does **not** use the shared `responsive.css`; it carries an inline stylesheet
   with its own fixed `.sticky-cta` (measured `display:flex`, `position:fixed`,
   height 89 px) that is shown at ≤759 px and hidden only at
   `@media(min-width:760px)` (where it also zeroes the padding). The 74 px is
   therefore a *real* reserved space for a *visible* bar, not dead space. Leaving
   it is correct; removing it would make the bar cover the footer.
2. **`blog/_template.html` at 320 px is a false positive** — it links
   `assets/blog.css` (no `../` because it is the engine template; the generator
   rewrites the path to `../assets/blog.css` at publish time). Opening the raw
   template over `file://` therefore misses the stylesheet and reports overflow.
   **Do not modify the template**; generated articles are clean.
3. **Intentional `object-fit:cover` crops** (e.g. 16:9 photos in 2:1 banner
   frames, portrait sector/blog covers) are design choices, not stretching.
4. **Admin-support banner images.** The sector card and the `offers.html` banner
   now use two distinct local files with normal names
   (`js/sectors.js` → `…soutien.jpg`, `offers.html` → `…soutien 1.jpg`); both load.

## Before / after (screenshots)

- Before: `band-BEFORE-index-375-*.png` (`C:\Users\onouari\Downloads\`).
- After: `band-AFTER-index-375-*.png`, `band-AFTER-offers-375-*.png`
  (`C:\Users\onouari\AppData\Local\Temp\opencode\waapply-audit\`).

## Files changed

- `css/offers.css` — `.opps-grid` track `1fr` → `minmax(0,1fr)`.
- `css/sections.css` — `.italia-media` / `.italia-body` `min-width:0`;
  `.italia-title` / `.italia-sub` `overflow-wrap:anywhere`; `.italia-cta`
  `white-space:normal; text-align:center; max-width:100%`.
- `css/responsive.css` — ≤980 px: `.italia-banner` track `1fr` →
  `minmax(0,1fr)`, `.italia-body` `min-width:0`; **removed the orphan
  `body{padding-bottom:78px;}`**; **fixed the PWA card `bottom` offset** to drop
  the removed 78 px.
- `css/layout.css` — `.hamburger` enlarged to 44×44 px, bars kept 26 px.

No text, images, links, CTAs, animations, SEO tags, scripts, dataset files or
generated data were modified. `css/responsive.css` still loads after
`css/offers.css`; all pages remain plain-`file://` compatible.

## Testing note (method)

Playwright's `navigate(width:)` does not reliably resize, and batching several
`resize`+`evaluate` pairs in one call reorders them (all resizes before all
evaluates). To measure many widths reliably, pages were served from a local
`python -m http.server` and measured inside **same-origin iframes** (one per
width, off-screen), scrolling each iframe before reading geometry; key results
were then cross-checked directly over `file://`.
