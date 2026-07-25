# Sheet-merge — warm adoption 12→2 (tk:32 profile candidate)

## Goal
Perf (create @300). CDP profile: warm `applyStyles` adoption = 9.0ms self / 12 create-300 cycles — top attributed JS cost. Cause: `shadowRoot.adoptedStyleSheets = compiledStylesArray` pushes ~12 sheets (11 uwcBase modules + component sheets) into EVERY shadow root; per-root attach cost scales with array length. **Patch** (unit shape is right; composition of one frozen array changes).

## Contract to preserve
- Cascade order identical: adopted-sheet list order × rule order = total rule order. Merging N CONSECUTIVE sheets into one (rules concatenated in the same order) preserves the total order exactly → identical cascade + @layer precedence (first-declaration order unchanged).
- `compiledStyles` (Map) stays UNMERGED — forkStyleMap / hasStyle / injectLightStyles / addStyle / removeStyle / themeStyles all consume per-key sheets. Runtime fork drops back to individual-sheet adoption (slow path, correct).
- Opt-out (`static styles = { 'uwc.reset': null }`) → entry skipped before partitioning (unchanged).
- Subclass override of a framework key → owner flips to subclass in place → that slot leaves the framework partition, splitting the run; each consecutive run merges independently → order still exact.
- Constructed sheets can't contain `@import` (replaceSync drops it) → cssRules serialization is lossless. Same serialization already trusted by reLayer/buildScopedSheet.

## New design
- `serializeSheetRules(sheet)` — consolidate the 2 inline rule-serialize loops (reLayer, buildScopedSheet) + reuse for merging.
- Global merged-run cache: `Map<runKey, CSSStyleSheet>`; runKey = per-sheet numeric ids (WeakMap registry) joined. Framework module sheets are module-lifetime singletons → cache is bounded (~1 entry in practice); ONE merged sheet object shared by every class/root keeps the browser's shared-contents optimization.
- `compileStyles`: mark each slot `frameworkOwned` (owner proto === HTMLElement); build `array` by walking slots in order, accumulating consecutive frameworkOwned CSSStyleSheet runs → run of 1 passes through, run of N ≥ 2 → cached merged sheet. Everything else pushes as-is.
- Consumers (`applyStyles` warm, `applyStylesCold`) unchanged.

## Cutover
Single flip inside compileStyles. No dual path.

## Verify
- `node --test` styles tests + full core sweep; eslint touched paths.
- Shootout @300 live Chrome: create/append/clear min vs standing 2.70/3.10/1.00; light columns unchanged.
- Advisor pass on the diff (task-note requirement).

## Out of scope
walkPath / subscribeRenderDeps / R-items (separate passes).

## Outcome (measured)
Live Chrome CDP: warm applyStyles self 9.0ms → 1.5ms per 12 create-300 cycles — target killed at the profile level. Wall-clock create-300 flat (min 2.70 pre and post): the freed time was absorbed by the larger costs the old profile under-attributed — PathSubscriptions ctor 14.6ms self + GC 10.6ms. KEEP: profile-proven, 12→2 adoption verified live, by-construction cascade preservation, 5/5 contract tests. In-page create-only instrument (min-of-30 after 5 warmups): min 2.70 / p25 3.00 / p50 3.10 — the before-number for the next unit.

---

# Unit 2 — renderDep Set channel (kills the Subscription-per-dep storm)

## Goal
Perf+memory (create @300). Post-merge profile: PathSubscriptions ctor 14.6ms self (top JS node), GC 10.6ms, subscribeRenderDeps ~3ms. Per 300-row create the local renderDep wiring allocates 300 × (3 Subscription + ~3 bucket Set + 1 submap Map + 1 ctx obj + 2 spreads + bus pending Set) ≈ 2 700+ heap objects that all die at clear. **Rewrite** of the local-realm renderDep channel: these subscriptions are structurally degenerate — same handler (markRenderDirty), same target (the component), once-per-batch, on a bus that is 1:1 with the component — so they need NO Subscription objects and NO buckets.

