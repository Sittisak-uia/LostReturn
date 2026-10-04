# These shadcn/ui components are interactive and need 'use client'
$uiComponents = @(
    'accordion', 'alert-dialog', 'avatar', 'button', 'calendar', 'carousel',
    'chart', 'checkbox', 'collapsible', 'command', 'context-menu', 'dialog',
    'drawer', 'dropdown-menu', 'form', 'hover-card', 'input', 'input-otp',
    'menubar', 'navigation-menu', 'popover', 'progress', 'radio-group',
    'resizable', 'scroll-area', 'select', 'sheet', 'sidebar', 'slider',
    'sonner', 'switch', 'tabs', 'textarea', 'toast', 'toaster',
    'toggle', 'toggle-group', 'tooltip'
)

$uiDir = Join-Path $PSScriptRoot 'src\components\ui'

foreach ($name in $uiComponents) {
    $path = Join-Path $uiDir "$name.tsx"
    if (Test-Path $path) {
        $content = Get-Content $path -Raw -Encoding UTF8
        if ($content -notmatch "^'use client'") {
            $newContent = "'use client';" + [Environment]::NewLine + $content
            Set-Content -Path $path -Value $newContent -Encoding UTF8
            Write-Host "Patched UI: $name.tsx"
        }
    }
}
Write-Host "UI components done."
