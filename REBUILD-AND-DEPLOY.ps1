# REBUILD-AND-DEPLOY.ps1
# Run this from: C:\My_Projects\temple-calendar-complete\

$frontend = "C:\My_Projects\temple-calendar-complete\temple-calendar"
$server   = "C:\My_Projects\temple-calendar-complete\server"
$ecr      = "011820201589.dkr.ecr.us-east-2.amazonaws.com/temple-calendar:latest"

Write-Host "`n=== STEP 1: Delete old dist ===" -ForegroundColor Cyan
if (Test-Path "$frontend\dist") { Remove-Item -Recurse -Force "$frontend\dist" }
if (Test-Path "$frontend\node_modules\.vite") { Remove-Item -Recurse -Force "$frontend\node_modules\.vite" }
Write-Host "✅ dist and vite cache cleared" -ForegroundColor Green

Write-Host "`n=== STEP 2: Build ===" -ForegroundColor Cyan
Set-Location $frontend
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "❌ Build failed!" -ForegroundColor Red; exit 1 }

$bundle = (Get-ChildItem "$frontend\dist\assets\*.js" | Select-Object -First 1).Name
Write-Host "✅ Built: $bundle" -ForegroundColor Green

Write-Host "`n=== STEP 3: Check bundle for old URL ===" -ForegroundColor Cyan
$bundleContent = Get-Content "$frontend\dist\assets\$bundle" -Raw
if ($bundleContent -match "jyuxa8xvk6") {
    Write-Host "❌ OLD URL still in bundle! Source files not updated." -ForegroundColor Red
    exit 1
} else {
    Write-Host "✅ Bundle is clean" -ForegroundColor Green
}

Write-Host "`n=== STEP 4: Copy to server (clean mirror — no stale bundles) ===" -ForegroundColor Cyan
# Security note (2026-09-04 audit): this used to be an overlay copy
# (xcopy /E /I /Y) that never cleared $server\dist-frontend first, so ~110
# historical JS bundles accumulated there over time — each one baking in
# whatever secrets/config were inlined into it at build time (see the
# ADMIN_SECRET/VITE_ADMIN_SECRET cleanup in the same audit). robocopy /MIR
# makes the destination an exact mirror of $dist, deleting anything in
# dist-frontend that no longer exists in the new build, so at most one
# build's worth of bundles is ever served.
robocopy "$frontend\dist" "$server\dist-frontend" /MIR /NFL /NDL /NJH /NJS
# robocopy's exit codes 0-7 are all "success" (8+ means a real failure) —
# unlike every other tool in this script, 0 is not the only success code.
if ($LASTEXITCODE -ge 8) { Write-Host "❌ Copy to dist-frontend failed!" -ForegroundColor Red; exit 1 }
Write-Host "✅ Copied to server\dist-frontend (old bundles removed)" -ForegroundColor Green

Write-Host "`n=== STEP 5: Docker build ===" -ForegroundColor Cyan
# The Dockerfile lives in server\, not the repo root — there has never
# been one at the repo root (checked git history), so `docker build .`
# from the root always failed with "open Dockerfile: no such file or
# directory". The image that's actually been deployed before was built
# from inside server\ (see server\Dockerfile — it COPYs the server's own
# package.json + source + the dist-frontend folder Step 4 just filled),
# matching the working manual steps this script was meant to replace.
Set-Location $server
docker build -t temple-calendar .
if ($LASTEXITCODE -ne 0) { Write-Host "❌ Docker build failed!" -ForegroundColor Red; exit 1 }
Write-Host "✅ Docker image built" -ForegroundColor Green

Write-Host "`n=== STEP 6: ECR login + push ===" -ForegroundColor Cyan
docker tag temple-calendar $ecr
aws ecr get-login-password --region us-east-2 | docker login --username AWS --password-stdin 011820201589.dkr.ecr.us-east-2.amazonaws.com
docker push $ecr
if ($LASTEXITCODE -ne 0) { Write-Host "❌ Push failed!" -ForegroundColor Red; exit 1 }

Write-Host "`n🎉 DONE! Now go to App Runner → calendarfly → Deploy" -ForegroundColor Green
