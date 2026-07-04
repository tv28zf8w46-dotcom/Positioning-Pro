#!/bin/bash
# ============================================================
# Recovery: remove the stray empty nested repo that GitHub
# Desktop created inside this folder, then push the REAL app
# to your Positioning-Pro repo. Uses your saved GitHub login.
# Double-click to run.
# ============================================================
set -e
cd "$(dirname "$0")"
echo ""
echo "Working in: $(pwd)"
echo ""

# 1. Delete the stray empty repo folder GitHub Desktop made
rm -rf "Positioning Pro Gabri's Mac"

# 2. Stop tracking it (it was committed as an empty placeholder)
git rm --cached "Positioning Pro Gabri's Mac" >/dev/null 2>&1 || true

# 3. Commit the cleanup
git add -A
git commit -m "Cleanup: remove stray nested repo folder created by GitHub Desktop" || echo "(nothing to commit)"

# 4. Push the full app and set upstream so future pushes are one word
git push -u origin main

echo ""
echo "=========================================="
echo " Done. Your full app is now on GitHub at:"
echo "   github.com/tv28zf8w46-dotcom/Positioning-Pro"
echo "=========================================="
echo "Press any key to close."
read -n 1
