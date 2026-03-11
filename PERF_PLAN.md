# Arrow Performance Plan

Date: March 11, 2026

## Goal

Keep Arrow's public API intact while pushing toward:

- less than `3 KB` brotli for the shipped ESM build
- competitive `js-framework-benchmark` results
- lower GC pressure during create, update, and teardown paths

## Benchmark Source

- Latest official `js-framework-benchmark` release tag is `chrome145`.
- `chrome145` is keyed-only.
- `chrome142` is the latest release that still gives a clean keyed and non-keyed comparison set, so the local harness is pinned there for now.

References:

- <https://github.com/krausest/js-framework-benchmark>
- <https://github.com/krausest/js-framework-benchmark/releases/tag/chrome145>
- <https://github.com/krausest/js-framework-benchmark/releases/tag/chrome142>

## Current Guardrails

- `pnpm test`
- `pnpm typecheck`
- `pnpm build`
- size gate on `dist/index.min.mjs`

Current size baseline:

- raw: `7682 B`
- gzip: `3325 B`
- brotli: `3032 B`

The hard build gate is currently brotli because that is the project target. Gzip is still reported because it remains useful as a secondary regression signal.

## Benchmark Workflow

Use the official benchmark repo out-of-tree under `.cache/`.

Commands:

- `pnpm benchmark:setup`
- `pnpm benchmark:sync`
- `pnpm benchmark:smoke`
- `pnpm benchmark:core`
- `pnpm benchmark:breadth`
- `pnpm benchmark:run -- ...` for custom runs

`benchmark:setup` now downloads and unpacks the official `build.zip` for the
pinned benchmark tag so the broader preset can run against the same prebuilt
framework artifacts used by upstream release runs.

## Benchmark Presets

### Smoke

Small harness check:

- frameworks: local Arrow, published Arrow, Vanilla
- benchmarks: `01_`

### Core

Short iteration loop:

- frameworks:
  - `keyed/arrowjs-local`
  - `keyed/arrowjs`
  - `keyed/vanillajs`
  - `keyed/redom`
  - `keyed/lit`
  - `keyed/mithril`
  - `keyed/solid`
  - `non-keyed/arrowjs-local`
  - `non-keyed/arrowjs`
  - `non-keyed/vanillajs`
  - `non-keyed/redom`
  - `non-keyed/lit`
  - `non-keyed/vue`
  - `non-keyed/uhtml`
- benchmarks:
  - `01_` create rows
  - `05_` swap rows
  - `07_` create many rows
  - `09_` clear rows

### Breadth

Wider comparison before bigger refactors:

- all `core` frameworks plus:
  - `keyed/preact-hooks`
  - `keyed/vue`
  - `non-keyed/mikado`
- benchmarks:
  - `01_` through `09_`

## Baseline

First measured local comparison on `01_run1k` with a single iteration:

- `vanillajs-keyed`: `32.3 ms`
- `vanillajs-non-keyed`: `32.5 ms`
- `arrowjs-local-keyed`: `60.5 ms`
- `arrowjs-local-non-keyed`: `57.6 ms`
- published `arrowjs-keyed`: `99.9 ms`
- published `arrowjs-non-keyed`: `100.5 ms`

This means the current branch already cuts the older Arrow benchmark implementation roughly in half on row creation, but it is still well behind Vanilla.

## Working Hypothesis

The next wins are likely in:

- per-row allocation count during initial mount
- event binding overhead
- fragment/chunk bookkeeping during list creation
- reducing DOM operations that produce extra placeholder work

Reactivity scheduling is still important, but it does not look like the first-order bottleneck for `01_run1k`.

## Iteration Order

1. Keep the branch reproducible on modern Node with passing tests and a size gate.
2. Use the official benchmark harness for every meaningful perf change.
3. Keep the benchmark harness clean: hydrate release artifacts and clear stale results.
4. Attack create-path allocations first.
5. Re-run the `core` preset after each runtime change.
6. Only widen to `breadth` once a change survives correctness, size, and the `core` benchmark slice.

## First Runtime Pass

Start by removing avoidable benchmark-side allocations before deeper runtime work:

- single delegated row-action listener in the benchmark adapter instead of
  per-row select/remove closures
- hoisted `buildData` dictionaries
- then continue with core event binding and DOM creation hot paths inside Arrow
