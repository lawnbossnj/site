# Modernize string-`^html` item building → `list()` + components

**Mandate (user):** every component using `escapeHtml` and/or old-style `^html` + string-concat
item building must move to `list()` + child components (or the right safe tool) when dealing with
items. The manual-escape footgun (forget one interpolation → XSS) and the string-builder pattern go away.

**Why:** UWC renders `${x}` as `textContent` by DEFAULT (XSS-safe). `^html${str}` opts OUT into raw
`innerHTML`, which is why those spots need manual `escapeHtml`. Rendering items through `list()` (or
per-item template fragments) restores the safe default and removes the escape burden entirely.

## Canonical pattern — PROVEN by `ui-tabs` (shadow-DOM rows, NOT light-DOM)

`ui-tabs` + `ui-tab-button` (tabs.js / tab-button.js) already solve roving-focus over
component rows with full shadow encapsulation. Replicate it verbatim — do NOT invent light-DOM:
- ROW component (normal shadow DOM): `static state` supplies its own defaults; renders
  `${state.label}` (auto-escaped `textContent` — NO escapeHtml); conditional children via
  `this.htmlElement`…`` (never `^html` strings); emits its event BY NAME
  (`this.emit('menu-item:select', {value})`); exposes a `focus()` method → `this.refs.button?.focus()`.
- PARENT: `list('items', RowComponent)` on the RAW `items` key (HARD RULE — never a derived array).
  ONE container `@menu-item:select` listener + ONE `@keydown`. Roving is DATA-DRIVEN: compute the next
  index from `state.items` (skip separators/disabled), then `this.findComponent('ui-menu-item', pred).focus()`
  — no shadow-piercing `querySelector`. Roving tabindex on each row (`tabindex=${active?'0':'-1'}`).
- Selection flow: row emits `menu-item:select` → menu catches (container listener) → `hidePopover()` +
  re-emits the PUBLIC `menu:select {value, item, index}` (stable consumer API preserved).
- Reflection (danger/checked/active) DECLARATIVE via bound class/`?attr=`, never imperative observe.

## Two-pattern split (advisor) — pick by row cost, not reflex
- **Interactive selectable lists → component rows** (`list('items', RowComponent)`): menu items,
  menubar triggers, radio-group options, image-list cells, pagination controls, carousel dots.
- **Dense DISPLAY grids → `list('items', renderFn)` render-FN kind** (the `'fn'` kind, see
  paged-list.js:212) — NOT a custom element per cell: calendar (42 day cells), ui-stat-table
  (rows×cols), color-picker swatches. Per-cell components carry real lifecycle cost; the `^html`
  there was partly a perf choice. `list()`+fn still restores auto-escaping and drops the string builder.

## Triage by USER-DATA exposure (do the XSS-real ones first)
- **HIGH — user strings interpolated into `^html` (real footgun):** menu DONE · menubar trigger labels
  STILL · select DONE · image-list DONE · ui-stat-table cells STILL · pin-input attrs STILL ·
  Phase 3 panel rows STILL. THESE NEXT.
- **LOW — pure computed markup, no user strings (consistency only, some fine to keep):** pagination
  numbers, calendar day numbers, skeleton, carousel dots, stepper.

## Phases

### Phase 0a — `ui-menu` ALONE = reference implementation  ← BUILD, VERIFY, GET BLESSED before anything else
- New `ui-menu-item` (SHADOW-DOM row, per the tabs pattern): `static state` { label, value, kbd,
  danger, checked, disabled, separator, active }; auto-escaped `${state.label}`/`${state.kbd}`;
  `focus()` method; emits `menu-item:select`. Separator → `<div role="separator">` branch.
- `menu.js`: `list('items', UIMenuItem)` on raw key; ONE `@menu-item:select` + ONE `@keydown`. Rewrite
  roving (`enabledIndexes`/`move`/`focusItem`/`handleKey`) data-driven + `findComponent(...).focus()`.
  Menu re-emits public `menu:select {value,item,index}` + `hidePopover()`. Drop `renderItems` + `^html`.
  Fold in `align` (start|center|end, default center) + keep `matchWidth`.