## Contract to preserve
- A local state write overlapping any renderDep flips templateBuilt/renderDepDirty BEFORE onFlush → updateView (dispatch runs before onFlush today; the new match hook runs at the same point).
- Overlap semantics identical to buckets: exact, dep-is-ancestor (changed 'a.b' hits dep 'a'), dep-is-descendant (changed 'a' hits dep 'a.b'), '' edge. Flat-deps fast path = two O(1) Set probes; any dotted dep present → pathsOverlap scan of the (small) dep set.
- notifyAll (replaceState) marks dirty when any renderDep exists.
- Once-per-batch: flag idempotent + short-circuit on first hit — same effective coalescing.
- Re-sync diff on every render pass (adds/removes) with zero allocation when unchanged; disconnect clears the channel exactly where clearRealmUnsubs(renderDepUnsubs) clears the legacy one; reconnect re-mints on first render.
- Global realm (shared bus — no per-component identity) and private realm keep the legacy Subscription route through renderDepUnsubs unchanged.
- A component with renderDeps but ZERO bucket subscriptions must still dispatch: the match hook is called OUTSIDE flush's `subs.size` gate (today such a component can't exist since renderDeps ARE bucket subs — the gate must not orphan the new channel).
- Value resolution: renderDep handlers ignore the bus-passed value, so skipping getValue for pure-renderDep paths is observably free (per privateState.js note).

## New design
- Base PathSubscriptions: `pending`/`subs` become LAZY (null until first notify / first bucket) — bus construct allocates ZERO collections. `matchRenderDeps(replaceAll, changed)` no-op hook called in flush before the subs-gated dispatch.
- ComponentStateBus: fields `renderDeps = null` (lazy Set) + `nestedRenderDepCount = 0`; `syncRenderDeps(paths|null)` (mint/diff/clear), `clearRenderDeps()`, `matchRenderDeps` override with the two-probe flat fast path + pathsOverlap scan fallback.
- render.js subscribeRenderDeps: local realm (realm.bus === this.stateBus, !sharedBus) routes to syncRenderDeps; other realms keep syncSubsByDiff; the two [...spread] snapshots become for…of (KNOWN-3 precedent).
- lifecycle.js handleDisconnect: `this.stateBus?.clearRenderDeps()` beside clearRealmUnsubs.
- `pathsOverlap` imported into state.js from utilities.js (already exported there) for the ComponentStateBus scan.

## Cutover
Single flip — no dual path for the local realm. renderDepUnsubs stays for global/private realms only.

## Verify
- New unit tests: flat hit/miss, ancestor/descendant dotted overlap both directions, notifyAll, resync add/remove, disconnect clear + reconnect re-mint, zero-bucket-still-renders, global dep still routes legacy.
- Full core sweep + eslint. In-page instrument before/after (min-of-30): before = 2.70 min. CDP re-profile: PathSubscriptions ctor + GC self-time deltas.

## Out of scope
walkPath; scheduler R10; template R-items.

