$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskExit = 1
$secureSecret = $null
$secretPointer = [IntPtr]::Zero
try {
    if ([Console]::IsInputRedirected -or [Console]::IsOutputRedirected) { throw 'Private terminal required' }
    if ($env:GITHUB_TEST_CLIENT_ID -or $env:GITHUB_TEST_CLIENT_SECRET) { throw 'Inherited OAuth credentials are not accepted' }
    Push-Location -LiteralPath $taskRoot
    try {
        & node scripts/local-oauth.mjs prerequisites
        if ($LASTEXITCODE -ne 0) { throw 'Prerequisites unavailable; no secret requested' }
        Write-Host 'Open GitHub Settings > Developer settings > OAuth Apps > OAZ Privacy Local OAuth Test.'
        Write-Host 'Use the new independent Test App credentials only. Never use Production or Demo credentials.'
        if ((Read-Host 'Type LOCAL-TEST-APP') -cne 'LOCAL-TEST-APP') { throw 'Not confirmed' }
        $env:GITHUB_TEST_CLIENT_ID = Read-Host 'Test App Client ID (local input)'
        $secureSecret = Read-Host 'New Test App Client Secret (hidden input)' -AsSecureString
        $secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureSecret)
        $env:GITHUB_TEST_CLIENT_SECRET = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer)
        & node scripts/local-oauth.mjs start
        $taskExit = $LASTEXITCODE
    } finally { Pop-Location }
} catch {
    Write-Host 'LOCAL_OAUTH_STOP: review prerequisites or recover the local session. No raw diagnostics printed.'
} finally {
    Remove-Item Env:GITHUB_TEST_CLIENT_ID -ErrorAction SilentlyContinue
    Remove-Item Env:GITHUB_TEST_CLIENT_SECRET -ErrorAction SilentlyContinue
    if ($secretPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer) }
    if ($null -ne $secureSecret) { $secureSecret.Dispose() }
}
exit $taskExit
