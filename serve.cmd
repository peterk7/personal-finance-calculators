@echo off
rem Serve the site locally, the way GitHub Pages will serve it.
rem Usage: serve.cmd [port]   (default port 8000)
rem
rem Runs ENTIRELY in this terminal window - no background processes.
rem The server lives and dies with this window: Ctrl+C stops it, and
rem closing the window kills it too. Open http://localhost:8000/ yourself.
setlocal
set PORT=%1
if "%PORT%"=="" set PORT=8000

cd /d "%~dp0"
echo Serving http://localhost:%PORT%/  (Ctrl+C to stop)
python -m http.server %PORT%
