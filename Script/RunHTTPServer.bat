@ECHO off
SET ext=".xlsx"
SET dir="C:\Users\fdefr\Downloads\"
SET gs="https://docs.google.com/spreadsheets/d/"
SET ge="/export?format=xlsx&id="

SET file="FiMs TradFi"
SET sid="1JJ7zW4GD7MzMBTatntdnojX5bZYcqI1kxMWIvc0_LTw"

SET url=%%dir%%file%%ext
SET goo=%%gs%%sid%%ge%%sid

:aaa
DEL %url%
START /WAIT "" %goo%

CLS
SET /p retry= Download spreadsheet %%file (Y/N) ?
IF %retry%==N GOTO bbb

CLS
for /l %%n in (55,-1,0) do (
  ECHO Waiting for file to be downloaded ...
  ECHO %%n secondes restantes
  TIMEOUT /t 1 /nobreak>nul
  CLS
  IF EXIST %url% GOTO zzz
)
SET /p retry= File not found. Check your Internet connexion. Retry (Y/N) ?
IF %retry%==Y GOTO aaa
:zzz
REM CHOICE /C YN /N /T 10 /D Y /M "Overwrite previous spreadsheet file (Y/N) ?"
REM SET do=%ERRORLEVEL%
REM IF %do% EQU 1 MOVE %url% .\Data
TIMEOUT /t 2 /nobreak>nul
MOVE %url% ..\Data
CLS

:bbb
SET file="FiMs Associate"
SET sid="1pMnJel8OYtwk1Zu4YgTG3JwmTA-WLIMf6OnCQlSgprU"

SET url=%%dir%%file%%ext
SET goo=%%gs%%sid%%ge%%sid

DEL %url%
START /WAIT "" %goo%

CLS
SET /p retry= Download spreadsheet %%file (Y/N) ?
IF %retry%==N GOTO ccc

CLS
for /l %%n in (55,-1,0) do (
  ECHO Waiting for file to be downloaded ...
  ECHO %%n secondes restantes
  TIMEOUT /t 1 /nobreak>nul
  CLS
  IF EXIST %url% GOTO yyy
)
SET /p retry= File not found. Check your Internet connexion. Retry (Y/N) ?
IF %retry%==Y GOTO bbb
:yyy
REM CHOICE /C YN /N /T 10 /D Y /M "Overwrite previous spreadsheet file (Y/N) ?"
REM SET do=%ERRORLEVEL%
REM IF %do% EQU 1 MOVE %url% .\Data
TIMEOUT /t 2 /nobreak>nul
MOVE %url% ..\Data
CLS


:ccc
SET file="FiMs DeFi"
SET sid="1enXnuwZExO92B5FxPB8s2Rhqlxl1p9nUY9tRaHtV1kI"

SET url=%%dir%%file%%ext
SET goo=%%gs%%sid%%ge%%sid

DEL %url%
START /WAIT "" %goo%

CLS
SET /p retry= Download spreadsheet %%file (Y/N) ?
IF %retry%==Y GOTO ddd

CLS
for /l %%n in (55,-1,0) do (
  ECHO Waiting for file to be downloaded ...
  ECHO %%n secondes restantes
  TIMEOUT /t 1 /nobreak>nul
  CLS
  IF EXIST %url% GOTO xxx
)
SET /p retry= File not found. Check your Internet connexion. Retry (Y/N) ?
IF %retry%==Y GOTO ccc
:xxx
REM CHOICE /C YN /N /T 10 /D Y /M "Overwrite previous spreadsheet file (Y/N) ?"
REM SET do=%ERRORLEVEL%
REM IF %do% EQU 1 MOVE %url% .\Data
TIMEOUT /t 2 /nobreak>nul
MOVE %url% ..\Data
CLS



:ddd
SET file="FiMs Pay"
SET sid="1lH6uLLPKZyltpxP83qUMr6veIyIQjzGm-qxaIh2ihIU"

SET url=%%dir%%file%%ext
SET goo=%%gs%%sid%%ge%%sid

DEL %url%
START /WAIT "" %goo%

CLS
SET /p retry= Download spreadsheet %%file (Y/N) ?
IF %retry%==Y GOTO end

CLS
for /l %%n in (55,-1,0) do (
  ECHO Waiting for file to be downloaded ...
  ECHO %%n secondes restantes
  TIMEOUT /t 1 /nobreak>nul
  CLS
  IF EXIST %url% GOTO www
)
SET /p retry= File not found. Check your Internet connexion. Retry (Y/N) ?
IF %retry%==Y GOTO ddd
:www
REM CHOICE /C YN /N /T 10 /D Y /M "Overwrite previous spreadsheet file (Y/N) ?"
REM SET do=%ERRORLEVEL%
REM IF %do% EQU 1 MOVE %url% .\Data
TIMEOUT /t 2 /nobreak>nul
MOVE %url% ..\Data
CLS


:end

REM Asks for the User Id, then open the browser in parallel, while the http server is starting
SET /p user= User ID ('TradFi' for FiMs TradFi, can also be void) :
START /B OpenLocalHost.bat %user%

REM Start the http server in the root folder (Install NPM first, then http-server)
CLS
CD ..
START /B http-server
EXIT
