@echo off
setlocal enabledelayedexpansion

set "REPO_DIR=%~dp0"
set "AGENTS_TARGET=%REPO_DIR%agents"

:: Determine the opencode global agents directory on Windows
set "OPENCODE_AGENTS_DIR=%USERPROFILE%\.config\opencode\agents"
if not exist "%USERPROFILE%\.config\opencode" mkdir "%USERPROFILE%\.config\opencode"

:: Remove existing agents directory/junction if it exists
if exist "%OPENCODE_AGENTS_DIR%" (
  echo Removing existing: %OPENCODE_AGENTS_DIR%
  rmdir /s /q "%OPENCODE_AGENTS_DIR%"
)

:: Create the directory junction
echo Creating junction: %OPENCODE_AGENTS_DIR% -^> %AGENTS_TARGET%
mklink /J "%OPENCODE_AGENTS_DIR%" "%AGENTS_TARGET%"

echo Done! opencode agents are now linked to: %AGENTS_TARGET%
dir "%OPENCODE_AGENTS_DIR%"

pause
