@echo off
echo Starting the Context Engine...
echo Current directory: %CD%
echo Node version: 
node --version

echo Attempting to start the server...
node src/index.js
echo Server exit code: %ERRORLEVEL%

pause