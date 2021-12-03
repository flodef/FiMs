@ECHO off
SET ext=".xlsx"
SET dir="C:\Users\fdefr\Downloads\"

SET file="FiMs Main"
SET url=%%dir%%file%%ext
SET goo="https://docs.google.com/spreadsheets/d/e/2PACX-1vQOD1ZjNIwHLYr7Qft0UzPCAvYLlVW8kmDu8cvG6RPqtrBw5sIYkigiKDBONUfcVcL6g4Xb_j0oeZla/pub?output=xlsx"

:lo
DEL %url%
START /WAIT "" %goo%

CLS
SET /p retry= Download spreadsheet %%file (Y/N) ?
IF %retry%==Y GOTO ab

CLS
for /l %%n in (55,-1,0) do (
  ECHO Waiting for file to be downloaded ...
  ECHO %%n secondes restantes
  TIMEOUT /t 1 /nobreak>nul
  CLS
  IF EXIST %url% GOTO el
)
SET /p retry= File not found. Check your Internet connexion. Retry (Y/N) ?
IF %retry%==Y GOTO lo
:el
REM CHOICE /C YN /N /T 10 /D Y /M "Overwrite previous spreadsheet file (Y/N) ?"
REM SET do=%ERRORLEVEL%
REM IF %do% EQU 1 MOVE %url% .\Data
TIMEOUT /t 2 /nobreak>nul
MOVE %url% .\Data
CLS

:ab
SET file="FiMs Associate"
SET url=%%dir%%file%%ext
SET goo="https://docs.google.com/spreadsheets/d/1pMnJel8OYtwk1Zu4YgTG3JwmTA-WLIMf6OnCQlSgprU/export?format=xlsx&id=1pMnJel8OYtwk1Zu4YgTG3JwmTA-WLIMf6OnCQlSgprU"

DEL %url%
START /WAIT "" %goo%

CLS
SET /p retry= Download spreadsheet %%file (Y/N) ?
IF %retry%==Y GOTO ht

CLS
for /l %%n in (55,-1,0) do (
  ECHO Waiting for file to be downloaded ...
  ECHO %%n secondes restantes
  TIMEOUT /t 1 /nobreak>nul
  CLS
  IF EXIST %url% GOTO cd
)
SET /p retry= File not found. Check your Internet connexion. Retry (Y/N) ?
IF %retry%==Y GOTO ab
:cd
REM CHOICE /C YN /N /T 10 /D Y /M "Overwrite previous spreadsheet file (Y/N) ?"
REM SET do=%ERRORLEVEL%
REM IF %do% EQU 1 MOVE %url% .\Data
TIMEOUT /t 2 /nobreak>nul
MOVE %url% .\Data
CLS

:ht
START /B http-server
EXIT
