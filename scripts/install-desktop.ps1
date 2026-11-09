<#
.SYNOPSIS
  Install / uninstall dsh-balance-chip into a DeepSeek Harness desktop profile.

.DESCRIPTION
  The desktop profile is owned by the Electron application and the `dsh plugin`
  CLI refuses it, so this script copies the package and edits package.json itself.
  A restart of the application is required for the plugin tree to be recomposed.

  package.json is rewritten through .NET with UTF-8 without BOM, because the DSH
  profile loader parses it as plain JSON.

.PARAMETER ProfileDir
  The desktop profile directory. Defaults to
  "$env:USERPROFILE\.dsh\profiles\desktop".

.PARAMETER Uninstall
  Remove the plugin and its manifest entries instead of installing.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-desktop.ps1

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-desktop.ps1 -Uninstall
#>
[CmdletBinding()]
param(
  [string]$ProfileDir = (Join-Path $env:USERPROFILE '.dsh\profiles\desktop'),
  [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'
$pluginName = 'dsh-balance-chip'
$sourceDir = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $ProfileDir 'package.json'
$targetDir = Join-Path $ProfileDir "node_modules\$pluginName"

if (-not (Test-Path $sourceDir)) { throw "plugin source not found: $sourceDir" }
if (-not (Test-Path $manifestPath)) {
  throw "desktop profile manifest not found: $manifestPath`nRun DeepSeek Harness at least once, or pass -ProfileDir <your DSH home>\profiles\desktop."
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
Copy-Item $manifestPath "$manifestPath.bak-$stamp"

if (-not $Uninstall) {
  if (Test-Path $targetDir) { Remove-Item $targetDir -Recurse -Force }
  New-Item -ItemType Directory -Force $targetDir | Out-Null
  foreach ($file in @('package.json', 'cordis.patch.yml', 'README.md', 'LICENSE')) {
    $path = Join-Path $sourceDir $file
    if (Test-Path $path) { Copy-Item $path $targetDir }
  }
  Copy-Item (Join-Path $sourceDir 'lib') $targetDir -Recurse
}

# Edit the manifest through .NET JSON so the file keeps plain UTF-8 (no BOM) and
# keeps every unrelated field exactly as it was.
$raw = [System.IO.File]::ReadAllText($manifestPath)
$manifest = $raw | ConvertFrom-Json
if (-not $manifest.PSObject.Properties['dsh']) { $manifest | Add-Member -NotePropertyName dsh -NotePropertyValue ([pscustomobject]@{}) }
if (-not $manifest.dsh.PSObject.Properties['profile']) { $manifest.dsh | Add-Member -NotePropertyName profile -NotePropertyValue ([pscustomobject]@{}) }
$bundles = @()
if ($manifest.dsh.profile.PSObject.Properties['bundles']) { $bundles = @($manifest.dsh.profile.bundles) }

if ($Uninstall) {
  $manifest.dsh.profile.bundles = @($bundles | Where-Object { $_ -ne $pluginName })
  if ($manifest.PSObject.Properties['dependencies'] -and $manifest.dependencies.PSObject.Properties[$pluginName]) {
    $manifest.dependencies.PSObject.Properties.Remove($pluginName)
  }
  if (Test-Path $targetDir) { Remove-Item $targetDir -Recurse -Force }
} else {
  $linkSpec = 'link:' + ($sourceDir -replace '\\', '/')
  if (-not $manifest.PSObject.Properties['dependencies']) { $manifest | Add-Member -NotePropertyName dependencies -NotePropertyValue ([pscustomobject]@{}) }
  if ($manifest.dependencies.PSObject.Properties[$pluginName]) {
    $manifest.dependencies.$pluginName = $linkSpec
  } else {
    $manifest.dependencies | Add-Member -NotePropertyName $pluginName -NotePropertyValue $linkSpec
  }
  if ($bundles -notcontains $pluginName) { $manifest.dsh.profile.bundles = @($bundles) + $pluginName }
}

$json = $manifest | ConvertTo-Json -Depth 32
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($manifestPath, $json, $utf8NoBom)

# Post-condition check: re-read and confirm the expected state, so a stale editor
# or a locked file never silently leaves a half-written manifest.
$check = [System.IO.File]::ReadAllText($manifestPath) | ConvertFrom-Json
$inBundles = @($check.dsh.profile.bundles) -contains $pluginName
$inDeps = $check.PSObject.Properties['dependencies'] -and $check.dependencies.PSObject.Properties[$pluginName]
if ($Uninstall) {
  if ($inBundles -or $inDeps) { throw 'uninstall did not remove the manifest entries; please check the file manually' }
} else {
  if (-not $inBundles -or -not $inDeps) { throw 'install did not write the manifest entries; please check the file manually' }
  if (-not (Test-Path (Join-Path $targetDir 'lib\client.js'))) { throw "plugin files missing under $targetDir" }
}

Write-Output ("{0} {1}" -f ($(if ($Uninstall) { 'removed' } else { 'installed' })), $pluginName)
Write-Output "profile : $ProfileDir"
Write-Output "backup  : $manifestPath.bak-$stamp"
Write-Output ''
Write-Output 'Done. Fully quit DeepSeek Harness (tray icon > Quit), then reopen it.'
Write-Output 'Only after the restart does the app recompose its plugin tree and load the chip.'
