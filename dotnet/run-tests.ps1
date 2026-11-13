<#
.SYNOPSIS
  Runs the Reqnroll suite, translating the shared TAGS / PARALLEL / BROWSER conventions
  into `dotnet test` arguments.

.EXAMPLE
  ./run-tests.ps1                              # everything except @wip
  ./run-tests.ps1 -Tags "@smoke and not @api"  # tag expression
  ./run-tests.ps1 -Browser firefox -Parallel 4
  ./run-tests.ps1 -Demo                        # headed, slowed-down tour of playwright.dev
#>
[CmdletBinding()]
param(
    [string] $Tags = $(if ($env:TAGS) { $env:TAGS } else { 'not @wip' }),
    [string] $Browser = $(if ($env:BROWSER) { $env:BROWSER } else { 'chromium' }),
    [int] $Parallel = $(if ($env:PARALLEL) { [int]$env:PARALLEL } else { 2 }),
    [string] $Configuration = 'Debug',
    [switch] $Demo,
    [switch] $InstallBrowsers,
    [Parameter(ValueFromRemainingArguments = $true)] [string[]] $Rest
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

function ConvertTo-TestFilter([string] $expression) {
    # Cucumber tag expression -> VSTest filter on NUnit categories.
    #   @smoke and not @api  ->  Category=smoke&Category!=api
    #   @smoke or @e2e       ->  Category=smoke|Category=e2e
    $e = $expression.Trim()
    if (-not $e) { return '' }
    $e = [regex]::Replace($e, 'not\s+@([\w-]+)', 'Category!=$1')
    $e = [regex]::Replace($e, '(?<![!=\w])@([\w-]+)', 'Category=$1')
    $e = [regex]::Replace($e, '\s+and\s+', '&')
    $e = [regex]::Replace($e, '\s+or\s+', '|')
    return $e
}

if ($Demo) {
    $Tags = '@demo'
    $env:HEADLESS = 'false'
    if (-not $env:SLOW_MO) { $env:SLOW_MO = '500' }
    $Parallel = 1
}

$env:BROWSER = $Browser

if ($InstallBrowsers) {
    dotnet build -c $Configuration --nologo
    & "$PSScriptRoot/AutoPlaywright.Specs/bin/$Configuration/net10.0/playwright.ps1" install --with-deps $Browser
}

$filter = ConvertTo-TestFilter $Tags
$arguments = @('test', '-c', $Configuration, '--nologo')
if ($filter) { $arguments += @('--filter', $filter) }
$arguments += $Rest
$arguments += @('--', "NUnit.NumberOfTestWorkers=$Parallel")

Write-Host "dotnet $($arguments -join ' ')" -ForegroundColor Cyan
& dotnet @arguments
exit $LASTEXITCODE
