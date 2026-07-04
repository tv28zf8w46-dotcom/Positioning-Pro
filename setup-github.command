#!/bin/bash
# ============================================================
# Positioning Pro — one-time GitHub setup / first push
# Double-click this file (it opens in Terminal). It will push
# your current app to:
#   https://github.com/tv28zf8w46-dotcom/Positioning-Pro
#
# BEFORE running: install GitHub Desktop and sign in once
# (https://desktop.github.com) so your GitHub login is saved
# to the Mac keychain. Then the push below won't ask for a password.
# ============================================================
set -e
cd "$(dirname "$0")"
echo ""
echo "Working in: $(pwd)"
echo ""

# 1. Clean any half-made repo state (safe if none exists)
rm -rf .git
# 2. Capacitor ships a nested git repo inside ios/App; remove it so
#    those files track normally instead of as a broken submodule.
rm -rf ios/App/.git

# 3. Fresh repo + commit (respects .gitignore already in this folder)
git init
git branch -M main
git add -A
git commit -m "Positioning Pro — current build (drag CR atlas, foot + hand photos, radiograph sim module)"

# 4. Connect to your GitHub repo and push
git remote add origin https://github.com/tv28zf8w46-dotcom/Positioning-Pro.git
git push -u origin main

echo ""
echo "=========================================="
echo " Done! Refresh your GitHub repo page."
echo " From now on, use GitHub Desktop to commit"
echo " and push updates with one click."
echo "=========================================="
echo "Press any key to close this window."
read -n 1
