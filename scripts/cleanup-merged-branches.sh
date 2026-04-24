#!/usr/bin/env bash
# Delete local + remote branches that have been merged into main.
#
# Safe: only touches branches whose PR is already MERGED per gh CLI.
# Never touches: main, any branch with an OPEN PR, any branch with no PR.
#
# Why: every preview branch becomes a phantom Vercel preview deploy target.
# At 10+ merged PRs/day, this accumulates fast. Run weekly or post-major-work.
#
# Run:
#   bash scripts/cleanup-merged-branches.sh          # dry run — lists what would be deleted
#   bash scripts/cleanup-merged-branches.sh --go     # actually deletes

set -e

DRY_RUN=1
if [ "${1:-}" = "--go" ]; then
  DRY_RUN=0
fi

echo "🧹 Cleanup merged branches (dry_run=$DRY_RUN)"
echo ""

# Sync remote refs first so we see the real state
git fetch --prune origin >/dev/null 2>&1

# Get list of all MERGED PRs (most recent 100)
MERGED_BRANCHES=$(gh pr list --state merged --limit 100 --json headRefName --jq '.[].headRefName' | sort -u)

if [ -z "$MERGED_BRANCHES" ]; then
  echo "No merged branches found."
  exit 0
fi

REMOTE_DELETED=0
LOCAL_DELETED=0

while IFS= read -r branch; do
  # Skip if somehow main got in here
  [ "$branch" = "main" ] && continue
  # Check if remote ref still exists
  if git ls-remote --exit-code --heads origin "$branch" >/dev/null 2>&1; then
    if [ "$DRY_RUN" -eq 1 ]; then
      echo "  would delete remote: origin/$branch"
    else
      echo "  deleting remote: origin/$branch"
      git push origin --delete "$branch" >/dev/null 2>&1 && REMOTE_DELETED=$((REMOTE_DELETED + 1))
    fi
  fi
  # Check if local branch exists
  if git show-ref --verify --quiet "refs/heads/$branch"; then
    if [ "$DRY_RUN" -eq 1 ]; then
      echo "  would delete local:  $branch"
    else
      echo "  deleting local:  $branch"
      git branch -D "$branch" >/dev/null 2>&1 && LOCAL_DELETED=$((LOCAL_DELETED + 1))
    fi
  fi
done <<< "$MERGED_BRANCHES"

echo ""
if [ "$DRY_RUN" -eq 1 ]; then
  echo "✋ Dry run. Run with --go to actually delete."
else
  echo "✅ Deleted $REMOTE_DELETED remote + $LOCAL_DELETED local branches"
fi
