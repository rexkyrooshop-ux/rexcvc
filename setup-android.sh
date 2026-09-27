#!/usr/bin/env bash
set -e
npm install
npx cap add android
npx cap sync android
echo
echo "Android project siap di folder ./android"
echo "Buka dengan: npx cap open android"
