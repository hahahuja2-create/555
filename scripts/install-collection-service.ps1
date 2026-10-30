param([switch] $Start, [switch] $Stop)
$ErrorActionPreference = 'Stop'
if ($Start -and $Stop) { throw 'Select Start or Stop.' }
$workspace = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$runner = Join-Path $PSScriptRoot 'run-collection-service.ps1'
$worker = Join-Path $PSScriptRoot 'collection-service.cjs'
if (-not (Test-Path -LiteralPath $runner -PathType Leaf) -or -not (Test-Path -LiteralPath $worker -PathType Leaf)) {
    throw 'Collection service files are missing.'
}
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$hash = [Security.Cryptography.SHA256]::Create()
try { $scope = ([BitConverter]::ToString($hash.ComputeHash([Text.Encoding]::UTF8.GetBytes($workspace))).Replace('-', '')).Substring(0, 12) }
finally { $hash.Dispose() }
$taskName = 'TaskMall Collection ' + $scope
$executable = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$arguments = '-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File "' + $runner + '"'
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing -and ($existing.Actions.Count -ne 1 -or $existing.Actions[0].Execute -ne $executable -or $existing.Actions[0].Arguments -ne $arguments)) {
    throw 'An unrelated scheduled task uses this name; it was not changed.'
}
if ($Stop) {
    Set-Location -LiteralPath $workspace
    $node = (Get-Command node.exe -ErrorAction Stop).Source
    & $node --env-file-if-exists=.env scripts/collection-service.cjs --stop
    if ($LASTEXITCODE -ne 0) { throw 'The collection stop request could not be stored.' }
    if ($existing) {
        Disable-ScheduledTask -TaskName $taskName | Out-Null
        Stop-ScheduledTask -TaskName $taskName
    }
    [PSCustomObject]@{ Task = $taskName; State = 'Disabled'; Transfers = 'No new collection cycles' }
    exit 0
}
if (-not $existing) {
    $action = New-ScheduledTaskAction -Execute $executable -Argument $arguments -WorkingDirectory $workspace
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $identity.Name
    $principal = New-ScheduledTaskPrincipal -UserId $identity.Name -LogonType Interactive -RunLevel Limited
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
        -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval ([TimeSpan]::FromMinutes(1))
    $task = New-ScheduledTask -Action $action -Trigger $trigger -Principal $principal -Settings $settings `
        -Description 'TaskMall USDT collection using the protected local wallet and verified spending policy.'
    Register-ScheduledTask -TaskName $taskName -InputObject $task | Out-Null
    Disable-ScheduledTask -TaskName $taskName | Out-Null
}
if ($Start) {
    Set-Location -LiteralPath $workspace
    $node = (Get-Command node.exe -ErrorAction Stop).Source
    & $node --env-file-if-exists=.env scripts/collection-service.cjs --check
    if ($LASTEXITCODE -ne 0) { throw 'Collection authorization is incomplete; the scheduled worker was not enabled.' }
    & $node --env-file-if-exists=.env scripts/collection-service.cjs --resume
    if ($LASTEXITCODE -ne 0) { throw 'The collection start request could not be stored.' }
    Enable-ScheduledTask -TaskName $taskName | Out-Null
    Start-ScheduledTask -TaskName $taskName
}
$current = Get-ScheduledTask -TaskName $taskName
[PSCustomObject]@{ Task = $taskName; State = [string]$current.State; User = $identity.Name; Start = 'Windows sign-in'; Protected = 'Windows current-user wallet' }
