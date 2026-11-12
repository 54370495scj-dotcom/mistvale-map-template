@echo off
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  echo Open http://127.0.0.1:4173/ ; press Ctrl+C to stop.
  py -3 -m http.server 4173 --bind 127.0.0.1 --directory dist
  exit /b
)
where python >nul 2>nul
if %errorlevel%==0 (
  echo Open http://127.0.0.1:4173/ ; press Ctrl+C to stop.
  python -m http.server 4173 --bind 127.0.0.1 --directory dist
  exit /b
)
echo Python 3 is not installed. Open preview.html in a browser instead.
pause
