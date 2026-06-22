@echo off
setlocal enabledelayedexpansion

echo ==========================================
echo   Opencode-Agents Windows Setup
echo ==========================================
echo.

set "REPO_DIR=%~dp0"
set "AGENTS_TARGET=%REPO_DIR%agents"
set "TOOLS_TARGET=%REPO_DIR%tools"
set "SKILLS_TARGET=%REPO_DIR%skills"
set "SPEC_TARGET=%REPO_DIR%.spec"
set "OPENCODE_CONFIG_DIR=%USERPROFILE%\.config\opencode"
set "OPENCODE_AGENTS_DIR=%OPENCODE_CONFIG_DIR%\agents"
set "OPENCODE_TOOLS_DIR=%OPENCODE_CONFIG_DIR%\tools"
set "OPENCODE_SKILLS_DIR=%OPENCODE_CONFIG_DIR%\skills"
set "OPENCODE_SPEC_DIR=%OPENCODE_CONFIG_DIR%\.spec"

echo ==^> Config dir: %OPENCODE_CONFIG_DIR%

:: Ensure the parent config directory exists
if not exist "%OPENCODE_CONFIG_DIR%" mkdir "%OPENCODE_CONFIG_DIR%"

:: ── Utility: create junction ─────────────────────────────────────
:link_dir
set "TARGET=%~1"
set "LINK=%~2"
set "NAME=%~3"
if exist "!LINK!" (
  echo   Removing existing: !LINK!
  rmdir /s /q "!LINK!"
)
mklink /J "!LINK!" "!TARGET!" >nul
echo   ✅ !NAME! linked: !LINK! -^> !TARGET!
goto :eof

:: ── Link Agents ──────────────────────────────────────────────────
call :link_dir "%AGENTS_TARGET%" "%OPENCODE_AGENTS_DIR%" "Agents"

:: ── Link Tools ───────────────────────────────────────────────────
call :link_dir "%TOOLS_TARGET%" "%OPENCODE_TOOLS_DIR%" "Tools"

:: ── Link Skills ──────────────────────────────────────────────────
call :link_dir "%SKILLS_TARGET%" "%OPENCODE_SKILLS_DIR%" "Skills"

:: ── Link .spec ───────────────────────────────────────────────────
if exist "%SPEC_TARGET%" (
  call :link_dir "%SPEC_TARGET%" "%OPENCODE_SPEC_DIR%" ".spec/"
) else (
  echo   ⚠️  No .spec/ directory at %SPEC_TARGET% — skipping
)

:: ── Register plugin in opencode.jsonc ────────────────────────────
set "JSONC_FILE=%OPENCODE_CONFIG_DIR%\opencode.jsonc"
if exist "%JSONC_FILE%" (
  >nul 2>&1 findstr /c:"plugin" "%JSONC_FILE%"
  if !errorlevel! equ 0 (
    echo   ✅ Plugin already registered in opencode.jsonc
  ) else (
    echo   ⚠️  Plugin not registered. Attempting auto-registration...
    powershell -NoProfile -Command ^
      "$c = Get-Content '%JSONC_FILE%';" ^
      "$i = $c.Count - 1;" ^
      "while ($i -ge 0 -and $c[$i].Trim() -eq '') { $i-- };" ^
      "if ($i -ge 0 -and $c[$i].Trim() -eq '}') {" ^
      "  $c[$i-1] = $c[$i-1] + ',';" ^
      "  $c[$i] = '    \"plugin\": [\"./tools/index.mjs\"]';" ^
      "  $c += '}';" ^
      "  Set-Content '%JSONC_FILE%' -Value $c;" ^
      "  Write-Host 'SUCCESS'" ^
      "}"
    if !errorlevel! equ 0 (
      echo   ✅ Plugin registered in opencode.jsonc
    ) else (
      echo   ❌ Could not auto-register plugin. Add this line manually:
      echo      "plugin": ["./tools/index.mjs"]
    )
  )
) else (
  echo   Creating opencode.jsonc with plugin entry...
  (
    echo {
    echo   "$schema": "https://opencode.ai/config.json",
    echo   "plugin": ["./tools/index.mjs"]
    echo }
  ) > "%JSONC_FILE%"
  echo   ✅ Created opencode.jsonc with plugin entry
)
:: ── Count resources ──────────────────────────────────────────────
set AGENT_COUNT=0
for %%f in ("%AGENTS_TARGET%\*.md") do set /a AGENT_COUNT+=1

set TOOL_COUNT=0
for %%f in ("%TOOLS_TARGET%\*.mjs") do set /a TOOL_COUNT+=1

set SKILL_COUNT=0
for /d %%d in ("%SKILLS_TARGET%\*") do set /a SKILL_COUNT+=1

:: ── Detect .spec link status ─────────────────────────────────────
set "SPEC_STATUS=not linked"
if exist "%OPENCODE_SPEC_DIR%" set "SPEC_STATUS=linked"

:: ── Summary table ────────────────────────────────────────────────
echo.
echo ==========================================
echo   ✅ Setup Complete!
echo ==========================================
echo   OS:       Windows
echo   Agents:   %AGENT_COUNT% linked
echo   Tools:    %TOOL_COUNT% linked
echo   Skills:   %SKILL_COUNT% linked
echo   .spec/:   %SPEC_STATUS%
echo   Plugin:   registered
echo ==========================================
echo.
echo   Repo:     %REPO_DIR%
echo   Agents:   %AGENTS_TARGET%
echo   Tools:    %TOOLS_TARGET%
echo   Skills:   %SKILLS_TARGET%
echo   .spec:    %SPEC_TARGET%
echo.
echo Restart opencode to load everything.
echo.

pause
