# Reactivity Architecture — flush / replacement / realms (2026-07-01)

Design + phased execution for pushing the reactivity core. Phases 1–4b SHIPPED (`db1167a8`, `96e94ee3`, `a7de8903`/`4e4bbf90`, `79f0ef7f`) + lazy-trie follow-up (`7b37ad52`). Open target: **Phase 5 — the flush→render junction** (see tracker `todo.code.private.md` § OPEN remainder).

## Pillars

1. **Trie-indexed bus** — `PathSubscriptions` maintains a segment trie mirroring `subs` (bijection enforced: `bucketFor`/`dropBucket` are the ONLY bucket create/delete paths, both index-paired). Index maintenance happens at the subscription-VOCABULARY boundary (bucket create/delete), not per-subscribe — dep re-syncs diff against live buckets, so steady-state subscribe/unsubscribe never touches the trie.
2. **Flush = match phase + dispatch phase.** Match: one trie walk per changed path (spine terminals = ancestor/exact subs; subtree terminals = descendant subs) → `Map<subPath, overlapping[]>`. Dispatch: iterate the `subs` snapshot in insertion order replaying the EXACT former per-bucket algorithm (same getValue timing, lazy bucket snapshot, first-overlap arg, multiPath replays) fed precomputed lists. `dispatchSingle` fast-path for `changed.length === 1` (dominant shape; replays unreachable with one path — direct pairwise test is optimal). `O(S×C)` → `O(C·depth + matches + S)`.
3. **`notifyAll()`** — the state-replacement primitive: one flag; flush runs `dispatchAll` — every bucket fired once with its own path. Replaces the caller-side "notify every subscribed path" idiom (the O(S²) generator). SEMANTIC NOTE (deliberate, tested): under notifyAll a multiPath subscriber fires ONCE at its own path — full-value replacement makes per-descendant replays redundant (keyed diff re-patches all rows in one pass).

## Shipped (Phase 1–2)

- `state/pathSubscriptions.js` — PathIndexNode (subtreeTerminals drives immediate prune; by induction reachable nodes always have a terminal below), collectOverlaps/dispatchChanged/dispatchSingle/dispatchAll, notifyAll, bucketFor/dropBucket (identity-guarded).
- `state/state.js` `replaceState` → `this.stateBus?.notifyAll()` (was: walk `subs.keys()` + notify each).
- `state/pathSubscriptions.test.js` (12, pure-node — bus is DOM-free): full contract (coalesce, both overlap directions, first-overlap identity, multiPath replay w/ cached value, segment boundary, '' path, mid-dispatch unsub/sub, notifyAll, trie prune/bijection) + **200-trial seeded-LCG equivalence vs a verbatim reference of the old pairwise algorithm** (fire-for-fire: id, changed-path arg, value, ORDER).

Bench (node, µs/flush; old = pairwise scan):
| scenario | old | new | × |
|---|---|---|---|
| S=500 C=1 | 15.0 | 14.1 | 1.1 |
| S=500 C=10 | 21.6 | 18.6 | 1.2 |
| S=2000 C=50 | 234 | 84 | 2.8 |
| S=500 C=500 | 236 | 71 | 3.3 |
| S=2000 C=2000 | 3543 | 298 | 11.9 |
| replaceState S=500 | 318 | 28 | 11.4 |
| replaceState S=2000 | 4972 | 113 | 44 |

## Phase 3 — `Store.replaceState()` (global/store reset) [SHIPPED 96e94ee3]

