# Arrow Monorepo — Agent Guide

Use this file for repo-wide automation and release tasks. Package-specific docs guidance still lives in `docs/AGENTS.md`.

## Commit messages

- Use Conventional Commits for all git commit messages, for example `feat: ...`, `fix: ...`, `perf(core): ...`, or `docs: ...`

## Release automation

The release entrypoint is:

```sh
pnpm run release
```

It supports both interactive and non-interactive usage.

### Interactive

- `pnpm run release`
- `pnpm run release:next`
- `pnpm run release:dev`

### Non-interactive

Use these forms for agent automation:

```sh
pnpm run release -- --tag next --bump patch --yes
pnpm run release -- --tag dev --bump patch --yes
pnpm run release -- --tag latest --bump patch --yes
```

Rules:

- `latest` is only allowed from `main`
- `next` and `dev` can be created from non-main branches
- `latest` updates package versions in git, commits, tags, and pushes
- `next` and `dev` create and push only a git tag; the workflow sets publish versions from the tag at release time

Tag formats:

- `vX.Y.Z` -> npm `latest`
- `vX.Y.Z-next.<hash>` -> npm `next`
- `vX.Y.Z-dev.<hash>` -> npm `dev`

## Trusted publishing

Publishing is handled by `.github/workflows/publish.yml`.

- It uses GitHub OIDC trusted publishing
- It installs `npm@latest`
- It does not use an npm token
- It blocks plain `vX.Y.Z` releases unless the tagged commit is on `main`
- It publishes each package in its own job, with dependencies running before dependants
- `create-arrow-js` is unscoped and still needs its own npm trusted publisher configured to this repo/workflow

## Public package set

The automated release flow syncs and publishes:

- `@arrow-js/core`
- `@arrow-js/framework`
- `@arrow-js/highlight`
- `@arrow-js/hydrate`
- `@arrow-js/sandbox`
- `@arrow-js/ssr`
- `@arrow-js/vite-plugin-arrow`
- `@arrow-js/skill`
- `create-arrow-js`
