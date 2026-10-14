# Validate the Windows launcher without starting Docker.
# Supported by Windows PowerShell 5.1 and PowerShell 7.
$ErrorActionPreference = 'Stop'
$psFiles = @(Get-ChildItem -Path $PSScriptRoot -Filter '*.ps1' -File)
if ($psFiles.Count -lt 2) { throw 'Launcher / parser test scripts missing.' }

foreach ($psFile in $psFiles) {
    $tokens = $null
    $syntaxErrors = $null
    $null = [System.Management.Automation.Language.Parser]::ParseFile($psFile.FullName, [ref]$tokens, [ref]$syntaxErrors)
    if ($syntaxErrors.Count -ne 0) {
        $messages = @($syntaxErrors | ForEach-Object {
            '{0}:{1} {2}' -f $psFile.Name, $_.Extent.StartLineNumber, $_.Message
        })
        throw ($messages -join [Environment]::NewLine)
    }
    Write-Host ('[PASS] PowerShell parser: ' + $psFile.Name)
}

$source = [System.IO.File]::ReadAllText((Join-Path $PSScriptRoot 'Start-ZenSpace.ps1'))
$upCount = [regex]::Matches($source, 'docker\s+compose\s+up\s+--build').Count
$configCount = [regex]::Matches($source, 'docker\s+compose\s+config\s+--format\s+json').Count
if (($upCount -ne 1) -or ($configCount -ne 1)) {
    throw ('Launcher duplicated or truncated: compose up={0}, config={1}' -f $upCount, $configCount)
}
if (-not $source.Contains('$apiPort/healthz')) {
    throw 'Readiness endpoint is not the Gin /healthz route.'
}
if (-not $source.Contains('Join-Path $RepoRoot ''apps/api''')) {
    throw 'Expected apps/api Docker build context check is missing.'
}
if (-not $source.Contains('Join-Path $RepoRoot ''apps/web''')) {
    throw 'Expected apps/web Docker build context check is missing.'
}
Write-Host '[PASS] Windows launcher configuration invariants'
