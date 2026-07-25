# JS-Style Audit — core/indicator/movingIndicator.js — 2026-06-15
Source of truth: js-style skill · scanned 1 file · 2 confirmed findings (scanner: 0 candidates — both caught by the semantic pass).

## Summary
| Rule                               | Confirmed | Risk               |
| ---------------------------------- | --------- | ------------------ |
| class-based-design (factory→class) | 1         | confirm · refactor |
| anon-callback (rAF)                | 1         | confirm · trivial  |

## Findings — RESOLVED 2026-06-15

### 1 ▸ class-based-design — classes
- [x] movingIndicator.js — factory-of-closures → `MovingIndicator` class with `static create()`, `#pendingFrame` private field, prototype methods (`moveTo`/`hide`/`destroy`/`#writeMetrics`/`#onSnapFrame`). Public `movingIndicator(element, opts)` kept as a thin delegator (returns a shared frozen no-op handle when no element) so call sites are untouched. TODO at the old :28 removed.

### 2 ▸ anon-callback — functions
- [x] movingIndicator.js — rAF body extracted to `#onSnapFrame()`; call site forwards with the sanctioned block-arrow `requestAnimationFrame(() => { this.#onSnapFrame(); })`. Node-proven that a bare `this.#onSnapFrame` ref loses `this`; `.bind` forbidden. Codified in js-style + this skill's false-positive table.

## Rejected (noise — recorded so the next run doesn't re-litigate)
- (none — scanner returned 0 candidates)

## Notes
- `noop` (:13) is a correct named declaration — good. Naming throughout is clean.
- `options.x || 'default'` fallbacks are fine — no rule forbids them.
- **Scanner gap:** finding #2 slipped the regex because `requestAnimationFrame`/`setTimeout`/`queueMicrotask` aren't in the `anon-callback` method list. Candidate to widen.

## Verdict — DONE
Both findings fixed; scanner re-run = 0 candidates, IDE diagnostics clean. Behavior preserved (same `{moveTo, hide, destroy}` surface, same CSS-prop writes, same snap/rAF timing). Net rule outcome: a new js-style exception for deferred host callbacks (rAF/timers) — forward to a named method via a thin block-arrow; never `.bind`, never inline anonymously.
