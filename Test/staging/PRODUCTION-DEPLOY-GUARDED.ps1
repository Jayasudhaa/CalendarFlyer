param([Parameter(Mandatory=$true)][string]$ProductionServiceArn)
$expectedProductionArn = 'arn:aws:apprunner:us-east-2:011820201589:service/calendarfly/3fa277ea6e73461281a662a36503e4c1'
if ($ProductionServiceArn -ne $expectedProductionArn) { throw 'This guarded copy only deploys the explicitly selected existing production service.' }
$actualName = aws apprunner describe-service --service-arn $ProductionServiceArn --region us-east-2 --query 'Service.ServiceName' --output text
if ($LASTEXITCODE -ne 0 -or $actualName -ne 'calendarfly') { throw 'Production service identity could not be verified.' }
$serviceArn = $ProductionServiceArn
# Prepared only. This script has NOT been run. It builds/deploys actual source when explicitly invoked.

# REBUILD-AND-DEPLOY.ps1
# Run this from: C:\My_Projects\temple-calendar-complete\

$frontend = "C:\My_Projects\temple-calendar-complete\temple-calendar"
$server   = "C:\My_Projects\temple-calendar-complete\server"
$ecr      = "011820201589.dkr.ecr.us-east-2.amazonaws.com/temple-calendar:latest"
$region   = "us-east-2"

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
docker build --platform linux/amd64 -t temple-calendar .
if ($LASTEXITCODE -ne 0) { Write-Host "❌ Docker build failed!" -ForegroundColor Red; exit 1 }
Write-Host "✅ Docker image built" -ForegroundColor Green

Write-Host "`n=== STEP 6: ECR login + push ===" -ForegroundColor Cyan
docker tag temple-calendar $ecr
aws ecr get-login-password --region $region | docker login --username AWS --password-stdin 011820201589.dkr.ecr.us-east-2.amazonaws.com
docker push $ecr
if ($LASTEXITCODE -ne 0) { Write-Host "❌ Push failed!" -ForegroundColor Red; exit 1 }
Write-Host "✅ Image pushed to ECR" -ForegroundColor Green

Write-Host "`n=== STEP 7: Trigger App Runner deployment ===" -ForegroundColor Cyan
# Merged in from the older "# Step 1 Build frontend.txt" manual steps —
# this script previously stopped after the ECR push and left the actual
# redeploy as a manual click in the App Runner console. Grabs whichever
# service this account has (matches the earlier script's own assumption
# that there's exactly one) rather than hardcoding a service ARN, since
# the ARN embeds a generated service ID this script has no other way to
# know ahead of time.
# Service ARN was explicitly provided and verified at the top.
if (-not $serviceArn -or $serviceArn -eq "None") {
    Write-Host "❌ Could not find an App Runner service in $region — check the AWS CLI is logged in to the right account." -ForegroundColor Red
    exit 1
}
Write-Host "Service: $serviceArn"
aws apprunner start-deployment --service-arn $serviceArn --region $region | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Host "❌ Could not start the App Runner deployment!" -ForegroundColor Red; exit 1 }

Write-Host "`n=== STEP 8: Wait for deployment to finish ===" -ForegroundColor Cyan
while ($true) {
    $status = aws apprunner describe-service --service-arn $serviceArn --region $region --query "Service.Status" --output text
    $time = Get-Date -Format "HH:mm:ss"
    Write-Host "[$time] Status: $status"
    if ($status -eq "RUNNING") { Write-Host "`n🎉 Deployed and running!" -ForegroundColor Green; break }
    if ($status -eq "CREATE_FAILED" -or $status -eq "DELETE_FAILED") { Write-Host "`n❌ Deployment failed! Check the App Runner console for the failure event/logs." -ForegroundColor Red; exit 1 }
    Start-Sleep -Seconds 15
}
