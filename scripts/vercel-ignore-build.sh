#!/usr/bin/env bash
# Vercel ignoreCommand — tells Vercel whether to build this commit.
#
# Contract: exit 0 = SKIP the build, exit 1 = PROCEED with build.
# Vercel only invokes this on PR preview builds (main merges always build).
#
# Why: docs-only PRs (runbooks, session notes, eval reports) don't affect
# the deployed bundle. Skipping preview builds for them saves Vercel
# compute + deploy time + preview URLs cluttering the PR comments.
#
# Rules:
# - Skip if EVERY changed path is one of:
#     - .github/runbooks/**
#     - .github/workflows/** (CI config, not app code)
#     - docs/**
#     - *.md at repo root
#     - scripts/** (one-off ops scripts, never deployed)
# - Build otherwise.

set -e

# VERCEL_GIT_PREVIOUS_SHA is Vercel's idea of "the prior commit on this ref".
# If unset (first build on a branch), build to be safe.
if [ -z "${VERCEL_GIT_PREVIOUS_SHA:-}" ]; then
  echo "No VERCEL_GIT_PREVIOUS_SHA — building (first build on this ref)"
  exit 1
fi

CHANGED_FILES=$(git diff --name-only "$VERCEL_GIT_PREVIOUS_SHA" HEAD)

if [ -z "$CHANGED_FILES" ]; then
  echo "No changed files — skipping build"
  exit 0
fi

# Each file must match one of the skip-safe patterns. If ANY file falls outside
# them, we build.
NEEDS_BUILD=0
while IFS= read -r file; do
  if [[ "$file" == .github/runbooks/* ]]; then continue; fi
  if [[ "$file" == .github/workflows/* ]]; then continue; fi
  if [[ "$file" == docs/* ]]; then continue; fi
  if [[ "$file" == scripts/* ]]; then continue; fi
  # Root-level markdown (README, CONTRIBUTING, etc.)
  if [[ "$file" =~ ^[^/]+\.md$ ]]; then continue; fi
  # Anything else — we need to build
  echo "Needs build due to: $file"
  NEEDS_BUILD=1
done <<< "$CHANGED_FILES"

if [ "$NEEDS_BUILD" -eq 0 ]; then
  echo "All changed files are docs/scripts/workflows only — skipping preview build"
  exit 0
fi

exit 1
