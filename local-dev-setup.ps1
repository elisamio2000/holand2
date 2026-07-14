<#
.SYNOPSIS
    Holand local dev wrapper around check-and-run.ps1.
.DESCRIPTION
    Mirrors check-and-run.ps1 switches for quick discoverability.
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
    [switch]$ResetDb,
    [switch]$SkipMigrate,
    [switch]$SkipHealth,
    [switch]$AutoYes,
    [switch]$Help,
    [string]$Logs,
    [int]$HealthTimeout = 5,
    [int]$GatewayWaitMinutes = 6
)

$checkScript = Join-Path $PSScriptRoot 'check-and-run.ps1'
if (-not (Test-Path $checkScript)) {
    throw "check-and-run.ps1 not found at $checkScript"
}

& $checkScript @PSBoundParameters
exit $LASTEXITCODE
