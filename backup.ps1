# Creates a timestamped zip snapshot of the app in .\backups
# Usage:  npm run backup            (label: snapshot)
#         npm run backup -- cancel  (label: cancel)
param([string]$Label = 'snapshot')

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$dir = Join-Path $root 'backups'
New-Item -ItemType Directory -Force $dir | Out-Null

$stamp = Get-Date -Format 'yyyy-MM-dd-HHmmss'
$zip = Join-Path $dir "aquatrack-$Label-$stamp.zip"

$items = @('server.js', 'seed.js', 'package.json', 'config.json', 'README.md', 'public', 'supabase') |
  ForEach-Object { Join-Path $root $_ } |
  Where-Object { Test-Path $_ }

Compress-Archive -Path $items -DestinationPath $zip -Force
Write-Host "Backup created: $zip"
