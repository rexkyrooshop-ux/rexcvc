$ErrorActionPreference = "Stop"
npm install
npx cap add android
npx cap sync android
Write-Host "Android project siap di folder .\android"
Write-Host "Buka dengan: npx cap open android"
