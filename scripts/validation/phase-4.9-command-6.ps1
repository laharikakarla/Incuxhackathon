# AICUXORA Phase 4.9 Command 6 — read-only diagnostic; not a migration.
# Only the disposable project reference below is targeted. The CLI environment
# label is not proof of project identity. Review the resolved project line.

$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = 'Stop'
$previousTelemetry = [Environment]::GetEnvironmentVariable(
    'SUPABASE_TELEMETRY_DISABLED',
    [EnvironmentVariableTarget]::Process
)

$expectedProjectName = 'incuxai-hackathon-validation'
$expectedProjectRef = 'bhnhhaurdnnalcozsviq'
$sql = @'
SELECT n.nspname AS relation_schema, c.relname AS relation_name,
       c.relkind AS relation_kind, pg_get_userbyid(c.relowner) AS relation_owner,
       c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS force_rls
FROM pg_catalog.pg_class AS c
JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r','p','v','m','f')
ORDER BY c.relkind, c.relname;
'@

$runId = [guid]::NewGuid().ToString('N')
$sqlFile = Join-Path $env:TEMP ("aicuxora-phase49-command6-$runId.sql")
$stdoutFile = Join-Path $env:TEMP ("aicuxora-phase49-command6-$runId.stdout.tmp")
$stderrFile = Join-Path $env:TEMP ("aicuxora-phase49-command6-$runId.stderr.tmp")
$sqlFileCreated = $false
$stdoutFileCreated = $false
$stderrFileCreated = $false
$sqlFileRemoved = $false
$stdoutFileRemoved = $false
$stderrFileRemoved = $false
$telemetryRestored = $false
$telemetryRestoreFailure = $null
$wrapperFailure = $null
$cliExitCode = $null
$stdoutLines = @()
$stderrLines = @()
$sqlStream = $null
$stdoutStream = $null
$stderrStream = $null

try {
    $encoding = [System.Text.UTF8Encoding]::new($false)

    $sqlStream = [System.IO.File]::Open(
        $sqlFile,
        [System.IO.FileMode]::CreateNew,
        [System.IO.FileAccess]::Write,
        [System.IO.FileShare]::None
    )
    $sqlFileCreated = $true
    $sqlBytes = $encoding.GetBytes($sql)
    $sqlStream.Write($sqlBytes, 0, $sqlBytes.Length)
    $sqlStream.Dispose()
    $sqlStream = $null

    $stdoutStream = [System.IO.File]::Open(
        $stdoutFile,
        [System.IO.FileMode]::CreateNew,
        [System.IO.FileAccess]::Write,
        [System.IO.FileShare]::None
    )
    $stdoutFileCreated = $true
    $stdoutStream.Dispose()
    $stdoutStream = $null

    $stderrStream = [System.IO.File]::Open(
        $stderrFile,
        [System.IO.FileMode]::CreateNew,
        [System.IO.FileAccess]::Write,
        [System.IO.FileShare]::None
    )
    $stderrFileCreated = $true
    $stderrStream.Dispose()
    $stderrStream = $null

    [Environment]::SetEnvironmentVariable('SUPABASE_TELEMETRY_DISABLED', '1', [EnvironmentVariableTarget]::Process)
    $ErrorActionPreference = 'Continue'
    $LASTEXITCODE = 1
    & npx --no-install supabase db query --file "$sqlFile" --remote=bhnhhaurdnnalcozsviq --read-only 1> $stdoutFile 2> $stderrFile
    $cliExitCode = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'

    $stdoutLines = [System.IO.File]::ReadAllLines($stdoutFile)
    $stderrLines = [System.IO.File]::ReadAllLines($stderrFile)
}
catch {
    $wrapperFailure = $_.Exception.Message
}
finally {
    if ($sqlStream) { $sqlStream.Dispose() }
    if ($stdoutStream) { $stdoutStream.Dispose() }
    if ($stderrStream) { $stderrStream.Dispose() }

    if ($sqlFileCreated -and (Test-Path -LiteralPath $sqlFile)) {
        Remove-Item -LiteralPath $sqlFile -Force -ErrorAction SilentlyContinue
    }
    if ($stdoutFileCreated -and (Test-Path -LiteralPath $stdoutFile)) {
        Remove-Item -LiteralPath $stdoutFile -Force -ErrorAction SilentlyContinue
    }
    if ($stderrFileCreated -and (Test-Path -LiteralPath $stderrFile)) {
        Remove-Item -LiteralPath $stderrFile -Force -ErrorAction SilentlyContinue
    }

    $sqlFileRemoved = -not (Test-Path -LiteralPath $sqlFile -ErrorAction SilentlyContinue)
    $stdoutFileRemoved = -not (Test-Path -LiteralPath $stdoutFile -ErrorAction SilentlyContinue)
    $stderrFileRemoved = -not (Test-Path -LiteralPath $stderrFile -ErrorAction SilentlyContinue)

    try {
        [Environment]::SetEnvironmentVariable('SUPABASE_TELEMETRY_DISABLED', $previousTelemetry, [EnvironmentVariableTarget]::Process)
        $telemetryRestored = $true
    }
    catch {
        $telemetryRestoreFailure = $_.Exception.Message
    }

    $ErrorActionPreference = $previousErrorActionPreference
}

