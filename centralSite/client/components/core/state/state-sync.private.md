# `.state=` two-way sync + smart-clone + function-state — plan & progress

## Goal (user)
`global-dock` passes `.state=${this.state.dock}` to `<ui-dock>`. Writing
`app.refs.globalDock.refs.dock.state.activeId = X` (child) must also update
`app.refs.globalDock.state.dock.activeId` (parent) — and vice-versa. All props of
the shared object stay in sync. Different instances of a component must NOT share
static-state objects. Support function-valued state.

## Diagnosis (verified by trace + tests)
- `.state=${this.state.dock}` → `child.assignState(dockProxy)` (template.js:1467) which
  DESTRUCTURES the dock proxy's top-level keys onto `child.STATE`:
  - nested objects/arrays (`items`) → copied BY REFERENCE → bidirectional via the
    "double-proxy" (state-channel.test.js:234 proves it). ✅ already works.
  - top-level PRIMITIVES (`activeId`) → copied BY VALUE → child has a SEPARATE copy.
    Carrier-link only flows parent→child. Child write never reaches parent. ❌ THE BUG.
- `ui-dock.handleItemSelect` does `this.state.activeId = id` (dock.js:42) — exactly the
  child-origin top-level primitive write that doesn't propagate up.
- smart-clone per instance ALREADY shipped (base.js:198). Docstring utilities.js:360 is
  STALE (says static state is never cloned; `cloneStaticState` flag is dead — grep: 0 uses).
- function-valued state NOT implemented.

## Approach — REVERSE CARRIER (forwarder), contained
Primitives can't share by reference → forward child writes back to the source.
1. `linkStateCarrier` (state.js): also store `sourceComponent` on `child.stateCarrier`.
2. `StateProxyHandler.set` (state.js): after notify, if `this.path === ''` and the
   component has a `stateCarrier` whose source object owns `key`, forward the write to
   `sourceComponent.stateProxy` at `sourcePath.key`. Guards:
   - only top-level writes (`path===''`) — nested already share via double-proxy.
   - only keys the source owns (`hasOwn(rawSource,key)`) — protects child-private keys
     (e.g. combo test `.state.test=` where `test` ∉ source).
   - skip if `rawSource[key] === value` — no-op / breaks echo loop.
   - assignState writes raw STATE (NOT through proxy) so the initial merge never reverse-fires.
   - Loop analysis: child write → source write → source notify → fwd carrier notifies child
     (notify only, no write) → converges. Source re-render re-merges equal value (no-op).
3. Root-carrier (`.state=${this.state}`, path '') stays guarded/skipped (test:365). Targeted
   pattern is a NAMED subtree (`.state=${this.state.dock}`), which is the global-dock case.

## Secondary asks
- (M) merge-opt: constructor clones ALL static defaults then overwrites provided keys — clone
  only keys MISSING from provided state (memory win). base.js:176-212.
- (F) function-state: `static state = () => ({...})` and provided `state` fn → call, use return.

## Status
- [x] Core reverse-carrier (state.js) — `forwardSharedWriteToSource` + `set` trap gate + `sourceComponent` on carrier
- [x] Refactor: extracted `applyTopLevelAccessor` → `set()` cognitive-complexity 17→under 15 (cleared PRE-EXISTING debt too)
- [x] Test: 3 new (child→parent primitive mirror, parent→child no-regress, no-leak) — all green
- [x] state-channel.test.js 17/17; realm.test.js only C/F fail (PRE-EXISTING bind() tests, unrelated); eslint clean
- [x] (M) merge-opt: clone only keys MISSING from provided ctor state — extracted to
      `foldStaticStateTemplate` / `materializeInstanceState` (base.js); dropped constructor
      cognitive-complexity below baseline (warning cleared)
- [x] (F) function-state: `static state = fn` (merge-time once, `resolveStateSource` in
      staticConfig.js) + ctor `state` fn (per-construction, base.js constructor)
- [x] Fix stale smartClone docstring (utilities.js)
- [x] New test file `state/static-state.test.js` — 5 tests (isolation, primitive-by-value,
      provided-by-ref + missing-cloned, static-fn, ctor-fn) all green
- [x] Importmap confirmed webcomponent→source (index.html) — fix is live, no rebuild
- [x] FINAL: full core suite 46 tests, 44 pass, 2 fail (realm C/F = PRE-EXISTING bind tests)

## Out of scope (pre-existing, NOT mine — flag to user)
- eslint ERROR base.js `accessor-pairs` on write-only `importStyles` accessor (surfaced by the
  user's uncommitted eslint.config.js change; intentional write-only setter, repo-wide pattern).
- pre-existing jsdoc warnings (tab-indented TODO in `static properties` doc; missing @returns
  across utilities.js/staticConfig.js).

## Mechanism summary (for recall)
- FORWARD carrier (was already shipped): source bus deep change → child bus (relative path).
- REVERSE carrier (NEW): child top-level proxy write → if key ∈ source object, mirror to
  source proxy at `sourcePath.key`. Origin distinguished by "did it go through the child
  PROXY" (set trap fires only on real writes; carrier notifies, never writes) → loop-free.
- Nested objects sync via the existing double-proxy; primitives needed the reverse carrier
  because JS can't share a primitive by reference.
