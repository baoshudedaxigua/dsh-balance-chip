# Configure the GitHub + Gitee remotes for this repository.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\set-remotes.ps1 -GithubUser your-name -GiteeUser your-name
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\set-remotes.ps1 -Remove
#
# Both platforms are pushed from the same checkout: `git push origin main` (GitHub)
# and `git push gitee main` (Gitee). See PUBLISHING.md for authentication notes.
[CmdletBinding()]
param(
  [string]$GithubUser,
  [string]$GiteeUser,
  [string]$RepoName = 'dsh-balance-chip',
  [switch]$Remove
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repoRoot
try {
  if (-not (Test-Path (Join-Path $repoRoot '.git'))) {
    throw "not a git repository: $repoRoot (run 'git init -b main' first, or clone the repository)"
  }

  $current = @(git remote)
  function Set-Remote([string]$Name, [string]$Url) {
    if ($current -contains $Name) { git remote remove $Name | Out-Null }
    git remote add $Name $Url
    if ($LASTEXITCODE -ne 0) { throw "failed to add remote $Name" }
    Write-Output "$Name -> $Url"
  }

  if ($Remove) {
    foreach ($name in @('origin', 'gitee')) {
      if ($current -contains $name) {
        git remote remove $name | Out-Null
        Write-Output "removed remote $name"
      }
    }
    return
  }

  if (-not $GithubUser -and -not $GiteeUser) {
    throw 'pass -GithubUser, -GiteeUser, or both (or -Remove)'
  }
  if ($GithubUser) { Set-Remote 'origin' "https://github.com/$GithubUser/$RepoName.git" }
  if ($GiteeUser) { Set-Remote 'gitee' "https://gitee.com/$GiteeUser/$RepoName.git" }

  Write-Output ''
  Write-Output 'Remotes:'
  git remote -v
  Write-Output ''
  Write-Output 'Create the two PUBLIC repositories with the same name on the websites, then:'
  Write-Output "  git push -u origin $(git rev-parse --abbrev-ref HEAD)"
  Write-Output "  git push gitee $(git rev-parse --abbrev-ref HEAD)"
} finally {
  Pop-Location
}
