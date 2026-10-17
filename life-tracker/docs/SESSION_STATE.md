# Session checkpoint

Updated: 2026-10-17 UTC
Current task: read-only #858 structural Calendar cold-start audit, conditional React.lazy/Suspense reveal A/B.

## Verified baseline
- Stable Scratch Preview v0.29.7 `perf/858-startup-diagnostics-20261017@34ac29ed0790ea796c9d350c9da2796b2ab29e7a` remains unchanged; canonical #39044763288 and trusted CI-first Preview #39044882214 SUCCESS. No dev/main/Production/1.0 approval; #858 open.
- [Critical-path CI #39048530590](https://github.com/carlers/mosaic-life-tracker/actions/runs/39048530590) SUCCESS. Under same synthetic cached-PWA mobile CPU/network conditions, 0/25/1000 tasks, n=3, DB ready around 160–184ms, app-shell module ready around 144–153ms, Home mounted around 492–517ms. DB ready -> Home mounted **333–335ms** across all tiers and offline/slow-online. 1000 online Home owner-data-ready p50 703ms, first task DOM by Playwright 753ms. React effects in same flush mark child before parent; small negative Shell->Home deltas do not mean reverse mounting.
- React official Suspense docs state it reveals suspended content in 300ms batches. React GitHub issue #36569 (unconfirmed) reports a preloaded React.lazy route delaying content commit ~300ms. This is an unusually good causal hypothesis for the observed invariant, **not proven** before paired A/B.

## Active A/B design (diagnostic-only)
- Isolated `chatgpt/858-suspense-reveal-ab-20261017` contains both the original `React.lazy` Home route and a direct-rendered already-preloaded HomePage module selected by a test-only global flag.
- `src/lib/homePreload.ts` shares a module-ready snapshot/subscribe function for the variant only; same HomePage code, UI, indexed DB, AppDataShell, AuthProvider, PWA, CSS and network conditions. The direct variant can show the same fallback without using Suspense to reveal the loaded page. Not a shipped implementation (error/retry behavior requires design).
- Browser lab `tests/e2e/startup-suspense-reveal-ab.spec.mjs`: interleaved 0/25/1000 task fixtures, 2× CPU, offline vs slow-online, n=3 per variant/mode; original v0.29.7 code and direct variant in **the same disposable production-mode build**, Appwrite held. Tests preserve task visibility and mounted calendar.
- Run focused CI, experimental lab; compare within-run Home mount/owner data/first-task DOM p50,p90 and FCP, identify regressions; if accepted, plan production-safe route state/error handling with unit/browser/401/login/offline/device gates.
- No module, schema, backend, version, dev/main or Preview changes are authorized by this diagnostic. Security #936 and compatibility #914 remain independent pre-1.0 gates.
