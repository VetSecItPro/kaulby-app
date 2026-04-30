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
#     - *.md anywhere (not just repo root — covers src/**/*.md, e2e/**/*.md, etc.)
#     - scripts/** (one-off ops scripts, never deployed)
#     - CHANGELOG, LICENSE, .editorconfig, .nvmrc, .npmrc, .gitignore (repo metadata)
# - Build otherwise.
#
# NOTE: public/** is intentionally NOT in the skip list. Static assets in
# public/ ship via Vercel's deploy step; if we skip the deploy, the asset
# never goes live. The CI workflow's paths-ignore CAN safely include public/**
# because CI doesn't deploy.

set -e

# Always build the long-lived `sandbox` branch, regardless of changed files.
# That branch is the host for the Polar sandbox webhook URL, so its preview
# alias must reflect the latest env-var bindings even when the only commits
# are doc updates.
if [ "${VERCEL_GIT_COMMIT_REF:-}" = "sandbox" ]; then
  echo "On sandbox branch — building (skips skip-detection)"
  exit 1
fi

# Production deploys always build — never skip a release on a [skip preview]
# marker meant for PR work.
if [ "${VERCEL_GIT_COMMIT_REF:-}" != "main" ]; then
  # Per-PR commit-message override. Lets a dev push WIP work without
  # spinning up a Vercel preview every time. Conventions:
  #   [skip preview]   — skip this Vercel preview
  #   [skip vercel]    — synonym
  #   [wip]            — same intent
  CMSG="${VERCEL_GIT_COMMIT_MESSAGE:-}"
  if echo "$CMSG" | grep -qiE '\[(skip[ -]preview|skip[ -]vercel|wip)\]'; then
    echo "Commit message contains skip-preview marker — skipping build"
    exit 0
  fi

  # Branch-name override. wip/* and draft/* prefixes signal in-progress work.
  REF="${VERCEL_GIT_COMMIT_REF:-}"
  case "$REF" in
    wip/*|draft/*) echo "Branch '$REF' matches wip/draft prefix — skipping build"; exit 0 ;;
  esac
fi

# VERCEL_GIT_PREVIOUS_SHA is Vercel's idea of "the prior commit on this ref".
# If unset (first build on a branch), build to be safe.
if [ -z "${VERCEL_GIT_PREVIOUS_SHA:-}" ]; then
  echo "No VERCEL_GIT_PREVIOUS_SHA — building (first build on this ref)"
  exit 1
fi

# If the previous SHA is missing (typical after a force-push/rebase that
# orphaned it), fall back to building — git diff would error out here and
# we don't want to silently skip a real build.
if ! git cat-file -e "$VERCEL_GIT_PREVIOUS_SHA" 2>/dev/null; then
  echo "VERCEL_GIT_PREVIOUS_SHA ($VERCEL_GIT_PREVIOUS_SHA) not reachable — building"
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
  # Markdown anywhere — never lands in the bundle.
  if [[ "$file" == *.md ]]; then continue; fi
  # Repo metadata files.
  case "$file" in
    CHANGELOG|LICENSE|.editorconfig|.nvmrc|.npmrc|.gitignore) continue ;;
  esac
  # Anything else — we need to build
  echo "Needs build due to: $file"
  NEEDS_BUILD=1
done <<< "$CHANGED_FILES"

if [ "$NEEDS_BUILD" -eq 0 ]; then
  echo "All changed files are docs/scripts/workflows only — skipping preview build"
  exit 0
fi

exit 1
