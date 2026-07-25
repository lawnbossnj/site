> **ARCHIVE (2026-07-13).** Open items migrated to the shared emP board — see **tk:26** (harness-gated perf remainder + collection.js deletion sweep) and **tk:25** (nested `static properties` schema). This file is retained as a DECISION-RATIONALE record: the round-by-round history documents *why* things were done or rejected (e.g. the replaceState-diff rejection, the trie seesaw, the dispatchSingle gating analysis) — do not treat its checkboxes as live tasks. New audit work goes on emP, not here.

# JS-Style + Performance Audit — components/core — v3 refresh 2026-06-30

Source of truth: **js-style skill**. Scope of THIS pass: **the WebComponent class + the modules folded onto its prototype** (base.js + the `assign` fold), focused on the **17 files changed since the v2 audit** plus a first-class **performance pass** over the class's hot paths.
Method (v3): per-changed-file delta auditor (re-anchor vs v2, by symbol) + per-hot-path perf auditor + adversarial verify (16 delta + 5 perf + verify; verify confirmed 37/39, rejecting 2 unsafe perf claims). Builds on v2 (2026-06-22, 120 findings) — does NOT re-litigate unchanged files.

> The **v3 sections immediately below** (Performance + Delta refresh) are the CURRENT authoritative state for the changed/in-scope files. The **v2 body further down** is retained for the out-of-scope files (ai/, net/, behaviors/, tooltips/, dialogs/, environment/, plugins/, and the unchanged prototype-method modules) — those entries are carried forward as-is. For any file listed in the v3 Delta refresh, trust the v3 current line numbers; the v2 lines below have drifted.

---

## ✅ Round 14 — behavior contract + device consolidation + CollectionEngine (2026-07-03/04, uncommitted)

Three shipped refactors (full record: repo-root `todo.private.md`) that RESOLVE or INVALIDATE tracker entries:

1. **Behavior contract: closure-free teardown.** ALL 7 behaviors rewritten as singleton CLASSES with prototype `uninstall(element)`; per-install state in WeakMaps; pipeline queues one `BehaviorTeardown` (registry.js) instead of storing a returned closure. **Round 10's carve-out "Behavior `return function uninstall()` per-install closures — established API shape" is OBSOLETE — the pattern is ELIMINATED, do not re-raise OR re-cite.** Round 10's autoResize `ResizeOnInput` per-element class also superseded (shared `currentTarget` handleEvent singleton + shared-rAF initial-resize queue). collection.js migrated off the returned-closure contract (`scrollReportBehavior` + `uninstall(scroller)`). New local suite `behaviors/behaviors.test.js` (5 tests incl. the install-returns-nothing contract ×7).
2. **Device detection consolidated into core.** `environment/device.js` REWRITTEN (sole owner of userAgent/platform/maxTouchPoints; module consts `isMobile/isApple/isTouch/…` + `environment.device` store scope; iPadOS correction), core-loaded via index.js. hotkeys.js dropped its platform ternary (**the "hotkeys.js:14 negated-condition" pre-existing eslint error is GONE** — every "pre-existing-error policy" list below citing it is stale; remaining policy items: ai/tools.js ×24 `type:` keys, visual.js `location`+ternary). viewport.js `maxTouchPoints` → `isTouch` import. behaviors/tooltip.js rewritten (class pair, gated dynamic import of the `<ui-tooltip>` element — app.js/preview.js side-effect imports removed). hotkeys.js also gained `createHotkeyEntry` (entry-only path; `registerHotkey` kept as public wrapper — no throwaway `{entry,unregister}` alloc on framework paths).
3. **NEW AUDIT-SCOPE FILE: `state/collectionEngine.js`** (headless engine driving host reactive state + IO sentinel; written to current rules — indexed loops, hoisted lengths, named module fns, one documented per-instance `keepItem` forwarder; local suite `state/collectionEngine.test.js` 11 tests). paged-list (out of core scope) migrated onto it. **`state/collection.js` (old controller) + `CollectionBinding` + the template.js install branches are SLATED FOR DELETION** once activity-log migrates (follow-up in root todo.private.md) — do not invest audit effort in collection.js; its Strict-CLEAN entry drops with it.

Gate: full core suite **123/123** (incl. the 2 new local suites), eslint 0 errors on all touched files, live-verified via playwright (/accounts/, /explorer/). v2-body checkboxes resolved by this round are ticked below with `[Round 14]`; boxes fixed by Rounds 10/11 but never ticked in the v2 body are ticked with their round tag (verified in current code this session).

---

## ✅ Round 15 — AI surface modernization + transports listener shape (2026-07-04, uncommitted)

**User-directed order: ai → descriptors → realm test → transports. ALL FOUR SHIPPED.** Gate: full suite **123/123** (14 files), ai/ eslint **39 errors → 0** (1 pre-existing `sanitize` complexity warning), node --check ×10.

