# Publish this repository to GitHub and Gitee.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\publish.ps1 -GithubUser your-name -GiteeUser your-name
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\publish.ps1            # asks for the names
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\publish.ps1 -DryRun    # only check remotes/repos
#
# Before running: create two EMPTY public repositories named "dsh-balance-chip"
# (do not initialize them with a README/.gitignore), one on GitHub and one on Gitee.
#
# Authentication: the first `git push` asks git-credential-manager for credentials.
# GitHub opens a browser OAuth window; Gitee uses your account + a personal token
# as the password. Nothing is stored in this repository.
[CmdletBinding()]
param(
  [string]$GithubUser,
  [string]$GiteeUser,
  [string]$RepoName = 'dsh-balance-chip',
  [switch]$SkipGithub,
  [switch]$SkipGitee,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repoRoot
try {
  if (-not (Test-Path (Join-Path $repoRoot '.git'))) {
    throw "not a git repository: $repoRoot"
  }
  if (-not $SkipGithub -and -not $GithubUser) { $GithubUser = (Read-Host 'GitHub username').Trim() }
  if (-not $SkipGitee -and -not $GiteeUser) { $GiteeUser = (Read-Host 'Gitee username').Trim() }
  if (-not $SkipGithub -and -not $GithubUser) { throw 'a GitHub username is required, or use -SkipGithub' }
  if (-not $SkipGitee -and -not $GiteeUser) { throw 'a Gitee username is required, or use -SkipGitee' }

  $branch = (git rev-parse --abbrev-ref HEAD).Trim()
  if ($LASTEXITCODE -ne 0) { throw 'cannot read the current branch (does the repository have a commit?)' }

  function Set-Remote([string]$Name, [string]$Url) {
    $existing = @(git remote)
    if ($existing -contains $Name) { git remote remove $Name | Out-Null }
    git remote add $Name $Url
    Write-Output "remote $Name -> $Url"
  }

  if (-not $SkipGithub) { Set-Remote 'origin' "https://github.com/$GithubUser/$RepoName.git" }
  if (-not $SkipGitee) { Set-Remote 'gitee' "https://gitee.com/$GiteeUser/$RepoName.git" }

  Write-Output ''
  Write-Output 'remote check (public repository reachable over HTTPS):'
  $problems = @()
  $checks = @()
  if (-not $SkipGithub) { $checks += @{ remote = 'origin'; url = "https://github.com/$GithubUser/$RepoName" } }
  if (-not $SkipGitee) { $checks += @{ remote = 'gitee'; url = "https://gitee.com/$GiteeUser/$RepoName" } }
  foreach ($check in $checks) {
    $reachable = $false
    try {
      $response = Invoke-WebRequest -Uri $check.url -Method Head -TimeoutSec 15 -UseBasicParsing -ErrorAction Stop
      $reachable = $response.StatusCode -ge 200 -and $response.StatusCode -lt 400
    } catch {
      $reachable = $false
    }
    if ($reachable) {
      Write-Output "  ok      $($check.remote)  $($check.url)"
    } else {
      Write-Output "  MISSING $($check.remote)  $($check.url)  (create the empty public repository first)"
      $problems += $check.remote
    }
  }

  if ($DryRun) {
    Write-Output ''
    if ($problems.Count -gt 0) { Write-Output "dry run: create the missing repositories, then re-run without -DryRun." }
    else { Write-Output "dry run: remotes exist; re-run without -DryRun to push." }
    return
  }
  if ($problems.Count -gt 0) { throw "missing remote repositories: $($problems -join ', ')" }

  foreach ($remote in @(if (-not $SkipGithub) { 'origin' }; if (-not $SkipGitee) { 'gitee' })) {
    Write-Output ''
    Write-Output "pushing $branch to $remote ..."
    git push -u $remote $branch
    if ($LASTEXITCODE -ne 0) { throw "push to $remote failed (authentication or permission). Run 'git push -u $remote $branch' in your own terminal to complete the login." }
  }
  Write-Output ''
  Write-Output 'published.'
  git remote -v
} finally {
  Pop-Location
}
