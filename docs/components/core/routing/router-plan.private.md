# Core Layered Router — move URL routing into UWC core

## Context

Routing today is app-level: `viat/centralSite/client/modules/urlRouter.js` (376 lines, proven mechanics) writes 8 hard-coded `route*` keys into `globalState`, and AppView hand-wires it (route table, start timing, activePage sync). We want routing to be a **core framework capability** so every UWC app gets it by default: a generic `Router` class in `components/core/routing/` that owns its **own reactive store** (`Store.create()`, no globalState pollution), with **layered route registration** — a small default layer for fast public boot, plus lazily-loaded higher-priority layers (login loads a user router layer; logout removes it; same URL resolves per-layer with fallthrough). `AppShell` (exists: `components/global/app-shell/app-shell.js`, AppView's base) becomes the routing host with a generic active-view reflection hook. **Clean cut**: delete urlRouter.js, migrate all 8 consumers, zero legacy keys.

User decisions: ① clean-cut migration ② BOTH `static routes` (declarative) and imperative config/layers — the login/logout dynamic-router scenario is a hard requirement ③ AppShell owns a generic page-switching hook. Implementation will be **delegated to a nexus subagent** with this plan as the spec.

## Architecture

ONE `Router` engine (single popstate listener + single capture-phase link interceptor, `handleEvent` pattern) holding a **priority-ordered stack of RouteLayers**. Resolution walks layers by priority DESC (tie: later-added wins), routes in declaration order within a layer, first match wins, no match → next layer (fallthrough), exhausted → first non-null layer fallback. `addLayer`/`removeLayer` re-resolve the current URL immediately (started → `dispatch`, else → `prime`). Same-name `addLayer` = wholesale replacement. Lazy modules reach the live router via `Router.primary` (set in `start()`, `??=` first wins, cleared in `stop()`).

Port urlRouter mechanics **verbatim** (don't redesign): trimSlashes/normalizePath, compileRoute (`:name` → `([^/]+)` anchored regex, decode on match/encode in urlFor), buildQueryString (sorted, empties dropped), toAppPath root-strip, the full link-interception bail ladder (modifiers, download, rel=external, `data-route-passthrough`, cross-origin, unmatched), pushState-only-on-URL-change, replaceState fallback redirect in dispatch. Convert the 2 arrow class fields (`handlePop`/`handleLinkClick`) to tier-1 `handleEvent` dispatch per house callback ladder.

## New core files

### `components/core/routing/router.js`
Imports: `import { Store } from '../state/globalState.js';` (core = relative imports only, no `webcomponent` specifier). No CSS → zero rollup config changes.

```js
export const ROUTER_CONFIG = { root: '/', interceptLinks: true, store: null, routes: [], fallback: null };
export const routerStore = Store.create();   // module singleton components bind
export class RouteLayer { constructor(name, config = {}, sequence = 0) }  // name, priority(0), sequence, routes[], fallback|null
class RouterSubscription { unsubscribe() }   // returned by on()
export class Router {
  static primary = null;  static create(config)  static is(value)
  constructor(config)     // merge ROUTER_CONFIG; store = config.store || routerStore; if routes/fallback → addLayer('default', {…, priority: 0}); ONLY the ctor default layer auto-fallbacks to routes[0]
  handleEvent(domEvent)   // popstate → dispatch(currentPath()); click → handleLinkClick
  // layers
  addLayer(name, { routes = [], fallback = null, priority = 0 })  // upsert (re-stamps sequence), sortLayers(), refresh(); returns RouteLayer
  removeLayer(name)       // → sortLayers(), refresh(); returns boolean
  getLayer(name) hasLayer(name) sortLayers() resolveFallback()
  refresh()               // started ? dispatch(currentPath()) : prime()
  // resolution (urlRouter signatures preserved)
  toAppPath(p) currentPath() currentQuery() matchPath(path) findById(id) findByPath(path) resolve(target) urlFor(target, params, query)
  // lifecycle/navigation
  prime()                 // resolve current URL → publish store; NO history writes, NO listeners; idempotent
  start()                 // idempotent; Router.primary ??= this; popstate + link listeners (listener = this); dispatch(currentPath())
  stop()                  // remove listeners; if primary === this → primary = null
  navigate(target, params = {}, query = {})  replace(…)  dispatch(path)
  notify(route, params, query)  publishState()  on(handler)  off(handler)
}
```

**Store publish spec (`publishState`)** — ONE `store.set(update)` per notify, 3 passes:
1. **Stale-clear**: previous publish's custom keys absent on the new route → `null` (never delete). Route A has `filter`, route B doesn't → `filter: null`.
2. **Custom spread**: all route-entry own keys not in `RESERVED_ROUTE_KEYS = Set('id','path','params','query','layer','activeView','layerName','paramNames','regex')` (viat: view/section/filter).
3. **Core keys last (win collisions)**: `id`, `path` (= currentPath(), app-relative location), `params`, `query`, `layer` (= route.layerName), `activeView` (= `route.view || route.section || route.id || ''` — the proven chain that keeps section-less detail routes working).
Track `publishedCustomKeys` between publishes. Dev-warn (defaultLogger) on reserved-key collision at compile. Store's structural-equality `setOne` guard suppresses no-op notifies (prime→start double-publish is silent).

### `observeStore` — fill the framework gap (`core/state/subscriptions.js`)
Components have no auto-cleaned callback observer for **named stores** (the detail pages' `observeGlobal(['routeActiveView','routeParams'], handleRoute)` pattern needs one). Add, following `observeGlobal` (:105) as parity template:

```js
observeStore(storeOrName, keys, callback, options?)  // options { immediate, once } — superset of observeGlobal
unobserveStore(storeOrName, key)
clearStoreObservers()                                 // disconnect sweep
```
- Resolve name via `resolveStores(component.constructor)` (`attrs/staticConfig.js:60`, no import cycle); `Store.is()` instance passthrough; undeclared name → throw with component tag (mirrors template.js bind error).
- Reuse `StateKeyObserver`; callback `(next, previous, changedPath)` with component-`this` (bare method refs work).
- Cleanup: `this.storeUnsubs = Map<Store, ComponentSubscriptionTracker>` (per-store — tracker buckets by path, flat map would collide same-named keys across stores).
- Wiring: `storeUnsubs = null;` field in `base.js` (~:584, beside `globalUnsubs`); `this.clearStoreObservers();` in `lifecycle.js` after `globalUnsubs?.clear()` (:198). Prototype fold at base.js:839-851 picks the exports up automatically.
- Add `static is(value)` to `Store` in `globalState.js` (house rule).

### Public surface (`core/index.js`)
`export { RouteLayer, Router, ROUTER_CONFIG, routerStore } from './routing/router.js';` — the ONLY build wiring (rollup single-entry follows the import graph).

## AppShell = routing host (`components/global/app-shell/app-shell.js`)

```js
static routes = null;          // subclass declares array → arms routing (leaf wins wholesale, no array merge)
static routerConfig = null;    // optional { root, interceptLinks, fallback, store }
static stores = { router: routerStore };
router = null;
ensureRouter()                 // both statics null → null (preview harness: ZERO change); else Router.create({...})
onConnect()                    // reflectViewport (existing); router → prime() + observeStore('router','activeView', this.reflectRouteView, { immediate: true })
reflectRouteView(view)         // this.dataset.routeView = view / removeAttribute — decoration doctrine data-* attr; CSS :host([data-route-view='x'])
onMount()                      // existing notify wiring; this.router?.start()  — onMount gates on descendants rendered, replacing app.js's hand-rolled whenRendered awaits
onDisconnect()                 // existing teardown; this.router?.stop()
navigate(target, params, query)  // passthrough or null
```
`prime()` in onConnect = deep links paint the right page on **first** render (improvement over today's late-start swap).

## Migration map (all under `viat/centralSite/client/`) — clean cut

| File | Edits |
|---|---|
| `modules/urlRouter.js` | **DELETE** (sole importer: app.js) |
| `modules/app.js` | Drop URLRouter import + `router =` field (:627) + `static state activePage` (:584). ROUTER_CONFIG (33-130) → `const APP_ROUTES = […13 entries, order preserved…]` + `static routes = APP_ROUTES;`. onConnect: `observeGlobal('routeActiveView', syncActivePageFromGlobal)` → `this.observeStore('router', 'activeView', this.handleActiveViewChange)` (NO immediate — no spurious boot fetch/scroll). Rename sync → `handleActiveViewChange(view, previousView)`: keep scroll reset + wallet-re-entry `fetchAccountForWallet()`. `handleDockSelect` **unchanged** (findById / current?.section re-tap guard / navigate — AppShell supplies `this.router`). render(): computed `is-page-` class → static `class="shell-page"`; fix the stale mount/unmount comment (:1736) — pages stay mounted, CSS-hidden. onRender: keep setScrollLockTarget; delete dashboard awaits + router.start() + re-sync; drop `async`. Keep every `super.onConnect/onMount/onDisconnect()` — the router rides them. |
| `modules/app.css` (:64-72) | `.shell-page:not(.is-page-X) > tag` → `:host(:not([data-route-view='X'])) .shell-page > tag { display: none; }` (7 pages; load css-style skill first) |
| `transaction-detail-page.js` (:93-107) | `static stores = { router: routerStore };` + `this.observeStore('router', ['activeView','params'], this.handleRoute, { immediate: true });` (drop manual `handleRoute()` call). Guard `this.stores.router.activeView !== 'transaction'`; read `this.stores.router.params?.id`. |
| `account-detail-page.js` (:101-116) | Same pattern; guard `'account'`; `params?.address`. |
| `accounts-list-page.js` (:74-86) | Same; guard `'accounts'`; `pageFromParams(this.stores.router.params)`. |
| `explorer-page.js` (:110-121) | Same with `['activeView','filter']`; `setView(this.stores.router.filter || 'all')` (`||` absorbs null-clear). |
| `global-dock.js` (:72-74) | `observeStore('router', 'section', this.syncActiveFromRoute, { immediate: true })` + named method `syncActiveFromRoute(sectionId) { this.state.dock.activeIndex = sectionId || ''; }` (kills inline arrow; section-less detail routes still blank the rail). |
| `global-top-bar.js` (:74-76) | `observeStore('router', 'view', this.handleRouteChange)` + named `handleRouteChange() { this.applyScrolled(false); }` (no immediate). |
| `wallet-onboarding.js` (:47-64) | `observeStore('router', 'id', this.handleRouteChange)` bare ref; `currentRouteId()` → `this.stores.router.id || ''`; WALLET_REQUIRED_ROUTES unchanged. |

**Invariant sweep**: `grep -rn "routeActiveView|routeSection|routeFilter|routeParams|routeQuery|routePath|routeId|routeView|URLRouter|urlRouter"` over `client/` = zero hits (code AND comments).

## Tests (`node --test`, happy-dom; copy harness header of `core/state/tests/stores.test.js` — register happy-dom BEFORE dynamic core import, stub fetch)

- `core/routing/tests/router.test.js` — use private `Store.create()` via `config.store` (never the singleton): ① compile/match/urlFor round-trip incl. encoded params, slash normalization, non-root `root` ② layer precedence + tie-break + findById shadowing ③ add/remove re-dispatch flips store `activeView`, URL unchanged ④ fallback fallthrough vs explicit layer fallback capture ⑤ stale-field null-clearing + reserved-key protection ⑥ activeView chain (view||section||id) ⑦ prime() = store published, location untouched, no listeners ⑧ navigate pushState-only-on-change; **synthetic** `PopStateEvent` dispatch (happy-dom `history.back()` doesn't emit) ⑨ link-interception bail ladder ⑩ start/stop idempotence + Router.primary.
- `core/state/tests/observeStore.test.js` — name resolution, undeclared-name throw, instance passthrough, callback shape + this, immediate/once, multi-key, per-store unobserve isolation, disconnect auto-sweep, reconnect re-subscribe. Regression: existing `core/state/tests/*.test.js` stay green.
- Manual QA (`pnpm run centralSite`): deep-link `/tx/<id>/` first paint, dock highlight + wallet re-tap refresh, explorer filter routes, back/forward, `data-route-passthrough`; preview harness (`client/preview/`) must boot routeless + warning-free.

## Execution order (nexus subagent runs this; plan = its spec)

0. Copy this plan into the repo as `viat/centralSite/client/components/core/routing/router-plan.private.md` (house rule: plans live in-repo, `.private.md`); track via emP task.
1. Load skills: uwc, js-style, js-comments, errors-handling (css-style before app.css).
2. `core/routing/router.js` (port + layers + publishState + handleEvent).
3. Core edits: globalState.js `Store.is` · subscriptions.js observeStore trio · base.js `storeUnsubs` field · lifecycle.js sweep line · index.js export.
4. Both test files; run + regression suite.
5. AppShell rewrite; verify preview harness unchanged.
6. app.js + app.css migration.
7. 6 component consumers.
8. Delete urlRouter.js; grep sweep.
9. `eslint --fix` all touched + diff the autofix; js-style-audit the new core files.
10. Manual QA; optional `pnpm run build:core` (dist not the live import path).
11. **Sync `~/.claude/skills/uwc/SKILL.md`** (mandatory house rule): new "Routing" section — Router/RouteLayer/routerStore exports, layer stack + Router.primary lazy pattern, publish shape + null-clear + reserved keys, observeStore beside observeGlobal, AppShell static routes/data-route-view, data-route-passthrough.

## Risks

- happy-dom popstate fidelity → synthetic events only (spec'd).
- prime() first-paint change is **intended** (deep links no longer flash wallet); boot-screen `bootComplete` gating untouched.
- Cleared custom fields publish `null` (was `''`) — all migrated sites use falsy checks; contract documented in skill.
- Two connected routed AppShells would contend for primary/interception — documented invariant, out of scope.
- Logout on a user-only URL replaceState-redirects to fallback (spec'd; "keep URL, show fallback view" = model a catch-all route in the default layer).
