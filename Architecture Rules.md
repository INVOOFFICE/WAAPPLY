# Visa Schengen — Architecture Rules
> This file is the single source of truth for any project modification.
> OpenCode must read and fully comply with it before each task.

---

## 1. File Structure

```
Visa Schengen/
├── index.html
├── assets/
│   ├── css/
│   │   ├── main.css
│   │   ├── base/
│   │   │   ├── _variables.css
│   │   │   ├── _reset.css
│   │   │   ├── _typography.css
│   │   │   └── _animations.css
│   │   ├── layout/
│   │   │   ├── _nav.css
│   │   │   ├── _hero.css
│   │   │   ├── _footer.css
│   │   │   └── _sections.css
│   │   ├── components/
│   │   │   ├── _buttons.css
│   │   │   ├── _forms.css
│   │   │   ├── _evaluator.css
│   │   │   ├── _result.css
│   │   │   ├── _features.css
│   │   │   ├── _countries.css
│   │   │   └── _news.css
│   │   └── utilities/
│   │       └── _responsive.css
│   └── js/
│       ├── main.js
│       ├── evaluator.js
│       └── icons.js
```

### Absolute Rules on Structure
- ❌ Never create a file outside this structure without declaring it here
- ❌ Never add a CSS or JS file at the project root
- ✅ Any new CSS component → create `components/_name.css` + import it in `main.css`
- ✅ Any new JS module → create `js/name.js` + import it in `main.js`

---

## 2. HTML Rules — `index.html`

```html
<!-- ✅ Allowed -->
<link rel="stylesheet" href="assets/css/main.css">
<script type="module" src="assets/js/main.js"></script>

<!-- ❌ Strictly forbidden -->
<style> ... </style>
<script> ... </script>         <!-- inline or without src -->
<script src="..." defer>       <!-- without type="module" -->
```

- `index.html` contains **zero** `<style>` tags and **zero** inline `<script>` blocks
- All scripts are loaded via `<script type="module" src="...">`
- The `id` and `class` attributes in HTML must exactly match existing CSS selectors

---

## 3. CSS Rules

### Cascade and Import Order in `main.css`
```css
/* 1. Base — always first */
@import 'base/_variables.css';
@import 'base/_reset.css';
@import 'base/_typography.css';
@import 'base/_animations.css';

/* 2. Layout */
@import 'layout/_sections.css';
@import 'layout/_nav.css';
@import 'layout/_hero.css';
@import 'layout/_footer.css';

/* 3. Components */
@import 'components/_buttons.css';
@import 'components/_forms.css';
@import 'components/_evaluator.css';
@import 'components/_result.css';
@import 'components/_features.css';
@import 'components/_countries.css';
@import 'components/_news.css';

/* 4. Utilities — always last */
@import 'utilities/_responsive.css';
```

### Rules per File

| File | Allowed Content | Forbidden Content |
|---|---|---|
| `_variables.css` | Only `:root { --var: value; }` | Any CSS rule other than `:root` |
| `_animations.css` | Only `@keyframes` | Any CSS rule other than `@keyframes` |
| `_responsive.css` | Only `@media` queries | Any rule outside `@media` |
| `_reset.css` | Global reset, `body`, `html`, `body` pseudo-elements | Specific components |
| Component files | Only the component's selectors | Inline variables, `@keyframes`, `@media` |

### CSS Variables
- ❌ Never write a hard-coded value if a variable already exists
- ❌ Never declare a new variable outside `_variables.css`
- ✅ Always use `var(--name)` for colors, radii, and fonts

```css
/* ❌ Forbidden */
background: #4F7CFF;
border-radius: 10px;

/* ✅ Correct */
background: var(--accent);
border-radius: var(--r);
```

### Responsive
- ❌ Never write a `@media` query inside a component or layout file
- ✅ All media queries go exclusively into `_responsive.css`
- Project standard breakpoints: `768px` (mobile), `1024px` (tablet)

---

## 4. JavaScript Rules — ES Modules

