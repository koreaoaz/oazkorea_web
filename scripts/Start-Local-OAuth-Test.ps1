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
        Write-Host '환경 검사가 완료되었습니다. 독립 앱 OAZ Privacy Local OAuth Test만 사용하세요.'
        Write-Host 'GitHub Settings > Developer settings > OAuth Apps에서 확인하세요. 운영/Demo 앱은 사용하지 마세요.'
        if ((Read-Host '테스트 앱 사용 확인: LOCAL-TEST-APP 입력') -cne 'LOCAL-TEST-APP') { throw 'Not confirmed' }
        $env:GITHUB_TEST_CLIENT_ID = Read-Host '테스트 앱 Client ID (이 로컬 콘솔에만 입력)'
        $secureSecret = Read-Host '새 테스트 앱 Client Secret (화면에 표시되지 않음)' -AsSecureString
        $secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureSecret)
        $env:GITHUB_TEST_CLIENT_SECRET = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer)
        & node scripts/local-oauth.mjs start
        $taskExit = $LASTEXITCODE
    } finally { Pop-Location }
} catch {
    Write-Host 'LOCAL_OAUTH_STOP: 사전 조건 또는 로컬 복구 상태를 확인하세요. 원문 오류와 비밀값은 출력하지 않습니다.'
} finally {
    Remove-Item Env:GITHUB_TEST_CLIENT_ID -ErrorAction SilentlyContinue
    Remove-Item Env:GITHUB_TEST_CLIENT_SECRET -ErrorAction SilentlyContinue
    if ($secretPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer) }
    if ($null -ne $secureSecret) { $secureSecret.Dispose() }
}
exit $taskExit