function ConvertTo-SanitizedLine {
    param([string]$Line)

    $safeLine = $Line
    $safeLine = $safeLine -replace '(?i)\b(?:postgres(?:ql)?|https?)://[^\s"''<>]+', '[REDACTED URI]'
    $safeLine = $safeLine -replace '(?i)\b(password|access[_-]?token|refresh[_-]?token|api[_-]?key|service[_-]?role[_-]?key|secret|authorization)(\s*[:=]\s*)("[^"]*"|''[^'']*''|\S+)', '$1$2[REDACTED]'
    $safeLine = $safeLine -replace '(?i)\bBearer\s+\S+', 'Bearer [REDACTED]'
    $safeLine = $safeLine -replace '\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b', '[REDACTED TOKEN]'
    $safeLine = $safeLine -replace '\b(?:sbp|sb_secret|sb_publishable)_[A-Za-z0-9_-]+\b', '[REDACTED TOKEN]'
    $safeLine = $safeLine -replace '(?<![A-Za-z0-9])[A-Za-z0-9_+/=-]{40,}(?![A-Za-z0-9])', '[REDACTED LONG TOKEN-LIKE VALUE]'
    return $safeLine
}

function Write-SanitizedLines {
    param(
        [string]$StreamName,
        [string[]]$Lines
    )

    Write-Host "--- CLI $StreamName (common credential formats redacted) ---"
    foreach ($line in $Lines) {
        Write-Host (ConvertTo-SanitizedLine -Line $line)
    }
}

Write-SanitizedLines -StreamName 'standard output' -Lines $stdoutLines
Write-SanitizedLines -StreamName 'standard error' -Lines $stderrLines

$allCliLines = @($stdoutLines) + @($stderrLines)
$targetLine = $allCliLines |
    Where-Object { $_.Contains($expectedProjectName) -and $_.Contains($expectedProjectRef) } |
    Select-Object -First 1
if ($targetLine) {
    Write-Host ("CLI project-target line: " + (ConvertTo-SanitizedLine -Line $targetLine))
}
else {
    Write-Host 'CLI project target: NOT CONFIRMED from output; the environment label is not project identity evidence.'
}

if ($null -eq $cliExitCode) {
    Write-Host 'CLI exit code: NOT CAPTURED (the CLI may not have started).'
}
else {
    Write-Host "CLI exit code: $cliExitCode"
}
Write-Host "SQL temporary file removed: $sqlFileRemoved"
Write-Host "stdout capture file removed: $stdoutFileRemoved"
Write-Host "stderr capture file removed: $stderrFileRemoved"
Write-Host "Telemetry setting restored: $telemetryRestored"

if ($telemetryRestoreFailure) {
    Write-Host "RESULT: PowerShell script failure while restoring telemetry: $telemetryRestoreFailure"
}
elseif ($wrapperFailure) {
    Write-Host "RESULT: PowerShell script failure (CLI status may be unavailable): $wrapperFailure"
}
elseif (-not $sqlFileRemoved -or -not $stdoutFileRemoved -or -not $stderrFileRemoved) {
    Write-Host 'RESULT: Cleanup failure; one or more exact temporary files remain.'
}
elseif ($null -eq $cliExitCode) {
    Write-Host 'RESULT: PowerShell wrapper failure; no CLI exit code was captured.'
}
elseif ($cliExitCode -ne 0) {
    Write-Host "RESULT: Supabase CLI failure; exit code $cliExitCode. Review the displayed stderr. Do not retry automatically."
}
elseif (-not $targetLine) {
    Write-Host 'RESULT: CLI completed, but project reference was not confirmed from its output. Do not accept the inventory.'
}
else {
    Write-Host 'RESULT: CLI query completed successfully and the expected project reference appeared in CLI output.'
}