1. **`registry.js`** — NEW `componentEntries()` (live `[id, component]` iterator → closure-free `for…of` + early-exit for every scanner; re-exported from ai/index.js). `notify(event→registryEvent)` shadow fixed (was a pre-existing eslint ERROR) + subscribers `for…of`. `eachComponent` kept (public API; zero internal consumers left).
2. **`host.js`** — ctor arrow → named `onRegistryEvent` + thin forward; `.catch` sniff → `isPromiseLike` + named async `settleTransportStart` (Round 11 settle pattern — also fixes the bare-thenable `.catch` TypeError class); broadcast/destroy `forEach` → delete-safe Set `for…of`.
3. **`visual.js`** — `eachComponent` → `for…of componentEntries()`; `location.href` → `globalThis.location.href`; nested ternary → if-branch (both pre-existing eslint errors gone).
4. **`descriptors.js`** — `kids.map` anon → module `describeChildNode`; queryByTag/queryByLabel → `for…of componentEntries()` + named `matchesLabelQuery` predicate.
5. **eslint POLICY (config, repo root)** — `no-restricted-syntax` narrowed for `components/core/ai/**`: `type` PROPERTY keys allowed (JSON-RPC/JSON-Schema wire format — renaming breaks MCP), `type` VARIABLE ban kept. Kills the ai/tools.js ×21 + webmcp/webrtc/registry/descriptors wire-key errors in one stroke. **The "pre-existing-error policy" item is CLOSED.**
6. **`realm.test.js`** — `el` → `element` ×35 (word-boundary sed; helpers already used `element`); realm 17/17.
7. **TRANSPORTS (un-parked by user):**
   - **websocket.js** — the transport IS the listener (`handleEvent` contract): 4 anon socket handlers → `addEventListener(type, this)` + named `handleSocketOpen/Message/Error/Close`; heartbeat setInterval → named `sendHeartbeat()` + thin forward. Zero closures per reconnect (was 4+).
   - **webrtc.js** — same pattern across all THREE targets (signal WS / pc / data channel): ~10 anon handlers → one `handleEvent` routing by `currentTarget` then type (`handleSignalEvent/handlePeerEvent/handleChannelEvent` + async `handleSignalMessage`/`handleChannelMessage`); `openSignaling` Promise-executor closures → `Promise.withResolvers()` + `signalReady` field (open resolves, pending-phase error rejects — post-settle no-ops preserved).
   - **webmcp.js** — `findById` DELETED (was an O(N) eachComponent scan — registry's `getComponentById` is the same Map lookup); subscribe arrow → named `onRegistryEvent`; publishAll/publishComponent/unpublishComponent/stop/getMcpToolDescriptors → `for…of` (Map delete-during-iteration documented); shared `noopUnregister`; `:45` `location` ×2 + negated-condition → `globalThis.location?.hostname ?? 'site'`. Executor arrow kept (MCP-forced callback shape, documented).
   - **local.js** — notify `forEach` → Set `for…of`. The `viatAI` api façade **kept as object-of-arrows by design** (documented in-code): public global console/agent API must survive destructuring — prototype methods would lose `this`; one object per start(). The `[~]` classes-factory entry is RIGHT-SIZED CLOSED.

---

## 🎯 OPEN — consolidated remainder (2026-07-04; supersedes the per-round STILL-OPEN lists)

### ⚡ Round 16 — Vue3-parity performance review DONE → [render-performance.private.md](render-performance.private.md) (2026-07-04)
Full rendering/templates/events architecture review. **Verdict: already post-Vue-shaped — no re-architecture warranted** (cached recipes = compile-once, spots = patch flags without a vdom, LIS+moveBefore diff, shared-dispatcher events all at/above Vue 3 runtime). 7 ranked, proof-gated wins subsume + concretize the Phase-5 items below: **✅ #1 onFlush no-op gate (state.js:42) SHIPPED 2026-07-04 → #2 replaceState shallow diff (THE state.js:527 TODO) → #3 patch-pass dep-resync skip (render.js:109)** — commit-sized, suite-gated, no harness needed → **harness rebuild** → **#4 targeted dispatchSingle (pathSubscriptions.js:424) → #5 TreeWalker instantiate** → re-measure → decide **#6 list event delegation** → **compiler seam** (prepareRecipe output is JSON-serializable — the natural build-step target after).
- **✅ A.1 — onFlush no-op gate SHIPPED** (uncommitted): `ComponentStateBus.onFlush` skips the per-flush **promise allocation** (async `updateView`) on surgical spot batches (`templateBuilt===true && !onStateChange`) — provable no-op (render side already gated on `!templateBuilt`, no hook). New `state/onFlushGate.test.js` (2 tests) drives the skip branch (0 updateView calls, DOM still patches via drainSpots) + the templateBuilt-flip complement. Suite **125/125**, eslint clean, advisor-confirmed. onStateChange once-per-replace/coalescing/zero-subs contract intact.
- **❌ A.2 — replaceState shallow diff REJECTED** (investigated, advisor-confirmed): the state.js:527 TODO is a **loss** here — `assignState` already IS the per-key-diff path (and is what keyed-list reuse calls); `replaceState` is the deliberate wholesale swap. App usage is full-replacement-dominated (bench "replace", list-row whole-item), where `dispatchAll` (fire-once, no trie) is already optimal — a diff would route the all-changed case through the costlier `dispatchChanged` trie build, **slow the very "replace" benchmark vs Vue**, and risk dropping a reused-nested-ref-mutated-in-place update. Resolved in-code (TODO → rationale comment, can't be re-proposed from bare text) + doc #2. Revival only if a real "spread old, change one top-level key" caller appears (→ dispatchSingle, no trie).
- **✅ A.2b — PARSED_PATHS cap SHIPPED** (uncommitted): `parsePath` memo Map was unbounded — dynamic list-index paths (`items.4821.label`) leak one array per path ever seen. Cap 10k + wholesale clear on the crossing miss (safe: consumers never retain the array by identity; check rides only the miss branch). Test in `pathSubscriptions.test.js` (25k churn). Suite **126/126**, eslint clean.
- **✅ A.3 / #4a — dispatchSingle FLAT fast path SHIPPED** (uncommitted): gating analysis (advisor-directed, static not harness) found **97% of app reads are flat** (1603 vs 49 nested; heaviest buses carousel 19 / poll 17 / slider 16 / settings-modal 15 keys, all 0–1 nested). Strengthened the advisor's prefix-walk: `nestedPathCount === 0` ⇒ a single changed path overlaps **≤1 bucket** (exact key, or first-segment sole bare ancestor) ⇒ `dispatchSingle` = **one `Map.get`**, no O(S) scan, no `[...subs.entries()]` snapshot, order trivially preserved. Gated by O(1) `nestedPathCount` (maintained at bucketFor/dropBucket alongside indexDirty — can't drift); shares `dispatchBucket` with the scan path (same reentrancy/once-per-batch contract). A.1-caliber (per-flush alloc elim on the DOMINANT flush shape for ~all components), provable-by-construction. **Verified**: 400-trial dedicated flat differential + existing 200+150 randomized differentials (now vs the new dispatch) + focused units + nestedPathCount invariant churn + full render-pipeline (onFlushGate/onStateChange). Suite **132/132**, eslint clean.
- **#4b nested/trie slice DEFERRED** (harness-gated): `nestedPathCount > 0` still scans; the "descendants via trie when clean" idea tensions with Round-13's lazy-trie create-storm win (single-path-heavy nested buses never build it). Only 3% of reads nested → low-value until the harness proves a nested large-S hot bus exists.
- **Provable-without-measurement category exhausted (A.1 + A.2b + A.3/#4a).** Remaining: **#3** (patch-pass dep-resync skip — measurement bet, no assertable delta), **#4b** (nested dispatch), **#5** (TreeWalker instantiate) — all micro-wins.
- **✅ HARNESS VALIDATED + first live Vue baseline captured (2026-07-04)** → [render-performance.private.md § Harness](render-performance.private.md). Drove the existing `framework-shootout` live via Playwright vs the running `pnpm centralSite` server (5173/shootout.html); 2× count=1000 runs, 9 columns (7 UWC + Lit3 + Vue3). **North-star answered: UWC's fast list strategies (`list()`/store/arrow) MATCH Lit3 and BEAT Vue3 on create (3.8–5.1 vs Vue 4.4–5.8) + append (3.5–5.3 vs 6.3–7.9), no compile step; UWC surgical updates ~10× Vue (directional).** These runs also **live-verified #4a for correctness** (real update workloads through the flat dispatchSingle, no breakage). **⚠ Two hard limits found:** (1) run-to-run variance ~30% on this loaded machine → the rig resolves ~2× framework deltas but **CANNOT stopwatch a sub-ms by-construction win** (#4a/#4b/#5 are below the noise — judge by construction, or build an isolated no-CDN micro-bench on a quiet machine); (2) **Lit `repeat` OOM-crashes the tab at 10k rows** (user-confirmed: "Lit has major trouble with large lists") → keep Lit-inclusive runs ≤ ~2k; for large-N UWC-vs-Vue, drop the Lit adapter (`el.adapters = el.adapters.filter(a => a.label !== 'Lit 3')`) before benchAll.
- **Next harness task (optional):** committed Playwright driver script (navigate → set count → benchAll → poll !busy → extract `state.results` + `Perf.report()` categories → JSON) for repeatable runs; + the CDN-await isolation the advisor flagged (wrap each framework import so a CDN failure or a column crash can't brick the page / abort the run). Low urgency — the manual Playwright loop works and the micro-wins aren't measurable here anyway.

### The flush→render junction — Phase 5 (pre-review framing; measurement-gate details still apply)
The original `flush()` O(N²) is **CLOSED** (Round 9 trie bus + `notifyAll`, 11.9–44×; Round 13 lazy trie recovered the insert tax; all reactivity-architecture phases 1–4b shipped). What "the flush issue" now means is the junction where a flush becomes a render:
1. **state.js:527 TODO** — blind `notifyAll` vs a diff check on `replaceState`: `dispatchAll` fires EVERY bucket even when few values actually changed; diff cost vs redundant-spot-refire cost is a measurement question ("many updates are full replacements where every path changes"), not an intuition one.
2. **sharedBus render hop** — store/global renderDeps route `markRenderDirtyGlobal → drainGlobalRenders → updateView` (Round 12 #3: store strategy 2–3× local `list()` on small ops; local realm gets the direct `onFlush → updateView`).
3. **GATE before designing:** both are render-coupled → rebuild the Round-12 browser harness (CDP driver + two static servers + baseline worktree) and measure the replace-cost split (proxy/proxyCache rebuild vs `dispatchAll` vs render) — Round 13 established pure-node cannot attribute these. Contract guards already in place: reactivity-architecture invariants, the pathSubscriptions equivalence suite, `onStateChange.test.js` (once-per-replace + coalescing).

### Prerequisite cleanup (shrinks the junction's surface first)
- **Commit the Round 14 work** (uncommitted; interleaves with user-WIP files — user's staging call).
- **activity-log → CollectionEngine, THEN the deletion sweep**: `state/collection.js` + `CollectionBinding` + `collection()`/autoKey + both template.js install branches + base.js `remote`/`disposeCollections` + lifecycle.js:172 + index.js export (root `todo.private.md` follow-up ▢). Removes a whole binding class + 2 install branches from the exact surface Phase 5 touches.

### Parked / policy (not blocking)
- ~~ai/transports listener shape + forEach sites~~ **[Round 15 — SHIPPED]**; ~~ai/host.js ×3~~ **[Round 15]**; ~~eslint policy (tools.js `type:`, visual.js)~~ **[Round 15 — config override + fixes]**.
- delegate.js dispatch-snapshot semantics (Round 11 analysis on file) — test-first deliberate pass; same discipline as Phase 5, different subsystem (event dispatch, not state flush).
- Round 12 #4 — Lit shrink-op credibility artifact (bench page only, not UWC).

### Residual style work (grep-verified 2026-07-04, post-Round 15)
- environment/geo.js:42–49 — anon Promise executor + getCurrentPosition success/error arrows. **The LAST open style finding tree-wide.**

---

## ✅ v3 — Low-risk batch APPLIED (2026-06-30)

The user-approved **low-risk batch** is fixed across the 12 in-scope files; eslint `--fix` clean (the one new error introduced — a negated-condition from the `isObject` swap — was reverted by inverting the branch; the 3 remaining eslint errors are **pre-existing**, confirmed against HEAD: base.js write-only `importStyles` setter, hotkeys.js:14 ternary, template.js `LightTemplate.is` forward-ref). **Landed:**
- **All 5 perf wins** (ticked below) — atPhase→prototype, BYPASS_MODIFIERS→Set, StateProxyHandler.get early-return, template.js patch-pass `.slice()` drop, ListSpot prefix hoist.
- **~50 loop-counter renames** (`i`/`j` → descriptive) across utilities.js, attrs/staticConfig.js, debug/assertions.js, state/state.js, render/render.js, lifecycle/lifecycle.js, dom/dom.js, template.js (21).
- **Half-names** — state.js (`obj`→target, `proto`→currentPrototype, `cb`→callback, `sub`→subscription), logger.js (`coll`/`cond`/`val`→resolved*), parser.js (`m`→match).
- **Helper-bypass swaps** — `isObject` (base.js, utilities.js), `isPromiseLike` (render.js ×8, lifecycle.js ×3), `isString`/`isFunction` (logger.js ×6, template.js), `isSet`/`isMap` (template.js); removed the cached `const t` in applyClassListItems.
- **5 `type`→`spotType`** param shadows in template.js Spot ctors.

**DEFERRED (judgment-heavy refactors — still OPEN below):**
- the **`el`→`element` Spot-ctor param cluster** (file-wide across the 9 `Spot` ctors + a few helpers — a consistency refactor; the callback-local `el`s are already renamed, see Round 2).
- state/pathSubscriptions.js `flush()` **O(N²)** — real, no safe quick fix (see Performance § REJECTED).
- All **out-of-scope v2 findings** (ai/, net/, behaviors/, …) in the v2 body below.

## ✅ Round 2 — Anonymous-function refactors APPLIED (2026-06-30)

The FUNCTIONS-dimension anon-callback findings across the in-scope files are fixed; eslint clean (only the **pre-existing** `template.js` `LightTemplate` forward-ref error remains, confirmed in HEAD) and **zero test regressions** (parser 8/8, listFilter 4/4, static-state 5/5, state-channel 17/17; realm 9/11 = unchanged pre-existing "2007 bug"). **Landed:**
- **lifecycle.js** — `runLifecycleStep` → `async/await` + `try/catch`; disconnected-destroy path → named `runDisconnectedDestroy` (both anon `.catch` gone).
- **dom.js** — `getComponentsArray` forEach → `for…of` over Map values; `ifAssign` `eachObject` → indexed loop (dropped now-unused `eachObject` import).
- **utilities.js** — `callFn`/`eachArray`/`eachObject`/`eachNodeList` arrow-const → **function declarations**; `runHook`'s `.then(onF, onR)` → named async `awaitHookResult` helper (sync fast-path preserved).
- **logger.js** — 4 gated formatters → named `logHeader`/`logRule`/`logGroup`/`logTrace`; `makeLevelLogger` body → named `printLevelLine` + thin level-injecting forwarder. (Tiny pure forwarders `passthrough`/`ifAvailable`/`ifPerf` left as-is — not violations.)
- **template.js** — applyClassListItems Set/Map branches → `for…of`; `diffClassList` → `for…of`; `buildMarkerMap`/`extractDataBindPlans` (×3)/`extractSubeventPlans` (×2)/`extractRefPlans` → indexed loops (callback `el` → `element`); `buildSpotPlan` `.map` → named `mapSpotPart`; `prepareRecipe` `eachArray` → indexed loop (dropped now-unused `eachNodeList` import).

---

## ✅ Round 3 — for-loop `.length` hoist APPLIED (2026-06-30)

New js-style rule (`SKILL.md:77`): never recompute `arr.length` per iteration — hoist it. **84 loops cached across 11 files** (git diff: 84/84 lines): template.js 46, dom.js 6, state.js 6, utilities.js 10, staticConfig.js 5, render.js 3, base.js 2, lifecycle.js 2, hotkeys.js 2, parser.js 1, assertions.js 1. (Round 3 first used a two-var init clause; Round 5 moved it to a `const` before the loop — see below.)

**Mutation-safety verified per loop** — caching length is only behavior-preserving when the loop body does NOT `push`/`splice`/`pop`/`shift`/`unshift` the *condition* array. A Node transform (`scratchpad/cache-length.mjs`) auto-skipped every loop whose array name appeared with a mutation method anywhere in the file; each skip (template.js ×10 `items`/`spotPlans`/`path`/`spots`, utilities.js ×2 `parts`, staticConfig.js ×2 `chain`) was then **hand-read and confirmed safe** — every one iterates a param/snapshot and writes to a *different* array (e.g. `this.items.splice` lives in a sibling method; `parts.pop()` runs once *before* the loop; `spotPlans.push` is the recipe-builder, not the iterating loops) — then force-applied. The genuine in-place mutators (`patchList`'s `this.items.splice`, the keyed/list-diff cluster) already used a pre-cached `itemCount`, not `.length`, so they were untouched.

**Gate:** eslint clean (only the 3 **pre-existing** errors — base.js:692 accessor-pairs, hotkeys.js:14 negated-condition, template.js:296 LightTemplate — none from this round); **zero test regressions** (state-channel 17/17, parser 8/8, static-state 5/5, listFilter 4/4, realm 9/11 = unchanged pre-existing "2007 bug"). **Deferred (tree-wide remainder):** ~90 more `.length` loops in out-of-audit-scope files (`ai/`, `plugins/`, `environment/{breakpoints,media,viewport}`, `debug/perf`, `state/pathSubscriptions`, `styles/`, `dom/{delegate,portal,projection}`, `events/`, `state/{subscriptions,privateState,globalState,context,collection}`, `lifecycle/{scheduler,observer}`) — clean follow-up if the rule goes tree-wide.

> **Form correction (Round 5):** the length cache was later moved OUT of the loop init clause into a `const` declared on its own line *before* the `for` (per updated `SKILL.md` rule — a `const` can't be accidentally reassigned). See Round 5.

---

## ✅ Round 4 — `instanceof` → type-guard utilities APPLIED (2026-06-30)

New js-style rule (`SKILL.md`): type checks go through `static is()`/`Klass.is()` or a generic `utilities.js` `isX()` helper — **never raw inline `instanceof`**. The sole sanctioned `instanceof` is *inside* a guard definition (the one chokepoint). The codebase already had the custom-class guards (`ClassList.isClassList`, `ListBinding.isListBinding`, `CollectionBinding.isCollectionBinding`, `WebComponent.isWebComponent`, `ComponentBinding.is`, `LiveList.isLiveList`, `LightTemplate.is`, `isCustomElementConstructor`) — the violations were inline *callers* bypassing them + built-in `instanceof` with no helper yet.

- **utilities.js** — added 6 generic guards: `isNode`, `isHTMLElement`, `isCSSStyleSheet`, `isPromise` (exact `instanceof Promise`, distinct from duck-typed `isPromiseLike`), `isArrayBuffer`, `isUint8Array`. Swapped its own binary-encoder inline checks (`toBase64Url`).
- **template.js** — `instanceof Node` ×2 → `isNode`; `instanceof ArrayBuffer` → `isArrayBuffer`; `instanceof Promise` → `isPromise` (added 3 to import).
- **state/binding.js** — `instanceof ArrayBuffer` → `isArrayBuffer`.
- **render/factory.js** — `instanceof HTMLElement` → `isHTMLElement`.
- **styles/styleApi.js** (×4, incl. negated `!(… instanceof CSSStyleSheet)` → `!isCSSStyleSheet`), **styles/headStyles.js**, **debug/assertions.js** — `instanceof CSSStyleSheet` → `isCSSStyleSheet`.

Each helper is a pure `instanceof` wrapper (exact semantics — no cross-realm/behavior change). **Gate:** zero inline `instanceof` left in-scope (verified by grep — only guard definitions remain); eslint adds **no new errors** (the 2 shown — template.js LightTemplate, binding.js TrackingProxyHandler — are pre-existing `no-use-before-define`, confirmed via HEAD stash, merely line-shifted by the new imports); **zero test regressions** (state-channel 17/17, parser 8/8, static-state 5/5, listFilter 4/4, realm 9/11). **Deferred (out of audit scope):** `net/envelope.js` (Uint8Array), `ai/{tools,mixin,descriptors}.js` (Element/ShadowRoot/Date — `isDate` helper not yet created).

---

## ✅ Round 5 — length cache → `const` before the loop APPLIED (2026-06-30)

Updated `SKILL.md` rule: the cached length must be a **`const` on its own line before the `for`**, NOT a `let` in the init clause — a `const` can't be accidentally reassigned, catching bugs early. Reworked all 84 Round 3 loops from `for (let i = 0, nLength = arr.length; i < nLength; i++)` → `const nLength = arr.length;` + `for (let i = 0; i < nLength; i++)`.

**Same-scope collision handling:** two sibling loops over the same array in one block would emit duplicate `const nLength` → redeclaration `SyntaxError`. Used the JS engine as ground truth — `node --check` flags each real same-scope redeclare (and only those; repeats across *different* functions are legal and were left alone), always pointing at the redundant *second* declaration, which was dropped (safe: the arrays aren't mutated between the sibling loops, verified in Round 3). **3 dedups, all in template.js** `instantiateRecipe`/realm-install sibling loops (`spotPlansLength` ×2, `dataBindPlansLength` ×1). **Gate:** every file passes `node --check`; zero init-clause `Length` loops remain (grep); eslint **no new errors** (same 3 pre-existing); **zero test regressions** (state-channel 17/17, parser 8/8, static-state 5/5, listFilter 4/4, realm 9/11).

---

## ✅ Round 6 — global-shadow + typeof-finish + naming sweep APPLIED (2026-07-01)

Three isolated commits closing the remaining **mechanical** tier. **Re-anchored against ground truth first** — the `[ ]` tail below had drifted line numbers AND overstated open work (all template.js `typeof 'function'`/`'string'` sites and all render.js `isPromiseLike` bypasses were already fixed in the low-risk batch / Round 4; the 5 perf wins are confirmed applied in code). Verified per file: `node --check` + eslint (error count vs HEAD baseline, no new) + core tests (listFilter 4/4, static-state 5/5, parser 8/8, state-channel 17/17, realm 9/11 = unchanged 2007 bug).

- **`10fd0e19` global-shadow renames (8 sites / 5 files)** — `prompt`→`promptHandler` (ai/permissions.js), `top`→`topPosition` (dom/anchor.js, fixed the return-shorthand key), `event`→`registryEvent`/`iceEvent`/`messageEvent`/`errorEvent`/`dataChannelEvent` (ai/host.js, transports/webmcp.js, webrtc.js ×5, websocket.js ×2). Resolves the **naming — global shadow — HIGH** section below.
- **`68244448` typeof-finish (3 sites)** — `isFunction`(dom/delegate.js closest-guard, ai/tools.js aiMap), `isString`(ai/protocol.js error.message; kept `error.code === 'number'` — no `isNumber` util). Closes the type-check rule (instanceof done Round 4). The template.js remaining `typeof` are `object`/`number`/`boolean`/`bigint` with **no util to route to** — out of scope unless `isNumber`/`isBoolean`/`isObject`-swap are wanted.
- **`aec6fcf7` naming sweep (survivors, re-anchored by symbol)** — `t`→`valueType`(descriptors), `ch`→`char`+`n`→`suffix`(paths), `x`→`value`+`c`→`ctor`(binding.isBindingType), `el`→`element`(refs.registerRef, autoselect, perf ×2), `obs`→`sharedObserver`(reveal — plain `observer` would've *re-shadowed* the module singleton), `p`→`fraction`(perf.quantile), `w`/`h`→`shellWidth`/`shellHeight`(tooltip ×2). Already-resolved in prior batches: parser `m`, logger `coll`/`cond`/`val`, state.js half-names.

**RECLASSIFIED → judgment tier (NOT mechanical):** the template.js **`el`→`element` cluster** is not the small "DataBindSpot ctor + install locals" the tail describes — `el` is a **pervasive engine-wide convention** (`this.el` field on all 9 Spot classes + `el` param in ~40 functions/installers + `spot.el` accessors). A complete rename is behavior-preserving only if *nothing* is missed across 3377 lines of the hottest path; the incompleteness risk makes it a judgment call, not a low-risk sweep. **Deferred to the judgment checkpoint below.**

**Newly-found (logged, not fixed):** autoselect.js:4 `typeof element.select === 'function'` → `isFunction` (needs an import add; not in the original tail).

**Follow-on from a user code-question (makeGlobalProxy):**
- **`a67a0ad7` dead-arg removal** — `makeGlobalProxy(globalState.proxy, this)` → `makeGlobalProxy(globalState.proxy)` at base.js:578 + template.js:909. The fn signature is `(globalState)`; it hardcodes `null` for the TrackingFactory component (global state is shared, no per-component accessors/realm), so the 2nd arg was silently ignored.
- **`b4470db6` shared global render proxy (module memo)** — the global render proxy is **component-independent by construction** (`TrackingFactory(globalState, globalRealm, null)`; dep attribution rides the ambient `currentTracking` at trap time, never baked into the proxy). Memoized inside `makeGlobalProxy` keyed on source-proxy identity (same invalidation axis the per-instance guard tracked); dropped the 2 base.js instance fields (`globalRenderProxy`/`globalRenderProxyState`), the template.js `ensureRenderProxies` pre-warm, and the now-orphaned `makeGlobalProxy`+`globalState` imports from template.js; simplified `get global()`. Win = nested-proxy cache dedup (N components building the same `global.user` proxy → 1 shared) + N factories/WeakMaps→1 + 2N instance fields→0 + no per-mount/unmount proxy GC churn; **zero render-CPU change** (build is once-per-lifetime, off hot path). **Reviewed via multi-agent audit** (independence 0.97 / readers 0.96 / invalidation 0.95 / perf 0.82-WORTH-IT + 3 adversarial skeptics, no breaks). `renderProxy`/`renderProxyState` are the *component-dependent* state twins — kept. Memo comment corrected in `5387479d`.

**DEFERRED FEATURE (user decision 2026-07-01 — fold into the realm work, do NOT build early):**
- **Per-component arbitrary-store / swappable-realm support.** Today `globalRealm` is a `const` singleton and `makeGlobalProxy` is a single-slot memo. Making realms swappable / letting components bind arbitrary stores would re-key this memo *per realm*.
- **Depends on: `Store.replaceState()`/`reset()`.** A genuine "clear global state with a new object" is currently UNSUPPORTED — `store.proxy` wraps `store.STATE` at construction (globalState.js:116) and a Proxy target is immutable, so `globalState.STATE = {}` strands the proxy on the old state. A correct reset must REBUILD `store.proxy` (+ notify). The render memo is already ready for this (identity-keyed → auto-invalidates on the rebuilt proxy). Build `reset()` together with the realm feature so semantics are designed as one piece.

---

## ✅ Round 7 — realm flag-carry fix + AI lifecycle de-monkey-patch APPLIED (2026-07-01)

**realm C/F fix (committed by user) — realm.test.js now 11/11 (was 9/11 every prior round).** Closed the latent **"2007 bug"** (non-anchored sole-child reactive `${bind('x')}`) and global-keyed `${bind('global.gx')}`. Root causes: (C) `syncSpotSubscriptions` got `new Set([bindingKey])` where a `Map<realm,paths>` was expected → destructuring `'msg'`→realm `'m'`→undefined bus; (F) the flag-carry READ side was incomplete so a global bind resolved LOCAL→empty. Fix routes both through `bindingDepMap`/`realmForBinding`/`resolveBindingValueForBinding` (scope from the binding's `.global` flag + bare `.key`, never the key spelling). Two-way/data-bind paths EXCLUDED on purpose (tests D/E guard local-only).

**`ai/mixin.js` monkey-patch → native lifecycle (this session; the wrapBefore/wrapAfter ask).** Deleted `wrapAfter`/`wrapBefore` — the **only** `proto[hook]=function…apply` site in all of core (full sweep: zero others) — plus the dead `opts.autoRegister` branch (sole caller passes no opts). Auto-register now rides the native lifecycle: `this.aiRegister?.()` in `handleConnect` (after parent-attach); `this.aiUnregister?.()` as the **first line** of `handleDisconnect`, before `await this.pendingConnect`. Matches how every other subsystem hooks the cycle. **Timing — one honest change, not a pure preservation:** *disconnect* is exactly preserved (sync unregister inside the disconnect tick, before the connect cycle resolves → list churn never strands a detached component). *Connect* is now **deterministic**: `aiRegister` runs BEFORE `onConnect` on every path — the old `wrapAfter` fired it AFTER `onConnect` on the warm (cached-styles, i.e. list-item 2..N) path and BEFORE it on the cold path, so this removes that nondeterminism (a latent-bug fix). Registration/unregistration also now run inside `runLifecycleStep`'s try/catch → a throw routes to `onLifecycleError` instead of escaping the callback. **Composition preserved & tested:** a subclass with its own `onConnect` still auto-registers (`aiRegister` is a core-lifecycle call, unshadowable by a subclass hook) — new `ai/registration.test.js` 4/4 (connect-registers, sync-disconnect-unregisters, subclass-onConnect-still-registers, and registered-before-onConnect on both cold+warm paths; local-only per the repo `*.test.js` gitignore). Gate: node --check + eslint clean (both files); realm 11/11, listFilter 4/4, registration 4/4. **"Update all AI core components" reduced to 1 mixin edit + 2 lifecycle lines** — the mixin is applied once, globally, at `index.js:7`; no other monkey-patch sites to migrate.

**DONE since the v2 Verdict was written** (its short-list is now stale): global-shadows ✓ (Round 6 `10fd0e19`), render.js `isPromiseLike` ✓ (low-risk batch / Round 4), classes-factory ✓ (delegate + confirm; local.js low-value skip). The template.js `el`→`element` cluster is being hand-migrated by the user.

---

## ✅ Round 8 — easy-wins sweep: out-of-scope mechanical tier CLOSED (2026-07-01)

29-file parallel sweep (one agent per file, 29/29 `node --check`, zero mutation-safety skips) + central gate. **Three commits:**
- **`24ce9e0e` loop sweep (23 files)** — ALL remaining single-letter loop counters renamed + ALL remaining for-condition `.length` hoists across the out-of-audit-scope tree (ai/{paths,visual}, debug/perf, dom/{children,delegate,portal,projection}, environment/×4, events, lifecycle/{observer,scheduler}, plugins/registry, state/×6, styles/×2). Closes the v2 `naming-loop-counter` section AND Round 3's "~90 tree-wide `.length`" deferral. Every hoisted array verified a snapshot/spread or read-only param; `pathSubscriptions.flush()` logic untouched (renames only — snapshot length now computed once at snapshot time). media.js dedupes `Object.keys(queries)` to one module const (also removed its PRE-EXISTING `keys` shadow — file is now cleaner than HEAD).
- **`b7418399` guard swaps** — added `isDate` to utilities.js; ai/descriptors (Element ×2, Date), ai/mixin (ShadowRoot), ai/tools (Element), net/envelope (Uint8Array), behaviors/autoselect (typeof→isFunction, the Round 6 newly-found item). **Zero inline `instanceof` remains outside guard definitions** — Round 4's deferral closed.
- **`0c1328e5` tooltip-service comment repair** — merged the mangled 3-fragment block, deleted the dead `ensureTooltip().catch()` residue (v2 quality item; the OTHER quality item, render/factory.js:14 console.log, was resolved by the user's `element.debug` change).

Sweep-introduced eslint shadows (2) caught by the central HEAD-baseline diff and fixed by hand (media.js `keysLength`, pathSubscriptions `subscriptionArrayLength`). Gate: node --check ×29; eslint delta vs HEAD = pre-existing errors only (ai/tools.js's 24 `type:`-key `no-restricted-syntax` + descriptors 1 + visual 2 + subscriptions.js 2 `no-return-assign` — all predate the sweep); **all 6 local suites 49/49** (registration 4, listFilter 4, realm 11, static-state 5, parser 8, state-channel 17).

**THE MECHANICAL TIER IS NOW EMPTY.** What's left is judgment/refactor work — **NEXT (bigger wins, in order):**
1. **First-class-function refactor of the AI transports** — the ~14 anon `addEventListener` handlers (`webrtc.js` ~10, `websocket.js` ~4) → named methods / `handleEvent` objects, plus the 4 `functions-deferred-inline` cousins (websocket heartbeat setInterval, tooltip.js slide timeout, visual.js fade, delegate.js queueMicrotask) and autoResize.js:9. One coherent pass over listener shape.
2. **The soft anon-callback tier (~35 left)** — ai/{protocol,descriptors,paths,host,visual,webmcp}, hotkeys dispatch cluster, dom/inert, resolver.js, styles/styleApi ⚠ (re-confirm first), tooltip-service `.then`s. Judgment calls at conf 0.4–0.6 — batch by file, decide keep/extract per site.
3. **`pathSubscriptions.flush()` O(N²)** on full-state replace — needs per-flush dedup Set + first-overlap preservation (contract-sensitive; see Performance § REJECTED for the two dead-end fast paths).
4. **Pre-existing eslint errors** now on record: subscriptions.js ×2 `no-return-assign`, ai/visual.js nested ternary + `location`, ai/tools.js `type:`-key rule (either rename the protocol field or scope an eslint disable — decide policy).
5. **DEFERRED FEATURE** — per-component arbitrary-store / swappable-realm + `Store.reset()` (one piece; Round 6).

---

## ✅ Round 9 — reactivity-bus rearchitecture Phase 1–2 SHIPPED (2026-07-01)

**Full design + phases: [`reactivity-architecture.private.md`](reactivity-architecture.private.md).** The flush O(N²) (v2 Verdict item 4, Performance § REJECTED "no safe quick fix") is CLOSED — not by the rejected fast paths but by a trie-indexed bus that preserves the dispatch contract provably:
- **`state/pathSubscriptions.js`** — segment-trie subscription index (bijection with `subs` via the only-two bucket create/delete choke points), match-phase + order-preserving dispatch-phase flush, `dispatchSingle` fast path (C=1, the dominant shape), **`notifyAll()`** replacement primitive (O(S), one flag).
- **`state/state.js`** — `replaceState` rides `notifyAll()` (was: notify-every-subscribed-path, the O(S²) generator; its TODO half-resolved — blind-notify stays, but cost collapsed).
- **`state/pathSubscriptions.test.js`** (12/12, pure-node): full contract + trie-prune bijection + **200-trial seeded equivalence vs a verbatim old-algorithm reference** (fire-for-fire incl. order).
- **Bench** (µs/flush old→new): S=500 C=1 15→14 (1.1×); C=10 1.2×; S=2000 C=50 2.8×; S=500 C=500 3.3×; S=2000 C=2000 3543→298 (**11.9×**); replaceState S=500 318→28 (**11.4×**); S=2000 4972→113 (**44×**). Zero regression on the steady-state case (first cut was 0.9× there — fixed via dispatchSingle before shipping).
- **Deliberate semantic (documented + tested):** under `notifyAll` a multiPath subscriber fires ONCE at its own path (old replaceState idiom replayed it per subscribed descendant — redundant for a full-value replacement; keyed diff repatches all rows in the single pass).
- Gate: eslint 0 errors; all 7 suites green (registration 5, listFilter 4, realm 11, static-state 5, parser 8, state-channel 17, pathSubscriptions 12).

**Phase 3 SHIPPED (`96e94ee3`):** `Store.replaceState()` — identity-stable in-place reset (plainEqual guard + null-out dropped keys + direct assign + notifyAll; STATE/proxy identity preserved → render-proxy memo/`get global()`/captured `this.global` valid by construction; proxyCache kept). Carry-down proven immune (the `.state=` carrier forwards only strictly-deeper paths, so notifyAll at a carrier's own path is a no-op; global-dock flow verified — state-channel 17/17). Tests: globalState.test.js 7 (pure-node) + realm.test.js group J (component `this.global.<key>` re-render via drainGlobalRenders). Full suite 8 files / 70 green.

**Phase 4a SHIPPED (`a7de8903`, API revised `4e4bbf90`):** named per-component reactive stores under ONE namespace — `this.stores.shop.count` (user review: one reserved name instead of one per store → a store can never shadow a component method/field; the namespace itself is a Proxy over the merged `static stores` table → enumerable, read-only, future-extensible). `static stores = { name: store }` subclass-merges via `ensureMerged`; `get stores()` = lazy per-instance Proxy (`storesNamespace ??=`), `StoresNamespaceHandler` resolves reads with the `state`/`global` split (tracking proxy while rendering, raw `store.proxy` otherwise), set/delete throw; `storeRealm`/`makeStoreProxy` (twins of global, memoized on store.proxy identity → reset-safe); render.js `realm.global`→`realm.sharedBus` generalization (store buses share the global-render drain). NO hot-path `realmForBinding` change; old per-name accessors + built-in-name guard deleted. Tests: state/stores.test.js 8 (render/react/reset/isolation/method-coexists/namespace-enumerable-readonly/shared-dual/subclass-merge/disconnect-teardown). Full suite 9 files / 78 green; carry-down intact (state-channel 17/17); eslint delta 0.

**Phase 4b SHIPPED (`79f0ef7f` + tests `ba3beb42`) — USER-REDESIGNED as channel-enforced keys:** the bind/list key names its channel, mirroring the property chain (`bind('items')` bare = local shorthand; `state.a.b` explicit local; `global.x`; `stores.shop.items`; optional `this.` stripped; any other dotted first segment THROWS at authoring — enforcement was free, zero in-repo dotted-unprefixed keys). `parseBindingChannel` in the Binding ctor carries {global, storeName, bare key}; `realmForBinding` (single reader) resolves stores via `resolveStores` at spot install (undeclared → throws w/ key+tag). Fixed channel vocabulary means store names live under the reserved `stores.` prefix — the 4a namespace insight applied to the key string (D/E-safe). Two-way/data-bind stay local-only. Suite 9 files / 87 green; template.js now lint-cleaner than HEAD (user's function-hoist rode along, resolving the LightTemplate forward-ref error).

Then the judgment tiers from Round 8 (AI transport handlers, soft anon-callbacks).

---

## ✅ Round 10 — core FUNCTIONS tier CLOSED: first-class functions everywhere (2026-07-02, `1822ab6c`)

**User directive hardened into the ruleset: arrow-consts — named or not — are per-call allocations ("effectively anon functions… dynamically generated on the fly") and must be a class or a first-class function, whichever fits.** Core-scoped pass (transports EXCLUDED by user call); post-sweep grep: **zero arrow-const functions remain in core outside transports**. Per-site verdicts:
- **anchor.js** `fitsOn` → module fn taking geometry as args (zero alloc per computeAnchor). **visual.js** fade chain → module fns via `setTimeout(fn, ms, box)` extra-args (zero closures) + shared `noopDispose`. **autoResize** → `ResizeOnInput` handleEvent class. **observer.js/reveal.js** IO callbacks → named module dispatchers. **hotkeys** ×4 Set forEach → `for…of` (shiftIsMeaningful gains real early-exit; dispatch documents delete-during-iteration safety). **resolver.js** two-callback `.then` → named async `importTag`. **inert.js** → async/await + named predicate/mapper. **tooltip-service** ×2 `.then().catch(()=>{})` → named async `hideWhenReady`/`showWhenReady` + documented `swallowTooltipLoadFailure`. **tooltip.js** slide timer → `onSlideEnd(token)` method + thin forward. **styleApi** compile forEach → `for…of`, per-entry `.then` → named async `fillSheetSlot` (**concurrency preserved** — unawaited pushes + one Promise.all), memo `.then` → `compileAndCacheStyles`, styleSheet array-map → indexed loop. **manifest.js** → named async `resolveModuleSheet([key, file])`.
- **Error fixes:** subscriptions.js `??=`-in-return hoisted (2→0 errors); base.js `importStyles` accessor-pairs → scoped disable w/ contract rationale (1→0). eslint delta vs HEAD: improvements only.
- **RESOLVED-BY-CARVE-OUT (do not re-raise):** delegate.js queueDelegateError — the microtask arrow is the forced zero-arg closure inside an already-named fn (sanctioned "wrapped callback last resort"). ~~Behavior `return function uninstall()` per-install closures — established API shape.~~ **[Round 14: carve-out obsolete — the pattern was eliminated; behaviors are uninstall(element) singletons.]**
- **CLOSED by user:** template.js `el`→`element` cluster (0 bare `el` remain — verified).
- Gate: 14 files node --check; suite 9 files / **87 green**.

**STILL OPEN (out of core scope or policy):** (1) ai/transports listener shape (~11 handlers + heartbeat/reconnect timers) — parked by user; (2) ai/* forEach batch (protocol 6, webmcp 4, descriptors 2, paths 2, host 2, local 1); (3) pre-existing-error policy: ai/tools.js ×24 `type:`-key rule, visual.js `location`+ternary, ~~hotkeys.js:14 negated-condition~~ [gone — Round 14 deleted the line].

---

## ✅ Round 11 — perf-yield tier (2026-07-02, `ba8077da` + `41a005d0` + `de591f4e`)

**User directive: prioritize anything with a perf yield, however small.**

- **`ba8077da` REGRESSION FIX (found first, priority zero)** — Round 10's hotkeys `forEach→for…of` broke combo assembly: **`Map.forEach` passes the VALUE; `for…of` a Map yields `[key, value]` ENTRIES.** `comboFromEvent` pushed entry arrays into `parts` (combos became `"keyk,k"` — no registration ever matched) and `shiftIsMeaningful` always saw length-2 arrays. Fix: `heldKeys.values()`. Audited every other Round 10 `for…of`: the 2 Set buckets (values ✓) and styleApi's `[key, entry]` destructure (order ✓) are correct. **Locked with `hotkeys/hotkeys.test.js`** (6 dispatch-level tests; verified 5/6 FAIL against the broken state). Rule added to js-style skill. *Test files are local-only — `*.test.js` is gitignored repo-wide (zero tracked test files); the suite runs from disk.*
- **`41a005d0` ai/ forEach batch (the non-transport remainder)** — protocol.js `listTools` duplicated descriptors' tool-descriptor literal ×2 → shared **`describeTool(def, toolName)`** + exported `describeTools`; Map-entry loops replace `(def, toolName)` closures (**protocol 3→0 pre-existing errors** — the duplicated `type:` literals left with the dedup). paths.js: `buildOverviewNode` per-recursive-node closure → Set `for…of`; `pageOverview` indexes `getRoots()`. Closes the batch: webmcp 4 + local 1 live under **ai/transports/** (parked); host 2 = user WIP.
- **`de591f4e` core hot paths (fresh perf read: scheduler / events / eventEntry / delegate)** —
  - `scheduler.flush`: dropped `[...tasks.entries()]` (O(N) throwaway arrays EVERY flush — safe live-iterate: `batch` nulled before the loop, tasks scheduling work write to the NEXT batch) + lazy `pendingTasks` (all-sync flush now allocates zero).
  - `nextFrame`: **one shared promise per frame** via `Promise.withResolvers()` (was 1 promise + 1 queued resolver PER CALLER + queue array per frame); state resets before `resolve()` so awaiter re-calls book the next frame. Only consumers (base.js forward, render.js:418) `await` it — identity-safe.
  - events.js/eventEntry.js/delegate.js: 3 per-async-dispatch `.catch` arrows → named async settle fns (context as args, invoked unawaited). Also fixes a latent TypeError: `isPromiseLike` only checks `.then`, so `.catch` on a bare thenable could throw.
  - **New `lifecycle/scheduler.test.js`** (pure-node, rAF stub): target dedup, async settle, shared-promise identity, call-order resume — 5 tests.
- Gate: suite **98/98** (11 files); eslint deltas vs HEAD: improvements only (protocol 3→0, rest 0→0).

### Recorded, NOT applied — delegate dispatch snapshots (contract-sensitive; analysis on file)
`dispatchBus`/`dispatchEnv`/`ScopeRecord.handleEvent` pay `Array.from(bucket)` per DISPATCH (bus/env events include scroll/resize-frequency traffic). Live Set iteration would drop the alloc, **but neither shape matches DOM listener semantics on both axes**: DOM = mid-dispatch adds NOT invoked, mid-dispatch removes NOT invoked. Snapshot gets adds right, removes wrong (an entry unsubscribed by an earlier handler still fires — `invoke()` has no `subscribed` check); live gets removes right, adds wrong (a handler subscribing same-name sees the in-flight event). Fixing both needs live-iterate + `subscribed` guard in `invoke()` + an add-epoch to skip same-dispatch subscriptions. Do it as one deliberate change WITH a delegate test file first — not as a drive-by. (hotkeys `dispatch` already live-iterates; its registrations are user-input-frequency, so the mismatch there is theoretical.)

**STILL OPEN:** unchanged from Round 10 minus item 2 — (1) transports listener shape + its forEach sites (webmcp 4, local 1) — parked; (2) pre-existing-error policy (ai/tools.js ×24 `type:` keys, visual.js `location`+ternary, ~~hotkeys.js:14~~ [gone — Round 14]); (3) delegate dispatch-snapshot semantics above (needs its own test-first pass).

---

## 📊 Round 12 — bench pages updated + measured A/B: session core vs pre-session baseline (2026-07-02)

**Page updates:** shootout gains (a) **`UWC store list()` column** — `Store.create()` + `static stores` + `list('stores.bench.items')`, adapter writes via `store.set`/`store.replaceState`; (b) **`replace` op** — full-state replacement with EVERY value shifted (`replaceState` no-ops on plainEqual, so identical data would measure nothing); UWC columns use `replaceState({items})`, Lit/Vue fall back to fresh-array assignment (their replace idiom). Perf-page architecture map row updated (trie bus / notifyAll / named stores).

**Method:** raw-CDP driver (scratchpad `cdp-bench.js`, headless-shell + `--expose-gc`, gcHonest=true) against two identical static servers — HEAD working tree vs a worktree at `92a731a1` (pre-session baseline; bench pages byte-identical across the arc, so the A/B isolates the core). 1000 items, p50, **order-controlled 4-run design (b/c/c/b)** to kill thermal/order noise.

### Verdict — the trie seesaw, measured
- **REGRESSION (real, order-stable): create/append +10–13% on per-row-subscription columns.** Full-CE create 15.4–16.0 → 17.9–18.2; UWC-light 5.1–5.2 → 5.6–5.8; no-shadow same; Lit/Vue flat-to-better (rules out environment). `UWC list()` **dead flat (3.7 ×4)** — one host-level subscription, spot-internal row patching. Perf-page sync metrics show construct 8.6→8.1 and patch 16.4→14.3 (both BETTER) → the cost is NOT construction; it is **subscription churn: trie `indexPath` (per-segment node create/counters) on install + `unindexPath`/prune on teardown**, paid per row-spot where the flat Map paid a bucket add.
- **WINS held:** updateAll/swap/removeHalf/clear flat everywhere (dispatchSingle fast path holds steady-state); construct/patch improved; the **replace primitive now exists and is cheap in the right strategies** — replace@1000: list() 1.0ms · store 1.5 · light 2.5 · full-CE 5.2 (Lit 0.7 · Vue 2.5 by assignment).
- **New store strategy debut:** within 8–50% of local list() (create 4.2 vs 3.7 · updateAll 0.6 vs 0.2 · replace 1.5 vs 1.0) and beats Vue on most ops — the sharedBus indirection (queueGlobalRender→drainGlobalRenders) is the gap.

### Improvement targets (ranked by measured gap)
1. **Trie insert tax** — make path indexing lazy/cheaper for churn: e.g. queue subscribe-time indexing and drain at the first flush that needs a match (create-storm subs that die before any notify never pay), or fast-path single-segment paths bucket-only. Contract-sensitive: needs the node equivalence suite + the shootout A/B as gates. ~10–13% of each()/full-CE create is on the table.
2. **replaceState double coverage** — full-CE replace 5.2ms vs updateAll 1.4: `notifyAll` re-fires every spot AND `updateView` re-renders the template. The code's own TODO ("diff check") is now measured — skipping the redundant updateView when the bus covers all spots is the shape.
3. **Store-bus write path** — 2–3× local list() on small ops; the drainGlobalRenders hop.
4. **Lit column credibility artifact (pre-existing, BOTH runs):** Lit removeHalf=363ms / clear=4243ms @1000 (4.4ms @50 → ~quadratic). Poisons Lit's shrink cells only; investigate esm.sh dev-build repeat teardown / adapter await. Not a UWC issue.

Raw runs: scratchpad `baseline-1000{,-b}.json`, `current-1000{,-b}.json`, `perfpage-{current,baseline}.json` (session-scoped; key numbers above are the durable record).

---

## ✅ Round 13 — trie insert tax RECOVERED; #2 premise DISPROVEN (2026-07-03, `7b37ad52`)

**User directive: continue the Round 12 ranked perf targets.** Discriminator applied: only #1 was cleanly isolatable in pure-node (the bus is DOM-free); #2/#3 are render-pipeline-coupled.

### Target #1 — trie insert tax → lazy-rebuild overlap index — SHIPPED `7b37ad52`
The trie is only READ in `collectOverlaps` (multi-path flushes); `dispatchSingle` (dominant) and `notifyAll` never consult it — yet it was maintained EAGERLY (`indexRoot`+`nodesByPath` Maps per bus at construction + `indexPath`/`unindexPath` walk per bucket create/delete). A create-storm paid all of it per row and usually never did a multi-path flush → the +10-13% tax.
- **Fix:** subscribe/unsubscribe only flip `indexDirty` (O(1), no alloc); the trie rebuilds from live `subs` keys the first time a multi-path flush needs it AND the vocab changed, cached across flushes. Rebuilding from `subs` (source of truth) removes the trie/map-drift bug class → dropped `subtreeTerminals` retention/prune, `nodesByPath`, node `parent`/`segment` (~50 lines).
- **Pure-node A/B vs incremental HEAD** (order-controlled, gc-honest, `scratchpad/bus-bench.js`): create-storm 1-path **+13.3% faster** (recovers the exact regression), teardown **+48-65%**, nested-path create **+46%**; steady-state multi-path flush flat (−1.9%, ~9ns/flush dirty check); churn worst-case **+10.2%** (O(1) flags beat incremental index+unindex+prune). The Round-12 browser diagnosis proved the cost is subscribe-side/DOM-free → the browser harness was unnecessary.
- **Gate:** pathSubscriptions **16/16** (rewrote index-lifecycle → lazy invariant via `collectTerminals`; NEW multi-flush equivalence = 150 interleaved sub/unsub/flush trials vs a fresh pairwise oracle with bucket-order mirroring; + create-storm-never-builds / vocabulary-growth / stable-vocab-reuse; **mutation-verified** — removing the `bucketFor` dirty-flip fails exactly the 2 vocab-change tests). Full core suite **103/103**; eslint delta **0**.

### Target #2 — replaceState "double-coverage" → PREMISE DISPROVEN (do NOT fix reactively)
`replaceState` does `notifyAll()` (schedules the bus flush) THEN an immediate `return this.updateView()` (state.js:530). **The immediate updateView renders NOTHING in the common already-rendered path** — `notifyAll` only *schedules* the flush (`queueMicrotask`), so `templateBuilt` is still `true` when 530 runs → `renderPending = null` (updateView:698 gate). The real render happens later via the flush's `onFlush → updateView` (templateBuilt flipped false by the renderDep fire → patch pass). **The tracker's "skip the redundant render" framing is wrong — there is no redundant render to skip.**
- **True replace cost** (unverified split — needs the browser harness): proxy + proxyCache REBUILD (state.js:507-508 — correctness-required, `store.proxy` targets are immutable so a STATE swap MUST rebuild) + `dispatchAll` over every bucket (vs `dispatchSingle` for updateAll) + the double updateView *invocation* (nearly free: onStateChange + 3 boolean checks, no render).
- **530 is load-bearing 3 ways:** no-bus fallback (`stateBus?.` optional-chain), first-render (`templateBuilt=false` path), the awaitable contract (callers `await replaceState`). Rerouting it is a flush/render-contract restructure at the framework's most contract-sensitive junction (focus-loss / child-CE recreation / phase-ladder stranding per the replaceState comment) — the exact speculative trade refused on #1. **NOT pursued.**
- **Latent-bug FIXED (correctness — user-directed, `fc6c7289`):** `onStateChange` fired TWICE per `replaceState` (immediate 530 + deferred onFlush) — replaceState both notified AND called updateView directly, unlike assignState (notify-only). Fix: replaceState is now **notify-only when a bus exists** (`if (this.stateBus) { notifyAll(); return Promise.resolve(); }`), direct `updateView` only as the no-bus fallback. The flush's `onFlush → updateView` fires it exactly once — load-bearing invariant: `flush()` calls `onFlush()` UNCONDITIONALLY (after the `if (this.subs.size)` guard), so a bus with zero live subs still drives that one updateView (do NOT move onFlush inside the guard, or this regresses to zero-fire). **Two intentional behavior shifts (at the call site + here):** (1) onStateChange is now ASYNC on the `.state=` path — assignState already was, so they now match; (2) N `replaceState` in one tick COALESCE to a single onStateChange (notifyAll early-returns on `pendingAll`; was N+1). Gated: NEW `state/onStateChange.test.js` **5/5** — teeth-verified (bus+renderDeps / bus-observe-no-reactive-read / N-in-tick FAIL with count 2/2/4 against HEAD via `git stash` of the fix, pass after; patch + await→DOM-reflects guard the unchanged paths). Full core suite **108/108**; eslint delta 0. The immediate-updateView removal also drops the redundant no-op render invocation per replace (the tiny perf sliver of the disproven #2).

### Target #3 — store-bus write path (drainGlobalRenders hop) — HARNESS-ONLY
The isolatable part (`queueGlobalRender` Set.add + `drainGlobalRenders` iteration) is trivially cheap; the measured 2-3×-on-small-ops gap is **render-coupled** (`drainGlobalRenders → updateView`) → validating it needs the browser harness like #2, not a pure-node A/B like #1.

### Edge of cheaply-measurable wins
#1 shipped because the bus is DOM-free → a pure-node A/B attributes the win to one confirmed term. #2/#3 are render-pipeline-coupled → validating either needs rebuilding the Round-12 browser harness (CDP driver + static servers + worktree). **Banked #1; #2 premise corrected; #2/#3 gated on a user call** (rebuild harness for the less-common replace/store ops, or stop).

---

## Performance pass (v3 · Lens B · 2026-06-30)

A dedicated hot-path review across the class's methods. **5 confirmed wins (all behavior-preserving), verified against the code**; the framework is otherwise heavily and deliberately tuned (render.js yielded zero — every candidate there is documented-intentional).

### performance — confirmed wins (lowest-risk first)
- [x] base.js:582 — `atPhase = atPhase` instance field holds a stateless module fn as a per-instance own-prop (one slot + write per construct; 500 redundant on a 500-row list). Move it into `PROTO_METHODS` / the prototype `assign` fold — `phaseGetters` already call `this.atPhase(...)`, no `.bind` needed. [mechanical] *(also the v2 base.js:560 perf item, re-anchored)*
- [x] hotkeys/hotkeys.js:40 — `BYPASS_MODIFIERS` array is probed for membership (`.indexOf(token) !== -1`) on the keydown dispatch path (`comboHasBypassModifier`). Make it `new Set(['alt','ctrl','meta'])` + `.has()` — O(1) vs per-token linear scan; the comment documents which modifiers, not the array shape. [mechanical]
- [x] state/state.js:435 — `StateProxyHandler.get` computes `joinPath(this.path, key)` unconditionally, but `nestedPath` is consumed only by the container branches; a nested-primitive read (`this.state.user.name`) allocates a throwaway path string the `return propertyValue` path never uses. Return the primitive before computing `nestedPath` (the 3 container branches are mutually exclusive — no double-compute). [mechanical] *(in-code verified safe: this is the PLAIN `stateProxy`; render-tracking dep registration runs through a SEPARATE `TrackingProxyHandler` (binding.js:225) via `makeProxy`, so the early return has zero reactivity impact — `nestedPath` here only feeds child-container proxy construction.)*
- [x] template.js:3238 — `updateTemplateSpots` does `state.prevExprs = newExprs.slice()` — an N-element copy on **every patch render** (the most frequent path). Drop the `.slice()`, assign `newExprs` directly: all 3 callers (`templateHtml`:3290, `templateHtmlElement`:3351, `patchLightRow`:390) pass a fresh single-use array and early-return before any `instantiateRecipe`, and the array is read-only. **KEEP** `.slice()` at the install sites (3324/3372/381) where the array is shared with instantiation. [low] *(verified in-code: install-vs-patch asymmetry confirmed)*
- [x] template.js:1790 — `ListSpot.refresh` rebuilds `` `${bindingKey}.` `` on every drain for the partial-update prefix test; `bindingKey` is fixed at construction (1740). Precompute `this.bindingKeyPrefix = bindingKey + '.'` in the ctor and use `changedPath.startsWith(this.bindingKeyPrefix)`. [low]

### performance — confirmed DELIBERATE (documented intentional tradeoffs; left as-is, on record)
- base.js:521 eager `renderDepUnsubs` Map — nearly every component with a bare `${this.state.x}` populates it on first render; lazying adds a per-dep-sync branch for a net loss (rationale at 516-520).
- base.js:192 `Perf.mark`/`measure` — `IS_PRODUCTION` early-returns + null-sentinel short-circuit ⇒ zero cost on the cold path.
- base.js:122 selective `smartClone` — only object containers cloned; primitives/functions/class-instances by reference; owned provided keys skipped.
- render/render.js — `subscribeRenderDeps`/`renderDepUnsubs` 2-level Map, `markRenderDirty` via bus-`target` (no per-component `.bind`), `boundKeys.forEach(localPaths.delete, localPaths)` zero-arrow trick, `isPatchPass` tail-bail + await-skip guards, `[...deps]`/`[...store.keys()]` spread → indexed loop (house rule). **Zero perf findings in render.js.**
- template.js — LIS keyed-diff core (640 `lisIndexSet` + 839 phase-2 `moveBefore`/`stable` minimal-move), `sameKeyOrder` fast-path, `BindingSpot.handle` value-capture (measured 1.28×), `ListSpot.drain` replay-per-path, `each()` `items.slice()`. `walkPath`/`buildMarkerMap`/`getNodePath` run at install time (not the patch hot path). scheduler `drainSpots` already Set-deduped + indexed.

### performance — REJECTED by verify (diagnosis real, proposed fix UNSAFE — recorded so it is not re-attempted naively)
- state/pathSubscriptions.js:255 `flush()` — the O(subscriptionPaths × changedPaths) ≈ **O(N²)** scan on a full state replace (`assignState` re-notifies every path) **is real**. But both proposed fast paths break documented contracts: an exact-match Set delivers `changedPath === subscriptionPath` whereas the contract fires on the **first overlapping** changed path (an ancestor present in the same batch — observable in the handler's 2nd arg); the drive-from-`changed` variant **double-fires** subscribers hit both exactly and hierarchically (breaks at-most-once-per-batch). A correct fix needs a per-flush dedup Set **and** first-overlap preservation — non-trivial, deferred. Not an actionable quick win.

---

## v3 Delta refresh (changed files re-anchored · 2026-06-30)

16 changed/in-scope files re-read in full and diffed against v2 (by symbol — v2 lines had drifted).

**CLEAN / confirmed-clean (zero findings):** template/constants.js · gestures/dragSnap.js · gestures/dragTrack.js · gestures/selectionLock.js (new file — correctly-shaped ref-counted singleton) · dom/registry.js · index.js (17th changed file — pure re-export barrel, no loops/callbacks/logic, no findings).

**RESOLVED by the post-audit edits (v2 finding gone):**
- dom/dom.js — v2:56 `findComponent` forEach → resolved (now delegates to named `firstComponentInBuckets`, indexed loop); v2:48 & v2:60 loop counters → resolved (extracted to `firstComponentInBuckets` / `collectComponentsInBuckets`, renamed `index`).
- attrs/staticConfig.js — v2:219 loop counter → resolved (`ensurePropertyIndex` now uses `index`).

**LIVE — v2 findings still present, re-anchored to CURRENT lines (carry-forward work):**
- base.js — atPhase (v2:560 → **582**) *(see perf above).*
- state/state.js — loop counters: v2 167→**266**, 378→**525**, 401→**548**, 493→**640**, 503→**650**, 583→**730**.
- render/render.js — v2:35→**35** loop var; `isPromiseLike` bypasses: v2 270→**272**, 282→**284**, 292→**294**, 296→**298**, 324→**326**, 342→**344**, 378→**380**, 396→**398** (8, hot path).
- lifecycle/lifecycle.js — v2:62→**63** anon `.catch`; loop counters v2 197→**199**, 203→**205**.
- dom/dom.js — v2:24→**25** `getComponentsArray` anon forEach; v2:25→**26** inner loop counter; v2:80→**140** `ifAssign` anon callback.
- utilities.js — loop counters v2 96/102/107/167/299/307/332→**same**, 369→**371**, 383→**385**, 399→**401**; arrow-const exports v2 92/95/100/106→**same** (`callFn`/`eachArray`/`eachObject`/`eachNodeList`); v2:244 `runHook` `.then`→**244**.
- attrs/staticConfig.js — loop counters v2 69→**71**, 147→**161**.
- template.js — 22 loop counters re-anchored (v2→cur: 142→148, 150→156, 222→228, 638→644, 731→737, 765→771, 795→801, 849→855, 1715→1762, 2192→2239, 2226→2273, 2255→2302, 2495→2561, 2559→2625, 2710→2776, 2923→2994, 2929→3000, 2932→3003, 2949→3020, 3112→3184, 3129→3201); `const t`→itemType v2:152→**158**; `el` cluster v2 3014→**2717**, 3044→**2763**; typeof/isString-isFunction bypasses (11): 73→79, 138→144, 160→159, 169→175, 182→188, 191→197, 211→217, 226→232, 1102→1108, 1276→1282, 3036→3107; anon forEach 190→196, 210→216, 242→248, 247→253.
- template/parser.js — `const m`→match v2:65→**72**.
- debug/logger.js — gated-formatter anon arrows v2 142/145/153/157→**same**; naming `coll`→284, `cond`→375, `val` v2:395→**397**.
- debug/assertions.js — loop counter v2:33→**27** (`assertStaticStyles`).

**NEW — confirmed this pass (adversarially verified; v2 missed these):**
- base.js:119 — `foldStaticStateTemplate`: `mergedValue === null || typeof !== 'object'` ⇒ `!isObject(mergedValue)` (add `isObject` to the utilities import). [mechanical]
- state/state.js — half-names v2 missed: :413 `obj`→`target`; :718 `proto`→`prototype`; :277 `cb`→`callback`; :657 `sub`→`subscription`. [mechanical]
- lifecycle/lifecycle.js — :95/:105/:115 raw `typeof x.then === 'function'` ⇒ `isPromiseLike(x)` (already imported); :192 `destroy()` anon `.catch((error)=>…)` ⇒ named handler (2nd site, distinct from :63). [soft/refactor]
- utilities.js:366 — `smartClone` guard `value === null || typeof !== 'object'` ⇒ `!isObject(value)` (helper is in-file). [soft]
- template.js — param `type` shadows the forbidden global at :1647/:1732/:1829/:2092/:2169 (BindingSpot/ListSpot/ComputedSpot/StaticSpot/TwoWaySpot ctors) ⇒ rename e.g. `spotType` [soft]; :853 `typeof anchor.moveBefore` ⇒ `isFunction`; :195 `instanceof Set` ⇒ `isSet`; :215 `instanceof Map` ⇒ `isMap` [mechanical]; anon multi-line callbacks (extract named): :2295 `buildMarkerMap`, :2360 `buildSpotPlan` map, :2529/:2544/:2559 `extractDataBindPlans` (param `el` + nested `i`), :2595 `extractSubeventPlans` forEach, :2597 (param `el`), :2623 `extractRefPlans` (param `el`), :2657 `prepareRecipe` eachArray. [refactor/soft]
- debug/logger.js — typeof bypasses v2 missed: :94 `typeof msg`⇒isFunction, :102/:261/:329/:342 `typeof …==='string'`⇒isString, :270 `typeof msg`⇒isFunction; :93 `makeLevelLogger` anon gated-arrow ⇒ named (same class as :142/:145). [mechanical/soft]

> Net for the v3-refreshed files: **3 v2 findings resolved**, all others **still live** (line-drifted only), **34 new style findings** confirmed (verify: 34/34 style + 3/5 perf; the 2 rejects were both perf), **5 perf wins** confirmed. The bulk remains the mechanical naming sweep; the new substantive items are the `isPromiseLike`/`isObject`/`isSet`/`isMap` helper-bypasses, the `type` param shadows, the template.js anon-callback extractions, and the 5 perf wins.

---

## ▼ v2 body (2026-06-22) — carried forward for OUT-OF-SCOPE files

> Everything below is the v2 deep audit, retained verbatim. For files re-audited in the **v3 Delta refresh** above (base.js, state/state.js, render/render.js, lifecycle/lifecycle.js, dom/dom.js, utilities.js, attrs/staticConfig.js, template.js, template/parser.js, debug/logger.js, debug/assertions.js, dom/registry.js, gestures/dragSnap.js, gestures/dragTrack.js, template/constants.js) the **v3 lines supersede** these. The v2 entries below are the live backlog for the **out-of-scope** files this pass did NOT re-read: `ai/*`, `net/*`, `behaviors/*`, `tooltips/*`, `dialogs/*`, `environment/*`, `plugins/*`, `resolver.js`, `clipboard.js`, `indicator/*`, and the unchanged prototype-method modules (`state/privateState.js`, `state/context.js`, `state/subscriptions.js`, `state/pathSubscriptions.js`, `state/globalState.js`, `events/events.js`, `dom/delegate.js`, `dom/children.js`, `lifecycle/observer.js`, `lifecycle/scheduler.js`, `debug/perf.js`, `styles/styleApi.js`, `hotkeys/hotkeys.js`).

## Diff vs v1 single-pass

### NEW this deep dive (v1 missed)
- **realm.test.js** — pervasive `el` half-name across 15 test sites (whole file unflagged in v1). `state/realm.test.js`.
- **7 more `naming-global-shadow` beyond permissions.js** — v1 found only `ai/permissions.js:4 let prompt`. v2 adds: `ai/host.js:16` (event), `ai/transports/webmcp.js:64` (event), `webrtc.js:44/77/105/108` + verify-added `55`/`108` (event), `websocket.js:52/71` (event), `dom/anchor.js:75` (`let top` shadows window.top). Shadow count 1 → 8.
- **forbidden-typeof-bypass spread** — v1 scoped this to render.js + template.js. v2 confirms it in `ai/protocol.js:266`, `ai/tools.js:291`, `dom/delegate.js:153`, plus template.js sites at 73/160/226/138/169/182/191/1102/1276/3036.
- **classes-factory on files v1 called CLEAN/exemplary**:
  - `ai/transports/local.js:25` — v1 marked CLEAN ("justified closures"); v2 flags the per-instance object-of-methods controller → class + static create.
  - `dialogs/confirm.js:32` — v1 marked **exemplary**; v2 flags the singleton-controller-of-closures shape (⚠ unverified, styles-attrs unit).
  - `dom/delegate.js:123` — `getOrCreateScopeRecord` object-literal-with-handleEvent → class, mirroring sibling `DelegateEntry`.
- **foundInVerify (11)** — surfaced only in the adversarial verify pass, absent from the first auditor reads:
  - `template.js:242,247` diffClassList anon forEach; `template.js:2651…` `el` half-name cluster (DataBindSpot).
  - `ai/host.js:65,76` broadcast/destroy anon forEach; `ai/descriptors.js:156` `kids.map` multi-field object.
  - `transports/webrtc.js:55,108` global-shadow `event` (omitted from the main shadow list).
  - `behaviors/reveal.js:13` inner `entries.forEach`; `debug/perf.js:38` `quantile(…, p)` single-letter param.
  - `dom/anchor.js:55` `const fitsOn` arrow-const (v1 noted at :58, v2 confirms as the same finding).
  - `dom/dom.js:24` `getComponentsArray` anon forEach-with-nested-loop (sibling of the :56 finding v1 had).

### WITHDRAWN / downgraded vs v1
- **MARQUEE: gestures/dragSnap.js + dragTrack.js** — v1's #2 substantive item (factory-of-closures → class). **Now CLEAN in v2** — converted to classes; gone from findings. The largest semantic refactor v1 flagged is resolved.
- `template.js:93 ClassList.prototype.create` odd-shape — not re-raised.
- `clipboard.js` trivial `.then(()=>true,()=>false)` — dropped (trivial-body carve-out, file now CLEAN).
- `template/parser.js` inline-array-membership perf-Set — not re-raised (parser.js now only the `m` rename).
- `dom/refs.js:8` FinalizationRegistry cb, `dom/children.js:4,9` factory arrows, `environment/battery.js:30` — not re-raised.

### Label note
`functions-arrow-const` (utilities.js) and `functions-const-arrow` (anchor.js:55) are the **same rule** under two auditor labels — merged in the table below.

---

## Summary (count = JSON entries; sum 120)

| rule                                 | count | risk              | where the weight is                                                                                 |
| ------------------------------------ | ----- | ----------------- | --------------------------------------------------------------------------------------------------- |
| functions-anon-callback              | 39    | soft / judgment   | ai subtree + transports/webmcp (5), styles, hotkeys (4), template.js, dom.js — mostly conf 0.4–0.55 |
| naming-loop-counter                  | 29    | mechanical        | template.js (3 entries span ~21 loops), state/* , utilities.js, ai/*                                |
| naming-var                           | 15    | mechanical        | template.js, ai/descriptors+paths, binding.js, perf.js, tooltip.js, logger.js, realm.test.js        |
| forbidden-typeof-bypass              | 11    | low               | template.js (most), render/render.js (~8 sites), protocol/tools/delegate                            |
| naming-global-shadow                 | 8     | high              | permissions.js `let prompt`, anchor.js `let top`, + 6 handler `event` params                        |
| functions-deferred-inline            | 4     | low / refactor    | websocket heartbeat, tooltip.js slide, visual.js, delegate.js                                       |
| classes-factory                      | 3     | refactor          | transports/local.js, dom/delegate.js, dialogs/confirm.js ⚠                                          |
| functions-anon-handler               | 3     | refactor          | transports/webrtc.js, websocket.js, behaviors/autoResize.js                                         |
| performance                          | 2     | soft / mechanical | base.js atPhase proto-move, hotkeys BYPASS_MODIFIERS→Set                                            |
| functions-arrow-const (+const-arrow) | 2     | refactor          | utilities.js (callFn/each*), anchor.js fitsOn                                                       |
| forbidden-nested-for                 | 1     | refactor          | pathSubscriptions.js flush() triple-nest                                                            |
| naming-half-name                     | 1     | mechanical        | template.js DataBindSpot `el` cluster                                                               |
| quality-debug-residue                | 1     | quality           | render/factory.js:14 console.log                                                                    |
| comments-residue                     | 1     | quality           | tooltips/tooltip-service.js:179 dead block                                                          |

Weight: ~73% of entries are the mechanical naming bulk (loop-counter 29 + naming-var 15 + half-name 1 = 45) plus the 39 soft anon-callback judgment calls. The substantive, behavior-shaping items are the 14 in the bottom half of the table.

---

## Findings (lowest-risk first)

### quality — debug / comment residue (trivial, do first)
- [x] render/factory.js:14 — stray `console.log` — resolved by the user's `element.debug` change [Round 8].
- [x] tooltips/tooltip-service.js:179 — malformed dead-code comment block — repaired [Round 8 `0c1328e5`].

### naming — single-letter loop counters (`i`/`j`/`k` → descriptive) — mechanical — ✅ CLOSED (in-scope: v3 low-risk batch; out-of-scope tree: Round 8 `24ce9e0e`; ai/ files via Rounds 7/8/11 rewrites. **Grep-verified 2026-07-04: zero `for (let i/j/k` hits remain in every file below.**)
- [x] utilities.js:96,102,107,167,299,307,332,369,383,399 — `i` → index/keyIndex/partIndex.
- [x] template.js:142,150,222,638,731,765,795,849 — `i`/`j` → tokenIndex/itemIndex/keyIndex/sourceIndex/insertIndex/elementIndex.
- [x] template.js:1715,1716,2192,2193 — `i` in ListSpot.drain/walkPath → pathIndex/depthIndex.
- [x] template.js:2226,2255,2495,2559,2710,2923,2929,2932,2949,3112,3129 — `i`/`j` → charIndex/attrIndex/partIndex/spotIndex/keyIndex/innerIndex.
- [x] ai/mixin.js:45,67 — `i` → index.
- [x] ai/tools.js:38 — `i` → index.
- [x] ai/descriptors.js:40,57,97 — `i` → index.
- [x] ai/paths.js:67,74 — `i` → index.
- [x] ai/visual.js:107,119 — `i` → index.
- [x] state/state.js:167,378,401,493,503,583 — `i` → index/pathIndex/keyIndex.
- [x] state/pathSubscriptions.js — file totally rewritten [Rounds 9/13]; written to current rules.
- [x] state/privateState.js:220,227 — `i` → keyIndex.
- [x] state/subscriptions.js:10,74,104 — `i` → index/keyIndex.
- [x] state/globalState.js:128 — `i` → index.
- [x] dom/delegate.js:55,86,158,443 — `i` → index.
- [x] dom/children.js:14 — `i` → index.
- [x] dom/dom.js:25,48,60 — `i` → index.
- [x] environment/breakpoints.js:43,57 — `i` → keyIndex/bucketIndex.
- [x] environment/media.js:22,48 — `i` → keyIndex.
- [x] environment/viewport.js:40 — `i` → keyIndex.
- [x] lifecycle/lifecycle.js:197,203 — `i` → index.
- [x] lifecycle/observer.js:34 — `i` → index.
- [x] lifecycle/scheduler.js:42,52 — `i` → index.
- [x] events/events.js:222,254 — `i` → index.
- [x] render/render.js:35 — `i` → childIndex.
- [x] plugins/registry.js:25 — `i` → pluginIndex.
- [x] debug/assertions.js:33 — `i` → index.
- [x] debug/perf.js:102,136,186 — `i` → index.
- [x] attrs/staticConfig.js:69,147,219 — `i` → index.

### naming — single-letter / abbreviated / half-name vars — mechanical — ✅ CLOSED except realm.test.js (grep-verified 2026-07-04)
- [x] template/parser.js:65 — `const m` → named `attrMatch`/`eventMatch`/`shorthandMatch` [low-risk batch].
- [x] template.js:152 — `const t = typeof item` — site restructured, gone [low-risk batch / Round 2].
- [x] template.js — `el` cluster → `element` — hand-migrated by user, 0 bare `el` remain [Round 10].
- [x] ai/descriptors.js:24 — `const t = typeof value` → `valueType` [Round 6 `aec6fcf7`].
- [x] ai/paths.js:36 — `let n = 2` → `suffix` [Round 6].
- [x] ai/paths.js:14 — param `ch` → `char` [Round 6].
- [x] state/binding.js:396 — `const c` → `ctor` [Round 6].
- [x] state/binding.js:392 — now `isBindingType(value)` [Round 6].
- [x] state/realm.test.js — `el` → `element` ×35 (word-boundary sed; realm 17/17) [Round 15].
- [x] dom/refs.js:40 — now `registerRef(component, refName, element)` [Round 6].
- [x] behaviors/autoselect.js:3 — `const el` — gone in the class rewrite (`element`) [Round 14].
- [x] behaviors/reveal.js:33 — `const obs` — renamed `sharedObserver` [Round 6], file since rewritten (per-margin observer Map) [Round 14].
- [x] tooltips/tooltip.js:38,39,61,62 — `w`/`h` → `shellWidth`/`shellHeight` [Round 6].
- [x] debug/perf.js:137,188 — `const el` gone [Round 6].
- [x] debug/perf.js:38 — now `quantile(sortedSamples, fraction)` [Round 6].
- [x] debug/logger.js:284,375,395 — zero `coll`/`cond`/`val` remain [low-risk batch].

### forbidden — imported helper bypassed by raw typeof — low — ✅ CLOSED (grep-verified 2026-07-04: zero `typeof … 'function'/'string'` bypasses + zero `typeof x.then` remain in the files below)
- [x] template.js:73 — → isFunction [low-risk batch].
- [x] template.js:226 — → isFunction [low-risk batch].
- [x] template.js:160 — → isFunction [low-risk batch].
- [x] template.js:138,169,182,191,211 — → isString [low-risk batch].
- [x] template.js:1102 — → !isString [low-risk batch].
- [x] template.js:1276 — → !isString [low-risk batch].
- [x] template.js:3036 — `typeof cleanup === 'function'` — RESOLVED BY REMOVAL: the behavior install site no longer handles a returned cleanup (BehaviorTeardown contract) [Round 14].
- [x] ai/protocol.js:266 — → `isString(error.message)` (now :255; `code` number-check kept) [Round 6 `68244448`].
- [x] ai/tools.js:291 — → `isFunction(component?.aiMap)` (now :294) [Round 6].
- [x] dom/delegate.js:153 — → isFunction [Round 6].
- [x] render/render.js ×8 — → isPromiseLike [low-risk batch].

### performance — mechanical / soft — ✅ both dupes of the v3 perf wins (ticked in that section)
- [x] hotkeys/hotkeys.js — `BYPASS_MODIFIERS` = `new Set` (:39, `.has` :222) [low-risk batch].
- [x] base.js:560 — `atPhase` instance field gone; lives in the prototype fold (:677) [low-risk batch].

### functions — deferred host callback inlines logic → thin forward — low/refactor
- [x] ai/transports/websocket.js:95 — → named `sendHeartbeat()` + thin forward [Round 15].
- [x] tooltips/tooltip.js:129 — token-guard + mutation → named `onSlideEnd(token)` + thin forward [Round 10].
- [x] ai/visual.js:82 — fade chain → named module fns via `setTimeout(fn, ms, box)` extra-args [Round 10].
- [x] dom/delegate.js:196 — RESOLVED-BY-CARVE-OUT: sanctioned wrapped-callback last resort (zero-arg microtask inside an already-named fn) [Round 10].

### functions — arrow-const reusable logic → named `function` — refactor — ✅ CLOSED
- [x] utilities.js — `callFn`/`eachArray`/`eachObject`/`eachNodeList` → `function` declarations (callFn now :113) [Round 2].
- [x] dom/anchor.js:55 — `fitsOn` → module `function fitsOn(…)` taking geometry as args (:39) [Round 10].

### functions — anonymous event handlers → named method / handleEvent — refactor — ✅ CLOSED [Round 15]
- [x] ai/transports/webrtc.js — ~10 handlers → transport-as-listener `handleEvent` routed by currentTarget/type; executor closures → `Promise.withResolvers` [Round 15].
- [x] ai/transports/websocket.js — 4 handlers → `addEventListener(type, this)` + named handleSocket* methods [Round 15].
- [x] behaviors/autoResize.js:9 — handler arrow — `ResizeOnInput` class [Round 10], superseded by a shared `currentTarget` handleEvent singleton [Round 14].

### classes — controller-of-closures → class + static create() — refactor
- [x] **dom/delegate.js — `getOrCreateScopeRecord` object-literal+handleEvent → `ScopeRecord` class (static create, mirrors DelegateEntry).** APPLIED `84d3b6ee`. Behavior-identical (DOM calls handleEvent with this===listener; same instance to add/removeEventListener). Loop rules folded in (snapshotLength const, i→index). Verified by node --check + eslint(no new) + full suite baseline + a happy-dom `installScopedDelegate` dispatch smoke test. **Coverage gap logged:** scoped delegation (Tier 3) has NO permanent unit test — worth adding a real delegate.test.js (out of scope for this commit).
- [x] ai/transports/local.js — **RIGHT-SIZED CLOSED [Round 15]:** the `viatAI` api façade stays an object of arrows BY DESIGN (documented in-code) — a public global console/agent API must survive destructuring; prototype methods would lose `this`. One object per start().
- [x] **dialogs/confirm.js — anon Promise executor → named `confirmExecutor`.** APPLIED `5681ea6d`. **Finding RIGHT-SIZED:** the "→ class + static create + handleEvent" prescription was REJECTED — confirm.js is module-singleton state + an async fn, NOT a factory-of-methods, and the settle/onAccept/onCancel/onClose closures are already *named* (v1 "exemplary" was right). The one real violation was the anonymous arrow executor (rule: top-level named executor). Fixed by a pure behavior-identical hoist; eslint clean, tests baseline. (No runtime smoke — pure hoist, no logic change; confirm.js has no test net and a heavier ui-modal/resolver import chain.)

### forbidden — nested for-loops → extract — refactor — ✅ OBSOLETE
- [x] state/pathSubscriptions.js flush() triple-nest — file totally rewritten: match-phase + dispatch-phase with named `dispatchSingle`/`dispatchChanged`/`dispatchAll` [Round 9 `db1167a8`, lazy trie Round 13 `7b37ad52`].

### naming — global shadow — HIGH (8 entries across 6 sites) — ✅ CLOSED [Round 6 `10fd0e19`] (grep-verified 2026-07-04: zero `(event)` params / `let prompt` / `let top` remain)
- [x] ai/permissions.js:4 — → `promptHandler`.
- [x] dom/anchor.js:75 — → `topPosition` (now :84).
- [x] ai/host.js:16 — → `registryEvent`.
- [x] ai/transports/webmcp.js:64 — → `registryEvent`.
- [x] ai/transports/webrtc.js ×5 — → `iceEvent`/`messageEvent`/`errorEvent`/`dataChannelEvent`.
- [x] ai/transports/websocket.js:52,71 — → `messageEvent`/`errorEvent`.

### functions — anonymous callbacks with real bodies → named — soft / judgment (conf 0.4–0.6)
> ✅ Mostly closed by Rounds 2/10/11 (grep-verified 2026-07-04). **Still live: 4 non-parked sites** (descriptors ×2, visual, geo) + the parked transports/host cluster.
- [x] resolver.js:56,59 — → named async `importTag` (:42) [Round 10].
- [x] utilities.js:244,246 — runHook → named async `awaitHookResult` (:255, sync fast-path kept) [Round 2].
- [x] template.js:190 — → `for…of` [Round 2].
- [x] template.js:210 — → `for…of` [Round 2].
- [x] template.js:242,247 — diffClassList → `for…of` [Round 2]. (Zero `.forEach((` left in template.js.)
- [x] ai/protocol.js:130,144 — → shared `describeTool`/`describeTools` + Map-entry loops [Round 11 `41a005d0`].
- [x] ai/descriptors.js:67 — → `describeTools` entry loop [Round 11].
- [x] ai/descriptors.js queryByTag/queryByLabel — → `for…of componentEntries()` + named `matchesLabelQuery` [Round 15].
- [x] ai/descriptors.js:167 — `kids.map` → module `describeChildNode` [Round 15].
- [x] ai/paths.js:149,169 — → Set `for…of` / indexed `getRoots()` [Round 11].
- [x] ai/visual.js:27 — → `for…of componentEntries()` [Round 15].
- [x] ai/host.js:43 — → `isPromiseLike` + named async `settleTransportStart` [Round 15].
- [x] ai/host.js:65 — broadcast → delete-safe Set `for…of` [Round 15].
- [x] ai/host.js:76 — destroy → `for…of` [Round 15].
- [x] ai/transports/local.js:55 — notify → Set `for…of` [Round 15].
- [x] ai/transports/webmcp.js:64 — → named `onRegistryEvent` + thin forward [Round 15].
- [x] ai/transports/webmcp.js:78 — findById DELETED — registry `getComponentById` is the same Map lookup [Round 15].
- [x] ai/transports/webmcp.js:92 — → `for…of` tools entries; shared `noopUnregister`; executor arrow = documented MCP-forced shape [Round 15].
- [x] ai/transports/webmcp.js:114 — → Map `for…of` (delete-during-iteration documented) [Round 15].
- [x] ai/transports/webmcp.js:162,164 — → nested `for…of`; builder shapes differ (pull-list vs registered descriptor) so no forced merge [Round 15].
- [x] dom/dom.js:56 — → named `firstComponentInBuckets`, indexed loop [Round 2 / v3 delta].
- [x] dom/dom.js:24 — → `for…of` over Map values (`collectComponentsInBuckets`) [Round 2 / v3 delta].
- [x] dom/dom.js:80 — ifAssign → indexed loop, `eachObject` import dropped [Round 2].
- [x] dom/inert.js:20 — → async/await + named predicate/mapper [Round 10].
- [x] behaviors/reveal.js:12 — IO callback → named `revealIntersectedEntries` [Round 10; survives the Round 14 rewrite].
- [x] behaviors/reveal.js:13 — inner `entries.forEach` → indexed loop [Round 14 rewrite].
- [x] hotkeys/hotkeys.js:244 — dispatch forEach → `for…of` bucket [Round 10; entry-Map footgun fixed Round 11 `ba8077da`].
- [x] hotkeys/hotkeys.js:132 — comboFromEvent → `for…of heldKeys.values()` [Rounds 10/11].
- [x] hotkeys/hotkeys.js:111 — shiftIsMeaningful → `for…of heldKeys.values()` with early-exit [Rounds 10/11].
- [x] hotkeys/hotkeys.js:364 — hotKeyListeners → `for…of` bucket [Round 10].
- [x] lifecycle/lifecycle.js:62 — → async/await inside `runLifecycleStep`, zero `.catch((` left in file [Round 2].
- [x] lifecycle/observer.js:33 — → named `dispatchIntersectionEntries` (:48) [Round 10].
- [ ] environment/geo.js:43,47 — getCurrentPosition success/error multi-step arrows → named handlers — still live (also an anon Promise executor at :42).
- [x] debug/logger.js:142,145,153,157 — → named `logHeader`/`logRule`/`logGroup`/`logTrace` + `printLevelLine` [Round 2]. Remaining `gated(level, (…)=>…)` at :101/:117 are the sanctioned thin level/method-injecting forwarders [Round 10 carve-out].
- [x] styles/styleApi.js:60 — compile forEach → `for…of` [Round 10; ⚠ resolved].
- [x] styles/styleApi.js:83 — → named async `fillSheetSlot` (concurrency preserved) [Round 10].
- [x] styles/styleApi.js:101 — → `compileAndCacheStyles` [Round 10].
- [x] styles/manifest.js:24,25 — → named async `resolveModuleSheet([key, file])` [Round 10].
- [x] tooltips/tooltip-service.js:103,126 — `.then` chains → named async `hideWhenReady`/`showWhenReady` [Round 10].

---

## Strict-CLEAN files (zero findings)
animation.js, attrs.js, autofocus.js, connection.js, constants.js, context.js, css-loader.js, device.js, documentTitle.js, **dragSnap.js**, **dragTrack.js** (both converted to classes since v1), envelope.js, headStyles.js, hotkey.js, index.js, inferTypes.js, listFilter.js, listFilter.test.js, locale.js, movingIndicator.js, phase.js, portal.js, projection.js, reflectViewport.js, registry.js (ai/ + dom/), collection.js, scrollReport.js, themeStyles.js, **tooltip.js (behaviors/)**, universalWebSocket.js.

> **[Round 14 note]** Several strict-CLEAN entries were REWRITTEN this round and re-verified clean under the current ruleset: `device.js` (full rewrite), `behaviors/{tooltip,hotkey,autofocus,autoselect,autoResize,reveal,scrollReport}.js` (class singletons), `behaviors/registry.js` (+BehaviorTeardown). `collection.js` is deletion-pending (superseded by `state/collectionEngine.js`, a NEW in-scope file audited-at-birth) — audit no further. `viewport.js` and `hotkeys.js` were also touched (device-const imports; `createHotkeyEntry` split).

---

## Verdict
> **[2026-07-04] STALE — historical record only.** Every item in this verdict's short-list is resolved (shadows R6, isPromiseLike batch, classes-factory R6/`84d3b6ee`/`5681ea6d`, flush-nest R9, el-cluster R10) except the parked transports handlers. Current state lives in **§ OPEN — consolidated remainder** at the top.

Most-numerous rule is **functions-anon-callback (39)** — but it is overwhelmingly `soft`/judgment at confidence 0.4–0.55, so it is NOT where the actionable weight sits. The actionable, high-confidence bulk is the **mechanical naming sweep** — loop-counter (29) + naming-var (15) + half-name (1) = 45 behavior-neutral renames — joined by the trivial `render/factory.js:14` console.log removal and the `let prompt` rename. That whole tier is a one-pass low-risk edit. **Effort tier: bulk = trivial mechanical; a thin top layer = deliberate refactor.** The short list a human should actually decide on: (1) the 3 `classes-factory` conversions — `transports/local.js`, `dom/delegate.js` scope-records, and `dialogs/confirm.js` ⚠ — note local.js/confirm.js were CLEAN/exemplary in v1; (2) the ~14 anonymous `addEventListener` handlers in `transports/webrtc.js` + `websocket.js` (changes listener-dispatch shape); (3) `render/render.js`'s ~8 `isPromiseLike` bypasses (consistency, hot path); (4) `pathSubscriptions.js` flush() triple-nested loops (shared inner state makes extraction non-trivial); (5) the 8 global-shadows (high severity, but each is a 1-word rename). The marquee v1 refactor — dragSnap/dragTrack factory-of-closures — is **resolved**. The 6 ⚠ `styles-attrs` findings did not clear adversarial verify; re-confirm before touching.

### v3 addendum (2026-06-30)
The WebComponent-class + perf re-pass (sections at top) confirms the v2 picture holds for the changed files: **only 3 v2 findings resolved** (dom/dom.js bucket-walk extraction ×2, attrs/staticConfig.js one counter), everything else still live (line-drifted). The substantive new layer is small and high-value: **5 perf wins** (atPhase→prototype, BYPASS_MODIFIERS→Set, StateProxyHandler.get early-return, template.js patch-pass `.slice()` drop, ListSpot prefix hoist — all behavior-preserving and in-code-verified), the **helper-bypass cluster** (`isPromiseLike` in lifecycle.js, `isObject` in base.js/utilities.js, `isSet`/`isMap`/`isFunction` in template.js & logger.js — v2 missed many in the changed files), and the **5 `type` param shadows** in template.js Spot ctors. The 2 `pathSubscriptions.flush()` perf ideas were **rejected** — the O(N²)-on-full-replace cost is real but no safe quick fix exists (contract-breaking). render.js is perf-clean (every candidate documented-deliberate). **Effort tier unchanged: bulk = mechanical renames/helper swaps (one low-risk pass); thin top = the template.js anon-callback extractions + the deferred subscriptions O(N²).**
