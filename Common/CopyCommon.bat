@ECHO off

CD ..
FOR %%a IN ("*GoogleAppsScript*/") DO (
  CD "%%a"
  MOVE ..\Common\Common.js .
  CD ..
)
