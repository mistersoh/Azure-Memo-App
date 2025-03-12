@echo off
echo Building Azure DevOps Memo App...

REM Install dependencies
call npm install

REM Build the app
call npm run build

echo.
echo Build completed! Find your executable in the 'dist' folder.
echo.
pause 