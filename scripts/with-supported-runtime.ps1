[CmdletBinding()]
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]] $Command
)

$ErrorActionPreference = 'Stop'
$workspaceRoot = Split-Path -Parent $PSScriptRoot
$nodeVersion = (Get-Content -LiteralPath (Join-Path $workspaceRoot '.nvmrc') -Raw).Trim()
$fnmNodeHome = Join-Path $env:APPDATA "fnm\node-versions\v$nodeVersion\installation"

if (Test-Path -LiteralPath (Join-Path $fnmNodeHome 'node.exe')) {
    $env:PATH = "$fnmNodeHome;$env:PATH"
}

$resolvedNode = (& node -p 'process.versions.node' 2>$null)
if ($LASTEXITCODE -ne 0 -or $resolvedNode -notmatch '^24\.(1[5-9]|[2-9][0-9])\.') {
    throw "Node 24.15+ in the Node 24 line was not found. Install $nodeVersion with fnm."
}

$resolvedPnpm = (& pnpm --version 2>$null)
if ($LASTEXITCODE -ne 0 -or $resolvedPnpm -ne '11.21.0') {
    throw 'pnpm 11.21.0 was not found. Run corepack prepare pnpm@11.21.0 --activate.'
}

$javaHomes = @()
if ($env:JAVA_HOME) {
    $javaHomes += $env:JAVA_HOME
}
$javaHomes += Get-ChildItem -Path "$env:ProgramFiles\Java\jdk-*" -Directory -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty FullName
$javaHomes += Get-ChildItem -Path "$env:ProgramFiles\Eclipse Adoptium\jdk-*" -Directory -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty FullName
$javaHomes += Get-ChildItem -Path "$env:ProgramFiles\Microsoft\jdk-*" -Directory -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty FullName

$supportedJavaHome = $null
foreach ($javaHome in ($javaHomes | Select-Object -Unique)) {
    $javaExecutable = Join-Path $javaHome 'bin\java.exe'
    if (-not (Test-Path -LiteralPath $javaExecutable)) {
        continue
    }
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $javaOutput = (& $javaExecutable -version 2>&1 | Out-String)
        $javaExitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    if ($javaExitCode -eq 0 -and $javaOutput -match 'version "(\d+)' -and [int]$Matches[1] -ge 21) {
        $supportedJavaHome = $javaHome
        break
    }
}

if (-not $supportedJavaHome) {
    throw 'Java 21 or newer was not found under JAVA_HOME or a standard Program Files installation.'
}

$env:JAVA_HOME = $supportedJavaHome
$env:PATH = "$(Join-Path $supportedJavaHome 'bin');$env:PATH"

$javaVersionLine = if ($javaOutput -match '(?m)(?:openjdk|java) version "[^"]+"') {
    $Matches[0]
}
else {
    'version 21 or newer'
}
Write-Host "Using Node $resolvedNode, pnpm $resolvedPnpm, Java $javaVersionLine."

if ($Command.Count -gt 0) {
    $commandName = $Command[0]
    [string[]]$commandArguments = if ($Command.Count -gt 1) { [string[]]$Command[1..($Command.Count - 1)] } else { @() }
    & $commandName @commandArguments
    exit $LASTEXITCODE
}
