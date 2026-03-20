#!/bin/sh

set -eu

cd "$(dirname "$0")/../.."

corepack enable
corepack prepare pnpm@10.14.0 --activate
pnpm install --frozen-lockfile
pnpm --filter @arrow-js/docs build
