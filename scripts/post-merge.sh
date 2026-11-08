#!/bin/bash
set -e
pnpm install --frozen-lockfile

# Database changes must be applied explicitly after the owner verifies which
# DATABASE_URL target is configured. Never mutate a populated database during
# post-merge setup; use the tracked, guarded migration command when approved.
