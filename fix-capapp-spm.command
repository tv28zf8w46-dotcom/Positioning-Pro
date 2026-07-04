#!/bin/bash
# ============================================================
# One-time cleanup: convert the ios/App/CapApp-SPM nested git
# repo (committed as an empty placeholder) into normally-tracked
# files, then commit & push. Uses your saved GitHub login.
# Double-click to run.
# ============================================================
set -e
cd "$(dirname "$0")"
echo ""
echo "Working in: $(pwd)"

# Remove the nested .git so the folder's files track normally
rm -rf ios/App/CapApp-SPM/.git

# Drop the empty placeholder (gitlink) from the index, then re-add real files
git rm --cached ios/App/CapApp-SPM >/dev/null 2>&1 || true
git add ios/App/CapApp-SPM
git add -A

git commit -m "Fix: track ios/App/CapApp-SPM as regular files (remove nested repo)"
git push

echo ""
echo "=========================================="
echo " Done. CapApp-SPM is now properly tracked."
echo "=========================================="
echo "Press any key to close."
read -n 1
