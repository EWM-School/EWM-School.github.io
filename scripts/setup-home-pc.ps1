#Requires -Version 5.1
<#
.SYNOPSIS
  EWM · Keep practicing — Setup / Transição em 1 Comando para o PC de Casa (Fora do OneDrive)
.DESCRIPTION
  1. Garante a pasta limpa C:\Projetos (fora do OneDrive, livre de conflitos de caminho/lock).
  2. Localiza e preserva com segurança qualquer arquivo .env existente contendo GEMINI_API_KEY.
  3. Clona (ou atualiza via pull --rebase --autostash) https://github.com/EWM-School/EWM-School.github.io.git
     diretamente em C:\Projetos\EWM-School.github.io na branch feat/ewm-v2 (mantendo main intocada).
  4. Restaura o .env local ignorado pelo Git, instala dependências limpas (npm install --legacy-peer-deps)
     e valida que a ponte automática Casa ⇄ Trabalho (scripts/auto-sync-pull.mjs) está 100% ativa.
#>

[CmdletBinding()]
param(
  [string]$ProjectsRoot = 'C:\Projetos',
  [string]$RepoUrl = 'https://github.com/EWM-School/EWM-School.github.io.git',
  [string]$TargetBranch = 'feat/ewm-v2'
)

$ErrorActionPreference = 'Stop'

# Atualiza PATH da sessão caso Git / Node / GitHub CLI tenham sido instalados recentemente via winget
$machinePath = [System.Environment]::GetEnvironmentVariable('Path', 'Machine')
$userPath = [System.Environment]::GetEnvironmentVariable('Path', 'User')
$env:Path = "$machinePath;$userPath"

function Write-Step([string]$Message) {
  Write-Host "`n[EWM-Setup] $Message" -ForegroundColor Cyan
}

function Write-Ok([string]$Message) {
  Write-Host "[EWM-Setup] OK: $Message" -ForegroundColor Green
}

function Write-Notice([string]$Message) {
  Write-Host "[EWM-Setup] AVISO: $Message" -ForegroundColor Yellow
}

Write-Step '1/5 Verificando ferramentas essenciais (git, node, npm)...'
foreach ($cmd in @('git', 'node', 'npm')) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    throw "Ferramenta '$cmd' não encontrada no PATH. Instale Git for Windows e Node.js LTS antes de continuar."
  }
}
Write-Ok "git ($(git --version)) | node ($(node --version)) | npm ($(npm --version))"

$TargetRepoDir = Join-Path $ProjectsRoot 'EWM-School.github.io'
$TargetEnvPath = Join-Path $TargetRepoDir '.env'

Write-Step "2/5 Garantindo diretório limpo fora do OneDrive em $ProjectsRoot..."
if (-not (Test-Path -LiteralPath $ProjectsRoot)) {
  New-Item -ItemType Directory -Path $ProjectsRoot -Force | Out-Null
}
Write-Ok "Diretório base pronto: $ProjectsRoot"

Write-Step '3/5 Procurando arquivo .env local existente para preservar GEMINI_API_KEY...'
$CandidateEnvPaths = New-Object System.Collections.Generic.List[string]
$CandidateEnvPaths.Add($TargetEnvPath)
$CandidateEnvPaths.Add((Join-Path (Get-Location).Path '.env'))
if ($PSScriptRoot) {
  $CandidateEnvPaths.Add((Join-Path (Split-Path -Parent $PSScriptRoot) '.env'))
}

foreach ($baseDir in @($env:OneDrive, $env:OneDriveCommercial, (Join-Path $HOME 'OneDrive'), (Join-Path $HOME 'Desktop'))) {
  if ($baseDir -and (Test-Path -LiteralPath $baseDir)) {
    $CandidateEnvPaths.Add((Join-Path $baseDir 'EWM-School.github.io\.env'))
    $CandidateEnvPaths.Add((Join-Path $baseDir 'Projetos\EWM-School.github.io\.env'))
    $CandidateEnvPaths.Add((Join-Path $baseDir 'IGOR\Projetos\EWM-School.github.io\.env'))
  }
}

