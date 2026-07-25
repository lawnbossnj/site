# Render/Template/Events — Vue3-parity performance review (2026-07-04)

Goal: get as close to Vue 3 as possible **without a compile step**; compiler comes after.
Scope read end-to-end: template.js, template/parser.js, render/render.js, state/binding.js,
state/state.js, state/pathSubscriptions.js, lifecycle/scheduler.js, events/events.js, dom/delegate.js, base.js.

## Harness — VALIDATED + first live baseline vs Vue 3 / Lit 3 (2026-07-04)
The existing `framework-shootout` component IS the harness (loads Lit3+Vue3 from CDN, full
js-framework-benchmark op set, GC-honest `Perf.bench` p50). Driven live via Playwright against the
running `pnpm centralSite` server (localhost:5173/shootout.html) — the page loads core from
localhost, so **these runs exercise the shipped #4a flat dispatchSingle in a real browser** under
real update workloads (update ops = single-path flushes). Two runs at count=1000, all 9 columns
(7 UWC strategies + Lit3 + Vue3). p50 ms, ops = create · updateAll · replace · upd10th · precision · append · swap · remove½ · clear.

| column | create | append | updateAll | upd10th | precision | replace | swap | clear |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| UWC full-component | 16–19 | 14–20 | 1.3–1.5 | 1.0–1.4 | 0.8–0.9 | 3.6–6.0 | 0.9–1.1 | 4.9–9.8 |
| **UWC `list()`** | **3.8–5.1** | **3.5–5.3** | 0.2 | 0.1–0.2 | 0.0–0.1 | 1.0–1.6 | 0.1 | 0.3–1.8 |
| UWC store `list()` | 3.8–6.1 | 4.3–6.0 | 0.5–0.6 | 0.4–0.5 | 0.2–0.3 | 1.4–2.3 | 0.3–0.4 | 0.4–1.6 |
| Lit 3 | 3.3–5.8 | 3.6–8.6 | 0.3–0.4 | 0.3–0.4 | 0.3 | 0.6–0.9 | 2.4–3.4 | **2761–5110** |
| Vue 3 | 4.4–5.8 | 6.3–7.9 | 1.8–1.9 | 1.7–1.8 | 1.6–1.7 | 2.3–3.2 | 1.6–1.8 | 0.4–1.5 |

**Reproducible findings** (relative ordering stable across both runs):
- **UWC's fast list strategies match Lit and BEAT Vue 3 on the reliable above-floor ops** —
  create: UWC `list()` 3.8–5.1 vs Vue 4.4–5.8; append: 3.5–5.3 vs Vue 6.3–7.9. **No compile step.**
  So "close to Vue3" understates it — UWC's fast paths are already at/ahead of Vue's runtime.
- **UWC surgical updates crush Vue** (directional): updateAll/upd10th/precision UWC `list()`
  0.0–0.2 ms vs Vue 1.6–1.9 ms (~10×) — fine-grained spot patching vs vdom diff. Near the floor
  at 1k, so directional not firm; the gap is architectural (spots = compiled-grade patch flags).
- UWC full-component-per-row is the heaviest strategy (~3–4× `list()`) — it buys CE + shadow +
  async lifecycle per row; the right tool when you need encapsulation, not for data lists.
- Lit's `repeat` teardown is pathological: remove½/clear 386 ms / 2.7–5.1 s at 1k, and **1k rows
  is its ceiling — 10k OOM-crashed the tab** (user-confirmed). Keep Lit runs ≤ ~2k.

