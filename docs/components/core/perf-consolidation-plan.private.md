# Core Perf + Consolidation Campaign — tk:26 subtask plan (2026-07-14)

> ## ⟐ RECONCILIATION — 2026-07-16 (claude-main, opus)
>
> Re-verified every finding against the CURRENT working tree. Two things changed the
> board since 2026-07-14: (1) **grok-build shipped tk:29 + tk:30** (2026-07-15); (2) a
> **large uncommitted, off-board refactor** sits in the working tree — it split
> `template.js` (3492→2270) into `template/{spot,list,planner}.js`, added `events/settle.js`,
> relocated `utilities.js`, and rewrote `render.js`/`factory.js`. **All plan line numbers below
> are stale.** Tree is **167/167 green**. The refactor is **uncommitted and unattributed** —
> flagged, not chased.
>
> **PERF (the hard line — "not even a little lost"):** verified **deterministically** — diffed
> HEAD vs working tree, not wall-clock (a happy-dom microbench would be rAF-noise-dominated, and
> the named rerender-bench is gone). The render per-patch hot path is **materially unchanged**,
> confirmed at BOTH levels: the DRIVER (`renderPass` — `isPatchPass` skip, gated `withResolvers`,
> `renderDeps` Map, tracking window) AND the INNER loop (`updateTemplateSpots → updateSpot →
> syncSpotParts → patchSpot` + `Spot.handle`/`drain` dispatch) both match HEAD. The refactor only
> **relocated** the `Spot` class into `template/spot.js` (module move, perf-neutral); the
> `.bind`-elimination + indexed `syncSpotParts` + `patchSpot` single-path wins were **already
> banked in HEAD**, not landed here. tk:29 reactive-read is a **strict allocation reduction**
> (verified correct). Net: **perf-neutral-to-better, no regression.**
>
> This verdict is **runtime-independent by design** — it counts allocations / code paths from a
> HEAD-vs-tree diff, NOT wall-clock. That is deliberate: **happy-dom is not a valid perf oracle**
> (no real layout/paint, rAF-via-timer) — the old `0.097ms` rerender-bench numbers were happy-dom
> and must not be trusted as a browser reference. The refactor's DOM-mutation pattern is unchanged
> (same `patchSpot` → same DOM writes), so real-browser paint/layout cost is unchanged too.
> **Bundling:** production is **rollup-bundled** (`build:core` → `core.rollup.config.js`), so the
> `template/` module split **inlines to zero** load cost; dev serves raw ESM via import map
> (`client/index.html`), where the split adds ~3 extra core requests at load — negligible,
> localhost, dev-only. Caveat: the refactor **skipped the mandated bench gate** ⇒ confirm in a
> **REAL browser** before committing: `client/perf/perf.html` (`<perf-list-page>` in Chromium) +
> the framework-shootout core A/B (sanctioned tool, commits de591f4e / fbe2e06b), HEAD vs tree.
> Do NOT gate this on a happy-dom microbench.
>
> **Scope of this reconciliation:** the wave-1 EXECUTION tasks only — tk:29–35 + tk:37. The
> parked / harness-gated items were **not** re-verified (never ready): **X8** (re-entrancy proof),
> **X14** (dual-realm double-fire), **KNOWN-5** (TreeWalker batch), and all of **tk:36** (wave-2,
> ⛔ blocked on tk:28 harness). So "0 RESOLVED across the render/startup/write findings" is a real
> result over the checked set, not a claim that every campaign item was inspected.
>
> | Task | Domain | Status | Detail |
> |------|--------|--------|--------|
> | **tk:29** | reactive-read | ✅ **DONE + verified correct** | X1/X2/X4/X5 sound in both proxies (aliasing-safe; dep-tracking independent of the child cache); X3 correctly dropped. Skipped advisor gate produced **no defect**. |
> | **tk:30** | shutdown | ✅ **DONE + verified correct** | D1/D2 race guard faithful + `disconnect.test.js` genuinely exercises the reconnect race; D3/D4/D5/D8/D9/D10b all landed. |
> | **tk:31** | render R1 | ❌ **OPEN** | Still async, `withResolvers` re-minted per pass, `renderDeps` Map per pass, `whenRendered` eager (no accessor). The new `!whenRenderedResolver` guard has **no steady-state effect**. |
> | **tk:32** | render R2–R11 | ❌ **OPEN (11/11)** | Refactor implemented **none** of the R-series; landed a disjoint opt family instead. **R8** upgraded: confirmed dead-yet-undeleted (template.js:1056-1059). |
> | **tk:33** | startup | ❌ **OPEN (8 open · S11/S12 partial)** | S1/S3/S4/S5/S7/S8/S9/S13 open. **Surprise:** the refactor shipped the exact primitives 4 fixes need — `hasAnyKey` (S5), `getProto` (S13), `serializeSheet` (S11), the `runHook`+`isPromiseLike` guard (S1) — but **never wired them into the flagged sites**; each fix is now one wire away. S1's lifecycle "warm-path no-await" comment is **provably false** (applyStyles still `async`). |
> | **tk:34** | events | 🟡 **PARTIAL** | `settle.js` unification wired into **3/4 surfaces** (events/eventEntry/delegate). STILL OPEN: **E3 live bug** (hotkeys unwired → bare-thenable `.catch` TypeError + sink bypass), **E10 live bug** (`@click`+`@click.capture` collision), E1/E7/E8/E9 micro-opts. |
> | **tk:35** | reactive-write | ✅ **DONE (4/4 shipped)** | X6 07-16 (parsePath descent, 1.53×); X11/X12/X18 07-17 (raw-STATE guard + `Store.setOne` + channel memo — same-ref skip 91.8×, fresh-equal 7.8×, realm write 1.80×, Binding ctor 6.5× vs pre-fix; node figures). Regression guards: `benchmarks/reactive-hotpath.bench.js` + `benchmarks/store-write-guard.bench.js`. |
> | **tk:37** | wave-3 consolid. | 🟡 **PARTIAL** | The events settle-unification (E4–E6 material) is largely done by `settle.js`; realm/Lifecycle/SubscriptionEntry consolidations remain. |
>
> **Two live BUGS still present (highest priority, correctness not perf): E3 + E10.**
> Board split applied so open tasks stay honest — see per-task notes on the emP board.

