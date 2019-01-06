@ECHO off
SET url="C:\Users\fdefr\Downloads\Finance.xlsx"
SET goo="https://docs.google.com/spreadsheets/d/e/2PACX-1vQOD1ZjNIwHLYr7Qft0UzPCAvYLlVW8kmDu8cvG6RPqtrBw5sIYkigiKDBONUfcVcL6g4Xb_j0oeZla/pub?output=xlsx"

:lo
DEL %url%
START /WAIT "" %goo%
CLS
for /l %%n in (9,-1,0) do (
  ECHO Waiting for file to be downloaded ...
  ECHO %%n secondes restantes
  TIMEOUT /t 1 /nobreak>nul
  CLS
  IF EXIST %url% GOTO el
)
SET /p retry= File not found. Check your Internet connexion. Retry (Y/N) ? 
IF %retry%==Y GOTO lo
:el
MOVE /-Y C:\Users\fdefr\Downloads\Finance.xlsx .\Data
CLS
START /B http-server
EXIT
