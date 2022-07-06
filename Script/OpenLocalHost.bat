@ECHO off

TIMEOUT /t 5 /nobreak>nul
IF NOT "%1"=="" (
  SET arg="?app=%1"
  IF NOT "%2"=="" (
    SET arg="?app=%1&id=%2"
  )
) ELSE (
  IF NOT "%2"=="" (
    SET arg="?id=%1"
  ) ELSE (
    SET arg=""
  )
) 
xdg-open "http://127.0.0.1:8080/%arg%"
