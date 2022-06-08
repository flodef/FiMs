@ECHO off

TIMEOUT /t 5 /nobreak>nul
IF NOT "%1"=="" (
  SET id="?id=%1"
) else (
  SET id=""
)
xdg-open "http://127.0.0.1:8080/%id%"