- `escapeHtml`: menu.js STILL exports it here (menubar/pin-input import it until Phase 0b/2) — remove the
  export only once no importer remains.
- VERIFY with REAL keyboard events (page.keyboard.press): focus-on-open shows no pre-highlight,
  ArrowDown/Up roving skips separators+disabled, Home/End, Enter/Space selects, aria-expanded flips,
  danger/checked/separator render, center default + align start/end + matchWidth. **Then get user sign-off.**

### Phase 0b — subclasses (AFTER 0a blessed)
- `menubar.js`: triggers → `list()` + a trigger row component (or reuse pattern); submenu items inherit
  the modernized menu rendering; drop `renderTriggers`/`renderItems` + the `escapeHtml` import; `align`.
- `context-menu.js`: inherits modernized items/roving; update its `position()` for `align`.
- After both convert + pin-input (Phase 2): DELETE the `escapeHtml` export from menu.js.

### Phase 1 — simple interactive lists — ALL DONE
~~pagination~~ ~~carousel dots~~ ~~stepper~~ ~~radio-group~~ ~~image-list~~.

### Phase 2 — complex / native-backed — ALL DONE
~~select~~ ~~color-picker presets~~ ~~theme-select~~ ~~pin-input~~ ~~ui-stat-table~~ ~~calendar~~.

### Phase 3 — user/* pages — ALL DONE
~~settings-modal~~ ~~explorer-page~~ ~~network-stats~~ ~~wallet-stats-panel~~ ~~wallet-params~~
~~account-detail-page~~ ~~transaction-detail-page~~ ~~panel~~.

### Keep (NOT string-built items — leave)
wallet-qr (SVG), ai-message/markdown (markdown→HTML renderer; its local escapeHtml stays),
skeleton (pure-display placeholder), whitebox-modal (small trusted media literal), divider.

## escapeHtml resolution
- **GONE** from menu.js and `core/utilities.js` (no remaining component importers).
- markdown.js local copy → KEPT (legit: escaping text before applying markdown tokens).

## Verify discipline
Establish + live-verify Phase 0 before fanning out. Each later component: convert, `node --check` +
eslint, and drive it in the gallery (list renders, events fire, no regressions). Track as emP items.

## STATUS
- [x] Phase 0a — `ui-menu` + `ui-menu-item` (live-verified).
- [x] Phase 0b — context-menu + menubar dropdown + **menubar trigger strip**
      (`list('menus', this.triggerRow)` light html; escapeHtml GONE).
- [x] escapeHtml — **DELETED from `core/utilities.js`**. No component importers remain.
      `markdown.js` local copy KEPT (legit markdown pipeline).
- [x] Phase 1 — ALL DONE:
      radio-group · image-list · stepper · pagination · carousel dots.
- [x] Phase 2 — ALL DONE:
      select · color-picker presets · theme-select · pin-input · ui-stat-table · calendar.
- [x] Phase 3 — DONE (audited 2026-07-10):
      panel base (`${this.renderBody}` / `${this.renderDot}`, no `^html`) ·
      network-stats · wallet-stats-panel · wallet-params · wallet-panel ·
      settings-modal (theme/profile options + wallet rows via `list()`) ·
      explorer-page filters · account-detail stats · transaction-detail body.
- [x] Keep (unchanged by design): wallet-qr SVG · ai-message/markdown escapeHtml ·
      whitebox-modal · divider.
- [x] Follow-up modernization (2026-07-10 scan):
      - [x] ui-button label — `htmlElement` (was `^html` string; XSS-safe)
      - [x] ui-skeleton — `list('lineItems', lineRow)` (was string builder)
      - [x] paged-list head — bare `${this.headHtml}`; hosts return `html\`…\``
        (explorer / account-detail / accounts-list)
- [x] REMAINING intentional `^html`: ai-message markdown HTML · wallet-qr SVG only.
- [ ] Optional polish (not XSS item lists): color-picker `syncActiveSwatch` still
      `querySelectorAll` (could stamp `data-on` via list flags); pin-input / menubar
      index focus still `querySelector` (accepted focusItem pattern); radio-group
      `querySelectorAll` for checked sync.
