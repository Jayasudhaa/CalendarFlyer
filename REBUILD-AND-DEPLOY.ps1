# REBUILD-AND-DEPLOY.ps1
# Run this from: C:\My_Projects\temple-calendar-complete\

$frontend = "C:\My_Projects\temple-calendar-complete\temple-calendar"
$server   = "C:\My_Projects\temple-calendar-complete\server"
$ecr      = "011820201589.dkr.ecr.us-east-2.amazonaws.com/temple-calendar:latest"

Write-Host "`n=== STEP 1: Write .env ===" -ForegroundColor Cyan
Set-Content "$frontend\.env" "VITE_ADMIN_SECRET=TempleAdmin2026!"
Write-Host "✅ .env written" -ForegroundColor Green

Write-Host "`n=== STEP 2: Delete old dist ===" -ForegroundColor Cyan
if (Test-Path "$frontend\dist") { Remove-Item -Recurse -Force "$frontend\dist" }
if (Test-Path "$frontend\node_modules\.vite") { Remove-Item -Recurse -Force "$frontend\node_modules\.vite" }
Write-Host "✅ dist and vite cache cleared" -ForegroundColor Green

Write-Host "`n=== STEP 3: Build ===" -ForegroundColor Cyan
Set-Location $frontend
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "❌ Build failed!" -ForegroundColor Red; exit 1 }

$bundle = (Get-ChildItem "$frontend\dist\assets\*.js" | Select-Object -First 1).Name
Write-Host "✅ Built: $bundle" -ForegroundColor Green

Write-Host "`n=== STEP 4: Check bundle for old URL ===" -ForegroundColor Cyan
$bundleContent = Get-Content "$frontend\dist\assets\$bundle" -Raw
if ($bundleContent -match "jyuxa8xvk6") {
    Write-Host "❌ OLD URL still in bundle! Source files not updated." -ForegroundColor Red
    exit 1
} else {
    Write-Host "✅ Bundle is clean" -ForegroundColor Green
}

Write-Host "`n=== STEP 5: Copy to server ===" -ForegroundColor Cyan
xcopy /E /I /Y "$frontend\dist" "$server\dist-frontend"
Write-Host "✅ Copied to server\dist-frontend" -ForegroundColor Green

Write-Host "`n=== STEP 6: Docker build ===" -ForegroundColor Cyan
Set-Location "C:\My_Projects\temple-calendar-complete"
docker build -t temple-calendar .
if ($LASTEXITCODE -ne 0) { Write-Host "❌ Docker build failed!" -ForegroundColor Red; exit 1 }
Write-Host "✅ Docker image built" -ForegroundColor Green

Write-Host "`n=== STEP 7: ECR login + push ===" -ForegroundColor Cyan
docker tag temple-calendar $ecr
aws ecr get-login-password --region us-east-2 | docker login --username AWS --password-stdin 011820201589.dkr.ecr.us-east-2.amazonaws.com
docker push $ecr
if ($LASTEXITCODE -ne 0) { Write-Host "❌ Push failed!" -ForegroundColor Red; exit 1 }

Write-Host "`n🎉 DONE! Now go to App Runner → calendarfly → Deploy" -ForegroundColor Green
