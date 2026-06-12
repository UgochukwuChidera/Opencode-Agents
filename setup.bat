@echo off
setlocal enabledelayedexpansion

set "REPO_DIR=%~dp0"
set "AGENTS_TARGET=%REPO_DIR%agents"
set "TOOLS_TARGET=%REPO_DIR%tools"
set "SKILLS_TARGET=%REPO_DIR%skills"
set "OPENCODE_CONFIG_DIR=%USERPROFILE%\.config\opencode"
set "OPENCODE_AGENTS_DIR=%OPENCODE_CONFIG_DIR%\agents"
set "OPENCODE_TOOLS_DIR=%OPENCODE_CONFIG_DIR%\tools"
set "OPENCODE_SKILLS_DIR=%OPENCODE_CONFIG_DIR%\skills"

:: Ensure the parent config directory exists
if not exist "%OPENCODE_CONFIG_DIR%" mkdir "%OPENCODE_CONFIG_DIR%"

:: ── Agents junction ────────────────────────────────────────────────
if exist "%OPENCODE_AGENTS_DIR%" (
  echo Removing existing: %OPENCODE_AGENTS_DIR%
  rmdir /s /q "%OPENCODE_AGENTS_DIR%"
)
echo Creating junction: %OPENCODE_AGENTS_DIR% -^> %AGENTS_TARGET%
mklink /J "%OPENCODE_AGENTS_DIR%" "%AGENTS_TARGET%"
echo   Agents linked.

:: ── Tools junction ─────────────────────────────────────────────────
if exist "%OPENCODE_TOOLS_DIR%" (
  echo Removing existing: %OPENCODE_TOOLS_DIR%
  rmdir /s /q "%OPENCODE_TOOLS_DIR%"
)
echo Creating junction: %OPENCODE_TOOLS_DIR% -^> %TOOLS_TARGET%
mklink /J "%OPENCODE_TOOLS_DIR%" "%TOOLS_TARGET%"
echo   Tools linked.

:: ── Skills junction ────────────────────────────────────────────────
if exist "%OPENCODE_SKILLS_DIR%" (
  echo Removing existing: %OPENCODE_SKILLS_DIR%
  rmdir /s /q "%OPENCODE_SKILLS_DIR%"
)
echo Creating junction: %OPENCODE_SKILLS_DIR% -^> %SKILLS_TARGET%
mklink /J "%OPENCODE_SKILLS_DIR%" "%SKILLS_TARGET%"
echo   Skills linked.

echo.
echo Done! opencode agents, tools, and skills are linked.
echo   Agents: %AGENTS_TARGET%
echo   Tools:  %TOOLS_TARGET%
echo   Skills: %SKILLS_TARGET%
echo.
echo IMPORTANT: Make sure your opencode.jsonc has the plugin entry:
echo   "plugin": ["./tools/index.mjs"]
echo.

pause
