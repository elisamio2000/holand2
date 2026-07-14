<#
.SYNOPSIS
    Holand local dev check-and-run script (Windows).
.DESCRIPTION
    Manages local Docker stack lifecycle for this repository:
    - prerequisite checks
    - optional rebuild
    - start/stop/restart
    - Alembic migrations (upgrade heads)
    - HTTP health checks
    - status/log shortcuts

.EXAMPLE
    .\check-and-run.ps1
    .\check-and-run.ps1 -Restart
    .\check-and-run.ps1 -Rebuild
    .\check-and-run.ps1 -RebuildServices api,web -Services api,web
    .\check-and-run.ps1 -Status
    .\check-and-run.ps1 -Logs api
#>

[CmdletBinding()]
param(
    [switch]$Stop,
    [switch]$Restart,
    [switch]$HealthOnly,
    [switch]$Status,
    [switch]$Rebuild,
    [switch]$RebuildAll,
    [string[]]$RebuildServices,
    [string[]]$Services,
    [switch]$NoDeps,
    [switch]$ForceRecreate,
    [switch]$NoRecreate,
    [switch]$BuildOnly,
    [switch]$SkipMigrate,
    [switch]$SkipHealth,
    [switch]$AutoYes,
    [switch]$Help,
    [string]$Logs,
    [switch]$ResetDb,
    [int]$HealthTimeout = 5,
    [int]$GatewayWaitMinutes = 6
)

$ErrorActionPreference = 'Continue'
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$Script:ExitCode = 0
$Script:RepoRoot = (Resolve-Path -Path $PSScriptRoot).Path
$Script:ComposeFile = Join-Path $Script:RepoRoot 'docker-compose.yml'

$Script:Services = @('postgres', 'redis', 'api', 'web')
$Script:BuildableServices = @('api', 'web')
$Script:DefaultRebuildServices = @('api', 'web')
$Script:PortKillExcludePatterns = @('com.docker', 'docker', 'wsl', 'vpnkit', 'msedge', 'chrome', 'firefox')

$Script:HealthEndpoints = @(
    @{ Name = 'API'; Url = 'http://localhost:8001/health'; Required = $true },
    @{ Name = 'Web'; Url = 'http://localhost:3000/api/health'; Required = $false },
    @{ Name = 'vLLM'; Url = 'http://localhost:18005/v1/models'; Required = $false }
)

$Script:RequiredPorts = @(
    @{ Port = 3000; Label = 'Web'; Critical = $true },
    @{ Port = 8001; Label = 'API'; Critical = $true },
    @{ Port = 5433; Label = 'Postgres'; Critical = $false },
    @{ Port = 6380; Label = 'Redis'; Critical = $false }
)

function Write-Header { param([string]$Text)
    Write-Host ''
    Write-Host ('=' * 60) -ForegroundColor DarkCyan
    Write-Host "  $Text" -ForegroundColor Cyan
    Write-Host ('=' * 60) -ForegroundColor DarkCyan
}

function Write-Step { param([string]$Text)
    Write-Host ''
    Write-Host "  >> $Text" -ForegroundColor White
    Write-Host ('  ' + ('-' * 50)) -ForegroundColor DarkGray
}

function Write-Pass { param([string]$Text) Write-Host "    [PASS] $Text" -ForegroundColor Green }
function Write-Warn { param([string]$Text) Write-Host "    [WARN] $Text" -ForegroundColor Yellow }
function Write-Fail { param([string]$Text) Write-Host "    [FAIL] $Text" -ForegroundColor Red; $Script:ExitCode = 1 }
function Write-Info { param([string]$Text) Write-Host "    [INFO] $Text" -ForegroundColor DarkGray }

function Read-YesNo {
    param([string]$Prompt, [bool]$DefaultYes = $false)
    if ($AutoYes) { return $DefaultYes }
    $tag = if ($DefaultYes) { '[Y/n]' } else { '[y/N]' }
    $answer = (Read-Host -Prompt "    $Prompt $tag").Trim()
    if ([string]::IsNullOrWhiteSpace($answer)) { return $DefaultYes }
    return $answer -match '^[yY]'
}