**⚠ Validity limit (critical for how to use this rig):** run-to-run variance was **~30%** on this
(loaded, dev) machine — create UWC full 16→19, Vue 4.4→5.8 between identical runs. So the harness
**resolves ~2× framework-level differences reliably but CANNOT A/B a sub-ms by-construction win**
(#4a/#4b/#5 are all below this noise). Confirms the advisor's `performance.now()` floor trap:
framework-level comparison = valid here; micro-optimization A/B needs an isolated micro-bench
(no CDN, no sibling columns) + a quiet machine + many samples, or is judged by construction (as
#4a was). **#4a is live-verified for CORRECTNESS here** (ran under real update workloads, no
breakage); its perf remains by-construction, not stopwatch-measurable at this scale.

## Verdict — the architecture is already post-Vue-shaped

No vdom. The pipeline is: tagged-template `strings` identity → **cached recipe** (parse once
per call site, ever) → clone + spot install → per-spot bus subscriptions → batched
microtask flush → surgical `patchSpot`. That is Vue's compiled output *plus* patch flags
*plus* block tree, achieved at runtime:

| Vue 3 technique | UWC equivalent | status |
| --- | --- | --- |
| template compile | `getRecipe` per strings identity (amortized 0) | ✅ better (cached clone vs per-vnode create) |
| patch flags / block tree | spots ARE the dynamic-node list; statics never revisited | ✅ |
| keyed diff (LIS) | `patchList` LIS + `moveBefore` + sameKeyOrder fast path | ✅ ahead (state-preserving moves) |
| scheduler (queueJob) | masterFlush + drainSpots single microtask | ✅ |
| reactive proxy + targeted trigger | proxy ✅ / **trigger scans all buckets** | ⚠ GAP 2 |
| per-element invoker closures | shared `handleEvent` dispatchers + WeakMap | ✅ better |
| v-once / static | `recipe.isStatic`, StaticSpot, `react:false` | ✅ |
| v-for row cost | LightTemplate rows (~10× cheaper than components) | ✅ opt-in |

Remaining losses vs Vue are **fixed overheads at the flush→render junction** (= Phase 5)
and **creation throughput** — not update algorithms. No re-architecture is warranted;
the wins below are surgical and cumulative.

## Ranked wins (small → large; each with proof method)

### 1. `onFlush` no-op gate — skip updateView when nothing can render ✅ SHIPPED 2026-07-04
`ComponentStateBus.onFlush` ([state.js:42](state/state.js#L42)) called `updateView()` on **every**
flush — including purely surgical batches (BindingSpot/TwoWay/observer) where `templateBuilt`
stayed `true` and no `onStateChange` hook exists. `updateView` is **async**, so the dominant
cost was **a promise allocated every flush per component** even when the call provably no-ops
(render side already gated on `!templateBuilt`; no hook → nothing) — plus the Perf pair and
hook/phase probes.
**Fix (landed)**: `onFlush` returns early when `component.templateBuilt === true && !component.onStateChange`.
`markRenderDirty` sets `templateBuilt = false`, so render passes flow through untouched; the
once-per-flush `onStateChange` contract — including replaceState's zero-subs guarantee, which
keys on the *hook's presence*, orthogonal to this gate — is preserved by the `!onStateChange`
clause; the `replaceState`-with-zero-subs-no-bus path calls `updateView` directly and never
reaches onFlush. **Verified**: new `state/onFlushGate.test.js` drives the skip branch (surgical
`bind()` spot, no bare read, no hook → mutate → DOM patches via drainSpots with **0 updateView
calls**) + the complement (bare-read renderDep flips templateBuilt → onFlush does NOT skip).
Full suite **125/125** (123 + 2), eslint clean. Advisor-confirmed gate proof.

### 2. `replaceState` shallow diff — ❌ REJECTED 2026-07-04 (evaluated; the state.js:527 TODO is now resolved as won't-do)
The bare TODO invites a top-level diff instead of `notifyAll`. Investigated the call sites +
the dispatch cost; it is a **loss for this codebase**, on four grounds:
1. **`assignState` already IS the per-key-diff path** — `if (this.STATE[key] === next) continue;`
   → notify only changed keys, and it's what keyed-list reuse calls (`updateReusedElement →
   element.assignState(item)`). The architecture deliberately splits: **`assignState` = partial
   diff update, `replaceState` = wholesale swap.** Diffing inside `replaceState` reimplements
   `assignState` and erases the distinction. A caller wanting partial semantics already has it.
2. **Usage is full-replacement-dominated** — every app `replaceState` call site is the bench
   "replace" op ("full-state replacement, every value changed") or a list-row whole-item
   assignment. Every key changes → the diff notifies every key anyway, after paying for the diff.
3. **`dispatchAll` is already optimal for all-changed** — fire each bucket once, no overlap
   matching, no trie. Routing the all-changed case through `notify(changedKeys)` → `dispatchChanged`
   → `ensureIndex` builds/walks a trie `dispatchAll` skips. Strictly more work — and it slows the
   very "replace" column benchmarked against Vue.
4. **Silent-wrong-render risk** — a reused nested ref mutated in place before `replaceState`
   (`U.name='b'; replaceState({user:U,…})`) has `newSTATE.user === oldSTATE.user`, so a ref-diff
   skips `user` and drops the `user.name` update that `dispatchAll` catches.
**Revival condition (absent here, don't build speculatively):** a genuine "spread old state,
change ONE top-level key" caller — that routes to `dispatchSingle` (no trie) and would win.
Resolved in-code: the state.js TODO is replaced with this rationale so it can't be re-proposed
from bare text.

### 2b. `PARSED_PATHS` unbounded-growth cap ✅ SHIPPED 2026-07-04
`parsePath` ([utilities.js:174](utilities.js#L174)) memoizes `path.split('.')` in a module Map with
no bound. Dynamic list-index paths (`items.4821.label`) mint a unique key per row, so a long
session churning large lists pins one small array per path ever seen — a slow leak.
**Fix (landed)**: cap at 10k; on the miss that crosses it, `PARSED_PATHS.clear()` wholesale.
Safe because all three consumers (`getValueAtPath` / `buildIndex` / `collectOverlaps`) read the
returned array locally and never retain it by identity, so a cold re-split is transparent; the
size check rides ONLY the cache-miss branch, so a cache hit (hot path) still pays one `Map.get`.
Test in `pathSubscriptions.test.js` (churn 25k unique paths → splits stay correct, early path
re-resolves post-clear, consumer read correct). Suite **126/126**, eslint clean.

### 3. Patch-pass dep re-sync skip
Every `renderView` tail runs `subscribeRenderDeps` → `syncSubsByDiff`
([render.js:109](render/render.js#L109)) with ~6 array allocations per realm even when the dep
set is unchanged — the overwhelmingly common case. Cheap set-equality pre-check
(size match + `every has`, no snapshots) or a dep-version counter skips the whole sync.
Also drop the `[...store.keys()]` / `[...deps]` snapshots — plain `for…of` is safe there
(no user code runs mid-loop; only `clearUnsubs` on vanished realms).
Risk: low. Prove: microbench a patch pass; Perf category `renderView`.

### 4. Targeted single-path dispatch — split into a provable FLAT slice (shipped) + a nested/trie slice (harness-gated)
`dispatchSingle` ([pathSubscriptions.js](state/pathSubscriptions.js)) snapshotted
`[...subs.entries()]` and ran `pathsOverlap` against **every** bucket per flush — O(S). Vue's
trigger is `depsMap.get(key)` — O(matched). The overlapping buckets are always {exact} ∪
{ancestors} ∪ {descendants}; descendants exist ONLY if a subscribed path is dotted below the
change. That splits the fix:

#### 4a. Flat fast path (`nestedPathCount === 0`) ✅ SHIPPED 2026-07-04
Evidence (static, tree-wide): reads are **1603 flat vs 49 nested — 97% flat**; the heaviest app
buses (carousel 19, poll 17, slider 16, settings-modal 15 keys) are 0–1 nested. So flat is the
dominant vocabulary. **Key strengthening of the advisor's prefix-walk**: when no bucket is dotted,
a single changed path overlaps **AT MOST ONE** bucket — its exact key (flat change), or its FIRST
SEGMENT (the sole bare-key ancestor; any longer prefix would be dotted → absent; a descendant
needs a dotted sub). So `dispatchSingle` collapses to **one `Map.get`** — no O(S) scan, no
per-flush `[...subs.entries()]` snapshot, and ≤1 bucket means dispatch order is trivially
preserved. Gated by an **O(1) `nestedPathCount`** maintained at the two bucket chokepoints
(`bucketFor`/`dropBucket`, the same lines that flip `indexDirty`, so it can't drift). Shares a new
`dispatchBucket` helper with the scan path (identical snapshot + null-handler reentrancy → the
once-per-batch contract holds). A.1-caliber: kills a per-flush allocation on the DOMINANT flush
shape for ~all components; provable-by-construction (strictly ≤ the scan), though below the
`performance.now()` floor to time per-op at the app's modest S — the payoff is GC-hygiene under
sustained interaction. **Verified**: new dedicated 400-trial flat differential vs the pairwise
`pathsOverlap` reference (exact + first-segment-ancestor + empty-path branches) + the existing
200+150 randomized differentials now running against the new dispatch + focused unit cases
(exact / ancestor-not-sibling / empty / mid-dispatch sibling-unsubscribe) + the `nestedPathCount`
invariant churn test + full render-pipeline tests (onFlushGate/onStateChange). Suite **132/132**,
eslint clean, advisor-designed.

#### 4b. Nested/trie slice (`nestedPathCount > 0`) — DEFERRED, harness-gated
When a dotted sub exists, descendants are possible → still needs the scan or the trie. Using the
trie opportunistically (`indexRoot && !indexDirty`) tensions against Round-13's lazy-trie win (it
only builds on multi-path flushes; a single-path-heavy nested bus never builds it, so "descendants
via trie when clean" falls back to the scan exactly where the win was wanted — and forcing an eager
build trades against the lazy win). That tension is a design question measurement must settle.
Only 3% of reads are nested here, so this is low-value until the harness proves a nested large-S
hot bus exists. Risk: medium. Prove: harness — nested large-S single-path workload.

### 5. TreeWalker batch node resolution at instantiate
`instantiateRecipe`/`instantiateLightRow` resolve each plan via `walkPath` — root-to-node
child-index walk **per spot** (O(spots × depth) pointer chasing per instance, × N rows).
Lit resolves all parts in **one document-order TreeWalker pass**: sort plans by path
(lexicographic on the index arrays, precomputed once in `prepareRecipe`), walk the clone
once, collect nodes as encountered.
Risk: medium (anchored spots resolve two comments; keep the two-phase resolve-then-install
contract). Prove: create-1k-rows bench, Perf `instantiate`/`spotInstall`.

### 6. List-scoped event delegation (architectural, bench-gated)
`installEventSpot` = one `addEventListener` per element per event type → 1k rows × @click
= 1k registrations. Solid delegates a fixed event set to the root by default; the Tier-3
`ScopeRecord` infra here already does scoped delegation. Option: when a recipe
instantiates as a **list row**, route modifier-free bubbling events (click, input,
pointer*, key*) through one listener on the list container (row → spot via WeakMap).
`.capture`/`.passive` spots keep per-element registration (not faithfully delegable).
Do **only if** the harness shows listener setup/memory matters at 1k–10k rows.
Risk: high-ish (semantics: once/self/stop across shadow boundaries). Prove first.

### 7. Micro (batch with any of the above)
- `PARSED_PATHS` ([utilities.js:173](utilities.js#L173)) grows unboundedly with dynamic list
  index paths (`items.4821.label`) — cap (e.g. 10k, clear-on-full) costs one size check.
- Flush-path snapshot allocs (`[...dirtySpots]`, `[...SCHEDULED]`, `[...subscriptions]`) —
  reusable scratch arrays where user code can't re-enter mid-loop; keep snapshots where
  observers fire synchronously (they can mutate).
- `renderView` allocates `new Map()` renderDeps + `Promise.withResolvers` per pass — the
  Map could be pooled per component (clear + reuse); withResolvers only when awaited.

## What was checked and is NOT a problem
- `Perf.mark` — properly gated (~1 branch inactive, compiled out in prod).
- Bare `${this.state.x}` re-render cost — same shape as Vue (re-run render fn + walk
  flagged dynamics with ref-equality skip). Parity, and `bind()`/spots beat Vue when used.
- Event dispatch cost — WeakMap lookup + shared fn; cheaper than Vue invokers.
- Recipe parse (`buildHTML`, `buildMarkerMap`, `getNodePath` O(siblings)) — once per
  template per page life; `static compile()` prewarm already exists.
- Keyed diff — LIS + moveBefore is state-of-the-art; sameKeyOrder fast path measured.

## Compiler seam (phase after)
`prepareRecipe` is a pure function of `strings` → `{html, meta}` is JSON-serializable.
A build step can emit precomputed recipes per call site (skip buildHTML + marker mapping
at runtime; first-mount only, recipes already cached). Win #5's ordered plans feed
straight into that output format. Nothing above blocks it; design later, after runtime
wins are banked and measured.

## Proof harness (prereq for 4–6, rebuild of Round-12 rig)
- Browser page (static server + CDP): js-framework-benchmark workloads — create 1k/10k,
  update every 10th, swap 2, select, clear — × {component rows, light rows, bind vs bare}.
  Side-by-side Vue 3 runtime page (vue.global.prod.js) for the target line.
- Node microbenches (no DOM): dispatchSingle variants, syncSubsByDiff skip, flush loop.
- In-page `Perf.report()` categories already cover renderView / patch / busFlush /
  instantiate / spotInstall.

**Status 2026-07-04**: ✅ #1 (onFlush gate) + ✅ #2b (PARSED_PATHS cap) shipped — these
exhausted the *provable-without-measurement* category. ❌ #2 rejected (assignState is the diff
path). #3 is NOT provable-safe: its payoff (skip dep re-sync when deps are stable) is a
measurement bet AND produces no behavior delta to assert (syncSubsByDiff already preserves stable
subs) — so it needs instrumentation, same dark-branch problem as #1 but without #1's clean
call-count signal. **Everything remaining (#3, #4, #5, and empirical confirmation of the #2
rejection) is gated on the harness.**
**Recommended order from here**: build the Round-12 browser+CDP harness → baseline vs Vue 3
runtime → #4 targeted dispatchSingle → #5 TreeWalker instantiate → re-measure → #3 if the profile
shows dep-resync cost → decide #6 (list delegation) → compiler-seam design.
