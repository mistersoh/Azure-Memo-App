@echo off
echo Building Azure DevOps Memo App - All Formats

REM Install dependencies
call npm install

REM Build NSIS installer
echo Building installer version...
call npx electron-builder --win --config.win.target=nsis

REM Build portable version
echo Building portable version...
call npx electron-builder --win --config.win.target=portable

echo.
echo Build completed! Find your files in the 'dist' folder:
echo - NSIS Installer: For normal installation (.exe installer)
echo - Portable: Copy the entire folder to share as portable app
echo.
pause 