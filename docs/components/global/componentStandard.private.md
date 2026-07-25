# Global Component API Standard — state keys, events, payloads

Authoritative naming + shape standard for every component under `components/global/`.
Companion to [`componentManifest.private.md`](./componentManifest.private.md) (the as-built inventory).
Framework contracts referenced here live in `core/events/events.js` (emit), `core/template/parser.js` (@event parsing), `core/template.js` (state channel, list machinery).

Ratified 2026-07-04: colon event style · `items` everywhere · no native-name re-emits · full migration.

---

## 1. Event names

- Format: **`<feature>:<action>`** — `feature` = the element tag minus the `ui-` prefix, verbatim (`tabs`, `menu`, `modal`, `toggle-group`, `ai-chat`, `json-row`). `action` = present tense, from the vocabulary below; multiword segments use kebab (`ai-chat:turn-complete`).
- Action vocabulary: `select` · `change` (committed) · `input` (live) · `open` / `close` · `toggle` · `dismiss` · `add` / `remove` · `submit` · `complete` · `action` (generic row action) · `click` (plain press primitives) · `status` / `error`.
- Never past tense (`change`, not `changed`). Never bare native names (`input` → `input:input`; `change` on select → `select:change`).
- A component's internal handler for a native event MUST `stopPropagation()` the native composed event before emitting the namespaced one (kills double delivery; `stopPropagation`, not `stopImmediatePropagation`, so same-element `$value` two-way still runs).
- Preventable intents: same naming, emitted `this.emit(name, data, { cancelable: true })`; the emitter checks the `dispatchEvent` return value (`modal:cancel` is the exemplar). Never a hand-rolled `new CustomEvent`.
- All dispatch goes through `this.emit` — payload lands at `event.detail.data`, emitter at `event.detail.source`, bubbles + composed by default.

## 2. Event payload (`detail.data`)

- `source` is automatic framework wrapping — NEVER put `source`, the raw DOM event, or whole `this.state` inside `data`.
- Standard keys: `value` (new committed/live value) · `item` (the RAW item object — always under the `item` key, never as the data root) · `id` · `index` · `open` / `checked` (new boolean state) · domain extras after.
- Item-selection events carry `{ id, item, index }`. Value events carry `{ value }`. Toggle events carry the new boolean under its state-key name (`{ open }`).

## 3. Listening

- Explicit form: `@feature:action=${this.handleThing}`. Bare `@${fn}` only when `fn.name` equals the event name exactly.
- Rows: ONE container-scoped listener per row event (`<div @icon-button:click=${this.handleSelect}>`). Never per-item listeners; never the `delegate` document bus for per-instance selection (delegate = genuinely global signals only).
- Intent flows UP as an event; state flows DOWN as a prop. Never wire reflected/down state back into an up-command.

## 4. State — collections

- **The primary renderable collection is `items` — always an Array of plain objects**, bound raw via `${list('items', Child, keyFn?)}`. No derived/enriched arrays; child rows own their defaults via their `static state`.
- Scalar series (numbers/strings with no per-item identity): `values`.
- Secondary collections keep domain plurals (`columns`, `presets`, `marks`).
- Raw non-array input: `data` — a `get/set` alias inside `static state` that ingests into the derived reactive `items` (json-inspector precedent).

## 5. Item object shape

```js
{ id, value, label, icon?, description?, href?, disabled?, tone?, active?, ...domainExtras }
```

- `label` is THE display key — never `text` / `title` / `name` for item display.
- `id` = stable identity when items are keyed/selectable; `value` = form value when the item is an option; both may coexist.
- `active` = boolean row highlight, written by the parent at event-time (`syncActiveFlags` pattern), never in a per-render loop.
- keyFn default: `item.key ?? item.id ?? index` — design items to carry `id` and omit the keyFn.
- Row event-name override state key: `emitName` (holds an event NAME string a parent may configure, e.g. dock items emitting `dock:select` through `icon-button` rows).

## 6. State — selection & value

