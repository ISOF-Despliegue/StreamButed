param(
  [string]$ApiBaseUrl = "https://api.migueleelg0106.me",
  [string]$FrontendUrl = "https://migueleelg0106.me",
  [string]$CatalogSearchTerms = "a,music,rock,pop",
  [switch]$IncludeStress,
  [switch]$IncludeSpike,
  [switch]$IncludeSoak,
  [switch]$IncludeAuthenticated,
  [string]$AccessToken = "",
  [string]$AuthEmail = "",
  [string]$AuthPassword = ""
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$scriptsDir = Join-Path $root "scripts"
$reportsDir = Join-Path $root "reports"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

New-Item -ItemType Directory -Force -Path $reportsDir | Out-Null

$commonEnv = @(
  "-e", "API_BASE_URL=$ApiBaseUrl",
  "-e", "FRONTEND_URL=$FrontendUrl",
  "-e", "CATALOG_SEARCH_TERMS=$CatalogSearchTerms"
)

function Invoke-K6Script {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$ScriptFile,
    [string[]]$ExtraEnv = @()
  )

  $scriptPath = Join-Path $scriptsDir $ScriptFile
  if (-not (Test-Path -LiteralPath $scriptPath)) {
    throw "Script not found: $scriptPath"
  }

  $summaryPath = "/reports/$timestamp-$Name-summary.json"
  Write-Host ""
  Write-Host "=== Running $Name ===" -ForegroundColor Cyan

  $scriptContent = Get-Content -Raw -LiteralPath $scriptPath
  $dockerArgs = @(
    "run", "--rm", "-i"
  ) + $commonEnv + $ExtraEnv + @(
    "-v", "${reportsDir}:/reports",
    "grafana/k6",
    "run",
    "--summary-export=$summaryPath",
    "-"
  )

  $scriptContent | & docker @dockerArgs
  if ($LASTEXITCODE -ne 0) {
    throw "k6 script failed: $Name"
  }

  Write-Host "Summary saved to $reportsDir\$timestamp-$Name-summary.json" -ForegroundColor Green
}

$plan = @(
  @{ Name = "smoke"; Script = "health-smoke.js"; Enabled = $true; ExtraEnv = @() },
  @{ Name = "load"; Script = "health-load.js"; Enabled = $true; ExtraEnv = @() },
  @{ Name = "catalog-load"; Script = "catalog-load.js"; Enabled = $true; ExtraEnv = @() },
  @{ Name = "mixed-api-flow"; Script = "mixed-api-flow.js"; Enabled = $true; ExtraEnv = @() },
  @{ Name = "stress"; Script = "health-stress.js"; Enabled = [bool]$IncludeStress; ExtraEnv = @() },
  @{ Name = "spike"; Script = "health-spike.js"; Enabled = [bool]$IncludeSpike; ExtraEnv = @() },
  @{ Name = "soak"; Script = "health-soak.js"; Enabled = [bool]$IncludeSoak; ExtraEnv = @() }
)

if ($IncludeAuthenticated) {
  $authEnv = @()
  if ($AccessToken) {
    $authEnv += @("-e", "ACCESS_TOKEN=$AccessToken")
  }
  if ($AuthEmail) {
    $authEnv += @("-e", "AUTH_EMAIL=$AuthEmail")
  }
  if ($AuthPassword) {
    $authEnv += @("-e", "AUTH_PASSWORD=$AuthPassword")
  }

  $plan += @{
    Name = "authenticated-flow"
    Script = "authenticated-flow.example.js"
    Enabled = $true
    ExtraEnv = $authEnv
  }
}

Write-Host "API_BASE_URL=$ApiBaseUrl"
Write-Host "FRONTEND_URL=$FrontendUrl"
Write-Host "CATALOG_SEARCH_TERMS=$CatalogSearchTerms"
Write-Host "Reports directory: $reportsDir"
Write-Host ""
Write-Host "Execution plan:"
$plan | Where-Object { $_.Enabled } | ForEach-Object { Write-Host " - $($_.Name)" }

foreach ($step in $plan) {
  if (-not $step.Enabled) {
    continue
  }

  Invoke-K6Script -Name $step.Name -ScriptFile $step.Script -ExtraEnv $step.ExtraEnv
}

Write-Host ""
Write-Host "All selected tests completed." -ForegroundColor Green