## Outcome (measured)
CDP: `PathSubscriptions` ctor 14.6ms self (#1 JS node) → GONE from the top-24; `subscribeRenderDeps` 3.0ms → gone (`syncRenderDeps` 1.1ms). 5/5 channel tests. Wall-clock create-300 flat again (2.70 → 2.80, noise): an in-page phase decomposition proved why — `setItems` sync 0.00ms, the two-microtask flush cascade 3.20ms min, the `whenRendered` await 0.00ms. **The whole op lives inside the flush cascade**; JS-node wins there are being absorbed by GC + native DOM, not by another JS node. KEEP: profile-proven, ~2 700 fewer heap objects per create-300, contract fully covered.

---

# Unit 3 — walkPath → pre-order slot resolution

## Goal
Perf. Post-channel profile: `walkPath` (planner.js) 4.8ms self = the #1 remaining JS node. Per instantiation each plan walked a child-index path from the clone ROOT — a live-`childNodes` hop per segment per plan per row. **Rewrite** of the resolution mechanism (patch to its callers).

## Contract to preserve
`cloneNode(true)` preserves the exact node sequence; slots are computed on the FINAL recipe fragment (post attribute-strips — attribute removal never changes node count or order); every plan family resolves BEFORE any anchored install mutates the tree.

## New design
Parse time (`assignResolveSlots`, once per template literal): TreeWalker `SHOW_ALL` enumeration assigns every node a pre-order index; pass A stamps each plan's raw target index (`nodeSlot` / `startSlot` / `endSlot`), unique indices sort into `recipe.resolveTargets`, pass B rewrites each stamp to its position in that array (duplicate targets share a slot). Instantiation (`resolveRecipeNodes`): ONE TreeWalker sweep, early-exit after the last target. `resolveSpotNode` deleted; `walkPath` un-exported (recipe-internal).

## Outcome (measured)
`walkPath` 4.8ms → GONE (native `nextNode` 1.7ms replaces it); `templateHtml` + `installSpotFromPlan` also left the top-20. **The JS self-time table is now flat** — top JS node is `materializeInstanceState` at 2.2ms/12cy. 235/235, eslint 0.

---

# Unit 4 — R-item sweep + R10 containment

R2 (double `realmForBinding` per Binding part → one resolution serving both dep-record and read) · R3 (`spot.realm`/`realmPath` cached at install on BindingSpot + ListSpot — callsite-constant) · R5 (ClassListSpot static literals pre-split at install, no per-refresh regex) · R7 (ifThen fallback `branchNodes` Map now lazy) · R8 (confirmed-DEAD ClassList ATTR branch DELETED with its null-component `applyClassListItems` path) · R9 (`ensureRenderProxies` consolidated into binding.js, `resolveTwoWaySourceValue` ≡ `resolveBindingValue` deduped; `TrackingFactory` moved after its handler classes so every class reference points backward) · R11 (`BindingSpot.drain` releases `pendingValue` after patch — no large value pinned to the next handle).

**R10** (robustness, not perf): per-iteration `try`/`catch` → `queueAsyncError` in BOTH flush-pipeline loops (`masterFlush`'s bus loop and `drainSpots`). Both clear their queue BEFORE looping, so one throwing handler previously evicted every remaining bus's flush / spot's patch AND skipped the `drainSpots`/`drainGlobalRenders` tail. 2 new tests prove siblings still drain, the batch is consumed (no re-drain loop), and the throw still surfaces through the sink.

---

# Campaign result @300 (min|p50 ms, Lit skipped)

| op | before | after | Vue 3 |
|---|---|---|---|
| create | 3.50 | **2.50\|3.10** | 1.20\|1.30 |
| append | 3.70 | **2.80\|3.00** | 1.60\|1.70 |
| clear | 1.40 | **0.90\|1.00** | 0.10\|0.20 |
| updateAll | — | **0.20\|0.40** | 0.50\|0.60 |
| removeHalf | — | **0.60\|0.70** | 0.30\|0.30 |

UWC-full now BEATS Vue on updateAll (0.20 vs 0.50). Light strategies unchanged and still ahead of Vue across the board (`list()` create 0.80 vs 1.20). Gates: 235/235 tests, eslint 0 errors.

## Where the remaining create gap lives (honest)
Not in a JS node any more. Per 12 create-300 cycles: `(program)` + GC ~10.4ms + native DOM ~16ms (cloneNode 3.4, replaceChildren 3.9, insertBefore 1.4, attachShadow 1.0, nextNode 1.7) — the custom-element + shadow-root + constructable-stylesheet floor Vue does not pay. Closing further means attacking the FLUSH CASCADE shape (the two-microtask hop the phase decomposition exposed) or the per-row shadow root itself — an architecture question, not a micro-optimization.
