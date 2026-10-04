$dirs = @(
    Join-Path $PSScriptRoot 'src\components\locker',
    Join-Path $PSScriptRoot 'src\components\dashboard',
    Join-Path $PSScriptRoot 'src\components\feed'
)

foreach ($dir in $dirs) {
    $files = Get-ChildItem -Path $dir -Filter '*.tsx'
    foreach ($f in $files) {
        $content = Get-Content $f.FullName -Raw -Encoding UTF8
        if ($content -notmatch "^'use client'") {
            $newContent = "'use client';" + [Environment]::NewLine + $content
            Set-Content -Path $f.FullName -Value $newContent -Encoding UTF8
            Write-Host "Patched: $($f.Name)"
        } else {
            Write-Host "Already has use client: $($f.Name)"
        }
    }
}
Write-Host "All done."