$PreservedEnvContent = $null
$PreservedEnvSource = $null
foreach ($envCandidate in ($CandidateEnvPaths | Select-Object -Unique)) {
  if ($envCandidate -and (Test-Path -LiteralPath $envCandidate)) {
    $rawContent = Get-Content -LiteralPath $envCandidate -Raw -ErrorAction SilentlyContinue
    if ($rawContent -and ($rawContent -match 'GEMINI_API_KEY\s*=\s*\S+')) {
      $PreservedEnvContent = $rawContent
      $PreservedEnvSource = $envCandidate
      break
    }
  }
}

if ($PreservedEnvContent) {
  Write-Ok "Chave GEMINI_API_KEY localizada e protegida em memória a partir de: $PreservedEnvSource"
} else {
  Write-Notice 'Nenhum .env prévio com GEMINI_API_KEY encontrado automaticamente neste PC (você poderá preenchê-lo ao final).'
}

Write-Step "4/5 Sincronizando repositório oficial em $TargetRepoDir (branch: $TargetBranch)..."
$GitFolder = Join-Path $TargetRepoDir '.git'

if (Test-Path -LiteralPath $GitFolder) {
  Push-Location $TargetRepoDir
  try {
    git fetch origin
    $currentBranch = (git rev-parse --abbrev-ref HEAD).Trim()
    if ($currentBranch -ne $TargetBranch) {
      git checkout $TargetBranch
    }
    git pull --rebase --autostash origin $TargetBranch
    Write-Ok "Repositório existente atualizado com origin/$TargetBranch."
  } finally {
    Pop-Location
  }
} else {
  if (Test-Path -LiteralPath $TargetRepoDir) {
    $existingItems = Get-ChildItem -LiteralPath $TargetRepoDir -Force | Where-Object { $_.Name -ne '.env' }
    if ($existingItems.Count -gt 0) {
      $backupDir = "${TargetRepoDir}_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
      Write-Notice "Pasta prévia sem .git detectada. Movendo backup de segurança para $backupDir..."
      Move-Item -LiteralPath $TargetRepoDir -Destination $backupDir -Force
    } elseif (Test-Path -LiteralPath $TargetEnvPath) {
      Remove-Item -LiteralPath $TargetEnvPath -Force
    }
  }

  git clone --branch $TargetBranch --single-branch $RepoUrl $TargetRepoDir
  Push-Location $TargetRepoDir
  try {
    # Mantém visibilidade remota de todas as branches sem alterar a main
    git config remote.origin.fetch '+refs/heads/*:refs/remotes/origin/*'
    git fetch origin
  } finally {
    Pop-Location
  }
  Write-Ok "Clone limpo concluído em $TargetRepoDir na branch $TargetBranch."
}

# Restaura .env preservado (100% fora do controle de versão)
if ($PreservedEnvContent) {
  [System.IO.File]::WriteAllText($TargetEnvPath, $PreservedEnvContent, (New-Object System.Text.UTF8Encoding($false)))
  Write-Ok "Arquivo .env restaurado em $TargetEnvPath."
} elseif (-not (Test-Path -LiteralPath $TargetEnvPath)) {
  $envExample = Join-Path $TargetRepoDir '.env.example'
  if (Test-Path -LiteralPath $envExample) {
    Copy-Item -LiteralPath $envExample -Destination $TargetEnvPath
    Write-Notice "Criado $TargetEnvPath a partir de .env.example — adicione sua GEMINI_API_KEY antes de testar IA/TTS."
  }
}

Write-Step '5/5 Instalando dependências limpas (npm install --legacy-peer-deps) e validando Auto-Sync...'
Push-Location $TargetRepoDir
try {
  if (Test-Path -LiteralPath $TargetEnvPath) {
    git check-ignore -q .env
    if ($LASTEXITCODE -ne 0) {
      throw 'ALERTA DE SEGURANÇA: .env não está sendo ignorado pelo .gitignore!'
    }
    Write-Ok 'Segurança confirmada: .env permanece 100% ignorado pelo Git.'
  }

  npm install --legacy-peer-deps
  if ($LASTEXITCODE -ne 0) {
    throw 'Falha durante npm install --legacy-peer-deps.'
  }

  node scripts/auto-sync-pull.mjs
  Write-Ok "Ambiente Casa pronto em $TargetRepoDir (branch $(git rev-parse --abbrev-ref HEAD))."
  Write-Host "`nPara iniciar o trabalho agora:" -ForegroundColor White
  Write-Host "  cd `"$TargetRepoDir`"; npm run dev" -ForegroundColor Green
} finally {
  Pop-Location
}