`store.proxy` wraps `store.STATE` at construction; a Proxy target is immutable → `globalState.STATE = {}` strands the proxy. **Identity-stable in-place replace** (globalState.js `Store.replaceState`):
1. `plainEqual` early-return (matches component replaceState).
2. Null-out existing own keys not in `next` (null-as-absent = the store's existing deleteProperty convention; hidden-class stable).
3. Assign `next`'s keys directly (bypass the set trap; no per-key notify).
4. `store.bus.notifyAll()`.
Zero proxy rebuild → the identity-keyed global render-proxy memo, `get global()`, and every captured `this.global` reference stay valid BY CONSTRUCTION. `proxyCache` kept as-is (identity-keyed: replaced children GC, reused children keep their proxy).
- Verified: pure-node globalState.test.js (7) + realm.test.js group J (component reading `this.global.<key>` re-renders after replaceState via drainGlobalRenders — StoreBus.onFlush is a no-op, so this is the reset render path).
- **Carry-down proven safe**: the `.state=` carrier's `forward()` early-returns unless `changedPath.length > sourcePath.length+1`, so notifyAll firing a carrier at its OWN path is a no-op; deep carry-down flows through `notify(deepPath)` → dispatchSingle/Changed, never notifyAll. global-dock ancestor-deep-write untouched (state-channel 17/17). `.state=${this.global...}` is unused anywhere today (grep-confirmed) — a global-carried subtree would re-merge via the parent's renderDep on the carried path, not the deep bridge; theoretical, no consumer.
- NOT done (advisor: zero-gain risk): unifying component `replaceState` to in-place — identity-swap is handled by `ensureRenderProxies` and touching it risks the carrier re-link path.

## Phase 4 — named per-component stores (USER-REFINED DESIGN)

**Core insight (user):** a named store is NOT a routing table — it is ADDITIVE, accessed under one NAMESPACE property: `this.stores.buttonStore.shared`. `this.state` (local) + `this.global` stay the defaults. ONE reserved name (`stores`) instead of one per store, so a store name can never collide with a component method/field in either direction — "longer but cleaner, keeps things exactly where you expect them." A distinct proxy per store → a distinct realm, so store paths cannot collide with local/global keys by construction (no key parsing, no routing). Stores are shared by reference (same `Store` in multiple components' `static stores` = a shared reactive slice). Declared via `static stores = { name: store }` (chosen so subclasses MERGE stores on extension).

### Phase 4a — property-access path [SHIPPED a7de8903, API revised → this.stores namespace 4e4bbf90]
`this.stores.<name>.path` tracked reads. Reuses all existing machinery; NO change to the hot `realmForBinding` binding-resolution path.
- `storeRealm(store)` (globalState.js): memoized `{ bus, read, write, sharedBus:true }`, twin of `globalRealm`. `sharedBus` generalizes render.js's old `realm.global` check — a renderDep on any shared bus (global OR store; no per-component `onFlush→updateView`) routes to `markRenderDirtyGlobal` → `drainGlobalRenders`. The local realm keeps `onFlush→updateView`.
- `makeStoreProxy(store)` (binding.js): per-store tracking proxy, twin of `makeGlobalProxy`, memoized on `store.proxy` identity (Phase 3 preserves it → survives store reset).
- `resolveStores()` (staticConfig.js): chain-merges `static stores` root→leaf via the existing `ensureMerged` → subclass inherit + extend for free.
- `get stores()` (base.js): lazy per-instance Proxy (`storesNamespace ??=`) whose TARGET is the merged stores table — `Object.keys(this.stores)`/`in` enumerate declared names for free. `StoresNamespaceHandler.get` resolves each read with the same split as `state`/`global` (tracking proxy while `renderTracking`, raw `store.proxy` otherwise); `set`/`deleteProperty` THROW (read-only — stores are static declarations). No per-name prototype defines → the old built-in-name guard is obsolete and deleted.
- Tests: state/stores.test.js (8) — render+react to `store.set`, re-render on `store.replaceState`, local/store non-collision, **store named after a component METHOD coexists** (the collision class the namespace removes), namespace enumerable + read-only, shared-store dual re-render, subclass merge, **disconnect tears down the store renderDep** (shared store outlives the component → `clearRealmUnsubs` sweeps the store realm; no detached-component leak).
- EDGE (noted, forward-only): `.state=${this.stores.shop.x}` as a carry-DOWN source works (the carrier forwards on `storeRealm.bus`); its REVERSE leg no-ops because `storeRealm` has no `component` (consistent with `globalRealm`, and `forwardSharedWriteToSource` guards `!carrier.sourceComponent`). A store subtree is not a two-way `.state=` source — matches "store writes go through the store API."

### Phase 4b — channel-enforced binding keys [SHIPPED 79f0ef7f — USER-REDESIGNED]
The factory idea was replaced by the user's cleaner call: **the key names its channel**, mirroring the property access it stands for (optional leading `this.` stripped):
- `bind('items')` — bare = LOCAL shorthand (unchanged; also keeps a local key literally named `global`/`stores` local — E/K5)
- `bind('state.a.b')` — local, explicit
- `bind('global.x')` — global (unchanged)
- `bind('stores.shop.items')` / `list('stores.shop.items', Row, keyFn)` — named store from `static stores`
- Any OTHER dotted first segment **throws at authoring** (`parseBindingChannel`, Binding ctor — ListBinding/CollectionBinding inherit). Enforcement was free: zero in-repo dotted-unprefixed keyed binds existed.
- Why this is D/E-safe despite being string-syntax: the channel vocabulary is FIXED (`state`/`global`/`stores`) — store names live UNDER the reserved `stores.` prefix (the 4a namespace insight applied to the key string), so a state key can never alias a store.
- `realmForBinding` (still the single reader) gains the store branch: resolve Store via `resolveStores(component.constructor)` at spot install; undeclared name throws with key + tag. Store-keyed spots need NO scheduler work — spot subs ride the store bus and drain in the same masterFlush.
- Two-way + data-bind stay LOCAL-ONLY (`realmForKey`; D/E).
- Tests: realm.test.js group K (5) + stores.test.js keyed (4: bind reacts / list reacts / replaceState-through-spot / path-less + undeclared errors). Suite 87 green.

## Invariants to preserve (test-guarded)

- Dispatch contract: at-most-once/first-overlap; multiPath replay w/ once-computed value (dispatchChanged); subs-insertion dispatch order; mid-dispatch snapshot semantics.
- Bucket↔trie bijection (ONLY bucketFor/dropBucket mutate either).
- '' path never enters the trie; overlaps only itself.
- masterFlush single-microtask coalescing + drainSpots/drainGlobalRenders ride-along.
