@echo off
REM AzadiPOS Update Package Creator (Windows)
REM Usage: create-update.bat [version] [description]

setlocal enabledelayedexpansion

set VERSION=%~1
if "%VERSION%"=="" set VERSION=1.0.0

set DESCRIPTION=%~2
if "%DESCRIPTION%"=="" set DESCRIPTION=Software update

for /f "tokens=2-4 delims=/" %%a in ("%date%") do set DATE=%%c%%a%%b
set OUTPUT_NAME=azadipos-update-v%VERSION%-%DATE%

set SCRIPT_DIR=%~dp0
set PROJECT_DIR=%SCRIPT_DIR%..
set OUTPUT_DIR=%PROJECT_DIR%\updates

echo === AzadiPOS Update Package Creator ===
echo Version: %VERSION%
echo Description: %DESCRIPTION%
echo Output: %OUTPUT_DIR%\%OUTPUT_NAME%.zip
echo.

if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"

REM Create staging directory
set STAGING=%TEMP%\azadipos_update_%RANDOM%
mkdir "%STAGING%"

echo Staging update files...

REM Copy files using robocopy, excluding unwanted directories
robocopy "%PROJECT_DIR%" "%STAGING%" /E /NFL /NDL /NJH /NJS ^^
  /XD node_modules .next .build .git prisma .updates updates electron nextjs_space server-setup .github dist build out ^^
  /XF .env .update-history.json *.log .DS_Store

REM Create update manifest
(
echo {
echo   "version": "%VERSION%",
echo   "description": "%DESCRIPTION%",
echo   "createdAt": "%DATE%",
echo   "sourceDir": ".",
echo   "compatibleWith": "^>^=1.0.0"
echo }
) > "%STAGING%\update-manifest.json"

echo Creating zip package...

REM Create zip using PowerShell
powershell -Command "Compress-Archive -Path '%STAGING%\*' -DestinationPath '%OUTPUT_DIR%\%OUTPUT_NAME%.zip' -Force"

echo.
echo === Update Package Created ===
echo File: %OUTPUT_DIR%\%OUTPUT_NAME%.zip
echo.
echo To apply this update:
echo   1. Copy the .zip file to a USB drive
echo   2. On each terminal/server, go to Admin ^> Settings ^> Software Update
echo   3. Click 'Choose File', select the .zip from the USB drive
echo   4. Click 'Apply Update'
echo   5. Restart the application

REM Cleanup
rd /s /q "%STAGING%" 2>nul

pause