### Module Architecture
```
main.js        → entry point, imports everything, binds DOM events
evaluator.js   → pure business logic (score, calculation, result rendering)
icons.js       → SVG functions, no business logic
```

### Required Syntax
```js
// ✅ Named exports required
export function calculate() { ... }
export function score() { ... }
export const svgBag = () => `<svg...>`

// ✅ Named imports required in main.js
import { calculate, score, render } from './evaluator.js';
import { svgBag, svgCoin } from './icons.js';

// ❌ Forbidden
export default ...          // no default exports
window.calculate = ...      // no globals
var x = ...                 // no var, only const/let
```

### Strict JS Rules
- ❌ No `var` — only `const` and `let`
- ❌ No global functions attached to `window`
- ❌ No DOM manipulation in `evaluator.js` or `icons.js`
- ✅ All DOM manipulation (getElementById, querySelector, addEventListener) → only in `main.js`
- ✅ `evaluator.js` returns pure data, `main.js` injects it into the DOM
- ✅ Each JS file starts with a JSDoc block describing its responsibility

```js
/**
 * @file evaluator.js
 * @description Scoring logic for the Schengen visa application.
 * Calculates a score, generates criteria and improvement tips.
 * Does not touch the DOM — returns data objects only.
 */
```

---

## 5. Naming Rules

### CSS — Simplified BEM
```css
/* Block */
.eval-wrap { }

/* Element */
.eval-header { }
.eval-body { }

/* Modifier */
.btn-primary { }
.btn-ghost { }
.v-high { }
.v-low { }
```

- CSS classes use `kebab-case`
- IDs use `kebab-case` and are reserved for JS elements (`#result`, `#loader`, `#res-bar`)
- No generic utility classes like `.mt-4`, `.flex` — everything is semantic

### JavaScript
```js
// Functions → camelCase
export function calculateChances() { }
const renderResult = () => { }

// Global constants → UPPER_SNAKE_CASE
const MAX_SCORE = 96;
const MIN_SCORE = 8;

// Local variables → camelCase
const totalScore = 0;
```

---

## 6. Quality Rules

### Before Each Modification
1. Read this `RULES.md` file
2. Identify the file(s) involved based on the structure
3. Only modify the necessary files — no unrequested refactoring

### Global Prohibitions
- ❌ Never duplicate CSS between two files
- ❌ Never copy-paste a style block into `index.html`
- ❌ Never mix business logic and DOM manipulation in the same file
- ❌ Never modify `_variables.css` without checking that the variable doesn't already exist
- ❌ Never create a new file without registering it in `main.css` or `main.js`

### Pre-Validation Checklist
```
[ ] index.html contains no <style> or inline <script> tags
[ ] All new CSS variables are in _variables.css
[ ] All @keyframes are in _animations.css
[ ] All @media queries are in _responsive.css
[ ] New JS modules are imported in main.js
[ ] New functions are exported as named exports
[ ] No hard-coded values where a CSS variable exists
[ ] File structure exactly matches this RULES.md
```

---

## 7. Design Tokens — Quick Reference

```css
/* Main colors */
--bg: #080C14          /* global background */
--bg-1: #0D1421        /* surfaces */
--bg-2: #111927        /* hover surfaces */
--accent: #4F7CFF      /* primary blue */
--accent-2: #7C5BF5    /* secondary purple */
--gold: #E8B85A        /* gold accent */
--green: #2DD496       /* success */
--orange: #FF8C42      /* warning */
--red: #FF5A5A         /* error */
--text: #F2F4F8        /* primary text */
--text-2: rgba(242,244,248,0.55)   /* secondary text */
--text-3: rgba(242,244,248,0.3)    /* disabled text */

/* Radii */
--r: 10px
--r-lg: 16px
--r-xl: 20px

/* Typography */
/* Headings  → Syne, 700–800, letter-spacing: -0.02em to -0.03em */
/* Body      → Instrument Sans, 300–600 */
```

---

*Last updated: May 2025 — Visa Schengen Morocco*