**Goal**: maximize core/ performance across startup, shutdown, events, render, and reactive
updates — consolidate and simplify where possible, **zero performance loss tolerated**.
Five parallel domain scans (2026-07-14) produced ~50 findings; this doc + the emP board
tasks (tag `tk26`) are the execution plan. Umbrella task: **tk:26**.

**Provenance**: findings are agent-scanned with cited evidence, spot-verified, NOT yet
re-verified line-by-line. **The implementing session MUST verify each finding in place
before editing** — line numbers drift, and a finding that doesn't reproduce gets dropped,
not forced.

## Standing constraints (violating these is a defect)

- House js-style binding: no per-call closures/arrows, no .bind, named module functions,
  indexed loops + cached length, lazy `??=`, snapshots wherever user code can run
  mid-loop. Never-reject async boundary pattern (no try/catch except sanctioned error
  boundaries).
- **REJECTED, do not re-propose**: replaceState shallow-diff (see render-performance.private.md §2).
- **PARKED contract-sensitive**: delegate dispatch live-iteration. The sanctioned
  direction is the scratch-pool that PRESERVES snapshot semantics (E2/X8 below).
- Gain classes: `by-construction` (provably fewer ops/allocs — ships with tests +
  reasoning, no stopwatch needed), `needs-bench` (blocked on tk:28 harness),
  `perf-neutral` (consolidation; must not add hot-path indirection).
- Verify gate per task: full sweep `node --test viat/centralSite/client/components/core/**/*.test.js
  viat/centralSite/client/components/global/input/input.test.js
  viat/centralSite/client/components/global/ui-collection/ui-collection.test.js
  viat/centralSite/client/components/user/global-top-bar/pulldownOffset.test.js`
  (165 green at plan time) + eslint 0 new errors + re-render bench sanity (happy-dom
  rerender-bench: patch ~0.097ms / item 0.021 / reorder 0.046 / ifthen 0.039 — flat).

## Execution waves

**Wave 1 — by-construction wins + bug fixes (no harness needed).** Highest value density:
reactive read path, shutdown teardown, render dep-sync, render patch-pass, startup
fast paths, events fixes, reactive write path.

**Wave 2 — build the harness (tk:28), then the gated items**: TreeWalker instantiate,
render-queue unification, scratch pooling verification, bench-gated followups.

**Wave 3 — perf-neutral consolidations** (any time, lowest urgency): events entry/registry
unification, realm/observer unification, lifecycle promise laziness (med-risk, test-heavy).

