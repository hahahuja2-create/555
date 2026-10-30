$ErrorActionPreference = 'Stop'
$workspace = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$node = (Get-Command node.exe -ErrorAction Stop).Source
$logFolder = Join-Path $env:LOCALAPPDATA 'TaskMall\collection-service'
New-Item -ItemType Directory -Path $logFolder -Force | Out-Null
$logFile = Join-Path $logFolder 'worker.log'
$errorFile = Join-Path $logFolder 'worker.error.log'
foreach ($existingLog in @($logFile, $errorFile)) {
    if (Test-Path -LiteralPath $existingLog) {
        Move-Item -LiteralPath $existingLog -Destination ($existingLog + '.' + [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss-fffffff'))
    }
}
$process = Start-Process -FilePath $node -ArgumentList @('--env-file-if-exists=.env', 'scripts/collection-service.cjs', '--run') `
    -WorkingDirectory $workspace -WindowStyle Hidden -RedirectStandardOutput $logFile -RedirectStandardError $errorFile -PassThru
$process.WaitForExit()
exit $process.ExitCode
