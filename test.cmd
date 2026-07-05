@echo off
rem Run all model tests. Add new test files below as calculators grow.
setlocal
cd /d "%~dp0"
set FAILED=0

echo === resp-calculator ===
node resp-calculator\test.js
if errorlevel 1 set FAILED=1

if %FAILED%==1 (
  echo.
  echo SOME TESTS FAILED
  exit /b 1
)
echo.
echo ALL TEST SUITES PASSED