Each board task body carries the full finding details (IDs S/D/E/R/X below map to the
scan agents' reports, parked in session Echo and reproduced condensed in task bodies).

## Domain summaries (headline findings)

### Reactive (hottest — the get trap ≈17 ops/tracked nested read)
- **X1** per-hop `joinPath` string alloc + WeakMap+Map double lookup on EVERY container
  read, both proxies → handler-local child cache w/ identity check. Highest-leverage.
- **X11** ✅ SHIPPED 07-17 `Store.set` equality reads through the proxy → `current === value` NEVER true
  for objects → full trapped deep-compare per write. Read raw STATE (`Store.setOne`, pathMap probe
  keeps the round-tripped-proxy identity skip).
- **X6** ✅ SHIPPED 07-16 `setValueAtPath` re-splits every path (`pop()` blocks the cache) → parsePath.
- **X8** re-entrancy PROOF: bus flush only reachable via queueMicrotask→masterFlush →
  scratch arrays safe across all dispatch snapshots (+debug assert).
- **X14** dual-realm components double-fire updateView/onStateChange per batch (onFlush
  route before drainSpots + global queue after) → unify on one pendingRenders queue.

### Render
- **R1** patch pass pays ~6 promise/closure allocs + ≥3 microtask hops for 100% sync
  work; `Promise.withResolvers` re-allocates EVERY pass (finishRender clears it) → sync
  patchPass fast path + lazy whenRendered.
- **KNOWN-3 + R4** dep re-sync churn is TWO call sites of one pattern (renderView tail
  + per-spot syncSpotSubscriptions) → one `syncSubsByDiffIfChanged` fix covers both.
- **R2/R3** double `realmForBinding` per Binding part per refresh; per-refresh realm
  re-resolution on List/Binding spots → resolve once at install, cache on spot.
- **KNOWN-5** TreeWalker batch node resolution (template.js:1932-1955, list.js:110-114) — harness-gated.
- **R10** drainSpots: a throwing drain() silently evicts remaining spots' patches — add containment.

### Startup
- **S1** `applyStyles` is async → warm path pays 2 promise allocs + ≥3 microtask hops per
  connect; the lifecycle comment claiming this is fixed is FALSE. (Team's own precedent:
  3 microtasks × 500 components ≈ 75ms.) Top startup item.
- **S3** upgradeShadowedProperties: ~80-120 proto descriptor lookups per construct for a
  per-class-static answer → ensureAccessorRescueMap.
- **S2** 6 eager Promise.withResolvers pairs per construct (~24 allocs), 5 re-armed per
  disconnect, mostly never awaited → lazy Lifecycle class (med-risk, wave 3).

### Shutdown
- **D1/D2** disconnect ALWAYS awaits a never-cleared pendingConnect (N async hops per
  subtree removal) + documented reconnect race that tears down a LIVE component →
  self-clear on connect settle + capture-await-recheck guard.
- **D3** child registry: O(N²) list teardown + per-connect closure (house-rule violation)
  → Map<tag,Set>.
- **D7** destroyed components mint 5 never-resolving lifecycle promises (semantic bug).
- **D8** registry id-drift LEAK pins components forever → store registration key on instance.

### Events
- **E3** hotkeys bypasses settle unification: bare-thenable handler → TypeError crash
  inside dispatch (latent bug) → route through settleEventResult.
- **E10-bug** @click + @click.capture on one element collide (eventName-keyed spot map):
  last spot fires twice, first handler never runs (pre-existing correctness bug).
- **E1** full combo string rebuild (array+sort+join+toLowerCase) on EVERY app keydown →
  single-key fast path (provably identical) + repeat cache.
- **E4/E5/E6 + D6** ~150 lines of triplicated entry/registry/sweep machinery → one
  SubscriptionEntry base + master-registry factory + callAndSettle + sweepEntrySet.
  (E5 fix rider: EventEntry abort branch breaks genuine `on('abort')` subscriptions.)

## Harness spec (tk:28 — gates all needs-bench items)

1. **Node microbenches** (no DOM, no CDN, quiet machine, many samples, compare min):
   dispatchSingle variants (flat/nested/trie-gated), syncSubsByDiff vs IfChanged,
   flush loop scratch vs spread, track() pool, hotkeys comboFromEvent, children
   registry Array vs Set at N=100/1k.
2. **Browser CDP rig** (rebuild of the Round-12 framework-shootout drive): local static
   server, js-framework-benchmark ops (create 1k/10k, updateAll, upd10th, swap, clear)
   × {component rows, light rows}, side-by-side Vue 3 runtime line. Playwright-driven,
   screenshots per playwright skill discipline.
3. In-page `Perf.report()` categories already exist: renderView / patch / busFlush /
   instantiate / spotInstall.
   ~30% variance on a loaded dev machine — framework-level deltas only; micro A/Bs go
   to the node benches.

## Post-campaign seam (out of scope, recorded)

Compiler seam: `prepareRecipe(strings) → {html, meta}` is JSON-serializable; a build step
can emit precomputed recipes per call site. KNOWN-5's ordered plans feed that format.
Design after runtime wins are banked.
