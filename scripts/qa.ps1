param(
  [switch]$FrontendOnly,
  [switch]$BackendOnly,
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

if ($FrontendOnly -and $BackendOnly) {
  Write-Error "No puedes usar -FrontendOnly y -BackendOnly al mismo tiempo."
  exit 1
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$frontendDir = Join-Path $repoRoot "app\frontend"
$backendDir = Join-Path $repoRoot "app\backend"

$results = New-Object System.Collections.Generic.List[object]

function Add-Result {
  param(
    [string]$Step,
    [string]$Status,
    [string]$Detail
  )

  $results.Add([PSCustomObject]@{
      Step   = $Step
      Status = $Status
      Detail = $Detail
    })
}

function Invoke-CommandStep {
  param(
    [string]$Step,
    [string]$Detail,
    [scriptblock]$Action
  )

  Write-Host ""
  Write-Host "==> $Step"
  if ($Detail) {
    Write-Host "    $Detail"
  }

  & $Action

  if ($LASTEXITCODE -ne 0) {
    Add-Result -Step $Step -Status "FAILED" -Detail "Exit code $LASTEXITCODE"
    throw "$Step failed with exit code $LASTEXITCODE"
  }

  $finalDetail = if ($Detail) { $Detail } else { "Completed" }
  Add-Result -Step $Step -Status "OK" -Detail $finalDetail
}

function Resolve-BackendPython {
  $venvPython = Join-Path $backendDir ".venv\Scripts\python.exe"
  if (Test-Path $venvPython) {
    return $venvPython
  }

  $pythonCommand = Get-Command python -ErrorAction SilentlyContinue
  if ($pythonCommand) {
    return $pythonCommand.Source
  }

  return $null
}

try {
  Invoke-CommandStep -Step "Git working tree" -Detail "git status --short" -Action {
    Set-Location $repoRoot
    git status --short
  }

  if (-not $BackendOnly) {
    Invoke-CommandStep -Step "Frontend lint" -Detail "app/frontend -> npm run lint" -Action {
      Set-Location $frontendDir
      npm run lint
    }

    if (-not $SkipBuild) {
      Invoke-CommandStep -Step "Frontend build" -Detail "app/frontend -> npm run build" -Action {
        Set-Location $frontendDir
        npm run build
      }
    } else {
      Write-Host ""
      Write-Host "==> Frontend build"
      Write-Host "    Skipped by -SkipBuild"
      Add-Result -Step "Frontend build" -Status "SKIPPED" -Detail "Skipped by -SkipBuild"
    }
  }

  if (-not $FrontendOnly) {
    $backendPython = Resolve-BackendPython

    if ($backendPython) {
      Invoke-CommandStep -Step "Backend tests" -Detail "$backendPython -m pytest tests" -Action {
        Set-Location $backendDir
        & $backendPython -m pytest tests
      }
    } else {
      Write-Host ""
      Write-Host "==> Backend tests"
      Write-Warning "No se encontro Python ni .venv en app/backend. Backend tests omitidos."
      Add-Result -Step "Backend tests" -Status "SKIPPED" -Detail "Python/.venv no disponible"

      if ($BackendOnly) {
        throw "Backend tests requested but no Python runtime is available."
      }
    }
  }
}
catch {
  Write-Host ""
  Write-Host "QA summary"
  $results | Format-Table -AutoSize
  Write-Error $_.Exception.Message
  exit 1
}
finally {
  Set-Location $repoRoot
}

Write-Host ""
Write-Host "QA summary"
$results | Format-Table -AutoSize
Write-Host ""
Write-Host "All requested QA checks passed."
exit 0