- `value` = the committed value (string/number; ISO date string for calendar). `values` = Array when the component is inherently multiple (toggle-group multi, tag-input). `checked` = switch/checkbox native parity only.
- **`activeIndex` = THE current-item pointer, one name for every component** (holds the item's string `id` in id-keyed components — tabs, dock — and the int position in position-keyed ones — stepper, carousel). **`active` = boolean ONLY, on row/child components.** `selected` = boolean membership on rows in multi-select contexts.
- Array-valued inputs are UNCONTROLLED: seed once from state, own internally, report via events — no parent writeback loops.

## 7. State — booleans

- Bare adjective/participle: `open` (overlays/disclosure) · `expanded` (inline expand; mandatory where native `<details>.open` would shadow) · `disabled` / `readonly` / `required` · `loading` (data in flight) · `streaming` (AI token flow).
- No `is*` / `has*` prefixes. `show*` only for optional-chrome render toggles (`showClose`, `showLegend`).

## 8. Forbidden state keys

No top-level `static state` key that exists on the EventTarget/Node/Element/HTMLElement prototypes — a consumer's bare `.key=` binding would silently set the DOM property instead of state.

| offender | use instead |
|---|---|
| `title` | `heading` (or `tooltip` for hover text) |
| `id` | `itemId` / `activeIndex` / `panelId` |
| `role` | `author` / `kind` |
| `hidden` | `muted` |
| `animate` | `animated` |
| `spellcheck` | host attribute via `static attrs` only |

Check when adding keys: intersect new keys × `Object.getOwnPropertyNames` of the four prototypes.

## 9. Channels & accessors (doctrine, restated)

- State is reached ONLY via `.state=${obj}` (merge) / `.state.key=${v}` (deep write) / `.method(${v})` (command). Bare `.foo=` sets a plain DOM property.
- Normalizing `get/set` pairs live INSIDE `static state` only. Construction is `Klass.create(state?, config?)`; behavior knobs are `config` keys.
- global/ components stay blank-slate primitives: state keys declared but empty; callers supply content.

---

## Rename ledger (migration of 2026-07-04)

### Events

| old | new |
|---|---|
| `buttonClick` (button) | `button:click` |
| `buttonClick` (icon-button default) | `icon-button:click` |
| `close-click` | `close-button:click` |
| `color-change` | `color-picker:change` |
| `date-change` / `range-change` | `calendar:change` / `calendar:range-change` |
| `carousel-change` | `carousel:change` |
| `tab-select` / `tab-change` | `tabs:select` / `tabs:change` |
| `toggle:change` / `toggle-select` | `toggle-group:change` / `toggle-group:select` |
| `sd-action` + `speed-dial:action` | `speed-dial:action` (single event) |
| `legend-select` | `legend:select` |
| `radio:change` | `radio-group:change` |
| `stepper:change` (number-stepper) | `number-stepper:change` |
| `step:change` (stepper) | `stepper:change` |
| `pin:input` / `pin:complete` | `pin-input:input` / `pin-input:complete` |
| `tag:add` / `tag:remove` / `tags:change` | `tag-input:add` / `tag-input:remove` / `tag-input:change` |
| `jsonrow:toggle` | `json-row:toggle` |
| `image:select` | `image-list:select` |
| `inquire:answer` | `ai-inquire:answer` |
| `approval:decision` | `ai-approval:decision` |
| `reasoning:toggle` | `ai-reasoning:toggle` |
| `heatmap:cell` | `heatmap:select` |
| `ui-context-menu:open` | `context-menu:open` |
| `modal-open/close/maximize/minimize/cancel` | `modal:open/close/maximize/minimize/cancel` |
| `notification-dismiss` | `notification:dismiss` |
| `poll-option-select` / `poll-vote` | `poll:select` / `poll:vote` |
| `vote-toggle` | `vote-tally:toggle` |
| `page:change` | `pagination:change` |
| `pulldown:state` | `pulldown:toggle` |
| `action` (empty-state) | `empty-state:action` |
| `input`/`change`/`focus`/`blur` (ui-input) | `input:input` / `input:change` / `input:focus` / `input:blur` |
| `change` (ui-select) | `select:change` |
| `youtube-play` | `youtube-video-player:play` |

Unchanged (already conforming): `menu:select`, `chip:click`, `chip:remove`, `fab:click`, `alert:dismiss`, `accordion:toggle`, `accordion:group-open`, `switch:change`, `slider:input`, `slider:change`, `ai-chat:*`, `dock:select`, `legend:change`.

### State keys

| component.key (old) | new |
|---|---|
| select.options / poll options / ai-inquire.options | `items` |
| tabs.tabs / calendar.events / ai-chat.messages / ai-plan.steps / ai-sources.sources / stepper.steps / legend.series / detail-list.pairs / tracker.segments / status-bar.cells / app-bar.actions / toolbar.actions / speed-dial.actions / ui-stat-table.rows / json-inspector.rows / carousel.slides | `items` |
| kbd.keys | `values` (scalar string tokens) |
| menubar.menus | UNCHANGED — composite: `items` is owned by the inherited UIMenu open-panel contract; `menus` is the structural menu list |
| svg-bands.segments | UNCHANGED — numeric scalar config (band count), not a collection |
| metric.trend / tag-input.tags | `values` |
| tabs.active / stepper.active / tabs.activeId / dock.activeId | `activeIndex` (single current-item pointer name — value is a string id or an int position per component) |
| paged-list.emptyText / paged-list.loadingText | `emptyMessage` / `loadingMessage` (matches stat-table/vote-tally/notification `message` vocabulary) |
| field.help | `hint` (matches empty-state/stat-table/metric) |
| boot-screen.subtitle / extraSubtitle | `subheading` / `extraSubheading` (matches card, pairs with `heading`) |
| ai-chat.errorText | `error` (matches field.error) |
| calendar.selected | `value` |
| top-level `title` (modal, panel, notification-item, stat-table, ai-chat, …) | `heading` |
| panel.id | `panelId` |
| legend-item.hidden | `muted` |
| icon.animate | `animated` |
| icon-button.onClick | `emitName` |
