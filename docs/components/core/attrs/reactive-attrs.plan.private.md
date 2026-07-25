# Reactive Attribute Channel — Plan

Make `this.attrs.*` a first-class **reactive, typed host-attribute channel**, parallel to
the `state` channel and the `.prop=` property channel. Components read/write host
attributes reactively and pass them through to a specific sub-element's attribute.

## STATUS — core SHIPPED + verified
- [x] 1 `state/binding.js` — `trackAttrRead` / `notifyAttrChange` (+ `attr:` namespace)
- [x] 2 `attrs/attrs.js` — proxy `get()` records the dep + file doc header (type contract + channel matrix)
- [x] 3 `base.js` — `attributeChangedCallback` (the missing native hook)
- [x] 4 `input.js` — `spellcheck: 'true'` string fix + `spellcheck=${this.attrs.spellcheck}`
- [x] 5 VERIFIED — `attrs/attrs.test.js` 4/4 (external setAttribute→patch, boolean presence, imperative
      write auto-remove, precision no-repaint) + 120 core state/template/lifecycle tests green; 4 files
      `node --check` clean
- [ ] 6 MIGRATE `global-top-bar`/`app-bar` pass-through → `this.attrs.spellcheck` — DEFERRED (separate
      commit; working code, user likes it — offer, don't impose)
- [x] 7 DOCS — attrs.js header + engram memory `reactive-host-attribute-channel-this-attrs-shipped`
- [x] 8 TESTS — attrs.test.js (5) + input.test.js (3, real `ui-input` incl. parse-time markup); FULL core
      suite 140/140 green; js-style loaded + violations fixed; eslint clean (the 2 remaining errors —
      binding.js `TrackingProxyHandler` fwd-ref, input.js `type:` key — pre-exist on HEAD, proven via stash)
- NOTE sidebar `inert:true` boolean default is a misleading dead type-tag (boolean reads are presence-only);
  harmless, left as-is — flag if touched.

## Verified ground truth (why this is small)

- `static attrs` → `ensureMergedAttrs` (chain-merged, cached) → `static get observedAttributes`
  already emits every attrs key. `this.attrs = makeAttrsProxy(host, mergedAttrs)` (base.js:264).
- Dep collection is **runtime read-triggered**: `render.js:206` sets
  `setCurrentTracking(renderDeps)` around the whole synchronous `render()` body; every reactive
  proxy read lands in `renderDeps` (`Map<realm, Set<path>>`), then `subscribeRenderDeps` wires it.
  `this.state.x` reactivity works *only* because its proxy records into `currentTracking`.
- Deps are **multi-realm** already (`localRealm` / `globalRealm` / `storeRealm`), each shaped
  `{ bus, read(path), write(path,value), global }`. An `attrsRealm` slots in with zero new plumbing.
- The reactive **attribute** spot already exists: plain `attr=${expr}` → `SPOT_TYPE.ATTR`,
  `?attr=${expr}` → `BOOL_ATTR`; both re-evaluate on a renderDep notify (patch pass).
- Two-way already exists: `$attr=` / `@bind` → `SPOT_TYPE.BIND` (what `$value="value"` uses).

**GAPS (all that's actually missing):**
1. `this.attrs` reads are NOT recorded as deps → `attr=${this.attrs.x}` never re-patches.
2. No `attributeChangedCallback` anywhere in the repo → external `setAttribute` is ignored.
3. `input.js` **misdeclares** `spellcheck` as boolean (`true`); it's an enumerated/valued attr → string.

## Type contract (RATIFY — matches existing `readHostAttr`/`writeHostAttr`, no code change)

The default value's TYPE declares the attribute's nature. **No boolean→string coercion** — a wrong
type is a misdeclaration, fixed at the declaration, not papered over in the proxy.

| default type | write(v)                                   | read                    | use for |
|--------------|--------------------------------------------|-------------------------|---------|
| **boolean**  | `true`→ set empty attr · `false`/`null`→ **remove** | `hasAttribute` → bool   | presence toggles: `disabled`, `hidden`, `inert` |
| **string**   | `String(v)`                                | raw `?? default`        | enumerated/valued: `spellcheck`, `role`, `aria-*` |
| **number**   | `String(v)`                                | `Number(raw) ?? default`| numeric: `tabindex`, `maxlength` |

Boolean = the disabled ergonomic: `this.attrs.disabled = false` auto-removes the attribute, no
manual `removeAttribute`. `spellcheck` needs the string channel (`'true'`) — it carries a value.

## Channel matrix (for docs — resolves the `.prop` vs attribute confusion)

- `.prop=${v}` → **PROP** → `element[prop] = v`. A JS property. For `spellcheck` it *happens* to
  round-trip because the native `HTMLElement.prototype.spellcheck` reflects to the attribute — a
  coincidence of reflected native props, not a general attribute channel. Use for real properties.
- `attr=${v}` → **ATTR** → `setAttribute`. The attribute channel on whatever element it's written on.
- `this.attrs.x` → the **formalized, typed, reactive** host-attribute accessor (this plan). Works for
  ANY attribute, reflected-native or not.

## Design — reuse ComponentStateBus + `attr:` namespace (NOT a new bus/realm)

> **Corrected after advisor review.** The first draft added a dedicated attrs bus. That BLOCKS:
> what schedules a patch pass is `ComponentStateBus.onFlush() → component.updateView()`
> (state.js:42-62). The base `PathSubscriptions.onFlush()` is a no-op (pathSubscriptions.js:331) —
> a dedicated attrs bus would flip the dirty flag and repaint NOTHING ("compiles, no pixels").
> Reuse the component's own bus; namespace the paths so they can't collide with state keys.

The reactive path already exists for state; attrs piggybacks on it via three tiny hooks:

1. **`state/binding.js`** (edit) — add the two namespace helpers next to `addDep`/`currentTracking`:
   ```js
   const ATTR_DEP_PREFIX = 'attr:';                       // one home for the namespace
   export function trackAttrRead(component, key) {         // called from the attrs proxy get()
     if (currentTracking) addDep(currentTracking, localRealm(component), ATTR_DEP_PREFIX + key);
   }
   export function notifyAttrChange(component, key) {      // called from attributeChangedCallback
     ensureStateBus(component).notify(ATTR_DEP_PREFIX + key);
   }
   ```
   `localRealm.bus` IS the `ComponentStateBus` → `onFlush→updateView` + microtask batching, free.
   The `attr:` prefix keeps attr buckets distinct from state buckets on the shared bus (belt), and
   the dep map is realm-keyed anyway (suspenders) — no keyspace collision either way.
2. **`attrs/attrs.js`** (edit) — `makeAttrsProxy` `get()`: after the `key in schema` guard, call
   `trackAttrRead(host, key)` before `readHostAttr`. Gated on `currentTracking`, so reads outside
   render (event handlers) are pure DOM reads, zero overhead. `set()` does NOT notify.
3. **`base.js`** (edit) — the missing native hook:
   ```js
   attributeChangedCallback(name, oldValue, newValue) {
     if (oldValue === newValue || !this.isConnected) return;  // parse-time attrs read live at 1st render
     notifyAttrChange(this, name);                            // batched → onFlush → patch pass
   }
   ```
   `observedAttributes` already emits every attrs key, so this fires for the whole channel.

**No new spot type, no parser change, no new realm/bus module.** `attr=${this.attrs.x}` /
`?attr=${this.attrs.x}` (existing ATTR/BOOL_ATTR spots) go reactive the instant the proxy records a dep.

### Reactivity flow (precise + loop-free)
```
render() reads this.attrs.x ──trackAttrRead──▶ ComponentStateBus subscribes "attr:x" → markRenderDirty
external setAttribute("x") ─┐
this.attrs.x = v ─▶ writeHostAttr ─┴▶ attributeChangedCallback (old≠new) ─▶ notify("attr:x")
     ─▶ (batched microtask flush) ─▶ markRenderDirty ─▶ onFlush→updateView ─▶ patch pass
     ─▶ render() re-reads this.attrs.x (live DOM) ─▶ patches the SUB-element's attribute
```
- **Precise:** an attr declared but never *read* in render() has no subscriber → its notify hits no
  bucket → `onFlush`'s `templateBuilt===true && !onStateChange` guard early-returns → NO repaint.
- **Loop-free:** spots patch sub-elements, never re-write the host's own attribute.
- **Single notify point:** the callback covers imperative *and* external writes; `old===new` kills echo.

## Two-way binding? Recommendation: NO — one-way reactive + imperative write

- Mutation API = imperative `this.attrs.x = v` (already exists; now reactive). ← the encouraged path.
- Reactive read = `attr=${this.attrs.x}`.
- `$attr=` two-way (BIND) already exists for DOM↔state; do **not** extend it to the attrs channel
  now — it buys a bidirectional sync + echo-guard we have no case for. `spellcheck`, `disabled`, and
  the pass-through cases are all one-way (consumer sets → component reacts; component never writes
  its own host attr back). Matches your instinct to "encourage the `.attr` property to change values."

## Change set (land in this order — correctness fix first, working code untouched last)

1. EDIT `state/binding.js` — add `ATTR_DEP_PREFIX`, `trackAttrRead(component, key)`,
   `notifyAttrChange(component, key)` (import `ensureStateBus` from `state.js`; `localRealm` already imported).
2. EDIT `attrs/attrs.js` — `makeAttrsProxy` `get()` calls `trackAttrRead(host, key)` after the schema guard.
3. EDIT `base.js` — add `attributeChangedCallback` (import `notifyAttrChange`). `observedAttributes` unchanged.
4. FIX `input.js` (independent bug — shippable alone) — `static attrs = { spellcheck: 'true' }`; render
   `spellcheck=${this.attrs.spellcheck}`. Doubles as the live-repaint test case.
5. **VERIFY one live repaint** (devtools: toggle `<ui-input>` `spellcheck` attr → inner input flips)
   BEFORE step 6.
6. MIGRATE `global-top-bar` / `app-bar` pass-through from `.spellcheck=`/`this.spellcheck` to the
   `this.attrs.spellcheck` channel — SEPARATE commit; don't rip out working code in the same pass.
7. DOCS — type contract + channel matrix into `attrs.js` header; engram memory of the ratified design.
8. TESTS — run `pathSubscriptions.test.js` + `scheduler.test.js` before/after (we extend that exact
   path). Add: external `setAttribute` → sub-element patches; boolean presence add/remove; string
   enumerated value; number coercion; echo-free imperative write; read-outside-render untracked;
   declared-but-unread attr change → no repaint (precision guard).

NOTE: the `attrsRealm.js` module + dedicated bus from the first draft are DROPPED — the corrected
design reuses `ComponentStateBus`. No new files.

## Verify (live, not just units)
Devtools: toggle the host attribute → sub-element updates. `this.attrs.disabled = false` removes the
attr + patches. `<ui-input spellcheck="false">` → inner input spellcheck OFF (the original bug).

## Risks / edge cases
- `attributeChangedCallback` fires during element upgrade **before** the constructor finishes →
  `this.attrsRealm?.` guard makes early callbacks no-ops (initial values are read live at first render).
- Attr-bus vs state-bus keyspace collision → dedicated attr bus (design point 1) avoids it.
- Async `render()` — reads after the first `await` are untracked by design (render.js:203); attrs
  inherits this constraint, same as state. Fine.
