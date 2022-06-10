@ECHO off

CD ..
FOR %%a IN ("*GoogleAppsScript*/") DO (
  CD "%%a"
  START /B /WAIT Push.bat
  CD ..
)