function Test-Command {
    param([string]$Name)
    return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Invoke-Compose {
    param([string[]]$ComposeArgs)
    Push-Location $Script:RepoRoot
    try {
        & docker compose @ComposeArgs
        return $LASTEXITCODE
    } finally {
        Pop-Location
    }
}

function Get-ListeningProcessId {
    param([int]$Port)
    try {
        $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop | Select-Object -First 1
        if ($listener) { return [int]$listener.OwningProcess }
    } catch {}
    return $null
}

function Test-DockerPublishedPort {
    param([int]$Port)
    try {
        $ports = docker ps --format "{{.Ports}}" 2>$null | Out-String
        return $ports -match ":$Port->"
    } catch {}
    return $false
}

function Get-PortConflictInfo {
    param([int]$Port)
    $listenerPid = Get-ListeningProcessId -Port $Port
    if (-not $listenerPid) { return $null }

    $proc = Get-Process -Id $listenerPid -ErrorAction SilentlyContinue
    $name = if ($proc) { $proc.ProcessName } else { 'unknown' }
    $isDocker = Test-DockerPublishedPort -Port $Port

    $isExcluded = $false
    $haystack = $name.ToLowerInvariant()
    foreach ($pat in $Script:PortKillExcludePatterns) {
        if ($haystack -like "*$pat*") { $isExcluded = $true; break }
    }
    if ($haystack -match 'docker|com\.docker|docker-proxy|wslrelay|vpnkit') {
        $isDocker = $true
    }

    return @{
        Port = $Port
        ProcessId = $listenerPid
        Name = $name
        IsExcluded = $isExcluded
        IsDocker = $isDocker
    }
}

function Stop-ProcessSafe {
    param([int]$ProcessId)
    if ($ProcessId -eq $PID) { return $false }
    try {
        Stop-Process -Id $ProcessId -Force -ErrorAction Stop
        return $true
    } catch {
        return $false
    }
}

function Test-HttpHealth {
    param([string]$Url, [int]$TimeoutSec = 5)
    try {
        $r = Invoke-WebRequest -Uri $Url -Method Get -TimeoutSec $TimeoutSec -UseBasicParsing
        return @{ Ok = $true; Status = [int]$r.StatusCode }
    } catch {
        return @{ Ok = $false; Status = 0; Error = $_.Exception.Message }
    }
}

function Test-Prerequisites {
    Write-Header 'Phase 1: Prerequisites'

    if (-not (Test-Command 'docker')) {
        Write-Fail 'docker CLI not found'
        return $false
    }
    Write-Pass 'docker CLI available'

    if (-not (Test-Path $Script:ComposeFile)) {
        Write-Fail "docker-compose.yml not found at $Script:ComposeFile"
        return $false
    }
    Write-Pass 'docker-compose.yml found'

    try {
        docker info *> $null
        if ($LASTEXITCODE -ne 0) {
            Write-Fail 'Docker daemon is not running'
            return $false
        }
    } catch {
        Write-Fail 'Docker daemon is not running'
        return $false
    }
    Write-Pass 'Docker daemon running'
    return $true
}

function Invoke-PortAudit {
    Write-Header 'Phase 2: Port Audit'
    $conflicts = @()
    foreach ($entry in $Script:RequiredPorts) {
        $conflict = Get-PortConflictInfo -Port $entry.Port
        if (-not $conflict) {
            Write-Pass "Port $($entry.Port) free ($($entry.Label))"
            continue
        }
        $conflicts += @{ Entry = $entry; Conflict = $conflict }
        Write-Warn "Port $($entry.Port) in use by PID $($conflict.ProcessId) ($($conflict.Name))"
    }

    foreach ($item in $conflicts) {
        $entry = $item.Entry
        $conflict = $item.Conflict
        if ($conflict.IsDocker) {
            Write-Pass "Port $($entry.Port) is already published by Docker ($($entry.Label))"
            continue
        }
        if ($conflict.IsExcluded) {
            if ($entry.Critical) {
                Write-Fail "Critical port $($entry.Port) is occupied by protected process $($conflict.Name)"
                return $false
            }
            Write-Warn "Skipping optional port $($entry.Port) conflict ($($conflict.Name))"
            continue
        }

        if (-not $entry.Critical) { continue }

        if (-not (Read-YesNo -Prompt "Kill process $($conflict.Name) (PID $($conflict.ProcessId)) for port $($entry.Port)?" -DefaultYes $false)) {
            Write-Fail "Cannot continue with critical port conflict on $($entry.Port)"
            return $false
        }

        if (Stop-ProcessSafe -ProcessId $conflict.ProcessId) {
            Write-Pass "Freed port $($entry.Port)"
        } else {
            Write-Fail "Failed to free critical port $($entry.Port)"
            return $false
        }
    }

    return $true
}

function Get-RebuildTargets {
    if ($RebuildServices -and $RebuildServices.Count -gt 0) { return $RebuildServices }
    if ($RebuildAll) { return $Script:BuildableServices }
    if ($Rebuild) { return $Script:DefaultRebuildServices }
    return @()
}

function Get-StartTargets {
    if ($Services -and $Services.Count -gt 0) { return $Services }
    return $Script:Services
}

function Get-RecreateArgs {
    param([bool]$DidRebuild, [bool]$IsRestart)
    if ($NoRecreate) { return @() }
    if ($ForceRecreate) { return @('--force-recreate') }
    if ($IsRestart) { return @('--force-recreate') }
    if ($DidRebuild) { return @('--force-recreate') }
    return @()
}

function Invoke-Stop {
    Write-Header 'Phase 3: Stop Stack'
    $code = Invoke-Compose -ComposeArgs @('down', '--remove-orphans')
    if ($code -eq 0) {
        Write-Pass 'Stack stopped'
    } else {
        Write-Warn "docker compose down exited with code $code"
    }
}

function Invoke-ResetDb {
    Write-Header 'Reset Postgres Volume'
    Write-Warn 'This removes local PostgreSQL data volumes.'
    if (-not (Read-YesNo -Prompt 'Confirm DB volume reset?' -DefaultYes $false)) {
        Write-Info 'Skipped DB reset'
        return
    }
    Invoke-Stop

    foreach ($vol in @('holand_postgres_data', 'postgres_data')) {
        docker volume rm $vol *> $null
    }
    Write-Pass 'Postgres volume reset done'
}

function Invoke-Build {
    param([string[]]$Targets)
    if (-not $Targets -or $Targets.Count -eq 0) { return $false }

    Write-Step "Building images: $($Targets -join ', ')"
    $code = Invoke-Compose -ComposeArgs (@('build') + $Targets)
    if ($code -ne 0) {
        Write-Fail 'docker compose build failed'
        return $false
    }
    Write-Pass 'Build completed'
    return $true
}

function Wait-ApiHealthy {
    Write-Step "Waiting for API health (max ${GatewayWaitMinutes}m)"
    $deadline = (Get-Date).AddMinutes($GatewayWaitMinutes)
    while ((Get-Date) -lt $deadline) {
        $probe = Test-HttpHealth -Url 'http://localhost:8001/health' -TimeoutSec $HealthTimeout
        if ($probe.Ok) {
            Write-Pass 'API is healthy'
            return $true
        }
        Start-Sleep -Seconds 2
    }
    Write-Fail 'API did not become healthy in time'
    return $false
}

function Invoke-Migrations {
    if ($SkipMigrate) {
        Write-Info 'Skipping migrations by request'
        return
    }
    Write-Header 'Phase 5: Migrations'
    Write-Step 'Running Alembic upgrade heads inside api container'

    docker exec holand-api python -m alembic upgrade heads
    if ($LASTEXITCODE -ne 0) {
        Write-Fail 'Alembic upgrade heads failed'
        return
    }
    Write-Pass 'Alembic migrations applied'
}

function Invoke-Health {
    if ($SkipHealth) {
        Write-Info 'Skipping health checks by request'
        return
    }

    Write-Header 'Phase 6: Health Checks'
    foreach ($ep in $Script:HealthEndpoints) {
        $result = Test-HttpHealth -Url $ep.Url -TimeoutSec $HealthTimeout
        if ($result.Ok) {
            Write-Pass "$($ep.Name): $($ep.Url)"
        } else {
            if ($ep.Required) {
                Write-Fail "$($ep.Name) health failed: $($result.Error)"
            } else {
                Write-Warn "$($ep.Name) unavailable: $($result.Error)"
            }
        }
    }

    Write-Step 'docker compose ps'
    [void](Invoke-Compose -ComposeArgs @('ps'))
}

function Show-Status {
    Write-Header 'Stack Status'
    [void](Invoke-Compose -ComposeArgs @('ps', '-a'))
}

function Show-Logs {
    param([string]$Service)
    Write-Header 'Logs'
    if ([string]::IsNullOrWhiteSpace($Service)) {
        [void](Invoke-Compose -ComposeArgs @('logs', '--tail', '120'))
    } else {
        [void](Invoke-Compose -ComposeArgs @('logs', '--tail', '180', $Service))
    }
}

function Show-OptionHelp {
@"
Holand check-and-run.ps1

Usage:
  .\check-and-run.ps1 [switches]

Common switches:
  -Stop -Restart -Status -HealthOnly
  -Rebuild -RebuildAll -RebuildServices api,web
  -Services api,web -NoDeps
  -ForceRecreate -NoRecreate -BuildOnly
  -ResetDb -SkipMigrate -SkipHealth
  -Logs api
"@ | Write-Host
}

$sw = [System.Diagnostics.Stopwatch]::StartNew()
Set-Location $Script:RepoRoot

if ($Help) { Show-OptionHelp; exit 0 }
if ($ForceRecreate -and $NoRecreate) { Write-Fail '-ForceRecreate and -NoRecreate cannot be used together'; exit 1 }

$plannedRebuild = Get-RebuildTargets
$plannedStart = Get-StartTargets

if ($Logs) { Show-Logs -Service $Logs; exit 0 }
if ($Status) { Show-Status; exit 0 }

if ($HealthOnly) {
    if (-not (Test-Prerequisites)) { exit 1 }
    Invoke-Health
    exit $Script:ExitCode
}

if ($Stop) {
    Invoke-Stop
    exit $Script:ExitCode
}

if ($ResetDb) {
    if (-not (Test-Prerequisites)) { exit 1 }
    Invoke-ResetDb
    exit $Script:ExitCode
}

if (-not (Test-Prerequisites)) { exit 1 }
if (-not (Invoke-PortAudit)) { exit 1 }

if ($Restart) {
    Invoke-Stop
}

$didRebuild = $false
if ($plannedRebuild.Count -gt 0) {
    $didRebuild = Invoke-Build -Targets $plannedRebuild
    if ($Script:ExitCode -ne 0) { exit $Script:ExitCode }
}

if ($BuildOnly) {
    Write-Pass 'Build-only mode completed'
    exit $Script:ExitCode
}

Write-Header $(if ($Restart) { 'Phase 4: Restart Stack' } else { 'Phase 4: Start Stack' })
$recreateArgs = Get-RecreateArgs -DidRebuild:$didRebuild -IsRestart:$Restart
$upArgs = @('up', '-d') + $recreateArgs
if ($NoDeps) { $upArgs += '--no-deps' }
$upArgs += $plannedStart

Write-Step "docker compose $($upArgs -join ' ')"
$upCode = Invoke-Compose -ComposeArgs $upArgs
if ($upCode -ne 0) {
    Write-Fail "docker compose up failed with code $upCode"
    exit $Script:ExitCode
}
Write-Pass 'Containers started'

if (-not (Wait-ApiHealthy)) { exit $Script:ExitCode }

Invoke-Migrations
Invoke-Health

Write-Header 'Summary'
Write-Info "Elapsed: $([Math]::Round($sw.Elapsed.TotalSeconds, 1))s"
if ($Script:ExitCode -eq 0) {
    Write-Pass 'Done'
} else {
    Write-Fail 'Completed with errors'
}

exit $Script:ExitCode
