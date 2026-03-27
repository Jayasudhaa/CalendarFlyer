# FIND-IN-BUNDLE.ps1
$bundle = Get-ChildItem "C:\My_Projects\temple-calendar-complete\temple-calendar\dist\assets\*.js" | Select-Object -First 1
Write-Host "Checking: $($bundle.Name)" -ForegroundColor Cyan
$content = Get-Content $bundle.FullName -Raw
$index = 0
$found = 0
while ($true) {
    $index = $content.IndexOf("jyuxa8xvk6", $index)
    if ($index -lt 0) { break }
    $start = [Math]::Max(0, $index - 120)
    $len   = [Math]::Min(250, $content.Length - $start)
    Write-Host "`n--- Occurrence $($found+1) ---" -ForegroundColor Yellow
    Write-Host $content.Substring($start, $len)
    $found++
    $index++
}
Write-Host "`nTotal: $found occurrences" -ForegroundColor Cyan

Write-Host "`n=== All JS/JSX files with old URL (excluding node_modules/dist) ===" -ForegroundColor Cyan
Get-ChildItem -Path "C:\My_Projects\temple-calendar-complete" -Recurse -Include "*.jsx","*.js" |
    Where-Object { $_.FullName -notmatch "\\node_modules\\" -and $_.FullName -notmatch "\\dist\\" } |
    Select-String -Pattern "jyuxa8xvk6" |
    Select-Object Path, LineNumber, Line |
    Format-List
